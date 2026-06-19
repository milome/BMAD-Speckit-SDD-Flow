const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeRuntimeHost,
  writeNativeGoalInvocationReceipt,
} = require('../runtime/host-runtime-mode.js');
const { resolveNativeGoalCommand } = require('./native-goal-command.js');

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function outputText(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return typeof value === 'string' ? value : '';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function blockedTaskReport(input) {
  return {
    packetId: input.packet.packetId,
    status: 'blocked',
    filesChanged: [],
    validationsRun: input.validationsRun,
    evidence: input.evidence,
    downstreamContext: [input.packet.expectedDelta],
    driftFlags: input.driftFlags,
  };
}

function buildHostNativeCommand(input) {
  const host = normalizeRuntimeHost(input.host);
  if (host === 'codex') {
    return {
      command: 'codex',
      args: [
        'exec',
        '--cd',
        input.projectRoot,
        '--sandbox',
        'workspace-write',
        '-a',
        'never',
        '--json',
        input.commandText,
      ],
    };
  }
  if (host === 'claude-code-cli') {
    return {
      command: 'claude',
      args: [
        '-p',
        input.commandText,
        '--permission-mode',
        'auto',
        '--output-format',
        'stream-json',
        '--add-dir',
        input.projectRoot,
      ],
    };
  }
  return { command: input.host, args: [input.commandText] };
}

function parseStrictTaskReport(filePath, packet) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed.packetId !== packet.packetId) {
    throw new Error(`packetId mismatch: ${String(parsed.packetId)}`);
  }
  if (parsed.status !== 'done' && parsed.status !== 'blocked' && parsed.status !== 'partial') {
    throw new Error(`invalid status: ${String(parsed.status)}`);
  }
  if (!Array.isArray(parsed.filesChanged)) throw new Error('filesChanged must be an array');
  if (!Array.isArray(parsed.validationsRun)) throw new Error('validationsRun must be an array');
  if (!Array.isArray(parsed.evidence)) throw new Error('evidence must be an array');
  if (!Array.isArray(parsed.downstreamContext)) throw new Error('downstreamContext must be an array');
  return {
    packetId: parsed.packetId,
    status: parsed.status,
    filesChanged: parsed.filesChanged,
    validationsRun: parsed.validationsRun,
    evidence: parsed.evidence,
    downstreamContext: parsed.downstreamContext,
    driftFlags: Array.isArray(parsed.driftFlags) ? parsed.driftFlags : undefined,
  };
}

function runNativeGoalInvocation(input) {
  const logsDir = path.join(input.projectRoot, '_bmad-output', 'runtime', 'native-goal', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stdoutPath = path.join(logsDir, `${input.packet.packetId}.stdout.log`);
  const stderrPath = path.join(logsDir, `${input.packet.packetId}.stderr.log`);
  const resolvedCommand = resolveNativeGoalCommand({
    projectRoot: input.projectRoot,
    host: input.host,
    packetId: input.packet.packetId,
    compiledPromptRef: input.compiledPromptRef,
  });

  if (!resolvedCommand.ok) {
    const taskReport = blockedTaskReport({
      packet: input.packet,
      validationsRun: ['native-goal-command-resolution'],
      evidence: resolvedCommand.evidence,
      driftFlags: resolvedCommand.driftFlags,
    });
    writeJson(input.taskReportPath, taskReport);
    fs.writeFileSync(stdoutPath, '', 'utf8');
    fs.writeFileSync(stderrPath, resolvedCommand.evidence.join('\n'), 'utf8');
    return {
      command: input.host,
      args: [],
      exitCode: 1,
      stdoutPath,
      stderrPath,
      receiptPath: null,
      taskReportPath: input.taskReportPath,
      taskReport,
    };
  }

  const hostCommand = buildHostNativeCommand({
    host: input.host,
    projectRoot: input.projectRoot,
    commandText: resolvedCommand.commandText,
  });
  const startedAt = new Date().toISOString();
  const spawnSyncFn = input.spawnSyncFn ?? spawnSync;
  const result = spawnSyncFn(hostCommand.command, hostCommand.args, {
    cwd: input.projectRoot,
    encoding: 'utf8',
    timeout: input.timeoutMs ?? 120_000,
    shell: process.platform === 'win32',
  });
  const endedAt = new Date().toISOString();
  const exitCode = result.status ?? (result.error ? 1 : 0);
  fs.writeFileSync(stdoutPath, outputText(result.stdout), 'utf8');
  fs.writeFileSync(stderrPath, outputText(result.stderr ?? result.error?.message), 'utf8');

  const receipt = writeNativeGoalInvocationReceipt({
    projectRoot: input.projectRoot,
    recordId: input.recordId ?? input.packet.parentSessionId,
    attemptId: input.attemptId ?? input.packet.packetId,
    packetId: input.packet.packetId,
    host: input.host,
    goalExecutionPath: resolvedCommand.goalExecutionPath,
    goalCommandTextHash: sha256Text(resolvedCommand.commandText),
    command: hostCommand.command,
    args: hostCommand.args,
    taskReportPath: input.taskReportPath,
    nativeGoalCommandUsed: true,
    stdoutRef: stdoutPath,
    stderrRef: stderrPath,
    exitCode,
    startedAt,
    endedAt,
  });

  if (exitCode !== 0) {
    const taskReport = blockedTaskReport({
      packet: input.packet,
      validationsRun: ['native-goal-host-command'],
      evidence: [`native host command exited ${exitCode}`, stderrPath],
      driftFlags: ['native-goal-invocation-failed'],
    });
    writeJson(input.taskReportPath, taskReport);
    return {
      ...hostCommand,
      exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport,
    };
  }

  if (!fs.existsSync(input.taskReportPath)) {
    return {
      ...hostCommand,
      exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: blockedTaskReport({
        packet: input.packet,
        validationsRun: ['native-goal-task-report-ingest'],
        evidence: [`TaskReport missing after native goal invocation: ${input.taskReportPath}`],
        driftFlags: ['native-goal-task-report-missing'],
      }),
    };
  }

  try {
    return {
      ...hostCommand,
      exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: parseStrictTaskReport(input.taskReportPath, input.packet),
    };
  } catch (error) {
    return {
      ...hostCommand,
      exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: blockedTaskReport({
        packet: input.packet,
        validationsRun: ['native-goal-task-report-ingest'],
        evidence: [error instanceof Error ? error.message : String(error)],
        driftFlags: [
          error instanceof Error && error.message.startsWith('packetId mismatch')
            ? 'native-goal-task-report-packet-mismatch'
            : 'native-goal-task-report-invalid',
        ],
      }),
    };
  }
}

module.exports = {
  runNativeGoalInvocation,
};
