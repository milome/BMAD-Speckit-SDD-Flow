export const RALPH_PRD_SCHEMA_VERSION = 'ralph_prd_v2' as const;

export const RALPH_TDD_PHASES = ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR', 'DONE'] as const;
export type RalphTddPhase = (typeof RALPH_TDD_PHASES)[number];

export const RALPH_PRODUCTION_TDD_PHASES = ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR'] as const;
export type RalphProductionTddPhase = (typeof RALPH_PRODUCTION_TDD_PHASES)[number];

export const RALPH_NON_PRODUCTION_TDD_PHASES = ['DONE'] as const;
export type RalphNonProductionTddPhase = (typeof RALPH_NON_PRODUCTION_TDD_PHASES)[number];

export interface RalphProjectContext {
  framework?: string;
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
}

export interface RalphTddStep {
  phase: RalphTddPhase;
  passes: boolean;
  command?: string;
  note?: string;
  timestamp?: string;
}

export interface RalphUserStoryBase {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes?: string;
}

export interface RalphProductionUserStory extends RalphUserStoryBase {
  involvesProductionCode: true;
  tddSteps: [
    RalphTddStep & { phase: 'TDD-RED' },
    RalphTddStep & { phase: 'TDD-GREEN' },
    RalphTddStep & { phase: 'TDD-REFACTOR' },
  ];
}

export interface RalphNonProductionUserStory extends RalphUserStoryBase {
  involvesProductionCode: false;
  tddSteps: [RalphTddStep & { phase: 'DONE' }];
}

export type RalphUserStory = RalphProductionUserStory | RalphNonProductionUserStory;

export interface RalphPrdDocument {
  schemaVersion: typeof RALPH_PRD_SCHEMA_VERSION;
  branchName: string;
  taskDescription: string;
  projectContext: RalphProjectContext;
  userStories: RalphUserStory[];
}

export interface RalphTrackingPaths {
  baseDir: string;
  stem?: string;
  prdPath: string;
  progressPath: string;
}

export interface ResolveRalphTrackingPathsInput {
  projectRoot?: string;
  referenceDocumentPath?: string;
  tasksPath?: string;
  preferredBaseDir?: string;
}

export interface RalphProgressHeader {
  title: string;
  totalStories: number;
  currentStory: number;
  completedStories: number;
}

export interface CreateRalphTrackingFilesInput extends ResolveRalphTrackingPathsInput {
  branchName: string;
  taskDescription: string;
  projectContext?: RalphProjectContext;
  userStories: RalphUserStory[];
  overwrite?: boolean;
}

export interface RalphTrackingWriteResult {
  paths: RalphTrackingPaths;
  prdCreated: boolean;
  progressCreated: boolean;
  prd: RalphPrdDocument;
}

export interface MarkRalphUserStoryPassedInput {
  prdPath: string;
  userStoryId: string;
  passes?: boolean;
}

export interface AppendRalphTddTraceInput {
  progressPath: string;
  userStoryId: string;
  title: string;
  phases: Array<{
    phase: RalphTddPhase;
    detail: string;
  }>;
  storyLogTimestamp?: Date | string;
}

export interface RecordRalphTddPhaseInput {
  progressPath: string;
  userStoryId: string;
  title: string;
  phase: RalphTddPhase;
  detail: string;
  storyLogTimestamp?: Date | string;
}

export interface RalphStoryLogEntryInput {
  userStoryId: string;
  title: string;
  timestamp?: Date | string;
}

export type RalphVerificationStatus = 'pass' | 'fail';

export interface RalphVerifierStoryResult {
  userStoryId: string;
  checked: boolean;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface RalphVerifierSummary {
  checkedStories: number;
  passingStories: number;
  failingStories: number;
  skippedStories: number;
}

export interface RalphVerifierResult {
  status: RalphVerificationStatus;
  errors: string[];
  warnings: string[];
  userStoryResults: RalphVerifierStoryResult[];
  summary: RalphVerifierSummary;
}

export interface RalphVerifierInput {
  prdPath: string;
  progressPath: string;
}

export function expectedRalphTddPhasesForStory(
  involvesProductionCode: boolean
): readonly RalphTddPhase[] {
  return involvesProductionCode ? RALPH_PRODUCTION_TDD_PHASES : RALPH_NON_PRODUCTION_TDD_PHASES;
}

export function isProductionRalphUserStory(
  story: RalphUserStory
): story is RalphProductionUserStory {
  return story.involvesProductionCode;
}
