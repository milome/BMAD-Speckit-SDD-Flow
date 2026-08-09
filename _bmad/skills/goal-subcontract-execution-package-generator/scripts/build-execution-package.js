#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const {
  createChildIdentityMap,
  createChildPacket,
  createCommitPolicy,
  createExecutionPolicy,
  createHandoffTemplate,
  createTaskReportTemplate,
  formatChildIdentity,
  isNonFunctionalText,
  normalizeDisplayTitle,
  projectChildIdentities,
  renderCampaignPrompt,
  renderChildPrompt,
} = require('./build-execution-package-projections');
const {
  failure,
  git,
  hasExactGoalFreezeDirectives,
  normalizeRecordBinding,
  parseArgs,
  readJson,
  resolveExistingInside,
  resolveInside,
  sha256,
  stableJson,
  verifySource,
  writeAtomic,
} = require('./build-execution-package-shared');

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const GIT_OBJECT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const AUTHORITY_PROFILES = new Set(['standalone_frozen', 'main_agent_compiled']);

function resolveManifestChildCandidate(repositoryRoot, projectedPath) {
  const resolvedPath = resolveExistingInside(
    repositoryRoot,
    projectedPath,
    'source_path_escape'
  );
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return null;
  }
  return { projectedPath, resolvedPath };
}

function projectManifestChildPath(repositoryRoot, partitionManifestPath, childContractPath) {
  const manifestChildPath = String(childContractPath || '').replace(/\\/gu, '/');
  if (
    !manifestChildPath ||
    path.posix.isAbsolute(manifestChildPath) ||
    /^[A-Za-z]:\//u.test(manifestChildPath) ||
    manifestChildPath.split('/').some((segment) => segment === '..') ||
    path.posix.normalize(manifestChildPath) !== manifestChildPath
  ) {
    failure('partition_manifest_not_final', { childContractPath });
  }
  const manifestRelativePath = path
    .relative(repositoryRoot, partitionManifestPath)
    .replace(/\\/gu, '/');
  const repositoryProjectedPath = path.posix.normalize(manifestChildPath);
  const manifestProjectedPath = path.posix.normalize(
    path.posix.join(path.posix.dirname(manifestRelativePath), manifestChildPath)
  );
  const repositoryCandidate = resolveManifestChildCandidate(
    repositoryRoot,
    repositoryProjectedPath
  );
  const manifestCandidate = resolveManifestChildCandidate(
    repositoryRoot,
    manifestProjectedPath
  );
  if (
    repositoryCandidate &&
    manifestCandidate &&
    repositoryCandidate.resolvedPath !== manifestCandidate.resolvedPath
  ) {
    failure('partition_manifest_not_final', {
      childContractPath,
      reason: 'ambiguous_child_contract_path',
    });
  }
  const selectedCandidate = repositoryCandidate ?? manifestCandidate;
  if (!selectedCandidate) {
    failure('partition_manifest_not_final', {
      childContractPath,
      reason: 'child_contract_path_not_found',
    });
  }
  return selectedCandidate.projectedPath;
}

function captureRepositoryBaseline(repositoryRoot) {
  const headCommit = git(repositoryRoot, ['rev-parse', 'HEAD'], 'repository_baseline_missing');
  const treeHash = git(
    repositoryRoot,
    ['rev-parse', `${headCommit}^{tree}`],
    'repository_baseline_missing'
  );
  const confirmedHead = git(repositoryRoot, ['rev-parse', 'HEAD'], 'repository_baseline_missing');
  if (confirmedHead !== headCommit) {
    failure('repository_baseline_changed', { headCommit, confirmedHead });
  }
  return { headCommit, treeHash };
}

function verifyRepositoryBaseline(
  repositoryRoot,
  baseline,
  failureClass = 'repository_baseline_mismatch'
) {
  if (
    !baseline ||
    !GIT_OBJECT_PATTERN.test(baseline.headCommit || '') ||
    !GIT_OBJECT_PATTERN.test(baseline.treeHash || '')
  ) {
    failure(failureClass);
  }
  git(repositoryRoot, ['cat-file', '-e', `${baseline.headCommit}^{commit}`], failureClass);
  const actualTreeHash = git(
    repositoryRoot,
    ['rev-parse', `${baseline.headCommit}^{tree}`],
    failureClass
  );
  if (actualTreeHash !== baseline.treeHash) {
    failure(failureClass, {
      headCommit: baseline.headCommit,
      expectedTreeHash: baseline.treeHash,
      actualTreeHash,
    });
  }
  return { headCommit: baseline.headCommit, treeHash: actualTreeHash };
}

