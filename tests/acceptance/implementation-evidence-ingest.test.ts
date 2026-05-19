import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../scripts/ingest-implementation-evidence';

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function artifactRef(artifactPath: string, contentHash: string, overrides: Record<string, unknown> = {}) {
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: artifactPath,
    hash: contentHash,
    producer: 'implementation-evidence-ingest.test',
    purpose: 'prove controlled implementation evidence ingest behavior',
    relatedRequirementIds: ['MUST-007', 'NEG-008'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
    ...overrides,
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

function writeFixture(root: string): { recordPath: string; evidencePath: string; artifactPath: string } {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-EVIDENCE-INGEST');
  const evidenceDir = path.join(base, 'execution');
  mkdirSync(evidenceDir, { recursive: true });
  const artifactPath = path.join(evidenceDir, 'implementation-evidence.json');
  const artifactContent = JSON.stringify({ assertion: 'negative regression evidence' }, null, 2);
  writeFileSync(artifactPath, `${artifactContent}\n`, 'utf8');
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-EVIDENCE-INGEST',
        requirementSetId: 'REQ-EVIDENCE-INGEST',
        status: 'user_confirmed',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash:
            'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        },
        globalContractTraceabilityPolicy,
        traceStatusPolicy,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const evidencePath = path.join(evidenceDir, 'packet.json');
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        eventType: 'execution_iteration_recorded',
        recordId: 'REQ-EVIDENCE-INGEST',
        requirementSetId: 'REQ-EVIDENCE-INGEST',
        executionIterationId: 'exec-001',
        runId: 'run-001',
        status: 'done',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        traceRows: ['TRACE-003'],
        taskRefs: ['TASK-DELIVERY-CORE-EVIDENCE'],
        evidenceRefs: ['EVD-006'],
        filesChanged: ['scripts/ingest-implementation-evidence.ts'],
        implementationDelta: {
          filesChanged: ['scripts/ingest-implementation-evidence.ts'],
          diffSummaryRef: 'diff-summary.md',
          behaviorAffecting: true,
          negativeAssertionArtifactRefs: [
            artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
          ],
        },
        diffSummary: 'Add controlled implementation evidence ingest.',
        commandRuns: [
          {
            commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
            command:
              'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts',
            runId: 'run-001',
            closeoutAttemptId: 'closeout-001',
            exitCode: 0,
            startedAt: '2026-05-19T00:00:00.000Z',
            completedAt: '2026-05-19T00:00:05.000Z',
            outputSummary: '3 tests passed',
          },
        ],
        artifactRefs: [
          artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
        ],
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
              commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
              command:
                'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts',
              commandType: 'delivery_evidence',
              blockingIfMissing: true,
              traceRows: ['TRACE-003'],
              evidenceRefs: ['EVD-006'],
              artifactRefs: [
                artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
              ],
            },
          ],
          historicalRunRefs: [
            {
              commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
              runId: 'run-001',
              closeoutAttemptId: 'closeout-001',
            },
          ],
        },
        requirementClosures: [{ requirementId: 'MUST-005', status: 'pass' }],
        gateChecks: [{ gate: 'Execution Closure Check', decision: 'pass' }],
        closeoutAttemptId: 'closeout-001',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { recordPath, evidencePath, artifactPath };
}

