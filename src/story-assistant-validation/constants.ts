/**
 * Story Assistant Validation - Constants
 * @module constants
 */

/**
 * Required sections in a story document
 */
export const REQUIRED_SECTIONS = [
  '元信息',
  '背景与目标',
  '需求描述',
  '验收标准',
  '技术约束',
  '依赖清单',
  '风险标记',
  '产出物',
  '关联信息',
];

/**
 * Required metadata fields
 */
export const REQUIRED_METADATA_FIELDS = [
  'Epic',
  'Story',
  'Epic标识',
  'Story标识',
  '状态',
  '创建时间',
];

/**
 * Prohibited words that should not appear in story documents
 */
export const PROHIBITED_WORDS = [
  '可能',
  '也许',
  '大概',
  '差不多',
  '考虑一下',
  '看一下',
  '研究一下',
  '待定',
  'TBD',
  'tbd',
  '稍后',
  '以后',
  '未来',
  '预留',
  '占位',
  '暂时',
  '临时',
  '简易',
  '简单处理',
  '粗略',
  '随便',
];

/**
 * Valid state transitions for the story state machine
 */
export const VALID_STATE_TRANSITIONS: Array<{ from: string; to: string }> = [
  { from: 'story-created', to: 'audit-passed' },
  { from: 'audit-passed', to: 'ready-for-dev' },
  { from: 'ready-for-dev', to: 'dev-completed' },
  { from: 'dev-completed', to: 'post-audit-passed' },
];

/**
 * All valid story states
 */
export const VALID_STATES = [
  'story-created',
  'audit-passed',
  'ready-for-dev',
  'dev-completed',
  'post-audit-passed',
];

/**
 * Required handoff fields
 */
export const REQUIRED_HANDOFF_FIELDS = [
  'layer',
  'stage',
  'artifactPath',
  'nextAction',
  'nextAgent',
];

/**
 * Stage to next agent mapping for validation
 */
export const STAGE_AGENT_MAP: Record<string, string> = {
  'layer-4': 'speckit-implement',
  'layer-3': 'speckit-specify',
  'layer-2': 'speckit-plan',
  'layer-1': 'speckit-clarify',
  'story-audit': 'story-auditor',
  'post-audit': 'story-auditor',
};

/**
 * Default output base path
 */
export const DEFAULT_OUTPUT_BASE_PATH = '_bmad-output/implementation-artifacts';

/**
 * Scoring dimensions for audit validation
 */
export const SCORING_DIMENSIONS = [
  'clarity',
  'completeness',
  'consistency',
  'testability',
  'feasibility',
];

/**
 * Minimum scores required
 */
export const MINIMUM_SCORES = {
  clarity: 7,
  completeness: 7,
  consistency: 6,
  testability: 6,
  feasibility: 7,
};

/**
 * Grade thresholds
 */
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
};
