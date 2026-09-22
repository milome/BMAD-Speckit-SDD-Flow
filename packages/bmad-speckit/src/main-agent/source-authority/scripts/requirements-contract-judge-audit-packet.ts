import { canonicalJson } from './requirements-contract-governed-write';
import {
  publishRequirementsContentObject,
  readRequirementsContentObject,
  type RequirementsContentRef,
} from './requirements-contract-content-store';
import { requirementsContractDomainHash } from './requirements-contract-hash-domains';
import {
  validateRequirementsContractSemanticIr,
  type RequirementsContractSemanticIr,
} from './requirements-contract-semantic-ir';

type JsonRecord = Record<string, unknown>;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const V3 = 'requirements-contract-judge-audit-packet/v3';
const DRAFT = 'requirements-contract-judge-audit-draft/v1';
const object = (value: unknown): value is JsonRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function fail(code: string): never {
  throw new Error(`requirements_judge_audit_packet_${code}`);
}
const V3_KEYS = new Set([
  'schemaVersion', 'judgeProtocolVersion', 'scopeSemanticHash', 'judgeInputSemanticHash',
  'semanticIrRef', 'semanticAuditSliceRefs', 'mandatoryDimensionIds',
  'coverageSemanticHash', 'packetHash',
]);

export interface RequirementsContractJudgeAuditArtifact {
  artifactId: string;
  payload: unknown;
  composition?: { schemaVersion: 'RequirementsMarkdownComposition/v2'; separator: string;
    parts: Array<string | { canonicalJson: unknown }> };
}

export function validateJudgeAuditPacketV3(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('v3_invalid');
  const packet = value as JsonRecord;
  if (
    Object.keys(packet).length !== V3_KEYS.size ||
    Object.keys(packet).some((key) => !V3_KEYS.has(key)) ||
    packet.schemaVersion !== V3 ||
    packet.judgeProtocolVersion !== 'requirements-judge-protocol/v1' ||
    !SHA256.test(String(packet.scopeSemanticHash)) ||
    !SHA256.test(String(packet.judgeInputSemanticHash)) ||
    !SHA256.test(String(packet.coverageSemanticHash)) ||
    !Array.isArray(packet.semanticAuditSliceRefs) ||
    !Array.isArray(packet.mandatoryDimensionIds)
  ) fail('v3_invalid');
  const { packetHash, ...payload } = packet;
  if (packetHash !== requirementsContractDomainHash(V3, payload)) fail('v3_hash_mismatch');
  return packet;
}

