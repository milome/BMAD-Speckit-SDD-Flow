import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { parseBmadAuditResult } from './parse-bmad-audit-result';

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
        stage?: 'bugfix' | 'standalone_tasks';
        closeoutApproved?: boolean;
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
        stage?: 'bugfix' | 'standalone_tasks';
        closeoutApproved?: boolean;
        converged?: boolean;
        iterationCount?: number;
        updatedAt: string;
      }
    >;
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

export function defaultRuntimeContextRegistry(root: string): RuntimeContextRegistry {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectRoot: root,
    generatedAt: now,
    updatedAt: now,
    sources: {
      sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
      epicsPath: 'epics.md',
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
  if (!parsed.auditIndex) {
    parsed.auditIndex = {
      bugfix: {},
      standalone_tasks: {},
    };
  } else {
    parsed.auditIndex.bugfix = parsed.auditIndex.bugfix ?? {};
    parsed.auditIndex.standalone_tasks = parsed.auditIndex.standalone_tasks ?? {};
  }
  parsed.latestReviewerCloseout = parsed.latestReviewerCloseout ?? null;
  return parsed;
}

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

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function dateSortValue(filePath: string): number {
  const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const time = Date.parse(`${match[1]}T00:00:00Z`);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function listStructuredAuditReports(root: string): string[] {
  const searchRoots = [path.join(root, '_bmad-output'), path.join(root, 'reports')];
  const found: string[] = [];
  const seen = new Set<string>();

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.audit\.md$/i.test(entry.name)) {
        continue;
      }
      const normalized = path.normalize(fullPath);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      found.push(fullPath);
    }
  };

  for (const searchRoot of searchRoots) {
    walk(searchRoot);
  }

  return found.sort((left, right) => dateSortValue(right) - dateSortValue(left));
}

function inferAuditIndexFlow(artifactDocPath: string): 'bugfix' | 'standalone_tasks' | null {
  const normalized = artifactDocPath.toLowerCase();
  if (normalized.includes('bugfix')) {
    return 'bugfix';
  }
  if (normalized.includes('tasks')) {
    return 'standalone_tasks';
  }
  return null;
}

function inferAuditIndexFlowFromParsedStage(
  stage: string | undefined,
  artifactDocPath: string
): 'bugfix' | 'standalone_tasks' | null {
  if (stage === 'bugfix' || stage === 'standalone_tasks') {
    return stage;
  }
  return inferAuditIndexFlow(artifactDocPath);
}

export function syncAuditIndexFromReport(root: string, reportPath: string): RuntimeContextRegistry {
  const registry = readRegistryOrDefault(root);
  const parsed = parseBmadAuditResult(fs.readFileSync(reportPath, 'utf8'));
  const artifactDocPath = normalizeText(parsed.artifactDocPath);
  const flow = inferAuditIndexFlowFromParsedStage(parsed.stage, artifactDocPath);

  if (!artifactDocPath || !flow || (parsed.status !== 'PASS' && parsed.status !== 'FAIL')) {
    return registry;
  }

  const existing = registry.auditIndex[flow][path.normalize(artifactDocPath)];
  registry.auditIndex[flow][path.normalize(artifactDocPath)] = {
    artifactDocPath,
    reportPath: path.normalize(reportPath),
    status: parsed.status,
    ...(flow === 'bugfix' || flow === 'standalone_tasks'
      ? { stage: parsed.stage === flow ? flow : existing?.stage ?? flow }
      : {}),
    ...(existing?.closeoutApproved !== undefined
      ? { closeoutApproved: existing.closeoutApproved }
      : {}),
    converged: parsed.converged ?? existing?.converged,
    iterationCount: parsed.iterationCount ?? existing?.iterationCount,
    updatedAt: new Date().toISOString(),
  };
  registry.updatedAt = new Date().toISOString();
  writeRuntimeContextRegistry(root, registry);
  return registry;
}

export function recordAuthoritativeAuditCloseout(
  root: string,
  input: {
    flow: 'bugfix' | 'standalone_tasks';
    artifactDocPath: string;
    reportPath: string;
    status: 'PASS' | 'FAIL' | 'UNKNOWN';
    closeoutApproved: boolean;
  }
): RuntimeContextRegistry {
  const registry = readRegistryOrDefault(root);
  const artifactKey = path.normalize(input.artifactDocPath);
  const existing = registry.auditIndex[input.flow][artifactKey];
  registry.auditIndex[input.flow][artifactKey] = {
    artifactDocPath: input.artifactDocPath,
    reportPath: path.normalize(input.reportPath),
    status:
      input.status === 'FAIL'
        ? 'FAIL'
        : input.status === 'PASS'
          ? 'PASS'
          : existing?.status ?? 'FAIL',
    stage: input.flow,
    closeoutApproved: input.closeoutApproved,
    converged: existing?.converged,
    iterationCount: existing?.iterationCount,
    updatedAt: new Date().toISOString(),
  };
  registry.updatedAt = new Date().toISOString();
  writeRuntimeContextRegistry(root, registry);
  return registry;
}

export function syncAuditIndexFromAllReports(root: string): RuntimeContextRegistry {
  let registry = readRegistryOrDefault(root);
  for (const reportPath of listStructuredAuditReports(root)) {
    registry = syncAuditIndexFromReport(root, reportPath);
  }
  return registry;
}

function writeJsonWithFsync(file: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
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

function mergeLatestReviewerCloseoutIntoContextFile(
  contextPath: string,
  closeout: ReviewerLatestCloseoutRecord
): void {
  if (!fs.existsSync(contextPath)) {
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(contextPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return;
  }

  parsed.latestReviewerCloseout = closeout;
  parsed.updatedAt = new Date().toISOString();
  writeJsonWithFsync(contextPath, parsed);
}

export function recordLatestReviewerCloseout(
  root: string,
  closeout: ReviewerLatestCloseoutRecord
): RuntimeContextRegistry {
  const registry = readRegistryOrDefault(root);
  registry.latestReviewerCloseout = closeout;
  registry.updatedAt = new Date().toISOString();
  writeRuntimeContextRegistry(root, registry);

  const scope = resolveActiveScope(registry, registry.activeScope);
  const resolvedContextPath = path.isAbsolute(scope.resolvedContextPath ?? '')
    ? (scope.resolvedContextPath as string)
    : path.resolve(root, resolveContextPathFromActiveScope(registry, scope));
  mergeLatestReviewerCloseoutIntoContextFile(resolvedContextPath, closeout);
  return registry;
}
