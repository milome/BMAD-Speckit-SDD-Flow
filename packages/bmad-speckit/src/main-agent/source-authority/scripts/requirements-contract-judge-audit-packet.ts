import { canonicalJson, sha256 } from './requirements-contract-governed-write';
import { encodeGoalSemanticDictionary, decodeGoalSemanticDictionary, GOAL_SEMANTIC_DICTIONARY_PROTOCOL } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { normalizeRequirementsContractSemanticIrAuthority, validateRequirementsContractSemanticIr,
  type RequirementsContractSemanticIr, type RequirementsSemanticCandidate } from './requirements-contract-semantic-ir';
import { expandRequirementsTypedDictionaries, restoreRequirementsTypedDictionaries,
  REQUIREMENTS_TYPED_DICTIONARY_EXPANSION_PROTOCOL } from './requirements-contract-typed-dictionary-expansion';

type JsonRecord = Record<string, unknown>;

export interface RequirementsContractJudgeAuditArtifact {
  artifactId: string;
  payload: unknown;
  composition?: { schemaVersion: 'RequirementsMarkdownComposition/v2'; separator: string;
    parts: Array<string | { canonicalJson: unknown }> };
}

const V2 = 'requirements-contract-judge-audit-packet/v2';
const SPAN_REFS = 'RequirementsSourceSpanReferences/v2';
const object = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string): never => { throw new Error(`requirements_judge_audit_packet_${code}`); };

export const REQUIREMENTS_JUDGE_AUDIT_PACKET_PROTOCOL = [
  'requirements-contract-judge-audit-packet/v2 carries a complete, lossless audit payload in payloadDictionary. '
    + 'The body field is a coverage header, never the complete audit input. Decode payloadDictionary and inspect '
    + 'all semanticIr fields and every artifactPayloadGroup; do not judge the header alone.',
  GOAL_SEMANTIC_DICTIONARY_PROTOCOL,
  REQUIREMENTS_TYPED_DICTIONARY_EXPANSION_PROTOCOL,
  'RequirementsSourceSpanReferences/v2 is a lossless physical-reference list: decode each suffixes entry from '
    + 'canonical unpadded base64url to exactly ten bytes, render twenty hex digits using hexCase (upper or lower), and prepend SOURCE-SPAN-. '
    + 'Preserve order and duplicates; listHash binds the canonical JSON of the complete original string array.',
  'Audit every complete semanticValue in the typed-dictionary recipes directly, including non-action boundaries and '
    + 'conditions. Artifact payloadEncoding canonical-json/v1 preserves the original JSON. For markdown-composition/v2, '
    + 'RequirementsMarkdownComposition/v2 joins every ordered parts item with separator: strings are literal; '
    + '{canonicalJson:value} renders that complete value as canonical sorted-key JSON. No artifacts are omitted. '
    + 'Every payloadHash binds the canonical JSON of the fully reconstructed original artifact, including Markdown strings.',
].join('\n\n');

export function transformRequirementsAuditSourceSpanReferences(value: unknown, restore = false): unknown {
  if (Array.isArray(value)) return value.map((child) => transformRequirementsAuditSourceSpanReferences(child, restore));
  if (!object(value)) return value;
  if (restore && typeof value.schemaVersion === 'string' && value.schemaVersion.startsWith('RequirementsSourceSpanReferences/')) {
    if (value.schemaVersion !== SPAN_REFS) fail('source_span_refs_version_unknown');
    if (Object.keys(value).sort().join('|') !== ['schemaVersion', 'suffixes', 'listHash', 'hexCase'].sort().join('|') ||
      !['upper', 'lower'].includes(String(value.hexCase)) || !Array.isArray(value.suffixes)) {
      fail('source_span_refs_invalid');
    }
    const refs = value.suffixes.map((suffix) => {
      if (typeof suffix !== 'string' || !/^[A-Za-z0-9_-]{14}$/u.test(suffix)) fail('source_span_refs_invalid');
      const decoded = Buffer.from(suffix, 'base64url');
      if (decoded.length !== 10 || decoded.toString('base64url') !== suffix) fail('source_span_refs_invalid');
      const hex = decoded.toString('hex');
      return `SOURCE-SPAN-${value.hexCase === 'upper' ? hex.toUpperCase() : hex}`;
    });
    if (sha256(canonicalJson(refs)) !== value.listHash) fail('source_span_refs_hash_mismatch');
    return refs;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (!restore && key === 'sourceSpanRefs' && Array.isArray(child) && child.length > 8 &&
      (child.every((ref) => typeof ref === 'string' && /^SOURCE-SPAN-[a-f0-9]{20}$/u.test(ref)) ||
        child.every((ref) => typeof ref === 'string' && /^SOURCE-SPAN-[A-F0-9]{20}$/u.test(ref)))) {
      return [key, { schemaVersion: SPAN_REFS, listHash: sha256(canonicalJson(child)),
        hexCase: child.every((ref) => /^SOURCE-SPAN-[A-F0-9]{20}$/u.test(ref)) ? 'upper' : 'lower',
        suffixes: child.map((ref) => Buffer.from(ref.slice('SOURCE-SPAN-'.length), 'hex').toString('base64url')) }];
    }
    return [key, transformRequirementsAuditSourceSpanReferences(child, restore)];
  }));
}

