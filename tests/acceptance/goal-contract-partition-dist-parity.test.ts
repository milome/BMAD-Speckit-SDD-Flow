import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');
const packageRoot = path.join(repoRoot, 'packages', 'bmad-speckit');
const publicBin = path.join(packageRoot, 'bin', 'bmad-speckit.js');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true });
});

describe('goal-contract partition dist acceptance', () => {
  it('runs the public bin from dist with explicit non-Sequence proof', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-dist-parity-'));
    roots.push(root);
    const source = path.join(root, 'source.md');
    const out = path.join(root, 'partition-manifest.json');
    const receipts = path.join(root, 'receipts');
    fs.writeFileSync(
      source,
      [
        '# Dist Parity',
        '',
        '## Implementation Task Breakdown',
        '',
        '- [ ] TASK-DIST: MUST close the public runtime capability.',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] AC-DIST: MUST prove observable completion.',
        '',
        '## Completion Evidence Packet',
        '',
        '- [ ] EVD-DIST: MUST bind current source bytes.',
        '',
        '## Required Test Commands',
        '',
        '- [ ] CMD-DIST: Run `node --version`.',
        '',
      ].join('\n'),
      'utf8'
    );
    const result = spawnSync(
      process.execPath,
      [
        publicBin,
        'goal-contract',
        'partition',
        '--entry',
        'standalone_goal_contract',
        '--source',
        source,
        '--out',
        out,
        '--receipts-dir',
        receipts,
        '--json',
      ],
      { cwd: packageRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.sequenceApplicability).toBe('not_applicable_with_proof');
    expect(payload.semanticProviderCallCount).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
    for (const relativePath of [
      'dist/_bmad',
      'dist/main-agent/source-authority/_bmad',
      'dist/main-agent/source-authority/packages',
      'dist/main-agent/source-authority/tests',
    ]) {
      expect(fs.existsSync(path.join(packageRoot, relativePath))).toBe(false);
    }
  });
});
