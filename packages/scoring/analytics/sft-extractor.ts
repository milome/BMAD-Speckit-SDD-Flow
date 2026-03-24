/**
 * Story 5.5 B07 / Story 7.2: SFT 微调数据集提取
 * 从 phase_score>=minScore 的记录提取 instruction（BUGFIX §1+§4）与 git diff bad/good 代码对
 * Story 7.2 增强：has_code_pair、git diff 失败 fallback、去重、摘要；minScore 默认 90（高分样本）
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getGitHeadHashFull } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';
import { parseEpicStoryFromRecord } from '../query';
import { extractAuditReportSections } from './audit-report-parser';

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

const SECTION_1_RE = /## §1[^\n]*\n([\s\S]*?)(?=## §|$)/;
const SECTION_4_RE = /## §4[^\n]*\n([\s\S]*?)(?=## §|$)/;

/**
 * Extract §1 and §4 sections from BUGFIX document.
 * @param {string} content - BUGFIX markdown content
 * @returns {{ s1: string; s4: string } | null} { s1, s4 } or null
 */
export function extractBugfixSections(content: string): { s1: string; s4: string } | null {
  const m1 = content.match(SECTION_1_RE);
  const m4 = content.match(SECTION_4_RE);
  if (!m1 || !m4) return null;
  const s1 = (m1[1] ?? '').trim();
  const s4 = (m4[1] ?? '').trim();
  if (!s1 || !s4) return null;
  return { s1, s4 };
}

/**
 * 解析 git diff 输出为 input/output 文本对。
 * @param {string} diff - git diff 输出
 * @returns {{ input: string; output: string }} input 为删除行，output 为新增行
 */
export function parseDiffToInputOutput(diff: string): { input: string; output: string } {
  const inputLines: string[] = [];
  const outputLines: string[] = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      inputLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      outputLines.push(line.slice(1));
    }
  }
  return {
    input: inputLines.join('\n').trim(),
    output: outputLines.join('\n').trim(),
  };
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
  const out = execSync(`git diff ${hash1} ${fullHash2}`, {
    cwd: workDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return out;
}

function loadRecordsFromDataPath(dataPath: string): RunScoreRecord[] {
  const base = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
  const records: RunScoreRecord[] = [];

  if (!fs.existsSync(base)) return [];

  const entries = fs.readdirSync(base, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = path.join(base, e.name);
    if (e.name.endsWith('.json') && e.name !== 'scores.jsonl') {
      try {
        const content = fs.readFileSync(full, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          records.push(...(parsed as RunScoreRecord[]));
        } else {
          records.push(parsed as RunScoreRecord);
        }
      } catch {
        // skip invalid json
      }
    }
  }

  const jsonlPath = path.join(base, 'scores.jsonl');
  if (fs.existsSync(jsonlPath)) {
    const lines = fs
      .readFileSync(jsonlPath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as RunScoreRecord);
      } catch {
        // skip invalid line
      }
    }
  }

  return records;
}

