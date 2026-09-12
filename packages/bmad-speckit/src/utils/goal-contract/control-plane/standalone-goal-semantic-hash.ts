import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

export function standaloneGoalSemanticIRHash(value: Record<string, unknown>): string {
  if (!['StandaloneGoalSemanticIR/v1', 'StandaloneGoalSemanticIR/v2'].includes(String(value.schemaVersion))) {
    throw new Error('standalone_goal_semantic_version_unsupported');
  }
  return sha256Stable({
    ...(value.schemaVersion === 'StandaloneGoalSemanticIR/v2' ? { schemaVersion: value.schemaVersion,
      sourceSnapshotHash: value.sourceSnapshotHash } : {}),
    sourcePlanHash: value.sourcePlanHash, semanticPayload: value.semanticPayload,
  });
}
