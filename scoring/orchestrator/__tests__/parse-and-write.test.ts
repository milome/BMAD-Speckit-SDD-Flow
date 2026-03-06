/**
 * Story 3.3 T5.1: parseAndWriteScore 集成测试
 * 覆盖 prd/arch/story 三类报告，content 与 reportPath 输入
 * T4.3: AC-B05-7 parseAuditReport/parseAndWriteScore 经 LLM fallback 的 E2E
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseAndWriteScore, validateIterationCount } from '../parse-and-write';

const FIXTURES = path.join(__dirname, '../../parsers/__tests__/fixtures');

describe('parseAndWriteScore', () => {
  it('writes record when given content for prd stage', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e3s3-prd-${Date.now()}`);
    const runId = `test-prd-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    expect(written.stage).toBe('prd');
    expect(written.phase_score).toBeDefined();
    expect(written.check_items).toBeDefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes record when given content for arch stage', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-arch-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e3s3-arch-${Date.now()}`);
    const runId = `test-arch-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'arch',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    expect(written.stage).toBe('arch');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes record when given content for story stage', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e3s3-story-${Date.now()}`);
    const runId = `test-story-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'story',
      runId,
      scenario: 'eval_question',
      question_version: 'v1.0',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    expect(written.stage).toBe('story');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes record when given reportPath', async () => {
    const reportPath = path.join(FIXTURES, 'sample-prd-report.md');
    const tempDir = path.join(os.tmpdir(), `scoring-e3s3-path-${Date.now()}`);
    const runId = `test-path-${Date.now()}`;

    await parseAndWriteScore({
      reportPath,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes record with veto_triggered=true when report contains veto item (veto path e2e)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-veto.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e4s1-veto-${Date.now()}`);
    const runId = `test-veto-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    expect(written.stage).toBe('prd');
    expect(written.veto_triggered).toBe(true);
    expect(written.phase_score).toBe(0);
    expect(written.tier_coefficient).toBeDefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when scenario=eval_question but question_version missing (Story 4.3)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e4s3-rej-${Date.now()}`);

    await expect(
      parseAndWriteScore({
        content,
        stage: 'story',
        runId: `test-rej-${Date.now()}`,
        scenario: 'eval_question',
        writeMode: 'single_file',
        dataPath: tempDir,
      })
    ).rejects.toThrow(/question_version.*必填/);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('includes base_commit_hash and content_hash in written record (GAP-B01)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-gapb01-${Date.now()}`);
    const runId = `test-hash-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.base_commit_hash).toBeDefined();
    expect(typeof written.base_commit_hash).toBe('string');
    expect(written.base_commit_hash.length).toBe(8);
    expect(written.content_hash).toBeDefined();
    expect(typeof written.content_hash).toBe('string');
    expect(written.content_hash.length).toBe(64);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses provided baseCommitHash when explicitly passed (GAP-B01)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-gapb01-override-${Date.now()}`);
    const runId = `test-hash-override-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      baseCommitHash: 'abcd1234',
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.base_commit_hash).toBe('abcd1234');
    expect(written.content_hash).toBeDefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('omits hash fields when skipAutoHash is true and no explicit hash (GAP-B01)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-gapb01-skip-${Date.now()}`);
    const runId = `test-hash-skip-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.base_commit_hash).toBeUndefined();
    expect(written.content_hash).toBeUndefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('content_hash is deterministic for same content (GAP-B01)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir1 = path.join(os.tmpdir(), `scoring-gapb01-det1-${Date.now()}`);
    const tempDir2 = path.join(os.tmpdir(), `scoring-gapb01-det2-${Date.now()}`);

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId: 'det-1',
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir1,
    });
    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId: 'det-2',
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir2,
    });

    const w1 = JSON.parse(fs.readFileSync(path.join(tempDir1, 'det-1.json'), 'utf-8'));
    const w2 = JSON.parse(fs.readFileSync(path.join(tempDir2, 'det-2.json'), 'utf-8'));
    expect(w1.content_hash).toBe(w2.content_hash);

    fs.rmSync(tempDir1, { recursive: true, force: true });
    fs.rmSync(tempDir2, { recursive: true, force: true });
  });

  it('AC-B05-7 T4.3: parseAndWriteScore + LLM fallback when regex fails (e2e)', async () => {
    const content = `
PRD审计报告
============
（无总体评级段落，触发 LLM fallback）
`;
    const origKey = process.env.SCORING_LLM_API_KEY;
    process.env.SCORING_LLM_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              grade: 'B',
              issues: [],
              veto_items: [],
            }),
          },
        }],
      }),
    }));

    try {
      const tempDir = path.join(os.tmpdir(), `scoring-e5s3-llm-${Date.now()}`);
      const runId = `test-llm-e2e-${Date.now()}`;

      await parseAndWriteScore({
        content,
        stage: 'prd',
        runId,
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      const filePath = path.join(tempDir, `${runId}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(written.run_id).toBe(runId);
      expect(written.stage).toBe('prd');
      expect(written.phase_score).toBe(80);

      fs.rmSync(tempDir, { recursive: true, force: true });
    } finally {
      vi.unstubAllGlobals();
      if (origKey !== undefined) process.env.SCORING_LLM_API_KEY = origKey;
      else delete process.env.SCORING_LLM_API_KEY;
    }
  });

  it('overrides phase_score by dimension weighted score when dimensions exist (B11)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-with-dimensions.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e5s2-dim-${Date.now()}`);
    const runId = `test-dim-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'spec',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.phase_score).toBe(78);
    expect(written.dimension_scores).toBeInstanceOf(Array);
    expect(written.dimension_scores.length).toBe(4);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('keeps grade-mapped phase_score when no dimensions found (B11 fallback)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e5s2-fallback-${Date.now()}`);
    const runId = `test-fallback-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'spec',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.phase_score).toBe(80);
    expect(written.dimension_scores).toBeUndefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('E5-S5 T5.1: includes source_path in written record when artifactDocPath is passed', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e5s5-srcpath-${Date.now()}`);
    const runId = `test-srcpath-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      artifactDocPath: '_bmad-output/implementation-artifacts/5-5/BUGFIX_something.md',
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.source_path).toBe('_bmad-output/implementation-artifacts/5-5/BUGFIX_something.md');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('overlays iteration_count and first_pass when iteration_count is passed (ITER-02)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-iter-${Date.now()}`);
    const runId = `test-iter-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
      iteration_count: 1,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.iteration_count).toBe(1);
    expect(written.first_pass).toBe(false);
    expect(written.tier_coefficient).toBe(0.8);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validateIterationCount: negative clamped to 0, non-integer rounded (ITER-04)', () => {
    expect(validateIterationCount(-1)).toBe(0);
    expect(validateIterationCount(-100)).toBe(0);
    expect(validateIterationCount(1.4)).toBe(1);
    expect(validateIterationCount(1.6)).toBe(2);
    expect(validateIterationCount(0)).toBe(0);
    expect(validateIterationCount(3)).toBe(3);
  });

  it('iteration_count=0 yields first_pass=true and tier 100% (ITER-02)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-iter0-${Date.now()}`);
    const runId = `test-iter0-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
      iteration_count: 0,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.iteration_count).toBe(0);
    expect(written.first_pass).toBe(true);
    expect(written.tier_coefficient).toBe(1);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes to jsonl when writeMode is jsonl', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e3s3-jsonl-${Date.now()}`);
    const runId = `test-jsonl-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: tempDir,
    });

    const jsonlPath = path.join(tempDir, 'scores.jsonl');
    expect(fs.existsSync(jsonlPath)).toBe(true);
    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const written = JSON.parse(lines[lines.length - 1]);
    expect(written.run_id).toBe(runId);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
