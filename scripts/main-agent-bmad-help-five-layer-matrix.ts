/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { loadConfig, resolveBmadHelpRuntimePolicy, type StageName } from './bmad-config';
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

export interface BmadHelpFiveLayerMatrixReport {
  reportType: 'bmad_help_five_layer_main_agent_matrix';
  generatedAt: string;
  projectRoot: string;
  bmadHelpEntry: {
    command: 'bmad-help';
    firstScreenPolicy: 'recommended_or_blocked_state_aware';
    catalogLoaded: boolean;
    canonicalHelpWorkflow: boolean;
  };
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
            : stage === 'pr_review' || stage === 'post_impl'
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
    };
  });
}

function validateBmadHelpEntry(projectRoot: string): BmadHelpFiveLayerMatrixReport['bmadHelpEntry'] {
  const commandPath = path.join(projectRoot, '_bmad', 'commands', 'bmad-help.md');
  const workflowPath = path.join(projectRoot, '_bmad', 'core', 'skills', 'bmad-help', 'workflow.md');
  const catalogPath = path.join(projectRoot, '_bmad', '_config', 'bmad-help.csv');
  const command = fs.readFileSync(commandPath, 'utf8');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  return {
    command: 'bmad-help',
    firstScreenPolicy: 'recommended_or_blocked_state_aware',
    catalogLoaded: fs.existsSync(catalogPath) && command.includes('bmad-help.csv'),
    canonicalHelpWorkflow:
      command.includes('_bmad/core/skills/bmad-help/SKILL.md') &&
      workflow.includes('recommended') &&
      workflow.includes('blocked') &&
      workflow.includes('OFFICIAL EXECUTION PATHS'),
  };
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
    layers: layerReports,
    steps,
    allPassed:
      bmadHelpEntry.catalogLoaded &&
      bmadHelpEntry.canonicalHelpWorkflow &&
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
