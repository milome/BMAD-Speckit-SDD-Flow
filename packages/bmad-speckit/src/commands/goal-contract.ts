const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

export type GoalContractCommandModule = never;

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function resolvePartitionCompilerIdentityAssetPath(relativePath) {
  const sourceRuntime = __filename.endsWith('.ts');
  const runtimeRoot = path.join(PACKAGE_ROOT, sourceRuntime ? 'src' : 'dist', relativePath);
  const extension = sourceRuntime ? '.ts' : '.js';
  const candidates = [`${runtimeRoot}${extension}`, path.join(runtimeRoot, `index${extension}`)];
  if (sourceRuntime) {
    const distRoot = path.join(PACKAGE_ROOT, 'dist', relativePath);
    candidates.push(`${distRoot}.js`, path.join(distRoot, 'index.js'));
  }
  return firstExistingPath(candidates);
}

/* goal-contract-source-runtime:start */
const SOURCE_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PARTITION_ASSET_ROOT = SOURCE_ROOT;

function loadDistModule(relativePath) {
  return require(path.join(PACKAGE_ROOT, 'dist', relativePath));
}

function resolvePartitionModulePath(relativePath) {
  const sourceBase = path.join(PACKAGE_ROOT, 'src', relativePath);
  const distBase = path.join(PACKAGE_ROOT, 'dist', relativePath);
  return firstExistingPath([
    `${sourceBase}.ts`,
    path.join(sourceBase, 'index.ts'),
    `${distBase}.js`,
    path.join(distBase, 'index.js'),
  ]);
}

function loadPartitionModule(relativePath) {
  return require(resolvePartitionModulePath(relativePath));
}
/* goal-contract-source-runtime:end */

function loadWholeSourceDependencies() {
  const { safeWriteText, sha256File } = loadDistModule('utils/large-document-writer');
  const { extractSourceObligations } = loadDistModule(
    'utils/goal-contract/source-obligation-extractor'
  );
  const { buildSourceSnapshot } = loadPartitionModule('utils/goal-contract/dual-view-derivation');
  const { resolveEntryScenario, validateEntryAuthority } = loadDistModule(
    'utils/goal-contract/entry-scenarios'
  );
  const { compileCanonicalIntent } = loadPartitionModule(
    'utils/goal-contract/control-plane/canonical-intent-compiler'
  );
  const { compileCompositeSourceAuthorityBundle } = loadPartitionModule(
    'utils/goal-contract/control-plane/composite-source-authority-bundle'
  );
  const {
    compileGoalContract,
    compileGoalContractPolicy,
    createGoalContractCompilationReceipt,
    goalContractCompilerIdentity,
  } = loadPartitionModule('utils/goal-contract/control-plane/goal-contract-compiler');
  const { hashControlPlaneValue } = loadPartitionModule(
    'utils/goal-contract/control-plane/canonical-hash'
  );
  const { compileIntentAuthorityEnvelope } = loadPartitionModule(
    'utils/goal-contract/control-plane/intent-authority'
  );
  const { compileSourceCompositionPolicy } = loadPartitionModule(
    'utils/goal-contract/control-plane/source-composition-policy'
  );
  const { compileOrderedSourceSnapshotSet } = loadPartitionModule(
    'utils/goal-contract/control-plane/source-snapshot'
  );
  const { defaultReceiptPaths, writeCoverageReceipt, writeGenerationReceipt } = loadPartitionModule(
    'utils/goal-contract/goal-contract-receipts'
  );
  const { resolveAuditProfile, runStandaloneDeterministicPreflight } = loadDistModule(
    'utils/goal-contract/standalone-audit-controller'
  );
  return {
    buildSourceSnapshot,
    compileCanonicalIntent,
    compileCompositeSourceAuthorityBundle,
    compileGoalContract,
    compileGoalContractPolicy,
    compileIntentAuthorityEnvelope,
    compileOrderedSourceSnapshotSet,
    compileSourceCompositionPolicy,
    createGoalContractCompilationReceipt,
    defaultReceiptPaths,
    extractSourceObligations,
    goalContractCompilerIdentity,
    hashControlPlaneValue,
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

function sha256FileBytes(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function compileStandaloneGoalContract({
  source,
  sourceText,
  resolvedOut,
  coverageReceiptPath,
  generationReceiptPath,
  profileBytes,
  templateBytes,
  dependencies,
}) {
  const {
    compileCanonicalIntent,
    compileCompositeSourceAuthorityBundle,
    compileGoalContract,
    compileGoalContractPolicy,
    compileIntentAuthorityEnvelope,
    compileOrderedSourceSnapshotSet,
    compileSourceCompositionPolicy,
    goalContractCompilerIdentity,
    hashControlPlaneValue,
  } = dependencies;
  const requiredSubordinateBindings = [];
  const authoritySourceId = `standalone-source-authority:${source.sourcePlanHash}`;
  const authorityRecord = {
    authorityKind: 'deterministic_source_authority_adapter',
    authoritySourceId,
    declaredMode: 'single_source',
    requiredSubordinateBindings,
    declaredRequiredBindingsHash: hashControlPlaneValue(requiredSubordinateBindings),
    authorityEvidenceHash: hashControlPlaneValue({
      authoritySourceId,
      mode: 'single_source',
      requiredSubordinateBindings,
    }),
  };
  const sourceCompositionPolicy = compileSourceCompositionPolicy({
    authorityRecord,
  });
  const sourceArtifactId = `standalone-source-${source.sourcePlanHash.slice(7)}`;
  const sourceNamespace = `STANDALONE_${source.sourcePlanHash.slice(7).toUpperCase()}`;
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: sourceNamespace,
        sourceOrder: 0,
        pathOrSegmentId: source.sourcePlanPath,
        rawBytes: Buffer.from(sourceText, 'utf8'),
      },
    ],
  });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: sourceNamespace,
      sourceArtifactId,
      ownedSemanticDomains: [],
      parentTaskRefs: [],
    },
    subordinateSources: [],
  });
  const candidateIntent = compileCanonicalIntent({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    authorityState: 'candidate_only',
  });
  const intentAuthorityEnvelope = compileIntentAuthorityEnvelope({
    subject: {
      sourceSnapshotHash: orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
      canonicalIntentSemanticHash: candidateIntent.canonicalIntentSemanticHash,
      specSpanRegistryHash: candidateIntent.specSpanRegistry.specSpanRegistryHash,
    },
    compositeSourceAuthorityBundle,
    authorityBasis: {
      kind: 'direct_source_declaration',
      sourceDeclarationHash: orderedSourceSnapshotSet.sourceSnapshots[0].sourceSnapshotHash,
      declaringUserAuthorityIdentity: 'user:standalone-goal-contract-command',
      entryScenario: 'standalone_goal_contract',
    },
  });
  const canonicalIntentBundle = compileCanonicalIntent({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    intentAuthorityEnvelope,
    authorityState: 'authoritative',
  });
  const compilePolicy = compileGoalContractPolicy({
    entryScenario: 'standalone_goal_contract',
    generationMode: 'source_plan_strict',
    sourcePlanPath: source.sourcePlanPath,
    outPath: normalize(resolvedOut),
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
    profileBytesHash: sha256Text(profileBytes),
    templateBytesHash: sha256Text(templateBytes),
  });
  const bundle = compileGoalContract({
    sourceCompositionPolicy,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    subordinateCoverageReceipts: [],
    compilePolicy,
    compilerIdentity: goalContractCompilerIdentity(),
    contractProfileBytes: profileBytes,
    templateBytes,
  });
  return {
    bundle,
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    subordinateCoverageReceipts: bundle.subordinateSourceCoverageReceipts,
  };
}

function resolveGoalContractAssetPath(...segments) {
  return firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', ...segments),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', ...segments),
  ]);
}

function resolveRendererPath() {
  return resolveGoalContractAssetPath('scripts', 'render-goal-contract.js');
}

function loadRenderer() {
  return require(resolveRendererPath());
}

function resolveCommandPortabilityCheckerPath() {
  return resolveGoalContractAssetPath('scripts', 'check-contract-command-portability.js');
}

