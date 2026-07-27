const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

export type GoalContractCommandModule = never;

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

/* goal-contract-source-runtime:start */
const SOURCE_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PARTITION_ASSET_ROOT = SOURCE_ROOT;

function loadDistModule(relativePath) {
  return require(path.join(PACKAGE_ROOT, 'dist', relativePath));
}

function loadPartitionModule(relativePath) {
  const sourceBase = path.join(PACKAGE_ROOT, 'src', relativePath);
  const distBase = path.join(PACKAGE_ROOT, 'dist', relativePath);
  return require(
    firstExistingPath([
      `${sourceBase}.ts`,
      path.join(sourceBase, 'index.ts'),
      `${distBase}.js`,
      path.join(distBase, 'index.js'),
    ])
  );
}
/* goal-contract-source-runtime:end */

function loadWholeSourceDependencies() {
  const { safeWriteText, sha256File } = loadDistModule('utils/large-document-writer');
  const { extractSourceObligations } = loadDistModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { buildSlotData } = loadDistModule('utils/goal-contract/slot-data-builder');
  const { resolveEntryScenario, validateEntryAuthority } = loadDistModule(
    'utils/goal-contract/entry-scenarios'
  );
  const { defaultReceiptPaths, writeCoverageReceipt, writeGenerationReceipt } = loadPartitionModule(
    'utils/goal-contract/goal-contract-receipts'
  );
  const { resolveAuditProfile, runStandaloneDeterministicPreflight } = loadDistModule(
    'utils/goal-contract/standalone-audit-controller'
  );
  return {
    buildSlotData,
    defaultReceiptPaths,
    extractSourceObligations,
    resolveAuditProfile,
    resolveEntryScenario,
    runStandaloneDeterministicPreflight,
    safeWriteText,
    sha256File,
    validateEntryAuthority,
    writeCoverageReceipt,
    writeGenerationReceipt,
  };
}

function take(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) return fallback;
  return value;
}

function has(args, name) {
  return args.includes(name);
}

function takeAll(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (value && !value.startsWith('-')) values.push(value);
  }
  return values;
}

function emitJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function normalize(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function loadRenderer() {
  return require(
    firstExistingPath([
      path.join(
        SOURCE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'render-goal-contract.js'
      ),
      path.join(
        PACKAGE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'render-goal-contract.js'
      ),
    ])
  );
}

function loadCommandPortabilityChecker() {
  return require(
    firstExistingPath([
      path.join(
        SOURCE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'check-contract-command-portability.js'
      ),
      path.join(
        PACKAGE_ROOT,
        '_bmad',
        'shared',
        'goal-contract',
        'scripts',
        'check-contract-command-portability.js'
      ),
    ])
  );
}

function failurePayload(failureClass, error, extra = {}) {
  const payload = {
    ok: false,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    failureClass,
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  };
  for (const field of [
    'sourceId',
    'lineStart',
    'lineEnd',
    'matchedPhrase',
    'sourceExcerpt',
    'repairHint',
  ]) {
    if (error && Object.prototype.hasOwnProperty.call(error, field)) {
      payload[field] = error[field];
    }
  }
  return payload;
}

function rendererIssues(audit) {
  const issues = [];
  for (const [field, code] of [
    ['missingRequiredSlots', 'required_slot_missing'],
    ['missingRequiredSections', 'required_section_missing'],
    ['missingInvariantFragments', 'invariant_fragment_missing'],
  ]) {
    for (const location of audit?.[field] || []) {
      issues.push({ code, location });
    }
  }
  return issues;
}

function assertPartitionGenerationArgsComplete(args) {
  const manifestFlag = has(args, '--partition-manifest');
  const partitionIdFlag = has(args, '--partition-id');
  const manifestPath = take(args, '--partition-manifest');
  const partitionId = take(args, '--partition-id');
  if (manifestFlag !== partitionIdFlag || (manifestFlag && (!manifestPath || !partitionId))) {
    throw Object.assign(new Error('partition_generation_arguments_incomplete'), {
      failureClass: 'partition_generation_arguments_incomplete',
      missingArguments: [
        ...(!manifestPath ? ['--partition-manifest'] : []),
        ...(!partitionId ? ['--partition-id'] : []),
      ],
    });
  }
}

function generateWholeSource(args) {
  assertPartitionGenerationArgsComplete(args);
  const {
    buildSlotData,
    defaultReceiptPaths,
    extractSourceObligations,
    resolveAuditProfile,
    resolveEntryScenario,
    runStandaloneDeterministicPreflight,
    safeWriteText,
    sha256File,
    validateEntryAuthority,
    writeCoverageReceipt,
    writeGenerationReceipt,
  } = loadWholeSourceDependencies();
  const entry = resolveEntryScenario(takeAll(args, '--entry'));
  if (entry.entryScenario !== 'standalone_goal_contract') {
    throw Object.assign(new Error('entry_route_mismatch'), {
      failureClass: 'entry_route_mismatch',
      entryScenario: entry.entryScenario,
      expectedEntryScenario: 'standalone_goal_contract',
    });
  }
  const sourcePath = take(args, '--source');
  const outPath = take(args, '--out');
  const entryAuthority = validateEntryAuthority({
    entryScenario: entry.entryScenario,
    sourceAuthority: sourcePath ? entry.sourceAuthority : null,
    requestedOutputs: outPath ? [path.basename(outPath)] : [],
  });
  if (entryAuthority.decision !== 'pass') {
    throw Object.assign(new Error(entryAuthority.failureClass), entryAuthority);
  }
  if (!fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`source plan missing: ${sourcePath}`), {
      failureClass: 'source_plan_missing',
    });
  }

  const resolvedOut = path.resolve(outPath);
  const receipts = defaultReceiptPaths(resolvedOut);
  const coverageReceiptPath = path.resolve(
    take(args, '--coverage-receipt', receipts.coverageReceiptPath)
  );
  const generationReceiptPath = path.resolve(
    take(args, '--generation-receipt', receipts.generationReceiptPath)
  );
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const source = extractSourceObligations({ sourcePath: normalize(sourcePath), sourceText });
  const profilePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
  ]);
  const templatePath = firstExistingPath([
    path.join(
      SOURCE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
    path.join(
      PACKAGE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
  ]);
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const { slotData, registries, implementationProofAudit } = buildSlotData({
    source,
    profile,
    outPath: normalize(resolvedOut),
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
  });
  const { renderGoalContract } = loadRenderer();
  const rendered = renderGoalContract({
    templateText,
    profile,
    slotData,
    validateHashes: true,
    coverageReceipt: {
      sourcePlanHash: source.sourcePlanHash,
      sourceObligations: registries.sourceObligations,
      unmappedSourceObligations: [],
    },
    generationMode: 'source_plan_strict',
  });
  const { auditCommandPortability } = loadCommandPortabilityChecker();
  const preflightStartedAt = new Date().toISOString();
  const commandPortabilityAudit = auditCommandPortability({
    content: rendered.document,
    targetPath: resolvedOut,
    shell: 'pwsh',
  });
  const deterministicPreflight = runStandaloneDeterministicPreflight({
    checks: [
      {
        id: 'renderer_structure',
        run: () => {
          const issues = rendererIssues(rendered.audit);
          return {
            decision: issues.length === 0 ? 'pass' : 'block',
            issues,
          };
        },
      },
      {
        id: 'source_coverage',
        run: () => ({
          decision:
            rendered.audit.coverageDecision === 'pass' &&
            implementationProofAudit.decision === 'pass'
              ? 'pass'
              : 'block',
          issues: [],
        }),
      },
      {
        id: 'command_portability',
        run: () => ({
          decision: commandPortabilityAudit.status === 'PASS' ? 'pass' : 'block',
          issues: (commandPortabilityAudit.issues || []).map((item) => ({
            code: item.code || 'command_not_portable',
            location: item.location || item.line || item.command || normalize(resolvedOut),
          })),
        }),
      },
    ],
    startedAt: preflightStartedAt,
    completedAt: new Date().toISOString(),
  });
  const auditMetrics = {
    schemaVersion: 'standalone-audit-metrics/v1',
    sequence: ['deterministic_preflight'],
    deterministicCheckCount: deterministicPreflight.checkCount,
    deterministicIssueCount: deterministicPreflight.issueCount,
    auditEpochOpened: false,
    persistedTransientViews: 0,
  };
  const auditProfile = resolveAuditProfile(entry.entryScenario);
  if (deterministicPreflight.decision !== 'pass') {
    throw Object.assign(
      new Error(
        `goal-contract deterministic preflight failed with ${deterministicPreflight.issueCount} issue(s)`
      ),
      {
        failureClass:
          commandPortabilityAudit.status === 'PASS'
            ? 'deterministic_preflight_failed'
            : 'command_portability_failed',
        commandPortabilityAudit,
        deterministicPreflight,
        auditMetrics,
      }
    );
  }
  const writeReceipt = safeWriteText(resolvedOut, rendered.document, {
    mode: fs.existsSync(resolvedOut) ? 'replace' : 'create',
  });
  const goalContractHash = sha256File(resolvedOut);
  const coverageReceipt = {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    entryScenario: entry.entryScenario,
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    sourceBytes: source.sourceBytes,
    sourceLines: source.sourceLines,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    sourceObligations: registries.sourceObligations,
    unmappedSourceObligations: [],
    orphanGeneratedRefs: [],
    blockingReasons: [],
    decision: 'pass',
  };
  writeCoverageReceipt(coverageReceiptPath, coverageReceipt);
  const generationReceipt = {
    ok: true,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    entryScenario: entry.entryScenario,
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
    sourceObligationCount: registries.sourceObligations.length,
    unmappedSourceObligations: 0,
    rendererAudit: rendered.audit,
    coverageAudit: { decision: 'pass', unmappedSourceObligations: [] },
    implementationProofAudit,
    commandPortabilityAudit,
    deterministicPreflight,
    auditMetrics,
    auditProfile,
    writeReceipt,
  };
  writeGenerationReceipt(generationReceiptPath, generationReceipt);
  return generationReceipt;
}

function resolvePartitionReceiptPath(receiptsDir, receiptPath) {
  if (
    typeof receiptPath !== 'string' ||
    receiptPath.length === 0 ||
    path.isAbsolute(receiptPath) ||
    receiptPath.includes('\\') ||
    receiptPath.split('/').includes('..')
  ) {
    throw partitionFailure('partition_receipt_path_invalid', { receiptPath });
  }
  const root = path.resolve(receiptsDir);
  const resolved = path.resolve(root, receiptPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw partitionFailure('partition_receipt_path_invalid', { receiptPath });
  }
  return resolved;
}

function selectedCommandRecords(graphInput, commandIds) {
  const records = new Map<string, Record<string, unknown>>();
  for (const command of Object.values(graphInput.commands || {}).flat()) {
    const record = command as Record<string, unknown>;
    const commandId = record?.commandId || record?.id;
    if (typeof commandId === 'string' && !records.has(commandId)) {
      records.set(commandId, record);
    }
  }
  return commandIds.map((commandId) => {
    const command = records.get(commandId);
    if (!command) {
      throw partitionFailure('partition_selection_command_unknown', { commandId });
    }
    return Object.freeze({ ...structuredClone(command), commandId });
  });
}

function enrichSelectedScope({ selectedScope, reconciliation }) {
  const sourceIds = new Set(
    selectedScope.selectionReceipt.selectedPrimarySourceObligationIds
  );
  const primarySourceObligations = (reconciliation.graphInput.sourceObligations || [])
    .filter((source) => sourceIds.has(source.id))
    .map((source) => structuredClone(source));
  if (primarySourceObligations.length !== sourceIds.size) {
    throw partitionFailure('partition_selection_source_obligation_unknown', {
      expected: sourceIds.size,
      actual: primarySourceObligations.length,
    });
  }
  return Object.freeze({
    ...selectedScope,
    primarySourceObligations,
    commands: selectedCommandRecords(
      reconciliation.graphInput,
      selectedScope.selectionReceipt.selectedCommandIds
    ),
  });
}

async function generatePartitionBound(args) {
  const {
    defaultReceiptPaths,
    writePartitionChildCoverageReceipt,
    writePartitionChildGenerationReceipt,
  } = loadPartitionModule('utils/goal-contract/goal-contract-receipts');
  const {
    readValidatedPartitionReceipt,
  } = loadPartitionModule('utils/goal-contract/partition-receipts');
  const {
    buildGlobalPartitionCoverageReceipt,
    selectPartitionScope,
  } = loadPartitionModule('utils/goal-contract/partition-selector');
  const { buildPartitionSlotData } = loadPartitionModule(
    'utils/goal-contract/slot-data-builder'
  );
  const {
    resolveEntryScenario,
    validateEntryAuthority,
  } = loadPartitionModule('utils/goal-contract/entry-scenarios');
  const {
    resolveAuditProfile,
    runStandaloneDeterministicPreflight,
  } = loadPartitionModule('utils/goal-contract/standalone-audit-controller');
  const { safeWriteText, sha256File } = loadWholeSourceDependencies();

  const entry = resolveEntryScenario(takeAll(args, '--entry'));
  if (entry.entryScenario !== 'standalone_goal_contract') {
    throw Object.assign(new Error('entry_route_mismatch'), {
      failureClass: 'entry_route_mismatch',
      entryScenario: entry.entryScenario,
      expectedEntryScenario: 'standalone_goal_contract',
    });
  }
  const sourcePath = take(args, '--source');
  const outPath = take(args, '--out');
  const entryAuthority = validateEntryAuthority({
    entryScenario: entry.entryScenario,
    sourceAuthority: sourcePath ? entry.sourceAuthority : null,
    requestedOutputs: outPath ? [path.basename(outPath)] : [],
  });
  if (entryAuthority.decision !== 'pass') {
    throw Object.assign(new Error(entryAuthority.failureClass), entryAuthority);
  }

  const manifestPath = path.resolve(take(args, '--partition-manifest'));
  const partitionId = take(args, '--partition-id');
  const resolvedOut = path.resolve(outPath);
  const receiptsDir = path.resolve(
    take(
      args,
      '--receipts-dir',
      path.join(path.dirname(manifestPath), '.goal-contract-receipts')
    )
  );
  const receiptPaths = defaultReceiptPaths(resolvedOut);
  const coverageReceiptPath = path.resolve(
    take(args, '--coverage-receipt', receiptPaths.coverageReceiptPath)
  );
  const generationReceiptPath = path.resolve(
    take(args, '--generation-receipt', receiptPaths.generationReceiptPath)
  );

  const authority = await compilePartitionAuthority(args);
  let activeManifestBytes;
  try {
    activeManifestBytes = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    throw partitionFailure('partition_manifest_missing', {
      partitionManifestPath: normalize(manifestPath),
    });
  }
  if (activeManifestBytes !== authority.compiled.partitionManifestBytes) {
    throw partitionFailure('partition_manifest_stale_or_tampered', {
      partitionManifestPath: normalize(manifestPath),
    });
  }
  let manifest;
  try {
    manifest = JSON.parse(activeManifestBytes);
  } catch {
    throw partitionFailure('partition_manifest_invalid_json');
  }

  const selected = selectPartitionScope({
    executionProjection: authority.projection,
    partitionManifest: manifest,
    partitionId,
  });
  const selectedScope = enrichSelectedScope({
    selectedScope: selected,
    reconciliation: authority.reconciliation,
  });
  const partition = selectedScope.partition;
  const globalCoverageReceiptPath = resolvePartitionReceiptPath(
    receiptsDir,
    manifest.globalCoverageReceiptPath
  );
  const selectionReceiptPath = resolvePartitionReceiptPath(
    receiptsDir,
    partition.selectionReceiptPath
  );
  const globalCoverageReceipt = readValidatedPartitionReceipt(
    globalCoverageReceiptPath,
    'goal-contract-partition-global-coverage-receipt/v1'
  );
  const selectionReceipt = readValidatedPartitionReceipt(
    selectionReceiptPath,
    'goal-contract-partition-selection-receipt/v1'
  );
  const expectedGlobalCoverage = buildGlobalPartitionCoverageReceipt({
    executionProjection: authority.projection,
    candidateManifest: manifest,
  });
  if (stableStringify(globalCoverageReceipt) !== stableStringify(expectedGlobalCoverage)) {
    throw partitionFailure('partition_global_coverage_receipt_stale');
  }
  if (
    stableStringify(selectionReceipt) !==
    stableStringify(selectedScope.selectionReceipt)
  ) {
    throw partitionFailure('partition_selection_receipt_stale', { partitionId });
  }

  const profilePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
  ]);
  const templatePath = firstExistingPath([
    path.join(
      SOURCE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
    path.join(
      PACKAGE_ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-execution-contract-template.md'
    ),
  ]);
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const globalCoverageReceiptHash = sha256File(globalCoverageReceiptPath);
  const selectionReceiptHash = sha256File(selectionReceiptPath);
  const bindings = {
    partitionManifestPath: normalize(manifestPath),
    partitionManifestHash: authority.compiled.partitionManifestHash,
    partitionAnalysisReceiptHash: manifest.partitionAnalysisReceiptHash,
    partitionSetHash: manifest.partitionSetHash,
    selectionReceiptPath: normalize(selectionReceiptPath),
    selectionReceiptHash,
    selectionSetHash: partition.selectionSetHash,
    globalCoverageReceiptPath: normalize(globalCoverageReceiptPath),
    globalCoverageReceiptHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    methodologyProfileArtifactHash:
      authority.methodology.methodologyProfileArtifactHash,
    executionProjectionHash: manifest.executionProjectionHash,
    taskDagHash: manifest.taskDagHash,
    sequenceMode: manifest.sequenceMode,
    sequenceApplicability: manifest.sequenceApplicability,
    sequenceCoverage: manifest.sequenceCoverage,
    sequenceClosureStatus: manifest.sequenceClosureStatus,
    childContractAuthority: manifest.childContractAuthority,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionPolicyArtifactHash:
      authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
  };
  const source = {
    sourcePlanPath: manifest.masterSourcePath,
    sourcePlanHash: manifest.masterSourceHash,
    sourceBytes: authority.snapshot.sourceBytes,
    sourceLines: authority.snapshot.sourceLines,
  };
  const {
    slotData,
    registries,
    coverageAudit,
    implementationProofAudit,
  } = buildPartitionSlotData({
    source,
    profile,
    selectedScope,
    receiptPaths: {
      outPath: normalize(resolvedOut),
      coverageReceiptPath: normalize(coverageReceiptPath),
      generationReceiptPath: normalize(generationReceiptPath),
    },
    bindings,
  });
  const { renderGoalContract } = loadRenderer();
  const rendered = renderGoalContract({
    templateText,
    profile,
    slotData,
    validateHashes: true,
    generationMode: 'partition_selected_scope',
  });
  const sequenceStateFields = [
    'sequenceMode',
    'sequenceApplicability',
    'sequenceCoverage',
    'sequenceClosureStatus',
    'childContractAuthority',
  ];
  for (const field of sequenceStateFields) {
    if (
      bindings[field] !== manifest[field] ||
      !new RegExp(`^${field}: ${manifest[field]}$`, 'mu').test(
        rendered.document
      )
    ) {
      throw partitionFailure(
        'partition_child_generation_sequence_state_mismatch',
        { field }
      );
    }
  }
  const { auditCommandPortability } = loadCommandPortabilityChecker();
  const commandPortabilityAudit = auditCommandPortability({
    content: rendered.document,
    targetPath: resolvedOut,
    shell: 'pwsh',
  });
  const preflightStartedAt = new Date().toISOString();
  const deterministicPreflight = runStandaloneDeterministicPreflight({
    checks: [
      {
        id: 'renderer_structure',
        run: () => {
          const issues = rendererIssues(rendered.audit);
          return {
            decision: issues.length === 0 ? 'pass' : 'block',
            issues,
          };
        },
      },
      {
        id: 'partition_selected_coverage',
        run: () => ({
          decision:
            coverageAudit.decision === 'pass' &&
            implementationProofAudit.decision === 'pass'
              ? 'pass'
              : 'block',
          issues: [],
        }),
      },
      {
        id: 'command_portability',
        run: () => ({
          decision: commandPortabilityAudit.status === 'PASS' ? 'pass' : 'block',
          issues: (commandPortabilityAudit.issues || []).map((item) => ({
            code: item.code || 'command_not_portable',
            location: item.location || item.line || item.command || normalize(resolvedOut),
          })),
        }),
      },
    ],
    startedAt: preflightStartedAt,
    completedAt: new Date().toISOString(),
  });
  if (deterministicPreflight.decision !== 'pass') {
    throw partitionFailure(
      commandPortabilityAudit.status === 'PASS'
        ? 'deterministic_preflight_failed'
        : 'command_portability_failed',
      {
        rendererAudit: rendered.audit,
        commandPortabilityAudit,
        deterministicPreflight,
      }
    );
  }

  const writeReceipt = safeWriteText(resolvedOut, rendered.document, {
    mode: fs.existsSync(resolvedOut) ? 'replace' : 'create',
  });
  const goalContractHash = sha256File(resolvedOut);
  const coverage = writePartitionChildCoverageReceipt({
    targetPath: coverageReceiptPath,
    partitionId,
    partitionManifestHash: authority.compiled.partitionManifestHash,
    selectionReceiptHash,
    globalCoverageReceiptHash,
    selectedPrimaryObligationIds:
      selectionReceipt.selectedPrimarySourceObligationIds,
    inheritedConstraintIds: selectionReceipt.inheritedConstraintIds,
    excludedObligationIds: uniqueStrings([
      ...selectionReceipt.excludedSourceObligationIds,
      ...selectionReceipt.excludedTraceSliceIds,
      ...selectionReceipt.excludedAtomicTaskIds,
      ...selectionReceipt.excludedAcceptanceIds,
      ...selectionReceipt.excludedCommandIds,
      ...selectionReceipt.excludedEvidenceContractIds,
    ]),
    unmappedSelectedObligations: coverageAudit.unmappedSourceObligations,
    orphanGeneratedTaskIds: registries.tasks.filter(
      (taskId) => !selectionReceipt.selectedPrimaryAtomicTaskIds.includes(taskId)
    ),
    orphanGeneratedAcceptanceIds: registries.acceptance.filter(
      (acceptanceId) => !selectionReceipt.selectedAcceptanceIds.includes(acceptanceId)
    ),
  });
  if (coverage.payload.decision !== 'pass') {
    throw partitionFailure('partition_child_coverage_blocked', {
      blockingReasons: coverage.payload.blockingReasons,
    });
  }
  const generation = writePartitionChildGenerationReceipt({
    targetPath: generationReceiptPath,
    masterSourcePath: manifest.masterSourcePath,
    masterSourceHash: manifest.masterSourceHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    methodologyProfileArtifactHash:
      authority.methodology.methodologyProfileArtifactHash,
    executionProjectionHash: manifest.executionProjectionHash,
    taskDagHash: manifest.taskDagHash,
    sequenceMode: manifest.sequenceMode,
    sequenceApplicability: manifest.sequenceApplicability,
    sequenceCoverage: manifest.sequenceCoverage,
    sequenceClosureStatus: manifest.sequenceClosureStatus,
    childContractAuthority: manifest.childContractAuthority,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionPolicyArtifactHash:
      authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
    partitionManifestPath: normalize(manifestPath),
    partitionManifestHash: authority.compiled.partitionManifestHash,
    partitionAnalysisReceiptHash: manifest.partitionAnalysisReceiptHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionId,
    partitionRole: partition.partitionRole,
    selectionReceiptPath: normalize(selectionReceiptPath),
    selectionReceiptHash,
    selectionSetHash: partition.selectionSetHash,
    globalCoverageReceiptPath: normalize(globalCoverageReceiptPath),
    globalCoverageReceiptHash,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    coverageReceiptPath: normalize(coverageReceiptPath),
    coverageReceiptHash: coverage.receiptHash,
    selectedAtomicTaskCount: selectedScope.primaryAtomicTasks.length,
    inheritedConstraintCount: selectedScope.inheritedConstraints.length,
    rendererAudit: rendered.audit,
    deterministicPreflight,
    commandPortabilityAudit,
    writeReceipt,
  });
  for (const field of sequenceStateFields) {
    if (generation.payload[field] !== manifest[field]) {
      throw partitionFailure(
        'partition_child_generation_sequence_state_mismatch',
        { field }
      );
    }
  }
  if (generation.payload.decision !== 'pass') {
    throw partitionFailure('partition_child_generation_blocked', {
      blockingReasons: generation.payload.blockingReasons,
    });
  }
  return Object.freeze({
    ok: true,
    ...generation.payload,
    generationReceiptPath: normalize(generation.path),
    auditProfile: resolveAuditProfile(entry.entryScenario),
  });
}

