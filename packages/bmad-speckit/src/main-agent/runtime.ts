/* eslint-disable no-console */
const path = require('node:path');
const { adaptiveIntakeGovernanceGateAction } = require('./actions/adaptive-intake-governance-gate');
const { adaptiveIntakeProofGateAction } = require('./actions/adaptive-intake-proof-gate');
const { aiTddContractGateAction } = require('./actions/ai-tdd-contract-gate');
const {
  aiTddCloseoutRemediationAdapterAction,
} = require('./actions/ai-tdd-closeout-remediation-adapter');
const { auditReviewGateAction } = require('./actions/audit-review-gate');
const { auditStageRoutingAction } = require('./actions/audit-stage-routing');
const { auditorPostActionsAction } = require('./actions/auditor-post-actions');
const { auditorSpecAction } = require('./actions/auditor-spec');
const { bmadRuntimeWorkerAction } = require('./actions/bmad-runtime-worker');
const { bmadArtifactHardcutAction } = require('./actions/bmad-artifact-hardcut');
const { chaosScenariosAction } = require('./actions/chaos-scenarios');
const { promptTransactionPublishAction } = require('./actions/prompt-transaction-publish');
const {
  confirmScopeAction,
  confirmScopeMissingReason,
  legacyConfirmScopeAction,
} = require('./actions/confirm-scope');
const { controlPlaneIsolationCheckAction } = require('./actions/control-plane-isolation-check');
const { dataGovernanceGateAction } = require('./actions/data-governance-gate');
const { deliveryCloseoutGateAction } = require('./actions/delivery-closeout-gate');
const { deliveryEvidenceRunAction } = require('./actions/delivery-evidence-run');
const { datasetReleaseGateAction } = require('./actions/dataset-release-gate');
const { decisionFieldCheckAction } = require('./actions/decision-field-check');
const { dispatchPlanAction } = require('./actions/dispatch-plan');
const { deliveryTruthGateAction } = require('./actions/delivery-truth-gate');
const { developmentJourneyMatrixAction } = require('./actions/development-journey-matrix');
const { dualHostPrOrchestratorAction } = require('./actions/dual-host-pr-orchestrator');
const { entryflowTraceabilityCheckAction } = require('./actions/entryflow-traceability-check');
const { executionClosureGateAction } = require('./actions/execution-closure-gate');
const { e2eDualHostJourneyRunnerAction } = require('./actions/e2e-dual-host-journey-runner');
const { e2eHostMatrixJourneyRunnerAction } = require('./actions/e2e-host-matrix-journey-runner');
const { finalCloseoutEvidenceRunnerAction } = require('./actions/final-closeout-evidence-runner');
const { functionalResumeCheckAction } = require('./actions/functional-resume-check');
const { governedDataProductsAction } = require('./actions/governed-data-products');
const { gapClosureEvidenceAction } = require('./actions/gap-closure-evidence');
const {
  governancePacketDispatchWorkerAction,
} = require('./actions/governance-packet-dispatch-worker');
const { hostMatrixPrOrchestratorAction } = require('./actions/host-matrix-pr-orchestrator');
const { implementationReadinessGateAction } = require('./actions/implementation-readiness-gate');
const {
  initializeSixModelRequirementConfirmationAction,
} = require('./actions/initialize-six-model-requirement-confirmation');
const { hasRuntimeState, inspectRuntimeState, legacyInspectSurface } = require('./actions/inspect');
const { liveSmokeMainAgentRuntimeAction } = require('./actions/live-smoke-main-agent-runtime');
const {
  orchestrationDispatchContractAction,
} = require('./actions/orchestration-dispatch-contract');
const {
  orchestrationGovernanceContractAction,
} = require('./actions/orchestration-governance-contract');
const { orchestrationStateAction } = require('./actions/orchestration-state');
const { ingestImplementationEvidenceAction } = require('./actions/ingest-implementation-evidence');
const { perMustClosureEvidenceIndexAction } = require('./actions/per-must-closure-evidence-index');
const {
  preRerunAntiFalsePositiveGateAction,
} = require('./actions/pre-rerun-anti-false-positive-gate');
const { printResolvedAuditPromptAction } = require('./actions/print-resolved-audit-prompt');
const { productionLoopReadyCheckAction } = require('./actions/production-loop-ready-check');
const { qualityGateAction } = require('./actions/quality-gate');
const { reconfirmationRuntimeAction } = require('./actions/reconfirmation-runtime');
const {
  recordMainAgentInspectReadinessClosureAction,
} = require('./actions/record-main-agent-inspect-readiness-closure');
const { releaseGateAction } = require('./actions/release-gate');
const {
  requirementRecordControlStoreAction,
} = require('./actions/requirement-record-control-store');
const {
  requirementRecordLiveSchemaGateAction,
} = require('./actions/requirement-record-live-schema-gate');
const {
  requirementRecordSchemaEvolutionAction,
} = require('./actions/requirement-record-schema-evolution');
const {
  requirementsContractSourceIntakeAction,
} = require('./actions/requirements-contract-source-intake');
const {
  submitRequirementsGrillResponseAction,
} = require('./actions/submit-requirements-grill-response');
const { resolveActiveRequirementAction } = require('./actions/resolve-active-requirement');
const {
  runRequiredCommandsFromAiTddManifestAction,
} = require('./actions/run-required-commands-from-ai-tdd-manifest');
const { runtimePolicySnapshotCheckAction } = require('./actions/runtime-policy-snapshot-check');
const { runtimeScoringDataPathAction } = require('./actions/runtime-scoring-data-path');
const { scoringGatesCheckAction } = require('./actions/scoring-gates-check');
const { skillOrchestrationAuditAction } = require('./actions/skill-orchestration-audit');
const { sixModelRuntimeDecisionAction } = require('./actions/six-model-runtime-decision');
const { soakRunnerAction } = require('./actions/soak-runner');
const {
  emitPackageOrchestration,
  authorConfirmationReadySourceAction,
  resumeAuthorConfirmationReadySourceAction,
} = require('./actions/source-authority-orchestration');
const { renderAuditBlockCliAction } = require('./actions/render-audit-block-cli');
const { strictCloseoutProofGateAction } = require('./actions/strict-closeout-proof-gate');
const {
  targetArtifactRealizationGateAction,
} = require('./actions/target-artifact-realization-gate');
const { traceStatusPolicyCheckAction } = require('./actions/trace-status-policy-check');
const {
  trace040EvidencePacketGeneratorAction,
} = require('./actions/trace-040-evidence-packet-generator');
const { unifiedIngressAction } = require('./actions/unified-ingress');
const { updateRuntimeAuditIndexAction } = require('./actions/update-runtime-audit-index');
const { verifyCursorAuditGranularityAction } = require('./actions/verify-cursor-audit-granularity');

