/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { buildEvidenceProvenance } from './evidence-provenance';

type ProviderMode = 'mock' | 'real';
const PKG_RUNTIME = __dirname.includes(`${path.sep}dist${path.sep}`);

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

function packageCliMainAgent(action: string, args: string[] = []): string[] {
  const packageBin = PKG_RUNTIME
    ? path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'bmad-speckit.js')
    : path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'bmad-speckit.js');
  return [process.execPath, packageBin, 'main-agent', action, ...args];
}

function runtimeCommandText(action: string, args: string[] = []): string {
  return packageCliMainAgent(action, args)
    .map((value) => (/\s/u.test(value) ? JSON.stringify(value) : value))
    .join(' ');
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

export function mainDeliveryEvidenceRun(argv: string[]): number {
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
      ? runtimeCommandText('host-matrix-pr-orchestrator', [
          '--provider',
          'real',
        ])
      : runtimeCommandText('host-matrix-pr-orchestrator', ['--provider', 'mock']);
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
      packageCliMainAgent('release-gate', commonReleaseArgs),
      releaseGateEnv,
      true
    )
  );

  const truthGate = runStep(
    'delivery-truth-gate',
    packageCliMainAgent('delivery-truth-gate'),
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
  process.exitCode = mainDeliveryEvidenceRun(process.argv.slice(2));
}
