import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseEpicStoryFromRecord } from '../query';
import { loadAndDedupeRecords } from '../query/loader';
import { computeStringHash, getGitHeadHashFull } from '../utils/hash';
import { readPatchSnapshot } from '../utils/patch-snapshot';
import type { RunScoreRecord } from '../writer/types';
import {
  buildCanonicalMessages,
  buildCanonicalSampleId,
  estimateCanonicalTokenCount,
  extractInstruction,
  parseDiffToInputOutput,
} from './canonical-sample';
import { applyQualityGates, type QualityGateOptions } from './quality-gates';
import { applyCanonicalRedaction } from './redaction';
import { assignDeterministicSplit } from './split';
import { readToolTraceArtifact, type LoadedToolTrace } from './tool-trace';
import type { CanonicalMessage, CanonicalSftSample } from './types';

export interface BuildCanonicalCandidatesOptions extends QualityGateOptions {
  dataPath?: string;
  cwd?: string;
  splitSeed?: number;
}

export interface CanonicalCandidateBuildResult {
  samples: CanonicalSftSample[];
}

interface PatchChange {
  kind: 'input' | 'output';
  text: string;
}

interface PatchChangeUnit {
  filePath: string;
  hunkHeader: string | null;
  unitKey: string;
  changes: PatchChange[];
}

interface SampleCodePair {
  input: string;
  output: string;
  patchRef: string | null;
  chunkKey: string | null;
}

const sourceArtifactCache = new Map<string, string | null>();
const diffCache = new Map<string, string>();
const patchSnapshotCache = new Map<string, { patchContent: string; patchRef: string | null }>();
const toolTraceCache = new Map<string, LoadedToolTrace | null>();
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

function loadRuntimeDiff(baseCommitHash: string | undefined, cwd: string): string | null {
  if (!baseCommitHash) {
    return null;
  }

  try {
    execSync(`git rev-parse --verify ${baseCommitHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const headHash = getGitHeadHashFull(cwd);
    if (!headHash) {
      return null;
    }
    const cacheKey = `${path.resolve(cwd)}::${baseCommitHash}::${headHash}`;
    if (diffCache.has(cacheKey)) {
      return diffCache.get(cacheKey) ?? '';
    }
    const diff = execSync(`git diff ${baseCommitHash} ${headHash}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    diffCache.set(cacheKey, diff);
    return diff;
  } catch {
    return null;
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
      patch_ref: record.patch_ref ?? null,
      patch_snapshot_path: record.patch_snapshot_path ?? null,
      tool_trace_ref: (record as RunScoreRecord & { tool_trace_ref?: string }).tool_trace_ref ?? null,
      tool_trace_path: (record as RunScoreRecord & { tool_trace_path?: string }).tool_trace_path ?? null,
    })),
  });
}

function loadPatchSnapshot(
  record: RunScoreRecord,
  cwd: string
): { patchContent: string; patchRef: string | null } | null {
  if (!record.patch_snapshot_path) {
    return null;
  }

  const cacheKey = `${record.patch_snapshot_path}::${record.patch_ref ?? 'no-ref'}`;
  const cached = patchSnapshotCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const patchContent = readPatchSnapshot(record.patch_snapshot_path, cwd);
  if (patchContent == null) {
    return null;
  }

  const result = {
    patchContent,
    patchRef: `sha256:${computeStringHash(patchContent)}`,
  };
  patchSnapshotCache.set(cacheKey, result);
  return result;
}

function loadToolTrace(record: RunScoreRecord, cwd: string): LoadedToolTrace | null {
  const derived = record as RunScoreRecord & {
    tool_trace_ref?: string;
    tool_trace_path?: string;
  };
  if (!derived.tool_trace_path) {
    return null;
  }

  const cacheKey = `${derived.tool_trace_path}::${derived.tool_trace_ref ?? 'no-ref'}`;
  if (toolTraceCache.has(cacheKey)) {
    return toolTraceCache.get(cacheKey) ?? null;
  }

  const loaded = readToolTraceArtifact(derived.tool_trace_path, cwd);
  toolTraceCache.set(cacheKey, loaded);
  return loaded;
}

function normalizePatchPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed === '/dev/null') {
    return trimmed;
  }
  return trimmed.replace(/^[ab]\//, '');
}

