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

export interface ReviewerLatestCloseoutRecord {
  updatedAt: string;
  runner: 'runAuditorHost';
  profile: string;
  stage: string;
  artifactPath: string;
  reportPath: string;
  auditStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  closeoutApproved: boolean;
  governanceClosure: {
    implementationReadinessStatusRequired: boolean;
    implementationReadinessGateName: string;
    gatesLoopRequired: boolean;
    rerunGatesRequired: boolean;
    packetExecutionClosureRequired: boolean;
  };
  closeoutEnvelope: {
    resultCode: string;
    requiredFixes: string[];
    requiredFixesDetail: Array<{ id: string; summary: string; severity: string }>;
    rerunDecision: string;
    scoringFailureMode: string;
    packetExecutionClosureStatus: string;
  };
  scoreError?: string;
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
