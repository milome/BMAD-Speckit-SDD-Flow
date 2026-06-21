import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { ReviewerLatestCloseoutRecord } from './types';

export interface ImplementationEntryGateRecord {
  gateName: 'implementation-readiness';
  requestedFlow: 'story' | 'bugfix' | 'standalone_tasks';
  recommendedFlow: 'story' | 'bugfix' | 'standalone_tasks';
  decision: 'pass' | 'block' | 'reroute';
  readinessStatus:
    | 'missing'
    | 'blocked'
    | 'repair_in_progress'
    | 'ready_clean'
    | 'repair_closed'
    | 'stale_after_semantic_change';
  blockerCodes: string[];
  blockerSummary: string[];
  rerouteRequired: boolean;
  rerouteReason: string | null;
  evidenceSources: {
    readinessReportPath: string | null;
    remediationArtifactPath: string | null;
    executionRecordPath: string | null;
    authoritativeAuditReportPath: string | null;
  };
  semanticFingerprint: string | null;
  evaluatedAt: string;
}

export interface RuntimeContextRegistry {
  version: number;
  projectRoot: string;
  generatedAt: string;
  updatedAt: string;
  sources: {
    sprintStatusPath?: string;
    epicsPath?: string;
    storyArtifactsRoot: string;
    specsRoot: string;
  };
  project: {
    activeEpicIds: string[];
    activeStoryIds: string[];
  };
  projectContextPath: string;
  epicContexts: Record<string, { path: string; [key: string]: unknown }>;
  storyContexts: Record<string, { path: string; [key: string]: unknown }>;
  runContexts: Record<string, { path: string; [key: string]: unknown }>;
  auditIndex: {
    bugfix: Record<
      string,
      {
        artifactDocPath: string;
        reportPath: string;
        status: 'PASS' | 'FAIL';
        converged?: boolean;
        iterationCount?: number;
        updatedAt: string;
      }
    >;
    standalone_tasks: Record<
      string,
      {
        artifactDocPath: string;
        reportPath: string;
        status: 'PASS' | 'FAIL';
        converged?: boolean;
        iterationCount?: number;
        updatedAt: string;
      }
    >;
  };
  implementationEntryIndex: {
    story: Record<string, ImplementationEntryGateRecord>;
    bugfix: Record<string, ImplementationEntryGateRecord>;
    standalone_tasks: Record<string, ImplementationEntryGateRecord>;
  };
  latestReviewerCloseout: ReviewerLatestCloseoutRecord | null;
  activeScope: {
    scopeType: 'project' | 'epic' | 'story' | 'run';
    epicId?: string;
    storyId?: string;
    runId?: string;
    resolvedContextPath?: string;
    reason?: string;
  };
}

export function runtimeContextRegistryPath(root: string): string {
  return path.join(root, '_bmad-output', 'runtime', 'registry.json');
}

function sanitizeBranchRef(value: string): string {
  const normalized = String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'dev';
}

function resolveGitHeadPath(root: string): string | null {
  const gitEntry = path.join(root, '.git');
  if (!fs.existsSync(gitEntry)) {
    return null;
  }
  try {
    const stat = fs.lstatSync(gitEntry);
    if (stat.isDirectory()) {
      return path.join(gitEntry, 'HEAD');
    }
    if (stat.isFile()) {
      const raw = fs.readFileSync(gitEntry, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/iu.exec(raw);
      if (!match) {
        return null;
      }
      const gitDir = path.isAbsolute(match[1]) ? match[1] : path.resolve(root, match[1]);
      return path.join(gitDir, 'HEAD');
    }
  } catch {
    return null;
  }
  return null;
}

function resolvePlanningArtifactsBranch(root: string): string {
  const headPath = resolveGitHeadPath(root);
  if (!headPath || !fs.existsSync(headPath)) {
    return 'dev';
  }
  try {
    const raw = fs.readFileSync(headPath, 'utf8').trim();
    const branchMatch = /^ref:\s+refs\/heads\/(.+)$/iu.exec(raw);
    if (branchMatch) {
      return sanitizeBranchRef(branchMatch[1]);
    }
    if (/^[0-9a-f]{7,40}$/iu.test(raw)) {
      return `detached-${raw.slice(0, 7)}`;
    }
  } catch {
    return 'dev';
  }
  return 'dev';
}

function defaultEpicsPath(root: string): string {
  return `_bmad-output/planning-artifacts/${resolvePlanningArtifactsBranch(root)}/epics.md`;
}

export function defaultRuntimeContextRegistry(root: string): RuntimeContextRegistry {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectRoot: root,
    generatedAt: now,
    updatedAt: now,
    sources: {
      sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
      epicsPath: defaultEpicsPath(root),
      storyArtifactsRoot: '_bmad-output/implementation-artifacts',
      specsRoot: 'specs',
    },
    project: {
      activeEpicIds: [],
      activeStoryIds: [],
    },
    projectContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
    epicContexts: {},
    storyContexts: {},
    runContexts: {},
    auditIndex: {
      bugfix: {},
      standalone_tasks: {},
    },
    implementationEntryIndex: {
      story: {},
      bugfix: {},
      standalone_tasks: {},
    },
    latestReviewerCloseout: null,
    activeScope: {
      scopeType: 'project',
      resolvedContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
      reason: 'default project scope',
    },
  };
}

