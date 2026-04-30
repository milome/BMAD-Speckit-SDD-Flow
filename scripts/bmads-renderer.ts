/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { resolveBmadHelpFiveLayerProgressState } from './main-agent-bmad-help-five-layer-matrix';
import { resolveMainAgentOrchestrationSurface } from './main-agent-orchestration';

interface BmadsRuntimeContract {
  schemaVersion: string;
  contracts: {
    governance: string;
    dispatch: string;
    stageMapping: string;
  };
  entry: {
    canonicalCommand: string;
    aliases: string[];
    advisory: {
      bmadHelpCommand: string;
      message: string;
    };
  };
  layers: Array<{
    id: string;
    name: string;
    stages: Array<{
      id: string;
      governanceStage: string;
      requiredGovernanceSignalsFrom: string;
      recommendedWorkflows?: string[];
      dispatch?: {
        taskType: string;
        hosts: string[];
      };
      gates?: {
        required: string[];
      };
      next?: {
        layer: string;
        stage: string;
      };
    }>;
  }>;
}

interface RenderOptions {
  projectRoot: string;
  json?: boolean;
}

type StageStatus = {
  layer: string;
  stage: string;
  completed: boolean;
  evidenceKind: string;
  evidencePath: string;
};

type ReadinessStatus = {
  status: 'ready' | 'missing' | 'stale';
  reportPath: string | null;
  reason: string;
};

type ArtifactKind = 'productBriefs' | 'prds' | 'architectures' | 'epics';

type UpstreamArtifact = {
  path: string;
  bytes: number;
  updatedAt: string;
};

type UpstreamArtifacts = Record<ArtifactKind, UpstreamArtifact[]>;

function parseArgs(argv: string[]): RenderOptions {
  const options: RenderOptions = { projectRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') options.projectRoot = argv[++index] ?? options.projectRoot;
    else if (arg.startsWith('--cwd=')) options.projectRoot = arg.slice('--cwd='.length);
    else if (arg === '--json') options.json = true;
  }
  if (process.env.npm_config_json === 'true') options.json = true;
  return options;
}

function loadRuntimeContract(projectRoot: string): BmadsRuntimeContract {
  const contractPath = path.join(projectRoot, '_bmad', '_config', 'bmads-runtime.yaml');
  const parsed = yaml.load(fs.readFileSync(contractPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('bmads-runtime.yaml must be a YAML object');
  }
  return parsed as BmadsRuntimeContract;
}

function existsRelative(projectRoot: string, relativePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function toProjectRelative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function collectFilesRecursive(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(entryPath);
    }
  };
  visit(root);
  return files;
}

function artifactRecord(projectRoot: string, filePath: string): UpstreamArtifact {
  const stat = fs.statSync(filePath);
  return {
    path: toProjectRelative(projectRoot, filePath),
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function collectUpstreamArtifacts(projectRoot: string): UpstreamArtifacts {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const files = collectFilesRecursive(planningRoot);
  const byName = (predicate: (name: string) => boolean): UpstreamArtifact[] =>
    files
      .filter((filePath) => predicate(path.basename(filePath).toLowerCase()))
      .map((filePath) => artifactRecord(projectRoot, filePath))
      .sort((left, right) => left.path.localeCompare(right.path));
  return {
    productBriefs: byName((name) => /^product-brief.*\.md$/.test(name) || /^brief.*\.md$/.test(name)),
    prds: byName((name) => name === 'prd.md' || /^prd[._-].*\.md$/.test(name)),
    architectures: byName((name) => name === 'architecture.md' || /^arch(?:itecture)?[._-].*\.md$/.test(name)),
    epics: byName((name) => name === 'epics.md' || /^epics[._-].*\.md$/.test(name)),
  };
}

function findLatestReadinessReport(projectRoot: string): string | null {
  const roots = [
    path.join(projectRoot, '_bmad-output', 'planning-artifacts'),
    path.join(projectRoot, '_bmad-output', 'implementation-artifacts'),
  ];
  const matches: Array<{ filePath: string; mtimeMs: number }> = [];
  const visit = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i.test(entry.name)) {
        matches.push({ filePath: entryPath, mtimeMs: fs.statSync(entryPath).mtimeMs });
      }
    }
  };
  for (const root of roots) visit(root);
  matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return matches[0]?.filePath ?? null;
}