function loadCommandPortabilityChecker() {
  return require(resolveCommandPortabilityCheckerPath());
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
    'errorCode',
    'taskId',
    'fieldName',
    'offendingToken',
    'reasonCode',
    'sourceArtifactId',
    'sourceSnapshotHash',
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
  const dependencies = loadWholeSourceDependencies();
  const {
    buildSourceSnapshot,
    createGoalContractCompilationReceipt,
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
  } = dependencies;
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
  const sourceSnapshot = buildSourceSnapshot({
    sourceType: 'source_plan',
    sourcePath: normalize(sourcePath),
    rawBytes: Buffer.from(sourceText, 'utf8'),
  });
  const source = extractSourceObligations({ snapshot: sourceSnapshot });
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
  const profileBytes = fs.readFileSync(profilePath);
  const templateBytes = fs.readFileSync(templatePath);
  const { bundle: compilation, sourceCompositionPolicy } = compileStandaloneGoalContract({
    source,
    sourceText,
    resolvedOut,
    coverageReceiptPath,
    generationReceiptPath,
    profileBytes,
    templateBytes,
    dependencies,
  });
  const registries = compilation.registries;
  const implementationProofAudit = compilation.implementationProofAudit;
  const rendered = {
    document: compilation.markdown,
    audit: compilation.rendererAudit,
  };
  const primaryCoverage = compilation.primarySourceCoverage;
  const coverageAudit = {
    decision:
      primaryCoverage.missingIds.length === 0 &&
      primaryCoverage.duplicateIds.length === 0 &&
      primaryCoverage.unmappedIds.length === 0 &&
      primaryCoverage.scopeEscapeIds.length === 0
        ? 'pass'
        : 'block',
    unmappedSourceObligations: [
      ...new Set([
        ...primaryCoverage.missingIds,
        ...primaryCoverage.duplicateIds,
        ...primaryCoverage.unmappedIds,
        ...primaryCoverage.scopeEscapeIds,
      ]),
    ].sort(),
  };
  if (coverageAudit.decision !== 'pass') {
    throw Object.assign(new Error('source_coverage_incomplete'), {
      failureClass: 'source_coverage_incomplete',
      coverageAudit,
    });
  }
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
  const goalContractDocumentHash = sha256File(resolvedOut);
  if (goalContractDocumentHash !== compilation.markdownHash) {
    throw Object.assign(new Error('goal_contract_document_hash_mismatch'), {
      failureClass: 'goal_contract_document_hash_mismatch',
      expectedHash: compilation.markdownHash,
      actualHash: goalContractDocumentHash,
    });
  }
  const compilationReceipt = createGoalContractCompilationReceipt(compilation, {
    compiledAt: new Date().toISOString(),
  });
  const goalContractHash = compilation.goalContractHash;
  const coverageReceipt = {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    entryScenario: entry.entryScenario,
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    sourceBytes: source.sourceBytes,
    sourceLines: source.sourceLines,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    goalContractDocumentHash,
    sourceObligations: registries.sourceObligations,
    unmappedSourceObligations: coverageAudit.unmappedSourceObligations,
    orphanGeneratedRefs: [],
    blockingReasons: [],
    decision: coverageAudit.decision,
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
    goalContractSemanticHash: compilation.goalContractSemanticHash,
    goalContractDocumentHash,
    runtimeRecordId: compilation.runtimeRecordId,
    sourceCompositionMode: sourceCompositionPolicy.mode,
    sourceCompositionPolicyHash: compilation.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: compilation.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: compilation.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash: compilation.canonicalIntentSemanticHash,
    canonicalIntentBundleHash: compilation.canonicalIntentBundleHash,
    authorityAttestationHash: compilation.authorityAttestationHash,
    compilePolicyHash: compilation.compilePolicyHash,
    compilerIdentityHash: compilation.compilerIdentityHash,
    subordinateSourceCoverageReceiptHashes: compilationReceipt.subordinateCoverageReceiptHashes,
    compilationReceipt,
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
    sourceObligationCount: registries.sourceObligations.length,
    unmappedSourceObligations: coverageAudit.unmappedSourceObligations.length,
    rendererAudit: rendered.audit,
    coverageAudit,
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
  const sourceIds = new Set(selectedScope.selectionReceipt.selectedPrimarySourceObligationIds);
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
  const { readValidatedPartitionReceipt } = loadPartitionModule(
    'utils/goal-contract/partition-receipts'
  );
  const { buildGlobalPartitionCoverageReceipt, selectPartitionScope } = loadPartitionModule(
    'utils/goal-contract/partition-selector'
  );
  const { buildPartitionSlotData } = loadPartitionModule('utils/goal-contract/slot-data-builder');
  const { resolveEntryScenario, validateEntryAuthority } = loadPartitionModule(
    'utils/goal-contract/entry-scenarios'
  );
  const { resolveAuditProfile, runStandaloneDeterministicPreflight } = loadPartitionModule(
    'utils/goal-contract/standalone-audit-controller'
  );
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
    take(args, '--receipts-dir', path.join(path.dirname(manifestPath), '.goal-contract-receipts'))
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
  if (stableStringify(selectionReceipt) !== stableStringify(selectedScope.selectionReceipt)) {
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
    methodologyProfileArtifactHash: authority.methodology.methodologyProfileArtifactHash,
    executionProjectionHash: manifest.executionProjectionHash,
    taskDagHash: manifest.taskDagHash,
    sequenceMode: manifest.sequenceMode,
    sequenceApplicability: manifest.sequenceApplicability,
    sequenceCoverage: manifest.sequenceCoverage,
    sequenceClosureStatus: manifest.sequenceClosureStatus,
    childContractAuthority: manifest.childContractAuthority,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionPolicyArtifactHash: authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
  };
  const source = {
    sourcePlanPath: manifest.masterSourcePath,
    sourcePlanHash: manifest.masterSourceHash,
    sourceBytes: authority.snapshot.sourceBytes,
    sourceLines: authority.snapshot.sourceLines,
  };
  const { slotData, registries, coverageAudit, implementationProofAudit } = buildPartitionSlotData({
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
      !new RegExp(`^${field}: ${manifest[field]}$`, 'mu').test(rendered.document)
    ) {
      throw partitionFailure('partition_child_generation_sequence_state_mismatch', { field });
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
            coverageAudit.decision === 'pass' && implementationProofAudit.decision === 'pass'
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
    selectedPrimaryObligationIds: selectionReceipt.selectedPrimarySourceObligationIds,
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
    methodologyProfileArtifactHash: authority.methodology.methodologyProfileArtifactHash,
    executionProjectionHash: manifest.executionProjectionHash,
    taskDagHash: manifest.taskDagHash,
    sequenceMode: manifest.sequenceMode,
    sequenceApplicability: manifest.sequenceApplicability,
    sequenceCoverage: manifest.sequenceCoverage,
    sequenceClosureStatus: manifest.sequenceClosureStatus,
    childContractAuthority: manifest.childContractAuthority,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionPolicyArtifactHash: authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
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
      throw partitionFailure('partition_child_generation_sequence_state_mismatch', { field });
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

function executableFence(obligation) {
  const text = String(obligation.exactText || obligation.text || '').trim();
  const normalizedText = text.replace(/^\\`\\`\\`/u, '```').replace(/\\`\\`\\`$/u, '```');
  const match = /^```([A-Za-z0-9_-]+)\r?\n([\s\S]*?)\r?\n```$/u.exec(normalizedText);
  if (!match) return null;
  const shell = match[1].toLowerCase();
  if (
    !new Set([
      'bash',
      'batch',
      'bat',
      'cmd',
      'fish',
      'powershell',
      'pwsh',
      'sh',
      'shell',
      'zsh',
    ]).has(shell)
  ) {
    return null;
  }
  const literal = match[2].trim();
  return literal ? { literal, shell } : null;
}

function commandDescriptor(obligation) {
  if (obligation?.kind === 'verification_command') {
    const literal = commandLiteral(obligation);
    return literal ? { literal, shell: 'host_shell' } : null;
  }
  if (obligation?.kind === 'command_block') {
    return executableFence(obligation);
  }
  return null;
}

function commandRuntime(literal) {
  const firstCommandLine = String(literal)
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  return firstCommandLine?.split(/\s+/u)[0]?.replace(/^["']|["']$/gu, '') || 'unknown';
}

function compileTypedCommandRecord(obligation) {
  const descriptor = commandDescriptor(obligation);
  if (!descriptor) {
    throw partitionFailure('command_definition_invalid', {
      commandId: obligation?.id || null,
    });
  }
  return {
    id: obligation.id,
    literal: descriptor.literal,
    commandTextHash: sha256Text(descriptor.literal),
    workingDirectory: '.',
    shell: descriptor.shell,
    runtime: commandRuntime(descriptor.literal),
    sourceBinding: {
      sourcePlanPath: obligation.sourcePlanPath,
      lineStart: obligation.lineStart,
      lineEnd: obligation.lineEnd,
      textHash: obligation.textHash,
      specSpanRefs: [...(obligation.specSpanRefs || [])].sort(),
    },
  };
}

function sourceAuthorizedPaths({ snapshot, extracted, repositoryFacts }) {
  const factPaths = (repositoryFacts.facts || []).map((fact) => fact.filePath).filter(Boolean);
  const declaredPaths = declaredPathsFromObligations(extracted.sourceObligations);
  return uniqueStrings([...factPaths, ...declaredPaths, snapshot.sourcePath]);
}

function declaredPathsFromObligations(obligations) {
  return obligations.flatMap((obligation) =>
    [...String(obligation.exactText || '').matchAll(/`([^`]+[\\/][^`]+)`/gu)]
      .map((match) => match[1])
      .filter((candidate) => !/\s/u.test(candidate))
  );
}

function headingPathStartsWith(candidate, prefix) {
  return (
    prefix.length > 0 &&
    prefix.length <= candidate.length &&
    prefix.every((heading, index) => heading === candidate[index])
  );
}

function structuredTaskOwner(obligation, declaredTasks) {
  return (
    declaredTasks
      .filter((task) => {
        const taskHeading = String(task.headingPath?.at(-1) || '');
        return (
          taskHeading.includes(task.id) &&
          headingPathStartsWith(obligation.headingPath || [], task.headingPath || [])
        );
      })
      .sort(
        (left, right) => (right.headingPath?.length || 0) - (left.headingPath?.length || 0)
      )[0] || null
  );
}

function explicitDependencyBody(obligation) {
  const text = String(obligation.exactText || obligation.text || '')
    .trim()
    .replace(/^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?/u, '')
    .trim();
  const match = /^\*{0,2}(?:依赖|dependencies?)\s*[:：]\*{0,2}\s*(.*)$/iu.exec(text);
  return match?.[1]?.trim() || null;
}

function structuredTaskDependencies({ task, scopedObligations, knownTaskIds }) {
  const declared = scopedObligations.flatMap((obligation) => {
    const body = explicitDependencyBody(obligation);
    if (!body) return [];
    return [...body.matchAll(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+[A-Z]?\b/gu)].map((match) => ({
      sourceId: obligation.id,
      dependencyId: match[0],
    }));
  });
  const unknownDependencies = declared.filter(
    ({ dependencyId }) => !knownTaskIds.has(dependencyId)
  );
  if (unknownDependencies.length > 0) {
    throw partitionFailure('source_obligation_dependency_unknown', {
      unknownDependencies,
    });
  }
  return uniqueStrings([
    ...(task.dependencyRefs || []),
    ...declared.map(({ dependencyId }) => dependencyId),
  ]).filter((dependencyId) => dependencyId !== task.id);
}

function structuredTaskSliceId(taskId) {
  return /^(.+)-T\d+[A-Z]?$/u.exec(String(taskId))?.[1] || null;
}

function structuredSliceTerminals({ declaredTasks, directDependenciesByTaskId }) {
  const tasksBySlice = new Map<string, string[]>();
  for (const task of declaredTasks) {
    const sliceId = structuredTaskSliceId(task.id);
    if (!sliceId) continue;
    const taskIds = tasksBySlice.get(sliceId) || [];
    taskIds.push(task.id);
    tasksBySlice.set(sliceId, taskIds);
  }
  return new Map<string, string[]>(
    [...tasksBySlice.entries()].map(([sliceId, taskIds]) => {
      const taskIdSet = new Set(taskIds);
      const consumedTaskIds = new Set(
        taskIds.flatMap((taskId) =>
          (directDependenciesByTaskId.get(taskId) || []).filter((dependencyId) =>
            taskIdSet.has(dependencyId)
          )
        )
      );
      const terminalTaskIds = taskIds.filter((taskId) => !consumedTaskIds.has(taskId));
      return [sliceId, terminalTaskIds.length > 0 ? terminalTaskIds : taskIds];
    })
  );
}

function structuredSliceDependencyRefs({ scopedObligations, sliceOrder }) {
  const knownSliceIds = new Set(sliceOrder);
  const refs = [];
  for (const obligation of scopedObligations) {
    const body = explicitDependencyBody(obligation);
    if (!body) continue;
    const declaredRefs = [...body.matchAll(/\bSlice\s+([A-Z][A-Z0-9]*)\b/giu)].map((match) =>
      match[1].toUpperCase()
    );
    const unknownDependencies = declaredRefs
      .filter((sliceId) => !knownSliceIds.has(sliceId))
      .map((sliceId) => ({
        sourceId: obligation.id,
        dependencyId: `Slice ${sliceId}`,
      }));
    if (unknownDependencies.length > 0) {
      throw partitionFailure('source_obligation_dependency_unknown', {
        unknownDependencies,
      });
    }
    refs.push(...declaredRefs);
    for (const match of body.matchAll(
      /\bSlice\s+([A-Z][A-Z0-9]*)\s*(?:至|到|through|to)\s*Slice\s+([A-Z][A-Z0-9]*)\b/giu
    )) {
      const startIndex = sliceOrder.indexOf(match[1].toUpperCase());
      const endIndex = sliceOrder.indexOf(match[2].toUpperCase());
      if (startIndex >= 0 && endIndex >= startIndex) {
        refs.push(...sliceOrder.slice(startIndex, endIndex + 1));
      }
    }
  }
  return uniqueStrings(refs);
}

function structuredArrowTaskDependencies({ sourceObligations, knownTaskIds }) {
  const dependenciesByTaskId = new Map(
    [...knownTaskIds].map((taskId): [string, string[]] => [taskId, []])
  );
  const taskIdPattern = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\\d+[A-Z]?';
  const chainPattern = new RegExp(
    `^\\s*(${taskIdPattern}(?:\\s*->\\s*${taskIdPattern})+)\\s*$`,
    'u'
  );
  const taskPattern = new RegExp(taskIdPattern, 'gu');
  for (const obligation of sourceObligations) {
    const lines = String(obligation.exactText || obligation.text || '').split(/\r?\n/gu);
    for (const line of lines) {
      const chain = chainPattern.exec(line);
      if (!chain) continue;
      const taskIds = [...chain[1].matchAll(taskPattern)].map((match) => match[0]);
      const unknownDependencies = taskIds
        .filter((taskId) => !knownTaskIds.has(taskId))
        .map((taskId) => ({
          sourceId: obligation.id,
          dependencyId: taskId,
        }));
      if (unknownDependencies.length > 0) {
        throw partitionFailure('source_obligation_dependency_unknown', {
          unknownDependencies,
        });
      }
      for (let index = 1; index < taskIds.length; index += 1) {
        const dependentTaskId = taskIds[index];
        dependenciesByTaskId.set(
          dependentTaskId,
          uniqueStrings([
            ...(dependenciesByTaskId.get(dependentTaskId) || []),
            taskIds[index - 1],
          ])
        );
      }
    }
  }
  return dependenciesByTaskId;
}

function deriveStructuredTaskDependencyMap({
  declaredTasks,
  scopedObligationsByTask,
  sourceObligations,
}) {
  const knownTaskIds = new Set(declaredTasks.map((task) => task.id));
  const arrowDependenciesByTaskId = structuredArrowTaskDependencies({
    sourceObligations,
    knownTaskIds,
  });
  const directDependenciesByTaskId = new Map<string, string[]>(
    declaredTasks.map((task): [string, string[]] => [
      task.id,
      uniqueStrings([
        ...structuredTaskDependencies({
          task,
          scopedObligations: scopedObligationsByTask.get(task.id) || [],
          knownTaskIds,
        }),
        ...(arrowDependenciesByTaskId.get(task.id) || []),
      ]),
    ])
  );
  const sliceOrder = uniqueStrings(
    declaredTasks.map((task) => structuredTaskSliceId(task.id)).filter(Boolean)
  );
  const terminalTaskIdsBySlice = structuredSliceTerminals({
    declaredTasks,
    directDependenciesByTaskId,
  });
  return new Map(
    declaredTasks.map((task) => {
      const sliceRefs = structuredSliceDependencyRefs({
        scopedObligations: scopedObligationsByTask.get(task.id) || [],
        sliceOrder,
      });
      const dependencies = uniqueStrings([
        ...(directDependenciesByTaskId.get(task.id) || []),
        ...sliceRefs.flatMap((sliceId) => terminalTaskIdsBySlice.get(sliceId) || []),
      ]).filter((dependencyId) => dependencyId !== task.id);
      return [task.id, dependencies];
    })
  );
}

function structuredSliceIdFromHeadingPath(headingPath) {
  for (const heading of [...(headingPath || [])].reverse()) {
    const traceSlice = /(?:trace\s+slice|contract\s+activation\s+gate)\s+([A-Z][A-Z0-9]*)\b/iu.exec(
      String(heading)
    );
    if (traceSlice) return traceSlice[1].toUpperCase();
    const sliceSection =
      /^([A-Z][A-Z0-9]*)\s+(?:required\s+tests|required\s+commands|exit\s+gate)\b/iu.exec(
        String(heading)
      );
    if (sliceSection) return sliceSection[1].toUpperCase();
  }
  return null;
}

function isStructuredWritePathObligation(obligation) {
  return /^\s*[-*]\s+(?:modify|create|add|delete|regenerate|修改|创建|新增|删除|重新生成)(?:\s*[:：]\s*|\s+)`[^`\r\n]+[\\/][^`\r\n]+`[.\s]*$/iu.test(
    String(obligation.exactText || obligation.text || '')
  );
}

function structuredTaskSourceSectionLines(snapshot, task) {
  if (!Number.isInteger(task?.lineStart) || task.lineStart < 1) return [];
  const lines = String(snapshot.segments[0].content)
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n')
    .split('\n');
  const startIndex = task.lineStart - 1;
  const taskHeading = /^(#{1,6})\s+/u.exec(lines[startIndex] || '');
  if (!taskHeading) return [];
  const taskHeadingLevel = taskHeading[1].length;
  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const heading = /^(#{1,6})\s+/u.exec(lines[index]);
    if (heading && heading[1].length <= taskHeadingLevel) {
      endIndex = index;
      break;
    }
  }
  return lines.slice(startIndex, endIndex);
}

function hasStructuredInspectPathAuthority(snapshot, task) {
  return structuredTaskSourceSectionLines(snapshot, task).some((line) =>
    /^\s*[-*]\s+(?:inspect|检查|审阅)\s*[:：]\s*`[^`\r\n]+[\\/][^`\r\n]+`/iu.test(line)
  );
}

function isStructuredWriteMarker(obligation) {
  return /^\s*(?:[-*]\s+)?\*{0,2}(?:(?:target\s+)?modification\s+paths?|modify|create|add|delete|regenerate|修改|创建|新增|删除|重新生成)(?:\s+(?:or\s+)?(?:modify|create|add|delete|regenerate|修改|创建|新增|删除|重新生成))?\s*[:：]\*{0,2}\s*$/iu.test(
    String(obligation.exactText || obligation.text || '')
  );
}

function isStructuredReadOnlyMarker(obligation) {
  return /^\s*(?:[-*]\s+)?\*{0,2}(?:read[-\s]?only\s+(?:dependency\s+)?paths?|只读(?:依赖)?路径)\s*[:：]\*{0,2}\s*$/iu.test(
    String(obligation.exactText || obligation.text || '')
  );
}

function isStructuredWritePathListObligation(obligation) {
  const text = String(obligation.exactText || obligation.text || '');
  return (
    /^\s*[-*]\s+(?:\[[ xX]\]\s*)?`[^`\r\n]+[\\/][^`\r\n]+`\s*$/u.test(text) &&
    declaredPathsFromObligations([obligation]).length > 0
  );
}

function isStructuredListObligation(obligation) {
  return /^\s*[-*]\s+(?:\[[ xX]\]\s*)?/u.test(
    String(obligation.exactText || obligation.text || '')
  );
}

function writePathsFromObligations(obligations) {
  return uniqueStrings(
    obligations.flatMap((obligation) => {
      const text = String(obligation.exactText || obligation.text || '');
      const inlinePaths = [
        ...text.matchAll(
          /^\s*[-*]\s+(?:modify|create|add|delete|regenerate|修改|创建|新增|删除|重新生成)\s*[:：]\s*([^\s`]+)\s*$/gimu
        ),
      ].map((match) => match[1]);
      return [...declaredPathsFromObligations([obligation]), ...inlinePaths];
    })
  );
}

