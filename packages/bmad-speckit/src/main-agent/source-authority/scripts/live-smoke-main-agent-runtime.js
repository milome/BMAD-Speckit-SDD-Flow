"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const runtime_context_1 = require("./runtime-context");
const runtime_context_registry_1 = require("./runtime-context-registry");
function repoRoot() {
    return process.cwd();
}
function rootTmpDir(prefix) {
    return (0, node_fs_1.mkdtempSync)(node_path_1.default.join(node_os_1.default.tmpdir(), prefix));
}
function linkNodeModules(projectRoot) {
    const src = node_path_1.default.join(repoRoot(), 'node_modules');
    const dest = node_path_1.default.join(projectRoot, 'node_modules');
    if ((0, node_fs_1.existsSync)(dest)) {
        return;
    }
    if (process.platform === 'win32') {
        (0, node_fs_1.symlinkSync)(src, dest, 'junction');
    }
    else {
        (0, node_fs_1.symlinkSync)(src, dest, 'dir');
    }
}
function createFixtureRoot(flow, cursorHost) {
    const root = rootTmpDir(`main-agent-live-smoke-${flow}-`);
    (0, node_fs_1.cpSync)(node_path_1.default.join(repoRoot(), '_bmad'), node_path_1.default.join(root, '_bmad'), { recursive: true });
    linkNodeModules(root);
    (0, runtime_context_registry_1.writeRuntimeContextRegistry)(root, (0, runtime_context_registry_1.defaultRuntimeContextRegistry)(root));
    (0, runtime_context_1.writeRuntimeContext)(root, (0, runtime_context_1.defaultRuntimeContextFile)({
        flow,
        stage: 'implement',
        sourceMode: flow === 'story' ? 'full_bmad' : 'seeded_solutioning',
        contextScope: flow === 'story' ? 'story' : 'project',
        ...(flow === 'story'
            ? {
                storyId: '20.1',
                epicId: 'epic-20',
                runId: 'run-20-1',
                artifactRoot: '_bmad-output/implementation-artifacts/epic-20/story-20.1',
                artifactPath: '_bmad-output/implementation-artifacts/epic-20/story-20.1/spec.md',
            }
            : {
                runId: 'run-bugfix-20-1',
                artifactRoot: '_bmad-output/implementation-artifacts/_orphan',
                artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_login_loop.md',
            }),
        updatedAt: new Date().toISOString(),
    }));
    const configPath = node_path_1.default.join(root, '_bmad', '_config', 'governance-remediation.yaml');
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(configPath), { recursive: true });
    (0, node_fs_1.writeFileSync)(configPath, [
        'version: 2',
        `primaryHost: ${cursorHost ? 'cursor' : 'claude'}`,
        'packetHosts:',
        `  - ${cursorHost ? 'cursor' : 'claude'}`,
        'provider:',
        '  mode: stub',
        '  id: live-smoke-provider',
        'execution:',
        '  enabled: true',
        '  interactiveMode: main-agent',
        '  fallbackAutonomousMode: false',
        `  authoritativeHost: ${cursorHost ? 'cursor' : 'claude'}`,
        '  fallbackHosts: []',
    ].join('\n'), 'utf8');
    return {
        root,
        cleanup: () => (0, node_fs_1.rmSync)(root, { recursive: true, force: true }),
    };
}
function commandResult(command, args, options = {}) {
    const result = (0, node_child_process_1.spawnSync)(command, args, {
        cwd: options.cwd,
        env: options.env,
        input: options.input,
        encoding: 'utf8',
        timeout: options.timeoutMs ?? 120000,
        windowsHide: true,
    });
    return {
        status: result.status,
        stdout: (result.stdout ?? '').trim(),
        stderr: (result.stderr ?? '').trim(),
        error: result.error ? String(result.error) : null,
    };
}
function detectHostBinaries() {
    return [
        {
            name: 'host-binary:claude',
            status: (0, node_fs_1.existsSync)('C:\\Users\\milom\\.local\\bin\\claude.exe') ? 'pass' : 'fail',
            details: {
                command: 'claude',
            },
        },
        {
            name: 'host-binary:cursor',
            status: (0, node_fs_1.existsSync)('D:\\Users\\milom\\AppData\\Local\\Programs\\cursor\\resources\\app\\resources\\app\\bin\\cursor.cmd')
                ? 'pass'
                : 'fail',
            details: {
                command: 'cursor',
            },
        },
    ];
}
function runClaudeCliSmoke() {
    const result = commandResult('claude', [
        '-p',
        '--output-format',
        'json',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
        'Reply with exactly: CLAUDE_SMOKE_OK',
    ]);
    const passed = result.status === 0 && result.stdout.includes('CLAUDE_SMOKE_OK');
    return {
        name: 'live-smoke:claude-cli-print',
        status: passed ? 'pass' : 'fail',
        details: result,
    };
}
function runCursorCliSmoke() {
    const cursorCommand = process.platform === 'win32' ? 'cursor.cmd' : 'cursor';
    const result = commandResult(cursorCommand, ['agent', '-p', '--force', '--output-format', 'json', 'Reply with exactly: CURSOR_SMOKE_OK'], {
        timeoutMs: 15000,
    });
    const passed = result.status === 0 && result.stdout.includes('CURSOR_SMOKE_OK');
    return {
        name: 'live-smoke:cursor-terminal-agent',
        status: passed ? 'pass' : 'warn',
        details: result,
    };
}
function runHookSmoke(flow, cursorHost) {
    const fixture = createFixtureRoot(flow, cursorHost);
    try {
        const hook = cursorHost
            ? node_path_1.default.join(repoRoot(), '.cursor', 'hooks', 'runtime-policy-inject.cjs')
            : node_path_1.default.join(repoRoot(), '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
        const input = cursorHost
            ? JSON.stringify({
                tool_name: 'Task',
                tool_input: {
                    executor: 'generalPurpose',
                    prompt: flow === 'story'
                        ? 'Execute Story implementation now.'
                        : 'Execute BUGFIX implementation now.',
                },
            })
            : JSON.stringify({
                tool_name: 'Agent',
                tool_input: {
                    subagent_type: 'general-purpose',
                    prompt: flow === 'story'
                        ? 'Execute Story implementation now.'
                        : 'Execute BUGFIX implementation now.',
                },
            });
        const result = commandResult(process.execPath, cursorHost ? [hook, '--cursor-host'] : [hook], {
            cwd: repoRoot(),
            input,
            env: {
                ...process.env,
                CURSOR_PROJECT_ROOT: fixture.root,
                CLAUDE_PROJECT_DIR: fixture.root,
            },
        });
        const parsed = JSON.parse(result.stdout || '{}');
        const stateDir = node_path_1.default.join(fixture.root, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
        const packetDir = node_path_1.default.join(fixture.root, '_bmad-output', 'runtime', 'governance', 'packets');
        const passed = result.status === 0 &&
            parsed.continue === false &&
            (parsed.systemMessage ?? '').includes('orchestration_state') &&
            (parsed.systemMessage ?? '').includes('pending_packet') &&
            (0, node_fs_1.existsSync)(stateDir) &&
            (0, node_fs_1.existsSync)(packetDir);
        return {
            name: `live-smoke:${cursorHost ? 'cursor' : 'claude'}-hook-${flow}`,
            status: passed ? 'pass' : 'fail',
            details: {
                ...result,
                stateDirExists: (0, node_fs_1.existsSync)(stateDir),
                packetDirExists: (0, node_fs_1.existsSync)(packetDir),
            },
        };
    }
    finally {
        fixture.cleanup();
    }
}
function runMainAgentScriptSmoke() {
    const fixture = createFixtureRoot('story', true);
    try {
        const inspect = process.platform === 'win32'
            ? commandResult('cmd.exe', [
                '/d',
                '/s',
                '/c',
                `npm run main-agent-orchestration -- --cwd ${fixture.root} --action dispatch-plan`,
            ], {
                cwd: repoRoot(),
                timeoutMs: 120000,
            })
            : commandResult('npm', [
                'run',
                'main-agent-orchestration',
                '--',
                '--cwd',
                fixture.root,
                '--action',
                'dispatch-plan',
            ], {
                cwd: repoRoot(),
                timeoutMs: 120000,
            });
        const passed = inspect.status === 0 &&
            inspect.stdout.includes('dispatch_implement') &&
            inspect.stdout.includes('packetPath');
        return {
            name: 'live-smoke:main-agent-orchestration-script',
            status: passed ? 'pass' : 'fail',
            details: inspect,
        };
    }
    finally {
        fixture.cleanup();
    }
}
function buildReport(results) {
    const passed = results.filter((item) => item.status === 'pass').length;
    const warned = results.filter((item) => item.status === 'warn').length;
    const failed = results.filter((item) => item.status === 'fail').length;
    return {
        generatedAt: new Date().toISOString(),
        repoRoot: repoRoot(),
        summary: {
            passed,
            warned,
            failed,
        },
        results,
    };
}
function main() {
    const results = [
        ...detectHostBinaries(),
        runClaudeCliSmoke(),
        runCursorCliSmoke(),
        runHookSmoke('story', false),
        runHookSmoke('story', true),
        runHookSmoke('bugfix', true),
        runMainAgentScriptSmoke(),
    ];
    const report = buildReport(results);
    const reportPath = node_path_1.default.join(repoRoot(), 'outputs', 'runtime', 'vibe-sessions', '2026-04-25-main-agent-e2e-orchestration-runtime', 'live-smoke-report.json');
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(reportPath), { recursive: true });
    (0, node_fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
main();
