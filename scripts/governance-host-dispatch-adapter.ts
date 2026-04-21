import * as fs from 'node:fs';
import { spawn, spawnSync, type SpawnOptions, type SpawnSyncReturns } from 'node:child_process';
import type {
  GovernanceHostKind,
} from './governance-remediation-runner';
import type {
  GovernancePacketDispatchAccepted,
  GovernancePacketDispatchAdapter,
  GovernancePacketDispatchFailed,
  GovernancePacketDispatchOutcome,
  GovernancePacketDispatchRejected,
} from './governance-packet-dispatch-worker';

type GovernanceLaunchMode = 'json-stdout' | 'packet-stdin';

interface GovernanceHostLaunchSpec {
  hostKind: GovernanceHostKind;
  mode: GovernanceLaunchMode;
  command: string;
  args: string[];
  startupTimeoutMs: number;
}

interface GovernanceHostDispatchAdapterOptions {
  env?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
}

interface GovernanceDispatchInput {
  executionId: string;
  authoritativeHost: GovernanceHostKind;
  packetPath: string;
  leaseOwner: string;
  timeoutMs: number;
  projectRoot: string;
}

function envVarKey(hostKind: GovernanceHostKind, suffix: string): string {
  return `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_${suffix}`;
}

function parseArgsJson(raw: string | undefined, hostKind: GovernanceHostKind): string[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error(
      `Invalid ${envVarKey(hostKind, 'LAUNCH_ARGS_JSON')}: expected JSON string array`
    );
  }
  return parsed;
}

function parsePositiveNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function accepted(
  externalRunId: string,
  metadata?: Record<string, unknown>,
  reason?: string
): GovernancePacketDispatchAccepted {
  return {
    kind: 'accepted',
    externalRunId,
    ...(reason ? { reason } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function rejected(
  reason: string,
  metadata?: Record<string, unknown>
): GovernancePacketDispatchRejected {
  return {
    kind: 'rejected',
    reason,
    ...(metadata ? { metadata } : {}),
  };
}

function failed(
  reason: string,
  metadata?: Record<string, unknown>
): GovernancePacketDispatchFailed {
  return {
    kind: 'failed',
    reason,
    ...(metadata ? { metadata } : {}),
  };
}

function defaultClaudeLaunchSpec(projectRoot: string, startupTimeoutMs?: number): GovernanceHostLaunchSpec {
  return {
    hostKind: 'claude',
    mode: 'packet-stdin',
    command: 'claude',
    args: [
      '-p',
      '--output-format',
      'json',
      '--dangerously-skip-permissions',
      '--permission-mode',
      'bypassPermissions',
      '--add-dir',
      projectRoot,
    ],
    startupTimeoutMs: startupTimeoutMs ?? 1500,
  };
}

function resolveHostLaunchSpec(
  input: GovernanceDispatchInput,
  options: GovernanceHostDispatchAdapterOptions = {}
): GovernanceHostLaunchSpec | null {
  const env = options.env ?? process.env;
  const hostKind = input.authoritativeHost;
  const command = env[envVarKey(hostKind, 'LAUNCH_COMMAND')];
  const argsJson = env[envVarKey(hostKind, 'LAUNCH_ARGS_JSON')];
  const modeRaw = env[envVarKey(hostKind, 'LAUNCH_MODE')];
  const envStartupTimeoutMs =
    parsePositiveNumber(env[envVarKey(hostKind, 'STARTUP_TIMEOUT_MS')]) ??
    options.startupTimeoutMs ??
    null;

  if (command && command.trim() !== '') {
    return {
      hostKind,
      mode:
        modeRaw === 'packet-stdin' || modeRaw === 'json-stdout'
          ? modeRaw
          : 'json-stdout',
      command,
      args: parseArgsJson(argsJson, hostKind),
      startupTimeoutMs: envStartupTimeoutMs ?? 1500,
    };
  }

  if (hostKind === 'claude') {
    return defaultClaudeLaunchSpec(input.projectRoot, envStartupTimeoutMs ?? undefined);
  }

  return null;
}

function buildLaunchEnv(
  spec: GovernanceHostLaunchSpec,
  input: GovernanceDispatchInput,
  env: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  return {
    ...env,
    BMAD_GOVERNANCE_DISPATCH_HOST: spec.hostKind,
    BMAD_GOVERNANCE_EXECUTION_ID: input.executionId,
    BMAD_GOVERNANCE_PACKET_PATH: input.packetPath,
    BMAD_GOVERNANCE_PROJECT_ROOT: input.projectRoot,
    BMAD_GOVERNANCE_LEASE_OWNER: input.leaseOwner,
    BMAD_GOVERNANCE_TIMEOUT_MS: String(input.timeoutMs),
  };
}

function spawnSyncJsonLaunch(
  spec: GovernanceHostLaunchSpec,
  input: GovernanceDispatchInput,
  env: NodeJS.ProcessEnv
): GovernancePacketDispatchOutcome {
  const spawnResult = spawnSync(spec.command, spec.args, {
    cwd: input.projectRoot,
    env: buildLaunchEnv(spec, input, env),
    encoding: 'utf8',
    timeout: spec.startupTimeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  }) as SpawnSyncReturns<string>;

  if (spawnResult.error) {
    const code =
      typeof (spawnResult.error as NodeJS.ErrnoException).code === 'string'
        ? (spawnResult.error as NodeJS.ErrnoException).code
        : 'unknown';
    if (code === 'ETIMEDOUT') {
      return failed(`host launch command timed out after ${spec.startupTimeoutMs}ms`, {
        command: spec.command,
        args: spec.args,
      });
    }
    return rejected(`host launch command failed to start: ${code}`, {
      command: spec.command,
      args: spec.args,
    });
  }

  if (spawnResult.signal === 'SIGTERM' || spawnResult.signal === 'SIGKILL') {
    return failed(`host launch command timed out after ${spec.startupTimeoutMs}ms`, {
      command: spec.command,
      args: spec.args,
      signal: spawnResult.signal,
    });
  }

  const stdout = (spawnResult.stdout ?? '').trim();
  const stderr = (spawnResult.stderr ?? '').trim();
  if (stdout === '') {
    return failed('host launch command produced no JSON result', {
      command: spec.command,
      args: spec.args,
      exitCode: spawnResult.status,
      stderr,
    });
  }

  let parsed: GovernancePacketDispatchOutcome;
  try {
    parsed = JSON.parse(stdout) as GovernancePacketDispatchOutcome;
  } catch (error) {
    return failed('host launch command returned invalid JSON', {
      command: spec.command,
      args: spec.args,
      exitCode: spawnResult.status,
      stdout,
      stderr,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) {
    return failed('host launch command JSON missing outcome kind', {
      command: spec.command,
      args: spec.args,
      stdout,
      stderr,
    });
  }

  const metadata = {
    command: spec.command,
    args: spec.args,
    exitCode: spawnResult.status,
    stderr,
    ...(('metadata' in parsed && parsed.metadata && typeof parsed.metadata === 'object')
      ? parsed.metadata
      : {}),
  };

  if (parsed.kind === 'accepted') {
    return accepted(
      parsed.externalRunId ?? `${spec.hostKind}:${Date.now()}`,
      metadata,
      parsed.reason
    );
  }

  if (parsed.kind === 'rejected') {
    return rejected(parsed.reason, metadata);
  }

  return failed(parsed.reason, metadata);
}

async function spawnPacketPromptLaunch(
  spec: GovernanceHostLaunchSpec,
  input: GovernanceDispatchInput,
  env: NodeJS.ProcessEnv
): Promise<GovernancePacketDispatchOutcome> {
  const packetPrompt = fs.readFileSync(input.packetPath, 'utf8');
  const spawnOptions: SpawnOptions = {
    cwd: input.projectRoot,
    env: buildLaunchEnv(spec, input, env),
    detached: true,
    stdio: ['pipe', 'ignore', 'ignore'],
    shell: false,
    windowsHide: true,
  };
  const child = spawn(spec.command, spec.args, spawnOptions);

  await new Promise<void>((resolve) => {
    child.stdin?.write(packetPrompt);
    child.stdin?.end();
    resolve();
  });

  const startedAt = Date.now();
  const launchResult = await new Promise<GovernancePacketDispatchOutcome>((resolve) => {
    let settled = false;
    const settle = (result: GovernancePacketDispatchOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    child.once('error', (error) => {
      const code =
        typeof (error as NodeJS.ErrnoException).code === 'string'
          ? (error as NodeJS.ErrnoException).code
          : 'unknown';
      settle(
        rejected(`host launch command failed to start: ${code}`, {
          command: spec.command,
          args: spec.args,
        })
      );
    });

    child.once('exit', (code, signal) => {
      if (code === 0) {
        settle(
          accepted(`${spec.hostKind}:${child.pid ?? 'unknown'}`, {
            command: spec.command,
            args: spec.args,
            pid: child.pid ?? null,
            exitCode: code,
            signal,
            completedWithinStartupWindow: true,
          })
        );
        return;
      }

      settle(
        failed(
          `host launch command exited before startup window (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
          {
            command: spec.command,
            args: spec.args,
            pid: child.pid ?? null,
            exitCode: code,
            signal,
          }
        )
      );
    });

    const timer = setTimeout(() => {
      clearTimeout(timer);
      settle(
        accepted(`${spec.hostKind}:${child.pid ?? 'unknown'}`, {
          command: spec.command,
          args: spec.args,
          pid: child.pid ?? null,
          launchMode: spec.mode,
          startupWindowMs: spec.startupTimeoutMs,
          startedAt: new Date(startedAt).toISOString(),
        })
      );
      child.unref();
    }, spec.startupTimeoutMs);
  });

  return launchResult;
}

export async function launchGovernanceExecutionViaHost(
  input: GovernanceDispatchInput,
  options: GovernanceHostDispatchAdapterOptions = {}
): Promise<GovernancePacketDispatchOutcome> {
  const env = options.env ?? process.env;
  const spec = resolveHostLaunchSpec(input, options);
  if (!spec) {
    return rejected(
      `no real launch command configured for authoritative host ${input.authoritativeHost}`,
      { authoritativeHost: input.authoritativeHost }
    );
  }

  if (spec.mode === 'json-stdout') {
    return spawnSyncJsonLaunch(spec, input, env);
  }

  return spawnPacketPromptLaunch(spec, input, env);
}

export function createGovernanceHostDispatchAdapter(
  options: GovernanceHostDispatchAdapterOptions = {}
): GovernancePacketDispatchAdapter {
  return {
    async launch(input) {
      return launchGovernanceExecutionViaHost(input, options);
    },
  };
}
