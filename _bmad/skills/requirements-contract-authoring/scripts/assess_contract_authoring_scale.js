#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
} = require('./pre_render_definition_drilldown_lib');

const CONDITIONAL_DOMAINS = [
  'governanceEvents',
  'runtimeRecovery',
  'scoringDashboardSft',
  'currentTargetMap',
  'scriptsAndHooks',
];
const AUTHORING_MODES = {
  SEMANTIC_KERNEL_THEN_PACKET: 'semantic_kernel_then_packet',
  SEMANTIC_KERNEL_THEN_PACKET_WITH_AMENDMENT: 'semantic_kernel_then_packet_with_amendment',
};

function usage(exitCode = 0) {
  console.log(`Usage:
  node assess_contract_authoring_scale.js --source <source-document.md> [--phase initial_assessment|post_packet_assessment|post_materialization_assessment] [--progress <progress.json>] [--semantic-kernel <semantic-kernel.json>] [--packet <must_decomposition_packet.json>] [--initial-assessment <scale-assessment-initial.json>] [--post-packet-assessment <scale-assessment-post-packet.json>] [--routing-decision-out <scale-routing-decision.json>] [--packet-source-reconciliation <must_packet_source_reconciliation_report.json>] [--checkpoint-persistence-evidence <checkpoint-persistence-evidence.json>] [--out <assessment.json>] [--json] [--quiet]

Classifies requirements contract authoring as single_pass_allowed, checkpoint_required, or checkpoint_required_with_amendment.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    phase: 'initial_assessment',
    progress: '',
    semanticKernel: '',
    packet: '',
    initialAssessment: '',
    postPacketAssessment: '',
    routingDecisionOut: '',
    packetSourceReconciliation: '',
    checkpointPersistenceEvidence: '',
    out: '',
    json: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--quiet') {
      args.quiet = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--phase' ||
      arg === '--progress' ||
      arg === '--semantic-kernel' ||
      arg === '--packet' ||
      arg === '--initial-assessment' ||
      arg === '--post-packet-assessment' ||
      arg === '--routing-decision-out' ||
      arg === '--packet-source-reconciliation' ||
      arg === '--checkpoint-persistence-evidence' ||
      arg === '--out'
    ) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      args[arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    if (args.source) return { error: `unexpected positional argument ${arg}` };
    args.source = arg;
  }
  if (!args.source) return { error: 'missing source document path' };
  if (!['initial_assessment', 'post_packet_assessment', 'post_materialization_assessment'].includes(args.phase)) {
    return { error: `unsupported phase ${args.phase}` };
  }
  return args;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function sha256Json(value) {
  return sha256(stableStringify(value));
}

function readJsonIfExists(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return null;
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function unwrapKnownJson(value, keys) {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    if (value[key] && typeof value[key] === 'object') return value[key];
  }
  return value;
}

function countMatches(text, pattern) {
  return (String(text).match(pattern) ?? []).length;
}

function confirmationSignals(text) {
  try {
    const { confirmation } = extractImplementationConfirmation(text);
    return {
      implementationConfirmationExists: true,
      mustCount: Array.isArray(confirmation.must) ? confirmation.must.length : 0,
      negCount: Array.isArray(confirmation.notDone) ? confirmation.notDone.length : 0,
      outCount: Array.isArray(confirmation.mustNot) ? confirmation.mustNot.length : 0,
      evidenceCount: Array.isArray(confirmation.evidence) ? confirmation.evidence.length : 0,
      traceRowCount: Array.isArray(confirmation.traceRows) ? confirmation.traceRows.length : 0,
      requiredCommandCount: Array.isArray(confirmation.requiredCommands) ? confirmation.requiredCommands.length : 0,
      blockingOpenQuestionCount: Array.isArray(confirmation.openQuestions)
        ? confirmation.openQuestions.filter((item) => item?.blocksImplementation === true).length
        : 0,
      blockingAssumptionCount: Array.isArray(confirmation.blockingAssumptions)
        ? confirmation.blockingAssumptions.length
        : 0,
      applicableConditionalDomains: CONDITIONAL_DOMAINS.filter(
        (domain) => confirmation.applicability?.[domain]?.applies === true
      ),
    };
  } catch (_error) {
    return {
      implementationConfirmationExists: false,
      mustCount: countMatches(text, /\bMUST-\d{3,}\b/gu),
      negCount: countMatches(text, /\bNEG-\d{3,}\b/gu),
      outCount: countMatches(text, /\bOUT-\d{3,}\b/gu),
      evidenceCount: countMatches(text, /\bEVD-\d{3,}\b/gu),
      traceRowCount: countMatches(text, /\bTRACE-\d{3,}\b/gu),
      requiredCommandCount: countMatches(text, /\bCMD-[A-Z0-9-]+\b/gu),
      blockingOpenQuestionCount: countMatches(text, /blocksImplementation:\s*true|blocking open question|阻断.*问题/giu),
      blockingAssumptionCount: countMatches(text, /blockingAssumptions|blocking assumption|阻断.*假设/giu),
      applicableConditionalDomains: inferConditionalDomainsFromText(text),
    };
  }
}

function inferConditionalDomainsFromText(text) {
  const lower = String(text).toLowerCase();
  return [
    /governance event|controlled ingest|writer registry|治理事件|受控写入/iu.test(lower) ? 'governanceEvents' : '',
    /runtime recovery|resume|rerun|recovery|恢复|断点|重试/iu.test(lower) ? 'runtimeRecovery' : '',
    /dashboard|score|sft|评分|仪表盘/iu.test(lower) ? 'scoringDashboardSft' : '',
    /current.?target|current target|当前.*目标/iu.test(lower) ? 'currentTargetMap' : '',
    /script|hook|commit|git|脚本|钩子/iu.test(lower) ? 'scriptsAndHooks' : '',
  ].filter(Boolean);
}

function scoreSignals(signals) {
  return scoreBreakdown(signals).reduce((sum, item) => sum + item.points, 0);
}

function scoreBand(actual, bands) {
  const matched = bands.find((band) => actual > band.threshold);
  return matched ? matched.points : 0;
}

function scoreBreakdown(signals) {
  const conditionalDomainCount = signals.applicableConditionalDomains.length;
  return [
    {
      id: 'line_count',
      actual: signals.lineCount,
      threshold: '>600 => +4; >300 => +2',
      points: scoreBand(signals.lineCount, [
        { threshold: 600, points: 4 },
        { threshold: 300, points: 2 },
      ]),
      reason: 'Large documents are more likely to time out or lose semantic context in one pass.',
    },
    {
      id: 'byte_length',
      actual: signals.byteLength,
      threshold: '>35000 => +4; >18000 => +2',
      points: scoreBand(signals.byteLength, [
        { threshold: 35000, points: 4 },
        { threshold: 18000, points: 2 },
      ]),
      reason: 'Large byte size indicates dense source content or generated structures.',
    },
    {
      id: 'section_count',
      actual: signals.sectionCount,
      threshold: '>20 => +2; >10 => +1',
      points: scoreBand(signals.sectionCount, [
        { threshold: 20, points: 2 },
        { threshold: 10, points: 1 },
      ]),
      reason: 'Many sections increase cross-reference and projection drift risk.',
    },
    {
      id: 'confirmation_id_count',
      actual: signals.confirmationIdCount,
      threshold: '>45 => +4; >20 => +2',
      points: scoreBand(signals.confirmationIdCount, [
        { threshold: 45, points: 4 },
        { threshold: 20, points: 2 },
      ]),
      reason: 'Many confirmation IDs increase trace/evidence reconciliation risk.',
    },
    {
      id: 'conditional_domain_count',
      actual: conditionalDomainCount,
      threshold: '+2 per applicable domain, max +6',
      points: Math.min(conditionalDomainCount * 2, 6),
      reason: 'Conditional governance/runtime domains require additional schema and gate coverage.',
      domains: signals.applicableConditionalDomains,
    },
    {
      id: 'mermaid_block_count',
      actual: signals.mermaidBlockCount,
      threshold: '>5 => +2',
      points: signals.mermaidBlockCount > 5 ? 2 : 0,
      reason: 'Many diagrams increase renderer and ID-bound view drift risk.',
    },
    {
      id: 'required_command_count',
      actual: signals.requiredCommandCount,
      threshold: '>8 => +2',
      points: signals.requiredCommandCount > 8 ? 2 : 0,
      reason: 'Many required commands increase execution and closeout evidence complexity.',
    },
    {
      id: 'progress_exists',
      actual: signals.progressExists,
      threshold: 'true => +5',
      points: signals.progressExists ? 5 : 0,
      reason: 'Existing checkpoint progress means this is a resumed or amended authoring run.',
    },
    {
      id: 'amendment_risk',
      actual: signals.amendmentRisk,
      threshold: 'true => +3',
      points: signals.amendmentRisk ? 3 : 0,
      reason: 'Amendment or blocking-decision markers require safer checkpointed repair.',
    },
  ].map((item) => ({ ...item, triggered: item.points > 0 }));
}

function hardTriggerBreakdown(signals, phase = 'initial_assessment') {
  const triggers = [
    {
      id: 'line_count_gt_600',
      actual: signals.lineCount,
      threshold: '>600',
      triggered: signals.lineCount > 600,
      reason: 'Document length exceeds single-pass hard limit.',
    },
    {
      id: 'byte_length_gt_35000',
      actual: signals.byteLength,
      threshold: '>35000',
      triggered: signals.byteLength > 35000,
      reason: 'Document byte size exceeds single-pass hard limit.',
    },
    {
      id: 'confirmation_ids_gt_45',
      actual: signals.confirmationIdCount,
      threshold: '>45',
      triggered: signals.confirmationIdCount > 45,
      reason: 'Confirmation ID surface is too large for single-pass reconciliation.',
    },
    {
      id: 'conditional_domains_gte_2',
      actual: signals.applicableConditionalDomains.length,
      threshold: '>=2',
      triggered: signals.applicableConditionalDomains.length >= 2,
      reason: 'Multiple conditional domains require checkpointed schema/projection coverage.',
      domains: signals.applicableConditionalDomains,
    },
    {
      id: 'progress_exists',
      actual: signals.progressExists,
      threshold: 'true',
      triggered: signals.progressExists,
      reason: 'Existing progress requires checkpoint-safe resume or amendment handling.',
    },
    {
      id: 'amendment_risk',
      actual: signals.amendmentRisk,
      threshold: 'true',
      triggered: signals.amendmentRisk,
      reason: 'Amendment markers or blocking decisions require checkpoint-safe repair.',
    },
  ];
  if (phase === 'post_packet_assessment') {
    triggers.push(
      {
        id: 'must_atomic_task_count_gt_20',
        actual: signals.mustAtomicTaskCount ?? 0,
        threshold: '>20',
        triggered: Number(signals.mustAtomicTaskCount ?? 0) > 20,
        reason: 'Packet atomic task surface exceeds single-pass hard limit.',
      },
      {
        id: 'projection_row_count_gt_45',
        actual: signals.projectionRowCount ?? 0,
        threshold: '>45',
        triggered: Number(signals.projectionRowCount ?? 0) > 45,
        reason: 'Packet projection surface exceeds single-pass hard limit.',
      },
      {
        id: 'required_command_projection_count_gt_8',
        actual: signals.requiredCommandProjectionCount ?? 0,
        threshold: '>8',
        triggered: Number(signals.requiredCommandProjectionCount ?? 0) > 8,
        reason: 'Packet command projection surface exceeds single-pass hard limit.',
      },
      {
        id: 'failure_edge_projection_count_gt_12',
        actual: signals.failureEdgeProjectionCount ?? 0,
        threshold: '>12',
        triggered: Number(signals.failureEdgeProjectionCount ?? 0) > 12,
        reason: 'Packet failure and edge projection surface exceeds single-pass hard limit.',
      },
      {
        id: 'growth_ratio_from_initial_gte_2',
        actual: signals.growthRatioFromInitial ?? 1,
        threshold: '>=2.0',
        triggered: Number(signals.growthRatioFromInitial ?? 1) >= 2.0,
        reason: 'Packet-derived surface expanded beyond initial single-pass routing.',
      },
      {
        id: 'semantic_gap_count_gt_0',
        actual: signals.semanticGapCount ?? 0,
        threshold: '>0',
        triggered: Number(signals.semanticGapCount ?? 0) > 0,
        reason: 'Open semantic gaps require checkpoint-safe amendment handling.',
      },
      {
        id: 'open_decision_count_gt_0',
        actual: signals.openDecisionCount ?? 0,
        threshold: '>0',
        triggered: Number(signals.openDecisionCount ?? 0) > 0,
        reason: 'Open decisions require checkpoint-safe amendment handling.',
      }
    );
  }
  if (phase === 'post_materialization_assessment') {
    triggers.push(
      {
        id: 'materialized_projection_growth_ratio_gte_1_25',
        actual: signals.materializedProjectionGrowthRatio ?? 1,
        threshold: '>=1.25',
        triggered: Number(signals.materializedProjectionGrowthRatio ?? 1) >= 1.25,
        reason: 'Materialized projection surface expanded beyond post-packet routing.',
      },
      {
        id: 'packet_source_reconciliation_not_pass',
        actual: signals.packetSourceReconciliationVerdict ?? 'missing',
        threshold: 'pass',
        triggered: signals.packetSourceReconciliationVerdict !== 'pass',
        reason: 'Packet/source reconciliation must pass before final single-pass.',
      }
    );
  }
  return triggers;
}

function amendmentRiskSignals(text, progressExists, confirmation) {
  const lowered = String(text).toLowerCase();
  const amendmentMarkerCount = countMatches(
    text,
    /\breconfirm_required\b|\breconfirmation\b|\bamendment\b|\bkernel amendment\b|definition blocker|blocking assumption|阻断|需重新确认|修订/giu
  );
  return {
    amendmentMarkerCount,
    amendmentRisk:
      progressExists ||
      amendmentMarkerCount > 0 ||
      Number(confirmation.blockingOpenQuestionCount ?? 0) > 0 ||
      Number(confirmation.blockingAssumptionCount ?? 0) > 0 ||
      lowered.includes('reconfirm_required'),
  };
}

function authoringModeFor(decision, signals) {
  if (decision === 'checkpoint_required_with_amendment' || signals?.amendmentRisk) {
    return AUTHORING_MODES.SEMANTIC_KERNEL_THEN_PACKET_WITH_AMENDMENT;
  }
  return AUTHORING_MODES.SEMANTIC_KERNEL_THEN_PACKET;
}

function defaultProgressPath(sourcePath) {
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join('_bmad-output', 'runtime', 'requirement-records', base, 'authoring', 'semantic-checkpoint-progress.json');
}

function currentSourceBinding(sourcePath) {
  const absolute = path.resolve(sourcePath);
  const text = fs.readFileSync(absolute, 'utf8');
  try {
    const extracted = extractImplementationConfirmation(text);
    return {
      absolute,
      text,
      confirmation: extracted.confirmation,
      recordId: String(extracted.confirmation?.recordId ?? '').trim(),
      sourceDocumentHash: sourceDocumentHashFor(text, extracted.blockText, extracted.confirmation),
      implementationConfirmationHash: implementationConfirmationHashFor(extracted.confirmation),
    };
  } catch (_error) {
    return {
      absolute,
      text,
      confirmation: null,
      recordId: '',
      sourceDocumentHash: sha256(text),
      implementationConfirmationHash: null,
    };
  }
}

function countRows(value) {
  return Array.isArray(value) ? value.length : 0;
}

function packetProjectionCount(packet, names) {
  return (packet?.mustPackets ?? []).reduce(
    (sum, mustPacket) => sum + names.reduce((inner, name) => inner + countRows(mustPacket?.[name]), 0),
    0
  );
}

function countAiTddManifestSections(packet) {
  const manifest = packet?.aiTddContractExecutionManifestProjection;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return 0;
  return Object.keys(manifest).length;
}

function currentGapCount(packet) {
  return [
    ...(packet?.semanticGaps ?? []),
    ...(packet?.validatedGaps ?? []),
    ...(packet?.gaps ?? []),
  ].filter((gap) => !['resolved', 'closed', 'waived', 'converted_to_out_boundary'].includes(String(gap?.status ?? 'open'))).length;
}

function openDecisionCount(packet) {
  return [
    ...(packet?.questions ?? []),
    ...(packet?.openQuestions ?? []),
    ...(packet?.decisionPoints ?? []),
  ].filter((item) => !['resolved', 'closed', 'waived'].includes(String(item?.status ?? 'open'))).length;
}

function domainsFromPacket(packet, fallback = []) {
  const domains = new Set(fallback);
  const scan = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    for (const domain of CONDITIONAL_DOMAINS) {
      if (value.domain === domain || value.conditionalDomain === domain || value.domainId === domain) domains.add(domain);
      if (value[domain]?.applies === true) domains.add(domain);
    }
    Object.values(value).forEach(scan);
  };
  scan(packet);
  return [...domains].sort();
}

function packetSignals(packet, initialAssessment, fallbackDomains = []) {
  const mustPackets = Array.isArray(packet?.mustPackets) ? packet.mustPackets : [];
  const mustCandidateCount = new Set(mustPackets.map((item) => item?.mustRef).filter(Boolean)).size;
  const mustAtomicTaskCount = mustPackets.reduce((sum, item) => sum + countRows(item?.mustAtomicTasks), 0);
  const evidenceProjectionCount = packetProjectionCount(packet, ['mustEvidenceProjection']);
  const traceProjectionCount = packetProjectionCount(packet, ['mustTraceProjection']);
  const acceptanceProjectionCount = packetProjectionCount(packet, ['mustAcceptanceProjection']);
  const failureEdgeProjectionCount = packetProjectionCount(packet, ['mustFailureEdgeProjection']);
  const targetModificationPathCount = packetProjectionCount(packet, ['mustTargetPathProjection']);
  const requiredCommandProjectionCount = packetProjectionCount(packet, ['mustCommandProjection']);
  const artifactProjectionCount = packetProjectionCount(packet, ['mustArtifactProjection']);
  const projectionRowCount =
    evidenceProjectionCount +
    traceProjectionCount +
    acceptanceProjectionCount +
    failureEdgeProjectionCount +
    targetModificationPathCount +
    requiredCommandProjectionCount +
    artifactProjectionCount +
    packetProjectionCount(packet, ['mustExecutionDecompositionMatrix']);
  const applicableConditionalDomains = domainsFromPacket(packet, fallbackDomains);
  const initialProjectionWeight =
    Number(initialAssessment?.signals?.confirmationIdCount ?? 0) +
    Number(initialAssessment?.signals?.requiredCommandCount ?? 0);
  const postPacketProjectionWeight = projectionRowCount + mustAtomicTaskCount + requiredCommandProjectionCount;
  return {
    mustCandidateCount,
    mustAtomicTaskCount,
    projectionRowCount,
    evidenceProjectionCount,
    traceProjectionCount,
    acceptanceProjectionCount,
    failureEdgeProjectionCount,
    targetModificationPathCount,
    requiredCommandProjectionCount,
    aiTddManifestSectionCount: countAiTddManifestSections(packet),
    semanticGapCount: currentGapCount(packet),
    openDecisionCount: openDecisionCount(packet),
    applicableConditionalDomains,
    conditionalDomainCount: applicableConditionalDomains.length,
    initialProjectionWeight,
    postPacketProjectionWeight,
    growthRatioFromInitial: Math.max(1, postPacketProjectionWeight) / Math.max(1, initialProjectionWeight),
  };
}

function materializedProjectionRowCount(confirmation) {
  if (!confirmation || typeof confirmation !== 'object') return 0;
  const rows = [];
  const collect = (value) => {
    if (Array.isArray(value)) {
      rows.push(...value.filter((item) => item && typeof item === 'object'));
      value.forEach(collect);
      return;
    }
    if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(confirmation);
  return rows.filter((row) => row.derivedFromPacketHash || row.derivedFromMustRef || row.packetProjectionRef).length;
}

function buildAssessment(sourcePath, progressPath = '', options = {}) {
  const phase = options.phase ?? 'initial_assessment';
  const binding = currentSourceBinding(sourcePath);
  const { absolute, text } = binding;
  const confirmation = confirmationSignals(text);
  const progress = progressPath || (binding.recordId
    ? path.join('_bmad-output', 'runtime', 'requirement-records', binding.recordId, 'authoring', 'semantic-checkpoint-progress.json')
    : defaultProgressPath(absolute));
  const progressExists = fs.existsSync(path.resolve(progress));
  const amendment = amendmentRiskSignals(text, progressExists, confirmation);
  const signals = {
    lineCount: text.replace(/\r\n/g, '\n').split('\n').length,
    byteLength: Buffer.byteLength(text, 'utf8'),
    sectionCount: countMatches(text, /^#{1,6}\s+/gmu),
    mermaidBlockCount: countMatches(text, /```mermaid/giu),
    progressPath: normalizePathForReport(progress),
    progressExists,
    ...confirmation,
    ...amendment,
  };
  signals.conditionalDomainCount = signals.applicableConditionalDomains.length;
  signals.sourceDocumentHash = binding.sourceDocumentHash;
  signals.implementationConfirmationHash = binding.implementationConfirmationHash;
  signals.confirmationIdCount =
    signals.mustCount + signals.negCount + signals.outCount + signals.evidenceCount + signals.traceRowCount;
  const blockingReasons = [];
  let blockingState = null;
  if (phase === 'post_packet_assessment') {
    const kernel = unwrapKnownJson(readJsonIfExists(options.semanticKernel), ['semanticKernel', 'semantic_kernel']);
    const packet = unwrapKnownJson(readJsonIfExists(options.packet), ['must_decomposition_packet', 'mustDecompositionPacket']);
    const initialAssessment = readJsonIfExists(options.initialAssessment);
    if (!kernel || kernel.schemaVersion !== 'semantic-kernel/v1') blockingReasons.push('missing_or_invalid_semantic_kernel');
    if (kernel && kernel.sourceDocumentHash !== binding.sourceDocumentHash) blockingReasons.push('semantic_kernel_source_hash_stale');
    if (!packet || packet.schemaVersion !== 'must-decomposition-packet/v1') blockingReasons.push('missing_or_invalid_must_decomposition_packet');
    if (packet && packet.status !== 'synchronized') blockingReasons.push('must_decomposition_packet_not_synchronized');
    if (packet && packet.sourceDocumentHash !== binding.sourceDocumentHash) blockingReasons.push('must_decomposition_packet_source_hash_stale');
    if (packet && kernel && packet.semanticKernelHash && kernel.kernelHash && packet.semanticKernelHash !== kernel.kernelHash) {
      blockingReasons.push('must_decomposition_packet_semantic_kernel_hash_stale');
    }
    Object.assign(signals, packetSignals(packet, initialAssessment, signals.applicableConditionalDomains));
  }
  if (phase === 'post_materialization_assessment') {
    const postPacketAssessment = readJsonIfExists(options.postPacketAssessment);
    const reconciliation = readJsonIfExists(options.packetSourceReconciliation);
    const materializedRows = materializedProjectionRowCount(binding.confirmation);
    const postPacketProjectionWeight = Number(postPacketAssessment?.signals?.postPacketProjectionWeight ?? 0);
    signals.materializedProjectionRowCount = materializedRows;
    signals.materializedProjectionGrowthRatio = Math.max(1, materializedRows) / Math.max(1, postPacketProjectionWeight);
    signals.packetSourceReconciliationVerdict = reconciliation?.verdict ?? 'missing';
    if (!reconciliation) blockingReasons.push('missing_packet_source_reconciliation');
    else if (reconciliation.verdict !== 'pass') blockingReasons.push('packet_source_reconciliation_not_pass');
  }
  if (blockingReasons.length > 0) {
    blockingState = blockingReasons.includes('missing_packet_source_reconciliation')
      ? 'blocked_by_missing_packet_source_reconciliation'
      : blockingReasons.includes('packet_source_reconciliation_not_pass')
        ? 'blocked_by_packet_source_drift'
        : 'blocked_by_stale_scale_assessment_hash';
  }
  const scoring = scoreBreakdown(signals);
  const hardTriggers = hardTriggerBreakdown(signals, phase);
  const score = scoring.reduce((sum, item) => sum + item.points, 0);
  const checkpointRequired = blockingReasons.length > 0 || score >= 6 || hardTriggers.some((item) => item.triggered);
  const decision = blockingReasons.length > 0
    ? 'checkpoint_required_with_amendment'
    : checkpointRequired
    ? (signals.amendmentRisk ? 'checkpoint_required_with_amendment' : 'checkpoint_required')
    : 'single_pass_allowed';
  const authoringMode = authoringModeFor(decision, signals);
  const riskLevel = score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low';
  const recommendedCheckpoints = decision === 'single_pass_allowed' ? [] : CHECKPOINT_IDS_PRE_RENDER;
  const scoreReason = score >= 6 ? `score ${score} >= checkpoint threshold 6` : `score ${score} < checkpoint threshold 6`;
  const triggeredHardTriggers = hardTriggers.filter((item) => item.triggered).map((item) => item.id);
  const assessment = {
    schemaVersion: 'contract-authoring-scale-assessment/v1',
    phase,
    recordId: binding.recordId || null,
    target: normalizePathForReport(absolute),
    decision,
    provisionalDecision: phase === 'initial_assessment' && decision === 'single_pass_allowed'
      ? 'provisional_single_pass_allowed'
      : null,
    blockingState,
    blockingReasons,
    authoringMode,
    riskLevel,
    score,
    scoreBreakdown: scoring,
    hardTriggerBreakdown: hardTriggers,
    thresholds: {
      checkpointScore: 6,
      lineHardTrigger: 600,
      byteHardTrigger: 35000,
      idHardTrigger: 45,
      conditionalDomainHardTrigger: 2,
    },
    signals,
    assessmentTrace: {
      visibleOutputStream: 'stderr',
      stdoutContract: 'json_only',
      start: {
        phase,
        source: normalizePathForReport(absolute),
        progressPath: signals.progressPath,
      },
      process: {
        scoreReason,
        triggeredHardTriggers,
        scoreBreakdown: scoring,
        hardTriggerBreakdown: hardTriggers,
      },
      result: {
        phase,
        decision,
        authoringMode,
        riskLevel,
        checkpointRequired,
        recommendedCheckpointCount: recommendedCheckpoints.length,
      },
    },
    recommendedCheckpoints,
  };
  if (options.semanticKernel) {
    const kernel = unwrapKnownJson(readJsonIfExists(options.semanticKernel), ['semanticKernel', 'semantic_kernel']);
    assessment.semanticKernelHash = kernel?.kernelHash ?? (kernel ? sha256Json(kernel) : null);
  }
  if (options.packet) {
    const packet = unwrapKnownJson(readJsonIfExists(options.packet), ['must_decomposition_packet', 'mustDecompositionPacket']);
    assessment.mustDecompositionPacketHash = packet?.packetHash ?? (packet ? sha256Json(packet) : null);
  }
  return assessment;
}

