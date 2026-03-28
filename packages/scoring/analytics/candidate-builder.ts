import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseEpicStoryFromRecord } from '../query';
import { loadAndDedupeRecords } from '../query/loader';
import { computeStringHash, getGitHeadHashFull } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';
import {
  buildCanonicalMessages,
  buildCanonicalSampleId,
  extractInstruction,
  parseDiffToInputOutput,
} from './canonical-sample';
import { applyQualityGates, type QualityGateOptions } from './quality-gates';
import { applyCanonicalRedaction } from './redaction';
import { assignDeterministicSplit } from './split';
import type { CanonicalSftSample } from './types';

export interface BuildCanonicalCandidatesOptions extends QualityGateOptions {
  dataPath?: string;
  cwd?: string;
  splitSeed?: number;
}

export interface CanonicalCandidateBuildResult {
  samples: CanonicalSftSample[];
}

const sourceArtifactCache = new Map<string, string | null>();
const diffCache = new Map<string, { input: string; output: string }>();
const canonicalBuildCache = new Map<string, CanonicalCandidateBuildResult>();

function resolveSourcePath(sourcePath: string, cwd: string): string {
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(cwd, sourcePath);
}

function readSourceArtifact(sourcePath: string, cwd: string): string | null {
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
  } catch {
    return null;
  }
}

function parseDiff(baseCommitHash: string | undefined, cwd: string): { input: string; output: string } {
  if (!baseCommitHash) {
    return { input: '', output: '' };
  }

  try {
    execSync(`git rev-parse --verify ${baseCommitHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const headHash = getGitHeadHashFull(cwd);
    if (!headHash) {
      return { input: '', output: '' };
    }
    const cacheKey = `${path.resolve(cwd)}::${baseCommitHash}::${headHash}`;
    const cached = diffCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const diff = execSync(`git diff ${baseCommitHash} ${headHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = parseDiffToInputOutput(diff);
    diffCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return { input: '', output: '' };
  }
}

function createBuildCacheKey(
  records: RunScoreRecord[],
  cwd: string,
  options: BuildCanonicalCandidatesOptions
): string {
  return JSON.stringify({
    cwd: path.resolve(cwd),
    minScore: options.minScore ?? 90,
    maxIterations: options.maxIterations ?? 3,
    maxTokens: options.maxTokens ?? 8192,
    requireCodePair: options.requireCodePair ?? false,
    splitSeed: options.splitSeed ?? 42,
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
    })),
  });
}

function isVetoTriggered(record: RunScoreRecord): boolean {
  const derived = record as RunScoreRecord & { veto_triggered?: boolean };
  if (derived.veto_triggered != null) {
    return derived.veto_triggered;
  }
  return record.check_items.some(
    (item) => item.passed === false && item.item_id.startsWith('veto_')
  );
}

