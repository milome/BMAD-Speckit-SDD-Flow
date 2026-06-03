/* eslint-disable no-console */
const path = require('node:path');
const { confirmScopeAction, confirmScopeMissingReason } = require('./actions/confirm-scope');
const { dispatchPlanAction } = require('./actions/dispatch-plan');
const { hasRuntimeState, inspectRuntimeState } = require('./actions/inspect');
const { runLoopAction } = require('./actions/run-loop');

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

function missingRuntimeState(context, reason) {
  return errorResponse(context, 'runtime_state_missing', reason, 1);
}

function requireRuntimeState(context) {
  if (!hasRuntimeState(context.cwd)) {
    return {
      ok: false,
      response: missingRuntimeState(context, 'runtime requirement-record state is missing'),
    };
  }
  return {
    ok: true,
    state: inspectRuntimeState(context.cwd),
  };
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

  if (context.action === 'inspect') {
    return emitResponse(context, envelope(context, 'ok', 0, inspectRuntimeState(context.cwd)));
  }

  if (context.action === 'confirm-scope') {
    const reason = confirmScopeMissingReason(context.args);
    if (reason) return emitResponse(context, missingRuntimeState(context, reason));
    const runtime = requireRuntimeState(context);
    if (!runtime.ok) return emitResponse(context, runtime.response);
    return emitResponse(context, envelope(context, 'ok', 0, confirmScopeAction(context, runtime.state)));
  }

  if (context.action === 'dispatch-plan') {
    const runtime = requireRuntimeState(context);
    if (!runtime.ok) return emitResponse(context, runtime.response);
    return emitResponse(context, envelope(context, 'ok', 0, dispatchPlanAction(context, runtime.state)));
  }

  if (context.action === 'run-loop') {
    const runtime = requireRuntimeState(context);
    if (!runtime.ok) return emitResponse(context, runtime.response);
    return emitResponse(context, envelope(context, 'ok', 0, runLoopAction(context, runtime.state)));
  }
}

function mainAgentRuntimeCommand(argv = process.argv.slice(2)) {
  return runMainAgentRuntime(parseRuntimeArgs(argv));
}

module.exports = {
  SCHEMA_VERSION,
  mainAgentRuntimeCommand,
  parseRuntimeArgs,
};
