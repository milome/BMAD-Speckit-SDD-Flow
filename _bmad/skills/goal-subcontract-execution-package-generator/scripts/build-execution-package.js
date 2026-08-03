#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const COMMIT_VERIFICATION_FIELDS = [
  'hash',
  'parentHash',
  'treeHash',
  'subject',
  'changedPaths',
  'diff',
  'reachability',
  'trailers',
];
const REQUIRED_COMMIT_TRAILERS = [
  'Functional-Outcome',
  'Affected-Scope',
  'Child-Contract',
  'Contract-Hash',
  'Evidence',
  'Validation',
];
const ENGLISH_LIFECYCLE_PREFIX =
  /^(?:close(?:d|s|ing)?|complete(?:d|s|ing)?|execute(?:d|s|ing)?|process(?:ed|es|ing)?|implement(?:ed|s|ing)?|implementation)\b/iu;
const CHINESE_LIFECYCLE_PREFIX = /^(?:闭合|完成|执行|处理|实现)/u;
const GENERIC_ENGLISH_DOMAIN_LABEL =
  /^(?:authentication|authorization|payments?|reporting|settings?|configuration|infrastructure|frontend|backend|api|security|user management|data processing)(?:\s+(?:capability|feature|module|improvements?|changes?|updates?|work|implementation|api))?$/iu;
const GENERIC_CHINESE_DOMAIN_LABEL =
  /^(?:认证|授权|支付|报表|设置|配置|基础设施|前端|后端|接口|安全|用户管理|数据处理)(?:功能|能力|模块|改造|实现)?$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const GIT_OBJECT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => ({ ...result, [key]: sorted(value[key]) }), {});
}

function stableJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  error.failureClass = failureClass;
  error.details = details;
  throw error;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--')) result[argv[index].slice(2)] = argv[index + 1] ?? true;
  }
  return result;
}

function resolveInside(root, relativePath, failureClass = 'path_escape') {
  if (!relativePath || path.isAbsolute(relativePath)) failure(failureClass, { path: relativePath });
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    failure(failureClass, { path: relativePath });
  }
  return resolved;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExistingInside(root, relativePath, failureClass = 'path_escape') {
  const resolved = resolveInside(root, relativePath, failureClass);
  if (!fs.existsSync(resolved)) return resolved;
  const realRoot = fs.realpathSync.native(path.resolve(root));
  const realResolved = fs.realpathSync.native(resolved);
  if (!isInside(realRoot, realResolved)) failure(failureClass, { path: relativePath });
  return realResolved;
}

function readJson(filePath, failureClass = 'invalid_json') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failure(failureClass, { path: filePath, message: error.message });
  }
}

function verifySource(repositoryRoot, binding, failureClass) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.hash !== 'string') {
    failure('invalid_source_binding');
  }
  const sourcePath = resolveExistingInside(repositoryRoot, binding.path, 'source_path_escape');
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    failure('source_file_missing', { path: binding.path });
  }
  const actualHash = sha256(fs.readFileSync(sourcePath));
  if (actualHash !== binding.hash) failure(failureClass, { path: binding.path, actualHash });
  return sourcePath;
}

function git(repositoryRoot, args, failureClass) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) failure(failureClass, { stderr: result.stderr.trim() });
  return result.stdout.trim();
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

function writeAtomic(root, relativePath, content) {
  fs.mkdirSync(root, { recursive: true });
  const target = resolveInside(root, relativePath, 'package_output_path_escape');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const realRoot = fs.realpathSync.native(path.resolve(root));
  const realParent = fs.realpathSync.native(path.dirname(target));
  if (!isInside(realRoot, realParent)) {
    failure('package_output_path_escape', { path: relativePath });
  }
  if (fs.existsSync(target)) {
    const realTarget = fs.realpathSync.native(target);
    if (!isInside(realRoot, realTarget) || fs.lstatSync(target).isSymbolicLink()) {
      failure('package_output_path_escape', { path: relativePath });
    }
    if (fs.readFileSync(target, 'utf8') === content) return target;
    failure('package_output_conflict', { path: relativePath });
  }
  const temporary = `${target}.${process.pid}.${sha256(content).slice(7, 19)}.tmp`;
  if (fs.existsSync(temporary)) failure('package_output_conflict', { path: relativePath });
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, target);
  return target;
}

