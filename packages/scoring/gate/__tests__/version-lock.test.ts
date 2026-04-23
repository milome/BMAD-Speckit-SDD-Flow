import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { checkPreconditionHash, loadLatestRecordByStage } from '../version-lock';

const TMP = path.join(process.cwd(), 'packages', 'scoring', 'data', 'e5s1-tmp-version-lock');

describe('version-lock', () => {
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

  it('hash 匹配 → { passed: true, action: proceed }', () => {
    const f = path.join(TMP, 'spec.md');
    fs.writeFileSync(f, 'hello', 'utf-8');
    const expected = crypto.createHash('sha256').update('hello', 'utf-8').digest('hex');
    const r = checkPreconditionHash('plan', f, expected);
    expect(r.passed).toBe(true);
    expect(r.action).toBe('proceed');
  });

  it('hash 不匹配 → { passed: false, action: block }', () => {
    const f = path.join(TMP, 'spec.md');
    fs.writeFileSync(f, 'hello', 'utf-8');
    const r = checkPreconditionHash('plan', f, 'wrong_hash_value');
    expect(r.passed).toBe(false);
    expect(r.action).toBe('block');
    expect(r.reason).toBe('hash mismatch');
  });

  it('源文件不存在 → { passed: false, action: block, reason: file not found }', () => {
    const r = checkPreconditionHash('plan', path.join(TMP, 'nonexistent.md'), 'abc123');
    expect(r.passed).toBe(false);
    expect(r.action).toBe('block');
    expect(r.reason).toContain('file not found');
  });

  it('上一阶段无记录（expectedHash 空）→ { passed: true, action: warn_and_proceed }', () => {
    const f = path.join(TMP, 'spec.md');
    fs.writeFileSync(f, 'x', 'utf-8');
    const r = checkPreconditionHash('plan', f, '');
    expect(r.passed).toBe(true);
    expect(r.action).toBe('warn_and_proceed');
    expect(r.reason).toBe('no prior record');
  });

  it('loadLatestRecordByStage 多条同 stage 按 timestamp 取最新', () => {
    const r1 = {
      run_id: 'a',
      scenario: 'real_dev' as const,
      stage: 'spec',
      phase_score: 80,
      phase_weight: 0.2,
      check_items: [],
      timestamp: '2026-03-05T10:00:00Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    const r2 = { ...r1, run_id: 'b', timestamp: '2026-03-05T12:00:00Z' };
    fs.writeFileSync(path.join(TMP, 'a.json'), JSON.stringify(r1), 'utf-8');
    fs.writeFileSync(path.join(TMP, 'b.json'), JSON.stringify(r2), 'utf-8');
    const latest = loadLatestRecordByStage('spec', TMP);
    expect(latest?.run_id).toBe('b');
  });

  it('loadLatestRecordByStage 按 source_path 过滤同 stage 记录', () => {
    const base = {
      scenario: 'real_dev' as const,
      stage: 'story',
      phase_score: 80,
      phase_weight: 0.2,
      check_items: [],
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    const storyA = path.join(TMP, 'story-a.md').replace(/\\/g, '/');
    const storyB = path.join(TMP, 'story-b.md').replace(/\\/g, '/');
    const r1 = { ...base, run_id: 'story-a-old', timestamp: '2026-03-05T10:00:00Z', source_path: storyA };
    const r2 = { ...base, run_id: 'story-b-new', timestamp: '2026-03-05T12:00:00Z', source_path: storyB };
    const r3 = { ...base, run_id: 'story-a-new', timestamp: '2026-03-05T13:00:00Z', source_path: storyA };
    fs.writeFileSync(path.join(TMP, 'a-old.json'), JSON.stringify(r1), 'utf-8');
    fs.writeFileSync(path.join(TMP, 'b-new.json'), JSON.stringify(r2), 'utf-8');
    fs.writeFileSync(path.join(TMP, 'a-new.json'), JSON.stringify(r3), 'utf-8');

    const latest = loadLatestRecordByStage('story', TMP, storyA);
    expect(latest?.run_id).toBe('story-a-new');
  });

  it('loadLatestRecordByStage dataPath 不可读 → 函数内部异常 → warn_and_proceed 场景由调用方处理', () => {
    const latest = loadLatestRecordByStage('spec', path.join(TMP, 'nonexistent_dir'));
    expect(latest).toBeNull();
  });

  it('集成：loadLatestRecordByStage + checkPreconditionHash 联动', () => {
    const specContent = 'spec content';
    const f = path.join(TMP, 'spec.md');
    fs.writeFileSync(f, specContent, 'utf-8');
    const hash = crypto.createHash('sha256').update(specContent, 'utf-8').digest('hex');
    const record = {
      run_id: 'run-1',
      scenario: 'real_dev' as const,
      stage: 'spec',
      phase_score: 80,
      phase_weight: 0.2,
      check_items: [],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      source_hash: hash,
    };
    fs.writeFileSync(path.join(TMP, 'run-1.json'), JSON.stringify(record), 'utf-8');
    const prior = loadLatestRecordByStage('spec', TMP);
    expect(prior?.source_hash).toBe(hash);
    const lockResult = checkPreconditionHash('plan', f, prior?.source_hash ?? null);
    expect(lockResult.passed).toBe(true);
    expect(lockResult.action).toBe('proceed');
  });
});
