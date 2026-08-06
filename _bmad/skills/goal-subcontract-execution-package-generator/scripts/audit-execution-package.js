#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  compileBoundSchema,
  compileBundledSchema,
  createChildPacket,
  createChildIdentityMap,
  createCommitPolicy,
  createExecutionPolicy,
  createHandoffTemplate,
  createTaskReportTemplate,
  failure,
  hasExactGoalFreezeDirectives,
  normalizeCollectionCommands,
  normalizeDisplayTitle,
  normalizeRecordBinding,
  parseArgs,
  projectManifestChildPath,
  readJson,
  renderCampaignPrompt,
  renderChildPrompt,
  resolveCanonicalRepositoryRoot,
  resolveExistingInside,
  sha256,
  stableJson,
  validateSchemaInstance,
  verifyManifest,
  verifyRepositoryBaseline,
  verifySource,
} = require('./build-execution-package');

function sourceBinding(binding) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.hash !== 'string') {
    failure('invalid_package_manifest');
  }
  return { path: binding.path, hash: binding.hash };
}

function listPackageFiles(packageRoot) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(packageRoot, fullPath).replace(/\\/gu, '/');
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        failure('package_artifact_path_escape', { path: relativePath });
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        files.push(relativePath);
      } else {
        failure('package_artifact_path_escape', { path: relativePath });
      }
    }
  };
  walk(packageRoot);
  return files.sort();
}

function readPackageReceipt(packageRoot, expectedPackageManifestHash) {
  if (!expectedPackageManifestHash) failure('expected_package_manifest_hash_missing');
  if (!/^sha256:[a-f0-9]{64}$/u.test(expectedPackageManifestHash)) {
    failure('expected_package_manifest_hash_invalid');
  }
  const lexicalRoot = path.resolve(packageRoot);
  if (!fs.existsSync(lexicalRoot) || !fs.statSync(lexicalRoot).isDirectory()) {
    failure('package_manifest_missing');
  }
  const resolvedRoot = fs.realpathSync.native(lexicalRoot);
  const manifestPath = resolveExistingInside(
    resolvedRoot,
    'package-manifest.json',
    'package_artifact_path_escape'
  );
  if (!fs.existsSync(manifestPath)) failure('package_manifest_missing');
  const manifest = readJson(manifestPath, 'invalid_package_manifest');
  const packageManifestValidator = compileBundledSchema(
    'execution-package-manifest.schema.json',
    'invalid_package_manifest'
  );
  validateSchemaInstance(packageManifestValidator, manifest, 'invalid_package_manifest');
  if (manifest.packageManifestHash !== expectedPackageManifestHash) {
    failure('package_manifest_hash_mismatch', {
      expectedPackageManifestHash,
      actualPackageManifestHash: manifest.packageManifestHash,
    });
  }
  const core = { ...manifest };
  delete core.packageManifestHash;
  const expectedManifestHash = sha256(stableJson(core));
  if (manifest.packageManifestHash !== expectedManifestHash) {
    failure('package_manifest_hash_mismatch', { expectedManifestHash });
  }
  return { core, manifest, resolvedRoot };
}

function verifyPackageSourceBindings(manifest) {
  const repositoryRoot = resolveCanonicalRepositoryRoot(
    manifest.repositoryRoot,
    'invalid_package_manifest'
  );
  const goalContract = sourceBinding(manifest.goalContract);
  const goalPath = verifySource(repositoryRoot, goalContract, 'goal_contract_hash_mismatch');
  if (!hasExactGoalFreezeDirectives(fs.readFileSync(goalPath, 'utf8'))) {
    failure('goal_contract_not_frozen');
  }
  const partitionManifestBinding = sourceBinding(manifest.partitionManifest);
  const partitionManifestPath = verifySource(
    repositoryRoot,
    partitionManifestBinding,
    'partition_manifest_hash_mismatch'
  );
  const sourcePartitionManifest = readJson(partitionManifestPath, 'invalid_partition_manifest');
  verifyManifest(sourcePartitionManifest);
  const evidenceSchema = sourceBinding(manifest.evidenceSchema);
  const closureSchema = sourceBinding(manifest.closureSchema);
  compileBoundSchema(
    repositoryRoot,
    evidenceSchema,
    'evidence_schema_hash_mismatch',
    'evidence_schema_invalid'
  );
  compileBoundSchema(
    repositoryRoot,
    closureSchema,
    'closure_schema_hash_mismatch',
    'closure_schema_invalid'
  );
  return {
    closureSchema,
    evidenceSchema,
    goalContract,
    partitionManifestBinding,
    partitionManifestPath,
    repositoryRoot,
    sourcePartitionManifest,
  };
}

function verifyPackageBaseline(repositoryRoot, repositoryBaseline) {
  if (
    !repositoryBaseline ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(repositoryBaseline.headCommit || '') ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(repositoryBaseline.treeHash || '')
  ) {
    failure('invalid_package_manifest');
  }
  verifyRepositoryBaseline(repositoryRoot, repositoryBaseline);
}

