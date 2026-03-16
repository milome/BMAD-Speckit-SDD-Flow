import { describe, it, expect } from 'vitest';
import { STAGE_TO_PHASE } from '../../constants/table-b';
import { computeCompositeScore } from '../../core/calculator';

describe('integration: table-calculator', () => {
  it('table-b 中 implement 对应环节 2-6，可参与计算', () => {
    const phases = STAGE_TO_PHASE.implement as number[];
    expect(phases).toContain(2);
    expect(phases).toContain(6);

    const phaseScores = [20, 25, 25, 15, 10, 5];
    const score = computeCompositeScore(phaseScores);
    expect(score).toBe(100);
  });
});