export function writeRuntimeContextRegistry(root: string, registry: RuntimeContextRegistry): void {
  const file = runtimeContextRegistryPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(registry, null, 2) + '\n';
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

export function readRuntimeContextRegistry(root: string): RuntimeContextRegistry {
  const file = runtimeContextRegistryPath(root);
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw) as RuntimeContextRegistry;
  parsed.sources = parsed.sources ?? {
    sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
    epicsPath: defaultEpicsPath(root),
    storyArtifactsRoot: '_bmad-output/implementation-artifacts',
    specsRoot: 'specs',
  };
  if (!parsed.sources.epicsPath || parsed.sources.epicsPath === 'epics.md') {
    parsed.sources.epicsPath = defaultEpicsPath(root);
  }
  if (!parsed.auditIndex) {
    parsed.auditIndex = {
      bugfix: {},
      standalone_tasks: {},
    };
  } else {
    parsed.auditIndex.bugfix = parsed.auditIndex.bugfix ?? {};
    parsed.auditIndex.standalone_tasks = parsed.auditIndex.standalone_tasks ?? {};
  }
  if (!parsed.implementationEntryIndex) {
    parsed.implementationEntryIndex = {
      story: {},
      bugfix: {},
      standalone_tasks: {},
    };
  } else {
    parsed.implementationEntryIndex.story = parsed.implementationEntryIndex.story ?? {};
    parsed.implementationEntryIndex.bugfix = parsed.implementationEntryIndex.bugfix ?? {};
    parsed.implementationEntryIndex.standalone_tasks =
      parsed.implementationEntryIndex.standalone_tasks ?? {};
  }
  parsed.latestReviewerCloseout = parsed.latestReviewerCloseout ?? null;
  return parsed;
}

/** Load existing registry from disk when present; otherwise a fresh default. */
export function readRegistryOrDefault(root: string): RuntimeContextRegistry {
  const file = runtimeContextRegistryPath(root);
  if (!fs.existsSync(file)) {
    return defaultRuntimeContextRegistry(root);
  }
  return readRuntimeContextRegistry(root);
}

export function buildProjectRegistryFromSprintStatus(
  root: string,
  sprintStatusPath: string
): RuntimeContextRegistry {
  const raw = fs.readFileSync(sprintStatusPath, 'utf8');
  const doc = (yaml.load(raw) ?? {}) as {
    development_status?: Record<string, string>;
  };
  const developmentStatus = doc.development_status ?? {};
  const activeEpicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
  const activeStoryIds = Object.keys(developmentStatus).filter((key) => !key.startsWith('epic-'));
  const registry = defaultRuntimeContextRegistry(root);
  registry.project.activeEpicIds = activeEpicIds;
  registry.project.activeStoryIds = activeStoryIds;
  registry.sources.sprintStatusPath = path.relative(root, sprintStatusPath).replace(/\\/g, '/');
  registry.updatedAt = new Date().toISOString();
  return registry;
}

