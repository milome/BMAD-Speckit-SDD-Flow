const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const Ajv2020 = require('ajv/dist/2020');
const {
  normalizePath,
  sha256File,
  stableStringify,
} = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);
const partitionManifestModulePath = __filename.endsWith('.ts')
  ? './partition-manifest.ts'
  : fs.existsSync(path.join(__dirname, 'partition-manifest.js'))
    ? './partition-manifest'
    : path.join(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'utils',
        'goal-contract',
        'partition-manifest.ts'
      );
const { validatePartitionManifest } = require(
  partitionManifestModulePath
);

export type GoalContractPartitionReceiptsModule = never;

const RECEIPT_SCHEMA_IDS = new Set([
  'goal-contract-partition-global-coverage-receipt/v1',
  'goal-contract-partition-selection-receipt/v1',
  'goal-contract-dependency-compatibility-receipt/v1',
  'goal-contract-partition-child-coverage-receipt/v1',
  'goal-contract-partition-child-generation-receipt/v1',
  'goal-contract-partition-release-gate-receipt/v1',
]);
const validators = new Map();

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function assertStringArray(value, failureClass) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw failure(failureClass);
  }
  return [...value].sort();
}

function readPredecessorCompletionReceipt(input) {
  if (
    typeof input.predecessorCompletionReceiptPath !== 'string' ||
    !fs.existsSync(input.predecessorCompletionReceiptPath)
  ) {
    throw failure('compatibility_predecessor_completion_receipt_missing');
  }
  let observed;
  try {
    observed = JSON.parse(
      fs.readFileSync(input.predecessorCompletionReceiptPath, 'utf8')
    );
  } catch {
    throw failure('compatibility_predecessor_completion_receipt_invalid');
  }
  return observed;
}

function findCompatibilityRequirement(input) {
  const requirements =
    input.dependentPartition?.compatibilityReceiptRequirements;
  if (!Array.isArray(requirements)) {
    throw failure('compatibility_requirement_missing');
  }
  const matches = requirements.filter(
    (requirement) =>
      requirement?.artifactPath === input.sharedArtifactPath &&
      requirement?.predecessorPartitionId ===
        input.predecessorPartition?.partitionId
  );
  if (matches.length !== 1) {
    throw failure(
      matches.length === 0
        ? 'compatibility_requirement_missing'
        : 'compatibility_requirement_ambiguous'
    );
  }
  return matches[0];
}

function validatePredecessorCompletionBinding(input) {
  if (
    Object.prototype.hasOwnProperty.call(
      input,
      'compatibilityCommandResults'
    )
  ) {
    throw failure('compatibility_command_result_authority_forbidden');
  }
  if (
    !input.predecessorPartition ||
    !input.dependentPartition ||
    typeof input.sharedArtifactPath !== 'string' ||
    input.sharedArtifactPath.length === 0
  ) {
    throw failure('compatibility_binding_invalid');
  }
  if (
    !Array.isArray(input.dependentPartition.dependencyPartitionIds) ||
    !input.dependentPartition.dependencyPartitionIds.includes(
      input.predecessorPartition.partitionId
    )
  ) {
    throw failure('compatibility_predecessor_dependency_missing');
  }
  if (
    !Array.isArray(input.predecessorPartition.ownedArtifactPaths) ||
    !input.predecessorPartition.ownedArtifactPaths.includes(
      input.sharedArtifactPath
    )
  ) {
    throw failure('compatibility_shared_artifact_not_owned');
  }
  findCompatibilityRequirement(input);
  const declared = input.predecessorCompletionReceipt;
  if (!declared || typeof declared !== 'object') {
    throw failure('compatibility_predecessor_completion_receipt_invalid');
  }
  if (
    declared.partitionId !== input.predecessorPartition.partitionId
  ) {
    throw failure('compatibility_predecessor_partition_mismatch');
  }
  if (declared.masterSourceHash !== input.masterSourceHash) {
    throw failure('compatibility_predecessor_source_mismatch');
  }
  if (declared.sourceSnapshotHash !== input.sourceSnapshotHash) {
    throw failure('compatibility_predecessor_snapshot_mismatch');
  }
  if (declared.partitionManifestHash !== input.partitionManifestHash) {
    throw failure('compatibility_predecessor_manifest_mismatch');
  }
  if (declared.decision !== 'pass') {
    throw failure('compatibility_predecessor_completion_blocked');
  }
  if (
    typeof input.predecessorArtifactPath !== 'string' ||
    !fs.existsSync(input.predecessorArtifactPath)
  ) {
    throw failure('compatibility_predecessor_artifact_missing');
  }
  const observedPredecessorArtifactHash = sha256File(
    input.predecessorArtifactPath
  );
  if (
    input.predecessorArtifactHash !== observedPredecessorArtifactHash ||
    declared.artifactHashes?.[input.sharedArtifactPath] !==
      observedPredecessorArtifactHash
  ) {
    throw failure('compatibility_predecessor_artifact_hash_mismatch');
  }
  if (
    typeof input.currentArtifactPath !== 'string' ||
    !fs.existsSync(input.currentArtifactPath)
  ) {
    throw failure('compatibility_current_artifact_missing');
  }
  const observedReceipt = readPredecessorCompletionReceipt(input);
  if (stableStringify(observedReceipt) !== stableStringify(declared)) {
    throw failure('compatibility_predecessor_completion_receipt_mismatch');
  }
  return Object.freeze({
    predecessorArtifactHash: observedPredecessorArtifactHash,
    predecessorCompletionReceiptHash: sha256File(
      input.predecessorCompletionReceiptPath
    ),
    currentArtifactHash: sha256File(input.currentArtifactPath),
  });
}

