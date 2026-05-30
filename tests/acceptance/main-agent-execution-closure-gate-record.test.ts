import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainExecutionClosureGate } from '../../scripts/main-agent-execution-closure-gate';
import { validateRequirementRecordSchemaObject } from '../../scripts/requirement-record-live-schema-gate';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function evidenceArtifactRef(recordId: string): Record<string, unknown> {
  return {
    artifactType: 'command_stdout',
    sourceOfTruthRole: 'evidence',
    path: `_bmad-output/runtime/requirement-records/${recordId}/trace-execution/attempt-001/command-results/CMD-001.stdout.txt`,
    hash: HASH,
    producer: 'main-agent-execution-closure-gate-record.test',
    purpose: 'prove CMD-001 execution output for execution closure',
    relatedRequirementIds: ['MUST-001', 'TRACE-001', 'EVD-001'],
    status: 'active',
    inputVersion: HASH,
    outputVersion: 'attempt-001:CMD-001:stdout',
    traceRows: ['TRACE-001'],
    evidenceRefs: ['EVD-001'],
  };
}

function modelPacket(): Record<string, unknown> {
  return {
    schemaVersion: 'model-packet-fixture/v1',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    requirements: {
      must: [
        {
          id: 'MUST-001',
          text: 'Execution closure requires command, artifact, and requirement closure.',
          evidenceRefs: ['EVD-001'],
          coveredByTraceRows: ['TRACE-001'],
        },
      ],
    },
    traceSlices: [
      {
        traceId: 'TRACE-001',
        requirementRefs: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'node verify.js',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
  };
}

function baseRecord(recordId = 'REQ-EXECUTION-CLOSURE'): Record<string, unknown> {
  const artifact = evidenceArtifactRef(recordId);
  return {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId: recordId,
    sourcePath: 'docs/requirements/execution-closure-fixture.md',
    status: 'user_confirmed',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    currentMentalModel: 'implementation_readiness',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId: recordId,
        confirmedAt: '2026-05-30T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/requirements/execution-closure-fixture.md',
        sourceDocumentHash: HASH,
        implementationConfirmationHash: HASH,
        confirmationPageHash: HASH,
        confirmationText: 'confirmed',
        renderReportPath: '_bmad-output/runtime/confirmation-render-report.json',
        htmlPath: '_bmad-output/runtime/confirmation.html',
      },
    ],
    sixModelResults: {
      requirement_confirmation: modelResult(recordId, 'requirement_confirmation', 'pass'),
      architecture_confirmation: modelResult(recordId, 'architecture_confirmation', 'pass'),
      implementation_readiness: modelResult(recordId, 'implementation_readiness', 'pass'),
    },
    executionIterations: [
      {
        eventType: 'execution_iteration_recorded',
        recordId,
        requirementSetId: recordId,
        executionIterationId: 'attempt-001',
        runId: 'attempt-001',
        status: 'done',
        traceRows: ['TRACE-001'],
        taskRefs: ['TASK-001'],
        evidenceRefs: ['EVD-001'],
        filesChanged: ['scripts/example.ts'],
        diffSummary: 'implemented execution closure fixture',
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            command: 'node verify.js',
            runId: 'attempt-001',
            closeoutAttemptId: 'attempt-001',
            exitCode: 0,
            startedAt: '2026-05-30T00:00:00.000Z',
            completedAt: '2026-05-30T00:00:01.000Z',
            outputSummary: 'pass',
          },
        ],
        evidenceArtifactRefs: [artifact],
        sourceRefs: [{ sourceType: 'model_packet', id: 'attempt-001' }],
        sourceDocumentHash: HASH,
        implementationConfirmationHash: HASH,
        architectureConfirmationHash: HASH,
        recordedAt: '2026-05-30T00:00:01.000Z',
        recordedBy: 'test-agent',
      },
    ],
    requirementClosures: [
      {
        eventType: 'requirement_closure_recorded',
        recordId,
        requirementSetId: recordId,
        requirementId: 'MUST-001',
        status: 'pass',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            command: 'node verify.js',
            runId: 'attempt-001',
            closeoutAttemptId: 'attempt-001',
            exitCode: 0,
            startedAt: '2026-05-30T00:00:00.000Z',
            completedAt: '2026-05-30T00:00:01.000Z',
          },
        ],
        evidenceArtifactRefs: [artifact],
        sourceRefs: [{ sourceType: 'execution_iteration', id: 'attempt-001' }],
        recordedAt: '2026-05-30T00:00:01.000Z',
        recordedBy: 'test-agent',
      },
    ],
    artifactIndex: [artifact],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          command: 'node verify.js',
          blockingIfMissing: true,
          closeoutAttemptId: 'attempt-001',
          artifactRefs: [artifact],
        },
      ],
    },
    mentalModelTransitions: [],
    gateChecks: [],
  };
}

