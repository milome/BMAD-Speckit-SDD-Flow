import { describe, it, expect } from 'vitest';
import { BMAD_LAYER_TO_STAGES, ALL_STAGES } from '../constants/table-a';
import { STAGE_TO_PHASE } from '../constants/table-b';

describe('constants', () => {
  it('AC-4.1: 表 A 完整', () => {
    expect(Object.keys(BMAD_LAYER_TO_STAGES).length).toBe(5);
    expect(ALL_STAGES).toContain('prd');
    expect(ALL_STAGES).toContain('pr_review');
  });

  it('AC-4.2: 表 B 完整，含 gaps', () => {
    expect(STAGE_TO_PHASE.gaps).toBeDefined();
    expect(STAGE_TO_PHASE.implement).toEqual([2, 3, 4, 5, 6]);
  });

  it('table-b 中所有 stage 均在 table-a 下', () => {
    const allStagesFromA = Object.values(BMAD_LAYER_TO_STAGES).flat();
    for (const stage of Object.keys(STAGE_TO_PHASE)) {
      expect(allStagesFromA).toContain(stage);
    }
  });
});
