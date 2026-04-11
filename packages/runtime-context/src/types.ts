/**
 * Minimal runtime types for context files (aligned with scripts/runtime-governance + bmad-config StageName).
 */
export type RuntimeFlowId = 'story' | 'bugfix' | 'standalone_tasks' | 'epic' | 'unknown';

export type RuntimeSourceMode = 'full_bmad' | 'seeded_solutioning' | 'standalone_story';

export type ContextMaturity = 'minimal' | 'seeded' | 'full' | 'unclassified';

export interface ContextMaturityEvidence {
  artifactComplete?: boolean;
  fourSignalsComplete?: boolean;
  executionSpecific?: boolean;
  governanceHealthy?: boolean;
  runtimeScopeComplete?: boolean;
  followUpBudgetExhausted?: boolean;
}

export type StageName =
  | 'prd'
  | 'arch'
  | 'epics'
  | 'story_create'
  | 'story_audit'
  | 'specify'
  | 'plan'
  | 'gaps'
  | 'tasks'
  | 'implement'
  | 'post_audit'
  | 'epic_create'
  | 'epic_complete';
