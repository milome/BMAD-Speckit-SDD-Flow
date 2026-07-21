import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence';
import { createRequirementsContractNormalizedTraceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function fixtureAuthority(root: string) {
  const suffix = sha256(root).slice(-12).toUpperCase();
  return {
    recordId: `REQ-${suffix}`,
    requirementSetId: `REQ-${suffix}`,
    transactionId: `TX-${suffix}`,
    implementationAttemptId: `IMP-${suffix}`,
    runId: `RUN-${suffix}`,
    executionIterationId: `EXEC-${suffix}`,
    closeoutAttemptId: `CLOSEOUT-${suffix}`,
    traceRef: `TRACE-${suffix}`,
    evidenceRef: `EVD-${suffix}`,
    requirementRef: `MUST-${suffix}`,
    taskRef: `TASK-${suffix}`,
  };
}

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

function materializeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-readback-'));
  const authority = fixtureAuthority(root);
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    authority.requirementSetId
  );
  const executionDir = path.join(base, 'execution');
  fs.mkdirSync(executionDir, { recursive: true });
  const sourceDocumentHash = `sha256:${'1'.repeat(64)}`;
  const implementationConfirmationHash = `sha256:${'2'.repeat(64)}`;
  const architectureConfirmationHash = `sha256:${'3'.repeat(64)}`;
  const semanticModelHash = sha256(`semantic-model:${authority.requirementSetId}`);
  const packetHash = sha256(`packet:${authority.requirementSetId}`);
  const lockPath = path.join(root, 'package-lock.json');
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({ lockfileVersion: 3, packages: {} }, null, 2)}\n`,
    'utf8'
  );
  const commandOutputPath = path.join(executionDir, 'command-output.txt');
  fs.writeFileSync(commandOutputPath, 'artifact readback acceptance passed\n', 'utf8');
  const artifactPath = path.join(executionDir, 'behavior-observation.json');
  const artifactBytes = `${JSON.stringify({ decision: 'pass' }, null, 2)}\n`;
  fs.writeFileSync(artifactPath, artifactBytes, 'utf8');
  const artifactRef = {
    artifactType: 'behavior_observation',
    sourceOfTruthRole: 'evidence',
    path: artifactPath,
    hash: sha256(artifactBytes),
    producer: 'requirements-contract-evidence-artifact-readback.test',
    purpose: 'prove artifact readback is required before controlled ingest',
    relatedRequirementIds: [authority.requirementRef],
    status: 'active',
    inputVersion: 'source/v1',
    outputVersion: 'observation/v1',
  };
  const recordPath = path.join(base, 'requirement-record.json');
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: authority.recordId,
        requirementSetId: authority.requirementSetId,
        status: 'user_confirmed',
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationHistory: createRecordedConfirmationHistory({
          recordId: authority.recordId,
          requirementSetId: authority.requirementSetId,
          sourcePath: 'source.md',
          sourceDocumentHash,
          implementationConfirmationHash,
        }),
        transactionId: authority.transactionId,
        currentAttemptId: authority.implementationAttemptId,
        semanticModelHash,
        packetHash,
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: architectureConfirmationHash,
        },
        globalContractTraceabilityPolicy,
        traceStatusPolicy,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const evidencePath = path.join(executionDir, 'packet.json');
  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        eventType: 'execution_iteration_recorded',
        recordId: authority.recordId,
        requirementSetId: authority.requirementSetId,
        transactionId: authority.transactionId,
        implementationAttemptId: authority.implementationAttemptId,
        executionIterationId: authority.executionIterationId,
        runId: authority.runId,
        status: 'done',
        sourceDocumentHash,
        implementationConfirmationHash,
        architectureConfirmationHash,
        traceRows: [authority.traceRef],
        taskRefs: [authority.taskRef],
        evidenceRefs: [authority.evidenceRef],
        filesChanged: ['src/behavior.ts'],
        implementationDelta: {
          filesChanged: ['src/behavior.ts'],
          diffSummaryRef: 'diff-summary.md',
          behaviorAffecting: true,
          negativeAssertionArtifactRefs: [artifactRef],
        },
        diffSummary: 'Exercise evidence artifact readback.',
        commandRuns: [
          {
            commandId: `CMD-${authority.runId}`,
            command: 'npm test',
            runId: authority.runId,
            closeoutAttemptId: authority.closeoutAttemptId,
            exitCode: 0,
            startedAt: '2026-07-16T00:00:00.000Z',
            completedAt: '2026-07-16T00:00:01.000Z',
            outputSummary: 'pass',
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
              commandId: `CMD-${authority.runId}`,
              command: 'npm test',
              commandType: 'delivery_evidence',
              blockingIfMissing: true,
              traceRows: [authority.traceRef],
              evidenceRefs: [authority.evidenceRef],
              artifactRefs: [artifactRef],
            },
          ],
          historicalRunRefs: [
            {
              commandId: `CMD-${authority.runId}`,
              runId: authority.runId,
              closeoutAttemptId: authority.closeoutAttemptId,
            },
          ],
        },
        requirementClosures: [
          { requirementId: authority.requirementRef, status: 'pass' },
        ],
        gateChecks: [{ gate: 'Execution Closure Check', decision: 'pass' }],
        closeoutAttemptId: authority.closeoutAttemptId,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const packet = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const commandRun = packet.commandRuns[0];
  const command = commandRun.command;
  const runtimeVersions = { node: process.version };
  const environment = { platform: process.platform, architecture: process.arch };
  Object.assign(packet, { semanticModelHash, packetHash });
  Object.assign(commandRun, {
    normalizedCommand: command,
    cwd: root,
    executorIdentity: {
      class: 'controlled_detached_executor',
      id: `EXECUTOR-${authority.runId}`,
    },
    runtimeVersions,
    dependencyLockHashes: [
      {
        path: 'package-lock.json',
        hash: sha256(fs.readFileSync(lockPath)),
      },
    ],
    environment,
    environmentFingerprint: sha256Stable({ environment, runtimeVersions }),
    environmentCompatibilityDecision: 'pass',
    transactionId: authority.transactionId,
    implementationAttemptId: authority.implementationAttemptId,
    sourceDocumentHash,
    semanticModelHash,
    packetHash,
    outputPath: commandOutputPath,
    outputHash: sha256(fs.readFileSync(commandOutputPath)),
    coveredRequirementIds: [authority.requirementRef],
  });
  const oracleId = `ORACLE-${authority.requirementRef}`;
  const graph = createRequirementsContractNormalizedTraceGraph({
    requirementSetId: authority.requirementSetId,
    sourceAuthorityHash: sourceDocumentHash,
    semanticModelHash,
    semanticConservationManifestHash: sha256(
      `semantic-conservation:${authority.requirementSetId}`
    ),
    nodes: [
      {
        id: authority.requirementRef,
        nodeType: 'requirement',
        bodyHash: sha256(`${authority.requirementRef}:body`),
        sourceRootRef: `${authority.requirementRef}:source`,
        sourceRootPayloadHash: sha256(`${authority.requirementRef}:source-root`),
        authorityClass: 'source_authorized',
      },
      {
        id: oracleId,
        nodeType: 'oracle',
        bodyHash: sha256(`${oracleId}:body`),
        sourceRootRef: `${oracleId}:source`,
        sourceRootPayloadHash: sha256(`${oracleId}:source-root`),
        authorityClass: 'independent_oracle',
      },
    ],
    edges: [
      {
        edgeId: `EDGE-${authority.requirementRef}`,
        edgeType: 'verified_by',
        fromRef: authority.requirementRef,
        toRef: oracleId,
        sourceRef: authority.traceRef,
        sourceHash: sha256(`${authority.requirementRef}:${oracleId}:edge`),
        proofRefs: [authority.evidenceRef],
        applicability: 'applicable',
      },
    ],
  });
  packet.normalizedTraceGraph = graph;
  packet.independentOracleResults = [
    {
      requirementId: authority.requirementRef,
      oracleId,
      decision: 'pass',
      transactionId: authority.transactionId,
      implementationAttemptId: authority.implementationAttemptId,
      sourceDocumentHash,
      semanticModelHash,
      packetHash,
      graphHash: graph.graphHash,
      commandId: commandRun.commandId,
      outputHash: commandRun.outputHash,
      evidenceRefs: [authority.evidenceRef],
      observedAt: '2026-07-16T00:00:02.000Z',
    },
  ];
  fs.writeFileSync(evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  return {
    root,
    recordPath,
    evidencePath,
    artifactPath,
    artifactHash: artifactRef.hash,
    artifactProducer: artifactRef.producer,
    authority,
  };
}

type Fixture = ReturnType<typeof materializeFixture>;

function writeReadbackReceipt(
  fixture: Fixture,
  mutate?: (input: {
    artifactSchema: Record<string, unknown>;
    receipt: Record<string, any>;
  }) => void
) {
  const artifactSchemaPath = path.join(
    path.dirname(fixture.artifactPath),
    'behavior-observation.schema.json'
  );
  const artifactSchema: Record<string, unknown> = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['decision'],
    properties: {
      decision: { const: 'pass' },
    },
  };
  const receiptPath = `${fixture.artifactPath}.readback-receipt.json`;
  const receipt: Record<string, any> = {
    schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1',
    artifactId: path.basename(fixture.artifactPath),
    artifactType: 'behavior_observation',
    artifactPath: fixture.artifactPath,
    artifactHash: fixture.artifactHash,
    artifactSchemaPath,
    artifactSchemaHash: '',
    producerIdentity: {
      class: 'controlled_artifact_producer',
      id: fixture.artifactProducer,
    },
    requirementSetId: fixture.authority.requirementSetId,
    requirementRefs: [fixture.authority.requirementRef],
    transactionId: fixture.authority.transactionId,
    implementationAttemptId: fixture.authority.implementationAttemptId,
    publishedAt: '2026-07-16T00:00:01.000Z',
    readbackAt: '2026-07-16T00:00:02.000Z',
    publication: {
      targetPath: fixture.artifactPath,
      publishedHash: fixture.artifactHash,
      readbackHash: fixture.artifactHash,
      readbackVerified: true,
    },
    decision: 'pass',
  };
  mutate?.({ artifactSchema, receipt });
  fs.writeFileSync(
    artifactSchemaPath,
    `${JSON.stringify(artifactSchema, null, 2)}\n`,
    'utf8'
  );
  receipt.artifactSchemaHash = sha256(fs.readFileSync(artifactSchemaPath));
  const packet = JSON.parse(fs.readFileSync(fixture.evidencePath, 'utf8'));
  const bind = (artifact: Record<string, unknown>) => {
    artifact.schemaPath = artifactSchemaPath;
    artifact.readbackReceiptPath = receiptPath;
  };
  for (const artifact of packet.artifactRefs) bind(artifact);
  for (const artifact of packet.implementationDelta.negativeAssertionArtifactRefs) bind(artifact);
  for (const command of packet.deliveryEvidence.requiredCommands) {
    for (const artifact of command.artifactRefs) bind(artifact);
  }
  fs.writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const { receiptHash: _ignored, ...payload } = receipt;
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify({ ...payload, receiptHash: sha256Stable(payload) }, null, 2)}\n`,
    'utf8'
  );
  return { artifactSchemaPath, receiptPath };
}

