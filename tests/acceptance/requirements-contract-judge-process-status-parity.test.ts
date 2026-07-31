import { describe, expect, it, vi } from 'vitest';
import {
  enforceJudgeProcessStatusParity,
  runJudgePublicCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/speckit-cli';

describe('Judge public JSON/process status parity', () => {
  it.each([
    ['pass', true, 0, 0],
    ['block', false, 1, 1],
    ['blocked', false, 1, 1],
    ['inconclusive', false, 1, 1],
    ['error', false, 1, 1],
  ])(
    'maps decision=%s and ok=%s to the required process status',
    (decision, ok, reportedProcessExitCode, expectedProcessExitCode) => {
      const result = enforceJudgeProcessStatusParity({
        schemaVersion: 'requirements-contract-judge-command-result/v1',
        command: 'bmad-speckit judge run',
        decision,
        ok,
        processExitCode: reportedProcessExitCode,
      });

      expect(result).toMatchObject({
        decision,
        ok,
        processExitCode: expectedProcessExitCode,
        processStatusParity: true,
      });
      expect(result.issueCode).toBeUndefined();
    }
  );

  it('records a release_process_status_mismatch and fails closed', () => {
    const result = enforceJudgeProcessStatusParity({
      schemaVersion: 'requirements-contract-judge-command-result/v1',
      command: 'bmad-speckit judge run',
      decision: 'pass',
      ok: true,
      processExitCode: 1,
    });

    expect(result).toMatchObject({
      processExitCode: 1,
      processStatusParity: false,
      issueCode: 'release_process_status_mismatch',
      reportedProcessExitCode: 1,
    });
  });

  it('preserves diagnostic JSON on authority or argv errors with nonzero exit', async () => {
    const writes: string[] = [];
    const exitCode = await runJudgePublicCommand(
      ['--json', '--external-adapter-command', 'codex'],
      {
        writeStdout: (value) => writes.push(value),
        writeStderr: vi.fn(),
      }
    );

    expect(exitCode).not.toBe(0);
    expect(JSON.parse(writes.join(''))).toMatchObject({
      command: 'bmad-speckit judge run',
      decision: 'error',
      ok: false,
      processExitCode: 1,
      processStatusParity: true,
    });
  });
});
