/**
 * Story 5.5 B07: SFT 微调数据集提取
 * 从 phase_score≤60 的记录提取 instruction（BUGFIX §1+§4）与 git diff bad/good 代码对
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getGitHeadHashFull } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';

export interface SftEntry {
  instruction: string;
  input: string;
  output: string;
  source_run_id: string;
  base_commit_hash: string;
}

const SECTION_1_RE = /## §1[^\n]*\n([\s\S]*?)(?=## §|$)/;
const SECTION_4_RE = /## §4[^\n]*\n([\s\S]*?)(?=## §|$)/;

export function extractBugfixSections(content: string): { s1: string; s4: string } | null {
  const m1 = content.match(SECTION_1_RE);
  const m4 = content.match(SECTION_4_RE);
  if (!m1 || !m4) return null;
  const s1 = (m1[1] ?? '').trim();
  const s4 = (m4[1] ?? '').trim();
  if (!s1 || !s4) return null;
  return { s1, s4 };
}

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

/**
 * 从 scoring data 提取 SFT 数据集。
 * 仅处理 phase_score≤60 且含 source_path、base_commit_hash 的记录。
 */
export async function extractSftDataset(
  dataPath?: string,
  outputPath?: string
): Promise<SftEntry[]> {
  const basePath = dataPath ?? path.join(process.cwd(), 'scoring', 'data');
  const outPath = outputPath ?? path.join(basePath, 'sft-dataset.jsonl');
  const records = loadRecordsFromDataPath(basePath);
  const cwd = process.cwd();
  const entries: SftEntry[] = [];

  const lowScoreRecords = records.filter((r) => r.phase_score <= 60);

  for (const rec of lowScoreRecords) {
    const sourcePath = (rec as RunScoreRecord & { source_path?: string }).source_path;
    const baseCommitHash = rec.base_commit_hash;

    if (!sourcePath) {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: no source_path`);
      continue;
    }
    if (!baseCommitHash) {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: no base_commit_hash`);
      continue;
    }

    const resolvedPath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.resolve(cwd, sourcePath);
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: source_path not found: ${resolvedPath}`);
      continue;
    }

    let bugfixContent: string;
    try {
      bugfixContent = fs.readFileSync(resolvedPath, 'utf-8');
    } catch {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: cannot read source_path`);
      continue;
    }

    const sections = extractBugfixSections(bugfixContent);
    if (!sections) {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: no §1 or §4 in BUGFIX`);
      continue;
    }
    const instruction = [sections.s1, sections.s4].join('\n\n');

    try {
      execSync(`git rev-parse --verify ${baseCommitHash}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: base_commit_hash not verifiable: ${baseCommitHash}`);
      continue;
    }

    let diff: string;
    try {
      diff = gitDiffBetween(baseCommitHash, 'HEAD', cwd);
    } catch {
      console.warn(`[sft-extractor] skip run_id=${rec.run_id}: git diff failed`);
      continue;
    }

    const { input, output } = parseDiffToInputOutput(diff);
    entries.push({
      instruction,
      input,
      output,
      source_run_id: rec.run_id,
      base_commit_hash: baseCommitHash,
    });
  }

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const jsonlContent = entries.map((e) => JSON.stringify(e)).join('\n');
  if (jsonlContent) fs.writeFileSync(outPath, jsonlContent + '\n', 'utf-8');

  return entries;
}
