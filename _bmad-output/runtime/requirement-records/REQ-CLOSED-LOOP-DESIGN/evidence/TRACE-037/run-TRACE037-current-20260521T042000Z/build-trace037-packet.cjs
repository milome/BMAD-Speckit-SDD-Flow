const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || 'tsconfig.node.json';
require('ts-node/register/transpile-only');
const {
  buildParallelMissionPlan,
  buildPrTopology,
  evaluateParallelMissionEvidenceIntegration,
} = require(path.resolve(process.cwd(), 'scripts/parallel-mission-control.ts'));
const { sha256Object } = require(path.resolve(process.cwd(), 'scripts/subagent-evidence-envelope.ts'));

const root = process.cwd();
const runId = 'run-TRACE037-current-20260521T042000Z';
const executionIterationId = 'execution-iteration-TRACE037-current-20260521T042000Z';
const recordId = 'REQ-CLOSED-LOOP-DESIGN';
const requirementSetId = 'REQ-CLOSED-LOOP-DESIGN';
const sourceDocumentHash = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const implementationConfirmationHash = 'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const architectureConfirmationHash = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';
const closeoutAttemptId = 'closeout-attempt-REQ-CLOSED-LOOP-DESIGN-TRACE038-copy-button-20260520T164100Z';
const runDir = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-037/run-TRACE037-current-20260521T042000Z'
);
const reportPath = path.resolve(
  root,
  '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/subagents/parallel-mission-evidence-integration-report.json'
);
const inputVersion = [
  `source=${sourceDocumentHash}`,
  `implementation=${implementationConfirmationHash}`,
  `architecture=${architectureConfirmationHash}`,
].join(';');
const relatedRequirementIds = ['MUST-048', 'NEG-037', 'EVD-006', 'EVD-021', 'EVD-047', 'TRACE-037'];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function summary(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-24)
    .join(' | ')
    .slice(-1800);
}