function deriveStructuredWritePathObligations(scopedObligations, taskId) {
  const writePathObligations = [];
  const readOnlyPathIds = new Set();
  let pathMarker = null;
  for (const obligation of scopedObligations) {
    if (isStructuredWritePathObligation(obligation)) {
      writePathObligations.push(obligation);
      pathMarker = null;
      continue;
    }
    if (isStructuredWriteMarker(obligation)) {
      pathMarker = 'write';
      continue;
    }
    if (isStructuredReadOnlyMarker(obligation)) {
      pathMarker = 'read_only';
      continue;
    }
    if (pathMarker && isStructuredWritePathListObligation(obligation)) {
      if (pathMarker === 'write') {
        writePathObligations.push(obligation);
      } else {
        readOnlyPathIds.add(obligation.id);
      }
      continue;
    }
    if (pathMarker && isStructuredListObligation(obligation)) {
      continue;
    }
    pathMarker = null;
  }
  const writePathIds = new Set(writePathObligations.map((obligation) => obligation.id));
  const unboundPathObligations = scopedObligations.filter(
    (obligation) =>
      isStructuredWritePathListObligation(obligation) &&
      !writePathIds.has(obligation.id) &&
      !readOnlyPathIds.has(obligation.id)
  );
  if (unboundPathObligations.length > 0) {
    throw partitionFailure('source_obligation_write_scope_unbound', {
      taskId,
      sourceIds: unboundPathObligations.map((obligation) => obligation.id),
    });
  }
  return writePathObligations;
}