function validateCompatibilityCommands(input) {
  if (
    !Array.isArray(input.compatibilityCommands) ||
    input.compatibilityCommands.length === 0
  ) {
    throw failure('compatibility_command_missing');
  }
  const commandIds = new Set();
  return input.compatibilityCommands.map((command) => {
    if (
      !command ||
      typeof command.commandId !== 'string' ||
      command.commandId.length === 0 ||
      commandIds.has(command.commandId) ||
      !Array.isArray(command.argv) ||
      command.argv.length === 0 ||
      command.argv.some(
        (argument) => typeof argument !== 'string' || argument.length === 0
      )
    ) {
      throw failure('compatibility_command_invalid');
    }
    commandIds.add(command.commandId);
    return command;
  });
}

function runObservedCompatibilityCommand({
  command,
  cwd,
  sharedArtifactPath,
  currentArtifactHash,
}) {
  const result = spawnSync(command.argv[0], command.argv.slice(1), {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return Object.freeze({
    commandId: command.commandId,
    argv: [...command.argv],
    cwd: normalizePath(cwd),
    exitCode: Number.isInteger(result.status) ? result.status : -1,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || result.error?.message || ''),
    artifactHashes: {
      [sharedArtifactPath]: currentArtifactHash,
    },
  });
}

function compatibilityBlockingReasons({
  invalidatedAcceptanceIds,
  commandResults,
}) {
  const reasons = [];
  if (invalidatedAcceptanceIds.length > 0) {
    reasons.push('compatibility_acceptance_invalidated');
  }
  if (commandResults.some((result) => result.exitCode !== 0)) {
    reasons.push('compatibility_command_failed');
  }
  return reasons.sort();
}

function buildDependencyCompatibilityReceipt(input) {
  const binding = validatePredecessorCompletionBinding(input);
  const commands = validateCompatibilityCommands(input);
  const preservedAcceptanceIds = assertStringArray(
    input.preservedAcceptanceIds,
    'compatibility_preserved_acceptance_ids_invalid'
  );
  const invalidatedAcceptanceIds = assertStringArray(
    input.invalidatedAcceptanceIds,
    'compatibility_invalidated_acceptance_ids_invalid'
  );
  const cwd = path.resolve(input.cwd || process.cwd());
  const compatibilityCommands = commands.map((command) =>
    runObservedCompatibilityCommand({
      command,
      cwd,
      sharedArtifactPath: input.sharedArtifactPath,
      currentArtifactHash: binding.currentArtifactHash,
    })
  );
  const blockingReasons = compatibilityBlockingReasons({
    invalidatedAcceptanceIds,
    commandResults: compatibilityCommands,
  });
  return Object.freeze(
    canonicalizeForSchema(
      'goal-contract-dependency-compatibility-receipt/v1',
      {
        schemaVersion:
          'goal-contract-dependency-compatibility-receipt/v1',
        masterSourceHash: input.masterSourceHash,
        sourceSnapshotHash: input.sourceSnapshotHash,
        partitionManifestHash: input.partitionManifestHash,
        dependentPartitionId: input.dependentPartition.partitionId,
        predecessorPartitionId: input.predecessorPartition.partitionId,
        predecessorCompletionReceiptHash:
          binding.predecessorCompletionReceiptHash,
        predecessorOwnedArtifactPath: input.sharedArtifactPath,
        predecessorArtifactHash: binding.predecessorArtifactHash,
        currentArtifactHash: binding.currentArtifactHash,
        compatibilityDomain: input.compatibilityDomain,
        preservedAcceptanceIds,
        invalidatedAcceptanceIds,
        compatibilityCommands,
        decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons,
      }
    )
  );
}

function validateDependencyCompatibilityReceipt(receipt, input) {
  const canonical = canonicalizeForSchema(
    'goal-contract-dependency-compatibility-receipt/v1',
    receipt
  );
  const binding = validatePredecessorCompletionBinding(input);
  const commands = validateCompatibilityCommands(input);
  const expectedFields = {
    masterSourceHash: input.masterSourceHash,
    sourceSnapshotHash: input.sourceSnapshotHash,
    partitionManifestHash: input.partitionManifestHash,
    dependentPartitionId: input.dependentPartition.partitionId,
    predecessorPartitionId: input.predecessorPartition.partitionId,
    predecessorCompletionReceiptHash:
      binding.predecessorCompletionReceiptHash,
    predecessorOwnedArtifactPath: input.sharedArtifactPath,
    predecessorArtifactHash: binding.predecessorArtifactHash,
    currentArtifactHash: binding.currentArtifactHash,
    compatibilityDomain: input.compatibilityDomain,
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    if (canonical[field] !== expected) {
      throw failure(`compatibility_${field}_mismatch`, {
        expected,
        actual: canonical[field],
      });
    }
  }
  const expectedPreserved = assertStringArray(
    input.preservedAcceptanceIds,
    'compatibility_preserved_acceptance_ids_invalid'
  );
  const expectedInvalidated = assertStringArray(
    input.invalidatedAcceptanceIds,
    'compatibility_invalidated_acceptance_ids_invalid'
  );
  if (
    stableStringify(canonical.preservedAcceptanceIds) !==
      stableStringify(expectedPreserved) ||
    stableStringify(canonical.invalidatedAcceptanceIds) !==
      stableStringify(expectedInvalidated)
  ) {
    throw failure('compatibility_acceptance_binding_mismatch');
  }
  if (canonical.compatibilityCommands.length !== commands.length) {
    throw failure('compatibility_command_count_mismatch');
  }
  const currentArtifactHashes = {
    [input.sharedArtifactPath]: binding.currentArtifactHash,
  };
  commands.forEach((command, index) => {
    const observed = canonical.compatibilityCommands[index];
    if (
      observed.commandId !== command.commandId ||
      stableStringify(observed.argv) !== stableStringify(command.argv) ||
      observed.cwd !== normalizePath(path.resolve(input.cwd || process.cwd()))
    ) {
      throw failure('compatibility_command_binding_mismatch', {
        commandId: command.commandId,
      });
    }
    if (
      stableStringify(observed.artifactHashes) !==
      stableStringify(currentArtifactHashes)
    ) {
      throw failure('compatibility_command_artifact_hash_mismatch', {
        commandId: command.commandId,
      });
    }
  });
  const expectedBlockingReasons = compatibilityBlockingReasons({
    invalidatedAcceptanceIds: expectedInvalidated,
    commandResults: canonical.compatibilityCommands,
  });
  const expectedDecision =
    expectedBlockingReasons.length === 0 ? 'pass' : 'blocked';
  if (
    canonical.decision !== expectedDecision ||
    stableStringify(canonical.blockingReasons) !==
      stableStringify(expectedBlockingReasons)
  ) {
    throw failure('compatibility_decision_mismatch');
  }
  return canonical;
}

function writeDependencyCompatibilityReceipt(input) {
  if (typeof input.targetPath !== 'string' || input.targetPath.length === 0) {
    throw failure('compatibility_receipt_target_missing');
  }
  const payload = buildDependencyCompatibilityReceipt(input);
  validateDependencyCompatibilityReceipt(payload, input);
  return writeImmutableReceipt({
    schemaId: payload.schemaVersion,
    targetPath: input.targetPath,
    payload,
    writeReceipt: writeValidatedPartitionReceipt,
  });
}

function safeWriteText(targetPath, text, { mode = 'upsert' } = {}) {
  const resolved = path.resolve(targetPath);
  const exists = fs.existsSync(resolved);
  if (mode === 'create' && exists) {
    throw failure('partition_receipt_target_exists', { targetPath: resolved });
  }
  if (mode === 'replace' && !exists) {
    throw failure('partition_receipt_target_missing', { targetPath: resolved });
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(temporaryPath, String(text), {
    encoding: 'utf8',
    flag: 'wx',
  });
  fs.renameSync(temporaryPath, resolved);
  return Object.freeze({
    targetPath: normalizePath(resolved),
    finalHash: sha256File(resolved),
  });
}

function safeWriteJson(targetPath, value, options) {
  return safeWriteText(targetPath, stableStringify(value), options);
}

function resolveAssetRoot({
  filename = __filename,
  dirname = __dirname,
} = {}) {
  const packageRoot = filename.endsWith('.ts')
    ? path.resolve(dirname, '..', '..', '..', '..', '..')
    : path.resolve(dirname, '..', '..', '..');
  return fs.existsSync(
    path.join(packageRoot, '_bmad', 'shared', 'goal-contract')
  )
    ? packageRoot
    : path.resolve(packageRoot, '..', '..');
}

const SCHEMA_ROOT = path.join(
  resolveAssetRoot(),
  '_bmad',
  'shared',
  'goal-contract'
);

function schemaFileName(schemaId) {
  if (!RECEIPT_SCHEMA_IDS.has(schemaId)) {
    throw failure('partition_receipt_schema_unknown', { schemaId });
  }
  return `${schemaId.slice(0, -'/v1'.length)}.schema.json`;
}

function schemaValidator(schemaId) {
  if (!validators.has(schemaId)) {
    const schemaPath = path.join(SCHEMA_ROOT, schemaFileName(schemaId));
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    validators.set(
      schemaId,
      new Ajv2020({ allErrors: true, strict: false }).compile(schema)
    );
  }
  return validators.get(schemaId);
}

function validateSchema(schemaId, value) {
  const validate = schemaValidator(schemaId);
  if (!validate(value)) {
    throw failure('partition_receipt_schema_invalid', {
      schemaId,
      validationErrors: validate.errors || [],
    });
  }
}

function assertUniqueSemanticArrays(value, fieldPath = '$') {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string')) {
      if (
        !fieldPath.endsWith('.argv') &&
        new Set(value).size !== value.length
      ) {
        throw failure('partition_receipt_duplicate_semantic_id', {
          fieldPath,
        });
      }
    } else if (value.every((item) => item && typeof item === 'object')) {
      const commandIds = value
        .map((item) => item.commandId)
        .filter((item) => typeof item === 'string');
      if (
        commandIds.length > 0 &&
        new Set(commandIds).size !== commandIds.length
      ) {
        throw failure('partition_receipt_duplicate_semantic_id', {
          fieldPath: `${fieldPath}.commandId`,
        });
      }
    }
    value.forEach((item, index) =>
      assertUniqueSemanticArrays(item, `${fieldPath}[${index}]`)
    );
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      assertUniqueSemanticArrays(item, `${fieldPath}.${key}`);
    }
  }
}

