const OPERATION_METADATA_KEYS = new Set([
  'authoringAttemptId', 'createdAt', 'updatedAt', 'timestamp',
  'renderer', 'rendererId', 'projectionPath', 'stagingPath',
  'attemptManifestHash', 'inputManifestHash', 'previousCheckpointManifestRef',
  'latestValidPredecessorCheckpoint', 'checkpointManifestHash',
]);

export function withoutRequirementsAuthoringOperationMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutRequirementsAuthoringOperationMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !OPERATION_METADATA_KEYS.has(key))
      .map(([key, child]) => [key, withoutRequirementsAuthoringOperationMetadata(child)])
  );
}
