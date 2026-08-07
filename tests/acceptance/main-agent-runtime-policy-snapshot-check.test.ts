import * as crypto from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence';
import { mainRuntimePolicySnapshotCheck } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-runtime-policy-snapshot-check';
import { createRequirementsContractNormalizedTraceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const TRANSACTION_ID = 'TX-RUNTIME-POLICY-001';
const IMPLEMENTATION_ATTEMPT_ID = 'IMP-RUNTIME-POLICY-001';
const SEMANTIC_MODEL_HASH = sha256Buffer('runtime-policy-semantic-model');
const PACKET_HASH = sha256Buffer('runtime-policy-model-packet');
const RUN_ID = 'run-019';
const CLOSEOUT_ATTEMPT_ID = 'closeout-019';

const globalContractTraceabilityPolicy = {
  schemaVersion: 'global-contract-traceability-policy/v1',
  appliesToEntryFlows: ['bugfix', 'standalone_tasks', 'story'],
  contractAuthoringRequired: true,
  taskBindingRequired: true,
  taskBindingDimensions: ['MUST', 'NEG', 'OUT', 'EVD', 'TRACE'],
  missingBindingBehavior: 'fail_closed',
  sourceDocumentHashRequired: true,
  implementationConfirmationHashRequired: true,
  reconfirmOnTraceSemanticChange: true,
  allowUnboundImplementationTask: false,
};

const traceStatusPolicy = {
  schemaVersion: 'trace-status-policy/v1',
  allowedStatuses: [
    'PENDING',
    'PASS',
    'FAIL',
    'BLOCKED',
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
  ],
  terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
  linkedDownstreamRequiredFields: [
    'downstreamRecordId',
    'downstreamStoryRef',
    'downstreamSourceDocumentPath',
    'downstreamSourceDocumentHash',
    'downstreamScopeSummary',
    'downstreamRequirementIds',
    'downstreamAuditEvidenceRefs',
  ],
  userApprovedDeferredRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'followUpRecordId',
  ],
  userApprovedOutOfScopeRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
  ],
  bareDeferredForbidden: true,
  bareOutOfScopeForbidden: true,
  fullCloseoutForUserScopedStatusesForbidden: true,
};

function sha256Buffer(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function stableHash(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(sort);
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sort(item)])
    );
  };
  return sha256Buffer(JSON.stringify(sort(value)));
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function artifactRef(
  root: string,
  artifactPath: string,
  hash: string,
  overrides: Record<string, unknown> = {}
) {
  const artifact = {
    artifactType: 'runtime_policy_snapshot',
    sourceOfTruthRole: 'projection',
    path: artifactPath,
    hash,
    producer: 'main-agent-runtime-policy-snapshot-check.test',
    purpose: 'freeze runtime policy snapshot as requirement-scoped context projection',
    relatedRequirementIds: ['MUST-026', 'NEG-014', 'OUT-012', 'EVD-026', 'TRACE-019'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'runtime-policy-snapshot-v1',
    ...overrides,
  };
  const schemaPath = `${path.resolve(root, artifactPath)}.schema.json`;
  const readbackReceiptPath = `${path.resolve(root, artifactPath)}.readback-receipt.json`;
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
  });
  const portableSchemaPath = path.relative(root, schemaPath).replace(/\\/g, '/');
  const portableReceiptPath = path.relative(root, readbackReceiptPath).replace(/\\/g, '/');
  const receiptPayload = {
    schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1',
    artifactId: path.basename(artifactPath),
    artifactType: String(artifact.artifactType),
    artifactPath,
    artifactHash: hash,
    artifactSchemaPath: portableSchemaPath,
    artifactSchemaHash: sha256Buffer(readFileSync(schemaPath)),
    producerIdentity: {
      class: 'controlled_artifact_producer',
      id: String(artifact.producer),
    },
    requirementSetId: 'REQ-RUNTIME-POLICY',
    requirementRefs: artifact.relatedRequirementIds.map(String),
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    publishedAt: '2026-05-19T00:00:00.000Z',
    readbackAt: '2026-05-19T00:00:01.000Z',
    publication: {
      targetPath: artifactPath,
      publishedHash: hash,
      readbackHash: hash,
      readbackVerified: true,
    },
    decision: 'pass',
  };
  writeJson(readbackReceiptPath, {
    ...receiptPayload,
    receiptHash: stableHash(receiptPayload),
  });
  return {
    ...artifact,
    schemaPath: portableSchemaPath,
    readbackReceiptPath: portableReceiptPath,
  };
}

