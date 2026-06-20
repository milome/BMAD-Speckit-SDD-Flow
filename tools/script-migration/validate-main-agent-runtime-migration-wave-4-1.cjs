#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  EXPECTED_HASHES,
  FINAL_EVIDENCE_PACKET_PATH,
  INSTALL_MATRIX_DIR,
  LEDGER_PATH,
  OWNER_EXPECTED_COUNTS,
  PACKAGE_SOURCE_PARITY_EVIDENCE_PATH,
  ROOT,
  SUMMARY_PATH,
  WAVE_ID,
  formatJson,
  loadLedger,
  normalizePath,
  repoPath,
  sha256File,
  sourceHashReport,
  summarizeLedger,
} = require('./main-agent-wave-4-1-utils.cjs');

const VALID_PHASES = new Set([
  'preflight',
  'ledger',
  'owner',
  'no-fallback',
  'registry',
  'parity',
  'install-matrix',
  'rework',
  'final',
]);

function parseArgs(argv) {
  const args = { phase: 'final', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--phase') args.phase = argv[++index];
    else if (arg === '--owner') args.owner = argv[++index];
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!VALID_PHASES.has(args.phase)) throw new Error(`unknown phase: ${args.phase}`);
  return args;
}

function passOutput(extra) {
  return {
    ok: true,
    status: 'passed',
    waveId: WAVE_ID,
    reworkRequired: false,
    ...extra,
  };
}

function failOutput(extra) {
  return {
    ok: false,
    status: 'failed',
    waveId: WAVE_ID,
    reworkRequired: true,
    ...extra,
  };
}

function assertSourceHashes() {
  const hashes = sourceHashReport();
  const mismatches = Object.entries(hashes)
    .filter(([, result]) => !result.ok)
    .map(([filePath, result]) => ({ filePath, ...result }));
  return { hashes, mismatches };
}

function readLedgerOrFailure() {
  try {
    return { ledger: loadLedger() };
  } catch (error) {
    return {
      failure: failOutput({
        failureClass: 'missing_migration_ledger',
        ledgerPath: LEDGER_PATH,
        error: error.message,
      }),
    };
  }
}

function buildStrictCompletionGatePreview(summary, noFallback = null, acceptanceResultCoverageGapCount = 38) {
  const dynamicFallbackHitCount = noFallback ? noFallback.dynamicFallbackHitCount || 0 : 0;
  const fallbackHitCount = noFallback ? noFallback.forbiddenHitCount || 0 : 0;
  const noFallbackScanCoverageRows = noFallback ? noFallback.scanCoverageRows || 0 : 0;
  const checks = {
    missingPackageImplementationSetCount: summary.missingPackageImplementationSetCount,
    invalidPackageImplementationPathCount: summary.invalidPackageImplementationPathCount,
    sourceAuthorityPathGapCount: summary.sourceAuthorityPathGapCount,
    runtimeReplayPathGapCount: summary.runtimeReplayPathGapCount,
    distOutputPathGapCount: summary.distOutputPathGapCount,
    missingBehaviorEquivalenceMatrixCount: summary.missingBehaviorEquivalenceMatrixCount,
    behaviorEquivalenceMatrixScenarioFieldGapCount: summary.behaviorEquivalenceMatrixScenarioFieldGapCount,
    behaviorEquivalenceMatrixScenarioCoverageGapCount: summary.behaviorEquivalenceMatrixScenarioCoverageGapCount,
    missingBehaviorEquivalenceReplayProofCount: summary.missingBehaviorEquivalenceReplayProofCount,
    behaviorEquivalenceReplayFailureCount: summary.behaviorEquivalenceReplayFailureCount,
    scenarioCoverageGapCount: summary.scenarioCoverageGapCount,
    expectedOutputProvenanceGapCount: summary.expectedOutputProvenanceGapCount,
    packageObservedExpectedOutputCount: summary.packageObservedExpectedOutputCount,
    firstGenerationProofGapCount: summary.firstGenerationProofGapCount,
    matrixOwnerCompletionTimingGapCount: summary.matrixOwnerCompletionTimingGapCount,
    semanticSizePaddingViolationCount: summary.semanticSizePaddingViolationCount,
    sizeDeltaProofGapCount: summary.sizeDeltaProofGapCount,
    sourceKindParityViolationCount: summary.sourceKindParityViolationCount,
    g009AggregationProofGapCount: summary.g009AggregationProofGapCount,
    g009AggregationHashMismatchCount: summary.g009AggregationHashMismatchCount,
    semanticZeroSizeMetricCount: summary.semanticZeroSizeMetricCount,
    semanticSizeDeltaViolationCount: summary.semanticSizeDeltaViolationCount,
    semanticSizeComputationMismatchCount: summary.semanticSizeComputationMismatchCount,
    sizeDeltaThresholdShapeGapCount: summary.sizeDeltaThresholdShapeGapCount,
    zeroSizeMetricCount: summary.zeroSizeMetricCount,
    sizeDeltaViolationCount: summary.sizeDeltaViolationCount,
    sizeDeltaComputationMismatchCount: summary.sizeDeltaComputationMismatchCount,
    settledEquivalenceBypassCount: summary.settledEquivalenceBypassCount,
    dynamicFallbackHitCount,
    fallbackHitCount,
    noFallbackScanCoverageRows,
    acceptanceResultCoverageGapCount,
  };
  const allStrictCompletionGatesPass =
    summary.ledgerRowCount === 240 &&
    summary.all240RowsHaveValidPackageImplementationSet &&
    summary.distOutputPathGapCount === 0 &&
    summary.all240RowsHaveBehaviorEquivalenceMatrix &&
    summary.allBehaviorEquivalenceMatrixScenariosHaveRequiredFields &&
    summary.behaviorEquivalenceMatrixScenarioCoverageGapCount === 0 &&
    summary.all240RowsHaveBehaviorEquivalenceReplayProof &&
    summary.all240RowsMatrixGeneratedByOwnerTask &&
    summary.all240RowsMatchDeterministicOwnerAssignment &&
    summary.matrixFirstGeneratedByG009Count === 0 &&
    summary.matrixOwnerCompletionTimingGapCount === 0 &&
    summary.behaviorEquivalenceReplayFailureCount === 0 &&
    summary.all240RowsHaveFullScenarioCoverage &&
    summary.expectedOutputProvenanceGapCount === 0 &&
    summary.packageObservedExpectedOutputCount === 0 &&
    summary.firstGenerationProofGapCount === 0 &&
    summary.semanticSizePaddingViolationCount === 0 &&
    summary.sizeDeltaProofGapCount === 0 &&
    summary.sourceKindParityViolationCount === 0 &&
    summary.g009AggregationProofGapCount === 0 &&
    summary.g009AggregationHashMismatchCount === 0 &&
    summary.semanticZeroSizeMetricCount === 0 &&
    summary.semanticSizeDeltaViolationCount === 0 &&
    summary.semanticSizeComputationMismatchCount === 0 &&
    summary.settledEquivalenceBypassCount === 0 &&
    summary.all240RowsHaveSizeDeltaDecision &&
    summary.sizeDeltaThresholdShapeGapCount === 0 &&
    summary.zeroSizeMetricCount === 0 &&
    summary.sizeDeltaViolationCount === 0 &&
    summary.sizeDeltaComputationMismatchCount === 0 &&
    acceptanceResultCoverageGapCount === 0 &&
    (!noFallback || (noFallback.ok && noFallback.scanCoverageRows === 240 && noFallback.forbiddenHitCount === 0));
  return {
    allStrictCompletionGatesPass,
    reworkRequired: !allStrictCompletionGatesPass,
    ...checks,
  };
}

