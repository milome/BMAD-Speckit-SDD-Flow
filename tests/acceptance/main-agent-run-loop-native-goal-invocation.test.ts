import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  type NativeGoalSpawnSyncFn,
} from '../../scripts/main-agent-orchestration';
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
    { host: 'codex' as const, expectedCommand: 'codex' },
    { host: 'claude' as const, expectedCommand: 'claude' },
  ])('routes $host native goal packet through host-native invoker', ({ host, expectedCommand }) => {
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
      const calls: Array<{ command: string; args: string[] }> = [];
      const spawnSyncFn: NativeGoalSpawnSyncFn = (command, args) => {
        calls.push({ command, args });
        writeJson(requestedTaskReportPath, {
          packetId,
          status: 'done',
          filesChanged: ['scripts/main-agent-orchestration.ts'],
          validationsRun: ['run-loop-native-goal-fixture'],
          evidence: ['native goal run-loop fixture completed'],
          downstreamContext: ['native goal run-loop completed'],
        });
        return { status: 0, stdout: `${host} stdout`, stderr: '' };
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

      expect(result.status).toBe('completed');
      expect(result.taskReport?.status).toBe('done');
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      expect(result.steps.some((step) => step.step === 'codex-worker-adapter')).toBe(false);
      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe(expectedCommand);
      expect(calls[0].args).toContain(commandText);
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('host_native_goal');
      expect(receipt.packetId).toBe(packetId);
      expect(receipt.taskReportPath).toBe(requestedTaskReportPath);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