const CHECKPOINT_IDS_PRE_RENDER = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-atomic-decomposition-loop-convergence',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
];

const ROUTE_DECISION_RANK = {
  single_pass_allowed: 0,
  single_pass_final_allowed: 0,
  checkpoint_required: 1,
  checkpoint_required_with_amendment: 2,
};

const ROUTE_HASH_EXCLUDED_FIELDS = new Set([
  'routeDecisionHash',
  'checkpointPersistenceSatisfied',
  'checkpointPersistenceRef',
  'createdAt',
  'createdBy',
]);

function routeHashInput(value) {
  if (Array.isArray(value)) return value.map(routeHashInput);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (ROUTE_HASH_EXCLUDED_FIELDS.has(key) || key.endsWith('RecordedAt')) continue;
    result[key] = routeHashInput(item);
  }
  return result;
}

function strongestRouteDecision(assessments) {
  return assessments.reduce((strongest, assessment) => {
    const decision = assessment?.decision ?? 'single_pass_allowed';
    return ROUTE_DECISION_RANK[decision] > ROUTE_DECISION_RANK[strongest] ? decision : strongest;
  }, 'single_pass_allowed');
}

function assessmentRef(filePath, assessment) {
  return {
    path: filePath ? normalizePathForReport(filePath) : null,
    hash: assessment ? sha256Json(assessment) : null,
  };
}