function validatePreflight() {
  const sourceHashCheck = assertSourceHashes();
  if (sourceHashCheck.mismatches.length > 0) {
    return failOutput({
      failureClass: 'source_hash_mismatch',
      sourceHashCheck,
    });
  }
  const { ledger, failure } = readLedgerOrFailure();
  if (failure) return failure;
  const entries = ledger.entries || [];
  const summary = summarizeLedger(entries);
  const ownerCountsExpected = OWNER_EXPECTED_COUNTS;
  const pass =
    summary.ledgerRowCount === 240 &&
    summary.backlog_migration === 206 &&
    summary.settled_revalidation === 34 &&
    summary.noUnmappedInventoryRows &&
    summary.requiredLedgerFieldsPresent &&
    summary.ownerAssignmentMismatchCount === 0 &&
    summary.missingOwnerAssignmentRuleCount === 0 &&
    summary.unexpectedOwnerAssignmentCount === 0 &&
    summary.ownerAssignmentRowCount === 240 &&
    summary.ownerCountsMatch;

  const output = {
    phase: 'preflight',
    ledgerPath: LEDGER_PATH,
    validationScopeOriginalPathCount: summary.ledgerRowCount,
    ownerCountsExpected,
    strictCompletionGatePreview: buildStrictCompletionGatePreview(summary),
    sourceHashCheck,
    ...summary,
  };
  return pass ? passOutput(output) : failOutput({ failureClass: 'preflight_ledger_contract_gap', ...output });
}

