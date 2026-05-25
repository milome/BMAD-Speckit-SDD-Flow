#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { extractImplementationConfirmation, normalizePathForReport } = require('./pre_render_definition_drilldown_lib');

const CONDITIONAL_DOMAINS = [
  'governanceEvents',
  'runtimeRecovery',
  'scoringDashboardSft',
  'currentTargetMap',
  'scriptsAndHooks',
];
const AUTHORING_MODES = {
  SINGLE_PASS: 'single_pass',
  KERNEL_THEN_CHECKPOINT: 'kernel_then_checkpoint',
  KERNEL_THEN_CHECKPOINT_WITH_AMENDMENT: 'kernel_then_checkpoint_with_amendment',
};

function usage(exitCode = 0) {
  console.log(`Usage:
  node assess_contract_authoring_scale.js --source <source-document.md> [--progress <progress.json>] [--out <assessment.json>] [--json]

Classifies requirements contract authoring as single_pass or checkpoint_required, with semantic-kernel-first authoringMode.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { source: '', progress: '', out: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--source' || arg === '--progress' || arg === '--out') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      if (arg === '--source') args.source = next;
      if (arg === '--progress') args.progress = next;
      if (arg === '--out') args.out = next;
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
  let score = 0;
  if (signals.lineCount > 600) score += 4;
  else if (signals.lineCount > 300) score += 2;
  if (signals.byteLength > 35000) score += 4;
  else if (signals.byteLength > 18000) score += 2;
  if (signals.sectionCount > 20) score += 2;
  else if (signals.sectionCount > 10) score += 1;
  if (signals.confirmationIdCount > 45) score += 4;
  else if (signals.confirmationIdCount > 20) score += 2;
  score += Math.min(signals.applicableConditionalDomains.length * 2, 6);
  if (signals.mermaidBlockCount > 5) score += 2;
  if (signals.requiredCommandCount > 8) score += 2;
  if (signals.progressExists) score += 5;
  if (signals.amendmentRisk) score += 3;
  return score;
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
  if (decision === 'single_pass') return AUTHORING_MODES.SINGLE_PASS;
  if (signals?.amendmentRisk) return AUTHORING_MODES.KERNEL_THEN_CHECKPOINT_WITH_AMENDMENT;
  return AUTHORING_MODES.KERNEL_THEN_CHECKPOINT;
}

function defaultProgressPath(sourcePath) {
  const base = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join('_bmad-output', 'runtime', 'requirement-records', base, 'authoring', 'semantic-checkpoint-progress.json');
}

function buildAssessment(sourcePath, progressPath = '') {
  const absolute = path.resolve(sourcePath);
  const text = fs.readFileSync(absolute, 'utf8');
  const confirmation = confirmationSignals(text);
  let recordId = '';
  try {
    const extracted = extractImplementationConfirmation(text);
    recordId = String(extracted.confirmation?.recordId ?? '').trim();
  } catch (_error) {
    recordId = '';
  }
  const progress = progressPath || (recordId
    ? path.join('_bmad-output', 'runtime', 'requirement-records', recordId, 'authoring', 'semantic-checkpoint-progress.json')
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
  signals.confirmationIdCount =
    signals.mustCount + signals.negCount + signals.outCount + signals.evidenceCount + signals.traceRowCount;
  const score = scoreSignals(signals);
  const hardTriggers = [
    signals.lineCount > 600,
    signals.byteLength > 35000,
    signals.confirmationIdCount > 45,
    signals.applicableConditionalDomains.length >= 2,
    progressExists,
    signals.amendmentRisk,
  ];
  const decision = score >= 6 || hardTriggers.some(Boolean) ? 'checkpoint_required' : 'single_pass';
  const authoringMode = authoringModeFor(decision, signals);
  return {
    schemaVersion: 'requirements-contract-scale-assessment/v1',
    target: normalizePathForReport(absolute),
    decision,
    authoringMode,
    riskLevel: score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low',
    score,
    thresholds: {
      checkpointScore: 6,
      lineHardTrigger: 600,
      byteHardTrigger: 35000,
      idHardTrigger: 45,
      conditionalDomainHardTrigger: 2,
    },
    signals,
    recommendedCheckpoints: decision === 'checkpoint_required' ? CHECKPOINT_IDS_PRE_RENDER : [],
  };
}

const CHECKPOINT_IDS_PRE_RENDER = [
  'cp-01-header-scope-decisions',
  'cp-02-confirmation-core-applicability',
  'cp-03-must-neg-out-evidence',
  'cp-04-failure-edge-trace',
  'cp-05-views',
  'cp-06-artifacts-commands-closeout',
  'cp-07-conditional-modules',
  'cp-08-human-readable-views-dod-reverse-audit',
];

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
  const assessment = buildAssessment(args.source, args.progress);
  const output = `${JSON.stringify(assessment, null, 2)}\n`;
  if (args.out) fs.writeFileSync(path.resolve(args.out), output, 'utf8');
  process.stdout.write(output);
  return 0;
}

module.exports = { buildAssessment, parseArgs };

if (require.main === module) process.exit(main(process.argv.slice(2)));