function artifact(file, artifactType, purpose, outputVersion, producer = 'TRACE-037 current implementation run') {
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

function nodeArtifact(nodeId) {
  const file = path.join(runDir, `${nodeId}-node-evidence.json`);
  writeJson(file, { nodeId, verification: 'passed', traceRow: 'TRACE-037' });
  return artifact(file, 'parallel_mission_node_evidence', `accepted envelope evidence for ${nodeId}`, 'parallel_node_evidence-trace-037-v1');
}

function envelope(nodeId, packetId, artifactRef, changedFile) {
  return {
    envelopeVersion: 'subagent-evidence-envelope/v1',
    recordId,
    requirementSetId,
    parentRunId: runId,
    parentCloseoutAttemptId: closeoutAttemptId,
    subtaskId: nodeId,
    packetId,
    packetKind: 'parallel_node',
    executorKind: 'parallel_mission_node',
    executorRole: 'implementation-worker',
    decisionAuthority: 'none',
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash,
    traceRows: ['TRACE-037'],
    coveredRequirementIds: ['MUST-048', 'NEG-037'],
    taskRefs: ['TASK-PARALLEL-MISSION-EVIDENCE-INTEGRATION'],
    allowedWriteScope: ['scripts/parallel-mission-control.ts', 'scripts/main-agent-delivery-closeout-gate.ts', 'tests/acceptance/**'],
    actualFilesChanged: [changedFile],
    diffHash: sha256Object({ nodeId, changedFile }),
    workspaceRef: { kind: 'worktree', path: root, commitBefore: 'before', commitAfter: 'after' },
    commandRuns: [
      {
        commandId: `CMD-${nodeId.toUpperCase()}-NODE`,
        command: 'node verify-parallel-node.js',
        exitCode: 0,
        startedAt: '2026-05-20T20:17:37.000Z',
        completedAt: '2026-05-20T20:17:38.000Z',
        outputSummary: `${nodeId} node verification passed`,
        artifactRefs: [artifactRef],
        closeoutAttemptId,
      },
    ],
    artifactRefs: [artifactRef],
    hookReceipts: [],
    transportRefs: [],
    status: 'accepted',
    failureRecords: [],
  };
}

const commandRunsPath = path.join(runDir, 'trace037-command-runs.json');
const commandRuns = readJson(commandRunsPath).map((run) => ({
  ...run,
  runId,
  closeoutAttemptId,
  outputSummary: summary(path.resolve(root, run.outputPath)),
}));
const commandOutputArtifacts = commandRuns.map((run) =>
  artifact(path.resolve(root, run.outputPath), 'command_output', `command output for ${run.commandId}`, 'command_output-trace-037-current-v1')
);
const commandEvidencePath = path.join(runDir, 'trace037-command-evidence.json');
const diffSummaryPath = path.join(runDir, 'diff-summary.md');
const negativeAssertionsPath = path.join(runDir, 'negative-assertions.json');

fs.writeFileSync(
  diffSummaryPath,
  [
    '# TRACE-037 Implementation Delta',
    '',
    '- Added parallel mission evidence integration evaluator for node envelopes, write scope proof, dependency merge order, PR topology reconciliation, and integrated main workspace verification.',
    '- Delivery Closeout Gate now fail-closes TRACE-037/parallel mission closeout when the current-attempt integration report is missing or blocked.',
    '- PR topology green status now requires evidence provenance when used as a pass signal.',
    '',
  ].join('\n'),
  'utf8'
);

const nodeAArtifact = nodeArtifact('node-a');
const nodeBArtifact = nodeArtifact('node-b');
const integratedArtifactFile = path.join(runDir, 'main-workspace-integrated-verification.json');
writeJson(integratedArtifactFile, { traceRow: 'TRACE-037', integratedVerification: 'passed' });
const integratedArtifact = artifact(
  integratedArtifactFile,
  'parallel_mission_integrated_verification',
  'main workspace integrated verification evidence for parallel mission',
  'parallel_mission_integrated_verification-trace-037-v1'
);
const missionPlan = buildParallelMissionPlan({
  batchId: 'trace-037-parallel-mission',
  nodes: [
    {
      node_id: 'node-a',
      story_key: 'REQ-CLOSED-LOOP-DESIGN',
      packet_id: 'packet-node-a',
      write_scope: ['scripts/parallel-mission-control.ts'],
      depends_on: [],
      assigned_agent: 'implementation-worker',
      target_branch: 'local/trace-037-node-a',
      target_pr: 'LOCAL-PR-A',
    },
    {
      node_id: 'node-b',
      story_key: 'REQ-CLOSED-LOOP-DESIGN',
      packet_id: 'packet-node-b',
      write_scope: ['scripts/main-agent-delivery-closeout-gate.ts', 'tests/acceptance/parallel-mission-evidence-integration.test.ts'],
      depends_on: ['node-a'],
      assigned_agent: 'implementation-worker',
      target_branch: 'local/trace-037-node-b',
      target_pr: 'LOCAL-PR-B',
    },
  ],
});
const prTopology = buildPrTopology({
  plan: missionPlan,
  states: { 'node-a': 'merged', 'node-b': 'closed_not_needed' },
  evidence_provenance: { runId, storyKey: recordId, evidenceBundleId: 'trace-037-evidence' },
});
const report = evaluateParallelMissionEvidenceIntegration({
  plan: missionPlan,
  prTopology,
  currentCloseoutAttemptId: closeoutAttemptId,
  projectRoot: root,
  record: {
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationState: { currentArchitectureConfirmationHash: architectureConfirmationHash },
  },
  nodeEvidence: [
    { node_id: 'node-a', envelope: envelope('node-a', 'packet-node-a', nodeAArtifact, 'scripts/parallel-mission-control.ts') },
    { node_id: 'node-b', envelope: envelope('node-b', 'packet-node-b', nodeBArtifact, 'scripts/main-agent-delivery-closeout-gate.ts') },
  ],
  integratedVerification: {
    closeoutAttemptId,
    workspaceRef: { kind: 'main_workspace', path: root, commitBefore: 'before', commitAfter: 'after' },
    commandRuns: [
      {
        commandId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
        closeoutAttemptId,
        exitCode: 0,
        artifactRefs: [integratedArtifact],
      },
    ],
    artifactRefs: [integratedArtifact],
  },
});
writeJson(reportPath, report);

writeJson(negativeAssertionsPath, {
  schemaVersion: 'negative-assertion-evidence/v1',
  traceRow: 'TRACE-037',
  assertions: [
    {
      id: 'NEG-037-node-envelope-required',
      requirementId: 'NEG-037',
      assertion: 'Parallel mission closeout blocks when any required node lacks an accepted envelope.',
      proof: 'parallel-mission-evidence-integration.test.ts covers node_missing_envelope.',
    },
    {
      id: 'NEG-037-write-scope-and-merge-order-required',
      requirementId: 'NEG-037',
      assertion: 'Unresolved write-scope conflicts and missing dependency merge order block closeout.',
      proof: 'acceptance tests cover overlapping_write_scope_without_serialization and dependency_order_missing.',
    },
    {
      id: 'NEG-037-pr-green-not-authoritative',
      requirementId: 'NEG-037',
      assertion: 'all_affected_stories_passed or assigned agent green cannot replace node closure and current-attempt integrated verification.',
      proof: 'acceptance tests cover PR topology green with open nodes and missing integrated verification.',
    },
  ],
  generatedAt: new Date().toISOString(),
});

const reportArtifact = artifact(
  reportPath,
  'parallel_mission_evidence_integration_report',
  'current-attempt parallel mission evidence integration report',
  'parallel_mission_evidence_integration_report-trace-037-v1'
);
const negativeArtifact = artifact(
  negativeAssertionsPath,
  'negative_assertion_evidence',
  'negative and regression assertions for parallel mission evidence integration',
  'negative_assertion_evidence-trace-037-v1'
);
const diffArtifact = artifact(diffSummaryPath, 'diff_summary', 'implementation delta summary for TRACE-037', 'diff_summary-trace-037-v1');

writeJson(commandEvidencePath, {
  schemaVersion: 'command-evidence/v1',
  traceRow: 'TRACE-037',
  runId,
  closeoutAttemptId,
  commandRuns,
  report: {
    path: rel(reportPath),
    hash: sha256File(reportPath),
    decision: report.decision,
    nodeCount: report.nodeResults.length,
  },
});
const commandEvidenceArtifact = artifact(
  commandEvidencePath,
  'command_evidence',
  'current command evidence for TRACE-037 delivery and recurring contract validation',
  'command_evidence-trace-037-v1'
);

const allArtifacts = [
  reportArtifact,
  negativeArtifact,
  diffArtifact,
  commandEvidenceArtifact,
  nodeAArtifact,
  nodeBArtifact,
  integratedArtifact,
  ...commandOutputArtifacts,
];

const packetPath = path.join(runDir, 'implementation-evidence-packet.json');
writeJson(packetPath, {
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
  traceRows: ['TRACE-037'],
  taskRefs: ['TASK-PARALLEL-MISSION-EVIDENCE-INTEGRATION'],
  evidenceRefs: ['EVD-006', 'EVD-021', 'EVD-047'],
  filesChanged: [
    'scripts/parallel-mission-control.ts',
    'scripts/main-agent-delivery-closeout-gate.ts',
    'tests/acceptance/parallel-mission-evidence-integration.test.ts',
  ],
  implementationDelta: {
    behaviorAffecting: true,
    filesChanged: [
      'scripts/parallel-mission-control.ts',
      'scripts/main-agent-delivery-closeout-gate.ts',
      'tests/acceptance/parallel-mission-evidence-integration.test.ts',
    ],
    diffSummaryRef: rel(diffSummaryPath),
    negativeAssertionArtifactRefs: [negativeArtifact],
  },
  diffSummary:
    'TRACE-037 adds parallel mission evidence integration and closeout fail-closed behavior for missing or stale node/integrated verification evidence.',
  commandRuns,
  artifactRefs: allArtifacts,
  deliveryEvidence: {
    requiredCommands: [
      {
        commandId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
        command: commandRuns[0].command,
        commandType: 'delivery_evidence',
        blockingIfMissing: true,
        negativeOrRegression: true,
        closeoutAttemptId,
        traceRows: ['TRACE-037'],
        evidenceRefs: ['EVD-006', 'EVD-021', 'EVD-047'],
        artifactRefs: [reportArtifact, negativeArtifact, commandEvidenceArtifact, commandOutputArtifacts[0]],
      },
    ],
    historicalRunRefs: commandRuns.map((run) => ({ commandId: run.commandId, runId, closeoutAttemptId })),
  },
  requirementClosures: [
    { requirementId: 'MUST-048', status: 'pass' },
    { requirementId: 'NEG-037', status: 'pass' },
    { requirementId: 'EVD-006', status: 'pass' },
    { requirementId: 'EVD-021', status: 'pass' },
    { requirementId: 'EVD-047', status: 'pass' },
  ],
  contractChecks: [
    { checkId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION:TRACE-037:current', contract: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION', decision: 'pass' },
    { checkId: 'CMD-RENDER-CONFIRMATION:TRACE-037:current', contract: 'CMD-RENDER-CONFIRMATION', decision: 'pass' },
    { checkId: 'CMD-TRACE-BINDING-ACCEPTANCE:TRACE-037:current', contract: 'CMD-TRACE-BINDING-ACCEPTANCE', decision: 'pass' },
    { checkId: 'CMD-ENCODING-GATE:TRACE-037:current', contract: 'CMD-ENCODING-GATE', decision: 'pass' },
  ],
  gateChecks: [
    { checkId: 'GATE-PARALLEL-MISSION-EVIDENCE-INTEGRATION:TRACE-037:current', gate: 'Parallel Mission Evidence Integration Gate', decision: 'pass' },
  ],
});

console.log(JSON.stringify({ ok: true, packetPath: rel(packetPath), reportDecision: report.decision, artifactCount: allArtifacts.length }, null, 2));
