import { canonicalJson } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

export interface RequirementsContractJudgeAuditArtifact {
  artifactId: string;
  payload: unknown;
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
  const packet = {
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
  const packet = input.packet as JsonRecord | null;
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
