#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveYamlModule() {
  const candidates = [
    'js-yaml',
    path.join(process.cwd(), 'node_modules', 'js-yaml'),
    path.join(process.cwd(), '..', 'BMAD-Speckit-SDD-Flow', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'js-yaml'),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new Error('Cannot resolve js-yaml from hook runtime');
}

const yaml = resolveYamlModule();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify(value, null, 2) + '\n';
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

function branchName(projectRoot) {
  const headPath = path.join(projectRoot, '.git', 'HEAD');
  if (!fs.existsSync(headPath)) return 'dev';
  const raw = fs.readFileSync(headPath, 'utf8').trim();
  const match = /^ref: refs\/heads\/(.+)$/.exec(raw);
  return match ? match[1] : 'dev';
}

function projectContextPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
}

function registryPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'registry.json');
}

function defaultRegistry(projectRoot) {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectRoot,
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
    activeScope: {
      scopeType: 'project',
      resolvedContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
      reason: 'default project scope',
    },
  };
}

function readRegistryOrDefault(projectRoot) {
  const file = registryPath(projectRoot);
  if (!fs.existsSync(file)) {
    return defaultRegistry(projectRoot);
  }
  return readJson(file);
}

function resolveProjectPath(projectRoot, candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  return path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
}

function resolveActiveContextPath(projectRoot, registry) {
  const scope = registry && registry.activeScope ? registry.activeScope : null;
  const byResolved = resolveProjectPath(projectRoot, scope && scope.resolvedContextPath);
  if (byResolved) return byResolved;
  if (scope && scope.scopeType === 'run' && scope.runId && registry.runContexts?.[scope.runId]?.path) {
    return resolveProjectPath(projectRoot, registry.runContexts[scope.runId].path);
  }
  if (
    scope &&
    scope.scopeType === 'story' &&
    scope.storyId &&
    registry.storyContexts?.[scope.storyId]?.path
  ) {
    return resolveProjectPath(projectRoot, registry.storyContexts[scope.storyId].path);
  }
  if (
    scope &&
    scope.scopeType === 'epic' &&
    scope.epicId &&
    registry.epicContexts?.[scope.epicId]?.path
  ) {
    return resolveProjectPath(projectRoot, registry.epicContexts[scope.epicId].path);
  }
  const byProject = resolveProjectPath(projectRoot, registry && registry.projectContextPath);
  return byProject || projectContextPath(projectRoot);
}

function readRuntimeContextFile(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function loadRuntimeContext(projectRoot, registry) {
  const activeContextPath = resolveActiveContextPath(projectRoot, registry);
  const active = readRuntimeContextFile(activeContextPath);
  if (active) {
    return {
      context: active,
      activeContextPath,
      projectContextPath: projectContextPath(projectRoot),
    };
  }
  const projectPath = projectContextPath(projectRoot);
  return {
    context: readRuntimeContextFile(projectPath),
    activeContextPath,
    projectContextPath: projectPath,
  };
}

function loadYaml(file) {
  if (!fs.existsSync(file)) return null;
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function loadContinueGateRouting(projectRoot) {
  return loadYaml(path.join(projectRoot, '_bmad', '_config', 'continue-gate-routing.yaml'));
}

function normalizeSlashes(value) {
  return typeof value === 'string' ? value.replace(/\\/g, '/') : value;
}

function asRelativeToProject(projectRoot, targetPath) {
  if (!targetPath) return null;
  const absolute = path.resolve(targetPath);
  const relative = path.relative(projectRoot, absolute);
  if (relative.startsWith('..')) {
    return normalizeSlashes(absolute);
  }
  return normalizeSlashes(relative);
}

function readFrontmatter(file) {
  if (!file || !fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const source = raw.slice(3, end).trim();
  try {
    return yaml.load(source) || null;
  } catch {
    return null;
  }
}

function basenameWithoutExt(file) {
  return path.basename(file, path.extname(file)).toLowerCase();
}

function escapeRegex(source) {
  return source.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globSegmentToRegex(segment) {
  return escapeRegex(segment)
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')
    .replace(/\\\?/g, '[^/]');
}

function listFilesRecursive(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const output = [];
  const queue = [baseDir];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(target);
        continue;
      }
      output.push(target);
    }
  }
  return output;
}

function resolveGlobMatches(pattern) {
  const absolutePattern = path.resolve(pattern);
  if (!/[*?]/.test(absolutePattern)) {
    return fs.existsSync(absolutePattern) ? [absolutePattern] : [];
  }
  const parsed = path.parse(absolutePattern);
  const remainder = absolutePattern.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean);
  const staticSegments = [];
  for (const segment of remainder) {
    if (/[*?]/.test(segment)) break;
    staticSegments.push(segment);
  }
  const baseDir = path.join(parsed.root, ...staticSegments);
  if (!fs.existsSync(baseDir)) return [];
  const relativePattern = remainder
    .slice(staticSegments.length)
    .map((segment) => globSegmentToRegex(segment))
    .join('/');
  const matcher = new RegExp(`^${relativePattern}$`, 'i');
  return listFilesRecursive(baseDir)
    .filter((file) => matcher.test(normalizeSlashes(path.relative(baseDir, file))))
    .sort((left, right) => left.localeCompare(right));
}

