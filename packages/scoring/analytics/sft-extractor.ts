/**
 * Story 5.5 B07 / Story 7.2: SFT 微调数据集提取
 * 兼容层：对外继续输出 legacy instruction/input/output JSONL，
 * 但内部候选构建与质量门禁改由 canonical pipeline 负责。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseEpicStoryFromRecord } from '../query';
import { loadAndDedupeRecords } from '../query/loader';
import { getGitHeadHashFull } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';
import { buildCanonicalCandidatesFromRecords } from './candidate-builder';
import {
  extractBugfixSections,
  extractInstruction,
  parseDiffToInputOutput,
} from './canonical-sample';
import type { CanonicalMessage, CanonicalSftSample } from './types';

export interface SftEntry {
  instruction: string;
  input: string;
  output: string;
  source_run_id: string;
  base_commit_hash: string;
  has_code_pair: boolean;
  source_path?: string;
}

export interface SftExtractSummary {
  n: number;
  m: number;
  k: number;
  skipReasons: Record<string, number>;
}

export interface ExtractSftDatasetOptions {
  /** Minimum phase_score for inclusion (default 90). Records with phase_score >= minScore are extracted. */
  minScore?: number;
}

function resolveDataPath(dataPath: string): string {
  return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}

function resolveOutputPath(basePath: string, outputPath?: string): string {
  if (outputPath == null || outputPath === '') {
    return path.join(basePath, 'sft-dataset.jsonl');
  }
  return path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
}

function loadRecordsFromDataPath(dataPath: string): RunScoreRecord[] {
  return loadAndDedupeRecords(resolveDataPath(dataPath));
}

function resolveSourcePath(sourcePath: string, cwd: string): string {
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(cwd, sourcePath);
}

function readSourceArtifact(sourcePath: string, cwd: string): string | null {
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
  } catch {
    return null;
  }
}

function verifyBaseCommitHash(baseCommitHash: string, cwd: string): boolean {
  try {
    execSync(`git rev-parse --verify ${baseCommitHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
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
export function gitDiffBetween(hash1: string, hash2: string, cwd?: string): string {
  const workDir = cwd ?? process.cwd();
  const fullHash2 = hash2 === 'HEAD' ? getGitHeadHashFull(workDir) : hash2;
  if (!fullHash2) throw new Error('git rev-parse HEAD failed');
  try {
    execSync(`git rev-parse --verify ${hash1}`, {
      cwd: workDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`git rev-parse --verify ${hash1} failed`);
  }
  return execSync(`git diff ${hash1} ${fullHash2}`, {
    cwd: workDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function incSkip(reasons: Record<string, number>, key: string): void {
  reasons[key] = (reasons[key] ?? 0) + 1;
}

function dedupeEntries(entries: SftEntry[]): SftEntry[] {
  const seen = new Set<string>();
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

function countUniqueStories(entries: SftEntry[]): number {
  const keys = new Set<string>();
  for (const entry of entries) {
    const pseudo: RunScoreRecord = {
      run_id: entry.source_run_id,
      source_path: entry.source_path,
    } as RunScoreRecord;
    const parsed = parseEpicStoryFromRecord(pseudo);
    if (parsed) {
      keys.add(`${parsed.epicId}.${parsed.storyId}`);
    }
  }
  return keys.size;
}

function formatSummary(summary: SftExtractSummary): string {
  const reasons =
    Object.keys(summary.skipReasons).length > 0
      ? Object.entries(summary.skipReasons)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')
      : '无';
  return `共提取 ${summary.n} 条，覆盖 ${summary.m} 个 Story；跳过 ${summary.k} 条（原因：${reasons}）`;
}

function contentToString(content: CanonicalMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => part.text).join('\n');
}

function getFirstMessage(sample: CanonicalSftSample, role: CanonicalMessage['role']): CanonicalMessage | undefined {
  return sample.messages.find((message) => message.role === role);
}

function getMetadataString(message: CanonicalMessage | undefined, key: string): string | null {
  const value = message?.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function stripPatchLocationHeaders(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('File: ') && !line.startsWith('Hunk: '))
    .join('\n')
    .trim();
}

function extractLegacyInstructionAndInput(userMessage: CanonicalMessage | undefined): {
  instruction: string;
  input: string;
} {
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

function toLegacyEntry(sample: CanonicalSftSample): SftEntry {
  const userMessage = getFirstMessage(sample, 'user');
  const assistantMessage = getFirstMessage(sample, 'assistant');
  const legacy = extractLegacyInstructionAndInput(userMessage);
  const output =
    stripPatchLocationHeaders(
      getMetadataString(assistantMessage, 'legacy_output') ??
        (assistantMessage ? contentToString(assistantMessage.content).trim() : '')
    );

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

function isLegacyInstructionOnlyCompatible(sample: CanonicalSftSample): boolean {
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

function collectPrevalidationSkipReason(
  record: RunScoreRecord,
  cwd: string,
  minScore: number,
  skipReasons: Record<string, number>
): boolean {
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

  const bugfixSections = extractBugfixSections(sourceContent);
  const instruction = extractInstruction(sourceContent);
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
export async function extractSftDataset(
  dataPath?: string,
  outputPath?: string,
  options?: ExtractSftDatasetOptions
): Promise<{ entries: SftEntry[]; summary: SftExtractSummary }> {
  const minScore = options?.minScore ?? 90;
  const basePath = resolveDataPath(dataPath ?? path.join(process.cwd(), 'packages', 'scoring', 'data'));
  const outPath = resolveOutputPath(basePath, outputPath);
  const cwd = process.cwd();
  const skipReasons: Record<string, number> = {};

  const records = loadRecordsFromDataPath(basePath);
  const candidateRecords = records.filter((record) =>
    collectPrevalidationSkipReason(record, cwd, minScore, skipReasons)
  );

  const { samples } = await buildCanonicalCandidatesFromRecords(candidateRecords, {
    cwd,
    minScore,
  });

  const entries: SftEntry[] = [];
  for (const sample of samples) {
    if (
      sample.quality.acceptance_decision === 'rejected' &&
      !isLegacyInstructionOnlyCompatible(sample)
    ) {
      incSkip(skipReasons, sample.quality.rejection_reasons[0] ?? 'canonical_rejected');
      continue;
    }
    entries.push(toLegacyEntry(sample));
  }

  const dedupedEntries = dedupeEntries(entries);
  const summary: SftExtractSummary = {
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

export { extractBugfixSections, formatSummary, parseDiffToInputOutput };
