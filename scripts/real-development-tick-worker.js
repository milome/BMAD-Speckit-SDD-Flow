const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BMAD_ROOT = process.env.BMAD_FRAMEWORK_ROOT || 'D:\\Dev\\BMAD-Speckit-SDD-Flow';

function run(command, args, options = {}) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    timeout: options.timeoutMs,
    input: options.input,
    env: options.env ?? process.env,
  });
  return {
    command: [command, ...args].join(' '),
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode: result.status ?? (result.error ? 1 : 0),
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, payload) {
  writeText(filePath, JSON.stringify(payload, null, 2) + '\n');
}

function appendJsonl(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf8');
}

function hashText(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJsonObject(filePath) {
  const raw = fs.readFileSync(filePath);
  let text;
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    text = raw.subarray(2).toString('utf16le');
  } else {
    text = raw.toString('utf8').replace(/^\uFEFF/u, '');
  }
  const trimmed = text.trim();
  const jsonText =
    trimmed.startsWith('{') && trimmed.endsWith('}')
      ? trimmed
      : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(jsonText);
}

function gitCapture(projectRoot, args, filePath) {
  const result = run('git', args, { cwd: projectRoot, timeoutMs: 60_000 });
  writeText(filePath, `${result.stdout}${result.stderr}`);
  return result;
}

function diffHash(projectRoot) {
  const result = run('git', ['diff', '--binary'], { cwd: projectRoot, timeoutMs: 60_000 });
  return hashText(`${result.stdout}${result.stderr}`);
}

function tickObjective(tick) {
  if (tick === 1) {
    return [
      'Implement Backtester subprocess Phase 2: prestart without showing UI, ready/health handshake, repeated show idempotency, dead process restart, and idempotent shutdown.',
      'Add or update real tests covering launcher prestart/health/restart/shutdown and subprocess repeated show guard.',
    ].join(' ');
  }
  return [
    'Continue from previous tick evidence with real fix, test rerun, review, and gate rerun.',
    'If failures remain, fix them. If implementation is already passing, complete TaskReport evidence and final inspect/gate without empty heartbeats.',
  ].join(' ');
}

function createPacket(projectRoot, sessionDir, tick) {
  const packetId = `real-dev-phase2-tick-${String(tick).padStart(3, '0')}`;
  const sessionId = 'backtester-independent-process-phase2-8h';
  const packet = {
    packetId,
    parentSessionId: sessionId,
    flow: 'story',
    phase: 'implement',
    taskType: tick === 1 ? 'implement' : 'remediate',
    role: 'codex-no-hooks-worker',
    inputArtifacts: [
      'docs/plans/PRD_backtest_independent_process.md',
      path.join(sessionDir, 'task-plan.md'),
      path.join(sessionDir, 'ticks.jsonl'),
    ],
    allowedWriteScope: [
      'vnpy/trader/backtester_subprocess_launcher.py',
      'vnpy_ctabacktester/vnpy_ctabacktester/run_backtester_subprocess.py',
      'tests/trader/test_backtester_run_in_subprocess_menu.py',
      'tests/ui/test_mainwindow_subprocess_menu_actions.py',
      '_bmad-output/**',
    ],
    expectedDelta: tickObjective(tick),
    successCriteria: [
      'BMAD main-agent codex worker adapter reads this dispatch packet and invokes Codex.',
      'Worker writes a TaskReport at the requested taskReportPath.',
      'TaskReport is ingested by BMAD main-agent run-loop using --taskReportPath.',
      'Targeted consumer-project tests are run and logged.',
      'Each tick records before/after diff hash, patch, adapter report, run-loop ingest, and tests in ticks.jsonl.',
    ],
    stopConditions: [
      'Do not edit outside allowedWriteScope.',
      'Do not claim completion without passing tests or writing blocked evidence.',
      'Do not commit or push.',
    ],
    downstreamConsumer: 'main-agent-run-loop-task-report-ingest',
  };
  const packetPath = path.join(sessionDir, 'dispatch-packets', `${packetId}.json`);
  writeJson(packetPath, packet);
  return { packet, packetPath };
}

