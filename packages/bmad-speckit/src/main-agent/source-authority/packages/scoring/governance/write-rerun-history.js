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
exports.writeGovernanceRerunHistory = writeGovernanceRerunHistory;
const path = __importStar(require("node:path"));
const loader_1 = require("../query/loader");
const parse_epic_story_1 = require("../query/parse-epic-story");
const write_score_1 = require("../writer/write-score");
const VALID_RUN_SCORE_STAGES = new Set([
    'prd',
    'arch',
    'epics',
    'story',
    'spec',
    'specify',
    'plan',
    'gaps',
    'tasks',
    'implement',
    'post_impl',
    'pr_review',
]);
function normalizeGovernanceHistoryStage(rawStage, runtimeContext) {
    const normalized = (rawStage ?? '').trim();
    if (normalized === 'post_audit')
        return 'post_impl';
    if (normalized === 'story_create' || normalized === 'story_audit')
        return 'story';
    if (normalized === 'epic_create' || normalized === 'epic_complete')
        return 'epics';
    if (VALID_RUN_SCORE_STAGES.has(normalized))
        return normalized;
    if (runtimeContext?.epicId && !runtimeContext?.storyId) {
        return 'epics';
    }
    if (runtimeContext?.storyId) {
        return 'story';
    }
    return 'post_impl';
}
function normalizeSummaryLines(lines) {
    const normalized = [...new Set((lines ?? []).map((line) => line.trim()).filter(Boolean))];
    return normalized.length > 0 ? normalized : undefined;
}
function resolveScoringDataPath(projectRoot) {
    const envPath = process.env.SCORING_DATA_PATH;
    if (envPath && envPath.trim() !== '') {
        return path.isAbsolute(envPath) ? envPath : path.resolve(projectRoot, envPath);
    }
    return path.resolve(projectRoot, '_bmad-output', 'scoring');
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
function effectiveStage(record) {
    return record.trigger_stage === 'speckit_5_2' ? 'implement' : record.stage;
}
function sanitizeRunToken(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
function buildSyntheticRunId(input) {
    const timeToken = new Date(input.timestamp).getTime();
    if (input.epicStory) {
        return `gov-e${input.epicStory.epicId}-s${input.epicStory.storyId}-${sanitizeRunToken(input.stage)}-${timeToken}`;
    }
    const baseToken = sanitizeRunToken(input.runGroupId ?? 'runtime-governance');
    return `gov-${baseToken}-${timeToken}`;
}
function normalizeExecutorRouting(routing) {
    if (!routing?.routingMode || !routing.executorRoute) {
        return undefined;
    }
    return {
        routing_mode: routing.routingMode,
        executor_route: routing.executorRoute,
        prioritized_signals: [...new Set((routing.prioritizedSignals ?? []).filter(Boolean))].sort(),
    };
}
function mergeGovernanceRerunHistory(existing, incoming) {
    const merged = new Map();
    for (const item of existing ?? []) {
        if (item?.event_id) {
            merged.set(item.event_id, item);
        }
    }
    for (const item of incoming ?? []) {
        if (item?.event_id) {
            merged.set(item.event_id, item);
        }
    }
    if (merged.size === 0) {
        return undefined;
    }
    return [...merged.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
function findTargetRecord(input) {
    const records = (0, loader_1.loadAndDedupeRecords)(input.dataPath).filter((record) => record.scenario === 'real_dev');
    const candidates = records.filter((record) => {
        if (effectiveStage(record) !== input.stage) {
            return false;
        }
        if (input.epicStory) {
            const parsed = (0, parse_epic_story_1.parseEpicStoryFromRecord)(record);
            return (parsed != null &&
                parsed.epicId === input.epicStory.epicId &&
                parsed.storyId === input.epicStory.storyId);
        }
        return ((input.runGroupId != null && record.run_group_id === input.runGroupId) ||
            (input.runGroupId != null && record.run_id === input.runGroupId));
    });
    return [...candidates].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
}
function writeGovernanceRerunHistory(input) {
    const dataPath = resolveScoringDataPath(input.projectRoot);
    const epicStory = parseEpicStoryFromRuntimeContext(input.runtimeContext);
    const stage = normalizeGovernanceHistoryStage(input.runtimeContext?.stage, input.runtimeContext);
    const runGroupId = input.runtimeContext?.runId;
    const target = findTargetRecord({
        dataPath,
        epicStory,
        stage,
        runGroupId,
    });
    const entry = {
        event_id: input.eventId,
        timestamp: input.timestamp,
        rerun_gate: input.rerunGate,
        outcome: input.outcome,
        ...(input.providerId != null ? { provider_id: input.providerId } : {}),
        ...(input.providerMode != null ? { provider_mode: input.providerMode } : {}),
        ...(input.hostKind != null ? { host_kind: input.hostKind } : {}),
        ...(input.decisionMode != null ? { decision_mode: input.decisionMode } : {}),
        ...(input.attemptId != null ? { attempt_id: input.attemptId } : {}),
        ...(input.loopStateId != null ? { loop_state_id: input.loopStateId } : {}),
        ...(normalizeExecutorRouting(input.executorRouting) != null
            ? { executor_routing: normalizeExecutorRouting(input.executorRouting) }
            : {}),
        ...(normalizeSummaryLines(input.remediationAuditTraceSummaryLines) != null
            ? { summary_lines: normalizeSummaryLines(input.remediationAuditTraceSummaryLines) }
            : {}),
        ...(normalizeSummaryLines(input.runnerSummaryLines) != null
            ? { runner_summary_lines: normalizeSummaryLines(input.runnerSummaryLines) }
            : {}),
    };
    const nextRecord = {
        ...(target ?? {
            run_id: buildSyntheticRunId({
                epicStory,
                stage,
                runGroupId,
                timestamp: input.timestamp,
            }),
            scenario: 'real_dev',
            stage,
            ...(input.hostKind != null ? { host_kind: input.hostKind } : {}),
            phase_score: 100,
            phase_weight: 0,
            check_items: [],
            timestamp: input.timestamp,
            iteration_count: 0,
            iteration_records: [],
            first_pass: true,
        }),
        ...(runGroupId != null ? { run_group_id: target?.run_group_id ?? runGroupId } : {}),
        ...(input.hostKind != null && target?.host_kind == null ? { host_kind: input.hostKind } : {}),
        ...(input.runtimePolicy?.triggerStage != null && target?.trigger_stage == null
            ? { trigger_stage: input.runtimePolicy.triggerStage }
            : {}),
        governance_rerun_history: mergeGovernanceRerunHistory(target?.governance_rerun_history, [
            entry,
        ]),
    };
    (0, write_score_1.writeScoreRecordSync)(nextRecord, 'both', { dataPath });
    return nextRecord;
}
