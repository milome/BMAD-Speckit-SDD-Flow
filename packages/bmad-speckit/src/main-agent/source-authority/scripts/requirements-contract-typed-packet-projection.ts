import { stableStringify } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const PROJECTION_REFS = {
  requiredCommands: 'contractExecutionManifest.requiredCommands',
  errorCaseCoverage: 'contractExecutionManifest.errorCaseCoverage',
  acceptanceTests: 'contractExecutionManifest.acceptanceTests',
  e2eSuites: 'contractExecutionManifest.e2eSuites',
} as const;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function equal(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function isTypedV2(packet: JsonRecord): boolean {
  return packet.schemaVersion === 'req-trace-ai-tdd-model-packet/v2';
}

function assertProjectionRefs(packet: JsonRecord): JsonRecord {
  const refs = record(packet.projectionRefs);
  if (!equal(refs, PROJECTION_REFS)) {
    throw new Error('typed_packet_projection_refs_invalid');
  }
  return refs;
}

export function resolveTypedModelPacketProjection(
  packet: JsonRecord,
  key: keyof typeof PROJECTION_REFS,
): unknown {
  const topLevel = packet[key];
  if (!isTypedV2(packet)) return topLevel;
  if (packet.projectionRefs === undefined) {
    if (topLevel === undefined) {
      throw new Error(`typed_packet_projection_refs_missing:${key}`);
    }
    return topLevel;
  }
  const refs = assertProjectionRefs(packet);
  if (refs[key] !== PROJECTION_REFS[key]) {
    throw new Error(`typed_packet_projection_ref_invalid:${key}`);
  }
  const manifest = record(packet.contractExecutionManifest);
  const projected = manifest[key];
  if (projected === undefined) throw new Error(`typed_packet_projection_missing:${key}`);
  if (topLevel !== undefined && !equal(topLevel, projected)) {
    throw new Error(`typed_packet_projection_conflict:${key}`);
  }
  return projected;
}

export function requiredCommandsFromTypedModelPacket(packet: JsonRecord): unknown[] {
  const value = resolveTypedModelPacketProjection(packet, 'requiredCommands');
  if (!Array.isArray(value)) throw new Error('typed_packet_projection_invalid:requiredCommands');
  return value;
}

export function errorCaseCoverageFromTypedModelPacket(packet: JsonRecord): JsonRecord {
  const value = resolveTypedModelPacketProjection(packet, 'errorCaseCoverage');
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('typed_packet_projection_invalid:errorCaseCoverage');
  }
  return value as JsonRecord;
}

export function typedModelPacketProjectionRefs(): typeof PROJECTION_REFS {
  return PROJECTION_REFS;
}