function bindIndependentOracleAuthority(
  packet: Record<string, unknown>,
  requirementIds: string[]
): void {
  const commandRun = (packet.commandRuns as Array<Record<string, unknown>>)[0];
  commandRun.coveredRequirementIds = requirementIds;
  const nodes = requirementIds.flatMap((requirementId) => {
    const oracleId = `ORACLE-${requirementId}`;
    return [
      {
        id: requirementId,
        nodeType: 'requirement' as const,
        bodyHash: sha256Buffer(`${requirementId}:body`),
        sourceRootRef: `${requirementId}:source`,
        sourceRootPayloadHash: sha256Buffer(`${requirementId}:source-root`),
        authorityClass: 'source_authorized',
      },
      {
        id: oracleId,
        nodeType: 'oracle' as const,
        bodyHash: sha256Buffer(`${oracleId}:body`),
        sourceRootRef: `${oracleId}:source`,
        sourceRootPayloadHash: sha256Buffer(`${oracleId}:source-root`),
        authorityClass: 'independent_oracle',
      },
    ];
  });
  const graph = createRequirementsContractNormalizedTraceGraph({
    requirementSetId: String(packet.requirementSetId),
    sourceAuthorityHash: String(packet.sourceDocumentHash),
    semanticModelHash: String(packet.semanticModelHash),
    semanticConservationManifestHash: sha256Buffer('runtime-policy-conservation'),
    nodes,
    edges: requirementIds.map((requirementId) => ({
      edgeId: `EDGE-${requirementId}`,
      edgeType: 'verified_by' as const,
      fromRef: requirementId,
      toRef: `ORACLE-${requirementId}`,
      sourceRef: `${requirementId}:trace`,
      sourceHash: sha256Buffer(`${requirementId}:edge`),
      proofRefs: [`PROOF-${requirementId}`],
      applicability: 'applicable' as const,
    })),
  });
  packet.normalizedTraceGraph = graph;
  packet.independentOracleResults = requirementIds.map((requirementId) => ({
    requirementId,
    oracleId: `ORACLE-${requirementId}`,
    decision: 'pass',
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    sourceDocumentHash: SOURCE_HASH,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    packetHash: PACKET_HASH,
    graphHash: graph.graphHash,
    commandId: commandRun.commandId,
    outputHash: commandRun.outputHash,
    evidenceRefs: packet.evidenceRefs,
    observedAt: '2026-05-19T00:00:05.000Z',
  }));
}

function writeFixture(root: string, locale = 'zh-CN') {
  writeJson(path.join(root, 'package-lock.json'), { lockfileVersion: 3, packages: {} });
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-RUNTIME-POLICY'
  );
  const recoveryDir = path.join(base, 'recovery');
  const evidenceDir = path.join(base, 'evidence', 'TRACE-019', 'run-001');
  mkdirSync(recoveryDir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });
  const policy = {
    flow: 'standalone_tasks',
    stage: 'implement',
    strictness: 'strict',
    mandatoryGate: false,
    scoringEnabled: false,
    language: {
      preserveMachineKeys: true,
      preserveParserAnchors: true,
      preserveTriggerStage: true,
    },
  };
  const snapshot = {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    recordId: 'REQ-RUNTIME-POLICY',
    requirementSetId: 'REQ-RUNTIME-POLICY',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    policyHash: stableHash(policy),
    policy,
    locale,
    host: 'codex',
    stage: 'implement',
    strictness: 'strict',
    mandatoryGates: [],
    localeIsolation: {
      localeAffectsConfirmationLanguage: false,
      localeAffectsRequirementSemantics: false,
      localeAffectsPassEvidence: false,
      localeAffectsCloseout: false,
    },
  };
  const snapshotPath = path.join(recoveryDir, 'runtime-policy-snapshot.json');
  writeJson(snapshotPath, snapshot);
  const snapshotHash = sha256Buffer(readFileSync(snapshotPath));
  const runtimeRef = artifactRef(
    root,
    path.relative(root, snapshotPath).replace(/\\/g, '/'),
    snapshotHash
  );
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, {
    recordId: 'REQ-RUNTIME-POLICY',
    requirementSetId: 'REQ-RUNTIME-POLICY',
    status: 'user_confirmed',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    transactionId: TRANSACTION_ID,
    currentAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    packetHash: PACKET_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-RUNTIME-POLICY',
        requirementSetId: 'REQ-RUNTIME-POLICY',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/contract.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation-render-report.json',
        htmlPath: 'confirmation.html',
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
    },
    globalContractTraceabilityPolicy,
    traceStatusPolicy,
    artifactIndex: [runtimeRef],
    runtimePolicySnapshotRef: runtimeRef,
  });
  const summaryPath = path.join(evidenceDir, 'implementation-delta-summary.json');
  writeJson(summaryPath, {
    summary: 'TRACE-019 runtime policy snapshot test delta.',
  });
  const negativePath = path.join(evidenceDir, 'negative-assertions.json');
  writeJson(negativePath, {
    assertions: [
      'locale cannot change confirmation language hash',
      'locale cannot change requirement semantics',
      'locale cannot change PASS evidence or closeout',
    ],
  });
  return { recordPath, snapshotPath, snapshotHash, runtimeRef, summaryPath, negativePath };
}

