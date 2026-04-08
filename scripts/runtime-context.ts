/**
 * Runtime context file helpers for `_bmad-output/runtime/context/...` scoped inputs.
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { RuntimeFlowId } from './runtime-governance';
import type { StageName } from './bmad-config';
import {
  buildProjectRegistryFromSprintStatus,
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';

export const RUNTIME_CONTEXT_VERSION = 1 as const;

const RUNTIME_FLOWS: RuntimeFlowId[] = ['story', 'bugfix', 'standalone_tasks', 'epic', 'unknown'];
const STAGE_NAMES: StageName[] = [
  'prd',
  'arch',
  'epics',
  'story_create',
  'story_audit',
  'specify',
  'plan',
  'gaps',
  'tasks',
  'implement',
  'post_audit',
  'epic_create',
  'epic_complete',
];

export interface RuntimeContextFile {
  version: number;
  flow: RuntimeFlowId;
  stage: StageName;
  workflow?: string;
  step?: string;
  sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
  templateId?: string;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
  artifactPath?: string;
  contextScope?: 'project' | 'story';
  /** Session-scoped language resolution (Story 15.2 i18n); optional. */
  languagePolicy?: { resolvedMode: 'zh' | 'en' | 'bilingual' };
  updatedAt: string;
}

function isRuntimeFlowId(v: string): v is RuntimeFlowId {
  return (RUNTIME_FLOWS as string[]).includes(v);
}

function isStageName(v: string): v is StageName {
  return (STAGE_NAMES as string[]).includes(v);
}

export function defaultRuntimeContextFile(
  overrides?: Partial<RuntimeContextFile>
): RuntimeContextFile {
  const base: RuntimeContextFile = {
    version: RUNTIME_CONTEXT_VERSION,
    flow: 'story',
    stage: 'specify',
    sourceMode: 'full_bmad',
    updatedAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

export function runtimeContextPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
}

export function projectContextPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
}

export function epicContextPath(root: string, epicId: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'context', 'epics', `${epicId}.json`);
}

export function storyContextPath(root: string, epicId: string, storyId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'context',
    'stories',
    epicId,
    `${storyId}.json`
  );
}

export function runContextPath(
  root: string,
  epicId: string,
  storyId: string,
  runId: string
): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'context',
    'runs',
    epicId,
    storyId,
    `${runId}.json`
  );
}

/** Resolve runtime context path from an explicit argument or the project-scoped default path. */
export function resolveRuntimeContextPath(root: string, explicitPath?: string): string {
  const candidate = explicitPath?.trim();
  if (candidate) {
    return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
  }
  return projectContextPath(root);
}

/** Resolve write target from an explicit argument or the project-scoped default path. */
export function resolveRuntimeContextWritePath(root: string, explicitPath?: string): string {
  const candidate = explicitPath?.trim();
  if (candidate) {
    return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
  }
  return projectContextPath(root);
}

