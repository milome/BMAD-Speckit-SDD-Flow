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
exports.buildCanonicalCandidatesFromRecordsSync = buildCanonicalCandidatesFromRecordsSync;
exports.buildCanonicalCandidatesFromRecords = buildCanonicalCandidatesFromRecords;
exports.buildCanonicalCandidatesSync = buildCanonicalCandidatesSync;
exports.buildCanonicalCandidates = buildCanonicalCandidates;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const query_1 = require("../query");
const loader_1 = require("../query/loader");
const hash_1 = require("../utils/hash");
const patch_snapshot_1 = require("../utils/patch-snapshot");
const path_1 = require("../constants/path");
const canonical_sample_1 = require("./canonical-sample");
const quality_gates_1 = require("./quality-gates");
const redaction_1 = require("./redaction");
const dataset_analytics_1 = require("./dataset-analytics");
const split_1 = require("./split");
const tool_trace_1 = require("./tool-trace");
const CANONICAL_GENERATOR_VERSION = 'candidate-builder.v3';
const CANONICAL_SCHEMA_VERSION = 'canonical-sft-sample.v1';
function inferSampleKind(record, codePairs) {
    if (record.stage === 'implement' &&
        codePairs.some((pair) => pair.input.trim() || pair.output.trim())) {
        return 'implementation';
    }
    return 'documentation';
}
const sourceArtifactCache = new Map();
const diffCache = new Map();
const patchSnapshotCache = new Map();
const toolTraceCache = new Map();
const canonicalBuildCache = new Map();
function resolveSourcePath(sourcePath, cwd) {
    return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(cwd, sourcePath);
}
function readSourceArtifact(sourcePath, cwd) {
    const resolved = resolveSourcePath(sourcePath, cwd);
    if (resolved.endsWith('.tmp') || !fs.existsSync(resolved)) {
        return null;
    }
    try {
        const stats = fs.statSync(resolved);
        const cacheKey = `${resolved}::${stats.mtimeMs}::${stats.size}`;
        if (sourceArtifactCache.has(cacheKey)) {
            return sourceArtifactCache.get(cacheKey) ?? null;
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        if (resolved.endsWith('.json')) {
            JSON.parse(content);
        }
        sourceArtifactCache.set(cacheKey, content);
        return content;
    }
    catch {
        return null;
    }
}
function loadRuntimeDiff(baseCommitHash, cwd) {
    if (!baseCommitHash) {
        return null;
    }
    try {
        (0, node_child_process_1.execSync)(`git rev-parse --verify ${baseCommitHash}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const headHash = (0, hash_1.getGitHeadHashFull)(cwd);
        if (!headHash) {
            return null;
        }
        const cacheKey = `${path.resolve(cwd)}::${baseCommitHash}::${headHash}`;
        if (diffCache.has(cacheKey)) {
            return diffCache.get(cacheKey) ?? '';
        }
        const diff = (0, node_child_process_1.execSync)(`git diff ${baseCommitHash} ${headHash}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        diffCache.set(cacheKey, diff);
        return diff;
    }
    catch {
        return null;
    }
}
function createBuildCacheKey(records, cwd, options) {
    return JSON.stringify({
        cwd: path.resolve(cwd),
        minScore: options.minScore ?? 90,
        maxIterations: options.maxIterations ?? 3,
        maxTokens: options.maxTokens ?? 8192,
        requireCodePair: options.requireCodePair ?? false,
        splitSeed: options.splitSeed ?? 42,
        toolTracePath: options.toolTracePath ?? null,
        records: records.map((record) => ({
            run_id: record.run_id,
            stage: record.stage,
            scenario: record.scenario,
            phase_score: record.phase_score,
            iteration_count: record.iteration_count,
            timestamp: record.timestamp,
            source_path: record.source_path ?? null,
            base_commit_hash: record.base_commit_hash ?? null,
            content_hash: record.content_hash ?? null,
            source_hash: record.source_hash ?? null,
            patch_ref: record.patch_ref ?? null,
            patch_snapshot_path: record.patch_snapshot_path ?? null,
            tool_trace_ref: record.tool_trace_ref ?? null,
            tool_trace_path: record.tool_trace_path ?? null,
        })),
    });
}
function loadPatchSnapshot(record, cwd) {
    if (!record.patch_snapshot_path) {
        return null;
    }
    const cacheKey = `${record.patch_snapshot_path}::${record.patch_ref ?? 'no-ref'}`;
    const cached = patchSnapshotCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const patchContent = (0, patch_snapshot_1.readPatchSnapshot)(record.patch_snapshot_path, cwd);
    if (patchContent == null) {
        return null;
    }
    const result = {
        patchContent,
        patchRef: `sha256:${(0, hash_1.computeStringHash)(patchContent)}`,
    };
    patchSnapshotCache.set(cacheKey, result);
    return result;
}
function loadToolTrace(record, cwd) {
    const derived = record;
    if (!derived.tool_trace_path) {
        return null;
    }
    const cacheKey = `${derived.tool_trace_path}::${derived.tool_trace_ref ?? 'no-ref'}`;
    if (toolTraceCache.has(cacheKey)) {
        return toolTraceCache.get(cacheKey) ?? null;
    }
    const loaded = (0, tool_trace_1.readToolTraceArtifact)(derived.tool_trace_path, cwd);
    toolTraceCache.set(cacheKey, loaded);
    return loaded;
}
function normalizePatchPath(rawPath) {
    const trimmed = rawPath.trim();
    if (trimmed === '/dev/null') {
        return trimmed;
    }
    return trimmed.replace(/^[ab]\//, '');
}
function parsePatchContentToUnits(patchContent) {
    const units = [];
    const lines = patchContent.split(/\r?\n/);
    let currentFilePath = 'unknown';
    let currentHunkHeader = null;
    let currentHunkIndex = 0;
    let pendingOldPath = null;
    let currentChanges = [];
    const flushCurrentUnit = () => {
        if (currentChanges.length === 0) {
            return;
        }
        units.push({
            filePath: currentFilePath,
            hunkHeader: currentHunkHeader,
            unitKey: `${currentFilePath}#${currentHunkIndex || 0}:${currentHunkHeader ?? 'full'}`,
            changes: currentChanges,
        });
        currentChanges = [];
    };
    for (const line of lines) {
        const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (diffMatch) {
            flushCurrentUnit();
            pendingOldPath = normalizePatchPath(diffMatch[1]);
            currentFilePath = normalizePatchPath(diffMatch[2]);
            currentHunkHeader = null;
            currentHunkIndex = 0;
            continue;
        }
        if (line.startsWith('--- ')) {
            const oldPath = normalizePatchPath(line.slice(4));
            if (oldPath !== '/dev/null') {
                pendingOldPath = oldPath;
            }
            continue;
        }
        if (line.startsWith('+++ ')) {
            const newPath = normalizePatchPath(line.slice(4));
            currentFilePath = newPath !== '/dev/null' ? newPath : (pendingOldPath ?? currentFilePath);
            continue;
        }
        if (line.startsWith('@@')) {
            flushCurrentUnit();
            currentHunkHeader = line.trim();
            currentHunkIndex += 1;
            continue;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
            currentChanges.push({ kind: 'input', text: line.slice(1) });
            continue;
        }
        if (line.startsWith('+') && !line.startsWith('+++')) {
            currentChanges.push({ kind: 'output', text: line.slice(1) });
        }
    }
    flushCurrentUnit();
    return units;
}
function formatPatchCodePair(unit, changes, patchRef, chunkKey) {
    const headerLines = [`File: ${unit.filePath}`];
    if (unit.hunkHeader) {
        headerLines.push(`Hunk: ${unit.hunkHeader}`);
    }
    const header = headerLines.join('\n').trim();
    const inputBody = changes
        .filter((change) => change.kind === 'input')
        .map((change) => change.text)
        .join('\n')
        .trim();
    const outputBody = changes
        .filter((change) => change.kind === 'output')
        .map((change) => change.text)
        .join('\n')
        .trim();
    return {
        input: [header, inputBody].filter(Boolean).join('\n').trim(),
        output: [header, outputBody].filter(Boolean).join('\n').trim(),
        patchRef,
        chunkKey,
    };
}
function buildMessagesWithToolTrace(instruction, assistantTarget, codePair, toolTrace) {
    const assistantContent = codePair.output.trim() || assistantTarget.trim();
    const baseMessages = (0, canonical_sample_1.buildCanonicalMessages)(instruction, codePair.input, assistantContent);
    if (!toolTrace) {
        return baseMessages;
    }
    return [baseMessages[0], baseMessages[1], ...toolTrace.messages, baseMessages[2]];
}
function estimateCodePairTokens(instruction, assistantTarget, codePair, toolTrace) {
    return (0, canonical_sample_1.estimateCanonicalTokenCount)(buildMessagesWithToolTrace(instruction, assistantTarget, codePair, toolTrace), toolTrace?.tools);
}
function splitLongChangeToBudget(unit, change, instruction, assistantTarget, maxTokens, patchRef, chunkKeyPrefix, toolTrace) {
    const chunks = [];
    let remaining = change.text;
    let fragmentIndex = 0;
    while (remaining.length > 0) {
        let low = 1;
        let high = remaining.length;
        let best = 0;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const candidate = formatPatchCodePair(unit, [{ kind: change.kind, text: remaining.slice(0, mid) }], patchRef, `${chunkKeyPrefix}:fragment-${fragmentIndex}`);
            if (estimateCodePairTokens(instruction, assistantTarget, candidate, toolTrace) <= maxTokens) {
                best = mid;
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        const sliceLength = Math.max(1, best);
        chunks.push(formatPatchCodePair(unit, [{ kind: change.kind, text: remaining.slice(0, sliceLength) }], patchRef, `${chunkKeyPrefix}:fragment-${fragmentIndex}`));
        remaining = remaining.slice(sliceLength);
        fragmentIndex += 1;
    }
    return chunks;
}
function splitPatchUnitToBudget(unit, instruction, assistantTarget, maxTokens, patchRef, toolTrace) {
    const wholeUnit = formatPatchCodePair(unit, unit.changes, patchRef, `${unit.unitKey}:whole`);
    if (estimateCodePairTokens(instruction, assistantTarget, wholeUnit, toolTrace) <= maxTokens) {
        return [wholeUnit];
    }
    const slices = [];
    let start = 0;
    let sliceIndex = 0;
    while (start < unit.changes.length) {
        let end = start + 1;
        let bestEnd = 0;
        let bestPair = null;
        while (end <= unit.changes.length) {
            const candidate = formatPatchCodePair(unit, unit.changes.slice(start, end), patchRef, `${unit.unitKey}:slice-${sliceIndex}`);
            if (estimateCodePairTokens(instruction, assistantTarget, candidate, toolTrace) <= maxTokens) {
                bestEnd = end;
                bestPair = candidate;
                end += 1;
            }
            else {
                break;
            }
        }
        if (bestPair) {
            slices.push(bestPair);
            start = bestEnd;
            sliceIndex += 1;
            continue;
        }
        const currentChange = unit.changes[start];
        slices.push(...splitLongChangeToBudget(unit, currentChange, instruction, assistantTarget, maxTokens, patchRef, `${unit.unitKey}:slice-${sliceIndex}`, toolTrace));
        start += 1;
        sliceIndex += 1;
    }
    return slices;
}
function combineCodePairsToBudget(codePairs, instruction, assistantTarget, maxTokens, toolTrace) {
    if (codePairs.length === 0) {
        return [];
    }
    const combined = [];
    let current = codePairs[0];
    for (let index = 1; index < codePairs.length; index += 1) {
        const next = codePairs[index];
        const candidate = {
            input: [current.input, next.input].filter(Boolean).join('\n\n'),
            output: [current.output, next.output].filter(Boolean).join('\n\n'),
            patchRef: current.patchRef ?? next.patchRef ?? null,
            chunkKey: [current.chunkKey, next.chunkKey].filter(Boolean).join('|') || null,
        };
        if (estimateCodePairTokens(instruction, assistantTarget, candidate, toolTrace) <= maxTokens) {
            current = candidate;
            continue;
        }
        combined.push(current);
        current = next;
    }
    combined.push(current);
    return combined;
}
function buildCodePairsFromPatchContent(patchContent, instruction, assistantTarget, maxTokens, patchRef, toolTrace) {
    const patchUnits = parsePatchContentToUnits(patchContent);
    if (patchUnits.length === 0) {
        const parsed = (0, canonical_sample_1.parseDiffToInputOutput)(patchContent);
        return [
            {
                input: parsed.input,
                output: parsed.output,
                patchRef,
                chunkKey: null,
            },
        ];
    }
    const boundedPairs = patchUnits.flatMap((unit) => splitPatchUnitToBudget(unit, instruction, assistantTarget, maxTokens, patchRef, toolTrace));
    return combineCodePairsToBudget(boundedPairs, instruction, assistantTarget, maxTokens, toolTrace);
}
function resolveCodePairsForRecord(record, instruction, assistantTarget, cwd, maxTokens, toolTrace) {
    const patchSnapshot = loadPatchSnapshot(record, cwd);
    if (patchSnapshot) {
        return buildCodePairsFromPatchContent(patchSnapshot.patchContent, instruction, assistantTarget, maxTokens, patchSnapshot.patchRef, toolTrace);
    }
    const runtimeDiff = loadRuntimeDiff(record.base_commit_hash, cwd);
    if (runtimeDiff != null) {
        return buildCodePairsFromPatchContent(runtimeDiff, instruction, assistantTarget, maxTokens, null, toolTrace);
    }
    return [
        {
            input: '',
            output: '',
            patchRef: null,
            chunkKey: null,
        },
    ];
}
function isVetoTriggered(record) {
    const derived = record;
    if (derived.veto_triggered != null) {
        return derived.veto_triggered;
    }
    return record.check_items.some((item) => item.passed === false && item.item_id.startsWith('veto_'));
}
function latestGovernanceHistoryEntry(record) {
    const history = record.governance_rerun_history ?? [];
    if (history.length === 0) {
        return null;
    }
    return ([...history].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] ?? null);
}
function resolveCanonicalProviderFacts(record) {
    const derived = record;
    const latestGovernanceHistory = latestGovernanceHistoryEntry(record);
    const hostKind = record.host_kind ?? record.host ?? latestGovernanceHistory?.host_kind ?? undefined;
    return {
        providerId: derived.provider_id ??
            (typeof latestGovernanceHistory?.provider_id === 'string'
                ? latestGovernanceHistory.provider_id
                : undefined),
        providerMode: derived.provider_mode ??
            (typeof latestGovernanceHistory?.provider_mode === 'string'
                ? latestGovernanceHistory.provider_mode
                : undefined),
        hostKind,
    };
}
function buildCanonicalSample(record, sourceContent, instruction, assistantTarget, sampleKind, codePair, toolTrace, options) {
    const messages = buildMessagesWithToolTrace(instruction, assistantTarget, codePair, toolTrace);
    const parsedStory = (0, query_1.parseEpicStoryFromRecord)(record);
    const providerFacts = resolveCanonicalProviderFacts(record);
    const split = (0, split_1.assignDeterministicSplit)({
        seed: options.splitSeed ?? 42,
        groupKey: parsedStory
            ? `epic-${parsedStory.epicId}/story-${parsedStory.storyId}`
            : record.run_id,
    });
    const lineage = [record.run_id, `${record.run_id}:${record.stage}`];
    if (codePair.chunkKey) {
        lineage.push(`chunk:${codePair.chunkKey}`);
    }
    if (toolTrace) {
        lineage.push(`tool-trace:${toolTrace.traceRef}`);
    }
    const artifactRefs = [
        {
            path: record.source_path ?? 'unknown',
            content_hash: record.content_hash ?? (0, hash_1.computeStringHash)(sourceContent),
            source_hash: record.source_hash ?? (0, hash_1.computeStringHash)(sourceContent),
            kind: path.extname(record.source_path ?? '').replace('.', '') || 'artifact',
        },
    ];
    if (toolTrace) {
        artifactRefs.push({
            path: toolTrace.artifactPath,
            content_hash: toolTrace.traceRef,
            kind: 'tool_trace',
        });
    }
    const baseSample = {
        sample_id: (0, canonical_sample_1.buildCanonicalSampleId)({
            runId: record.run_id,
            stage: record.stage,
            sourcePath: record.source_path ?? null,
            baseCommitHash: record.base_commit_hash ?? null,
            instruction,
            input: codePair.input,
            chunkKey: codePair.chunkKey,
            traceRef: toolTrace?.traceRef ?? null,
            output: codePair.output || assistantTarget,
        }),
        sample_version: 'v1',
        source: {
            run_id: record.run_id,
            stage: record.stage,
            flow: 'story',
            epic_id: parsedStory ? `epic-${parsedStory.epicId}` : undefined,
            story_id: parsedStory ? `${parsedStory.storyId}` : undefined,
            story_slug: undefined,
            provider_id: providerFacts.providerId,
            provider_mode: providerFacts.providerMode,
            tool_trace_ref: toolTrace?.traceRef,
            event_ids: [`score:${record.run_id}:${record.stage}`],
            score_record_id: `${record.run_id}:${record.stage}`,
            artifact_refs: artifactRefs,
        },
        messages,
        ...(toolTrace ? { tools: toolTrace.tools } : {}),
        metadata: {
            schema_targets: toolTrace
                ? ['openai_chat', 'hf_tool_calling']
                : ['openai_chat', 'hf_conversational'],
            sample_kind: sampleKind,
            ...(record.host ? { host: record.host } : {}),
            ...(providerFacts.hostKind ? { host_kind: providerFacts.hostKind } : {}),
            language: 'zh-CN',
            notes: [
                codePair.input || codePair.output ? 'legacy_flat_compat' : 'legacy_instruction_only',
                ...(toolTrace ? ['tool_trace_injected'] : []),
                ...(toolTrace
                    ? [`tool_trace_summary=${JSON.stringify((0, tool_trace_1.summarizeToolTrace)(toolTrace))}`]
                    : []),
            ],
        },
        quality: {
            acceptance_decision: 'accepted',
            phase_score: record.phase_score,
            raw_phase_score: record.raw_phase_score ??
                record.phase_score,
            dimension_scores: record.dimension_scores
                ? Object.fromEntries(record.dimension_scores.map((score) => [score.dimension, score.score]))
                : undefined,
            trace_completeness: (0, tool_trace_1.computeTraceCompleteness)(toolTrace),
            training_ready: false,
            training_blockers: toolTrace ? [] : ['tool_trace_missing'],
            veto_triggered: isVetoTriggered(record),
            iteration_count: record.iteration_count,
            has_code_pair: codePair.input.length > 0 || codePair.output.length > 0,
            token_estimate: (0, canonical_sample_1.estimateCanonicalTokenCount)(messages, toolTrace?.tools),
            dedupe_cluster_id: null,
            safety_flags: [],
            rejection_reasons: [],
            warnings: [],
        },
        provenance: {
            base_commit_hash: record.base_commit_hash ?? null,
            content_hash: record.content_hash ?? (0, hash_1.computeStringHash)(sourceContent),
            source_hash: record.source_hash ?? (0, hash_1.computeStringHash)(sourceContent),
            source_path: record.source_path ?? null,
            patch_ref: codePair.patchRef,
            generator_version: CANONICAL_GENERATOR_VERSION,
            schema_version: CANONICAL_SCHEMA_VERSION,
            lineage,
            generated_at: new Date().toISOString(),
        },
        split,
        redaction: {
            status: 'clean',
            applied_rules: [],
            findings: [],
            redacted_fields: [],
        },
        export_compatibility: {
            openai_chat: { compatible: true, reasons: [], warnings: [] },
            hf_conversational: toolTrace
                ? { compatible: false, reasons: ['target_incompatible_hf_conversational'], warnings: [] }
                : { compatible: true, reasons: [], warnings: [] },
            hf_tool_calling: toolTrace
                ? { compatible: true, reasons: [], warnings: [] }
                : { compatible: false, reasons: ['target_incompatible_hf_tool_calling'], warnings: [] },
        },
    };
    return (0, quality_gates_1.applyQualityGates)((0, redaction_1.applyCanonicalRedaction)(baseSample), options);
}
function buildCanonicalSampleFromFixtureArtifact(artifact, record, options) {
    void record;
    void options;
    return artifact;
}
function buildCanonicalCandidatesFromRecordsSync(records, options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const buildCacheKey = createBuildCacheKey(records, cwd, options);
    const cached = canonicalBuildCache.get(buildCacheKey);
    if (cached) {
        return cached;
    }
    const samples = [];
    const maxTokens = options.maxTokens ?? 8192;
    for (const record of records) {
        if (record.scenario !== 'real_dev' || !record.source_path) {
            continue;
        }
        if (options.toolTracePath) {
            const resolvedToolTracePath = path.isAbsolute(options.toolTracePath)
                ? options.toolTracePath
                : path.resolve(cwd, options.toolTracePath);
            if (fs.existsSync(resolvedToolTracePath)) {
                try {
                    const toolTraceArtifact = JSON.parse(fs.readFileSync(resolvedToolTracePath, 'utf-8'));
                    samples.push(buildCanonicalSampleFromFixtureArtifact(toolTraceArtifact, record, options));
                    continue;
                }
                catch {
                    // Fall back to the source artifact path when fixture tool trace content is invalid.
                }
            }
        }
        const sourceContent = readSourceArtifact(record.source_path, cwd);
        if (sourceContent == null) {
            continue;
        }
        const instruction = (0, canonical_sample_1.extractInstruction)(sourceContent) ?? '';
        const assistantTarget = (0, canonical_sample_1.extractAssistantTarget)(sourceContent) ?? '';
        const toolTrace = loadToolTrace(record, cwd);
        const codePairs = resolveCodePairsForRecord(record, instruction, assistantTarget, cwd, maxTokens, toolTrace);
        const sampleKind = inferSampleKind(record, codePairs);
        for (const codePair of codePairs) {
            samples.push(buildCanonicalSample(record, sourceContent, instruction, assistantTarget, sampleKind, codePair, toolTrace, options));
        }
    }
    const result = { samples: (0, dataset_analytics_1.assignDedupeClusters)(samples) };
    canonicalBuildCache.set(buildCacheKey, result);
    return result;
}
async function buildCanonicalCandidatesFromRecords(records, options = {}) {
    return buildCanonicalCandidatesFromRecordsSync(records, options);
}
function buildCanonicalCandidatesSync(options = {}) {
    const dataPath = options.dataPath ?? (0, path_1.getScoringDataPath)();
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    return buildCanonicalCandidatesFromRecordsSync(records, options);
}
async function buildCanonicalCandidates(options = {}) {
    return buildCanonicalCandidatesSync(options);
}