function buildScaleRoutingDecision({ sourcePath, initial, postPacket, postMaterialization, refs = {}, checkpointPersistence = null }) {
  const assessments = [initial, postPacket, postMaterialization].filter(Boolean);
  let decision = strongestRouteDecision(assessments);
  let blockingState = null;
  const blockingReasons = [];
  const latestCompletedPhase = postMaterialization?.phase ?? postPacket?.phase ?? initial?.phase ?? null;
  let decisionSource =
    assessments.find((assessment) => assessment?.decision === decision)?.phase ??
    latestCompletedPhase ??
    'initial_assessment';

  if (!initial) {
    decision = 'checkpoint_required_with_amendment';
    decisionSource = 'initial_assessment';
    blockingState = 'blocked_by_missing_initial_assessment';
    blockingReasons.push('missing_initial_assessment');
  } else if (!postPacket && decision === 'single_pass_allowed') {
    decision = 'checkpoint_required_with_amendment';
    decisionSource = 'post_packet_assessment';
    blockingState = 'blocked_by_missing_post_packet_assessment';
    blockingReasons.push('missing_post_packet_assessment');
  } else if (!postMaterialization && decision === 'single_pass_allowed') {
    decision = 'checkpoint_required_with_amendment';
    decisionSource = 'post_materialization_assessment';
    blockingState = 'blocked_by_missing_post_materialization_assessment';
    blockingReasons.push('missing_post_materialization_assessment');
  } else if (decision === 'single_pass_allowed') {
    decision = 'single_pass_final_allowed';
    decisionSource = 'post_materialization_assessment';
  }

  for (const assessment of assessments) {
    if (assessment?.blockingState && !blockingState) blockingState = assessment.blockingState;
    for (const reason of assessment?.blockingReasons ?? []) blockingReasons.push(reason);
  }

  const sourceDocumentHash = postMaterialization?.signals?.sourceDocumentHash ?? postPacket?.signals?.sourceDocumentHash ?? initial?.signals?.sourceDocumentHash ?? null;
  const implementationConfirmationHash =
    postMaterialization?.signals?.implementationConfirmationHash ??
    postPacket?.signals?.implementationConfirmationHash ??
    initial?.signals?.implementationConfirmationHash ??
    null;
  const reconciliationVerdict = postMaterialization?.signals?.packetSourceReconciliationVerdict;
  if (decision === 'single_pass_final_allowed' && reconciliationVerdict !== 'pass') {
    decision = 'checkpoint_required_with_amendment';
    decisionSource = 'post_materialization_assessment';
    blockingState = reconciliationVerdict === 'missing'
      ? 'blocked_by_missing_packet_source_reconciliation'
      : 'blocked_by_packet_source_drift';
    blockingReasons.push(blockingState);
  }
  const checkpointPersistenceSatisfied = checkpointPersistence?.checkpointPersistenceSatisfied === true;
  if (
    checkpointPersistenceSatisfied &&
    (decision === 'checkpoint_required' || decision === 'checkpoint_required_with_amendment') &&
    !blockingState &&
    reconciliationVerdict === 'pass'
  ) {
    decision = 'single_pass_final_allowed';
    decisionSource = 'checkpoint_persistence_satisfied';
    blockingReasons.length = 0;
  }

  const route = {
    schemaVersion: 'contract-authoring-scale-routing-decision/v1',
    recordId: initial?.recordId ?? postPacket?.recordId ?? postMaterialization?.recordId ?? null,
    requirementSetId: initial?.recordId ?? postPacket?.recordId ?? postMaterialization?.recordId ?? null,
    latestCompletedPhase,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash: postPacket?.semanticKernelHash ?? postMaterialization?.semanticKernelHash ?? null,
    mustDecompositionPacketHash: postPacket?.mustDecompositionPacketHash ?? postMaterialization?.mustDecompositionPacketHash ?? null,
    packetSourceReconciliationHash: refs.packetSourceReconciliationHash ?? null,
    initialAssessmentRef: assessmentRef(refs.initialAssessment, initial),
    postPacketAssessmentRef: assessmentRef(refs.postPacketAssessment, postPacket),
    postMaterializationAssessmentRef: assessmentRef(refs.postMaterializationAssessment, postMaterialization),
    decision,
    decisionSource,
    checkpointScoreThreshold: 6,
    inputRefs: [
      refs.initialAssessment,
      refs.postPacketAssessment,
      refs.postMaterializationAssessment,
      refs.packetSourceReconciliation,
    ].filter(Boolean).map(normalizePathForReport),
    monotonicUpgrade: decision !== 'single_pass_final_allowed',
    previousDecision: initial?.provisionalDecision ?? initial?.decision ?? null,
    blockingSinglePassReason: blockingReasons[0] ?? null,
    blockingState,
    blockingReasons: [...new Set(blockingReasons)],
    nextAction: decision === 'single_pass_final_allowed'
      ? 'continue_pre_render_readiness'
      : blockingState === 'blocked_by_missing_packet_source_reconciliation' || blockingState === 'blocked_by_packet_source_drift'
        ? 'run_packet_source_reconciliation'
        : 'run_checkpoint_persistence_or_authoring_repair',
    checkpointPersistenceSatisfied,
    checkpointPersistenceRef: checkpointPersistence?.checkpointPersistenceRef ?? null,
    createdBy: 'requirements-contract-authoring',
    createdAt: new Date().toISOString(),
  };
  route.routeDecisionHash = sha256Json(routeHashInput(route));
  return route;
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(',') : 'none';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value === undefined || value === null || value === '') return 'none';
  return String(value);
}

