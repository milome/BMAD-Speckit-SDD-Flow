import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('main-agent quality gate thresholds', () => {
  it('loads versioned thresholds and passes when required paths exist', () => {
    const output = execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--project',
        'tsconfig.node.json',
        '--transpile-only',
        'scripts/main-agent-quality-gate.ts',
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );

    const report = JSON.parse(output) as {
      thresholdsPath: string;
      critical_failures: number;
      checks: Array<{ id: string; passed: boolean }>;
    };

    expect(report.thresholdsPath).toBe('_bmad/_config/main-agent-quality-gate.thresholds.json');
    expect(report.critical_failures).toBe(0);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('keeps the quality gate implementation out of fail-closed TODO stub mode', () => {
    const source = readFileSync(path.join(ROOT, 'scripts/main-agent-quality-gate.ts'), 'utf8');
    expect(source).not.toContain("failTodo('main-agent-quality-gate'");
    expect(source).not.toContain('TODO implementation not completed');
  });
});
