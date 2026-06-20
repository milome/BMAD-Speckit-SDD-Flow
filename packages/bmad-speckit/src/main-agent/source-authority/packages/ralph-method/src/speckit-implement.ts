import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveRalphTrackingPaths } from './pathing';
import type {
  RalphTddPhase,
  RalphTrackingPaths,
  RalphTrackingWriteResult,
  RalphUserStory,
  RalphVerifierResult,
} from './types';
import { verifyRalphCompliance } from './verify-ralph-compliance';
import { createRalphTrackingFiles, recordTddPhaseTrace } from './write-tracking-files';

export interface SpeckitImplementRalphInput {
  projectRoot?: string;
  tasksPath: string;
  mode?: string;
  epic?: string;
  story?: string;
  epicSlug?: string;
  storySlug?: string;
  branchName: string;
  taskDescription?: string;
  overwrite?: boolean;
}

export interface SpeckitImplementRalphPreparation extends RalphTrackingWriteResult {
  verifyCommand: string;
}

export interface SpeckitImplementRalphVerification {
  paths: RalphTrackingPaths;
  result: RalphVerifierResult;
}

export interface SpeckitImplementRalphPhaseInput {
  projectRoot?: string;
  tasksPath: string;
  mode?: string;
  epic?: string;
  story?: string;
  epicSlug?: string;
  storySlug?: string;
  userStoryId: string;
  title: string;
  phase: RalphTddPhase;
  detail: string;
  storyLogTimestamp?: Date | string;
}

export interface SpeckitImplementRalphPhaseResult {
  paths: RalphTrackingPaths;
  progress: string;
}

export const RALPH_SCRIPT_ENFORCED_SUBSET = [
  'create/prepare tracking files',
  'record TDD-RED/TDD-GREEN/TDD-REFACTOR phase traces',
  'final compliance verification',
] as const;

const TASK_LINE_PATTERN = /^\s*-\s*\[(?<checked>[ xX])\]\s+(?<body>.+?)\s*$/u;
const TASK_ID_PATTERN = /\bT\d+(?:\.\d+)?\b/u;
const NON_PRODUCTION_HINT_PATTERN =
  /\b(doc|docs|documentation|readme|\.md\b|audit|review|lint|verify|verification|checklist|handoff|comment|comments|changelog)\b/iu;

function normalizeString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveProjectRoot(projectRoot?: string): string {
  return path.resolve(projectRoot ?? process.cwd());
}

function resolveTasksPath(projectRoot: string, tasksPath: string): string {
  return path.isAbsolute(tasksPath) ? path.resolve(tasksPath) : path.resolve(projectRoot, tasksPath);
}

function resolveTrackingBaseDir(
  projectRoot: string,
  input: Pick<SpeckitImplementRalphInput, 'mode' | 'epic' | 'story' | 'epicSlug' | 'storySlug'>,
  tasksPath: string
): string {
  if (normalizeString(input.mode) !== 'bmad') {
    return path.dirname(tasksPath);
  }

  const epic = normalizeString(input.epic);
  const story = normalizeString(input.story);
  const epicSlug = normalizeString(input.epicSlug);
  const storySlug = normalizeString(input.storySlug);

  if (!epic || !story || !epicSlug || !storySlug) {
    return path.dirname(tasksPath);
  }

  return path.join(
    projectRoot,
    '_bmad-output',
    'implementation-artifacts',
    `epic-${epic}-${epicSlug}`,
    `story-${story}-${storySlug}`
  );
}

function buildReferenceDocumentPath(baseDir: string, tasksPath: string): string {
  return path.join(baseDir, path.basename(tasksPath));
}

function inferProductionCode(taskBody: string): boolean {
  return !NON_PRODUCTION_HINT_PATTERN.test(taskBody);
}

function createPendingTddSteps(involvesProductionCode: boolean): RalphUserStory['tddSteps'] {
  return involvesProductionCode
    ? [
        { phase: 'TDD-RED', passes: false },
        { phase: 'TDD-GREEN', passes: false },
        { phase: 'TDD-REFACTOR', passes: false },
      ]
    : [{ phase: 'DONE', passes: false }];
}

