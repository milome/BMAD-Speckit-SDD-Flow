import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultRuntimeContextFile, writeRuntimeContext } from './runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from './runtime-context-registry';

interface SmokeResult {
  name: string;
  status: 'pass' | 'fail';
  details: Record<string, unknown>;
}

function repoRoot(): string {
  return process.cwd();
}

function tmpRoot(prefix: string): string {
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

function commandResult(command: string, args: string[], cwd?: string) {
  const result = spawnSync(command, args, {
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

function createSpeckitFixture(): { root: string; cleanup: () => void } {
  const root = tmpRoot('speckit-workflow-main-agent-');
  cpSync(path.join(repoRoot(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
  linkNodeModules(root);
  writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
  writeRuntimeContext(
    root,
    defaultRuntimeContextFile({
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
    })
  );
  const tasksPath = path.join(
    root,
    '_bmad-output',
    'implementation-artifacts',
    'epic-31',
    'story-31.1',
    'TASKS_E31-S1.md'
  );
  mkdirSync(path.dirname(tasksPath), { recursive: true });
  writeFileSync(tasksPath, '# TASKS\n\n- [ ] T001 Smoke Speckit handoff\n', 'utf8');
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
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
    ].join('\n'),
    'utf8'
  );
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function readFileCheck(name: string, file: string): SmokeResult {
  const content = fs.readFileSync(file, 'utf8');
  const passed =
    content.includes('main-agent-orchestration') &&
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

function runSpeckitRuntimeCheck(): SmokeResult[] {
  const fixture = createSpeckitFixture();
  try {
    const dispatchPlan =
      process.platform === 'win32'
        ? commandResult(
            'cmd.exe',
            ['/d', '/s', '/c', `npm run main-agent-orchestration -- --cwd ${fixture.root} --action dispatch-plan`],
            repoRoot()
          )
        : commandResult(
            'npm',
            ['run', 'main-agent-orchestration', '--', '--cwd', fixture.root, '--action', 'dispatch-plan'],
            repoRoot()
          );

    const dispatchPass =
      dispatchPlan.status === 0 &&
      dispatchPlan.stdout.includes('dispatch_implement') &&
      dispatchPlan.stdout.includes('packetPath');

    const inspect =
      process.platform === 'win32'
        ? commandResult(
            'cmd.exe',
            ['/d', '/s', '/c', `npm run main-agent-orchestration -- --cwd ${fixture.root} --action inspect`],
            repoRoot()
          )
        : commandResult(
            'npm',
            ['run', 'main-agent-orchestration', '--', '--cwd', fixture.root, '--action', 'inspect'],
            repoRoot()
          );

    const inspectPass =
      inspect.status === 0 &&
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
  } finally {
    fixture.cleanup();
  }
}

function outputDir(): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date());
  return path.join(
    repoRoot(),
    'outputs',
    'runtime',
    'vibe-sessions',
    `${date}-speckit-workflow-main-agent-smoke`
  );
}

function main(): number {
  const results: SmokeResult[] = [
    readFileCheck(
      'speckit-smoke:cursor-skill-surface',
      path.join(repoRoot(), '.cursor', 'skills', 'speckit-workflow', 'SKILL.md')
    ),
    readFileCheck(
      'speckit-smoke:claude-skill-surface',
      path.join(repoRoot(), '.claude', 'skills', 'speckit-workflow', 'SKILL.md')
    ),
    ...runSpeckitRuntimeCheck(),
  ];

  const outDir = outputDir();
  mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'live-smoke-report.json');
  const payload = {
    summary: {
      passed: results.filter((item) => item.status === 'pass').length,
      failed: results.filter((item) => item.status === 'fail').length,
      total: results.length,
    },
    results,
  };
  writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  process.stdout.write(`${JSON.stringify({ reportPath, ...payload.summary }, null, 2)}\n`);
  return payload.summary.failed === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}
