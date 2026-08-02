import { readFileSync } from 'node:fs';

export interface RequirementsContractSourceAmendmentBinding {
  amendmentId: string;
  authority: string;
  hash: string;
}

export interface RequirementsContractFrozenUniverse {
  taskIds: string[];
  sourceIds: string[];
  acceptanceIds: string[];
  traceIds: string[];
  commandIds: string[];
  evidenceIds: string[];
  artifactIds: string[];
  artifactIndexIds: string[];
  sourceAmendments: RequirementsContractSourceAmendmentBinding[];
  sourceAmendmentHashes: string[];
}

export interface RequirementsContractEvidenceUniverseInput {
  sourceAmendmentHashes: unknown;
  coverage: unknown;
  evidenceIndex: unknown;
  artifactIndex: unknown;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const RANGE = /^([A-Z]+-?)(\d+)-([A-Z]+-?)(\d+)$/u;
const FRONT_MATTER_MARKER = '<!-- goal-slot:frontMatter required dynamic=frontMatter -->';
const EFFECTIVE_UNIVERSE_MARKER = 'The effective universes remain exactly:';

function parseFrontMatter(contractText: string): Map<string, string> {
  const markerIndex = contractText.indexOf(FRONT_MATTER_MARKER);
  if (markerIndex < 0) throw new Error('contract_universe_front_matter_marker_missing');
  const frontMatterStart = contractText.indexOf('---', markerIndex);
  const frontMatterEnd = contractText.indexOf('---', frontMatterStart + 3);
  if (frontMatterStart < 0 || frontMatterEnd < 0) {
    throw new Error('contract_universe_front_matter_missing');
  }
  const values = new Map<string, string>();
  for (const line of contractText.slice(frontMatterStart + 3, frontMatterEnd).split(/\r?\n/u)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) values.set(key, value);
  }
  return values;
}

function parseRange(value: string, label: string): string[] {
  const match = RANGE.exec(value);
  if (!match || match[1] !== match[3]) {
    throw new Error(`contract_universe_range_invalid:${label}`);
  }
  const start = Number(match[2]);
  const end = Number(match[4]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    throw new Error(`contract_universe_range_invalid:${label}`);
  }
  const width = match[2].length;
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${match[1]}${String(start + index).padStart(width, '0')}`
  );
}

function effectiveRanges(contractText: string): Map<string, string> {
  const markerIndex = contractText.lastIndexOf(EFFECTIVE_UNIVERSE_MARKER);
  if (markerIndex < 0) throw new Error('contract_universe_effective_block_missing');
  const fenceStart = contractText.indexOf('```text', markerIndex);
  const fenceEnd = contractText.indexOf('```', fenceStart + 7);
  if (fenceStart < 0 || fenceEnd < 0) {
    throw new Error('contract_universe_effective_block_invalid');
  }
  const ranges = new Map<string, string>();
  for (const line of contractText.slice(fenceStart + 7, fenceEnd).split(/\r?\n/u)) {
    const value = line.trim();
    const match = RANGE.exec(value);
    if (match) ranges.set(match[1], value);
  }
  return ranges;
}

function requiredRange(ranges: Map<string, string>, prefix: string): string {
  const value = ranges.get(prefix);
  if (!value) throw new Error(`contract_universe_range_missing:${prefix}`);
  return value;
}

function frontMatterRange(
  frontMatter: Map<string, string>,
  key: string,
  effectiveValue: string
): void {
  const value = frontMatter.get(key);
  if (!value || value !== effectiveValue) {
    throw new Error(`contract_universe_front_matter_range_mismatch:${key}`);
  }
}

function amendmentKey(amendmentId: string): string {
  return amendmentId.toLowerCase().replace('-', '');
}

function amendmentHash(
  contractText: string,
  frontMatter: Map<string, string>,
  amendmentId: string
): string {
  const value = frontMatter.get(`${amendmentKey(amendmentId)}SourceHash`);
  if (value !== undefined) {
    if (!SHA256.test(value)) {
      throw new Error(`contract_universe_source_amendment_hash_invalid:${amendmentId}`);
    }
    return value;
  }
  const fallback = new RegExp(
    `Amendment \`${amendmentId}\`[\\s\\S]{0,500}?canonical digest \`(sha256:[a-f0-9]{64})\``,
    'u'
  ).exec(contractText)?.[1];
  if (!fallback || !SHA256.test(fallback)) {
    throw new Error(`contract_universe_source_amendment_hash_missing:${amendmentId}`);
  }
  return fallback;
}

