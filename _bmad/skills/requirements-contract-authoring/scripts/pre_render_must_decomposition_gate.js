#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  asArray,
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
  stableStringify,
  stringList,
  unique,
} = require('./pre_render_definition_drilldown_lib');

const SOURCE_ROW_GROUPS = [
  { sourceKey: 'atomicImplementationTaskList', projectionKey: 'mustAtomicTasks' },
  { sourceKey: 'mustExecutionDecompositionMatrix', projectionKey: 'mustExecutionDecompositionMatrix' },
  { sourceKey: 'evidence', projectionKey: 'mustEvidenceProjection' },
  { sourceKey: 'traceRows', projectionKey: 'mustTraceProjection' },
  { sourceKey: 'acceptanceTests', projectionKey: 'mustAcceptanceProjection' },
  { sourceKey: 'e2eSuites', projectionKey: 'mustAcceptanceProjection' },
  { sourceKey: 'failurePaths', projectionKey: 'mustFailureEdgeProjection' },
  { sourceKey: 'edgeCases', projectionKey: 'mustFailureEdgeProjection' },
  { sourceKey: 'targetModificationPaths', projectionKey: 'mustTargetPathProjection' },
  { sourceKey: 'artifactAutomationPlan', projectionKey: 'mustArtifactProjection' },
  { sourceKey: 'requiredCommands', projectionKey: 'mustCommandProjection' },
];

const VALID_NO_NEW_GAP_VERDICTS = new Set(['no_new_valid_gap', 'no_new_confirmation_blocking_gap']);
const RESOLVED_GAP_STATUSES = new Set(['resolved', 'converted_to_out_boundary', 'converted_to_open_question', 'rejected']);

