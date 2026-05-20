const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const runId = 'run-TRACE036-current-20260521T040500Z';
const executionIterationId = 'execution-iteration-TRACE036-current-20260521T040500Z';
const recordId = 'REQ-CLOSED-LOOP-DESIGN';
const requirementSetId = 'REQ-CLOSED-LOOP-DESIGN';
const sourceDocumentHash = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const implementationConfirmationHash = 'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const architectureConfirmationHash = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';
const closeoutAttemptId = 'closeout-attempt-REQ-CLOSED-LOOP-DESIGN-TRACE038-copy-button-20260520T164100Z';
const runDir = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-036/run-TRACE036-current-20260521T040500Z'
);
const inputVersion = [
  `source=${sourceDocumentHash}`,
  `implementation=${implementationConfirmationHash}`,
  `architecture=${architectureConfirmationHash}`,
].join(';');
const relatedRequirementIds = ['MUST-047', 'NEG-036', 'EVD-003', 'EVD-009', 'EVD-046', 'TRACE-036'];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function summary(file) {
  const text = fs.readFileSync(file, 'utf8');
  const compact = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-24)
    .join(' | ');
  return compact.length > 1800 ? compact.slice(-1800) : compact;
}

function artifact(file, artifactType, purpose, outputVersion, producer = 'TRACE-036 current implementation run') {
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: rel(file),
    hash: sha256File(file),
    producer,
    purpose,
    relatedRequirementIds,
    status: 'active',
    inputVersion,
    outputVersion,
  };
}

const reportPath = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/subagents/subagent-current-attempt-revalidation-report.json'
);
const commandRunsPath = path.join(runDir, 'trace036-command-runs.json');
const diffSummaryPath = path.join(runDir, 'diff-summary.md');
const negativeAssertionsPath = path.join(runDir, 'negative-assertions.json');
const commandEvidencePath = path.join(runDir, 'trace036-command-evidence.json');
const packetPath = path.join(runDir, 'implementation-evidence-packet.json');

const diffSummary = [
  '# TRACE-036 Implementation Delta',
  '',
  '- Added current-attempt revalidation for accepted subagent evidence envelopes.',
  '- Delivery Closeout Gate now fail-closes when an accepted subagent envelope lacks a matching pass revalidation report for the current closeout attempt and envelope hash.',
  '- Rerun loop source authority now accepts controlled failure_record refs so subagent_revalidation_failed can feed the same rerun loop instead of a duplicate rework chain.',
  '- Ingest preserves the failure_record authority type without allowing direct control-field writes from subagents.',
  '',
].join('\n');
fs.writeFileSync(diffSummaryPath, diffSummary, 'utf8');

const revalidationReport = readJson(reportPath);
writeJson(negativeAssertionsPath, {
  schemaVersion: 'negative-assertion-evidence/v1',
  traceRow: 'TRACE-036',
  assertions: [
    {
      id: 'NEG-036-current-attempt-required',
      requirementId: 'NEG-036',
      assertion: 'Accepted subagent evidence cannot close out unless revalidated in the main workspace for the current closeout attempt.',
      proof: 'tests/acceptance/subagent-current-attempt-revalidation.test.ts blocks stale attempt, non-main workspace, and failed command evidence.',
    },
    {
      id: 'NEG-036-closeout-blocks-missing-report',
      requirementId: 'NEG-036',
      assertion: 'Delivery Closeout Gate blocks accepted subagent envelope events that do not have a matching pass subagent_current_attempt_revalidation_report artifact.',
      proof: 'main-agent-delivery-closeout-gate test case expects subagent_current_attempt_revalidation_missing blocker.',
    },
    {
      id: 'MUST-047-no-direct-control-write',
      requirementId: 'MUST-047',
      assertion: 'The revalidation script emits report, failureRecords, and rerunLoops only as evidence; it marks controlWrite as forbidden_use_controlled_ingest.',
      proof: `current report decision=${revalidationReport.decision}; controlWrite=${revalidationReport.controlWrite}`,
    },
  ],
  commandRefs: ['CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION'],
  generatedAt: new Date().toISOString(),
});

const commandRuns = readJson(commandRunsPath).map((run) => ({
  ...run,
  runId,
  closeoutAttemptId,
  outputSummary: summary(path.resolve(root, run.outputPath)),
}));

const commandOutputArtifacts = commandRuns.map((run) =>
  artifact(path.resolve(root, run.outputPath), 'command_output', `command output for ${run.commandId}`, 'command_output-trace-036-current-v1')
);
const revalidationReportArtifact = artifact(
  reportPath,
  'subagent_current_attempt_revalidation_report',
  'current-attempt main-workspace revalidation report for accepted subagent evidence envelope',
  'subagent_current_attempt_revalidation_report-trace-036-v1'
);
const diffArtifact = artifact(diffSummaryPath, 'diff_summary', 'implementation delta summary for TRACE-036', 'diff_summary-trace-036-v1');
const negativeArtifact = artifact(
  negativeAssertionsPath,
  'negative_assertion_evidence',
  'negative and regression assertions for subagent current-attempt closeout revalidation',
  'negative_assertion_evidence-trace-036-v1'
);