function sameFilesystemPath(left, right) {
  const normalize = (value) => {
    const normalized = path.normalize(value);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  return normalize(left) === normalize(right);
}

function resolveCanonicalRepositoryRoot(value, failureClass = 'invalid_compile_request') {
  if (typeof value !== 'string' || value.trim() === '' || !path.isAbsolute(value)) {
    failure(failureClass);
  }
  const lexicalRoot = path.resolve(value);
  if (!fs.existsSync(lexicalRoot) || !fs.statSync(lexicalRoot).isDirectory()) {
    failure(failureClass, { repositoryRoot: value });
  }
  const realRoot = fs.realpathSync.native(lexicalRoot);
  if (!sameFilesystemPath(lexicalRoot, realRoot)) {
    failure(failureClass, { repositoryRoot: value });
  }
  const gitRootOutput = git(realRoot, ['rev-parse', '--show-toplevel'], failureClass);
  const gitRoot = fs.realpathSync.native(path.resolve(gitRootOutput));
  if (!sameFilesystemPath(realRoot, gitRoot)) {
    failure(failureClass, { repositoryRoot: value, gitRoot });
  }
  return realRoot;
}

function loadAjv2020(repositoryRoot) {
  const bases = [
    __filename,
    path.join(process.cwd(), 'package.json'),
    ...(repositoryRoot ? [path.join(repositoryRoot, 'package.json')] : []),
  ];
  const errors = [];
  for (const base of [...new Set(bases)]) {
    try {
      const localRequire = createRequire(base);
      const loaded = localRequire('ajv/dist/2020');
      return loaded.default || loaded;
    } catch (error) {
      errors.push(error.message);
    }
  }
  failure('schema_validator_unavailable', { errors });
}

function compileJsonSchema(repositoryRoot, schema, failureClass, details = {}) {
  try {
    const Ajv2020 = loadAjv2020(repositoryRoot);
    return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  } catch (error) {
    if (error.failureClass) throw error;
    failure(failureClass, { ...details, message: error.message });
  }
}

function compileBoundSchema(repositoryRoot, binding, hashFailureClass, schemaFailureClass) {
  const schemaPath = verifySource(repositoryRoot, binding, hashFailureClass);
  const schema = readJson(schemaPath, schemaFailureClass);
  return compileJsonSchema(repositoryRoot, schema, schemaFailureClass, {
    path: binding.path,
  });
}

function compileBundledSchema(schemaName, failureClass, repositoryRoot) {
  const schemaPath = path.join(__dirname, '..', 'schemas', schemaName);
  const schema = readJson(schemaPath, failureClass);
  return compileJsonSchema(repositoryRoot, schema, failureClass, { path: schemaPath });
}

function validateSchemaInstance(validator, value, failureClass, details = {}) {
  if (!validator(value)) {
    failure(failureClass, {
      ...details,
      errors: (validator.errors || []).slice(0, 5),
    });
  }
}

function compileMainAgentCertificationValidator(repositoryRoot) {
  const schemaPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'shared',
    'goal-contract',
    'goal-contract-partition-manifest.schema.json'
  );
  const schema = readJson(schemaPath, 'certification_schema_invalid');
  return compileJsonSchema(
    repositoryRoot,
    {
      $schema: schema.$schema,
      $defs: schema.$defs,
      $ref: '#/$defs/mainAgentGoalSourceAuthorityCertification',
    },
    'certification_schema_invalid',
    { path: schemaPath }
  );
}

