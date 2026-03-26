/**
 * Minimal runtime types for context files (aligned with scripts/runtime-governance + bmad-config StageName).
 */
export type RuntimeFlowId = 'story' | 'bugfix' | 'standalone_tasks' | 'epic' | 'unknown';

export type StageName =
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
