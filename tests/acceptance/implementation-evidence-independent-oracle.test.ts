import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence';
import { createRequirementsContractNormalizedTraceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonObject = Record<string, unknown>;

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
  taskRegistryField: 'implementationTasks',
  traceTaskRefsMustResolveTo: 'implementationTasks[].id',
  readinessFailureWhenUnresolved: true,
  closeoutFailureWhenUnresolved: true,
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
    'followUpDueCondition',
  ],
  userApprovedOutOfScopeRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'confirmationDeltaRef',
  ],
  bareDeferredForbidden: true,
  bareOutOfScopeForbidden: true,
  fullCloseoutForUserScopedStatusesForbidden: true,
};

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizedCommand(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function fixtureGraph(input: {
  requirementSetId: string;
  requirementId: string;
  oracleId: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  linked: boolean;
}) {
  const requirementBodyHash = sha256(`${input.requirementId}:body`);
  const oracleBodyHash = sha256(`${input.oracleId}:body`);
  return createRequirementsContractNormalizedTraceGraph({
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    semanticConservationManifestHash: sha256(`${input.requirementSetId}:conservation`),
    nodes: [
      {
        id: input.requirementId,
        nodeType: 'requirement',
        bodyHash: requirementBodyHash,
        sourceRootRef: `${input.requirementSetId}:requirement`,
        sourceRootPayloadHash: sha256(`${input.requirementId}:source-root`),
        authorityClass: 'source_authorized',
      },
      {
        id: input.oracleId,
        nodeType: 'oracle',
        bodyHash: oracleBodyHash,
        sourceRootRef: `${input.requirementSetId}:oracle`,
        sourceRootPayloadHash: sha256(`${input.oracleId}:source-root`),
        authorityClass: 'independent_oracle',
      },
    ],
    edges: input.linked
      ? [
          {
            edgeId: `EDGE-${randomUUID()}`,
            edgeType: 'verified_by',
            fromRef: input.requirementId,
            toRef: input.oracleId,
            sourceRef: `${input.requirementSetId}:trace`,
            sourceHash: sha256(`${input.requirementId}:${input.oracleId}:edge`),
            proofRefs: [`PROOF-${randomUUID()}`],
            applicability: 'applicable',
          },
        ]
      : [],
  });
}

function createFixture(): {
  root: string;
  recordPath: string;
  packetPath: string;
  packet: JsonObject;
  requirementId: string;
  oracleId: string;
  makeGraph: (linked: boolean) => ReturnType<typeof fixtureGraph>;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-oracle-'));
  const suffix = randomUUID();
  const recordId = `REQ-${suffix}`;
  const requirementId = `MUST-${suffix}`;
  const oracleId = `ORACLE-${suffix}`;
  const evidenceId = `EVD-${suffix}`;
  const commandId = `CMD-${suffix}`;
  const transactionId = `TX-${suffix}`;
  const implementationAttemptId = `IMP-${suffix}`;
  const runId = `RUN-${suffix}`;
  const closeoutAttemptId = `CLOSEOUT-${suffix}`;
  const sourceDocumentHash = sha256(`${suffix}:source`);
  const implementationConfirmationHash = sha256(`${suffix}:confirmation`);
  const architectureConfirmationHash = sha256(`${suffix}:architecture`);
  const semanticModelHash = sha256(`${suffix}:semantic-model`);
  const packetHash = sha256(`${suffix}:model-packet`);
  const command = 'npx vitest run tests/acceptance/implementation-evidence-independent-oracle.test.ts';
  const lockPath = path.join(root, 'package-lock.json');
  writeJson(lockPath, { lockfileVersion: 3, packages: {} });

  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const executionDir = path.join(base, 'execution');
  const outputPath = path.join(executionDir, 'command-output.txt');
  const artifactPath = path.join(executionDir, 'independent-oracle.json');
  mkdirSync(executionDir, { recursive: true });
  writeFileSync(outputPath, 'independent oracle passed\n', 'utf8');
  writeJson(artifactPath, { oracleId, requirementId, decision: 'pass' });

  const artifactSchemaPath = `${artifactPath}.schema.json`;
  writeJson(artifactSchemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
  });
  const artifactHash = sha256(readFileSync(artifactPath));
  const artifactRef = {
    artifactType: 'independent_oracle_result',
    sourceOfTruthRole: 'evidence',
    path: artifactPath,
    hash: artifactHash,
    producer: 'implementation-evidence-independent-oracle.test',
    purpose: 'prove graph-linked current-attempt independent oracle acceptance',
    relatedRequirementIds: [requirementId],
    status: 'active',
    inputVersion: implementationAttemptId,
    outputVersion: `${implementationAttemptId}:oracle`,
    schemaPath: artifactSchemaPath,
    readbackReceiptPath: `${artifactPath}.readback-receipt.json`,
  };
  const receiptPayload = {
    schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1',
    artifactId: path.basename(artifactPath),
    artifactType: artifactRef.artifactType,
    artifactPath,
    artifactHash,
    artifactSchemaPath,
    artifactSchemaHash: sha256(readFileSync(artifactSchemaPath)),
    producerIdentity: {
      class: 'controlled_artifact_producer',
      id: artifactRef.producer,
    },
    requirementSetId: recordId,
    requirementRefs: [requirementId],
    transactionId,
    implementationAttemptId,
    publishedAt: '2026-07-18T00:00:00.000Z',
    readbackAt: '2026-07-18T00:00:01.000Z',
    publication: {
      targetPath: artifactPath,
      publishedHash: artifactHash,
      readbackHash: artifactHash,
      readbackVerified: true,
    },
    decision: 'pass',
  };
  writeJson(artifactRef.readbackReceiptPath, {
    ...receiptPayload,
    receiptHash: sha256Stable(receiptPayload),
  });

  const makeGraph = (linked: boolean) =>
    fixtureGraph({
      requirementSetId: recordId,
      requirementId,
      oracleId,
      sourceDocumentHash,
      semanticModelHash,
      linked,
    });
  const normalizedTraceGraph = makeGraph(true);
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, {
    recordId,
    requirementSetId: recordId,
    status: 'user_confirmed',
    transactionId,
    currentAttemptId: implementationAttemptId,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticModelHash,
    packetHash,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: architectureConfirmationHash,
    },
    globalContractTraceabilityPolicy,
    traceStatusPolicy,
  });

  const environment = {
    platform: process.platform,
    architecture: process.arch,
  };
  const runtimeVersions = { node: process.version };
  const packet: JsonObject = {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId: recordId,
    transactionId,
    implementationAttemptId,
    semanticModelHash,
    packetHash,
    executionIterationId: `EXEC-${suffix}`,
    runId,
    closeoutAttemptId,
    status: 'done',
    sourceDocumentHash,
    implementationConfirmationHash,
    architectureConfirmationHash,
    traceRows: [`TRACE-${suffix}`],
    taskRefs: [`TASK-${suffix}`],
    evidenceRefs: [evidenceId],
    filesChanged: [
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence.ts',
    ],
    implementationDelta: {
      filesChanged: [
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence.ts',
      ],
      diffSummaryRef: 'implementation-evidence-independent-oracle.diff',
      behaviorAffecting: true,
      negativeAssertionArtifactRefs: [artifactRef],
    },
    diffSummary: 'Bind requirement closure to current-attempt independent oracle evidence.',
    commandRuns: [
      {
        commandId,
        command,
        normalizedCommand: normalizedCommand(command),
        cwd: root,
        executorIdentity: {
          class: 'controlled_detached_executor',
          id: `EXECUTOR-${suffix}`,
        },
        runtimeVersions,
        dependencyLockHashes: [{ path: 'package-lock.json', hash: sha256(readFileSync(lockPath)) }],
        environment,
        environmentFingerprint: sha256Stable({ environment, runtimeVersions }),
        environmentCompatibilityDecision: 'pass',
        transactionId,
        implementationAttemptId,
        sourceDocumentHash,
        semanticModelHash,
        packetHash,
        runId,
        closeoutAttemptId,
        exitCode: 0,
        startedAt: '2026-07-18T00:00:00.000Z',
        completedAt: '2026-07-18T00:00:05.000Z',
        outputPath,
        outputHash: sha256(readFileSync(outputPath)),
        coveredRequirementIds: [requirementId],
      },
    ],
    normalizedTraceGraph,
    independentOracleResults: [
      {
        requirementId,
        oracleId,
        decision: 'pass',
        transactionId,
        implementationAttemptId,
        sourceDocumentHash,
        semanticModelHash,
        packetHash,
        graphHash: normalizedTraceGraph.graphHash,
        commandId,
        outputHash: sha256(readFileSync(outputPath)),
        evidenceRefs: [evidenceId],
        observedAt: '2026-07-18T00:00:05.000Z',
      },
    ],
    artifactRefs: [artifactRef],
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
          commandId,
          command,
          blockingIfMissing: true,
          traceRows: [`TRACE-${suffix}`],
          evidenceRefs: [evidenceId],
          artifactRefs: [artifactRef],
        },
      ],
    },
    requirementClosures: [{ requirementId, status: 'pass' }],
  };
  const packetPath = path.join(executionDir, 'packet.json');
  writeJson(packetPath, packet);
  return { root, recordPath, packetPath, packet, requirementId, oracleId, makeGraph };
}