describe('implementation evidence ingest', () => {
  it('records execution evidence through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-ingest-'));
    try {
      const fixture = writeFixture(root);
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmed-at',
        '2026-05-19T00:00:06.000Z',
        '--recorded-by',
        'test-agent',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.lastEventType).toBe('execution_iteration_recorded');
      expect(record).toMatchObject({
        entryFlow: 'standalone_tasks',
        entryFlowClass: 'task_packet_entry',
        workflowAdapter: 'direct',
        contractAuthoringRequired: true,
        globalContractTraceabilityPolicy: {
          schemaVersion: 'global-contract-traceability-policy/v1',
          allowUnboundImplementationTask: false,
        },
        traceStatusPolicy: {
          schemaVersion: 'trace-status-policy/v1',
          fullCloseoutForUserScopedStatusesForbidden: true,
        },
      });
      expect(record.executionIterations).toHaveLength(1);
      expect(record.executionIterations[0]).toMatchObject({
        executionIterationId: 'exec-001',
        status: 'done',
        recordedBy: 'test-agent',
      });
      expect(record.executionIterations[0].commandRunRefs[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        runId: 'run-001',
        closeoutAttemptId: 'closeout-001',
      });
      expect(record.requirementClosures[0]).toMatchObject({
        eventType: 'requirement_closure_recorded',
        requirementId: 'MUST-005',
        status: 'pass',
      });
      expect(record.gateChecks[0]).toMatchObject({
        eventType: 'gate_check_recorded',
        gate: 'Execution Closure Check',
        decision: 'pass',
      });
      expect(record.deliveryEvidence.requiredCommands[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        blockingIfMissing: true,
      });
      expect(record.deliveryEvidence.requiredCommands[0].artifactRefs).toHaveLength(1);
      expect(record.artifactIndex[0]).toMatchObject({
        purpose: 'prove controlled implementation evidence ingest behavior',
        relatedRequirementIds: ['MUST-007', 'NEG-008'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'artifact-v1',
      });
      expect(record.deliveryEvidence.historicalRunRefs[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        runId: 'run-001',
        closeoutAttemptId: 'closeout-001',
      });
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl'))).toBe(
        true
      );
      expect(
        existsSync(path.join(path.dirname(path.dirname(fixture.recordPath)), 'artifact-index.jsonl'))
      ).toBe(true);
      expect(existsSync(fixture.artifactPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records observability extension refs through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-extension-'));
    try {
      const fixture = writeFixture(root);
      const extensionPath = path.join(path.dirname(fixture.artifactPath), 'observability-extension.json');
      const extensionContent = JSON.stringify({ observability: 'extension' }, null, 2);
      writeFileSync(extensionPath, `${extensionContent}\n`, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.traceRows = ['TRACE-007'];
      packet.taskRefs = ['TASK-DATA-SFT-GOVERNANCE'];
      packet.evidenceRefs = ['EVD-010', 'EVD-009'];
      packet.extensionRefs = [
        artifactRef(extensionPath, sha256(`${extensionContent}\n`), {
          artifactType: 'observability_extension',
          relatedRequirementIds: ['MUST-011', 'MUST-017', 'EVD-010'],
          purpose: 'prove production observability extension registration',
          inputVersion: 'trace-007',
          outputVersion: 'observability-extension-v1',
        }),
      ];
      packet.requirementClosures = [
        { requirementId: 'MUST-011', status: 'pass' },
        { requirementId: 'MUST-017', status: 'pass' },
      ];
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmed-at',
        '2026-05-19T00:00:06.000Z',
        '--recorded-by',
        'test-agent',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.extensionRefs.at(-1)).toMatchObject({
        artifactType: 'observability_extension',
        sourceOfTruthRole: 'evidence',
        relatedRequirementIds: ['MUST-011', 'MUST-017', 'EVD-010'],
        status: 'active',
      });
      expect(record.artifactIndex.at(-1)).toMatchObject({
        artifactType: 'observability_extension',
        relatedRequirementIds: ['MUST-011', 'MUST-017', 'EVD-010'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects stale hashes without mutating the requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-stale-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.architectureConfirmationHash =
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects legacy result fields and historical command runs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-result-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.result = 'pass';
      packet.commandRuns[0].runId = 'old-run';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps legacy gateChecks result to decision at ingest boundary without persisting result', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-gate-result-'));
    try {
      const { recordPath, evidencePath } = writeFixture(root);
      const packet = JSON.parse(readFileSync(evidencePath, 'utf8'));
      packet.gateChecks = [
        {
          gate: 'legacy_gate',
          result: 'passed',
        },
      ];
      writeFileSync(evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainIngestImplementationEvidence(['--evidence', evidencePath, '--requirement-record', recordPath])).toBe(0);
      } finally {
        process.chdir(prev);
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({ gate: 'legacy_gate', decision: 'pass' });
      expect(record.gateChecks.at(-1)).not.toHaveProperty('result');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps legacy contractChecks result to decision at ingest boundary without persisting result', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-contract-result-'));
    try {
      const { recordPath, evidencePath } = writeFixture(root);
      const packet = JSON.parse(readFileSync(evidencePath, 'utf8'));
      packet.contractChecks = [
        {
          contract: 'requirement_record_schema',
          result: 'ok',
        },
      ];
      writeFileSync(evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainIngestImplementationEvidence(['--evidence', evidencePath, '--requirement-record', recordPath])).toBe(0);
      } finally {
        process.chdir(prev);
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.contractChecks.at(-1)).toMatchObject({
        eventType: 'contract_check_recorded',
        contract: 'requirement_record_schema',
        decision: 'pass',
      });
      expect(record.contractChecks.at(-1)).not.toHaveProperty('result');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects delivery required commands that cannot prove current blocking evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-required-command-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.deliveryEvidence.requiredCommands[0].blockingIfMissing = false;
      packet.deliveryEvidence.requiredCommands[0].artifactRefs = [];
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid entryFlowState updates before mutating the requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-entry-flow-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.entryFlowState = {
        entryFlow: 'speckit_tasks',
        entryFlowClass: 'task_packet_entry',
        workflowAdapter: 'direct',
        contractAuthoringRequired: false,
      };
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects missing or unsafe global contract traceability policy before mutating the requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-traceability-policy-'));
    try {
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      delete record.globalContractTraceabilityPolicy;
      writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      delete packet.entryFlowState.globalContractTraceabilityPolicy;
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);

      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects evidence packets without behavior-affecting implementation delta proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-delta-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      delete packet.implementationDelta;
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects artifact refs without pass-grade metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-artifact-metadata-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      delete packet.artifactRefs[0].purpose;
      packet.artifactRefs[0].relatedRequirementIds = [];
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects inline full diffs and legacy write targets', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-inline-diff-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.fullDiff = 'diff --git a/file b/file';
      packet.artifactRefs[0].path = '_bmad-output/runtime/gates/legacy-report.json';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('normalizes historical artifact refs without making them current pass evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-historical-artifact-'));
    try {
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      record.artifactIndex = [
        {
          artifactType: 'legacy_report',
          sourceOfTruthRole: 'evidence',
          path: '_bmad-output/runtime/requirement-records/REQ-EVIDENCE-INGEST/execution/old-report.json',
          contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          producer: 'legacy-runner',
          traceRows: ['TRACE-OLD'],
          evidenceRefs: ['EVD-OLD'],
        },
      ];
      writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(0);
      const updated = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(updated.artifactIndex[0]).toMatchObject({
        status: 'archived',
        inputVersion: 'pre-artifact-metadata-enforcement',
        outputVersion: 'archived-historical-artifact',
      });
      expect(updated.artifactIndex.at(-1)).toMatchObject({
        status: 'active',
        relatedRequirementIds: ['MUST-007', 'NEG-008'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