function writeEvidencePacket(root: string, fixture: ReturnType<typeof writeFixture>): string {
  const evidencePath = path.join(
    path.dirname(fixture.summaryPath),
    'implementation-evidence-packet.json'
  );
  const summaryRef = artifactRef(
    root,
    path.relative(root, fixture.summaryPath).replace(/\\/g, '/'),
    sha256Buffer(readFileSync(fixture.summaryPath)),
    {
      artifactType: 'implementation_delta_summary',
      sourceOfTruthRole: 'evidence',
    }
  );
  const negativeRef = artifactRef(
    root,
    path.relative(root, fixture.negativePath).replace(/\\/g, '/'),
    sha256Buffer(readFileSync(fixture.negativePath)),
    {
      artifactType: 'negative_assertion_report',
      sourceOfTruthRole: 'evidence',
    }
  );
  const command =
    'npx ts-node --project tsconfig.node.json --transpile-only packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-runtime-policy-snapshot-check.ts';
  const commandOutputPath = path.join(path.dirname(evidencePath), 'command-output.txt');
  writeFileSync(commandOutputPath, 'runtime_policy_snapshot=pass\n', 'utf8');
  const environment = { platform: process.platform, architecture: process.arch };
  const runtimeVersions = { node: process.version };
  const packet: Record<string, unknown> = {
    eventType: 'execution_iteration_recorded',
    recordId: 'REQ-RUNTIME-POLICY',
    requirementSetId: 'REQ-RUNTIME-POLICY',
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    packetHash: PACKET_HASH,
    executionIterationId: 'exec-019',
    runId: RUN_ID,
    status: 'done',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    traceRows: ['TRACE-019'],
    taskRefs: ['TASK-FUNCTIONAL-RESUME'],
    evidenceRefs: ['EVD-005', 'EVD-022', 'EVD-026'],
    filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-runtime-policy-snapshot-check.ts'],
    implementationDelta: {
      filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-runtime-policy-snapshot-check.ts'],
      diffSummaryRef: path.relative(root, fixture.summaryPath).replace(/\\/g, '/'),
      behaviorAffecting: true,
      negativeAssertionArtifactRefs: [negativeRef],
    },
    diffSummary: 'Add runtime policy snapshot ref enforcement.',
    commandRuns: [
      {
        commandId: 'CMD-RUNTIME-POLICY-SNAPSHOT-CHECK',
        command,
        normalizedCommand: command,
        cwd: root,
        executorIdentity: {
          class: 'controlled_detached_executor',
          id: 'EXECUTOR-RUNTIME-POLICY',
        },
        runtimeVersions,
        dependencyLockHashes: [
          {
            path: 'package-lock.json',
            hash: sha256Buffer(readFileSync(path.join(root, 'package-lock.json'))),
          },
        ],
        environment,
        environmentFingerprint: stableHash({ environment, runtimeVersions }),
        environmentCompatibilityDecision: 'pass',
        transactionId: TRANSACTION_ID,
        implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
        sourceDocumentHash: SOURCE_HASH,
        semanticModelHash: SEMANTIC_MODEL_HASH,
        packetHash: PACKET_HASH,
        runId: RUN_ID,
        closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
        exitCode: 0,
        startedAt: '2026-05-19T00:00:00.000Z',
        completedAt: '2026-05-19T00:00:05.000Z',
        outputPath: commandOutputPath,
        outputHash: sha256Buffer(readFileSync(commandOutputPath)),
        outputSummary: 'runtime_policy_snapshot=pass',
      },
    ],
    artifactRefs: [summaryRef, negativeRef, fixture.runtimeRef],
    runtimePolicySnapshotRef: fixture.runtimeRef,
    entryFlowState: {
      entryFlow: 'standalone_tasks',
      entryFlowClass: 'task_packet_entry',
      workflowAdapter: 'direct',
      contractAuthoringRequired: true,
      globalContractTraceabilityPolicy,
      traceStatusPolicy,
    },
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-RUNTIME-POLICY-SNAPSHOT-CHECK',
          command,
          commandType: 'delivery_evidence',
          blockingIfMissing: true,
          traceRows: ['TRACE-019'],
          evidenceRefs: ['EVD-026'],
          artifactRefs: [summaryRef],
        },
      ],
      historicalRunRefs: [
        {
          commandId: 'CMD-RUNTIME-POLICY-SNAPSHOT-CHECK',
          runId: RUN_ID,
          closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
        },
      ],
    },
    requirementClosures: [{ requirementId: 'MUST-026', status: 'pass' }],
    gateChecks: [{ gate: 'Runtime Policy Snapshot Check', decision: 'pass' }],
    closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
  };
  bindIndependentOracleAuthority(packet, ['MUST-026']);
  writeJson(evidencePath, packet);
  return evidencePath;
}