function canonicalizeValue(value, fieldName = '') {
  if (Array.isArray(value)) {
    const canonical = value.map((item) => canonicalizeValue(item));
    if (
      fieldName !== 'argv' &&
      canonical.every((item) => typeof item === 'string')
    ) {
      return canonical.sort();
    }
    return canonical;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeValue(value[key], key)])
  );
}

function canonicalizeForSchema(schemaId, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw failure('partition_receipt_payload_invalid', { schemaId });
  }
  if (payload.schemaVersion !== schemaId) {
    throw failure('partition_receipt_schema_identity_mismatch', {
      schemaId,
      actualSchemaVersion: payload.schemaVersion,
    });
  }
  assertUniqueSemanticArrays(payload);
  const canonical = canonicalizeValue(structuredClone(payload));
  validateSchema(schemaId, canonical);
  return canonical;
}

function assertCanonicalReceiptBytes(filePath, payload) {
  const expected = stableStringify(payload);
  const actual = fs.readFileSync(filePath, 'utf8');
  if (actual !== expected) {
    throw failure('partition_receipt_noncanonical_bytes', {
      targetPath: normalizePath(filePath),
    });
  }
}

function writeValidatedPartitionReceipt({
  schemaId,
  targetPath,
  payload,
}) {
  const canonical = canonicalizeForSchema(schemaId, payload);
  safeWriteJson(targetPath, canonical, {
    mode: fs.existsSync(targetPath) ? 'replace' : 'create',
  });
  const receiptHash = sha256File(targetPath);
  const reread = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  validateSchema(schemaId, reread);
  assertCanonicalReceiptBytes(targetPath, reread);
  if (stableStringify(reread) !== stableStringify(canonical)) {
    throw failure('partition_receipt_readback_mismatch', {
      targetPath: normalizePath(targetPath),
    });
  }
  return Object.freeze({
    path: normalizePath(targetPath),
    receiptHash,
    payload: reread,
  });
}

