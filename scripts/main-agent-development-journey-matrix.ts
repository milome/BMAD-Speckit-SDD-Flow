/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runBmadHelpFiveLayerMatrix } from './main-agent-bmad-help-five-layer-matrix';
import { runUnifiedIngress, type MainAgentHostKind } from './main-agent-unified-ingress';
import { runDualHostPrOrchestration } from './main-agent-dual-host-pr-orchestrator';
import { defaultRuntimeContextFile, writeRuntimeContext } from './runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';

interface JourneyMatrixStep {
  id: string;
  sequence: string;
  passed: boolean;
  evidence: string;
}

export interface DevelopmentJourneyMatrixReport {
  reportType: 'main_agent_development_journey_matrix';
  generatedAt: string;
  projectRoot: string;
  steps: JourneyMatrixStep[];
  allPassed: boolean;
}

function prepareHostBranchRoot(root: string, hostKind: MainAgentHostKind): string {
  const branchRoot = path.join(root, '_bmad-output', 'runtime', 'journey-matrix', hostKind);
  fs.rmSync(branchRoot, { recursive: true, force: true });
  fs.mkdirSync(branchRoot, { recursive: true });
  writeRuntimeContextRegistry(branchRoot, defaultRuntimeContextRegistry(branchRoot));
  writeRuntimeContext(
    branchRoot,
    defaultRuntimeContextFile({
      flow: 'story',
      stage: 'implement',
      sourceMode: 'full_bmad',
      contextScope: 'story',
      storyId: `S-matrix-${hostKind}`,
      runId: `journey-matrix-${hostKind}`,
    })
  );
  if (hostKind === 'cursor') {
    fs.mkdirSync(path.join(branchRoot, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(branchRoot, '.cursor', 'hooks.json'), '{"version":1}\n', 'utf8');
  }
  if (hostKind === 'claude') {
    fs.mkdirSync(path.join(branchRoot, '_bmad', 'claude', 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(branchRoot, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs'),
      'module.exports = {};\n',
      'utf8'
    );
  }
  return branchRoot;
}

function prepareDualHostRoot(root: string): string {
  const dualHostRoot = path.join(root, '_bmad-output', 'runtime', 'journey-matrix', 'dual-host');
  fs.rmSync(dualHostRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(dualHostRoot, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(dualHostRoot, '_bmad-output', 'implementation-artifacts'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(dualHostRoot, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
    [
      'signals: {}',
      'stage_requirements:',
      '  implement: {}',
      'mapping_contract: {}',
      'adaptiveIntakeGovernanceGate:',
      '  matchScoring: {}',
      '  decisionThresholds: {}',
    ].join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(dualHostRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    'development_status:\n  S-matrix: in_progress\n',
    'utf8'
  );
  return dualHostRoot;
}

export function runDevelopmentJourneyMatrix(input: {
  projectRoot: string;
  hostKinds?: MainAgentHostKind[];
  realProvider?: boolean;
}): DevelopmentJourneyMatrixReport {
  const projectRoot = path.resolve(input.projectRoot);
  const canonicalBmadRoot = path.join(__dirname, '..', '_bmad');
  if (!fs.existsSync(path.join(projectRoot, '_bmad')) && fs.existsSync(canonicalBmadRoot)) {
    fs.cpSync(canonicalBmadRoot, path.join(projectRoot, '_bmad'), { recursive: true });
  }
  const hostKinds = input.hostKinds ?? ['cursor', 'claude', 'codex'];
  const steps: JourneyMatrixStep[] = [];
  const dualHostRoot = prepareDualHostRoot(projectRoot);

  const bmadHelpFiveLayer = runBmadHelpFiveLayerMatrix({ projectRoot });
  steps.push({
    id: 'bmad-help-five-layer-main-agent',
    sequence: 'BH1-L1-L5',
    passed:
      bmadHelpFiveLayer.allPassed &&
      bmadHelpFiveLayer.bmadHelpEntry.catalogLoaded &&
      bmadHelpFiveLayer.layers.map((layer) => layer.id).join(',') ===
        'layer_1,layer_2,layer_3,layer_4,layer_5',
    evidence: bmadHelpFiveLayer.layers
      .map((layer) => `${layer.id}:${layer.passed ? 'passed' : 'failed'}`)
      .join(','),
  });

  for (const hostKind of hostKinds) {
    const branchRoot = prepareHostBranchRoot(projectRoot, hostKind);
    const ingress = runUnifiedIngress({
      projectRoot: branchRoot,
      hostKind,
      flow: 'story',
      stage: 'implement',
      forceNoHooks: hostKind === 'codex',
    });
    steps.push({
      id: `ingress-${hostKind}`,
      sequence: 'S3c-S3e',
      passed:
        ingress.sameControlPlane &&
        ingress.controlPlane === 'main-agent-orchestration' &&
        ingress.runLoop.status === 'completed' &&
        (hostKind !== 'codex' || ingress.orchestrationEntry === 'cli_ingress'),
      evidence: `${ingress.hostMode}/${ingress.orchestrationEntry}/${ingress.runLoop.runId}`,
    });
  }

  const dualHost = runDualHostPrOrchestration({
    provider: input.realProvider ? 'real' : 'mock',
    projectRoot: dualHostRoot,
  });
  steps.push({
    id: 'dual-host-e2e',
    sequence: 'S31-S32',
    passed:
      dualHost.journeyMode === (input.realProvider ? 'real' : 'mock') &&
      dualHost.journeyE2EPassed &&
      dualHost.hostsPassed.claude &&
      dualHost.hostsPassed.codex,
    evidence: `${dualHost.journeyMode}/${dualHost.finalPassed}`,
  });
  steps.push({
    id: 'pr-topology',
    sequence: 'S37-S38',
    passed: dualHost.prTopology.all_affected_stories_passed,
    evidence: dualHost.prTopology.required_nodes
      .map((node) => `${node.node_id}:${node.state}`)
      .join(','),
  });

  steps.push({
    id: 'delivery-truth-live',
    sequence: 'R1-R10/S39-S43',
    passed: false,
    evidence:
      'not synthesized; run main-agent:delivery-truth-gate with real evidence bundle for completion verdict',
  });

  return {
    reportType: 'main_agent_development_journey_matrix',
    generatedAt: new Date().toISOString(),
    projectRoot,
    steps,
    allPassed: steps.every((step) => step.passed),
  };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) out[token.slice(2)] = argv[++index];
  }
  return out;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const report = runDevelopmentJourneyMatrix({
    projectRoot: path.resolve(args.cwd ?? process.cwd()),
    realProvider: args.realProvider === 'true',
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        report.projectRoot,
        '_bmad-output',
        'runtime',
        'e2e',
        'development-journey-matrix.json'
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
