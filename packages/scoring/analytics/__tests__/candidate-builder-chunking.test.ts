import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildCanonicalCandidates } from '../candidate-builder';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'run-e15-s1-chunk',
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
    content_hash: 'sha256:content-chunk',
    source_hash: 'sha256:source-chunk',
    ...overrides,
  };
}

function repeated(label: string): string {
  return `${label} ${label} ${label} ${label} ${label} ${label} ${label} ${label} ${label} ${label}`;
}

describe('canonical candidate builder chunking', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-candidate-chunking-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('splits one patch snapshot into multiple canonical samples under the token budget', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    const patchPath = path.join(tempDir, 'patches', 'run-e15-s1-chunk.patch');

    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n需要把 runtime dashboard / scoring / SFT 观察链路切得更细，让训练数据默认就能导出。\n\n## §4 修复方案\n按 patch snapshot 的 file / hunk / token budget 分块构建 canonical sample，并保持 provenance 稳定。\n`,
      'utf-8'
    );

    fs.writeFileSync(
      patchPath,
      [
        'diff --git a/src/runtime/query.ts b/src/runtime/query.ts',
        '--- a/src/runtime/query.ts',
        '+++ b/src/runtime/query.ts',
        '@@ -10,1 +10,1 @@',
        `-${repeated('before-runtime-query')}`,
        `+${repeated('after-runtime-query')}`,
        '@@ -20,1 +20,1 @@',
        `-${repeated('before-runtime-stage')}`,
        `+${repeated('after-runtime-stage')}`,
        'diff --git a/src/analytics/sft.ts b/src/analytics/sft.ts',
        '--- a/src/analytics/sft.ts',
        '+++ b/src/analytics/sft.ts',
        '@@ -30,1 +30,1 @@',
        `-${repeated('before-sft-export')}`,
        `+${repeated('after-sft-export')}`,
        '',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        makeRecord({
          source_path: bugfixPath,
          patch_ref: 'sha256:patch-snapshot-chunk',
          patch_snapshot_path: patchPath,
        })
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
      maxTokens: 110,
    });

    expect(result.samples.length).toBeGreaterThan(1);
    expect(result.samples.every((sample) => sample.quality.token_estimate <= 110)).toBe(true);
    expect(result.samples.every((sample) => sample.quality.acceptance_decision === 'accepted')).toBe(true);
    expect(new Set(result.samples.map((sample) => sample.sample_id)).size).toBe(result.samples.length);
    expect(new Set(result.samples.map((sample) => sample.split.group_key)).size).toBe(1);
  });
});
