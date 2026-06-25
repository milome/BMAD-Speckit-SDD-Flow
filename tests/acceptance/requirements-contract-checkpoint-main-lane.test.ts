import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract checkpoint main lane', () => {
  it('wires checkpoint persistence evidence through the CLI parser', () => {
    const source = readFileSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
      ),
      'utf8'
    );

    expect(source).toContain('--checkpoint-persistence-evidence');
    expect(source).toContain('out.checkpointPersistenceEvidencePath = argv[++index]');
    expect(source).toContain(
      'checkpointPersistenceEvidencePath: args.checkpointPersistenceEvidencePath'
    );
  });

  it('automatically persists checkpoint evidence for checkpoint_required routes', () => {
    const root = createTempRoot('requirements-contract-checkpoint-main-');
    try {
      const source = writeMinimalConsumerRequirement(root, 'docs/plans/checkpoint-main.md');
      const result = runAuthoring(root, source, 'REQ-CHECKPOINT-MAIN', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-CHECKPOINT-MAIN', 'REQ-CHECKPOINT-MAIN-SET');
      const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const ref = evidence.checkpointPersistenceRef as Record<string, unknown>;

      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
      expect(String(route.decision)).toBe('single_pass_final_allowed');
      expect(route.checkpointPersistenceSatisfied).toBe(true);
      expect(evidence).toMatchObject({
        checkpointPersistenceSatisfiedCandidate: true,
      });
      expect(evidence.completedCheckpointIds).toEqual([
        'cp-00-semantic-kernel',
        'cp-01-must-decomposition-packet',
        'cp-02-atomic-decomposition-loop-convergence',
        'cp-03-packet-to-source-materialization',
        'cp-04-id-freeze',
        'cp-05-implementation-confirmation-core',
        'cp-06-projections',
        'cp-07-human-readable-views',
        'cp-08-pre-render-global-reconciliation',
      ]);
      expect(ref.progressHash).toBeTruthy();
      expect(ref.preRenderMustDecompositionGateHash).toBeTruthy();
      expect(ref.preRenderGlobalConsistencyHash).toBeTruthy();
      expect(ref.packetSourceReconciliationHash).toBeTruthy();
      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'checkpoint_required_before_source_materialization'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
