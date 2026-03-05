/**
 * Story 5.5 B07: sft-extractor 单测
 * AC-B07-1~4, AC-B07-3 异常处理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  extractSftDataset,
  parseDiffToInputOutput,
  extractBugfixSections,
} from '../sft-extractor';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('sft-extractor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `sft-extractor-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    vi.clearAllMocks();
  });

  it('T2-1: gitDiffBetween parses - lines as input and + lines as output (AC-B07-2)', () => {
    const diff = `--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,3 @@
-old code
+new code
`;
    const result = parseDiffToInputOutput(diff);
    expect(result.input).toBe('old code');
    expect(result.output).toBe('new code');
  });

  it('T2-2: extracts §1 and §4 from BUGFIX content (AC-B07-1)', () => {
    const content = `## §1 现象/问题描述
问题描述内容

## §4 修复方案
修复方案内容

## §7 任务列表
`;
    const result = extractBugfixSections(content);
    expect(result).not.toBeNull();
    expect(result!.s1).toContain('问题描述内容');
    expect(result!.s4).toContain('修复方案内容');
  });

  it('T2-3: returns null when §1 or §4 missing', () => {
    expect(extractBugfixSections('## §1 only\ncontent')).toBeNull();
    expect(extractBugfixSections('## §4 only\ncontent')).toBeNull();
    expect(extractBugfixSections('no sections')).toBeNull();
  });

  it('T2-4: filters A/B records (phase_score > 60) - only C/D extracted (AC-B07-4)', async () => {
    const bugfixPath = path.join(tempDir, 'bugfix-c.md');
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题
描述

## §4 修复
方案`,
      'utf-8'
    );
    const recordA = {
      run_id: 'run-a',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 80,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    const recordC = {
      run_id: 'run-c',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 55,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      source_path: bugfixPath,
      base_commit_hash: 'abc12345',
    };
    fs.writeFileSync(path.join(tempDir, 'run-a.json'), JSON.stringify(recordA), 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'run-c.json'), JSON.stringify(recordC), 'utf-8');

    vi.mocked(execSync)
      .mockImplementationOnce(() => 'abc12345') // extractSftDataset: rev-parse --verify
      .mockImplementationOnce(() => 'abc12345') // gitDiffBetween: rev-parse --verify
      .mockImplementationOnce(() => 'a'.repeat(40)) // getGitHeadHashFull: rev-parse HEAD
      .mockImplementationOnce(() => '--- a/foo\n+++ b/foo\n-xx\n+yy'); // git diff

    const entries = await extractSftDataset(tempDir, path.join(tempDir, 'out.jsonl'));
    expect(entries.length).toBe(1);
    expect(entries[0].source_run_id).toBe('run-c');
    expect(entries[0].instruction).toContain('描述');
    expect(entries[0].input).toBe('xx');
    expect(entries[0].output).toBe('yy');
  });

  it('T2-5: skips record when source_path missing (AC-B07-3)', async () => {
    const record = {
      run_id: 'run-no-path',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 50,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      base_commit_hash: 'abc12345',
    };
    fs.writeFileSync(path.join(tempDir, 'run-no-path.json'), JSON.stringify(record), 'utf-8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const entries = await extractSftDataset(tempDir, path.join(tempDir, 'out.jsonl'));
    expect(entries.length).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no source_path'));

    warnSpy.mockRestore();
  });

  it('T2-6: skips record when source_path file not found (AC-B07-3)', async () => {
    const record = {
      run_id: 'run-missing',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 50,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      source_path: path.join(tempDir, 'nonexistent-bugfix.md'),
      base_commit_hash: 'abc12345',
    };
    fs.writeFileSync(path.join(tempDir, 'run-missing.json'), JSON.stringify(record), 'utf-8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const entries = await extractSftDataset(tempDir, path.join(tempDir, 'out.jsonl'));
    expect(entries.length).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('source_path not found'));

    warnSpy.mockRestore();
  });

  it('T2-7: skips record when git diff fails (AC-B07-3)', async () => {
    const bugfixPath = path.join(tempDir, 'bugfix.md');
    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\nx\n## §4 修复\ny`,
      'utf-8'
    );
    const record = {
      run_id: 'run-git-fail',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 50,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      source_path: bugfixPath,
      base_commit_hash: 'abc12345',
    };
    fs.writeFileSync(path.join(tempDir, 'run-git-fail.json'), JSON.stringify(record), 'utf-8');

    vi.mocked(execSync)
      .mockImplementationOnce(() => 'abc12345') // rev-parse --verify ok
      .mockImplementationOnce(() => {
        throw new Error('git diff failed');
      });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const entries = await extractSftDataset(tempDir, path.join(tempDir, 'out.jsonl'));
    expect(entries.length).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('git diff failed'));

    warnSpy.mockRestore();
  });
});