function normalizeRecordBinding(binding) {
  if (binding === undefined) {
    return { status: 'absent', downstreamAction: 'main_agent_resolve_requirement_record' };
  }
  if (binding?.status === 'absent') {
    const keys = Object.keys(binding).sort();
    if (keys.join(',') !== 'downstreamAction,status') failure('invalid_record_binding');
    if (binding.downstreamAction !== 'main_agent_resolve_requirement_record') {
      failure('invalid_record_binding');
    }
    return binding;
  }
  const required = ['recordId', 'requirementSetId', 'recordPathHash'];
  if (binding?.status !== 'present' || required.some((field) => !binding[field])) {
    failure('invalid_record_binding');
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(binding.recordPathHash)) failure('invalid_record_binding');
  return {
    status: 'present',
    recordId: binding.recordId,
    requirementSetId: binding.requirementSetId,
    recordPathHash: binding.recordPathHash,
  };
}

function isNonFunctionalText(value, child = {}) {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase();
  const partitionId = String(child.partitionId || '')
    .trim()
    .toLowerCase();
  const displayTitle = String(child.displayTitle || '')
    .trim()
    .toLowerCase();
  return (
    !text ||
    CHINESE_LIFECYCLE_PREFIX.test(text) ||
    ENGLISH_LIFECYCLE_PREFIX.test(text) ||
    GENERIC_ENGLISH_DOMAIN_LABEL.test(text) ||
    GENERIC_CHINESE_DOMAIN_LABEL.test(text) ||
    /\b(?:[a-z][a-z0-9]*-\d+|g\d+)\b/iu.test(text) ||
    /\b(?:implementation|subcontract|child\s+contract|goal\s+contract)\b/iu.test(text) ||
    (partitionId !== '' && normalized.includes(partitionId)) ||
    (displayTitle !== '' && normalized === displayTitle)
  );
}

function normalizeDisplayTitle(partition) {
  const partitionId = String(partition?.partitionId || '').trim();
  const displayTitle = String(partition?.displayTitle || '').trim();
  if (isNonFunctionalText(displayTitle, { partitionId })) {
    failure('child_display_title_not_human_readable', {
      partitionId,
      displayTitle,
    });
  }
  return displayTitle;
}

function formatChildIdentity(child) {
  return `${child.displayTitle} (${child.partitionId})`;
}

function projectChildIdentities(children) {
  return children.map(({ partitionId, displayTitle }) => ({
    partitionId,
    displayTitle,
  }));
}

function createChildIdentityMap(children) {
  const childByPartitionId = new Map(children.map((child) => [child.partitionId, child]));
  if (childByPartitionId.size !== children.length) failure('partition_manifest_not_final');
  for (const child of children) {
    if (
      !Array.isArray(child.predecessorPartitionIds) ||
      child.predecessorPartitionIds.some((partitionId) => !childByPartitionId.has(partitionId))
    ) {
      failure('partition_manifest_not_final', { partitionId: child.partitionId });
    }
  }
  return childByPartitionId;
}

function createCommitPolicy() {
  return {
    commitCount: 1,
    subjectPattern: '<type>(<functional-scope>): <specific functional capability>',
    requiredTrailers: REQUIRED_COMMIT_TRAILERS,
    forbiddenLifecycleSubjects: [
      '闭合令牌刷新子合同',
      '完成 AUTH-03',
      '执行认证改造',
      'complete AUTH-03 implementation',
    ],
  };
}

function createExecutionPolicy() {
  return {
    predecessorClosureRequired: true,
    stageOwnedPathsOnly: true,
    closureStatus: 'closed',
    commitVerificationFields: COMMIT_VERIFICATION_FIELDS,
  };
}

