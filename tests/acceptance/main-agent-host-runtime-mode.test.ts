import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  selectExecutionRuntimeMode,
  validateNativeGoalReadiness,
  writeExecutionRuntimeModeSelection,
  writeNativeGoalInvocationReceipt,
  validateNativeGoalInvocationReceipt,
} from '../../scripts/host-runtime-mode';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Main Agent host runtime mode contract', () => {
  it('selects deterministic host modes and writes hash-bound runtime selection artifacts', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      expect(selectExecutionRuntimeMode('codex')).toMatchObject({
        canonicalHost: 'codex',
        executionRuntimeMode: 'native_goal',
      });
      expect(selectExecutionRuntimeMode('claude-code-cli')).toMatchObject({
        canonicalHost: 'claude-code-cli',
        executionRuntimeMode: 'native_goal',
      });
      expect(selectExecutionRuntimeMode('cursor-ide')).toMatchObject({
        canonicalHost: 'cursor-ide',
        executionRuntimeMode: 'cursor_ide_subagent_ralph_tdd_loop',
      });
      expect(selectExecutionRuntimeMode('cursor-cli')).toMatchObject({
        canonicalHost: 'cursor-cli',
        executionRuntimeMode: 'main_session_direct',
      });
      expect(selectExecutionRuntimeMode('unknown-host')).toMatchObject({
        canonicalHost: 'unknown',
        executionRuntimeMode: 'main_session_direct',
      });

      const written = writeExecutionRuntimeModeSelection({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        packetId: 'implement-current',
        attemptId: 'implement-current',
        host: 'codex',
        compiledPromptRef: compiled.compiledPromptRef,
      });
      expect(fs.existsSync(written.path)).toBe(true);
      expect(written.selection.goalExecutionHash).toBe(
        compiled.compiledPromptRef.goalExecutionHash
      );
      expect(
        validateNativeGoalReadiness({
          projectRoot: fixture.root,
          recordId: fixture.recordId,
          packetId: 'implement-current',
          attemptId: 'implement-current',
          host: 'codex',
          compiledPromptRef: compiled.compiledPromptRef,
        })
      ).toBeNull();
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects prompt-only or missing native goal document receipts for native goal hosts', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const promptOnly = {
        ...compiled.compiledPromptRef,
        goalExecutionPath: null,
        goalExecutionHash: null,
      };
      const blocker = validateNativeGoalReadiness({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        packetId: 'implement-current',
        attemptId: 'implement-current',
        host: 'codex',
        compiledPromptRef: promptOnly,
      });
      expect(blocker?.reasonCode).toBe('native_goal_readiness_invalid');
      expect(blocker?.reasonDetails.invalidFields).toEqual(
        expect.arrayContaining(['goalExecutionPath', 'goalExecutionHash'])
      );

      expect(
        validateNativeGoalInvocationReceipt({
          projectRoot: fixture.root,
          recordId: fixture.recordId,
          attemptId: 'implement-current',
          packetId: 'implement-current',
          host: 'codex',
          goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash!,
        })?.reasonCode
      ).toBe('native_goal_receipt_missing');
      writeNativeGoalInvocationReceipt({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        attemptId: 'implement-current',
        packetId: 'implement-current',
        host: 'codex',
        goalExecutionPath: compiled.compiledPromptRef.goalExecutionPath!,
        stdoutRef: 'stdout.log',
        stderrRef: 'stderr.log',
        exitCode: 0,
      });
      expect(
        validateNativeGoalInvocationReceipt({
          projectRoot: fixture.root,
          recordId: fixture.recordId,
          attemptId: 'implement-current',
          packetId: 'implement-current',
          host: 'codex',
          goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash!,
        })
      ).toBeNull();
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