function verifyAuthorityProfile({
  repositoryRoot,
  input,
  goalPath,
  partitionManifest,
  requirementRecordBinding,
}) {
  const authorityProfile = input.authorityProfile || 'standalone_frozen';
  if (!AUTHORITY_PROFILES.has(authorityProfile)) failure('invalid_authority_profile');
  if (authorityProfile === 'standalone_frozen') {
    if (!hasExactGoalFreezeDirectives(fs.readFileSync(goalPath, 'utf8'))) {
      failure('goal_contract_not_frozen');
    }
    return { authorityProfile };
  }
  const sourceFields = [
    'certification',
    'goalContractBundle',
    'partitionCoverageReceipt',
    'currentDispatchPointer',
    'transactionManifest',
  ];
  const bindings = Object.fromEntries(
    sourceFields.map((field) => {
      const binding = normalizeSourceBinding(input[field]);
      verifySource(repositoryRoot, binding, `${field}_hash_mismatch`);
      return [field, binding];
    })
  );
  const certificationPath = resolveExistingInside(
    repositoryRoot,
    bindings.certification.path,
    'certification_path_escape'
  );
  const certification = readJson(certificationPath, 'certification_schema_invalid');
  validateSchemaInstance(
    compileMainAgentCertificationValidator(repositoryRoot),
    certification,
    'certification_schema_invalid'
  );
  const certificationCore = { ...certification };
  delete certificationCore.certifiedAt;
  delete certificationCore.certificationHash;
  if (certification.certificationHash !== sha256(stableJson(certificationCore))) {
    failure('certification_hash_mismatch');
  }
  if (
    certification.goalContractBundleHash !== bindings.goalContractBundle.hash ||
    certification.partitionManifestHash !== partitionManifest.partitionManifestHash ||
    certification.partitionCoverageReceiptHash !== bindings.partitionCoverageReceipt.hash ||
    certification.currentDispatchPointerHash !== bindings.currentDispatchPointer.hash ||
    certification.transactionManifestHash !== bindings.transactionManifest.hash ||
    certification.goalProjectionBinding?.goalProjectionHash !== input.goalContract.hash ||
    stableJson(certification.requirementRecordBinding) !== stableJson(requirementRecordBinding)
  ) {
    failure('certification_authority_mismatch');
  }
  return { authorityProfile, ...bindings };
}

function normalizeSourceBinding(binding) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.hash !== 'string') {
    failure('invalid_source_binding');
  }
  return { path: binding.path, hash: binding.hash };
}

function normalizeCollectionCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    failure('collection_commands_missing');
  }
  const normalized = commands.map((command) => {
    if (
      !command ||
      typeof command.id !== 'string' ||
      command.id.trim() === '' ||
      typeof command.command !== 'string' ||
      command.command.trim() === ''
    ) {
      failure('collection_commands_missing');
    }
    return { id: command.id, command: command.command };
  });
  if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
    failure('collection_commands_missing');
  }
  return normalized;
}

function readManifestIdentity(manifest) {
  if (
    manifest?.schemaVersion !== 'goal-contract-partition-manifest/v2' ||
    manifest?.manifestAuthorityMode !== 'final_child_membership' ||
    !SHA256_PATTERN.test(manifest?.partitionManifestHash || '') ||
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder) ||
    !Array.isArray(manifest.orderedChildContractHashes)
  ) {
    failure('partition_manifest_not_final');
  }
  const ids = manifest.partitions.map((entry) => entry.partitionId);
  const hashes = manifest.partitions.map((entry) => entry.childContractHash);
  if (
    ids.some((id) => typeof id !== 'string' || id.trim() === '') ||
    new Set(ids).size !== ids.length ||
    manifest.partitionCount !== manifest.partitions.length ||
    stableJson(ids) !== stableJson(manifest.topologicalOrder) ||
    stableJson(hashes) !== stableJson(manifest.orderedChildContractHashes)
  ) {
    failure('partition_manifest_not_final');
  }
  return ids;
}

function verifyManifestCoverage(manifest) {
  const coverageFields = [
    'uncoveredObligationIds',
    'duplicateObligationIds',
    'unmappedObligationIds',
    'scopeEscapeObligationIds',
  ];
  if (
    !manifest.coverage ||
    coverageFields.some(
      (field) => !Array.isArray(manifest.coverage[field]) || manifest.coverage[field].length > 0
    )
  ) {
    failure('partition_coverage_incomplete');
  }
}

function isInvalidOwnedPath(ownedPath) {
  return (
    typeof ownedPath !== 'string' ||
    ownedPath.trim() === '' ||
    path.isAbsolute(ownedPath) ||
    resolveInside('.', ownedPath, 'partition_manifest_not_final') !==
      path.resolve('.', ownedPath)
  );
}

