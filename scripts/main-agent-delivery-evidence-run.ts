/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { buildEvidenceProvenance } from './evidence-provenance';

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
    } else if (token === '--storyKey' && value) {
      out.storyKey = value;
      index += 1;
    } else if (token === '--status' && value) {
      out.status = value;
      index += 1;
    } else if (token === '--token' && value) {
      out.token = value;
      index += 1;
    } else if (token === '--runId' && value) {
      out.runId = value;
      index += 1;
    } else if (token === '--evidenceBundleId' && value) {
      out.evidenceBundleId = value;
      index += 1;
    } else if (token === '--record-id' && value) {
      out.recordId = value;
      index += 1;
    } else if (token === '--requirement-set-id' && value) {
      out.requirementSetId = value;
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

function runStepWithEnv(
  id: string,
  command: string[],
  env: NodeJS.ProcessEnv,
  allowFailure = false
): StepResult {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, ...env },
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
  const steps: StepResult[] = [];
  const root = process.cwd();
  const storyKey = args.storyKey ?? 'S-release-gate';
  const provenance = buildEvidenceProvenance({
    root,
    runId: args.runId,
    storyKey,
    evidenceBundleId: args.evidenceBundleId,
    prefix: 'release-gate',
  });
  const commonReleaseArgs = [
    '--runId',
    provenance.runId,
    '--storyKey',
    provenance.storyKey,
    '--evidenceBundleId',
    provenance.evidenceBundleId,
    ...(args.recordId ? ['--record-id', args.recordId] : []),
    ...(args.requirementSetId ? ['--requirement-set-id', args.requirementSetId] : []),
  ];
  const releaseGateCommand =
    provider === 'real'
      ? 'node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-host-matrix-pr-orchestrator.ts --provider real --enableRealPrApi true'
      : 'node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-host-matrix-pr-orchestrator.ts --provider mock';
  const releaseGateEnv = {
    MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: releaseGateCommand,
  };

  if (args.skipSprintAudit === 'true') {
    console.error('[main-agent-delivery-evidence-run] sprint audit skipped by --skipSprintAudit');
  }
  if (args.token) {
    console.error(
      '[main-agent-delivery-evidence-run] --token is ignored; release gate now owns sprint authorization'
    );
  }

  steps.push(
    runStepWithEnv(
      'release-gate',
      tsNodeScript('scripts/main-agent-release-gate.ts', commonReleaseArgs),
      releaseGateEnv,
      true
    )
  );

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
        evidence_provenance: provenance,
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