export function parseSpeckitTasksToUserStories(tasksContent: string): RalphUserStory[] {
  const userStories = tasksContent
    .split(/\r?\n/u)
    .map((line) => line.match(TASK_LINE_PATTERN))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      checked: match.groups?.checked?.toLowerCase() === 'x',
      body: match.groups?.body?.trim() ?? '',
    }))
    .filter(({ body }) => TASK_ID_PATTERN.test(body))
    .map(({ checked, body }, index) => {
      const involvesProductionCode = inferProductionCode(body);
      return {
        id: `US-${String(index + 1).padStart(3, '0')}`,
        title: body,
        description: body,
        acceptanceCriteria: [body],
        priority: index + 1,
        passes: checked,
        notes: `Source task checkbox: ${checked ? '[x]' : '[ ]'}`,
        involvesProductionCode,
        tddSteps: createPendingTddSteps(involvesProductionCode),
      } as RalphUserStory;
    });

  if (userStories.length === 0) {
    throw new Error('No actionable checklist tasks were found in tasks.md for Ralph tracking');
  }

  return userStories;
}

export function buildSpeckitImplementVerifyCommand(
  input: Pick<
    SpeckitImplementRalphInput,
    'tasksPath' | 'mode' | 'epic' | 'story' | 'epicSlug' | 'storySlug'
  >
): string {
  const args = ['ralph', 'verify', `--tasksPath "${input.tasksPath}"`];
  for (const [key, value] of Object.entries({
    mode: input.mode,
    epic: input.epic,
    story: input.story,
    epicSlug: input.epicSlug,
    storySlug: input.storySlug,
  })) {
    const normalized = normalizeString(value);
    if (normalized) {
      args.push(`--${key} "${normalized}"`);
    }
  }
  return `npx bmad-speckit ${args.join(' ')}`;
}

export function buildSpeckitImplementRecordPhaseCommand(
  input: Pick<
    SpeckitImplementRalphPhaseInput,
    | 'tasksPath'
    | 'mode'
    | 'epic'
    | 'story'
    | 'epicSlug'
    | 'storySlug'
    | 'userStoryId'
    | 'title'
    | 'phase'
    | 'detail'
    | 'storyLogTimestamp'
  >
): string {
  const args = [
    'ralph',
    'record-phase',
    `--tasksPath "${input.tasksPath}"`,
    `--userStoryId "${input.userStoryId}"`,
    `--title "${input.title}"`,
    `--phase "${input.phase}"`,
    `--detail "${input.detail}"`,
  ];
  for (const [key, value] of Object.entries({
    mode: input.mode,
    epic: input.epic,
    story: input.story,
    epicSlug: input.epicSlug,
    storySlug: input.storySlug,
    storyLogTimestamp:
      typeof input.storyLogTimestamp === 'string' ? input.storyLogTimestamp : undefined,
  })) {
    const normalized = normalizeString(value);
    if (normalized) {
      args.push(`--${key} "${normalized}"`);
    }
  }
  return `npx bmad-speckit ${args.join(' ')}`;
}

export function prepareSpeckitImplementRalphTracking(
  input: SpeckitImplementRalphInput
): SpeckitImplementRalphPreparation {
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
  const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
  const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
  const tasksContent = fs.readFileSync(tasksPath, 'utf8');
  const userStories = parseSpeckitTasksToUserStories(tasksContent);
  const stem = path.basename(tasksPath, path.extname(tasksPath));
  const taskDescription =
    normalizeString(input.taskDescription) ?? `Execute speckit implement tasks from ${stem}`;
  const result = createRalphTrackingFiles({
    projectRoot,
    tasksPath,
    referenceDocumentPath,
    branchName: input.branchName,
    taskDescription,
    userStories,
    overwrite: input.overwrite,
  });

  return {
    ...result,
    verifyCommand: buildSpeckitImplementVerifyCommand({
      tasksPath: input.tasksPath,
      mode: input.mode,
      epic: input.epic,
      story: input.story,
      epicSlug: input.epicSlug,
      storySlug: input.storySlug,
    }),
  };
}

export function verifySpeckitImplementRalphTracking(
  input: Omit<SpeckitImplementRalphInput, 'branchName'>
): SpeckitImplementRalphVerification {
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
  const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
  const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
  const paths = resolveRalphTrackingPaths({
    projectRoot,
    tasksPath,
    referenceDocumentPath,
  });

  return {
    paths,
    result: verifyRalphCompliance({
      prdPath: paths.prdPath,
      progressPath: paths.progressPath,
    }),
  };
}

export function recordSpeckitImplementRalphPhase(
  input: SpeckitImplementRalphPhaseInput
): SpeckitImplementRalphPhaseResult {
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
  const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
  const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
  const paths = resolveRalphTrackingPaths({
    projectRoot,
    tasksPath,
    referenceDocumentPath,
  });

  return {
    paths,
    progress: recordTddPhaseTrace({
      progressPath: paths.progressPath,
      userStoryId: input.userStoryId,
      title: input.title,
      phase: input.phase,
      detail: input.detail,
      storyLogTimestamp: input.storyLogTimestamp,
    }),
  };
}
