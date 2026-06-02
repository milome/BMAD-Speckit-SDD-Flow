/* eslint-disable no-console */
const path = require('node:path');
const { confirmScopeMissingReason } = require('./actions/confirm-scope');
const { hasRuntimeState, inspectRuntimeState } = require('./actions/inspect');

const SCHEMA_VERSION = 'main-agent-package-runtime/v1';
const SUPPORTED_ACTIONS = new Set(['inspect', 'confirm-scope', 'dispatch-plan', 'run-loop']);

function normalizeAction(value) {
  return String(value || '').trim().replace(/_/g, '-');
}

function parseKeyValueArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const equalsIndex = token.indexOf('=');
    if (equalsIndex > -1) {
      args[token.slice(2, equalsIndex).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] =
        token.slice(equalsIndex + 1);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = 'true';
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function parseRuntimeArgs(argv) {
  const rawArgv = [...argv];
  const positionalAction = rawArgv[0] && !rawArgv[0].startsWith('-') ? rawArgv[0] : null;
  const rootArgv = positionalAction ? ['--action', positionalAction, ...rawArgv.slice(1)] : rawArgv;
  const args = parseKeyValueArgs(rootArgv);
  const action = normalizeAction(args.action || positionalAction || 'inspect');
  return {
    action,
    args,
    cwd: path.resolve(String(args.cwd || process.cwd())),
    json: args.json === 'true',
    legacyOrchestration: args.legacyOrchestration === 'true',
    rawArgv,
    rootArgv,
  };
}

function envelope(context, status, exitCode, data, errors = []) {
  return {
    schemaVersion: SCHEMA_VERSION,
    action: context.action,
    cwd: context.cwd,
    status,
    exitCode,
    errors,
    data,
  };
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeHuman(context, response) {
  if (response.exitCode === 0) {
    process.stdout.write(`main-agent ${context.action}: ${response.status}\n`);
  } else {
    const message = response.errors[0]?.message || response.status;
    process.stderr.write(`main-agent ${context.action}: ${message}\n`);
  }
}

function emitResponse(context, response) {
  if (context.json) writeJson(response);
  else writeHuman(context, response);
  return response.exitCode;
}

function errorResponse(context, code, message, exitCode = 1) {
  return envelope(context, code, exitCode, null, [{ code, message }]);
}

function loadCompiledOrchestration() {
  return require(path.join(__dirname, 'compiled', 'main-agent-orchestration.cjs'));
}

async function invokeCompiled(context, captureOutput) {
  const compiled = loadCompiledOrchestration();
  const entry =
    compiled.mainMainAgentOrchestrationAsync || compiled.mainMainAgentOrchestration;
  if (typeof entry !== 'function') {
    throw new Error('compiled main-agent orchestration entry is missing');
  }
  if (!captureOutput) {
    return {
      exitCode: await entry(context.rootArgv),
      stdout: '',
      stderr: '',
    };
  }

  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function writeStdout(chunk, ...rest) {
    stdout += String(chunk);
    if (typeof rest[rest.length - 1] === 'function') rest[rest.length - 1]();
    return true;
  };
  process.stderr.write = function writeStderr(chunk, ...rest) {
    stderr += String(chunk);
    if (typeof rest[rest.length - 1] === 'function') rest[rest.length - 1]();
    return true;
  };
  try {
    return {
      exitCode: await entry(context.rootArgv),
      stdout,
      stderr,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

function parseDelegatedJson(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { rawOutput: trimmed };
  }
}

function missingRuntimeState(context, reason) {
  return errorResponse(context, 'runtime_state_missing', reason, 1);
}

async function delegateRuntimeAction(context) {
  if (!hasRuntimeState(context.cwd)) {
    return emitResponse(
      context,
      missingRuntimeState(context, 'runtime requirement-record state is missing')
    );
  }
  let result;
  try {
    result = await invokeCompiled(context, context.json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emitResponse(context, errorResponse(context, 'delegated_runtime_failed', message, 1));
  }
  if (!context.json) return result.exitCode ?? 0;

  const data = parseDelegatedJson(result.stdout);
  const status = result.exitCode === 0 ? 'ok' : 'delegated_runtime_failed';
  const errors =
    result.exitCode === 0
      ? []
      : [{ code: status, message: result.stderr.trim() || `exitCode=${result.exitCode}` }];
  return emitResponse(context, envelope(context, status, result.exitCode ?? 1, data, errors));
}

async function runMainAgentRuntime(context) {
  if (!SUPPORTED_ACTIONS.has(context.action)) {
    return emitResponse(
      context,
      errorResponse(
        context,
        'unsupported_main_agent_action',
        `unsupported main-agent action: ${context.action}`,
        2
      )
    );
  }

  if (context.legacyOrchestration && context.action === 'inspect' && !context.json) {
    const result = await invokeCompiled(context, false);
    return result.exitCode ?? 0;
  }

  if (context.action === 'inspect') {
    return emitResponse(context, envelope(context, 'ok', 0, inspectRuntimeState(context.cwd)));
  }

  if (context.action === 'confirm-scope') {
    const reason = confirmScopeMissingReason(context.args);
    if (reason) return emitResponse(context, missingRuntimeState(context, reason));
    return delegateRuntimeAction(context);
  }

  return delegateRuntimeAction(context);
}

function mainAgentRuntimeCommand(argv = process.argv.slice(2)) {
  return runMainAgentRuntime(parseRuntimeArgs(argv));
}

module.exports = {
  SCHEMA_VERSION,
  mainAgentRuntimeCommand,
  parseRuntimeArgs,
};
