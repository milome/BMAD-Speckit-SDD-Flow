/**
 * 表 A：BMAD Layer → 阶段列表（需求 §2.1、spec §5）
 */
export const BMAD_LAYER_TO_STAGES: Record<string, readonly string[]> = {
  'Layer 1 产品定义层': ['prd', 'arch'],
  'Layer 2 Epic/Story 规划层': ['epics'],
  'Layer 3 Story 开发层': ['story'],
  'Layer 4 技术实现层': ['specify', 'plan', 'gaps', 'tasks', 'implement'],
  'Layer 5 收尾层': ['post_impl', 'pr_review'],
} as const;

export const ALL_STAGES: readonly string[] = [
  'prd', 'arch', 'epics', 'story', 'specify', 'plan', 'gaps', 'tasks', 'implement', 'post_impl', 'pr_review',
] as const;
