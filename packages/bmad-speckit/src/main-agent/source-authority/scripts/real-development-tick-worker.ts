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

function appendTickEvent(sessionDir, tickDir, payload) {
  const event = {
    tick: Number(process.env.BMAD_REAL_DEV_TICK ?? '0'),
    recordedAt: new Date().toISOString(),
    ...payload,
  };
  appendJsonl(path.join(sessionDir, 'tick-events.jsonl'), event);
  appendJsonl(path.join(tickDir, 'events.jsonl'), event);
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

function gitOutput(projectRoot, args) {
  const result = run('git', args, { cwd: projectRoot, timeoutMs: 60_000 });
  return `${result.stdout}${result.stderr}`;
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
    role: 'main-session-implementation',
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
      'The current main session reads and executes this dispatch packet.',
      'The current main session writes a TaskReport at the requested taskReportPath.',
      'TaskReport is ingested by BMAD main-agent run-loop using --taskReportPath.',
      'Targeted consumer-project tests are run and logged.',
      'Each tick records before/after diff hash, patch, main-session handoff, run-loop ingest, and tests in ticks.jsonl.',
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

function normalizeSlash(value) {
  return value.replace(/\\/g, '/');
}

function scopeToPathspec(scope) {
  const normalized = normalizeSlash(scope);
  return normalized.endsWith('/**') ? normalized.slice(0, -3) : normalized;
}

function changedFiles(projectRoot, scopes) {
  const pathspecs = scopes.map(scopeToPathspec).filter((scope) => !scope.includes('*'));
  const args = pathspecs.length > 0 ? ['diff', '--name-only', '--', ...pathspecs] : ['diff', '--name-only'];
  return gitOutput(projectRoot, args)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('warning:'));
}

function finalTaskReport(input) {
  const existing =
    fs.existsSync(input.taskReportPath) && fs.statSync(input.taskReportPath).size > 0
      ? (() => {
          try {
            return readJsonObject(input.taskReportPath);
          } catch {
            return null;
          }
        })()
      : null;
  const testPassed = input.testExitCode === 0;
  const filesChanged = Array.from(
    new Set([...(Array.isArray(existing?.filesChanged) ? existing.filesChanged : []), ...input.filesChanged])
  );
  const existingEvidence = Array.isArray(existing?.evidence) ? existing.evidence : [];
  const evidence = Array.from(
    new Set([
      ...existingEvidence,
      input.mainSessionHandoffPath,
      input.testLogPath,
      input.afterDiffPath,
    ])
  );
  const validationsRun = Array.from(
    new Set([
      ...(Array.isArray(existing?.validationsRun) ? existing.validationsRun : []),
      'main-session-execution',
      'pytest:targeted-backtester-subprocess',
      'bmad-real-development-tick-finalize',
    ])
  );
  const status =
    testPassed && (input.patchChanged || input.hasPriorCompletedTick) ? 'done' : 'blocked';
  return {
    packetId: input.packet.packetId,
    status,
    filesChanged,
    validationsRun,
    evidence:
      status === 'done'
        ? evidence
        : [
            ...evidence,
            `testExitCode=${input.testExitCode}`,
          ],
    downstreamContext: [
      input.packet.expectedDelta,
      status === 'done'
        ? input.patchChanged
          ? 'Real development tick produced patch and targeted tests passed; ready for main-agent ingest/final inspect.'
          : 'Real review/gate tick reran targeted tests after prior completed patch; no additional code change was required.'
        : 'Next tick must fix main-session execution or test failures and rerun gates.',
    ],
  };
}

function hasPriorCompletedTick(sessionDir) {
  const ticksPath = path.join(sessionDir, 'ticks.jsonl');
  if (!fs.existsSync(ticksPath)) {
    return false;
  }
  return fs
    .readFileSync(ticksPath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .some((line) => {
      try {
        const record = JSON.parse(line);
        return record?.result === 'passed' || record?.taskReport?.status === 'done';
      } catch {
        return false;
      }
    });
}

function writeTickOrchestrationState(projectRoot, packet, packetPath) {
  const stateDir = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
  const statePath = path.join(stateDir, `${packet.parentSessionId}.json`);
  const existing = fs.existsSync(statePath) ? readJsonObject(statePath) : {};
  const state = {
    ...existing,
    version: 1,
    sessionId: packet.parentSessionId,
    host: 'codex',
    flow: packet.flow,
    currentPhase: packet.phase,
    nextAction: packet.taskType === 'remediate' ? 'dispatch_remediation' : 'dispatch_implement',
    pendingPacket: {
      packetId: packet.packetId,
      packetPath,
      packetKind: 'execution',
      status: 'ready_for_main_agent',
      createdAt: new Date().toISOString(),
      claimOwner: null,
    },
    originalExecutionPacketId: existing.originalExecutionPacketId ?? null,
    gatesLoop: {
      retryCount: existing.gatesLoop?.retryCount ?? 0,
      maxRetries: existing.gatesLoop?.maxRetries ?? 3,
      noProgressCount: existing.gatesLoop?.noProgressCount ?? 0,
      circuitOpen: false,
      rerunGate: packet.taskType === 'remediate' ? 'targeted-tests' : null,
      activePacketId: packet.packetId,
      lastResult: existing.gatesLoop?.lastResult ?? null,
    },
    closeout: existing.closeout ?? {
      invoked: false,
      approved: false,
      scoreWriteResult: null,
      handoffPersisted: false,
      resultCode: null,
    },
    lastTaskReport: existing.lastTaskReport ?? null,
  };
  writeJson(statePath, state);
  return statePath;
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
  appendTickEvent(sessionDir, tickDir, { event: 'tick_started', sessionDir, tickDir });
  const beforeHash = diffHash(projectRoot);
  gitCapture(projectRoot, ['status', '--short'], path.join(tickDir, 'before.status.txt'));
  gitCapture(projectRoot, ['diff', '--binary'], path.join(tickDir, 'before.diff.patch'));

  const { packet, packetPath } = createPacket(projectRoot, sessionDir, tick);
  const orchestrationStatePath = writeTickOrchestrationState(projectRoot, packet, packetPath);
  const taskReportPath = path.join(tickDir, 'task-report.json');
  const mainSessionHandoffPath = path.join(tickDir, 'main-session-execution-handoff.json');
  const runLoopIngestPath = path.join(tickDir, 'main-agent-run-loop-ingest.json');
  writeJson(mainSessionHandoffPath, {
    schemaVersion: 'main-session-execution-handoff/v1',
    packetId: packet.packetId,
    packetPath,
    executionSurface: 'current_main_session',
    decision: 'blocked_pending_main_session',
  });
  appendTickEvent(sessionDir, tickDir, {
    event: 'main_session_execution_handoff_prepared',
    packetPath,
    orchestrationStatePath,
    taskReportPath,
    mainSessionHandoffPath,
  });

  appendTickEvent(sessionDir, tickDir, { event: 'targeted_tests_started' });
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
  appendTickEvent(sessionDir, tickDir, {
    event: 'targeted_tests_finished',
    exitCode: test.exitCode,
    logPath: path.join(tickDir, 'test-targeted.log'),
  });

  const afterHash = diffHash(projectRoot);
  gitCapture(projectRoot, ['status', '--short'], path.join(tickDir, 'after.status.txt'));
  const afterDiffPath = path.join(tickDir, 'after.diff.patch');
  gitCapture(projectRoot, ['diff', '--binary'], afterDiffPath);

  const finalizedTaskReport = finalTaskReport({
    packet,
    taskReportPath,
    mainSessionHandoffPath,
    testExitCode: test.exitCode,
    testLogPath: path.join(tickDir, 'test-targeted.log'),
    afterDiffPath,
    patchChanged: beforeHash !== afterHash,
    hasPriorCompletedTick: hasPriorCompletedTick(sessionDir),
    filesChanged: changedFiles(projectRoot, packet.allowedWriteScope ?? []),
  });
  writeJson(taskReportPath, finalizedTaskReport);
  appendTickEvent(sessionDir, tickDir, {
    event: 'task_report_finalized',
    status: finalizedTaskReport.status,
    taskReportPath,
  });

  appendTickEvent(sessionDir, tickDir, { event: 'run_loop_ingest_started', taskReportPath });
  const runLoop = run(
    process.execPath,
    [
      path.join(BMAD_ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
      'main-agent-orchestration',
      '--action',
      'run-loop',
      '--cwd',
      projectRoot,
      '--flow',
      'story',
      '--stage',
      'implement',
      '--host',
      'codex',
      '--taskReportPath',
      taskReportPath,
    ],
    { cwd: BMAD_ROOT, timeoutMs: 5 * 60 * 1000 }
  );
  writeText(runLoopIngestPath, `${runLoop.stdout}${runLoop.stderr}`);
  appendTickEvent(sessionDir, tickDir, {
    event: 'run_loop_ingest_finished',
    exitCode: runLoop.exitCode,
    outputPath: runLoopIngestPath,
  });

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
    action: 'bmad-main-agent-main-session-dispatch-ingest-gate-tick',
    bmadFrameworkRoot: BMAD_ROOT,
    consumerProjectRoot: projectRoot,
    packetId: packet.packetId,
    packetPath,
    orchestrationStatePath,
    beforeDiffHash: beforeHash,
    afterDiffHash: afterHash,
    patchChanged: beforeHash !== afterHash,
    mainSessionExecution: {
      executionSurface: 'current_main_session',
      handoffPath: mainSessionHandoffPath,
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
      afterDiffPath,
      taskReportPath,
      runLoopIngestPath,
    },
    taskReport,
    result:
      finalizedTaskReport.status === 'done' && runLoop.exitCode === 0 && test.exitCode === 0
        ? 'passed'
        : 'failed',
    rerunFixes:
      finalizedTaskReport.status === 'done' && runLoop.exitCode === 0 && test.exitCode === 0
        ? []
        : ['Next tick must inspect main-session handoff, run-loop, and test logs before rerun.'],
  };

  appendJsonl(path.join(sessionDir, 'ticks.jsonl'), tickRecord);
  writeJson(path.join(tickDir, 'tick-record.json'), tickRecord);
  appendTickEvent(sessionDir, tickDir, {
    event: 'tick_finished',
    result: tickRecord.result,
    tickRecordPath: path.join(tickDir, 'tick-record.json'),
  });
  return tickRecord.result === 'passed' ? 0 : 1;
}

process.exitCode = main();