export function buildEpicContextsFromSprintStatus(
  root: string,
  sprintStatusPath: string
): Record<string, { path: string; status: string }> {
  const raw = fs.readFileSync(sprintStatusPath, 'utf8');
  const doc = (yaml.load(raw) ?? {}) as {
    development_status?: Record<string, string>;
  };
  const developmentStatus = doc.development_status ?? {};
  return Object.fromEntries(
    Object.entries(developmentStatus)
      .filter(([key]) => key.startsWith('epic-'))
      .map(([epicId, status]) => [
        epicId,
        {
          path: path.join(root, '_bmad-output', 'runtime', 'context', 'epics', `${epicId}.json`),
          status,
        },
      ])
  );
}

export function buildStoryContextsFromSprintStatus(
  root: string,
  sprintStatusPath: string
): Record<
  string,
  { path: string; status: string; epicId: string; artifactRoot: string; specRoot: string }
> {
  const raw = fs.readFileSync(sprintStatusPath, 'utf8');
  const doc = (yaml.load(raw) ?? {}) as {
    development_status?: Record<string, string>;
  };
  const developmentStatus = doc.development_status ?? {};
  const epicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
  const defaultEpicId = epicIds[0] ?? 'epic-unknown';
  return Object.fromEntries(
    Object.entries(developmentStatus)
      .filter(([key]) => !key.startsWith('epic-'))
      .map(([storyId, status]) => [
        storyId,
        {
          path: path.join(
            root,
            '_bmad-output',
            'runtime',
            'context',
            'stories',
            defaultEpicId,
            `${storyId}.json`
          ),
          status,
          epicId: defaultEpicId,
          artifactRoot: path.join(
            root,
            '_bmad-output',
            'implementation-artifacts',
            defaultEpicId,
            storyId
          ),
          specRoot: path.join(root, 'specs', defaultEpicId, storyId),
        },
      ])
  );
}

export function buildRunContext(
  root: string,
  input: {
    epicId: string;
    storyId: string;
    storySlug: string;
    runId: string;
    lifecycleStage: 'story_create' | 'story_audit' | 'dev_story' | 'post_audit';
    workflowStage?: 'constitution' | 'specify' | 'plan' | 'gaps' | 'tasks' | 'implement';
    iteration?: number;
  }
): {
  scopeType: 'run';
  epicId: string;
  storyId: string;
  storySlug: string;
  runId: string;
  lifecycleStage: 'story_create' | 'story_audit' | 'dev_story' | 'post_audit';
  workflowStage?: 'constitution' | 'specify' | 'plan' | 'gaps' | 'tasks' | 'implement';
  iteration?: number;
  path: string;
} {
  return {
    scopeType: 'run',
    epicId: input.epicId,
    storyId: input.storyId,
    storySlug: input.storySlug,
    runId: input.runId,
    lifecycleStage: input.lifecycleStage,
    ...(input.workflowStage ? { workflowStage: input.workflowStage } : {}),
    ...(input.iteration != null ? { iteration: input.iteration } : {}),
    path: path.join(
      root,
      '_bmad-output',
      'runtime',
      'context',
      'runs',
      input.epicId,
      input.storyId,
      `${input.runId}.json`
    ),
  };
}

export function resolveActiveScope(
  registry: RuntimeContextRegistry,
  scope: RuntimeContextRegistry['activeScope']
): RuntimeContextRegistry['activeScope'] {
  return scope;
}

export function resolveContextPathFromActiveScope(
  registry: RuntimeContextRegistry,
  scope: RuntimeContextRegistry['activeScope']
): string {
  switch (scope.scopeType) {
    case 'run': {
      if (!scope.runId || !registry.runContexts[scope.runId]) {
        throw new Error(`Missing run context for ${scope.runId ?? 'unknown'}`);
      }
      return registry.runContexts[scope.runId].path;
    }
    case 'story': {
      if (!scope.storyId || !registry.storyContexts[scope.storyId]) {
        throw new Error(`Missing story context for ${scope.storyId ?? 'unknown'}`);
      }
      return registry.storyContexts[scope.storyId].path;
    }
    case 'epic': {
      if (!scope.epicId || !registry.epicContexts[scope.epicId]) {
        throw new Error(`Missing epic context for ${scope.epicId ?? 'unknown'}`);
      }
      return registry.epicContexts[scope.epicId].path;
    }
    case 'project':
    default:
      return registry.projectContextPath;
  }
}