function tsNodeArgs(scriptPath, extraArgs) {
  return [
    path.join(BMAD_ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js'),
    '--project',
    path.join(BMAD_ROOT, 'tsconfig.node.json'),
    '--transpile-only',
    scriptPath,
    ...extraArgs,
  ];
}

function main() {
  const projectRoot = process.cwd();
  const sessionDir = process.env.BMAD_REAL_DEV_SESSION_DIR;
  const tick = Number(process.env.BMAD_REAL_DEV_TICK ?? '0');
  const tickDir =
    process.env.BMAD_REAL_DEV_TICK_DIR ||
    (sessionDir ? path.join(sessionDir, `tick-${String(tick).padStart(3, '0')}`) : '');

  if (!sessionDir || !tickDir || !tick) {
    console.error('Missing BMAD_REAL_DEV_SESSION_DIR/BMAD_REAL_DEV_TICK/BMAD_REAL_DEV_TICK_DIR');
    return 2;
  }

  fs.mkdirSync(tickDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const beforeHash = diffHash(projectRoot);
  gitCapture(projectRoot, ['status', '--short'], path.join(tickDir, 'before.status.txt'));
  gitCapture(projectRoot, ['diff', '--binary'], path.join(tickDir, 'before.diff.patch'));

  const { packet, packetPath } = createPacket(projectRoot, sessionDir, tick);
  const taskReportPath = path.join(tickDir, 'task-report.json');
  const adapterReportPath = path.join(tickDir, 'codex-worker-adapter-report.json');
  const runLoopIngestPath = path.join(tickDir, 'main-agent-run-loop-ingest.json');

  const adapter = run(
    process.execPath,
    tsNodeArgs(path.join(BMAD_ROOT, 'scripts', 'main-agent-codex-worker-adapter.ts'), [
      '--cwd',
      projectRoot,
      '--packetPath',
      packetPath,
      '--taskReportPath',
      taskReportPath,
      '--reportPath',
      adapterReportPath,
      '--timeoutMs',
      String(35 * 60 * 1000),
    ]),
    {
      cwd: BMAD_ROOT,
      timeoutMs: 40 * 60 * 1000,
      env: {
        ...process.env,
        BMAD_FRAMEWORK_ROOT: BMAD_ROOT,
        BMAD_REAL_DEV_SESSION_DIR: sessionDir,
        BMAD_REAL_DEV_TICK: String(tick),
        BMAD_REAL_DEV_TICK_DIR: tickDir,
      },
    }
  );
  writeText(path.join(tickDir, 'adapter-stdout.log'), adapter.stdout);
  writeText(path.join(tickDir, 'adapter-stderr.log'), adapter.stderr);

  const runLoop = run(
    process.execPath,
    tsNodeArgs(path.join(BMAD_ROOT, 'scripts', 'main-agent-orchestration.ts'), [
      '--action',
      'run-loop',
      '--cwd',
      projectRoot,
      '--flow',
      'story',
      '--stage',
      'implement',
      '--taskReportPath',
      taskReportPath,
    ]),
    { cwd: BMAD_ROOT, timeoutMs: 5 * 60 * 1000 }
  );
  writeText(runLoopIngestPath, `${runLoop.stdout}${runLoop.stderr}`);

  const test = run(
    'python',
    [
      '-m',
      'pytest',
      'tests/trader/test_backtester_run_in_subprocess_menu.py',
      'tests/ui/test_mainwindow_subprocess_menu_actions.py',
      '-q',
    ],
    { cwd: projectRoot, timeoutMs: 10 * 60 * 1000 }
  );
  writeText(path.join(tickDir, 'test-targeted.log'), `${test.stdout}${test.stderr}`);

  const afterHash = diffHash(projectRoot);
  gitCapture(projectRoot, ['status', '--short'], path.join(tickDir, 'after.status.txt'));
  gitCapture(projectRoot, ['diff', '--binary'], path.join(tickDir, 'after.diff.patch'));

  let taskReport = null;
  if (fs.existsSync(taskReportPath)) {
    try {
      taskReport = readJsonObject(taskReportPath);
    } catch (error) {
      taskReport = { status: 'invalid_json', error: String(error) };
    }
  }

  const tickRecord = {
    tick,
    startedAt,
    endedAt: new Date().toISOString(),
    action: 'bmad-main-agent-codex-worker-adapter-dispatch-ingest-gate-tick',
    bmadFrameworkRoot: BMAD_ROOT,
    consumerProjectRoot: projectRoot,
    packetId: packet.packetId,
    packetPath,
    beforeDiffHash: beforeHash,
    afterDiffHash: afterHash,
    patchChanged: beforeHash !== afterHash,
    adapter: {
      command: adapter.command,
      exitCode: adapter.exitCode,
      stdoutPath: path.join(tickDir, 'adapter-stdout.log'),
      stderrPath: path.join(tickDir, 'adapter-stderr.log'),
      reportPath: adapterReportPath,
    },
    runLoopIngest: {
      command: runLoop.command,
      exitCode: runLoop.exitCode,
      outputPath: runLoopIngestPath,
    },
    tests: [
      {
        command: test.command,
        exitCode: test.exitCode,
        logPath: path.join(tickDir, 'test-targeted.log'),
      },
    ],
    evidence: {
      beforeStatusPath: path.join(tickDir, 'before.status.txt'),
      beforeDiffPath: path.join(tickDir, 'before.diff.patch'),
      afterStatusPath: path.join(tickDir, 'after.status.txt'),
      afterDiffPath: path.join(tickDir, 'after.diff.patch'),
      taskReportPath,
      runLoopIngestPath,
    },
    taskReport,
    result:
      adapter.exitCode === 0 && runLoop.exitCode === 0 && test.exitCode === 0 ? 'passed' : 'failed',
    rerunFixes:
      adapter.exitCode === 0 && runLoop.exitCode === 0 && test.exitCode === 0
        ? []
        : ['Next tick must inspect adapter/run-loop/test logs and close failures via BMAD orchestrated rerun.'],
  };

  appendJsonl(path.join(sessionDir, 'ticks.jsonl'), tickRecord);
  writeJson(path.join(tickDir, 'tick-record.json'), tickRecord);
  return tickRecord.result === 'passed' ? 0 : 1;
}

process.exitCode = main();