function readValidatedPartitionReceipt(targetPath, expectedSchemaId = null) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    throw failure('partition_receipt_invalid_json', {
      targetPath: normalizePath(targetPath),
    });
  }
  const schemaId = expectedSchemaId || payload.schemaVersion;
  const canonical = canonicalizeForSchema(schemaId, payload);
  assertCanonicalReceiptBytes(targetPath, canonical);
  return canonical;
}

function readStagedAuthority(staged) {
  const analysisReceiptBytes = fs.readFileSync(
    staged.analysisReceiptPath,
    'utf8'
  );
  const partitionManifestBytes = fs.readFileSync(staged.manifestPath, 'utf8');
  let analysisReceipt;
  let manifest;
  try {
    analysisReceipt = JSON.parse(analysisReceiptBytes);
    manifest = JSON.parse(partitionManifestBytes);
  } catch {
    throw failure('partition_stage_reread_mismatch');
  }
  const compiled = {
    analysisReceipt,
    analysisReceiptBytes,
    partitionAnalysisReceiptHash: sha256File(staged.analysisReceiptPath),
    manifest,
    partitionManifestBytes,
    partitionManifestHash: sha256File(staged.manifestPath),
  };
  validatePartitionManifest(compiled);
  if (
    staged.partitionRunId !== manifest.partitionRunId ||
    staged.analysisReceiptHash !== compiled.partitionAnalysisReceiptHash ||
    staged.partitionManifestHash !== compiled.partitionManifestHash ||
    stableStringify(staged.manifest) !== stableStringify(manifest)
  ) {
    throw failure('partition_manifest_changed_during_finalization');
  }
  return compiled;
}

