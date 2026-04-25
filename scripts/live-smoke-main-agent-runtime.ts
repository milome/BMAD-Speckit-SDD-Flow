import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  defaultRuntimeContextFile,
  writeRuntimeContext,
} from './runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';

interface LiveSmokeResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details: Record<string, unknown>;
}

function repoRoot(): string {
  return process.cwd();
}

function rootTmpDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function linkNodeModules(projectRoot: string): void {
  const src = path.join(repoRoot(), 'node_modules');
  const dest = path.join(projectRoot, 'node_modules');
  if (existsSync(dest)) {
    return;
  }
  if (process.platform === 'win32') {
    symlinkSync(src, dest, 'junction');
  } else {
    symlinkSync(src, dest, 'dir');
  }
}

function createFixtureRoot(flow: 'story' | 'bugfix', cursorHost: boolean): {
  root: string;
  cleanup: () => void;
} {
  const root = rootTmpDir(`main-agent-live-smoke-${flow}-`);
  cpSync(path.join(repoRoot(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
  linkNodeModules(root);
  writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
  writeRuntimeContext(
    root,
    defaultRuntimeContextFile({
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
    })
  );
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
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
    ].join('\n'),
    'utf8'
  );
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function commandResult(command: string, args: string[], options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
} = {}) {
  const result = spawnSync(command, args, {
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

function detectHostBinaries(): LiveSmokeResult[] {
  return [
    {
      name: 'host-binary:claude',
      status: existsSync('C:\\Users\\milom\\.local\\bin\\claude.exe') ? 'pass' : 'fail',
      details: {
        command: 'claude',
      },
    },
    {
      name: 'host-binary:cursor',
      status: existsSync('D:\\Users\\milom\\AppData\\Local\\Programs\\cursor\\resources\\app\\resources\\app\\bin\\cursor.cmd')
        ? 'pass'
        : 'fail',
      details: {
        command: 'cursor',
      },
    },
  ];
}

function runClaudeCliSmoke(): LiveSmokeResult {
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

function runCursorCliSmoke(): LiveSmokeResult {
  const cursorCommand = process.platform === 'win32' ? 'cursor.cmd' : 'cursor';
  const result = commandResult(cursorCommand, [
    'agent',
    '-p',
    '--force',
    '--output-format',
    'json',
    'Reply with exactly: CURSOR_SMOKE_OK',
  ], {
    timeoutMs: 15000,
  });
  const passed = result.status === 0 && result.stdout.includes('CURSOR_SMOKE_OK');
  return {
    name: 'live-smoke:cursor-terminal-agent',
    status: passed ? 'pass' : 'warn',
    details: result,
  };
}

function runHookSmoke(flow: 'story' | 'bugfix', cursorHost: boolean): LiveSmokeResult {
  const fixture = createFixtureRoot(flow, cursorHost);
  try {
    const hook = cursorHost
      ? path.join(repoRoot(), '.cursor', 'hooks', 'runtime-policy-inject.cjs')
      : path.join(repoRoot(), '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
    const input = cursorHost
      ? JSON.stringify({
          tool_name: 'Task',
          tool_input: {
            executor: 'generalPurpose',
            prompt: flow === 'story' ? 'Execute Story implementation now.' : 'Execute BUGFIX implementation now.',
          },
        })
      : JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            subagent_type: 'general-purpose',
            prompt: flow === 'story' ? 'Execute Story implementation now.' : 'Execute BUGFIX implementation now.',
          },
        });

    const result = commandResult(
      process.execPath,
      cursorHost ? [hook, '--cursor-host'] : [hook],
      {
        cwd: repoRoot(),
        input,
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: fixture.root,
          CLAUDE_PROJECT_DIR: fixture.root,
        },
      }
    );

    const parsed = JSON.parse(result.stdout || '{}') as { continue?: boolean; systemMessage?: string };
    const stateDir = path.join(fixture.root, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
    const packetDir = path.join(fixture.root, '_bmad-output', 'runtime', 'governance', 'packets');
    const passed =
      result.status === 0 &&
      parsed.continue === false &&
      (parsed.systemMessage ?? '').includes('orchestration_state') &&
      (parsed.systemMessage ?? '').includes('pending_packet') &&
      existsSync(stateDir) &&
      existsSync(packetDir);

    return {
      name: `live-smoke:${cursorHost ? 'cursor' : 'claude'}-hook-${flow}`,
      status: passed ? 'pass' : 'fail',
      details: {
        ...result,
        stateDirExists: existsSync(stateDir),
        packetDirExists: existsSync(packetDir),
      },
    };
  } finally {
    fixture.cleanup();
  }
}

function runMainAgentScriptSmoke(): LiveSmokeResult {
  const fixture = createFixtureRoot('story', true);
  try {
    const inspect =
      process.platform === 'win32'
        ? commandResult('cmd.exe', ['/d', '/s', '/c', `npm run main-agent-orchestration -- --cwd ${fixture.root} --action dispatch-plan`], {
            cwd: repoRoot(),
            timeoutMs: 120000,
          })
        : commandResult('npm', ['run', 'main-agent-orchestration', '--', '--cwd', fixture.root, '--action', 'dispatch-plan'], {
            cwd: repoRoot(),
            timeoutMs: 120000,
          });
    const passed =
      inspect.status === 0 &&
      inspect.stdout.includes('dispatch_implement') &&
      inspect.stdout.includes('packetPath');
    return {
      name: 'live-smoke:main-agent-orchestration-script',
      status: passed ? 'pass' : 'fail',
      details: inspect,
    };
  } finally {
    fixture.cleanup();
  }
}

function buildReport(results: LiveSmokeResult[]) {
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
  const reportPath = path.join(
    repoRoot(),
    'outputs',
    'runtime',
    'vibe-sessions',
    '2026-04-25-main-agent-e2e-orchestration-runtime',
    'live-smoke-report.json'
  );
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