export function buildRequirementsContractJudgeAuditPacketV3(input: {
  recordRoot: string;
  packet: unknown;
  semanticIr?: unknown;
  semanticIrRef?: RequirementsContentRef;
  artifactEntries?: Array<{
    artifactId: string;
    role: string;
    schemaVersion: string;
    semanticHash: string;
    contentRef: RequirementsContentRef;
  }>;
}): JsonRecord {
  const resolved = validateRequirementsContractJudgeAuditDraft(input.packet);
  const body = object(resolved.body) ? resolved.body as JsonRecord : {};
  const semanticIr = object(body.semanticIr)
    ? body.semanticIr
    : {
        schemaVersion: 'requirements-contract-judge-semantic-slice/v1',
        semanticRevisionId: resolved.semanticRevisionId ?? null,
        scopeSemanticHash: resolved.scopeSemanticHash,
        requirementIds: body.requirementIds ?? [],
      };
  if ((input.semanticIrRef === undefined) !== (input.artifactEntries === undefined)) {
    fail('v3_ref_input_incomplete');
  }
  const semanticIrRef = input.semanticIrRef ?? publishRequirementsContentObject({
    recordRoot: input.recordRoot,
    role: 'judge_semantic_ir',
    mediaType: 'application/json',
    bytes: Buffer.from(canonicalJson(semanticIr), 'utf8'),
  });
  const { semanticIr: _semanticIr, ...auditBody } = body;
  let semanticAuditSliceRefs: Array<{
    role: string;
    schemaVersion: string;
    semanticHash: string;
    contentRef: RequirementsContentRef;
  }>;
  if (input.artifactEntries) {
    const semanticIrBytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: semanticIrRef });
    const referencedSemanticIr = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(semanticIrBytes));
    if (canonicalJson(referencedSemanticIr) !== canonicalJson(input.semanticIr ?? semanticIr)) {
      fail('v3_semantic_ir_ref_mismatch');
    }
    const artifactPayloadGroups = Array.isArray(auditBody.artifactPayloadGroups)
      ? auditBody.artifactPayloadGroups as JsonRecord[] : [];
    const payloadByArtifactId = new Map<string, unknown>();
    for (const group of artifactPayloadGroups) {
      if (!Array.isArray(group.artifactIds) || group.payload === undefined) fail('v3_artifact_group_invalid');
      for (const artifactId of group.artifactIds as unknown[]) {
        if (typeof artifactId !== 'string' || payloadByArtifactId.has(artifactId)) fail('v3_artifact_group_invalid');
        payloadByArtifactId.set(artifactId, group.payload);
      }
    }
    if (
      payloadByArtifactId.size !== input.artifactEntries.length ||
      input.artifactEntries.some((entry) => !payloadByArtifactId.has(entry.artifactId))
    ) fail('v3_artifact_ref_coverage_mismatch');
    const artifactRefBindings = input.artifactEntries
      .map((entry) => ({ artifactId: entry.artifactId, role: entry.role, schemaVersion: entry.schemaVersion }))
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId, 'en'));
    const { artifactPayloadGroups: _artifactPayloadGroups, ...metadataBody } = auditBody;
    const metadataSlice = {
      schemaVersion: 'requirements-contract-judge-metadata-slice/v1',
      semanticRevisionId: resolved.semanticRevisionId ?? null,
      scopeSemanticHash: resolved.scopeSemanticHash,
      body: metadataBody,
      artifactRefBindings,
    };
    const metadataRef = publishRequirementsContentObject({
      recordRoot: input.recordRoot,
      role: 'judge_metadata_slice',
      mediaType: 'application/json',
      bytes: Buffer.from(canonicalJson(metadataSlice), 'utf8'),
    });
    const artifactRefs = input.artifactEntries.map((entry) => {
      const bytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: entry.contentRef });
      const payload = /^text\/(?:markdown|plain)(?:;|$)/iu.test(entry.contentRef.mediaType)
        ? new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        : JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (canonicalJson(payload) !== canonicalJson(payloadByArtifactId.get(entry.artifactId))) {
        fail('v3_artifact_ref_mismatch');
      }
      if (entry.semanticHash !== requirementsContractDomainHash(
        `requirements-projection:${entry.role}/v1`, payload
      )) fail('v3_artifact_semantic_hash_mismatch');
      return {
        role: entry.artifactId,
        schemaVersion: entry.schemaVersion,
        semanticHash: entry.semanticHash,
        contentRef: entry.contentRef,
      };
    });
    semanticAuditSliceRefs = [{
      role: 'judge_metadata',
      schemaVersion: 'requirements-contract-judge-metadata-slice/v1',
      semanticHash: requirementsContractDomainHash('requirements-audit-slice:judge-metadata/v1', metadataSlice),
      contentRef: metadataRef,
    }, ...artifactRefs].sort((left, right) => left.role.localeCompare(right.role, 'en'));
  } else {
    const auditSlice = {
      schemaVersion: 'requirements-contract-judge-audit-slice/v1',
      semanticRevisionId: resolved.semanticRevisionId ?? null,
      scopeSemanticHash: resolved.scopeSemanticHash,
      body: auditBody,
    };
    const sliceRef = publishRequirementsContentObject({
      recordRoot: input.recordRoot,
      role: 'judge_audit_slice',
      mediaType: 'application/json',
      bytes: Buffer.from(canonicalJson(auditSlice), 'utf8'),
    });
    semanticAuditSliceRefs = [{
      role: 'judge_audit_packet',
      schemaVersion: 'requirements-contract-judge-audit-slice/v1',
      semanticHash: requirementsContractDomainHash('requirements-audit-slice:judge-packet/v1', auditSlice),
      contentRef: sliceRef,
    }];
  }
  const mandatoryDimensionIds = sortedUnique(Array.isArray(body.mandatoryDimensionIds)
    ? body.mandatoryDimensionIds.map(String) : []);
  const coverageSemanticHash = requirementsContractDomainHash('requirements-judge-coverage/v1', {
    requirementIds: sortedUnique(Array.isArray(body.requirementIds) ? body.requirementIds.map(String) : []),
    artifactIds: sortedUnique(Array.isArray(body.artifactIds) ? body.artifactIds.map(String) : []),
  });
  const judgeInputSemanticHash = requirementsContractDomainHash('requirements-judge-input-semantic/v1', {
    scopeSemanticHash: String(resolved.scopeSemanticHash),
    semanticAuditSlices: semanticAuditSliceRefs.map(({ role, schemaVersion, semanticHash }) => ({ role, schemaVersion, semanticHash })),
    mandatoryDimensionIds,
    coverageSemanticHash,
    judgeProtocolVersion: 'requirements-judge-protocol/v1',
  });
  const payload = {
    schemaVersion: V3,
    judgeProtocolVersion: 'requirements-judge-protocol/v1',
    scopeSemanticHash: String(resolved.scopeSemanticHash),
    judgeInputSemanticHash,
    semanticIrRef,
    semanticAuditSliceRefs,
    mandatoryDimensionIds,
    coverageSemanticHash,
  };
  return validateJudgeAuditPacketV3({
    ...payload,
    packetHash: requirementsContractDomainHash(V3, payload),
  });
}