function verifyManifestPartition(partition, index, ordinalByPartitionId) {
  const dependencies = partition.dependencyPartitionIds;
  const ownedPaths = partition.ownedArtifactPaths;
  const commandIds = partition.commandIds;
  const invalidDependency = (dependencyId) =>
    !ordinalByPartitionId.has(dependencyId) ||
    dependencyId === partition.partitionId ||
    ordinalByPartitionId.get(dependencyId) >= index;
  if (
    !Array.isArray(dependencies) ||
    new Set(dependencies).size !== dependencies.length ||
    dependencies.some(invalidDependency) ||
    !SHA256_PATTERN.test(partition.childContractHash || '') ||
    typeof partition.childContractPath !== 'string' ||
    partition.childContractPath.trim() === '' ||
    !Array.isArray(ownedPaths) ||
    ownedPaths.length === 0 ||
    new Set(ownedPaths).size !== ownedPaths.length ||
    ownedPaths.some(isInvalidOwnedPath) ||
    !Array.isArray(commandIds) ||
    commandIds.length === 0 ||
    new Set(commandIds).size !== commandIds.length ||
    commandIds.some((commandId) => typeof commandId !== 'string' || !commandId.trim())
  ) {
    failure('partition_manifest_not_final', { partitionId: partition.partitionId });
  }
  return { ownedPaths, commandIds };
}

function verifyManifest(manifest) {
  const ids = readManifestIdentity(manifest);
  verifyManifestCoverage(manifest);
  const ordinalByPartitionId = new Map(ids.map((id, index) => [id, index]));
  const allOwnedPaths = [];
  const allCommandIds = [];
  for (const [index, partition] of manifest.partitions.entries()) {
    const { ownedPaths, commandIds } = verifyManifestPartition(
      partition,
      index,
      ordinalByPartitionId
    );
    allOwnedPaths.push(...ownedPaths);
    allCommandIds.push(...commandIds);
  }
  if (
    new Set(allOwnedPaths).size !== allOwnedPaths.length ||
    new Set(allCommandIds).size !== allCommandIds.length
  ) {
    failure('partition_manifest_not_final');
  }
}

function loadCompileInputs(requestPath) {
  const request = readJson(path.resolve(requestPath), 'invalid_compile_request');
  if (request.schemaVersion !== 'goal-subcontract-execution-package-request/v1') {
    failure('invalid_compile_request');
  }
  const repositoryRoot = resolveCanonicalRepositoryRoot(
    request.repositoryRoot,
    'invalid_compile_request'
  );
  const goalPath = verifySource(
    repositoryRoot,
    request.goalContract,
    'goal_contract_hash_mismatch'
  );
  const manifestPath = verifySource(
    repositoryRoot,
    request.partitionManifest,
    'partition_manifest_hash_mismatch'
  );
  const manifest = readJson(manifestPath, 'invalid_partition_manifest');
  verifyManifest(manifest);
  compileBoundSchema(
    repositoryRoot,
    request.evidenceSchema,
    'evidence_schema_hash_mismatch',
    'evidence_schema_invalid'
  );
  compileBoundSchema(
    repositoryRoot,
    request.closureSchema,
    'closure_schema_hash_mismatch',
    'closure_schema_invalid'
  );
  return { request, repositoryRoot, goalPath, manifest, manifestPath };
}

function projectChildren({ request, repositoryRoot, manifest, manifestPath }) {
  if (!Array.isArray(request.children) || request.children.length !== manifest.partitions.length) {
    failure('child_membership_mismatch');
  }
  const partitionIds = manifest.partitions.map(({ partitionId }) => partitionId);
  return manifest.partitions.map((partition, index) => {
    const supplied = request.children[index];
    const projectedChildPath = projectManifestChildPath(
      repositoryRoot,
      manifestPath,
      partition.childContractPath
    );
    if (
      supplied?.partitionId !== partition.partitionId ||
      supplied.path !== projectedChildPath ||
      supplied.hash !== partition.childContractHash
    ) {
      failure('child_membership_mismatch', { partitionId: partition.partitionId });
    }
    verifySource(repositoryRoot, supplied, 'child_contract_hash_mismatch');
    return {
      partitionId: partition.partitionId,
      displayTitle: normalizeDisplayTitle(partition, partitionIds),
      ordinal: index + 1,
      contract: normalizeSourceBinding(supplied),
      predecessorPartitionIds: partition.dependencyPartitionIds || [],
      ownedArtifactPaths: partition.ownedArtifactPaths || [],
      requiredCommandIds: partition.commandIds || [],
    };
  });
}