function replacePatternTokens(pattern, tokens) {
  let result = pattern;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

function resolveArtifactCandidates(projectRoot, route, currentContext, branch) {
  const planningArtifacts = normalizeSlashes(path.join(projectRoot, '_bmad-output', 'planning-artifacts'));
  const specsRoot = normalizeSlashes(path.join(projectRoot, 'specs'));
  const tokens = {
    branch,
    planning_artifacts: planningArtifacts,
    specs_root: specsRoot,
    epicId: currentContext?.epicId || '',
    storyId: currentContext?.storyId || '',
    artifact_root: currentContext?.artifactRoot
      ? normalizeSlashes(path.join(projectRoot, currentContext.artifactRoot))
      : '',
  };
  const configured = Array.isArray(route?.artifact?.candidates) ? route.artifact.candidates : [];
  if (configured.length > 0) {
    return configured.map((pattern) => replacePatternTokens(pattern, tokens));
  }
  const workflow = String(route?.workflow || currentContext?.workflow || '').toLowerCase();
  if (workflow.includes('product-brief')) {
    return [
      replacePatternTokens('{planning_artifacts}/{branch}/product-brief-*.md', tokens),
      replacePatternTokens('{planning_artifacts}/product-brief-*.md', tokens),
    ];
  }
  if (workflow.includes('create-prd')) {
    return [
      replacePatternTokens('{planning_artifacts}/{branch}/prd.md', tokens),
      replacePatternTokens('{planning_artifacts}/prd.md', tokens),
    ];
  }
  if (workflow.includes('create-architecture')) {
    return [
      replacePatternTokens('{planning_artifacts}/{branch}/architecture.md', tokens),
      replacePatternTokens('{planning_artifacts}/architecture.md', tokens),
    ];
  }
  if (workflow.includes('implementation-readiness')) {
    return [
      replacePatternTokens('{planning_artifacts}/{branch}/implementation-readiness-report-*.md', tokens),
      replacePatternTokens('{planning_artifacts}/implementation-readiness-report-*.md', tokens),
    ];
  }
  if (workflow.includes('create-epics-and-stories')) {
    return [
      replacePatternTokens('{planning_artifacts}/{branch}/epics.md', tokens),
      replacePatternTokens('{planning_artifacts}/epics.md', tokens),
    ];
  }
  if (currentContext?.artifactRoot && currentContext?.storyId) {
    return [
      replacePatternTokens('{artifact_root}/*.md', tokens),
      replacePatternTokens('{specs_root}/**/*{storyId}*.md', tokens),
    ];
  }
  return [
    replacePatternTokens('{specs_root}/**/*.md', tokens),
  ];
}

function resolveArtifactPath(projectRoot, route, currentContext, explicitArtifactPath, branch) {
  const explicit = resolveProjectPath(projectRoot, explicitArtifactPath || currentContext?.artifactPath);
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }
  for (const pattern of resolveArtifactCandidates(projectRoot, route, currentContext, branch)) {
    const matches = resolveGlobMatches(pattern);
    if (matches.length > 0) {
      return matches[0];
    }
  }
  return explicit || null;
}

