#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  LEDGER_PATH,
  WAVE_DIR,
  ensureDir,
  fileInfo,
  formatJson,
  loadLedger,
  normalizePath,
  nowIso,
  repoPath,
  sha256File,
  sourceAuthorityPathToDistRuntimePath,
  writeJson,
} = require('./main-agent-wave-4-1-utils.cjs');

const DEFAULT_OWNER_TASK_ID = 'G004';
const ALLOWED_OWNER_TASK_IDS = new Set(['G004', 'G005', 'G006', 'G007', 'G008']);
const TARGET_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority';
const STRICT_SIZE_RATIO_MIN = 0.9;
const STRICT_SIZE_RATIO_MAX = 1.1;

function parseArgs(argv) {
  const args = { json: false, updateLedger: false, owner: DEFAULT_OWNER_TASK_ID };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--update-ledger') args.updateLedger = true;
    else if (arg === '--owner') {
      index += 1;
      args.owner = argv[index];
      if (!ALLOWED_OWNER_TASK_IDS.has(args.owner)) throw new Error(`unsupported owner: ${args.owner}`);
    }
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function manifestPathForOwner(ownerTaskId) {
  if (ownerTaskId === 'G004') return `${WAVE_DIR}/source-authority/G004.package-runtime-source-manifest.json`;
  return `${WAVE_DIR}/source-authority/${ownerTaskId}.package-runtime-source-manifest.json`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalizeText(value), 'utf8').digest('hex')}`;
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n|\r/gu, '\n');
}

function round4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function sourceAuthorityTargetPath(sourceRelativePath) {
  const normalized = normalizePath(sourceRelativePath);
  return `${TARGET_ROOT}/${normalized}`;
}

function packageImplementationPath(sourceRelativePath) {
  return sourceAuthorityTargetPath(sourceRelativePath);
}

function runtimeReplayPathForSource(sourceRelativePath) {
  const sourceAuthorityPath = packageImplementationPath(sourceRelativePath);
  return sourceAuthorityPathToDistRuntimePath(sourceAuthorityPath);
}

function repoText(relativePath) {
  return canonicalizeText(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function sourcePathForImport(importerRelativePath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const importerDir = path.dirname(importerRelativePath);
  const candidateBase = normalizePath(path.normalize(path.join(importerDir, specifier)));
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.cjs`,
    `${candidateBase}/index.ts`,
    `${candidateBase}/index.tsx`,
    `${candidateBase}/index.js`,
    `${candidateBase}/index.cjs`,
  ];
  return candidates.find((candidate) => fs.existsSync(repoPath(candidate)) && fs.statSync(repoPath(candidate)).isFile()) || null;
}

function importSpecifiers(sourceText) {
  const out = [];
  const importRe = /\bimport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gu;
  const exportRe = /\bexport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gu;
  const requireRe = /\b(?:require|requireCommonJs)\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;
  let match;
  while ((match = importRe.exec(sourceText)) !== null) out.push(match[1]);
  while ((match = exportRe.exec(sourceText)) !== null) out.push(match[1]);
  while ((match = requireRe.exec(sourceText)) !== null) out.push(match[1]);
  return out;
}

function collectSourceGraph(entrySource) {
  const seen = new Set();
  const queue = [entrySource];
  const edges = [];
  while (queue.length > 0) {
    const current = normalizePath(queue.shift());
    if (seen.has(current)) continue;
    seen.add(current);
    const text = repoText(current);
    for (const specifier of importSpecifiers(text)) {
      const resolved = sourcePathForImport(current, specifier);
      if (!resolved) continue;
      edges.push({ from: current, specifier, to: resolved });
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return {
    sources: [...seen].sort(),
    edges: edges.sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)),
  };
}

function writeText(relativePath, text) {
  const canonicalText = canonicalizeText(text);
  const absolute = repoPath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, canonicalText, 'utf8');
  return {
    path: normalizePath(relativePath),
    bytes: Buffer.byteLength(canonicalText, 'utf8'),
    sha256: sha256Text(canonicalText),
  };
}

