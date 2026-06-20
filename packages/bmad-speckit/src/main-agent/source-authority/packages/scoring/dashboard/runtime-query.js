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
exports.hydrateSftSummaryFromLatestBundle = hydrateSftSummaryFromLatestBundle;
exports.buildRuntimeDashboardModel = buildRuntimeDashboardModel;
exports.queryRuntimeDashboard = queryRuntimeDashboard;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const candidate_builder_1 = require("../analytics/candidate-builder");
const validation_report_1 = require("../analytics/validation-report");
const dataset_analytics_1 = require("../analytics/dataset-analytics");
const loader_1 = require("../query/loader");
const event_store_1 = require("../runtime/event-store");
const projection_1 = require("../runtime/projection");
const reviewer_projection_1 = require("./reviewer-projection");
const compute_1 = require("./compute");
const readiness_drift_1 = require("../governance/readiness-drift");
const veto_1 = require("../veto");
const six_model_projection_1 = require("./six-model-projection");
const STANDARD_STAGE_SEQUENCE = {
    story: ['brief', 'prd', 'arch', 'tasks', 'implement'],
    bugfix: ['prd', 'plan', 'tasks', 'implement'],
    standalone_tasks: ['plan', 'tasks', 'implement'],
    epic: ['brief', 'prd', 'arch', 'tasks', 'implement'],
    unknown: ['plan', 'tasks', 'implement'],
};
function normalizeRedactionPreviewStatus(status) {
    return status;
}
function compareTimestamps(left, right) {
    const leftValue = left ? new Date(left).getTime() : 0;
    const rightValue = right ? new Date(right).getTime() : 0;
    return rightValue - leftValue;
}
function compareTimestampsAsc(left, right) {
    return compareTimestamps(right, left);
}
function rankBoardStatus(status) {
    if (status === 'in_progress')
        return 0;
    if (status === 'todo')
        return 1;
    return 2;
}
function normalizePath(value) {
    return (value ?? '').replace(/\\/g, '/');
}
function normalizePathLower(value) {
    return normalizePath(value).toLowerCase();
}
function titleFromSlug(slug) {
    return slug
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function slugFromPath(sourcePath) {
    const normalized = normalizePath(sourcePath);
    if (!normalized)
        return null;
    const basename = normalized.split('/').pop() ?? normalized;
    const withoutExtension = basename.replace(/\.[a-z0-9]+$/i, '');
    const withoutPrefix = withoutExtension
        .replace(/^bugfix[-_]+/i, '')
        .replace(/^standalone[-_]+/i, '');
    const slug = withoutPrefix
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return slug || null;
}
function extractStoryIdentityFromPath(sourcePath) {
    const normalized = normalizePath(sourcePath);
    if (!normalized)
        return null;
    const storyScopedMatch = normalized.match(/epic-([^/]+)\/story-([^/]+)/i);
    if (storyScopedMatch) {
        return {
            epicId: `epic-${storyScopedMatch[1]}`.replace(/^epic-epic-/i, 'epic-'),
            storyKey: storyScopedMatch[2],
        };
    }
    const specsMatch = normalized.match(/specs\/epic-(\d+)\/story-(\d+)-([^/]+)/i);
    if (specsMatch) {
        return {
            epicId: `epic-${specsMatch[1]}`,
            storyKey: `${specsMatch[1]}-${specsMatch[2]}-${specsMatch[3]}`,
        };
    }
    return null;
}
function parseEpicNumber(epicId) {
    if (!epicId)
        return null;
    const match = /epic[-_]?(\d+)/i.exec(epicId);
    return match?.[1] ?? null;
}
function parseRunIdentity(runId) {
    const canonicalMatch = runId.match(/-e([a-z0-9]+)-s([a-z0-9]+)(?:-|$)/i);
    if (canonicalMatch) {
        return {
            epicToken: canonicalMatch[1],
            storyToken: canonicalMatch[2],
        };
    }
    const mixedMatch = runId.match(/-e([a-z0-9]+)-sS?([a-z0-9]+)(?:-|$)/i);
    if (mixedMatch) {
        return {
            epicToken: mixedMatch[1],
            storyToken: mixedMatch[2],
        };
    }
    return {};
}
function normalizeEpicId(epicToken) {
    if (!epicToken)
        return null;
    return epicToken.toLowerCase().startsWith('epic-') ? epicToken : `epic-${epicToken}`;
}
function normalizeStoryKey(epicToken, storyToken) {
    if (!epicToken || !storyToken)
        return null;
    return `${epicToken}-${storyToken}`;
}
function classifyArtifactScope(sourcePath, scope) {
    if (scope?.story_key)
        return 'story_scoped';
    const normalized = normalizePath(sourcePath);
    if (normalized.includes('/_orphan/'))
        return 'orphan_scoped';
    return 'story_scoped';
}
function inferScopeFromSeed(seed) {
    if (seed.scope?.story_key || seed.scope?.epic_id) {
        return seed.scope;
    }
    const fromPath = extractStoryIdentityFromPath(seed.source_path);
    if (fromPath) {
        return {
            flow: 'story',
            epic_id: fromPath.epicId,
            story_key: fromPath.storyKey,
            story_id: fromPath.storyKey,
        };
    }
    const fromRunId = parseRunIdentity(seed.run_id);
    const epicId = normalizeEpicId(fromRunId.epicToken);
    const storyKey = normalizeStoryKey(fromRunId.epicToken, fromRunId.storyToken);
    if (epicId && storyKey) {
        return {
            flow: 'story',
            epic_id: epicId,
            story_key: storyKey,
            story_id: storyKey,
        };
    }
    return null;
}
function inferFlowForSeed(seed) {
    if (seed.scope?.story_key)
        return 'story';
    if (seed.flow === 'story' ||
        seed.flow === 'standalone_tasks' ||
        seed.flow === 'bugfix' ||
        seed.flow === 'epic') {
        return seed.flow;
    }
    const normalized = normalizePath(seed.source_path).toLowerCase();
    if (normalized.includes('/standalone_tasks/'))
        return 'standalone_tasks';
    if (normalized.includes('/bugfix/') ||
        normalized.includes('/bugfix_') ||
        normalized.includes('/bugfix-'))
        return 'bugfix';
    if (normalized.includes('/story-') || normalized.includes('/story/'))
        return 'story';
    return 'unknown';
}
function preferredBoardGroupIdForSelectedRun(workItems, selectedRunId) {
    if (!selectedRunId)
        return null;
    const directMatch = workItems.find((item) => item.run_ids.includes(selectedRunId));
    if (directMatch)
        return directMatch.board_group_id;
    const runIdLower = selectedRunId.toLowerCase();
    if (runIdLower.includes('bugfix'))
        return 'queue:bugfix';
    if (runIdLower.includes('standalone'))
        return 'queue:standalone-ops';
    return null;
}
function deriveWorkItemIdentity(seed) {
    const inferredScope = inferScopeFromSeed(seed);
    const flow = inferFlowForSeed({ ...seed, scope: inferredScope });
    const artifactScope = classifyArtifactScope(seed.source_path, inferredScope);
    const storyKey = inferredScope?.story_key ?? null;
    const epicId = inferredScope?.epic_id ?? null;
    if (storyKey) {
        const epicNumber = parseEpicNumber(epicId);
        return {
            work_item_id: `story:${storyKey}`,
            work_item_type: 'story',
            artifact_scope: 'story_scoped',
            title: storyKey,
            slug: storyKey,
            flow: 'story',
            board_group_id: epicId ? `epic:${epicId}` : 'epic:unassigned',
            board_group_label: epicNumber ? `Epic ${epicNumber}` : 'Unassigned Story',
            board_group_kind: 'epic',
            epic_id: epicId,
            story_key: storyKey,
            linked_story_key: null,
            linked_epic_id: null,
        };
    }
    const slug = slugFromPath(seed.source_path) ?? seed.run_id.toLowerCase();
    if (flow === 'standalone_tasks') {
        return {
            work_item_id: `standalone_task:orphan:${slug}`,
            work_item_type: 'standalone_task',
            artifact_scope: artifactScope,
            title: titleFromSlug(slug),
            slug,
            flow,
            board_group_id: 'queue:standalone-ops',
            board_group_label: 'Standalone / Ops',
            board_group_kind: 'standalone_ops',
            epic_id: null,
            story_key: null,
            linked_story_key: null,
            linked_epic_id: null,
        };
    }
    if (flow === 'bugfix') {
        return {
            work_item_id: `bugfix:orphan:${slug}`,
            work_item_type: 'bugfix',
            artifact_scope: artifactScope,
            title: titleFromSlug(slug),
            slug,
            flow,
            board_group_id: 'queue:bugfix',
            board_group_label: 'Bugfix Queue',
            board_group_kind: 'bugfix_queue',
            epic_id: null,
            story_key: null,
            linked_story_key: null,
            linked_epic_id: null,
        };
    }
    if (storyKey && epicId) {
        const epicNumber = parseEpicNumber(epicId);
        return {
            work_item_id: `story:${storyKey}`,
            work_item_type: 'story',
            artifact_scope: artifactScope,
            title: storyKey,
            slug: storyKey,
            flow: 'story',
            board_group_id: `epic:${epicId}`,
            board_group_label: epicNumber ? `Epic ${epicNumber}` : epicId,
            board_group_kind: 'epic',
            epic_id: epicId,
            story_key: storyKey,
            linked_story_key: null,
            linked_epic_id: null,
        };
    }
    const normalized = normalizePath(seed.source_path).toLowerCase();
    if (normalized.includes('bugfix')) {
        return {
            work_item_id: `bugfix:orphan:${slug}`,
            work_item_type: 'bugfix',
            artifact_scope: artifactScope,
            title: titleFromSlug(slug),
            slug,
            flow: 'bugfix',
            board_group_id: 'queue:bugfix',
            board_group_label: 'Bugfix Queue',
            board_group_kind: 'bugfix_queue',
            epic_id: null,
            story_key: null,
            linked_story_key: null,
            linked_epic_id: null,
        };
    }
    return {
        work_item_id: `standalone_task:orphan:${slug}`,
        work_item_type: 'standalone_task',
        artifact_scope: artifactScope,
        title: titleFromSlug(slug),
        slug,
        flow: 'standalone_tasks',
        board_group_id: 'queue:standalone-ops',
        board_group_label: 'Standalone / Ops',
        board_group_kind: 'standalone_ops',
        epic_id: null,
        story_key: null,
        linked_story_key: null,
        linked_epic_id: null,
    };
}
function summarizeRuntimeStatus(seeds) {
    const statuses = seeds.map((seed) => seed.runtime_status);
    if (statuses.includes('running'))
        return 'running';
    if (statuses.includes('failed'))
        return 'failed';
    if (statuses.includes('vetoed'))
        return 'vetoed';
    if (statuses.includes('pending'))
        return 'pending';
    if (statuses.includes('passed'))
        return 'passed';
    if (statuses.includes('skipped'))
        return 'skipped';
    return 'unknown';
}
function deriveBoardStatus(runtimeStatus, seeds, findingsCount, latestScoreRecord) {
    const hasStageExecution = seeds.some((seed) => seed.has_stage_execution);
    if (latestScoreRecord == null &&
        !hasStageExecution &&
        (runtimeStatus === 'pending' || runtimeStatus === 'unknown')) {
        return 'todo';
    }
    if (runtimeStatus === 'running' || runtimeStatus === 'failed' || runtimeStatus === 'vetoed') {
        return 'in_progress';
    }
    if (runtimeStatus === 'pending') {
        return hasStageExecution || latestScoreRecord != null ? 'in_progress' : 'todo';
    }
    if (findingsCount > 0) {
        return 'in_progress';
    }
    return latestScoreRecord == null ? 'todo' : 'done';
}
function deriveSftStatus(boardStatus, latestScoreRecord) {
    if (boardStatus === 'todo' || latestScoreRecord == null)
        return 'none';
    if (latestScoreRecord.phase_score >= 90)
        return 'ready';
    return 'partial';
}
function buildRunWorkItemSeeds(events, projections, scoreRecords) {
    const seeds = new Map();
    const ensureSeed = (runId) => {
        const existing = seeds.get(runId);
        if (existing)
            return existing;
        const created = {
            run_id: runId,
            scope: null,
            flow: null,
            source_path: null,
            runtime_status: 'unknown',
            current_stage: null,
            has_stage_execution: false,
            last_updated_at: null,
            score_records: [],
        };
        seeds.set(runId, created);
        return created;
    };
    for (const event of events) {
        const seed = ensureSeed(event.run_id);
        if (event.scope)
            seed.scope = { ...(seed.scope ?? {}), ...event.scope };
        if (event.flow)
            seed.flow = event.flow;
        const sourcePath = event.source?.source_path ??
            (typeof event.payload?.path === 'string' ? event.payload.path : null);
        if (sourcePath)
            seed.source_path = sourcePath;
        seed.last_updated_at =
            compareTimestamps(seed.last_updated_at, event.timestamp) > 0
                ? seed.last_updated_at
                : event.timestamp;
        if (event.event_type === 'stage.started' ||
            event.event_type === 'stage.completed' ||
            event.event_type === 'stage.failed' ||
            event.event_type === 'stage.vetoed') {
            seed.has_stage_execution = true;
        }
    }
    for (const projection of projections) {
        const seed = ensureSeed(projection.run_id);
        seed.scope = projection.current_scope ?? seed.scope;
        seed.flow = projection.current_scope?.flow ?? seed.flow;
        seed.runtime_status = projection.status;
        seed.current_stage = projection.current_stage;
        seed.has_stage_execution = seed.has_stage_execution || projection.stage_history.length > 0;
        seed.last_updated_at =
            compareTimestamps(seed.last_updated_at, projection.last_event_at) > 0
                ? seed.last_updated_at
                : projection.last_event_at;
        const projectedSourcePath = projection.artifact_refs[0]?.path ?? projection.score_refs[0]?.path ?? seed.source_path;
        if (projectedSourcePath)
            seed.source_path = projectedSourcePath;
    }
    for (const record of scoreRecords) {
        const seed = ensureSeed(record.run_id);
        seed.score_records.push(record);
        if (seed.runtime_status === 'unknown')
            seed.runtime_status = 'passed';
        if (seed.current_stage == null)
            seed.current_stage = record.stage;
        if (record.source_path)
            seed.source_path = record.source_path;
        seed.last_updated_at =
            compareTimestamps(seed.last_updated_at, record.timestamp) > 0
                ? seed.last_updated_at
                : record.timestamp;
    }
    return [...seeds.values()];
}
function buildScoreFindings(record) {
    const deduped = new Map();
    for (const item of record.check_items.filter((candidate) => candidate.passed === false)) {
        const finding = {
            run_id: record.run_id,
            stage: record.stage,
            timestamp: record.timestamp,
            item_id: item.item_id,
            note: item.note ?? item.item_id,
            score_delta: item.score_delta,
        };
        const key = `${finding.run_id}::${finding.stage}::${finding.item_id}::${finding.note}::${finding.score_delta}`;
        if (!deduped.has(key)) {
            deduped.set(key, finding);
        }
    }
    return [...deduped.values()];
}
function buildWorkboard(events, projections, scoreRecords, selectedRunId, options = {}) {
    const seeds = buildRunWorkItemSeeds(events, projections, scoreRecords);
    const grouped = new Map();
    for (const seed of seeds) {
        const identity = deriveWorkItemIdentity(seed);
        if (!identity)
            continue;
        const existing = grouped.get(identity.work_item_id);
        if (existing)
            existing.seeds.push(seed);
        else
            grouped.set(identity.work_item_id, { identity, seeds: [seed] });
    }
    const workItems = [...grouped.values()].map(({ identity, seeds }) => {
        const allScoreRecords = seeds
            .flatMap((seed) => seed.score_records)
            .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
        const latestScoreRecord = allScoreRecords[0] ?? null;
        const runtimeStatus = summarizeRuntimeStatus(seeds);
        const findingsCount = allScoreRecords.reduce((count, record) => count + buildScoreFindings(record).length, 0);
        const boardStatus = deriveBoardStatus(runtimeStatus, seeds, findingsCount, latestScoreRecord);
        const latestSeed = [...seeds].sort((left, right) => compareTimestamps(left.last_updated_at, right.last_updated_at))[0] ?? seeds[0];
        const primarySeed = seeds.find((seed) => seed.run_id === selectedRunId) ??
            seeds.find((seed) => seed.runtime_status === 'running') ??
            latestSeed;
        return {
            work_item_id: identity.work_item_id,
            work_item_type: identity.work_item_type,
            artifact_scope: identity.artifact_scope,
            title: identity.title,
            slug: identity.slug,
            flow: identity.flow,
            board_group_id: identity.board_group_id,
            board_group_label: identity.board_group_label,
            board_status: boardStatus,
            epic_id: identity.epic_id ?? null,
            story_key: identity.story_key ?? null,
            linked_story_key: identity.linked_story_key ?? null,
            linked_epic_id: identity.linked_epic_id ?? null,
            primary_run_id: primarySeed?.run_id ?? null,
            run_ids: seeds.map((seed) => seed.run_id),
            runtime_status: runtimeStatus,
            current_stage: primarySeed?.current_stage ?? latestScoreRecord?.stage ?? null,
            phase_score: boardStatus === 'todo' ? null : (latestScoreRecord?.phase_score ?? null),
            findings_count: findingsCount,
            sft_status: deriveSftStatus(boardStatus, latestScoreRecord),
            source_path: primarySeed?.source_path ?? latestScoreRecord?.source_path ?? null,
            artifact_doc_path: latestScoreRecord?.source_path ?? primarySeed?.source_path ?? null,
            last_updated_at: primarySeed?.last_updated_at ?? latestScoreRecord?.timestamp ?? null,
            _board_group_kind: identity.board_group_kind,
        };
    });
    workItems.sort((left, right) => compareTimestamps(left.last_updated_at, right.last_updated_at) ||
        left.title.localeCompare(right.title));
    const groupMap = new Map();
    for (const item of workItems) {
        const existing = groupMap.get(item.board_group_id) ?? {
            board_group_id: item.board_group_id,
            board_group_label: item.board_group_label,
            kind: item._board_group_kind,
            board_status: 'todo',
            sort_order: item._board_group_kind === 'epic' ? 0 : item._board_group_kind === 'standalone_ops' ? 1 : 2,
            counts: { todo: 0, in_progress: 0, done: 0 },
        };
        existing.counts[item.board_status] += 1;
        if (item.board_status === 'in_progress') {
            existing.board_status = 'in_progress';
        }
        else if (item.board_status === 'done' &&
            existing.board_status !== 'in_progress' &&
            existing.counts.in_progress === 0) {
            existing.board_status = 'done';
        }
        groupMap.set(item.board_group_id, existing);
    }
    const dedupedBoardGroups = new Map();
    for (const group of groupMap.values()) {
        const existing = dedupedBoardGroups.get(group.board_group_label);
        if (!existing) {
            dedupedBoardGroups.set(group.board_group_label, group);
            continue;
        }
        existing.counts.todo += group.counts.todo;
        existing.counts.in_progress += group.counts.in_progress;
        existing.counts.done += group.counts.done;
        if (group.board_status === 'in_progress') {
            existing.board_status = 'in_progress';
        }
        else if (group.board_status === 'done' &&
            existing.board_status !== 'in_progress' &&
            existing.counts.in_progress === 0) {
            existing.board_status = 'done';
        }
    }
    const boardGroups = [...dedupedBoardGroups.values()].sort((left, right) => left.sort_order - right.sort_order ||
        left.board_group_label.localeCompare(right.board_group_label));
    const boardGroupSwimlanes = {
        todo: boardGroups.filter((group) => group.board_status === 'todo'),
        in_progress: boardGroups.filter((group) => group.board_status === 'in_progress'),
        done: boardGroups.filter((group) => group.board_status === 'done'),
    };
    const selectedWorkItem = selectedRunId
        ? (workItems.find((item) => item.run_ids.includes(selectedRunId)) ?? null)
        : null;
    const preferredBoardGroupId = preferredBoardGroupIdForSelectedRun(workItems, selectedRunId);
    const activeBoardGroupId = options.boardGroupId ??
        preferredBoardGroupId ??
        selectedWorkItem?.board_group_id ??
        boardGroups[0]?.board_group_id ??
        null;
    const filteredWorkItems = workItems
        .filter((item) => item.board_group_id === activeBoardGroupId)
        .sort((left, right) => {
        const byStatus = rankBoardStatus(left.board_status) - rankBoardStatus(right.board_status);
        if (byStatus !== 0)
            return byStatus;
        const leftHasFindings = left.findings_count > 0 ? 0 : 1;
        const rightHasFindings = right.findings_count > 0 ? 0 : 1;
        if (leftHasFindings !== rightHasFindings)
            return leftHasFindings - rightHasFindings;
        return (compareTimestamps(left.last_updated_at, right.last_updated_at) ||
            left.title.localeCompare(right.title));
    });
    const activeWorkItemId = options.workItemId ??
        (selectedWorkItem && selectedWorkItem.board_group_id === activeBoardGroupId
            ? selectedWorkItem.work_item_id
            : (filteredWorkItems[0]?.work_item_id ?? null));
    const payload = {
        active_board_group_id: activeBoardGroupId,
        active_work_item_id: activeWorkItemId,
        board_groups: boardGroups,
        work_items: workItems.map(({ _board_group_kind, ...item }) => item),
        swimlanes: {
            todo: filteredWorkItems
                .filter((item) => item.board_status === 'todo')
                .map(({ _board_group_kind, ...item }) => item),
            in_progress: filteredWorkItems
                .filter((item) => item.board_status === 'in_progress')
                .map(({ _board_group_kind, ...item }) => item),
            done: filteredWorkItems
                .filter((item) => item.board_status === 'done')
                .map(({ _board_group_kind, ...item }) => item),
        },
        board_group_swimlanes: boardGroupSwimlanes,
    };
    return {
        payload,
        active_work_item: payload.work_items.find((item) => item.work_item_id === activeWorkItemId) ?? null,
    };
}
function filterScoreRecordsForActiveWorkItem(scoreRecords, activeWorkItem) {
    if (!activeWorkItem)
        return scoreRecords;
    const runIdSet = new Set(activeWorkItem.run_ids);
    let matched = scoreRecords.filter((record) => runIdSet.has(record.run_id));
    if (matched.length > 0) {
        return matched.sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
    }
    if (activeWorkItem.story_key) {
        matched = scoreRecords.filter((record) => {
            const parsedFromPath = extractStoryIdentityFromPath(record.source_path);
            if (parsedFromPath?.storyKey === activeWorkItem.story_key)
                return true;
            const parsedRun = parseRunIdentity(record.run_id);
            const storyKey = normalizeStoryKey(parsedRun.epicToken, parsedRun.storyToken);
            return storyKey === activeWorkItem.story_key;
        });
    }
    if (matched.length > 0) {
        return matched.sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
    }
    if (activeWorkItem.source_path) {
        matched = scoreRecords.filter((record) => record.source_path === activeWorkItem.source_path);
    }
    return matched.sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
}
function buildRuntimeProjections(events) {
    const runIds = [...new Set(events.map((event) => event.run_id))];
    return runIds
        .map((runId) => (0, projection_1.buildRunProjection)(events, runId))
        .filter((item) => item != null);
}
function inferRuntimeRootFromDataPath(dataPath, fallbackRoot) {
    if (dataPath == null || dataPath === '') {
        return fallbackRoot;
    }
    const resolved = path.resolve(dataPath);
    const normalized = resolved.replace(/\\/g, '/');
    const knownSuffixes = ['/packages/scoring/data', '/_bmad-output/scoring'];
    for (const suffix of knownSuffixes) {
        if (normalized.endsWith(suffix)) {
            return resolved.slice(0, resolved.length - suffix.length);
        }
    }
    return fallbackRoot;
}
function resolveDashboardDataPath(root, dataPath) {
    if (dataPath != null && dataPath !== '') {
        return dataPath;
    }
    const packageDataPath = path.join(root, 'packages', 'scoring', 'data');
    if (fs.existsSync(packageDataPath)) {
        return packageDataPath;
    }
    return dataPath;
}
function selectRuntimeProjection(projections) {
    if (projections.length === 0) {
        return null;
    }
    const active = projections
        .filter((projection) => projection.status === 'running' || projection.status === 'pending')
        .sort((left, right) => compareTimestamps(left.last_event_at, right.last_event_at));
    if (active.length > 0) {
        return active[0] ?? null;
    }
    const latest = [...projections].sort((left, right) => compareTimestamps(left.last_event_at, right.last_event_at));
    return latest[0] ?? null;
}
function resolveSelectedScoreRecords(scoreRecords, options, projection) {
    if (projection) {
        return scoreRecords
            .filter((record) => record.run_id === projection.run_id)
            .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
    }
    if (scoreRecords.length === 0) {
        return [];
    }
    if (options.strategy === 'epic_story_window') {
        return (0, compute_1.getLatestRunRecordsV2)(scoreRecords, {
            strategy: 'epic_story_window',
            epic: options.epic,
            story: options.story,
            windowHours: options.windowHours,
        });
    }
    return (0, compute_1.getLatestRunRecords)(scoreRecords);
}
function resolveWorkboardScoreRecords(scoreRecords, selectedScoreRecords) {
    if (scoreRecords.length > 0) {
        return scoreRecords;
    }
    return selectedScoreRecords;
}
function mapDimensionScores(scores) {
    if (!scores || scores.length === 0) {
        return undefined;
    }
    return Object.fromEntries(scores.map((score) => [score.dimension, score.score]));
}
function isScoreRecordVetoed(record) {
    const derived = record;
    if (derived.veto_triggered != null) {
        return derived.veto_triggered;
    }
    const vetoIds = (0, veto_1.buildVetoItemIds)();
    return record.check_items.some((item) => item.passed === false && vetoIds.has(item.item_id));
}
function countVetoTriggeredRecords(records) {
    return records.filter((record) => isScoreRecordVetoed(record)).length;
}
function buildScoreDetailRecords(records) {
    return records
        .slice()
        .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp))
        .map((record) => {
        const derived = record;
        return {
            run_id: record.run_id,
            stage: record.stage,
            timestamp: record.timestamp,
            phase_score: record.phase_score,
            raw_phase_score: derived.raw_phase_score ?? record.phase_score,
            phase_weight: record.phase_weight,
            iteration_count: record.iteration_count,
            first_pass: record.first_pass,
            veto_triggered: isScoreRecordVetoed(record),
            tier_coefficient: derived.tier_coefficient ?? null,
            check_item_count: record.check_items.length,
            source_path: record.source_path,
            base_commit_hash: record.base_commit_hash,
            dimension_scores: mapDimensionScores(record.dimension_scores),
            readiness_baseline_run_id: record.readiness_baseline_run_id ?? null,
            drift_signals: record.drift_signals,
            drifted_dimensions: record.drifted_dimensions,
            drift_severity: record.drift_severity ?? null,
            re_readiness_required: record.re_readiness_required,
            blocking_reason: record.blocking_reason ?? null,
            effective_verdict: record.effective_verdict ?? null,
            findings: buildScoreFindings(record),
        };
    });
}
function buildSyntheticRuntimeContext(scoreDetailRecords) {
    if (scoreDetailRecords.length === 0) {
        return {
            run_id: null,
            status: 'unknown',
            current_stage: null,
            flow: null,
            scope: null,
            last_event_at: null,
            reviewer_contract: buildDashboardReviewerProjection({
                flow: null,
                stage: null,
            }).reviewerContract,
            latest_reviewer_closeout: null,
        };
    }
    const latest = scoreDetailRecords[0];
    return {
        run_id: latest.run_id,
        status: 'passed',
        current_stage: latest.stage,
        flow: 'story',
        scope: null,
        last_event_at: latest.timestamp,
        reviewer_contract: buildDashboardReviewerProjection({
            flow: 'story',
            stage: latest.stage,
        }).reviewerContract,
        latest_reviewer_closeout: null,
    };
}
function loadLatestReviewerCloseoutFromRoot(root) {
    const registryPath = path.join(root, '_bmad-output', 'runtime', 'registry.json');
    if (!fs.existsSync(registryPath)) {
        return null;
    }
    let registry;
    try {
        registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    }
    catch {
        return null;
    }
    const scopedPath = registry.activeScope?.resolvedContextPath
        ? path.resolve(root, registry.activeScope.resolvedContextPath)
        : null;
    const scopedCloseout = scopedPath && fs.existsSync(scopedPath)
        ? (() => {
            try {
                const parsed = JSON.parse(fs.readFileSync(scopedPath, 'utf8'));
                return parsed.latestReviewerCloseout ?? null;
            }
            catch {
                return null;
            }
        })()
        : null;
    const raw = scopedCloseout ?? registry.latestReviewerCloseout ?? null;
    if (!raw) {
        return null;
    }
    return {
        updated_at: raw.updatedAt,
        runner: raw.runner,
        profile: raw.profile,
        stage: raw.stage,
        artifact_path: raw.artifactPath,
        report_path: raw.reportPath,
        audit_status: raw.auditStatus,
        closeout_approved: raw.closeoutApproved,
        result_code: raw.closeoutEnvelope.resultCode,
        rerun_decision: raw.closeoutEnvelope.rerunDecision,
        packet_execution_closure_status: raw.closeoutEnvelope.packetExecutionClosureStatus,
        scoring_failure_mode: raw.closeoutEnvelope.scoringFailureMode,
        blocking_reason: raw.closeoutEnvelope.requiredFixes[0] ?? null,
        required_fixes: raw.closeoutEnvelope.requiredFixes ?? [],
        score_error: raw.scoreError ?? null,
    };
}
function buildStageTimeline(projection, scoreDetailRecords, activeWorkItem) {
    const stageOrder = STANDARD_STAGE_SEQUENCE[activeWorkItem?.flow ?? 'unknown'] ?? STANDARD_STAGE_SEQUENCE.unknown;
    const byStage = new Map();
    for (const record of [...scoreDetailRecords].sort((left, right) => compareTimestampsAsc(left.timestamp, right.timestamp))) {
        byStage.set(record.stage, record);
    }
    const projectionByStage = new Map();
    if (projection) {
        for (const stage of projection.stage_history) {
            projectionByStage.set(stage.stage, stage);
        }
    }
    const knownStages = [...new Set([...stageOrder, ...projectionByStage.keys(), ...byStage.keys()])];
    const buildEntry = (stageName) => {
        const projectionStage = projectionByStage.get(stageName);
        const scoreDetail = byStage.get(stageName);
        return {
            stage: stageName,
            status: projectionStage?.status ?? (scoreDetail ? 'passed' : 'pending'),
            started_at: projectionStage?.started_at,
            completed_at: projectionStage?.completed_at,
            phase_score: scoreDetail?.phase_score ?? null,
            raw_phase_score: scoreDetail?.raw_phase_score ?? null,
            veto_triggered: scoreDetail?.veto_triggered ?? false,
            iteration_count: scoreDetail?.iteration_count ?? null,
            score_timestamp: scoreDetail?.timestamp ?? null,
        };
    };
    return knownStages.map(buildEntry);
}
function createEmptyTargetAvailability() {
    return {
        openai_chat: { compatible: 0, incompatible: 0 },
        hf_conversational: { compatible: 0, incompatible: 0 },
        hf_tool_calling: { compatible: 0, incompatible: 0 },
    };
}
function countRejectionReasons(samples) {
    const counts = new Map();
    for (const sample of samples) {
        for (const reason of sample.quality.rejection_reasons) {
            counts.set(reason, (counts.get(reason) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([reason, count]) => ({ reason, count }));
}
function buildTargetAvailability(samples) {
    const targetAvailability = createEmptyTargetAvailability();
    const targets = ['openai_chat', 'hf_conversational', 'hf_tool_calling'];
    for (const sample of samples) {
        for (const target of targets) {
            const decision = (0, validation_report_1.assessSampleForTarget)(sample, target);
            if (decision.exportable) {
                targetAvailability[target].compatible += 1;
            }
            else {
                targetAvailability[target].incompatible += 1;
            }
        }
    }
    return targetAvailability;
}
function bundleMatchesWorkItem(manifest, activeWorkItem, activeBoardGroupId) {
    const scope = manifest.source_scope;
    if (!scope) {
        return activeWorkItem == null;
    }
    if (scope.scope_type === 'global') {
        return activeWorkItem == null;
    }
    if (scope.work_item_id && activeWorkItem?.work_item_id) {
        return scope.work_item_id === activeWorkItem.work_item_id;
    }
    if (scope.story_key && activeWorkItem?.story_key) {
        return scope.story_key === activeWorkItem.story_key;
    }
    if (scope.board_group_id && activeBoardGroupId) {
        return scope.board_group_id === activeBoardGroupId;
    }
    if (scope.epic_id && activeWorkItem?.epic_id) {
        return scope.epic_id === activeWorkItem.epic_id;
    }
    if (scope.scope_type === 'story' && activeWorkItem?.work_item_type === 'story') {
        return true;
    }
    if (scope.scope_type === 'bugfix' && activeWorkItem?.work_item_type === 'bugfix') {
        return true;
    }
    if (scope.scope_type === 'standalone_task' &&
        activeWorkItem?.work_item_type === 'standalone_task') {
        return true;
    }
    return false;
}
function listDashboardExecutionRecords(root) {
    const executionsRoot = path.join(root, '_bmad-output', 'runtime', 'governance', 'executions');
    if (!fs.existsSync(executionsRoot)) {
        return [];
    }
    const records = [];
    for (const file of fs.readdirSync(executionsRoot, { recursive: true })) {
        const fullPath = path.join(executionsRoot, String(file));
        if (!fullPath.endsWith('.json') || fullPath.endsWith('reconciliation-report.json')) {
            continue;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            if (parsed && typeof parsed === 'object' && parsed.executionId) {
                records.push(parsed);
            }
        }
        catch {
            continue;
        }
    }
    return records.sort((left, right) => compareTimestamps(left.updatedAt, right.updatedAt));
}
function executionRecordMatchesWorkItem(record, activeWorkItem) {
    if (!activeWorkItem) {
        return false;
    }
    const candidates = [
        normalizePathLower(record.artifactPath),
        typeof record.loopStateId === 'string' ? record.loopStateId.toLowerCase() : '',
    ];
    if (activeWorkItem.story_key) {
        const storyKey = activeWorkItem.story_key.toLowerCase();
        if (candidates.some((value) => value.includes(storyKey))) {
            return true;
        }
    }
    if (activeWorkItem.epic_id) {
        const epicId = activeWorkItem.epic_id.toLowerCase();
        if (candidates.some((value) => value.includes(epicId))) {
            return true;
        }
    }
    if (activeWorkItem.slug) {
        const slug = activeWorkItem.slug.toLowerCase();
        if (candidates.some((value) => value.includes(slug))) {
            return true;
        }
    }
    return false;
}
function buildDashboardReviewerProjection(input) {
    const auditEntryStage = (0, reviewer_projection_1.mapFlowStageToReviewerAuditEntryStage)(input.flow, input.stage);
    const reviewerContract = (0, reviewer_projection_1.buildReviewerContractProjection)({ auditEntryStage });
    return {
        reviewerContract,
        reviewerRouteExplainability: auditEntryStage
            ? [(0, reviewer_projection_1.buildReviewerRouteExplainability)({ requestedSkillId: 'code-reviewer', auditEntryStage })]
            : null,
    };
}
function buildExecutionStateSummary(root, activeWorkItem, runtimeContext) {
    const reviewerProjection = buildDashboardReviewerProjection({
        flow: runtimeContext?.flow ?? activeWorkItem?.flow ?? null,
        stage: runtimeContext?.current_stage ?? null,
    });
    const records = listDashboardExecutionRecords(root);
    if (records.length === 0) {
        return {
            source: 'none',
            selection_match: 'none',
            execution_id: null,
            execution_status: null,
            configured_authoritative_host: null,
            dispatched_host: null,
            fallback_used: false,
            last_rerun_gate_status: null,
            artifact_path: null,
            packet_paths: {},
            last_dispatch_error: null,
            reviewer_route_explainability: reviewerProjection.reviewerRouteExplainability,
        };
    }
    const matched = records.find((record) => executionRecordMatchesWorkItem(record, activeWorkItem)) ?? records[0];
    const launchMetadata = matched.lastLaunch?.metadata ?? {};
    const dispatchedHost = typeof launchMetadata.dispatchedHost === 'string' ? launchMetadata.dispatchedHost : null;
    return {
        source: 'execution_record',
        selection_match: executionRecordMatchesWorkItem(matched, activeWorkItem)
            ? 'work_item'
            : 'global',
        execution_id: matched.executionId ?? null,
        execution_status: matched.status ?? null,
        configured_authoritative_host: typeof matched.authoritativeHost === 'string' ? matched.authoritativeHost : null,
        dispatched_host: dispatchedHost,
        fallback_used: Boolean(launchMetadata.fallbackUsed),
        last_rerun_gate_status: matched.lastRerunGateResult?.status ?? null,
        artifact_path: matched.artifactPath
            ? path.relative(root, matched.artifactPath).replace(/\\/g, '/')
            : null,
        packet_paths: Object.fromEntries(Object.entries(matched.packetPaths ?? {}).map(([hostKind, packetPath]) => [
            hostKind,
            path.relative(root, packetPath).replace(/\\/g, '/'),
        ])),
        last_dispatch_error: typeof matched.lastDispatchError === 'string' ? matched.lastDispatchError : null,
        reviewer_route_explainability: reviewerProjection.reviewerRouteExplainability,
    };
}
function toBundleSummary(root, bundleDir, manifestPath, manifest) {
    return {
        bundle_id: manifest.bundle_id,
        export_target: manifest.export_target,
        created_at: manifest.created_at,
        bundle_dir: path.relative(root, bundleDir).replace(/\\/g, '/'),
        manifest_path: path.relative(root, manifestPath).replace(/\\/g, '/'),
        ...(manifest.source_scope ? { source_scope: manifest.source_scope } : {}),
        ...(manifest.validation_summary ? { validation_summary: manifest.validation_summary } : {}),
    };
}
function findLatestBundles(root, activeWorkItem, activeBoardGroupId) {
    const bundlesRoot = path.join(root, '_bmad-output', 'datasets');
    if (!fs.existsSync(bundlesRoot)) {
        return {
            global_last_bundle: null,
            scoped_last_bundle: null,
        };
    }
    const manifests = [];
    for (const dirent of fs.readdirSync(bundlesRoot, { withFileTypes: true })) {
        if (!dirent.isDirectory()) {
            continue;
        }
        const bundleDir = path.join(bundlesRoot, dirent.name);
        const manifestPath = path.join(bundleDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            continue;
        }
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            if (manifest.bundle_id && manifest.export_target && manifest.created_at) {
                manifests.push({ manifest, bundleDir, manifestPath });
            }
        }
        catch {
            continue;
        }
    }
    if (manifests.length === 0) {
        return {
            global_last_bundle: null,
            scoped_last_bundle: null,
        };
    }
    manifests.sort((left, right) => compareTimestamps(left.manifest.created_at, right.manifest.created_at));
    const globalLatest = manifests[0];
    const scopedLatest = manifests.find(({ manifest }) => bundleMatchesWorkItem(manifest, activeWorkItem, activeBoardGroupId)) ?? null;
    return {
        global_last_bundle: toBundleSummary(root, globalLatest.bundleDir, globalLatest.manifestPath, globalLatest.manifest),
        scoped_last_bundle: scopedLatest
            ? toBundleSummary(root, scopedLatest.bundleDir, scopedLatest.manifestPath, scopedLatest.manifest)
            : null,
    };
}
function numberFrom(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function hydrateSftSummaryFromLatestBundle(summary) {
    const bundle = summary.last_bundle ?? summary.global_last_bundle;
    if (!bundle || summary.total_candidates > 0) {
        return summary;
    }
    const validation = bundle.validation_summary ?? {};
    const totalCandidates = numberFrom(validation.completion_only_ready);
    if (totalCandidates <= 0) {
        return summary;
    }
    summary.total_candidates = totalCandidates;
    summary.accepted = totalCandidates;
    summary.rejected = 0;
    summary.target_availability = createEmptyTargetAvailability();
    const exportTarget = bundle.export_target;
    if (summary.target_availability[exportTarget]) {
        summary.target_availability[exportTarget].compatible = totalCandidates;
    }
    summary.training_view_summary = {
        ...summary.training_view_summary,
        assistant_only_ready: numberFrom(validation.assistant_only_ready),
        completion_only_ready: numberFrom(validation.completion_only_ready),
        tool_calling_ready: numberFrom(validation.tool_calling_ready),
        schema_target_counts: summary.training_view_summary?.schema_target_counts ?? {},
    };
    summary.training_ready_candidates =
        typeof validation.training_ready_passed === 'boolean' && validation.training_ready_passed
            ? totalCandidates
            : 0;
    return summary;
}
function buildSftSummary(records, root, activeWorkItem, activeBoardGroupId) {
    const latestBundles = findLatestBundles(root, activeWorkItem, activeBoardGroupId);
    const summary = {
        total_candidates: 0,
        accepted: 0,
        rejected: 0,
        downgraded: 0,
        training_ready_candidates: 0,
        by_split: {
            train: 0,
            validation: 0,
            test: 0,
            holdout: 0,
        },
        target_availability: createEmptyTargetAvailability(),
        rejection_reasons: [],
        redaction_status_counts: {
            clean: 0,
            redacted: 0,
            blocked: 0,
        },
        redaction_applied_rules: [],
        redaction_finding_kinds: [],
        redaction_preview: [],
        duplicate_summary: {
            cluster_count: 0,
            duplicate_cluster_count: 0,
            duplicated_sample_count: 0,
            largest_cluster_size: 0,
            clusters: [],
        },
        balance_summary: {
            by_host_kind: {},
            by_provider_id: {},
            by_stage: {},
            by_source_scope: {},
            by_sample_kind: {},
            by_split: {},
            by_target: {},
            dominant_host_kind_share: 0,
            dominant_provider_share: 0,
            dominant_stage_share: 0,
            dominant_source_scope_share: 0,
            dominant_sample_kind_share: 0,
        },
        training_view_summary: {
            assistant_only_ready: 0,
            completion_only_ready: 0,
            tool_calling_ready: 0,
            schema_target_counts: {},
        },
        last_bundle: latestBundles.scoped_last_bundle,
        global_last_bundle: latestBundles.global_last_bundle,
    };
    if (records.length === 0) {
        return hydrateSftSummaryFromLatestBundle(summary);
    }
    const { samples } = (0, candidate_builder_1.buildCanonicalCandidatesFromRecordsSync)(records, {
        cwd: root,
        minScore: 90,
    });
    summary.total_candidates = samples.length;
    summary.target_availability = buildTargetAvailability(samples);
    summary.rejection_reasons = countRejectionReasons(samples);
    const redactionSummary = (0, validation_report_1.buildDatasetRedactionSummary)(samples);
    summary.redaction_status_counts = redactionSummary.status_counts;
    summary.redaction_applied_rules = redactionSummary.applied_rules;
    summary.redaction_finding_kinds = redactionSummary.finding_kinds;
    summary.duplicate_summary = (0, dataset_analytics_1.buildDatasetDuplicateSummary)(samples);
    summary.balance_summary = (0, dataset_analytics_1.buildDatasetBalanceSummary)(samples);
    summary.training_view_summary = (0, dataset_analytics_1.buildDatasetTrainingViewSummary)(samples);
    summary.redaction_preview = (0, validation_report_1.buildDatasetRedactionPreview)(samples).map((item) => ({
        sample_id: item.sample_id,
        status: normalizeRedactionPreviewStatus(item.status),
        applied_rules: item.applied_rules,
        finding_kinds: item.finding_kinds,
        ...(item.rejection_reasons ? { rejection_reasons: item.rejection_reasons } : {}),
    }));
    for (const sample of samples) {
        if (sample.quality.acceptance_decision === 'accepted')
            summary.accepted += 1;
        if (sample.quality.acceptance_decision === 'rejected')
            summary.rejected += 1;
        if (sample.quality.acceptance_decision === 'downgraded')
            summary.downgraded += 1;
        if (sample.quality.training_ready)
            summary.training_ready_candidates += 1;
        summary.by_split[sample.split.assignment] += 1;
    }
    return hydrateSftSummaryFromLatestBundle(summary);
}
function buildRuntimeDashboardModel(input) {
    const options = input.options ?? {};
    const root = input.root ?? options.root ?? process.cwd();
    const scoreRecords = input.scoreRecords.filter((record) => record.scenario !== 'eval_question');
    const projections = buildRuntimeProjections(input.events);
    const selectedProjection = selectRuntimeProjection(projections);
    const selectedScoreRecords = resolveSelectedScoreRecords(scoreRecords, options, selectedProjection);
    const workboardScoreRecords = resolveWorkboardScoreRecords(scoreRecords, selectedScoreRecords);
    const selectedRunId = selectedProjection?.run_id ??
        (selectedScoreRecords.length > 0
            ? ([...new Set(selectedScoreRecords.map((record) => record.run_id))][0] ?? null)
            : null);
    const workboardResolution = buildWorkboard(input.events, projections, workboardScoreRecords, selectedRunId, {
        workItemId: options.workItemId,
        boardGroupId: options.boardGroupId,
    });
    const workboard = workboardResolution.payload;
    const activeWorkItem = workboardResolution.active_work_item;
    const activeWorkItemScoreRecords = filterScoreRecordsForActiveWorkItem(workboardScoreRecords, activeWorkItem);
    const detailSourceRecords = activeWorkItemScoreRecords.length > 0 ? activeWorkItemScoreRecords : selectedScoreRecords;
    const scoreDetailRecords = buildScoreDetailRecords(detailSourceRecords);
    const scoreFindings = detailSourceRecords
        .flatMap((record) => buildScoreFindings(record))
        .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
    const runtimeContext = selectedProjection
        ? {
            run_id: selectedProjection.run_id,
            status: selectedProjection.status,
            current_stage: selectedProjection.current_stage,
            flow: selectedProjection.current_scope?.flow ?? null,
            scope: selectedProjection.current_scope,
            last_event_at: selectedProjection.last_event_at,
            reviewer_contract: buildDashboardReviewerProjection({
                flow: selectedProjection.current_scope?.flow ?? null,
                stage: selectedProjection.current_stage,
            }).reviewerContract,
            latest_reviewer_closeout: loadLatestReviewerCloseoutFromRoot(root),
            work_item: null,
        }
        : buildSyntheticRuntimeContext(scoreDetailRecords);
    const executionState = buildExecutionStateSummary(root, activeWorkItem, runtimeContext);
    const selection = {
        run_id: selectedRunId,
        source: selectedProjection ? 'runtime' : selectedScoreRecords.length > 0 ? 'scores' : 'none',
        has_runtime: selectedProjection != null,
        has_scores: selectedScoreRecords.length > 0,
    };
    if (runtimeContext) {
        runtimeContext.latest_reviewer_closeout =
            runtimeContext.latest_reviewer_closeout ?? loadLatestReviewerCloseoutFromRoot(root);
        runtimeContext.work_item = activeWorkItem
            ? {
                work_item_id: activeWorkItem.work_item_id,
                work_item_type: activeWorkItem.work_item_type,
                artifact_scope: activeWorkItem.artifact_scope,
                board_group_id: activeWorkItem.board_group_id,
                board_group_label: activeWorkItem.board_group_label,
                linked_story_key: activeWorkItem.linked_story_key ?? null,
            }
            : null;
    }
    selection.work_item_id = activeWorkItem?.work_item_id ?? null;
    selection.board_group_id = workboard.active_board_group_id;
    const readinessCarrierRecord = detailSourceRecords.length > 0
        ? (selectedScoreRecords.find((record) => record.run_id === detailSourceRecords[0].run_id &&
            record.stage === detailSourceRecords[0].stage &&
            record.timestamp === detailSourceRecords[0].timestamp) ?? null)
        : null;
    const readinessProjection = (0, readiness_drift_1.buildReadinessDriftProjection)({
        currentRecord: readinessCarrierRecord ?? null,
        allRecords: scoreRecords,
    });
    const stageTimeline = buildStageTimeline(selectedProjection, scoreDetailRecords, activeWorkItem);
    const sftSummary = buildSftSummary(selectedScoreRecords, root, activeWorkItem, workboard.active_board_group_id ?? null);
    return {
        generated_at: new Date().toISOString(),
        selection,
        six_model_projection: (0, six_model_projection_1.buildSixMentalModelProjection)({
            runtimeContext,
            executionState,
            stageTimeline,
            scoreDetail: {
                run_id: selectedRunId,
                records: scoreDetailRecords,
                findings: scoreFindings,
            },
            workboard,
        }),
        overview: {
            status: runtimeContext.status,
            health_score: selectedScoreRecords.length > 0 ? (0, compute_1.computeHealthScore)(selectedScoreRecords) : null,
            trend: (0, compute_1.getTrend)(scoreRecords),
            veto_count: countVetoTriggeredRecords(selectedScoreRecords),
            dimensions: selectedScoreRecords.length > 0
                ? (0, compute_1.getDimensionScores)(selectedScoreRecords)
                : ['功能性', '代码质量', '测试覆盖', '安全性'].map((dimension) => ({
                    dimension,
                    score: '无数据',
                })),
            weak_top3: (0, compute_1.getWeakTop3)(selectedScoreRecords),
            high_iteration_top3: (0, compute_1.getHighIterationTop3)(selectedScoreRecords),
            score_record_count: selectedScoreRecords.length,
            last_updated_at: runtimeContext.last_event_at ?? scoreDetailRecords[0]?.timestamp ?? null,
        },
        runtime_context: runtimeContext,
        execution_state: executionState,
        stage_timeline: stageTimeline,
        score_detail: {
            run_id: selectedRunId,
            records: scoreDetailRecords,
            findings: scoreFindings,
        },
        readiness_projection: readinessProjection,
        sft_summary: sftSummary,
        workboard,
    };
}
function queryRuntimeDashboard(options = {}) {
    const explicitRoot = options.root ?? process.cwd();
    const root = inferRuntimeRootFromDataPath(options.dataPath, explicitRoot);
    const events = (0, event_store_1.readRuntimeEvents)({ root });
    const scoreRecords = (0, loader_1.loadAndDedupeRecords)(resolveDashboardDataPath(root, options.dataPath));
    return buildRuntimeDashboardModel({
        root,
        events,
        scoreRecords,
        options: {
            ...options,
            root,
        },
    });
}