async function generate(args) {
  assertPartitionGenerationArgsComplete(args);
  if (has(args, '--partition-manifest') && has(args, '--partition-id')) {
    return generatePartitionBound(args);
  }
  return generateWholeSource(args);
}

function assertNoForbiddenPartitionAuthorityArgs(args) {
  const forbiddenPolicyFlags = [
    '--partition-policy-hash',
    '--policy-hash',
    '--partition-policy-bytes',
    '--partition-policy-json',
  ];
  const forbiddenPolicy = forbiddenPolicyFlags.filter((flag) =>
    args.some((arg) => arg === flag || arg.startsWith(`${flag}=`))
  );
  if (forbiddenPolicy.length > 0) {
    throw Object.assign(new Error('partition_policy_authority_override_forbidden'), {
      failureClass: 'partition_policy_authority_override_forbidden',
      forbidden: forbiddenPolicy,
    });
  }
  const forbiddenFlags = [
    '--partition-count',
    '--task',
    '--selected-candidate',
    '--decision',
    '--selection-receipt',
    '--global-coverage',
    '--global-coverage-decision',
    '--selection-decision',
    '--selection-receipts',
  ];
  const forbidden = forbiddenFlags.filter((flag) =>
    args.some((arg) => arg === flag || arg.startsWith(`${flag}=`))
  );
  if (forbidden.length > 0) {
    throw Object.assign(new Error('partition_authority_argument_forbidden'), {
      failureClass: 'partition_authority_argument_forbidden',
      forbidden,
    });
  }
}

