"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchGovernanceExecutionViaHost = launchGovernanceExecutionViaHost;
exports.createGovernanceHostDispatchAdapter = createGovernanceHostDispatchAdapter;
const fs = __importStar(require("node:fs"));
const node_child_process_1 = require("node:child_process");
const governance_remediation_config_1 = require("./governance-remediation-config");
function envVarKey(hostKind, suffix) {
    return `BMAD_GOVERNANCE_${hostKind.toUpperCase()}_${suffix}`;
}
function parseArgsJson(raw, hostKind) {
    if (!raw || raw.trim() === '') {
        return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
        throw new Error(`Invalid ${envVarKey(hostKind, 'LAUNCH_ARGS_JSON')}: expected JSON string array`);
    }
    return parsed;
}
function parsePositiveNumber(raw) {
    if (!raw || raw.trim() === '') {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function accepted(externalRunId, metadata, reason) {
    return {
        kind: 'accepted',
        externalRunId,
        ...(reason ? { reason } : {}),
        ...(metadata ? { metadata } : {}),
    };
}
function rejected(reason, metadata) {
    return {
        kind: 'rejected',
        reason,
        ...(metadata ? { metadata } : {}),
    };
}
function failed(reason, metadata) {
    return {
        kind: 'failed',
        reason,
        ...(metadata ? { metadata } : {}),
    };
}
function defaultClaudeLaunchSpec(projectRoot, startupTimeoutMs) {
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
function resolveHostLaunchSpec(input, options = {}) {
    const env = options.env ?? process.env;
    const hostKind = input.authoritativeHost;
    const command = env[envVarKey(hostKind, 'LAUNCH_COMMAND')];
    const argsJson = env[envVarKey(hostKind, 'LAUNCH_ARGS_JSON')];
    const modeRaw = env[envVarKey(hostKind, 'LAUNCH_MODE')];
    const envStartupTimeoutMs = parsePositiveNumber(env[envVarKey(hostKind, 'STARTUP_TIMEOUT_MS')]) ??
        options.startupTimeoutMs ??
        null;
    if (command && command.trim() !== '') {
        return {
            hostKind,
            mode: modeRaw === 'packet-stdin' || modeRaw === 'json-stdout' ? modeRaw : 'json-stdout',
            command,
            args: parseArgsJson(argsJson, hostKind),
            startupTimeoutMs: envStartupTimeoutMs ?? 1500,
        };
    }
    if (hostKind === 'claude') {
        return defaultClaudeLaunchSpec(input.projectRoot, envStartupTimeoutMs ?? undefined);
    }
    if (hostKind === 'cursor') {
        return null;
    }
    return null;
}
function buildLaunchEnv(spec, input, env) {
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
function spawnSyncJsonLaunch(spec, input, env) {
    const spawnResult = (0, node_child_process_1.spawnSync)(spec.command, spec.args, {
        cwd: input.projectRoot,
        env: buildLaunchEnv(spec, input, env),
        encoding: 'utf8',
        timeout: spec.startupTimeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
    });
    if (spawnResult.error) {
        const code = typeof spawnResult.error.code === 'string'
            ? spawnResult.error.code
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
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch (error) {
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
        ...('metadata' in parsed && parsed.metadata && typeof parsed.metadata === 'object'
            ? parsed.metadata
            : {}),
    };
    if (parsed.kind === 'accepted') {
        return accepted(parsed.externalRunId ?? `${spec.hostKind}:${Date.now()}`, metadata, parsed.reason);
    }
    if (parsed.kind === 'rejected') {
        return rejected(parsed.reason, metadata);
    }
    return failed(parsed.reason, metadata);
}
async function spawnPacketPromptLaunch(spec, input, env) {
    const packetPrompt = fs.readFileSync(input.packetPath, 'utf8');
    const spawnOptions = {
        cwd: input.projectRoot,
        env: buildLaunchEnv(spec, input, env),
        detached: true,
        stdio: ['pipe', 'ignore', 'ignore'],
        shell: false,
        windowsHide: true,
    };
    const child = (0, node_child_process_1.spawn)(spec.command, spec.args, spawnOptions);
    await new Promise((resolve) => {
        child.stdin?.write(packetPrompt);
        child.stdin?.end();
        resolve();
    });
    const startedAt = Date.now();
    const launchResult = await new Promise((resolve) => {
        let settled = false;
        const settle = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(result);
        };
        child.once('error', (error) => {
            const code = typeof error.code === 'string'
                ? error.code
                : 'unknown';
            settle(rejected(`host launch command failed to start: ${code}`, {
                command: spec.command,
                args: spec.args,
            }));
        });
        child.once('exit', (code, signal) => {
            if (code === 0) {
                settle(accepted(`${spec.hostKind}:${child.pid ?? 'unknown'}`, {
                    command: spec.command,
                    args: spec.args,
                    pid: child.pid ?? null,
                    exitCode: code,
                    signal,
                    completedWithinStartupWindow: true,
                }));
                return;
            }
            settle(failed(`host launch command exited before startup window (code=${code ?? 'null'}, signal=${signal ?? 'null'})`, {
                command: spec.command,
                args: spec.args,
                pid: child.pid ?? null,
                exitCode: code,
                signal,
            }));
        });
        const timer = setTimeout(() => {
            clearTimeout(timer);
            settle(accepted(`${spec.hostKind}:${child.pid ?? 'unknown'}`, {
                command: spec.command,
                args: spec.args,
                pid: child.pid ?? null,
                launchMode: spec.mode,
                startupWindowMs: spec.startupTimeoutMs,
                startedAt: new Date(startedAt).toISOString(),
            }));
            child.unref();
        }, spec.startupTimeoutMs);
    });
    return launchResult;
}
async function launchGovernanceExecutionViaHost(input, options = {}) {
    const env = options.env ?? process.env;
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(input.projectRoot);
    if (config.execution?.interactiveMode === 'main-agent' &&
        env.BMAD_GOVERNANCE_ALLOW_AUTONOMOUS_FALLBACK !== '1') {
        return rejected('autonomous governance dispatch disabled unless explicit fallback mode is enabled', {
            interactiveMode: config.execution?.interactiveMode,
            fallbackAutonomousMode: config.execution?.fallbackAutonomousMode,
        });
    }
    if (config.execution?.fallbackAutonomousMode === false) {
        return rejected('autonomous fallback dispatch is disabled by configuration', {
            interactiveMode: config.execution?.interactiveMode,
            fallbackAutonomousMode: config.execution?.fallbackAutonomousMode,
        });
    }
    const spec = resolveHostLaunchSpec(input, options);
    if (!spec) {
        return rejected(`no real launch command configured for authoritative host ${input.authoritativeHost}`, { authoritativeHost: input.authoritativeHost });
    }
    if (spec.mode === 'json-stdout') {
        return spawnSyncJsonLaunch(spec, input, env);
    }
    return spawnPacketPromptLaunch(spec, input, env);
}
function createGovernanceHostDispatchAdapter(options = {}) {
    return {
        async launch(input) {
            return launchGovernanceExecutionViaHost(input, options);
        },
    };
}
