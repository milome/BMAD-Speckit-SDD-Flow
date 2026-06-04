/* eslint-disable no-console */
const path = require('node:path');
const { chaosScenariosAction } = require('./actions/chaos-scenarios');
const { codexWorkerAdapterAction } = require('./actions/codex-worker-adapter');
const { compiledPromptRunnerAction } = require('./actions/compiled-prompt-runner');
const {
  confirmScopeAction,
  confirmScopeMissingReason,
  legacyConfirmScopeAction,
} = require('./actions/confirm-scope');
const { deliveryCloseoutGateAction } = require('./actions/delivery-closeout-gate');
const { deliveryEvidenceRunAction } = require('./actions/delivery-evidence-run');
const { dispatchPlanAction } = require('./actions/dispatch-plan');
const { deliveryTruthGateAction } = require('./actions/delivery-truth-gate');
const { dualHostPrOrchestratorAction } = require('./actions/dual-host-pr-orchestrator');
const { implementationReadinessGateAction } = require('./actions/implementation-readiness-gate');
const { hasRuntimeState, inspectRuntimeState, legacyInspectSurface } = require('./actions/inspect');
const { qualityGateAction } = require('./actions/quality-gate');
const { releaseGateAction } = require('./actions/release-gate');
const { legacyRunLoopAction, runLoopAction } = require('./actions/run-loop');
const { soakRunnerAction } = require('./actions/soak-runner');
const { unifiedIngressAction } = require('./actions/unified-ingress');

const SCHEMA_VERSION = 'main-agent-package-runtime/v1';
const SUPPORTED_ACTIONS = new Set([
  'inspect',
  'confirm-scope',
  'dispatch-plan',
  'run-loop',
  'release-gate',
  'quality-gate',
  'delivery-truth-gate',
  'codex-worker-adapter',
  'compiled-prompt-runner',
  'implementation-readiness-gate',
  'unified-ingress',
  'delivery-closeout-gate',
  'delivery-evidence-run',
  'soak-runner',
  'dual-host-pr-orchestrator',
  'chaos-scenarios',
]);

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

function emitLegacyResult(result) {
  if (!result.suppressStdout) writeJson(result.payload ?? result);
  return result.exitCode ?? (result.ok === false ? 1 : 0);
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
    if (context.legacyOrchestration) {
      return emitLegacyResult({
        exitCode: 0,
        payload: legacyInspectSurface(context.cwd, context.args),
      });
    }
    return emitResponse(context, envelope(context, 'ok', 0, inspectRuntimeState(context.cwd)));
  }

  if (context.action === 'confirm-scope') {
    const reason = confirmScopeMissingReason(context.args);
    if (reason) return emitResponse(context, missingRuntimeState(context, reason));
    if (context.legacyOrchestration) return emitLegacyResult(legacyConfirmScopeAction(context));
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
    if (context.legacyOrchestration) return emitLegacyResult(legacyRunLoopAction(context));
    const runtime = requireRuntimeState(context);
    if (!runtime.ok) return emitResponse(context, runtime.response);
    return emitResponse(context, envelope(context, 'ok', 0, runLoopAction(context, runtime.state)));
  }

  if (context.action === 'release-gate') {
    return emitResponse(context, envelope(context, 'package_runtime_ready', 0, releaseGateAction(context)));
  }

  if (context.action === 'quality-gate') {
    return emitResponse(context, envelope(context, 'package_runtime_ready', 0, qualityGateAction(context)));
  }

  if (context.action === 'delivery-truth-gate') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, deliveryTruthGateAction(context))
    );
  }

  if (context.action === 'codex-worker-adapter') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, codexWorkerAdapterAction(context))
    );
  }

  if (context.action === 'compiled-prompt-runner') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, compiledPromptRunnerAction(context))
    );
  }

  if (context.action === 'implementation-readiness-gate') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, implementationReadinessGateAction(context))
    );
  }

  if (context.action === 'unified-ingress') {
    return emitResponse(context, envelope(context, 'package_runtime_ready', 0, unifiedIngressAction(context)));
  }

  if (context.action === 'delivery-closeout-gate') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, deliveryCloseoutGateAction(context))
    );
  }

  if (context.action === 'delivery-evidence-run') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, deliveryEvidenceRunAction(context))
    );
  }

  if (context.action === 'soak-runner') {
    return emitResponse(context, envelope(context, 'package_runtime_ready', 0, soakRunnerAction(context)));
  }

  if (context.action === 'dual-host-pr-orchestrator') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, dualHostPrOrchestratorAction(context))
    );
  }

  if (context.action === 'chaos-scenarios') {
    return emitResponse(context, envelope(context, 'package_runtime_ready', 0, chaosScenariosAction(context)));
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
