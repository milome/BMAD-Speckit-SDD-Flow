/**
 * Story 3.3 T5.1: parseAndWriteScore 集成测试
 * 覆盖 prd/arch/story 三类报告，content 与 reportPath 输入
 * T4.3: AC-B05-7 parseAuditReport/parseAndWriteScore 经 LLM fallback 的 E2E
 */
import { describe, it, expect, vi } from 'vitest';
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
  }, 40000);

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
  }, 40000);

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

  it('content_hash is deterministic for same content (GAP-B01)', { timeout: 15000 }, async () => {
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

  it('T1: stage=implement + artifactDocPath=tasks path → source_path=reportPath', async () => {
    const reportPath = path.join(FIXTURES, 'sample-prd-report.md');
    const tasksPath = 'specs/epic-9/story-2-slug/tasks-E9-S2.md';
    const tempDir = path.join(os.tmpdir(), `scoring-t1-tasks-${Date.now()}`);
    const runId = `test-t1-tasks-${Date.now()}`;

    await parseAndWriteScore({
      reportPath,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      artifactDocPath: tasksPath,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const expectedReportPath = path.isAbsolute(reportPath)
      ? reportPath
      : path.resolve(process.cwd(), reportPath);
    expect(written.source_path).toBe(expectedReportPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('T1: stage=implement + artifactDocPath=BUGFIX path → source_path=artifactDocPath', async () => {
    const reportPath = path.join(FIXTURES, 'sample-prd-report.md');
    const bugfixPath = '_bmad-output/implementation-artifacts/_orphan/BUGFIX_xxx.md';
    const tempDir = path.join(os.tmpdir(), `scoring-t1-bugfix-${Date.now()}`);
    const runId = `test-t1-bugfix-${Date.now()}`;

    await parseAndWriteScore({
      reportPath,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      artifactDocPath: bugfixPath,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.source_path).toBe(bugfixPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('T1: stage=implement + artifactDocPath not passed → no source_path', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-t1-noart-${Date.now()}`);
    const runId = `test-t1-noart-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.source_path).toBeUndefined();
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

  it('T5: parses stage=tasks checklist-style report (table+conclusion+parseable block)', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-tasks-report-checklist-style.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-tasks-checklist-${Date.now()}`);
    const runId = `test-tasks-checklist-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'tasks',
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
    expect(written.stage).toBe('tasks');
    expect(written.phase_score).toBeDefined();
    expect(typeof written.phase_score).toBe('number');
    expect(written.dimension_scores).toBeInstanceOf(Array);
    expect(written.dimension_scores.length).toBe(4);
    const dimNames = (written.dimension_scores as Array<{ dimension: string; score: number }>).map((d) => d.dimension);
    expect(dimNames).toContain('需求完整性');
    expect(dimNames).toContain('可测试性');
    expect(dimNames).toContain('一致性');
    expect(dimNames).toContain('可追溯性');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses stage=tasks 逐条对照 report with table+conclusion+parseable block (T5)', async () => {
    const content = fs.readFileSync(
      path.join(FIXTURES, 'sample-tasks-report-逐条对照.md'),
      'utf-8'
    );
    const tempDir = path.join(os.tmpdir(), `scoring-tasks-逐条-${Date.now()}`);
    const runId = `test-tasks-逐条-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'tasks',
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
    expect(written.stage).toBe('tasks');
    expect(written.phase_score).toBeDefined();
    expect(written.dimension_scores).toBeInstanceOf(Array);
    expect(written.dimension_scores.length).toBe(4);
    expect(written.phase_score).toBeGreaterThan(0);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('E9-S1 T4/T4b: writes trigger_stage when triggerStage option is passed', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e9s1-trigger-${Date.now()}`);
    const runId = `test-trigger-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'tasks',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
      triggerStage: 'speckit_5_2',
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(runId);
    expect(written.stage).toBe('tasks');
    expect(written.trigger_stage).toBe('speckit_5_2');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Story 9.4: iterationReportPaths 2 fail + 1 pass → 3 iteration_records', async () => {
    const tempDir = path.join(os.tmpdir(), `scoring-e9s4-iter-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const fail1 = path.join(tempDir, 'AUDIT_spec-E9-S4_round1.md');
    const fail2 = path.join(tempDir, 'AUDIT_spec-E9-S4_round2.md');
    const passContent = fs.readFileSync(path.join(FIXTURES, 'sample-spec-report.md'), 'utf-8');
    fs.writeFileSync(fail1, `Spec 审计 round1\n总体评级: C\n维度评分:\n- 需求完整性: 60/100\n问题清单:\n1. [严重程度:高] 遗漏需求`);
    fs.writeFileSync(fail2, `Spec 审计 round2\n总体评级: B\n维度评分:\n- 需求完整性: 75/100\n问题清单:\n1. [严重程度:中] 描述不清`);
    const passPath = path.join(tempDir, 'AUDIT_spec-E9-S4_pass.md');
    fs.writeFileSync(passPath, passContent);
    const runId = `test-iter-e9s4-${Date.now()}`;

    await parseAndWriteScore({
      reportPath: passPath,
      stage: 'spec',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
      iterationReportPaths: [fail1, fail2],
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.iteration_records).toHaveLength(3);
    expect(written.iteration_records[0].result).toBe('fail');
    expect(written.iteration_records[0].overall_grade).toBe('C');
    expect(written.iteration_records[1].result).toBe('fail');
    expect(written.iteration_records[1].overall_grade).toBe('B');
    expect(written.iteration_records[2].result).toBe('pass');
    expect(written.iteration_records[2].overall_grade).toBe('B');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Story 9.4: iteration_records empty when iterationReportPaths not passed', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-e9s4-noiter-${Date.now()}`);
    const runId = `test-noiter-${Date.now()}`;
    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });
    const written = JSON.parse(fs.readFileSync(path.join(tempDir, `${runId}.json`), 'utf-8'));
    expect(written.iteration_records).toEqual([]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Story 9.4: iteration_records empty when scenario=eval_question even with iterationReportPaths', async () => {
    const tempDir = path.join(os.tmpdir(), `scoring-e9s4-eval-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const fail1 = path.join(tempDir, 'round1.md');
    fs.writeFileSync(fail1, `总体评级: C\n问题清单:\n1. [严重程度:高] x`);
    const passContent = fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8');
    const passPath = path.join(tempDir, 'pass.md');
    fs.writeFileSync(passPath, passContent);
    const runId = `test-eval-iter-${Date.now()}`;

    await parseAndWriteScore({
      reportPath: passPath,
      stage: 'story',
      runId,
      scenario: 'eval_question',
      question_version: 'v1',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
      iterationReportPaths: [fail1],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tempDir, `${runId}.json`), 'utf-8'));
    expect(written.iteration_records).toEqual([]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('T1: stage=implement + artifactDocPath=tasks path → source_path=reportPath', async () => {
    const reportPath = path.join(FIXTURES, 'sample-prd-report.md');
    const tempDir = path.join(os.tmpdir(), `scoring-t1-tasks-${Date.now()}`);
    const runId = `test-t1-tasks-${Date.now()}`;

    await parseAndWriteScore({
      reportPath,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      artifactDocPath: 'specs/epic-9/story-2-xxx/tasks-E9-S2.md',
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const expectedReportPath = path.isAbsolute(reportPath)
      ? reportPath
      : path.resolve(process.cwd(), reportPath);
    expect(written.source_path).toBe(expectedReportPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('T1: stage=implement + artifactDocPath=BUGFIX path → source_path=artifactDocPath', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-t1-bugfix-${Date.now()}`);
    const runId = `test-t1-bugfix-${Date.now()}`;
    const bugfixPath = '_bmad-output/implementation-artifacts/_orphan/BUGFIX_xxx.md';

    await parseAndWriteScore({
      content,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      artifactDocPath: bugfixPath,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.source_path).toBe(bugfixPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('T1: stage=implement + artifactDocPath not provided → no source_path', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const tempDir = path.join(os.tmpdir(), `scoring-t1-no-artifact-${Date.now()}`);
    const runId = `test-t1-no-artifact-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'implement',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.source_path).toBeUndefined();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('BUGFIX_overall-grade: outputs WARN when Overall Grade has forbidden modifier (English B+)', async () => {
    const content = `Implement audit
Overall Grade: B+

Dimension scores:
- Functionality: 85/100
`;
    const tempDir = path.join(os.tmpdir(), `scoring-forbidden-mod-en-${Date.now()}`);
    const runId = `test-forbidden-mod-en-${Date.now()}`;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await parseAndWriteScore({
        content,
        stage: 'implement',
        runId,
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      const errCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(errCalls.includes('WARN') && (errCalls.includes('B+') || errCalls.includes('forbidden'))).toBe(true);
    } finally {
      consoleSpy.mockRestore();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('BUGFIX_overall-grade: outputs WARN to stderr when report contains forbidden overall_grade modifier (e.g. B+)', async () => {
    const content = `Implement 审计报告
总体评级: B+

维度评分:
- 功能性: 85/100
- 代码质量: 82/100
- 测试覆盖: 78/100
- 安全性: 90/100
`;
    const tempDir = path.join(os.tmpdir(), `scoring-forbidden-mod-${Date.now()}`);
    const runId = `test-forbidden-mod-${Date.now()}`;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await parseAndWriteScore({
        content,
        stage: 'implement',
        runId,
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      const errCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(
        errCalls.includes('WARN') &&
          (errCalls.includes('B+') || errCalls.includes('forbidden') || errCalls.includes('modifier'))
      ).toBe(true);
    } finally {
      consoleSpy.mockRestore();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('writes to jsonl when writeMode is jsonl', { timeout: 15000 }, async () => {
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

  it('writes journey_contract_signals derived from dedicated journey contract check_items (Wave 1B)', async () => {
    const content = `
总体评级: C

问题清单:
1. [严重程度:高] Journey Slice J-1 缺少 smoke task chain，无法证明至少一条 smoke path task chain 已落到任务
2. [严重程度:中] Journey Slice J-1 缺少 closure note task，无法形成 closure note task
3. [严重程度:中] setup/foundation 任务只带 Journey ID，但未显式说明 unlocks 哪条 journey / smoke path
4. [严重程度:中] Journey Slice 生成规则把 definition gap 和 implementation gap 混在一起，未保持 gap split contract
5. [严重程度:低] multi-agent 模式只要求共享 trace map，未要求共享同一份 journey ledger / invariant ledger / trace map 的路径引用

通过标准:
待修复
`;
    const tempDir = path.join(os.tmpdir(), `scoring-journey-signals-${Date.now()}`);
    const runId = `test-journey-signals-${Date.now()}`;

    await parseAndWriteScore({
      content,
      stage: 'tasks',
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
      skipAutoHash: true,
    });

    const filePath = path.join(tempDir, `${runId}.json`);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.journey_contract_signals).toEqual({
      smoke_task_chain: true,
      closure_task_id: true,
      journey_unlock: true,
      gap_split_contract: true,
      shared_path_reference: true,
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