function projectSourceChildren(repositoryRoot, partitionManifestPath, sourcePartitionManifest) {
  return sourcePartitionManifest.partitions.map((partition, index) => {
    const projectedChildPath = projectManifestChildPath(
      repositoryRoot,
      partitionManifestPath,
      partition.childContractPath
    );
    const child = {
      partitionId: partition.partitionId,
      displayTitle: normalizeDisplayTitle(partition),
      ordinal: index + 1,
      contract: {
        path: projectedChildPath,
        hash: partition.childContractHash,
      },
      predecessorPartitionIds: partition.dependencyPartitionIds,
      ownedArtifactPaths: partition.ownedArtifactPaths,
      requiredCommandIds: partition.commandIds,
    };
    verifySource(repositoryRoot, child.contract, 'child_contract_hash_mismatch');
    return child;
  });
}

function createPackageId({
  children,
  closureSchema,
  collectionVerificationCommands,
  evidenceSchema,
  goalContract,
  partitionManifestBinding,
  repositoryBaseline,
  repositoryRoot,
  requirementRecordBinding,
}) {
  const seed = {
    repositoryRoot,
    repositoryBaseline,
    goalContract,
    partitionManifest: partitionManifestBinding,
    evidenceSchema,
    closureSchema,
    requirementRecordBinding,
    children,
    collectionVerificationCommands,
  };
  return `goal-subcontract-package-${sha256(stableJson(seed)).slice(7, 23)}`;
}

function createProjectionContext(manifest, sourceBindings, children) {
  const {
    closureSchema,
    evidenceSchema,
    goalContract,
    partitionManifestBinding,
    repositoryRoot,
    sourcePartitionManifest,
  } = sourceBindings;
  const childByPartitionId = createChildIdentityMap(children);
  const requirementRecordBinding = normalizeRecordBinding(manifest.requirementRecordBinding);
  const collectionVerificationCommands = normalizeCollectionCommands(
    manifest.collectionVerificationCommands
  );
  const packageId = createPackageId({
    children,
    closureSchema,
    collectionVerificationCommands,
    evidenceSchema,
    goalContract,
    partitionManifestBinding,
    repositoryBaseline: manifest.repositoryBaseline,
    repositoryRoot,
    requirementRecordBinding,
  });
  const commitPolicy = createCommitPolicy();
  const executionPolicy = createExecutionPolicy();
  const childPacketValidator = compileBundledSchema(
    'child-prompt-packet.schema.json',
    'invalid_child_packet',
    repositoryRoot
  );
  return {
    childByPartitionId,
    childPacketValidator,
    children,
    closureSchema,
    collectionVerificationCommands,
    commitPolicy,
    evidenceSchema,
    executionPolicy,
    goalContract,
    packageId,
    partitionManifestBinding,
    repositoryBaseline: manifest.repositoryBaseline,
    repositoryRoot,
    requirementRecordBinding,
    sourcePartitionManifest,
  };
}

