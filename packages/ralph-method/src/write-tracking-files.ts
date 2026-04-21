import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveRalphTrackingPaths } from './pathing';
import {
  appendRalphStoryLog,
  computeRalphProgressHeader,
  formatRalphStoryLogLine,
  hasRalphStoryLogEntry,
  renderInitialRalphProgressDocument,
  updateRalphProgressHeader,
  upsertRalphProgressPhaseLine,
  markRalphStoryStatus,
} from './progress-format';
import { assertValidRalphPrdDocument, parseRalphPrdDocument } from './schema';
import type {
  AppendRalphTddTraceInput,
  CreateRalphTrackingFilesInput,
  MarkRalphUserStoryPassedInput,
  RalphPrdDocument,
  RecordRalphTddPhaseInput,
  RalphTrackingWriteResult,
} from './types';
import { RALPH_PRD_SCHEMA_VERSION } from './types';

function atomicWriteFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  let fd = fs.openSync(tmp, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
  fd = fs.openSync(filePath, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function readRalphPrd(filePath: string): RalphPrdDocument {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  return parseRalphPrdDocument(parsed);
}

function writeRalphPrd(filePath: string, document: RalphPrdDocument): void {
  assertValidRalphPrdDocument(document);
  atomicWriteFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

function resolvePrdPathFromProgressPath(progressPath: string): string {
  return path.join(
    path.dirname(progressPath),
    path.basename(progressPath).replace(/^progress/, 'prd').replace(/\.txt$/i, '.json')
  );
}

function findUserStory(document: RalphPrdDocument, userStoryId: string) {
  const story = document.userStories.find((candidate) => candidate.id === userStoryId);
  if (!story) {
    throw new Error(`Unknown Ralph user story: ${userStoryId}`);
  }
  return story;
}

export function createRalphTrackingFiles(
  input: CreateRalphTrackingFilesInput
): RalphTrackingWriteResult {
  const paths = resolveRalphTrackingPaths(input);
  const prd: RalphPrdDocument = {
    schemaVersion: RALPH_PRD_SCHEMA_VERSION,
    branchName: input.branchName,
    taskDescription: input.taskDescription,
    projectContext: input.projectContext ?? {},
    userStories: input.userStories,
  };

  assertValidRalphPrdDocument(prd);

  let prdCreated = false;
  if (input.overwrite || !fs.existsSync(paths.prdPath)) {
    writeRalphPrd(paths.prdPath, prd);
    prdCreated = true;
  }

  let progressCreated = false;
  if (input.overwrite || !fs.existsSync(paths.progressPath)) {
    atomicWriteFile(paths.progressPath, renderInitialRalphProgressDocument(prd));
    progressCreated = true;
  }

  return {
    paths,
    prdCreated,
    progressCreated,
    prd: fs.existsSync(paths.prdPath) ? readRalphPrd(paths.prdPath) : prd,
  };
}

export function markUserStoryPassed(input: MarkRalphUserStoryPassedInput): RalphPrdDocument {
  const prd = readRalphPrd(input.prdPath);
  const story = findUserStory(prd, input.userStoryId);
  story.passes = input.passes ?? true;
  writeRalphPrd(input.prdPath, prd);
  return prd;
}

export function recomputeProgressCounters(
  prdPath: string,
  progressPath: string
): string {
  const prd = readRalphPrd(prdPath);
  const current = fs.readFileSync(progressPath, 'utf8');
  const next = updateRalphProgressHeader(current, computeRalphProgressHeader(prd));
  atomicWriteFile(progressPath, next);
  return next;
}

export function recordTddPhaseTrace(input: RecordRalphTddPhaseInput): string {
  const prdPath = resolvePrdPathFromProgressPath(input.progressPath);
  const prd = readRalphPrd(prdPath);
  const story = findUserStory(prd, input.userStoryId);

  let content = fs.readFileSync(input.progressPath, 'utf8');
  content = upsertRalphProgressPhaseLine(content, story, input.phase, input.detail);
  const step = story.tddSteps.find((candidate) => candidate.phase === input.phase);
  if (!step) {
    throw new Error(`User story ${story.id} does not define TDD phase ${input.phase}`);
  }
  step.passes = true;
  step.note = input.detail;
  step.timestamp =
    typeof input.storyLogTimestamp === 'string'
      ? input.storyLogTimestamp
      : (input.storyLogTimestamp ?? new Date()).toISOString();

  story.passes = story.tddSteps.every((step) => step.passes);
  if (story.passes && !hasRalphStoryLogEntry(content, story.id)) {
    content = appendRalphStoryLog(
      content,
      formatRalphStoryLogLine({
        userStoryId: input.userStoryId,
        title: input.title,
        timestamp: input.storyLogTimestamp,
      })
    );
  }
  content = markRalphStoryStatus(content, story);
  writeRalphPrd(prdPath, prd);
  content = updateRalphProgressHeader(content, computeRalphProgressHeader(prd));
  atomicWriteFile(input.progressPath, content);
  return content;
}

export function appendTddTrace(input: AppendRalphTddTraceInput): string {
  let content = fs.readFileSync(input.progressPath, 'utf8');
  for (const phase of input.phases) {
    content = recordTddPhaseTrace({
      progressPath: input.progressPath,
      userStoryId: input.userStoryId,
      title: input.title,
      phase: phase.phase,
      detail: phase.detail,
      storyLogTimestamp: input.storyLogTimestamp,
    });
  }
  return content;
}