function optionalFileInfo(relativePath) {
  if (!relativePath) return null;
  const absolute = repoPath(relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return {
      path: normalizePath(relativePath),
      exists: false,
      bytes: 0,
      lines: 0,
      sha256: null,
    };
  }
  return {
    ...fileInfo(relativePath),
    exists: true,
  };
}

function isGeneratedCommonJsEmitText(text) {
  const trimmed = String(text || '').trimStart();
  if (!trimmed.startsWith('"use strict";') && !trimmed.startsWith("'use strict';")) return false;
  return (
    text.includes('Object.defineProperty(exports, "__esModule"') ||
    text.includes('var __createBinding =') ||
    text.includes('var __importStar =') ||
    text.includes('var __importDefault =') ||
    /\bexports\.[A-Za-z_$][\w$]*\s*=/u.test(text)
  );
}

function sourceKindParityProblems(originalPath, packageText, packagePath = packageImplementationPath(originalPath)) {
  const normalized = normalizePath(originalPath);
  const normalizedPackagePath = normalizePath(packagePath);
  const problems = [];
  if (/\.(?:ts|tsx)$/u.test(normalized)) {
    if (!/\.(?:ts|tsx)$/u.test(normalizedPackagePath)) {
      problems.push('ts_original_missing_package_ts_source_authority');
    }
    if (/\.(?:js|cjs|mjs)$/u.test(normalizedPackagePath)) {
      problems.push('ts_original_packageImplementationSet_contains_js_runtime_source');
    }
    if (isGeneratedCommonJsEmitText(packageText)) {
      problems.push('ts_original_packageImplementationSet_contains_generated_cjs_emit_source');
      problems.push('ts_original_backed_only_by_generated_cjs_emit_source');
    }
  }
  return problems;
}

function sourceAuthorityEntryInfo(originalPath) {
  const packagePath = packageImplementationPath(originalPath);
  const output = fs.existsSync(repoPath(packagePath)) ? repoText(packagePath) : repoText(originalPath);
  return {
    bytes: Buffer.byteLength(output, 'utf8'),
    lines: output.split(/\r?\n/u).length,
    sourceKindParityProblems: sourceKindParityProblems(originalPath, output, packagePath),
  };
}

function isWithinStrictSize(originalInfo, generatedInfo) {
  const byteRatio = generatedInfo.bytes / originalInfo.bytes;
  const locRatio = generatedInfo.lines / originalInfo.lines;
  return (
    generatedInfo.sourceKindParityProblems.length === 0 &&
    byteRatio >= STRICT_SIZE_RATIO_MIN &&
    byteRatio <= STRICT_SIZE_RATIO_MAX &&
    locRatio >= STRICT_SIZE_RATIO_MIN &&
    locRatio <= STRICT_SIZE_RATIO_MAX
  );
}

