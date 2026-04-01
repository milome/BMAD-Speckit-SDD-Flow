/**
 * CLI for ensure-run-runtime-context (bmad-speckit subcommand).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ensureRunRuntimeContext,
  runContextPath,
} from './context';
import {
  buildProjectRegistryFromSprintStatus,
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  runtimeContextRegistryPath,
  writeRuntimeContextRegistry,
} from './registry';

export interface EnsureRunCliOptions {
  storyKey: string;
  lifecycle: 'dev_story' | 'post_audit';
  persist?: boolean;
  cwd?: string;
}

export interface ParsedStoryKey {
  epicNum: string;
  storyNum: string;
  storySlug: string;
  epicId: string;
}

interface RuntimeEventRecord {
  event_id: string;
  event_type: string;
  event_version: 1;
  timestamp: string;
  run_id: string;
  flow?: string;
  stage?: string;
  scope?: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/** Same rule as create-story: epic_num-story_num-slug (e.g. 15-1-runtime-governance-complete). */
export function parseStoryKey(storyKey: string): ParsedStoryKey {
  const trimmed = storyKey.trim();
  const m = /^(\d+)-(\d+)-(.+)$/.exec(trimmed);
  if (!m) {
    throw new Error(
      `Invalid story-key: expected "{{epic}}-{{story}}-{{slug}}" (e.g. 15-1-runtime-governance-complete), got: ${storyKey}`
    );
  }
  const [, epicNum, storyNum, storySlug] = m;
  return {
    epicNum,
    storyNum,
    storySlug,
    epicId: `epic-${epicNum}`,
  };
}

function lastRunPath(root: string, lifecycle: 'dev_story' | 'post_audit'): string {
  const name =
    lifecycle === 'dev_story' ? 'last-dev-story-run.json' : 'last-post-audit-run.json';
  return path.join(root, '_bmad-output', 'runtime', name);
}

function runtimeEventsPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'events');
}

function appendRuntimeEvent(root: string, event: RuntimeEventRecord): void {
  const eventsDir = runtimeEventsPath(root);
  fs.mkdirSync(eventsDir, { recursive: true });
  const safeTimestamp = event.timestamp.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeEventId = event.event_id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(eventsDir, `${safeTimestamp}-${safeEventId}.json`);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(event, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function emitRunLifecycleEvents(
  root: string,
  input: {
    runId: string;
    storyKey: string;
    epicId: string;
    lifecycle: 'dev_story' | 'post_audit';
    runPath: string;
  }
): void {
  const now = new Date().toISOString();
  const stage = stageForLifecycle(input.lifecycle);
  const scope = {
    story_key: input.storyKey,
    epic_id: input.epicId.replace(/^epic-/, ''),
    story_id: input.storyKey.split('-')[1] ?? input.storyKey,
    flow: 'story',
    resolved_context_path: input.runPath,
  };

  appendRuntimeEvent(root, {
    event_id: randomUUID(),
    event_type: 'run.created',
    event_version: 1,
    timestamp: now,
    run_id: input.runId,
    flow: 'story',
    stage,
    scope,
    payload: {
      lifecycle: input.lifecycle,
      status: 'pending',
    },
  });
  appendRuntimeEvent(root, {
    event_id: randomUUID(),
    event_type: 'run.scope.changed',
    event_version: 1,
    timestamp: now,
    run_id: input.runId,
    flow: 'story',
    stage,
    scope,
    payload: {
      lifecycle: input.lifecycle,
      scope_type: 'run',
    },
  });
  appendRuntimeEvent(root, {
    event_id: randomUUID(),
    event_type: 'stage.started',
    event_version: 1,
    timestamp: now,
    run_id: input.runId,
    flow: 'story',
    stage,
    scope,
    payload: {
      lifecycle: input.lifecycle,
      status: 'running',
    },
  });
}

function writeLastRun(root: string, lifecycle: 'dev_story' | 'post_audit', body: { storyKey: string; runId: string }): void {
  const file = lastRunPath(root, lifecycle);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n', 'utf8');
}

function readLastRun(
  root: string,
  lifecycle: 'dev_story' | 'post_audit'
): { storyKey: string; runId: string } {
  const file = lastRunPath(root, lifecycle);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`Missing ${file}; run without --persist first.`);
    }
    throw e;
  }
  const parsed = JSON.parse(raw) as { storyKey?: string; runId?: string };
  if (typeof parsed.storyKey !== 'string' || typeof parsed.runId !== 'string') {
    throw new Error(`Invalid last-run file: ${file}`);
  }
  return { storyKey: parsed.storyKey, runId: parsed.runId };
}

function stageForLifecycle(lifecycle: 'dev_story' | 'post_audit'): 'implement' | 'post_audit' {
  return lifecycle === 'dev_story' ? 'implement' : 'post_audit';
}

/**
 * Persist registry after sprint-status write: refresh from sprint when present, re-affirm run scope.
 */
function persistRunRegistry(
  root: string,
  storyKey: string,
  runId: string,
  lifecycle: 'dev_story' | 'post_audit'
): void {
  const parsed = parseStoryKey(storyKey);
  const sprintPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');

  let registry = fs.existsSync(runtimeContextRegistryPath(root))
    ? readRuntimeContextRegistry(root)
    : defaultRuntimeContextRegistry(root);

  if (fs.existsSync(sprintPath)) {
    registry = buildProjectRegistryFromSprintStatus(root, sprintPath);
  }

  const runPath = runContextPath(root, parsed.epicId, storyKey, runId);
  registry.runContexts[runId] = {
    path: runPath,
    epicId: parsed.epicId,
    storyId: storyKey,
    runId,
    lifecycleStage: lifecycle,
  };
  registry.activeScope = {
    scopeType: 'run',
    epicId: parsed.epicId,
    storyId: storyKey,
    runId,
    resolvedContextPath: runPath,
    reason: `ensure-run-runtime-context --persist (${lifecycle})`,
  };
  registry.updatedAt = new Date().toISOString();
  writeRuntimeContextRegistry(root, registry);
  emitRunLifecycleEvents(root, {
    runId,
    storyKey,
    epicId: parsed.epicId,
    lifecycle,
    runPath,
  });
}

export function runEnsureRunCli(opts: EnsureRunCliOptions): void {
  const root = opts.cwd ?? process.cwd();
  const lifecycle = opts.lifecycle;

  if (opts.persist) {
    const { storyKey, runId } = readLastRun(root, lifecycle);
    if (storyKey !== opts.storyKey.trim()) {
      throw new Error(
        `story-key mismatch: CLI has "${opts.storyKey}" but ${lastRunPath(root, lifecycle)} has "${storyKey}"`
      );
    }
    persistRunRegistry(root, storyKey, runId, lifecycle);
    return;
  }

  const storyKey = opts.storyKey.trim();
  const parsed = parseStoryKey(storyKey);
  const runId = randomUUID();
  ensureRunRuntimeContext(root, {
    epicId: parsed.epicId,
    storyId: storyKey,
    runId,
    stage: stageForLifecycle(lifecycle),
    flow: 'story',
  });
  emitRunLifecycleEvents(root, {
    runId,
    storyKey,
    epicId: parsed.epicId,
    lifecycle,
    runPath: runContextPath(root, parsed.epicId, storyKey, runId),
  });

  // eslint-disable-next-line no-console -- CLI contract (tasks-E15-S1)
  console.log(`RUN_ID:${runId}`);
  writeLastRun(root, lifecycle, { storyKey, runId });
}
