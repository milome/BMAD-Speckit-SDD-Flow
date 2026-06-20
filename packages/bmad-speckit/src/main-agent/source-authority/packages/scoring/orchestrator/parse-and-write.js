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
exports.validateIterationCount = validateIterationCount;
exports.parseAndWriteScore = parseAndWriteScore;
/**
 * Story 3.3: parseAndWriteScore 编排
 * Story 4.1: 集成 applyTierAndVeto，在写入前应用 veto 与阶梯系数
 * GAP-B01: 支持 base_commit_hash + content_hash 版本追溯
 * Story 9.4: 支持 iterationReportPaths 解析失败轮报告并写入 iteration_records
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_crypto_1 = require("node:crypto");
const parsers_1 = require("../parsers");
const dimension_contracts_1 = require("../contracts/dimension-contracts");
const loader_1 = require("../query/loader");
const writer_1 = require("../writer");
const veto_1 = require("../veto");
const readiness_drift_1 = require("../governance/readiness-drift");
const path_1 = require("../constants/path");
const hash_1 = require("../utils/hash");
const patch_snapshot_1 = require("../utils/patch-snapshot");
const runtime_1 = require("../runtime");
function resolveScoreDataPath(dataPath) {
    if (dataPath == null || dataPath === '') {
        return (0, path_1.getScoringDataPath)();
    }
    return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}
function inferRuntimeRootFromDataPath(dataPath) {
    if (dataPath == null || dataPath === '') {
        return process.cwd();
    }
    const resolved = resolveScoreDataPath(dataPath);
    const normalized = resolved.replace(/\\/g, '/');
    const knownSuffixes = ['/packages/scoring/data', '/_bmad-output/scoring'];
    for (const suffix of knownSuffixes) {
        if (normalized.endsWith(suffix)) {
            return resolved.slice(0, resolved.length - suffix.length);
        }
    }
    return resolved;
}
/**
 * 校验并规范化 iteration_count：非负则 clamp 为 0，非整数则 Math.round。
 * @param {number} value - Raw iteration count (may be negative or fractional).
 * @returns {number} Normalized non-negative integer (0 if value < 0, else Math.round(value)).
 */
function validateIterationCount(value) {
    if (value < 0)
        return 0;
    return Math.round(value);
}
function computeWeightedDimensionScore(scores) {
    const weighted = scores.reduce((sum, current) => sum + (current.score * current.weight) / 100, 0);
    return Math.round(weighted * 100) / 100;
}
const JOURNEY_CONTRACT_SIGNAL_BY_ITEM_ID = {
    journey_smoke_chain: 'smoke_task_chain',
    journey_closure_task: 'closure_task_id',
    journey_unlock_contract: 'journey_unlock',
    journey_gap_split_contract: 'gap_split_contract',
    shared_path_reference: 'shared_path_reference',
};
function deriveJourneyContractSignals(checkItems) {
    const signals = {};
    for (const item of checkItems) {
        if (item.passed)
            continue;
        const signalKey = JOURNEY_CONTRACT_SIGNAL_BY_ITEM_ID[item.item_id];
        if (signalKey) {
            signals[signalKey] = true;
        }
    }
    return Object.keys(signals).length > 0 ? signals : undefined;
}
function deriveStructuredDriftSignals(content) {
    const block = (0, parsers_1.extractStructuredDriftSignalBlock)(content);
    if (!block.present) {
        return { blockPresent: false };
    }
    const signals = {};
    for (const entry of block.entries) {
        if (!entry.triggered)
            continue;
        signals[entry.signal] = true;
    }
    return {
        blockPresent: true,
        ...(Object.keys(signals).length > 0 ? { signals } : {}),
    };
}
/** Story 9.4: 从问题清单解析最高严重等级 */
const SEVERITY_ORDER = ['fatal', 'serious', 'normal', 'minor'];
function severityTokenToIndex(raw) {
    const t = raw.trim().toLowerCase();
    if (/致命|fatal|critical/.test(t))
        return 0;
    if (/高|high|serious/.test(t))
        return 1;
    if (/中|medium|normal/.test(t))
        return 2;
    return 3; // 低|low|minor
}
function parseMaxSeverityFromReport(content) {
    const zhMatches = content.matchAll(/\[严重程度:([^\]]+)\]/g);
    const enMatches = content.matchAll(/\[Severity:([^\]]+)\]/gi);
    let maxIdx = SEVERITY_ORDER.indexOf('normal');
    for (const m of zhMatches) {
        const idx = severityTokenToIndex(m[1] ?? '');
        if (idx < maxIdx)
            maxIdx = idx;
    }
    for (const m of enMatches) {
        const idx = severityTokenToIndex(m[1] ?? '');
        if (idx < maxIdx)
            maxIdx = idx;
    }
    return SEVERITY_ORDER[maxIdx];
}
/**
 * T1: implement 阶段 source_path 写入逻辑。
 * - stage=implement + artifactDocPath 含 BUGFIX → source_path=artifactDocPath
 * - stage=implement + artifactDocPath 非 BUGFIX（如 tasks）→ source_path=reportPath
 * - stage=implement + artifactDocPath 未传入 → 不写 source_path
 * - 其他 stage：artifactDocPath 传入则 source_path=artifactDocPath
 * @param {AuditStage} stage - 审计阶段
 * @param {string | undefined} artifactDocPath - 触发评分的源文档路径
 * @param {string | undefined} reportPath - 审计报告路径
 * @returns {{ source_path?: string }} 包含 source_path 的对象，可能为空
 */
