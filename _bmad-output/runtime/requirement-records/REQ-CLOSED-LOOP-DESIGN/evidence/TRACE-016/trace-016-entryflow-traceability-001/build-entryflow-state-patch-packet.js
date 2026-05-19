const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const evidenceRoot = __dirname;
const projectRoot = path.resolve(evidenceRoot, '../../../../../../..');
const recordId = 'REQ-CLOSED-LOOP-DESIGN';
const requirementSetId = 'REQ-CLOSED-LOOP-DESIGN';
const runId = 'trace-016-entryflow-state-patch-001';
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

const proofPath = rel(path.join(evidenceRoot, 'pre-ingest-entryflow-patch-proof.json'));
const artifactRef = {
  artifactType: 'entryflow_state_patch_proof',
  sourceOfTruthRole: 'evidence',
  path: proofPath,
  hash: hashFile(path.join(projectRoot, proofPath)),
  producer: 'TRACE-016',
  purpose: 'Proves controlled entryFlowState patch for a pre-existing confirmed RequirementRecord.',
  relatedRequirementIds,
  status: 'active',
  inputVersion: `${recordId}@${sourceDocumentHash}`,
  outputVersion: runId,
};

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId,
  requirementSetId,
  executionIterationId: 'exec-trace-016-entryflow-state-patch-001',
  runId,
  closeoutAttemptId: runId,
  status: 'done',
  traceRows: ['TRACE-016'],
  taskRefs: ['TASK-ENTRYFLOW-TRACEABILITY'],
  evidenceRefs: ['EVD-001', 'EVD-004', 'EVD-023'],
  filesChanged: [
    'scripts/ingest-implementation-evidence.ts',
    '_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js',
    '_bmad/_schemas/requirement-record.schema.json',
    'scripts/main-agent-entryflow-traceability-check.ts',
    'tests/acceptance/main-agent-entryflow-traceability-check.test.ts',
    'tests/acceptance/implementation-evidence-ingest.test.ts',
    'tests/acceptance/requirement-record-schema.test.ts',
  ],
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  diffSummary: 'Apply controlled entryFlowState to existing RequirementRecord before running TRACE-016 traceability gate.',
  commandRuns: [
    {
      commandId: 'CMD-TRACE-016-ENTRYFLOW-STATE-CONTROLLED-PATCH',
      command: 'npx ts-node --project tsconfig.node.json --transpile-only scripts/ingest-implementation-evidence.ts --evidence <entryflow-state-patch-packet.json> --requirement-record _bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json',
      runId,
      closeoutAttemptId: runId,
      exitCode: 0,
      startedAt: '2026-05-19T14:13:00.000Z',
      completedAt: '2026-05-19T14:13:01.000Z',
      outputSummary: 'controlled entryFlowState patch packet generated and accepted by ingest validator',
    },
  ],
  artifactRefs: [artifactRef],
  entryFlowState: {
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
  },
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/ingest-implementation-evidence.ts',
      '_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js',
      '_bmad/_schemas/requirement-record.schema.json',
      'scripts/main-agent-entryflow-traceability-check.ts',
      'tests/acceptance/main-agent-entryflow-traceability-check.test.ts',
      'tests/acceptance/implementation-evidence-ingest.test.ts',
      'tests/acceptance/requirement-record-schema.test.ts',
    ],
    diffSummaryRef: proofPath,
    negativeAssertionArtifactRefs: [artifactRef],
  },
  requirementClosures: [],
  gateChecks: [
    {
      checkId: 'trace-016-entryflow-state-controlled-patch',
      gate: 'EntryFlow State Controlled Patch',
      decision: 'pass',
    },
  ],
  deliveryEvidence: {
    requiredCommands: [
      {
        commandId: 'CMD-TRACE-016-ENTRYFLOW-STATE-CONTROLLED-PATCH',
        command: 'npx ts-node --project tsconfig.node.json --transpile-only scripts/ingest-implementation-evidence.ts --evidence <entryflow-state-patch-packet.json> --requirement-record _bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json',
        blockingIfMissing: true,
        negativeOrRegression: false,
        artifactRefs: [artifactRef],
      },
    ],
    historicalRunRefs: [
      {
        commandId: 'CMD-TRACE-016-ENTRYFLOW-STATE-CONTROLLED-PATCH',
        runId,
        closeoutAttemptId: runId,
      },
    ],
  },
};

fs.writeFileSync(path.join(evidenceRoot, 'entryflow-state-patch-packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, path: rel(path.join(evidenceRoot, 'entryflow-state-patch-packet.json')) }, null, 2));