function relativeRunPath(receiptPath, partitionRunId) {
  const prefix = `partition-runs/${partitionRunId}/`;
  if (
    typeof receiptPath !== 'string' ||
    !receiptPath.startsWith(prefix) ||
    receiptPath.includes('\\') ||
    receiptPath.split('/').includes('..')
  ) {
    throw failure('partition_final_receipt_path_mismatch', { receiptPath });
  }
  return receiptPath.slice(prefix.length);
}

function assertFinalReceiptPaths({ analysisReceipt, manifest }) {
  const root = `partition-runs/${manifest.partitionRunId}`;
  const expected = {
    partitionAnalysisReceiptPath: `${root}/partition-analysis.receipt.json`,
    partitionManifestPath: `${root}/partition-manifest.json`,
    globalCoverageReceiptPath: `${root}/global-coverage.receipt.json`,
  };
  for (const [field, value] of Object.entries(expected)) {
    const actual =
      field === 'partitionAnalysisReceiptPath'
        ? manifest[field]
        : analysisReceipt[field];
    if (actual !== value) {
      throw failure('partition_final_receipt_path_mismatch', {
        field,
        expected: value,
        actual,
      });
    }
  }
  if (manifest.globalCoverageReceiptPath !== expected.globalCoverageReceiptPath) {
    throw failure('partition_final_receipt_path_mismatch', {
      field: 'manifest.globalCoverageReceiptPath',
    });
  }
  for (const partition of manifest.partitions) {
    const expectedSelection =
      `${root}/partitions/${partition.partitionId}/selection.receipt.json`;
    if (partition.selectionReceiptPath !== expectedSelection) {
      throw failure('partition_final_receipt_path_mismatch', {
        field: 'selectionReceiptPath',
        partitionId: partition.partitionId,
      });
    }
  }
}

