/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { loadConfig, resolveBmadHelpRuntimePolicy, type StageName } from './bmad-config';
import {
  validateLayer1PrdCompletionMarker,
  writeLayer1PrdCompletionMarker,
} from './bmad-help-five-layer-progress-marker';
export {
  buildLayer1PrdCompletionMarker,
  validateLayer1PrdCompletionMarker,
  writeLayer1PrdCompletionMarker,
} from './bmad-help-five-layer-progress-marker';
import {
  buildMainAgentDispatchInstruction,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from './main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from './runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';
import type { RuntimeFlowId } from './runtime-governance';

interface LayerDefinition {
  id: 'layer_1' | 'layer_2' | 'layer_3' | 'layer_4' | 'layer_5';
  name: string;
  flow: RuntimeFlowId;
  stages: StageName[];
  outputRoot: string;
}

export interface BmadHelpFiveLayerMatrixStep {
  id: string;
  layer: string;
  stage: StageName;
  passed: boolean;
  recommendationLabel: string;
  orchestration: {
    initialNextAction: string | null;
    packetId: string | null;
    runLoopStatus: string;
    finalNextAction: string | null;
    pendingPacketStatus: string;
  };
  evidence: string[];
}

export interface BmadHelpFiveLayerStageStatus {
  layer: LayerDefinition['id'];
  stage: StageName;
  completed: boolean;
  evidencePath: string;
  evidenceKind: 'strict_marker' | 'upstream_artifact' | 'gate_report' | 'missing';
}

export interface BmadHelpFiveLayerProgressState {
  currentLayer: LayerDefinition['id'];
  currentStage: StageName;
  nextRequiredLayer: LayerDefinition['id'];
  completedLayers: LayerDefinition['id'][];
  stageStatuses: BmadHelpFiveLayerStageStatus[];
}

export interface BmadHelpFiveLayerMatrixReport {
  reportType: 'bmad_help_five_layer_main_agent_matrix';
  generatedAt: string;
  projectRoot: string;
  bmadHelpEntry: {
    command: 'bmad-help';
    firstScreenPolicy: 'recommended_or_blocked_state_aware';
    catalogLoaded: boolean;
    canonicalHelpWorkflow: boolean;
    codexFirstClass: boolean;
    fiveLayerCatalog: boolean;
    docsExposeCodex: boolean;
    bmadsRuntimeContract: boolean;
    bmadHelpIsUpstreamOnly: boolean;
  };
  progressState: BmadHelpFiveLayerProgressState;
  layers: Array<{
    id: string;
    name: string;
    stages: StageName[];
    passed: boolean;
  }>;
  steps: BmadHelpFiveLayerMatrixStep[];
  allPassed: boolean;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) out[token.slice(2)] = argv[++index];
  }
  return out;
}

function loadLayerDefinitions(projectRoot: string): LayerDefinition[] {
  const mappingPath = path.join(projectRoot, '_bmad', '_config', 'stage-mapping.yaml');
  const parsed = yaml.load(fs.readFileSync(mappingPath, 'utf8')) as {
    layer_to_stages?: Record<string, { name?: string; stages?: string[] }>;
  };
  const rawLayers = parsed.layer_to_stages ?? {};
  const layerFlow: Record<LayerDefinition['id'], RuntimeFlowId> = {
    layer_1: 'story',
    layer_2: 'epic',
    layer_3: 'story',
    layer_4: 'story',
    layer_5: 'story',
  };
  return (['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'] as const).map((id) => {
    const stages = (rawLayers[id]?.stages ?? []) as StageName[];
    const executableStages = Array.from(
      new Set(
        stages.map((stage) =>
          stage === 'story'
            ? ('story_create' as StageName)
            : stage === 'post_impl'
              ? 'post_audit'
              : stage
        )
      )
    );
    return {
      id,
      name: rawLayers[id]?.name ?? id,
      flow: layerFlow[id],
      stages: executableStages,
      outputRoot: outputRootForLayer(id),
    };
  });
}