function validateOwner(owner) {
  if (!owner || !Object.prototype.hasOwnProperty.call(OWNER_EXPECTED_COUNTS, owner)) {
    return failOutput({
      phase: 'owner',
      failureClass: 'invalid_owner_scope',
      owner,
      allowedOwners: Object.keys(OWNER_EXPECTED_COUNTS),
    });
  }
  const preflight = validatePreflight();
  if (!preflight.ok) return preflight;
  const { ledger } = readLedgerOrFailure();
  const rows = (ledger.entries || []).filter((entry) => entry.matrixOwnerTaskId === owner);
  const summary = summarizeLedger(rows);
  const pass =
    rows.length === OWNER_EXPECTED_COUNTS[owner] &&
    summary.ownerAssignmentMismatchCount === 0 &&
    summary.all240RowsHaveValidPackageImplementationSet &&
    summary.distOutputPathGapCount === 0 &&
    summary.all240RowsHaveBehaviorEquivalenceMatrix &&
    summary.allBehaviorEquivalenceMatrixScenariosHaveRequiredFields &&
    summary.behaviorEquivalenceMatrixScenarioCoverageGapCount === 0 &&
    summary.all240RowsHaveFullScenarioCoverage &&
    summary.all240RowsHaveBehaviorEquivalenceReplayProof &&
    summary.expectedOutputProvenanceGapCount === 0 &&
    summary.packageObservedExpectedOutputCount === 0 &&
    summary.firstGenerationProofGapCount === 0 &&
    summary.matrixOwnerCompletionTimingGapCount === 0 &&
    summary.semanticSizePaddingViolationCount === 0 &&
    summary.sizeDeltaProofGapCount === 0 &&
    summary.sourceKindParityViolationCount === 0 &&
    summary.semanticZeroSizeMetricCount === 0 &&
    summary.semanticSizeDeltaViolationCount === 0 &&
    summary.semanticSizeComputationMismatchCount === 0 &&
    summary.sizeDeltaViolationCount === 0 &&
    summary.sizeDeltaComputationMismatchCount === 0 &&
    summary.sizeDeltaThresholdShapeGapCount === 0;

  const output = {
    phase: 'owner',
    owner,
    ownerRowCount: rows.length,
    expectedOwnerRowCount: OWNER_EXPECTED_COUNTS[owner],
    ownerRowsPassed: pass,
    ownerRowsHaveBehaviorEquivalenceMatrix: summary.all240RowsHaveBehaviorEquivalenceMatrix,
    ownerRowsHaveRequiredBehaviorEquivalenceMatrixScenarioFields:
      summary.allBehaviorEquivalenceMatrixScenariosHaveRequiredFields,
    ownerRowsHaveFullScenarioCoverage: summary.all240RowsHaveFullScenarioCoverage,
    ownerRowsHaveStrictSizeDelta:
      summary.zeroSizeMetricCount === 0 &&
      summary.sizeDeltaViolationCount === 0 &&
      summary.sizeDeltaComputationMismatchCount === 0 &&
      summary.semanticZeroSizeMetricCount === 0 &&
      summary.semanticSizeDeltaViolationCount === 0 &&
      summary.semanticSizeComputationMismatchCount === 0 &&
      summary.semanticSizePaddingViolationCount === 0 &&
      summary.sizeDeltaProofGapCount === 0 &&
      summary.sourceKindParityViolationCount === 0 &&
      summary.sizeDeltaThresholdShapeGapCount === 0,
    ownerRowsHaveReplayFailureCount: summary.behaviorEquivalenceReplayFailureCount,
    packageObservedExpectedOutputCount: summary.packageObservedExpectedOutputCount,
    firstGenerationProofGapCount: summary.firstGenerationProofGapCount,
    semanticSizePaddingViolationCount: summary.semanticSizePaddingViolationCount,
    semanticSizeDeltaViolationCount: summary.semanticSizeDeltaViolationCount,
    dynamicFallbackHitCount: 0,
    settledEquivalenceBypassCount: summary.settledEquivalenceBypassCount,
    ...summary,
  };
  return pass ? passOutput(output) : failOutput({ failureClass: 'owner_scope_rework_required', ...output });
}

function listFiles(rootRelative, predicate) {
  const root = repoPath(rootRelative);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
    } else if (predicate(current)) {
      out.push(normalizePath(path.relative(ROOT, current)));
    }
  }
  return out.sort();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pushNoFallbackHit(hits, seen, filePath, originalPath, hitKind) {
  const key = `${filePath}\u0000${originalPath}\u0000${hitKind}`;
  if (seen.has(key)) return;
  seen.add(key);
  hits.push({ filePath, originalPath, hitKind });
}

function stripRuntimeComments(content, filePath) {
  if (!/\.(?:js|cjs|mjs|ts|tsx)$/iu.test(filePath)) return content;
  return String(content)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

function hasRootScriptPathToken(content, originalPath) {
  const normalizedOriginalPath = normalizePath(originalPath);
  const absoluteOriginalPath = normalizePath(repoPath(normalizedOriginalPath));
  const escapedOriginalPath = escapeRegExp(normalizedOriginalPath);
  const tokenPattern = new RegExp(
    `(?:^|[\\s"'({\\[=,:])(?:\\.\\/|(?:\\.\\.\\/)*)?${escapedOriginalPath}(?=$|[\\s"')}\\],;])`,
    'u'
  );
  return tokenPattern.test(content) || content.includes(absoluteOriginalPath);
}

function hasRootScriptsAndBasename(content, basename) {
  const escapedBasename = escapeRegExp(basename);
  return new RegExp(`(?:^|[^/\\w-])scripts/[^\\n"')]*${escapedBasename}`, 'u').test(content);
}

function isSourceAuthorityRuntimeMirror(filePath) {
  return normalizePath(filePath).includes('/source-authority/');
}

function isGeneratedHookBundle(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized === '.cursor/hooks/emit-runtime-policy.cjs' ||
    normalized === '.cursor/hooks/render-audit-block.cjs' ||
    normalized === '.cursor/hooks/resolve-for-session.cjs' ||
    normalized === '.claude/hooks/emit-runtime-policy.cjs' ||
    normalized === '.claude/hooks/render-audit-block.cjs' ||
    normalized === '.claude/hooks/resolve-for-session.cjs' ||
    normalized.endsWith('/.cursor/hooks/emit-runtime-policy.cjs') ||
    normalized.endsWith('/.cursor/hooks/render-audit-block.cjs') ||
    normalized.endsWith('/.cursor/hooks/resolve-for-session.cjs') ||
    normalized.endsWith('/.claude/hooks/emit-runtime-policy.cjs') ||
    normalized.endsWith('/.claude/hooks/render-audit-block.cjs') ||
    normalized.endsWith('/.claude/hooks/resolve-for-session.cjs')
  );
}

