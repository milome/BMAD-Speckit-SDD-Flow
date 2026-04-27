/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildParallelMissionPlan,
  buildPrTopology,
  validatePrTopologyForReleaseGate,
  type PrTopology,
} from './parallel-mission-control';
import { runDualHostJourneyRunner } from './e2e-dual-host-journey-runner';

type ProviderMode = 'mock' | 'real';

export interface DualHostPrOrchestrationReport {
  reportType: 'main_agent_dual_host_pr_orchestration';
  provider: ProviderMode;
  journeyMode: 'mock' | 'real';
  journeyE2EPassed: boolean;
  hostsPassed: Record<'claude' | 'codex', boolean>;
  prTopology: PrTopology;
  providerPreflight: Array<{ id: string; passed: boolean; detail: string }>;
  finalPassed: boolean;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--provider' && argv[index + 1]) {
      out.provider = argv[++index];
    } else if (token === '--projectRoot' && argv[index + 1]) {
      out.projectRoot = argv[++index];
    } else if (token === '--reportPath' && argv[index + 1]) {
      out.reportPath = argv[++index];
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }
  if (!out.provider && positional[0]) out.provider = positional[0];
  return out;
}

function commandExists(command: string): boolean {
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function providerPreflight(provider: ProviderMode): DualHostPrOrchestrationReport['providerPreflight'] {
  if (provider === 'mock') {
    return [{ id: 'mock-provider', passed: true, detail: 'deterministic local provider' }];
  }
  return [
    { id: 'github-cli', passed: commandExists('gh'), detail: 'gh CLI must be available' },
    { id: 'claude-cli', passed: commandExists('claude'), detail: 'claude CLI must be available' },
    { id: 'codex-cli', passed: commandExists('codex'), detail: 'codex CLI must be available' },
    {
      id: 'github-token',
      passed: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
      detail: 'GITHUB_TOKEN or GH_TOKEN must be set',
    },
  ];
}

function makeJourneyRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-host-pr-'));
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
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
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    'development_status:\n  S1: in_progress\n',
    'utf8'
  );
  return root;
}

export function runDualHostPrOrchestration(input: {
  provider: ProviderMode;
  projectRoot?: string;
}): DualHostPrOrchestrationReport {
  const providerChecks = providerPreflight(input.provider);
  const providerOk = providerChecks.every((check) => check.passed);
  const journeyRoot = input.projectRoot ? path.resolve(input.projectRoot) : makeJourneyRoot();
  const journeyReportPath = path.join(journeyRoot, '_bmad-output', 'runtime', 'e2e', 'dual-host-pr-journey.json');
  const journeyExit =
    providerOk || input.provider === 'mock'
      ? runDualHostJourneyRunner([
          '--project-root',
          journeyRoot,
          '--mode',
          input.provider === 'real' ? 'real' : 'mock',
          '--hosts',
          'claude,codex',
          '--report-path',
          journeyReportPath,
        ])
      : 1;

  const journeyReport = fs.existsSync(journeyReportPath)
    ? (JSON.parse(fs.readFileSync(journeyReportPath, 'utf8')) as {
        mode: 'mock' | 'real';
        journeys: Array<{ host: 'claude' | 'codex'; passed: boolean }>;
        finalPassed: boolean;
      })
    : { mode: input.provider === 'real' ? 'real' : 'mock', journeys: [], finalPassed: false };
  const hostsPassed = {
    claude: journeyReport.journeys.find((item) => item.host === 'claude')?.passed === true,
    codex: journeyReport.journeys.find((item) => item.host === 'codex')?.passed === true,
  };

  const plan = buildParallelMissionPlan({
    batchId: 'dual-host-pr-batch',
    nodes: [
      {
        node_id: 'claude-node',
        story_key: 'S1',
        packet_id: 'packet-claude',
        write_scope: ['src/claude/**'],
        depends_on: [],
        assigned_agent: 'claude',
        target_branch: 'task/claude-node',
        target_pr: 'PR-CLAUDE',
      },
      {
        node_id: 'codex-node',
        story_key: 'S1',
        packet_id: 'packet-codex',
        write_scope: ['src/codex/**'],
        depends_on: ['claude-node'],
        assigned_agent: 'codex',
        target_branch: 'task/codex-node',
        target_pr: 'PR-CODEX',
      },
    ],
  });
  const prTopology = buildPrTopology({
    plan,
    states:
      journeyExit === 0 && providerOk
        ? { 'claude-node': 'merged', 'codex-node': 'closed_not_needed' }
        : { 'claude-node': 'blocked', 'codex-node': 'blocked' },
  });
  const prGate = validatePrTopologyForReleaseGate(prTopology);
  const finalPassed =
    providerOk &&
    journeyExit === 0 &&
    journeyReport.finalPassed === true &&
    hostsPassed.claude &&
    hostsPassed.codex &&
    prGate.passed;

  return {
    reportType: 'main_agent_dual_host_pr_orchestration',
    provider: input.provider,
    journeyMode: journeyReport.mode,
    journeyE2EPassed: journeyReport.finalPassed === true,
    hostsPassed,
    prTopology,
    providerPreflight: providerChecks,
    finalPassed,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const provider: ProviderMode = args.provider === 'real' ? 'real' : 'mock';
  const report = runDualHostPrOrchestration({
    provider,
    projectRoot: args.projectRoot,
  });
  if (args.reportPath) {
    const reportPath = path.resolve(args.reportPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  return report.finalPassed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
