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
exports.governanceAttemptLoopStatePath = governanceAttemptLoopStatePath;
exports.readGovernanceAttemptLoopState = readGovernanceAttemptLoopState;
exports.writeGovernanceAttemptLoopState = writeGovernanceAttemptLoopState;
exports.createGovernanceExecutorPacket = createGovernanceExecutorPacket;
exports.governanceExecutorPacketPath = governanceExecutorPacketPath;
exports.renderGovernanceExecutorPacket = renderGovernanceExecutorPacket;
exports.writeGovernanceExecutorPacket = writeGovernanceExecutorPacket;
exports.runGovernanceRemediation = runGovernanceRemediation;
exports.buildGovernanceRemediationRunnerSummaryLines = buildGovernanceRemediationRunnerSummaryLines;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const { appendRunnerSummaryToArtifactMarkdown, renderGovernanceRunnerSummaryLines } = require('../_bmad/runtime/hooks/governance-runner-summary-format.cjs');
const governance_remediation_artifact_1 = require("./governance-remediation-artifact");
const prompt_routing_governance_1 = require("./prompt-routing-governance");
const governance_provider_adapter_1 = require("./governance-provider-adapter");
const skill_inventory_provider_1 = require("./skill-inventory-provider");
const runtime_context_1 = require("./runtime-context");
const runtime_context_registry_1 = require("./runtime-context-registry");
const runtime_governance_1 = require("./runtime-governance");
const governance_remediation_config_1 = require("./governance-remediation-config");
const reviewer_registry_1 = require("./reviewer-registry");
const remediation_hints_1 = require("../packages/scoring/gate/remediation-hints");
const loader_1 = require("../packages/scoring/query/loader");
const query_1 = require("../packages/scoring/query");
const runtime_scoring_data_path_1 = require("./runtime-scoring-data-path");
function toExecutionMode(hostKind) {
    switch (hostKind) {
        case 'cursor':
            return 'cursor-mcp-task';
        case 'claude':
            return 'claude-agent-tool';
        case 'codex':
            return 'codex-spawn-agent';
        case 'generic':
        default:
            return 'generic-prompt-packet';
    }
}
function sanitizeLoopStateId(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
function unique(items) {
    return [...new Set(items.filter((item) => item.trim() !== ''))];
}
function blockerSignature(result) {
    if (!result || result.status !== 'fail') {
        return '';
    }
    return unique([...(result.blockerIds ?? [])])
        .sort()
        .join('|');
}
function resolveAbsolutePath(projectRoot, targetPath) {
    return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}
function resolveGovernanceScoringDataPath(projectRoot) {
    return (0, runtime_scoring_data_path_1.resolveRuntimeScoringDataPath)({ root: projectRoot });
}
function nowIso() {
    return new Date().toISOString();
}
function parseEpicStoryFromRuntimeContext(runtimeContext) {
    const dottedStory = runtimeContext?.storyId?.match(/^(\d+)\.(\d+)$/);
    if (dottedStory) {
        return {
            epicId: Number(dottedStory[1]),
            storyId: Number(dottedStory[2]),
        };
    }
    const epic = runtimeContext?.epicId?.match(/(\d+)/);
    const story = runtimeContext?.storyId?.match(/(\d+)$/);
    if (epic && story) {
        return {
            epicId: Number(epic[1]),
            storyId: Number(story[1]),
        };
    }
    return null;
}
function loadJourneyContractHintsForRuntime(projectRoot, runtimeContext) {
    const dataPath = resolveGovernanceScoringDataPath(projectRoot);
    if (!fs.existsSync(dataPath)) {
        return [];
    }
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath).filter((record) => record.scenario === 'real_dev' && record.journey_contract_signals != null);
    if (records.length === 0) {
        return [];
    }
    const epicStory = parseEpicStoryFromRuntimeContext(runtimeContext);
    const relevantRecords = epicStory
        ? records.filter((record) => {
            const parsed = (0, query_1.parseEpicStoryFromRecord)(record);
            return (parsed != null &&
                parsed.epicId === epicStory.epicId &&
                parsed.storyId === epicStory.storyId);
        })
        : records;
    if (relevantRecords.length === 0) {
        return [];
    }
    return (0, remediation_hints_1.buildGateRemediationHints)(relevantRecords);
}
function buildJourneyContractActionLines(hints) {
    if (hints.length === 0) {
        return ['- (none)'];
    }
    return hints.flatMap((hint) => [
        `- ${hint.signal}: ${hint.recommendation}`,
        `  - Count: ${hint.count}`,
        `  - Affected stages: ${hint.affected_stages.join(', ') || '(none)'}`,
        `  - Stories: ${hint.epic_stories.join(', ') || '(none)'}`,
    ]);
}
function uniqueSignals(signals) {
    return [
        ...new Set(signals.filter((signal) => Boolean(signal && signal.trim()))),
    ].sort();
}
function resolveExecutorRouting(input) {
    const hintSignals = input.journeyContractHints.map((hint) => hint.signal);
    const decisionSignals = input.rerunDecision?.signals ?? [];
    const prioritizedSignals = uniqueSignals([...decisionSignals, ...hintSignals]);
    const targeted = input.rerunDecision?.mode === 'targeted' || prioritizedSignals.length > 0;
    if (targeted) {
        return {
            routingMode: 'targeted',
            executorRoute: 'journey-contract-remediation',
            prioritizedSignals,
            packetStrategy: 'journey-contract-remediation-packet',
            reason: input.rerunDecision?.reason ??
                'journey contract hints detected; use targeted remediation routing before generic blocker cleanup',
        };
    }
    return {
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
        packetStrategy: 'default-remediation-packet',
        reason: input.rerunDecision?.reason ??
            'no journey contract hints detected; use the default gate remediation route',
    };
}
function normalizeRerunStage(stage) {
    return {
        ...stage,
        targetArtifacts: unique(stage.targetArtifacts ?? []),
        sourceGateFailureIds: unique(stage.sourceGateFailureIds ?? []),
        stageKind: stage.stageKind === 'resume_original_flow' ? 'resume_original_flow' : 'remediation',
        resumeOriginalExecution: stage.resumeOriginalExecution &&
            typeof stage.resumeOriginalExecution === 'object' &&
            typeof stage.resumeOriginalExecution.promptText === 'string' &&
            stage.resumeOriginalExecution.promptText.trim() !== ''
            ? {
                toolName: typeof stage.resumeOriginalExecution.toolName === 'string'
                    ? stage.resumeOriginalExecution.toolName
                    : undefined,
                routeHint: typeof stage.resumeOriginalExecution.routeHint === 'string'
                    ? stage.resumeOriginalExecution.routeHint
                    : null,
                promptText: stage.resumeOriginalExecution.promptText,
                requestedFlow: typeof stage.resumeOriginalExecution.requestedFlow === 'string'
                    ? stage.resumeOriginalExecution.requestedFlow
                    : null,
                blockedByGate: typeof stage.resumeOriginalExecution.blockedByGate === 'string'
                    ? stage.resumeOriginalExecution.blockedByGate
                    : null,
            }
            : null,
    };
}
function createRerunStageFromInput(input) {
    return normalizeRerunStage({
        rerunGate: input.rerunGate,
        capabilitySlot: input.capabilitySlot,
        canonicalAgent: input.canonicalAgent,
        targetArtifacts: input.targetArtifacts,
        expectedDelta: input.expectedDelta,
        actualExecutor: input.actualExecutor,
        adapterPath: input.adapterPath,
        rerunOwner: input.rerunOwner,
        sourceGateFailureIds: input.sourceGateFailureIds,
        outcome: input.outcome,
        stageKind: 'remediation',
    });
}
function activeRerunChain(state) {
    if (state.rerunChain && state.rerunChain.length > 0) {
        return state.rerunChain.map((stage) => normalizeRerunStage(stage));
    }
    return [
        normalizeRerunStage({
            rerunGate: state.rerunGate,
            capabilitySlot: state.capabilitySlot,
            canonicalAgent: state.canonicalAgent,
            targetArtifacts: state.targetArtifacts,
            expectedDelta: '',
        }),
    ];
}
function activeRerunStage(state) {
    const chain = activeRerunChain(state);
    const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
    return chain[index];
}
function syncLoopStateWithActiveRerunStage(state) {
    const chain = activeRerunChain(state);
    const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
    const stage = chain[index];
    state.rerunChain = chain;
    state.rerunStageIndex = index;
    state.rerunGate = stage.rerunGate;
    state.capabilitySlot = stage.capabilitySlot;
    state.canonicalAgent = stage.canonicalAgent;
    state.targetArtifacts = unique(stage.targetArtifacts);
    return state;
}
function ensureLoopStateRerunChain(state, input) {
    if ((!state.rerunChain || state.rerunChain.length === 0) && input.rerunChain?.length) {
        state.rerunChain = input.rerunChain.map((stage) => normalizeRerunStage(stage));
        state.rerunStageIndex = 0;
    }
    else if (!state.rerunChain || state.rerunChain.length === 0) {
        state.rerunChain = [createRerunStageFromInput(input)];
        state.rerunStageIndex = 0;
    }
    return syncLoopStateWithActiveRerunStage(state);
}
function advanceLoopStateToNextRerunStage(state) {
    const chain = activeRerunChain(state);
    const currentIndex = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
    if (currentIndex >= chain.length - 1) {
        return null;
    }
    state.rerunChain = chain;
    state.rerunStageIndex = currentIndex + 1;
    syncLoopStateWithActiveRerunStage(state);
    state.updatedAt = nowIso();
    return activeRerunStage(state);
}
function deriveLoopStateId(input) {
    return sanitizeLoopStateId(input.loopStateId ??
        `${input.rerunGate}--${input.capabilitySlot}--${input.targetArtifacts.join('-') || 'artifacts'}`);
}
function governanceAttemptLoopStatePath(projectRoot, loopStateId) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'remediation-loops', `${sanitizeLoopStateId(loopStateId)}.json`);
}
function defaultGovernanceAttemptLoopState(input, loopStateId) {
    const timestamp = nowIso();
    const rerunChain = (input.rerunChain?.length ? input.rerunChain : [createRerunStageFromInput(input)]).map((stage) => normalizeRerunStage(stage));
    const firstStage = rerunChain[0];
    return {
        version: 1,
        loopStateId,
        rerunGate: firstStage.rerunGate,
        capabilitySlot: firstStage.capabilitySlot,
        canonicalAgent: firstStage.canonicalAgent,
        targetArtifacts: firstStage.targetArtifacts,
        maxAttempts: input.maxAttempts ?? 3,
        maxNoProgressRepeats: input.maxNoProgressRepeats ?? 1,
        attemptCount: 0,
        noProgressRepeatCount: 0,
        status: 'idle',
        lastGateResult: null,
        lastStopReason: null,
        executorRouting: null,
        remediationAuditTraceSummaryLines: [],
        rerunChain,
        rerunStageIndex: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        attempts: [],
    };
}
function tryReadRuntimeContext(projectRoot) {
    try {
        return (0, runtime_context_1.readRuntimeContext)(projectRoot);
    }
    catch {
        return null;
    }
}
function tryReadRuntimeContextRegistry(projectRoot) {
    try {
        return (0, runtime_context_registry_1.readRuntimeContextRegistry)(projectRoot);
    }
    catch {
        return null;
    }
}
function tryResolveRuntimePolicy(runtimeContext) {
    if (!runtimeContext) {
        return null;
    }
    try {
        return (0, runtime_governance_1.resolveRuntimePolicy)({
            flow: runtimeContext.flow,
            stage: runtimeContext.stage,
            epicId: runtimeContext.epicId,
            storyId: runtimeContext.storyId,
            storySlug: runtimeContext.storySlug,
            runId: runtimeContext.runId,
            artifactRoot: runtimeContext.artifactRoot,
            contextSource: runtimeContext.sourceMode,
        });
    }
    catch {
        return null;
    }
}
function readGovernanceAttemptLoopState(projectRoot, loopStateId) {
    const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function tryReadGovernanceAttemptLoopState(projectRoot, loopStateId) {
    const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
    if (!fs.existsSync(file)) {
        return null;
    }
    return readGovernanceAttemptLoopState(projectRoot, loopStateId);
}
function writeGovernanceAttemptLoopState(projectRoot, state) {
    const file = governanceAttemptLoopStatePath(projectRoot, state.loopStateId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
function shouldStopForHumanPrReview(input) {
    return (input.rerunGateResult.gate === 'bmad_story_stage4' &&
        input.rerunGateResult.status === 'pass' &&
        input.nextStage?.rerunGate === 'pr_review');
}
function ingestRerunGateResult(state, result) {
    const previous = state.lastGateResult;
    const lastAttempt = state.attempts[state.attempts.length - 1];
    if (lastAttempt) {
        lastAttempt.rerunGateResult = {
            ...result,
            observedAt: result.observedAt ?? nowIso(),
        };
    }
    const normalized = {
        ...result,
        observedAt: result.observedAt ?? nowIso(),
    };
    if (normalized.status === 'fail' &&
        previous?.status === 'fail' &&
        blockerSignature(previous) !== '' &&
        blockerSignature(previous) === blockerSignature(normalized)) {
        state.noProgressRepeatCount += 1;
    }
    else if (normalized.status === 'fail') {
        state.noProgressRepeatCount = 0;
    }
    else {
        state.noProgressRepeatCount = 0;
    }
    state.lastGateResult = normalized;
    state.updatedAt = nowIso();
    return state;
}
function writeLoopStateTraceSummary(input) {
    input.loopState.executorRouting = {
        ...input.executorRouting,
        prioritizedSignals: [...input.executorRouting.prioritizedSignals],
    };
    input.loopState.remediationAuditTraceSummaryLines = (0, governance_remediation_artifact_1.buildRemediationAuditTraceSummaryLines)(input.stopReason ?? undefined, input.journeyContractHints, input.executorRouting);
    if (input.attachToLatestAttempt) {
        const lastAttempt = input.loopState.attempts[input.loopState.attempts.length - 1];
        if (lastAttempt) {
            lastAttempt.executorRouting = {
                ...input.executorRouting,
                prioritizedSignals: [...input.executorRouting.prioritizedSignals],
            };
            lastAttempt.remediationAuditTraceSummaryLines = [
                ...input.loopState.remediationAuditTraceSummaryLines,
            ];
        }
    }
    return input.loopState;
}
function buildPacketPrompt(input) {
    const runtimeLines = input.runtimeContext
        ? [
            `- Flow: ${input.runtimeContext.flow}`,
            `- Stage: ${input.runtimeContext.stage}`,
            `- Scope: ${input.runtimeContext.contextScope ?? 'project'}`,
            `- Story ID: ${input.runtimeContext.storyId ?? '(none)'}`,
            `- Run ID: ${input.runtimeContext.runId ?? '(none)'}`,
            `- Artifact Root: ${input.runtimeContext.artifactRoot ?? '(none)'}`,
        ]
        : ['- (none)'];
    const policyLines = input.runtimePolicy
        ? [
            `- Trigger Stage: ${input.runtimePolicy.triggerStage}`,
            `- Strictness: ${input.runtimePolicy.strictness}`,
            `- Audit Required: ${input.runtimePolicy.auditRequired ? 'yes' : 'no'}`,
            `- Mandatory Gate: ${input.runtimePolicy.mandatoryGate ? 'yes' : 'no'}`,
        ]
        : ['- (none)'];
    const resumeExecution = input.rerunStage?.stageKind === 'resume_original_flow'
        ? (input.rerunStage.resumeOriginalExecution ?? null)
        : null;
    const isResumeStage = Boolean(resumeExecution?.promptText);
    if (isResumeStage && resumeExecution) {
        const resume = resumeExecution;
        return [
            '# Governance Resume Original Execution Packet',
            '',
            '## Runtime Context',
            ...runtimeLines,
            '',
            '## Runtime Policy',
            ...policyLines,
            '',
            '## Attempt Loop State',
            `- Loop State ID: ${input.loopState.loopStateId}`,
            `- Current Attempt Number: ${input.currentAttemptNumber}`,
            `- Attempt Count So Far: ${input.loopState.attemptCount}`,
            `- Max Attempts: ${input.loopState.maxAttempts}`,
            `- No-Progress Repeat Count: ${input.loopState.noProgressRepeatCount}`,
            `- Resume Gate: ${input.rerunGate}`,
            `- Previous Gate Result: ${input.loopState.lastGateResult?.status ?? 'none'}`,
            '',
            '## Resume Original Execution',
            `- Requested Flow: ${resume.requestedFlow ?? '(unknown)'}`,
            `- Blocked By Gate: ${resume.blockedByGate ?? 'implementation-readiness'}`,
            `- Original Tool: ${resume.toolName ?? '(unknown)'}`,
            `- Route Hint: ${resume.routeHint ?? '(none)'}`,
            '',
            '## Guardrails',
            '- Resume the previously blocked implementation flow without widening scope.',
            '- Do not reopen implementation-readiness unless a genuinely new blocker is discovered.',
            '- Preserve blocker ownership, target artifact scope, and post-audit closeout contracts.',
            '',
            '## Success Criteria',
            '- Relaunch the original blocked implementation flow automatically.',
            '- Keep the same implementation target and same user-approved scope.',
            '- Continue only because the implementation-entry blocker has already been remediated.',
            '',
            '## Stop Conditions',
            '- Stop if a genuinely new blocker requires reopening implementation-readiness.',
            '- Stop if governance-owned fields would need to change.',
            '- Stop if max attempts is reached or no-progress repeats exceed the policy limit.',
            '',
            '## Original Blocked Prompt',
            '',
            resume.promptText ?? '',
            '',
            '## Governance Remediation Artifact',
            '',
            input.artifactMarkdown,
            '',
        ].join('\n');
    }
    return [
        '# Governance Remediation Task Packet',
        '',
        '## Runtime Context',
        ...runtimeLines,
        '',
        '## Runtime Policy',
        ...policyLines,
        '',
        '## Attempt Loop State',
        `- Loop State ID: ${input.loopState.loopStateId}`,
        `- Current Attempt Number: ${input.currentAttemptNumber}`,
        `- Attempt Count So Far: ${input.loopState.attemptCount}`,
        `- Max Attempts: ${input.loopState.maxAttempts}`,
        `- No-Progress Repeat Count: ${input.loopState.noProgressRepeatCount}`,
        `- Awaiting Rerun Gate: ${input.rerunGate}`,
        `- Previous Gate Result: ${input.loopState.lastGateResult?.status ?? 'none'}`,
        '',
        '## Executor Routing Decision',
        `- Routing Mode: ${input.executorRouting.routingMode}`,
        `- Executor Route: ${input.executorRouting.executorRoute}`,
        `- Packet Strategy: ${input.executorRouting.packetStrategy}`,
        `- Prioritized Signals: ${input.executorRouting.prioritizedSignals.join(', ') || '(none)'}`,
        `- Routing Reason: ${input.executorRouting.reason}`,
        '',
        '## Guardrails',
        '- Do not change blocker ownership.',
        '- Do not change failed-check severity.',
        '- Do not change artifact-derived root target.',
        '- Do not continue downstream while the blocker gate remains open.',
        '',
        '## Success Criteria',
        '- Apply the minimal remediation needed to close the named blockers.',
        '- Update only the target artifacts required by the remediation artifact.',
        `- Leave the work ready for rerun of \`${input.rerunGate}\`.`,
        ...(input.executorRouting.routingMode === 'targeted'
            ? [
                '- Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact.',
            ]
            : []),
        '',
        '## Stop Conditions',
        '- Stop if the rerun gate passes.',
        '- Stop if governance-owned fields would need to change.',
        '- Stop if max attempts is reached or no-progress repeats exceed the policy limit.',
        '',
        '## Targeted Remediation Actions',
        ...buildJourneyContractActionLines(input.journeyContractHints),
        '',
        '## Remediation Artifact',
        '',
        input.artifactMarkdown,
        '',
    ].join('\n');
}
function buildExecutorPacket(input) {
    const executorRouting = input.executorRouting ??
        resolveExecutorRouting({
            journeyContractHints: input.journeyContractHints,
            rerunDecision: input.rerunDecision,
        });
    const successCriteria = [
        'Apply the minimal remediation needed to close the named blockers.',
        'Update only the target artifacts required by the remediation artifact.',
        `Leave the work ready for rerun of ${input.rerunGate}.`,
        ...(executorRouting.routingMode === 'targeted'
            ? [
                'Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact.',
            ]
            : []),
    ];
    const isResumeStage = input.rerunStage?.stageKind === 'resume_original_flow' &&
        Boolean(input.rerunStage.resumeOriginalExecution?.promptText);
    return {
        hostKind: input.hostKind,
        executionMode: toExecutionMode(input.hostKind),
        routingMode: executorRouting.routingMode,
        executorRoute: executorRouting.executorRoute,
        prioritizedSignals: executorRouting.prioritizedSignals,
        packetStrategy: executorRouting.packetStrategy,
        routingReason: executorRouting.reason,
        prompt: buildPacketPrompt({
            ...input,
            executorRouting,
        }),
        guardrails: isResumeStage
            ? [
                'Do not widen scope beyond the original blocked implementation flow.',
                'Do not reopen implementation-readiness unless a genuinely new blocker is discovered.',
                'Do not bypass post-audit closeout contracts.',
            ]
            : [
                'Do not change blocker ownership.',
                'Do not change failed-check severity.',
                'Do not change artifact-derived root target.',
                'Do not continue downstream while the blocker gate remains open.',
            ],
        successCriteria: isResumeStage
            ? [
                'Relaunch the original blocked implementation flow automatically.',
                'Keep the same implementation target and same user-approved scope.',
                `Leave the work ready for completion of ${input.rerunGate}.`,
            ]
            : successCriteria,
        stopConditions: isResumeStage
            ? [
                'Stop if a genuinely new blocker requires reopening implementation-readiness.',
                'Stop if governance-owned fields would need to change.',
                'Stop if max attempts is reached.',
                'Stop if no-progress repeats exceed the policy limit.',
            ]
            : [
                'Stop if the rerun gate passes.',
                'Stop if governance-owned fields would need to change.',
                'Stop if max attempts is reached.',
                'Stop if no-progress repeats exceed the policy limit.',
            ],
    };
}
function createGovernanceExecutorPacket(input) {
    return buildExecutorPacket(input);
}
function governanceExecutorPacketPath(artifactPath, hostKind) {
    return artifactPath.replace(/\.md$/i, `.${hostKind}-packet.md`);
}
function renderGovernanceExecutorPacket(packet) {
    return [
        '# Governance Remediation Executor Packet',
        '',
        `- Host Kind: ${packet.hostKind}`,
        `- Execution Mode: ${packet.executionMode}`,
        `- Routing Mode: ${packet.routingMode}`,
        `- Executor Route: ${packet.executorRoute}`,
        `- Packet Strategy: ${packet.packetStrategy}`,
        `- Prioritized Signals: ${packet.prioritizedSignals.join(', ') || '(none)'}`,
        `- Routing Reason: ${packet.routingReason}`,
        '',
        '## Guardrails',
        ...packet.guardrails.map((line) => `- ${line}`),
        '',
        '## Success Criteria',
        ...packet.successCriteria.map((line) => `- ${line}`),
        '',
        '## Stop Conditions',
        ...packet.stopConditions.map((line) => `- ${line}`),
        '',
        '## Prompt',
        '',
        packet.prompt,
        '',
    ].join('\n');
}
function writeGovernanceExecutorPacket(artifactPath, packet) {
    const file = governanceExecutorPacketPath(artifactPath, packet.hostKind);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderGovernanceExecutorPacket(packet), 'utf8');
    return file;
}
async function resolveModelHintsCandidate(input) {
    if (!input.providerAdapter || !input.promptText) {
        return null;
    }
    const adapterInput = {
        projectRoot: input.projectRoot,
        hostKind: input.hostKind,
        promptText: input.promptText,
        stageContextKnown: input.stageContextKnown,
        gateFailureExists: input.gateFailureExists,
        blockerOwnershipLocked: input.blockerOwnershipLocked,
        rootTargetLocked: input.rootTargetLocked,
        equivalentAdapterCount: input.equivalentAdapterCount,
        capabilitySlot: input.capabilitySlot,
        canonicalAgent: input.canonicalAgent,
        actualExecutor: input.actualExecutor,
        targetArtifacts: input.targetArtifacts,
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory,
    };
    return (0, governance_provider_adapter_1.resolveModelHintsViaGovernanceProvider)(adapterInput, input.providerAdapter);
}
function stopResult(input) {
    return {
        artifactPath: null,
        artifactResult: null,
        executionIntentCandidate: input.executionIntentCandidate,
        executionPlanDecision: input.executionPlanDecision,
        journeyContractHints: input.journeyContractHints,
        runtimeContext: input.runtimeContext,
        runtimeRegistry: input.runtimeRegistry,
        runtimePolicy: input.runtimePolicy,
        modelHintsCandidate: input.modelHintsCandidate,
        loopState: input.loopState,
        currentAttemptNumber: input.loopState.attemptCount > 0 ? input.loopState.attemptCount : null,
        nextAttemptNumber: null,
        shouldContinue: false,
        stopReason: input.stopReason,
        rerunGateResultIngested: input.rerunGateResultIngested,
        executorPacket: null,
        packetPaths: {},
    };
}
async function runGovernanceRemediation(input) {
    const loopStateId = deriveLoopStateId(input);
    const runtimeContext = tryReadRuntimeContext(input.projectRoot);
    const runtimeRegistry = tryReadRuntimeContextRegistry(input.projectRoot);
    const runtimePolicy = tryResolveRuntimePolicy(runtimeContext);
    const resolvedSkillInventory = input.availableSkills?.length || input.skillPaths?.length || input.skillInventory?.length
        ? {
            availableSkills: input.availableSkills ?? [],
            skillPaths: input.skillPaths ?? [],
            skillInventory: input.skillInventory ?? [],
        }
        : (0, skill_inventory_provider_1.resolveGovernanceSkillInventory)({
            projectRoot: input.projectRoot,
            hostKind: input.hostKind,
        });
    const modelHintsCandidate = await resolveModelHintsCandidate(input);
    const promptHintUsage = (0, prompt_routing_governance_1.resolvePromptHintUsageFromText)({
        projectRoot: input.projectRoot,
        promptText: input.promptText,
        stageContextKnown: input.stageContextKnown,
        gateFailure: {
            exists: input.gateFailureExists,
            blockerOwnershipLocked: input.blockerOwnershipLocked,
        },
        artifactState: {
            rootTargetLocked: input.rootTargetLocked,
            equivalentAdapterCount: input.equivalentAdapterCount,
        },
        modelHintsCandidate,
        availableSkills: resolvedSkillInventory.availableSkills,
        skillPaths: resolvedSkillInventory.skillPaths,
        skillInventory: resolvedSkillInventory.skillInventory,
    });
    const executionIntentCandidate = promptHintUsage.executionIntentCandidate;
    const executionPlanDecision = promptHintUsage.executionPlanDecision;
    const journeyContractHints = loadJourneyContractHintsForRuntime(input.projectRoot, runtimeContext);
    let loopState = tryReadGovernanceAttemptLoopState(input.projectRoot, loopStateId) ??
        defaultGovernanceAttemptLoopState(input, loopStateId);
    loopState.maxAttempts = input.maxAttempts ?? loopState.maxAttempts;
    loopState.maxNoProgressRepeats = input.maxNoProgressRepeats ?? loopState.maxNoProgressRepeats;
    loopState = ensureLoopStateRerunChain(loopState, input);
    let rerunGateResultIngested = false;
    if (input.rerunGateResult) {
        loopState = ingestRerunGateResult(loopState, input.rerunGateResult);
        rerunGateResultIngested = true;
        if (input.rerunGateResult.status === 'pass') {
            const nextStage = advanceLoopStateToNextRerunStage(loopState);
            if (!nextStage) {
                loopState = writeLoopStateTraceSummary({
                    loopState,
                    stopReason: 'rerun gate passed',
                    journeyContractHints,
                    executorRouting: resolveExecutorRouting({
                        journeyContractHints,
                        rerunDecision: input.rerunDecision,
                    }),
                });
                loopState.status = 'completed';
                loopState.lastStopReason = 'rerun gate passed';
                loopState.updatedAt = nowIso();
                writeGovernanceAttemptLoopState(input.projectRoot, loopState);
                return stopResult({
                    loopState,
                    stopReason: 'rerun gate passed',
                    runtimeContext,
                    runtimeRegistry,
                    runtimePolicy,
                    rerunGateResultIngested,
                    modelHintsCandidate,
                    executionIntentCandidate,
                    executionPlanDecision,
                    journeyContractHints,
                });
            }
            if (shouldStopForHumanPrReview({ rerunGateResult: input.rerunGateResult, nextStage })) {
                loopState = writeLoopStateTraceSummary({
                    loopState,
                    stopReason: 'await human review',
                    journeyContractHints,
                    executorRouting: resolveExecutorRouting({
                        journeyContractHints,
                        rerunDecision: input.rerunDecision,
                    }),
                });
                loopState.status = 'stopped';
                loopState.lastStopReason = 'await human review';
                loopState.updatedAt = nowIso();
                writeGovernanceAttemptLoopState(input.projectRoot, loopState);
                return stopResult({
                    loopState,
                    stopReason: 'await human review',
                    runtimeContext,
                    runtimeRegistry,
                    runtimePolicy,
                    rerunGateResultIngested,
                    modelHintsCandidate,
                    executionIntentCandidate,
                    executionPlanDecision,
                    journeyContractHints,
                });
            }
            loopState.status = 'idle';
            loopState.lastStopReason = null;
            loopState.updatedAt = nowIso();
        }
        if (loopState.attemptCount >= loopState.maxAttempts) {
            loopState = writeLoopStateTraceSummary({
                loopState,
                stopReason: `max attempts reached (${loopState.maxAttempts})`,
                journeyContractHints,
                executorRouting: resolveExecutorRouting({
                    journeyContractHints,
                    rerunDecision: input.rerunDecision,
                }),
            });
            loopState.status = 'stopped';
            loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
            loopState.updatedAt = nowIso();
            writeGovernanceAttemptLoopState(input.projectRoot, loopState);
            return stopResult({
                loopState,
                stopReason: loopState.lastStopReason,
                runtimeContext,
                runtimeRegistry,
                runtimePolicy,
                rerunGateResultIngested,
                modelHintsCandidate,
                executionIntentCandidate,
                executionPlanDecision,
                journeyContractHints,
            });
        }
        if (loopState.noProgressRepeatCount >= loopState.maxNoProgressRepeats) {
            loopState = writeLoopStateTraceSummary({
                loopState,
                stopReason: `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`,
                journeyContractHints,
                executorRouting: resolveExecutorRouting({
                    journeyContractHints,
                    rerunDecision: input.rerunDecision,
                }),
            });
            loopState.status = 'stopped';
            loopState.lastStopReason = `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`;
            loopState.updatedAt = nowIso();
            writeGovernanceAttemptLoopState(input.projectRoot, loopState);
            return stopResult({
                loopState,
                stopReason: loopState.lastStopReason,
                runtimeContext,
                runtimeRegistry,
                runtimePolicy,
                rerunGateResultIngested,
                modelHintsCandidate,
                executionIntentCandidate,
                executionPlanDecision,
                journeyContractHints,
            });
        }
    }
    const stage = activeRerunStage(loopState);
    const currentAttemptNumber = loopState.attemptCount + 1;
    if (currentAttemptNumber > loopState.maxAttempts) {
        loopState = writeLoopStateTraceSummary({
            loopState,
            stopReason: `max attempts reached (${loopState.maxAttempts})`,
            journeyContractHints,
            executorRouting: resolveExecutorRouting({
                journeyContractHints,
                rerunDecision: input.rerunDecision,
            }),
        });
        loopState.status = 'stopped';
        loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
        loopState.updatedAt = nowIso();
        writeGovernanceAttemptLoopState(input.projectRoot, loopState);
        return stopResult({
            loopState,
            stopReason: loopState.lastStopReason,
            runtimeContext,
            runtimeRegistry,
            runtimePolicy,
            rerunGateResultIngested,
            modelHintsCandidate,
            executionIntentCandidate,
            executionPlanDecision,
            journeyContractHints,
        });
    }
    const absoluteOutputPath = resolveAbsolutePath(input.projectRoot, input.outputPath);
    const sharedArtifactsUpdated = unique([
        ...(input.sharedArtifactsUpdated ?? []),
        ...(input.rerunGateResult?.updatedArtifacts ?? []),
    ]);
    const executorRouting = resolveExecutorRouting({
        journeyContractHints,
        rerunDecision: input.rerunDecision,
    });
    const artifactResult = (0, governance_remediation_artifact_1.writeGovernanceRemediationArtifact)({
        ...input,
        outputPath: absoluteOutputPath,
        modelHintsCandidate,
        journeyContractHints,
        sourceGateFailureIds: stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0
            ? stage.sourceGateFailureIds
            : input.sourceGateFailureIds,
        capabilitySlot: stage.capabilitySlot,
        canonicalAgent: stage.canonicalAgent,
        actualExecutor: stage.actualExecutor ?? input.actualExecutor,
        adapterPath: stage.adapterPath ?? input.adapterPath,
        targetArtifacts: stage.targetArtifacts,
        availableSkills: resolvedSkillInventory.availableSkills,
        skillPaths: resolvedSkillInventory.skillPaths,
        skillInventory: resolvedSkillInventory.skillInventory,
        expectedDelta: stage.expectedDelta || input.expectedDelta,
        rerunOwner: stage.rerunOwner ?? input.rerunOwner,
        rerunGate: stage.rerunGate,
        outcome: stage.outcome ?? input.outcome,
        sharedArtifactsUpdated,
        contradictionsDelta: input.contradictionsDelta ?? input.rerunGateResult?.contradictionsDelta,
        externalProofAdded: input.externalProofAdded ?? input.rerunGateResult?.externalProofAdded,
        readyToRerunGate: input.readyToRerunGate ?? false,
        stopReason: input.stopReason,
        executorRouting,
    });
    loopState.attemptCount = currentAttemptNumber;
    loopState.status = 'awaiting_rerun';
    loopState.lastStopReason = null;
    loopState.updatedAt = nowIso();
    loopState.attempts.push({
        attemptNumber: currentAttemptNumber,
        attemptId: input.attemptId,
        outputPath: absoluteOutputPath,
        outcome: stage.outcome ?? input.outcome,
        createdAt: loopState.updatedAt,
        sourceGateFailureIds: stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0
            ? stage.sourceGateFailureIds
            : input.sourceGateFailureIds,
    });
    loopState = writeLoopStateTraceSummary({
        loopState,
        stopReason: input.stopReason ?? null,
        journeyContractHints,
        executorRouting,
        attachToLatestAttempt: true,
    });
    writeGovernanceAttemptLoopState(input.projectRoot, loopState);
    const provisionalExecutorPacket = buildExecutorPacket({
        hostKind: input.hostKind,
        runtimeContext,
        runtimePolicy,
        loopState,
        currentAttemptNumber,
        rerunGate: stage.rerunGate,
        artifactMarkdown: artifactResult.markdown,
        journeyContractHints: artifactResult.journeyContractHints,
        rerunDecision: input.rerunDecision,
        executorRouting,
        rerunStage: stage,
    });
    const artifactWithRunnerSummary = {
        ...artifactResult,
        markdown: appendRunnerSummaryToArtifactMarkdown(artifactResult.markdown, buildGovernanceRemediationRunnerSummaryLines({
            artifactPath: absoluteOutputPath,
            artifactResult,
            executionIntentCandidate,
            executionPlanDecision,
            journeyContractHints: artifactResult.journeyContractHints,
            runtimeContext,
            runtimeRegistry,
            runtimePolicy,
            modelHintsCandidate,
            loopState,
            currentAttemptNumber,
            nextAttemptNumber: currentAttemptNumber + 1,
            shouldContinue: true,
            stopReason: null,
            rerunGateResultIngested,
            executorPacket: provisionalExecutorPacket,
            packetPaths: {},
        })),
    };
    fs.writeFileSync(absoluteOutputPath, artifactWithRunnerSummary.markdown, 'utf8');
    const executorPacket = buildExecutorPacket({
        hostKind: input.hostKind,
        runtimeContext,
        runtimePolicy,
        loopState,
        currentAttemptNumber,
        rerunGate: stage.rerunGate,
        artifactMarkdown: artifactWithRunnerSummary.markdown,
        journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
        rerunDecision: input.rerunDecision,
        executorRouting,
        rerunStage: stage,
    });
    return {
        artifactPath: absoluteOutputPath,
        artifactResult: artifactWithRunnerSummary,
        executionIntentCandidate: artifactWithRunnerSummary.executionIntentCandidate ?? executionIntentCandidate,
        executionPlanDecision: artifactWithRunnerSummary.executionPlanDecision ?? executionPlanDecision,
        journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        modelHintsCandidate,
        loopState,
        currentAttemptNumber,
        nextAttemptNumber: currentAttemptNumber + 1,
        shouldContinue: true,
        stopReason: null,
        rerunGateResultIngested,
        executorPacket,
        packetPaths: {},
    };
}
function parseBooleanFlag(value, flagName) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    throw new Error(`Invalid ${flagName}: expected true|false`);
}
function parseList(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function argValue(args, flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
}
function buildGovernanceRemediationRunnerSummaryLines(result) {
    const reviewerProjection = result.executionPlanDecision?.reviewerRouteExplainability?.[0] ??
        result.executionIntentCandidate?.reviewerRouteExplainability?.[0] ??
        (result.runtimeContext
            ? (() => {
                const contract = (0, reviewer_registry_1.buildReviewerContractProjection)({
                    auditEntryStage: (0, reviewer_registry_1.mapFlowStageToReviewerAuditEntryStage)(result.runtimeContext?.flow, result.runtimeContext?.stage),
                });
                return contract.activeAuditConsumer
                    ? {
                        requestedSkillId: 'code-reviewer',
                        reviewerIdentity: contract.reviewerIdentity,
                        registryVersion: contract.registryVersion,
                        closeoutRunner: contract.closeoutRunner,
                        activeAuditConsumer: contract.activeAuditConsumer,
                    }
                    : null;
            })()
            : null);
    const lines = [
        '## Governance Remediation Runner Summary',
        `- Loop State ID: ${result.loopState.loopStateId}`,
        `- Current Attempt Number: ${result.currentAttemptNumber ?? '(none)'}`,
        `- Next Attempt Number: ${result.nextAttemptNumber ?? '(none)'}`,
        `- Should Continue: ${result.shouldContinue ? 'yes' : 'no'}`,
        `- Stop Reason: ${result.stopReason ?? '(none)'}`,
        `- Artifact Path: ${result.artifactPath ?? '(none)'}`,
        `- Executor Packet: ${result.executorPacket ? 'yes' : 'no'}`,
        `- Reviewer Projection: ${reviewerProjection
            ? `${reviewerProjection.requestedSkillId} => ${reviewerProjection.reviewerIdentity} [registry=${reviewerProjection.registryVersion}; closeout=${reviewerProjection.closeoutRunner}; active=${reviewerProjection.activeAuditConsumer?.entryStage ?? '(none)'}/${reviewerProjection.activeAuditConsumer?.profile ?? '(none)'}]`
            : '(none)'}`,
        '',
        '## Loop State Trace Summary',
        ...(result.loopState.remediationAuditTraceSummaryLines.length > 0
            ? result.loopState.remediationAuditTraceSummaryLines.map((line) => `- ${line}`)
            : ['- (none)']),
    ];
    const packetPaths = result.packetPaths
        ? Object.entries(result.packetPaths).filter((entry) => Boolean(entry[1]))
        : [];
    if (packetPaths.length > 0) {
        lines.push('');
        lines.push('## Packet Paths');
        for (const [hostKind, packetPath] of packetPaths) {
            lines.push(`- ${hostKind}: ${packetPath}`);
        }
    }
    return lines;
}
function renderGovernanceRemediationRunnerSummary(result) {
    return renderGovernanceRunnerSummaryLines(buildGovernanceRemediationRunnerSummaryLines(result));
}
async function main() {
    const argvTokens = process.argv.map((value) => path.basename(String(value)).toLowerCase());
    const isDirectRunnerCli = argvTokens.some((value) => value.includes('governance-remediation-runner'));
    if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
        return;
    }
    if (require.main !== module || !isDirectRunnerCli) {
        return;
    }
    const args = process.argv.slice(2);
    const jsonInputPath = argValue(args, '--jsonInputPath');
    if (jsonInputPath) {
        const payload = JSON.parse(fs.readFileSync(path.resolve(jsonInputPath), 'utf8'));
        const result = await runGovernanceRemediation(payload);
        process.stdout.write(JSON.stringify(result));
        return;
    }
    const outputPath = argValue(args, '--outputPath');
    if (!outputPath) {
        throw new Error('Usage: npx ts-node --transpile-only scripts/governance-remediation-runner.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--projectRoot <path>] [--configPath <path>] [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]');
    }
    const projectRoot = argValue(args, '--projectRoot')
        ? path.resolve(argValue(args, '--projectRoot'))
        : process.cwd();
    const config = (0, governance_remediation_config_1.readGovernanceRemediationConfig)(projectRoot, argValue(args, '--configPath'));
    const providerAdapter = (0, governance_remediation_config_1.createGovernanceProviderAdapterFromConfig)(config);
    const result = await runGovernanceRemediation({
        projectRoot,
        outputPath,
        promptText: argValue(args, '--promptText'),
        stageContextKnown: parseBooleanFlag(argValue(args, '--stageContextKnown'), '--stageContextKnown'),
        gateFailureExists: parseBooleanFlag(argValue(args, '--gateFailureExists'), '--gateFailureExists'),
        blockerOwnershipLocked: parseBooleanFlag(argValue(args, '--blockerOwnershipLocked'), '--blockerOwnershipLocked'),
        rootTargetLocked: parseBooleanFlag(argValue(args, '--rootTargetLocked'), '--rootTargetLocked'),
        equivalentAdapterCount: Number(argValue(args, '--equivalentAdapterCount') ?? '0'),
        attemptId: argValue(args, '--attemptId') ?? 'attempt-unknown',
        sourceGateFailureIds: parseList(argValue(args, '--sourceGateFailureIds')),
        capabilitySlot: argValue(args, '--capabilitySlot') ?? 'unknown-slot',
        canonicalAgent: argValue(args, '--canonicalAgent') ?? 'unknown-agent',
        actualExecutor: argValue(args, '--actualExecutor') ?? 'unknown-executor',
        adapterPath: argValue(args, '--adapterPath') ?? 'unknown-adapter',
        targetArtifacts: parseList(argValue(args, '--targetArtifacts')),
        expectedDelta: argValue(args, '--expectedDelta') ?? 'n/a',
        rerunOwner: argValue(args, '--rerunOwner') ?? 'PM',
        rerunGate: argValue(args, '--rerunGate') ?? 'n/a',
        outcome: argValue(args, '--outcome') ?? 'n/a',
        sharedArtifactsUpdated: parseList(argValue(args, '--sharedArtifactsUpdated')),
        contradictionsDelta: argValue(args, '--contradictionsDelta'),
        externalProofAdded: argValue(args, '--externalProofAdded'),
        readyToRerunGate: argValue(args, '--readyToRerunGate')
            ? parseBooleanFlag(argValue(args, '--readyToRerunGate'), '--readyToRerunGate')
            : undefined,
        stopReason: argValue(args, '--stopReason'),
        hostKind: config.primaryHost,
        providerAdapter,
        maxAttempts: argValue(args, '--maxAttempts')
            ? Number(argValue(args, '--maxAttempts'))
            : undefined,
        maxNoProgressRepeats: argValue(args, '--maxNoProgressRepeats')
            ? Number(argValue(args, '--maxNoProgressRepeats'))
            : undefined,
        loopStateId: argValue(args, '--loopStateId'),
    });
    if (!result.executorPacket || !result.artifactPath || !result.artifactResult) {
        console.log(renderGovernanceRemediationRunnerSummary(result));
        return;
    }
    const packetPaths = {};
    for (const hostKind of config.packetHosts) {
        const packet = createGovernanceExecutorPacket({
            hostKind,
            runtimeContext: result.runtimeContext,
            runtimePolicy: result.runtimePolicy,
            loopState: result.loopState,
            currentAttemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
            rerunGate: result.loopState.rerunGate,
            artifactMarkdown: result.artifactResult.markdown,
            journeyContractHints: result.artifactResult.journeyContractHints,
            rerunDecision: {
                mode: result.executorPacket.routingMode,
                signals: result.executorPacket.prioritizedSignals,
                reason: result.executorPacket.routingReason,
            },
            executorRouting: {
                routingMode: result.executorPacket.routingMode,
                executorRoute: result.executorPacket.executorRoute,
                prioritizedSignals: result.executorPacket.prioritizedSignals,
                packetStrategy: result.executorPacket.packetStrategy,
                reason: result.executorPacket.routingReason,
            },
        });
        packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
    }
    result.packetPaths = packetPaths;
    console.log(renderGovernanceRemediationRunnerSummary(result));
}
void main();