function createChildPacket({
  packageId,
  child,
  evidenceSchema,
  closureSchema,
  commitPolicy,
  executionPolicy,
}) {
  return {
    schemaVersion: 'goal-subcontract-child-prompt-packet/v2',
    packageId,
    ...child,
    evidenceSchema,
    closureSchema,
    executionPolicy,
    commitPolicy,
  };
}

function renderChildPrompt(
  child,
  childByPartitionId,
  evidenceSchema,
  closureSchema,
  executionPolicy
) {
  return [
    `# Execute ${formatChildIdentity(child)}`,
    '',
    `Contract: ${child.contract.path}#${child.contract.hash}`,
    `Predecessors: ${
      child.predecessorPartitionIds
        .map((partitionId) => formatChildIdentity(childByPartitionId.get(partitionId)))
        .join(', ') || 'none'
    }`,
    `Owned paths: ${child.ownedArtifactPaths.join(', ')}`,
    `Required commands: ${child.requiredCommandIds.join(', ')}`,
    `Evidence schema: ${evidenceSchema.path}#${evidenceSchema.hash}`,
    `Closure schema: ${closureSchema.path}#${closureSchema.hash}`,
    `Required closure status: ${executionPolicy.closureStatus}`,
    `Commit verification: ${executionPolicy.commitVerificationFields.join(', ')}`,
    '',
    'Start only after every predecessor has a schema-valid closed closure artifact.',
    'Validate evidence and closure JSON against the bound schemas before claiming closure.',
    'Stage only changed paths declared in Owned paths and create exactly one atomic local commit.',
    'Inspect the actual commit diff and verify it is non-empty and limited to Owned paths.',
    'Verify the actual commit hash, parent, tree, changed paths, diff, reachability, subject, and unique terminal trailers.',
    'The commit subject must describe the specific functional capability; lifecycle-only summaries fail.',
    'Use the partition ID only in trace fields; pair every human-facing reference with the display title or verified functional outcome.',
    '',
  ].join('\n');
}

function renderCampaignPrompt(children, collectionVerificationCommands) {
  return [
    '# Goal Child Campaign',
    '',
    `Execute in order: ${children.map(formatChildIdentity).join(' -> ')}.`,
    '',
    'Collection verification commands:',
    ...collectionVerificationCommands.map(({ id, command }) => `- ${id}: ${command}`),
    '',
    'Record schema-valid evidence for every collection command.',
    'Do not report done until every child and collection audit passes.',
    '',
  ].join('\n');
}

function createTaskReportTemplate({ packageId, children, requirementRecordBinding }) {
  return {
    schemaVersion: 'goal-subcontract-campaign-task-report-template/v2',
    status: 'pending_audit',
    packageId,
    childIdentities: projectChildIdentities(children),
    requirementRecordBinding,
  };
}

function createHandoffTemplate({
  packageId,
  goalContractHash,
  partitionManifestHash,
  children,
  requirementRecordBinding,
}) {
  return {
    schemaVersion: 'goal-subcontract-main-agent-handoff-template/v2',
    status: 'pending_audit',
    packageId,
    goalContractHash,
    partitionManifestHash,
    childIdentities: projectChildIdentities(children),
    requirementRecordBinding,
  };
}