function createPackageContext({ request, repositoryRoot, children, goalPath, manifest }) {
  const collectionVerificationCommands = normalizeCollectionCommands(
    request.collectionVerificationCommands
  );
  const repositoryBaseline = captureRepositoryBaseline(repositoryRoot);
  const requirementRecordBinding = normalizeRecordBinding(request.requirementRecordBinding);
  const goalContract = normalizeSourceBinding(request.goalContract);
  const partitionManifest = normalizeSourceBinding(request.partitionManifest);
  const evidenceSchema = normalizeSourceBinding(request.evidenceSchema);
  const closureSchema = normalizeSourceBinding(request.closureSchema);
  const authority = verifyAuthorityProfile({
    repositoryRoot,
    input: request,
    goalPath,
    partitionManifest: manifest,
    requirementRecordBinding,
  });
  const seed = {
    repositoryRoot,
    repositoryBaseline,
    ...authority,
    goalContract,
    partitionManifest,
    evidenceSchema,
    closureSchema,
    requirementRecordBinding,
    children,
    collectionVerificationCommands,
  };
  const packageId = `goal-subcontract-package-${sha256(stableJson(seed)).slice(7, 23)}`;
  return {
    ...seed,
    packageId,
    commitPolicy: createCommitPolicy(),
    executionPolicy: createExecutionPolicy(),
  };
}

function compilePackageValidators(repositoryRoot) {
  return {
    childPacketValidator: compileBundledSchema(
      'child-prompt-packet.schema.json',
      'invalid_child_packet',
      repositoryRoot
    ),
    packageManifestValidator: compileBundledSchema(
      'execution-package-manifest.schema.json',
      'invalid_package_manifest',
      repositoryRoot
    ),
  };
}

function createArtifactEmitter(outputRoot) {
  const artifacts = [];
  const emit = (kind, relativePath, content) => {
    writeAtomic(outputRoot, relativePath, content);
    artifacts.push({ kind, path: relativePath, hash: sha256(content) });
  };
  return { artifacts, emit };
}

function projectChildArtifact({ child, context, childByPartitionId, validator, emit }) {
  const prefix = `${String(child.ordinal).padStart(2, '0')}-${child.partitionId}`;
  const packetPath = `children/${prefix}.packet.json`;
  const promptPath = `children/${prefix}.prompt.md`;
  const packet = createChildPacket({
    packageId: context.packageId,
    child,
    evidenceSchema: context.evidenceSchema,
    closureSchema: context.closureSchema,
    executionPolicy: context.executionPolicy,
    commitPolicy: context.commitPolicy,
  });
  validateSchemaInstance(validator, packet, 'invalid_child_packet', {
    partitionId: child.partitionId,
  });
  const packetContent = stableJson(packet);
  const promptContent = renderChildPrompt(
    child,
    childByPartitionId,
    context.evidenceSchema,
    context.closureSchema,
    context.executionPolicy
  );
  emit('child-packet', packetPath, packetContent);
  emit('child-prompt', promptPath, promptContent);
  return {
    ...child,
    packetPath,
    packetHash: sha256(packetContent),
    promptPath,
    promptHash: sha256(promptContent),
  };
}

function emitChildArtifacts({ context, validator, emit }) {
  const childByPartitionId = createChildIdentityMap(context.children);
  return context.children.map((child) =>
    projectChildArtifact({
      child,
      context,
      childByPartitionId,
      validator,
      emit,
    })
  );
}

