import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-implementation-evidence';
import {
  buildSubagentEvidenceEnvelopeFromTaskReport,
  runSubagentEvidenceEnvelopeAcceptance,
  sha256Object,
  validateSubagentEvidenceEnvelope,
  validateTaskReportLegacyBoundary,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope';
import type { ExecutionPacket, TaskReport } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';
import { createRequirementsContractNormalizedTraceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const SOURCE_HASH = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const IMPLEMENTATION_HASH =
  'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const ARCHITECTURE_HASH = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';
const TRANSACTION_ID = 'TX-subagent-envelope-test';
const IMPLEMENTATION_ATTEMPT_ID = 'IMP-subagent-envelope-test';

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

const SEMANTIC_MODEL_HASH = sha256('subagent-envelope-semantic-model');
const PACKET_HASH = sha256('subagent-envelope-model-packet');

function globalContractTraceabilityPolicy() {
  return {
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
}

function traceStatusPolicy() {
  return {
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
}

function artifactRef(
  artifactPath: string,
  contentHash: string,
  relatedRequirementIds: string[],
  schemaPath: string,
  readbackReceiptPath: string
) {
  return {
    artifactType: 'subagent_evidence',
    sourceOfTruthRole: 'evidence',
    path: artifactPath,
    contentHash,
    schemaPath,
    readbackReceiptPath,
    producer: 'subagent-evidence-envelope.test',
    purpose: 'prove subagent evidence envelope acceptance',
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'trace-035',
    outputVersion: 'subagent-envelope-v1',
  };
}

function writeFixture(root: string, options: { executionVerified?: boolean } = {}) {
  const requirementIds = ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027', 'EVD-045'];
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-CLOSED-LOOP-DESIGN'
  );
  const evidenceDir = path.join(base, 'evidence', 'TRACE-035', 'fixture');
  mkdirSync(evidenceDir, { recursive: true });
  const lockContent = `${JSON.stringify({ lockfileVersion: 3, packages: {} }, null, 2)}\n`;
  const lockPath = path.join(root, 'package-lock.json');
  writeFileSync(lockPath, lockContent, 'utf8');
  const commandOutputContent = 'subagent evidence envelope acceptance passed\n';
  const commandOutputPath = path.join(evidenceDir, 'command-output.txt');
  writeFileSync(commandOutputPath, commandOutputContent, 'utf8');
  const evidenceArtifactPath = path.join(evidenceDir, 'subagent-proof.json');
  const evidenceArtifactContent = `${JSON.stringify({ assertion: 'subagent evidence envelope accepted' }, null, 2)}\n`;
  writeFileSync(evidenceArtifactPath, evidenceArtifactContent, 'utf8');
  const evidenceArtifactSchemaPath = path.join(evidenceDir, 'subagent-proof.schema.json');
  const evidenceArtifactSchemaContent = `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required: ['assertion'],
      properties: {
        assertion: { const: 'subagent evidence envelope accepted' },
      },
    },
    null,
    2
  )}\n`;
  writeFileSync(evidenceArtifactSchemaPath, evidenceArtifactSchemaContent, 'utf8');
  const evidenceArtifactReadbackReceiptPath = `${evidenceArtifactPath}.readback-receipt.json`;
  const evidenceArtifactHash = sha256(evidenceArtifactContent);
  const evidenceArtifactReceiptPayload = {
    schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1',
    artifactId: path.basename(evidenceArtifactPath),
    artifactType: 'subagent_evidence',
    artifactPath: evidenceArtifactPath,
    artifactHash: evidenceArtifactHash,
    artifactSchemaPath: evidenceArtifactSchemaPath,
    artifactSchemaHash: sha256(evidenceArtifactSchemaContent),
    producerIdentity: {
      class: 'controlled_artifact_producer',
      id: 'subagent-evidence-envelope.test',
    },
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementRefs: requirementIds,
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    publishedAt: '2026-05-21T00:00:04.000Z',
    readbackAt: '2026-05-21T00:00:05.000Z',
    publication: {
      targetPath: evidenceArtifactPath,
      publishedHash: evidenceArtifactHash,
      readbackHash: evidenceArtifactHash,
      readbackVerified: true,
    },
    decision: 'pass',
  };
  writeFileSync(
    evidenceArtifactReadbackReceiptPath,
    `${JSON.stringify(
      {
        ...evidenceArtifactReceiptPayload,
        receiptHash: sha256Object(evidenceArtifactReceiptPayload),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-CLOSED-LOOP-DESIGN',
        requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
        status: 'user_confirmed',
        transactionId: TRANSACTION_ID,
        currentAttemptId: IMPLEMENTATION_ATTEMPT_ID,
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        semanticModelHash: SEMANTIC_MODEL_HASH,
        packetHash: PACKET_HASH,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            recordId: 'REQ-CLOSED-LOOP-DESIGN',
            requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
            confirmedAt: '2026-05-21T00:00:00.000Z',
            confirmedBy: 'user',
            sourcePath: 'docs/design/需求实现完整性门禁与重跑闭环设计.md',
            sourceDocumentHash: SOURCE_HASH,
            implementationConfirmationHash: IMPLEMENTATION_HASH,
            confirmationPageHash:
              'sha256:d8eae14f55643500a39e3f8cc7b58537b8588208e0bfc18b324797f7ab57c20c',
            confirmationText: 'confirmed',
            renderReportPath: 'confirmation-render-report.json',
            htmlPath: 'confirmation.html',
          },
        ],
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
        },
        globalContractTraceabilityPolicy: globalContractTraceabilityPolicy(),
        traceStatusPolicy: traceStatusPolicy(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const packet: ExecutionPacket = {
    packetId: 'packet-trace-035',
    parentSessionId: 'run-trace-035',
    flow: 'standalone_tasks',
    phase: 'implementation',
    taskType: 'implement',
    role: 'implementation-worker',
    inputArtifacts: ['docs/design/需求实现完整性门禁与重跑闭环设计.md'],
    allowedWriteScope: [
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/**',
      'tests/**',
      '_bmad/_schemas/**',
    ],
    expectedDelta: 'Implement subagent evidence envelope acceptance',
    successCriteria: ['subagentEvidenceEnvelope accepted through controlled ingest'],
    stopConditions: ['hash drift'],
  };
  const taskReport: TaskReport = {
    packetId: packet.packetId,
    status: 'done',
    filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'],
    validationsRun: ['npx vitest run tests/acceptance/subagent-evidence-envelope.test.ts'],
    evidence: [evidenceArtifactPath],
    downstreamContext: ['TRACE-035'],
  };
  const evidenceRef = artifactRef(
    evidenceArtifactPath,
    evidenceArtifactHash,
    requirementIds,
    evidenceArtifactSchemaPath,
    evidenceArtifactReadbackReceiptPath
  );
  const oracleIdFor = (requirementId: string) => `ORACLE-${requirementId}`;
  const normalizedTraceGraph = createRequirementsContractNormalizedTraceGraph({
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    sourceAuthorityHash: SOURCE_HASH,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    semanticConservationManifestHash: sha256('subagent-envelope-semantic-conservation'),
    nodes: requirementIds.flatMap((requirementId) => {
      const oracleId = oracleIdFor(requirementId);
      return [
        {
          id: requirementId,
          nodeType: 'requirement' as const,
          bodyHash: sha256(`${requirementId}:body`),
          sourceRootRef: `REQ-CLOSED-LOOP-DESIGN:${requirementId}`,
          sourceRootPayloadHash: sha256(`${requirementId}:source-root`),
          authorityClass: 'source_authorized' as const,
        },
        {
          id: oracleId,
          nodeType: 'oracle' as const,
          bodyHash: sha256(`${oracleId}:body`),
          sourceRootRef: `REQ-CLOSED-LOOP-DESIGN:${oracleId}`,
          sourceRootPayloadHash: sha256(`${oracleId}:source-root`),
          authorityClass: 'independent_oracle' as const,
        },
      ];
    }),
    edges: requirementIds.map((requirementId) => {
      const oracleId = oracleIdFor(requirementId);
      return {
        edgeId: `EDGE-${requirementId}`,
        edgeType: 'verified_by' as const,
        fromRef: requirementId,
        toRef: oracleId,
        sourceRef: 'REQ-CLOSED-LOOP-DESIGN:TRACE-035',
        sourceHash: sha256(`${requirementId}:${oracleId}:edge`),
        proofRefs: [evidenceArtifactPath],
        applicability: 'applicable' as const,
      };
    }),
  });
  const command = 'npx vitest run tests/acceptance/subagent-evidence-envelope.test.ts';
  const runtimeVersions = { node: process.version };
  const environment = {
    platform: process.platform,
    architecture: process.arch,
  };
  const commandRun = {
    commandId: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE',
    command,
    normalizedCommand: command,
    cwd: root,
    executorIdentity: {
      class: 'controlled_detached_executor',
      id: 'subagent-evidence-envelope.test',
    },
    runtimeVersions,
    dependencyLockHashes: [{ path: 'package-lock.json', hash: sha256(lockContent) }],
    environment,
    environmentFingerprint: sha256Object({ environment, runtimeVersions }),
    environmentCompatibilityDecision: 'pass',
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    sourceDocumentHash: SOURCE_HASH,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    packetHash: PACKET_HASH,
    runId: 'run-trace-035',
    exitCode: 0,
    startedAt: '2026-05-21T00:00:00.000Z',
    completedAt: '2026-05-21T00:00:05.000Z',
    outputSummary: 'subagent evidence envelope acceptance passed',
    outputPath: commandOutputPath,
    outputHash: sha256(commandOutputContent),
    coveredRequirementIds: requirementIds,
    artifactRefs: [evidenceRef],
    closeoutAttemptId: 'closeout-trace-035',
  };
  const envelope = buildSubagentEvidenceEnvelopeFromTaskReport({
    packet,
    taskReport,
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    parentRunId: 'run-trace-035',
    parentCloseoutAttemptId: 'closeout-trace-035',
    executorKind: 'codex_spawn_agent',
    executorRole: 'implementation-worker',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    traceRows: ['TRACE-035'],
    coveredRequirementIds: ['MUST-044', 'MUST-046', 'NEG-034', 'NEG-035', 'OUT-027'],
    taskRefs: ['TASK-SUBAGENT-EVIDENCE-ENVELOPE-GOVERNANCE'],
    actualFilesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'],
    diffHash: sha256Object({ filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'] }),
    workspaceRef: {
      kind: 'main_workspace',
      path: root,
      commitBefore: 'before',
      commitAfter: 'after',
    },
    commandRuns: [commandRun],
    artifactRefs: [evidenceRef],
    executionVerified: options.executionVerified ?? true,
  });
  const packetPath = path.join(evidenceDir, 'implementation-evidence-packet.json');
  const implementationPacket = {
    eventType: 'execution_iteration_recorded',
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    executionIterationId: 'exec-trace-035',
    runId: 'run-trace-035',
    closeoutAttemptId: 'closeout-trace-035',
    transactionId: TRANSACTION_ID,
    implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    semanticModelHash: SEMANTIC_MODEL_HASH,
    packetHash: PACKET_HASH,
    status: 'done',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    traceRows: ['TRACE-035'],
    taskRefs: ['TASK-SUBAGENT-EVIDENCE-ENVELOPE-GOVERNANCE'],
    evidenceRefs: ['EVD-004', 'EVD-044', 'EVD-045'],
    filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'],
    implementationDelta: {
      filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'],
      diffSummaryRef: 'diff-summary.md',
      behaviorAffecting: true,
      negativeAssertionArtifactRefs: [evidenceRef],
    },
    diffSummary: 'Add subagent evidence envelope schema, validator, and controlled ingest parser.',
    commandRuns: [commandRun],
    normalizedTraceGraph,
    independentOracleResults: requirementIds.map((requirementId) => ({
      requirementId,
      oracleId: oracleIdFor(requirementId),
      decision: 'pass',
      transactionId: TRANSACTION_ID,
      implementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
      sourceDocumentHash: SOURCE_HASH,
      semanticModelHash: SEMANTIC_MODEL_HASH,
      packetHash: PACKET_HASH,
      graphHash: normalizedTraceGraph.graphHash,
      commandId: commandRun.commandId,
      outputHash: commandRun.outputHash,
      evidenceRefs: ['EVD-045'],
      observedAt: '2026-05-21T00:00:05.000Z',
    })),
    artifactRefs: [evidenceRef],
    subagentEvidenceEnvelope: envelope,
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE',
          command: 'npx vitest run tests/acceptance/subagent-evidence-envelope.test.ts',
          commandType: 'delivery_evidence',
          blockingIfMissing: true,
          traceRows: ['TRACE-035'],
          evidenceRefs: ['EVD-045'],
          artifactRefs: [evidenceRef],
        },
      ],
      historicalRunRefs: [
        {
          commandId: 'CMD-SUBAGENT-EVIDENCE-ENVELOPE-ACCEPTANCE',
          runId: 'run-trace-035',
          closeoutAttemptId: 'closeout-trace-035',
        },
      ],
    },
    requirementClosures: [
      { requirementId: 'MUST-044', status: 'pass' },
      { requirementId: 'MUST-046', status: 'pass' },
      { requirementId: 'NEG-034', status: 'pass' },
      { requirementId: 'NEG-035', status: 'pass' },
      { requirementId: 'OUT-027', status: 'pass' },
      { requirementId: 'EVD-045', status: 'pass' },
    ],
    contractChecks: [
      {
        checkId: 'RCC-SUBAGENT-EVIDENCE-ENVELOPE:TRACE-035:current',
        contract: 'RCC-SUBAGENT-EVIDENCE-ENVELOPE',
        decision: 'pass',
      },
    ],
  };
  writeFileSync(packetPath, `${JSON.stringify(implementationPacket, null, 2)}\n`, 'utf8');
  return { recordPath, packetPath, evidenceDir, envelope, evidenceArtifactPath };
}

describe('subagent evidence envelope acceptance', () => {
  it('rejects an unsupported executor kind', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-unsupported-executor-'));
    try {
      const fixture = writeFixture(root);
      const unsupportedEnvelope = {
        ...fixture.envelope,
        executorKind: 'unsupported_executor',
      };

      expect(validateSubagentEvidenceEnvelope(unsupportedEnvelope).mismatches).toContain(
        'subagent_envelope_executor_kind_invalid:unsupported_executor'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks TaskReport done when execution is not independently verified', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-unverified-'));
    try {
      const fixture = writeFixture(root, { executionVerified: false });

      expect(fixture.envelope).toMatchObject({
        decisionAuthority: 'none',
        status: 'blocked',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records accepted subagentEvidenceEnvelope through controlled ingest without granting decision authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-ingest-'));
    try {
      const fixture = writeFixture(root);
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.packetPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmed-at',
        '2026-05-21T00:00:06.000Z',
        '--recorded-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.lastEventType).toBe('subagent_evidence_envelope_recorded');
      expect(record.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'subagent_evidence_envelope_recorded',
            status: 'accepted',
            subagentEvidenceEnvelope: expect.objectContaining({
              decisionAuthority: 'none',
              traceRows: ['TRACE-035'],
            }),
          }),
        ])
      );
      expect(record.requirementClosures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ requirementId: 'MUST-044', status: 'pass' }),
          expect.objectContaining({ requirementId: 'MUST-046', status: 'pass' }),
          expect.objectContaining({ requirementId: 'NEG-034', status: 'pass' }),
          expect.objectContaining({ requirementId: 'NEG-035', status: 'pass' }),
          expect.objectContaining({ requirementId: 'OUT-027', status: 'pass' }),
          expect.objectContaining({ requirementId: 'EVD-045', status: 'pass' }),
        ])
      );
      expect(JSON.stringify(record.executionIterations)).not.toContain('"result"');
      expect(JSON.stringify(record.executionIterations)).not.toContain('"decision"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes schema and acceptance report as evidence-only artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-report-'));
    try {
      const fixture = writeFixture(root);
      const envelopePath = path.join(fixture.evidenceDir, 'accepted-envelope.json');
      const schemaPath = path.join(fixture.evidenceDir, 'subagent-evidence-envelope.schema.json');
      const reportPath = path.join(fixture.evidenceDir, 'subagent-envelope-acceptance-report.json');
      writeFileSync(envelopePath, `${JSON.stringify(fixture.envelope, null, 2)}\n`, 'utf8');

      const code = runSubagentEvidenceEnvelopeAcceptance([
        '--envelope',
        envelopePath,
        '--requirement-record',
        fixture.recordPath,
        '--schema-out',
        schemaPath,
        '--report-out',
        reportPath,
        '--project-root',
        root,
        '--json',
      ]);

      expect(code).toBe(0);
      expect(existsSync(schemaPath)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        reportType: 'subagent_evidence_envelope_acceptance',
        decision: 'pass',
        status: 'accepted',
        controlWrite: 'forbidden_use_controlled_ingest',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects missing fields, result/decision fields, wrong hashes, and closeout attempt mismatch', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-reject-'));
    try {
      const fixture = writeFixture(root);
      const missingTraceRows = { ...fixture.envelope };
      delete (missingTraceRows as Record<string, unknown>).traceRows;
      expect(validateSubagentEvidenceEnvelope(missingTraceRows).mismatches).toContain(
        'subagent_envelope_required_field_missing:traceRows'
      );

      const containsResult = { ...fixture.envelope, result: 'pass' };
      expect(validateSubagentEvidenceEnvelope(containsResult).mismatches).toContain(
        'subagent_envelope_forbidden_field_present:result'
      );

      const containsDecision = { ...fixture.envelope, decision: 'pass' };
      expect(validateSubagentEvidenceEnvelope(containsDecision).mismatches).toContain(
        'subagent_envelope_forbidden_field_present:decision'
      );

      const wrongHash = {
        ...fixture.envelope,
        architectureConfirmationHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      };
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(validateSubagentEvidenceEnvelope(wrongHash, { record }).mismatches).toContain(
        'subagent_envelope_architecture_confirmation_hash_mismatch'
      );

      expect(
        validateSubagentEvidenceEnvelope(fixture.envelope, {
          expectedParentCloseoutAttemptId: 'different-attempt',
        }).mismatches
      ).toContain('subagent_envelope_parent_closeout_attempt_id_mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks TaskReport done without envelope and rejects direct control-field writes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-boundary-'));
    try {
      const fixture = writeFixture(root);
      const taskReport: TaskReport = {
        packetId: 'packet-trace-035',
        status: 'done',
        filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/subagent-evidence-envelope.ts'],
        validationsRun: ['test'],
        evidence: [fixture.evidenceArtifactPath],
        downstreamContext: ['TRACE-035'],
      };
      expect(validateTaskReportLegacyBoundary(taskReport).mismatches).toContain(
        'task_report_done_without_subagent_evidence_envelope'
      );

      const directClosureWrite = {
        ...fixture.envelope,
        requirementClosures: [{ requirementId: 'MUST-044', status: 'pass' }],
      };
      expect(validateSubagentEvidenceEnvelope(directClosureWrite).mismatches).toContain(
        'subagent_envelope_direct_control_field_forbidden:requirementClosures'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unindexed artifactRefs instead of trusting final message or stdout', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-envelope-artifact-'));
    try {
      const fixture = writeFixture(root);
      const validation = validateSubagentEvidenceEnvelope(fixture.envelope, {
        indexedArtifactRefs: [],
      });
      expect(validation.ok).toBe(true);

      const blocked = validateSubagentEvidenceEnvelope(fixture.envelope, {
        indexedArtifactRefs: [
          {
            path: 'different.json',
            contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
      });
      expect(blocked.mismatches.join('\n')).toContain(
        'subagent_envelope_artifact_refs_not_indexed'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
