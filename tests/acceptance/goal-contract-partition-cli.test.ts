import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const sourceCommand = path.join(
  repoRoot,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const runner = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const roots: string[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-partition-acceptance-'));
  roots.push(root);
  const source = path.join(root, 'source.md');
  const out = path.join(root, 'partition-manifest.json');
  fs.writeFileSync(
    source,
    [
      '# Public Partition Source',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-PUBLIC: MUST compile one execution projection.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-PUBLIC: MUST reach the optimizer boundary.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-PUBLIC: MUST bind current source roots.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-PUBLIC: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return { out, source };
}

function runPublicSourceCli(args: string[]) {
  return spawnSync(process.execPath, ['-e', runner, sourceCommand, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

describe('goal-contract partition public source CLI', () => {
  it('promotes one manifest after coverage and selection receipts pass', () => {
    const { out, source } = fixture();
    const result = runPublicSourceCli([
      'partition',
      '--entry',
      'standalone_goal_contract',
      '--source',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload.ok).toBe(true);
    expect(payload.globalCoverageDecision).toBe('pass');
    expect(payload.selectionReceiptCount).toBe(payload.partitionCount);
    expect(fs.existsSync(out)).toBe(true);
    const manifestBytes = fs.readFileSync(out);
    expect(payload.partitionManifestHash).toBe(
      `sha256:${createHash('sha256').update(manifestBytes).digest('hex')}`
    );
  });
});
