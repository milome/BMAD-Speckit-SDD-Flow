import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CHECKER = join(
  ROOT,
  '_bmad',
  'skills',
  'goal-execution-contract-generator',
  'scripts',
  'check-contract-command-portability.js'
);

function runChecker(content: string) {
  const directory = mkdtempSync(join(tmpdir(), 'goal-contract-portability-'));
  const target = join(directory, 'contract.md');
  writeFileSync(target, content, 'utf8');

  try {
    return spawnSync(process.execPath, [CHECKER, '--target', target, '--shell', 'pwsh', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('goal contract command portability gate', () => {
  it('rejects unquoted PowerShell git revision expressions', () => {
    const result = runChecker('Run `git rev-parse HEAD^{tree}` before validation.\n');

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'FAIL',
      issueCount: 1,
      issues: [
        {
          code: 'powershell_git_revision_expression_requires_quoting',
          line: 1,
          command: 'git rev-parse HEAD^{tree}',
        },
      ],
    });
  });

  it('accepts quoted PowerShell git revision expressions', () => {
    const result = runChecker(
      'Run `git rev-parse "HEAD^{tree}"` and `git rev-parse \'HEAD^{commit}\'`.\n'
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'PASS',
      issueCount: 0,
      issues: [],
    });
  });

  it('packages the shared portability checker into the public CLI runtime', () => {
    const buildScript = readFileSync(
      join(ROOT, 'packages', 'bmad-speckit', 'scripts', 'build-main-agent-dist.cjs'),
      'utf8'
    );

    expect(buildScript).toContain(
      "'skills/goal-execution-contract-generator/scripts/check-contract-command-portability.js'"
    );
    expect(buildScript).toContain('ensurePackageBmadOwner();');
  });
});
