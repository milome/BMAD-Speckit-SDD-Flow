/**
 * 六环节权重（需求 §3.2）
 * 环节 1: 20, 2: 25, 3: 25, 4: 15, 5: 10, 6: 5
 */
export const PHASE_WEIGHTS: readonly number[] = [0.2, 0.25, 0.25, 0.15, 0.1, 0.05];

/** Story 5.2 B03: spec/plan/tasks 三阶段固定权重 */
export const PHASE_WEIGHTS_SPEC = 0.2;
export const PHASE_WEIGHTS_PLAN = 0.2;
export const PHASE_WEIGHTS_TASKS = 0.2;

/** Story 9.2: implement 环节 2 权重 25% */
export const PHASE_WEIGHT_IMPLEMENT = 0.25;

/**
 * 各环节满分
 */
export const PHASE_MAX_SCORES: readonly number[] = [20, 25, 25, 15, 10, 5];

/**
 * L1–L5 等级与得分区间（需求 §3.2）
 * L5: 90–100, L4: 80–89, L3: 60–79, L2: 40–59, L1: 0–39
 * 边界值归属高等级（如 90 归属 L5）
 */
export const LEVEL_RANGES: ReadonlyArray<{ min: number; max: number; level: string }> = [
  { min: 90, max: 100, level: 'L5' },
  { min: 80, max: 89, level: 'L4' },
  { min: 60, max: 79, level: 'L3' },
  { min: 40, max: 59, level: 'L2' },
  { min: 0, max: 39, level: 'L1' },
] as const;