function parsePatchContentToUnits(patchContent: string): PatchChangeUnit[] {
  const units: PatchChangeUnit[] = [];
  const lines = patchContent.split(/\r?\n/);

  let currentFilePath = 'unknown';
  let currentHunkHeader: string | null = null;
  let currentHunkIndex = 0;
  let pendingOldPath: string | null = null;
  let currentChanges: PatchChange[] = [];

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
      currentFilePath = newPath !== '/dev/null' ? newPath : pendingOldPath ?? currentFilePath;
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

function formatPatchCodePair(
  unit: PatchChangeUnit,
  changes: PatchChange[],
  patchRef: string | null,
  chunkKey: string
): SampleCodePair {
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

function buildMessagesWithToolTrace(
  instruction: string,
  codePair: SampleCodePair,
  toolTrace: LoadedToolTrace | null
): CanonicalMessage[] {
  const baseMessages = buildCanonicalMessages(instruction, codePair.input, codePair.output);
  if (!toolTrace) {
    return baseMessages;
  }

  return [
    baseMessages[0]!,
    baseMessages[1]!,
    ...toolTrace.messages,
    baseMessages[2]!,
  ];
}

function estimateCodePairTokens(
  instruction: string,
  codePair: SampleCodePair,
  toolTrace: LoadedToolTrace | null
): number {
  return estimateCanonicalTokenCount(
    buildMessagesWithToolTrace(instruction, codePair, toolTrace),
    toolTrace?.tools
  );
}

function splitLongChangeToBudget(
  unit: PatchChangeUnit,
  change: PatchChange,
  instruction: string,
  maxTokens: number,
  patchRef: string | null,
  chunkKeyPrefix: string,
  toolTrace: LoadedToolTrace | null
): SampleCodePair[] {
  const chunks: SampleCodePair[] = [];
  let remaining = change.text;
  let fragmentIndex = 0;

  while (remaining.length > 0) {
    let low = 1;
    let high = remaining.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = formatPatchCodePair(
        unit,
        [{ kind: change.kind, text: remaining.slice(0, mid) }],
        patchRef,
        `${chunkKeyPrefix}:fragment-${fragmentIndex}`
      );

      if (estimateCodePairTokens(instruction, candidate, toolTrace) <= maxTokens) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const sliceLength = Math.max(1, best);
    chunks.push(
      formatPatchCodePair(
        unit,
        [{ kind: change.kind, text: remaining.slice(0, sliceLength) }],
        patchRef,
        `${chunkKeyPrefix}:fragment-${fragmentIndex}`
      )
    );
    remaining = remaining.slice(sliceLength);
    fragmentIndex += 1;
  }

  return chunks;
}

function splitPatchUnitToBudget(
  unit: PatchChangeUnit,
  instruction: string,
  maxTokens: number,
  patchRef: string | null,
  toolTrace: LoadedToolTrace | null
): SampleCodePair[] {
  const wholeUnit = formatPatchCodePair(unit, unit.changes, patchRef, `${unit.unitKey}:whole`);
  if (estimateCodePairTokens(instruction, wholeUnit, toolTrace) <= maxTokens) {
    return [wholeUnit];
  }

  const slices: SampleCodePair[] = [];
  let start = 0;
  let sliceIndex = 0;

  while (start < unit.changes.length) {
    let end = start + 1;
    let bestEnd = 0;
    let bestPair: SampleCodePair | null = null;

    while (end <= unit.changes.length) {
      const candidate = formatPatchCodePair(
        unit,
        unit.changes.slice(start, end),
        patchRef,
        `${unit.unitKey}:slice-${sliceIndex}`
      );
      if (estimateCodePairTokens(instruction, candidate, toolTrace) <= maxTokens) {
        bestEnd = end;
        bestPair = candidate;
        end += 1;
      } else {
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
    slices.push(
      ...splitLongChangeToBudget(
        unit,
        currentChange,
        instruction,
        maxTokens,
        patchRef,
        `${unit.unitKey}:slice-${sliceIndex}`,
        toolTrace
      )
    );
    start += 1;
    sliceIndex += 1;
  }

  return slices;
}

function combineCodePairsToBudget(
  codePairs: SampleCodePair[],
  instruction: string,
  maxTokens: number,
  toolTrace: LoadedToolTrace | null
): SampleCodePair[] {
  if (codePairs.length === 0) {
    return [];
  }

  const combined: SampleCodePair[] = [];
  let current = codePairs[0];

  for (let index = 1; index < codePairs.length; index += 1) {
    const next = codePairs[index];
    const candidate: SampleCodePair = {
      input: [current.input, next.input].filter(Boolean).join('\n\n'),
      output: [current.output, next.output].filter(Boolean).join('\n\n'),
      patchRef: current.patchRef ?? next.patchRef ?? null,
      chunkKey: [current.chunkKey, next.chunkKey].filter(Boolean).join('|') || null,
    };

    if (estimateCodePairTokens(instruction, candidate, toolTrace) <= maxTokens) {
      current = candidate;
      continue;
    }

    combined.push(current);
    current = next;
  }

  combined.push(current);
  return combined;
}

function buildCodePairsFromPatchContent(
  patchContent: string,
  instruction: string,
  maxTokens: number,
  patchRef: string | null,
  toolTrace: LoadedToolTrace | null
): SampleCodePair[] {
  const patchUnits = parsePatchContentToUnits(patchContent);
  if (patchUnits.length === 0) {
    const parsed = parseDiffToInputOutput(patchContent);
    return [
      {
        input: parsed.input,
        output: parsed.output,
        patchRef,
        chunkKey: null,
      },
    ];
  }

  const boundedPairs = patchUnits.flatMap((unit) =>
    splitPatchUnitToBudget(unit, instruction, maxTokens, patchRef, toolTrace)
  );

  return combineCodePairsToBudget(boundedPairs, instruction, maxTokens, toolTrace);
}

function resolveCodePairsForRecord(
  record: RunScoreRecord,
  instruction: string,
  cwd: string,
  maxTokens: number,
  toolTrace: LoadedToolTrace | null
): SampleCodePair[] {
  const patchSnapshot = loadPatchSnapshot(record, cwd);
  if (patchSnapshot) {
    return buildCodePairsFromPatchContent(
      patchSnapshot.patchContent,
      instruction,
      maxTokens,
      patchSnapshot.patchRef,
      toolTrace
    );
  }

  const runtimeDiff = loadRuntimeDiff(record.base_commit_hash, cwd);
  if (runtimeDiff != null) {
    return buildCodePairsFromPatchContent(runtimeDiff, instruction, maxTokens, null, toolTrace);
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
  instruction: string,
  codePair: SampleCodePair,
  toolTrace: LoadedToolTrace | null,
  options: BuildCanonicalCandidatesOptions
): CanonicalSftSample {
  const messages = buildMessagesWithToolTrace(instruction, codePair, toolTrace);
  const parsedStory = parseEpicStoryFromRecord(record);
  const split = assignDeterministicSplit({
    seed: options.splitSeed ?? 42,
    groupKey: parsedStory ? `epic-${parsedStory.epicId}/story-${parsedStory.storyId}` : record.run_id,
  });

  const lineage = [record.run_id, `${record.run_id}:${record.stage}`];
  if (codePair.chunkKey) {
    lineage.push(`chunk:${codePair.chunkKey}`);
  }
  if (toolTrace) {
    lineage.push(`tool-trace:${toolTrace.traceRef}`);
  }

  const artifactRefs: CanonicalSftSample['source']['artifact_refs'] = [
    {
      path: record.source_path ?? 'unknown',
      content_hash: record.content_hash ?? computeStringHash(sourceContent),
      source_hash: record.source_hash ?? computeStringHash(sourceContent),
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

  const baseSample: CanonicalSftSample = {
    sample_id: buildCanonicalSampleId({
      runId: record.run_id,
      stage: record.stage,
      sourcePath: record.source_path ?? null,
      baseCommitHash: record.base_commit_hash ?? null,
      instruction,
      input: codePair.input,
      chunkKey: codePair.chunkKey,
      traceRef: toolTrace?.traceRef ?? null,
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
      artifact_refs: artifactRefs,
    },
    messages,
    ...(toolTrace ? { tools: toolTrace.tools } : {}),
    metadata: {
      schema_targets: toolTrace ? ['openai_chat', 'hf_tool_calling'] : ['openai_chat', 'hf_conversational'],
      language: 'zh-CN',
      notes: [
        codePair.input || codePair.output ? 'legacy_flat_compat' : 'legacy_instruction_only',
        ...(toolTrace ? ['tool_trace_injected'] : []),
      ],
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
      token_estimate: estimateCanonicalTokenCount(messages, toolTrace?.tools),
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
      patch_ref: codePair.patchRef,
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
  const maxTokens = options.maxTokens ?? 8192;

  for (const record of records) {
    if (record.scenario !== 'real_dev' || !record.source_path) {
      continue;
    }

    const sourceContent = readSourceArtifact(record.source_path, cwd);
    if (sourceContent == null) {
      continue;
    }

    const instruction = extractInstruction(sourceContent) ?? '';
    const toolTrace = loadToolTrace(record, cwd);
    const codePairs = resolveCodePairsForRecord(record, instruction, cwd, maxTokens, toolTrace);

    for (const codePair of codePairs) {
      samples.push(buildCanonicalSample(record, sourceContent, instruction, codePair, toolTrace, options));
    }
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
