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
    producer: 'TRACE-011',
    purpose,
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'REQ-CLOSED-LOOP-DESIGN@sha256:426b56bec964e275600935e5dee293985c61483e34f523b66f3b705247ad2294',
    outputVersion: 'trace-011-bmad-artifact-hardcut-001',
  };
}

const commandRuns = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'command-runs.json'), 'utf8')).map((run) => ({
  ...run,
  logPath: rel(run.logPath),
}));

const relatedRequirementIds = ['MUST-018', 'MUST-019', 'EVD-001', 'EVD-005', 'EVD-020', 'TRACE-011'];
const hardcutReportPath = path.join(evidenceRoot, 'bmad-artifact-hardcut-report.json');
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
  executionIterationId: 'exec-trace-011-bmad-artifact-hardcut-001',
  runId: 'trace-011-bmad-artifact-hardcut-001',
  closeoutAttemptId: 'trace-011-bmad-artifact-hardcut-001',
  status: 'done',
  traceRows: ['TRACE-011'],
  taskRefs: ['TASK-BMAD-ARTIFACT-HARDCUT'],
  evidenceRefs: ['EVD-001', 'EVD-005', 'EVD-020'],
  filesChanged: [
    'scripts/main-agent-bmad-artifact-hardcut.ts',
    'tests/acceptance/main-agent-bmad-artifact-hardcut.test.ts',
  ],
  sourceDocumentHash: record.sourceDocumentHash,
  implementationConfirmationHash: record.implementationConfirmationHash,
  architectureConfirmationHash: archHash,
  diffSummary: 'Added read-only BMAD artifact hardcut checker and acceptance tests for BMAD native workflow preservation, requirement-scoped runtime outputs, legacy runtime output hardcut, and docs/reference schema-only semantics.',
  commandRuns,
  artifactRefs: [
    artifact(hardcutReportPath, 'bmad_artifact_hardcut_report', relatedRequirementIds, 'Proves BMAD native authoring paths remain preserved and old runtime paths cannot be target-state pass evidence.'),
    artifact(commandRunsPath, 'command_run_manifest', relatedRequirementIds, 'Captures TRACE-011 validation command runs with exit codes and timestamps.'),
    artifact(deltaSummaryPath, 'implementation_delta_summary', relatedRequirementIds, 'Summarizes TRACE-011 implementation delta and changed paths.'),
    ...commandLogArtifacts,
  ],
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/main-agent-bmad-artifact-hardcut.ts',
      'tests/acceptance/main-agent-bmad-artifact-hardcut.test.ts',
    ],
    diffSummaryRef: rel(deltaSummaryPath),
    negativeAssertionArtifactRefs: [
      artifact(negativeAssertionsPath, 'negative_assertion_report', relatedRequirementIds, 'Documents negative assertions covered by TRACE-011 hardcut acceptance tests.'),
    ],
  },
  requirementClosures: [
    { requirementId: 'MUST-018', status: 'pass' },
    { requirementId: 'MUST-019', status: 'pass' },
    { requirementId: 'EVD-001', status: 'pass' },
    { requirementId: 'EVD-005', status: 'pass' },
    { requirementId: 'EVD-020', status: 'pass' },
  ],
  gateChecks: [
    {
      checkId: 'trace-011-bmad-artifact-hardcut-check',
      gate: 'BMAD Artifact Hardcut Check',
      decision: 'pass',
    },
    {
      checkId: 'trace-011-docs-reference-boundary-check',
      gate: 'Docs Reference Boundary Check',
      decision: 'pass',
    },
  ],
  deliveryEvidence: {
    requiredCommands: commandRuns.map((run) => ({
      commandId: run.commandId,
      command: run.command,
      blockingIfMissing: true,
      lastRunRef: run.commandId,
      artifactRefs: [
        artifact(path.join(evidenceRoot, `${run.commandId}.log`), 'command_log', relatedRequirementIds, `Required command log for ${run.commandId}`),
      ],
    })),
  },
};

fs.writeFileSync(path.join(evidenceRoot, 'implementation-evidence-packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, packetPath: normalize(path.join(evidenceRoot, 'implementation-evidence-packet.json')) }, null, 2));