function resolveReadinessStatus(projectRoot: string): ReadinessStatus {
  const reportPath = findLatestReadinessReport(projectRoot);
  if (!reportPath) {
    return {
      status: 'missing',
      reportPath: null,
      reason: 'No implementation-readiness report was found.',
    };
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const hasReadyConclusion =
    /\bREADY\b/i.test(content) ||
    /ready_clean/i.test(content) ||
    /repair_closed/i.test(content) ||
    /Overall Readiness Status\s*\n+\s*\*\*READY\*\*/i.test(content);
  if (!hasReadyConclusion) {
    return {
      status: 'missing',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason: 'Latest implementation-readiness report does not state READY / ready_clean / repair_closed.',
    };
  }
  const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  if (
    fs.existsSync(runtimeContextPath) &&
    fs.statSync(reportPath).mtimeMs < fs.statSync(runtimeContextPath).mtimeMs
  ) {
    return {
      status: 'stale',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason: 'Latest implementation-readiness report is older than the active runtime context.',
    };
  }
  return {
    status: 'ready',
    reportPath: toProjectRelative(projectRoot, reportPath),
    reason: 'Latest implementation-readiness report states READY / ready_clean / repair_closed.',
  };
}

function filterRecommendedWorkflows(input: {
  currentStage: string;
  workflows: string[];
  readiness: ReadinessStatus;
}): string[] {
  if (input.currentStage !== 'story_create') return input.workflows;
  if (input.readiness.status === 'ready') return input.workflows;
  return input.workflows.filter((workflow) => workflow !== 'bmad-story-assistant');
}

export function buildBmadsOutput(projectRootInput = process.cwd()): Record<string, unknown> {
  const projectRoot = path.resolve(projectRootInput);
  const runtime = loadRuntimeContract(projectRoot);
  const progress = resolveBmadHelpFiveLayerProgressState({ projectRoot });
  const orchestration = resolveMainAgentOrchestrationSurface({ projectRoot });
  const readiness = resolveReadinessStatus(projectRoot);
  const artifacts = collectUpstreamArtifacts(projectRoot);
  const currentRoute = runtime.layers
    .flatMap((layer) => layer.stages.map((stage) => ({ layer, stage })))
    .find((item) => item.layer.id === progress.currentLayer && item.stage.id === progress.currentStage);
  const contractStatus = {
    governance: existsRelative(projectRoot, runtime.contracts.governance),
    dispatch: existsRelative(projectRoot, runtime.contracts.dispatch),
    stageMapping: existsRelative(projectRoot, runtime.contracts.stageMapping),
  };
  return {
    console: 'BMADS Runtime Console',
    projectRoot,
    schemaVersion: runtime.schemaVersion,
    entry: runtime.entry,
    contracts: runtime.contracts,
    contractStatus,
    artifacts,
    progress,
    currentRoute: currentRoute
      ? {
          layer: currentRoute.layer.id,
          layerName: currentRoute.layer.name,
          stage: currentRoute.stage.id,
          governanceStage: currentRoute.stage.governanceStage,
          requiredGovernanceSignalsFrom: currentRoute.stage.requiredGovernanceSignalsFrom,
          recommendedWorkflows: filterRecommendedWorkflows({
            currentStage: progress.currentStage,
            workflows: currentRoute.stage.recommendedWorkflows ?? [],
            readiness,
          }),
          blockedWorkflows:
            progress.currentStage === 'story_create' && readiness.status !== 'ready'
              ? [
                  {
                    workflow: 'bmad-story-assistant',
                    reason: 'implementation-readiness must be READY / ready_clean / repair_closed before story development.',
                  },
                ]
              : [],
          dispatch: currentRoute.stage.dispatch ?? null,
          gates: currentRoute.stage.gates ?? null,
          next: currentRoute.stage.next ?? null,
        }
      : null,
    readiness,
    orchestration: {
      nextAction: orchestration.nextAction,
      ready: orchestration.mainAgentReady,
      pendingPacketStatus: orchestration.pendingPacketStatus,
      sessionId: orchestration.sessionId,
    },
    advisory: runtime.entry.advisory,
    commandHints: [
      'bmads',
      'bmad-speckit bmads',
      'bmad-speckit main-agent-orchestration --action inspect',
      'bmad-speckit main-agent-orchestration --action dispatch-plan --host codex',
      'bmad-speckit main-agent:release-gate',
      'bmad-speckit main-agent:delivery-truth-gate',
    ],
  };
}

export function renderBmads(output: Record<string, unknown>): string {
  const progress = output.progress as {
    currentLayer: string;
    currentStage: string;
    nextRequiredLayer: string;
    completedLayers: string[];
    stageStatuses: StageStatus[];
  };
  const route = output.currentRoute as null | {
    layerName: string;
    governanceStage: string;
    requiredGovernanceSignalsFrom: string;
    recommendedWorkflows: string[];
    blockedWorkflows?: Array<{ workflow: string; reason: string }>;
    dispatch: null | { taskType: string; hosts: string[] };
    gates: null | { required: string[] };
    next: null | { layer: string; stage: string };
  };
  const readiness = output.readiness as ReadinessStatus;
  const artifacts = output.artifacts as UpstreamArtifacts;
  const orchestration = output.orchestration as {
    nextAction: string | null;
    ready: boolean | null;
    pendingPacketStatus: string;
    sessionId: string;
  };
  const contractStatus = output.contractStatus as Record<string, boolean>;
  const advisory = output.advisory as { bmadHelpCommand: string; message: string };
  const lines = [
    '# BMADS Runtime Console',
    '',
    '## Project State',
    '',
    `Current: ${progress.currentLayer} / ${progress.currentStage}`,
    `Next required: ${progress.nextRequiredLayer}`,
    `Completed layers: ${progress.completedLayers.length > 0 ? progress.completedLayers.join(', ') : 'none'}`,
    '',
    '## Upstream BMAD Artifacts',
    '',
    ...renderArtifactGroup('Product briefs', artifacts.productBriefs),
    ...renderArtifactGroup('PRDs', artifacts.prds),
    ...renderArtifactGroup('Architectures', artifacts.architectures),
    ...renderArtifactGroup('Epics', artifacts.epics),
    '',
    '## Completed Layer Artifacts',
    '',
    ...progress.stageStatuses
      .filter((item) => progress.completedLayers.includes(item.layer))
      .map((item) => `- ${item.layer}/${item.stage}: ${item.evidenceKind} ${item.evidencePath}`),
    ...(progress.completedLayers.length === 0 ? ['- none'] : []),
    '',
    '## Implementation Readiness',
    '',
    `Status: ${readiness.status}`,
    `Reason: ${readiness.reason}`,
    `Report: ${readiness.reportPath ?? 'none'}`,
    '',
    '## Current Route',
    '',
  ];
  if (route) {
    lines.push(`Layer name: ${route.layerName}`);
    lines.push(`Governance stage: ${route.governanceStage}`);
    lines.push(`Governance source: ${route.requiredGovernanceSignalsFrom}`);
    lines.push(`Recommended workflows: ${route.recommendedWorkflows.length > 0 ? route.recommendedWorkflows.join(', ') : 'none'}`);
    if (route.blockedWorkflows && route.blockedWorkflows.length > 0) {
      lines.push('Blocked workflows:');
      for (const item of route.blockedWorkflows) lines.push(`- ${item.workflow}: ${item.reason}`);
    }
    if (route.dispatch) lines.push(`Dispatch: ${route.dispatch.taskType} via ${route.dispatch.hosts.join(', ')}`);
    if (route.gates) lines.push(`Required gates: ${route.gates.required.join(', ')}`);
    if (route.next) lines.push(`Next: ${route.next.layer} / ${route.next.stage}`);
  } else {
    lines.push('No route matched current layer/stage.');
  }
  lines.push(
    '',
    '## Main Agent',
    '',
    `Next action: ${orchestration.nextAction ?? 'none'}`,
    `Ready: ${String(orchestration.ready)}`,
    `Pending packet: ${orchestration.pendingPacketStatus}`,
    `Session: ${orchestration.sessionId}`,
    '',
    '## Contract Status',
    '',
    ...Object.entries(contractStatus).map(([name, exists]) => `- ${name}: ${exists ? 'present' : 'missing'}`),
    '',
    '## Stage Evidence',
    '',
    ...progress.stageStatuses.map((item) => `- ${item.layer}/${item.stage}: ${item.completed ? 'complete' : 'missing'} (${item.evidenceKind}) ${item.evidencePath}`),
    '',
    '## Command Hints',
    '',
    ...(output.commandHints as string[]).map((item) => `- ${item}`),
    '',
    '## BMAD Method Advisory',
    '',
    `${advisory.message} Command: \`${advisory.bmadHelpCommand}\`.`,
  );
  return `${lines.join('\n')}\n`;
}

function renderArtifactGroup(label: string, artifacts: UpstreamArtifact[]): string[] {
  if (artifacts.length === 0) return [`${label}: missing`];
  return [
    `${label}:`,
    ...artifacts.map((item) => `- ${item.path} (${item.bytes} bytes, updated ${item.updatedAt})`),
  ];
}

export function mainBmadsRenderer(argv: string[] = process.argv.slice(2)): number {
  try {
    const options = parseArgs(argv);
    const output = buildBmadsOutput(options.projectRoot);
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else process.stdout.write(renderBmads(output));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = mainBmadsRenderer();
}
