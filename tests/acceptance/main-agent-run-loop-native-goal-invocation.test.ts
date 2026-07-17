import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  type NativeGoalSpawnSyncFn,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function taskReportPath(root: string, sessionId: string, packetId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    sessionId,
    `${packetId}.json`
  );
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

function addGoalCommandText(input: {
  packetPath: string;
  auditReceiptPath: string;
  goalExecutionPath: string;
  modelPacketPath: string;
  packetId: string;
}): string {
  const commandText = `/goal Execute ${input.packetId} by following ${input.goalExecutionPath}; use ${input.modelPacketPath} as authority; stop only on final pass or reconfirm_required.`;
  writeJson(input.auditReceiptPath, {
    decision: 'pass',
    goalCommand: {
      mode: 'native_goal_document_ref',
      commandText,
      chars: Array.from(commandText).length,
      documentPath: input.goalExecutionPath,
      documentHash: sha256File(input.goalExecutionPath),
      nativeGoalCommandUsed: true,
    },
    continuationDirective: {
      directive: commandText,
      nativeGoalCommandUsed: true,
    },
  });
  const packet = JSON.parse(fs.readFileSync(input.packetPath, 'utf8'));
  packet.compiledPromptRef.auditReceiptHash = sha256File(input.auditReceiptPath);
  packet.compiledPromptRef.goalExecutionHash = sha256File(input.goalExecutionPath);
  writeJson(input.packetPath, packet);
  return commandText;
}

describe('main-agent run-loop native goal invocation routing', () => {
  it.each([
    { host: 'codex' as const },
    { host: 'claude' as const },
  ])('prepares $host native goal packet for main-session execution without host subprocess', ({ host }) => {
    const packetId = `implement-native-${host}`;
    const fixture = materializeRequirementFixture({
      orchestrationNextAction: 'dispatch_implement',
      pendingPacket: { packetId, packetKind: 'execution', status: 'ready_for_main_agent' },
    });
    try {
      const compiled = writeCompiledImplementPacket({
        root: fixture.root,
        fixture,
        packetId,
      });
      const commandText = addGoalCommandText({
        packetPath: compiled.packetPath,
        auditReceiptPath: compiled.compiledPromptRef.auditReceiptPath,
        goalExecutionPath: compiled.compiledPromptRef.goalExecutionPath!,
        modelPacketPath: compiled.compiledPromptRef.modelPacketPath,
        packetId,
      });
      const requestedTaskReportPath = taskReportPath(
        fixture.root,
        fixture.requirementSetId,
        packetId
      );
      const spawnSyncFn: NativeGoalSpawnSyncFn = () => {
        throw new Error('run-loop must not spawn a host CLI for native /goal');
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        runId: fixture.runId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host,
        nativeGoalSpawnSyncFn: spawnSyncFn,
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.validationsRun).toContain('main-session-native-goal-preparation');
      expect(result.taskReport?.driftFlags).toContain('main-session-native-goal-required');
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.executionSurface).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([commandText]);
      expect(receipt.nativeGoalCommandPrepared).toBe(true);
      expect(receipt.nativeGoalCommandUsed).toBe(false);
      expect(receipt.packetId).toBe(packetId);
      expect(receipt.taskReportPath).toBe(requestedTaskReportPath);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('infers Codex CLI host from process env even when state and config still say cursor', () => {
    const packetId = 'implement-native-codex-env';
    const previousEnv = {
      CODEX_THREAD_ID: process.env.CODEX_THREAD_ID,
      CODEX_MANAGED_BY_NPM: process.env.CODEX_MANAGED_BY_NPM,
      CODEX_MANAGED_PACKAGE_ROOT: process.env.CODEX_MANAGED_PACKAGE_ROOT,
    };
    process.env.CODEX_THREAD_ID = 'codex-thread-fixture';
    process.env.CODEX_MANAGED_BY_NPM = 'true';
    process.env.CODEX_MANAGED_PACKAGE_ROOT = 'D:\\Dev\\BMAD-Speckit-SDD-Flow';

    const fixture = materializeRequirementFixture({
      orchestrationNextAction: 'dispatch_implement',
      pendingPacket: { packetId, packetKind: 'execution', status: 'ready_for_main_agent' },
    });
    try {
      fs.mkdirSync(path.join(fixture.root, '_bmad', '_config'), { recursive: true });
      fs.writeFileSync(
        path.join(fixture.root, '_bmad', '_config', 'governance-remediation.yaml'),
        ['version: 1', 'primaryHost: cursor', 'authoritativeHost: cursor'].join('\n'),
        'utf8'
      );
      const statePath = orchestrationStatePath(fixture);
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.host = 'cursor';
      state.hostRecovery = {
        degradation_level: 'none',
        active_host_mode: 'cursor',
        orchestration_entry: 'main-agent-orchestration',
        updated_at: '2026-06-28T00:00:00.000Z',
      };
      writeJson(statePath, state);

      const compiled = writeCompiledImplementPacket({
        root: fixture.root,
        fixture,
        packetId,
      });
      const commandText = addGoalCommandText({
        packetPath: compiled.packetPath,
        auditReceiptPath: compiled.compiledPromptRef.auditReceiptPath,
        goalExecutionPath: compiled.compiledPromptRef.goalExecutionPath!,
        modelPacketPath: compiled.compiledPromptRef.modelPacketPath,
        packetId,
      });
      const spawnSyncFn: NativeGoalSpawnSyncFn = () => {
        throw new Error('run-loop must not spawn a host CLI for native /goal');
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        runId: fixture.runId,
        flow: 'standalone_tasks',
        stage: 'implement',
        nativeGoalSpawnSyncFn: spawnSyncFn,
      });

      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([commandText]);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