function ingest(fixture: ReturnType<typeof createFixture>): number {
  writeJson(fixture.packetPath, fixture.packet);
  return mainIngestImplementationEvidence([
    '--evidence',
    fixture.packetPath,
    '--requirement-record',
    fixture.recordPath,
    '--confirmed-at',
    '2026-07-18T00:00:06.000Z',
    '--recorded-by',
    'independent-oracle-test',
    '--json',
  ]);
}

describe('implementation evidence independent oracle authority', () => {
  it('does not create requirement PASS from done, trace rows, or evidence refs', () => {
    const fixture = createFixture();
    try {
      fixture.packet.requirementClosures = [];
      fixture.packet.independentOracleResults = [];
      expect(ingest(fixture)).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.requirementClosures ?? []).toEqual([]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([
    'cwd',
    'executorIdentity',
    'runtimeVersions',
    'dependencyLockHashes',
    'environmentFingerprint',
    'implementationAttemptId',
    'outputHash',
    'coveredRequirementIds',
  ])('rejects command evidence missing %s without mutating the record', (field) => {
    const fixture = createFixture();
    try {
      const before = readFileSync(fixture.recordPath, 'utf8');
      delete (fixture.packet.commandRuns as JsonObject[])[0][field];
      expect(ingest(fixture)).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects non-zero command evidence without mutating the record', () => {
    const fixture = createFixture();
    try {
      const before = readFileSync(fixture.recordPath, 'utf8');
      (fixture.packet.commandRuns as JsonObject[])[0].exitCode = 1;
      expect(ingest(fixture)).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects stale, unlinked, and uncovered independent oracle closure claims', () => {
    const mutations: Array<(fixture: ReturnType<typeof createFixture>) => void> = [
      (fixture) => {
        (fixture.packet.independentOracleResults as JsonObject[])[0].implementationAttemptId =
          `IMP-${randomUUID()}`;
      },
      (fixture) => {
        const graph = fixture.makeGraph(false);
        fixture.packet.normalizedTraceGraph = graph;
        (fixture.packet.independentOracleResults as JsonObject[])[0].graphHash = graph.graphHash;
      },
      (fixture) => {
        (fixture.packet.requirementClosures as JsonObject[]).push({
          requirementId: `MUST-${randomUUID()}`,
          status: 'pass',
        });
      },
    ];
    for (const mutate of mutations) {
      const fixture = createFixture();
      try {
        const before = readFileSync(fixture.recordPath, 'utf8');
        mutate(fixture);
        expect(ingest(fixture)).toBe(3);
        expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    }
  });

  it('records only a current-attempt graph-linked independent oracle closure', () => {
    const fixture = createFixture();
    try {
      expect(ingest(fixture)).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.requirementClosures).toHaveLength(1);
      expect(record.requirementClosures[0]).toMatchObject({
        eventType: 'requirement_closure_recorded',
        requirementId: fixture.requirementId,
        status: 'pass',
        oracleId: fixture.oracleId,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