function packageRuntimeReportFactoryHasSourceAuthorityReplay() {
  const filePath = repoPath('packages/bmad-speckit/src/main-agent/actions/package-runtime-report.js');
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('sourceAuthorityRuntimeProof') &&
    content.includes('replaySourceAuthorityRuntime') &&
    content.includes('spawnSync(process.execPath')
  );
}

function durableHelperFactoryHasSourceAuthorityLoadProof() {
  const filePath = repoPath('packages/bmad-speckit/src/main-agent/helpers/durable-helper-report.js');
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    content.includes('sourceAuthorityRuntimeProof') &&
    content.includes('loadSourceAuthorityHelper') &&
    content.includes('require(runtimePath)')
  );
}

function isNoFallbackScannableFile(filePath) {
  const normalized = normalizePath(filePath);
  if (normalized.endsWith('/package.json')) return true;
  if (normalized.startsWith(`${INSTALL_MATRIX_DIR}/`) && normalized.endsWith('.json')) return true;
  if (normalized.includes('/assets/') || normalized.endsWith('.min.js')) return false;
  return /\.(?:js|cjs|mjs|ts|tsx)$/i.test(normalized);
}

function validateNoFallback() {
  const preflight = validatePreflight();
  if (!preflight.ok) return preflight;
  const { ledger } = readLedgerOrFailure();
  const originalPaths = (ledger.entries || []).map((entry) => entry.originalPath);
  const scanRoots = [
    'packages/bmad-speckit/src',
    'packages/bmad-speckit/dist',
    'packages/bmad-speckit/bin',
    'packages/bmad-speckit/scripts',
    'packages/bmad-speckit/package.json',
    '_bmad/codex',
    '.codex',
    '.cursor',
    '.claude',
    INSTALL_MATRIX_DIR,
  ];
  const files = scanRoots.flatMap((root) =>
    listFiles(root, (filePath) => isNoFallbackScannableFile(normalizePath(path.relative(ROOT, filePath))))
  );
  const hits = [];
  const compiledFallbackHits = [];
  const reportOnlySourceHits = [];
  const descriptorOnlyHelperHits = [];
  const seenHits = new Set();
  const packageRuntimeReportFactoryIsFunctional = packageRuntimeReportFactoryHasSourceAuthorityReplay();
  const durableHelperFactoryIsFunctional = durableHelperFactoryHasSourceAuthorityLoadProof();
  for (const filePath of files) {
    const content = fs.readFileSync(repoPath(filePath), 'utf8');
    const runtimeContent = stripRuntimeComments(content, filePath);
    const normalizedContent = normalizePath(runtimeContent);
    const compactContent = normalizedContent.replace(/['"`\s+]/gu, '');
    const broadPathTextScanAllowed =
      !isSourceAuthorityRuntimeMirror(filePath) && !isGeneratedHookBundle(filePath);
    if (
      /(^|\/)compiled\/main-agent-orchestration\.cjs$/u.test(filePath) ||
      content.includes('compiled/main-agent-orchestration.cjs') ||
      content.includes("compiled', 'main-agent-orchestration.cjs") ||
      content.includes('compiledOrchestrationModule')
    ) {
      compiledFallbackHits.push({ filePath, hitKind: 'compiled_fallback' });
    }
    if (
      !packageRuntimeReportFactoryIsFunctional &&
      !filePath.endsWith('actions/package-runtime-report.js') &&
      (content.includes("require('./package-runtime-report')") ||
        content.includes('createPackageRuntimeReportAction({'))
    ) {
      reportOnlySourceHits.push({ filePath, hitKind: 'report_only_package_runtime_action' });
    }
    if (
      !durableHelperFactoryIsFunctional &&
      !filePath.endsWith('helpers/durable-helper-report.js') &&
      (content.includes("require('./durable-helper-report')") ||
        content.includes('createDurableHelperDescriptor({'))
    ) {
      descriptorOnlyHelperHits.push({ filePath, hitKind: 'descriptor_only_durable_helper' });
    }
    if (
      !normalizedContent.includes('scripts/') &&
      !/\b(?:tsx|ts-node)\b/u.test(content) &&
      !normalizedContent.includes('compiled/main-agent-orchestration.cjs')
    ) {
      continue;
    }
    for (const originalPath of originalPaths) {
      const basename = path.basename(originalPath);
      const escapedBasename = escapeRegExp(basename);
      const hasScriptsAndBasename = hasRootScriptsAndBasename(normalizedContent, basename);
      if (broadPathTextScanAllowed && hasRootScriptPathToken(normalizedContent, originalPath)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'direct_original_path');
      }
      if (broadPathTextScanAllowed && hasScriptsAndBasename) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'possible_dynamic_script_path');
      }
      if (broadPathTextScanAllowed && compactContent.includes(originalPath)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'split_string_path');
      }
      if (
        broadPathTextScanAllowed &&
        new RegExp(`path\\.(?:join|resolve)\\([^)]*['"\`]scripts['"\`][^)]*['"\`]${escapedBasename}['"\`]`, 'u').test(content)
      ) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'path_join_script_path');
      }
      if (broadPathTextScanAllowed && content.includes('`') && content.includes('${') && hasScriptsAndBasename) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'template_literal_script_path');
      }
      if (broadPathTextScanAllowed && /\b(?:glob|fastGlob|globby|tinyglobby)\b/u.test(content) && hasScriptsAndBasename) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'glob_script_selection');
      }
      if (filePath.endsWith('package.json') && (hasScriptsAndBasename || /\b(?:tsx|ts-node)\b/u.test(content))) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'package_script_indirection');
      }
      if (new RegExp(`\\bimport\\b[^\\n;]*scripts/[^\\n;]*${escapedBasename}`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'import_original_path');
      }
      if (new RegExp(`\\brequire\\s*\\([^)]*scripts/[^)]*${escapedBasename}`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'require_original_path');
      }
      if (new RegExp(`\\bspawn\\s*\\([^)]*(?:scripts/[^)]*${escapedBasename}|tsx|ts-node)`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'spawn_original_path');
      }
      if (new RegExp(`\\bexec\\s*\\([^)]*(?:scripts/[^)]*${escapedBasename}|tsx|ts-node)`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'exec_original_path');
      }
      if (new RegExp(`\\bexecFile\\s*\\([^)]*(?:scripts/[^)]*${escapedBasename}|tsx|ts-node)`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'exec_file_original_path');
      }
      if (new RegExp(`\\bfork\\s*\\([^)]*scripts/[^)]*${escapedBasename}`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'fork_original_path');
      }
      if (
        broadPathTextScanAllowed &&
        new RegExp(`\\b(?:shell|command)\\b[^\\n]*(?:scripts/[^\\n]*${escapedBasename}|tsx|ts-node)`, 'u').test(normalizedContent)
      ) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'shell_dispatch_original_path');
      }
      if (new RegExp(`\\breadFile(?:Sync)?\\s*\\([^)]*scripts/[^)]*${escapedBasename}`, 'u').test(normalizedContent)) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'runtime_file_read_original_path');
      }
      if (broadPathTextScanAllowed && /\btsx\b/u.test(content) && hasScriptsAndBasename) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'tsx_original_path');
      }
      if (broadPathTextScanAllowed && /\bts-node\b/u.test(content) && hasScriptsAndBasename) {
        pushNoFallbackHit(hits, seenHits, filePath, originalPath, 'ts_node_original_path');
      }
    }
  }
  const output = {
    phase: 'no-fallback',
    scannedOriginalPathCount: originalPaths.length,
    scanCoverageRows: originalPaths.length,
    scanRoots,
    scannedFileCount: files.length,
    forbiddenHitCount:
      hits.length + compiledFallbackHits.length + reportOnlySourceHits.length + descriptorOnlyHelperHits.length,
    rootScriptDispatchHitCount: hits.length,
    dynamicFallbackHitCount: hits.filter((hit) => hit.hitKind === 'possible_dynamic_script_path').length,
    splitStringPathHitCount: hits.filter((hit) => hit.hitKind === 'split_string_path').length,
    pathJoinHitCount: hits.filter((hit) => hit.hitKind === 'path_join_script_path').length,
    templateLiteralPathHitCount: hits.filter((hit) => hit.hitKind === 'template_literal_script_path').length,
    globScriptSelectionHitCount: hits.filter((hit) => hit.hitKind === 'glob_script_selection').length,
    packageScriptIndirectionHitCount: hits.filter((hit) => hit.hitKind === 'package_script_indirection').length,
    importHitCount: hits.filter((hit) => hit.hitKind === 'import_original_path').length,
    requireHitCount: hits.filter((hit) => hit.hitKind === 'require_original_path').length,
    spawnHitCount: hits.filter((hit) => hit.hitKind === 'spawn_original_path').length,
    execHitCount: hits.filter((hit) => hit.hitKind === 'exec_original_path').length,
    execFileHitCount: hits.filter((hit) => hit.hitKind === 'exec_file_original_path').length,
    forkHitCount: hits.filter((hit) => hit.hitKind === 'fork_original_path').length,
    shellDispatchHitCount: hits.filter((hit) => hit.hitKind === 'shell_dispatch_original_path').length,
    runtimeFileReadHitCount: hits.filter((hit) => hit.hitKind === 'runtime_file_read_original_path').length,
    tsxHitCount: hits.filter((hit) => hit.hitKind === 'tsx_original_path').length,
    tsNodeHitCount: hits.filter((hit) => hit.hitKind === 'ts_node_original_path').length,
    compiledFallbackHitCount: compiledFallbackHits.length,
    reportOnlySourceHitCount: reportOnlySourceHits.length,
    descriptorOnlyHelperHitCount: descriptorOnlyHelperHits.length,
    sampleHits: hits.slice(0, 20),
    sampleCompiledFallbackHits: compiledFallbackHits.slice(0, 20),
    sampleReportOnlySourceHits: reportOnlySourceHits.slice(0, 20),
    sampleDescriptorOnlyHelperHits: descriptorOnlyHelperHits.slice(0, 20),
  };
  return output.forbiddenHitCount === 0
    ? passOutput(output)
    : failOutput({ failureClass: 'fallback_hit', ...output });
}

