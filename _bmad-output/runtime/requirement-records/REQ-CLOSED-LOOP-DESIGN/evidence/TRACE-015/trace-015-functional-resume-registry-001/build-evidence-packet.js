const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const evidenceRoot = __dirname;
const projectRoot = path.resolve(evidenceRoot, '../../../../../../..');
const runId = 'trace-015-functional-resume-registry-001';
const recordId = 'REQ-CLOSED-LOOP-DESIGN';
const requirementSetId = 'REQ-CLOSED-LOOP-DESIGN';
const sourceDocumentHash = 'sha256:426b56bec964e275600935e5dee293985c61483e34f523b66f3b705247ad2294';
const implementationConfirmationHash = 'sha256:e5e8b680fa4e1d273c29bea5a613ef595486868e8e57dae0fa48ac47016909ec';
const architectureConfirmationHash = 'sha256:fe98c301cf8479be934a8258ad584575e146e2d5cc2e846bf6ccec1a1e6909f1';
const relatedRequirementIds = ['MUST-022', 'NEG-010', 'OUT-008', 'EVD-001', 'EVD-004', 'EVD-022', 'TRACE-015'];

function rel(file) {
  return path.relative(projectRoot, file).replace(/\\/g, '/');
}

function hashFile(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function artifact(artifactType, relativePath, purpose) {
  const absolute = path.resolve(projectRoot, relativePath);
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: relativePath,
    hash: hashFile(absolute),
    producer: 'TRACE-015',
    purpose,
    relatedRequirementIds,
    status: 'active',
    inputVersion: `${recordId}@${sourceDocumentHash}`,
    outputVersion: runId,
  };
}

const commandRuns = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'command-runs.json'), 'utf8'));
const commandLogArtifacts = commandRuns.map((run) =>
  artifact('command_log', run.logPath, `Command evidence for ${run.commandId}`)
);
const proofPath = rel(path.join(evidenceRoot, 'resume', 'functional-resume-proof.json'));
const checkpointPath = rel(path.join(evidenceRoot, 'resume', 'trace-checkpoints.jsonl'));
const packetLogPath = rel(path.join(evidenceRoot, 'resume', 'resume-packets.jsonl'));
const commandManifestPath = rel(path.join(evidenceRoot, 'command-runs.json'));
const deltaSummaryPath = rel(path.join(evidenceRoot, 'implementation-delta-summary.md'));
const negativeAssertionsPath = rel(path.join(evidenceRoot, 'negative-assertions.md'));

const artifactRefs = [
  artifact('functional_resume_registry_proof', proofPath, 'Proves source-driven functional resume failure registry validation and coverage matrix.'),
  artifact('trace_checkpoint_log', checkpointPath, 'Append-only traceRows checkpoint evidence for TRACE-015 resume validation.'),
  artifact('resume_packet_log', packetLogPath, 'Append-only resume packet evidence including failure registry coverage.'),
  artifact('command_run_manifest', commandManifestPath, 'Captures TRACE-015 validation command runs with exit codes and timestamps.'),
  artifact('implementation_delta_summary', deltaSummaryPath, 'Summarizes TRACE-015 implementation delta and changed paths.'),
  ...commandLogArtifacts,
];

const negativeAssertionArtifact = artifact(
  'negative_assertion_report',
  negativeAssertionsPath,
  'Documents TRACE-015 negative assertions for functional resume registry and recovery-action validation.'
);

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId,
  requirementSetId,
  executionIterationId: 'exec-trace-015-functional-resume-registry-001',
  runId,
  closeoutAttemptId: runId,
  status: 'done',
  traceRows: ['TRACE-015'],
  taskRefs: ['TASK-FUNCTIONAL-RESUME'],
  evidenceRefs: ['EVD-001', 'EVD-004', 'EVD-022'],
  filesChanged: [
    'scripts/main-agent-functional-resume-check.ts',
    'tests/acceptance/main-agent-functional-resume-check.test.ts',
  ],
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  diffSummary:
    'Added source-driven functional resume failure registry validation, recovery action event binding checks, payloadContract checks, and coverage output in resume packet/proof.',
  commandRuns,
  artifactRefs,
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/main-agent-functional-resume-check.ts',
      'tests/acceptance/main-agent-functional-resume-check.test.ts',
    ],
    diffSummaryRef: deltaSummaryPath,
    negativeAssertionArtifactRefs: [negativeAssertionArtifact],
  },
  requirementClosures: [
    { requirementId: 'MUST-022', status: 'pass' },
    { requirementId: 'NEG-010', status: 'pass' },
    { requirementId: 'OUT-008', status: 'pass' },
    { requirementId: 'EVD-001', status: 'pass' },
    { requirementId: 'EVD-004', status: 'pass' },
    { requirementId: 'EVD-022', status: 'pass' },
  ],
  gateChecks: [
    {
      checkId: 'trace-015-functional-resume-gate',
      gate: 'Functional Resume Gate',
      decision: 'pass',
    },
    {
      checkId: 'trace-015-resume-failure-registry-check',
      gate: 'Resume Failure Registry Check',
      decision: 'pass',
    },
    {
      checkId: 'trace-015-recovery-action-event-contract-check',
      gate: 'Recovery Action Event Contract Check',
      decision: 'pass',
    },
  ],
  deliveryEvidence: {
    requiredCommands: commandRuns.map((run) => ({
      commandId: run.commandId,
      command: run.command,
      blockingIfMissing: true,
      negativeOrRegression: run.commandId === 'CMD-TRACE-015-FUNCTIONAL-RESUME-REGISTRY-TEST',
      lastRunRef: run.commandId,
      artifactRefs: [
        artifact('command_log', run.logPath, `Required command log for ${run.commandId}`),
      ],
    })),
    historicalRunRefs: commandRuns.map((run) => ({
      commandId: run.commandId,
      runId,
      closeoutAttemptId: runId,
    })),
  },
};

fs.writeFileSync(path.join(evidenceRoot, 'implementation-evidence-packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, path: rel(path.join(evidenceRoot, 'implementation-evidence-packet.json')) }, null, 2));
