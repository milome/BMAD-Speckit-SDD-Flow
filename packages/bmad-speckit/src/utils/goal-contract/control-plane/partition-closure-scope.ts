const INTEGRATION_PARTITION_ROLES = new Set([
  'integration',
  'final_integration',
]);

// Schema validation establishes the shape before these dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function uniqueNonEmptyStrings(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw failure('subcontract_governed_scope_invalid');
  }
  return [...value].sort();
}

function deriveClosureScopeMode(partition: SchemaRecord): string {
  const governedPaths = uniqueNonEmptyStrings(
    partition.governedPaths || partition.ownedArtifactPaths || []
  );
  if (governedPaths.length > 0) {
    return 'governed_files';
  }
  if (!INTEGRATION_PARTITION_ROLES.has(partition.partitionRole)) {
    throw failure('subcontract_zero_governed_scope_invalid', {
      partitionRole: partition.partitionRole || null,
    });
  }
  if (
    !Array.isArray(partition.primaryTaskIds) ||
    partition.primaryTaskIds.length === 0 ||
    !Array.isArray(partition.dependencyPartitionIds) ||
    partition.dependencyPartitionIds.length === 0
  ) {
    throw failure('subcontract_integration_verification_incomplete');
  }
  return 'integration_only';
}

module.exports = {
  deriveClosureScopeMode,
};
