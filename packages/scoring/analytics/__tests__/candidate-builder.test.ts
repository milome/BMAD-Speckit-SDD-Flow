import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { buildCanonicalCandidates } from '../candidate-builder';
import type { RunScoreRecord } from '../../writer/types';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

function makeRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'run-e15-s1-001',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 95,
    phase_weight: 1,
    check_items: [],
    timestamp: '2026-03-28T00:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    source_path: '',
    base_commit_hash: 'ad245b7',
    content_hash: 'sha256:content-001',
    source_hash: 'sha256:source-001',
    ...overrides,
  };
}

describe('canonical candidate builder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-candidate-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('builds a canonical sample from a legacy high-score record', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n修复 dashboard runtime 观测缺口。\n\n## §4 修复方案\n补充 query core 与 live dashboard。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(makeRecord({ source_path: bugfixPath })),
      'utf-8'
    );

    vi.mocked(execSync).mockImplementation((command: string) => {
      if (command.includes('rev-parse HEAD')) return 'f'.repeat(40);
      if (command.includes('rev-parse --verify')) return 'ad245b7';
      if (command.includes('git diff')) return '--- a/foo.ts\n+++ b/foo.ts\n-old code\n+new code';
      return '';
    });

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toMatchObject({
      sample_version: 'v1',
      quality: {
        acceptance_decision: 'accepted',
        has_code_pair: true,
      },
      split: {
        strategy: 'story_hash_v1',
      },
    });
    expect(result.samples[0].messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
    ]);
  });

  it('prefers a persisted patch snapshot over runtime git diff reconstruction', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    const patchPath = path.join(tempDir, 'patches', 'run-e15-s1-001.patch');
    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n修复 dashboard runtime 观测缺口。\n\n## §4 修复方案\n补充 query core 与 live dashboard。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      patchPath,
      '--- a/foo.ts\n+++ b/foo.ts\n-old snapshot code\n+new snapshot code',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        makeRecord({
          source_path: bugfixPath,
          patch_ref: 'sha256:patch-snapshot-001',
          patch_snapshot_path: patchPath,
        })
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].provenance.patch_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.samples[0].quality.has_code_pair).toBe(true);
    expect(String(result.samples[0].messages[1].content)).toContain('old snapshot code');
    expect(String(result.samples[0].messages[2].content)).toContain('new snapshot code');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('rejects a candidate when provenance is incomplete', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n修复 dashboard runtime 观测缺口。\n\n## §4 修复方案\n补充 query core 与 live dashboard。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        makeRecord({
          source_path: bugfixPath,
          base_commit_hash: undefined,
        })
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].quality.acceptance_decision).toBe('rejected');
    expect(result.samples[0].quality.rejection_reasons).toContain('prov_missing_hash');
  });

  it('ignores tmp and malformed source artifacts before candidate creation', async () => {
    const tmpPath = path.join(tempDir, 'artifact.md.tmp');
    const brokenJsonPath = path.join(tempDir, 'broken.json');
    fs.writeFileSync(tmpPath, 'tmp artifact', 'utf-8');
    fs.writeFileSync(brokenJsonPath, '{broken', 'utf-8');
    fs.writeFileSync(
      path.join(tempDir, 'records.json'),
      JSON.stringify([
        makeRecord({ run_id: 'run-e15-s1-tmp', source_path: tmpPath }),
        makeRecord({ run_id: 'run-e15-s1-json', source_path: brokenJsonPath }),
      ]),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
    });

    expect(result.samples).toHaveLength(0);
  });

  it('rejects a high-score candidate when veto is triggered', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n修复 dashboard runtime 观测缺口。\n\n## §4 修复方案\n补充 query core 与 live dashboard。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        makeRecord({
          source_path: bugfixPath,
          check_items: [{ item_id: 'veto_core_logic', passed: false, score_delta: -100 }],
        })
      ),
      'utf-8'
    );

    vi.mocked(execSync).mockImplementation((command: string) => {
      if (command.includes('rev-parse HEAD')) return 'f'.repeat(40);
      if (command.includes('rev-parse --verify')) return 'ad245b7';
      if (command.includes('git diff')) return '--- a/foo.ts\n+++ b/foo.ts\n-old code\n+new code';
      return '';
    });

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].quality.acceptance_decision).toBe('rejected');
    expect(result.samples[0].quality.rejection_reasons).toContain('veto_triggered');
  });
});