function hasExactGoalFreezeDirectives(goalText) {
  const effectiveText = goalText.replace(/<!--[\s\S]*?-->/gu, '');
  const directives = {
    contractMode: [],
    rewritePolicy: [],
  };
  let fence = null;
  for (const line of effectiveText.split(/\r?\n/u)) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
    if (fence) {
      const closingFenceMatch = /^ {0,3}(`{3,}|~{3,})[ \t]*$/u.exec(line);
      if (
        closingFenceMatch &&
        closingFenceMatch[1][0] === fence.marker &&
        closingFenceMatch[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    if (/^ {0,3}>/u.test(line) || /^(?: {4}|\t)/u.test(line)) continue;
    const match = /^(contractMode|rewritePolicy)\s*:\s*(.*?)\s*$/u.exec(line.trim());
    if (match) directives[match[1]].push(match[2]);
  }
  return (
    directives.contractMode.length === 1 &&
    directives.contractMode[0] === 'frozen' &&
    directives.rewritePolicy.length === 1 &&
    directives.rewritePolicy[0] === 'forbidden'
  );
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

function verifyManifest(manifest) {
  const coverageFields = [
    'uncoveredObligationIds',
    'duplicateObligationIds',
    'unmappedObligationIds',
    'scopeEscapeObligationIds',
  ];
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
  if (
    !manifest.coverage ||
    coverageFields.some(
      (field) => !Array.isArray(manifest.coverage[field]) || manifest.coverage[field].length > 0
    )
  ) {
    failure('partition_coverage_incomplete');
  }
  const ordinalByPartitionId = new Map(ids.map((id, index) => [id, index]));
  const allOwnedPaths = [];
  const allCommandIds = [];
  for (const [index, partition] of manifest.partitions.entries()) {
    const dependencies = partition.dependencyPartitionIds;
    const ownedPaths = partition.ownedArtifactPaths;
    const commandIds = partition.commandIds;
    if (
      !Array.isArray(dependencies) ||
      new Set(dependencies).size !== dependencies.length ||
      dependencies.some(
        (dependencyId) =>
          !ordinalByPartitionId.has(dependencyId) ||
          dependencyId === partition.partitionId ||
          ordinalByPartitionId.get(dependencyId) >= index
      ) ||
      !SHA256_PATTERN.test(partition.childContractHash || '') ||
      typeof partition.childContractPath !== 'string' ||
      partition.childContractPath.trim() === '' ||
      !Array.isArray(ownedPaths) ||
      ownedPaths.length === 0 ||
      new Set(ownedPaths).size !== ownedPaths.length ||
      ownedPaths.some(
        (ownedPath) =>
          typeof ownedPath !== 'string' ||
          ownedPath.trim() === '' ||
          path.isAbsolute(ownedPath) ||
          resolveInside('.', ownedPath, 'partition_manifest_not_final') !==
            path.resolve('.', ownedPath)
      ) ||
      !Array.isArray(commandIds) ||
      commandIds.length === 0 ||
      new Set(commandIds).size !== commandIds.length ||
      commandIds.some((commandId) => typeof commandId !== 'string' || !commandId.trim())
    ) {
      failure('partition_manifest_not_final', { partitionId: partition.partitionId });
    }
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

function buildExecutionPackage({ requestPath, outputRoot }) {
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
  const goalText = fs.readFileSync(goalPath, 'utf8');
  if (!hasExactGoalFreezeDirectives(goalText)) failure('goal_contract_not_frozen');
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
  if (!Array.isArray(request.children) || request.children.length !== manifest.partitions.length) {
    failure('child_membership_mismatch');
  }
  const children = manifest.partitions.map((partition, index) => {
    const supplied = request.children[index];
    if (
      supplied?.partitionId !== partition.partitionId ||
      supplied.path !== partition.childContractPath ||
      supplied.hash !== partition.childContractHash
    ) {
      failure('child_membership_mismatch', { partitionId: partition.partitionId });
    }
    verifySource(repositoryRoot, supplied, 'child_contract_hash_mismatch');
    return {
      partitionId: partition.partitionId,
      displayTitle: normalizeDisplayTitle(partition),
      ordinal: index + 1,
      contract: normalizeSourceBinding(supplied),
      predecessorPartitionIds: partition.dependencyPartitionIds || [],
      ownedArtifactPaths: partition.ownedArtifactPaths || [],
      requiredCommandIds: partition.commandIds || [],
    };
  });
  const collectionVerificationCommands = normalizeCollectionCommands(
    request.collectionVerificationCommands
  );
  const repositoryBaseline = captureRepositoryBaseline(repositoryRoot);
  const requirementRecordBinding = normalizeRecordBinding(request.requirementRecordBinding);
  const goalContract = normalizeSourceBinding(request.goalContract);
  const partitionManifest = normalizeSourceBinding(request.partitionManifest);
  const evidenceSchema = normalizeSourceBinding(request.evidenceSchema);
  const closureSchema = normalizeSourceBinding(request.closureSchema);
  const seed = {
    repositoryRoot,
    repositoryBaseline,
    goalContract,
    partitionManifest,
    evidenceSchema,
    closureSchema,
    requirementRecordBinding,
    children,
    collectionVerificationCommands,
  };
  const packageId = `goal-subcontract-package-${sha256(stableJson(seed)).slice(7, 23)}`;
  const commitPolicy = createCommitPolicy();
  const executionPolicy = createExecutionPolicy();
  const childPacketValidator = compileBundledSchema(
    'child-prompt-packet.schema.json',
    'invalid_child_packet',
    repositoryRoot
  );
  const packageManifestValidator = compileBundledSchema(
    'execution-package-manifest.schema.json',
    'invalid_package_manifest',
    repositoryRoot
  );
  const artifacts = [];
  const childByPartitionId = createChildIdentityMap(children);
  const emit = (kind, relativePath, content) => {
    writeAtomic(outputRoot, relativePath, content);
    artifacts.push({ kind, path: relativePath, hash: sha256(content) });
  };
  const projectedChildren = children.map((child) => {
    const prefix = `${String(child.ordinal).padStart(2, '0')}-${child.partitionId}`;
    const packetPath = `children/${prefix}.packet.json`;
    const promptPath = `children/${prefix}.prompt.md`;
    const packet = createChildPacket({
      packageId,
      child,
      evidenceSchema,
      closureSchema,
      executionPolicy,
      commitPolicy,
    });
    validateSchemaInstance(childPacketValidator, packet, 'invalid_child_packet', {
      partitionId: child.partitionId,
    });
    const packetContent = stableJson(packet);
    const promptContent = renderChildPrompt(
      child,
      childByPartitionId,
      evidenceSchema,
      closureSchema,
      executionPolicy
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
  });
  emit(
    'campaign-prompt',
    'campaign-prompt.md',
    renderCampaignPrompt(children, collectionVerificationCommands)
  );
  emit(
    'task-report-template',
    'templates/task-report.json',
    stableJson(
      createTaskReportTemplate({
        packageId,
        children,
        requirementRecordBinding,
      })
    )
  );
  emit(
    'handoff-template',
    'templates/main-agent-handoff.json',
    stableJson(
      createHandoffTemplate({
        packageId,
        goalContractHash: goalContract.hash,
        partitionManifestHash: partitionManifest.hash,
        children,
        requirementRecordBinding,
      })
    )
  );
  const manifestCore = {
    schemaVersion: 'goal-subcontract-execution-package/v2',
    packageId,
    repositoryRoot,
    repositoryBaseline,
    goalContract,
    partitionManifest: {
      ...partitionManifest,
      partitionManifestHash: manifest.partitionManifestHash,
    },
    evidenceSchema,
    closureSchema,
    requirementRecordBinding,
    children: projectedChildren,
    artifacts,
    collectionVerificationCommands,
  };
  const packageManifestHash = sha256(stableJson(manifestCore));
  const packageManifest = { ...manifestCore, packageManifestHash };
  validateSchemaInstance(packageManifestValidator, packageManifest, 'invalid_package_manifest');
  writeAtomic(outputRoot, 'package-manifest.json', stableJson(packageManifest));
  return {
    ok: true,
    packageId,
    packageManifestHash,
    childCount: children.length,
    requirementRecordBindingStatus: requirementRecordBinding.status,
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
  hasExactGoalFreezeDirectives,
  isNonFunctionalText,
  main,
  normalizeCollectionCommands,
  normalizeDisplayTitle,
  normalizeRecordBinding,
  parseArgs,
  projectChildIdentities,
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
  verifySource,
  writeAtomic,
};