function reconstructComposition(value: unknown): string {
  if (!object(value) || value.schemaVersion !== 'RequirementsMarkdownComposition/v2' || typeof value.separator !== 'string' ||
    !Array.isArray(value.parts) || Object.keys(value).some((key) => !['schemaVersion', 'separator', 'parts'].includes(key))) fail('composition_invalid');
  return value.parts.map((part) => {
    if (typeof part === 'string') return part;
    if (!object(part) || Object.keys(part).length !== 1 || !Object.prototype.hasOwnProperty.call(part, 'canonicalJson')) fail('composition_part_invalid');
    return canonicalJson(part.canonicalJson);
  }).join(value.separator);
}

export function resolveRequirementsContractJudgeAuditPacket(value: unknown): JsonRecord {
  if (!object(value)) fail('invalid');
  if (value.schemaVersion !== V2) {
    if (typeof value.schemaVersion === 'string' && value.schemaVersion.startsWith('requirements-contract-judge-audit-packet/') &&
      value.schemaVersion !== 'requirements-contract-judge-audit-packet/v1') fail('version_unknown');
    return value;
  }
  if (Object.keys(value).some((key) => !['schemaVersion', 'semanticRevisionId', 'scopeSemanticHash', 'body', 'payloadDictionary', 'packetHash'].includes(key)) ||
    !object(value.body)) fail('fields_invalid');
  const { packetHash, ...payload } = value;
  if (packetHash !== sha256(canonicalJson(payload))) fail('hash_mismatch');
  const decoded = restoreRequirementsTypedDictionaries(transformRequirementsAuditSourceSpanReferences(
    decodeGoalSemanticDictionary(value.payloadDictionary), true));
  if (!object(decoded) || !Array.isArray(decoded.artifactPayloadGroups) || !object(decoded.semanticIr)) fail('dictionary_body_invalid');
  const semanticIr = decoded.semanticIr as unknown as RequirementsContractSemanticIr;
  if (validateRequirementsContractSemanticIr(semanticIr).decision !== 'pass' || semanticIr.scopeSemanticHash !== value.scopeSemanticHash ||
    semanticIr.semanticRevisionId !== value.semanticRevisionId) fail('semantic_authority_invalid');
  const authority = normalizeRequirementsContractSemanticIrAuthority(semanticIr) as RequirementsSemanticCandidate;
  if (authority.candidateHash !== decoded.normalizedSemanticCandidateHash) fail('semantic_candidate_hash_mismatch');
  for (const field of ['semanticRevisionId', 'scopeSemanticHash', 'requirementIds', 'artifactIds', 'mandatoryDimensionIds']) {
    if (canonicalJson(value.body[field]) !== canonicalJson(decoded[field])) fail('header_mismatch');
  }
  const artifactPayloadGroups = decoded.artifactPayloadGroups.map((group) => {
    if (!object(group) || !Array.isArray(group.artifactIds) ||
      Object.keys(group).some((key) => !['artifactIds', 'payloadHash', 'payloadEncoding', 'payload'].includes(key))) fail('artifact_encoding_invalid');
    const artifact = group.payloadEncoding === 'markdown-composition/v2' ? reconstructComposition(group.payload)
      : group.payloadEncoding === 'canonical-json/v1' ? group.payload : fail('artifact_encoding_invalid');
    if (sha256(canonicalJson(artifact)) !== group.payloadHash) fail('artifact_hash_mismatch');
    return { artifactIds: group.artifactIds, payload: artifact };
  });
  return { schemaVersion: V2, semanticRevisionId: value.semanticRevisionId, scopeSemanticHash: value.scopeSemanticHash,
    body: { ...decoded, artifactPayloadGroups } };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

export function buildRequirementsContractJudgeAuditPacket(input: {
  semanticRevisionId: string;
  scopeSemanticHash: string;
  requirementIds: string[];
  mandatoryDimensionIds: string[];
  lineageNodes: unknown[];
  authorityResolutions: unknown[];
  artifacts: RequirementsContractJudgeAuditArtifact[];
  semanticIr?: RequirementsContractSemanticIr;
}) {
  if (
    input.artifacts.some(
      (artifact) =>
        typeof artifact.artifactId !== 'string' ||
        artifact.artifactId.trim().length === 0 ||
        artifact.payload === undefined
    )
  ) {
    throw new Error('judge_audit_packet_coverage_gap');
  }
  const artifactIds = input.artifacts.map((artifact) => artifact.artifactId);
  if (new Set(artifactIds).size !== artifactIds.length) {
    throw new Error('judge_audit_packet_artifact_id_duplicate');
  }
  const byPayload = new Map<string, { artifactIds: string[]; payload: unknown }>();
  for (const artifact of input.artifacts) {
    const canonicalPayload = canonicalJson(artifact.payload);
    const existing = byPayload.get(canonicalPayload);
    if (existing) {
      existing.artifactIds.push(artifact.artifactId);
    } else {
      byPayload.set(canonicalPayload, { artifactIds: [artifact.artifactId], payload: artifact.payload });
    }
  }
  const artifactPayloadGroups = [...byPayload.values()]
    .map((group) => ({ artifactIds: sortedUnique(group.artifactIds), payload: group.payload }))
    .sort((left, right) => left.artifactIds[0].localeCompare(right.artifactIds[0], 'en'));
  let packet: JsonRecord = {
    schemaVersion: 'requirements-contract-judge-audit-packet/v1' as const,
    semanticRevisionId: input.semanticRevisionId,
    scopeSemanticHash: input.scopeSemanticHash,
    body: {
      semanticRevisionId: input.semanticRevisionId,
      scopeSemanticHash: input.scopeSemanticHash,
      requirementIds: sortedUnique(input.requirementIds),
      artifactIds: sortedUnique(artifactIds),
      mandatoryDimensionIds: sortedUnique(input.mandatoryDimensionIds),
      lineageNodes: input.lineageNodes,
      authorityResolutions: input.authorityResolutions,
      artifactPayloadGroups,
    },
  };
  if (input.semanticIr?.schemaVersion === 'requirements-contract-semantic-ir/v2') {
    const authority = normalizeRequirementsContractSemanticIrAuthority(input.semanticIr) as RequirementsSemanticCandidate;
    const typedGroups = artifactPayloadGroups.map((group) => {
      const composition = input.artifacts.find((artifact) => group.artifactIds.includes(artifact.artifactId) && artifact.composition)?.composition;
      if (composition && reconstructComposition(composition) !== group.payload) fail('composition_roundtrip_mismatch');
      return { artifactIds: group.artifactIds, payloadHash: sha256(canonicalJson(group.payload)),
        payloadEncoding: composition ? 'markdown-composition/v2' : 'canonical-json/v1', payload: composition ?? group.payload };
    });
    const body = packet.body as JsonRecord;
    const payloadDictionary = encodeGoalSemanticDictionary(transformRequirementsAuditSourceSpanReferences(expandRequirementsTypedDictionaries({
      ...body, artifactPayloadGroups: typedGroups, semanticIr: input.semanticIr, normalizedSemanticCandidateHash: authority.candidateHash })));
    const header = Object.fromEntries(['semanticRevisionId', 'scopeSemanticHash', 'requirementIds', 'artifactIds', 'mandatoryDimensionIds'].map((field) => [field, body[field]]));
    const preimage = { schemaVersion: V2, semanticRevisionId: input.semanticRevisionId, scopeSemanticHash: input.scopeSemanticHash,
      body: header, payloadDictionary };
    packet = { ...preimage, packetHash: sha256(canonicalJson(preimage)) };
    resolveRequirementsContractJudgeAuditPacket(packet);
  }
  const serializedPacket = canonicalJson(packet);
  return {
    packet,
    serializedPacket,
    serializedBytes: Buffer.byteLength(serializedPacket, 'utf8'),
  };
}

export function validateRequirementsContractJudgeAuditPacketCoverage(input: {
  packet: unknown;
  expectedArtifactIds: string[];
}) {
  let packet: JsonRecord;
  try { packet = resolveRequirementsContractJudgeAuditPacket(input.packet); }
  catch (error) { return { decision: 'block' as const, issueCodes: [error instanceof Error ? error.message : 'judge_audit_packet_coverage_gap'] }; }
  const body = packet?.body as JsonRecord | null;
  const groups = Array.isArray(body?.artifactPayloadGroups) ? body.artifactPayloadGroups : [];
  const coveredIds: string[] = [];
  let invalid = false;
  for (const value of groups) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalid = true;
      continue;
    }
    const group = value as JsonRecord;
    const keys = Object.keys(group);
    if (
      keys.length !== 2 ||
      !keys.includes('artifactIds') ||
      !keys.includes('payload') ||
      !Array.isArray(group.artifactIds) ||
      group.artifactIds.some((id) => typeof id !== 'string' || !id) ||
      group.payload === undefined
    ) {
      invalid = true;
      continue;
    }
    coveredIds.push(...(group.artifactIds as string[]));
  }
  const expected = sortedUnique(input.expectedArtifactIds);
  const covered = sortedUnique(coveredIds);
  if (
    invalid ||
    coveredIds.length !== covered.length ||
    covered.length !== expected.length ||
    covered.some((id, index) => id !== expected[index])
  ) {
    return { decision: 'block' as const, issueCodes: ['judge_audit_packet_coverage_gap'] };
  }
  return { decision: 'pass' as const, issueCodes: [] as string[] };
}
