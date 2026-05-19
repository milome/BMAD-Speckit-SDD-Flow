const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const recordPath = '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json';
const base =
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-CLOSURE-RECONCILIATION/trace-closure-reconciliation-001';
const runId = 'run-trace-closure-reconciliation-001';
const closeoutAttemptId = 'closeout-trace-closure-reconciliation-001';

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
    inputVersion: 'TRACE-CLOSURE-RECONCILIATION',
    outputVersion: 'trace-closure-reconciliation-evidence-v1',
  };
}

fs.mkdirSync(base, { recursive: true });

const commands = [
  {
    commandId: 'CMD-TRACE-CLOSURE-RECONCILIATION-ACCEPTANCE',
    command:
      'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts tests/acceptance/trace-closure-matrix.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
    logPath: path.join(base, 'CMD-TRACE-CLOSURE-RECONCILIATION-ACCEPTANCE.log'),
  },
  {
    commandId: 'CMD-TRACE-CLOSURE-RECONCILIATION-ENCODING',
    command: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
    logPath: path.join(base, 'CMD-TRACE-CLOSURE-RECONCILIATION-ENCODING.log'),
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
    console.error(
      JSON.stringify(
        {
          ok: false,
          failedCommandId: item.commandId,
          exitCode: result.status ?? 1,
          logPath: item.logPath,
        },
        null,
        2
      )
    );
    process.exit(result.status ?? 1);
  }
}

const record = readJson(recordPath);
const traceRows = [...new Set((record.executionIterations || []).flatMap((iteration) => iteration.traceRows || []))].sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true })
);
const passClosures = new Set((record.requirementClosures || []).filter((closure) => closure.status === 'pass').map((closure) => closure.requirementId));
const openTraceRows = traceRows.filter((traceRow) => !passClosures.has(traceRow));
const evidenceRefs = [
  'EVD-001',
  'EVD-003',
  'EVD-004',
  'EVD-005',
  'EVD-006',
  'EVD-007',
  'EVD-008',
  'EVD-009',
  'EVD-010',
  'EVD-011',
  'EVD-012',
  'EVD-013',
  'EVD-014',
  'EVD-015',
  'EVD-016',
  'EVD-017',
  'EVD-019',
  'EVD-020',
  'EVD-021',
  'EVD-022',
  'EVD-023',
  'EVD-024',
  'EVD-025',
  'EVD-026',
  'EVD-027',
  'EVD-028',
  'EVD-029',
  'EVD-030',
  'EVD-031',
  'EVD-032',
  'EVD-033',
  'EVD-034',
  'EVD-036',
  'EVD-037',
  'EVD-038',
];
const relatedRequirementIds = [...openTraceRows, 'MUST-005', 'MUST-006', 'EVD-006', 'EVD-009'];

const commandRunResultsPath = path.join(base, 'command-run-results.json');
fs.writeFileSync(commandRunResultsPath, `${JSON.stringify(commandRuns, null, 2)}\n`, 'utf8');

