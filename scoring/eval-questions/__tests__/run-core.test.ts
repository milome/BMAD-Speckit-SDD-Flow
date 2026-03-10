/**
 * Story 8.3: run 核心逻辑单元测试
 */
import { describe, it, expect } from 'vitest';
import { generateEvalRunId, validateQuestionVersionForEval } from '../run-core';

describe('run-core', () => {
  describe('generateEvalRunId', () => {
    it('生成格式符合 eval-{id}-{version}-{timestamp}', () => {
      const id = 'q001';
      const version = 'v1';
      const ts = 1730812345678;
      const runId = generateEvalRunId(id, version, ts);
      expect(runId).toBe('eval-q001-v1-1730812345678');
    });

    it('无 timestamp 时使用 Date.now()', () => {
      const before = Date.now();
      const runId = generateEvalRunId('q002', 'v2');
      const after = Date.now();
      const match = runId.match(/^eval-q002-v2-(\d+)$/);
      expect(match).toBeTruthy();
      const ts = parseInt(match![1], 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('validateQuestionVersionForEval', () => {
    it('scenario=eval_question 且 question_version 缺失时 throw', () => {
      expect(() => validateQuestionVersionForEval('eval_question', undefined)).toThrow(
        /question_version.*必填.*eval_question/
      );
    });

    it('scenario=eval_question 且 question_version 为空字符串时 throw', () => {
      expect(() => validateQuestionVersionForEval('eval_question', '')).toThrow(
        /question_version.*必填/
      );
      expect(() => validateQuestionVersionForEval('eval_question', '   ')).toThrow(
        /question_version.*必填/
      );
    });

    it('scenario=eval_question 且 question_version 有效时不 throw', () => {
      expect(() => validateQuestionVersionForEval('eval_question', 'v1')).not.toThrow();
      expect(() => validateQuestionVersionForEval('eval_question', 'v2')).not.toThrow();
    });

    it('scenario=real_dev 时不校验 question_version', () => {
      expect(() => validateQuestionVersionForEval('real_dev', undefined)).not.toThrow();
      expect(() => validateQuestionVersionForEval('real_dev', '')).not.toThrow();
    });
  });
});