function packStructuredWritePathObligations(obligations, maximumPaths) {
  if (obligations.length === 0) return [[]];
  const groups = [];
  let current = [];
  let currentPaths = new Set();
  for (const obligation of obligations) {
    const paths = uniqueStrings(writePathsFromObligations([obligation]));
    const nextPaths = new Set([...currentPaths, ...paths]);
    if (current.length > 0 && nextPaths.size > maximumPaths) {
      groups.push(current);
      current = [];
      currentPaths = new Set();
    }
    current.push(obligation);
    currentPaths = new Set([...currentPaths, ...paths]);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function hasStructuredNoSplitAuthority(scopedObligations) {
  return scopedObligations.some((obligation) => {
    const match = /^\s*[-*]\s+split\s+rule\s*[:：]\s*(.+)$/iu.exec(
      String(obligation.exactText || obligation.text || '')
    );
    if (!match) return false;
    return (
      /\batomic\b/iu.test(match[1]) ||
      /\b(?:remain|stay|form)\s+(?:in\s+)?one\b/iu.test(match[1]) ||
      /\bone\s+(?:ownership\s+)?(?:task|owner|unit|boundary|protocol|authority)\b/iu.test(match[1])
    );
  });
}

function deriveStructuredAtomicTasks({
  declaredTasks,
  scopedObligationsByTask,
  sourceTaskDependenciesByTaskId,
  unscopedSourceIds,
  maximumWriteScopesPerTask,
}) {
  const blueprints = declaredTasks.map((task) => {
    const scopedObligations = scopedObligationsByTask.get(task.id) || [];
    const writePathObligations = deriveStructuredWritePathObligations(scopedObligations, task.id);
    const writePathCount = uniqueStrings(writePathsFromObligations(writePathObligations)).length;
    const noSplitAuthority = hasStructuredNoSplitAuthority(scopedObligations);
    const atomicGroupRefs = uniqueStrings([
      ...(task.atomicGroupRefs || []),
      ...(noSplitAuthority
        ? [`source-atomic-${sha256Text(`${task.id}:${task.textHash}`).slice(7, 23)}`]
        : []),
    ]);
    const groups =
      writePathCount > maximumWriteScopesPerTask &&
      atomicGroupRefs.length === 0 &&
      !noSplitAuthority
        ? packStructuredWritePathObligations(writePathObligations, maximumWriteScopesPerTask)
        : [writePathObligations];
    const atomicTaskIds =
      groups.length === 1
        ? [task.id]
        : groups.map((_group, index) => `${task.id}-A${String(index + 1).padStart(2, '0')}`);
    return {
      task,
      scopedObligations,
      writePathObligations,
      groups,
      atomicTaskIds,
      atomicGroupRefs,
    };
  });
  const terminalTaskIdBySourceTask = new Map(
    blueprints.map((blueprint) => [blueprint.task.id, blueprint.atomicTaskIds.at(-1)])
  );
  const sourceTaskIdByAtomicTaskId = new Map(
    blueprints.flatMap((blueprint) =>
      blueprint.atomicTaskIds.map((atomicTaskId) => [atomicTaskId, blueprint.task.id])
    )
  );
  const tasks = [];
  const allowedPathsByTaskId = new Map();
  for (let sourceTaskIndex = 0; sourceTaskIndex < blueprints.length; sourceTaskIndex += 1) {
    const blueprint = blueprints[sourceTaskIndex];
    const writeSourceIds = new Set(
      blueprint.writePathObligations.map((obligation) => obligation.id)
    );
    const nonWriteSourceIds = blueprint.scopedObligations
      .filter(
        (obligation) => obligation.id !== blueprint.task.id && !writeSourceIds.has(obligation.id)
      )
      .map((obligation) => obligation.id);
    const sourceDependencies = sourceTaskDependenciesByTaskId.get(blueprint.task.id) || [];
    const resolvedSourceDependencies = sourceDependencies.map(
      (dependencyId) => terminalTaskIdBySourceTask.get(dependencyId) || dependencyId
    );
    for (let atomicIndex = 0; atomicIndex < blueprint.atomicTaskIds.length; atomicIndex += 1) {
      const atomicTaskId = blueprint.atomicTaskIds[atomicIndex];
      const group = blueprint.groups[atomicIndex];
      const finalAtomicTask = atomicIndex === blueprint.atomicTaskIds.length - 1;
      const sourceIds = uniqueStrings([
        ...(atomicIndex === 0 ? [blueprint.task.id] : []),
        ...group.map((obligation) => obligation.id),
        ...(finalAtomicTask ? nonWriteSourceIds : []),
        ...(sourceTaskIndex === 0 && finalAtomicTask ? unscopedSourceIds : []),
      ]);
      const dependencies =
        atomicIndex === 0 ? resolvedSourceDependencies : [blueprint.atomicTaskIds[atomicIndex - 1]];
      const allowedPaths = uniqueStrings(writePathsFromObligations(group));
      tasks.push({
        id: atomicTaskId,
        title:
          blueprint.atomicTaskIds.length === 1
            ? String(blueprint.task.exactText || blueprint.task.text || blueprint.task.id)
            : `${String(
                blueprint.task.exactText || blueprint.task.text || blueprint.task.id
              )} [atomic ${atomicIndex + 1}/${blueprint.atomicTaskIds.length}]`,
        sourceIds,
        dependencies,
        atomicGroupRefs: uniqueStrings(blueprint.atomicGroupRefs),
      });
      allowedPathsByTaskId.set(atomicTaskId, allowedPaths);
    }
  }
  return {
    tasks,
    allowedPathsByTaskId,
    sourceTaskIdByAtomicTaskId,
    terminalTaskIdBySourceTask,
  };
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
    .replace(/才允许(?=\s*(?:hard-cut|authoritative confirmation|atomic acceptance))/gu, '才许可')
    .replace(/表示允许(?=调用 Judge)/gu, '表示许可')
    .replace(/允许(?=\s*`requestedModel`\s*缺失)/gu, '许可')
    .replace(/允许后(?=\s*发生)/gu, '许可后')
    .replace(
      /可以(?=\s*(?:审阅和修订|写 execution evidence|选择 (?:Claude CLI|Codex CLI|OpenAI-compatible HTTP|Anthropic-compatible HTTP)|使用 (?:OpenAI-compatible|Anthropic-compatible)|在不改 production code|追溯到|在 crash recovery 后复用|产生后续修复轮|去重|作为独立 oracle|进行只读搜索|打开 Judge))/gu,
      '能够'
    )
    .replace(/\boptional(?=\s+draft preview\s+必须明确标记 non-authoritative)/giu, 'conditional');
}

function commandClassificationSnapshot(snapshot) {
  const content = snapshot.segments[0].content;
  const normalized = normalizeBoundedPermissionText(content)
    .replace(/^\\`\\`\\`/gmu, '```')
    .replace(/^\\~\\~\\~/gmu, '~~~');
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
  return currentKind === 'declared_execution_task' ? 'heading_requirement' : currentKind;
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
    const headingPath = [...(headingPaths[obligation.lineStart - 1] || obligation.headingPath)];
    const localizedTaskHeading =
      /^#{1,6}\s+(?:Task\s+)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+[A-Z]?)\s*[:：]/u.exec(rawLine);
    const listDeclaration =
      /^(?:\s*[-*]|\s*\d+\.)\s+(\[[ xX]\]\s*)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(rawLine);
    const listRemainder = listDeclaration ? rawLine.slice(listDeclaration[0].length) : '';
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
      `SRC-${sha256Text(`${snapshot.aggregateHash}:${obligation.lineStart}:${text}`)
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
    sourceObligationGraphHash: hashSourceObligationGraph(sourceObligationGraph),
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
        /^(?:Task\s+)?[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-T\d+[A-Z]?\s*[:：]/u.test(String(heading))
      ) && findNonDeterministicPhrase(obligation.text)
  );
  if (ambiguousLocalizedObligation) {
    throw partitionFailure('source_obligation_classification_ambiguous', {
      sourceId: ambiguousLocalizedObligation.id,
      matchedPhrase: findNonDeterministicPhrase(ambiguousLocalizedObligation.text),
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
  const tasks = applicable.filter((obligation) => obligation.kind === 'declared_execution_task');
  const select = (primaryKind, fallbackKind) => {
    const primary = applicable.filter((obligation) => obligation.kind === primaryKind);
    const fallback = applicable.filter((obligation) => obligation.kind === fallbackKind);
    const selected = primary.length > 0 ? primary : fallback;
    const seen = new Set();
    return selected.filter((obligation) => {
      if (seen.has(obligation.id)) return false;
      seen.add(obligation.id);
      return true;
    });
  };
  const explicitCommands = applicable.filter(
    (obligation) => obligation.kind === 'verification_command'
  );
  const commands =
    explicitCommands.length > 0
      ? explicitCommands
      : applicable.filter(
          (obligation) => obligation.kind === 'command_block' && commandDescriptor(obligation)
        );
  commands.forEach(compileTypedCommandRecord);
  return {
    tasks,
    acceptance: select('acceptance_condition', 'completion_criteria'),
    commands,
    evidence: select('evidence_contract', 'observability'),
  };
}

function deriveStructuredViews({
  snapshot,
  extracted,
  repositoryFacts,
  structuredBindings,
  partitionLimits,
  validators,
}) {
  const applicable = extracted.sourceObligations.filter(
    (obligation) => obligation.applicabilityState === 'applicable'
  );
  const sourceIds = uniqueStrings(applicable.map((obligation) => obligation.id));
  const declaredTasks = structuredBindings.tasks;
  const declaredTaskById = new Map(declaredTasks.map((task) => [task.id, task]));
  const declaredAcceptance = structuredBindings.acceptance;
  const declaredCommands = structuredBindings.commands;
  const declaredEvidence = structuredBindings.evidence;
  const ownerBySourceId = new Map();
  const scopedObligationsByTask = new Map<string, unknown[]>(
    declaredTasks.map((task): [string, unknown[]] => [task.id, []])
  );
  for (const obligation of applicable) {
    const owner = structuredTaskOwner(obligation, declaredTasks);
    if (!owner) continue;
    ownerBySourceId.set(obligation.id, owner.id);
    scopedObligationsByTask.get(owner.id).push(obligation);
  }
  const unscopedSourceIds = applicable
    .filter((obligation) => !ownerBySourceId.has(obligation.id))
    .map((obligation) => obligation.id);
  const sourceTaskDependenciesByTaskId = deriveStructuredTaskDependencyMap({
    declaredTasks,
    scopedObligationsByTask,
    sourceObligations: applicable,
  });
  const { tasks, allowedPathsByTaskId, sourceTaskIdByAtomicTaskId, terminalTaskIdBySourceTask } =
    deriveStructuredAtomicTasks({
      declaredTasks,
      scopedObligationsByTask,
      sourceTaskDependenciesByTaskId,
      unscopedSourceIds,
      maximumWriteScopesPerTask: partitionLimits.maxPrimaryWriteScopeOwnersPerPartition,
    });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const hasScopedBindings = [...declaredAcceptance, ...declaredEvidence].some((obligation) =>
    ownerBySourceId.has(obligation.id)
  );
  const sourceTaskOwnerFor = (obligation) =>
    ownerBySourceId.get(obligation.id) ||
    (!hasScopedBindings || declaredTasks.length === 1 ? declaredTasks[0].id : null);
  const ownerFor = (obligation) => {
    const sourceTaskId = sourceTaskOwnerFor(obligation);
    return sourceTaskId ? terminalTaskIdBySourceTask.get(sourceTaskId) || null : null;
  };
  const localBindings = (bindings, taskId) =>
    bindings.filter((obligation) => ownerFor(obligation) === taskId);
  const commandBindingsForTask = (taskId) => {
    const sourceTaskId = sourceTaskIdByAtomicTaskId.get(taskId);
    if (!sourceTaskId) return [];
    const sourceSliceId = structuredTaskSliceId(sourceTaskId);
    return declaredCommands.filter((obligation) => {
      const explicitOwner = ownerBySourceId.get(obligation.id);
      if (explicitOwner) return explicitOwner === sourceTaskId;
      const commandSliceId = structuredSliceIdFromHeadingPath(obligation.headingPath);
      return commandSliceId ? Boolean(sourceSliceId && commandSliceId === sourceSliceId) : true;
    });
  };
  const evidenceIdsForTask = (taskId) => {
    const explicit = localBindings(declaredEvidence, taskId).map((obligation) => obligation.id);
    return explicit.length > 0 ? explicit : [`EVD-DERIVED-${taskId}`];
  };
  const commandRecords = declaredCommands.map((obligation) => ({
    ...compileTypedCommandRecord(obligation),
    expectedExitBehavior: 'exits with the declared expected status',
    productionEntryPoint: 'goalContractCommand',
    evidenceType: 'behavior',
    provenanceFields: ['argv', 'cwd', 'exitCode'],
    freshnessRule: 'current source roots',
  }));
  const commandIds = commandRecords.map((command) => command.id);
  const allowedPaths = sourceAuthorizedPaths({
    snapshot,
    extracted,
    repositoryFacts,
  });
  const traceSlices = tasks.map((task, index) => {
    const taskAcceptance = localBindings(declaredAcceptance, task.id);
    const taskCommands = commandBindingsForTask(task.id).map((obligation) => obligation.id);
    const sourceTaskId = sourceTaskIdByAtomicTaskId.get(task.id);
    const taskAllowedPaths = allowedPathsByTaskId.get(task.id) || [];
    const integrationVerificationOnly =
      taskAllowedPaths.length === 0 &&
      task.dependencies.length > 0 &&
      taskCommands.length > 0 &&
      taskAcceptance.length > 0 &&
      hasStructuredInspectPathAuthority(snapshot, declaredTaskById.get(sourceTaskId));
    return {
      id: `TRACE-${task.id}`,
      goalIds: [task.id],
      sourceIds: task.sourceIds,
      acceptanceIds: taskAcceptance.map((obligation) => obligation.id),
      evidenceIds: evidenceIdsForTask(task.id),
      classification: integrationVerificationOnly ? 'evidence_only' : 'code_bearing',
      verificationOnly: integrationVerificationOnly,
      productionSymbols: integrationVerificationOnly ? [] : ['goalContractCommand'],
      allowedPaths: taskAllowedPaths,
      directCommands: taskCommands,
      impactedCommands: taskCommands,
      integrationCommands: taskCommands,
      regressionCommands: taskCommands,
      dependencies: task.dependencies,
      commitPolicy: 'exactly_one_atomic_commit',
      closeCondition: `The observable outcome for ${task.id} is verified.`,
      stopConditionIds: index === 0 ? ['STOP-STRUCTURED-001'] : [],
    };
  });
  const primaryTrace = traceSlices[0];
  const acceptanceItems = declaredAcceptance
    .map((obligation) => {
      const ownerTaskId = ownerFor(obligation);
      const ownerTask = taskById.get(ownerTaskId);
      if (!ownerTask) return null;
      return {
        id: obligation.id,
        statement: String(obligation.exactText || obligation.text || obligation.id),
        sourceIds: ownerTask.sourceIds,
        goalIds: [ownerTask.id],
        traceIds: [`TRACE-${ownerTask.id}`],
        requiredCommands: commandBindingsForTask(ownerTask.id).map((command) => command.id),
        expectedEvidenceIds: localBindings(declaredEvidence, ownerTask.id).length
          ? localBindings(declaredEvidence, ownerTask.id).map((evidence) => evidence.id)
          : evidenceIdsForTask(ownerTask.id),
        requiredEvidenceStrength: 'behavior',
        passCondition: String(obligation.exactText || obligation.text || obligation.id),
      };
    })
    .filter(Boolean);
  const explicitExpectedEvidence = declaredEvidence
    .map((obligation) => {
      const ownerTaskId = ownerFor(obligation);
      const ownerTask = taskById.get(ownerTaskId);
      if (!ownerTask) return null;
      const taskCommands = commandBindingsForTask(ownerTask.id);
      return {
        id: obligation.id,
        sourceIds: ownerTask.sourceIds,
        producer: taskCommands[0]?.id || ownerTask.id,
        admissibleTypes: ['behavior'],
        requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
        freshnessRule: 'current source roots',
        expectedResult: String(obligation.exactText || obligation.text || obligation.id),
      };
    })
    .filter(Boolean);
  const derivedExpectedEvidence = tasks
    .filter((task) => localBindings(declaredEvidence, task.id).length === 0)
    .map((task) => ({
      id: evidenceIdsForTask(task.id)[0],
      sourceIds: task.sourceIds,
      producer: task.id,
      admissibleTypes: ['behavior'],
      requiredProvenanceFields: ['taskId', 'sourceSnapshotHash'],
      freshnessRule: 'current source roots',
      expectedResult: `The observable outcome for ${task.id} is verified.`,
    }));
  const expectedEvidence = [...explicitExpectedEvidence, ...derivedExpectedEvidence].sort(
    (left, right) => left.id.localeCompare(right.id)
  );
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
        evidenceIds: expectedEvidence.map((evidence) => evidence.id),
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
  if (sequenceExecutionState.shouldResolveProducer && !producerAvailable) {
    throw partitionFailure('sequence_closure_required_unavailable', sequenceExecutionState);
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

async function compilePartitionAuthority(
  args,
  { canonicalSourceAuthority = null } = {}
) {
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
  const { canonicalSourceObligationGraph, extractSourceObligations, hashSourceObligationGraph } =
    loadPartitionModule('utils/goal-contract/source-obligation-extractor');
  const { findNonDeterministicPhrase } = loadPartitionModule(
    'utils/goal-contract/non-deterministic-source-validator'
  );
  const { loadPartitionPolicy } = loadPartitionModule('utils/goal-contract/partition-policy');
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
  const { deriveSequenceExecutionState, resolveSequenceMode } = loadPartitionModule(
    'utils/goal-contract/sequence-mode'
  );
  const sequenceMode = resolveSequenceMode(take(args, '--sequence-mode', 'auto'));
  const {
    compileLegacySingleSourcePartitions,
    compilePartitions,
  } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-compiler'
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
  const structuredBindings = selectCommandStructuredBindings(extracted.sourceObligations);
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
          partitionLimits: policyBinding.policy.limits,
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
  const boundaryContext: Record<string, unknown> & {
    sequenceMode?: unknown;
    sequenceCoverage?: unknown;
    sequenceClosureStatus?: unknown;
    childContractAuthority?: unknown;
  } = {
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
          ? path.join(path.dirname(path.resolve(requestedOut)), '.goal-contract-receipts')
          : path.join(path.dirname(sourcePath), '.goal-contract-receipts')
      );
      const { writeSequenceApplicabilityBoundaryReceipt } = loadPartitionModule(
        'utils/goal-contract/partition-receipts'
      );
      const persisted = writeSequenceApplicabilityBoundaryReceipt({
        applicabilityReceipt: applicability,
        methodologyProfileHash: methodology.methodologyProfileHash,
        receiptsDir,
        sequenceMode,
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
  let partitionBundle;
  let compiled;
  try {
    const partitionRequest = {
      methodologyProfile: methodology,
      partitionPolicyBinding: policyBinding,
      reconciledGraph: reconciliation.graphInput,
      reconciliationReceiptHash: sha256Text(
        stableStringify({
          graphInputHash: reconciliation.graphInputHash,
          issues: reconciliation.issues,
          metrics: reconciliation.metrics,
          outputInventory: reconciliation.outputInventory,
        })
      ),
      sequenceApplicabilityReceipt: applicability,
      sequenceConstraintInput: sequenceBranch.sequenceConstraintInput,
      sequenceExecutionState: sequenceBranch.sequenceExecutionState,
    };
    partitionBundle = canonicalSourceAuthority
      ? compilePartitions({
          ...canonicalSourceAuthority,
          ...partitionRequest,
        })
      : compileLegacySingleSourcePartitions({
          sourceSnapshot: snapshot,
          sourceObligationGraph: extracted.sourceObligationGraph,
          ...partitionRequest,
        });
    const partitionSourceSnapshot = {
      ...snapshot,
      aggregateHash: partitionBundle.partitionPlan.orderedSourceSnapshotSetHash,
    };
    const partitionSourceObligationGraph = canonicalSourceAuthority
      ? canonicalSourceAuthority.canonicalIntentBundle.sourceObligationGraph
      : extracted.sourceObligationGraph;
    Object.assign(boundaryContext, {
      sourceCompositionMode: partitionBundle.partitionPlan.sourceCompositionMode,
      sourceCompositionPolicyHash: partitionBundle.partitionPlan.sourceCompositionPolicyHash,
      orderedSourceSnapshotSetHash: partitionBundle.partitionPlan.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: partitionBundle.partitionPlan.sourceAuthorityBundleHash,
      canonicalIntentSemanticHash: partitionBundle.partitionPlan.canonicalIntentSemanticHash,
      canonicalIntentBundleHash: partitionBundle.partitionPlan.canonicalIntentBundleHash,
      specSpanRegistryHash: partitionBundle.partitionPlan.specSpanRegistryHash,
      intentAuthorityAttestationHash: partitionBundle.partitionPlan.intentAuthorityAttestationHash,
      goalContractSemanticHash: partitionBundle.partitionPlan.goalContractSemanticHash,
      goalContractHash: partitionBundle.partitionPlan.goalContractHash,
    });
    compiled = compilePartitionManifest({
      sourceSnapshot: partitionSourceSnapshot,
      sourceObligationGraph: partitionSourceObligationGraph,
      sourceObligationGraphHash: partitionBundle.executionProjection.sourceObligationGraphHash,
      methodologyProfileHash: methodology.methodologyProfileHash,
      reconciledGraph: partitionBundle.reconciledGraphAuthority,
      reconciledGraphHash: partitionBundle.executionProjection.reconciledGraphHash,
      reconciliationReceiptHash: sha256Text(
        stableStringify({
          graphInputHash: reconciliation.graphInputHash,
          issues: reconciliation.issues,
          metrics: reconciliation.metrics,
          outputInventory: reconciliation.outputInventory,
        })
      ),
      executionProjection: partitionBundle.executionProjection,
      projectionAuthority: partitionBundle.projectionAuthority,
      policyBinding: partitionBundle.partitionPolicyBinding,
      semanticDerivationMode: derivationMode.mode,
      implementationViewReceipt: derivation.implementation.receipt,
      acceptanceEvidenceViewReceipt: derivation.acceptanceEvidence.receipt,
      componentGraph: partitionBundle.componentGraph,
      optimization: partitionBundle.optimization,
    });
  } catch (error) {
    Object.assign(error, boundaryContext, {
      executionProjectionHash: partitionBundle?.executionProjection?.executionProjectionHash,
      taskDagHash: partitionBundle?.executionProjection?.taskDagHash,
      integrationJoinGraphHash: partitionBundle?.executionProjection?.integrationJoinGraphHash,
    });
    throw error;
  }
  return Object.freeze({
    boundaryContext,
    snapshot,
    methodology,
    extracted,
    reconciliation,
    projection: partitionBundle.executionProjection,
    optimizerPolicyBinding: partitionBundle.partitionPolicyBinding,
    componentGraph: partitionBundle.componentGraph,
    optimization: partitionBundle.optimization,
    partitionPlan: partitionBundle.partitionPlan,
    partitionPlanBytes: partitionBundle.partitionPlanBytes,
    partitionPlanHash: partitionBundle.partitionPlanHash,
    projectionAuthority: partitionBundle.projectionAuthority,
    reconciledGraphAuthority: partitionBundle.reconciledGraphAuthority,
    compiled,
  });
}

function requireSupersessionArg(args, name) {
  const value = take(args, name);
  if (!value) {
    throw partitionFailure('authority_supersession_argument_missing', {
      missingArguments: [name],
    });
  }
  return value;
}

function partitionCompilerIdentityAssetPaths() {
  const assetNames = [
    'goal-contract-profile.json',
    'goal-execution-contract-template.md',
    'goal-contract-partition-plan.schema.json',
    'goal-contract-partition-analysis-receipt.schema.json',
    'goal-contract-partition-closure-feasibility-receipt.schema.json',
    'goal-contract-partition-impact-drift-receipt.schema.json',
    'goal-contract-partition-impact-graph.schema.json',
    'goal-contract-partition-impact-policy.json',
    'goal-contract-partition-impact-policy.schema.json',
    'goal-contract-execution-projection.schema.json',
    'goal-contract-partition-manifest.schema.json',
    'goal-contract-partition-output-authority.schema.json',
    'goal-contract-authority-supersession-receipt.schema.json',
    'goal-contract-source-grounded-coverage-receipt.schema.json',
    'goal-contract-partition-release-gate-receipt.schema.json',
    'goal-contract-campaign-activation-receipt.schema.json',
    'goal-contract-subcontract-execution-lease.schema.json',
    'goal-contract-subcontract-evidence.schema.json',
    'goal-contract-subcontract-closure-receipt.schema.json',
    'goal-contract-campaign-closure-receipt.schema.json',
  ];
  return [
    __filename,
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/control-plane/canonical-hash'),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/partition-compiler'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/partition-closure-feasibility'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/partition-impact-graph'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/partition-impact-policy'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/authority-supersession'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/campaign-activation'
    ),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/control-plane/campaign-closure'),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/campaign-receipt-store'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/subcontract-closure'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/partition-closure-scope'
    ),
    resolvePartitionCompilerIdentityAssetPath(
      'utils/goal-contract/control-plane/subcontract-evidence'
    ),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/goal-contract-receipts'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/partition-receipts'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/partition-manifest'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/partition-selector'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/source-obligation-extractor'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/slot-data-builder'),
    resolvePartitionCompilerIdentityAssetPath('utils/goal-contract/release-gate'),
    resolveRendererPath(),
    resolveCommandPortabilityCheckerPath(),
    ...assetNames.map((assetName) => resolveGoalContractAssetPath(assetName)),
  ].filter((assetPath, index, paths) => paths.indexOf(assetPath) === index);
}

function currentPartitionCompilerIdentityHash() {
  const { hashControlPlaneValue } = loadPartitionModule(
    'utils/goal-contract/control-plane/canonical-hash'
  );
  return hashControlPlaneValue(
    partitionCompilerIdentityAssetPaths()
      .map((compilerPath) => ({
        path: normalize(compilerPath),
        sha256: sha256FileBytes(compilerPath),
      }))
      .sort((left, right) => left.path.localeCompare(right.path))
  );
}

function parseFrozenGoalContractFrontMatter(goalContractPath) {
  const text = fs.readFileSync(goalContractPath, 'utf8');
  const lines = text.split(/\r?\n/u);
  const slotIndex = lines.findIndex((line) =>
    line.startsWith('<!-- goal-slot:frontMatter ')
  );
  const openingIndex =
    lines[0] === '---'
      ? 0
      : slotIndex >= 0 && lines[slotIndex + 1] === '---'
        ? slotIndex + 1
        : -1;
  if (openingIndex < 0) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  const closingIndex = lines.indexOf('---', openingIndex + 1);
  if (closingIndex <= openingIndex) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  return Object.fromEntries(
    lines.slice(openingIndex + 1, closingIndex).map((line) => {
      const separator = line.indexOf(':');
      return [
        line.slice(0, separator),
        line.slice(separator + 1).trim(),
      ];
    })
  );
}

function readFrozenSuccessorAuthority({ goalContractPath, sourcePath }) {
  const resolvedGoalContractPath = path.resolve(goalContractPath);
  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedGoalContractPath)) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract', {
      requiredPath: normalize(resolvedGoalContractPath),
    });
  }
  const fields = parseFrozenGoalContractFrontMatter(resolvedGoalContractPath);
  const sourceHash = sha256FileBytes(resolvedSourcePath);
  if (
    fields.contractMode !== 'frozen' ||
    fields.rewritePolicy !== 'forbidden' ||
    path.resolve(fields.sourcePlanPath || '') !== resolvedSourcePath ||
    fields.sourcePlanHash !== sourceHash ||
    !fields.coverageReceiptPath ||
    !fields.generationReceiptPath
  ) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  let coverageReceipt;
  let generationReceipt;
  try {
    coverageReceipt = JSON.parse(
      fs.readFileSync(path.resolve(fields.coverageReceiptPath), 'utf8')
    );
    generationReceipt = JSON.parse(
      fs.readFileSync(path.resolve(fields.generationReceiptPath), 'utf8')
    );
  } catch {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  const goalContractDocumentHash = sha256FileBytes(resolvedGoalContractPath);
  if (
    coverageReceipt.decision !== 'pass' ||
    coverageReceipt.sourcePlanHash !== sourceHash ||
    generationReceipt.sourcePlanHash !== sourceHash ||
    generationReceipt.goalContractDocumentHash !== goalContractDocumentHash
  ) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  return Object.freeze({
    goalContractPath: resolvedGoalContractPath,
    goalContractDocumentHash,
    sourceHash,
    fields,
    coverageReceipt,
    generationReceipt,
  });
}

function goalContractRendererAssets() {
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
  return Object.freeze({
    profilePath,
    profileBytes: fs.readFileSync(profilePath),
    profile: JSON.parse(fs.readFileSync(profilePath, 'utf8')),
    templatePath,
    templateBytes: fs.readFileSync(templatePath),
    templateText: fs.readFileSync(templatePath, 'utf8'),
  });
}

function compileFrozenSuccessorSourceAuthority({ frozen, assets }) {
  const dependencies = loadWholeSourceDependencies();
  const sourcePath = path.resolve(frozen.fields.sourcePlanPath);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const sourceSnapshot = dependencies.buildSourceSnapshot({
    sourceType: 'source_plan',
    sourcePath: normalize(sourcePath),
    rawBytes: Buffer.from(sourceText, 'utf8'),
  });
  const source = dependencies.extractSourceObligations({
    snapshot: sourceSnapshot,
  });
  const compiled = compileStandaloneGoalContract({
    source,
    sourceText,
    resolvedOut: frozen.goalContractPath,
    coverageReceiptPath: path.resolve(frozen.fields.coverageReceiptPath),
    generationReceiptPath: path.resolve(frozen.fields.generationReceiptPath),
    profileBytes: assets.profileBytes,
    templateBytes: assets.templateBytes,
    dependencies,
  });
  const generationReceipt = frozen.generationReceipt;
  const compilationReceipt = generationReceipt.compilationReceipt || {};
  const expectedBindings = {
    sourceCompositionPolicyHash: compiled.bundle.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: compiled.bundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: compiled.bundle.sourceAuthorityBundleHash,
  };
  for (const [field, actual] of Object.entries(expectedBindings)) {
    const expected = generationReceipt[field] || compilationReceipt[field];
    if (expected && expected !== actual) {
      throw partitionFailure('blocked_by_frozen_successor_goal_contract', {
        field,
        expected,
        actual,
      });
    }
  }
  return Object.freeze({
    sourceCompositionPolicy: compiled.sourceCompositionPolicy,
    orderedSourceSnapshotSet: compiled.orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle: compiled.compositeSourceAuthorityBundle,
    canonicalIntentBundle: compiled.canonicalIntentBundle,
    goalContractBundle: compiled.bundle,
    subordinateCoverageReceipts: compiled.subordinateCoverageReceipts,
  });
}

function createPartitionChildRenderer({
  authority,
  sourcePath,
  assets,
  renderEvidence,
  repositoryRelativeUnitRoot = null,
}) {
  const { buildPartitionSlotData } = loadPartitionModule(
    'utils/goal-contract/slot-data-builder'
  );
  const { selectPartitionScope } = loadPartitionModule(
    'utils/goal-contract/partition-selector'
  );
  const { renderGoalContract } = loadRenderer();
  const { auditCommandPortability } = loadCommandPortabilityChecker();
  return ({ childProjectionInput, displayOrdinal }) => {
    const legacySelectedScope = selectPartitionScope({
      executionProjection: authority.projection,
      partitionManifest: authority.compiled.manifest,
      partitionId: childProjectionInput.partitionId,
    });
    for (const field of [
      'primaryTaskIds',
      'primaryTraceSliceIds',
      'completionPredicateIds',
      'evidenceContractIds',
      'dependencyPartitionIds',
      'ownedArtifactPaths',
      'governedPaths',
    ]) {
      if (
        stableStringify(legacySelectedScope.partition[field] || []) !==
        stableStringify(childProjectionInput[field] || [])
      ) {
        throw partitionFailure('partition_child_projection_mismatch', {
          partitionId: childProjectionInput.partitionId,
          mismatchedFields: [field],
        });
      }
    }
    const selectedScope = enrichSelectedScope({
      selectedScope: {
        ...legacySelectedScope,
        partition: {
          ...legacySelectedScope.partition,
          primarySourceObligationIds:
            childProjectionInput.primarySourceObligationIds,
          selectionSetHash: childProjectionInput.selectionHash,
        },
        selectionReceipt: {
          ...legacySelectedScope.selectionReceipt,
          selectedPrimarySourceObligationIds:
            childProjectionInput.primarySourceObligationIds,
        },
      },
      reconciliation: authority.reconciliation,
    });
    const ordinal = String(displayOrdinal).padStart(2, '0');
    const unitChildContractPath =
      `children/p${ordinal}-${childProjectionInput.partitionId}` +
      '-goal-execution-plan.md';
    const unitCoverageReceiptPath =
      `receipts/children/${childProjectionInput.partitionId}.coverage.json`;
    const unitGenerationReceiptPath =
      `receipts/children/${childProjectionInput.partitionId}.generation.json`;
    const childContractPath = repositoryRelativeUnitRoot
      ? path.posix.join(
          repositoryRelativeUnitRoot,
          unitChildContractPath
        )
      : unitChildContractPath;
    const coverageReceiptPath = repositoryRelativeUnitRoot
      ? path.posix.join(
          repositoryRelativeUnitRoot,
          unitCoverageReceiptPath
        )
      : unitCoverageReceiptPath;
    const generationReceiptPath = repositoryRelativeUnitRoot
      ? path.posix.join(
          repositoryRelativeUnitRoot,
          unitGenerationReceiptPath
        )
      : unitGenerationReceiptPath;
    const { slotData, registries, coverageAudit, implementationProofAudit } =
      buildPartitionSlotData({
        source: {
          sourcePlanPath: normalize(sourcePath),
          sourcePlanHash: sha256FileBytes(sourcePath),
          sourceBytes: authority.snapshot.sourceBytes,
          sourceLines: authority.snapshot.sourceLines,
        },
        profile: assets.profile,
        selectedScope,
        receiptPaths: {
          outPath: childContractPath,
          coverageReceiptPath: path.posix.relative(
            path.posix.dirname(childContractPath),
            coverageReceiptPath
          ),
          generationReceiptPath: path.posix.relative(
            path.posix.dirname(childContractPath),
            generationReceiptPath
          ),
        },
        bindings: {
          partitionPlanHash: authority.partitionPlan.partitionPlanHash,
          sourceCompositionPolicyHash:
            authority.partitionPlan.sourceCompositionPolicyHash,
          goalContractHash: authority.partitionPlan.goalContractHash,
          partitionSetHash: authority.partitionPlan.partitionSetHash,
          selectionSetHash: childProjectionInput.selectionHash,
          orderedSourceSnapshotSetHash:
            authority.partitionPlan.orderedSourceSnapshotSetHash,
          sourceAuthorityBundleHash:
            authority.partitionPlan.sourceAuthorityBundleHash,
          subordinateCoverageReceiptHashes:
            childProjectionInput.subordinateCoverageReceiptHashes,
          displayOrdinal,
          obligationRefs: childProjectionInput.primarySourceObligationIds,
          namespacedObligations: childProjectionInput.namespacedObligations,
          namespaceRefs: childProjectionInput.namespaceRefs,
          sourceArtifactRefs: childProjectionInput.sourceArtifactRefs,
          specSpanRefs: childProjectionInput.specSpanRefs,
          governedPaths:
            childProjectionInput.governedPaths ??
            childProjectionInput.ownedArtifactPaths,
          sourceSnapshotHash:
            authority.partitionPlan.orderedSourceSnapshotSetHash,
          methodologyProfileHash:
            authority.partitionPlan.methodologyProfileHash,
          methodologyProfileArtifactHash:
            authority.methodology.methodologyProfileArtifactHash,
          executionProjectionHash:
            authority.partitionPlan.executionProjectionHash,
          taskDagHash: authority.partitionPlan.taskDagHash,
          partitionPolicyHash: authority.partitionPlan.partitionPolicyHash,
          partitionPolicyArtifactHash:
            authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
          partitionAnalysisReceiptHash:
            authority.partitionPlan.partitionPlanHash,
          sequenceMode: authority.partitionPlan.sequenceMode,
          sequenceApplicability:
            authority.partitionPlan.sequenceApplicability,
          sequenceCoverage: authority.partitionPlan.sequenceCoverage,
          sequenceClosureStatus:
            authority.partitionPlan.sequenceClosureStatus,
          childContractAuthority:
            authority.partitionPlan.childContractAuthority,
        },
        generatedAt: '1970-01-01T00:00:00.000Z',
      });
    const rendered = renderGoalContract({
      templateText: assets.templateText,
      profile: assets.profile,
      slotData,
      validateHashes: true,
      generationMode: 'partition_selected_scope',
    });
    const embeddedFrontMatter = slotData.frontMatter.trim();
    const childContractBytes =
      `${embeddedFrontMatter}\n\n` +
      rendered.document.replace(`\n${embeddedFrontMatter}\n`, '\n');
    const commandPortabilityAudit = auditCommandPortability({
      content: childContractBytes,
      targetPath: childContractPath,
      shell: 'pwsh',
    });
    const issues = rendererIssues(rendered.audit);
    if (
      coverageAudit.decision !== 'pass' ||
      implementationProofAudit.decision !== 'pass' ||
      issues.length > 0 ||
      commandPortabilityAudit.status !== 'PASS'
    ) {
      throw partitionFailure(
        commandPortabilityAudit.status === 'PASS'
          ? 'deterministic_preflight_failed'
          : 'command_portability_failed',
        {
          partitionId: childProjectionInput.partitionId,
          rendererAudit: rendered.audit,
          commandPortabilityAudit,
          coverageAudit,
          implementationProofAudit,
        }
      );
    }
    renderEvidence.push({
      partitionId: childProjectionInput.partitionId,
      displayOrdinal,
      childContractPath,
      coverageReceiptPath,
      generationReceiptPath,
      rendererAudit: rendered.audit,
      coverageAudit,
      implementationProofAudit,
      commandPortabilityAudit,
      selectedPrimaryObligationIds:
        selectedScope.selectionReceipt.selectedPrimarySourceObligationIds,
      inheritedConstraintIds:
        selectedScope.selectionReceipt.inheritedConstraintIds,
      excludedObligationIds: [
        ...selectedScope.selectionReceipt.excludedSourceObligationIds,
        ...selectedScope.selectionReceipt.excludedTraceSliceIds,
        ...selectedScope.selectionReceipt.excludedAtomicTaskIds,
        ...selectedScope.selectionReceipt.excludedAcceptanceIds,
        ...selectedScope.selectionReceipt.excludedCommandIds,
        ...selectedScope.selectionReceipt.excludedEvidenceContractIds,
      ],
      orphanGeneratedTaskIds: registries.tasks.filter(
        (taskId) =>
          !selectedScope.selectionReceipt.selectedPrimaryAtomicTaskIds.includes(
            taskId
          )
      ),
      orphanGeneratedAcceptanceIds: registries.acceptance.filter(
        (acceptanceId) =>
          !selectedScope.selectionReceipt.selectedAcceptanceIds.includes(
            acceptanceId
          )
      ),
      selectedAtomicTaskCount: selectedScope.primaryAtomicTasks.length,
      inheritedConstraintCount: selectedScope.inheritedConstraints.length,
      partitionRole: selectedScope.partition.partitionRole,
      deterministicPreflight: {
        schemaVersion:
          'goal-contract-governed-child-deterministic-preflight/v1',
        decision: 'pass',
      },
    });
    return { childContractPath, childContractBytes };
  };
}

function projectFunctionalPartitionTitles(authority) {
  const taskTitles = new Map(
    (authority?.projection?.atomicTasks || []).map((task) => [
      task.taskId,
      task.title,
    ])
  );
  return Object.freeze(
    Object.fromEntries(
      (authority?.partitionPlan?.childProjectionInputs || []).map(
        (partition) => {
          const titles = [
            ...new Set(
              (partition.primaryTaskIds || [])
                .map((taskId) => taskTitles.get(taskId))
                .filter(
                  (title) =>
                    typeof title === 'string' &&
                    title.trim().length > 0
                )
                .map((title) => title.trim())
            ),
          ];
          if (titles.length === 0) {
            throw partitionFailure(
              'partition_display_title_missing',
              { partitionId: partition.partitionId }
            );
          }
          return [partition.partitionId, titles.join('; ')];
        }
      )
    )
  );
}

function authorityUnitChildArtifactPath(output, childContractPath) {
  const repositoryCandidate = path.resolve(
    process.cwd(),
    childContractPath
  );
  const repositoryRelativeToUnit = path.relative(
    output.unitRoot,
    repositoryCandidate
  );
  if (
    repositoryRelativeToUnit.length > 0 &&
    repositoryRelativeToUnit !== '..' &&
    !repositoryRelativeToUnit.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(repositoryRelativeToUnit)
  ) {
    return repositoryRelativeToUnit.replace(/\\/gu, '/');
  }
  return childContractPath;
}

async function supersedeAuthority(args) {
  const sourcePath = path.resolve(requireSupersessionArg(args, '--source'));
  const {
    assertRawNonAuthoritativeContainmentRoot,
  } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-output-paths'
  );
  const finalRoot = assertRawNonAuthoritativeContainmentRoot({
    repositoryRoot: process.cwd(),
    containmentRoot: requireSupersessionArg(args, '--out-root'),
  });
  const authority = await compilePartitionAuthority(args);
  const partitionPlan = authority.partitionPlan;
  const { projectExecutionArtifacts } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-compiler'
  );
  const {
    prepareAuthoritySupersession,
    promoteAuthoritySupersessionAttempt,
    stageAuthoritySupersessionAttempt,
  } = loadPartitionModule('utils/goal-contract/control-plane/authority-supersession');
  const { buildPartitionSlotData } = loadPartitionModule('utils/goal-contract/slot-data-builder');
  const { selectPartitionScope } = loadPartitionModule('utils/goal-contract/partition-selector');
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
  const { renderGoalContract } = loadRenderer();
  const { auditCommandPortability } = loadCommandPortabilityChecker();
  const renderEvidence = [];
  const projected = projectExecutionArtifacts({
    partitionPlan,
    renderChildContract({ childProjectionInput, displayOrdinal }) {
      const legacySelectedScope = selectPartitionScope({
        executionProjection: authority.projection,
        partitionManifest: authority.compiled.manifest,
        partitionId: childProjectionInput.partitionId,
      });
      for (const field of [
        'primaryTaskIds',
        'primaryTraceSliceIds',
        'completionPredicateIds',
        'evidenceContractIds',
        'dependencyPartitionIds',
        'ownedArtifactPaths',
        'governedPaths',
      ]) {
        if (
          stableStringify(legacySelectedScope.partition[field] || []) !==
          stableStringify(childProjectionInput[field] || [])
        ) {
          throw partitionFailure('partition_child_projection_mismatch', {
            partitionId: childProjectionInput.partitionId,
            mismatchedFields: [field],
          });
        }
      }
      const selectedScope = enrichSelectedScope({
        selectedScope: {
          ...legacySelectedScope,
          partition: {
            ...legacySelectedScope.partition,
            primarySourceObligationIds: childProjectionInput.primarySourceObligationIds,
            selectionSetHash: childProjectionInput.selectionHash,
          },
          selectionReceipt: {
            ...legacySelectedScope.selectionReceipt,
            selectedPrimarySourceObligationIds: childProjectionInput.primarySourceObligationIds,
          },
        },
        reconciliation: authority.reconciliation,
      });
      const ordinal = String(displayOrdinal).padStart(2, '0');
      const childContractPath =
        `children/p${ordinal}-${childProjectionInput.partitionId}` + '-goal-execution-plan.md';
      const coverageReceiptPath =
        `receipts/children/${childProjectionInput.partitionId}` + '.coverage.json';
      const generationReceiptPath =
        `receipts/children/${childProjectionInput.partitionId}` + '.generation.json';
      const relativeCoveragePath = path.posix.relative(
        path.posix.dirname(childContractPath),
        coverageReceiptPath
      );
      const relativeGenerationPath = path.posix.relative(
        path.posix.dirname(childContractPath),
        generationReceiptPath
      );
      const { slotData, coverageAudit, implementationProofAudit } = buildPartitionSlotData({
        source: {
          sourcePlanPath: normalize(sourcePath),
          sourcePlanHash: sha256FileBytes(sourcePath),
          sourceBytes: authority.snapshot.sourceBytes,
          sourceLines: authority.snapshot.sourceLines,
        },
        profile,
        selectedScope,
        receiptPaths: {
          outPath: childContractPath,
          coverageReceiptPath: relativeCoveragePath,
          generationReceiptPath: relativeGenerationPath,
        },
        bindings: {
          partitionPlanHash: partitionPlan.partitionPlanHash,
          sourceCompositionPolicyHash: partitionPlan.sourceCompositionPolicyHash,
          goalContractHash: partitionPlan.goalContractHash,
          partitionSetHash: partitionPlan.partitionSetHash,
          selectionSetHash: childProjectionInput.selectionHash,
          orderedSourceSnapshotSetHash: partitionPlan.orderedSourceSnapshotSetHash,
          sourceAuthorityBundleHash: partitionPlan.sourceAuthorityBundleHash,
          subordinateCoverageReceiptHashes: childProjectionInput.subordinateCoverageReceiptHashes,
          displayOrdinal,
          obligationRefs: childProjectionInput.primarySourceObligationIds,
          namespacedObligations: childProjectionInput.namespacedObligations,
          namespaceRefs: childProjectionInput.namespaceRefs,
          sourceArtifactRefs: childProjectionInput.sourceArtifactRefs,
          specSpanRefs: childProjectionInput.specSpanRefs,
          governedPaths:
            childProjectionInput.governedPaths ??
            childProjectionInput.ownedArtifactPaths,
          sourceSnapshotHash: partitionPlan.orderedSourceSnapshotSetHash,
          methodologyProfileHash: partitionPlan.methodologyProfileHash,
          methodologyProfileArtifactHash: authority.methodology.methodologyProfileArtifactHash,
          executionProjectionHash: partitionPlan.executionProjectionHash,
          taskDagHash: partitionPlan.taskDagHash,
          partitionPolicyHash: partitionPlan.partitionPolicyHash,
          partitionPolicyArtifactHash: authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
          partitionAnalysisReceiptHash: partitionPlan.partitionPlanHash,
          sequenceMode: partitionPlan.sequenceMode,
          sequenceApplicability: partitionPlan.sequenceApplicability,
          sequenceCoverage: partitionPlan.sequenceCoverage,
          sequenceClosureStatus: partitionPlan.sequenceClosureStatus,
          childContractAuthority: partitionPlan.childContractAuthority,
        },
        generatedAt: '1970-01-01T00:00:00.000Z',
      });
      const rendered = renderGoalContract({
        templateText,
        profile,
        slotData,
        validateHashes: true,
        generationMode: 'partition_selected_scope',
      });
      const embeddedFrontMatter = slotData.frontMatter.trim();
      if (!rendered.document.includes(`\n${embeddedFrontMatter}\n`)) {
        throw partitionFailure('partition_child_front_matter_projection_missing', {
          partitionId: childProjectionInput.partitionId,
        });
      }
      const childContractBytes =
        `${embeddedFrontMatter}\n\n` +
        rendered.document.replace(`\n${embeddedFrontMatter}\n`, '\n');
      const commandPortabilityAudit = auditCommandPortability({
        content: childContractBytes,
        targetPath: childContractPath,
        shell: 'pwsh',
      });
      const issues = rendererIssues(rendered.audit);
      if (
        coverageAudit.decision !== 'pass' ||
        implementationProofAudit.decision !== 'pass' ||
        issues.length > 0 ||
        commandPortabilityAudit.status !== 'PASS'
      ) {
        throw partitionFailure(
          commandPortabilityAudit.status === 'PASS'
            ? 'deterministic_preflight_failed'
            : 'command_portability_failed',
          {
            partitionId: childProjectionInput.partitionId,
            rendererAudit: rendered.audit,
            commandPortabilityAudit,
            coverageAudit,
            implementationProofAudit,
          }
        );
      }
      renderEvidence.push({
        partitionId: childProjectionInput.partitionId,
        displayOrdinal,
        childContractPath,
        coverageReceiptPath,
        generationReceiptPath,
        rendererAudit: {
          ...rendered.audit,
          contentHash: sha256Text(childContractBytes),
        },
        deterministicPreflight: {
          decision: 'pass',
          checks: [
            {
              id: 'renderer_structure',
              decision: 'pass',
            },
            {
              id: 'partition_selected_coverage',
              decision: 'pass',
            },
            {
              id: 'command_portability',
              decision: 'pass',
            },
          ],
        },
        commandPortabilityAudit,
        coverageAudit,
        implementationProofAudit,
      });
      return {
        childContractPath,
        childContractBytes,
      };
    },
  });
  const prepared = prepareAuthoritySupersession({
    repositoryRoot: process.cwd(),
    attemptId: requireSupersessionArg(args, '--attempt-id'),
    supersessionMode: take(args, '--supersession-mode', 'strict_equivalence'),
    supersededAuthority: {
      parentPlanPath: sourcePath,
      parentPlanHash: requireSupersessionArg(args, '--superseded-parent-hash'),
      partitionManifestPath: path.resolve(requireSupersessionArg(args, '--superseded-manifest')),
      partitionManifestHash: requireSupersessionArg(args, '--superseded-manifest-hash'),
      partitionSetHash: requireSupersessionArg(args, '--superseded-partition-set-hash'),
      childrenSummaryPath: path.resolve(requireSupersessionArg(args, '--children-summary')),
      childrenSummaryHash: requireSupersessionArg(args, '--children-summary-hash'),
    },
    successorAuthority: {
      partitionPlan,
      partitionPlanBytes: authority.partitionPlanBytes,
      executionProjectionBundle: projected,
      successorSelectionManifest: authority.compiled.manifest,
      compilerIdentityHash: currentPartitionCompilerIdentityHash(),
      sourceIdentity: {
        sourcePath: normalize(sourcePath),
        sourceHash: sha256FileBytes(sourcePath),
        sourceSnapshotHash: authority.snapshot.aggregateHash,
      },
      releaseContext: {
        methodologyProfileArtifactHash: authority.methodology.methodologyProfileArtifactHash,
        partitionPolicyArtifactHash: authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
        sequenceApplicabilityReceipt: authority.boundaryContext.sequenceApplicabilityReceipt,
        renderEvidence,
      },
    },
    checkpointPaths: takeAll(args, '--checkpoint').map((value) => path.resolve(value)),
  });
  const staged = stageAuthoritySupersessionAttempt({
    prepared,
    finalRoot,
    additionalArtifacts: [
      {
        relativePath: 'receipts/render-evidence.json',
        bytes: `${stableStringify({
          schemaVersion: 'goal-contract-authority-supersession-render-evidence/v1',
          renderEvidence,
        })}\n`,
      },
    ],
  });
  const promoted = promoteAuthoritySupersessionAttempt({ staged });
  const finalManifestPath = path.join(finalRoot, 'partition-manifest.json');
  const finalManifest = JSON.parse(fs.readFileSync(finalManifestPath, 'utf8'));
  return Object.freeze({
    ok: true,
    schemaVersion: 'goal-contract-authority-supersession-command-receipt/v1',
    authorityMode: 'raw_non_authoritative',
    rawContainmentRoot: normalize(finalRoot),
    attemptId: prepared.attemptId,
    attemptKey: prepared.attemptKey,
    supersessionMode: prepared.supersessionMode,
    activationMode: prepared.activationMode,
    sourceCoverageAuthority: prepared.sourceCoverageAuthority,
    supersededDisposition: prepared.supersededDisposition,
    authorityRoot: normalize(finalRoot),
    authoritySupersessionReceiptPath: normalize(
      path.join(finalRoot, 'authority-supersession.receipt.json')
    ),
    authoritySupersessionReceiptHash: promoted.receiptHash,
    partitionPlanPath: normalize(path.join(finalRoot, 'partition-plan.json')),
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionManifestPath: normalize(finalManifestPath),
    partitionManifestHash: projected.partitionManifestHash,
    partitionManifestDocumentHash: projected.partitionManifestDocumentHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    partitionCount: finalManifest.partitionCount,
    orderedChildContractHashes: projected.orderedChildContractHashes,
    partitionMappings: prepared.partitionMappings,
    checkpointMappings: prepared.checkpointMappings,
    equivalence: prepared.equivalence,
    sourceGroundedCoverage: prepared.sourceGroundedCoverage,
    atomicPromotion: true,
    idempotent: promoted.idempotent,
    modelInvocationCounters: {
      criticalAuditor: 0,
      reviewer: 0,
      auditor: 0,
      judgeSemanticAttempt: 0,
    },
  });
}

async function partition(args) {
  if (has(args, '--governed')) {
    return governedPartition(args);
  }
  const requestedOut = take(args, '--out');
  if (!requestedOut) {
    throw partitionFailure('partition_output_missing');
  }
  const { resolveRawPartitionOutputPaths } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-output-paths'
  );
  const rawOutput = resolveRawPartitionOutputPaths({
    repositoryRoot: process.cwd(),
    outPath: requestedOut,
    outRoot: take(args, '--out-root', null),
    receiptsDir: take(args, '--receipts-dir', null),
  });
  const authority = await compilePartitionAuthority(args);
  const { projection, compiled } = authority;
  const { stagePartitionSolution } = loadPartitionModule(
    'utils/goal-contract/partition-manifest'
  );
  const { buildGlobalPartitionCoverageReceipt, selectPartitionScope } = loadPartitionModule(
    'utils/goal-contract/partition-selector'
  );
  const { finalizePartitionRun } = loadPartitionModule('utils/goal-contract/partition-receipts');
  const receiptsDir = rawOutput.receiptsDir;
  const activeManifestPath = rawOutput.outputPath;
  const partitionPlanPath = path.join(path.resolve(receiptsDir), 'partition-plan.json');
  fs.mkdirSync(path.dirname(partitionPlanPath), { recursive: true });
  fs.writeFileSync(partitionPlanPath, authority.partitionPlanBytes, 'utf8');
  const partitionPlanDocumentHash = sha256Text(authority.partitionPlanBytes);
  const { writeSequenceApplicabilityReceipt } = loadPartitionModule(
    'utils/goal-contract/partition-receipts'
  );
  const sequenceApplicabilityEvidence = writeSequenceApplicabilityReceipt({
    applicabilityReceipt: authority.boundaryContext.sequenceApplicabilityReceipt,
    receiptsDir,
  });
  const staged = stagePartitionSolution({
    compiled,
    receiptsDir,
    activeManifestPath,
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
    activeManifestPath,
  });
  if (finalized.activeManifestHash !== staged.partitionManifestHash) {
    throw partitionFailure('partition_manifest_changed_during_finalization');
  }
  return Object.freeze({
    ok: true,
    schemaVersion: 'goal-contract-partition-command-receipt/v1',
    authorityMode: rawOutput.authorityMode,
    rawContainmentRoot: normalize(rawOutput.containmentRoot),
    runId: finalized.runId,
    partitionPlanPath: normalize(partitionPlanPath),
    partitionPlanHash: authority.partitionPlanHash,
    partitionPlanDocumentHash,
    partitionManifestPath: finalized.activeManifestPath,
    partitionManifestHash: finalized.activeManifestHash,
    executionProjectionHash: projection.executionProjectionHash,
    partitionCount: finalized.manifest.partitionCount,
    partitionSetHash: finalized.manifest.partitionSetHash,
    partitionPlanPartitionSetHash: authority.partitionPlan.partitionSetHash,
    sourceCompositionPolicyHash: authority.partitionPlan.sourceCompositionPolicyHash,
    globalCoverageDecision: globalCoverage.decision,
    selectionReceiptCount: selections.length,
    sequenceMode: authority.boundaryContext.sequenceMode,
    sequenceApplicability: authority.boundaryContext.sequenceApplicability,
    sequenceCoverage: authority.boundaryContext.sequenceCoverage,
    sequenceClosureStatus: authority.boundaryContext.sequenceClosureStatus,
    childContractAuthority: authority.boundaryContext.childContractAuthority,
    sequenceApplicabilityReceipt: sequenceApplicabilityEvidence.payload,
    sequenceApplicabilityReceiptPath: sequenceApplicabilityEvidence.path,
    sequenceApplicabilityReceiptHash: sequenceApplicabilityEvidence.receiptHash,
    semanticDerivationMode: authority.boundaryContext.semanticDerivationMode,
    semanticProviderCallCount: authority.boundaryContext.semanticProviderCallCount,
  });
}

async function governedPartition(args) {
  const goalContractPath = take(args, '--goal-contract');
  if (
    !goalContractPath ||
    !fs.existsSync(path.resolve(goalContractPath))
  ) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract', {
      requiredPath: goalContractPath
        ? normalize(goalContractPath)
        : null,
    });
  }
  const rawOutputFlags = ['--out', '--out-root', '--receipts-dir'].filter(
    (flag) => has(args, flag)
  );
  if (rawOutputFlags.length > 0) {
    throw partitionFailure('partition_governed_raw_output_override_rejected', {
      forbidden: rawOutputFlags,
    });
  }
  const requirementRecordPath = take(args, '--requirement-record', null);
  const authorityRootOverride = take(args, '--authority-root', null);
  const sourcePath = requireExistingSource(args);
  const frozen = readFrozenSuccessorAuthority({
    goalContractPath,
    sourcePath,
  });
  const assets = goalContractRendererAssets();
  const canonicalSourceAuthority = compileFrozenSuccessorSourceAuthority({
    frozen,
    assets,
  });
  const coreAuthority = await compilePartitionAuthority(args, {
    canonicalSourceAuthority,
  });
  const { compilePartitionImpactAuthority } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-compiler'
  );
  const partitionImpactAuthority =
    compilePartitionImpactAuthority({
      repositoryRoot: process.cwd(),
      packageRoot: PARTITION_ASSET_ROOT,
      partitionPlan: coreAuthority.partitionPlan,
      reconciledGraph:
        coreAuthority.reconciledGraphAuthority,
    });
  const authority = Object.freeze({
    ...coreAuthority,
    partitionPlan: partitionImpactAuthority.partitionPlan,
    partitionPlanBytes:
      partitionImpactAuthority.partitionPlanBytes,
    partitionPlanHash:
      partitionImpactAuthority.partitionPlanHash,
    partitionImpactAuthority,
  });
  if (
    frozen.generationReceipt.sourceCompositionPolicyHash &&
    frozen.generationReceipt.sourceCompositionPolicyHash !==
      authority.partitionPlan.sourceCompositionPolicyHash
  ) {
    throw partitionFailure('blocked_by_frozen_successor_goal_contract');
  }
  const {
    computePartitionGenerationKey,
    resolveCanonicalPartitionOutputPaths,
    writeImmutableAuthorityFile,
    assertImmutableAuthorityUnit,
    activateStandalonePartitionGeneration,
  } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-output-paths'
  );
  const generationInput = {
    sourceHash: frozen.sourceHash,
    templateHash: sha256Text(assets.templateBytes),
    profileHash: sha256Text(assets.profileBytes),
    compilerIdentityHash: currentPartitionCompilerIdentityHash(),
    methodologyProfileHash: authority.methodology.methodologyProfileHash,
    partitionPolicyHash: authority.optimizerPolicyBinding.partitionPolicyHash,
    sourceCompositionPolicyHash:
      authority.partitionPlan.sourceCompositionPolicyHash,
  };
  const generationKey = computePartitionGenerationKey(generationInput);
  const { projectExecutionArtifacts } = loadPartitionModule(
    'utils/goal-contract/control-plane/partition-compiler'
  );
  const {
    buildPartitionPlanGlobalCoverageReceipt,
    buildPartitionPlanSelectionReceipt,
  } = loadPartitionModule('utils/goal-contract/partition-selector');
  let requirementRecord = null;
  let resolvedRequirementRecordPath = null;
  if (requirementRecordPath) {
    resolvedRequirementRecordPath = path.resolve(
      requirementRecordPath
    );
    try {
      requirementRecord = JSON.parse(
        fs.readFileSync(resolvedRequirementRecordPath, 'utf8')
      );
    } catch {
      throw partitionFailure('partition_authority_record_invalid', {
        recordPath: normalize(resolvedRequirementRecordPath),
      });
    }
  }
  let output = requirementRecord
    ? null
    : resolveCanonicalPartitionOutputPaths({
        repositoryRoot: process.cwd(),
        ...generationInput,
        ...(authorityRootOverride
          ? { authorityRootOverride }
          : {}),
      });
  const repositoryRelativeUnitRoot = output
    ? path
        .relative(process.cwd(), output.unitRoot)
        .replace(/\\/gu, '/')
    : null;
  const renderEvidence = [];
  const projection = projectExecutionArtifacts({
    partitionPlan: authority.partitionPlan,
    displayTitles: projectFunctionalPartitionTitles(authority),
    partitionAnalysisReceipt:
      authority.compiled.analysisReceipt,
    partitionImpactAuthority,
    artifactLayout: 'authority_unit',
    renderChildContract: createPartitionChildRenderer({
      authority,
      sourcePath,
      assets,
      renderEvidence,
      repositoryRelativeUnitRoot,
    }),
  });
  output =
    output ||
    resolveCanonicalPartitionOutputPaths({
      repositoryRoot: process.cwd(),
      ...generationInput,
      requirementSetId: requirementRecord.requirementSetId,
      partitionRunId: projection.partitionManifest.partitionRunId,
      ...(authorityRootOverride
        ? { authorityRootOverride }
        : {}),
    });
  const globalCoverage = buildPartitionPlanGlobalCoverageReceipt({
    partitionPlan: authority.partitionPlan,
    candidateManifest: projection.partitionManifest,
  });
  if (globalCoverage.decision !== 'pass') {
    throw partitionFailure('partition_global_coverage_blocked', {
      blockingReasons: globalCoverage.blockingReasons,
    });
  }
  const selections = projection.partitionManifest.partitions.map(
    (partition) =>
      buildPartitionPlanSelectionReceipt({
        partitionPlan: authority.partitionPlan,
        partitionManifest: projection.partitionManifest,
        partitionId: partition.partitionId,
      })
  );
  const {
    buildPartitionChildCoverageReceipt,
    buildPartitionChildGenerationReceipt,
  } = loadPartitionModule('utils/goal-contract/goal-contract-receipts');
  const {
    readValidatedPartitionReceipt,
    serializeValidatedPartitionReceipt,
  } = loadPartitionModule('utils/goal-contract/partition-receipts');
  const pendingReceiptArtifacts = [];
  const finalReceiptArtifacts = [];
  const requiredReceiptPaths = [];
  const receiptBytes = (schemaId, payload) =>
    schemaId
      ? serializeValidatedPartitionReceipt({ schemaId, payload })
      : `${stableStringify(payload)}\n`;
  const queueReceipt = (
    target,
    payload,
    schemaId = null,
    phase = 'pending'
  ) => {
    const artifact = Object.freeze({
      relativePath: target,
      bytes: receiptBytes(schemaId, payload),
      schemaId,
    });
    (phase === 'pending'
      ? pendingReceiptArtifacts
      : finalReceiptArtifacts
    ).push(artifact);
    requiredReceiptPaths.push(target);
    return artifact;
  };
  const queueReceiptBytes = (
    target,
    bytes,
    phase = 'pending'
  ) => {
    const artifact = Object.freeze({
      relativePath: target,
      bytes,
      schemaId: null,
    });
    (phase === 'pending'
      ? pendingReceiptArtifacts
      : finalReceiptArtifacts
    ).push(artifact);
    requiredReceiptPaths.push(target);
    return artifact;
  };
  queueReceiptBytes(
    projection.partitionManifest.partitionAnalysisReceiptPath,
    projection.analysisReceiptBytes
  );
  queueReceiptBytes(
    projection.partitionManifest.partitionImpactGraphPath,
    partitionImpactAuthority.impactGraphBytes
  );
  queueReceiptBytes(
    projection.partitionManifest
      .partitionClosureFeasibilityReceiptPath,
    partitionImpactAuthority.closureFeasibilityBytes
  );
  queueReceiptBytes(
    projection.partitionManifest.partitionImpactDriftReceiptPath,
    partitionImpactAuthority.impactDriftBytes
  );
  const globalCoverageArtifact = queueReceipt(
    'receipts/global-coverage.receipt.json',
    globalCoverage,
    'goal-contract-partition-global-coverage-receipt/v1'
  );
  const selectionArtifacts = new Map();
  for (const selection of selections) {
    selectionArtifacts.set(
      selection.partitionId,
      queueReceipt(
      `receipts/partitions/${selection.partitionId}/selection.receipt.json`,
        selection,
        'goal-contract-partition-selection-receipt/v1'
      )
    );
  }
  for (const child of projection.childCompilationReceipts) {
    const { childContractBytes: _childContractBytes, ...pendingReceipt } = child;
    queueReceipt(
      `receipts/children/${child.partitionId}.compilation.json`,
      pendingReceipt
    );
  }
  const renderEvidenceByPartitionId = new Map(
    renderEvidence.map((evidence) => [evidence.partitionId, evidence])
  );
  for (const child of projection.childCompilationReceipts) {
    const evidence = renderEvidenceByPartitionId.get(child.partitionId);
    const selectionArtifact = selectionArtifacts.get(child.partitionId);
    if (!evidence || !selectionArtifact) {
      throw partitionFailure('partition_child_receipt_input_missing', {
        partitionId: child.partitionId,
      });
    }
    const coverageReceiptPath =
      `receipts/children/${child.partitionId}.coverage.json`;
    const coverage = buildPartitionChildCoverageReceipt({
      partitionId: child.partitionId,
      partitionManifestHash: projection.partitionManifestDocumentHash,
      selectionReceiptHash: sha256Text(selectionArtifact.bytes),
      globalCoverageReceiptHash: sha256Text(globalCoverageArtifact.bytes),
      selectedPrimaryObligationIds: evidence.selectedPrimaryObligationIds,
      inheritedConstraintIds: evidence.inheritedConstraintIds,
      excludedObligationIds: evidence.excludedObligationIds,
      unmappedSelectedObligations: evidence.coverageAudit.unmappedSourceObligations,
      orphanGeneratedTaskIds: evidence.orphanGeneratedTaskIds,
      orphanGeneratedAcceptanceIds: evidence.orphanGeneratedAcceptanceIds,
    });
    const coverageArtifact = queueReceipt(
      coverageReceiptPath,
      coverage,
      'goal-contract-partition-child-coverage-receipt/v1',
      'final'
    );
    const generation = buildPartitionChildGenerationReceipt({
      masterSourcePath: projection.partitionManifest.masterSourcePath,
      masterSourceHash: projection.partitionManifest.masterSourceHash,
      sourceSnapshotHash: projection.partitionManifest.sourceSnapshotHash,
      methodologyProfileHash:
        projection.partitionManifest.methodologyProfileHash,
      methodologyProfileArtifactHash:
        authority.methodology.methodologyProfileArtifactHash,
      executionProjectionHash:
        projection.partitionManifest.executionProjectionHash,
      taskDagHash: projection.partitionManifest.taskDagHash,
      sequenceMode: projection.partitionManifest.sequenceMode,
      sequenceApplicability:
        projection.partitionManifest.sequenceApplicability,
      sequenceCoverage: projection.partitionManifest.sequenceCoverage,
      sequenceClosureStatus:
        projection.partitionManifest.sequenceClosureStatus,
      childContractAuthority:
        projection.partitionManifest.childContractAuthority,
      partitionPolicyHash: projection.partitionManifest.partitionPolicyHash,
      partitionPolicyArtifactHash:
        authority.optimizerPolicyBinding.partitionPolicyArtifactHash,
      partitionManifestPath: 'partition-manifest.json',
      partitionManifestHash: projection.partitionManifestDocumentHash,
      partitionAnalysisReceiptHash:
        projection.partitionManifest.partitionAnalysisReceiptHash,
      partitionImpactGraphHash:
        projection.partitionManifest.partitionImpactGraphHash,
      partitionClosureFeasibilityHash:
        projection.partitionManifest.partitions.find(
          (partition) =>
            partition.partitionId === child.partitionId
        ).partitionClosureFeasibilityHash,
      driftHash: projection.partitionManifest.driftHash,
      partitionSetHash: projection.partitionManifest.partitionSetHash,
      partitionId: child.partitionId,
      partitionRole: evidence.partitionRole,
      selectionReceiptPath: projection.partitionManifest.partitions.find(
        (partition) => partition.partitionId === child.partitionId
      ).selectionReceiptPath,
      selectionReceiptHash: sha256Text(selectionArtifact.bytes),
      selectionSetHash: child.selectionHash,
      globalCoverageReceiptPath:
        projection.partitionManifest.globalCoverageReceiptPath,
      globalCoverageReceiptHash: sha256Text(globalCoverageArtifact.bytes),
      goalContractPath: child.childContractPath,
      goalContractHash: child.childContractHash,
      coverageReceiptPath,
      coverageReceiptHash: sha256Text(coverageArtifact.bytes),
      selectedAtomicTaskCount: evidence.selectedAtomicTaskCount,
      inheritedConstraintCount: evidence.inheritedConstraintCount,
      rendererAudit: evidence.rendererAudit,
      deterministicPreflight: evidence.deterministicPreflight,
      commandPortabilityAudit: evidence.commandPortabilityAudit,
      writeReceipt: { finalHash: child.childContractHash },
    });
    if (coverage.decision !== 'pass' || generation.decision !== 'pass') {
      throw partitionFailure('partition_child_generation_blocked', {
        partitionId: child.partitionId,
        coverage,
        generation,
      });
    }
    queueReceipt(
      `receipts/children/${child.partitionId}.generation.json`,
      generation,
      'goal-contract-partition-child-generation-receipt/v1',
      'final'
    );
  }
  for (const membership of projection.childMembershipReceipts) {
    queueReceipt(
      `receipts/children/${membership.partitionId}.membership.json`,
      membership,
      null,
      'final'
    );
  }
  const renderEvidenceArtifact = Object.freeze({
    relativePath: 'evidence/render-evidence.json',
    bytes: `${stableStringify({
      schemaVersion: 'goal-contract-partition-render-evidence/v1',
      sourceHash: frozen.sourceHash,
      generationKey,
      partitionPlanHash: authority.partitionPlanHash,
      partitionManifestHash: projection.partitionManifestHash,
      partitionManifestDocumentHash:
        projection.partitionManifestDocumentHash,
      renderEvidence,
    })}\n`,
  });
  const lifecycleArtifact = Object.freeze({
    relativePath: 'lifecycle/activation-state.json',
    bytes: `${stableStringify({
      schemaVersion: 'goal-contract-partition-lifecycle-state/v1',
      state: 'validated_pending_execution',
      generationKey,
      partitionManifestHash: projection.partitionManifestHash,
    })}\n`,
  });
  const expectedArtifacts = [
    {
      relativePath: 'partition-plan.json',
      bytes: authority.partitionPlanBytes,
    },
    ...projection.childCompilationReceipts.map((child) => ({
      relativePath: authorityUnitChildArtifactPath(
        output,
        child.childContractPath
      ),
      bytes: child.childContractBytes,
    })),
    ...pendingReceiptArtifacts,
    {
      relativePath: 'partition-manifest.json',
      bytes: projection.partitionManifestBytes,
    },
    ...finalReceiptArtifacts,
    renderEvidenceArtifact,
    lifecycleArtifact,
  ];
  assertImmutableAuthorityUnit({
    authority: output,
    expectedArtifacts,
  });
  for (const artifact of expectedArtifacts) {
    writeImmutableAuthorityFile({
      authority: output,
      targetPath: path.join(output.unitRoot, artifact.relativePath),
      bytes: artifact.bytes,
    });
  }
  for (const artifact of [
    ...pendingReceiptArtifacts,
    ...finalReceiptArtifacts,
  ]) {
    if (artifact.schemaId) {
      readValidatedPartitionReceipt(
        path.join(output.unitRoot, artifact.relativePath),
        artifact.schemaId
      );
    }
  }
  let activePointerPath;
  let activePointerHash;
  if (output.authorityMode === 'requirement_record') {
    const {
      commitRequirementRecordPartitionAuthoritySupersession,
    } = loadPartitionModule(
      'utils/goal-contract/control-plane/authority-supersession'
    );
    const committed =
      commitRequirementRecordPartitionAuthoritySupersession({
        repositoryRoot: process.cwd(),
        recordPath: resolvedRequirementRecordPath,
        sourceHash: frozen.sourceHash,
        partitionRunId: output.partitionRunId,
        authorityRoot: output.authorityRoot,
        partitionPlanHash: authority.partitionPlanHash,
        partitionManifestHash: projection.partitionManifestHash,
        partitionManifestDocumentHash:
          projection.partitionManifestDocumentHash,
        partitionSetHash: projection.partitionManifest.partitionSetHash,
        eventChainProjection: sha256Text(
          stableStringify({
            requirementSetId: output.requirementSetId,
            sourceHash: frozen.sourceHash,
            partitionRunId: output.partitionRunId,
            partitionManifestHash: projection.partitionManifestHash,
            partitionManifestDocumentHash:
              projection.partitionManifestDocumentHash,
          })
        ),
      });
    activePointerPath = normalize(committed.pointer.pointerPath);
    activePointerHash = committed.pointer.pointerProjectionHash;
  } else {
    const activated = activateStandalonePartitionGeneration({
      authority: output,
      partitionPlanBytes: authority.partitionPlanBytes,
      partitionManifestBytes: projection.partitionManifestBytes,
      partitionManifestHash: projection.partitionManifestHash,
      partitionManifestDocumentHash:
        projection.partitionManifestDocumentHash,
      childContractPaths: projection.childCompilationReceipts.map(
        ({ childContractPath }) => childContractPath
      ),
      requiredReceiptPaths,
    });
    activePointerPath = activated.pointerPath;
    activePointerHash = activated.pointerHash;
  }
  return Object.freeze({
    ok: true,
    schemaVersion: 'goal-contract-governed-partition-command-receipt/v1',
    authorityMode: output.authorityMode,
    sourceHash: frozen.sourceHash,
    generationKey,
    authorityRoot: normalize(output.authorityRoot),
    unitRoot: normalize(output.unitRoot),
    activePointerPath,
    activePointerHash,
    partitionPlanPath: normalize(output.partitionPlanPath),
    partitionPlanHash: authority.partitionPlanHash,
    partitionManifestPath: normalize(output.partitionManifestPath),
    partitionManifestHash: projection.partitionManifestHash,
    partitionManifestDocumentHash: projection.partitionManifestDocumentHash,
    partitionManifest: projection.partitionManifest,
    orderedChildContractHashes: projection.orderedChildContractHashes,
    childReceiptCount: projection.childCompilationReceipts.length,
    globalCoverageDecision: globalCoverage.decision,
  });
}

async function goalContractCommand(_opts: { json?: boolean } = {}, forwardedArgs: string[] = []) {
  const args = [...forwardedArgs];
  const subcommand = args.shift();
  const json = has(args, '--json') || _opts.json;
  try {
    if (subcommand === 'release-gate') {
      const { goalContractReleaseGateCommand, parseGoalContractBinding } = loadPartitionModule(
        'utils/goal-contract/release-gate'
      );
      const goalPath = take(args, '--goal');
      const binding = parseGoalContractBinding(goalPath);
      let partitionAuthority = null;
      if (binding.mode === 'partition') {
        const manifestPath = path.resolve(
          take(args, '--partition-manifest') || binding.fields.partitionManifestPath || ''
        );
        let manifest = null;
        if (fs.existsSync(manifestPath)) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          } catch {
            throw partitionFailure('partition_manifest_invalid_json');
          }
        }
        const successorBound =
          manifest?.schemaVersion === 'goal-contract-partition-manifest/v2' &&
          manifest?.manifestAuthorityMode === 'final_child_membership';
        if (successorBound) {
          const inferredAuthorityRoot = path.dirname(manifestPath);
          const explicitAuthorityRoot = take(args, '--authority-root');
          if (
            explicitAuthorityRoot &&
            path.resolve(explicitAuthorityRoot) !== inferredAuthorityRoot
          ) {
            throw partitionFailure('successor_authority_root_mismatch');
          }
          const supersessionMarkers = [
            'bundle-manifest.json',
            'authority-supersession.receipt.json',
            'release-authority.json',
            'receipts/sequence-applicability.receipt.json',
          ];
          if (
            supersessionMarkers.some((relativePath) =>
              fs.existsSync(
                path.join(inferredAuthorityRoot, relativePath)
              )
            )
          ) {
            const { loadAuthoritySupersessionForRelease } =
              loadPartitionModule(
                'utils/goal-contract/control-plane/authority-supersession'
              );
            partitionAuthority = loadAuthoritySupersessionForRelease({
              authorityRoot: inferredAuthorityRoot,
              partitionManifestPath: manifestPath,
              goalPath,
              expectedPartitionPlanHash:
                binding.fields.partitionPlanHash,
            });
          } else {
            const { loadCanonicalPartitionAuthorityForRelease } =
              loadPartitionModule(
                'utils/goal-contract/control-plane/partition-output-paths'
              );
            partitionAuthority =
              loadCanonicalPartitionAuthorityForRelease({
                partitionManifestPath: manifestPath,
                goalPath,
                expectedPartitionPlanHash:
                  binding.fields.partitionPlanHash,
              });
          }
        } else {
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
          partitionAuthority = await compilePartitionAuthority(authorityArgs);
        }
      }
      return await goalContractReleaseGateCommand(_opts, args, {
        partitionAuthority,
      });
    }
    if (!['generate', 'partition', 'supersede-authority'].includes(subcommand)) {
      throw Object.assign(
        new Error(
          'Usage: bmad-speckit goal-contract <generate|partition|supersede-authority> --entry standalone_goal_contract --source <plan.md> --out <artifact> [--sequence-mode auto|required|disabled] --json'
        ),
        {
          failureClass: 'invalid_subcommand',
        }
      );
    }
    const result =
      subcommand === 'partition'
        ? await partition(args)
        : subcommand === 'supersede-authority'
          ? await supersedeAuthority(args)
          : await generate(args);
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
      ...(error.mismatchedFields
        ? { mismatchedFields: error.mismatchedFields }
        : {}),
      ...(error.reason ? { reason: error.reason } : {}),
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
            sequenceApplicabilityReceiptPath: error.sequenceApplicabilityReceiptPath,
          }
        : {}),
      ...(error.sequenceApplicabilityReceiptHash
        ? {
            sequenceApplicabilityReceiptHash: error.sequenceApplicabilityReceiptHash,
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
      ...(error.stagedManifestPath ? { stagedManifestPath: error.stagedManifestPath } : {}),
      ...(error.partitionManifestHash
        ? { partitionManifestHash: error.partitionManifestHash }
        : {}),
      ...(Number.isInteger(error.partitionCount) ? { partitionCount: error.partitionCount } : {}),
      ...(error.selectedCandidateId ? { selectedCandidateId: error.selectedCandidateId } : {}),
      ...(typeof error.activeManifestWritten === 'boolean'
        ? { activeManifestWritten: error.activeManifestWritten }
        : {}),
      ...(error.staleFields ? { staleFields: error.staleFields } : {}),
      ...(error.mismatchedFields ? { mismatchedFields: error.mismatchedFields } : {}),
      ...(error.invalidFields ? { invalidFields: error.invalidFields } : {}),
      ...(error.validationErrors ? { validationErrors: error.validationErrors } : {}),
      ...(error.field ? { field: error.field } : {}),
      ...(error.reason ? { reason: error.reason } : {}),
      ...(typeof error.value === 'string' ? { value: error.value } : {}),
      ...(typeof error.relativePath === 'string'
        ? { relativePath: error.relativePath }
        : {}),
      ...(typeof error.sourcePath === 'string'
        ? { sourcePath: error.sourcePath }
        : {}),
      ...(typeof error.path === 'string' ? { path: error.path } : {}),
      ...(typeof error.artifactPath === 'string'
        ? { artifactPath: error.artifactPath }
        : {}),
      ...(typeof error.artifactId === 'string'
        ? { artifactId: error.artifactId }
        : {}),
      ...(Number.isInteger(error.line) ? { line: error.line } : {}),
      ...(typeof error.limit === 'string' ? { limit: error.limit } : {}),
      ...(error.expected ? { expected: error.expected } : {}),
      ...(error.actual ? { actual: error.actual } : {}),
    });
    if (json) emitJson(payload);
    else console.error(payload.message);
    return 1;
  }
}

module.exports = {
  compileTypedCommandRecord,
  currentPartitionCompilerIdentityHash,
  generate,
  goalContractCommand,
  partition,
  partitionCompilerIdentityAssetPaths,
  selectCommandStructuredBindings,
  supersedeAuthority,
};