function resolveRoute(routingConfig, workflow) {
  if (!routingConfig || !Array.isArray(routingConfig.routes) || !workflow) return null;
  return (
    routingConfig.routes.find((route) => {
      const aliases = Array.isArray(route.aliases) ? route.aliases : [];
      return route.workflow === workflow || aliases.includes(workflow);
    }) || null
  );
}

function resolveRouteByWorkflowType(routingConfig, workflowType) {
  if (!routingConfig || !Array.isArray(routingConfig.routes) || !workflowType) return null;
  return (
    routingConfig.routes.find((route) =>
      Array.isArray(route.workflow_types) && route.workflow_types.includes(workflowType)
    ) || null
  );
}

function inferRouteFromArtifact(routingConfig, artifactPath, frontmatter) {
  const workflowType = frontmatter && typeof frontmatter.workflowType === 'string'
    ? frontmatter.workflowType.trim()
    : '';
  const byType = resolveRouteByWorkflowType(routingConfig, workflowType);
  if (byType) return byType;
  const base = basenameWithoutExt(artifactPath || '');
  if (base === 'prd') return resolveRoute(routingConfig, 'bmad-create-prd');
  if (base === 'architecture') return resolveRoute(routingConfig, 'bmad-create-architecture');
  if (base === 'epics') return resolveRoute(routingConfig, 'bmad-create-epics-and-stories');
  if (base.startsWith('product-brief-')) return resolveRoute(routingConfig, 'bmad-create-product-brief');
  if (base.startsWith('implementation-readiness-report-')) {
    return resolveRoute(routingConfig, 'bmad-check-implementation-readiness');
  }
  return null;
}

function parseStepOrder(stepName) {
  const match = /^step-(\d+)[-_]/i.exec(stepName || '') || /^step-(\d+)$/i.exec(stepName || '');
  return match ? Number(match[1]) : null;
}

function inferStepFromFrontmatter(route, frontmatter) {
  if (!route || !route.steps) return 'workflow';
  const routeSteps = Object.keys(route.steps).filter((key) => key !== 'workflow');
  if (routeSteps.length === 0) return 'workflow';

  const completedStrings = [];
  const completedNumbers = [];
  const pushStepValue = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      completedNumbers.push(value);
      return;
    }
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (!normalized) return;
    completedStrings.push(normalized);
    const numeric = parseStepOrder(normalized);
    if (numeric != null) {
      completedNumbers.push(numeric);
      return;
    }
    if (/^\d+$/.test(normalized)) {
      completedNumbers.push(Number(normalized));
    }
  };

  if (frontmatter && Array.isArray(frontmatter.stepsCompleted)) {
    for (const value of frontmatter.stepsCompleted) {
      pushStepValue(value);
    }
  }
  if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, 'lastStep')) {
    pushStepValue(frontmatter.lastStep);
  }

  const exactMatches = routeSteps.filter((stepName) => completedStrings.includes(stepName));
  if (exactMatches.length > 0) {
    return exactMatches.sort((left, right) => {
      const leftOrder = parseStepOrder(left) || 0;
      const rightOrder = parseStepOrder(right) || 0;
      return rightOrder - leftOrder;
    })[0];
  }

  const maxCompleted = completedNumbers.length > 0 ? Math.max(...completedNumbers) : null;
  if (maxCompleted != null) {
    const numericMatches = routeSteps
      .map((stepName) => ({ stepName, order: parseStepOrder(stepName) }))
      .filter((item) => item.order != null && item.order <= maxCompleted)
      .sort((left, right) => right.order - left.order);
    if (numericMatches.length > 0) {
      return numericMatches[0].stepName;
    }
  }

  return route.steps.workflow ? 'workflow' : routeSteps[0];
}

function normalizeExplicitStep(route, step) {
  if (!step) return '';
  if (!route || !route.steps) return step;
  if (route.steps[step]) return step;
  if (step === 'workflow' && route.steps.workflow) return 'workflow';
  return step;
}

function deriveStageFromWorkflow(workflow) {
  const lower = String(workflow || '').toLowerCase();
  if (lower.includes('create-product-brief') || lower.includes('create-prd')) return 'prd';
  if (lower.includes('create-architecture') || lower.includes('implementation-readiness')) return 'arch';
  if (lower.includes('create-epics-and-stories')) return 'epics';
  if (lower.includes('create-story')) return 'story_create';
  if (lower.includes('dev-story') || lower.includes('speckit')) return 'implement';
  return null;
}

