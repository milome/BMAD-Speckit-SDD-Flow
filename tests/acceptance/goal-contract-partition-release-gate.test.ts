import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CLI = join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const fakePartitionId = `partition-${'f'.repeat(64)}`;

function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, 'goal-contract', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [
      key,
      canonical((value as Record<string, unknown>)[key]),
    ])
  );
}

function stable(value: unknown): string {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function prepare() {
  const root = mkdtempSync(join(tmpdir(), 'partition-release-'));
  const source = join(root, 'source.md');
  const manifest = join(root, 'active-manifest.json');
  const child = join(root, 'child-goal-execution-plan.md');
  writeFileSync(source, [
    '# Plan', '', '## Implementation Task Breakdown', '',
    '- [ ] TASK-1: MUST compile one selected child.', '',
    '## Acceptance Criteria', '', '- [ ] AC-1: MUST pass.', '',
    '## Required Test Commands', '', '- [ ] CMD-1: Run node --version.', '',
    '## Completion Evidence Packet', '', '- [ ] EVD-1: MUST bind current bytes.', '',
  ].join('\n'), 'utf8');
  const compiled = run(['partition', '--entry', 'standalone_goal_contract',
    '--source', source, '--out', manifest, '--json']);
  expect(compiled.status, compiled.stderr || compiled.stdout).toBe(0);
  const manifestObject = JSON.parse(readFileSync(manifest, 'utf8'));
  const partitionId = manifestObject.topologicalOrder[0];
  const generated = run(['generate', '--entry', 'standalone_goal_contract',
    '--source', source, '--partition-manifest', manifest, '--partition-id',
    partitionId, '--out', child, '--json']);
  expect(generated.status, generated.stderr || generated.stdout).toBe(0);
  return { root, source, manifest, child, partitionId, ...JSON.parse(generated.stdout) };
}

function gate(runState: ReturnType<typeof prepare>) {
  return run(['release-gate', '--source', runState.source, '--goal', runState.child,
    '--coverage', runState.coverageReceiptPath, '--generation',
    runState.generationReceiptPath, '--release-receipt',
    join(runState.root, 'release.receipt.json'), '--json']);
}

describe('partition-aware public release gate', () => {
  it('passes a current child and auto-routes it away from whole-source validation', () => {
    const state = prepare();
    const result = gate(state);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe('pass');
  });

  it('blocks source, manifest, receipt replay, and child tampering with structured reasons', () => {
    const cases: Array<[string, (state: ReturnType<typeof prepare>) => void]> = [
      ['partition_master_source_not_current', (s) => writeFileSync(s.source, `${readFileSync(s.source, 'utf8')}\nchanged\n`, 'utf8')],
      ['partition_manifest_hash_mismatch', (s) => {
        const value = JSON.parse(readFileSync(s.manifest, 'utf8'));
        value.selectedCandidateId = 'candidate-tampered';
        writeFileSync(s.manifest, stable(value), 'utf8');
      }],
      ['partition_selection_partition_mismatch', (s) => {
        const value = JSON.parse(readFileSync(s.selectionReceiptPath, 'utf8'));
        value.partitionId = fakePartitionId;
        writeFileSync(s.selectionReceiptPath, stable(value), 'utf8');
      }],
      ['partition_child_coverage_partition_mismatch', (s) => {
        const value = JSON.parse(readFileSync(s.coverageReceiptPath, 'utf8'));
        value.partitionId = fakePartitionId;
        writeFileSync(s.coverageReceiptPath, stable(value), 'utf8');
      }],
      ['partition_child_generation_partition_mismatch', (s) => {
        const value = JSON.parse(readFileSync(s.generationReceiptPath, 'utf8'));
        value.partitionId = fakePartitionId;
        writeFileSync(s.generationReceiptPath, stable(value), 'utf8');
      }],
      ['partition_child_goal_hash_mismatch', (s) => writeFileSync(s.child, `${readFileSync(s.child, 'utf8')}\nchanged\n`, 'utf8')],
    ];
    for (const [reason, tamper] of cases) {
      const state = prepare();
      tamper(state);
      const result = gate(state);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).blockingReasons).toContain(reason);
    }
  });
});