function formatAssessmentTrace(assessment) {
  const lines = [
    `[requirements-contract-authoring] scale assessment started phase=${assessment.phase ?? 'initial_assessment'}`,
    `source=${assessment.target}`,
    `progress=${assessment.signals.progressPath}`,
    `[requirements-contract-authoring] signals phase=${assessment.phase ?? 'initial_assessment'}`,
    [
      `lineCount=${assessment.signals.lineCount}`,
      `byteLength=${assessment.signals.byteLength}`,
      `sectionCount=${assessment.signals.sectionCount}`,
      `mermaidBlockCount=${assessment.signals.mermaidBlockCount}`,
      `confirmationIdCount=${assessment.signals.confirmationIdCount}`,
      `requiredCommandCount=${assessment.signals.requiredCommandCount}`,
      `progressExists=${assessment.signals.progressExists}`,
      `amendmentRisk=${assessment.signals.amendmentRisk}`,
      `conditionalDomains=${formatValue(assessment.signals.applicableConditionalDomains)}`,
    ].join(' '),
    `[requirements-contract-authoring] score breakdown phase=${assessment.phase ?? 'initial_assessment'}`,
    ...assessment.scoreBreakdown.map((item) =>
      `${item.points > 0 ? '+' : ''}${item.points} ${item.id} actual=${formatValue(item.actual)} threshold="${item.threshold}" triggered=${item.triggered}`
    ),
    `[requirements-contract-authoring] score result score=${assessment.score} checkpointThreshold=${assessment.thresholds.checkpointScore}`,
    `[requirements-contract-authoring] hard triggers phase=${assessment.phase ?? 'initial_assessment'}`,
    ...assessment.hardTriggerBreakdown.map((item) =>
      `${item.triggered ? 'TRIGGERED' : 'clear'} ${item.id} actual=${formatValue(item.actual)} threshold="${item.threshold}"`
    ),
    `[requirements-contract-authoring] scale assessment result phase=${assessment.phase ?? 'initial_assessment'}`,
    [
      `decision=${assessment.decision}`,
      `routeDecision=${assessment.decision === 'single_pass_allowed' && assessment.phase === 'initial_assessment' ? 'provisional_single_pass_allowed' : assessment.decision}`,
      `monotonicUpgrade=${assessment.decision !== 'single_pass_allowed'}`,
      `authoringMode=${assessment.authoringMode}`,
      `riskLevel=${assessment.riskLevel}`,
      `recommendedCheckpointCount=${assessment.recommendedCheckpoints.length}`,
    ].join(' '),
  ];
  return `${lines.join('\n')}\n`;
}

