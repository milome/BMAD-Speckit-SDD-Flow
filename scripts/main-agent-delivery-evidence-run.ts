/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

type ProviderMode = 'mock' | 'real';
const TOOL_ROOT = path.resolve(__dirname, '..');

interface StepResult {
  id: string;
  command: string[];
  exitCode: number;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--provider' && value) {
      out.provider = value;
      index += 1;
    } else if (token === '--durationMs' && value) {
      out.durationMs = value;
      index += 1;
    } else if (token === '--tickIntervalMs' && value) {
      out.tickIntervalMs = value;
      index += 1;
    } else if (token === '--storyKey' && value) {
      out.storyKey = value;
      index += 1;
    } else if (token === '--status' && value) {
      out.status = value;
      index += 1;
    } else if (token === '--token' && value) {
      out.token = value;
      index += 1;
    } else if (token === '--skipSprintAudit') {
      out.skipSprintAudit = 'true';
    }
  }
  return out;
}

function tsNodeScript(scriptPath: string, args: string[] = []): string[] {
  return [
    process.execPath,
    path.join(TOOL_ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
    '--project',
    path.join(TOOL_ROOT, 'tsconfig.node.json'),
    '--transpile-only',
    path.join(TOOL_ROOT, scriptPath),
    ...args,
  ];
}

function runStep(id: string, command: string[], allowFailure = false): StepResult {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const exitCode = result.status ?? (result.error ? 1 : 0);
  if (exitCode !== 0 && !allowFailure) {
    console.error(`[main-agent-delivery-evidence-run] ${id} failed with exitCode=${exitCode}`);
  }
  return { id, command, exitCode };
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const provider: ProviderMode = args.provider === 'real' ? 'real' : 'mock';
  const durationMs = args.durationMs ?? '10';
  const tickIntervalMs = args.tickIntervalMs ?? '5';
  const steps: StepResult[] = [];

  steps.push(runStep('release-gate', tsNodeScript('scripts/main-agent-release-gate.ts'), true));
  steps.push(
    runStep(
      'multi-host-pr-orchestration',
      tsNodeScript('scripts/main-agent-host-matrix-pr-orchestrator.ts', ['--provider', provider]),
      true
    )
  );
  steps.push(
    runStep(
      'long-run-soak',
      tsNodeScript('scripts/main-agent-soak-runner.ts', [
        '--durationMs',
        durationMs,
        '--tickIntervalMs',
        tickIntervalMs,
      ]),
      true
    )
  );

  if (args.skipSprintAudit !== 'true' && args.token) {
    steps.push(
      runStep(
        'sprint-status-authorized-update',
        tsNodeScript('scripts/sprint-status-authorized-update.ts', [
          '--storyKey',
          args.storyKey ?? 'delivery-truth-gate',
          '--status',
          args.status ?? 'done',
          '--releaseGateReportPath',
          path.join('_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json'),
          '--token',
          args.token,
        ]),
        true
      )
    );
  } else {
    console.error(
      '[main-agent-delivery-evidence-run] sprint audit skipped: pass --token release-gate:pass:<id> to attempt authorized sprint-status evidence'
    );
  }

  const truthGate = runStep(
    'delivery-truth-gate',
    tsNodeScript('scripts/main-agent-delivery-truth-gate.ts'),
    true
  );
  steps.push(truthGate);

  console.log(
    JSON.stringify(
      {
        reportType: 'main_agent_delivery_evidence_run',
        provider,
        durationMs: Number(durationMs),
        steps: steps.map((step) => ({
          id: step.id,
          exitCode: step.exitCode,
        })),
        completionAllowed: truthGate.exitCode === 0,
      },
      null,
      2
    )
  );

  return truthGate.exitCode;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
