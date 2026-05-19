const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../../../../..');
const evidenceRoot = __dirname;
const recordPath = path.join(root, '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/requirement-record.json');
const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
const archHash = record.architectureConfirmationState.currentArchitectureConfirmationHash;

function normalize(filePath) {
  return filePath.replace(/\\/g, '/');
}

function rel(filePath) {
  return normalize(path.relative(root, filePath));
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function artifact(filePath, artifactType, relatedRequirementIds, purpose) {
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: rel(filePath),
    hash: sha256File(filePath),
    producer: 'TRACE-012',
    purpose,
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'REQ-CLOSED-LOOP-DESIGN@sha256:426b56bec964e275600935e5dee293985c61483e34f523b66f3b705247ad2294',
    outputVersion: 'trace-012-functional-resume-001',
  };
}

const commandRuns = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'command-runs.json'), 'utf8')).map((run) => ({
  ...run,
  logPath: rel(run.logPath),
}));

const relatedRequirementIds = ['MUST-020', 'NEG-005', 'EVD-001', 'EVD-004', 'EVD-009', 'TRACE-012'];
const resumeDir = path.join(evidenceRoot, 'resume');
const proofPath = path.join(resumeDir, 'functional-resume-proof.json');
const checkpointsPath = path.join(resumeDir, 'trace-checkpoints.jsonl');
const packetsPath = path.join(resumeDir, 'resume-packets.jsonl');
const deltaSummaryPath = path.join(evidenceRoot, 'implementation-delta-summary.md');
const negativeAssertionsPath = path.join(evidenceRoot, 'negative-assertions.md');
const commandRunsPath = path.join(evidenceRoot, 'command-runs.json');
const commandLogArtifacts = commandRuns.map((run) =>
  artifact(path.join(evidenceRoot, `${run.commandId}.log`), 'command_log', relatedRequirementIds, `Command evidence for ${run.commandId}`)
);

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId: 'REQ-CLOSED-LOOP-DESIGN',
  requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
  executionIterationId: 'exec-trace-012-functional-resume-001',
  runId: 'trace-012-functional-resume-001',
  closeoutAttemptId: 'trace-012-functional-resume-001',
  status: 'done',
  traceRows: ['TRACE-012'],
  taskRefs: ['TASK-GATES-CLOSEOUT-RERUN', 'TASK-FUNCTIONAL-RESUME'],
  evidenceRefs: ['EVD-001', 'EVD-004', 'EVD-009'],
  filesChanged: [
    'scripts/main-agent-functional-resume-check.ts',
    'tests/acceptance/main-agent-functional-resume-check.test.ts',
  ],
  sourceDocumentHash: record.sourceDocumentHash,
  implementationConfirmationHash: record.implementationConfirmationHash,
  architectureConfirmationHash: archHash,
  diffSummary: 'Added functional resume checker that derives checkpoint, resume packet, and proof from controlled RequirementRecord fields; added fail-closed tests for hash drift, open blockers, pending rerun, open RCA, and artifact hash mismatch.',
  commandRuns,
  artifactRefs: [
    artifact(proofPath, 'functional_resume_proof', relatedRequirementIds, 'Proves functional resume is derived from controlled RequirementRecord sources.'),
    artifact(checkpointsPath, 'trace_checkpoint_log', relatedRequirementIds, 'Append-only traceRows checkpoint evidence for resume.'),
    artifact(packetsPath, 'resume_packet_log', relatedRequirementIds, 'Append-only resume packet evidence for fail-closed resume decisions.'),
    artifact(commandRunsPath, 'command_run_manifest', relatedRequirementIds, 'Captures TRACE-012 validation command runs with exit codes and timestamps.'),
    artifact(deltaSummaryPath, 'implementation_delta_summary', relatedRequirementIds, 'Summarizes TRACE-012 implementation delta and changed paths.'),
    ...commandLogArtifacts,
  ],
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/main-agent-functional-resume-check.ts',
      'tests/acceptance/main-agent-functional-resume-check.test.ts',
    ],
    diffSummaryRef: rel(deltaSummaryPath),
    negativeAssertionArtifactRefs: [
      artifact(negativeAssertionsPath, 'negative_assertion_report', relatedRequirementIds, 'Documents negative assertions covered by TRACE-012 functional resume tests.'),
    ],
  },
  requirementClosures: [
    { requirementId: 'MUST-020', status: 'pass' },
    { requirementId: 'NEG-005', status: 'pass' },
    { requirementId: 'EVD-001', status: 'pass' },
    { requirementId: 'EVD-004', status: 'pass' },
    { requirementId: 'EVD-009', status: 'pass' },
  ],
  gateChecks: [
    {
      checkId: 'trace-012-functional-resume-check',
      gate: 'Functional Resume Check',
      decision: 'pass',
    },
    {
      checkId: 'trace-012-closeout-blocker-boundary-check',
      gate: 'Closeout Blocker Boundary Check',
      decision: 'pass',
    },
  ],
  deliveryEvidence: {
    requiredCommands: commandRuns.map((run) => ({
      commandId: run.commandId,
      command: run.command,
      blockingIfMissing: true,
      negativeOrRegression: run.commandId.includes('TEST'),
      lastRunRef: run.commandId,
      artifactRefs: [
        artifact(path.join(evidenceRoot, `${run.commandId}.log`), 'command_log', relatedRequirementIds, `Required command log for ${run.commandId}`),
      ],
    })),
  },
};

fs.writeFileSync(path.join(evidenceRoot, 'implementation-evidence-packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, packetPath: normalize(path.join(evidenceRoot, 'implementation-evidence-packet.json')) }, null, 2));