function emitVisibleTrace(assessment) {
  process.stderr.write(formatAssessmentTrace(assessment));
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: args.error }, null, 2));
    return 2;
  }
  if (!fs.existsSync(path.resolve(args.source))) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: 'source document file not found' }, null, 2));
    return 1;
  }
  const assessment = buildAssessment(args.source, args.progress, args);
  const output = `${JSON.stringify(assessment, null, 2)}\n`;
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), output, 'utf8');
  }
  if (args.routingDecisionOut) {
    const currentRef = args.out || '';
    const initial = args.phase === 'initial_assessment'
      ? assessment
      : readJsonIfExists(args.initialAssessment);
    const postPacket = args.phase === 'post_packet_assessment'
      ? assessment
      : readJsonIfExists(args.postPacketAssessment);
    const postMaterialization = args.phase === 'post_materialization_assessment'
      ? assessment
      : null;
    const checkpointPersistenceEvidence = readJsonIfExists(args.checkpointPersistenceEvidence);
    const packetSourceReconciliationHash = args.packetSourceReconciliation && fs.existsSync(path.resolve(args.packetSourceReconciliation))
      ? sha256(fs.readFileSync(path.resolve(args.packetSourceReconciliation), 'utf8'))
      : null;
    const routing = buildScaleRoutingDecision({
      sourcePath: args.source,
      initial,
      postPacket,
      postMaterialization,
      refs: {
        initialAssessment: args.phase === 'initial_assessment' ? currentRef : args.initialAssessment,
        postPacketAssessment: args.phase === 'post_packet_assessment' ? currentRef : args.postPacketAssessment,
        postMaterializationAssessment: args.phase === 'post_materialization_assessment' ? currentRef : '',
        packetSourceReconciliation: args.packetSourceReconciliation,
        packetSourceReconciliationHash,
      },
      checkpointPersistence: checkpointPersistenceEvidence?.checkpointPersistenceSatisfiedCandidate === true
        ? {
            checkpointPersistenceSatisfied: true,
            checkpointPersistenceRef: checkpointPersistenceEvidence.checkpointPersistenceRef ?? null,
          }
        : null,
    });
    fs.mkdirSync(path.dirname(path.resolve(args.routingDecisionOut)), { recursive: true });
    fs.writeFileSync(path.resolve(args.routingDecisionOut), `${JSON.stringify(routing, null, 2)}\n`, 'utf8');
    if (!args.quiet && routing.monotonicUpgrade) {
      process.stderr.write(
        `[requirements-contract-authoring] scale routing upgrade\nfrom=${routing.previousDecision ?? 'none'} to=${routing.decision} source=${routing.decisionSource} reason=${routing.blockingSinglePassReason ?? 'checkpoint_threshold'}\n`
      );
    }
  }
  if (!args.quiet) emitVisibleTrace(assessment);
  process.stdout.write(output);
  return 0;
}

module.exports = {
  buildAssessment,
  buildScaleRoutingDecision,
  emitVisibleTrace,
  formatAssessmentTrace,
  hardTriggerBreakdown,
  parseArgs,
  routeHashInput,
  scoreBreakdown,
};

if (require.main === module) process.exit(main(process.argv.slice(2)));