function sourceAmendments(
  contractText: string,
  frontMatter: Map<string, string>
): RequirementsContractSourceAmendmentBinding[] {
  const sourceAmendmentId = frontMatter.get('sourceAmendmentId');
  if (!sourceAmendmentId) throw new Error('contract_universe_source_amendment_id_missing');
  const amendmentIds = sourceAmendmentId.split('+');
  if (
    amendmentIds.length === 0 ||
    amendmentIds.some((id) => !/^AMEND-\d{2}$/u.test(id)) ||
    new Set(amendmentIds).size !== amendmentIds.length
  ) {
    throw new Error('contract_universe_source_amendment_id_invalid');
  }
  return amendmentIds.map((amendmentId) => {
    const key = amendmentKey(amendmentId);
    return {
      amendmentId,
      authority:
        frontMatter.get(`${key}AuthorityPath`) ??
        frontMatter.get(`${key}Authority`) ??
        amendmentId,
      hash: amendmentHash(contractText, frontMatter, amendmentId),
    };
  });
}

function exactIds(actual: unknown, expected: string[], label: string): void {
  if (
    !Array.isArray(actual) ||
    actual.some((value) => typeof value !== 'string') ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    throw new Error(`contract_universe_${label}_mismatch`);
  }
}

export function validateRequirementsContractEvidenceUniverse(
  input: RequirementsContractEvidenceUniverseInput,
  universe: RequirementsContractFrozenUniverse
): void {
  exactIds(
    input.sourceAmendmentHashes,
    universe.sourceAmendmentHashes,
    'source_amendment_hash_set'
  );
  if (!input.coverage || typeof input.coverage !== 'object' || Array.isArray(input.coverage)) {
    throw new Error('contract_universe_coverage_invalid');
  }
  const coverage = input.coverage as Record<string, unknown>;
  exactIds(coverage.storyIds, universe.sourceIds, 'source');
  exactIds(coverage.acceptanceIds, universe.acceptanceIds, 'acceptance');
  exactIds(coverage.traceIds, universe.traceIds, 'trace');
  exactIds(coverage.commandIds, universe.commandIds, 'command');
  if (!Array.isArray(input.evidenceIndex)) {
    throw new Error('contract_universe_evidence_index_invalid');
  }
  exactIds(
    input.evidenceIndex.map((entry) => (entry && typeof entry === 'object' ? entry.evidenceId : '')),
    universe.evidenceIds,
    'evidence'
  );
  if (!Array.isArray(input.artifactIndex)) {
    throw new Error('contract_universe_artifact_index_invalid');
  }
  exactIds(
    input.artifactIndex.map((entry) => (entry && typeof entry === 'object' ? entry.artifactId : '')),
    universe.artifactIndexIds,
    'artifact_index'
  );
}

export function deriveRequirementsContractFrozenUniverseFromText(
  contractText: string
): RequirementsContractFrozenUniverse {
  const frontMatter = parseFrontMatter(contractText);
  const ranges = effectiveRanges(contractText);
  const taskRange = requiredRange(ranges, 'G');
  const sourceRange = requiredRange(ranges, 'S');
  const acceptanceRange = requiredRange(ranges, 'AC-');
  frontMatterRange(frontMatter, 'taskRange', taskRange);
  frontMatterRange(frontMatter, 'sourceObligationRange', sourceRange);
  frontMatterRange(frontMatter, 'acceptanceRange', acceptanceRange);

  const amendments = sourceAmendments(contractText, frontMatter);
  const artifactIds = parseRange(requiredRange(ranges, 'ARTIFACT-'), 'artifact');
  if (artifactIds[0] !== 'ARTIFACT-01') {
    throw new Error('contract_universe_artifact_bundle_identity_missing');
  }

  return {
    taskIds: parseRange(taskRange, 'task'),
    sourceIds: parseRange(sourceRange, 'source'),
    acceptanceIds: parseRange(acceptanceRange, 'acceptance'),
    traceIds: parseRange(requiredRange(ranges, 'TR-'), 'trace'),
    commandIds: parseRange(requiredRange(ranges, 'CMD-'), 'command'),
    evidenceIds: parseRange(requiredRange(ranges, 'EVD-'), 'evidence'),
    artifactIds,
    artifactIndexIds: artifactIds.slice(1),
    sourceAmendments: amendments,
    sourceAmendmentHashes: amendments.map((amendment) => amendment.hash),
  };
}

export function deriveRequirementsContractFrozenUniverse(
  contractPath: string
): RequirementsContractFrozenUniverse {
  return deriveRequirementsContractFrozenUniverseFromText(readFileSync(contractPath, 'utf8'));
}
