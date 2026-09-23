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
const { collectProjectionQualityIssues } = require('./projection_quality_gate');
const {
  buildDerivedContractExecutionManifest,
} = require('../../../shared/contract-execution-manifest/build-contract-execution-manifest');

const SOURCE_ROW_GROUPS = [
  { sourceKey: 'implementationTasks', projectionKey: 'mustAtomicTasks' },
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

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function parseArgs(argv) {
  const args = {
    source: '',
    semanticKernel: '',
    mustDecompositionPacket: '',
    authoringDir: '',
    out: '',
    receipt: '',
    reconciliationReport: '',
    prepublicationAttempt: false,
    recordRoot: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--prepublication-attempt') {
      args.prepublicationAttempt = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--semantic-kernel' ||
      arg === '--must-decomposition-packet' ||
      arg === '--authoring-dir' ||
      arg === '--record-root' ||
      arg === '--out' ||
      arg === '--receipt' ||
      arg === '--reconciliation-report'
    ) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      args[arg.slice(2).replace(/-([a-z])/g, (_match, character) => character.toUpperCase())] = next;
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

function validateContentAddressedPrepublication(input) {
  const manifest = input.buildManifestV2;
  const failures = [];
  const entries = Array.isArray(manifest?.artifactEntries) ? manifest.artifactEntries : [];
  const byRole = new Map(entries.map((entry) => [entry.role, entry]));
  const requiredRoles = [
    'semantic_ir', 'source_binding', 'resolved_evidence_index', 'confirmation_projection',
    'final_markdown', 'execution_manifest', 'per_must_bundle', 'trace_matrix', 'diagram_set',
    'projection_reconciliation_report', 'authority_resolution_report', 'renderability_probe_report',
    'judge_audit_packet',
  ];
  const readEntry = (role) => {
    const entry = byRole.get(role);
    if (!entry) { failures.push(`prepublication_artifact_role_missing:${role}`); return null; }
    const ref = entry.contentRef;
    if (!ref || !/^authoring\/objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{62}$/u.test(String(ref.recordRelativePath ?? '')) ||
      !SHA256_PATTERN.test(String(ref.contentHash ?? ''))) {
      failures.push(`prepublication_artifact_ref_invalid:${role}`); return null;
    }
    const absolute = path.resolve(input.recordRoot, ...String(ref.recordRelativePath).split('/'));
    const relative = path.relative(path.resolve(input.recordRoot), absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absolute)) {
      failures.push(`prepublication_artifact_missing:${role}`); return null;
    }
    const bytes = fs.readFileSync(absolute);
    if (`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` !== ref.contentHash || bytes.length !== ref.byteLength) {
      failures.push(`prepublication_artifact_hash_mismatch:${role}`); return null;
    }
    if (/^application\/json(?:;|$)/iu.test(String(ref.mediaType))) {
      try {
        const value = JSON.parse(bytes.toString('utf8'));
        if (!value || typeof value !== 'object' || value.schemaVersion !== entry.schemaVersion) {
          failures.push(`prepublication_artifact_schema_mismatch:${role}`);
        }
        return value;
      } catch { failures.push(`prepublication_artifact_json_invalid:${role}`); return null; }
    }
    return bytes.toString('utf8');
  };
  if (!manifest || manifest.schemaVersion !== 'requirements-contract-build-manifest/v2') {
    failures.push('prepublication_build_manifest_invalid');
  }
  for (const role of requiredRoles) readEntry(role);
  const semanticIr = readEntry('semantic_ir');
  if (!semanticIr || !['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2'].includes(semanticIr.schemaVersion) ||
    !SHA256_PATTERN.test(String(semanticIr.scopeSemanticHash ?? '')) ||
    !semanticIr.semanticPayload || !Array.isArray(semanticIr.semanticPayload.specSpanRegistry) ||
    !Array.isArray(semanticIr.semanticPayload.evidenceClaims)) failures.push('prepublication_semantic_ir_invalid');
  for (const role of ['projection_reconciliation_report', 'authority_resolution_report', 'renderability_probe_report']) {
    const value = readEntry(role);
    if (value?.decision === 'block') failures.push(`prepublication_${role}_blocked`);
  }
  const packet = readEntry('judge_audit_packet');
  if (!packet || packet.schemaVersion !== 'requirements-contract-judge-audit-packet/v3' ||
    !SHA256_PATTERN.test(String(packet.packetHash ?? '')) || !Array.isArray(packet.semanticAuditSliceRefs) ||
    packet.semanticAuditSliceRefs.length === 0) failures.push('prepublication_judge_audit_packet_invalid');
  return { exitCode: failures.length ? 1 : 0, report: {
    verdict: failures.length ? 'block' : 'pass', failedChecks: unique(failures), blockingIssues: unique(failures),
    sourcePath: input.sourcePath, recordRoot: input.recordRoot,
  } };
}
function prepublicationIssue(code, refs = []) {
  return issue(code, code.replace(/_/gu, ' '), refs, 'blocker', 'prepublication_build_gate');
}

function validatePrepublicationAttempt(input) {
  if (!input.buildManifestV2) {
    const finding = prepublicationIssue('prepublication_build_manifest_required');
    return {
      exitCode: 1,
      report: {
        schemaVersion: 'requirements-contract-prepublication-render-gate-report/v2',
        verdict: 'FAIL',
        sourcePath: normalizePathForReport(input.sourcePath),
        recordRoot: normalizePathForReport(input.recordRoot),
        failedChecks: [finding.code],
        blockingIssues: [finding],
      },
    };
  }
  return validateContentAddressedPrepublication(input);
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

function defaultAuthoringDir(sourcePath, confirmation) {
  const recordId = String(confirmation?.recordId ?? '').trim();
  if (recordId) {
    return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring');
  }
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', base, 'authoring');
}

function rowId(row, fallback = '') {
  return String(row?.id ?? row?.taskId ?? row?.commandId ?? row?.artifactId ?? row?.path ?? fallback).trim();
}

function sourceRowsForKey(confirmation, key) {
  if (key === 'implementationTasks' || key === 'atomicImplementationTaskList') {
    const canonicalTasks = asArray(confirmation.implementationTasks);
    return canonicalTasks.length ? canonicalTasks : asArray(confirmation.atomicImplementationTaskList);
  }
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
  if (
    row.projectionStatus === 'synchronized' &&
    (row.derivedFromMustRef || row.derivedFromRequirementRef)
  ) {
    return true;
  }
  if (row.derivedFromProjectionRef || row.derivedFromProjectionId) return true;
  return false;
}

function packetProjectionBacksSourceRow(projections, sourceKey, row, index) {
  const rowIdentifier = rowId(row, String(index));
  const sourceKeys =
    sourceKey === 'implementationTasks'
      ? ['implementationTasks', 'atomicImplementationTaskList']
      : [sourceKey];
  return sourceKeys.some((key) =>
    projections.some((projection) =>
      projectionMaterializedTargets(projection).some((target) => {
        const parsed = parseMaterializedTarget(target);
        if (!parsed || parsed.sourceKey !== key) return false;
        return !parsed.id || parsed.id === rowIdentifier || String(row?.path ?? '') === parsed.id;
      })
    )
  );
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

function collectContractExecutionManifestIssues(confirmation) {
  try {
    const manifest = buildDerivedContractExecutionManifest({ confirmation });
    const hasAcceptanceSurface = [
      'acceptanceTests',
      'acceptanceCriteria',
      'e2eSuites',
      'e2eScenarios',
    ].some((field) => asArray(confirmation[field]).length > 0);
    return asArray(manifest?.errorCaseCoverage?.missing)
      .filter(
        (finding) =>
          hasAcceptanceSurface ||
          !['failure_path_acceptance_coverage_missing', 'edge_case_acceptance_coverage_missing'].includes(
            finding.code
          )
      )
      .map((finding) =>
        issue(
          `ai_tdd_manifest_${finding.code}`,
          `errorCaseCoverage missing ${finding.id}: ${finding.code}`,
          ['errorCaseCoverage', finding.id],
          'blocker',
          'contract_execution_manifest'
        )
      );
  } catch (error) {
    return [
      issue(
        'ai_tdd_manifest_derivation_failed',
        error instanceof Error ? error.message : String(error),
        ['aiTddContractExecutionManifestProjection'],
        'blocker',
        'contract_execution_manifest'
      ),
    ];
  }
}

function buildReconciliationReport({
  confirmation,
  packet,
  sourcePath = '',
  packetPath = '',
  sourceDocumentHash = '',
  implementationConfirmationHash = '',
}) {
  const issues = [];
  const packetHash = packet?.packetHash ?? '';
  const projections = allPacketProjectionRows(packet ?? {});
  const atomicTasksById = new Map(
    asArray(confirmation.atomicImplementationTaskList).map((row, index) => [
      rowId(row, String(index)),
      row,
    ])
  );
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
    for (const [index, row] of sourceRowsForKey(confirmation, group.sourceKey).entries()) {
      const canonicalAtomicTask =
        group.sourceKey === 'implementationTasks'
          ? atomicTasksById.get(rowId(row, String(index)))
          : null;
      if (
        !isProjectionBacked(row, packetHash) &&
        !(canonicalAtomicTask && isProjectionBacked(canonicalAtomicTask, packetHash)) &&
        !packetProjectionBacksSourceRow(projections, group.sourceKey, row, index)
      ) {
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

  const report = {
    schemaVersion: 'must-packet-source-reconciliation-report/v1',
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: stringList([sourcePath, packetPath]).map((item) => normalizePathForReport(item)),
    verdict: issues.length ? 'fail' : 'pass',
    packetHash,
    checkedGroups: SOURCE_ROW_GROUPS.map((group) => group.sourceKey),
    issueCount: issues.length,
    issues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });
  return report;
}

function runGate(args) {
  const sourcePath = path.resolve(args.source);
  if (args.prepublicationAttempt) {
    if (!args.recordRoot) {
      const finding = prepublicationIssue('prepublication_record_root_missing');
      return {
        exitCode: 1,
        report: {
          schemaVersion: 'requirements-contract-prepublication-render-gate-report/v1',
          verdict: 'FAIL',
          failedChecks: [finding.code],
          blockingIssues: [finding],
        },
      };
    }
    const result = validatePrepublicationAttempt({
      sourcePath,
      recordRoot: args.recordRoot,
    });
    if (args.out) writeJson(args.out, result.report);
    return result;
  }
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

  const blockingIssues = [
    ...(kernelRead.ok ? [] : [issue(kernelRead.missing ? 'missing_semantic_kernel' : 'semantic_kernel_unreadable', kernelRead.error ?? 'semantic-kernel.json is missing or unreadable', [kernelPath])]),
    ...(packetRead.ok ? [] : [issue(packetRead.missing ? 'missing_must_decomposition_packet' : 'must_packet_unreadable', packetRead.error ?? 'must_decomposition_packet.json is missing or unreadable', [packetPath])]),
    ...collectKernelIssues({ kernel, kernelPath, sourceDocumentHash }),
    ...collectPacketIssues({ packet, packetPath, kernel, sourceDocumentHash, confirmation }),
    ...collectProjectionQualityIssues(confirmation, {
      source: 'must_decomposition_gate',
      makeIssue: issue,
    }),
    ...collectContractExecutionManifestIssues(confirmation),
  ];

  const reconciliation = buildReconciliationReport({
    confirmation,
    packet,
    sourcePath,
    packetPath,
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  blockingIssues.push(...reconciliation.issues);
  if (reconciliation.verdict !== 'pass') {
    blockingIssues.push(issue('packet_source_reconciliation_failed', 'packet/source reconciliation verdict is not pass', [reconciliationPath]));
  }

  const verdict = blockingIssues.length ? 'FAIL' : 'PASS';
  const receipt = {
    schemaVersion: 'must-decomposition-receipt/v1',
    verdict,
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: [
      normalizePathForReport(sourcePath),
      normalizePathForReport(kernelPath),
      normalizePathForReport(packetPath),
      normalizePathForReport(reconciliationPath),
    ],
    semanticKernelHash: kernel?.kernelHash ?? null,
    packetHash: packet?.packetHash ?? null,
    reconciliationReportPath: normalizePathForReport(reconciliationPath),
    failedChecks: unique(blockingIssues.map((item) => item.code)),
  };
  receipt.receiptHash = hashObject({ ...receipt, receiptHash: null });
  const report = {
    schemaVersion: 'pre-render-must-decomposition-gate-report/v1',
    verdict,
    recordId: String(confirmation?.recordId ?? '').trim() || null,
    confirmability: verdict === 'PASS' ? 'confirmable' : 'blocked',
    sourcePath: normalizePathForReport(sourcePath),
    authoringDir: normalizePathForReport(authoringDir),
    sourceDocumentHash,
    implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt: new Date().toISOString(),
    inputRefs: [
      normalizePathForReport(sourcePath),
      normalizePathForReport(kernelPath),
      normalizePathForReport(packetPath),
      normalizePathForReport(receiptPath),
      normalizePathForReport(reconciliationPath),
    ],
    semanticKernelRef: { path: normalizePathForReport(kernelPath), hash: kernel?.kernelHash ?? null },
    mustDecompositionPacketRef: { path: normalizePathForReport(packetPath), hash: packet?.packetHash ?? null, status: packet?.status ?? null },
    mustDecompositionReceiptPath: normalizePathForReport(receiptPath),
    packetSourceReconciliation: {
      reportPath: normalizePathForReport(reconciliationPath),
      verdict: reconciliation.verdict,
    },
    failedChecks: receipt.failedChecks,
    blockingIssues,
  };
  report.contentHash = hashObject({ ...report, contentHash: null });

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
  validatePrepublicationAttempt,
  buildReconciliationReport,
};
