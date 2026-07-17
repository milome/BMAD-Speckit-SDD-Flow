import { describe, expect, it } from 'vitest';
import {
  deriveCheckpointProgressState,
  REQUIREMENTS_CONTRACT_CHECKPOINT_IDS,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract checkpoint progress consistency', () => {
  it('derives completed progression only from committed persistence plus passing semantic validation', () => {
    const root = createTempRoot('requirements-contract-checkpoint-progress-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'checkpoint-progress-consistency'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/plans/checkpoint-progress-consistency.md',
        descriptor
      );
      const attemptId = materialized.authoringOptions.implementationAttemptId;
      const result = runAuthoring(root, materialized.sourcePath, 'REQ-CHECKPOINT-PROGRESS', {
        ...materialized.authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(
        root,
        'REQ-CHECKPOINT-PROGRESS',
        'REQ-CHECKPOINT-PROGRESS-SET'
      );
      const progress = readJson<Record<string, any>>(paths.progress);

      expect(result.blockingIssues).toEqual([]);
      expect(progress.implementationAttemptId).toBe(attemptId);
      expect(progress.checkpoints).toHaveLength(9);
      for (const checkpoint of progress.checkpoints) {
        expect(checkpoint).toMatchObject({
          persistenceStatus: 'committed',
          semanticValidationStatus: 'pass',
          status: 'passed',
        });
      }
      expect(progress.resumeLedger.completedCheckpointIds).toHaveLength(9);
      expect(progress.lastCompletedCheckpoint).toBe('cp-08-pre-render-global-reconciliation');
      expect(progress.currentCheckpoint).toBe(null);
      expect(progress.next).toBe(null);
    } finally {
      removeTempRoot(root);
    }
  });

  it('stops progression at cp-02 even when every downstream receipt claims pass', () => {
    const checkpointStates = REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.map((id, index) => ({
      id,
      name: id,
      persistenceStatus: 'committed' as const,
      semanticValidationStatus: index === 2 ? ('block' as const) : ('pass' as const),
      receiptPath: `authoring/checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`,
      receiptHash: `sha256:${String(index).padStart(64, '0')}`,
    }));

    const progress = deriveCheckpointProgressState(checkpointStates);

    expect(progress.checkpoints.slice(0, 2).map((checkpoint) => checkpoint.status)).toEqual([
      'passed',
      'passed',
    ]);
    expect(progress.checkpoints[2].status).toBe('blocked');
    expect(
      progress.checkpoints.slice(3).every((checkpoint) => checkpoint.status === 'pending')
    ).toBe(true);
    expect(progress.completedCheckpointIds).toEqual(
      REQUIREMENTS_CONTRACT_CHECKPOINT_IDS.slice(0, 2)
    );
    expect(progress.lastCompletedCheckpoint).toBe(REQUIREMENTS_CONTRACT_CHECKPOINT_IDS[1]);
    expect(progress.currentCheckpoint).toBe(REQUIREMENTS_CONTRACT_CHECKPOINT_IDS[2]);
    expect(progress.next).toBe(REQUIREMENTS_CONTRACT_CHECKPOINT_IDS[2]);
  });
});