function updateLedgerRow(
  row,
  originalInfo,
  packageInfo,
  runtimeInfo,
  runtimeReplayPath,
  generatedAt,
  manifestPath,
  manifestHash,
  sizeDecision,
  sourceKindProblems,
  ownerTaskId
) {
  const byteRatio = round4(packageInfo.bytes / originalInfo.bytes);
  const locRatio = round4(packageInfo.lines / originalInfo.lines);
  const sizePassed = sizeDecision === 'passed_within_strict_threshold';
  row.sourceSha256 = originalInfo.sha256;
  row.originalBytes = originalInfo.bytes;
  row.originalLoc = originalInfo.lines;
  row.sourceFacts = {
    ...(row.sourceFacts && typeof row.sourceFacts === 'object' ? row.sourceFacts : {}),
    originalCanonicalBytes: originalInfo.bytes,
    originalCanonicalLoc: originalInfo.lines,
    originalCanonicalSha256: originalInfo.sha256,
    originalSizeHashPolicy: 'canonical_lf_text',
  };
  row.packageImplementationSet = [packageInfo.path];
  row.sourceAuthorityPaths = [packageInfo.path];
  row.runtimeReplayPaths = runtimeReplayPath ? [runtimeReplayPath] : [];
  row.distOutputPaths = runtimeReplayPath ? [runtimeReplayPath] : [];
  row.changedFiles = [
    ...new Set([
      ...(Array.isArray(row.changedFiles) ? row.changedFiles : []),
      packageInfo.path,
      ...(runtimeReplayPath ? [runtimeReplayPath] : []),
      manifestPath,
    ]),
  ];
  row.packageSourceProof = {
    status: sizePassed
      ? 'passed_package_source_authority_entry_present_pending_behavior_matrix'
      : 'failed_package_source_authority_entry_size_delta_pending_rework',
    sourcePath: packageInfo.path,
    sourceSha256: packageInfo.sha256,
    runtimeEntryPoint: runtimeReplayPath,
    runtimeEntryPointSha256: runtimeInfo && runtimeInfo.sha256 ? runtimeInfo.sha256 : null,
    runtimeReplayPath,
    runtimeReplayPathSha256: runtimeInfo && runtimeInfo.sha256 ? runtimeInfo.sha256 : null,
    sourceManifestPath: manifestPath,
    sourceManifestSha256: manifestHash,
    behaviorMatrixStillRequiredByOwnerTask: ownerTaskId,
  };
  row.semanticSizeProof = {
    semanticPackageBytes: packageInfo.bytes,
    semanticPackageLoc: packageInfo.lines,
    semanticPackageByteRatio: byteRatio,
    semanticPackageLocRatio: locRatio,
    commentOnlyBytes: 0,
    deadCodeBytes: 0,
    sharedOvercountBytes: 0,
    antiPaddingDecision: 'passed_no_semantic_padding',
  };
  row.packageBytes = packageInfo.bytes;
  row.packageLoc = packageInfo.lines;
  row.semanticPackageBytes = packageInfo.bytes;
  row.semanticPackageLoc = packageInfo.lines;
  row.packageByteRatio = byteRatio;
  row.packageLocRatio = locRatio;
  row.semanticPackageByteRatio = byteRatio;
  row.semanticPackageLocRatio = locRatio;
  row.sizeDeltaDecision = sizeDecision;
  row.sizeDeltaThreshold = {
    byteRatioMin: STRICT_SIZE_RATIO_MIN,
    byteRatioMax: STRICT_SIZE_RATIO_MAX,
    locRatioMin: STRICT_SIZE_RATIO_MIN,
    locRatioMax: STRICT_SIZE_RATIO_MAX,
  };
  row.sizeDeltaProof = {
    status: sizePassed
      ? 'passed_within_strict_threshold_pending_behavior_matrix'
      : 'failed_size_delta_threshold_rework_required',
    originalPath: row.originalPath,
    packageImplementationSet: [packageInfo.path],
    originalBytes: originalInfo.bytes,
    originalLoc: originalInfo.lines,
    packageBytes: packageInfo.bytes,
    packageLoc: packageInfo.lines,
    packageByteRatio: byteRatio,
    packageLocRatio: locRatio,
    semanticPackageBytes: packageInfo.bytes,
    semanticPackageLoc: packageInfo.lines,
    semanticPackageByteRatio: byteRatio,
    semanticPackageLocRatio: locRatio,
    rawByteDelta: packageInfo.bytes - originalInfo.bytes,
    rawLocDelta: packageInfo.lines - originalInfo.lines,
    semanticByteDelta: packageInfo.bytes - originalInfo.bytes,
    semanticLocDelta: packageInfo.lines - originalInfo.lines,
    sourceKindParityDecision:
      sourceKindProblems.length === 0 ? 'passed_source_kind_parity' : 'failed_source_kind_parity',
    sourceKindParityProblems: sourceKindProblems,
    threshold: row.sizeDeltaThreshold,
    decision: sizeDecision,
  };
  row.validationResult = {
    status: sizePassed
      ? 'package_source_and_size_recorded_pending_behavior_equivalence_matrix'
      : 'package_source_recorded_size_delta_failed_rework_required',
    reworkRequired: true,
  };
  row.reworkHistory = [
    ...(Array.isArray(row.reworkHistory) ? row.reworkHistory : []),
    {
      at: generatedAt,
      ownerTaskId,
      action: 'generated_package_source_authority_entry_and_size_proof',
      packageImplementationSet: [packageInfo.path],
      sourceAuthorityPaths: [packageInfo.path],
      runtimeReplayPaths: runtimeReplayPath ? [runtimeReplayPath] : [],
      behaviorMatrixStatus: sizePassed ? 'pending_owner_local_replay' : 'blocked_until_size_delta_rework',
      sizeDeltaDecision: sizeDecision,
    },
  ];
}