describe('main-agent runtime policy snapshot check', () => {
  it('passes when runtimePolicySnapshotRef is indexed, hash-matched, and locale-isolated', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-snapshot-pass-'));
    try {
      const fixture = writeFixture(root);
      const reportPath = path.join(root, 'runtime-policy-snapshot-check.json');
      const prev = process.cwd();
      process.chdir(root);
      try {
        const code = mainRuntimePolicySnapshotCheck([
          '--requirement-record',
          fixture.recordPath,
          '--report-path',
          reportPath,
          '--json',
        ]);
        expect(code).toBe(0);
      } finally {
        process.chdir(prev);
      }
      expect(existsSync(reportPath)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.decision).toBe('pass');
      expect(report.snapshotSummary).toMatchObject({
        locale: 'zh-CN',
        host: 'codex',
        stage: 'implement',
        strictness: 'strict',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks missing runtimePolicySnapshotRef and hash drift', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-snapshot-block-'));
    try {
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      delete record.runtimePolicySnapshotRef;
      writeJson(fixture.recordPath, record);
      const missingCode = mainRuntimePolicySnapshotCheck([
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(missingCode).toBe(1);

      record.runtimePolicySnapshotRef = fixture.runtimeRef;
      writeJson(fixture.recordPath, record);
      writeFileSync(
        fixture.snapshotPath,
        `${readFileSync(fixture.snapshotPath, 'utf8')}\n`,
        'utf8'
      );
      const driftCode = mainRuntimePolicySnapshotCheck([
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(driftCode).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks locale leakage into confirmation, requirement semantics, pass evidence, or closeout', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-snapshot-locale-'));
    try {
      const fixture = writeFixture(root, 'en-US');
      const snapshot = JSON.parse(readFileSync(fixture.snapshotPath, 'utf8'));
      snapshot.localeIsolation.localeAffectsCloseout = true;
      writeJson(fixture.snapshotPath, snapshot);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      record.runtimePolicySnapshotRef.hash = sha256Buffer(readFileSync(fixture.snapshotPath));
      record.runtimePolicySnapshotRef.contentHash = record.runtimePolicySnapshotRef.hash;
      record.artifactIndex[0] = record.runtimePolicySnapshotRef;
      writeJson(fixture.recordPath, record);

      const code = mainRuntimePolicySnapshotCheck(['--requirement-record', fixture.recordPath]);
      expect(code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('controlled ingest records runtimePolicySnapshotRef without treating it as a control artifact', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-snapshot-ingest-'));
    try {
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      delete record.runtimePolicySnapshotRef;
      record.artifactIndex = [];
      writeJson(fixture.recordPath, record);
      const evidencePath = writeEvidencePacket(root, fixture);
      const prev = process.cwd();
      process.chdir(root);
      try {
        const code = mainIngestImplementationEvidence([
          '--evidence',
          evidencePath,
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-at',
          '2026-05-19T00:00:06.000Z',
          '--recorded-by',
          'test-agent',
        ]);
        expect(code).toBe(0);
      } finally {
        process.chdir(prev);
      }
      const updated = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(updated.runtimePolicySnapshotRef).toMatchObject({
        artifactType: 'runtime_policy_snapshot',
        sourceOfTruthRole: 'projection',
        path: fixture.runtimeRef.path,
      });
      expect(updated.runtimePolicySnapshotRef.sourceOfTruthRole).not.toBe('control');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
