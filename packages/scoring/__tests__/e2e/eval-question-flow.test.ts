/**
 * B10: eval_question 场景端到端验证
 * parse → write → coach diagnose 全链路
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAndWriteScore } from '../../orchestrator';
import { coachDiagnose } from '../../coach/diagnose';

const FIXTURE = path.join(
  __dirname,
  '../../parsers/__tests__/fixtures/sample-eval-question-report.md'
);
const TMP = path.join(process.cwd(), 'packages', 'scoring', 'data', 'e5s1-e2e-eval-question');

describe('eval-question-flow E2E', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { recursive: true });
    }
    fs.mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TMP)) {
      fs.rmSync(TMP, { recursive: true });
    }
  });

  it('eval_question + question_version → 完整写入 + coach 诊断成功', async () => {
    const runId = `e2e-eval-q-${Date.now()}`;
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'eval_question',
      writeMode: 'single_file',
      dataPath: TMP,
      question_version: 'v1',
      skipAutoHash: true,
      baseCommitHash: 'a1b2c3d4',
    });
    const recordPath = path.join(TMP, `${runId}.json`);
    expect(fs.existsSync(recordPath)).toBe(true);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
    expect(record.scenario).toBe('eval_question');
    expect(record.question_version).toBe('v1');

    const result = await coachDiagnose(runId, { dataPath: TMP });
    expect('error' in result ? result.error : null).toBeNull();
    if (!('error' in result)) {
      expect(result.phase_scores).toBeDefined();
      expect(result.iteration_passed).toBeDefined();
    }
  });

  it('eval_question + writeMode=jsonl → 正确追加到 scores.jsonl', async () => {
    const runId = `e2e-eval-jsonl-${Date.now()}`;
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'eval_question',
      writeMode: 'jsonl',
      dataPath: TMP,
      question_version: 'v2',
      skipAutoHash: true,
    });
    const jsonlPath = path.join(TMP, 'scores.jsonl');
    expect(fs.existsSync(jsonlPath)).toBe(true);
    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.run_id).toBe(runId);
    expect(last.scenario).toBe('eval_question');
  });

  it('eval_question 记录的 content_hash 和 base_commit_hash 正确', async () => {
    const runId = `e2e-eval-hash-${Date.now()}`;
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    await parseAndWriteScore({
      content,
      stage: 'prd',
      runId,
      scenario: 'eval_question',
      writeMode: 'single_file',
      dataPath: TMP,
      question_version: 'v3',
      skipAutoHash: false,
      baseCommitHash: 'deadbeef',
    });
    const recordPath = path.join(TMP, `${runId}.json`);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
    expect(record.content_hash).toBeDefined();
    expect(typeof record.content_hash).toBe('string');
    expect(record.content_hash.length).toBeGreaterThan(0);
    expect(record.base_commit_hash).toBe('deadbeef');
  });
});