function buildCanonicalSample(
  record: RunScoreRecord,
  sourceContent: string,
  codePair: { input: string; output: string },
  options: BuildCanonicalCandidatesOptions
): CanonicalSftSample {
  const instruction = extractInstruction(sourceContent) ?? '';
  const messages = buildCanonicalMessages(instruction, codePair.input, codePair.output);
  const parsedStory = parseEpicStoryFromRecord(record);
  const split = assignDeterministicSplit({
    seed: options.splitSeed ?? 42,
    groupKey: parsedStory ? `epic-${parsedStory.epicId}/story-${parsedStory.storyId}` : record.run_id,
  });

  const baseSample: CanonicalSftSample = {
    sample_id: buildCanonicalSampleId({
      runId: record.run_id,
      stage: record.stage,
      sourcePath: record.source_path ?? null,
      baseCommitHash: record.base_commit_hash ?? null,
      instruction,
      output: codePair.output,
    }),
    sample_version: 'v1',
    source: {
      run_id: record.run_id,
      stage: record.stage,
      flow: 'story',
      epic_id: parsedStory ? `epic-${parsedStory.epicId}` : undefined,
      story_id: parsedStory ? `${parsedStory.storyId}` : undefined,
      story_slug: undefined,
      event_ids: [`score:${record.run_id}:${record.stage}`],
      score_record_id: `${record.run_id}:${record.stage}`,
      artifact_refs: [
        {
          path: record.source_path ?? 'unknown',
          content_hash: record.content_hash ?? computeStringHash(sourceContent),
          source_hash: record.source_hash ?? computeStringHash(sourceContent),
          kind: path.extname(record.source_path ?? '').replace('.', '') || 'artifact',
        },
      ],
    },
    messages,
    metadata: {
      schema_targets: ['openai_chat', 'hf_conversational'],
      language: 'zh-CN',
      notes: codePair.input || codePair.output ? ['legacy_flat_compat'] : ['legacy_instruction_only'],
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: record.phase_score,
      raw_phase_score:
        (record as RunScoreRecord & { raw_phase_score?: number }).raw_phase_score ?? record.phase_score,
      dimension_scores: record.dimension_scores
        ? Object.fromEntries(record.dimension_scores.map((score) => [score.dimension, score.score]))
        : undefined,
      veto_triggered: isVetoTriggered(record),
      iteration_count: record.iteration_count,
      has_code_pair: codePair.input.length > 0 || codePair.output.length > 0,
      token_estimate: Math.max(1, Math.ceil(messages.map((message) => String(message.content)).join('\n').length / 4)),
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: record.base_commit_hash ?? null,
      content_hash: record.content_hash ?? computeStringHash(sourceContent),
      source_hash: record.source_hash ?? computeStringHash(sourceContent),
      source_path: record.source_path ?? null,
      patch_ref:
        codePair.input || codePair.output
          ? `sha256:${computeStringHash(`${codePair.input}\n${codePair.output}`)}`
          : null,
      lineage: [record.run_id, `${record.run_id}:${record.stage}`],
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
      hf_conversational: { compatible: true, reasons: [], warnings: [] },
      hf_tool_calling: { compatible: false, reasons: [], warnings: [] },
    },
  };

  return applyQualityGates(applyCanonicalRedaction(baseSample), options);
}

export function buildCanonicalCandidatesFromRecordsSync(
  records: RunScoreRecord[],
  options: BuildCanonicalCandidatesOptions = {}
): CanonicalCandidateBuildResult {
  const cwd = options.cwd ?? process.cwd();
  const buildCacheKey = createBuildCacheKey(records, cwd, options);
  const cached = canonicalBuildCache.get(buildCacheKey);
  if (cached) {
    return cached;
  }
  const samples: CanonicalSftSample[] = [];

  for (const record of records) {
    if (record.scenario !== 'real_dev' || !record.source_path) {
      continue;
    }

    const sourceContent = readSourceArtifact(record.source_path, cwd);
    if (sourceContent == null) {
      continue;
    }

    const codePair = parseDiff(record.base_commit_hash, cwd);
    samples.push(buildCanonicalSample(record, sourceContent, codePair, options));
  }

  const result = { samples };
  canonicalBuildCache.set(buildCacheKey, result);
  return result;
}

export async function buildCanonicalCandidatesFromRecords(
  records: RunScoreRecord[],
  options: BuildCanonicalCandidatesOptions = {}
): Promise<CanonicalCandidateBuildResult> {
  return buildCanonicalCandidatesFromRecordsSync(records, options);
}

export function buildCanonicalCandidatesSync(
  options: BuildCanonicalCandidatesOptions = {}
): CanonicalCandidateBuildResult {
  const dataPath = options.dataPath ?? path.join(process.cwd(), 'packages', 'scoring', 'data');
  const records = loadAndDedupeRecords(dataPath);
  return buildCanonicalCandidatesFromRecordsSync(records, options);
}

export async function buildCanonicalCandidates(
  options: BuildCanonicalCandidatesOptions = {}
): Promise<CanonicalCandidateBuildResult> {
  return buildCanonicalCandidatesSync(options);
}