function dedupeEntries(entries: SftEntry[]): SftEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const sp = e.source_path ?? '';
    const key = `${e.source_run_id}|${e.base_commit_hash}|${sp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countUniqueStories(entries: SftEntry[]): number {
  const keys = new Set<string>();
  for (const e of entries) {
    const pseudo: RunScoreRecord = {
      run_id: e.source_run_id,
      source_path: e.source_path,
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
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
      : '无';
  return `共提取 ${summary.n} 条，覆盖 ${summary.m} 个 Story；跳过 ${summary.k} 条（原因：${reasons}）`;
}

/**
 * 从 scoring data 提取 SFT 数据集。
 * 仅处理 phase_score>=minScore 且含 source_path、base_commit_hash 的记录。
 * git diff 失败时 fallback 为 instruction-only（has_code_pair: false）。
 * 按 source_run_id+base_commit_hash+source_path 去重。
 */
/**
 * Extract SFT dataset from scoring records and git diffs.
 * Processes high-score records (phase_score >= minScore) with source_path and base_commit_hash.
 * @param {string} [dataPath] - Optional; defaults to scoring/data
 * @param {string} [outputPath] - Optional output path
 * @param {ExtractSftDatasetOptions} [options] - minScore (default 90)
 * @returns {Promise<{ entries: SftEntry[]; summary: SftExtractSummary }>} entries and summary
 */
export async function extractSftDataset(
  dataPath?: string,
  outputPath?: string,
  options?: ExtractSftDatasetOptions
): Promise<{ entries: SftEntry[]; summary: SftExtractSummary }> {
  const minScore = options?.minScore ?? 90;
  const basePath = dataPath ?? path.join(process.cwd(), 'packages', 'scoring', 'data');
  const outPath = outputPath ?? path.join(basePath, 'sft-dataset.jsonl');
  const records = loadRecordsFromDataPath(basePath);
  const cwd = process.cwd();
  const entries: SftEntry[] = [];
  const skipReasons: Record<string, number> = {};

  const highScoreRecords = records.filter((r) => r.phase_score >= minScore);

  for (const rec of highScoreRecords) {
    const sourcePath = (rec as RunScoreRecord & { source_path?: string }).source_path;
    const baseCommitHash = rec.base_commit_hash;

    if (!sourcePath) {
      incSkip(skipReasons, '无 source_path');
      continue;
    }
    if (!baseCommitHash) {
      incSkip(skipReasons, '无 base_commit_hash');
      continue;
    }

    const resolvedPath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.resolve(cwd, sourcePath);
    if (!fs.existsSync(resolvedPath)) {
      incSkip(skipReasons, 'source_path 不存在');
      continue;
    }

    let bugfixContent: string;
    try {
      bugfixContent = fs.readFileSync(resolvedPath, 'utf-8');
    } catch {
      incSkip(skipReasons, '无法读取 source_path');
      continue;
    }

    const sections = extractBugfixSections(bugfixContent);
    let instruction: string;
    if (sections) {
      instruction = [sections.s1, sections.s4].join('\n\n');
    } else {
      const auditSections = extractAuditReportSections(bugfixContent);
      instruction = [auditSections.criticConclusion, auditSections.gaps.join('\n'), auditSections.suggestions.join('\n')]
        .filter(Boolean)
        .join('\n\n');
      if (instruction.trim().length < 20) {
        incSkip(skipReasons, '无 §1/§4 且审计报告解析失败');
        continue;
      }
    }

    try {
      execSync(`git rev-parse --verify ${baseCommitHash}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      incSkip(skipReasons, 'base_commit_hash 不可验证');
      continue;
    }

    let diff: string | null = null;
    try {
      diff = gitDiffBetween(baseCommitHash, 'HEAD', cwd);
    } catch {
      // fallback: instruction-only
    }

    if (diff == null || diff.trim() === '') {
      entries.push({
        instruction,
        input: '',
        output: '',
        source_run_id: rec.run_id,
        base_commit_hash: baseCommitHash,
        has_code_pair: false,
        source_path: sourcePath,
      });
    } else {
      const { input, output } = parseDiffToInputOutput(diff);
      const hasValidPair = input.length > 0 || output.length > 0;
      entries.push({
        instruction,
        input,
        output,
        source_run_id: rec.run_id,
        base_commit_hash: baseCommitHash,
        has_code_pair: hasValidPair,
        source_path: sourcePath,
      });
    }
  }

  const deduped = dedupeEntries(entries);
  const k = Object.values(skipReasons).reduce((a, b) => a + b, 0);
  const m = countUniqueStories(deduped);

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const jsonlContent = deduped.map((e) => JSON.stringify(e)).join('\n');
  if (jsonlContent) fs.writeFileSync(outPath, jsonlContent + '\n', 'utf-8');

  const summary: SftExtractSummary = {
    n: deduped.length,
    m,
    k,
    skipReasons,
  };

  return { entries: deduped, summary };
}

function incSkip(reasons: Record<string, number>, key: string): void {
  reasons[key] = (reasons[key] ?? 0) + 1;
}

export { formatSummary };
