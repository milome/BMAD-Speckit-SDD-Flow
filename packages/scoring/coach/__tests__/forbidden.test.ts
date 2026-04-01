import { describe, it, expect } from 'vitest';
import { loadForbiddenWords, validateForbiddenWords } from '../forbidden';

describe('forbidden words validation', () => {
  it('loads dominant and ambiguous terms from default yaml config', () => {
    const words = loadForbiddenWords();
    expect(words.dominant_terms).toContain('面试');
    expect(words.ambiguous_terms).toContain('可选');
  });

  it('rejects dominant interview-oriented terms', () => {
    const words = loadForbiddenWords();
    const out = validateForbiddenWords('本轮建议优先准备面试表达。', words);
    expect(out.passed).toBe(false);
    expect(out.violations).toContain('面试');
  });

  it('warns on ambiguous terms without hard rejection', () => {
    const words = loadForbiddenWords();
    const out = validateForbiddenWords('可选先做测试，然后视情况收敛。', words);
    expect(out.passed).toBe(true);
    expect(out.warnings).toContain('可选');
    expect(out.warnings).toContain('视情况');
  });

  it('warns on English ambiguous terms (TB.5 scheme 2)', () => {
    const words = loadForbiddenWords();
    const out = validateForbiddenWords('We can do TBD later, maybe optional.', words);
    expect(out.passed).toBe(true);
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});