function buildScopeFromArtifactPath(currentContext, artifactPath) {
  const out = {
    epicId: currentContext?.epicId || null,
    storyId: currentContext?.storyId || null,
  };
  if (artifactPath && (!out.epicId || !out.storyId)) {
    const normalized = normalizeSlashes(artifactPath);
    const match = /\/(epic-[^/]+)\/(story-[^/]+)\//i.exec(normalized);
    if (match) {
      out.epicId = out.epicId || match[1];
      out.storyId = out.storyId || match[2];
    }
  }
  return out;
}

function parseHookInput(hookInput) {
  if (!hookInput || typeof hookInput !== 'object') {
    return {};
  }
  const direct = {
    workflow: typeof hookInput.workflow === 'string' ? hookInput.workflow : '',
    step: typeof hookInput.step === 'string' ? hookInput.step : '',
    artifactPath: typeof hookInput.artifactPath === 'string' ? hookInput.artifactPath : '',
  };
  const nested = hookInput.tool_input && typeof hookInput.tool_input === 'object'
    ? hookInput.tool_input
    : {};
  return {
    workflow: direct.workflow || (typeof nested.workflow === 'string' ? nested.workflow : ''),
    step: direct.step || (typeof nested.step === 'string' ? nested.step : ''),
    artifactPath:
      direct.artifactPath ||
      (typeof nested.artifactPath === 'string' ? nested.artifactPath : '') ||
      (typeof nested.file_path === 'string' ? nested.file_path : '') ||
      (typeof hookInput.file_path === 'string' ? hookInput.file_path : ''),
  };
}

function resolveRuntimeStepState(projectRoot, options) {
  const argv = Array.isArray(options?.argv) ? options.argv : process.argv;
  const env = options?.env || process.env;
  const hookValues = parseHookInput(options?.hookInput);
  const registry = readRegistryOrDefault(projectRoot);
  const runtimeContextRecord = loadRuntimeContext(projectRoot, registry);
  const currentContext = runtimeContextRecord.context || {};
  const routingConfig = loadContinueGateRouting(projectRoot);
  const branch = branchName(projectRoot);

  const explicitWorkflow =
    (options?.workflow || '').trim() ||
    hookValues.workflow ||
    (argv[2] || '').trim() ||
    (env.BMAD_WORKFLOW || '').trim() ||
    (env.BMAD_PRECONTINUE_WORKFLOW || '').trim() ||
    (currentContext.workflow || '').trim() ||
    (currentContext.templateId || '').trim();

  const explicitArtifactPath =
    (options?.artifactPath || '').trim() ||
    hookValues.artifactPath ||
    (argv[4] || '').trim() ||
    (env.BMAD_ARTIFACT_PATH || '').trim() ||
    (env.BMAD_PRECONTINUE_ARTIFACT_PATH || '').trim() ||
    (currentContext.artifactPath || '').trim();

  const initialRoute = resolveRoute(routingConfig, explicitWorkflow);
  const initialArtifactPath = resolveArtifactPath(
    projectRoot,
    initialRoute,
    currentContext,
    explicitArtifactPath,
    branch
  );
  const frontmatter = readFrontmatter(initialArtifactPath);
  const inferredRoute = initialRoute || inferRouteFromArtifact(routingConfig, initialArtifactPath, frontmatter);
  const canonicalRoute = inferredRoute;
  const workflow = canonicalRoute?.workflow || explicitWorkflow;

  const explicitStep =
    (options?.step || '').trim() ||
    hookValues.step ||
    (argv[3] || '').trim() ||
    (env.BMAD_STEP || '').trim() ||
    (env.BMAD_PRECONTINUE_STEP || '').trim() ||
    (currentContext.step || '').trim();

  const step =
    normalizeExplicitStep(canonicalRoute, explicitStep) ||
    inferStepFromFrontmatter(canonicalRoute, frontmatter) ||
    'workflow';

  const artifactPath = resolveArtifactPath(
    projectRoot,
    canonicalRoute,
    currentContext,
    initialArtifactPath,
    branch
  );
  const scope = buildScopeFromArtifactPath(currentContext, artifactPath);
  const flow = canonicalRoute?.flow || currentContext.flow || 'story';
  const stage =
    canonicalRoute?.stage ||
    currentContext.stage ||
    deriveStageFromWorkflow(workflow) ||
    'specify';
  const rerunGate =
    canonicalRoute?.steps?.[step] ||
    canonicalRoute?.steps?.workflow ||
    null;
  const artifactRoot = artifactPath ? asRelativeToProject(projectRoot, path.dirname(artifactPath)) : null;

  return {
    workflow,
    step,
    flow,
    stage,
    rerunGate,
    artifactPath: artifactPath ? normalizeSlashes(artifactPath) : null,
    artifactRoot,
    branch,
    epicId: scope.epicId,
    storyId: scope.storyId,
    route: canonicalRoute || null,
    frontmatter: frontmatter || null,
    registry,
    runtimeContext: currentContext,
    activeContextPath: runtimeContextRecord.activeContextPath,
    projectContextPath: runtimeContextRecord.projectContextPath,
    contextScope:
      currentContext.contextScope ||
      (registry.activeScope?.scopeType === 'project' ? 'project' : 'story'),
  };
}