function requireExistingSource(args) {
  const sourcePath = take(args, '--source');
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`source plan missing: ${sourcePath || ''}`), {
      failureClass: 'source_plan_missing',
    });
  }
  return path.resolve(sourcePath);
}

function partitionFailure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...extra,
  });
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function commandLiteral(obligation) {
  const text = String(obligation.exactText || obligation.text || '');
  const fenced = /`([^`\r\n]+)`/u.exec(text);
  return fenced?.[1] || text.replace(/^[-*]\s+\[[ xX]\]\s*[^:]+:\s*/u, '').trim();
}

function sourceAuthorizedPaths({ snapshot, extracted, repositoryFacts }) {
  const factPaths = (repositoryFacts.facts || []).map((fact) => fact.filePath).filter(Boolean);
  const declaredPaths = extracted.sourceObligations.flatMap((obligation) =>
    [...String(obligation.exactText || '').matchAll(/`([^`]+[\\/][^`]+)`/gu)]
      .map((match) => match[1])
      .filter((candidate) => !/\s/u.test(candidate))
  );
  return uniqueStrings([...factPaths, ...declaredPaths, snapshot.sourcePath]);
}

function assertValidDerivedView(view, validate) {
  const validation = validate(view);
  if (validation.decision !== 'pass') {
    throw partitionFailure(validation.failureClass, validation);
  }
  return validation;
}

function normalizeBoundedPermissionText(text) {
  return String(text)
    .replace(/不允许/gu, '禁止')
    .replace(
      /允许一次(?=\s*(?:bounded fresh tarball[^\n]*npm install --no-save|新?\s*(?:Auditor|Judge)))/gu,
      '许可一次'
    )
    .replace(
      /只允许(?=\s*(?:`[^`]+`|通过 deterministic audit units|一个 semantic Judge invocation|：))/gu,
      '只许可'
    )
    .replace(
      /才允许(?=\s*(?:hard-cut|authoritative confirmation|atomic acceptance))/gu,
      '才许可'
    )
    .replace(/表示允许(?=调用 Judge)/gu, '表示许可')
    .replace(/允许(?=\s*`requestedModel`\s*缺失)/gu, '许可')
    .replace(/允许后(?=\s*发生)/gu, '许可后')
    .replace(
      /可以(?=\s*(?:审阅和修订|写 execution evidence|选择 (?:Claude CLI|Codex CLI|OpenAI-compatible HTTP|Anthropic-compatible HTTP)|使用 (?:OpenAI-compatible|Anthropic-compatible)|在不改 production code|追溯到|在 crash recovery 后复用|产生后续修复轮|去重|作为独立 oracle|进行只读搜索|打开 Judge))/gu,
      '能够'
    )
    .replace(
      /\boptional(?=\s+draft preview\s+必须明确标记 non-authoritative)/giu,
      'conditional'
    );
}

function commandClassificationSnapshot(snapshot) {
  const content = snapshot.segments[0].content;
  const normalized = normalizeBoundedPermissionText(content);
  if (normalized === content) return snapshot;
  return {
    ...snapshot,
    segments: [{ ...snapshot.segments[0], content: normalized }],
  };
}

function sourceHeadingPaths(lines) {
  const stack = [];
  return lines.map((line) => {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (stack.length > 0 && stack.at(-1).level >= level) stack.pop();
      stack.push({ level, title: heading[2].trim() });
    }
    return stack.map((entry) => entry.title);
  });
}

function originalObligationText(lines, obligation) {
  const selected = lines.slice(obligation.lineStart - 1, obligation.lineEnd);
  if (selected.length === 1) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(selected[0]);
    if (heading) return heading[2].trim();
  }
  return selected.join('\n').trim();
}

function fallbackStructuredKind(headingPath, currentKind) {
  const nearest = String(headingPath.at(-1) || '').toLowerCase();
  if (/completion|acceptance/u.test(nearest)) return 'completion_criteria';
  if (/commands?/u.test(nearest)) return 'command_block';
  if (/evidence|receipt/u.test(nearest)) return 'observability';
  if (/implementation tasks?|task breakdown/u.test(nearest)) {
    return 'heading_execution_segment';
  }
  return currentKind === 'declared_execution_task'
    ? 'heading_requirement'
    : currentKind;
}

function restoreCommandExtractionAuthority({
  snapshot,
  extracted,
  canonicalSourceObligationGraph,
  hashSourceObligationGraph,
}) {
  const lines = String(snapshot.segments[0].content)
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n')
    .split('\n');
  const headingPaths = sourceHeadingPaths(lines);
  const restored = extracted.sourceObligations.map((obligation) => {
    const rawLine = lines[obligation.lineStart - 1] || '';
    const text = originalObligationText(lines, obligation);
    const headingPath = [
      ...(headingPaths[obligation.lineStart - 1] || obligation.headingPath),
    ];
    const localizedTaskHeading =
      /^#{1,6}\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+)\s*[:：]/u.exec(
        rawLine
      );
    const listDeclaration =
      /^(?:\s*[-*]|\s*\d+\.)\s+(\[[ xX]\]\s*)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(
        rawLine
      );
    const listRemainder = listDeclaration
      ? rawLine.slice(listDeclaration[0].length)
      : '';
    const taskDeclarationSection =
      /^(?:implementation tasks?|implementation task breakdown|task breakdown)$/iu.test(
        String(headingPath.at(-1) || '').trim()
      );
    const demoteBareReference =
      obligation.declaredId &&
      listDeclaration &&
      !listDeclaration[1] &&
      !/^\s*[:：]/u.test(listRemainder) &&
      !taskDeclarationSection;
    const declaredId = localizedTaskHeading
      ? localizedTaskHeading[1]
      : demoteBareReference
        ? null
        : obligation.declaredId
          ? obligation.id
          : null;
    const id =
      declaredId ||
      `SRC-${sha256Text(
        `${snapshot.aggregateHash}:${obligation.lineStart}:${text}`
      )
        .slice(7, 19)
        .toUpperCase()}`;
    const textHash = sha256Text(text);
    return {
      ...obligation,
      id,
      declaredId: Boolean(declaredId),
      kind: localizedTaskHeading
        ? 'declared_execution_task'
        : demoteBareReference
          ? fallbackStructuredKind(headingPath, obligation.kind)
          : obligation.kind,
      headingPath,
      textHash,
      exactText: text,
      text,
      summary: `sourceRef=${obligation.sourcePlanPath}:${obligation.lineStart}-${obligation.lineEnd}; sourceKind=${obligation.kind}; sourceTextHash=${textHash}`,
    };
  });
  const declaredIds = restored
    .filter((obligation) => obligation.declaredId)
    .map((obligation) => obligation.id);
  const duplicateIds = uniqueStrings(
    declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index)
  );
  if (duplicateIds.length > 0) {
    throw partitionFailure('source_obligation_id_duplicate', { duplicateIds });
  }
  const knownIds = new Set(restored.map((obligation) => obligation.id));
  const unknownDependencies = restored.flatMap((obligation) =>
    (obligation.dependencyRefs || [])
      .filter((dependencyId) => !knownIds.has(dependencyId))
      .map((dependencyId) => ({ sourceId: obligation.id, dependencyId }))
  );
  if (unknownDependencies.length > 0) {
    throw partitionFailure('source_obligation_dependency_unknown', {
      unknownDependencies,
    });
  }
  const sourceObligationGraph = canonicalSourceObligationGraph({
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligations: restored,
  });
  return {
    ...extracted,
    sourceObligations: restored,
    sourceObligationGraph,
    sourceObligationGraphHash: hashSourceObligationGraph(
      sourceObligationGraph
    ),
  };
}