function validateInstallMatrix() {
  const requiredModes = ['no-save', 'save-dev', 'npx-package', 'init-sync-consumer'];
  const records = requiredModes.map((mode) => {
    const relativePath = `${INSTALL_MATRIX_DIR}/${mode}.json`;
    const absolute = repoPath(relativePath);
    if (!fs.existsSync(absolute)) return { mode, path: relativePath, exists: false };
    const record = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    return { mode, path: relativePath, exists: true, record };
  });
  const pass = records.every(
    (item) =>
      item.exists &&
      item.record.status === 'passed' &&
      item.record.rootScriptDependencyCount === 0 &&
      item.record.usedRootScript === false &&
      item.record.usedTsx === false &&
      item.record.usedTsNode === false &&
      item.record.usedCompiledFallback === false
  );
  return pass
    ? passOutput({ phase: 'install-matrix', records })
    : failOutput({ phase: 'install-matrix', failureClass: 'install_matrix_incomplete', records });
}

function expectedAcceptanceIds() {
  return Array.from({ length: 38 }, (_, index) => `ACC${String(index + 1).padStart(3, '0')}`);
}

function readJsonArtifact(relativePath, errors) {
  const absolute = repoPath(relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`${relativePath} missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath} invalid JSON: ${error.message}`);
    return null;
  }
}

