import { stableStringify } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { decodeGoalSemanticDictionary, encodeGoalSemanticDictionary } from './goal-semantic-dictionary';

type JsonObject = Record<string, unknown>;
const DICTIONARY_THRESHOLD_BYTES = 128 * 1024;

export function normalizeStandaloneGoalSemanticPayload(payload: JsonObject): JsonObject {
  const plainBytes = Buffer.byteLength(stableStringify(payload), 'utf8');
  if (plainBytes < DICTIONARY_THRESHOLD_BYTES) return payload;
  const dictionary = encodeGoalSemanticDictionary(payload);
  return Buffer.byteLength(stableStringify(dictionary), 'utf8') < plainBytes
    ? dictionary as unknown as JsonObject : payload;
}

export function resolveStandaloneGoalSemanticPayload(candidate: JsonObject): JsonObject {
  const payload = candidate.semanticPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('standalone_goal_semantic_payload_invalid');
  }
  const record = payload as JsonObject;
  if (record.schemaVersion !== undefined) {
    if (candidate.schemaVersion !== 'StandaloneGoalSemanticIR/v2') {
      throw new Error('standalone_goal_semantic_representation_version_mismatch');
    }
    const decoded = decodeGoalSemanticDictionary(record);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('standalone_goal_semantic_payload_invalid');
    }
    return decoded as JsonObject;
  }
  return record;
}
