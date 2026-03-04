/**
 * 表 B：阶段 → 评分环节（需求 §2.1、spec §6）
 * gaps 双轨：前置计入环节 1 补充；后置 implement 占环节 2 的 30%、post_impl 占环节 6 的 50%
 */
export const STAGE_TO_PHASE: Record<string, number | number[]> = {
  prd: 1,
  arch: [1, 2], // 环节 1 补充、环节 2 设计侧
  epics: 0,     // 环节 1 输入依据（不单独计分）
  story: 1,     // 环节 1 补充
  specify: 1,
  plan: [1, 2], // 环节 1 补充、环节 2 设计侧
  gaps: [1, 2, 3, 4, 5, 6], // 前置环节 1；后置环节 2–6
  tasks: [2, 3, 4, 5],
  implement: [2, 3, 4, 5, 6],
  post_impl: [2, 3, 4, 5, 6],
  pr_review: 6, // 环节 6 补充（可选）
} as const;