function validateFinalizationReceipts({
  compiled,
  globalCoverage,
  selections,
}) {
  const { manifest, partitionManifestHash } = compiled;
  const canonicalCoverage = canonicalizeForSchema(
    'goal-contract-partition-global-coverage-receipt/v1',
    globalCoverage
  );
  if (
    canonicalCoverage.decision !== 'pass' ||
    canonicalCoverage.partitionManifestHash !== partitionManifestHash ||
    stableStringify(canonicalCoverage.partitionIds) !==
      stableStringify([...manifest.topologicalOrder].sort())
  ) {
    throw failure('partition_global_coverage_blocked');
  }
  const byPartitionId = new Map();
  for (const selection of selections || []) {
    const canonical = canonicalizeForSchema(
      'goal-contract-partition-selection-receipt/v1',
      selection
    );
    if (byPartitionId.has(canonical.partitionId)) {
      throw failure('partition_selection_receipt_duplicate', {
        partitionId: canonical.partitionId,
      });
    }
    byPartitionId.set(canonical.partitionId, canonical);
  }
  if (byPartitionId.size !== manifest.partitions.length) {
    throw failure('partition_selection_receipt_missing');
  }
  for (const partition of manifest.partitions) {
    const selection = byPartitionId.get(partition.partitionId);
    if (
      !selection ||
      selection.decision !== 'pass' ||
      selection.partitionManifestHash !== partitionManifestHash ||
      selection.partitionSetHash !== manifest.partitionSetHash ||
      selection.selectionSetHash !== partition.selectionSetHash
    ) {
      throw failure('partition_selection_receipt_mismatch', {
        partitionId: partition.partitionId,
      });
    }
  }
  return { globalCoverage: canonicalCoverage, selections: byPartitionId };
}

function writeImmutableReceipt({
  schemaId,
  targetPath,
  payload,
  writeReceipt,
}) {
  const canonical = canonicalizeForSchema(schemaId, payload);
  if (fs.existsSync(targetPath)) {
    const current = readValidatedPartitionReceipt(targetPath, schemaId);
    if (stableStringify(current) !== stableStringify(canonical)) {
      throw failure('partition_run_identity_collision', {
        targetPath: normalizePath(targetPath),
      });
    }
    return Object.freeze({
      path: normalizePath(targetPath),
      receiptHash: sha256File(targetPath),
      payload: current,
    });
  }
  return writeReceipt({ schemaId, targetPath, payload: canonical });
}

function verifyPromotedRun({
  finalRoot,
  compiled,
  globalCoverage,
  selections,
}) {
  const analysisPath = path.join(finalRoot, 'partition-analysis.receipt.json');
  const manifestPath = path.join(finalRoot, 'partition-manifest.json');
  if (
    !fs.existsSync(analysisPath) ||
    !fs.existsSync(manifestPath) ||
    fs.readFileSync(analysisPath, 'utf8') !== compiled.analysisReceiptBytes ||
    fs.readFileSync(manifestPath, 'utf8') !== compiled.partitionManifestBytes
  ) {
    throw failure('partition_run_identity_collision');
  }
  const globalPath = path.join(
    finalRoot,
    relativeRunPath(
      compiled.manifest.globalCoverageReceiptPath,
      compiled.manifest.partitionRunId
    )
  );
  const currentGlobal = readValidatedPartitionReceipt(
    globalPath,
    globalCoverage.schemaVersion
  );
  if (stableStringify(currentGlobal) !== stableStringify(globalCoverage)) {
    throw failure('partition_run_identity_collision');
  }
  for (const partition of compiled.manifest.partitions) {
    const selectionPath = path.join(
      finalRoot,
      relativeRunPath(
        partition.selectionReceiptPath,
        compiled.manifest.partitionRunId
      )
    );
    const current = readValidatedPartitionReceipt(
      selectionPath,
      'goal-contract-partition-selection-receipt/v1'
    );
    if (
      stableStringify(current) !==
      stableStringify(selections.get(partition.partitionId))
    ) {
      throw failure('partition_run_identity_collision');
    }
  }
  return { analysisPath, manifestPath, globalPath };
}