function usage(exitCode = 0) {
  console.log(`Usage:
  node pre_render_must_decomposition_gate.js --source <source-document.md> [options]

Options:
  --semantic-kernel <semantic-kernel.json>
  --must-decomposition-packet <must_decomposition_packet.json>
  --authoring-dir <dir>
  --out <pre-render-must-decomposition-gate-report.json>
  --receipt <must_decomposition_receipt.json>
  --reconciliation-report <must_packet_source_reconciliation_report.json>
  --json
  --help`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    semanticKernel: '',
    mustDecompositionPacket: '',
    authoringDir: '',
    out: '',
    receipt: '',
    reconciliationReport: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--semantic-kernel' ||
      arg === '--must-decomposition-packet' ||
      arg === '--authoring-dir' ||
      arg === '--out' ||
      arg === '--receipt' ||
      arg === '--reconciliation-report'
    ) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      args[arg.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    if (args.source) return { error: `unexpected positional argument ${arg}` };
    args.source = arg;
  }
  if (!args.source) return { error: 'missing source document path' };
  return args;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function hashObject(value) {
  return sha256(stableStringify(value));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonSafe(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    return { ok: false, missing: true, path: absolute };
  }
  try {
    return { ok: true, value: readJsonFile(absolute), path: absolute };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      path: absolute,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeJson(filePath, value) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function issue(code, message, refs = [], severity = 'blocker', source = 'must_decomposition_gate') {
  return { code, message, refs: stringList(refs), severity, source };
}

function unwrapKernel(value) {
  return value?.semanticKernel ?? value;
}

function unwrapPacket(value) {
  return value?.must_decomposition_packet ?? value?.mustDecompositionPacket ?? value;
}

function unwrapReceipt(value) {
  return value?.criticalAuditorReceipt ?? value;
}

function defaultAuthoringDir(sourcePath, confirmation) {
  const recordId = String(confirmation?.recordId ?? '').trim();
  if (recordId) {
    return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  }
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', base, 'authoring');
}

function collectReceiptPaths(authoringDir) {
  if (!fs.existsSync(authoringDir)) return [];
  return fs
    .readdirSync(authoringDir)
    .filter((fileName) => /^critical-auditor-receipt-round-\d+\.json$/u.test(fileName))
    .map((fileName) => path.join(authoringDir, fileName))
    .sort();
}

function rowId(row, fallback = '') {
  return String(row?.id ?? row?.taskId ?? row?.commandId ?? row?.artifactId ?? row?.path ?? fallback).trim();
}

function sourceRowsForKey(confirmation, key) {
  if (key === 'currentTargetMap') {
    const map = confirmation.currentTargetMap ?? {};
    return [
      ...asArray(map.currentSummary),
      ...asArray(map.targetSummary),
      ...asArray(map.diffRows),
      ...asArray(map.process),
      ...asArray(map.artifactPaths),
      ...asArray(map.canonicalArtifacts),
      ...asArray(map.existingArtifacts),
    ];
  }
  if (key === 'aiTddContractExecutionManifestProjection') {
    const manifest = confirmation.aiTddContractExecutionManifestProjection ?? confirmation.contractExecutionManifest ?? {};
    return Object.entries(manifest).map(([id, value]) => ({ id, ...(value && typeof value === 'object' ? value : { value }) }));
  }
  if (key === 'closeoutReadinessPreview') {
    const closeout = confirmation.closeoutReadinessPreview ?? {};
    return closeout && Object.keys(closeout).length ? [{ id: 'closeoutReadinessPreview', ...closeout }] : [];
  }
  return asArray(confirmation[key]);
}

function projectionMaterializedTargets(row) {
  return stringList(row?.materializedTo ?? row?.materializedToRefs ?? row?.sourceRefs);
}

function parseMaterializedTarget(target) {
  const text = String(target ?? '');
  const match = text.match(/^implementationConfirmation\.([A-Za-z0-9_.]+)(?:\[([^\]]+)\])?/u);
  if (!match) return null;
  return { sourceKey: match[1].split('.')[0], id: match[2] ?? '' };
}

function hasSourceRow(confirmation, target) {
  const parsed = parseMaterializedTarget(target);
  if (!parsed) return false;
  const rows = sourceRowsForKey(confirmation, parsed.sourceKey);
  if (!parsed.id) return rows.length > 0;
  return rows.some((row, index) => rowId(row, String(index)) === parsed.id || String(row?.path ?? '') === parsed.id);
}

function isProjectionBacked(row, packetHash) {
  if (!row || typeof row !== 'object') return false;
  if (row.derivedFromPacketHash === packetHash) return true;
  if (row.projectionStatus === 'synchronized' && row.derivedFromMustRef) return true;
  if (row.derivedFromProjectionRef || row.derivedFromProjectionId) return true;
  return false;
}

function allPacketProjectionRows(packet) {
  return asArray(packet.mustPackets).flatMap((mustPacket) =>
    [
      'mustExecutionDecompositionMatrix',
      'mustAtomicTasks',
      'mustEvidenceProjection',
      'mustTraceProjection',
      'mustAcceptanceProjection',
      'mustFailureEdgeProjection',
      'mustTargetPathProjection',
      'mustCurrentTargetProjection',
      'mustAiTddManifestProjection',
      'mustArtifactProjection',
      'mustCommandProjection',
      'mustCloseoutBoundaryProjection',
    ].flatMap((key) =>
      asArray(mustPacket[key]).map((row) => ({
        ...row,
        projectionKey: key,
        mustRef: mustPacket.mustRef,
      }))
    )
  );
}

function collectKernelIssues({ kernel, kernelPath, sourceDocumentHash }) {
  const issues = [];
  if (!kernel) {
    issues.push(issue('missing_semantic_kernel', 'semantic-kernel.json is missing', [kernelPath]));
    return issues;
  }
  if (kernel.schemaVersion !== 'semantic-kernel/v1') {
    issues.push(issue('semantic_kernel_schema_invalid', 'semantic kernel schemaVersion must be semantic-kernel/v1', ['schemaVersion']));
  }
  if (kernel.sourceDocumentHash !== sourceDocumentHash) {
    issues.push(issue('semantic_kernel_source_hash_stale', 'semantic kernel sourceDocumentHash is stale', ['sourceDocumentHash']));
  }
  for (const field of ['goal', 'currentState', 'targetState']) {
    const value = kernel[field];
    if (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()) {
      issues.push(issue('semantic_kernel_core_missing', `semantic kernel missing ${field}`, [field]));
    }
  }
  if (!String(kernel.kernelHash ?? '').startsWith('sha256:')) {
    issues.push(issue('semantic_kernel_hash_missing', 'semantic kernel must declare kernelHash', ['kernelHash']));
  }
  return issues;
}

function collectPacketIssues({ packet, packetPath, kernel, sourceDocumentHash, confirmation }) {
  const issues = [];
  if (!packet) {
    issues.push(issue('missing_must_decomposition_packet', 'must_decomposition_packet.json is missing', [packetPath]));
    return issues;
  }
  if (packet.schemaVersion !== 'must-decomposition-packet/v1') {
    issues.push(issue('must_packet_schema_invalid', 'must_decomposition_packet schemaVersion must be must-decomposition-packet/v1', ['schemaVersion']));
  }
  if (packet.status !== 'synchronized') {
    issues.push(issue('must_packet_not_synchronized', 'must_decomposition_packet.status must be synchronized', ['status']));
  }
  if (packet.sourceDocumentHash !== sourceDocumentHash) {
    issues.push(issue('must_packet_source_hash_stale', 'must_decomposition_packet sourceDocumentHash is stale', ['sourceDocumentHash']));
  }
  if (kernel?.kernelHash && packet.semanticKernelHash !== kernel.kernelHash) {
    issues.push(issue('must_packet_semantic_kernel_hash_stale', 'must_decomposition_packet semanticKernelHash is stale', ['semanticKernelHash']));
  }
  if (!String(packet.packetHash ?? '').startsWith('sha256:')) {
    issues.push(issue('must_packet_hash_missing', 'must_decomposition_packet must declare packetHash', ['packetHash']));
  }

  const packetRows = asArray(packet.mustPackets);
  const byMust = new Map(packetRows.map((row) => [row.mustRef, row]));
  for (const must of asArray(confirmation.must)) {
    const mustId = String(must?.id ?? '').trim();
    const mustPacket = byMust.get(mustId);
    if (!mustPacket) {
      issues.push(issue('must_packet_missing_must_row', `${mustId} lacks a mustPackets[] row`, [mustId]));
      continue;
    }
    if (!mustPacket.decompositionBasis || !Object.keys(mustPacket.decompositionBasis).length) {
      issues.push(issue('must_packet_decomposition_basis_missing', `${mustId} lacks decompositionBasis`, [mustId]));
    }
    if (!mustPacket.atomicityDrivers || !Object.keys(mustPacket.atomicityDrivers).length) {
      issues.push(issue('must_packet_atomicity_drivers_missing', `${mustId} lacks atomicityDrivers`, [mustId]));
    }
    if (mustPacket.questionCoverage?.coverageVerdict !== 'complete') {
      issues.push(issue('must_packet_question_coverage_incomplete', `${mustId} questionCoverage is incomplete`, [mustId]));
    }
    const expected = Number(mustPacket.atomicityCompleteness?.expectedTaskCount ?? 0);
    const actual = Number(mustPacket.atomicityCompleteness?.actualTaskCount ?? asArray(mustPacket.mustAtomicTasks).length);
    if (mustPacket.atomicityCompleteness?.completenessVerdict !== 'complete') {
      issues.push(issue('must_packet_atomicity_incomplete', `${mustId} atomicityCompleteness is not complete`, [mustId]));
    }
    if (actual < expected) {
      issues.push(issue('must_packet_under_split', `${mustId} actualTaskCount is less than expectedTaskCount`, [mustId]));
    }
    for (const task of asArray(mustPacket.mustAtomicTasks)) {
      const taskId = rowId(task, mustId);
      const overBroad =
        task.overBroad === true ||
        task.coversMultipleIndependentUnits === true ||
        String(task.estimatedAtomicity ?? '').toLowerCase() === 'over_broad' ||
        asArray(task.primaryObservableBehaviors).length > 1 ||
        asArray(task.primaryAcceptanceOracles).length > 1;
      if (overBroad) {
        issues.push(issue('must_packet_over_broad_atomic_task', `${taskId} covers more than one atomic unit`, [mustId, taskId]));
      }
      if (!asArray(task.targetFiles).length && !task.noFileModificationRequired) {
        issues.push(issue('must_packet_atomic_task_missing_target_files', `${taskId} lacks targetFiles[]`, [mustId, taskId]));
      }
      if (!task.redProofPlan) {
        issues.push(issue('must_packet_atomic_task_missing_red_proof', `${taskId} lacks redProofPlan`, [mustId, taskId]));
      }
    }
  }
  for (const claim of [
    ...asArray(packet.authorClaims),
    ...packetRows.flatMap((row) => asArray(row.authorClaims)),
  ]) {
    if (!claim.criticDisposition) {
      issues.push(issue('author_claim_lacks_critic_disposition', 'Author claim lacks Critical Auditor disposition', [claim.id ?? claim.claim ?? 'authorClaim']));
    }
  }
  return issues;
}

function buildAuditInputHash({ sourceDocumentHash, implementationConfirmationHash, kernel, packet }) {
  return hashObject({
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash: kernel?.kernelHash ?? null,
    packetHash: packet?.packetHash ?? null,
  });
}

function collectCriticalAuditorIssues({ receiptReads, auditInputHash }) {
  const issues = [];
  const receipts = [];
  for (const read of receiptReads) {
    if (!read.ok) {
      issues.push(issue('critical_auditor_receipt_unreadable', read.error ?? 'Critical Auditor receipt is unreadable', [read.path]));
      continue;
    }
    receipts.push(unwrapReceipt(read.value));
  }
  if (!receipts.length) {
    issues.push(issue('critical_auditor_receipt_missing', 'Critical Auditor receipts are missing'));
    return { issues, receipts: [], consecutiveNoNewGapRounds: 0, latestReceiptHash: null };
  }
  receipts.sort((a, b) => Number(a.roundIndex ?? 0) - Number(b.roundIndex ?? 0));
  let consecutive = 0;
  let latestReceiptHash = null;
  for (const receipt of receipts) {
    latestReceiptHash = hashObject(receipt);
    if (receipt.schemaVersion !== 'critical-auditor-receipt/v1') {
      issues.push(issue('critical_auditor_receipt_schema_invalid', `round ${receipt.roundIndex ?? '?'} has invalid schemaVersion`));
    }
    if (receipt.inputHash !== auditInputHash) {
      issues.push(issue('critical_auditor_receipt_input_hash_stale', `round ${receipt.roundIndex ?? '?'} inputHash is stale`, ['inputHash']));
    }
    const verdict = receipt.convergenceDecision?.verdict;
    if (verdict === 'insufficient_audit') {
      issues.push(issue('critical_auditor_insufficient_audit', `round ${receipt.roundIndex ?? '?'} is insufficient_audit`));
    }
    if (verdict === 'blocked') {
      issues.push(issue('critical_auditor_blocked', `round ${receipt.roundIndex ?? '?'} is blocked`));
    }
    for (const gap of asArray(receipt.validatedGaps)) {
      const status = String(gap.status ?? gap.resolutionStatus ?? '').trim();
      if (!RESOLVED_GAP_STATUSES.has(status)) {
        issues.push(issue('critical_auditor_validated_gap_unresolved', `validated gap ${gap.id ?? gap.code ?? 'unknown'} is unresolved`, [gap.id ?? gap.code ?? 'gap']));
      }
    }
    consecutive = VALID_NO_NEW_GAP_VERDICTS.has(verdict) ? consecutive + 1 : 0;
  }
  if (consecutive < 3) {
    issues.push(issue('critical_auditor_less_than_three_no_new_gap_rounds', 'Critical Auditor has fewer than three consecutive no-new-gap rounds'));
  }
  return { issues, receipts, consecutiveNoNewGapRounds: consecutive, latestReceiptHash };
}

function buildReconciliationReport({ confirmation, packet }) {
  const issues = [];
  const packetHash = packet?.packetHash ?? '';
  const projections = allPacketProjectionRows(packet ?? {});
  for (const projection of projections) {
    const targets = projectionMaterializedTargets(projection);
    if (!targets.length) {
      issues.push(
        issue(
          'packet_projection_not_materialized',
          `${rowId(projection, projection.projectionKey)} lacks materializedTo[]`,
          [projection.mustRef, projection.projectionKey]
        )
      );
      continue;
    }
    for (const target of targets) {
      if (!hasSourceRow(confirmation, target)) {
        issues.push(issue('packet_projection_points_to_missing_source_row', `${target} does not resolve to a source row`, [target]));
      }
    }
  }

  for (const group of SOURCE_ROW_GROUPS) {
    for (const row of sourceRowsForKey(confirmation, group.sourceKey)) {
      if (!isProjectionBacked(row, packetHash)) {
        issues.push(
          issue(
            'source_row_independently_invented',
            `${group.sourceKey}[${rowId(row)}] lacks synchronized packet back-reference`,
            [group.sourceKey, rowId(row)]
          )
        );
      }
    }
  }

  for (const key of ['currentTargetMap', 'aiTddContractExecutionManifestProjection', 'closeoutReadinessPreview']) {
    const rows = sourceRowsForKey(confirmation, key);
    if (rows.length && !asArray(packet?.mustDerivedProjectionMap).some((row) => stringList(row.materializedTo).some((target) => target.includes(key)))) {
      issues.push(issue('packet_projection_missing_group_mapping', `${key} lacks mustDerivedProjectionMap materialization`, [key]));
    }
  }

  return {
    schemaVersion: 'must-packet-source-reconciliation-report/v1',
    verdict: issues.length ? 'fail' : 'pass',
    packetHash,
    checkedGroups: SOURCE_ROW_GROUPS.map((group) => group.sourceKey),
    issueCount: issues.length,
    issues,
  };
}

function runGate(args) {
  const sourcePath = path.resolve(args.source);
  let sourceText;
  let confirmation;
  let blockText;
  try {
    sourceText = fs.readFileSync(sourcePath, 'utf8');
    const extracted = extractImplementationConfirmation(sourceText);
    confirmation = extracted.confirmation;
    blockText = extracted.blockText;
  } catch (error) {
    const finding = issue('source_parse_failed', error instanceof Error ? error.message : String(error), [sourcePath]);
    const report = {
      schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
      verdict: 'FAIL',
      failedChecks: [finding.code],
      blockingIssues: [finding],
    };
    return { exitCode: 1, report };
  }

  const sourceDocumentHash = sourceDocumentHashFor(sourceText, blockText, confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const authoringDir = path.resolve(args.authoringDir || defaultAuthoringDir(sourcePath, confirmation));
  const kernelPath = path.resolve(args.semanticKernel || confirmation.preConfirmationDrilldown?.semanticKernelRef?.path || path.join(authoringDir, 'semantic-kernel.json'));
  const packetPath = path.resolve(
    args.mustDecompositionPacket ||
      confirmation.preConfirmationDrilldown?.mustDecompositionPacketRef?.path ||
      path.join(authoringDir, 'must_decomposition_packet.json')
  );
  const reportPath = path.resolve(args.out || path.join(authoringDir, 'pre-render-must-decomposition-gate-report.json'));
  const receiptPath = path.resolve(args.receipt || path.join(authoringDir, 'must_decomposition_receipt.json'));
  const reconciliationPath = path.resolve(args.reconciliationReport || path.join(authoringDir, 'must_packet_source_reconciliation_report.json'));

  const kernelRead = readJsonSafe(kernelPath);
  const packetRead = readJsonSafe(packetPath);
  const kernel = kernelRead.ok ? unwrapKernel(kernelRead.value) : null;
  const packet = packetRead.ok ? unwrapPacket(packetRead.value) : null;
  const auditInputHash = buildAuditInputHash({ sourceDocumentHash, implementationConfirmationHash, kernel, packet });
  const receiptReads = collectReceiptPaths(authoringDir).map((receiptFile) => readJsonSafe(receiptFile));

  const blockingIssues = [
    ...(kernelRead.ok ? [] : [issue(kernelRead.missing ? 'missing_semantic_kernel' : 'semantic_kernel_unreadable', kernelRead.error ?? 'semantic-kernel.json is missing or unreadable', [kernelPath])]),
    ...(packetRead.ok ? [] : [issue(packetRead.missing ? 'missing_must_decomposition_packet' : 'must_packet_unreadable', packetRead.error ?? 'must_decomposition_packet.json is missing or unreadable', [packetPath])]),
    ...collectKernelIssues({ kernel, kernelPath, sourceDocumentHash }),
    ...collectPacketIssues({ packet, packetPath, kernel, sourceDocumentHash, confirmation }),
  ];

  const auditor = collectCriticalAuditorIssues({ receiptReads, auditInputHash });
  blockingIssues.push(...auditor.issues);

  const reconciliation = buildReconciliationReport({ confirmation, packet });
  blockingIssues.push(...reconciliation.issues);
  if (reconciliation.verdict !== 'pass') {
    blockingIssues.push(issue('packet_source_reconciliation_failed', 'packet/source reconciliation verdict is not pass', [reconciliationPath]));
  }

  const verdict = blockingIssues.length ? 'FAIL' : 'PASS';
  const receipt = {
    schemaVersion: 'must-decomposition-receipt/v1',
    verdict,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash: kernel?.kernelHash ?? null,
    packetHash: packet?.packetHash ?? null,
    auditInputHash,
    criticalAuditor: {
      receiptCount: auditor.receipts.length,
      minimumRounds: 3,
      consecutiveNoNewGapRounds: auditor.consecutiveNoNewGapRounds,
      latestReceiptHash: auditor.latestReceiptHash,
      convergenceVerdict: auditor.consecutiveNoNewGapRounds >= 3 ? 'bounded_no_new_gap' : 'blocked',
    },
    reconciliationReportPath: normalizePathForReport(reconciliationPath),
    failedChecks: unique(blockingIssues.map((item) => item.code)),
  };
  const report = {
    schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
    verdict,
    confirmability: verdict === 'PASS' ? 'confirmable' : 'blocked',
    sourcePath: normalizePathForReport(sourcePath),
    authoringDir: normalizePathForReport(authoringDir),
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelRef: { path: normalizePathForReport(kernelPath), hash: kernel?.kernelHash ?? null },
    mustDecompositionPacketRef: { path: normalizePathForReport(packetPath), hash: packet?.packetHash ?? null, status: packet?.status ?? null },
    mustDecompositionReceiptPath: normalizePathForReport(receiptPath),
    packetSourceReconciliation: {
      reportPath: normalizePathForReport(reconciliationPath),
      verdict: reconciliation.verdict,
    },
    criticalAuditor: receipt.criticalAuditor,
    failedChecks: receipt.failedChecks,
    blockingIssues,
  };

  writeJson(reconciliationPath, reconciliation);
  writeJson(receiptPath, receipt);
  writeJson(reportPath, report);

  return { exitCode: verdict === 'PASS' ? 0 : 1, report, receipt, reconciliation };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ ok: false, code: 'invalid_args', message: args.error }, null, 2));
    return 2;
  }

  const result = runGate(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  } else {
    console.log(`pre-render-must-decomposition-gate-report.json=${result.report.reportPath ?? ''}`);
    console.log(`must_decomposition_receipt.json=${result.report.mustDecompositionReceiptPath ?? ''}`);
    console.log(`must_packet_source_reconciliation_report.json=${result.report.packetSourceReconciliation?.reportPath ?? ''}`);
    console.log(`verdict=${result.report.verdict}`);
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  main,
  parseArgs,
  runGate,
  buildAuditInputHash,
  buildReconciliationReport,
};