function validateCloseoutArtifacts(entries, summary) {
  const errors = [];
  const parity = readJsonArtifact(PACKAGE_SOURCE_PARITY_EVIDENCE_PATH, errors);
  if (parity) {
    if (parity.rowCount !== 240) errors.push('package-source-parity-evidence rowCount must be 240');
    if (!Array.isArray(parity.entries) || parity.entries.length !== 240) {
      errors.push('package-source-parity-evidence entries length must be 240');
    } else {
      const ledgerPaths = new Set(entries.map((entry) => entry.originalPath));
      const parityPaths = new Set(parity.entries.map((entry) => entry.originalPath));
      if (parityPaths.size !== 240) errors.push('package-source-parity-evidence originalPath set must be 240 unique rows');
      for (const originalPath of ledgerPaths) {
        if (!parityPaths.has(originalPath)) errors.push(`package-source-parity-evidence missing ${originalPath}`);
      }
      for (const entry of parity.entries) {
        if (!Array.isArray(entry.packageImplementationSet) || entry.packageImplementationSet.length === 0) {
          errors.push(`package-source-parity-evidence missing packageImplementationSet for ${entry.originalPath}`);
          break;
        }
        if (!Array.isArray(entry.runtimeReplayPaths) || entry.runtimeReplayPaths.length === 0) {
          errors.push(`package-source-parity-evidence missing runtimeReplayPaths for ${entry.originalPath}`);
          break;
        }
        if (entry.sizeDeltaDecision !== 'passed_within_strict_threshold') {
          errors.push(`package-source-parity-evidence sizeDeltaDecision gap for ${entry.originalPath}`);
          break;
        }
      }
    }
    if (parity.summary?.all240RowsHavePackageImplementationSet !== true) {
      errors.push('package-source-parity-evidence summary must prove all240RowsHavePackageImplementationSet=true');
    }
    if (parity.summary?.sourceKindParityViolationCount !== 0) {
      errors.push('package-source-parity-evidence summary sourceKindParityViolationCount must be 0');
    }
  }

  const packet = readJsonArtifact(FINAL_EVIDENCE_PACKET_PATH, errors);
  if (packet) {
    const acceptanceIds = expectedAcceptanceIds();
    const results = Array.isArray(packet.acceptanceResults) ? packet.acceptanceResults : [];
    const resultIds = new Set(results.map((result) => result.id));
    if (results.length !== 38) errors.push('final-evidence-packet acceptanceResults length must be 38');
    for (const id of acceptanceIds) {
      const result = results.find((item) => item.id === id);
      if (!result) errors.push(`final-evidence-packet missing ${id}`);
      else if (result.status !== 'pass') errors.push(`final-evidence-packet ${id} must be pass`);
      else if (!Array.isArray(result.evidenceIds) || result.evidenceIds.length === 0) {
        errors.push(`final-evidence-packet ${id} must have evidenceIds`);
      }
    }
    for (const id of resultIds) {
      if (!acceptanceIds.includes(id)) errors.push(`final-evidence-packet unexpected acceptance id ${id}`);
    }
    if (packet.packageImplementationSetSummary?.all240RowsHavePackageImplementationSet !== true) {
      errors.push('final-evidence-packet packageImplementationSetSummary missing all240RowsHavePackageImplementationSet=true');
    }
    if (packet.packageImplementationSetSummary?.invalidPackageImplementationPathCount !== 0) {
      errors.push('final-evidence-packet invalidPackageImplementationPathCount must be 0');
    }
    if (packet.behaviorEquivalenceSummary?.matrixRowCount !== 240) {
      errors.push('final-evidence-packet behaviorEquivalenceSummary matrixRowCount must be 240');
    }
    if (packet.behaviorEquivalenceSummary?.matrixScenarioCount < 240) {
      errors.push('final-evidence-packet matrixScenarioCount must be at least 240');
    }
    if (packet.behaviorEquivalenceSummary?.behaviorEquivalenceReplayFailureCount !== 0) {
      errors.push('final-evidence-packet behaviorEquivalenceReplayFailureCount must be 0');
    }
    if (packet.behaviorEquivalenceSummary?.matrixFirstGeneratedByG009Count !== 0) {
      errors.push('final-evidence-packet matrixFirstGeneratedByG009Count must be 0');
    }
    if (packet.distCompilationSummary?.checkedTypeScriptFamilySourcePathCount !== 197) {
      errors.push('final-evidence-packet must count all 197 TypeScript-family source authority paths');
    }
    if (packet.distCompilationSummary?.checkedTypeScriptRuntimeSourcePathCount !== 196) {
      errors.push('final-evidence-packet must count all 196 runtime TypeScript source authority paths');
    }
    if (packet.distCompilationSummary?.checkedTypeScriptDeclarationSourcePathCount !== 1) {
      errors.push('final-evidence-packet must count the 1 TypeScript declaration source authority path');
    }
    if (packet.distCompilationSummary?.allTypeScriptRuntimeSourceAuthorityPathsHaveDistJs !== true) {
      errors.push('final-evidence-packet must prove all runtime TypeScript source authority paths compile to dist JS');
    }
    if (packet.distCompilationSummary?.allTypeScriptDeclarationSourceAuthorityPathsHaveDistDeclarations !== true) {
      errors.push('final-evidence-packet must prove all TypeScript declaration source authority paths copy to dist declarations');
    }
    if (packet.distCompilationSummary?.allTypeScriptSourceAuthorityPathsHaveDistProof !== true) {
      errors.push('final-evidence-packet must prove all TypeScript-family source authority paths have dist proof');
    }
    if (packet.distCompilationSummary?.allTypeScriptSourceAuthorityPathsHaveDistJs !== true) {
      errors.push('final-evidence-packet must prove all runtime TypeScript source authority paths compile to dist JS');
    }
    const installModes = Array.isArray(packet.installMatrix?.modes) ? packet.installMatrix.modes : [];
    if (packet.installMatrix?.allModesPassed !== true || installModes.length !== 4) {
      errors.push('final-evidence-packet installMatrix must contain four passed modes');
    }
    for (const mode of ['no-save', 'save-dev', 'npx-package', 'init-sync-consumer']) {
      const record = installModes.find((item) => item.mode === mode);
      if (!record) errors.push(`final-evidence-packet installMatrix missing ${mode}`);
      else if (
        record.status !== 'passed' ||
        record.path !== `${INSTALL_MATRIX_DIR}/${mode}.json` ||
        record.hash !== sha256File(`${INSTALL_MATRIX_DIR}/${mode}.json`) ||
        record.usedRootScript !== false ||
        record.usedTsx !== false ||
        record.usedTsNode !== false ||
        record.usedCompiledFallback !== false ||
        record.rootScriptDependencyCount !== 0
      ) {
        errors.push(`final-evidence-packet installMatrix mode ${mode} is not strict current passed`);
      }
    }
    if (packet.noFallbackSummary?.forbiddenHitCount !== 0) {
      errors.push('final-evidence-packet noFallbackSummary forbiddenHitCount must be 0');
    }
    if (packet.reworkSummary?.reworkQueueLength !== 0) {
      errors.push('final-evidence-packet reworkSummary reworkQueueLength must be 0');
    }
    if (packet.residualRisks !== 'none') {
      errors.push('final-evidence-packet residualRisks must be none');
    }
    if (packet.sizeDeltaSummary?.sizeDeltaViolationCount !== 0) {
      errors.push('final-evidence-packet sizeDeltaViolationCount must be 0');
    }
  }

  const summaryPath = repoPath(SUMMARY_PATH);
  if (!fs.existsSync(summaryPath)) {
    errors.push(`${SUMMARY_PATH} missing`);
  } else {
    const text = fs.readFileSync(summaryPath, 'utf8');
    for (const marker of [
      'all240RowsPassed=true',
      'reworkQueueLength=0',
      'residualRisks=none',
      'fallbackHitCount=0',
      'installMatrixPassed=true',
      'installMatrixModeCount=4',
      'checkedTypeScriptFamilySourcePathCount=197',
      'checkedTypeScriptRuntimeSourcePathCount=196',
      'checkedTypeScriptDeclarationSourcePathCount=1',
      'allTypeScriptRuntimeSourceAuthorityPathsHaveDistJs=true',
      'allTypeScriptDeclarationSourceAuthorityPathsHaveDistDeclarations=true',
      'allTypeScriptSourceAuthorityPathsHaveDistProof=true',
      'allTypeScriptSourceAuthorityPathsHaveDistJs=true',
      'behaviorEquivalenceReplayFailureCount=0',
    ]) {
      if (!text.includes(marker)) errors.push(`summary.md missing ${marker}`);
    }
  }

  if (!summary.all240RowsHaveValidPackageImplementationSet) {
    errors.push('ledger summary does not have valid packageImplementationSet for all rows');
  }
  return {
    ok: errors.length === 0,
    errors,
    artifactPaths: {
      packageSourceParityEvidencePath: PACKAGE_SOURCE_PARITY_EVIDENCE_PATH,
      finalEvidencePacketPath: FINAL_EVIDENCE_PACKET_PATH,
      summaryPath: SUMMARY_PATH,
    },
  };
}

