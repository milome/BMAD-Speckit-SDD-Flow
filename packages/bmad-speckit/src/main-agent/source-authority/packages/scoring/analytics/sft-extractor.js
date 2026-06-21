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
exports.parseDiffToInputOutput = exports.extractBugfixSections = void 0;
exports.gitDiffBetween = gitDiffBetween;
exports.extractSftDataset = extractSftDataset;
exports.formatSummary = formatSummary;
/**
 * Story 5.5 B07 / Story 7.2: SFT 微调数据集提取
 * 兼容层：对外继续输出 legacy instruction/input/output JSONL，
 * 但内部候选构建与质量门禁改由 canonical pipeline 负责。
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const query_1 = require("../query");
const loader_1 = require("../query/loader");
const path_1 = require("../constants/path");
const hash_1 = require("../utils/hash");
const candidate_builder_1 = require("./candidate-builder");
const canonical_sample_1 = require("./canonical-sample");
Object.defineProperty(exports, "extractBugfixSections", { enumerable: true, get: function () { return canonical_sample_1.extractBugfixSections; } });
Object.defineProperty(exports, "parseDiffToInputOutput", { enumerable: true, get: function () { return canonical_sample_1.parseDiffToInputOutput; } });
function resolveDataPath(dataPath) {
    return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}
function resolveOutputPath(basePath, outputPath) {
    if (outputPath == null || outputPath === '') {
        return path.join(basePath, 'sft-dataset.jsonl');
    }
    return path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
}
function loadRecordsFromDataPath(dataPath) {
    return (0, loader_1.loadAndDedupeRecords)(resolveDataPath(dataPath));
}
function resolveSourcePath(sourcePath, cwd) {
    return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(cwd, sourcePath);
}
function readSourceArtifact(sourcePath, cwd) {
    const resolved = resolveSourcePath(sourcePath, cwd);
    if (!fs.existsSync(resolved)) {
        return null;
    }
    try {
        const content = fs.readFileSync(resolved, 'utf-8');
        if (resolved.endsWith('.json')) {
            JSON.parse(content);
        }
        return content;
    }
    catch {
        return null;
    }
}
function verifyBaseCommitHash(baseCommitHash, cwd) {
    try {
        (0, node_child_process_1.execSync)(`git rev-parse --verify ${baseCommitHash}`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 执行 git diff 获取两个 commit 之间的差异。
 * 短 hash 会通过 git rev-parse --verify 验证唯一性。
 * 使用 getGitHeadHashFull 获取 40 位 HEAD 作为 hash2。
 * @param {string} hash1 - 起始 commit hash
 * @param {string} hash2 - 结束 commit hash（可为 HEAD）
 * @param {string} [cwd] - 工作目录
 * @returns {string} git diff 输出
 */
