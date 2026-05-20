const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const runId = 'run-TRACE035-current-20260521T031700Z';
const closeoutAttemptId = 'closeout-attempt-REQ-CLOSED-LOOP-DESIGN-TRACE038-copy-button-20260520T164100Z';
const sourceDocumentHash = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const implementationConfirmationHash = 'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const architectureConfirmationHash = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';
const runDir = path.join(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-035',
  runId
);
const related = ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027', 'EVD-004', 'EVD-044', 'EVD-045', 'TRACE-035'];
const changedFiles = [
  '_bmad/_schemas/requirement-record.schema.json',
  'scripts/ingest-implementation-evidence.ts',
  'scripts/main-agent-codex-worker-adapter.ts',
  'scripts/subagent-evidence-envelope.ts',
  'tests/acceptance/subagent-evidence-envelope.test.ts',
  'tests/acceptance/main-agent-codex-worker-adapter-e2e.test.ts',
];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function sha256Object(value) {
  return sha256Text(stableStringify(value));
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function artifactRef(file, artifactType, purpose, outputVersion) {
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    path: rel(file),
    hash: sha256File(file),
    producer: 'TRACE-035 current implementation run',
    purpose,
    relatedRequirementIds: related,
    status: 'active',
    inputVersion: `source=${sourceDocumentHash};implementation=${implementationConfirmationHash};architecture=${architectureConfirmationHash}`,
    outputVersion,
  };
}

const commandEvidencePath = path.join(runDir, 'trace035-command-evidence.json');
const commandEvidence = JSON.parse(fs.readFileSync(commandEvidencePath, 'utf8'));
const outputArtifacts = commandEvidence.commandRuns.map((run) =>
  artifactRef(path.join(root, run.outputPath), 'command_output', `command output for ${run.commandId}`, 'command_output-trace-035-current-v1')
);
const baseArtifactRefs = [
  artifactRef(
    path.join(runDir, 'subagent-task-report-proof.json'),
    'subagent_task_report_boundary_proof',
    'evidence that TaskReport and final messages are evidence input only',
    'subagent_task_report_boundary_proof-trace-035-v1'
  ),
  artifactRef(
    path.join(runDir, 'negative-assertions.json'),
    'negative_assertion_evidence',
    'negative and regression assertions for subagent evidence envelope governance',
    'negative_assertion_evidence-trace-035-v1'
  ),
  artifactRef(
    path.join(runDir, 'diff-summary.md'),
    'diff_summary',
    'implementation delta summary for TRACE-035 subagent evidence envelope governance',
    'diff_summary-trace-035-v1'
  ),
  artifactRef(
    commandEvidencePath,
    'command_evidence',
    'current command evidence for TRACE-035 delivery and recurring contract validation',
    'command_evidence-trace-035-v1'
  ),
  ...outputArtifacts,
];
const packetOnlyArtifactRefs = [
  artifactRef(
    path.join(root, '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/subagents/subagent-evidence-envelope.schema.json'),
    'subagent_evidence_envelope_schema',
    'schema artifact for subagentEvidenceEnvelope required fields and forbidden control fields',
    'subagent_evidence_envelope_schema-trace-035-v1'
  ),
  artifactRef(
    path.join(root, '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/subagents/subagent-envelope-acceptance-report.json'),
    'subagent_evidence_envelope_acceptance_report',
    'acceptance report proving current subagentEvidenceEnvelope validates before controlled ingest',
    'subagent_evidence_envelope_acceptance_report-trace-035-v1'
  ),
];

let envelope = {
  envelopeVersion: 'subagent-evidence-envelope/v1',
  recordId: 'REQ-CLOSED-LOOP-DESIGN',
  requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
  parentRunId: runId,
  parentCloseoutAttemptId: closeoutAttemptId,
  subtaskId: 'TRACE-035-subagent-evidence-envelope-governance',
  packetId: 'packet-TRACE-035-current',
  packetKind: 'execution',
  executorKind: 'codex_worker_adapter',
  executorRole: 'implementation-worker',
  decisionAuthority: 'none',
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  traceRows: ['TRACE-035'],
  coveredRequirementIds: ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027'],
  taskRefs: ['TASK-SUBAGENT-EVIDENCE-ENVELOPE-GOVERNANCE'],
  allowedWriteScope: [
    '_bmad/_schemas/**',
    'scripts/**',
    'tests/acceptance/**',
    '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-035/**',
  ],
  actualFilesChanged: changedFiles,
  diffHash: sha256Object({ changedFiles }),
  workspaceRef: {
    kind: 'main_workspace',
    path: root.replace(/\\/g, '/'),
    commitBefore: 'ae2ca285',
    commitAfter: 'working-tree-trace-035-before-commit',
  },
  commandRuns: commandEvidence.commandRuns.map((run) => ({
    commandId: run.commandId,
    command: run.command,
    exitCode: run.exitCode,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    outputSummary: run.outputSummary,
    artifactRefs: outputArtifacts.filter((artifact) => artifact.path === run.outputPath),
    closeoutAttemptId,
  })),
  artifactRefs: baseArtifactRefs,
  hookReceipts: [],
  transportRefs: [],
  status: 'accepted',
  failureRecords: [],
};

