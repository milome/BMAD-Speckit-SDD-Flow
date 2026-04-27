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
type CommandChecker = (command: string, args?: string[]) => boolean;
type CommandRunner = (command: string, args: string[], cwd: string) => {
  id?: string;
  exitCode: number;
  detail: string;
};
const GITHUB_TOKEN_ENV_NAMES = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_PAT_TOKEN',
  'GITHUB_PERSONAL_ACCESS_TOKEN',
];

export interface DualHostPrOrchestrationReport {
  reportType: 'main_agent_dual_host_pr_orchestration';
  provider: ProviderMode;
  journeyMode: 'mock' | 'real';
  journeyE2EPassed: boolean;
  hostsPassed: Record<'claude' | 'codex', boolean>;
  prTopology: PrTopology;
  providerPreflight: Array<{ id: string; passed: boolean; detail: string }>;
  githubPrApi: {
    attempted: boolean;
    passed: boolean;
    steps: Array<{ id: string; exitCode: number; detail: string }>;
    prUrl: string | null;
  };
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
    } else if (token === '--prTopologyPath' && argv[index + 1]) {
      out.prTopologyPath = argv[++index];
    } else if (token === '--enableRealPrApi' && argv[index + 1]) {
      out.enableRealPrApi = argv[++index];
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

function commandSucceeds(command: string, args: string[] = []): boolean {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0;
}

function githubAuthAvailable(checkCommand: CommandChecker): boolean {
  return (
    GITHUB_TOKEN_ENV_NAMES.some((name) => Boolean(process.env[name])) ||
    checkCommand('gh', ['auth', 'status'])
  );
}

function providerPreflight(
  provider: ProviderMode,
  checkCommand: CommandChecker = (command, args) =>
    args && args.length > 0 ? commandSucceeds(command, args) : commandExists(command)
): DualHostPrOrchestrationReport['providerPreflight'] {
  if (provider === 'mock') {
    return [{ id: 'mock-provider', passed: true, detail: 'deterministic local provider' }];
  }
  return [
    { id: 'github-cli', passed: checkCommand('gh'), detail: 'gh CLI must be available' },
    { id: 'claude-cli', passed: checkCommand('claude'), detail: 'claude CLI must be available' },
    { id: 'codex-cli', passed: checkCommand('codex'), detail: 'codex CLI must be available' },
    {
      id: 'github-auth',
      passed: githubAuthAvailable(checkCommand),
      detail:
        'GITHUB_TOKEN/GH_TOKEN/GITHUB_PAT_TOKEN/GITHUB_PERSONAL_ACCESS_TOKEN or gh auth status must be available',
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

function runCommandStep(
  id: string,
  command: string,
  args: string[],
  cwd: string,
  runner?: CommandRunner
): { id: string; exitCode: number; detail: string } {
  if (runner) {
    const result = runner(command, args, cwd);
    return { id, exitCode: result.exitCode, detail: result.detail };
  }
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return {
    id,
    exitCode: result.status ?? (result.error ? 1 : 0),
    detail: (result.stdout || result.stderr || result.error?.message || '').trim(),
  };
}

function runGhStep(
  id: string,
  args: string[],
  cwd: string,
  runner?: CommandRunner
): { id: string; exitCode: number; detail: string } {
  if (runner) return runCommandStep(id, 'gh', args, cwd, runner);
  const result = spawnSync('gh', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return {
    id,
    exitCode: result.status ?? (result.error ? 1 : 0),
    detail: (result.stdout || result.stderr || result.error?.message || '').trim(),
  };
}

function currentGitBranch(cwd: string): string {
  const result = spawnSync('git', ['branch', '--show-current'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return (result.stdout || 'dev').trim() || 'dev';
}

function runGithubPrApiOrchestration(input: {
  provider: ProviderMode;
  projectRoot: string;
  providerOk: boolean;
  journeyPassed: boolean;
  enableRealPrApi?: boolean;
  runCommand?: CommandRunner;
}): DualHostPrOrchestrationReport['githubPrApi'] {
  if (input.provider !== 'real') {
    return { attempted: false, passed: true, steps: [], prUrl: null };
  }
  if (!input.enableRealPrApi) {
    return {
      attempted: true,
      passed: false,
      steps: [
        {
          id: 'real-pr-api-disabled',
          exitCode: 1,
          detail: 'pass --enableRealPrApi true to create/close a real GitHub PR',
        },
      ],
      prUrl: null,
    };
  }
  if (!input.providerOk || !input.journeyPassed) {
    return {
      attempted: true,
      passed: false,
      steps: [{ id: 'precondition', exitCode: 1, detail: 'provider or journey precondition failed' }],
      prUrl: null,
    };
  }

  const branchName = `codex/main-agent-smoke-${Date.now()}`;
  const proofPath = path.join(
    input.projectRoot,
    'docs',
    'ops',
    'pr-api-smoke',
    `${branchName.replace(/[\\/]/g, '-')}.md`
  );
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(
    proofPath,
    `# Codex PR API Smoke\n\nbranch: ${branchName}\ngeneratedAt: ${new Date().toISOString()}\n`,
    'utf8'
  );

  const baseBranch = currentGitBranch(input.projectRoot);
  const steps = [
    runGhStep('auth-status', ['auth', 'status'], input.projectRoot, input.runCommand),
    runGhStep('checkout-branch', ['repo', 'set-default', '--view'], input.projectRoot, input.runCommand),
  ];
  steps.push(
    runCommandStep('git-checkout-branch', 'git', ['checkout', '-b', branchName], input.projectRoot, input.runCommand)
  );
  steps.push(runCommandStep('git-add-proof', 'git', ['add', proofPath], input.projectRoot, input.runCommand));
  steps.push(
    runCommandStep('git-commit-proof', 'git', ['commit', '-m', 'test: codex pr api smoke'], input.projectRoot, input.runCommand)
  );
  steps.push(
    runCommandStep('git-push-proof', 'git', ['push', '-u', 'origin', branchName], input.projectRoot, input.runCommand)
  );
  const push = runGhStep('pr-create', [
    'pr',
    'create',
    '--draft',
    '--base',
    baseBranch,
    '--head',
    branchName,
    '--title',
    'Codex PR API smoke',
    '--body',
    'Automated fail-close smoke for Codex branch orchestration.',
  ], input.projectRoot, input.runCommand);
  steps.push(push);
  const prUrl = push.exitCode === 0 ? push.detail.split(/\r?\n/).find((line) => line.includes('http')) ?? null : null;
  if (prUrl) {
    steps.push(runGhStep('pr-close', ['pr', 'close', prUrl], input.projectRoot, input.runCommand));
    steps.push(
      runCommandStep(
        'git-delete-remote-branch',
        'git',
        ['push', 'origin', '--delete', branchName],
        input.projectRoot,
        input.runCommand
      )
    );
  }
  steps.push(runCommandStep('git-checkout-back', 'git', ['checkout', baseBranch], input.projectRoot, input.runCommand));
  if (!prUrl && steps.find((step) => step.id === 'git-push-proof')?.exitCode === 0) {
    steps.push(
      runCommandStep(
        'git-delete-remote-branch',
        'git',
        ['push', 'origin', '--delete', branchName],
        input.projectRoot,
        input.runCommand
      )
    );
  }
  steps.push(
    runCommandStep(
      'git-delete-local-branch',
      'git',
      ['branch', '-D', branchName],
      input.projectRoot,
      input.runCommand
    )
  );
  return {
    attempted: true,
    passed: steps.every((step) => step.exitCode === 0) && Boolean(prUrl),
    steps,
    prUrl,
  };
}

export function runDualHostPrOrchestration(input: {
  provider: ProviderMode;
  projectRoot?: string;
  checkCommand?: CommandChecker;
  enableRealPrApi?: boolean;
  runCommand?: CommandRunner;
}): DualHostPrOrchestrationReport {
  const providerChecks = providerPreflight(input.provider, input.checkCommand);
  const providerOk = providerChecks.every((check) => check.passed);
  const journeyRoot = input.projectRoot ? path.resolve(input.projectRoot) : makeJourneyRoot();
  const journeyReportPath = path.join(
    journeyRoot,
    '_bmad-output',
    'runtime',
    'e2e',
    'dual-host-pr-journey.json'
  );
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
  const githubPrApi = runGithubPrApiOrchestration({
    provider: input.provider,
    projectRoot: journeyRoot,
    providerOk,
    journeyPassed: journeyReport.finalPassed === true && hostsPassed.claude && hostsPassed.codex,
    enableRealPrApi: input.enableRealPrApi,
    runCommand: input.runCommand,
  });

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
        ? {
            'claude-node': githubPrApi.passed ? 'merged' : 'blocked',
            'codex-node': githubPrApi.passed ? 'closed_not_needed' : 'blocked',
          }
        : { 'claude-node': 'blocked', 'codex-node': 'blocked' },
  });
  const prGate = validatePrTopologyForReleaseGate(prTopology);
  const finalPassed =
    providerOk &&
    journeyExit === 0 &&
    journeyReport.finalPassed === true &&
    hostsPassed.claude &&
    hostsPassed.codex &&
    githubPrApi.passed &&
    prGate.passed;

  return {
    reportType: 'main_agent_dual_host_pr_orchestration',
    provider: input.provider,
    journeyMode: journeyReport.mode,
    journeyE2EPassed: journeyReport.finalPassed === true,
    hostsPassed,
    prTopology,
    providerPreflight: providerChecks,
    githubPrApi,
    finalPassed,
  };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const provider: ProviderMode = args.provider === 'real' ? 'real' : 'mock';
  const projectRoot = path.resolve(args.projectRoot ?? process.cwd());
  const report = runDualHostPrOrchestration({
    provider,
    projectRoot,
    enableRealPrApi: args.enableRealPrApi === 'true',
  });
  const reportPath = path.resolve(
    args.reportPath ??
      path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'e2e',
        'dual-host-pr-orchestration-report.json'
      )
  );
  const prTopologyPath = path.resolve(
    args.prTopologyPath ??
      path.join(projectRoot, '_bmad-output', 'runtime', 'pr', 'pr_topology.json')
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.mkdirSync(path.dirname(prTopologyPath), { recursive: true });
  fs.writeFileSync(prTopologyPath, JSON.stringify(report.prTopology, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  return report.finalPassed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
