export const requirementRecordSchemaEvolutionPolicy = {
  schemaVersion: 'requirement-record-schema-evolution/v1',
  upcasterRegistry: ['requirement-record/v1'],
  migrationEventTypes: ['control_commit_recovery_recorded', 'closeout_attempt_invalidated'],
  compatibilityMatrix: ['control-event-envelope/v1 -> requirement-record/v1'],
  snapshotOnlyBackfillAllowed: false,
  eventLogRewriteAllowed: false,
} as const;

if (require.main === module) {
  console.log(
    JSON.stringify({ ok: true, policy: requirementRecordSchemaEvolutionPolicy }, null, 2)
  );
}