function emitCampaignArtifacts(context, emit) {
  emit(
    'campaign-prompt',
    'campaign-prompt.md',
    renderCampaignPrompt(context.children, context.collectionVerificationCommands)
  );
  emit(
    'task-report-template',
    'templates/task-report.json',
    stableJson(
      createTaskReportTemplate({
        packageId: context.packageId,
        children: context.children,
        requirementRecordBinding: context.requirementRecordBinding,
      })
    )
  );
  emit(
    'handoff-template',
    'templates/main-agent-handoff.json',
    stableJson(
      createHandoffTemplate({
        packageId: context.packageId,
        goalContractHash: context.goalContract.hash,
        partitionManifestHash: context.partitionManifest.hash,
        children: context.children,
        requirementRecordBinding: context.requirementRecordBinding,
      })
    )
  );
}

function createManifestCore(context, projectedChildren, artifacts) {
  const authority = Object.fromEntries(
    [
      'authorityProfile',
      'certification',
      'goalContractBundle',
      'partitionCoverageReceipt',
      'currentDispatchPointer',
      'transactionManifest',
    ]
      .filter((field) => context[field])
      .map((field) => [field, context[field]])
  );
  return {
    schemaVersion: 'goal-subcontract-execution-package/v2',
    packageId: context.packageId,
    repositoryRoot: context.repositoryRoot,
    repositoryBaseline: context.repositoryBaseline,
    ...authority,
    goalContract: context.goalContract,
    partitionManifest: {
      ...context.partitionManifest,
      partitionManifestHash: context.manifest.partitionManifestHash,
    },
    evidenceSchema: context.evidenceSchema,
    closureSchema: context.closureSchema,
    requirementRecordBinding: context.requirementRecordBinding,
    children: projectedChildren,
    artifacts,
    collectionVerificationCommands: context.collectionVerificationCommands,
  };
}

function buildExecutionPackage({ requestPath, outputRoot }) {
  const inputs = loadCompileInputs(requestPath);
  const children = projectChildren(inputs);
  const context = {
    ...createPackageContext({
      request: inputs.request,
      repositoryRoot: inputs.repositoryRoot,
      children,
      goalPath: inputs.goalPath,
      manifest: inputs.manifest,
    }),
    manifest: inputs.manifest,
  };
  const validators = compilePackageValidators(context.repositoryRoot);
  const { artifacts, emit } = createArtifactEmitter(outputRoot);
  const projectedChildren = emitChildArtifacts({
    context,
    validator: validators.childPacketValidator,
    emit,
  });
  emitCampaignArtifacts(context, emit);
  const manifestCore = createManifestCore(context, projectedChildren, artifacts);
  const packageManifestHash = sha256(stableJson(manifestCore));
  const packageManifest = { ...manifestCore, packageManifestHash };
  validateSchemaInstance(
    validators.packageManifestValidator,
    packageManifest,
    'invalid_package_manifest'
  );
  writeAtomic(outputRoot, 'package-manifest.json', stableJson(packageManifest));
  return {
    ok: true,
    packageId: context.packageId,
    packageManifestHash,
    childCount: children.length,
    requirementRecordBindingStatus: context.requirementRecordBinding.status,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (!args.request || !args.out) failure('invalid_arguments');
    const result = buildExecutionPackage({
      requestPath: args.request,
      outputRoot: path.resolve(args.out),
    });
    process.stdout.write(stableJson(result));
    return 0;
  } catch (error) {
    process.stdout.write(
      stableJson({
        ok: false,
        failureClass: error.failureClass || 'execution_package_build_failed',
        details: error.details || {},
      })
    );
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  buildExecutionPackage,
  captureRepositoryBaseline,
  createChildPacket,
  createChildIdentityMap,
  createCommitPolicy,
  createExecutionPolicy,
  createHandoffTemplate,
  createTaskReportTemplate,
  failure,
  formatChildIdentity,
  git,
  hasExactGoalFreezeDirectives,
  isNonFunctionalText,
  main,
  normalizeCollectionCommands,
  normalizeDisplayTitle,
  normalizeRecordBinding,
  parseArgs,
  projectChildIdentities,
  projectManifestChildPath,
  readJson,
  renderCampaignPrompt,
  renderChildPrompt,
  resolveCanonicalRepositoryRoot,
  resolveInside,
  resolveExistingInside,
  sha256,
  stableJson,
  compileBoundSchema,
  compileBundledSchema,
  validateSchemaInstance,
  verifyRepositoryBaseline,
  verifyManifest,
  verifyAuthorityProfile,
  verifySource,
  writeAtomic,
};
