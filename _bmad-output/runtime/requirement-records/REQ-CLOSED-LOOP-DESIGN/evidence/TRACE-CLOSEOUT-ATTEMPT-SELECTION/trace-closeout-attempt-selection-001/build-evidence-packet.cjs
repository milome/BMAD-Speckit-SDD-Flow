const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const recordPath = '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json';
const base =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-CLOSEOUT-ATTEMPT-SELECTION/trace-closeout-attempt-selection-001';
const runId = 'run-trace-closeout-attempt-selection-001';
const closeoutAttemptId = 'closeout-REQ-CLOSED-LOOP-DESIGN-20260519-006';
const previousCloseoutAttemptId = 'closeout-REQ-CLOSED-LOOP-DESIGN-20260519-005';

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function artifactRef(file, artifactType, purpose, relatedRequirementIds) {
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: file.replace(/\\/g, '/'),
    hash: sha256File(file),
    producer: 'codex',
    purpose,
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'TRACE-CLOSEOUT-ATTEMPT-SELECTION',
    outputVersion: 'closeout-attempt-selection-evidence-v1',
  };
}

fs.mkdirSync(base, { recursive: true });

const commands = [
  {
    commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ACCEPTANCE',
    command:
      'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts tests/acceptance/requirement-record-schema.test.ts',
    logPath: path.join(base, 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ACCEPTANCE.log'),
  },
  {
    commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ENCODING',
    command: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
    logPath: path.join(base, 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ENCODING.log'),
  },
];

const commandRuns = [];
for (const item of commands) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(item.command, {
    shell: true,
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  const completedAt = new Date().toISOString();
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(item.logPath, output, 'utf8');
  const lines = output.split(/\r?\n/).filter(Boolean);
  commandRuns.push({
    commandId: item.commandId,
    command: item.command,
    runId,
    closeoutAttemptId,
    exitCode: result.status ?? 1,
    startedAt,
    completedAt,
    outputSummary: lines.slice(-20).join('\n'),
  });
  if ((result.status ?? 1) !== 0) {
    console.error(JSON.stringify({ ok: false, failedCommandId: item.commandId, logPath: item.logPath }, null, 2));
    process.exit(result.status ?? 1);
  }
}

const record = readJson(recordPath);
const traceRows = [
  'TRACE-002',
  'TRACE-003',
  'TRACE-006',
  'TRACE-024',
  'TRACE-CLOSURE-RECONCILIATION',
];
const evidenceRefs = ['EVD-003', 'EVD-006', 'EVD-009', 'EVD-019', 'EVD-031'];
const relatedRequirementIds = [...traceRows, 'MUST-004', 'MUST-005', 'MUST-006', ...evidenceRefs];

const commandRunResultsPath = path.join(base, 'command-run-results.json');
fs.writeFileSync(commandRunResultsPath, `${JSON.stringify(commandRuns, null, 2)}\n`, 'utf8');

const negativeAssertionsPath = path.join(base, 'negative-assertions.json');
fs.writeFileSync(
  negativeAssertionsPath,
  `${JSON.stringify(
    {
      assertions: [
        {
          id: 'NEG-CLOSEOUT-ATTEMPT-SELECTS-CURRENT-COMMANDS',
          statement:
            'Delivery Closeout Gate must not require every historical deliveryEvidence.requiredCommands entry to rerun in one final attempt; it evaluates the current attempt selected commands only.',
          protectedBy: ['tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts'],
        },
        {
          id: 'NEG-CLOSEOUT-FAILED-ATTEMPT-IS-IMMUTABLE',
          statement:
            'A blocked closeout attempt remains immutable; remediation records resolved failure/RCA events and creates a new closeoutAttemptId.',
          protectedBy: ['tests/acceptance/implementation-evidence-ingest.test.ts'],
        },
      ],
    },
    null,
    2
  )}\n`,
  'utf8'
);

const diffSummaryPath = path.join(base, 'diff-summary.md');
fs.writeFileSync(
  diffSummaryPath,
  [
    '# Closeout Attempt Selection',
    '',
    '- Delivery Closeout Gate now selects requiredCommands by current closeoutAttemptId or lastRunRef.closeoutAttemptId.',
    '- Controlled ingest can append resolved failure/RCA status records so blocked attempts remain immutable while remediation can proceed.',
    '- Closeout evaluation uses latest failure/RCA status by id.',
    '',
  ].join('\n'),
  'utf8'
);

const artifactRefs = [
  artifactRef(diffSummaryPath, 'diff_summary', 'summarize closeout attempt selection implementation delta', relatedRequirementIds),
  artifactRef(negativeAssertionsPath, 'negative_assertion_evidence', 'prove closeout attempt selection negative assertions', relatedRequirementIds),
  artifactRef(commandRunResultsPath, 'command_evidence', 'record closeout attempt selection acceptance and encoding command results', relatedRequirementIds),
  ...commands.map((command) =>
    artifactRef(command.logPath, 'command_log', `capture ${command.commandId} output for closeout attempt selection`, relatedRequirementIds)
  ),
];

const requiredCommands = [
  {
    commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ACCEPTANCE',
    command: commands[0].command,
    commandType: 'delivery_evidence',
    blockingIfMissing: true,
    negativeOrRegression: true,
    closeoutAttemptId,
    lastRunRef: {
      commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ACCEPTANCE',
      runId,
      closeoutAttemptId,
    },
    traceRows,
    evidenceRefs,
    artifactRefs: [artifactRefs[2], artifactRefs[3]],
  },
  {
    commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ENCODING',
    command: commands[1].command,
    commandType: 'delivery_evidence',
    blockingIfMissing: true,
    negativeOrRegression: true,
    closeoutAttemptId,
    lastRunRef: {
      commandId: 'CMD-CLOSEOUT-ATTEMPT-SELECTION-ENCODING',
      runId,
      closeoutAttemptId,
    },
    traceRows,
    evidenceRefs,
    artifactRefs: [artifactRefs[2], artifactRefs[4]],
  },
];

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId: 'REQ-CLOSED-LOOP-DESIGN',
  requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
  executionIterationId: 'TRACE-CLOSEOUT-ATTEMPT-SELECTION-001',
  runId,
  status: 'done',
  sourceDocumentHash: record.sourceDocumentHash,
  implementationConfirmationHash: record.implementationConfirmationHash,
  architectureConfirmationHash: record.architectureConfirmationState.currentArchitectureConfirmationHash,
  traceRows,
  taskRefs: ['TASK-GATES-CLOSEOUT-RERUN', 'TASK-DELIVERY-CORE-EVIDENCE'],
  evidenceRefs,
  filesChanged: [
    '_bmad/_schemas/requirement-record.schema.json',
    'scripts/ingest-implementation-evidence.ts',
    'scripts/main-agent-delivery-closeout-gate.ts',
    'tests/acceptance/implementation-evidence-ingest.test.ts',
    'tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
    'tests/acceptance/requirement-record-schema.test.ts',
  ],
  implementationDelta: {
    filesChanged: [
      '_bmad/_schemas/requirement-record.schema.json',
      'scripts/ingest-implementation-evidence.ts',
      'scripts/main-agent-delivery-closeout-gate.ts',
      'tests/acceptance/implementation-evidence-ingest.test.ts',
      'tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
      'tests/acceptance/requirement-record-schema.test.ts',
    ],
    diffSummaryRef: diffSummaryPath.replace(/\\/g, '/'),
    behaviorAffecting: true,
    negativeAssertionArtifactRefs: [artifactRefs[1]],
  },
  diffSummary:
    'Constrain Delivery Closeout Gate to current attempt selected requiredCommands and allow controlled failure/RCA resolution events for immutable blocked attempts.',
  commandRuns,
  artifactRefs,
  deliveryEvidence: {
    requiredCommands,
    historicalRunRefs: commandRuns.map((run) => ({
      commandId: run.commandId,
      runId,
      closeoutAttemptId,
    })),
  },
  failureRecords: [
    {
      eventType: 'failure_recorded',
      failureId: `failure:${previousCloseoutAttemptId}`,
      type: 'delivery_closeout_blocked',
      status: 'resolved',
      closeoutAttemptId: previousCloseoutAttemptId,
      blockingReasons: ['superseded_by_current_attempt_required_command_selection'],
      sourceRefs: [{ sourceType: 'closeout_attempt', id: previousCloseoutAttemptId }],
    },
  ],
  rcaRecords: [
    {
      eventType: 'rca_created',
      rcaId: `rca:${previousCloseoutAttemptId}`,
      type: 'closeout_blocker',
      status: 'resolved',
      sourceRefs: [{ sourceType: 'failure_record', id: `failure:${previousCloseoutAttemptId}` }],
    },
  ],
  requirementClosures: [
    { requirementId: 'MUST-004', status: 'pass' },
    { requirementId: 'MUST-005', status: 'pass' },
    { requirementId: 'MUST-006', status: 'pass' },
    { requirementId: 'EVD-003', status: 'pass' },
    { requirementId: 'EVD-006', status: 'pass' },
    { requirementId: 'EVD-009', status: 'pass' },
    { requirementId: 'EVD-019', status: 'pass' },
  ],
  gateChecks: [
    {
      gate: 'delivery_closeout_attempt_selection',
      decision: 'pass',
    },
  ],
  contractChecks: [
    {
      contract: 'current_attempt_required_command_selection',
      decision: 'pass',
    },
    {
      contract: 'blocked_closeout_attempt_immutable_remediation',
      decision: 'pass',
    },
  ],
  closeoutAttemptId,
};

const packetPath = path.join(base, 'implementation-evidence-packet.json');
fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      ok: true,
      packetPath,
      commandRuns: commandRuns.length,
      artifactRefs: artifactRefs.length,
      closeoutAttemptId,
    },
    null,
    2
  )
);