function persistRuntimeStepState(projectRoot, resolvedState) {
  const registry = resolvedState.registry || readRegistryOrDefault(projectRoot);
  const activeContextPath =
    resolvedState.activeContextPath || resolveActiveContextPath(projectRoot, registry);
  const projectPath = resolvedState.projectContextPath || projectContextPath(projectRoot);
  const currentProjectContext = readRuntimeContextFile(projectPath) || {};
  const currentActiveContext =
    activeContextPath === projectPath
      ? currentProjectContext
      : readRuntimeContextFile(activeContextPath) || currentProjectContext;

  const nextPayload = {
    ...currentActiveContext,
    version: typeof currentActiveContext.version === 'number' ? currentActiveContext.version : 1,
    flow: resolvedState.flow || currentActiveContext.flow || 'story',
    stage: resolvedState.stage || currentActiveContext.stage || 'specify',
    contextScope:
      resolvedState.contextScope ||
      currentActiveContext.contextScope ||
      (registry.activeScope?.scopeType === 'project' ? 'project' : 'story'),
    updatedAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries({
    templateId: currentActiveContext.templateId,
    sourceMode: currentActiveContext.sourceMode,
    storySlug: currentActiveContext.storySlug,
    runId: currentActiveContext.runId,
  })) {
    if (value !== undefined && value !== null && value !== '') {
      nextPayload[key] = value;
    }
  }

  for (const [key, value] of Object.entries({
    workflow: resolvedState.workflow,
    step: resolvedState.step,
    artifactPath: resolvedState.artifactPath,
    artifactRoot: resolvedState.artifactRoot,
    epicId: resolvedState.epicId,
    storyId: resolvedState.storyId,
  })) {
    if (value !== undefined && value !== null && value !== '') {
      nextPayload[key] = value;
    }
  }

  writeJsonAtomic(activeContextPath, nextPayload);
  if (activeContextPath !== projectPath) {
    writeJsonAtomic(projectPath, nextPayload);
  }

  const relativeActive = asRelativeToProject(projectRoot, activeContextPath);
  if (!registry.activeScope) {
    registry.activeScope = { scopeType: 'project' };
  }
  if (!registry.activeScope.resolvedContextPath) {
    registry.activeScope.resolvedContextPath = relativeActive;
  } else {
    registry.activeScope.resolvedContextPath = relativeActive;
  }
  registry.updatedAt = new Date().toISOString();
  writeJsonAtomic(registryPath(projectRoot), registry);

  return {
    ...resolvedState,
    activeContextPath,
    projectContextPath: projectPath,
    persistedContext: nextPayload,
    registry,
  };
}

module.exports = {
  branchName,
  loadContinueGateRouting,
  readFrontmatter,
  readRegistryOrDefault,
  resolveRoute,
  resolveRouteByWorkflowType,
  resolveRuntimeStepState,
  persistRuntimeStepState,
};