function extractCommandSourceObligations({
  snapshot,
  extractSourceObligations,
  canonicalSourceObligationGraph,
  hashSourceObligationGraph,
  findNonDeterministicPhrase,
}) {
  const extracted = extractSourceObligations({
    snapshot: commandClassificationSnapshot(snapshot),
  });
  const ambiguousLocalizedObligation = extracted.sourceObligations.find(
    (obligation) =>
      (obligation.headingPath || []).some((heading) =>
        /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+\s*[:：]/u.test(String(heading))
      ) && findNonDeterministicPhrase(obligation.text)
  );
  if (ambiguousLocalizedObligation) {
    throw partitionFailure('source_obligation_classification_ambiguous', {
      sourceId: ambiguousLocalizedObligation.id,
      matchedPhrase: findNonDeterministicPhrase(
        ambiguousLocalizedObligation.text
      ),
      sourceExcerpt: String(ambiguousLocalizedObligation.text).slice(0, 500),
    });
  }
  return restoreCommandExtractionAuthority({
    snapshot,
    extracted,
    canonicalSourceObligationGraph,
    hashSourceObligationGraph,
  });
}

function selectCommandStructuredBindings(sourceObligations) {
  const applicable = sourceObligations.filter(
    (obligation) => obligation.applicabilityState === 'applicable'
  );
  const tasks = applicable.filter(
    (obligation) => obligation.kind === 'declared_execution_task'
  );
  const select = (primaryKind, fallbackKind) => {
    const primary = applicable.filter(
      (obligation) => obligation.kind === primaryKind
    );
    if (primary.length > 0 || tasks.length === 0) return primary;
    return applicable.filter(
      (obligation) => obligation.kind === fallbackKind
    );
  };
  return {
    tasks,
    acceptance: select('acceptance_condition', 'completion_criteria'),
    commands: select('verification_command', 'command_block'),
    evidence: select('evidence_contract', 'observability'),
  };
}

function deriveStructuredViews({
  snapshot,
  extracted,
  repositoryFacts,
  structuredBindings,
  validators,
}) {
  const applicable = extracted.sourceObligations.filter(
    (obligation) => obligation.applicabilityState === 'applicable'
  );
  const sourceIds = uniqueStrings(applicable.map((obligation) => obligation.id));
  const declaredTasks = structuredBindings.tasks;
  const declaredAcceptance = structuredBindings.acceptance;
  const declaredCommands = structuredBindings.commands;
  const declaredEvidence = structuredBindings.evidence;
  const taskIds = new Set(declaredTasks.map((obligation) => obligation.id));
  const tasks = declaredTasks.map((obligation, index) => ({
    id: obligation.id,
    title: String(obligation.exactText || obligation.text || obligation.id),
    sourceIds: index === 0 ? sourceIds : [obligation.id],
    dependencies: uniqueStrings(
      (obligation.dependencyRefs || []).filter((dependencyId) => taskIds.has(dependencyId))
    ),
    atomicGroupRefs: uniqueStrings(obligation.atomicGroupRefs || []),
  }));
  const commandRecords = declaredCommands.map((obligation) => ({
    id: obligation.id,
    literal: commandLiteral(obligation),
    expectedExitBehavior: 'exits with the declared expected status',
    productionEntryPoint: 'goalContractCommand',
    evidenceType: 'behavior',
    provenanceFields: ['argv', 'cwd', 'exitCode'],
    freshnessRule: 'current source roots',
  }));
  const commandIds = commandRecords.map((command) => command.id);
  const acceptanceIds = declaredAcceptance.map((obligation) => obligation.id);
  const evidenceIds = declaredEvidence.map((obligation) => obligation.id);
  const allowedPaths = sourceAuthorizedPaths({
    snapshot,
    extracted,
    repositoryFacts,
  });
  const traceSlices = tasks.map((task, index) => ({
    id: `TRACE-${task.id}`,
    goalIds: [task.id],
    sourceIds: task.sourceIds,
    acceptanceIds: index === 0 ? acceptanceIds : [],
    evidenceIds: index === 0 ? evidenceIds : [],
    productionSymbols: ['goalContractCommand'],
    allowedPaths,
    directCommands: commandIds,
    impactedCommands: commandIds,
    integrationCommands: commandIds,
    regressionCommands: commandIds,
    dependencies: task.dependencies,
    commitPolicy: 'exactly_one_atomic_commit',
    closeCondition: `The observable outcome for ${task.id} is verified.`,
    stopConditionIds: index === 0 ? ['STOP-STRUCTURED-001'] : [],
  }));
  const primaryTask = tasks[0];
  const primaryTrace = traceSlices[0];
  const acceptanceItems = declaredAcceptance.map((obligation, index) => ({
    id: obligation.id,
    statement: String(obligation.exactText || obligation.text || obligation.id),
    sourceIds: index === 0 ? sourceIds : [obligation.id],
    goalIds: [primaryTask.id],
    traceIds: [primaryTrace.id],
    requiredCommands: commandIds,
    expectedEvidenceIds: evidenceIds,
    requiredEvidenceStrength: 'behavior',
    passCondition: String(obligation.exactText || obligation.text || obligation.id),
  }));
  const expectedEvidence = declaredEvidence.map((obligation) => ({
    id: obligation.id,
    sourceIds: [obligation.id],
    producer: commandIds[0],
    admissibleTypes: ['behavior'],
    requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
    freshnessRule: 'current source roots',
    expectedResult: String(obligation.exactText || obligation.text || obligation.id),
  }));
  const implementationView = {
    tasks,
    traceSlices,
    productionSymbols: ['goalContractCommand'],
    allowedPaths,
    commands: Object.fromEntries(
      ['direct', 'impacted', 'integration', 'regression'].map((kind) => [
        kind,
        commandRecords.map((command) => ({ ...command })),
      ])
    ),
    dependencies: tasks.flatMap((task) =>
      task.dependencies.map((dependencyId) => ({
        from: task.id,
        to: dependencyId,
      }))
    ),
    commitPolicy: 'exactly_one_atomic_commit',
    closeConditions: ['Every typed source obligation has observable closure.'],
    synchronizationObligations: ['source-snapshot', 'evidence-graph'],
    commandEvidenceStrength: Object.fromEntries(
      commandIds.map((commandId) => [commandId, 'behavior'])
    ),
  };
  const acceptanceEvidenceView = {
    acceptanceItems,
    negativeControls: ['Missing or stale evidence fails closed.'],
    productionEntryPoints: ['goalContractCommand'],
    manualScenarios: [
      {
        id: 'MV-STRUCTURED-001',
        title: 'Invoke the public partition command.',
        steps: ['Run the production command with the current source snapshot.'],
        commandIds,
        evidenceIds,
        productionEntryPoints: ['goalContractCommand'],
        expectedResult: 'The command reaches the next unimplemented boundary.',
      },
    ],
    expectedEvidence,
    antiCheatRules: ['Caller-authored partition authority cannot replace derived semantics.'],
    stopConditions: [
      {
        id: 'STOP-STRUCTURED-001',
        condition: 'A required semantic or evidence binding is unavailable.',
        failureClass: 'BLOCKED_ENVIRONMENT',
        sourceIds,
        traceIds: [primaryTrace.id],
      },
    ],
  };
  const implementationValidation = assertValidDerivedView(
    implementationView,
    validators.validateImplementationView
  );
  const acceptanceValidation = assertValidDerivedView(
    acceptanceEvidenceView,
    validators.validateAcceptanceEvidenceView
  );
  const receipt = (viewType, validation) =>
    Object.freeze({
      schemaVersion: 'goal-contract-structured-view-receipt/v1',
      viewType,
      inputHash: snapshot.aggregateHash,
      sourceSnapshotHash: snapshot.aggregateHash,
      sessionIdentity: `structured:${viewType}:${snapshot.aggregateHash}`,
      persistedViewAuthorityFiles: 0,
      validation,
    });
  return Object.freeze({
    mode: 'structured_fast_path',
    implementation: Object.freeze({
      view: Object.freeze(implementationView),
      validation: implementationValidation,
      receipt: receipt('implementation', implementationValidation),
    }),
    acceptanceEvidence: Object.freeze({
      view: Object.freeze(acceptanceEvidenceView),
      validation: acceptanceValidation,
      receipt: receipt('acceptance_evidence', acceptanceValidation),
    }),
  });
}

async function deriveSemanticViews({
  snapshot,
  extracted,
  methodology,
  repositoryFacts,
  providerFactory,
  validators,
}) {
  const provider = providerFactory({
    packageRoot: PARTITION_ASSET_ROOT,
  });
  const request = Object.freeze({
    sourceSnapshot: snapshot,
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfile: methodology.semantic,
    methodologyProfileHash: methodology.methodologyProfileHash,
    repositoryFacts,
    repositoryFactsHash: repositoryFacts.repositoryFactsHash,
  });
  const [implementation, acceptanceEvidence] = await Promise.all([
    provider.deriveImplementationView(request),
    provider.deriveAcceptanceEvidenceView(request),
  ]);
  const implementationValidation = assertValidDerivedView(
    implementation.view,
    validators.validateImplementationView
  );
  const acceptanceValidation = assertValidDerivedView(
    acceptanceEvidence.view,
    validators.validateAcceptanceEvidenceView
  );
  return Object.freeze({
    mode: 'semantic_completion',
    implementation: Object.freeze({
      ...implementation,
      validation: implementationValidation,
      receipt: Object.freeze({
        ...implementation.receipt,
        persistedViewAuthorityFiles: 0,
      }),
    }),
    acceptanceEvidence: Object.freeze({
      ...acceptanceEvidence,
      validation: acceptanceValidation,
      receipt: Object.freeze({
        ...acceptanceEvidence.receipt,
        persistedViewAuthorityFiles: 0,
      }),
    }),
  });
}