function validateFinal(options = {}) {
  const requireCloseoutArtifacts = options.requireCloseoutArtifacts !== false;
  const preflight = validatePreflight();
  if (!preflight.ok) return preflight;
  const noFallback = validateNoFallback();
  const installMatrix = validateInstallMatrix();
  const { ledger } = readLedgerOrFailure();
  const entries = ledger.entries || [];
  const summary = summarizeLedger(entries);
  const closeoutArtifacts = requireCloseoutArtifacts
    ? validateCloseoutArtifacts(entries, summary)
    : { ok: true, skipped: true, errors: [], artifactPaths: {} };
  const corePass =
    summary.ledgerRowCount === 240 &&
    summary.all240RowsHaveValidPackageImplementationSet &&
    summary.distOutputPathGapCount === 0 &&
    summary.all240RowsHaveBehaviorEquivalenceMatrix &&
    summary.allBehaviorEquivalenceMatrixScenariosHaveRequiredFields &&
    summary.behaviorEquivalenceMatrixScenarioCoverageGapCount === 0 &&
    summary.all240RowsHaveBehaviorEquivalenceReplayProof &&
    summary.all240RowsMatrixGeneratedByOwnerTask &&
    summary.all240RowsMatchDeterministicOwnerAssignment &&
    summary.matrixFirstGeneratedByG009Count === 0 &&
    summary.matrixOwnerCompletionTimingGapCount === 0 &&
    summary.behaviorEquivalenceReplayFailureCount === 0 &&
    summary.all240RowsHaveFullScenarioCoverage &&
    summary.scenarioCoverageGapCount === 0 &&
    summary.expectedOutputProvenanceGapCount === 0 &&
    summary.packageObservedExpectedOutputCount === 0 &&
    summary.firstGenerationProofGapCount === 0 &&
    summary.semanticSizePaddingViolationCount === 0 &&
    summary.sizeDeltaProofGapCount === 0 &&
    summary.sourceKindParityViolationCount === 0 &&
    summary.g009AggregationProofGapCount === 0 &&
    summary.g009AggregationHashMismatchCount === 0 &&
    summary.semanticZeroSizeMetricCount === 0 &&
    summary.semanticSizeDeltaViolationCount === 0 &&
    summary.semanticSizeComputationMismatchCount === 0 &&
    summary.settledEquivalenceBypassCount === 0 &&
    summary.all240RowsHaveSizeDeltaDecision &&
    summary.sizeDeltaThresholdShapeGapCount === 0 &&
    summary.zeroSizeMetricCount === 0 &&
    summary.sizeDeltaViolationCount === 0 &&
    summary.sizeDeltaComputationMismatchCount === 0 &&
    noFallback.ok &&
    installMatrix.ok;
  const pass = corePass && closeoutArtifacts.ok;
  const output = {
    phase: 'final',
    all240RowsPassed: pass,
    reworkQueueLength: pass ? 0 : 1,
    allAcceptancePassed: pass,
    residualRisks: pass ? 'none' : 'wave_4_1_strict_gates_incomplete',
    scannedOriginalPathCount: noFallback.scannedOriginalPathCount || 0,
    noFallbackScanCoverageRows: noFallback.scanCoverageRows || 0,
    fallbackHitCount: noFallback.forbiddenHitCount || 0,
    g009AggregationProofGapCount: summary.g009AggregationProofGapCount,
    g009AggregationHashMismatchCount: summary.g009AggregationHashMismatchCount,
    acceptanceResultsCount: pass ? 38 : 0,
    acceptanceResultCoverageGapCount: pass ? 0 : 38,
    dynamicFallbackHitCount: noFallback.dynamicFallbackHitCount || 0,
    installMatrixPassed: installMatrix.ok,
    installMatrixModeCount: installMatrix.records ? installMatrix.records.length : 0,
    installMatrixFailureClass: installMatrix.ok ? null : installMatrix.failureClass,
    closeoutArtifacts,
    strictCompletionGatePreview: buildStrictCompletionGatePreview(summary, noFallback, pass ? 0 : 38),
    ...summary,
  };
  return pass ? passOutput(output) : failOutput({ failureClass: 'final_strict_gates_incomplete', ...output });
}

function validatePhase(args) {
  if (args.phase === 'preflight' || args.phase === 'ledger' || args.phase === 'registry' || args.phase === 'parity') {
    return validatePreflight();
  }
  if (args.phase === 'owner') return validateOwner(args.owner);
  if (args.phase === 'no-fallback') return validateNoFallback();
  if (args.phase === 'install-matrix') return validateInstallMatrix();
  if (args.phase === 'rework') return failOutput({
    phase: 'rework',
    failureClass: 'rework_required',
    reworkQueueLength: 1,
    residualRisks: 'wave_4_1_strict_gates_incomplete',
  });
  return validateFinal();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = validatePhase(args);
  process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
  if (!output.ok) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  validateFinal,
  validateNoFallback,
  validateOwner,
  validatePhase,
  validatePreflight,
};
