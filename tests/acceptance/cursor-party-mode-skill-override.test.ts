import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' });
}

describe('cursor party-mode skill override', () => {
  it('ships a Cursor-specific step-02 override without checkpoint semantics and installs it into consumer .cursor/skills', () => {
    const sourcePath = join(
      repoRoot,
      '_bmad',
      'cursor',
      'skills',
      'bmad-party-mode',
      'steps',
      'step-02-discussion-orchestration.md'
    );
    expect(existsSync(sourcePath)).toBe(true);
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).not.toMatch(/checkpoint/iu);
    expect(source).toContain('target_rounds_total');
    expect(source).toContain('Long-Run Compact Mode');
    expect(source).toContain('one short substantive speaker line per round');
    expect(source).toContain('_bmad-output/party-mode/runtime/current-session.json');
    expect(source).toContain('missing session-log files or missing capture files alone is not sufficient evidence');

    const target = mkdtempSync(join(tmpdir(), 'cursor-party-mode-skill-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );
      const pkgPath = repoRoot.replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const installedPath = join(
        target,
        '.cursor',
        'skills',
        'bmad-party-mode',
        'steps',
        'step-02-discussion-orchestration.md'
      );
      expect(existsSync(installedPath)).toBe(true);
      const installed = readFileSync(installedPath, 'utf8');
      expect(installed).not.toMatch(/checkpoint/iu);
      expect(installed).toContain('target_rounds_total');
      expect(installed).toContain('Long-Run Compact Mode');
      expect(installed).toContain('one short substantive speaker line per round');
      expect(installed).toContain('_bmad-output/party-mode/runtime/current-session.json');
      expect(installed).toContain('missing session-log files or missing capture files alone is not sufficient evidence');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120000);
});
