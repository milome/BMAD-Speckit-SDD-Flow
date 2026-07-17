import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importNativeGoalTaskReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  createDefaultOrchestrationState,
  writeOrchestrationStateAtPath,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-state';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function prepareTaskReportImport() {
  const fixture = materializeRequirementFixture({
    currentMentalModel: 'execution_closure',
    sixModelResults: {
      requirement_confirmation: { status: 'pass' },
      architecture_confirmation: { status: 'pass' },
      implementation_readiness: { status: 'pass' },
      execution_closure: { status: 'pass' },
    },
  });
  const packetId = 'task-report-untrusted-claim';
  const compiled = writeCompiledImplementPacket({
    root: fixture.root,
    fixture,
    packetId,
  });
  const packetCompiledPromptRef = compiled.packet.compiledPromptRef;
  if (!packetCompiledPromptRef) {
    throw new Error('compiled packet prompt reference is required');
  }
  const modelPacket = JSON.parse(
    fs.readFileSync(compiled.compiledPromptRef.modelPacketPath, 'utf8')
  );
  const commandId = 'CMD-TASK-REPORT-CLAIM';
  const commandText = 'npm test -- --task-report-claim';
  const commandArgv = ['npm', 'test', '--', '--task-report-claim'];
  const receiptPath = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    fixture.requirementSetId,
    'command-receipts',
    packetId,
    `${commandId}.json`
  );
  const controlledExecutionContext = {
    requirementSetId: fixture.requirementSetId,
    transactionId: 'TX-task-report-claim',
    implementationAttemptId: 'IMP-task-report-claim',
    architectureAuditAttemptId: 'AUDIT-task-report-claim',
    activePhaseAuditAttemptId: 'AUDIT-task-report-claim',
    contractHash: `sha256:${'a'.repeat(64)}`,
    inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
  };
  modelPacket.controlledExecutionContext = controlledExecutionContext;
  modelPacket.requiredCommands = [
    {
      id: commandId,
      command: commandText,
      argv: commandArgv,
      cwd: fixture.root,
      receiptPath,
      requirementRefs: [fixture.recordId],
      acceptanceRefs: ['AC-149'],
      traceRefs: ['TR-149'],
    },
  ];
  fs.writeFileSync(
    compiled.compiledPromptRef.modelPacketPath,
    `${JSON.stringify(modelPacket, null, 2)}\n`,
    'utf8'
  );
  const stdoutPath = `${receiptPath}.stdout.log`;
  const stderrPath = `${receiptPath}.stderr.log`;
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(stdoutPath, 'controlled command output\n', 'utf8');
  fs.writeFileSync(stderrPath, '', 'utf8');
  const receiptPayload = {
    schemaVersion: 'requirements-contract-command-execution-receipt/v1' as const,
    commandRunId: 'RUN-task-report-untrusted-claim',
    commandId,
    command: commandText,
    normalizedCommand: commandText,
    argv: commandArgv,
    argvHash: sha256Stable(commandArgv),
    cwd: fixture.root,
    executorIdentity: {
      class: 'controlled_detached_executor' as const,
      id: 'task-report-untrusted-claim-test',
    },
    hostIdentity: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
    },
    requirementSetId: fixture.requirementSetId,
    requirementRefs: [fixture.recordId],
    ...controlledExecutionContext,
    startedAt: '2026-07-16T00:00:00.000Z',
    endedAt: '2026-07-16T00:00:01.000Z',
    exitCode: 0,
    signal: null,
    stdoutPath,
    stdoutHash: `sha256:${createHash('sha256')
      .update(fs.readFileSync(stdoutPath))
      .digest('hex')}`,
    stderrPath,
    stderrHash: `sha256:${createHash('sha256')
      .update(fs.readFileSync(stderrPath))
      .digest('hex')}`,
    acceptanceRefs: ['AC-149'],
    traceRefs: ['TR-149'],
    publication: {
      writer: 'controlled-detached-executor',
      targetPath: receiptPath,
      publishedAt: '2026-07-16T00:00:01.100Z',
      readbackAt: '2026-07-16T00:00:01.200Z',
      explicitUtf8: true as const,
      createOnly: true as const,
      readbackVerified: true as const,
    },
    decision: 'pass' as const,
  };
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify(
      { ...receiptPayload, receiptHash: sha256Stable(receiptPayload) },
      null,
      2
    )}\n`,
    'utf8'
  );
  const taskReportPath = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    fixture.requirementSetId,
    `${packetId}.json`
  );
  packetCompiledPromptRef.taskReportPath = taskReportPath;
  packetCompiledPromptRef.modelPacketHash = `sha256:${createHash('sha256')
    .update(fs.readFileSync(compiled.compiledPromptRef.modelPacketPath))
    .digest('hex')}`;
  fs.writeFileSync(compiled.packetPath, `${JSON.stringify(compiled.packet, null, 2)}\n`, 'utf8');
  const state = createDefaultOrchestrationState({
    sessionId: fixture.requirementSetId,
    host: 'codex',
    flow: 'standalone_tasks',
    currentPhase: 'implement',
    nextAction: 'dispatch_implement',
    pendingPacket: {
      packetId,
      packetPath: compiled.packetPath,
      packetKind: 'execution',
      status: 'dispatched',
      createdAt: '2026-07-16T00:00:00.000Z',
      claimOwner: null,
    },
  });
  writeOrchestrationStateAtPath(
    path.join(
      fixture.root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      fixture.requirementSetId,
      'orchestration',
      'orchestration-state',
      `${fixture.requirementSetId}.json`
    ),
    state
  );
  fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });
  fs.writeFileSync(
    taskReportPath,
    `${JSON.stringify(
      {
        packetId,
        status: 'done',
        filesChanged: ['tests/task-report-claim.test.ts'],
        validationsRun: ['CMD-TASK-REPORT-CLAIM passed'],
        evidence: [
          'claimed command success',
          'claimed requirement closure',
          'claimed accepted evidence',
          'claimed gate PASS',
        ],
        downstreamContext: ['claimed completion'],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { fixture, packetId, taskReportPath };
}

describe('requirements contract TaskReport untrusted claim', () => {
  it('does not synthesize closure, accepted evidence, command success, or PASS authority', () => {
    const prepared = prepareTaskReportImport();
    try {
      const before = JSON.parse(fs.readFileSync(prepared.fixture.recordPath, 'utf8'));
      const imported = importNativeGoalTaskReport({
        projectRoot: prepared.fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: prepared.fixture.recordId,
        requirementSetId: prepared.fixture.requirementSetId,
        runId: prepared.fixture.runId,
        taskReportPath: prepared.taskReportPath,
      });
      const after = JSON.parse(fs.readFileSync(prepared.fixture.recordPath, 'utf8'));

      expect(imported.status).toBe('imported');
      expect(after.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executionIterationId: prepared.packetId,
            status: 'done',
            authorityClass: 'untrusted_claim',
            commandSuccessEligible: false,
            requirementClosureEligible: false,
            evidenceAcceptanceEligible: false,
            gatePassEligible: false,
            sixModelAdvancementEligible: false,
            completionEligible: false,
          }),
        ])
      );
      expect(after.requirementClosures ?? []).toEqual(before.requirementClosures ?? []);
      expect(
        (after.artifactIndex ?? []).filter(
          (artifact: Record<string, unknown>) => artifact.sourceOfTruthRole === 'evidence'
        )
      ).toEqual(
        (before.artifactIndex ?? []).filter(
          (artifact: Record<string, unknown>) => artifact.sourceOfTruthRole === 'evidence'
        )
      );
      expect(after.deliveryEvidence ?? null).toEqual(before.deliveryEvidence ?? null);
      expect(after.gateChecks ?? []).toEqual(before.gateChecks ?? []);
      expect(after.sixModelResults).toEqual(before.sixModelResults);
      expect(after.status).toBe(before.status);
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });
});
