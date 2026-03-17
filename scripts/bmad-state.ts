/**
 * BMAD Multi-Story State Management
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const STATE_DIR = '.claude/state';
const STORIES_DIR = join(STATE_DIR, 'stories');
const LOCKS_DIR = join(STATE_DIR, 'locks');
const GLOBAL_STATE_FILE = join(STATE_DIR, 'bmad-progress.yaml');

export interface StoryRef {
  epic: string;
  story: string;
  stage: string;
  status: 'active' | 'paused' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface GlobalState {
  version: string;
  active_stories: StoryRef[];
  completed_stories: { epic: string; story: string; completed_at: string }[];
  current_context: { epic: string; story: string } | null;
}

export interface StoryState {
  version: string;
  epic: string;
  story: string;
  story_slug?: string;
  layer: number;
  stage: string;
  audit_status: 'pending' | 'pass' | 'fail';
  auditReportPath?: string;
  completedAt?: string;
  artifacts: Record<string, unknown>;
  scores: Record<string, unknown>;
  git_control: { commit_allowed: boolean; last_commit_request?: string };
  runtime: { last_action: string; iteration_count?: number };
}

export interface LockInfo {
  locked: boolean;
  owner: string | null;
  epic: string;
  story: string;
  acquired_at: string | null;
  expires_at: string | null;
  type: 'read' | 'write';
}

function toYaml(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function fromYaml(yaml: string): unknown {
  try {
    return JSON.parse(yaml);
  } catch {
    return {};
  }
}

function ensureDirs() {
  if (!existsSync(STORIES_DIR)) mkdirSync(STORIES_DIR, { recursive: true });
  if (!existsSync(LOCKS_DIR)) mkdirSync(LOCKS_DIR, { recursive: true });
}

export function getGlobalState(): GlobalState {
  ensureDirs();
  if (!existsSync(GLOBAL_STATE_FILE)) {
    const defaultState: GlobalState = {
      version: '2.0',
      active_stories: [],
      completed_stories: [],
      current_context: null,
    };
    saveGlobalState(defaultState);
    return defaultState;
  }
  return fromYaml(readFileSync(GLOBAL_STATE_FILE, 'utf8')) as GlobalState;
}

export function saveGlobalState(state: GlobalState) {
  ensureDirs();
  writeFileSync(GLOBAL_STATE_FILE, toYaml(state));
}

export function getStoryStatePath(epic: string, story: string): string {
  return join(STORIES_DIR, `${epic}-${story}-progress.yaml`);
}

export function getStoryState(epic: string, story: string): StoryState | null {
  const path = getStoryStatePath(epic, story);
  if (!existsSync(path)) return null;
  return fromYaml(readFileSync(path, 'utf8')) as StoryState;
}

export function saveStoryState(state: StoryState) {
  ensureDirs();
  writeFileSync(getStoryStatePath(state.epic, state.story), toYaml(state));
}

export function createStory(
  epic: string,
  story: string,
  storySlug: string,
  initialStage = 'specify'
): StoryState {
  const global = getGlobalState();
  const existing = global.active_stories.find((s) => s.epic === epic && s.story === story);
  if (existing) throw new Error(`Story ${epic}-${story} already exists`);

  const now = new Date().toISOString();
  const storyState: StoryState = {
    version: '2.0',
    epic,
    story,
    story_slug: storySlug,
    layer: 4,
    stage: initialStage,
    audit_status: 'pending',
    artifacts: {},
    scores: {},
    git_control: { commit_allowed: false },
    runtime: { last_action: 'story_created' },
  };

  global.active_stories.push({
    epic,
    story,
    stage: initialStage,
    status: 'active',
    created_at: now,
    updated_at: now,
  });
  global.current_context = { epic, story };

  saveStoryState(storyState);
  saveGlobalState(global);
  return storyState;
}

export function updateStoryState(
  epic: string,
  story: string,
  patch: Partial<StoryState>
): StoryState {
  const state = getStoryState(epic, story);
  if (!state) throw new Error(`Story ${epic}-${story} not found`);

  const updated = { ...state, ...patch };
  saveStoryState(updated);

  const global = getGlobalState();
  const storyRef = global.active_stories.find((s) => s.epic === epic && s.story === story);
  if (storyRef) {
    storyRef.stage = updated.stage;
    storyRef.updated_at = new Date().toISOString();
    global.current_context = { epic, story };
    saveGlobalState(global);
  }
  return updated;
}

export function completeStory(epic: string, story: string) {
  const global = getGlobalState();
  const index = global.active_stories.findIndex((s) => s.epic === epic && s.story === story);
  if (index === -1) throw new Error(`Story ${epic}-${story} not found`);

  global.completed_stories.push({ epic, story, completed_at: new Date().toISOString() });
  global.active_stories.splice(index, 1);
  global.current_context =
    global.active_stories.length > 0
      ? { epic: global.active_stories[0].epic, story: global.active_stories[0].story }
      : null;
  saveGlobalState(global);
}

export function listActiveStories(): StoryRef[] {
  return getGlobalState().active_stories;
}

export function getCurrentContext() {
  return getGlobalState().current_context;
}

export function setCurrentContext(epic: string, story: string) {
  const global = getGlobalState();
  if (!global.active_stories.some((s) => s.epic === epic && s.story === story)) {
    throw new Error(`Story ${epic}-${story} is not active`);
  }
  global.current_context = { epic, story };
  saveGlobalState(global);
}

export function getLockPath(epic: string, story: string): string {
  return join(LOCKS_DIR, `${epic}-${story}.lock`);
}

export function getLock(epic: string, story: string): LockInfo {
  const path = getLockPath(epic, story);
  if (!existsSync(path)) {
    return {
      locked: false,
      owner: null,
      epic,
      story,
      acquired_at: null,
      expires_at: null,
      type: 'write',
    };
  }
  const lock = fromYaml(readFileSync(path, 'utf8')) as LockInfo;
  if (lock.expires_at && new Date(lock.expires_at) < new Date()) {
    releaseLock(epic, story, lock.owner || '');
    return {
      locked: false,
      owner: null,
      epic,
      story,
      acquired_at: null,
      expires_at: null,
      type: 'write',
    };
  }
  return lock;
}

export function acquireLock(
  epic: string,
  story: string,
  owner: string,
  type: 'read' | 'write' = 'write',
  durationMinutes = 60
): boolean {
  const existing = getLock(epic, story);
  if (existing.locked && existing.owner !== owner) return false;

  const now = new Date();
  const lock: LockInfo = {
    locked: true,
    owner,
    epic,
    story,
    acquired_at: now.toISOString(),
    expires_at: new Date(now.getTime() + durationMinutes * 60000).toISOString(),
    type,
  };
  writeFileSync(getLockPath(epic, story), toYaml(lock));
  return true;
}

export function releaseLock(epic: string, story: string, owner: string): boolean {
  const existing = getLock(epic, story);
  if (!existing.locked) return true;
  if (existing.owner !== owner) return false;

  try {
    unlinkSync(getLockPath(epic, story));
  } catch {
    // intentional: ignore unlink errors
  }
  return true;
}

export function withLock<T>(
  epic: string,
  story: string,
  owner: string,
  fn: () => T,
  type: 'read' | 'write' = 'write'
): T {
  if (!acquireLock(epic, story, owner, type))
    throw new Error(`Failed to acquire lock for ${epic}-${story}`);
  try {
    return fn();
  } finally {
    releaseLock(epic, story, owner);
  }
}
