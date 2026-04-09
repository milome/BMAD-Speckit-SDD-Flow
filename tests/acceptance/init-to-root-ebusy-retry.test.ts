import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('init-to-root Windows EBUSY retry', () => {
  it('retries transient copy EBUSY during cursor init and still succeeds', () => {
    const target = mkdtempSync(join(tmpdir(), 'init-ebusy-target-'));
    const shimDir = mkdtempSync(join(tmpdir(), 'init-ebusy-shim-'));
    const shimPath = join(shimDir, 'copyfile-ebusy-once.cjs');

    try {
      writeFileSync(
        shimPath,
        [
          "const fs = require('node:fs');",
          "const original = fs.copyFileSync;",
          "const suffix = 'step-e-02-review.md';",
          'let injected = false;',
          'fs.copyFileSync = function patchedCopyFileSync(src, dest, ...rest) {',
          "  const source = String(src).replace(/\\\\/g, '/');",
          "  const target = String(dest).replace(/\\\\/g, '/');",
          '  if (!injected && (source.endsWith(suffix) || target.endsWith(suffix))) {',
          '    injected = true;',
          "    const error = new Error('transient busy');",
          "    error.code = 'EBUSY';",
          '    throw error;',
          '  }',
          '  return original.call(this, src, dest, ...rest);',
          '};',
        ].join('\n'),
        'utf8'
      );

      execFileSync(
        process.execPath,
        [join(ROOT, 'scripts', 'init-to-root.js'), target, '--agent', 'cursor', '--no-package-json'],
        {
          cwd: ROOT,
          stdio: 'pipe',
          env: {
            ...process.env,
            NODE_OPTIONS: `--require=${shimPath}`,
          },
        }
      );

      expect(
        existsSync(
          join(
            target,
            '_bmad',
            'bmm',
            'workflows',
            '2-plan-workflows',
            'bmad-edit-prd',
            'steps-e',
            'step-e-02-review.md'
          )
        )
      ).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'pre-continue-check.cjs'))).toBe(true);
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(shimDir, { recursive: true, force: true });
    }
  }, 60_000);
});