function modelResult(recordId: string, model: string, status: string): Record<string, unknown> {
  return {
    payloadKind: 'model_result',
    model,
    recordId,
    requirementSetId: recordId,
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    status,
    resultRecordedAt: '2026-05-30T00:00:00.000Z',
    resultRecordedBy: 'test-agent',
    blockingReasons: status === 'pass' ? [] : [`${model}_${status}`],
    sourceRefs: [{ sourceType: 'fixture', id: model }],
    currentHashes: {
      sourceDocumentHash: HASH,
      implementationConfirmationHash: HASH,
    },
  };
}

function writeRuntime(root: string, record: Record<string, unknown>): string {
  const recordId = String(record.recordId);
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const traceDir = path.join(base, 'trace-execution', 'attempt-001');
  const recordPath = path.join(base, 'requirement-record.json');
  mkdirSync(traceDir, { recursive: true });
  writeJson(recordPath, record);
  writeJson(path.join(traceDir, 'model_packet.json'), modelPacket());
  writeJson(path.join(traceDir, 'command-results', 'summary.json'), [
    {
      commandId: 'CMD-001',
      command: 'node verify.js',
      exitCode: 0,
      startedAt: '2026-05-30T00:00:00.000Z',
      completedAt: '2026-05-30T00:00:01.000Z',
    },
  ]);
  writeJson(path.join(traceDir, 'implementation-evidence', 'implementation-evidence-packet.json'), {
    schemaVersion: 'implementation-evidence-packet/v1',
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId: recordId,
    executionIterationId: 'attempt-001',
    runId: 'attempt-001',
    status: 'done',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    architectureConfirmationHash: HASH,
    closeoutAttemptId: 'attempt-001',
    traceRows: ['TRACE-001'],
    taskRefs: ['TASK-001'],
    evidenceRefs: ['EVD-001'],
    filesChanged: ['scripts/example.ts'],
    diffSummary: 'implemented execution closure fixture',
    commandRuns: [
      {
        commandId: 'CMD-001',
        command: 'node verify.js',
        runId: 'attempt-001',
        closeoutAttemptId: 'attempt-001',
        exitCode: 0,
      },
    ],
    artifactRefs: [evidenceArtifactRef(recordId)],
    requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
  });
  return recordPath;
}

describe('main agent execution closure gate', () => {
  it('records execution_closure pass only after per-MUST command, artifact, and closure evidence pass', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'execution-closure-pass-'));
    try {
      const recordPath = writeRuntime(root, baseRecord());
      const code = mainExecutionClosureGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'attempt-001',
        '--evaluated-at',
        '2026-05-30T00:00:02.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.lastEventType).toBe('execution_closure_result_recorded');
      expect(record.currentMentalModel).toBe('execution_closure');
      expect(record.sixModelResults.execution_closure).toMatchObject({
        model: 'execution_closure',
        status: 'pass',
        blockingReasons: [],
      });
      expect(record.mentalModelTransitions.at(-1)).toMatchObject({
        fromModel: 'implementation_readiness',
        toModel: 'execution_closure',
      });
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Execution Closure Gate',
        decision: 'pass',
      });
      expect(validateRequirementRecordSchemaObject(record).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks execution_closure when per-MUST closure evidence is incomplete', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'execution-closure-blocked-'));
    try {
      const record = {
        ...baseRecord('REQ-EXECUTION-CLOSURE-BLOCKED'),
        requirementClosures: [],
      };
      const recordPath = writeRuntime(root, record);
      const code = mainExecutionClosureGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'attempt-001',
        '--evaluated-at',
        '2026-05-30T00:00:02.000Z',
      ]);
      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.sixModelResults.execution_closure).toMatchObject({
        model: 'execution_closure',
        status: 'blocked',
      });
      expect(updated.sixModelResults.execution_closure.blockingReasons).toContain(
        'per_must_closure_evidence_index_not_passed'
      );
      expect(updated.currentMentalModel).toBe('execution_closure');
      expect(validateRequirementRecordSchemaObject(updated).ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