function outputRootForLayer(layerId: LayerDefinition['id']): string {
  switch (layerId) {
    case 'layer_1':
      return '_bmad-output/runtime/context';
    case 'layer_2':
      return 'docs/architecture';
    case 'layer_3':
      return 'docs/stories';
    case 'layer_4':
      return 'specs';
    case 'layer_5':
      return '_bmad-output/runtime/gates';
  }
}

function stageEvidencePath(
  projectRoot: string,
  layer: LayerDefinition,
  stage: StageName
): string {
  return path.join(projectRoot, layer.outputRoot, `${layer.id}-${stage}.complete.json`);
}

function hasUpstreamPlanningArtifact(projectRoot: string, fileNames: string[]): boolean {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  if (!fs.existsSync(planningRoot)) return false;
  const names = new Set(fileNames.map((item) => item.toLowerCase()));
  const stack = [planningRoot];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (names.has(entry.name.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function resolveStageEvidence(
  projectRoot: string,
  layer: LayerDefinition,
  stage: StageName
): Pick<BmadHelpFiveLayerStageStatus, 'completed' | 'evidenceKind'> {
  const root = path.join(projectRoot, layer.outputRoot);
  if (stage === ('release_gate' as StageName)) {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(path.join(root, 'main-agent-release-gate-report.json'), (value) =>
        value.critical_failures === 0 && value.blocked_sprint_status_update === false
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  if (stage === ('delivery_truth_gate' as StageName)) {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(path.join(root, 'main-agent-delivery-truth-gate-report.json'), (value) =>
        value.completionAllowed === true
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  const explicitStageMarker = stageEvidencePath(projectRoot, layer, stage);
  if (layer.id === 'layer_1' && stage === 'prd') {
    const strictMarkerComplete = validateLayer1PrdCompletionMarker({
      projectRoot,
      markerPath: explicitStageMarker,
    });
    if (strictMarkerComplete) return { completed: true, evidenceKind: 'strict_marker' };
    const upstreamPrdComplete = hasUpstreamPlanningArtifact(projectRoot, ['prd.md']);
    return { completed: upstreamPrdComplete, evidenceKind: upstreamPrdComplete ? 'upstream_artifact' : 'missing' };
  }
  if (!fs.existsSync(root)) {
    if (layer.id === 'layer_2' && stage === 'arch') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    if (layer.id === 'layer_3' && stage === 'epics') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    return { completed: false, evidenceKind: 'missing' };
  }
  if (fs.existsSync(explicitStageMarker)) {
    return { completed: true, evidenceKind: 'strict_marker' };
  }
  const exactNames = exactStageEvidenceNames(stage);
  const completed = fs
    .readdirSync(root, { withFileTypes: true })
    .some((entry) => exactNames.has(entry.name.toLowerCase()));
  if (completed) return { completed: true, evidenceKind: 'strict_marker' };
  if (layer.id === 'layer_2' && stage === 'arch') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
    return { completed: upstreamComplete, evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing' };
  }
  if (layer.id === 'layer_3' && stage === 'epics') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
    return { completed: upstreamComplete, evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing' };
  }
  return { completed: false, evidenceKind: 'missing' };
}

function exactStageEvidenceNames(stage: StageName): Set<string> {
  const normalized = String(stage).toLowerCase();
  const dashed = normalized.replace(/_/g, '-');
  const names = new Set([`${normalized}.json`, `${normalized}.md`, `${dashed}.json`, `${dashed}.md`]);
  if (stage === 'arch') {
    for (const item of ['architecture.md', 'architecture.json', 'arch.md', 'arch.json']) names.add(item);
  }
  if (stage === 'epics') {
    names.add('epics.md');
    names.add('epics.json');
  }
  if (stage === 'story_create') {
    names.add('story-create.md');
    names.add('story-create.json');
  }
  if (stage === 'post_audit') {
    names.add('post-audit.md');
    names.add('post-audit.json');
  }
  return names;
}

function gateReportPassed(filePath: string, predicate: (value: Record<string, unknown>) => boolean): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    return predicate(JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>);
  } catch {
    return false;
  }
}

export function markBmadHelpFiveLayerStageComplete(input: {
  projectRoot: string;
  layer: LayerDefinition['id'];
  stage: StageName;
}): string {
  const layer = loadLayerDefinitions(input.projectRoot).find((item) => item.id === input.layer);
  if (!layer) {
    throw new Error(`unknown layer: ${input.layer}`);
  }
  if (input.layer === 'layer_1' && input.stage === 'prd') {
    return writeLayer1PrdCompletionMarker({ projectRoot: input.projectRoot });
  }
  const markerPath = stageEvidencePath(input.projectRoot, layer, input.stage);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        markerType: 'bmad_help_five_layer_stage_complete',
        layer: input.layer,
        stage: input.stage,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return markerPath;
}

export function resolveBmadHelpFiveLayerProgressState(input: {
  projectRoot: string;
}): BmadHelpFiveLayerProgressState {
  const projectRoot = path.resolve(input.projectRoot);
  const layers = loadLayerDefinitions(projectRoot);
  const stageStatuses = layers.flatMap((layer) =>
    layer.stages.map((stage) => {
      const evidence = resolveStageEvidence(projectRoot, layer, stage);
      return {
        layer: layer.id,
        stage,
        completed: evidence.completed,
        evidenceKind: evidence.evidenceKind,
        evidencePath: stageEvidencePath(projectRoot, layer, stage),
      };
    })
  );
  const firstIncomplete = stageStatuses.find((item) => !item.completed) ?? stageStatuses.at(-1);
  if (!firstIncomplete) {
    throw new Error('bmad-help five-layer mapping has no executable stages');
  }
  const completedLayers = layers
    .filter(
      (layer) =>
        layer.stages.length > 0 &&
        layer.stages.every((stage) =>
          stageStatuses.some((item) => item.layer === layer.id && item.stage === stage && item.completed)
        )
    )
    .map((layer) => layer.id);
  return {
    currentLayer: firstIncomplete.layer,
    currentStage: firstIncomplete.stage,
    nextRequiredLayer: firstIncomplete.layer,
    completedLayers,
    stageStatuses,
  };
}

function validateBmadHelpEntry(projectRoot: string): BmadHelpFiveLayerMatrixReport['bmadHelpEntry'] {
  const commandPath = path.join(projectRoot, '_bmad', 'commands', 'bmad-help.md');
  const bmadsCommandPath = path.join(projectRoot, '_bmad', 'commands', 'bmads.md');
  const bmadsRuntimePath = path.join(projectRoot, '_bmad', '_config', 'bmads-runtime.yaml');
  const workflowPath = path.join(projectRoot, '_bmad', 'core', 'skills', 'bmad-help', 'workflow.md');
  const catalogPath = path.join(projectRoot, '_bmad', '_config', 'bmad-help.csv');
  const command = fs.readFileSync(commandPath, 'utf8');
  const bmadsCommand = fs.existsSync(bmadsCommandPath) ? fs.readFileSync(bmadsCommandPath, 'utf8') : '';
  const bmadsRuntime = fs.existsSync(bmadsRuntimePath) ? fs.readFileSync(bmadsRuntimePath, 'utf8') : '';
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const catalog = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf8') : '';
  const readme = readFirstExistingFile([
    path.join(projectRoot, 'README.md'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'README.md'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'README.zh-CN.md'),
  ]);
  const codexSetup = readFirstExistingFile([
    path.join(projectRoot, 'docs', 'how-to', 'codex-setup.md'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'docs', 'how-to', 'codex-setup.md'),
  ]);
  const layerTokens = ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'];
  return {
    command: 'bmad-help',
    firstScreenPolicy: 'recommended_or_blocked_state_aware',
    catalogLoaded:
      fs.existsSync(catalogPath) &&
      command.includes('_bmad/_config/bmad-help.csv') &&
      command.includes('_bmad/core/tasks/help.md'),
    canonicalHelpWorkflow:
      command.includes('_bmad/core/skills/bmad-help/SKILL.md') &&
      workflow.includes('recommended') &&
      workflow.includes('blocked') &&
      workflow.includes('OFFICIAL EXECUTION PATHS'),
    codexFirstClass:
      bmadsRuntime.includes('codex') &&
      bmadsRuntime.includes('main-agent-orchestration') === false &&
      bmadsCommand.includes('main-agent runtime console'),
    fiveLayerCatalog:
      layerTokens.every((token) => bmadsRuntime.includes(token)) &&
      bmadsRuntime.includes('post_audit') &&
      bmadsRuntime.includes('pr_review') &&
      bmadsRuntime.includes('release_gate') &&
      bmadsRuntime.includes('delivery_truth_gate') &&
      !catalog.includes('main-agent,layer_') &&
      !workflow.includes('CODEX / MAIN-AGENT FIVE-LAYER FIRST SCREEN'),
    docsExposeCodex:
      readme.includes('codex') &&
      readme.includes('bmad-speckit-init') &&
      codexSetup.includes('layer_5_closeout') &&
      codexSetup.includes('--agent codex') &&
      codexSetup.includes('Start from `bmads`'),
    bmadsRuntimeContract:
      bmadsRuntime.includes('schemaVersion: bmads-runtime/v1') &&
      bmadsRuntime.includes('governance: _bmad/_config/orchestration-governance.contract.yaml') &&
      bmadsRuntime.includes('dispatch: scripts/orchestration-dispatch-contract.ts') &&
      bmadsRuntime.includes('stageMapping: _bmad/_config/stage-mapping.yaml') &&
      !bmadsRuntime.includes('p0_journey_coverage') &&
      !bmadsRuntime.includes('smoke_e2e_readiness'),
    bmadHelpIsUpstreamOnly:
      !command.includes('RUN OR EMULATE') &&
      !command.includes('Project State Card') &&
      command.includes('Do **not** call `scripts/bmad-help-renderer.ts`') &&
      !workflow.includes('layer_1 -> layer_5') &&
      !catalog.includes('CX1') &&
      !catalog.includes('CX5'),
  };
}

function readFirstExistingFile(candidates: string[]): string {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? fs.readFileSync(found, 'utf8') : '';
}

function prepareStageRoot(root: string, layer: LayerDefinition, stage: StageName): string {
  const stageRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'bmad-help-five-layer',
    `${Date.now()}-${process.pid}`,
    layer.id,
    stage
  );
  fs.mkdirSync(stageRoot, { recursive: true });
  writeRuntimeContextRegistry(stageRoot, defaultRuntimeContextRegistry(stageRoot));
  writeRuntimeContext(
    stageRoot,
    defaultRuntimeContextFile({
      flow: layer.flow,
      stage,
      sourceMode: 'full_bmad',
      contextScope: stage === 'prd' || stage === 'arch' || stage === 'epics' ? 'project' : 'story',
      epicId: `epic-${layer.id}`,
      storyId: `${layer.id}-${stage}`,
      runId: `${layer.id}-${stage}-run`,
      artifactRoot: `_bmad-output/implementation-artifacts/${layer.id}/${stage}`,
      updatedAt: new Date().toISOString(),
    })
  );
  return stageRoot;
}

function runLayerStage(input: {
  projectRoot: string;
  layer: LayerDefinition;
  stage: StageName;
}): BmadHelpFiveLayerMatrixStep {
  const stageRoot = prepareStageRoot(input.projectRoot, input.layer, input.stage);
  const config = loadConfig();
  const helpPolicy = resolveBmadHelpRuntimePolicy({
    projectRoot: stageRoot,
    config,
    flow: input.layer.flow,
    stage: input.stage,
    runtimeContext: {
      flow: input.layer.flow,
      stage: input.stage,
      sourceMode: 'full_bmad',
      contextScope: input.stage === 'prd' || input.stage === 'arch' || input.stage === 'epics' ? 'project' : 'story',
      runId: `${input.layer.id}-${input.stage}-run`,
      storyId: `${input.layer.id}-${input.stage}`,
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  });
  const initialSurface = resolveMainAgentOrchestrationSurface({
    projectRoot: stageRoot,
    flow: input.layer.flow,
    stage: input.stage,
    implementationEntryGate: helpPolicy.implementationEntryGate,
  });
  const instruction = buildMainAgentDispatchInstruction({
    projectRoot: stageRoot,
    flow: input.layer.flow,
    stage: input.stage,
    implementationEntryGate: helpPolicy.implementationEntryGate,
    hydratePacket: true,
  });
  const runLoop = runMainAgentAutomaticLoop({
    projectRoot: stageRoot,
    flow: input.layer.flow,
    stage: input.stage,
    args: {
      reportEvidence: `bmad-help-five-layer:${input.layer.id}:${input.stage}`,
      validationsRun: 'bmad-help-five-layer-matrix',
    },
    executor: ({ projectRoot, instruction, args }) => {
      const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    },
  });
  const evidence = [
    `recommendation=${helpPolicy.helpRouting.recommendationLabel}`,
    `initial=${initialSurface.mainAgentNextAction ?? 'none'}`,
    `packet=${instruction?.packetId ?? 'none'}`,
    `run=${runLoop.runId}`,
    `final=${runLoop.finalSurface.mainAgentNextAction ?? 'none'}`,
  ];
  const passed =
    helpPolicy.mainAgentOrchestration.source !== 'none' &&
    helpPolicy.mainAgentNextAction != null &&
    instruction != null &&
    runLoop.status === 'completed' &&
    runLoop.finalSurface.pendingPacketStatus === 'completed' &&
    runLoop.taskReport?.evidence.some((item) =>
      item.includes(`bmad-help-five-layer:${input.layer.id}:${input.stage}`)
    ) === true;
  return {
    id: `${input.layer.id}-${input.stage}`,
    layer: input.layer.id,
    stage: input.stage,
    passed,
    recommendationLabel: helpPolicy.helpRouting.recommendationLabel,
    orchestration: {
      initialNextAction: initialSurface.mainAgentNextAction,
      packetId: instruction?.packetId ?? null,
      runLoopStatus: runLoop.status,
      finalNextAction: runLoop.finalSurface.mainAgentNextAction,
      pendingPacketStatus: runLoop.finalSurface.pendingPacketStatus,
    },
    evidence,
  };
}

export function runBmadHelpFiveLayerMatrix(input: {
  projectRoot: string;
}): BmadHelpFiveLayerMatrixReport {
  const projectRoot = path.resolve(input.projectRoot);
  const bmadHelpEntry = validateBmadHelpEntry(projectRoot);
  const layers = loadLayerDefinitions(projectRoot);
  const progressState = resolveBmadHelpFiveLayerProgressState({ projectRoot });
  const steps = layers.flatMap((layer) =>
    layer.stages.map((stage) => runLayerStage({ projectRoot, layer, stage }))
  );
  const layerReports = layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    stages: layer.stages,
    passed:
      layer.stages.length > 0 &&
      layer.stages.every((stage) =>
        steps.some((step) => step.layer === layer.id && step.stage === stage && step.passed)
      ),
  }));
  return {
    reportType: 'bmad_help_five_layer_main_agent_matrix',
    generatedAt: new Date().toISOString(),
    projectRoot,
    bmadHelpEntry,
    progressState,
    layers: layerReports,
    steps,
    allPassed:
      bmadHelpEntry.catalogLoaded &&
      bmadHelpEntry.canonicalHelpWorkflow &&
      bmadHelpEntry.codexFirstClass &&
      bmadHelpEntry.fiveLayerCatalog &&
      bmadHelpEntry.docsExposeCodex &&
      bmadHelpEntry.bmadsRuntimeContract &&
      bmadHelpEntry.bmadHelpIsUpstreamOnly &&
      layerReports.every((layer) => layer.passed),
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const report = runBmadHelpFiveLayerMatrix({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        report.projectRoot,
        '_bmad-output',
        'runtime',
        'e2e',
        'bmad-help-five-layer-main-agent-matrix.json'
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  return report.allPassed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
