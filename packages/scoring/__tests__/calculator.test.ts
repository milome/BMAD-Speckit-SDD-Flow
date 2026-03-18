import { describe, it, expect } from 'vitest';
import { computeCompositeScore, aggregateFourDimensions, scoreToLevel } from '../core/calculator';

describe('calculator', () => {
  it('AC-1.1: 六环节分项评分可计算，权重 20/25/25/15/10/5', () => {
    const scores = [18, 22, 20, 12, 8, 4];
    const composite = computeCompositeScore(scores);
    expect(composite).toBeCloseTo(84, 1);
  });

  it('AC-1.2: 四能力维度聚合公式正确', () => {
    const scores = [20, 25, 25, 15, 10, 5];
    const dims = aggregateFourDimensions(scores);
    expect(dims['需求与设计能力']).toBe(20);
    expect(dims['端到端交付能力']).toBe(5);
  });

  it('AC-1.3: 综合得分 = Σ(环节得分×权重)，0–100', () => {
    const scores = [20, 25, 25, 15, 10, 5];
    const composite = computeCompositeScore(scores);
    expect(composite).toBe(100);
  });

  it('AC-1.4: L1–L5 等级与得分区间固定', () => {
    expect(scoreToLevel(95)).toBe('L5');
    expect(scoreToLevel(90)).toBe('L5');
    expect(scoreToLevel(84)).toBe('L4');
    expect(scoreToLevel(80)).toBe('L4');
    expect(scoreToLevel(70)).toBe('L3');
    expect(scoreToLevel(50)).toBe('L2');
    expect(scoreToLevel(30)).toBe('L1');
  });

  it('边界值 90 归属 L5', () => {
    expect(scoreToLevel(90)).toBe('L5');
  });
});
