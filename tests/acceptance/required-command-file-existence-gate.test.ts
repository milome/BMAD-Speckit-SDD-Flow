import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateRequiredCommandFileExistence } from '../../scripts/target-artifact-realization-gate';

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

describe('required command file existence gate', () => {
  it('fails when a declared required command names a missing file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'required-command-file-'));
    try {
      const sourcePath = path.join(root, 'source.md');
      writeText(
        sourcePath,
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  requiredCommands:',
          '    - id: CMD-MISSING',
          '      command: npx vitest run tests/acceptance/missing-file.test.ts',
          '',
        ].join('\n')
      );
      const report = evaluateRequiredCommandFileExistence({ sourcePath });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('required_command_file_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when all declared command files exist', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'required-command-file-pass-'));
    try {
      const testPath = path.join(root, 'tests', 'acceptance', 'existing.test.ts');
      writeText(testPath, 'export const ok = true;\n');
      const sourcePath = path.join(root, 'source.md');
      writeText(
        sourcePath,
        [
          'implementationConfirmation:',
          '  status: user_confirmed',
          '  requiredCommands:',
          '    - id: CMD-EXISTS',
          `      command: npx vitest run ${testPath.replace(/\\/gu, '/')}`,
          '',
        ].join('\n')
      );
      const report = evaluateRequiredCommandFileExistence({ sourcePath });
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