function computeSourcePath(stage, artifactDocPath, reportPath) {
    if (artifactDocPath == null)
        return {};
    if (stage === 'implement') {
        if (/BUGFIX/i.test(artifactDocPath))
            return { source_path: artifactDocPath };
        if (reportPath != null)
            return { source_path: reportPath };
        return {};
    }
    return { source_path: artifactDocPath };
}
/**
 * Story 9.4: 从失败轮报告解析为 IterationRecord
 * @param {string} filePath - 失败轮报告文件路径
 * @param {string} content - 报告内容
 * @param {AuditStage} stage - 审计阶段
 * @returns {IterationRecord} 迭代记录对象
 */
function parseIterationReportToRecord(filePath, content, stage) {
    const stat = fs.statSync(filePath);
    const timestamp = stat.mtime.toISOString();
    const overallGrade = (0, parsers_1.extractOverallGrade)(content);
    const dimensionScores = (0, parsers_1.parseDimensionScores)(content, (0, parsers_1.stageToMode)(stage));
    const severity = parseMaxSeverityFromReport(content);
    return {
        timestamp,
        result: 'fail',
        severity,
        overall_grade: overallGrade ?? undefined,
        dimension_scores: dimensionScores.length > 0 ? dimensionScores : undefined,
    };
}
/**
 * 解析审计报告并写入 scoring 存储。
 * 写入前应用 veto 与阶梯系数（Story 4.1）；reportPath 与 content 二选一。
 * 自动采集 base_commit_hash（git HEAD）和 content_hash（审计内容 SHA-256）。
 *
 * @param {ParseAndWriteScoreOptions} options - ParseAndWriteScoreOptions: stage, runId, scenario, writeMode required; reportPath or content required.
 * @returns {Promise<void>} Promise that resolves when write completes.
 * @throws Error when reportPath and content are both missing/empty.
 */
