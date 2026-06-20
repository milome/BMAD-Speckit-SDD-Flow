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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const fs = __importStar(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const runtime_context_1 = require("./runtime-context");
const runtime_context_registry_1 = require("./runtime-context-registry");
function repoRoot() {
    return process.cwd();
}
function tmpRoot(prefix) {
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
function commandResult(command, args, cwd) {
    const result = (0, node_child_process_1.spawnSync)(command, args, {
        cwd,
        encoding: 'utf8',
        timeout: 120000,
        windowsHide: true,
    });
    return {
        status: result.status,
        stdout: (result.stdout ?? '').trim(),
        stderr: (result.stderr ?? '').trim(),
        error: result.error ? String(result.error) : null,
    };
}
function createSpeckitFixture() {
    const root = tmpRoot('speckit-workflow-main-agent-');
    (0, node_fs_1.cpSync)(node_path_1.default.join(repoRoot(), '_bmad'), node_path_1.default.join(root, '_bmad'), { recursive: true });
    linkNodeModules(root);
    (0, runtime_context_registry_1.writeRuntimeContextRegistry)(root, (0, runtime_context_registry_1.defaultRuntimeContextRegistry)(root));
    (0, runtime_context_1.writeRuntimeContext)(root, (0, runtime_context_1.defaultRuntimeContextFile)({
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'story',
        storyId: '31.1',
        epicId: 'epic-31',
        runId: 'run-31-1',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-31/story-31.1',
        artifactPath: '_bmad-output/implementation-artifacts/epic-31/story-31.1/TASKS_E31-S1.md',
        updatedAt: new Date().toISOString(),
    }));
    const tasksPath = node_path_1.default.join(root, '_bmad-output', 'implementation-artifacts', 'epic-31', 'story-31.1', 'TASKS_E31-S1.md');
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(tasksPath), { recursive: true });
    (0, node_fs_1.writeFileSync)(tasksPath, '# TASKS\n\n- [ ] T001 Smoke Speckit handoff\n', 'utf8');
    const configPath = node_path_1.default.join(root, '_bmad', '_config', 'governance-remediation.yaml');
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(configPath), { recursive: true });
    (0, node_fs_1.writeFileSync)(configPath, [
        'version: 2',
        'primaryHost: cursor',
        'packetHosts:',
        '  - cursor',
        'provider:',
        '  mode: stub',
        '  id: speckit-workflow-smoke-provider',
        'execution:',
        '  enabled: true',
        '  interactiveMode: main-agent',
        '  fallbackAutonomousMode: false',
        '  authoritativeHost: cursor',
        '  fallbackHosts: []',
    ].join('\n'), 'utf8');
    return {
        root,
        cleanup: () => (0, node_fs_1.rmSync)(root, { recursive: true, force: true }),
    };
}
function readFileCheck(name, file) {
    const content = fs.readFileSync(file, 'utf8');
    const passed = content.includes('main-agent-orchestration') &&
        content.includes('dispatch-plan') &&
        content.includes('pendingPacketStatus');
    return {
        name,
        status: passed ? 'pass' : 'fail',
        details: {
            file,
        },
    };
}
function runSpeckitRuntimeCheck() {
    const fixture = createSpeckitFixture();
    try {
        const dispatchPlan = process.platform === 'win32'
            ? commandResult('cmd.exe', [
                '/d',
                '/s',
                '/c',
                `npm run main-agent-orchestration -- --cwd ${fixture.root} --action dispatch-plan`,
            ], repoRoot())
            : commandResult('npm', [
                'run',
                'main-agent-orchestration',
                '--',
                '--cwd',
                fixture.root,
                '--action',
                'dispatch-plan',
            ], repoRoot());
        const dispatchPass = dispatchPlan.status === 0 &&
            dispatchPlan.stdout.includes('dispatch_implement') &&
            dispatchPlan.stdout.includes('packetPath');
        const inspect = process.platform === 'win32'
            ? commandResult('cmd.exe', [
                '/d',
                '/s',
                '/c',
                `npm run main-agent-orchestration -- --cwd ${fixture.root} --action inspect`,
            ], repoRoot())
            : commandResult('npm', ['run', 'main-agent-orchestration', '--', '--cwd', fixture.root, '--action', 'inspect'], repoRoot());
        const inspectPass = inspect.status === 0 &&
            inspect.stdout.includes('"pendingPacketStatus": "ready_for_main_agent"') &&
            inspect.stdout.includes('"mainAgentNextAction": "dispatch_implement"');
        return [
            {
                name: 'speckit-smoke:dispatch-plan',
                status: dispatchPass ? 'pass' : 'fail',
                details: dispatchPlan,
            },
            {
                name: 'speckit-smoke:inspect-after-dispatch-plan',
                status: inspectPass ? 'pass' : 'fail',
                details: inspect,
            },
        ];
    }
    finally {
        fixture.cleanup();
    }
}
function outputDir() {
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
    }).format(new Date());
    return node_path_1.default.join(repoRoot(), 'outputs', 'runtime', 'vibe-sessions', `${date}-speckit-workflow-main-agent-smoke`);
}
function main() {
    const results = [
        readFileCheck('speckit-smoke:cursor-skill-surface', node_path_1.default.join(repoRoot(), '.cursor', 'skills', 'speckit-workflow', 'SKILL.md')),
        readFileCheck('speckit-smoke:claude-skill-surface', node_path_1.default.join(repoRoot(), '.claude', 'skills', 'speckit-workflow', 'SKILL.md')),
        ...runSpeckitRuntimeCheck(),
    ];
    const outDir = outputDir();
    (0, node_fs_1.mkdirSync)(outDir, { recursive: true });
    const reportPath = node_path_1.default.join(outDir, 'live-smoke-report.json');
    const payload = {
        summary: {
            passed: results.filter((item) => item.status === 'pass').length,
            failed: results.filter((item) => item.status === 'fail').length,
            total: results.length,
        },
        results,
    };
    (0, node_fs_1.writeFileSync)(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    process.stdout.write(`${JSON.stringify({ reportPath, ...payload.summary }, null, 2)}\n`);
    return payload.summary.failed === 0 ? 0 : 1;
}
if (require.main === module) {
    process.exit(main());
}