function finalizePartitionRun({
  staged,
  receiptsDir,
  globalCoverage,
  selections,
  activeManifestPath,
  writeReceipt = writeValidatedPartitionReceipt,
  renameDirectory = fs.renameSync,
  writeActiveManifest = safeWriteText,
}) {
  const compiled = readStagedAuthority(staged);
  assertFinalReceiptPaths(compiled);
  const validated = validateFinalizationReceipts({
    compiled,
    globalCoverage,
    selections,
  });
  const stageRoot = path.dirname(path.resolve(staged.manifestPath));
  const expectedStageRoot = path.join(
    path.resolve(receiptsDir),
    '.partition-staging',
    compiled.manifest.partitionRunId
  );
  if (stageRoot !== expectedStageRoot) {
    throw failure('partition_stage_path_mismatch');
  }
  const globalCoveragePath = path.join(
    stageRoot,
    relativeRunPath(
      compiled.manifest.globalCoverageReceiptPath,
      compiled.manifest.partitionRunId
    )
  );
  writeImmutableReceipt({
    schemaId: validated.globalCoverage.schemaVersion,
    targetPath: globalCoveragePath,
    payload: validated.globalCoverage,
    writeReceipt,
  });
  for (const partition of compiled.manifest.partitions) {
    writeImmutableReceipt({
      schemaId: 'goal-contract-partition-selection-receipt/v1',
      targetPath: path.join(
        stageRoot,
        relativeRunPath(
          partition.selectionReceiptPath,
          compiled.manifest.partitionRunId
        )
      ),
      payload: validated.selections.get(partition.partitionId),
      writeReceipt,
    });
  }
  if (
    fs.readFileSync(staged.manifestPath, 'utf8') !==
    compiled.partitionManifestBytes
  ) {
    throw failure('partition_manifest_changed_during_finalization');
  }
  const finalRoot = path.join(
    path.resolve(receiptsDir),
    'partition-runs',
    compiled.manifest.partitionRunId
  );
  fs.mkdirSync(path.dirname(finalRoot), { recursive: true });
  if (fs.existsSync(finalRoot)) {
    verifyPromotedRun({
      finalRoot,
      compiled,
      globalCoverage: validated.globalCoverage,
      selections: validated.selections,
    });
  } else {
    renameDirectory(stageRoot, finalRoot);
  }
  const promoted = verifyPromotedRun({
    finalRoot,
    compiled,
    globalCoverage: validated.globalCoverage,
    selections: validated.selections,
  });
  writeActiveManifest(activeManifestPath, compiled.partitionManifestBytes, {
    mode: fs.existsSync(activeManifestPath) ? 'replace' : 'create',
  });
  if (
    fs.readFileSync(activeManifestPath, 'utf8') !==
    compiled.partitionManifestBytes
  ) {
    throw failure('partition_active_output_changed');
  }
  return Object.freeze({
    runId: compiled.manifest.partitionRunId,
    partitionRunId: compiled.manifest.partitionRunId,
    manifest: compiled.manifest,
    promotedRunPath: normalizePath(finalRoot),
    promotedManifestPath: normalizePath(promoted.manifestPath),
    globalCoverageReceiptPath: normalizePath(promoted.globalPath),
    activeManifestPath: normalizePath(activeManifestPath),
    activeManifestHash: sha256File(activeManifestPath),
  });
}

module.exports = {
  buildDependencyCompatibilityReceipt,
  canonicalizeForSchema,
  finalizePartitionRun,
  readValidatedPartitionReceipt,
  resolveAssetRoot,
  validateDependencyCompatibilityReceipt,
  writeDependencyCompatibilityReceipt,
  writeValidatedPartitionReceipt,
};
