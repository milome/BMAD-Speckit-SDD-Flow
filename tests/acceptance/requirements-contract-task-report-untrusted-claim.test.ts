import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  type NativeGoalControlledExecutor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { validateModelPacketCommandExecutionReceipts } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt';
import {
  createDefaultOrchestrationState,
  writeOrchestrationStateAtPath,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-state';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';
import {
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

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

function prepareTaskReportImport(options: { includeControlledCommandReceipt?: boolean } = {}) {
  const includeControlledCommandReceipt = options.includeControlledCommandReceipt ?? true;
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
    implementationAttemptId: 'IMPL-ATTEMPT-TASK-REPORT-CLAIM',
    architectureAuditAttemptId: 'AUDIT-task-report-claim',
    activePhaseAuditAttemptId: 'AUDIT-task-report-claim',
    contractHash: `sha256:${'a'.repeat(64)}`,
    inputSnapshotHash: `sha256:${'b'.repeat(64)}`,
  };
  if (includeControlledCommandReceipt) {
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
  } else {
    delete modelPacket.controlledExecutionContext;
    modelPacket.requiredCommands = [];
    if (
      modelPacket.executionHandoff &&
      typeof modelPacket.executionHandoff === 'object' &&
      !Array.isArray(modelPacket.executionHandoff)
    ) {
      modelPacket.executionHandoff.requiredValidationCommands = [];
      modelPacket.executionHandoff.requiredValidationCommandRefs = [];
    }
  }
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
    stdoutHash: `sha256:${createHash('sha256').update(fs.readFileSync(stdoutPath)).digest('hex')}`,
    stderrPath,
    stderrHash: `sha256:${createHash('sha256').update(fs.readFileSync(stderrPath)).digest('hex')}`,
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
  if (includeControlledCommandReceipt) {
    fs.writeFileSync(
      receiptPath,
      `${JSON.stringify(
        { ...receiptPayload, receiptHash: sha256Stable(receiptPayload) },
        null,
        2
      )}\n`,
      'utf8'
    );
  }
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
  return { fixture, packetId, taskReportPath, modelPacket };
}

describe('requirements contract TaskReport untrusted claim', () => {
  it('rejects a model packet with no controlled command bundle', () => {
    const prepared = prepareTaskReportImport({ includeControlledCommandReceipt: false });
    try {
      const validation = validateModelPacketCommandExecutionReceipts({
        projectRoot: prepared.fixture.root,
        modelPacket: prepared.modelPacket,
      });

      expect(validation.decision).toBe('block');
      expect(validation.issueCodes).toContain('required_command_descriptor_missing');
    } finally {
      cleanupRequirementWorkspace(prepared.fixture.root);
    }
  });

  it('does not synthesize closure, accepted evidence, command success, or PASS authority', async () => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const before = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      const executor: NativeGoalControlledExecutor = (request) => {
        expect(request.commandText).toBe(goalCommandText);
        executeRequiredCommandsForPublishedFixture({ fixture, pointer });
        fs.mkdirSync(path.dirname(request.taskReportPath), { recursive: true });
        fs.writeFileSync(
          request.taskReportPath,
          `${JSON.stringify(
            {
              packetId: request.packetId,
              status: 'done',
              filesChanged: [],
              validationsRun: ['claimed command success'],
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
        return {
          exitCode: 0,
          stdout: 'controlled native goal completed',
          stderr: '',
        };
      };
      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        host: 'codex',
        nativeGoalExecutor: executor,
      });
      const after = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      const packetId = result.dispatchInstruction!.packetId;

      expect(result.status).toBe('completed');
      expect(after.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executionIterationId: packetId,
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
      const evidenceArtifactIdentities = (record: Record<string, unknown>) =>
        ((record.artifactIndex as Array<Record<string, unknown>> | undefined) ?? [])
          .filter((artifact) => artifact.sourceOfTruthRole === 'evidence')
          .map((artifact) => ({
            artifactType: artifact.artifactType,
            path: artifact.path,
            hash: artifact.contentHash ?? artifact.hash,
            sourceOfTruthRole: artifact.sourceOfTruthRole,
            status: artifact.status,
          }));
      expect(evidenceArtifactIdentities(after)).toEqual(evidenceArtifactIdentities(before));
      expect(after.deliveryEvidence ?? null).toEqual(before.deliveryEvidence ?? null);
      expect(after.gateChecks ?? []).toEqual(before.gateChecks ?? []);
      expect(after.sixModelResults).toEqual(before.sixModelResults);
      expect(after.status).toBe(before.status);
    } finally {
      fixture.cleanup();
    }
  });
});
