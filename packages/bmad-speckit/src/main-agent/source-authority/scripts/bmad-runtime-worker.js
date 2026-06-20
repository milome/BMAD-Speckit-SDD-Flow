"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTONOMOUS_FALLBACK_DISABLED_REASON = exports.governanceCurrentRunPath = void 0;
exports.processQueue = processQueue;
/* eslint-disable @typescript-eslint/no-unused-vars */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const { buildGovernanceRunnerCliPresentation } = require('../_bmad/runtime/hooks/governance-runner-summary-presenter.cjs');
const write_rerun_history_1 = require("../packages/scoring/governance/write-rerun-history");
const governance_remediation_config_1 = require("./governance-remediation-config");
const governance_packet_execution_store_1 = require("./governance-packet-execution-store");
const governance_remediation_runner_1 = require("./governance-remediation-runner");
const reviewer_registry_1 = require("./reviewer-registry");
const governance_runtime_queue_1 = require("./governance-runtime-queue");
Object.defineProperty(exports, "governanceCurrentRunPath", { enumerable: true, get: function () { return governance_runtime_queue_1.governanceCurrentRunPath; } });
const governance_execution_result_ingestor_1 = require("./governance-execution-result-ingestor");
const governance_stage_event_emitter_cjs_1 = require("../_bmad/runtime/hooks/governance-stage-event-emitter.cjs");
const LEGACY_QUEUE_DIR = path.join('.claude', 'state', 'runtime', 'queue');
function legacyCurrentRunPath(projectRoot) {
    return path.join(projectRoot, '.claude', 'state', 'runtime', 'current-run.json');
}
function ensureLegacyQueueDirs(projectRoot) {
    for (const bucket of ['pending', 'processing', 'done', 'failed']) {
        fs.mkdirSync(path.join(projectRoot, LEGACY_QUEUE_DIR, bucket), { recursive: true });
    }
}
function readQueueFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));
}
function appendLegacyCurrentRun(projectRoot, item) {
    const currentRunFile = legacyCurrentRunPath(projectRoot);
    const existing = fs.existsSync(currentRunFile)
        ? JSON.parse(fs.readFileSync(currentRunFile, 'utf8'))
        : [];
    existing.push(item);
    fs.mkdirSync(path.dirname(currentRunFile), { recursive: true });
    fs.writeFileSync(currentRunFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}
function processLegacyEvent(projectRoot, item) {
    appendLegacyCurrentRun(projectRoot, item);
}
async function processLegacyQueue(projectRoot) {
    ensureLegacyQueueDirs(projectRoot);
    const pendingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'pending');
    const processingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'processing');
    const doneDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'done');
    const failedDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'failed');
    for (const file of readQueueFiles(pendingDir)) {
        const itemPath = path.join(pendingDir, file);
        const processingPath = path.join(processingDir, file);
        fs.renameSync(itemPath, processingPath);
        try {
            const item = JSON.parse(fs.readFileSync(processingPath, 'utf8'));
            processLegacyEvent(projectRoot, item);
            fs.renameSync(processingPath, path.join(doneDir, file));
        }
        catch {
            fs.renameSync(processingPath, path.join(failedDir, file));
        }
    }
}
function deriveRerunDecisionFromPayload(payload) {
    if (payload.rerunDecision?.mode) {
        return payload.rerunDecision;
    }
    const signals = [
        ...new Set((payload.journeyContractHints ?? [])
            .map((hint) => (typeof hint?.signal === 'string' ? hint.signal : null))
            .filter((signal) => Boolean(signal && signal.trim()))),
    ].sort();
    if (signals.length > 0) {
        return {
            mode: 'targeted',
            signals,
            hintCount: signals.length,
            reason: 'journey contract hints attached to governance rerun queue item',
        };
    }
    return {
        mode: 'generic',
        signals: [],
        hintCount: 0,
        reason: 'no journey contract hints attached to governance rerun queue item',
    };
}
function activeRerunStageFromLoopState(loopState) {
    const chain = Array.isArray(loopState.rerunChain) ? loopState.rerunChain : [];
    if (chain.length === 0) {
        return null;
    }
    const index = typeof loopState.rerunStageIndex === 'number' && loopState.rerunStageIndex >= 0
        ? Math.min(loopState.rerunStageIndex, chain.length - 1)
        : 0;
    return chain[index] ?? null;
}
function deriveExecutorRoutingProjection(input) {
    if (input.result.executorPacket) {
        return {
            routingMode: input.result.executorPacket.routingMode,
            executorRoute: input.result.executorPacket.executorRoute,
            prioritizedSignals: input.result.executorPacket.prioritizedSignals,
        };
    }
    if (input.rerunDecision.mode === 'targeted') {
        return {
            routingMode: 'targeted',
            executorRoute: 'journey-contract-remediation',
            prioritizedSignals: [...new Set((input.rerunDecision.signals ?? []).filter(Boolean))].sort(),
        };
    }
    if (input.rerunDecision.mode === 'generic') {
        return {
            routingMode: 'generic',
            executorRoute: 'default-gate-remediation',
            prioritizedSignals: [],
        };
    }
    return undefined;
}
function buildRemediationAuditTraceProjection(input) {
    if (!input.executorRouting) {
        return undefined;
    }
    const summaryLines = [
        `Routing Mode: ${input.executorRouting.routingMode}`,
        `Executor Route: ${input.executorRouting.executorRoute}`,
        `Stop Reason: ${input.result.stopReason ?? '(none)'}`,
        `Journey Contract Signals: ${input.result.journeyContractHints.map((hint) => hint.signal).join(', ') || '(none)'}`,
    ];
    return {
        artifactPath: input.result.artifactPath,
        stopReason: input.result.stopReason,
        journeyContractHints: input.result.journeyContractHints,
        routingMode: input.executorRouting.routingMode,
        executorRoute: input.executorRouting.executorRoute,
        prioritizedSignals: input.executorRouting.prioritizedSignals,
        summaryLines,
    };
}
function buildGovernancePresentationProjection(input) {
    const fallbackAuditEntryStage = input.runtimeContext
        ? (0, reviewer_registry_1.mapFlowStageToReviewerAuditEntryStage)(input.runtimeContext.flow, input.runtimeContext.stage)
        : null;
    const fallbackReviewerRouteExplainability = fallbackAuditEntryStage
        ? [
            (0, reviewer_registry_1.buildReviewerRouteExplainability)({
                requestedSkillId: 'code-reviewer',
                auditEntryStage: fallbackAuditEntryStage,
            }),
        ]
        : undefined;
    const existingReviewerRouteExplainability = input.result.executionPlanDecision?.reviewerRouteExplainability ??
        input.result.executionIntentCandidate?.reviewerRouteExplainability;
    const reviewerRouteExplainability = existingReviewerRouteExplainability && existingReviewerRouteExplainability.length > 0
        ? existingReviewerRouteExplainability.map((entry) => entry.activeAuditConsumer || !fallbackAuditEntryStage
            ? entry
            : {
                ...entry,
                activeAuditConsumer: fallbackReviewerRouteExplainability?.[0]?.activeAuditConsumer ?? null,
            })
        : fallbackReviewerRouteExplainability;
    return buildGovernanceRunnerCliPresentation({
        executionIntentCandidate: input.result.executionIntentCandidate,
        executionPlanDecision: input.result.executionPlanDecision
            ? {
                ...input.result.executionPlanDecision,
                ...(reviewerRouteExplainability ? { reviewerRouteExplainability } : {}),
            }
            : input.result.executionPlanDecision,
        shouldContinue: input.result.shouldContinue,
        stopReason: input.result.stopReason ?? null,
        loopStateId: input.result.loopStateId ?? null,
        currentAttemptNumber: input.result.currentAttemptNumber ?? null,
        nextAttemptNumber: input.result.nextAttemptNumber ?? null,
        artifactPath: input.result.artifactPath ?? null,
        packetPaths: input.packetPaths,
        executorRouting: input.result.executorRouting,
        runnerSummaryLines: input.result.runnerSummaryLines ?? [],
    });
}
function buildExecutionProjection(record) {
    if (!record) {
        return undefined;
    }
    return {
        executionId: record.executionId,
        executionStatus: record.status,
        authoritativeHost: record.authoritativeHost,
        lastRerunGateStatus: record.lastRerunGateResult?.status ?? null,
    };
}
function syncExecutionProjectionIntoCurrentRun(projectRoot, executionRecords) {
    if (executionRecords.length === 0) {
        return;
    }
    const currentRun = (0, governance_runtime_queue_1.readGovernanceCurrentRun)(projectRoot);
    if (currentRun.length === 0) {
        return;
    }
    const updated = currentRun.map((entry) => {
        const loopStateId = entry.result?.loopStateId;
        if (typeof loopStateId !== 'string' || !loopStateId) {
            return entry;
        }
        const record = executionRecords.find((item) => item.loopStateId === loopStateId);
        if (!record || !entry.result) {
            return entry;
        }
        return {
            ...entry,
            result: {
                ...entry.result,
                executionProjection: buildExecutionProjection(record),
            },
        };
    });
    fs.mkdirSync(path.dirname((0, governance_runtime_queue_1.governanceCurrentRunPath)(projectRoot)), { recursive: true });
    fs.writeFileSync((0, governance_runtime_queue_1.governanceCurrentRunPath)(projectRoot), JSON.stringify(updated, null, 2) + '\n', 'utf8');
}
async function processGovernanceRerunEvent(queueProjectRoot, item) {
    const payload = item.payload ?? {};
    const runnerProjectRoot = payload.projectRoot ?? queueProjectRoot;
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(runnerProjectRoot, payload.configPath);
    const providerAdapter = (0, governance_remediation_config_1.createGovernanceProviderAdapterFromConfig)(config);
    const runnerInput = payload.runnerInput;
    const rerunDecision = deriveRerunDecisionFromPayload(payload);
    if (!runnerInput) {
        throw new Error('governance-remediation-rerun queue item missing payload.runnerInput');
    }
    let priorExecutionRecord = null;
    if (config.execution?.enabled &&
        typeof runnerInput.loopStateId === 'string' &&
        runnerInput.loopStateId &&
        runnerInput.rerunGateResult) {
        priorExecutionRecord = (0, governance_execution_result_ingestor_1.ingestGovernanceRerunGateResult)(runnerProjectRoot, {
            loopStateId: runnerInput.loopStateId,
            rerunGateResult: runnerInput.rerunGateResult,
        });
    }
    const result = await (0, governance_remediation_runner_1.runGovernanceRemediation)({
        ...runnerInput,
        projectRoot: runnerProjectRoot,
        hostKind: config.primaryHost,
        providerAdapter,
        rerunDecision,
    });
    const executorRouting = deriveExecutorRoutingProjection({ result, rerunDecision });
    const remediationAuditTrace = buildRemediationAuditTraceProjection({ result, executorRouting });
    const packetPaths = {};
    let executionRecord = null;
    if (result.artifactPath && result.artifactResult) {
        const activeStage = activeRerunStageFromLoopState(result.loopState);
        const packetHosts = [...new Set(config.packetHosts)];
        if (config.execution?.enabled) {
            packetHosts.push(config.execution.authoritativeHost);
            if (config.execution.projections.emitNonAuthoritativePackets) {
                packetHosts.push(...config.execution.fallbackHosts);
            }
        }
        for (const hostKind of [...new Set(packetHosts)]) {
            const packet = (0, governance_remediation_runner_1.createGovernanceExecutorPacket)({
                hostKind,
                runtimeContext: result.runtimeContext,
                runtimePolicy: result.runtimePolicy,
                loopState: result.loopState,
                currentAttemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
                rerunGate: result.loopState.rerunGate,
                artifactMarkdown: result.artifactResult.markdown,
                journeyContractHints: result.artifactResult.journeyContractHints,
                rerunDecision,
                rerunStage: activeStage,
            });
            packetPaths[hostKind] = (0, governance_remediation_runner_1.writeGovernanceExecutorPacket)(result.artifactPath, packet);
        }
        if (config.execution?.enabled) {
            executionRecord = (0, governance_packet_execution_store_1.createGovernancePacketExecutionRecord)({
                projectRoot: runnerProjectRoot,
                queueItemId: item.id,
                loopStateId: result.loopState.loopStateId,
                attemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
                rerunGate: result.loopState.rerunGate,
                artifactPath: result.artifactPath,
                packetPaths,
                authoritativeHost: config.execution.authoritativeHost,
                fallbackHosts: config.execution.fallbackHosts,
            });
        }
    }
    const runnerSummaryLines = (0, governance_remediation_runner_1.buildGovernanceRemediationRunnerSummaryLines)({
        ...result,
        packetPaths,
    });
    const processedAt = new Date().toISOString();
    (0, write_rerun_history_1.writeGovernanceRerunHistory)({
        projectRoot: runnerProjectRoot,
        eventId: item.id,
        timestamp: processedAt,
        rerunGate: runnerInput.rerunGate,
        outcome: runnerInput.outcome,
        providerId: result.modelHintsCandidate && result.modelHintsCandidate.source === 'model-provider'
            ? result.modelHintsCandidate.providerId
            : undefined,
        providerMode: result.modelHintsCandidate && result.modelHintsCandidate.source === 'model-provider'
            ? result.modelHintsCandidate.providerMode
            : undefined,
        hostKind: runnerInput.hostKind,
        decisionMode: executorRouting?.routingMode ?? rerunDecision.mode,
        attemptId: runnerInput.attemptId,
        loopStateId: result.loopState.loopStateId,
        runtimeContext: result.runtimeContext,
        runtimePolicy: result.runtimePolicy
            ? { triggerStage: result.runtimePolicy.triggerStage }
            : null,
        executorRouting,
        remediationAuditTraceSummaryLines: remediationAuditTrace?.summaryLines,
        runnerSummaryLines,
    });
    const resultPayload = {
        executionProjection: buildExecutionProjection(executionRecord ?? priorExecutionRecord),
        artifactPath: result.artifactPath,
        packetPaths,
        executionIntentCandidate: result.executionIntentCandidate,
        executionPlanDecision: result.executionPlanDecision,
        journeyContractHints: result.journeyContractHints,
        shouldContinue: result.shouldContinue,
        stopReason: result.stopReason,
        currentAttemptNumber: result.currentAttemptNumber,
        nextAttemptNumber: result.nextAttemptNumber,
        loopStateId: result.loopState.loopStateId,
        rerunGateResultIngested: result.rerunGateResultIngested,
        executorRouting,
        remediationAuditTrace,
        runnerSummaryLines,
    };
    resultPayload.governancePresentation = buildGovernancePresentationProjection({
        result: resultPayload,
        packetPaths,
        runtimeContext: result.runtimeContext,
    });
    const finalizedItem = {
        ...item,
        processedAt,
        result: resultPayload,
    };
    const debugPath = path.join(queueProjectRoot, '_bmad-output', 'runtime', 'governance', 'queue', 'last-success-debug.json');
    fs.mkdirSync(path.dirname(debugPath), { recursive: true });
    fs.writeFileSync(debugPath, JSON.stringify({
        itemId: item.id,
        processedAt,
        stopReason: resultPayload.stopReason ?? null,
        shouldContinue: resultPayload.shouldContinue ?? null,
        artifactPath: resultPayload.artifactPath ?? null,
        queueProjectRoot,
    }, null, 2) + '\n', 'utf8');
    (0, governance_runtime_queue_1.appendGovernanceCurrentRun)(queueProjectRoot, finalizedItem);
    return finalizedItem;
}
async function processGovernanceEvent(queueProjectRoot, item) {
    if (item.type === 'governance-pre-continue-check') {
        const payload = (item.payload ?? {});
        const gateFailures = Array.isArray(payload.failures) ? payload.failures : [];
        const gateCheck = {
            gate: payload.gate || 'pre-continue',
            workflow: payload.workflow,
            step: payload.step,
            artifactPath: payload.artifactPath ?? null,
            scope: {
                branch: payload.branch ?? null,
                epicId: payload.epicId ?? null,
                storyId: payload.storyId ?? null,
            },
            failures: gateFailures,
            status: payload.status || (gateFailures.length > 0 ? 'fail' : 'pass'),
            rerunGate: payload.rerunGate || payload.gate || 'pre-continue',
            sourceGateFailureIds: payload.sourceGateFailureIds || [],
        };
        const result = {
            shouldContinue: gateCheck.status === 'pass' ? false : false,
            stopReason: gateFailures.length > 0
                ? 'gate failed - remediation required'
                : 'gate passed - awaiting workflow transition',
            gateCheck,
        };
        if (payload.status === 'fail' && payload.rerunGate) {
            const runnerProjectRoot = payload.projectRoot ?? queueProjectRoot;
            const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(runnerProjectRoot);
            const remediationResult = await (0, governance_remediation_runner_1.runGovernanceRemediation)({
                projectRoot: runnerProjectRoot,
                outputPath: payload.artifactPath ??
                    path.join(runnerProjectRoot, '_bmad-output', 'planning-artifacts', 'gate-remediation.md'),
                promptText: `GateFailure for ${payload.workflow || 'unknown-workflow'} ${payload.step || 'workflow'}: ${gateFailures.join('; ')}`,
                stageContextKnown: true,
                gateFailureExists: true,
                blockerOwnershipLocked: true,
                rootTargetLocked: true,
                equivalentAdapterCount: 1,
                attemptId: `pre-continue-${item.id}`,
                sourceGateFailureIds: payload.sourceGateFailureIds ?? [],
                capabilitySlot: `${payload.workflow || 'workflow'}.${payload.step || 'workflow'}`,
                canonicalAgent: 'Governance Gate Runner',
                actualExecutor: 'pre-continue-check',
                adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
                targetArtifacts: payload.artifactPath ? [payload.artifactPath] : [],
                expectedDelta: 'repair governed contract sections before Continue',
                rerunOwner: 'PM',
                rerunGate: payload.rerunGate,
                rerunChain: payload.rerunChain,
                outcome: 'blocked',
                hostKind: 'claude',
            });
            const rerunDecision = deriveRerunDecisionFromPayload({
                journeyContractHints: [],
            });
            const activeStage = activeRerunStageFromLoopState(remediationResult.loopState);
            const packetPaths = {};
            let executionRecord = null;
            if (remediationResult.artifactPath && remediationResult.artifactResult) {
                const packetHosts = [...new Set(config.packetHosts)];
                if (config.execution?.enabled) {
                    packetHosts.push(config.execution.authoritativeHost);
                    if (config.execution.projections.emitNonAuthoritativePackets) {
                        packetHosts.push(...config.execution.fallbackHosts);
                    }
                }
                for (const hostKind of [...new Set(packetHosts)]) {
                    const packet = (0, governance_remediation_runner_1.createGovernanceExecutorPacket)({
                        hostKind,
                        runtimeContext: remediationResult.runtimeContext,
                        runtimePolicy: remediationResult.runtimePolicy,
                        loopState: remediationResult.loopState,
                        currentAttemptNumber: remediationResult.currentAttemptNumber ?? remediationResult.loopState.attemptCount,
                        rerunGate: remediationResult.loopState.rerunGate,
                        artifactMarkdown: remediationResult.artifactResult.markdown,
                        journeyContractHints: remediationResult.artifactResult.journeyContractHints,
                        rerunDecision,
                        rerunStage: activeStage,
                    });
                    packetPaths[hostKind] = (0, governance_remediation_runner_1.writeGovernanceExecutorPacket)(remediationResult.artifactPath, packet);
                }
                if (config.execution?.enabled) {
                    executionRecord = (0, governance_packet_execution_store_1.createGovernancePacketExecutionRecord)({
                        projectRoot: runnerProjectRoot,
                        queueItemId: item.id,
                        loopStateId: remediationResult.loopState.loopStateId,
                        attemptNumber: remediationResult.currentAttemptNumber ?? remediationResult.loopState.attemptCount,
                        rerunGate: remediationResult.loopState.rerunGate,
                        artifactPath: remediationResult.artifactPath,
                        packetPaths,
                        authoritativeHost: config.execution.authoritativeHost,
                        fallbackHosts: config.execution.fallbackHosts,
                    });
                }
            }
            result.stopReason = remediationResult.stopReason ?? result.stopReason;
            result.shouldContinue = remediationResult.shouldContinue;
            result.currentAttemptNumber = remediationResult.currentAttemptNumber;
            result.nextAttemptNumber = remediationResult.nextAttemptNumber;
            result.loopStateId = remediationResult.loopState.loopStateId;
            result.rerunGateResultIngested = remediationResult.rerunGateResultIngested;
            result.executionProjection = buildExecutionProjection(executionRecord);
            result.executorRouting = remediationResult.executorPacket
                ? {
                    routingMode: remediationResult.executorPacket.routingMode,
                    executorRoute: remediationResult.executorPacket.executorRoute,
                    prioritizedSignals: remediationResult.executorPacket.prioritizedSignals,
                }
                : undefined;
            result.runnerSummaryLines = (0, governance_remediation_runner_1.buildGovernanceRemediationRunnerSummaryLines)({
                ...remediationResult,
                packetPaths,
                shouldContinue: remediationResult.shouldContinue,
                stopReason: result.stopReason ?? null,
            });
            result.packetPaths = packetPaths;
            result.artifactPath = remediationResult.artifactPath;
        }
        if (payload.status === 'fail' && payload.rerunGate) {
            (0, governance_stage_event_emitter_cjs_1.persistGovernanceStageRerunResultEvent)((0, governance_stage_event_emitter_cjs_1.buildGovernanceStageRerunResultEvent)({
                projectRoot: payload.projectRoot ?? queueProjectRoot,
                sourceEventType: 'governance-pre-continue-check',
                runnerInput: {
                    projectRoot: payload.projectRoot ?? queueProjectRoot,
                    outputPath: payload.artifactPath ??
                        path.join(payload.projectRoot ?? queueProjectRoot, '_bmad-output', 'planning-artifacts', 'gate-remediation.md'),
                    promptText: `GateFailure for ${payload.workflow || 'unknown-workflow'} ${payload.step || 'workflow'}: ${gateFailures.join('; ')}`,
                    stageContextKnown: true,
                    gateFailureExists: true,
                    blockerOwnershipLocked: true,
                    rootTargetLocked: true,
                    equivalentAdapterCount: 1,
                    attemptId: `pre-continue-${item.id}`,
                    sourceGateFailureIds: payload.sourceGateFailureIds ?? [],
                    capabilitySlot: `${payload.workflow || 'workflow'}.${payload.step || 'workflow'}`,
                    canonicalAgent: 'Governance Gate Runner',
                    actualExecutor: 'pre-continue-check',
                    adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
                    targetArtifacts: payload.artifactPath ? [payload.artifactPath] : [],
                    expectedDelta: 'repair governed contract sections before Continue',
                    rerunOwner: 'PM',
                    rerunGate: payload.rerunGate,
                    outcome: 'blocked',
                    hostKind: 'claude',
                },
                rerunGateResult: {
                    gate: payload.rerunGate,
                    status: 'fail',
                    blockerIds: payload.sourceGateFailureIds ?? [],
                    summary: gateFailures.join('; '),
                    updatedArtifacts: payload.artifactPath ? [payload.artifactPath] : [],
                },
            }));
        }
        const passthroughItem = {
            ...item,
            processedAt: new Date().toISOString(),
            result,
        };
        (0, governance_runtime_queue_1.appendGovernanceCurrentRun)(queueProjectRoot, passthroughItem);
        return passthroughItem;
    }
    if (item.type === 'governance-remediation-rerun') {
        return processGovernanceRerunEvent(queueProjectRoot, item);
    }
    const passthroughItem = {
        ...item,
        processedAt: new Date().toISOString(),
    };
    (0, governance_runtime_queue_1.appendGovernanceCurrentRun)(queueProjectRoot, passthroughItem);
    return passthroughItem;
}
async function processGovernanceQueue(projectRoot) {
    (0, governance_runtime_queue_1.ensureGovernanceQueueDirs)(projectRoot);
    const pendingDir = path.dirname((0, governance_runtime_queue_1.governancePendingQueueFilePath)(projectRoot, 'queue-probe'));
    for (const file of readQueueFiles(pendingDir)) {
        const itemPath = path.join(pendingDir, file);
        const itemId = path.basename(file, '.json');
        const processingPath = (0, governance_runtime_queue_1.governanceProcessingQueueFilePath)(projectRoot, itemId);
        fs.renameSync(itemPath, processingPath);
        try {
            const item = JSON.parse(fs.readFileSync(processingPath, 'utf8'));
            const finalizedItem = await processGovernanceEvent(projectRoot, item);
            fs.writeFileSync(processingPath, JSON.stringify(finalizedItem, null, 2) + '\n', 'utf8');
            fs.renameSync(processingPath, (0, governance_runtime_queue_1.governanceDoneQueueFilePath)(projectRoot, itemId));
        }
        catch (error) {
            const failedDebugPath = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue', 'last-failed-debug.json');
            try {
                const failedItem = JSON.parse(fs.readFileSync(processingPath, 'utf8'));
                failedItem.processedAt = new Date().toISOString();
                failedItem.error = error instanceof Error ? error.message : String(error);
                fs.writeFileSync(processingPath, JSON.stringify(failedItem, null, 2) + '\n', 'utf8');
            }
            catch {
                // Keep the original queue file if it cannot be re-read or re-written.
            }
            fs.mkdirSync(path.dirname(failedDebugPath), { recursive: true });
            fs.writeFileSync(failedDebugPath, JSON.stringify({
                itemId,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? (error.stack ?? null) : null,
                processingPath,
                failedAt: new Date().toISOString(),
            }, null, 2) + '\n', 'utf8');
            fs.renameSync(processingPath, (0, governance_runtime_queue_1.governanceFailedQueueFilePath)(projectRoot, itemId));
        }
    }
}
exports.AUTONOMOUS_FALLBACK_DISABLED_REASON = 'autonomous fallback execution has been hard disabled; main agent must continue from orchestration state and packet';
async function processQueue(projectRoot = process.cwd(), options = {}) {
    void projectRoot;
    void options;
    return;
}
if (require.main === module) {
    void processQueue(process.cwd());
}