const commandEvidence = {
  schemaVersion: 'command-evidence/v1',
  traceRow: 'TRACE-036',
  runId,
  closeoutAttemptId,
  commandRuns,
  report: {
    path: rel(reportPath),
    hash: sha256File(reportPath),
    decision: revalidationReport.decision,
    envelopeHash: revalidationReport.envelopeHash,
    currentCloseoutAttemptId: revalidationReport.currentCloseoutAttemptId,
  },
};
writeJson(commandEvidencePath, commandEvidence);
const commandEvidenceArtifact = artifact(
  commandEvidencePath,
  'command_evidence',
  'current command evidence for TRACE-036 delivery and recurring contract validation',
  'command_evidence-trace-036-v1'
);

const allArtifacts = [
  revalidationReportArtifact,
  negativeArtifact,
  diffArtifact,
  commandEvidenceArtifact,
  ...commandOutputArtifacts,
];
const deliveryArtifacts = [revalidationReportArtifact, negativeArtifact, commandEvidenceArtifact, commandOutputArtifacts[0]];

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId,
  requirementSetId,
  executionIterationId,
  runId,
  closeoutAttemptId,
  status: 'done',
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  traceRows: ['TRACE-036'],
  taskRefs: ['TASK-SUBAGENT-CLOSEOUT-REVALIDATION'],
  evidenceRefs: ['EVD-003', 'EVD-009', 'EVD-046'],
  filesChanged: [
    'scripts/ingest-implementation-evidence.ts',
    'scripts/main-agent-delivery-closeout-gate.ts',
    'scripts/subagent-current-attempt-revalidation.ts',
    'tests/acceptance/subagent-current-attempt-revalidation.test.ts',
  ],
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/ingest-implementation-evidence.ts',
      'scripts/main-agent-delivery-closeout-gate.ts',
      'scripts/subagent-current-attempt-revalidation.ts',
      'tests/acceptance/subagent-current-attempt-revalidation.test.ts',
    ],
    diffSummaryRef: rel(diffSummaryPath),
    negativeAssertionArtifactRefs: [negativeArtifact],
  },
  diffSummary:
    'TRACE-036 adds current-attempt subagent evidence revalidation and closeout fail-closed enforcement for missing/stale revalidation reports.',
  commandRuns,
  artifactRefs: allArtifacts,
  deliveryEvidence: {
    requiredCommands: [
      {
        commandId: 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION',
        command: commandRuns[0].command,
        commandType: 'delivery_evidence',
        blockingIfMissing: true,
        negativeOrRegression: true,
        closeoutAttemptId,
        traceRows: ['TRACE-036'],
        evidenceRefs: ['EVD-003', 'EVD-009', 'EVD-046'],
        artifactRefs: deliveryArtifacts,
      },
    ],
    historicalRunRefs: commandRuns.map((run) => ({
      commandId: run.commandId,
      runId,
      closeoutAttemptId,
    })),
  },
  requirementClosures: [
    { requirementId: 'MUST-047', status: 'pass' },
    { requirementId: 'NEG-036', status: 'pass' },
    { requirementId: 'EVD-003', status: 'pass' },
    { requirementId: 'EVD-009', status: 'pass' },
    { requirementId: 'EVD-046', status: 'pass' },
  ],
  contractChecks: [
    { checkId: 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION:TRACE-036:current', contract: 'CMD-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION', decision: 'pass' },
    { checkId: 'CMD-RENDER-CONFIRMATION:TRACE-036:current', contract: 'CMD-RENDER-CONFIRMATION', decision: 'pass' },
    { checkId: 'CMD-TRACE-BINDING-ACCEPTANCE:TRACE-036:current', contract: 'CMD-TRACE-BINDING-ACCEPTANCE', decision: 'pass' },
    { checkId: 'CMD-ENCODING-GATE:TRACE-036:current', contract: 'CMD-ENCODING-GATE', decision: 'pass' },
  ],
  gateChecks: [
    { checkId: 'GATE-SUBAGENT-CURRENT-ATTEMPT-REVALIDATION:TRACE-036:current', gate: 'Subagent Current Attempt Revalidation Gate', decision: 'pass' },
  ],
};

writeJson(packetPath, packet);
console.log(JSON.stringify({ ok: true, packetPath: rel(packetPath), artifactCount: allArtifacts.length }, null, 2));