const envelopePath = path.join(runDir, 'accepted-subagent-evidence-envelope.json');
const finalArtifactRefs = baseArtifactRefs;
const packetArtifactRefs = [...finalArtifactRefs, ...packetOnlyArtifactRefs];
envelope = {
  ...envelope,
  artifactRefs: finalArtifactRefs,
  commandRuns: envelope.commandRuns.map((run) => ({
    ...run,
    artifactRefs: finalArtifactRefs.filter((artifact) => artifact.path.endsWith(`${run.commandId}.output.txt`)),
  })),
};
fs.writeFileSync(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

const packet = {
  eventType: 'execution_iteration_recorded',
  recordId: 'REQ-CLOSED-LOOP-DESIGN',
  requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
  executionIterationId: 'execution-iteration-TRACE035-current-20260521T031700Z',
  runId,
  closeoutAttemptId,
  status: 'done',
  sourceDocumentHash,
  implementationConfirmationHash,
  architectureConfirmationHash,
  traceRows: ['TRACE-035'],
  taskRefs: ['TASK-SUBAGENT-EVIDENCE-ENVELOPE-GOVERNANCE'],
  evidenceRefs: ['EVD-004', 'EVD-044', 'EVD-045'],
  filesChanged: changedFiles,
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: changedFiles,
    diffSummaryRef: rel(path.join(runDir, 'diff-summary.md')),
    negativeAssertionArtifactRefs: [finalArtifactRefs.find((artifact) => artifact.artifactType === 'negative_assertion_evidence')],
  },
  diffSummary:
    'TRACE-035 adds subagent evidence envelope schema, validation, controlled ingest recording, and Codex worker adapter envelope binding with fail-closed tests.',
  commandRuns: commandEvidence.commandRuns,
  artifactRefs: packetArtifactRefs,
  subagentEvidenceEnvelope: envelope,
  deliveryEvidence: {
    requiredCommands: [
      {
        commandId: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE',
        command:
          'npx.cmd vitest run tests/acceptance/subagent-evidence-envelope.test.ts tests/acceptance/main-agent-codex-worker-adapter-e2e.test.ts tests/acceptance/implementation-evidence-ingest.test.ts tests/acceptance/requirement-record-schema.test.ts',
        commandType: 'delivery_evidence',
        blockingIfMissing: true,
        traceRows: ['TRACE-035'],
        evidenceRefs: ['EVD-004', 'EVD-044', 'EVD-045'],
        artifactRefs: packetArtifactRefs,
      },
    ],
    historicalRunRefs: commandEvidence.commandRuns.map((run) => ({ commandId: run.commandId, runId, closeoutAttemptId })),
  },
  requirementClosures: [
    { requirementId: 'MUST-044', status: 'pass' },
    { requirementId: 'MUST-046', status: 'pass' },
    { requirementId: 'NEG-034', status: 'pass' },
    { requirementId: 'NEG-035', status: 'pass' },
    { requirementId: 'OUT-027', status: 'pass' },
    { requirementId: 'EVD-004', status: 'pass' },
    { requirementId: 'EVD-044', status: 'pass' },
    { requirementId: 'EVD-045', status: 'pass' },
  ],
  contractChecks: [
    { checkId: 'RCC-SUBAGENT-EVIDENCE-ENVELOPE:TRACE-035:current', contract: 'RCC-SUBAGENT-EVIDENCE-ENVELOPE', decision: 'pass' },
    {
      checkId: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE:TRACE-035:current',
      contract: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE',
      decision: 'pass',
    },
    { checkId: 'CMD-RENDER-CONFIRMATION:TRACE-035:current', contract: 'CMD-RENDER-CONFIRMATION', decision: 'pass' },
    { checkId: 'CMD-TRACE-BINDING-ACCEPTANCE:TRACE-035:current', contract: 'CMD-TRACE-BINDING-ACCEPTANCE', decision: 'pass' },
    { checkId: 'CMD-ENCODING-GATE:TRACE-035:current', contract: 'CMD-ENCODING-GATE', decision: 'pass' },
  ],
};

const packetPath = path.join(runDir, 'implementation-evidence-packet.json');
fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      ok: true,
      packetPath: rel(packetPath),
      artifactCount: finalArtifactRefs.length,
      envelopeHash: sha256Object(envelope),
    },
    null,
    2
  )
);