function currentRepositoryTreeHash() {
  try {
    const index = execFileSync('git', ['ls-files', '-s'], {
      cwd: SOURCE_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return sha256Text(index.replace(/\r\n/gu, '\n'));
  } catch (error) {
    throw partitionFailure('partition_repository_facts_stale', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildApplicabilityInput({
  snapshot,
  graph,
  methodology,
  deriveSequenceArchitectureFacts,
}) {
  return {
    sourceSnapshotHash: snapshot.aggregateHash,
    semanticModelHash: graph.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    architectureFacts: deriveSequenceArchitectureFacts(graph),
    policyVersion: methodology.profile.profileVersion,
  };
}

function assertSequencePacketHashes(packet) {
  const staleFields = [];
  if (packet?.schemaVersion !== 'goal-contract-sequence-constraint-input/v1') {
    staleFields.push('schemaVersion');
  }
  for (const [valueField, hashField] of [
    ['sequenceContract', 'sequenceContractHash'],
    ['interfaceContractSet', 'interfaceContractSetHash'],
    ['sequenceClosureBundle', 'sequenceClosureBundleHash'],
  ]) {
    if (
      !packet?.[valueField] ||
      packet[hashField] !== sha256Text(stableStringify(packet[valueField]))
    ) {
      staleFields.push(hashField);
    }
  }
  if (staleFields.length > 0) {
    throw partitionFailure('sequence_constraint_hash_mismatch', {
      staleFields,
    });
  }
}

function resolveSequenceConstraintBranch({
  applicability,
  sequenceMode,
  args,
  deriveSequenceExecutionState,
  validateSequenceConstraintInput,
}) {
  const constraintPath = take(args, '--sequence-constraints', null);
  if (sequenceMode === 'disabled' && constraintPath) {
    throw partitionFailure('sequence_constraints_forbidden_when_disabled');
  }
  let sequenceConstraintInput = null;
  const producerAvailable = Boolean(constraintPath && fs.existsSync(path.resolve(constraintPath)));
  const sequenceExecutionState = deriveSequenceExecutionState({
    sequenceMode,
    sequenceApplicability: applicability.decision,
    producerAvailable,
  });
  if (sequenceMode === 'disabled') {
    return Object.freeze({
      sequenceConstraintInput: null,
      sequenceExecutionState,
    });
  }
  if (producerAvailable) {
    try {
      sequenceConstraintInput = JSON.parse(fs.readFileSync(path.resolve(constraintPath), 'utf8'));
    } catch {
      throw partitionFailure('sequence_constraint_hash_mismatch', {
        staleFields: ['packet'],
      });
    }
    assertSequencePacketHashes(sequenceConstraintInput);
  }
  const validatedInput = validateSequenceConstraintInput({
    applicabilityReceipt: applicability,
    producerAvailable,
    sequenceConstraintInput,
    currentSourceSnapshotHash: applicability.sourceSnapshotHash,
    currentSemanticModelHash: applicability.semanticModelHash,
    currentTraceGraphHash: applicability.traceGraphHash,
    currentPolicyVersion: applicability.policyVersion,
  });
  return Object.freeze({
    sequenceConstraintInput: validatedInput,
    sequenceExecutionState,
  });
}

async function compilePartitionAuthority(args) {
  assertNoForbiddenPartitionAuthorityArgs(args);
  const {
    assertNoForbiddenPartitionAuthorityArgs: assertNoForbiddenSemanticAuthorityArgs,
    createGoalContractSemanticProvider,
  } = loadPartitionModule('utils/goal-contract/semantic-provider-registry');
  assertNoForbiddenSemanticAuthorityArgs(args);
  const { resolveEntryScenario } = loadPartitionModule('utils/goal-contract/entry-scenarios');
  const entry = resolveEntryScenario(takeAll(args, '--entry'));
  if (entry.entryScenario !== 'standalone_goal_contract') {
    throw Object.assign(new Error('entry_route_mismatch'), {
      failureClass: 'entry_route_mismatch',
      entryScenario: entry.entryScenario,
      expectedEntryScenario: 'standalone_goal_contract',
    });
  }
  const sourcePath = requireExistingSource(args);
  const rawBytes = fs.readFileSync(sourcePath);
  const { buildSourceSnapshot } = loadPartitionModule('utils/goal-contract/dual-view-derivation');
  const {
    buildCanonicalSemanticModel,
    selectSemanticDerivationMode,
    validateAcceptanceEvidenceView,
    validateImplementationView,
  } = loadPartitionModule('utils/goal-contract/dual-view-derivation');
  const { loadPartitionMethodologyProfile } = loadPartitionModule(
    'utils/goal-contract/partition-methodology-profile'
  );
  const {
    canonicalSourceObligationGraph,
    extractSourceObligations,
    hashSourceObligationGraph,
  } = loadPartitionModule('utils/goal-contract/source-obligation-extractor');
  const { findNonDeterministicPhrase } = loadPartitionModule(
    'utils/goal-contract/non-deterministic-source-validator'
  );
  const { assertCurrentPartitionPolicyBinding, loadPartitionPolicy } = loadPartitionModule(
    'utils/goal-contract/partition-policy'
  );
  const { buildPartitionComponents } = loadPartitionModule(
    'utils/goal-contract/partition-components'
  );
  const { optimizePartitions } = loadPartitionModule(
    'utils/goal-contract/partition-optimizer'
  );
  const { compilePartitionManifest } = loadPartitionModule(
    'utils/goal-contract/partition-manifest'
  );
  const { loadRepositoryFacts } = loadPartitionModule('utils/goal-contract/repository-facts');
  const { reconcileGoalContractViews } = loadPartitionModule(
    'utils/goal-contract/view-reconciliation'
  );
  const { buildEvidenceGraph } = loadPartitionModule('utils/goal-contract/evidence-graph');
  const { decideSequenceApplicability, validateSequenceConstraintInput } = loadPartitionModule(
    'utils/goal-contract/sequence-applicability'
  );
  const { deriveSequenceArchitectureFacts } = loadPartitionModule(
    'utils/goal-contract/sequence-applicability-adapter'
  );
  const {
    deriveSequenceExecutionState,
    resolveSequenceMode,
  } = loadPartitionModule('utils/goal-contract/sequence-mode');
  const sequenceMode = resolveSequenceMode(
    take(args, '--sequence-mode', 'auto')
  );
  const { compileExecutionProjection } = loadPartitionModule(
    'utils/goal-contract/execution-projection'
  );
  const snapshot = buildSourceSnapshot({
    sourceType: 'source_plan',
    sourcePath: normalize(sourcePath),
    rawBytes,
  });
  const methodology = loadPartitionMethodologyProfile({
    packageRoot: PARTITION_ASSET_ROOT,
  });
  const policyBinding = loadPartitionPolicy({
    packageRoot: PARTITION_ASSET_ROOT,
    policyPath: take(args, '--policy', null),
  });
  const extracted = extractCommandSourceObligations({
    snapshot,
    extractSourceObligations,
    canonicalSourceObligationGraph,
    hashSourceObligationGraph,
    findNonDeterministicPhrase,
  });
  const repositoryFactsPath = take(args, '--repository-facts', null);
  const repositoryFacts = loadRepositoryFacts({
    factsPath: repositoryFactsPath,
    expectedRepositoryTreeHash: repositoryFactsPath
      ? currentRepositoryTreeHash()
      : sha256Text('repository-facts:not-provided'),
    allowlistedAnalyzers: ['repository-analyzer@1.0.0'],
  });
  const structuredBindings = selectCommandStructuredBindings(
    extracted.sourceObligations
  );
  const hasCompleteStructuredBindings = Object.values(structuredBindings).every(
    (bindings) => bindings.length > 0
  );
  const derivationMode = hasCompleteStructuredBindings
    ? Object.freeze({
        mode: 'structured_fast_path',
        sourceSnapshotHash: snapshot.aggregateHash,
        semanticProviderCallCount: 0,
        missingStructuredBindings: [],
      })
    : selectSemanticDerivationMode({
        sourceSnapshot: snapshot,
        sourceObligations: extracted.sourceObligations,
        semanticDerivationAllowed: policyBinding.policy.semanticDerivationAllowance,
      });
  const validators = {
    validateAcceptanceEvidenceView,
    validateImplementationView,
  };
  const derivation =
    derivationMode.mode === 'structured_fast_path'
      ? deriveStructuredViews({
          snapshot,
          extracted,
          repositoryFacts,
          structuredBindings,
          validators,
        })
      : await deriveSemanticViews({
          snapshot,
          extracted,
          methodology,
          repositoryFacts,
          providerFactory: createGoalContractSemanticProvider,
          validators,
        });
  const semantic = buildCanonicalSemanticModel({
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    derivation,
  });
  const reconciliation = reconcileGoalContractViews({
    sourceSnapshot: snapshot,
    sourceObligationGraph: extracted.sourceObligationGraph,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    semanticModelHash: semantic.semanticModelHash,
    derivation,
  });
  const graph = buildEvidenceGraph(reconciliation);
  const applicability = decideSequenceApplicability(
    buildApplicabilityInput({
      snapshot,
      graph,
      methodology,
      deriveSequenceArchitectureFacts,
    })
  );
  const boundaryContext = {
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    partitionPolicyHash: policyBinding.partitionPolicyHash,
    partitionPolicyArtifactHash: policyBinding.partitionPolicyArtifactHash,
    policyPath: policyBinding.policyPath,
    policyBytes: policyBinding.policyBytes,
    semanticDerivationAllowance: policyBinding.policy.semanticDerivationAllowance,
    semanticModelHash: semantic.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    semanticDerivationMode: derivationMode.mode,
    semanticProviderCallCount: derivationMode.semanticProviderCallCount,
    sequenceApplicability: applicability.decision,
    sequenceApplicabilityReceipt: applicability,
  };
  let sequenceBranch;
  try {
    sequenceBranch = resolveSequenceConstraintBranch({
      applicability,
      sequenceMode,
      args,
      deriveSequenceExecutionState,
      validateSequenceConstraintInput,
    });
    Object.assign(boundaryContext, sequenceBranch.sequenceExecutionState);
  } catch (error) {
    let persistedBoundary = {};
    if (error.failureClass === 'sequence_closure_required_unavailable') {
      const requestedOut = take(args, '--out', null);
      const receiptsDir = take(
        args,
        '--receipts-dir',
        requestedOut
          ? path.join(
              path.dirname(path.resolve(requestedOut)),
              '.goal-contract-receipts'
            )
          : path.join(path.dirname(sourcePath), '.goal-contract-receipts')
      );
      const {
        writeSequenceApplicabilityBoundaryReceipt,
      } = loadPartitionModule('utils/goal-contract/partition-receipts');
      const persisted = writeSequenceApplicabilityBoundaryReceipt({
        applicabilityReceipt: applicability,
        methodologyProfileHash: methodology.methodologyProfileHash,
        receiptsDir,
      });
      persistedBoundary = {
        sequenceApplicabilityReceipt: persisted.payload,
        sequenceApplicabilityReceiptPath: persisted.path,
        sequenceApplicabilityReceiptHash: persisted.receiptHash,
      };
    }
    Object.assign(error, boundaryContext, persistedBoundary);
    throw error;
  }
  let projection;
  const projectionAuthority = {
    sourceSnapshotHash: snapshot.aggregateHash,
    sourceObligationGraphHash: extracted.sourceObligationGraphHash,
    methodologyProfileHash: methodology.methodologyProfileHash,
    semanticModelHash: semantic.semanticModelHash,
    traceGraphHash: graph.traceGraphHash,
    reconciledGraph: reconciliation.graphInput,
    reconciledGraphHash: reconciliation.graphInputHash,
    sequenceApplicabilityReceipt: applicability,
    sequenceConstraintInput: sequenceBranch.sequenceConstraintInput,
    sequenceExecutionState: sequenceBranch.sequenceExecutionState,
  };
  try {
    projection = compileExecutionProjection(projectionAuthority);
  } catch (error) {
    Object.assign(error, boundaryContext);
    throw error;
  }
  let optimizerPolicyBinding;
  try {
    optimizerPolicyBinding = assertCurrentPartitionPolicyBinding({
      policyBinding,
      sourceSnapshotHash: snapshot.aggregateHash,
      semanticModelHash: semantic.semanticModelHash,
      executionProjectionHash: projection.executionProjectionHash,
    });
  } catch (error) {
    Object.assign(error, boundaryContext, {
      executionProjectionHash: projection.executionProjectionHash,
      taskDagHash: projection.taskDagHash,
      integrationJoinGraphHash: projection.integrationJoinGraphHash,
    });
    throw error;
  }
  let componentGraph;
  let optimization;
  let compiled;
  try {
    componentGraph = buildPartitionComponents({
      executionProjection: projection,
      policy: optimizerPolicyBinding.policy,
    });
    optimization = optimizePartitions({
      componentGraph,
      executionProjection: projection,
      policyBinding: optimizerPolicyBinding,
      projectionAuthority,
    });
    compiled = compilePartitionManifest({
      sourceSnapshot: snapshot,
      sourceObligationGraph: extracted.sourceObligationGraph,
      sourceObligationGraphHash: extracted.sourceObligationGraphHash,
      methodologyProfileHash: methodology.methodologyProfileHash,
      reconciledGraph: reconciliation.graphInput,
      reconciledGraphHash: reconciliation.graphInputHash,
      reconciliationReceiptHash: sha256Text(
        stableStringify({
          graphInputHash: reconciliation.graphInputHash,
          issues: reconciliation.issues,
          metrics: reconciliation.metrics,
          outputInventory: reconciliation.outputInventory,
        })
      ),
      executionProjection: projection,
      projectionAuthority,
      policyBinding: optimizerPolicyBinding,
      semanticDerivationMode: derivationMode.mode,
      implementationViewReceipt: derivation.implementation.receipt,
      acceptanceEvidenceViewReceipt: derivation.acceptanceEvidence.receipt,
      componentGraph,
      optimization,
    });
  } catch (error) {
    Object.assign(error, boundaryContext, {
      executionProjectionHash: projection.executionProjectionHash,
      taskDagHash: projection.taskDagHash,
      integrationJoinGraphHash: projection.integrationJoinGraphHash,
    });
    throw error;
  }
  return Object.freeze({
    boundaryContext,
    snapshot,
    methodology,
    extracted,
    reconciliation,
    projection,
    optimizerPolicyBinding,
    componentGraph,
    optimization,
    compiled,
  });
}

async function partition(args) {
  const authority = await compilePartitionAuthority(args);
  const {
    projection,
    compiled,
  } = authority;
  const { stagePartitionSolution } = loadPartitionModule(
    'utils/goal-contract/partition-manifest'
  );
  const {
    buildGlobalPartitionCoverageReceipt,
    selectPartitionScope,
  } = loadPartitionModule('utils/goal-contract/partition-selector');
  const { finalizePartitionRun } = loadPartitionModule(
    'utils/goal-contract/partition-receipts'
  );
  const requestedOut = take(args, '--out');
  if (!requestedOut) {
    throw partitionFailure('partition_output_missing');
  }
  const receiptsDir = take(
    args,
    '--receipts-dir',
    path.join(path.dirname(path.resolve(requestedOut)), '.goal-contract-receipts')
  );
  const staged = stagePartitionSolution({
    compiled,
    receiptsDir,
    activeManifestPath: requestedOut,
  });
  const globalCoverage = buildGlobalPartitionCoverageReceipt({
    executionProjection: projection,
    candidateManifest: staged.manifest,
  });
  if (globalCoverage.decision !== 'pass') {
    throw partitionFailure('partition_global_coverage_blocked', {
      blockingReasons: globalCoverage.blockingReasons,
    });
  }
  const selections = staged.manifest.partitions.map(
    (candidatePartition) =>
      selectPartitionScope({
        executionProjection: projection,
        partitionManifest: staged.manifest,
        partitionId: candidatePartition.partitionId,
      }).selectionReceipt
  );
  const finalized = finalizePartitionRun({
    staged,
    receiptsDir,
    globalCoverage,
    selections,
    activeManifestPath: requestedOut,
  });
  if (finalized.activeManifestHash !== staged.partitionManifestHash) {
    throw partitionFailure('partition_manifest_changed_during_finalization');
  }
  return Object.freeze({
    ok: true,
    schemaVersion: 'goal-contract-partition-command-receipt/v1',
    runId: finalized.runId,
    partitionManifestPath: finalized.activeManifestPath,
    partitionManifestHash: finalized.activeManifestHash,
    executionProjectionHash: projection.executionProjectionHash,
    partitionCount: finalized.manifest.partitionCount,
    partitionSetHash: finalized.manifest.partitionSetHash,
    globalCoverageDecision: globalCoverage.decision,
    selectionReceiptCount: selections.length,
    sequenceMode: authority.boundaryContext.sequenceMode,
    sequenceApplicability: authority.boundaryContext.sequenceApplicability,
    sequenceCoverage: authority.boundaryContext.sequenceCoverage,
    sequenceClosureStatus:
      authority.boundaryContext.sequenceClosureStatus,
    childContractAuthority:
      authority.boundaryContext.childContractAuthority,
    sequenceApplicabilityReceipt:
      authority.boundaryContext.sequenceApplicabilityReceipt,
    semanticDerivationMode: authority.boundaryContext.semanticDerivationMode,
    semanticProviderCallCount:
      authority.boundaryContext.semanticProviderCallCount,
  });
}

async function goalContractCommand(_opts: { json?: boolean } = {}, forwardedArgs: string[] = []) {
  const args = [...forwardedArgs];
  const subcommand = args.shift();
  const json = has(args, '--json') || _opts.json;
  try {
    if (subcommand === 'release-gate') {
      const {
        goalContractReleaseGateCommand,
        parseGoalContractBinding,
      } = loadPartitionModule('utils/goal-contract/release-gate');
      const goalPath = take(args, '--goal');
      const binding = parseGoalContractBinding(goalPath);
      let partitionAuthority = null;
      if (binding.mode === 'partition') {
        const authorityArgs = [
          '--entry',
          binding.fields.entryScenario || 'standalone_goal_contract',
          '--source',
          take(args, '--source') || binding.fields.masterSourcePath,
        ];
        for (const flag of [
          '--sequence-mode',
          '--sequence-constraints',
          '--repository-facts',
          '--policy',
        ]) {
          const value = take(args, flag);
          if (value) authorityArgs.push(flag, value);
        }
        partitionAuthority = await compilePartitionAuthority(
          authorityArgs
        );
      }
      return await goalContractReleaseGateCommand(_opts, args, {
        partitionAuthority,
      });
    }
    if (!['generate', 'partition'].includes(subcommand)) {
      throw Object.assign(
        new Error(
          'Usage: bmad-speckit goal-contract <generate|partition> --entry standalone_goal_contract --source <plan.md> --out <artifact> [--sequence-mode auto|required|disabled] --json'
        ),
        {
          failureClass: 'invalid_subcommand',
        }
      );
    }
    const result = subcommand === 'partition' ? await partition(args) : await generate(args);
    if (json) emitJson(result);
    else if (result?.goalContractPath) {
      process.stdout.write(`${result.goalContractPath}\n`);
    }
    return 0;
  } catch (error) {
    const failureClass = error.failureClass || error.code || 'goal_contract_generation_failed';
    const payload = failurePayload(failureClass, error, {
      ...(error.entryScenario ? { entryScenario: error.entryScenario } : {}),
      ...(error.expectedEntryScenario
        ? { expectedEntryScenario: error.expectedEntryScenario }
        : {}),
      ...(error.requestedOutputs ? { requestedOutputs: error.requestedOutputs } : {}),
      ...(error.requiredOutputs ? { requiredOutputs: error.requiredOutputs } : {}),
      ...(error.coverageAudit ? { coverageAudit: error.coverageAudit } : {}),
      ...(error.implementationProofAudit
        ? { implementationProofAudit: error.implementationProofAudit }
        : {}),
      ...(error.commandPortabilityAudit
        ? { commandPortabilityAudit: error.commandPortabilityAudit }
        : {}),
      ...(error.deterministicPreflight
        ? { deterministicPreflight: error.deterministicPreflight }
        : {}),
      ...(error.auditMetrics ? { auditMetrics: error.auditMetrics } : {}),
      ...(error.forbidden ? { forbidden: error.forbidden } : {}),
      ...(error.missingArguments ? { missingArguments: error.missingArguments } : {}),
      ...(error.sourceSnapshotHash ? { sourceSnapshotHash: error.sourceSnapshotHash } : {}),
      ...(error.sourceObligationGraphHash
        ? {
            sourceObligationGraphHash: error.sourceObligationGraphHash,
          }
        : {}),
      ...(error.methodologyProfileHash
        ? { methodologyProfileHash: error.methodologyProfileHash }
        : {}),
      ...(error.partitionPolicyHash ? { partitionPolicyHash: error.partitionPolicyHash } : {}),
      ...(error.partitionPolicyArtifactHash
        ? {
            partitionPolicyArtifactHash: error.partitionPolicyArtifactHash,
          }
        : {}),
      ...(error.policyPath ? { policyPath: error.policyPath } : {}),
      ...(Number.isInteger(error.policyBytes) ? { policyBytes: error.policyBytes } : {}),
      ...(typeof error.semanticDerivationAllowance === 'boolean'
        ? {
            semanticDerivationAllowance: error.semanticDerivationAllowance,
          }
        : {}),
      ...(error.semanticModelHash ? { semanticModelHash: error.semanticModelHash } : {}),
      ...(error.traceGraphHash ? { traceGraphHash: error.traceGraphHash } : {}),
      ...(error.semanticDerivationMode
        ? {
            semanticDerivationMode: error.semanticDerivationMode,
          }
        : {}),
      ...(Number.isInteger(error.semanticProviderCallCount)
        ? {
            semanticProviderCallCount: error.semanticProviderCallCount,
          }
        : {}),
      ...(error.sequenceMode
        ? {
            sequenceMode: error.sequenceMode,
          }
        : {}),
      ...(error.sequenceApplicability
        ? {
            sequenceApplicability: error.sequenceApplicability,
          }
        : {}),
      ...(error.sequenceCoverage
        ? {
            sequenceCoverage: error.sequenceCoverage,
          }
        : {}),
      ...(error.sequenceClosureStatus
        ? {
            sequenceClosureStatus: error.sequenceClosureStatus,
          }
        : {}),
      ...(error.childContractAuthority
        ? {
            childContractAuthority: error.childContractAuthority,
          }
        : {}),
      ...(error.sequenceApplicabilityReceipt
        ? {
            sequenceApplicabilityReceipt: error.sequenceApplicabilityReceipt,
          }
        : {}),
      ...(error.sequenceApplicabilityReceiptPath
        ? {
            sequenceApplicabilityReceiptPath:
              error.sequenceApplicabilityReceiptPath,
          }
        : {}),
      ...(error.sequenceApplicabilityReceiptHash
        ? {
            sequenceApplicabilityReceiptHash:
              error.sequenceApplicabilityReceiptHash,
          }
        : {}),
      ...(error.executionProjectionHash
        ? {
            executionProjectionHash: error.executionProjectionHash,
          }
        : {}),
      ...(error.taskDagHash ? { taskDagHash: error.taskDagHash } : {}),
      ...(error.integrationJoinGraphHash
        ? {
            integrationJoinGraphHash: error.integrationJoinGraphHash,
          }
        : {}),
      ...(error.partitionRunId ? { partitionRunId: error.partitionRunId } : {}),
      ...(error.partitionAnalysisReceiptPath
        ? {
            partitionAnalysisReceiptPath: error.partitionAnalysisReceiptPath,
          }
        : {}),
      ...(error.partitionAnalysisReceiptHash
        ? {
            partitionAnalysisReceiptHash: error.partitionAnalysisReceiptHash,
          }
        : {}),
      ...(error.stagedManifestPath
        ? { stagedManifestPath: error.stagedManifestPath }
        : {}),
      ...(error.partitionManifestHash
        ? { partitionManifestHash: error.partitionManifestHash }
        : {}),
      ...(Number.isInteger(error.partitionCount)
        ? { partitionCount: error.partitionCount }
        : {}),
      ...(error.selectedCandidateId
        ? { selectedCandidateId: error.selectedCandidateId }
        : {}),
      ...(typeof error.activeManifestWritten === 'boolean'
        ? { activeManifestWritten: error.activeManifestWritten }
        : {}),
      ...(error.staleFields ? { staleFields: error.staleFields } : {}),
      ...(error.mismatchedFields
        ? { mismatchedFields: error.mismatchedFields }
        : {}),
      ...(error.invalidFields ? { invalidFields: error.invalidFields } : {}),
      ...(error.expected ? { expected: error.expected } : {}),
      ...(error.actual ? { actual: error.actual } : {}),
    });
    if (json) emitJson(payload);
    else console.error(payload.message);
    return 1;
  }
}

module.exports = {
  generate,
  goalContractCommand,
  partition,
};
