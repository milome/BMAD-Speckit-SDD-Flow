/**
 * Story 3.3 T5.1: parseAndWriteScore 集成测试
 * 覆盖 prd/arch/story 三类报告，content 与 reportPath 输入
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseAndWriteScore } from '../parse-and-write';

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
