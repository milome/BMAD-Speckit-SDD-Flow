import { describe, expect, it } from 'vitest';
import { projectControlledIngestWriterRegistry } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-controlled-ingest-writer-registry';

const HASH =
  'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writerRow(
  writerId: string,
  eventType: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    writerId,
    scriptPath: `packages/bmad-speckit/src/${writerId}.ts`,
    scriptContentHash: HASH,
    ownerModel: 'implementation_readiness',
    allowedWriteApis: ['appendControlEventAndReplay'],
    allowedPaths: ['requirement-record.json'],
    allowedEventTypes: [eventType],
    payloadContractRefs: [eventType],
    writesControlFields: ['nativeGoalHandoff'],
    receiptPath: 'events/receipts/<event-id>.json',
    beforeAfterHashRequired: true,
    canModifyWriterRegistry: false,
    registryHash: HASH,
    architectureConfirmationHash: HASH,
    ...overrides,
  };
}

describe('controlled ingest writer registry projection', () => {
  it('retains the complete goal-contract authority writer binding', () => {
    const confirmation = {
      controlledIngestWriterRegistry: [
        writerRow(
          'requirements-confirmation-ingest',
          'confirmation_recorded'
        ),
        writerRow(
          'goal-contract-authority-supersession',
          'goal_contract_partition_authority_superseded',
          {
            scriptPath:
              'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts',
            allowedPaths: [
              '_bmad-output/runtime/requirement-records/<requirement-set-id>/goal-contract/partition-runs/<partition-run-id>',
            ],
            payloadContractRefs: [
              'goal-contract-partition-authority-supersession/v1',
            ],
            writesControlFields: [
              'nativeGoalHandoff.goalContractPartitionAuthority',
            ],
          }
        ),
      ],
    };

    const projected = projectControlledIngestWriterRegistry(
      confirmation,
      HASH,
      HASH
    );
    const goalWriter = projected.controlledIngestWriterRegistry.find(
      (writer) =>
        writer.writerId === 'goal-contract-authority-supersession'
    );

    expect(goalWriter).toMatchObject({
      writerId: 'goal-contract-authority-supersession',
      eventTypes: [
        'goal_contract_partition_authority_superseded',
      ],
      scriptPath:
        'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts',
      scriptContentHash: HASH,
      allowedWriteApis: ['appendControlEventAndReplay'],
      payloadContractRefs: [
        'goal-contract-partition-authority-supersession/v1',
      ],
      writesControlFields: [
        'nativeGoalHandoff.goalContractPartitionAuthority',
      ],
      beforeAfterHashRequired: true,
      canModifyWriterRegistry: false,
      registryHash: HASH,
      architectureConfirmationHash: HASH,
    });
  });
});