export function readRuntimeContext(root: string, explicitPath?: string): RuntimeContextFile {
  const file = resolveRuntimeContextPath(root, explicitPath);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`runtime-context missing: ${file}`);
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`runtime-context invalid JSON: ${file}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`runtime-context not an object: ${file}`);
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== RUNTIME_CONTEXT_VERSION) {
    throw new Error(
      `runtime-context.version must be ${RUNTIME_CONTEXT_VERSION}, got ${String(o.version)}`
    );
  }
  if (typeof o.flow !== 'string' || !isRuntimeFlowId(o.flow)) {
    throw new Error(`runtime-context.flow invalid or missing: ${file}`);
  }
  if (typeof o.stage !== 'string' || !isStageName(o.stage)) {
    throw new Error(`runtime-context.stage invalid or missing: ${file}`);
  }
  if (o.templateId !== undefined && typeof o.templateId !== 'string') {
    throw new Error(`runtime-context.templateId must be string when set: ${file}`);
  }
  if (
    o.sourceMode !== undefined &&
    o.sourceMode !== 'full_bmad' &&
    o.sourceMode !== 'seeded_solutioning' &&
    o.sourceMode !== 'standalone_story'
  ) {
    throw new Error(`runtime-context.sourceMode invalid: ${file}`);
  }
  for (const key of ['epicId', 'storyId', 'storySlug', 'runId', 'artifactRoot'] as const) {
    if (o[key] !== undefined && typeof o[key] !== 'string') {
      throw new Error(`runtime-context.${key} must be string when set: ${file}`);
    }
  }
  for (const key of ['workflow', 'step', 'artifactPath'] as const) {
    if (o[key] !== undefined && typeof o[key] !== 'string') {
      throw new Error(`runtime-context.${key} must be string when set: ${file}`);
    }
  }
  if (o.contextScope !== undefined && o.contextScope !== 'project' && o.contextScope !== 'story') {
    throw new Error(`runtime-context.contextScope invalid: ${file}`);
  }
  if (o.languagePolicy !== undefined) {
    if (!o.languagePolicy || typeof o.languagePolicy !== 'object') {
      throw new Error(`runtime-context.languagePolicy invalid: ${file}`);
    }
    const lp = o.languagePolicy as Record<string, unknown>;
    if (
      lp.resolvedMode !== 'zh' &&
      lp.resolvedMode !== 'en' &&
      lp.resolvedMode !== 'bilingual'
    ) {
      throw new Error(`runtime-context.languagePolicy.resolvedMode invalid: ${file}`);
    }
  }
  if (typeof o.updatedAt !== 'string' || o.updatedAt.trim() === '') {
    throw new Error(`runtime-context.updatedAt missing: ${file}`);
  }
  const out: RuntimeContextFile = {
    version: RUNTIME_CONTEXT_VERSION,
    flow: o.flow,
    stage: o.stage,
    updatedAt: o.updatedAt,
  };
  if (
    o.sourceMode === 'full_bmad' ||
    o.sourceMode === 'seeded_solutioning' ||
    o.sourceMode === 'standalone_story'
  ) {
    out.sourceMode = o.sourceMode;
  }
  if (typeof o.templateId === 'string' && o.templateId !== '') {
    out.templateId = o.templateId;
  }
  if (typeof o.epicId === 'string' && o.epicId !== '') out.epicId = o.epicId;
  if (typeof o.storyId === 'string' && o.storyId !== '') out.storyId = o.storyId;
  if (typeof o.storySlug === 'string' && o.storySlug !== '') out.storySlug = o.storySlug;
  if (typeof o.runId === 'string' && o.runId !== '') out.runId = o.runId;
  if (typeof o.artifactRoot === 'string' && o.artifactRoot !== '')
    out.artifactRoot = o.artifactRoot;
  if (typeof o.artifactPath === 'string' && o.artifactPath !== '') out.artifactPath = o.artifactPath;
  if (typeof o.workflow === 'string' && o.workflow !== '') out.workflow = o.workflow;
  if (typeof o.step === 'string' && o.step !== '') out.step = o.step;
  if (o.contextScope === 'project' || o.contextScope === 'story') out.contextScope = o.contextScope;
  if (o.languagePolicy && typeof o.languagePolicy === 'object') {
    const lp = o.languagePolicy as Record<string, unknown>;
    if (
      lp.resolvedMode === 'zh' ||
      lp.resolvedMode === 'en' ||
      lp.resolvedMode === 'bilingual'
    ) {
      out.languagePolicy = { resolvedMode: lp.resolvedMode as 'zh' | 'en' | 'bilingual' };
    }
  }
  return out;
}

/**
 * Write context with fsync so emit can read within ~1s on local FS.
 */
/**
 * Merge `languagePolicy.resolvedMode` into existing project runtime context when `project.json` exists and is valid.
 * No-op if file missing or unreadable (hooks must not fail closed on cold projects).
 */
export function mergeLanguagePolicyIntoProjectContext(
  root: string,
  languagePolicy: { resolvedMode: 'zh' | 'en' | 'bilingual' }
): void {
  const file = projectContextPath(root);
  if (!fs.existsSync(file)) {
    return;
  }
  try {
    const ctx = readRuntimeContext(root);
    const next: RuntimeContextFile = {
      ...ctx,
      languagePolicy: { resolvedMode: languagePolicy.resolvedMode },
      updatedAt: new Date().toISOString(),
    };
    writeRuntimeContext(root, next);
  } catch {
    /* ignore corrupt or legacy context */
  }
}

export function writeRuntimeContext(root: string, payload: RuntimeContextFile): void {
  writeRuntimeContextFile(runtimeContextPath(root), payload);
}

function writeRuntimeContextFile(file: string, payload: RuntimeContextFile): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const body = JSON.stringify(payload, null, 2) + '\n';
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, 'utf8');
  let fd = fs.openSync(tmp, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  fd = fs.openSync(file, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function readRegistryOrDefault(root: string) {
  try {
    return readRuntimeContextRegistry(root);
  } catch {
    return defaultRuntimeContextRegistry(root);
  }
}

export function detectRuntimeSourceMode(
  root: string,
  hints?: {
    sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
    hasSprintStatus?: boolean;
    hasStoryOnly?: boolean;
  }
): 'full_bmad' | 'seeded_solutioning' | 'standalone_story' {
  if (hints?.sourceMode) return hints.sourceMode;
  if (hints?.hasSprintStatus) return 'full_bmad';
  if (hints?.hasStoryOnly) return 'standalone_story';
  return 'seeded_solutioning';
}

export function ensureProjectRuntimeContext(
  root: string,
  options?: Partial<RuntimeContextFile> & {
    sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
    hasSprintStatus?: boolean;
  }
): RuntimeContextFile {
  const detectedSourceMode = detectRuntimeSourceMode(root, {
    sourceMode: options?.sourceMode,
    hasSprintStatus: options?.hasSprintStatus,
  });
  const payload = defaultRuntimeContextFile({
    contextScope: 'project',
    sourceMode: detectedSourceMode,
    ...options,
  });
  writeRuntimeContext(root, payload);

  const sprintStatusPath = path.join(
    root,
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  );
  const registry =
    detectedSourceMode === 'full_bmad' && fs.existsSync(sprintStatusPath)
      ? buildProjectRegistryFromSprintStatus(root, sprintStatusPath)
      : defaultRuntimeContextRegistry(root);
  registry.activeScope = {
    scopeType: 'project',
    resolvedContextPath: registry.projectContextPath,
    reason: 'ensureProjectRuntimeContext bootstrap',
  };
  writeRuntimeContextRegistry(root, registry);

  return payload;
}

export function ensureStoryRuntimeContext(
  root: string,
  options: Partial<RuntimeContextFile> & {
    epicId?: string;
    storyId: string;
    sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
  }
): RuntimeContextFile {
  const detectedSourceMode = detectRuntimeSourceMode(root, {
    sourceMode: options?.sourceMode,
    hasStoryOnly: true,
  });
  const payload = defaultRuntimeContextFile({
    contextScope: 'story',
    sourceMode: detectedSourceMode,
    ...options,
  });
  writeRuntimeContext(root, payload);

  const registry = readRegistryOrDefault(root);
  const epicId = options.epicId || payload.epicId || 'epic-unknown';
  const scopedPath = storyContextPath(root, epicId, options.storyId);
  writeRuntimeContextFile(scopedPath, payload);
  registry.storyContexts[options.storyId] = {
    path: scopedPath,
    epicId,
    sourceMode: detectedSourceMode,
  };
  registry.activeScope = {
    scopeType: 'story',
    epicId,
    storyId: options.storyId,
    resolvedContextPath: registry.storyContexts[options.storyId].path,
    reason: 'ensureStoryRuntimeContext bootstrap',
  };
  writeRuntimeContextRegistry(root, registry);
  return payload;
}

export function ensureRunRuntimeContext(
  root: string,
  options: Partial<RuntimeContextFile> & {
    storyId: string;
    runId: string;
    sourceMode?: 'full_bmad' | 'seeded_solutioning' | 'standalone_story';
  }
): RuntimeContextFile {
  const detectedSourceMode = detectRuntimeSourceMode(root, {
    sourceMode: options?.sourceMode,
    hasStoryOnly: true,
  });
  const payload = defaultRuntimeContextFile({
    contextScope: 'story',
    sourceMode: detectedSourceMode,
    ...options,
  });
  writeRuntimeContext(root, payload);

  const registry = readRegistryOrDefault(root);
  const epicId = options.epicId || payload.epicId || 'epic-unknown';
  const scopedPath = runContextPath(root, epicId, options.storyId, options.runId);
  writeRuntimeContextFile(scopedPath, payload);
  registry.runContexts[options.runId] = {
    path: scopedPath,
    epicId,
    storyId: options.storyId,
    runId: options.runId,
    sourceMode: detectedSourceMode,
  };
  registry.activeScope = {
    scopeType: 'run',
    epicId,
    storyId: options.storyId,
    runId: options.runId,
    resolvedContextPath: registry.runContexts[options.runId].path,
    reason: 'ensureRunRuntimeContext bootstrap',
  };
  writeRuntimeContextRegistry(root, registry);
  return payload;
}

export function writeRuntimeContextFromSprintStatus(root: string, sprintStatusPath: string): void {
  const raw = fs.readFileSync(sprintStatusPath, 'utf8');
  const doc = (yaml.load(raw) ?? {}) as {
    development_status?: Record<string, string>;
  };
  const developmentStatus = doc.development_status ?? {};
  const epicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
  const storyIds = Object.keys(developmentStatus).filter((key) => !key.startsWith('epic-'));
  const payload = defaultRuntimeContextFile({
    flow: 'story',
    stage: 'story_create',
    sourceMode: 'full_bmad',
    contextScope: 'project',
    epicId: epicIds[0],
    storyId: storyIds[0],
  });
  writeRuntimeContext(root, payload);
}