describe('requirements contract evidence artifact readback', () => {
  it('rejects an otherwise valid evidence packet when the artifact readback Receipt is missing', () => {
    const fixture = materializeFixture();
    try {
      const before = fs.readFileSync(fixture.recordPath);
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);

      expect(code).toBe(3);
      expect(fs.readFileSync(fixture.recordPath)).toEqual(before);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('accepts a current schema-valid hash-bound artifact with verified readback', () => {
    const fixture = materializeFixture();
    try {
      writeReadbackReceipt(fixture);
      expect(
        mainIngestImplementationEvidence([
          '--evidence',
          fixture.evidencePath,
          '--requirement-record',
          fixture.recordPath,
        ])
      ).toBe(0);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'cross-transaction',
      mutate: ({ receipt }: { receipt: Record<string, any> }) => {
        receipt.transactionId = 'TX-OTHER';
      },
    },
    {
      name: 'cross-attempt',
      mutate: ({ receipt }: { receipt: Record<string, any> }) => {
        receipt.implementationAttemptId = 'IMP-OTHER';
      },
    },
    {
      name: 'readback-not-verified',
      mutate: ({ receipt }: { receipt: Record<string, any> }) => {
        receipt.publication.readbackVerified = false;
      },
    },
  ])('rejects $name artifact authority', (testCase) => {
    const fixture = materializeFixture();
    try {
      const before = fs.readFileSync(fixture.recordPath);
      writeReadbackReceipt(fixture, testCase.mutate);
      expect(
        mainIngestImplementationEvidence([
          '--evidence',
          fixture.evidencePath,
          '--requirement-record',
          fixture.recordPath,
        ])
      ).toBe(3);
      expect(fs.readFileSync(fixture.recordPath)).toEqual(before);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects an artifact whose bytes fail its bound schema', () => {
    const fixture = materializeFixture();
    try {
      const before = fs.readFileSync(fixture.recordPath);
      fs.writeFileSync(fixture.artifactPath, `${JSON.stringify({ decision: 'block' })}\n`, 'utf8');
      fixture.artifactHash = sha256(fs.readFileSync(fixture.artifactPath));
      const packet = JSON.parse(fs.readFileSync(fixture.evidencePath, 'utf8'));
      const updateHash = (artifact: Record<string, any>) => {
        artifact.hash = fixture.artifactHash;
      };
      packet.artifactRefs.forEach(updateHash);
      packet.implementationDelta.negativeAssertionArtifactRefs.forEach(updateHash);
      packet.deliveryEvidence.requiredCommands.forEach((command: Record<string, any>) =>
        command.artifactRefs.forEach(updateHash)
      );
      fs.writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      writeReadbackReceipt(fixture, ({ receipt }) => {
        receipt.artifactHash = fixture.artifactHash;
        receipt.publication.publishedHash = fixture.artifactHash;
        receipt.publication.readbackHash = fixture.artifactHash;
      });

      expect(
        mainIngestImplementationEvidence([
          '--evidence',
          fixture.evidencePath,
          '--requirement-record',
          fixture.recordPath,
        ])
      ).toBe(3);
      expect(fs.readFileSync(fixture.recordPath)).toEqual(before);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a missing artifact even when metadata and Receipt remain present', () => {
    const fixture = materializeFixture();
    try {
      const before = fs.readFileSync(fixture.recordPath);
      writeReadbackReceipt(fixture);
      fs.rmSync(fixture.artifactPath);
      expect(
        mainIngestImplementationEvidence([
          '--evidence',
          fixture.evidencePath,
          '--requirement-record',
          fixture.recordPath,
        ])
      ).toBe(3);
      expect(fs.readFileSync(fixture.recordPath)).toEqual(before);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a tampered readback Receipt self-hash', () => {
    const fixture = materializeFixture();
    try {
      const before = fs.readFileSync(fixture.recordPath);
      const written = writeReadbackReceipt(fixture);
      const receipt = JSON.parse(fs.readFileSync(written.receiptPath, 'utf8'));
      receipt.receiptHash = `sha256:${'f'.repeat(64)}`;
      fs.writeFileSync(written.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      expect(
        mainIngestImplementationEvidence([
          '--evidence',
          fixture.evidencePath,
          '--requirement-record',
          fixture.recordPath,
        ])
      ).toBe(3);
      expect(fs.readFileSync(fixture.recordPath)).toEqual(before);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