const SCHEMA_VERSION = 'main-agent-package-runtime/v1';
const PACKAGE_RUNTIME_READY_ACTIONS = {
  'live-smoke-main-agent-runtime': liveSmokeMainAgentRuntimeAction,
  'ai-tdd-closeout-remediation-adapter': aiTddCloseoutRemediationAdapterAction,
  'audit-review-gate': auditReviewGateAction,
  'bmad-artifact-hardcut': bmadArtifactHardcutAction,
  'control-plane-isolation-check': controlPlaneIsolationCheckAction,
  'data-governance-gate': dataGovernanceGateAction,
  'dataset-release-gate': datasetReleaseGateAction,
  'decision-field-check': decisionFieldCheckAction,
  'development-journey-matrix': developmentJourneyMatrixAction,
  'entryflow-traceability-check': entryflowTraceabilityCheckAction,
  'execution-closure-gate': executionClosureGateAction,
  'functional-resume-check': functionalResumeCheckAction,
  'gap-closure-evidence': gapClosureEvidenceAction,
  'governed-data-products': governedDataProductsAction,
  'production-loop-ready-check': productionLoopReadyCheckAction,
  'runtime-policy-snapshot-check': runtimePolicySnapshotCheckAction,
  'scoring-gates-check': scoringGatesCheckAction,
  'trace-status-policy-check': traceStatusPolicyCheckAction,
  'orchestration-dispatch-contract': orchestrationDispatchContractAction,
  'orchestration-governance-contract': orchestrationGovernanceContractAction,
  'orchestration-state': orchestrationStateAction,
  'record-main-agent-inspect-readiness-closure': recordMainAgentInspectReadinessClosureAction,
  'skill-orchestration-audit': skillOrchestrationAuditAction,
  'initialize-six-model-requirement-confirmation': initializeSixModelRequirementConfirmationAction,
  'reconfirmation-runtime': reconfirmationRuntimeAction,
  'requirement-record-control-store': requirementRecordControlStoreAction,
  'requirement-record-live-schema-gate': requirementRecordLiveSchemaGateAction,
  'requirement-record-schema-evolution': requirementRecordSchemaEvolutionAction,
  'requirements-contract-source-intake': requirementsContractSourceIntakeAction,
  'submit-requirements-grill-response': submitRequirementsGrillResponseAction,
  'author-confirmation-ready-source': authorConfirmationReadySourceAction,
  'resume-author-confirmation-ready-source': resumeAuthorConfirmationReadySourceAction,
  'resolve-active-requirement': resolveActiveRequirementAction,
  'run-required-commands-from-ai-tdd-manifest': runRequiredCommandsFromAiTddManifestAction,
  'runtime-scoring-data-path': runtimeScoringDataPathAction,
  'six-model-runtime-decision': sixModelRuntimeDecisionAction,
  'adaptive-intake-governance-gate': adaptiveIntakeGovernanceGateAction,
  'adaptive-intake-proof-gate': adaptiveIntakeProofGateAction,
  'ai-tdd-contract-gate': aiTddContractGateAction,
  'audit-stage-routing': auditStageRoutingAction,
  'auditor-post-actions': auditorPostActionsAction,
  'auditor-spec': auditorSpecAction,
  'bmad-runtime-worker': bmadRuntimeWorkerAction,
  'e2e-dual-host-journey-runner': e2eDualHostJourneyRunnerAction,
  'e2e-host-matrix-journey-runner': e2eHostMatrixJourneyRunnerAction,
  'final-closeout-evidence-runner': finalCloseoutEvidenceRunnerAction,
  'governance-packet-dispatch-worker': governancePacketDispatchWorkerAction,
  'print-resolved-audit-prompt': printResolvedAuditPromptAction,
  'render-audit-block-cli': renderAuditBlockCliAction,
  'ingest-implementation-evidence': ingestImplementationEvidenceAction,
  'per-must-closure-evidence-index': perMustClosureEvidenceIndexAction,
  'pre-rerun-anti-false-positive-gate': preRerunAntiFalsePositiveGateAction,
  'strict-closeout-proof-gate': strictCloseoutProofGateAction,
  'target-artifact-realization-gate': targetArtifactRealizationGateAction,
  'trace-040-evidence-packet-generator': trace040EvidencePacketGeneratorAction,
  'update-runtime-audit-index': updateRuntimeAuditIndexAction,
  'verify-cursor-audit-granularity': verifyCursorAuditGranularityAction,
};
const WAVE_3_12_PACKAGE_RUNTIME_ACTIONS = {
  'analytics-sft-extract': ['./actions/analytics-sft-extract', 'runAnalyticsSftExtract'],
  'assert-implementation-entry': [
    './actions/assert-implementation-entry',
    'runAssertImplementationEntry',
  ],
  'bmad-config': ['./actions/bmad-config', 'runBmadConfig'],
  'check-sprint-ready': ['./actions/check-sprint-ready', 'runCheckSprintReady'],
  'dashboard-generate': ['./actions/dashboard-generate', 'runDashboardGenerate'],
  'governance-execution-result-ingestor': [
    './actions/governance-execution-result-ingestor',
    'runGovernanceExecutionResultIngestor',
  ],
  'governance-hook-types': ['./actions/governance-hook-types', 'runGovernanceHookTypes'],
  'governance-provider-adapter': [
    './actions/governance-provider-adapter',
    'runGovernanceProviderAdapter',
  ],
  'governance-runtime-queue': ['./actions/governance-runtime-queue', 'runGovernanceRuntimeQueue'],
  'governance-stage-event-emitter': [
    './actions/governance-stage-event-emitter',
    'runGovernanceStageEventEmitter',
  ],
  'i18n-render-template': ['./actions/i18n-render-template', 'runRenderTemplate'],
  'ingest-architecture-confirmation': [
    './actions/ingest-architecture-confirmation',
    'runIngestArchitectureConfirmation',
  ],
  'mcp-consumer-install-consumer-mcp': [
    './actions/mcp-consumer-install-consumer-mcp',
    'runInstallConsumerMcp',
  ],
  'mcp-consumer-verify-consumer-mcp': [
    './actions/mcp-consumer-verify-consumer-mcp',
    'runVerifyConsumerMcp',
  ],
  'model-governance-hint-resolver': [
    './actions/model-governance-hint-resolver',
    'runModelGovernanceHintResolver',
  ],
  'parse-and-write-score': ['./actions/parse-and-write-score', 'runParseAndWriteScore'],
  'runtime-governance': ['./actions/runtime-governance', 'runRuntimeGovernance'],
  'runtime-governance-registry': [
    './actions/runtime-governance-registry',
    'runRuntimeGovernanceRegistry',
  ],
  'runtime-governance-template-schema': [
    './actions/runtime-governance-template-schema',
    'runRuntimeGovernanceTemplateSchema',
  ],
  'sft-extract': ['./actions/sft-extract', 'runSftExtract'],
  'user-story-mapping': ['./actions/user-story-mapping', 'runUserStoryMapping'],
  'validate-consumer-governance': [
    './actions/validate-consumer-governance',
    'runValidateConsumerGovernance',
  ],
  'verify-hooks-no-ts-node': ['./actions/verify-hooks-no-ts-node', 'runVerifyHooksNoTsNode'],
  'write-runtime-policy-snapshot-and-recovery-context': [
    './actions/write-runtime-policy-snapshot-and-recovery-context',
    'runWriteRuntimePolicySnapshotAndRecoveryContext',
  ],
};
const SUPPORTED_ACTIONS = new Set([
  'inspect',
  'confirm-scope',
  'dispatch-plan',
  'run-loop',
  'release-gate',
  'quality-gate',
  'delivery-truth-gate',
  'requirements-contract-prompt-transaction-publish',
  'implementation-readiness-gate',
  'unified-ingress',
  'delivery-closeout-gate',
  'delivery-evidence-run',
  'host-matrix-pr-orchestrator',
  'soak-runner',
  'dual-host-pr-orchestrator',
  'chaos-scenarios',
  ...Object.keys(PACKAGE_RUNTIME_READY_ACTIONS),
  ...Object.keys(WAVE_3_12_PACKAGE_RUNTIME_ACTIONS),
]);
const ORCHESTRATION_ACTIONS = new Set([
  'inspect',
  'step',
  'dispatch-plan',
  'run-loop',
  'controlled-closeout',
  'claim',
  'dispatch',
  'complete',
  'invalidate',
  'route-intake',
  'adaptive-intake',
  'confirm-scope',
  'confirmation-ingest',
  'confirm-closeout-acceptance',
  'closeout-acceptance-ingest',
  'route-confirmation-drift',
  'confirmation-drift-route',
  'repair-confirmation-bookkeeping',
  'confirmation-bookkeeping-repair',
  'register-pre-confirmation-render',
  'register_pre_confirmation_render',
  'author-confirmation-ready-source',
  'author_confirmation_ready_source',
  'authoring-repair',
  'authoring_repair',
  'post-close-defect-intake',
  'controlled-readiness-audit',
]);