function reconstructChildArtifacts(context, expectArtifact) {
  const {
    childByPartitionId,
    childPacketValidator,
    children,
    closureSchema,
    commitPolicy,
    evidenceSchema,
    executionPolicy,
    packageId,
  } = context;
  return children.map((child) => {
    const prefix = `${String(child.ordinal).padStart(2, '0')}-${child.partitionId}`;
    const packetPath = `children/${prefix}.packet.json`;
    const promptPath = `children/${prefix}.prompt.md`;
    const packet = createChildPacket({
      packageId,
      child,
      evidenceSchema,
      closureSchema,
      commitPolicy,
      executionPolicy,
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
    expectArtifact('child-packet', packetPath, packetContent);
    expectArtifact('child-prompt', promptPath, promptContent);
    return {
      ...child,
      packetPath,
      packetHash: sha256(packetContent),
      promptPath,
      promptHash: sha256(promptContent),
    };
  });
}

function reconstructCampaignArtifacts(context, expectArtifact) {
  const {
    children,
    collectionVerificationCommands,
    goalContract,
    packageId,
    partitionManifestBinding,
    requirementRecordBinding,
  } = context;
  expectArtifact(
    'campaign-prompt',
    'campaign-prompt.md',
    renderCampaignPrompt(children, collectionVerificationCommands)
  );
  expectArtifact(
    'task-report-template',
    'templates/task-report.json',
    stableJson(createTaskReportTemplate({ packageId, children, requirementRecordBinding }))
  );
  expectArtifact(
    'handoff-template',
    'templates/main-agent-handoff.json',
    stableJson(
      createHandoffTemplate({
        packageId,
        goalContractHash: goalContract.hash,
        partitionManifestHash: partitionManifestBinding.hash,
        children,
        requirementRecordBinding,
      })
    )
  );
}

function reconstructExpectedArtifacts(context) {
  const expectedArtifacts = [];
  const expectedContentByPath = new Map();
  const expectArtifact = (kind, artifactPath, content) => {
    expectedArtifacts.push({ kind, path: artifactPath, hash: sha256(content) });
    expectedContentByPath.set(artifactPath, content);
  };
  const projectedChildren = reconstructChildArtifacts(context, expectArtifact);
  reconstructCampaignArtifacts(context, expectArtifact);
  return { expectedArtifacts, expectedContentByPath, projectedChildren };
}

function verifyPackageProjection(core, context, reconstruction) {
  const {
    closureSchema,
    collectionVerificationCommands,
    evidenceSchema,
    goalContract,
    packageId,
    partitionManifestBinding,
    repositoryBaseline,
    repositoryRoot,
    requirementRecordBinding,
    sourcePartitionManifest,
  } = context;
  const expectedCore = {
    schemaVersion: 'goal-subcontract-execution-package/v2',
    packageId,
    repositoryRoot,
    repositoryBaseline,
    goalContract,
    partitionManifest: {
      ...partitionManifestBinding,
      partitionManifestHash: sourcePartitionManifest.partitionManifestHash,
    },
    evidenceSchema,
    closureSchema,
    requirementRecordBinding,
    children: reconstruction.projectedChildren,
    artifacts: reconstruction.expectedArtifacts,
    collectionVerificationCommands,
  };
  if (stableJson(core) !== stableJson(expectedCore)) {
    failure('package_projection_mismatch');
  }
}

function verifyPackageArtifact(
  resolvedRoot,
  artifact,
  expectedContentByPath,
  childPacketValidator
) {
  const artifactPath = resolveExistingInside(
    resolvedRoot,
    artifact.path,
    'package_artifact_path_escape'
  );
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    failure('package_artifact_missing', { path: artifact.path });
  }
  const actualContent = fs.readFileSync(artifactPath);
  const actualHash = sha256(actualContent);
  if (actualHash !== artifact.hash) {
    failure('package_artifact_hash_mismatch', { path: artifact.path, actualHash });
  }
  if (artifact.kind === 'child-packet') {
    const actualPacket = readJson(artifactPath, 'invalid_child_packet');
    validateSchemaInstance(childPacketValidator, actualPacket, 'invalid_child_packet', {
      path: artifact.path,
    });
  }
  if (actualContent.toString('utf8') !== expectedContentByPath.get(artifact.path)) {
    failure('human_readable_identity_projection_mismatch', { path: artifact.path });
  }
}

function verifyPackageInventory(resolvedRoot, reconstruction, childPacketValidator) {
  const { expectedArtifacts, expectedContentByPath } = reconstruction;
  const expectedFiles = new Set([
    'package-manifest.json',
    ...expectedArtifacts.map(({ path: artifactPath }) => artifactPath),
  ]);
  const actualFiles = listPackageFiles(resolvedRoot);
  const undeclaredFile = actualFiles.find((file) => !expectedFiles.has(file));
  if (undeclaredFile) {
    failure('undeclared_package_artifact', { path: undeclaredFile });
  }
  const missingFile = [...expectedFiles].find((file) => !actualFiles.includes(file));
  if (missingFile) {
    failure('package_artifact_missing', { path: missingFile });
  }
  for (const artifact of expectedArtifacts) {
    verifyPackageArtifact(
      resolvedRoot,
      artifact,
      expectedContentByPath,
      childPacketValidator
    );
  }
}

function auditExecutionPackage(packageRoot, expectedPackageManifestHash) {
  const receipt = readPackageReceipt(packageRoot, expectedPackageManifestHash);
  const sourceBindings = verifyPackageSourceBindings(receipt.manifest);
  if (
    sourceBindings.sourcePartitionManifest.partitions.length !==
    receipt.manifest.children.length
  ) {
    failure('child_identity_source_mismatch');
  }
  verifyPackageBaseline(
    sourceBindings.repositoryRoot,
    receipt.manifest.repositoryBaseline
  );
  const children = projectSourceChildren(
    sourceBindings.repositoryRoot,
    sourceBindings.partitionManifestPath,
    sourceBindings.sourcePartitionManifest
  );
  const context = createProjectionContext(receipt.manifest, sourceBindings, children);
  const reconstruction = reconstructExpectedArtifacts(context);
  verifyPackageProjection(receipt.core, context, reconstruction);
  verifyPackageInventory(
    receipt.resolvedRoot,
    reconstruction,
    context.childPacketValidator
  );
  return receipt.manifest;
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (!args.package) failure('invalid_arguments');
    const manifest = auditExecutionPackage(args.package, args['expected-package-manifest-hash']);
    process.stdout.write(
      stableJson({
        ok: true,
        packageId: manifest.packageId,
        packageManifestHash: manifest.packageManifestHash,
        childCount: manifest.children.length,
        requirementRecordBindingStatus: manifest.requirementRecordBinding.status,
      })
    );
    return 0;
  } catch (error) {
    process.stdout.write(
      stableJson({
        ok: false,
        failureClass: error.failureClass || 'execution_package_audit_failed',
        details: error.details || {},
      })
    );
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { auditExecutionPackage, main };
