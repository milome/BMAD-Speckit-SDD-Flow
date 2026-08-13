import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildNativeGoalImportReturnMetadata,
  ensureMainAgentDispatchPacket,
  mainAgentRunLoopExitCode,
  runMainAgentAutomaticLoop,
  type NativeGoalControlledExecutor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { packetArtifactPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';
import { writeGovernedJson } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import {
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashFile(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function hashText(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function attachCampaignRuntimeBinding(input: {
  fixture: Awaited<ReturnType<typeof publishImplementationPromptFixture>>['fixture'];
  pointer: Record<string, unknown>;
  packetId: string;
  bindingChildCount?: number;
  firstManifestChildHash?: string;
}): Record<string, unknown> {
  const root = input.fixture.root;
  const runtimeDir = path.join(root, '_bmad-output', 'runtime', 'campaign-binding');
  const packageRequestPath = path.join(runtimeDir, 'package-request.json');
  const partitionManifestPath = path.join(runtimeDir, 'partition-manifest.json');
  const childPaths = [
    path.join(runtimeDir, 'child-1.md'),
    path.join(runtimeDir, 'child-2.md'),
  ];
  const dependencyPath = path.join(runtimeDir, 'campaign-dependencies.cjs');
  const aggregateAuditMarkerPath = path.join(runtimeDir, 'aggregate-audit.marker');
  const certificationPath = path.join(runtimeDir, 'certification.json');
  const bindingPath = path.join(runtimeDir, 'binding.json');
  const packetPath = packetArtifactPath(
    root,
    input.fixture.identity.requirementSetId,
    input.packetId
  );
  for (const [index, childPath] of childPaths.entries()) {
    fs.mkdirSync(path.dirname(childPath), { recursive: true });
    fs.writeFileSync(childPath, `# Child ${index + 1}\n`, 'utf8');
  }
  writeJson(partitionManifestPath, {
    schemaVersion: 'goal-contract-partition-manifest/v1',
    partitions: childPaths.map((childPath, index) => ({
      partitionId: `child-${index + 1}`,
      childContractPath: childPath,
      childContractHash:
        index === 0 && input.firstManifestChildHash
          ? input.firstManifestChildHash
          : hashFile(childPath),
    })),
  });
  writeJson(packageRequestPath, {
    schemaVersion: 'goal-subcontract-execution-package-request/v1',
    partitionManifest: {
      path: partitionManifestPath,
      hash: hashFile(partitionManifestPath),
    },
    children: childPaths.map((childPath, index) => ({
      partitionId: `child-${index + 1}`,
      path: childPath,
      hash: hashFile(childPath),
    })),
  });
  fs.writeFileSync(
    dependencyPath,
    [
      `const fs = require('node:fs');`,
      `const PACKAGE_HASH = 'sha256:${'1'.repeat(64)}';`,
      `const CAMPAIGN_HASH = 'sha256:${'2'.repeat(64)}';`,
      `const COMMIT_HASH = 'sha256:${'3'.repeat(64)}';`,
      `const AGGREGATE_AUDIT_MARKER = ${JSON.stringify(aggregateAuditMarkerPath)};`,
      'module.exports = {',
      '  compileExecutionPackage() { return { packageManifestHash: PACKAGE_HASH, packageManifestPath: "package/package-manifest.json", campaignPromptPath: "package/campaign-prompt.md", campaignPromptHash: "sha256:4444444444444444444444444444444444444444444444444444444444444444", packageCompileReceiptPath: "package/compile-receipt.json", packageCompileReceiptHash: "sha256:5555555555555555555555555555555555555555555555555555555555555555" }; },',
      '  auditExecutionPackage() { return { status: "pass", packageManifestHash: PACKAGE_HASH }; },',
      '  auditCompletedChild({ child }) { return { status: "closed", partitionId: child.partitionId, commitHash: COMMIT_HASH, filesChanged: [], validationsRun: ["campaign-child"], evidence: ["campaign-child-proof"] }; },',
      '  auditCompletedCampaign() { fs.appendFileSync(AGGREGATE_AUDIT_MARKER, "audit\\n", "utf8"); return { status: "done", packageManifestHash: PACKAGE_HASH, campaignReportHash: CAMPAIGN_HASH }; },',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  const packageRequestRef = { path: packageRequestPath, hash: hashFile(packageRequestPath) };
  const partitionManifestRef = {
    path: partitionManifestPath,
    hash: hashFile(partitionManifestPath),
  };
  const dependencyModuleRef = { path: dependencyPath, hash: hashFile(dependencyPath) };
  writeJson(certificationPath, {
    schemaVersion: 'main-agent-goal-source-authority-certification/v1',
    authorityProfile: 'main_agent_compiled',
    decision: 'PASS',
    transactionManifestHash: (input.pointer.transactionManifestRef as Record<string, unknown>)
      .hash,
    modelPacketBinding: {
      modelPacketHash: (input.pointer.modelPacketRef as Record<string, unknown>).hash,
    },
    packetRef: { path: packetPath },
    packageRequestRef,
    partitionManifestRef,
  });
  writeJson(bindingPath, {
    schemaVersion: 'main-agent-campaign-runtime-binding/v1',
    pointerRef: { path: input.fixture.options.currentDispatchPointer },
    packetRef: { path: packetPath },
    certificationRef: { path: certificationPath, hash: hashFile(certificationPath) },
    packageRequestRef,
    partitionManifestRef,
    children: childPaths
      .slice(0, input.bindingChildCount ?? childPaths.length)
      .map((childPath, index) => ({
        partitionId: `child-${index + 1}`,
        path: childPath,
        hash: hashFile(childPath),
      })),
    runtimeDependencies: Object.fromEntries(
      [
        'compileExecutionPackage',
        'auditExecutionPackage',
        'auditCompletedChild',
        'auditCompletedCampaign',
      ].map((exportName) => [
        exportName,
        { moduleRef: dependencyModuleRef, exportName },
      ])
    ),
  });
  const bindingHash = hashFile(bindingPath);
  const currentPointer = {
    ...input.pointer,
    campaignRuntimeBindingRef: {
      path: bindingPath,
      hash: bindingHash,
      readbackHash: bindingHash,
      readbackVerified: true,
    },
  };
  writeGovernedJson(input.fixture.options.currentDispatchPointer, currentPointer);
  return { currentPointer, aggregateAuditMarkerPath };
}

function receiptPath(root: string, recordId: string, attemptId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'runtime-mode',
    attemptId,
    'native-goal-invocation-receipt.json'
  );
}

function orchestrationStatePath(fixture: {
  recordPath: string;
  requirementSetId: string;
}): string {
  return path.join(
    path.dirname(fixture.recordPath),
    'orchestration',
    'orchestration-state',
    `${fixture.requirementSetId}.json`
  );
}

describe('main-agent run-loop native goal invocation routing', () => {
  it('treats awaiting user acceptance as a successful CLI handoff', () => {
    expect(mainAgentRunLoopExitCode('completed')).toBe(0);
    expect(mainAgentRunLoopExitCode('awaiting_user_acceptance')).toBe(0);
    expect(mainAgentRunLoopExitCode('blocked')).toBe(1);
  });

  it.each([
    { host: 'codex' as const },
    { host: 'claude' as const },
  ])('persists $host awaiting_task_report without a synthetic TaskReport', async ({ host }) => {
    const { fixture, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const taskReportBefore = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host,
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport).toBeNull();
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const packetId = result.dispatchInstruction!.packetId;
      const taskReportAfter = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      expect(taskReportAfter).toEqual(taskReportBefore);
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.authority.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.executionSurface).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([goalCommandText]);
      expect(receipt.nativeGoalCommandPrepared).toBe(true);
      expect(receipt.nativeGoalCommandUsed).toBe(false);
      expect(receipt.packetId).toBe(packetId);
      expect(receipt.taskReportPath).toBe(fixture.options.taskReportPath);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        packetId,
        invoked: true,
        imported: false,
        importStatus: 'awaiting_task_report',
        returnCommand: 'bmad-speckit',
        returnArgv: [
          'main-agent-orchestration',
          '--action',
          'import-native-goal-task-report',
          '--taskReportPath',
          fixture.options.taskReportPath,
        ],
      });
      expect(record.lastEventType).toBe('native_goal_handoff_recorded');
      expect(result.finalSurface.orchestrationState?.pendingPacket?.status).toBe('dispatched');
      expect(result.finalSurface.orchestrationState?.lastTaskReport ?? null).toBeNull();
      expect(result.finalSurface.orchestrationState?.gatesLoop?.noProgressCount ?? 0).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  it('infers Codex CLI host from process env even when state and config still say cursor', async () => {
    const previousEnv = {
      CODEX_THREAD_ID: process.env.CODEX_THREAD_ID,
      CODEX_MANAGED_BY_NPM: process.env.CODEX_MANAGED_BY_NPM,
      CODEX_MANAGED_PACKAGE_ROOT: process.env.CODEX_MANAGED_PACKAGE_ROOT,
    };
    const { fixture, goalCommandText } = await publishImplementationPromptFixture();
    try {
      process.env.CODEX_THREAD_ID = fixture.identity.transactionId;
      process.env.CODEX_MANAGED_BY_NPM = 'true';
      process.env.CODEX_MANAGED_PACKAGE_ROOT = fixture.paths.installedPackageRoot;
      fs.mkdirSync(path.join(fixture.root, '_bmad', '_config'), { recursive: true });
      fs.writeFileSync(
        path.join(fixture.root, '_bmad', '_config', 'governance-remediation.yaml'),
        ['version: 1', 'primaryHost: cursor', 'authoritativeHost: cursor'].join('\n'),
        'utf8'
      );
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'cursor',
      });
      const statePath = orchestrationStatePath({
        recordPath: fixture.paths.recordPath,
        requirementSetId: fixture.identity.requirementSetId,
      });
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.host = 'cursor';
      state.hostRecovery = {
        degradation_level: 'none',
        active_host_mode: 'cursor',
        orchestration_entry: 'main-agent-orchestration',
        updated_at: '2026-06-28T00:00:00.000Z',
      };
      writeJson(statePath, state);

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });

      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const packetId = result.dispatchInstruction!.packetId;
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.authority.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([goalCommandText]);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        dispatchHost: 'codex',
        importStatus: 'awaiting_task_report',
      });
    } finally {
      fixture.cleanup();
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it.each([
    { host: 'codex' as const, canonicalHost: 'codex' },
    { host: 'claude' as const, canonicalHost: 'claude-code-cli' },
  ])('ingests a real TaskReport produced by the $host controlled executor', async ({
    host,
    canonicalHost,
  }) => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const executor: NativeGoalControlledExecutor = (request) => {
        expect(request).toMatchObject({
          host: canonicalHost,
          commandText: goalCommandText,
          taskReportPath: fixture.options.taskReportPath,
        });
        executeRequiredCommandsForPublishedFixture({
          fixture,
          pointer,
        });
        writeJson(request.taskReportPath, {
          packetId: request.packetId,
          status: 'done',
          filesChanged: [],
          validationsRun: ['main-agent-controlled-native-goal'],
          evidence: ['controlled executor TaskReport'],
          downstreamContext: ['continue to execution closure'],
        });
        return {
          exitCode: 0,
          stdout: 'native goal completed',
          stderr: '',
        };
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host,
        nativeGoalExecutor: executor,
      });

      expect(result.steps.filter((step) => step.status === 'fail')).toEqual([]);
      expect(result.status).toBe('completed');
      const packetId = result.dispatchInstruction!.packetId;
      expect(result.taskReport).toMatchObject({
        packetId,
        status: 'done',
      });
      const receipt = JSON.parse(
        fs.readFileSync(
          receiptPath(
            fixture.root,
            fixture.authority.recordId,
            packetId
          ),
          'utf8'
        )
      );
      expect(receipt).toMatchObject({
        executionSurface: 'host_native_goal',
        invokedCommandKind: 'host_native_goal',
        nativeGoalCommandPrepared: true,
        nativeGoalCommandUsed: true,
        exitCode: 0,
        taskReportPath: fixture.options.taskReportPath,
      });
      expect(receipt.taskReportHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(receipt.transactionManifestHash).toBe(
        (pointer.transactionManifestRef as Record<string, unknown>).hash
      );
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        invoked: true,
        imported: true,
        importStatus: 'task_report_done',
      });
      expect(record.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executionIterationId: packetId,
            status: 'done',
          }),
        ])
      );
      const modelPacket = JSON.parse(
        fs.readFileSync(
          String((pointer.modelPacketRef as Record<string, unknown>).path),
          'utf8'
        )
      ) as Record<string, unknown>;
      const requiredCommand = (modelPacket.requiredCommands as Array<Record<string, unknown>>)[0];
      const executionIteration = (
        record.executionIterations as Array<Record<string, unknown>>
      ).find((iteration) => iteration.executionIterationId === packetId);
      expect(executionIteration?.commandRunRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commandId: requiredCommand.id,
            runId: expect.stringMatching(/^RUN-[A-Za-z0-9._-]+$/u),
            exitCode: 0,
            executorIdentity: expect.objectContaining({
              class: 'goal_controlled_executor',
            }),
            transactionId: fixture.identity.transactionId,
            implementationAttemptId: fixture.identity.implementationAttemptId,
          }),
        ])
      );
      expect(executionIteration?.evidenceArtifactRefs).toEqual(
        expect.arrayContaining(
          [
            'native_goal_task_report',
            'native_goal_invocation_receipt',
            'prompt_transaction_manifest',
            'current_dispatch_pointer',
            'command_execution_receipt',
          ].map((artifactType) => expect.objectContaining({ artifactType }))
        )
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('propagates a controlled closeout candidate without importing a final TaskReport', async () => {
    const { fixture, pointer } = await publishImplementationPromptFixture();
    const closeoutAttemptId = 'closeout-attempt-dynamic';
    const candidatePath = path.join(
      fixture.root,
      '_bmad-output',
      'runtime',
      'controlled-closeout',
      closeoutAttemptId,
      'task-report-candidate.json'
    );
    try {
      writeJson(candidatePath, {
        packetId: 'candidate-packet-bound-at-runtime',
        status: 'done',
        filesChanged: [],
        validationsRun: ['manifest-defined-validation'],
        evidence: ['context-bound-campaign-evidence'],
        downstreamContext: ['await controlled user acceptance'],
      });
      const candidateHash = hashFile(candidatePath);
      const contextHash = hashText(`${closeoutAttemptId}:context`);
      const campaignId = 'partitioned-standalone-goal-campaign';
      const compileReceiptHash = hashText(`${closeoutAttemptId}:compile`);
      const childClosureSetHash = hashText(`${closeoutAttemptId}:children`);
      const campaignReportHash = hashText(`${closeoutAttemptId}:campaign-report`);
      const producerReceipt = {
        schemaVersion: 'goal-campaign-closure-receipt/v1',
        status: 'campaign_closed',
        closeoutAttemptId,
        contextHash,
        compileReceiptHash,
        childClosureSetHash,
        campaignReportPath: 'campaign-report.json',
        campaignReportHash,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        receiptHash: hashText(`${closeoutAttemptId}:closure`),
      };
      const executionFinalJudgeCampaign = {
        schemaVersion: 'requirements-contract-parent-goal-blind-review-aggregate/v2',
        campaignId,
        closeoutAttemptId,
        candidateBytesHash: candidateHash,
        decision: 'pass',
        aggregateHash: hashText(`${closeoutAttemptId}:judge-campaign`),
      };
      const effectivePassReceipt = {
        campaignId,
        effectivePass: true,
        effectivePassReceiptHash: hashText(`${closeoutAttemptId}:effective-pass`),
      };
      const deliveryGateReceipt = {
        status: 'awaiting_user_acceptance',
        closeoutAttemptId,
        receiptHash: hashText(`${closeoutAttemptId}:delivery-closeout`),
      };
      const taskReportBefore = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      const executor: NativeGoalControlledExecutor = () => {
        executeRequiredCommandsForPublishedFixture({ fixture, pointer });
        return {
          exitCode: 0,
          stdout: 'controlled closeout awaiting acceptance',
          stderr: '',
          closeoutStatus: 'awaiting_user_acceptance',
          closeoutAttemptId,
          taskReportCandidatePath: candidatePath,
          taskReportArtifactHash: candidateHash,
          closeoutContextHash: contextHash,
          producerReceipt,
          executionFinalJudgeCampaign,
          effectivePassReceipt,
          deliveryGateReceipt,
        };
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        nativeGoalExecutor: executor,
      });

      expect(result).toMatchObject({
        status: 'awaiting_user_acceptance',
        taskReport: null,
        closeoutAttemptId,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        controlledCloseoutIngested: true,
      });
      expect(result.steps.some((step) => step.step === 'native-goal-task-report.ingest')).toBe(
        false
      );
      const taskReportAfter = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      expect(taskReportAfter).toEqual(taskReportBefore);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        importStatus: 'awaiting_user_acceptance',
        imported: false,
        closeoutAttemptId,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        controlledCloseout: {
          contextHash,
          compileReceiptHash,
          childClosureSetHash,
          campaignReportHash,
        },
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('resolves a certified campaign binding from the current pointer and authorizes children serially', async () => {
    const { fixture, pointer } = await publishImplementationPromptFixture();
    const packetId = 'campaign-runtime-packet';
    try {
      const { currentPointer } = attachCampaignRuntimeBinding({ fixture, pointer, packetId });
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: packetId,
      });
      const events: string[] = [];
      const executor: NativeGoalControlledExecutor = (request) => {
        executeRequiredCommandsForPublishedFixture({ fixture, pointer: currentPointer });
        const childInvocations: Array<Record<string, unknown>> = [];
        for (const child of request.children ?? []) {
          events.push(`dispatch:${child.partitionId}`);
          childInvocations.push(child);
          const authorized = request.reportChildResult?.(child) ?? false;
          events.push(`authorize:${child.partitionId}:${authorized}`);
          if (!authorized) break;
        }
        return { exitCode: 0, childInvocations };
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'codex',
        nativeGoalExecutor: executor,
      });

      expect(result.dispatchInstruction?.packet.executionStrategy?.strategyId).toBe(
        'governed_skill_adapter'
      );
      expect(result.dispatchInstruction?.packet.campaignRuntimeBindingRef).toEqual(
        currentPointer.campaignRuntimeBindingRef
      );
      expect(events).toEqual([
        'dispatch:child-1',
        'authorize:child-1:true',
        'dispatch:child-2',
        'authorize:child-2:true',
      ]);
      expect(result.status).toBe('completed');
      expect(result.taskReport).toMatchObject({ packetId, status: 'done' });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a runtime binding that omits a manifest-declared Goal child', async () => {
    const { fixture, pointer } = await publishImplementationPromptFixture();
    const packetId = 'campaign-runtime-incomplete-child-set';
    let executorCalled = false;
    try {
      attachCampaignRuntimeBinding({
        fixture,
        pointer,
        packetId,
        bindingChildCount: 1,
      });
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: packetId,
      });

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        nativeGoalExecutor: () => {
          executorCalled = true;
          return { exitCode: 0 };
        },
      });

      expect(result.status).toBe('blocked');
      expect(executorCalled).toBe(false);
      expect(result.steps.at(-1)).toMatchObject({
        step: 'native-goal-invocation',
        status: 'fail',
        summary: 'campaign_runtime_binding_child_set_mismatch',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a runtime binding whose child bytes disagree with the partition manifest', async () => {
    const { fixture, pointer } = await publishImplementationPromptFixture();
    const packetId = 'campaign-runtime-manifest-child-drift';
    let executorCalled = false;
    try {
      attachCampaignRuntimeBinding({
        fixture,
        pointer,
        packetId,
        firstManifestChildHash: hashText('different child contract bytes'),
      });
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'bugfix',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: packetId,
      });

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'bugfix',
        stage: 'implement',
        host: 'codex',
        nativeGoalExecutor: () => {
          executorCalled = true;
          return { exitCode: 0 };
        },
      });

      expect(result.status).toBe('blocked');
      expect(executorCalled).toBe(false);
      expect(result.steps.at(-1)).toMatchObject({
        step: 'native-goal-invocation',
        status: 'fail',
        summary: 'campaign_runtime_binding_child_membership_mismatch:0',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('closes a partitioned root Goal campaign independently of the legacy workflow name', async () => {
    const { fixture, pointer } = await publishImplementationPromptFixture();
    const packetId = 'partitioned-standalone-goal-packet';
    const closeoutAttemptId = 'partitioned-standalone-goal-closeout';
    try {
      const { currentPointer, aggregateAuditMarkerPath } = attachCampaignRuntimeBinding({
        fixture,
        pointer,
        packetId,
      });
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        preferredPacketId: packetId,
      });
      const candidatePath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'controlled-closeout',
        closeoutAttemptId,
        'task-report-candidate.json'
      );
      writeJson(candidatePath, {
        packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: ['package-manifest-defined-validation'],
        evidence: ['ordered child closure receipts'],
        downstreamContext: ['await controlled user acceptance'],
      });
      const candidateHash = hashFile(candidatePath);
      const contextHash = hashText(`${closeoutAttemptId}:context`);
      const campaignId = 'partitioned-standalone-goal-campaign';
      const compileReceiptHash = hashText(`${closeoutAttemptId}:compile`);
      const childClosureSetHash = hashText(`${closeoutAttemptId}:children`);
      const campaignReportHash = hashText(`${closeoutAttemptId}:campaign-report`);
      const producerReceipt = {
        schemaVersion: 'goal-campaign-closure-receipt/v1',
        status: 'campaign_closed',
        closeoutAttemptId,
        contextHash,
        compileReceiptHash,
        childClosureSetHash,
        campaignReportPath: 'campaign-report.json',
        campaignReportHash,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        receiptHash: hashText(`${closeoutAttemptId}:closure`),
      };
      const executionFinalJudgeCampaign = {
        schemaVersion: 'requirements-contract-parent-goal-blind-review-aggregate/v2',
        campaignId,
        closeoutAttemptId,
        candidateBytesHash: candidateHash,
        decision: 'pass',
        aggregateHash: hashText(`${closeoutAttemptId}:judge-campaign`),
      };
      const effectivePassReceipt = {
        campaignId,
        effectivePass: true,
        effectivePassReceiptHash: hashText(`${closeoutAttemptId}:effective-pass`),
      };
      const deliveryGateReceipt = {
        status: 'awaiting_user_acceptance',
        closeoutAttemptId,
        receiptHash: hashText(`${closeoutAttemptId}:delivery-closeout`),
      };
      const taskReportBefore = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      const executor: NativeGoalControlledExecutor = (request) => {
        executeRequiredCommandsForPublishedFixture({ fixture, pointer: currentPointer });
        const childInvocations: Array<Record<string, unknown>> = [];
        for (const child of request.children ?? []) {
          childInvocations.push(child);
          if (!(request.reportChildResult?.(child) ?? false)) break;
        }
        return {
          exitCode: 0,
          childInvocations,
          closeoutStatus: 'awaiting_user_acceptance',
          closeoutAttemptId,
          taskReportCandidatePath: candidatePath,
          taskReportArtifactHash: candidateHash,
          closeoutContextHash: contextHash,
          producerReceipt,
          executionFinalJudgeCampaign,
          effectivePassReceipt,
          deliveryGateReceipt,
        };
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'story',
        stage: 'implement',
        host: 'codex',
        nativeGoalExecutor: executor,
      });

      expect(result).toMatchObject({
        status: 'awaiting_user_acceptance',
        taskReport: null,
        closeoutAttemptId,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        controlledCloseoutIngested: true,
      });
      expect(fs.existsSync(aggregateAuditMarkerPath)).toBe(false);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        controlledCloseoutIngested: true,
        closeoutAttemptId,
        taskReportCandidatePath: candidatePath,
        taskReportArtifactHash: candidateHash,
        controlledCloseout: {
          schemaVersion: 'main-agent-controlled-closeout-handoff/v1',
          contextHash,
          compileReceiptHash,
          childClosureSetHash,
          campaignReportHash,
        },
      });
      const taskReportAfter = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      expect(taskReportAfter).toEqual(taskReportBefore);
    } finally {
      fixture.cleanup();
    }
  });

  it('builds argv-safe TaskReport import metadata for paths with spaces and shell metacharacters', () => {
    const taskReportPath = path.join(
      'D:\\consumer workspace',
      '_bmad-output',
      'runtime',
      'task reports',
      'native goal & proof.json'
    );

    expect(buildNativeGoalImportReturnMetadata(taskReportPath)).toEqual({
      returnCommand: 'bmad-speckit',
      returnArgv: [
        'main-agent-orchestration',
        '--action',
        'import-native-goal-task-report',
        '--taskReportPath',
        taskReportPath,
      ],
    });
  });
});
