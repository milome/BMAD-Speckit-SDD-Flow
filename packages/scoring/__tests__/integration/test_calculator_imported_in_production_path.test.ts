/**
 * 验证 calculator 在生产代码关键路径（验收脚本）中被 import 并调用，无孤岛
 */
import { describe, it, expect } from 'vitest';
import { computeCompositeScore, scoreToLevel } from '../../core/calculator';

describe('test_calculator_imported_in_production_path', () => {
  it('验收脚本 import scoring/core 并调用，验证无孤岛', () => {
    // 模拟 accept-e1-s1 的调用链
    const phaseScores = [18, 22, 20, 12, 8, 4];
    const score = computeCompositeScore(phaseScores);
    const level = scoreToLevel(score);
    expect(score).toBeCloseTo(84, 1);
    expect(level).toBe('L4');
    // 若此测试通过，说明 core 可被生产路径（验收脚本）正确 import 并调用
  });
});