async function parseAndWriteScore(options) {
    const scopedConsoleError = console.error;
    const { stage, runId, scenario, writeMode, dataPath } = options;
    let content = options.content;
    let reportPath;
    if (options.reportPath) {
        reportPath = path.isAbsolute(options.reportPath)
            ? options.reportPath
            : path.resolve(process.cwd(), options.reportPath);
        content = fs.readFileSync(reportPath, 'utf-8');
    }
    if (content == null || content === '') {
        throw new Error('parseAndWriteScore: reportPath or content must be provided');
    }
    const record = await (0, parsers_1.parseAuditReport)({
        content,
        stage,
        runId,
        scenario,
    });
    const dimensionContract = (0, dimension_contracts_1.resolveScoringDimensionContract)({
        stage,
        dimensionMode: options.dimensionMode,
        dimensionContractId: options.dimensionContractId,
        expectedDimensions: options.expectedDimensions,
        atomicItemSetId: options.atomicItemSetId,
    });
    if (dimensionContract.status !== 'resolved' || !dimensionContract.dimensionMode) {
        throw new Error(`parseAndWriteScore: dimension contract ${dimensionContract.status}: ${dimensionContract.blockingReasons.join(', ')}`);
    }
    const dimensionScores = (0, parsers_1.parseDimensionScores)(content, dimensionContract.dimensionMode);
    let baseRecord = dimensionScores.length > 0
        ? {
            ...record,
            phase_score: computeWeightedDimensionScore(dimensionScores),
            dimension_scores: dimensionScores,
        }
        : record;
    if (options.host != null && options.host !== '') {
        baseRecord = {
            ...baseRecord,
            host: options.host,
        };
    }
    if (options.host_kind != null && options.host_kind !== '') {
        baseRecord = {
            ...baseRecord,
            host_kind: options.host_kind,
        };
    }
    if (options.provider_id != null && options.provider_id !== '') {
        baseRecord = {
            ...baseRecord,
            provider_id: options.provider_id,
        };
    }
    if (options.provider_mode != null && options.provider_mode !== '') {
        baseRecord = {
            ...baseRecord,
            provider_mode: options.provider_mode,
        };
    }
    if (options.tool_trace_ref != null && options.tool_trace_ref !== '') {
        baseRecord = {
            ...baseRecord,
            tool_trace_ref: options.tool_trace_ref,
        };
    }
    if (options.tool_trace_path != null && options.tool_trace_path !== '') {
        baseRecord = {
            ...baseRecord,
            tool_trace_path: options.tool_trace_path,
        };
    }
    if (options.iteration_count != null) {
        const validated = validateIterationCount(options.iteration_count);
        baseRecord = {
            ...baseRecord,
            iteration_count: validated,
            first_pass: validated === 0,
        };
    }
    const rawScore = baseRecord.phase_score;
    const { phase_score, veto_triggered, tier_coefficient } = (0, veto_1.applyTierAndVeto)({ ...baseRecord, raw_phase_score: rawScore }, { rulesDir: (0, path_1.resolveRulesDir)() });
    const gitCwd = options.gitCwd ?? process.cwd();
    const baseCommitHash = options.skipAutoHash
        ? options.baseCommitHash
        : (options.baseCommitHash ?? (0, hash_1.getGitHeadHash)(gitCwd));
    const contentHash = options.skipAutoHash ? undefined : (0, hash_1.computeStringHash)(content);
    let sourceHash;
    if (options.sourceHashFilePath) {
        const resolved = path.isAbsolute(options.sourceHashFilePath)
            ? options.sourceHashFilePath
            : path.resolve(process.cwd(), options.sourceHashFilePath);
        sourceHash = (0, hash_1.computeContentHash)(resolved);
    }
    let iterationRecords = [];
    if (options.scenario === 'real_dev' && options.iterationReportPaths?.length) {
        const failRecords = [];
        for (const p of options.iterationReportPaths) {
            const absPath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
            if (!fs.existsSync(absPath))
                continue;
            const iterContent = fs.readFileSync(absPath, 'utf-8');
            failRecords.push(parseIterationReportToRecord(absPath, iterContent, stage));
        }
        const mainOverallGrade = (0, parsers_1.extractOverallGrade)(content);
        const mainDimensionScores = (0, parsers_1.parseDimensionScores)(content, dimensionContract.dimensionMode);
        const passRecord = {
            timestamp: baseRecord.timestamp,
            result: 'pass',
            severity: 'normal',
            overall_grade: mainOverallGrade ?? undefined,
            dimension_scores: mainDimensionScores.length > 0 ? mainDimensionScores : baseRecord.dimension_scores,
        };
        iterationRecords = [...failRecords, passRecord];
    }
    const structuredDrift = stage === 'implement' || stage === 'post_impl'
        ? deriveStructuredDriftSignals(content)
        : { blockPresent: false };
    const journeyContractSignals = stage === 'implement' || stage === 'post_impl'
        ? structuredDrift.signals
        : deriveJourneyContractSignals(baseRecord.check_items);
    const resolvedDataPath = resolveScoreDataPath(dataPath);
    const priorRecords = (0, loader_1.loadAndDedupeRecords)(resolvedDataPath);
    const readinessDrift = (0, readiness_drift_1.evaluateReadinessDrift)({
        stage,
        signals: journeyContractSignals,
        signalBlockPresent: stage === 'implement' || stage === 'post_impl' ? structuredDrift.blockPresent : undefined,
        allRecords: priorRecords,
    });
    const patchSnapshot = (0, patch_snapshot_1.persistPatchSnapshot)({
        cwd: gitCwd,
        dataPath: resolvedDataPath,
        runId,
        stage,
        baseCommitHash,
    });
    const recordToWrite = {
        ...baseRecord,
        iteration_records: iterationRecords,
        phase_score,
        raw_phase_score: rawScore,
        veto_triggered,
        tier_coefficient,
        ...(journeyContractSignals != null ? { journey_contract_signals: journeyContractSignals } : {}),
        ...(readinessDrift.readiness_baseline_run_id != null
            ? { readiness_baseline_run_id: readinessDrift.readiness_baseline_run_id }
            : {}),
        ...(readinessDrift.drift_signals.length > 0
            ? { drift_signals: readinessDrift.drift_signals }
            : {}),
        ...(readinessDrift.drifted_dimensions.length > 0
            ? { drifted_dimensions: readinessDrift.drifted_dimensions }
            : {}),
        ...(readinessDrift.drift_severity !== 'none'
            ? { drift_severity: readinessDrift.drift_severity }
            : {}),
        ...(readinessDrift.re_readiness_required
            ? { re_readiness_required: readinessDrift.re_readiness_required }
            : {}),
        ...(readinessDrift.blocking_reason != null
            ? { blocking_reason: readinessDrift.blocking_reason }
            : {}),
        ...(readinessDrift.effective_verdict !== 'unknown'
            ? { effective_verdict: readinessDrift.effective_verdict }
            : {}),
        ...(options.question_version != null ? { question_version: options.question_version } : {}),
        ...(baseCommitHash != null ? { base_commit_hash: baseCommitHash } : {}),
        ...(contentHash != null ? { content_hash: contentHash } : {}),
        ...(sourceHash != null ? { source_hash: sourceHash } : {}),
        ...(patchSnapshot ?? {}),
        ...computeSourcePath(stage, options.artifactDocPath, reportPath),
        ...(options.triggerStage != null ? { trigger_stage: options.triggerStage } : {}),
        dimension_contract_id: dimensionContract.dimensionContractId ?? undefined,
        dimension_mode: dimensionContract.dimensionMode,
        expected_dimensions: dimensionContract.expectedDimensions,
        atomic_item_set_id: dimensionContract.atomicItemSetId ?? undefined,
    };
    if ((stage === 'implement' || stage === 'post_impl') && dimensionScores.length === 0) {
        const expectedEn = (0, parsers_1.listDimensionNamesEn)(dimensionContract.dimensionMode);
        const dimHint = expectedEn.length > 0
            ? expectedEn.join(', ')
            : 'Functionality, Code Quality, Test Coverage, Security';
        scopedConsoleError(`WARN: implement stage report has no parseable dimension_scores. Expected dimensions (name_en from modes.code): ${dimHint}. Check report parseable block matches modes.code.dimensions.`);
    }
    if ((stage === 'implement' || stage === 'post_impl') && structuredDrift.blockPresent === false) {
        scopedConsoleError('WARN: implement/post_impl stage report is missing Structured Drift Signal Block; implementation verdict is not trustworthy until re-readiness evidence is regenerated.');
    }
    if ((stage === 'implement' || stage === 'post_impl') &&
        readinessDrift.effective_verdict !== 'approved') {
        const blocker = readinessDrift.blocking_reason ?? 'Readiness drift requires another gated pass.';
        scopedConsoleError(`WARN: implement stage effective verdict is ${readinessDrift.effective_verdict}. ${blocker}`);
    }
    // BUGFIX_overall-grade-forbidden-ratings: 检测非法总体评级格式（A-、B+、C+、D- 等）
    const forbiddenModZh = content.match(/总体评级:\s*([ABCD][+-])/m);
    const forbiddenModEn = content.match(/Overall Grade:\s*([ABCD][+-])/im);
    const forbiddenModMatch = forbiddenModZh ?? forbiddenModEn;
    if (forbiddenModMatch) {
        const line = forbiddenModMatch[0];
        const snippet = line.length > 80 ? line.slice(0, 80) + '…' : line;
        scopedConsoleError(`WARN: audit report contains forbidden overall_grade modifier (e.g. B+ or A-). Expected: A, B, C, or D only. Content snippet: ${snippet}`);
    }
    (0, writer_1.writeScoreRecordSync)(recordToWrite, writeMode, dataPath != null ? { dataPath } : undefined);
    const scoreRecordPath = writeMode === 'jsonl'
        ? path.join(resolvedDataPath, 'scores.jsonl')
        : path.join(resolvedDataPath, `${runId}.json`);
    (0, runtime_1.appendRuntimeEvent)({
        event_id: (0, node_crypto_1.randomUUID)(),
        event_type: 'score.written',
        event_version: 1,
        timestamp: recordToWrite.timestamp,
        run_id: runId,
        flow: 'story',
        stage,
        payload: {
            score_record_id: `${runId}:${stage}`,
            path: scoreRecordPath,
            phase_score: recordToWrite.phase_score,
            veto_triggered: recordToWrite.veto_triggered ?? false,
        },
        source: {
            source_path: recordToWrite.source_path,
            base_commit_hash: recordToWrite.base_commit_hash,
            content_hash: recordToWrite.content_hash,
        },
    }, {
        root: inferRuntimeRootFromDataPath(dataPath),
    });
    return recordToWrite;
}
