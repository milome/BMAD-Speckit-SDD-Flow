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
exports.resolveBmadHelpRoutingState = resolveBmadHelpRoutingState;
exports.resolveBmadHelpRuntimePolicy = resolveBmadHelpRuntimePolicy;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const context_1 = require("../packages/runtime-context/src/context");
const governance_packet_execution_store_1 = require("./governance-packet-execution-store");
const runtime_governance_1 = require("./runtime-governance");
const runtime_context_registry_1 = require("./runtime-context-registry");
const reviewer_registry_1 = require("./reviewer-registry");
const main_agent_orchestration_1 = require("./main-agent-orchestration");
const bmad_help_five_layer_progress_marker_1 = require("./bmad-help-five-layer-progress-marker");
const resolve_active_requirement_1 = require("./resolve-active-requirement");
const READINESS_REPORT_PATTERN = /^implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i;
const IMPLEMENTATION_GATE_NAME = 'implementation-readiness';
const ACTIVE_REMEDIATION_STATUSES = new Set([
    'pending_dispatch',
    'leased',
    'running',
    'awaiting_rerun_gate',
    'retry_pending',
]);
const READY_STATUSES = new Set(['READY']);
const BLOCKED_STATUSES = new Set(['NEEDS WORK', 'NOT READY']);
function outputRootForLayer(layerId) {
    switch (layerId) {
        case 'layer_1':
            return '_bmad-output/runtime/context';
        case 'layer_2':
            return 'docs/architecture';
        case 'layer_3':
            return 'docs/stories';
        case 'layer_4':
            return 'specs';
        case 'layer_5':
            return '_bmad-output/runtime/gates';
    }
}
function normalizeLayerStage(stage) {
    if (stage === 'story')
        return 'story_create';
    if (stage === 'post_impl')
        return 'post_audit';
    return stage;
}
function stageEvidenceNames(stage) {
    const normalized = String(stage).toLowerCase();
    const dashed = normalized.replace(/_/g, '-');
    const names = new Set([
        `${normalized}.json`,
        `${normalized}.md`,
        `${dashed}.json`,
        `${dashed}.md`,
    ]);
    if (stage === 'arch') {
        for (const item of ['architecture.md', 'architecture.json', 'arch.md', 'arch.json'])
            names.add(item);
    }
    if (stage === 'epics') {
        names.add('epics.md');
        names.add('epics.json');
    }
    if (stage === 'story_create') {
        names.add('story-create.md');
        names.add('story-create.json');
    }
    if (stage === 'post_audit') {
        names.add('post-audit.md');
        names.add('post-audit.json');
    }
    return names;
}
function gateReportPassed(filePath, predicate) {
    if (!fs.existsSync(filePath))
        return false;
    try {
        return predicate(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    }
    catch {
        return false;
    }
}
function loadFiveLayerDefinitions(projectRoot) {
    const mappingPath = path.join(projectRoot, '_bmad', '_config', 'stage-mapping.yaml');
    const parsed = yaml.load(fs.readFileSync(mappingPath, 'utf8'));
    const raw = parsed.layer_to_stages ?? {};
    return ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'].map((id) => {
        const stages = id === 'layer_5' && raw[id]?.closeout_stages ? raw[id].closeout_stages : raw[id]?.stages;
        return {
            id,
            stages: Array.from(new Set((stages ?? []).map(normalizeLayerStage))),
        };
    });
}
function hasFiveLayerEvidence(projectRoot, layerId, stage) {
    const root = path.join(projectRoot, outputRootForLayer(layerId));
    if (!fs.existsSync(root))
        return false;
    if (stage === 'release_gate') {
        return gateReportPassed(path.join(root, 'main-agent-release-gate-report.json'), (value) => value.critical_failures === 0 && value.blocked_sprint_status_update === false);
    }
    if (stage === 'delivery_truth_gate') {
        return gateReportPassed(path.join(root, 'main-agent-delivery-truth-gate-report.json'), (value) => value.completionAllowed === true);
    }
    const explicitPath = path.join(root, `${layerId}-${stage}.complete.json`);
    if (layerId === 'layer_1' && stage === 'prd') {
        return (0, bmad_help_five_layer_progress_marker_1.validateLayer1PrdCompletionMarker)({
            projectRoot,
            markerPath: explicitPath,
        });
    }
    if (fs.existsSync(explicitPath))
        return true;
    const names = stageEvidenceNames(stage);
    return fs
        .readdirSync(root, { withFileTypes: true })
        .some((entry) => names.has(entry.name.toLowerCase()));
}
function resolveFiveLayerRoutingProgress(projectRoot) {
    if (!projectRoot)
        return null;
    try {
        const root = path.resolve(projectRoot);
        const layers = loadFiveLayerDefinitions(root);
        const statuses = layers.flatMap((layer) => layer.stages.map((stage) => ({
            layer: layer.id,
            stage,
            completed: hasFiveLayerEvidence(root, layer.id, stage),
        })));
        const firstIncomplete = statuses.find((item) => !item.completed) ?? statuses.at(-1);
        if (!firstIncomplete)
            return null;
        const completedLayers = layers
            .filter((layer) => layer.stages.length > 0 &&
            layer.stages.every((stage) => statuses.some((item) => item.layer === layer.id && item.stage === stage && item.completed)))
            .map((layer) => layer.id);
        return {
            currentLayer: firstIncomplete.layer,
            currentStage: firstIncomplete.stage,
            nextRequiredLayer: firstIncomplete.layer,
            completedLayers,
        };
    }
    catch {
        return null;
    }
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function dateSortValue(filePath) {
    const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
        const time = Date.parse(`${match[1]}T00:00:00Z`);
        if (!Number.isNaN(time)) {
            return time;
        }
    }
    try {
        return fs.statSync(filePath).mtimeMs;
    }
    catch {
        return 0;
    }
}
function listReadinessReports(projectRoot) {
    if (!projectRoot) {
        return [];
    }
    const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
    if (!fs.existsSync(planningRoot)) {
        return [];
    }
    const found = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (READINESS_REPORT_PATTERN.test(entry.name)) {
                found.push(fullPath);
            }
        }
    };
    walk(planningRoot);
    return found.sort((left, right) => dateSortValue(right) - dateSortValue(left));
}
function pathSegments(value) {
    return value
        .split(/[\\/]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);
}
function sharedPathScore(left, right) {
    const leftSegments = pathSegments(path.normalize(left).toLowerCase());
    const rightSegments = pathSegments(path.normalize(right).toLowerCase());
    let score = 0;
    let leftIndex = leftSegments.length - 1;
    let rightIndex = rightSegments.length - 1;
    while (leftIndex >= 0 && rightIndex >= 0) {
        if (leftSegments[leftIndex] !== rightSegments[rightIndex]) {
            break;
        }
        score += 1;
        leftIndex -= 1;
        rightIndex -= 1;
    }
    return score;
}
function selectBestScopedPath(candidates, hints) {
    if (candidates.length === 0) {
        return null;
    }
    const normalizedHints = hints
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .map((value) => path.normalize(value));
    const scored = candidates.map((candidate) => {
        const candidatePath = path.normalize(candidate);
        const candidateLower = candidatePath.toLowerCase();
        let score = 0;
        for (const hint of normalizedHints) {
            const hintLower = hint.toLowerCase();
            if (!hintLower) {
                continue;
            }
            if (candidateLower.includes(hintLower)) {
                score += 1000;
            }
            score += sharedPathScore(candidatePath, hint) * 10;
        }
        return { candidate, score, sortValue: dateSortValue(candidate) };
    });
    scored.sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return right.sortValue - left.sortValue;
    });
    return scored[0]?.candidate ?? null;
}
function readMarkdownSection(markdown, heading) {
    const pattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, 'im');
    const match = markdown.match(pattern);
    return match?.[1]?.trim() ?? '';
}
function parseOverallReadinessStatus(markdown) {
    const match = markdown.match(/^###\s+Overall Readiness Status\s*$\s*^(READY|NEEDS WORK|NOT READY)$/im);
    return match?.[1] ?? null;
}
function parseBlockerCount(markdown) {
    const metricMatch = markdown.match(/^- Blocker count:\s*(\d+)\s*$/im);
    if (metricMatch) {
        return Number(metricMatch[1]);
    }
    const section = readMarkdownSection(markdown, 'Blockers Requiring Immediate Action');
    const lines = section
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- ') && !/^- none$/i.test(line));
    return lines.length;
}
function readLatestReadinessReport(projectRoot) {
    const reportPath = listReadinessReports(projectRoot)[0];
    if (!reportPath) {
        return null;
    }
    const markdown = fs.readFileSync(reportPath, 'utf8');
    return {
        reportPath,
        overallStatus: parseOverallReadinessStatus(markdown),
        blockerCount: parseBlockerCount(markdown),
    };
}
function resolveScopedReadinessReport(projectRoot, runtimeContext) {
    const reports = listReadinessReports(projectRoot);
    if (reports.length === 0) {
        return null;
    }
    const scopedReportPath = selectBestScopedPath(reports, [
        runtimeContext?.artifactRoot,
        runtimeContext?.artifactPath,
        runtimeContext?.runId,
        runtimeContext?.storyId,
        runtimeContext?.epicId,
    ]);
    if (!scopedReportPath) {
        return readLatestReadinessReport(projectRoot);
    }
    const markdown = fs.readFileSync(scopedReportPath, 'utf8');
    return {
        reportPath: scopedReportPath,
        overallStatus: parseOverallReadinessStatus(markdown),
        blockerCount: parseBlockerCount(markdown),
    };
}
function remediationPathFromReport(reportPath) {
    if (!reportPath) {
        return null;
    }
    const remediationPath = reportPath.replace(/implementation-readiness-report-/i, 'implementation-readiness-remediation-');
    return fs.existsSync(remediationPath) ? remediationPath : null;
}
function selectExecutionRecord(projectRoot, remediationArtifactPath, runtimeContext) {
    if (!projectRoot) {
        return null;
    }
    const records = (0, governance_packet_execution_store_1.listGovernancePacketExecutionRecords)(projectRoot)
        .filter((record) => record.rerunGate === IMPLEMENTATION_GATE_NAME)
        .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || '') -
        Date.parse(left.updatedAt || left.createdAt || ''));
    if (remediationArtifactPath) {
        const matched = records.find((record) => normalizeText(record.artifactPath) === normalizeText(remediationArtifactPath));
        if (matched) {
            return matched;
        }
    }
    const hintedRecords = records.filter((record) => {
        if (runtimeContext?.runId && record.loopStateId.includes(runtimeContext.runId)) {
            return true;
        }
        if (runtimeContext?.storyId &&
            normalizeText(record.artifactPath)
                .toLowerCase()
                .includes(runtimeContext.storyId.toLowerCase())) {
            return true;
        }
        if (runtimeContext?.artifactRoot &&
            record.artifactPath &&
            sharedPathScore(record.artifactPath, runtimeContext.artifactRoot) > 0) {
            return true;
        }
        return false;
    });
    return hintedRecords[0] ?? null;
}
function resolveAuditFactSummary(input) {
    const requiresImplementationEntryAudit = input.stage === 'implement' || input.stage === 'post_audit';
    if (!requiresImplementationEntryAudit) {
        return {
            artifactDocPath: null,
            reportPath: null,
            stage: null,
            auditPassed: null,
            closeoutApproved: null,
        };
    }
    if (!input.projectRoot) {
        return {
            artifactDocPath: null,
            reportPath: null,
            stage: null,
            auditPassed: false,
            closeoutApproved: false,
        };
    }
    (0, runtime_context_registry_1.syncAuditIndexFromAllReports)(input.projectRoot);
    const registry = (0, runtime_context_registry_1.readRegistryOrDefault)(input.projectRoot);
    if (input.flow === 'story') {
        const closeout = registry.latestReviewerCloseout;
        const candidateArtifactPath = normalizeText(closeout?.artifactPath);
        const scopedHints = [
            input.runtimeContext?.artifactRoot,
            input.runtimeContext?.artifactPath,
            input.runtimeContext?.storyId,
            input.runtimeContext?.runId,
            input.runtimeContext?.epicId,
        ]
            .map((value) => normalizeText(value))
            .filter(Boolean);
        const candidateMatchesScope = scopedHints.length === 0 ||
            scopedHints.some((hint) => candidateArtifactPath.toLowerCase().includes(hint.toLowerCase()));
        if (closeout && closeout.stage === 'story' && candidateMatchesScope) {
            return {
                artifactDocPath: closeout.artifactPath ?? null,
                reportPath: closeout.reportPath ?? null,
                stage: 'story',
                auditPassed: closeout.auditStatus === 'PASS' && closeout.closeoutApproved === true,
                closeoutApproved: closeout.closeoutApproved === true,
            };
        }
        return {
            artifactDocPath: null,
            reportPath: null,
            stage: 'story',
            auditPassed: false,
            closeoutApproved: false,
        };
    }
    if (input.flow !== 'bugfix' && input.flow !== 'standalone_tasks') {
        return {
            artifactDocPath: null,
            reportPath: null,
            stage: null,
            auditPassed: null,
            closeoutApproved: null,
        };
    }
    const currentArtifactPath = selectBestScopedPath(Object.keys(registry.auditIndex[input.flow]), [
        input.runtimeContext?.artifactPath,
        input.runtimeContext?.artifactRoot,
        input.runtimeContext?.storyId,
        input.runtimeContext?.runId,
    ]);
    if (!currentArtifactPath) {
        return {
            artifactDocPath: null,
            reportPath: null,
            stage: null,
            auditPassed: false,
            closeoutApproved: false,
        };
    }
    const entry = registry.auditIndex[input.flow][path.normalize(currentArtifactPath)];
    const expectedStage = input.flow;
    const closeoutApproved = entry?.closeoutApproved === true && entry?.stage === expectedStage;
    return {
        artifactDocPath: entry?.artifactDocPath ?? null,
        reportPath: entry?.reportPath ?? null,
        stage: entry?.stage ?? null,
        auditPassed: entry?.status === 'PASS' && closeoutApproved,
        closeoutApproved,
    };
}
function resolveContinueStateSummary(input) {
    const contextCloseout = input.runtimeContext?.latestReviewerCloseout;
    const contextCloseoutWithCompat = contextCloseout;
    const contextCanContinue = typeof contextCloseoutWithCompat?.canMainAgentContinue === 'boolean'
        ? contextCloseoutWithCompat.canMainAgentContinue
        : typeof contextCloseoutWithCompat?.mainAgentCanContinue === 'boolean'
            ? contextCloseoutWithCompat.mainAgentCanContinue
            : null;
    if (contextCloseout && contextCanContinue !== null) {
        return {
            mainAgentCanContinue: contextCanContinue,
            source: 'runtimeContext',
            continueDecision: contextCanContinue
                ? 'continue'
                : contextCloseout.closeoutEnvelope?.rerunDecision &&
                    contextCloseout.closeoutEnvelope.rerunDecision !== 'none'
                    ? 'rerun'
                    : 'blocked',
        };
    }
    if (!input.projectRoot) {
        return { mainAgentCanContinue: null, source: 'none', continueDecision: null };
    }
    const registry = (0, runtime_context_registry_1.readRegistryOrDefault)(input.projectRoot);
    if (registry.latestReviewerCloseout &&
        typeof registry.latestReviewerCloseout.canMainAgentContinue === 'boolean') {
        return {
            mainAgentCanContinue: registry.latestReviewerCloseout.canMainAgentContinue,
            source: 'registry',
            continueDecision: registry.latestReviewerCloseout.canMainAgentContinue
                ? 'continue'
                : registry.latestReviewerCloseout.closeoutEnvelope?.rerunDecision &&
                    registry.latestReviewerCloseout.closeoutEnvelope.rerunDecision !== 'none'
                    ? 'rerun'
                    : 'blocked',
        };
    }
    return { mainAgentCanContinue: null, source: 'none', continueDecision: null };
}
function deriveMainAgentNextAction(input) {
    if (input.implementationEntryDecision === 'reroute') {
        return { nextAction: 'await_user', ready: false };
    }
    if (input.implementationEntryDecision === 'block') {
        return { nextAction: 'dispatch_remediation', ready: true };
    }
    if (input.continueDecision === 'rerun') {
        return { nextAction: 'dispatch_remediation', ready: true };
    }
    if (input.continueDecision === 'blocked') {
        return { nextAction: 'await_user', ready: false };
    }
    if (input.continueDecision === 'continue') {
        if (input.stage === 'post_audit') {
            return { nextAction: 'run_closeout', ready: true };
        }
        return { nextAction: 'dispatch_implement', ready: true };
    }
    if (input.stage === 'post_audit') {
        return { nextAction: 'run_closeout', ready: true };
    }
    return { nextAction: 'dispatch_implement', ready: true };
}
function inferReadinessEvidence(input) {
    const fromArtifacts = {
        readinessReportPresent: input.report !== null,
        blockerCount: input.report?.blockerCount,
        remediationState: input.executionRecord?.status === 'gate_passed'
            ? 'closed'
            : input.executionRecord && ACTIVE_REMEDIATION_STATUSES.has(input.executionRecord.status)
                ? 'in_progress'
                : input.remediationArtifactPath
                    ? 'in_progress'
                    : 'none',
        rerunGateStatus: input.executionRecord?.lastRerunGateResult?.status === 'pass'
            ? 'pass'
            : input.executionRecord?.lastRerunGateResult?.status === 'fail'
                ? 'fail'
                : 'unknown',
    };
    if (input.report?.overallStatus) {
        if (READY_STATUSES.has(input.report.overallStatus)) {
            fromArtifacts.blockerCount = 0;
        }
        else if (BLOCKED_STATUSES.has(input.report.overallStatus) &&
            fromArtifacts.blockerCount === 0) {
            fromArtifacts.blockerCount = 1;
        }
    }
    if ((input.flow === 'story' || input.flow === 'bugfix' || input.flow === 'standalone_tasks') &&
        (input.stage === 'implement' || input.stage === 'post_audit') &&
        input.overrides?.documentAuditPassed === undefined) {
        fromArtifacts.documentAuditPassed = input.auditFact.auditPassed ?? false;
    }
    return {
        ...fromArtifacts,
        ...(input.overrides ?? {}),
    };
}
function mergeRuntimeContext(input) {
    if (input.runtimeContext) {
        return input.runtimeContext;
    }
    if (!input.projectRoot) {
        return null;
    }
    try {
        const resolved = (0, resolve_active_requirement_1.resolveActiveRequirement)({
            root: input.projectRoot,
            recordId: input.recordId,
            requirementSetId: input.requirementSetId,
            runId: input.runId,
        });
        return (0, resolve_active_requirement_1.resolvedRuntimeContextToRuntimeContext)(resolved);
    }
    catch {
        // Fall back to the legacy context reader only when no active requirement can be resolved.
    }
    try {
        return (0, context_1.readRuntimeContext)(input.projectRoot, input.runtimeContextPath);
    }
    catch {
        return null;
    }
}
function inferContextMaturityEvidence(input) {
    const runtimeContext = input.runtimeContext;
    const fromArtifacts = {
        artifactComplete: Boolean(input.report || runtimeContext?.artifactRoot || runtimeContext?.artifactPath),
        fourSignalsComplete: Boolean(runtimeContext?.flow &&
            runtimeContext?.stage &&
            runtimeContext?.sourceMode &&
            (runtimeContext?.storyId || runtimeContext?.runId || runtimeContext?.epicId)),
        executionSpecific: Boolean(runtimeContext?.storyId || runtimeContext?.runId || runtimeContext?.artifactRoot),
        governanceHealthy: (0, runtime_governance_1.implementationReadinessPassed)(input.implementationReadinessStatus),
        runtimeScopeComplete: Boolean(runtimeContext?.flow && runtimeContext?.stage && runtimeContext?.contextScope),
    };
    return {
        ...fromArtifacts,
        ...(input.overrides ?? {}),
    };
}
function inferComplexityFactors(input) {
    const fallback = {
        impactSurface: input.runtimeContext?.contextScope === 'project' ? 1 : 0,
        sharedContract: 0,
        verificationCost: input.basePolicy.validationLevel === 'full_validation'
            ? 2
            : input.basePolicy.validationLevel === 'test_only'
                ? 1
                : 0,
        uncertainty: input.contextMaturity === 'unclassified' || input.implementationReadinessStatus === 'missing'
            ? 2
            : input.implementationReadinessStatus === 'blocked' || input.contextMaturity === 'minimal'
                ? 1
                : 0,
        rollbackDifficulty: input.stage === 'implement' || input.stage === 'post_audit'
            ? 1
            : input.flow === 'story'
                ? 1
                : 0,
        forcedReasons: [],
    };
    return {
        ...fallback,
        ...(input.overrides ?? {}),
        forcedReasons: [...(input.overrides?.forcedReasons ?? fallback.forcedReasons ?? [])],
    };
}
function toImplementationEntryFlowId(flow) {
    return flow === 'story' || flow === 'bugfix' || flow === 'standalone_tasks' ? flow : null;
}
function resolveRequirementRecordImplementationEntryGate(runtimeContext) {
    const candidate = runtimeContext?.implementationEntryGate;
    const resolvedKind = runtimeContext
        ?.resolvedRuntimeContext?.kind;
    if (resolvedKind !== 'ResolvedRuntimeContext' || !candidate) {
        return null;
    }
    const evidence = candidate.evidenceSources;
    const hasEvidenceSource = Boolean(evidence?.readinessReportPath ||
        evidence?.remediationArtifactPath ||
        evidence?.executionRecordPath ||
        evidence?.authoritativeAuditReportPath);
    const emptyMissingGate = candidate.decision === 'block' &&
        candidate.readinessStatus === 'missing' &&
        candidate.blockerCodes.length === 1 &&
        candidate.blockerCodes[0] === 'missing_readiness_evidence' &&
        !hasEvidenceSource;
    return emptyMissingGate ? null : candidate;
}
function buildImplementationEntryBlockers(input) {
    const blockerCodes = [];
    const blockerSummary = [];
    if (input.auditFact.auditPassed === false) {
        switch (input.flow) {
            case 'story':
                blockerCodes.push('story_audit_not_closed');
                blockerSummary.push('Story Audit authoritative closeout is missing or has not passed');
                break;
            case 'bugfix':
                blockerCodes.push('bugfix_document_audit_not_closed');
                blockerSummary.push('BUGFIX document authoritative closeout is missing or has not passed');
                break;
            case 'standalone_tasks':
                blockerCodes.push('standalone_tasks_document_audit_not_closed');
                blockerSummary.push('TASKS/BUGFIX prerequisite audit authoritative closeout is missing or has not passed');
                break;
            default:
                break;
        }
    }
    if (input.readinessStatus === 'stale_after_semantic_change') {
        blockerCodes.push('stale_after_semantic_change');
        blockerSummary.push('implementation-entry 璇箟鍩虹宸插彉鍖栵紝蹇呴』閲嶆柊閫氳繃 readiness');
    }
    return { blockerCodes, blockerSummary };
}
function resolveBmadHelpRoutingState(input) {
    const basePolicy = input.basePolicy ??
        (0, runtime_governance_1.resolveRuntimePolicy)({
            flow: input.flow,
            stage: input.stage,
            config: input.config,
            epicId: input.epicId,
            storyId: input.storyId,
            storySlug: input.storySlug,
            runId: input.runId,
            artifactRoot: input.artifactRoot,
            contextSource: input.contextSource,
        });
    const runtimeContext = mergeRuntimeContext(input);
    const continueState = resolveContinueStateSummary({
        projectRoot: input.projectRoot,
        runtimeContext,
    });
    const sourceMode = input.sourceMode ?? runtimeContext?.sourceMode ?? null;
    const report = resolveScopedReadinessReport(input.projectRoot, runtimeContext);
    const remediationArtifactPath = remediationPathFromReport(report?.reportPath ?? null);
    const executionRecord = selectExecutionRecord(input.projectRoot, remediationArtifactPath, runtimeContext);
    const auditFact = resolveAuditFactSummary({
        projectRoot: input.projectRoot,
        flow: input.flow,
        stage: input.stage,
        runtimeContext,
    });
    const implementationEvidence = inferReadinessEvidence({
        flow: input.flow,
        stage: input.stage,
        report,
        remediationArtifactPath,
        executionRecord,
        auditFact,
        overrides: input.implementationReadinessEvidence,
    });
    const derivedImplementationReadinessStatus = (0, runtime_governance_1.deriveImplementationReadinessStatus)(input.flow, implementationEvidence);
    const requirementRecordImplementationEntryGate = resolveRequirementRecordImplementationEntryGate(runtimeContext);
    const implementationReadinessStatus = requirementRecordImplementationEntryGate?.readinessStatus ??
        derivedImplementationReadinessStatus;
    const contextEvidence = inferContextMaturityEvidence({
        runtimeContext,
        implementationReadinessStatus,
        report,
        overrides: input.contextMaturityEvidence,
    });
    const contextMaturity = (0, runtime_governance_1.deriveBmadHelpContextMaturity)(sourceMode ?? undefined, contextEvidence);
    const complexityFactors = inferComplexityFactors({
        flow: input.flow,
        stage: input.stage,
        basePolicy,
        runtimeContext,
        contextMaturity,
        implementationReadinessStatus,
        overrides: input.complexityFactors,
    });
    const complexity = (0, runtime_governance_1.deriveBmadHelpComplexity)(complexityFactors);
    const shouldUpgradeStandaloneTasks = (0, runtime_governance_1.shouldUpgradeStandaloneTasksToStory)(input.flow, complexity.level);
    const blockerState = buildImplementationEntryBlockers({
        flow: input.flow,
        readinessStatus: implementationReadinessStatus,
        auditFact,
    });
    const implementationEntryFlow = toImplementationEntryFlowId(input.flow);
    const implementationEntryEvidenceSources = {
        readinessReportPath: report?.reportPath ?? null,
        remediationArtifactPath,
        executionRecordPath: executionRecord && input.projectRoot
            ? path.join(input.projectRoot, '_bmad-output', 'runtime', 'governance', 'executions', executionRecord.loopStateId, `${String(executionRecord.attemptNumber).padStart(4, '0')}.json`)
            : null,
        authoritativeAuditReportPath: auditFact.reportPath ?? null,
    };
    const semanticFingerprint = normalizeText(runtimeContext?.artifactPath) || null;
    const derivedImplementationEntryGate = implementationEntryFlow != null
        ? (0, runtime_governance_1.resolveImplementationEntryGate)({
            requestedFlow: implementationEntryFlow,
            readinessStatus: implementationReadinessStatus,
            complexity: complexity.level,
            evidenceSources: implementationEntryEvidenceSources,
            semanticFingerprint,
            evaluatedAt: normalizeText(runtimeContext?.updatedAt) || undefined,
            blockerCodes: blockerState.blockerCodes,
            blockerSummary: blockerState.blockerSummary,
        })
        : {
            gateName: IMPLEMENTATION_GATE_NAME,
            requestedFlow: 'story',
            recommendedFlow: 'story',
            decision: 'block',
            readinessStatus: implementationReadinessStatus,
            blockerCodes: ['unsupported_implementation_entry_flow'],
            blockerSummary: [`flow=${input.flow} 褰撳墠涓嶆敮鎸?implementation-entry gate`],
            rerouteRequired: false,
            rerouteReason: null,
            evidenceSources: implementationEntryEvidenceSources,
            semanticFingerprint,
            evaluatedAt: new Date().toISOString(),
        };
    const implementationEntryGate = requirementRecordImplementationEntryGate ?? derivedImplementationEntryGate;
    const recommendedFlow = implementationEntryGate.recommendedFlow;
    const recommendationLabel = implementationEntryGate.decision === 'pass' ? 'recommended' : 'blocked';
    const mainAgentOrchestration = (0, main_agent_orchestration_1.resolveMainAgentOrchestrationSurface)({
        projectRoot: input.projectRoot,
        runtimeContext,
        runtimeContextPath: input.runtimeContextPath,
        flow: input.flow,
        stage: input.stage,
        implementationEntryGate,
    });
    const resumeProjection = 'runtimeResumeProjection' in mainAgentOrchestration
        ? mainAgentOrchestration.runtimeResumeProjection
        : undefined;
    const mainAgentAction = resumeProjection
        ? {
            nextAction: resumeProjection.runtimeNextAction,
            ready: resumeProjection.ready,
        }
        : deriveMainAgentNextAction({
            stage: input.stage,
            continueDecision: continueState.continueDecision,
            implementationEntryDecision: implementationEntryGate.decision,
        });
    const effectiveContinueState = continueState.source === 'runtimeContext'
        ? continueState
        : mainAgentOrchestration.continueDecision != null ||
            mainAgentOrchestration.mainAgentCanContinue != null
            ? {
                mainAgentCanContinue: mainAgentOrchestration.mainAgentCanContinue,
                source: mainAgentOrchestration.source === 'reviewer_closeout'
                    ? continueState.source
                    : mainAgentOrchestration.source === 'orchestration_state'
                        ? 'runtimeContext'
                        : continueState.source,
                continueDecision: mainAgentOrchestration.continueDecision,
            }
            : continueState;
    const fiveLayerProgress = resolveFiveLayerRoutingProgress(input.projectRoot);
    return {
        sourceMode,
        contextMaturity,
        complexity: complexity.level,
        complexityScore: complexity.score,
        complexityForcedReasons: complexity.forcedReasons,
        implementationReadinessStatus,
        implementationEntryRecommended: implementationEntryGate.decision === 'pass',
        implementationEntryDecision: implementationEntryGate.decision,
        shouldUpgradeStandaloneTasks,
        recommendedFlow,
        recommendationLabel,
        rerouteRequired: implementationEntryGate.rerouteRequired,
        rerouteReason: implementationEntryGate.rerouteReason,
        canonicalImplementationGate: IMPLEMENTATION_GATE_NAME,
        implementationEntryGate,
        evidence: {
            contextMaturity: contextEvidence,
            implementationReadiness: implementationEvidence,
            complexityFactors,
        },
        evidenceSources: implementationEntryEvidenceSources,
        executionRecordId: executionRecord?.executionId ?? null,
        mainAgentCanContinue: effectiveContinueState.mainAgentCanContinue,
        continueStateSource: effectiveContinueState.source,
        continueDecision: effectiveContinueState.continueDecision,
        mainAgentNextAction: mainAgentAction.nextAction,
        mainAgentReady: mainAgentAction.ready,
        mainAgentOrchestration,
        fiveLayerProgress,
    };
}
function resolveBmadHelpRuntimePolicy(input) {
    const basePolicy = (0, runtime_governance_1.resolveRuntimePolicy)(input);
    const helpRouting = resolveBmadHelpRoutingState({
        projectRoot: input.projectRoot,
        runtimeContext: input.runtimeContext,
        runtimeContextPath: input.runtimeContextPath,
        flow: input.flow,
        stage: input.stage,
        config: input.config,
        sourceMode: input.runtimeContext?.sourceMode ?? undefined,
        contextMaturityEvidence: input.contextMaturityEvidence,
        implementationReadinessEvidence: input.implementationReadinessEvidence,
        complexityFactors: input.complexityFactors,
        basePolicy,
        epicId: input.epicId,
        storyId: input.storyId,
        storySlug: input.storySlug,
        runId: input.runId,
        artifactRoot: input.artifactRoot,
        requirementSetId: input.requirementSetId,
        recordId: input.recordId,
        contextSource: input.contextSource,
    });
    return {
        ...basePolicy,
        contextMaturity: helpRouting.contextMaturity,
        complexity: helpRouting.complexity,
        implementationReadinessStatus: helpRouting.implementationReadinessStatus,
        implementationEntryRecommended: helpRouting.implementationEntryRecommended,
        implementationEntryDecision: helpRouting.implementationEntryDecision,
        implementationEntryGate: helpRouting.implementationEntryGate,
        helpRouting,
        reviewerContract: (0, reviewer_registry_1.buildReviewerContractProjection)({
            auditEntryStage: (0, reviewer_registry_1.mapFlowStageToReviewerAuditEntryStage)(input.flow, input.stage),
        }),
        mainAgentCanContinue: helpRouting.mainAgentCanContinue,
        continueStateSource: helpRouting.continueStateSource,
        continueDecision: helpRouting.continueDecision,
        mainAgentNextAction: helpRouting.mainAgentNextAction,
        mainAgentReady: helpRouting.mainAgentReady,
        mainAgentOrchestration: helpRouting.mainAgentOrchestration,
        fiveLayerProgress: helpRouting.fiveLayerProgress,
    };
}
