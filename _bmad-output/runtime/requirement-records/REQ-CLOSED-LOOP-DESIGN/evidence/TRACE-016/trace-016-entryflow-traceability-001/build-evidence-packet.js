const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const evidenceRoot = __dirname;
const projectRoot = path.resolve(evidenceRoot, '../../../../../../..');
const runId = 'trace-016-entryflow-traceability-001';
const recordId = 'REQ-CLOSED-LOOP-DESIGN';
const requirementSetId = 'REQ-CLOSED-LOOP-DESIGN';
const sourceDocumentHash = 'sha256:426b56bec964e275600935e5dee293985c61483e34f523b66f3b705247ad2294';
const implementationConfirmationHash = 'sha256:e5e8b680fa4e1d273c29bea5a613ef595486868e8e57dae0fa48ac47016909ec';
const architectureConfirmationHash = 'sha256:fe98c301cf8479be934a8258ad584575e146e2d5cc2e846bf6ccec1a1e6909f1';
const relatedRequirementIds = ['MUST-023', 'NEG-011', 'OUT-009', 'EVD-001', 'EVD-004', 'EVD-023', 'TRACE-016'];

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
    producer: 'TRACE-016',
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
const matrixPath = rel(path.join(evidenceRoot, 'entry-flow-adaptation-matrix.json'));
const commandManifestPath = rel(path.join(evidenceRoot, 'command-runs.json'));
const deltaSummaryPath = rel(path.join(evidenceRoot, 'implementation-delta-summary.md'));
const negativeAssertionsPath = rel(path.join(evidenceRoot, 'negative-assertions.md'));
const statePatchProofPath = rel(path.join(evidenceRoot, 'pre-ingest-entryflow-patch-proof.json'));

const artifactRefs = [
  artifact('entry_flow_adaptation_matrix', matrixPath, 'Read-only matrix proving canonical entryFlow, entryFlowClass, workflowAdapter, and contractAuthoringRequired boundaries.'),
  artifact('entryflow_state_patch_proof', statePatchProofPath, 'Evidence that the existing record entryFlow fields were patched through controlled ingest.'),
  artifact('command_run_manifest', commandManifestPath, 'Captures TRACE-016 validation command runs with exit codes and timestamps.'),
  artifact('implementation_delta_summary', deltaSummaryPath, 'Summarizes TRACE-016 implementation delta and changed paths.'),
  ...commandLogArtifacts,
];

const negativeAssertionArtifact = artifact(
  'negative_assertion_report',
  negativeAssertionsPath,
  'Documents TRACE-016 negative assertions for entryFlow boundaries and standalone task artifact scope.'
);

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId,
  requirementSetId,
  executionIterationId: 'exec-trace-016-entryflow-traceability-001',
  runId,
  closeoutAttemptId: runId,
  status: 'done',
  traceRows: ['TRACE-016'],
  taskRefs: ['TASK-ENTRYFLOW-TRACEABILITY'],
  evidenceRefs: ['EVD-001', 'EVD-004', 'EVD-023'],
  filesChanged: [
    '_bmad/_schemas/requirement-record.schema.json',
    '_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js',
    'scripts/ingest-implementation-evidence.ts',
    'scripts/main-agent-entryflow-traceability-check.ts',
    'tests/acceptance/main-agent-entryflow-traceability-check.test.ts',
    'tests/acceptance/implementation-evidence-ingest.test.ts',
    'tests/acceptance/requirement-record-schema.test.ts',
  ],
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  diffSummary:
    'Added canonical entryFlow fields to controlled records, confirmation ingest persistence, controlled entryFlowState patch validation, and read-only entryFlow traceability matrix.',
  commandRuns,
  artifactRefs,
  entryFlowState: {
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
  },
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      '_bmad/_schemas/requirement-record.schema.json',
      '_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js',
      'scripts/ingest-implementation-evidence.ts',
      'scripts/main-agent-entryflow-traceability-check.ts',
      'tests/acceptance/main-agent-entryflow-traceability-check.test.ts',
      'tests/acceptance/implementation-evidence-ingest.test.ts',
      'tests/acceptance/requirement-record-schema.test.ts',
    ],
    diffSummaryRef: deltaSummaryPath,
    negativeAssertionArtifactRefs: [negativeAssertionArtifact],
  },
  requirementClosures: [
    { requirementId: 'MUST-023', status: 'pass' },
    { requirementId: 'NEG-011', status: 'pass' },
    { requirementId: 'OUT-009', status: 'pass' },
    { requirementId: 'EVD-001', status: 'pass' },
    { requirementId: 'EVD-004', status: 'pass' },
    { requirementId: 'EVD-023', status: 'pass' },
  ],
  gateChecks: [
    {
      checkId: 'trace-016-entryflow-traceability-check',
      gate: 'EntryFlow Traceability Check',
      decision: 'pass',
    },
    {
      checkId: 'trace-016-forbidden-top-level-entryflow-check',
      gate: 'Forbidden Top-Level EntryFlow Check',
      decision: 'pass',
    },
    {
      checkId: 'trace-016-standalone-runtime-artifact-boundary-check',
      gate: 'Standalone Task Runtime Artifact Boundary Check',
      decision: 'pass',
    },
  ],
  deliveryEvidence: {
    requiredCommands: commandRuns.map((run) => ({
      commandId: run.commandId,
      command: run.command,
      blockingIfMissing: true,
      negativeOrRegression: run.commandId === 'CMD-TRACE-016-ENTRYFLOW-TRACEABILITY-TEST',
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
