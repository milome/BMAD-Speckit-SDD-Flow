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
exports.runAdaptiveIntakeGovernanceGate = runAdaptiveIntakeGovernanceGate;
exports.mainAdaptiveIntakeGovernanceGate = mainAdaptiveIntakeGovernanceGate;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const user_story_mapping_1 = require("./user-story-mapping");
const orchestration_governance_contract_1 = require("./orchestration-governance-contract");
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizePath(value) {
    return value
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .toLowerCase();
}
function globToRegExp(pattern) {
    const escaped = normalizePath(pattern).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    const withStars = escaped.replace(/\*\*/g, '::DOUBLE_STAR::').replace(/\*/g, '[^/]*');
    return new RegExp(`^${withStars.replace(/::DOUBLE_STAR::/g, '.*')}$`, 'i');
}
function pathMatchesScope(filePath, scopes) {
    const normalized = normalizePath(filePath);
    return scopes.some((scope) => globToRegExp(scope).test(normalized));
}
function readSprintStatusSnapshot(projectRoot) {
    const file = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    if (!fs.existsSync(file)) {
        return { developmentStatus: {}, activeDemandCount: 0 };
    }
    const parsed = (yaml.load(fs.readFileSync(file, 'utf8')) ?? {});
    const developmentStatus = parsed.development_status ?? {};
    const activeDemandCount = Object.values(developmentStatus).filter((status) => status !== 'done' && status !== 'optional').length;
    return { developmentStatus, activeDemandCount };
}
function scoreRoute(candidate, route, sprint, requirementMappings, weights) {
    const storyMatch = candidate.storyId != null && candidate.storyId === route.storyId;
    const epicMatch = candidate.epicId != null && candidate.epicId === route.epicId;
    const exactRequirement = route.requirementId === candidate.requirementId;
    const dependencyHits = (candidate.changedPaths ?? []).filter((file) => pathMatchesScope(file, route.allowedWriteScope)).length;
    const dependencyFit = (candidate.changedPaths?.length ?? 0) === 0
        ? storyMatch || epicMatch
            ? 0.8
            : 0.5
        : dependencyHits / Math.max(1, candidate.changedPaths?.length ?? 1);
    const sprintStatus = sprint.developmentStatus[route.storyId] ?? sprint.developmentStatus[route.epicId];
    const domainFit = clamp01((storyMatch ? 0.6 : 0.25) + (epicMatch ? 0.25 : 0) + (exactRequirement ? 0.15 : 0));
    const sprintFit = clamp01((candidate.sprintId === route.sprintId ? 0.8 : 0) +
        (sprintStatus && sprintStatus !== 'done' ? 0.2 : sprintStatus === 'done' ? -0.2 : 0));
    const riskPenalty = candidate.readiness?.riskLevel === 'high'
        ? 0.35
        : candidate.readiness?.riskLevel === 'medium'
            ? 0.15
            : 0;
    const siblingConflict = requirementMappings.some((item) => item.storyId !== route.storyId && (item.status === 'planned' || item.status === 'in_progress'));
    const riskFit = clamp01((route.status === 'done' ? 0.35 : route.status === 'blocked' ? 0.45 : 0.9) -
        riskPenalty -
        (siblingConflict ? 0.15 : 0));
    const readinessFit = clamp01((candidate.readiness?.implementationReady === false ? 0.15 : 0.85) -
        (route.status === 'done' ? 0.25 : 0));
    const weightedTotal = domainFit * weights.domainFit +
        dependencyFit * weights.dependencyFit +
        sprintFit * weights.sprintFit +
        riskFit * weights.riskFit +
        readinessFit * weights.readinessFit;
    return {
        route: {
            requirementId: route.requirementId,
            epicId: route.epicId,
            storyId: route.storyId,
            flow: route.flow,
            sprintId: route.sprintId,
            allowedWriteScope: route.allowedWriteScope,
            status: route.status,
        },
        scoreBreakdown: {
            domainFit,
            dependencyFit,
            sprintFit,
            riskFit,
            readinessFit,
            impact: domainFit,
            dependency: dependencyFit,
            capacity: sprintFit,
            weightedTotal: Number(weightedTotal.toFixed(4)),
        },
        reasons: [
            storyMatch ? 'story hint matched' : 'story hint not matched',
            epicMatch ? 'epic hint matched' : 'epic hint not matched',
            exactRequirement ? 'existing requirement mapping reused' : 'new route candidate',
            dependencyHits > 0
                ? `changed paths matched ${dependencyHits} scoped entries`
                : 'no scoped path match',
            candidate.sprintId === route.sprintId
                ? 'candidate sprint aligned'
                : 'candidate sprint misaligned',
        ],
    };
}
function decideVerdict(candidate, topScore, requirementMappings, queueSyncPath, thresholds) {
    const mappingConsistency = [];
    const lifecycleConsistency = [];
    const sprintConsistency = [];
    if (requirementMappings.length > 1) {
        mappingConsistency.push('requirement_to_story_unique_active');
    }
    if (topScore && topScore.route.allowedWriteScope.length === 0) {
        mappingConsistency.push('allowed_write_scope_consistent');
    }
    if (topScore && topScore.route.flow !== candidate.flow) {
        mappingConsistency.push('flow_to_story_type_consistent');
    }
    if (topScore && topScore.route.status === 'done') {
        lifecycleConsistency.push('orchestration_state_aligned_with_mapping_status');
    }
    if (!candidate.sprintId || (topScore && candidate.sprintId !== topScore.route.sprintId)) {
        sprintConsistency.push('sprint_id_valid');
    }
    if (queueSyncPath === '') {
        sprintConsistency.push('backlog_sync_record_present');
    }
    const hasFailure = mappingConsistency.length > 0 ||
        lifecycleConsistency.length > 0 ||
        sprintConsistency.length > 0;
    const currentActive = requirementMappings[0]?.storyId ?? null;
    const routeChanged = currentActive != null && topScore != null && topScore.route.storyId !== currentActive;
    const needsDraft = topScore == null;
    return {
        verdict: hasFailure
            ? 'block'
            : needsDraft
                ? 'warn'
                : routeChanged
                    ? 'reroute'
                    : topScore != null &&
                        topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForAutoMatch
                        ? 'pass'
                        : topScore != null &&
                            topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForWarn
                            ? 'warn'
                            : 'block',
        confidence: topScore?.scoreBreakdown.weightedTotal ?? 0,
        reason: hasFailure
            ? [...mappingConsistency, ...lifecycleConsistency, ...sprintConsistency].join(', ')
            : needsDraft
                ? 'draft_pending_readiness_required'
                : routeChanged
                    ? 'existing active mapping must reroute through the unified main loop'
                    : topScore != null &&
                        topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForAutoMatch
                        ? 'adaptive intake route satisfied auto-match threshold'
                        : topScore != null &&
                            topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForWarn
                            ? 'adaptive intake route is matchable but below auto-match threshold'
                            : 'adaptive intake route confidence is below governance threshold',
        route: topScore?.route ?? null,
        queueSyncPath,
        draftPath: null,
        applied: false,
    };
}
function queueSyncPath(projectRoot, requirementId) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'adaptive-intake-queue-sync', `${(0, user_story_mapping_1.normalizeCandidateId)(requirementId)}.json`);
}
function writeQueueSyncArtifact(projectRoot, result) {
    const file = queueSyncPath(projectRoot, result.candidate.requirementId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', 'utf8');
    return file;
}
function writeDraftArtifact(projectRoot, candidate) {
    const file = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'adaptive-intake-drafts', `${(0, user_story_mapping_1.normalizeCandidateId)(candidate.requirementId)}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
        requirementId: candidate.requirementId,
        flow: candidate.flow,
        epicId: candidate.epicId ?? null,
        storyId: candidate.storyId ?? null,
        sprintId: candidate.sprintId ?? null,
        status: 'draft_pending_readiness',
        changedPaths: candidate.changedPaths ?? [],
        summary: candidate.summary ?? null,
    }, null, 2) + '\n', 'utf8');
    return file;
}
function applyDecision(projectRoot, result) {
    if (result.decision.route == null || result.decision.verdict === 'block') {
        return result;
    }
    const current = (0, user_story_mapping_1.readUserStoryMappingIndexOrDefault)(projectRoot);
    const nextRoute = {
        requirementId: result.candidate.requirementId,
        sourceType: result.candidate.sourceType,
        epicId: result.decision.route.epicId,
        storyId: result.decision.route.storyId,
        flow: result.candidate.flow,
        sprintId: result.candidate.sprintId ?? result.decision.route.sprintId,
        allowedWriteScope: result.decision.route.allowedWriteScope,
        status: 'planned',
        acceptanceRefs: result.candidate.acceptanceRefs ?? [],
        lastPacketId: null,
    };
    const deactivated = (0, user_story_mapping_1.deactivateSiblingActiveMappings)(current, nextRoute.requirementId, nextRoute.storyId);
    const updated = (0, user_story_mapping_1.upsertUserStoryMappingItem)(deactivated, nextRoute);
    (0, user_story_mapping_1.writeUserStoryMappingIndex)(projectRoot, updated);
    return {
        ...result,
        decision: {
            ...result.decision,
            applied: true,
        },
    };
}
function runAdaptiveIntakeGovernanceGate(projectRoot, candidate, options = {}) {
    const contract = (0, orchestration_governance_contract_1.readOrchestrationGovernanceContract)(projectRoot);
    const mappingIndex = (0, user_story_mapping_1.readUserStoryMappingIndexOrDefault)(projectRoot);
    const sprint = readSprintStatusSnapshot(projectRoot);
    const requirementMappings = (0, user_story_mapping_1.findMappingsForRequirement)(mappingIndex, candidate.requirementId).filter((item) => item.status === 'planned' || item.status === 'in_progress');
    const scoring = mappingIndex.items
        .filter((item) => item.flow === candidate.flow)
        .map((item) => scoreRoute(candidate, item, sprint, requirementMappings, contract.adaptiveIntakeGovernanceGate.matchScoring))
        .sort((left, right) => {
        if (right.scoreBreakdown.weightedTotal !== left.scoreBreakdown.weightedTotal) {
            return right.scoreBreakdown.weightedTotal - left.scoreBreakdown.weightedTotal;
        }
        return left.route.storyId.localeCompare(right.route.storyId);
    });
    const initial = {
        candidate,
        scoring,
        consistency: {
            mappingConsistency: { passed: true, failed: [] },
            lifecycleConsistency: { passed: true, failed: [] },
            sprintConsistency: { passed: true, failed: [] },
        },
        decision: decideVerdict(candidate, scoring[0] ?? null, requirementMappings, queueSyncPath(projectRoot, candidate.requirementId), contract.adaptiveIntakeGovernanceGate.decisionThresholds),
    };
    initial.consistency.mappingConsistency.failed = initial.decision.reason
        .split(', ')
        .filter((value) => [
        'requirement_to_story_unique_active',
        'allowed_write_scope_consistent',
        'flow_to_story_type_consistent',
    ].includes(value));
    initial.consistency.lifecycleConsistency.failed = initial.decision.reason
        .split(', ')
        .filter((value) => ['orchestration_state_aligned_with_mapping_status'].includes(value));
    initial.consistency.sprintConsistency.failed = initial.decision.reason
        .split(', ')
        .filter((value) => ['sprint_id_valid', 'backlog_sync_record_present'].includes(value));
    initial.consistency.mappingConsistency.passed =
        initial.consistency.mappingConsistency.failed.length === 0;
    initial.consistency.lifecycleConsistency.passed =
        initial.consistency.lifecycleConsistency.failed.length === 0;
    initial.consistency.sprintConsistency.passed =
        initial.consistency.sprintConsistency.failed.length === 0;
    if (initial.decision.reason === 'draft_pending_readiness_required') {
        initial.decision.draftPath = writeDraftArtifact(projectRoot, candidate);
    }
    const applied = options.apply ? applyDecision(projectRoot, initial) : initial;
    const reportPath = writeQueueSyncArtifact(projectRoot, applied);
    return {
        ...applied,
        decision: {
            ...applied.decision,
            queueSyncPath: reportPath,
        },
    };
}
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith('--')) {
            out[token.slice(2)] = argv[index + 1]?.startsWith('--') ? 'true' : (argv[++index] ?? 'true');
        }
    }
    return out;
}
function mainAdaptiveIntakeGovernanceGate(argv) {
    const args = parseArgs(argv);
    const projectRoot = path.resolve(args.cwd ?? process.cwd());
    const inputPath = args.input ? path.resolve(projectRoot, args.input) : null;
    if (!args.payload &&
        (!inputPath || !fs.existsSync(inputPath) || fs.statSync(inputPath).isDirectory())) {
        process.stdout.write(`${JSON.stringify({
            skipped: true,
            reason: 'adaptive intake candidate not provided',
        }, null, 2)}\n`);
        return 0;
    }
    const candidate = JSON.parse(args.payload ?? fs.readFileSync(inputPath, 'utf8'));
    const result = runAdaptiveIntakeGovernanceGate(projectRoot, candidate, {
        apply: args.apply === 'true',
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.decision.verdict === 'block' ? 1 : 0;
}
function isAdaptiveIntakeGovernanceGateEntry(entry) {
    return /(^|[\\/])adaptive-intake-governance-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
if (require.main === module && isAdaptiveIntakeGovernanceGateEntry(process.argv[1])) {
    process.exit(mainAdaptiveIntakeGovernanceGate(process.argv.slice(2)));
}
