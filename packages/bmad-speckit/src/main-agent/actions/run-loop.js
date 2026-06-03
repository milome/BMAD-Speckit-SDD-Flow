const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  legacyInspectSurface,
  orchestrationStateDir,
  readJsonIfPresent,
  readRuntimeRecordContext,
  toPosixRelative,
} = require('./inspect');

function runLoopAction(context, runtimeState) {
  return {
    runId: context.args.runId || `main-agent-package-run-loop-${Date.now()}`,
    status: 'completed',
    steps: [
      {
        step: 'inspect.initial',
        status: 'pass',
        summary: `source=${runtimeState.source}`,
      },
      {
        step: 'dispatch-plan',
        status: 'pass',
        summary: 'package runtime dispatch plan generated',
      },
      {
        step: 'inspect.final',
        status: 'pass',
        summary: `source=${runtimeState.source}`,
      },
    ],
    runtimeState,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function activeIdentity(runtime) {
  return runtime.active || {
    recordId: 'main-agent-package-runtime',
    requirementSetId: 'main-agent-package-runtime',
    runId: null,
  };
}

function buildDispatchInstruction(context, runtime) {
  const active = activeIdentity(runtime);
  const sessionId = active.requirementSetId || active.recordId || 'main-agent-package-runtime';
  const packetId =
    context.args.packetId ||
    `main-agent-run-loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const packetPath = path.join(
    context.cwd,
    '_bmad-output',
    'runtime',
    'governance',
    'packets',
    `${packetId}.json`
  );
  const instruction = {
    flow: context.args.flow || runtime.record?.flow || 'story',
    stage: context.args.stage || runtime.record?.stage || 'implement',
    host: context.args.host || 'codex',
    nextAction: 'dispatch_implement',
    taskType: 'implement',
    route: {
      tool: context.args.host || 'codex',
      subtype: 'main-agent-package-runtime',
    },
    sessionId,
    packetId,
    packetKind: 'execution',
    packetPath,
    role: 'developer',
    expectedDelta: 'consumer main-agent execution completed',
  };
  writeJson(packetPath, {
    packetId,
    sessionId,
    host: instruction.host,
    recordId: active.recordId,
    requirementSetId: active.requirementSetId,
    expectedDelta: instruction.expectedDelta,
  });
  return instruction;
}

function taskReportPath(context, instruction) {
  return path.join(
    context.cwd,
    '_bmad-output',
    'runtime',
    instruction.host,
    'task-reports',
    `${instruction.packetId}.json`
  );
}

function statePath(context, instruction) {
  return path.join(orchestrationStateDir(context.cwd), `${instruction.sessionId}.json`);
}

function writeState(context, instruction, pendingStatus, taskReport) {
  const state = {
    version: 1,
    sessionId: instruction.sessionId,
    host: instruction.host,
    flow: instruction.flow,
    currentPhase: instruction.stage,
    nextAction: pendingStatus === 'completed' ? 'await_review' : 'await_user',
    pendingPacket: {
      packetId: instruction.packetId,
      packetPath: toPosixRelative(context.cwd, instruction.packetPath),
      packetKind: instruction.packetKind,
      status: pendingStatus,
      claimOwner: 'main-agent-run-loop',
      createdAt: new Date().toISOString(),
    },
    lastTaskReport: taskReport,
  };
  writeJson(statePath(context, instruction), state);
  return state;
}

function readTaskReport(reportPath) {
  return readJsonIfPresent(reportPath);
}

function runCodexOverride(context, instruction, reportPath) {
  if (
    process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE !== 'true' ||
    !process.env.CODEX_WORKER_ADAPTER_BIN
  ) {
    return null;
  }
  const prompt = [
    `Packet ID: ${instruction.packetId}`,
    `write a JSON TaskReport to: ${reportPath}`,
    `Allowed write scope: ${instruction.packetPath}`,
    '',
  ].join('\n');
  const step = spawnSync(process.env.CODEX_WORKER_ADAPTER_BIN, [], {
    cwd: context.cwd,
    input: prompt,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    exitCode: step.status ?? 1,
    stdout: step.stdout || '',
    stderr: step.stderr || '',
  };
}

function blockedTaskReport(instruction, evidence) {
  return {
    packetId: instruction.packetId,
    status: 'blocked',
    filesChanged: [],
    validationsRun: ['main-agent-package-runtime-codex-fail-closed'],
    evidence,
    downstreamContext: [instruction.expectedDelta],
    driftFlags: ['codex-task-report-missing'],
  };
}

function legacyRunLoopAction(context) {
  const runtime = readRuntimeRecordContext(context.cwd);
  if (!runtime.active) {
    const finalSurface = legacyInspectSurface(context.cwd, context.args);
    return {
      exitCode: 1,
      payload: {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps: [
          {
            step: 'inspect.initial',
            status: 'fail',
            summary: 'NO_ACTIVE_REQUIREMENT: contract_authoring_required',
          },
        ],
        dispatchInstruction: null,
        taskReport: null,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      },
    };
  }

  const instruction = buildDispatchInstruction(context, runtime);
  const reportPath = taskReportPath(context, instruction);
  const steps = [
    {
      step: 'inspect.initial',
      status: 'pass',
      summary: `pending=${legacyInspectSurface(context.cwd, context.args).pendingPacketStatus}`,
    },
    {
      step: 'dispatch-plan',
      status: 'pass',
      summary: `packet=${instruction.packetId}, taskType=${instruction.taskType}`,
    },
  ];

  let taskReport = null;
  if (instruction.host === 'codex') {
    const adapter = runCodexOverride(context, instruction, reportPath);
    if (adapter) {
      steps.push({
        step: 'codex-worker-adapter',
        status: adapter.exitCode === 0 ? 'pass' : 'fail',
        summary: `report=${toPosixRelative(context.cwd, reportPath)}`,
      });
      taskReport = readTaskReport(reportPath);
    } else {
      taskReport = blockedTaskReport(instruction, ['codex did not produce task report']);
      writeJson(reportPath, taskReport);
      const state = writeState(context, instruction, 'invalidated', taskReport);
      return {
        exitCode: 1,
        suppressStdout: true,
        payload: {
          runId: `main-agent-run-loop-${Date.now()}`,
          status: 'blocked',
          steps,
          dispatchInstruction: instruction,
          taskReport,
          finalSurface: {
            ...legacyInspectSurface(context.cwd, context.args),
            orchestrationState: state,
          },
          mainAgentStageSummary: legacyInspectSurface(context.cwd, context.args).mainAgentStageSummary,
        },
      };
    }
  }

  if (!taskReport || taskReport.status !== 'done') {
    taskReport =
      taskReport ||
      blockedTaskReport(instruction, ['missing real task report artifact; pass --taskReportPath or provide an executor']);
    writeJson(reportPath, taskReport);
    const state = writeState(context, instruction, 'invalidated', taskReport);
    const finalSurface = {
      ...legacyInspectSurface(context.cwd, context.args),
      orchestrationState: state,
    };
    return {
      exitCode: 1,
      payload: {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps,
        dispatchInstruction: instruction,
        taskReport,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      },
    };
  }

  const state = writeState(context, instruction, 'completed', taskReport);
  const finalSurface = {
    ...legacyInspectSurface(context.cwd, context.args),
    orchestrationState: state,
    pendingPacketStatus: 'completed',
  };
  steps.push({
    step: 'task-report.ingest',
    status: 'pass',
    summary: `report=${taskReport.status}`,
  });
  steps.push({
    step: 'inspect.final',
    status: 'pass',
    summary: 'pending=completed',
  });
  return {
    exitCode: 0,
    payload: {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'completed',
      steps,
      dispatchInstruction: instruction,
      taskReport,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    },
  };
}

module.exports = {
  legacyRunLoopAction,
  runLoopAction,
};