export function publishRequirementsContractJudgeAuditPacketRef(input: {
  recordRoot: string;
  packet: unknown;
}): RequirementsContentRef {
  return publishRequirementsContentObject({
    recordRoot: input.recordRoot,
    role: 'judge_audit_packet',
    mediaType: 'application/json',
    bytes: Buffer.from(canonicalJson(input.packet), 'utf8'),
  });
}

export function hydrateRequirementsContractJudgeAuditPacket(input: {
  recordRoot: string;
  packetRef: RequirementsContentRef;
}): unknown {
  try {
    const bytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: input.packetRef });
    const packet = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (packet?.schemaVersion !== V3) fail('version_retired');
    const descriptor = validateJudgeAuditPacketV3(packet);
    const slices = descriptor.semanticAuditSliceRefs as JsonRecord[];
    if (slices.length === 0) fail('v3_slice_count_invalid');
    const semanticIrBytes = readRequirementsContentObject({
      recordRoot: input.recordRoot,
      ref: descriptor.semanticIrRef as unknown as RequirementsContentRef,
    });
    const semanticIr = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(semanticIrBytes));
    if (
      !object(semanticIr) ||
      !['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2']
        .includes(String(semanticIr.schemaVersion)) ||
      validateRequirementsContractSemanticIr(semanticIr).decision !== 'pass' ||
      semanticIr.scopeSemanticHash !== descriptor.scopeSemanticHash
    ) fail('v3_semantic_ir_invalid');
    const metadataRef = slices.find((slice) => slice.role === 'judge_metadata');
    if (metadataRef) {
      if (slices.filter((slice) => slice.role === 'judge_metadata').length !== 1) fail('v3_slice_count_invalid');
      const metadataBytes = readRequirementsContentObject({
        recordRoot: input.recordRoot,
        ref: metadataRef.contentRef as unknown as RequirementsContentRef,
      });
      const metadataSlice = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes));
      if (
        !object(metadataSlice) || metadataSlice.schemaVersion !== 'requirements-contract-judge-metadata-slice/v1' ||
        !object(metadataSlice.body) || !Array.isArray(metadataSlice.artifactRefBindings) ||
        requirementsContractDomainHash('requirements-audit-slice:judge-metadata/v1', metadataSlice) !== metadataRef.semanticHash
      ) fail('v3_slice_hash_mismatch');
      const bindings = metadataSlice.artifactRefBindings as JsonRecord[];
      const artifactSlices = slices.filter((slice) => slice.role !== 'judge_metadata');
      if (bindings.length !== artifactSlices.length) fail('v3_artifact_ref_coverage_mismatch');
      const artifactPayloadGroups = artifactSlices.map((slice) => {
        const binding = bindings.find((entry) => entry.artifactId === slice.role);
        if (!binding || binding.schemaVersion !== slice.schemaVersion || typeof binding.role !== 'string') {
          fail('v3_artifact_ref_coverage_mismatch');
        }
        const artifactRole = binding.role;
        const bytes = readRequirementsContentObject({
          recordRoot: input.recordRoot,
          ref: slice.contentRef as unknown as RequirementsContentRef,
        });
        const mediaType = String((slice.contentRef as JsonRecord).mediaType ?? '');
        const payload = /^text\/(?:markdown|plain)(?:;|$)/iu.test(mediaType)
          ? new TextDecoder('utf-8', { fatal: true }).decode(bytes)
          : JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (requirementsContractDomainHash(
          `requirements-projection:${artifactRole}/v1`, payload
        ) !== slice.semanticHash) fail('v3_artifact_semantic_hash_mismatch');
        return { artifactIds: [String(slice.role)], payload };
      });
      const body = metadataSlice.body as JsonRecord;
      const coverageSemanticHash = requirementsContractDomainHash('requirements-judge-coverage/v1', {
        requirementIds: sortedUnique(Array.isArray(body.requirementIds) ? body.requirementIds.map(String) : []),
        artifactIds: sortedUnique(Array.isArray(body.artifactIds) ? body.artifactIds.map(String) : []),
      });
      if (coverageSemanticHash !== descriptor.coverageSemanticHash) fail('v3_coverage_hash_mismatch');
      const judgeInputSemanticHash = requirementsContractDomainHash('requirements-judge-input-semantic/v1', {
        scopeSemanticHash: String(descriptor.scopeSemanticHash),
        semanticAuditSlices: slices.map(({ role, schemaVersion, semanticHash }) => ({ role, schemaVersion, semanticHash })),
        mandatoryDimensionIds: descriptor.mandatoryDimensionIds,
        coverageSemanticHash: descriptor.coverageSemanticHash,
        judgeProtocolVersion: descriptor.judgeProtocolVersion,
      });
      if (judgeInputSemanticHash !== descriptor.judgeInputSemanticHash) fail('v3_input_hash_mismatch');
      return {
        schemaVersion: 'requirements-contract-judge-audit-packet/v3-hydrated',
        scopeSemanticHash: descriptor.scopeSemanticHash,
        judgeInputSemanticHash: descriptor.judgeInputSemanticHash,
        body: { ...body, artifactPayloadGroups, semanticIr },
      };
    }
    if (slices.length !== 1) fail('v3_slice_count_invalid');
    const slice = slices[0];
    const sliceBytes = readRequirementsContentObject({ recordRoot: input.recordRoot,
      ref: slice.contentRef as unknown as RequirementsContentRef });
    const auditSlice = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sliceBytes));
    if (!object(auditSlice) || auditSlice.schemaVersion !== 'requirements-contract-judge-audit-slice/v1' ||
      !object(auditSlice.body) || requirementsContractDomainHash(
        'requirements-audit-slice:judge-packet/v1', auditSlice) !== slice.semanticHash) fail('v3_slice_hash_mismatch');
    return {
      schemaVersion: 'requirements-contract-judge-audit-packet/v3-hydrated',
      scopeSemanticHash: descriptor.scopeSemanticHash,
      judgeInputSemanticHash: descriptor.judgeInputSemanticHash,
      body: { ...(auditSlice.body as JsonRecord), semanticIr },
    };
  } catch {
    throw new Error('requirements_judge_audit_packet_ref_mismatch');
  }
}

export const REQUIREMENTS_JUDGE_AUDIT_PACKET_V3_PROTOCOL =
  'requirements-contract-judge-audit-packet/v3-hydrated carries direct semantic IR plus the complete audited slices in body. Audit that body exactly once; refs and renderer metadata are not semantic findings.';

export function validateRequirementsContractJudgeAuditDraft(value: unknown): JsonRecord {
  if (!object(value) || value.schemaVersion !== DRAFT || !object(value.body)) fail('draft_invalid');
  if (
    Object.keys(value).length !== 4 ||
    !['schemaVersion', 'semanticRevisionId', 'scopeSemanticHash', 'body'].every((key) => key in value) ||
    !SHA256.test(String(value.scopeSemanticHash))
  ) fail('draft_invalid');
  return value;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

export function buildRequirementsContractJudgeAuditDraft(input: {
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
  const packet: JsonRecord = {
    schemaVersion: DRAFT,
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
      ...(input.semanticIr ? { semanticIr: input.semanticIr } : {}),
    },
  };
  validateRequirementsContractJudgeAuditDraft(packet);
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
  try { packet = validateRequirementsContractJudgeAuditDraft(input.packet); }
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