function loadWave312PackageRuntimeAction(action) {
  const definition = WAVE_3_12_PACKAGE_RUNTIME_ACTIONS[action];
  if (!definition) return null;
  const [modulePath, exportName] = definition;
  return require(modulePath)[exportName];
}

function normalizeAction(value) {
  return String(value || '')
    .trim()
    .replace(/_/g, '-');
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

function emitPackageActionResponse(context, data, defaultStatus = 'package_runtime_ready') {
  const exitCode = typeof data?.exitCode === 'number' ? data.exitCode : data?.ok === false ? 1 : 0;
  return emitResponse(
    context,
    envelope(
      context,
      data?.status || defaultStatus,
      exitCode,
      data,
      Array.isArray(data?.errors) ? data.errors : []
    )
  );
}

function emitLegacyResult(result) {
  if (!result.suppressStdout) writeJson(result.payload ?? result);
  return result.exitCode ?? (result.ok === false ? 1 : 0);
}

function captureProcessWrites(callback) {
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function writeCapturedStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callbackArg = rest.find((value) => typeof value === 'function');
    if (callbackArg) callbackArg();
    return true;
  };
  process.stderr.write = function writeCapturedStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callbackArg = rest.find((value) => typeof value === 'function');
    if (callbackArg) callbackArg();
    return true;
  };
  try {
    return {
      result: callback(),
      stdout,
      stderr,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

function emitLegacyAction(context, action) {
  if (!context.json) return emitLegacyResult(action(context));

  const captured = captureProcessWrites(() => action(context));
  const exitCode = captured.result.exitCode ?? (captured.result.ok === false ? 1 : 0);
  const status = exitCode === 0 ? 'package_runtime_ready' : 'legacy_action_blocked';
  const message =
    captured.stderr.trim() ||
    captured.stdout.trim() ||
    `${context.action} exited with code ${exitCode}`;
  return emitResponse(
    context,
    envelope(
      context,
      status,
      exitCode,
      {
        legacyResult: captured.result,
        stdout: captured.stdout,
        stderr: captured.stderr,
      },
      exitCode === 0 ? [] : [{ code: status, message }]
    )
  );
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
  if (
    context.legacyOrchestration &&
    ORCHESTRATION_ACTIONS.has(context.action) &&
    context.action !== 'author-confirmation-ready-source' &&
    context.action !== 'inspect' &&
    context.action !== 'confirm-scope'
  ) {
    return emitPackageOrchestration(context);
  }

  if (!SUPPORTED_ACTIONS.has(context.action) && ORCHESTRATION_ACTIONS.has(context.action)) {
    return emitPackageOrchestration(context);
  }

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
    const result = confirmScopeAction(
      context,
      hasRuntimeState(context.cwd) ? inspectRuntimeState(context.cwd) : null
    );
    const exitCode = result.exitCode ?? (result.ok === false ? 1 : 0);
    return emitResponse(
      context,
      envelope(
        context,
        result.ok === false ? 'confirmation_blocked' : result.status || 'ok',
        exitCode,
        result,
        result.ok === false
          ? [
              {
                code: result.mismatches?.[0] || 'confirmation_blocked',
                message: result.error || result.mismatches?.join(', ') || 'confirmation blocked',
              },
            ]
          : []
      )
    );
  }

  if (context.action === 'dispatch-plan') {
    const runtime = requireRuntimeState(context);
    if (!runtime.ok) return emitResponse(context, runtime.response);
    return emitPackageActionResponse(
      context,
      dispatchPlanAction(context, runtime.state),
      'dispatch_blocked'
    );
  }

  if (context.action === 'run-loop') {
    return emitPackageOrchestration(context);
  }

  if (context.action === 'release-gate') {
    return emitLegacyAction(context, releaseGateAction);
  }

  if (context.action === 'quality-gate') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, qualityGateAction(context))
    );
  }

  if (context.action === 'delivery-truth-gate') {
    return emitLegacyAction(context, deliveryTruthGateAction);
  }

  if (context.action === 'requirements-contract-prompt-transaction-publish') {
    return emitPackageActionResponse(
      context,
      await promptTransactionPublishAction(context),
      'prompt_transaction_publication_blocked'
    );
  }

  if (context.action === 'implementation-readiness-gate') {
    return emitPackageActionResponse(
      context,
      implementationReadinessGateAction(context),
      'implementation_readiness_blocked'
    );
  }

  if (context.action === 'unified-ingress') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, unifiedIngressAction(context))
    );
  }

  if (context.action === 'delivery-closeout-gate') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, deliveryCloseoutGateAction(context))
    );
  }

  if (context.action === 'delivery-evidence-run') {
    return emitLegacyAction(context, deliveryEvidenceRunAction);
  }

  if (context.action === 'host-matrix-pr-orchestrator') {
    return emitLegacyAction(context, hostMatrixPrOrchestratorAction);
  }

  if (context.action === 'soak-runner') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, soakRunnerAction(context))
    );
  }

  if (context.action === 'dual-host-pr-orchestrator') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, dualHostPrOrchestratorAction(context))
    );
  }

  if (context.action === 'chaos-scenarios') {
    return emitResponse(
      context,
      envelope(context, 'package_runtime_ready', 0, chaosScenariosAction(context))
    );
  }

  const packageRuntimeReadyAction =
    PACKAGE_RUNTIME_READY_ACTIONS[context.action] ||
    loadWave312PackageRuntimeAction(context.action);
  if (packageRuntimeReadyAction) {
    const data = await packageRuntimeReadyAction(context);
    return emitResponse(
      context,
      envelope(
        context,
        data.status || 'package_runtime_ready',
        typeof data.exitCode === 'number' ? data.exitCode : 0,
        data,
        Array.isArray(data.errors) ? data.errors : []
      )
    );
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