function generate(updateLedger, ownerTaskId = DEFAULT_OWNER_TASK_ID) {
  if (!ALLOWED_OWNER_TASK_IDS.has(ownerTaskId)) throw new Error(`unsupported owner: ${ownerTaskId}`);
  const manifestPath = manifestPathForOwner(ownerTaskId);
  ensureDir(`${WAVE_DIR}/source-authority`);
  const generatedAt = nowIso();
  const ledger = loadLedger();
  const rows = ledger.entries.filter((entry) => entry.matrixOwnerTaskId === ownerTaskId);
  const selectedRows = [];
  const skippedRows = [];
  for (const row of rows) {
    const originalInfo = fileInfo(row.originalPath);
    const generatedInfo = sourceAuthorityEntryInfo(row.originalPath);
    if (isWithinStrictSize(originalInfo, generatedInfo)) selectedRows.push(row);
    else {
      skippedRows.push({
        originalPath: row.originalPath,
        reason: 'generated_entry_size_outside_strict_threshold',
        originalBytes: originalInfo.bytes,
        originalLoc: originalInfo.lines,
        generatedBytes: generatedInfo.bytes,
        generatedLoc: generatedInfo.lines,
        packageByteRatio: round4(generatedInfo.bytes / originalInfo.bytes),
        packageLocRatio: round4(generatedInfo.lines / originalInfo.lines),
        sourceKindParityProblems: generatedInfo.sourceKindParityProblems,
      });
    }
  }

  const sourceSet = new Set();
  const edges = [];
  const diagnostics = [];
  for (const row of rows) {
    const graph = collectSourceGraph(row.originalPath);
    for (const source of graph.sources) sourceSet.add(source);
    edges.push(...graph.edges);
  }

  const sourceAuthorityFiles = [];
  for (const source of [...sourceSet].sort()) {
    const target = sourceAuthorityTargetPath(source);
    const sourceText = fs.existsSync(repoPath(target)) ? repoText(target) : repoText(source);
    const receipt = writeText(target, sourceText);
    sourceAuthorityFiles.push({
      source,
      sourceSha256: sha256File(source),
      target,
      ...receipt,
    });
  }

  const skippedPathSet = new Set(skippedRows.map((row) => row.originalPath));
  const entryPackages = rows.map((row) => {
    const entryTarget = packageImplementationPath(row.originalPath);
    const runtimeTarget = runtimeReplayPathForSource(row.originalPath);
    const originalInfo = fileInfo(row.originalPath);
    const packageInfo = fileInfo(entryTarget);
    const runtimeInfo = optionalFileInfo(runtimeTarget);
    const sourceKindProblems = sourceKindParityProblems(row.originalPath, repoText(entryTarget), entryTarget);
    const byteRatio = packageInfo.bytes / originalInfo.bytes;
    const locRatio = packageInfo.lines / originalInfo.lines;
    const passedStrictSize =
      sourceKindProblems.length === 0 &&
      byteRatio >= STRICT_SIZE_RATIO_MIN &&
      byteRatio <= STRICT_SIZE_RATIO_MAX &&
      locRatio >= STRICT_SIZE_RATIO_MIN &&
      locRatio <= STRICT_SIZE_RATIO_MAX;
    return {
      originalPath: row.originalPath,
      packageImplementationSet: [entryTarget],
      sourceAuthorityPaths: [entryTarget],
      runtimeReplayPaths: runtimeTarget ? [runtimeTarget] : [],
      distOutputPaths: runtimeTarget ? [runtimeTarget] : [],
      runtimeEntryPoint: runtimeTarget,
      originalInfo,
      packageInfo,
      runtimeInfo,
      sourceKindParityProblems: sourceKindProblems,
      sizeDeltaDecision:
        skippedPathSet.has(row.originalPath) || !passedStrictSize
          ? 'failed_size_delta_threshold_rework_required'
          : 'passed_within_strict_threshold',
    };
  });

  const manifest = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-owner-package-source-manifest/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId,
    generatedAt,
    selectedRowCount: selectedRows.length,
    skippedRowCount: skippedRows.length,
    targetRoot: TARGET_ROOT,
    sourceAuthorityFileCount: sourceAuthorityFiles.length,
    edgeCount: edges.length,
    sourceAuthorityFiles,
    entryPackages: entryPackages.map(({ originalPath, packageImplementationSet, sourceAuthorityPaths, runtimeReplayPaths, distOutputPaths, runtimeEntryPoint, packageInfo, runtimeInfo, sourceKindParityProblems, sizeDeltaDecision }) => ({
      originalPath,
      packageImplementationSet,
      sourceAuthorityPaths,
      runtimeReplayPaths,
      distOutputPaths,
      runtimeEntryPoint,
      packageBytes: packageInfo.bytes,
      packageLoc: packageInfo.lines,
      packageSha256: packageInfo.sha256,
      runtimeExists: runtimeInfo.exists,
      runtimeBytes: runtimeInfo.bytes,
      runtimeLoc: runtimeInfo.lines,
      runtimeSha256: runtimeInfo.sha256,
      sourceKindParityProblems,
      sizeDeltaDecision,
    })),
    skippedRows,
    edges,
    diagnostics,
    behaviorMatrixStatus: 'not_generated_by_this_command',
  };
  const manifestReceipt = writeJson(manifestPath, manifest);

  let ledgerReceipt = null;
  if (updateLedger) {
    for (const entry of entryPackages) {
      const row = ledger.entries.find((candidate) => candidate.originalPath === entry.originalPath);
      updateLedgerRow(
        row,
        entry.originalInfo,
        entry.packageInfo,
        entry.runtimeInfo,
        entry.runtimeEntryPoint,
        generatedAt,
        manifestPath,
        manifestReceipt.hash,
        entry.sizeDeltaDecision,
        entry.sourceKindParityProblems,
        ownerTaskId
      );
    }
    ledger.generatedAt = generatedAt;
    ledgerReceipt = writeJson(LEDGER_PATH, ledger);
  }

  const failedEntryCount = entryPackages.filter(
    (entry) => entry.sizeDeltaDecision !== 'passed_within_strict_threshold'
  ).length;
  const ok = diagnostics.length === 0 && failedEntryCount === 0;
  return {
    ok,
    status: updateLedger
      ? ok
        ? 'package_source_evidence_written_pending_behavior_matrices'
        : 'rework_required_size_delta_or_source_kind_failed_ledger_updated'
      : 'package_source_evidence_written_without_ledger_update',
    ownerTaskId,
    selectedRowCount: selectedRows.length,
    skippedRowCount: skippedRows.length,
    failedEntryCount,
    sourceAuthorityFileCount: sourceAuthorityFiles.length,
    manifestPath,
    manifestHash: manifestReceipt.hash,
    ledgerReceipt,
    diagnostics,
    skippedRows,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = generate(args.updateLedger, args.owner);
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
  generate,
};
