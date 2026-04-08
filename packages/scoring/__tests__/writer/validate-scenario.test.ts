/**
 * Story 4.3 T1.2: validateScenarioConstraints 单测
 * [TDD-RED] 先编写断言，实现后 [TDD-GREEN]
 */
import { describe, it, expect } from 'vitest';
import { validateScenarioConstraints } from '../../writer/validate';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'test-1',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 20,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-05T12:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('validateScenarioConstraints', () => {
  it('eval_question + question_version 为空 → 抛错', () => {
    const record = makeRecord({
      scenario: 'eval_question',
      question_version: undefined,
    });
    expect(() => validateScenarioConstraints(record)).toThrow(/question_version.*必填|required/i);
  });

  it('eval_question + question_version 空字符串 → 抛错', () => {
    const record = makeRecord({
      scenario: 'eval_question',
      question_version: '',
    });
    expect(() => validateScenarioConstraints(record)).toThrow(/question_version.*必填|required/i);
  });

  it('eval_question + question_version 仅有空格 → 抛错', () => {
    const record = makeRecord({
      scenario: 'eval_question',
      question_version: '   ',
    });
    expect(() => validateScenarioConstraints(record)).toThrow(/question_version.*必填|required/i);
  });

  it('eval_question + question_version 有值 → 不抛错', () => {
    const record = makeRecord({
      scenario: 'eval_question',
      question_version: 'v1.0',
    });
    expect(() => validateScenarioConstraints(record)).not.toThrow();
  });

  it('real_dev + question_version 可空 → 不抛错', () => {
    const record = makeRecord({
      scenario: 'real_dev',
      question_version: undefined,
    });
    expect(() => validateScenarioConstraints(record)).not.toThrow();
  });

  it('scenario 非法值 → 抛错', () => {
    const record = makeRecord({}) as RunScoreRecord & { scenario: string };
    (record as { scenario: string }).scenario = 'invalid';
    expect(() => validateScenarioConstraints(record as RunScoreRecord)).toThrow();
  });
});