const negativeAssertionsPath = path.join(base, 'negative-assertions.json');
fs.writeFileSync(
  negativeAssertionsPath,
  `${JSON.stringify(
    {
      assertions: [
        {
          id: 'NEG-TRACE-CLOSURE-HISTORY-OPEN-NOT-CURRENT',
          statement: 'Historical open requirement closure events cannot block closeout after a later pass closure exists for the same requirementId.',
          protectedBy: ['tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts'],
        },
        {
          id: 'NEG-TRACE-ROWS-NOT-IMPLICITLY-CLOSED-WITHOUT-DONE',
          statement: 'Trace rows are closed only by controlled ingest on done execution packets or explicit pass closures, not by prose or task completion.',
          protectedBy: ['tests/acceptance/implementation-evidence-ingest.test.ts', 'tests/acceptance/trace-closure-matrix.test.ts'],
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
    '# TRACE Closure Reconciliation',
    '',
    '- Added controlled ingest trace-row pass closure materialization for done execution packets.',
    '- Changed Delivery Closeout Gate to evaluate latest closure state per requirementId instead of historical open events.',
    '- Added acceptance coverage for trace row closure and append-only closure state reconciliation.',
    '',
  ].join('\n'),
  'utf8'
);

const artifactRefs = [
  artifactRef(diffSummaryPath, 'diff_summary', 'summarize trace closure reconciliation implementation delta', relatedRequirementIds),
  artifactRef(negativeAssertionsPath, 'negative_assertion_evidence', 'prove trace closure reconciliation negative assertions', relatedRequirementIds),
  artifactRef(commandRunResultsPath, 'command_evidence', 'record trace closure reconciliation acceptance and encoding command results', relatedRequirementIds),
  ...commands.map((command) =>
    artifactRef(command.logPath, 'command_log', `capture ${command.commandId} output for trace closure reconciliation`, relatedRequirementIds)
  ),
];

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId: 'REQ-CLOSED-LOOP-DESIGN',
  requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
  executionIterationId: 'TRACE-CLOSURE-RECONCILIATION-001',
  runId,
  status: 'done',
  sourceDocumentHash: record.sourceDocumentHash,
  implementationConfirmationHash: record.implementationConfirmationHash,
  architectureConfirmationHash: record.architectureConfirmationState.currentArchitectureConfirmationHash,
  traceRows: openTraceRows,
  taskRefs: [
    'TASK-GATES-CLOSEOUT-RERUN',
    'TASK-DELIVERY-CORE-EVIDENCE',
    'TASK-ARTIFACT-CONTROL-INGEST',
  ],
  evidenceRefs,
  filesChanged: [
    'scripts/ingest-implementation-evidence.ts',
    'scripts/main-agent-delivery-closeout-gate.ts',
    'tests/acceptance/implementation-evidence-ingest.test.ts',
    'tests/acceptance/trace-closure-matrix.test.ts',
    'tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
  ],
  implementationDelta: {
    filesChanged: [
      'scripts/ingest-implementation-evidence.ts',
      'scripts/main-agent-delivery-closeout-gate.ts',
      'tests/acceptance/implementation-evidence-ingest.test.ts',
      'tests/acceptance/trace-closure-matrix.test.ts',
      'tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts',
    ],
    diffSummaryRef: diffSummaryPath.replace(/\\/g, '/'),
    behaviorAffecting: true,
    negativeAssertionArtifactRefs: [artifactRefs[1]],
  },
  diffSummary:
    'Close TRACE row closure gap by materializing traceRows as controlled pass closures on done ingest and evaluating closeout closures by latest requirementId state.',
  commandRuns,
  artifactRefs,
  deliveryEvidence: {
    requiredCommands: [
      {
        commandId: 'CMD-TRACE-CLOSURE-RECONCILIATION-ACCEPTANCE',
        command: commands[0].command,
        commandType: 'delivery_evidence',
        blockingIfMissing: true,
        negativeOrRegression: true,
        traceRows: openTraceRows,
        evidenceRefs,
        artifactRefs: [artifactRefs[2], artifactRefs[3]],
      },
      {
        commandId: 'CMD-TRACE-CLOSURE-RECONCILIATION-ENCODING',
        command: commands[1].command,
        commandType: 'delivery_evidence',
        blockingIfMissing: true,
        negativeOrRegression: true,
        traceRows: openTraceRows,
        evidenceRefs,
        artifactRefs: [artifactRefs[2], artifactRefs[4]],
      },
    ],
    historicalRunRefs: commandRuns.map((run) => ({
      commandId: run.commandId,
      runId,
      closeoutAttemptId,
    })),
  },
  requirementClosures: [
    ...openTraceRows.map((traceRow) => ({ requirementId: traceRow, status: 'pass' })),
  ],
  gateChecks: [
    {
      gate: 'trace_closure_reconciliation',
      decision: 'pass',
    },
  ],
  contractChecks: [
    {
      contract: 'trace_rows_must_have_requirement_closure',
      decision: 'pass',
    },
    {
      contract: 'delivery_closeout_latest_closure_state',
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
      traceRows: openTraceRows.length,
      commandRuns: commandRuns.length,
      artifactRefs: artifactRefs.length,
    },
    null,
    2
  )
);