function gitDiffBetween(hash1, hash2, cwd) {
    const workDir = cwd ?? process.cwd();
    const fullHash2 = hash2 === 'HEAD' ? (0, hash_1.getGitHeadHashFull)(workDir) : hash2;
    if (!fullHash2)
        throw new Error('git rev-parse HEAD failed');
    try {
        (0, node_child_process_1.execSync)(`git rev-parse --verify ${hash1}`, {
            cwd: workDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch {
        throw new Error(`git rev-parse --verify ${hash1} failed`);
    }
    return (0, node_child_process_1.execSync)(`git diff ${hash1} ${fullHash2}`, {
        cwd: workDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}
function incSkip(reasons, key) {
    reasons[key] = (reasons[key] ?? 0) + 1;
}
function dedupeEntries(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
        const sourcePath = entry.source_path ?? '';
        const key = `${entry.source_run_id}|${entry.base_commit_hash}|${sourcePath}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function countUniqueStories(entries) {
    const keys = new Set();
    for (const entry of entries) {
        const pseudo = {
            run_id: entry.source_run_id,
            source_path: entry.source_path,
        };
        const parsed = (0, query_1.parseEpicStoryFromRecord)(pseudo);
        if (parsed) {
            keys.add(`${parsed.epicId}.${parsed.storyId}`);
        }
    }
    return keys.size;
}
function formatSummary(summary) {
    const reasons = Object.keys(summary.skipReasons).length > 0
        ? Object.entries(summary.skipReasons)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ')
        : '无';
    return `共提取 ${summary.n} 条，覆盖 ${summary.m} 个 Story；跳过 ${summary.k} 条（原因：${reasons}）`;
}
function contentToString(content) {
    if (typeof content === 'string') {
        return content;
    }
    return content.map((part) => part.text).join('\n');
}
function getFirstMessage(sample, role) {
    return sample.messages.find((message) => message.role === role);
}
function getMetadataString(message, key) {
    const value = message?.metadata?.[key];
    return typeof value === 'string' ? value : null;
}
function stripPatchLocationHeaders(content) {
    return content
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('File: ') && !line.startsWith('Hunk: '))
        .join('\n')
        .trim();
}
function extractLegacyInstructionAndInput(userMessage) {
    const legacyInstruction = getMetadataString(userMessage, 'legacy_instruction');
    const legacyInput = getMetadataString(userMessage, 'legacy_input');
    if (legacyInstruction != null || legacyInput != null) {
        return {
            instruction: legacyInstruction ?? '',
            input: stripPatchLocationHeaders(legacyInput ?? ''),
        };
    }
    const content = userMessage ? contentToString(userMessage.content).trim() : '';
    const marker = '\n\nCurrent implementation:\n';
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) {
        return { instruction: content, input: '' };
    }
    return {
        instruction: content.slice(0, markerIndex).trim(),
        input: content.slice(markerIndex + marker.length).trim(),
    };
}
function toLegacyEntry(sample) {
    const userMessage = getFirstMessage(sample, 'user');
    const assistantMessage = getFirstMessage(sample, 'assistant');
    const legacy = extractLegacyInstructionAndInput(userMessage);
    const output = stripPatchLocationHeaders(getMetadataString(assistantMessage, 'legacy_output') ??
        (assistantMessage ? contentToString(assistantMessage.content).trim() : ''));
    return {
        instruction: legacy.instruction,
        input: legacy.input,
        output,
        source_run_id: sample.source.run_id,
        base_commit_hash: sample.provenance.base_commit_hash ?? '',
        has_code_pair: sample.quality.has_code_pair,
        source_path: sample.provenance.source_path ?? undefined,
    };
}
function isLegacyInstructionOnlyCompatible(sample) {
    if (sample.quality.training_blockers && sample.quality.training_blockers.length > 0) {
        return false;
    }
    if (sample.quality.has_code_pair) {
        return false;
    }
    const reasons = new Set(sample.quality.rejection_reasons);
    if (reasons.size === 0) {
        return false;
    }
    for (const reason of reasons) {
        if (reason !== 'missing_assistant_target' && reason !== 'missing_code_pair') {
            return false;
        }
    }
    return true;
}
function collectPrevalidationSkipReason(record, cwd, minScore, skipReasons) {
    if (record.phase_score < minScore || record.scenario !== 'real_dev') {
        return false;
    }
    const sourcePath = record.source_path;
    if (!sourcePath) {
        incSkip(skipReasons, '无 source_path');
        return false;
    }
    const baseCommitHash = record.base_commit_hash;
    if (!baseCommitHash) {
        incSkip(skipReasons, '无 base_commit_hash');
        return false;
    }
    const resolvedSourcePath = resolveSourcePath(sourcePath, cwd);
    if (!fs.existsSync(resolvedSourcePath)) {
        incSkip(skipReasons, 'source_path 不存在');
        return false;
    }
    const sourceContent = readSourceArtifact(sourcePath, cwd);
    if (sourceContent == null) {
        incSkip(skipReasons, '无法读取 source_path');
        return false;
    }
    const bugfixSections = (0, canonical_sample_1.extractBugfixSections)(sourceContent);
    const instruction = (0, canonical_sample_1.extractInstruction)(sourceContent);
    if (!instruction || (!bugfixSections && instruction.trim().length < 20)) {
        incSkip(skipReasons, '无 §1/§4 且审计报告解析失败');
        return false;
    }
    if (!verifyBaseCommitHash(baseCommitHash, cwd)) {
        incSkip(skipReasons, 'base_commit_hash 不可验证');
        return false;
    }
    return true;
}
/**
 * 从 scoring data 提取 legacy SFT 数据集。
 * 仅导出 canonical pipeline 判定为 accepted/downgraded 的样本；
 * rejected 样本只计入 summary.skipReasons。
 * @param {string} [dataPath] - Optional scoring data path
 * @param {string} [outputPath] - Optional output JSONL path
 * @param {ExtractSftDatasetOptions} [options] - Extraction options
 * @returns {Promise<{ entries: SftEntry[]; summary: SftExtractSummary }>} Extracted dataset and summary
 */
async function extractSftDataset(dataPath, outputPath, options) {
    const minScore = options?.minScore ?? 90;
    const basePath = resolveDataPath(dataPath ?? (0, path_1.getScoringDataPath)());
    const outPath = resolveOutputPath(basePath, outputPath);
    const cwd = process.cwd();
    const skipReasons = {};
    const records = loadRecordsFromDataPath(basePath);
    const candidateRecords = records.filter((record) => collectPrevalidationSkipReason(record, cwd, minScore, skipReasons));
    const { samples } = await (0, candidate_builder_1.buildCanonicalCandidatesFromRecords)(candidateRecords, {
        cwd,
        minScore,
    });
    const entries = [];
    for (const sample of samples) {
        if (sample.quality.acceptance_decision === 'rejected' &&
            !isLegacyInstructionOnlyCompatible(sample)) {
            incSkip(skipReasons, sample.quality.rejection_reasons[0] ?? 'canonical_rejected');
            continue;
        }
        entries.push(toLegacyEntry(sample));
    }
    const dedupedEntries = dedupeEntries(entries);
    const summary = {
        n: dedupedEntries.length,
        m: countUniqueStories(dedupedEntries),
        k: Object.values(skipReasons).reduce((sum, count) => sum + count, 0),
        skipReasons,
    };
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const jsonlContent = dedupedEntries.map((entry) => JSON.stringify(entry)).join('\n');
    if (jsonlContent) {
        fs.writeFileSync(outPath, `${jsonlContent}\n`, 'utf-8');
    }
    return { entries: dedupedEntries, summary };
}
