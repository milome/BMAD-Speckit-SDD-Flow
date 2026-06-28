import { existsSync, readFileSync, rmSync } from 'node:fs';
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
      let stderr = '';
      let result: ReturnType<typeof runAuthoring> | null = null;
      const originalStderrWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        return true;
      }) as typeof process.stderr.write;
      try {
        result = runAuthoring(root, source, 'REQ-CHECKPOINT-MAIN', {
          targetPath: 'vnpy/chart/multi_timeframe_widget.py',
          requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
          criticalAuditorRound: cleanCriticalAuditorRound,
        });
      } finally {
        process.stderr.write = originalStderrWrite;
      }
      const paths = artifacts(root, 'REQ-CHECKPOINT-MAIN', 'REQ-CHECKPOINT-MAIN-SET');
      const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const ref = evidence.checkpointPersistenceRef as Record<string, unknown>;
      const progress = readJson<Record<string, unknown>>(paths.progress);
      const checkpointIds = [
        'cp-00-semantic-kernel',
        'cp-01-must-decomposition-packet',
        'cp-02-atomic-decomposition-loop-convergence',
        'cp-03-packet-to-source-materialization',
        'cp-04-id-freeze',
        'cp-05-implementation-confirmation-core',
        'cp-06-projections',
        'cp-07-human-readable-views',
        'cp-08-pre-render-global-reconciliation',
      ];

      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
      expect(String(route.decision)).toBe('single_pass_final_allowed');
      expect(route.checkpointPersistenceSatisfied).toBe(true);
      expect(evidence).toMatchObject({
        checkpointPersistenceSatisfiedCandidate: true,
      });
      expect(evidence).not.toHaveProperty('completedCheckpointIds');
      expect(ref.completedCheckpointIds).toEqual(checkpointIds);
      expect(Array.isArray(ref.checkpointReceiptRefs)).toBe(true);
      expect(ref.checkpointReceiptRefs).toHaveLength(checkpointIds.length);
      for (const [index, checkpointId] of checkpointIds.entries()) {
        const receiptPath = paths.checkpointReceiptPaths[index];
        expect(existsSync(receiptPath)).toBe(true);
        const receipt = readJson<Record<string, unknown>>(receiptPath);
        expect(receipt).toMatchObject({
          schemaVersion: 'requirements-contract-checkpoint-receipt/v1',
          checkpointId,
          status: 'passed',
          recordId: 'REQ-CHECKPOINT-MAIN',
        });
        expect(String(receipt.receiptHash)).toMatch(/^sha256:/u);
      }
      expect(progress.resumeLedger).toMatchObject({
        schemaVersion: 'requirements-contract-checkpoint-resume-ledger/v1',
        completedCheckpointIds: checkpointIds,
      });
      expect(progress.lastCompletedCheckpoint).toBe('cp-08-pre-render-global-reconciliation');
      expect(progress.currentCheckpoint).toBe(null);
      expect(progress.next).toBe(null);
      expect(ref.progressHash).toBeTruthy();
      expect(ref.preRenderMustDecompositionGateHash).toBeTruthy();
      expect(ref.preRenderGlobalConsistencyHash).toBeTruthy();
      expect(ref.packetSourceReconciliationHash).toBeTruthy();
      expect(stderr).toContain('[requirements-contract-authoring] checkpoint trace start');
      for (const checkpointId of checkpointIds) {
        expect(stderr).toContain(`checkpoint phase=start id=${checkpointId}`);
        expect(stderr).toContain(`checkpoint phase=result id=${checkpointId} result=passed`);
      }
      expect(stderr).toContain('artifact=_bmad-output/runtime/requirement-records/REQ-CHECKPOINT-MAIN/authoring/');
      expect(stderr).toContain('hash=sha256:');
      expect(stderr).toContain('next=cp-01-must-decomposition-packet');
      expect(stderr).toContain('next=checkpoint-persistence-summary');
      expect(stderr).toContain('checkpoint-persistence summary');
      expect(result?.blockingIssues.map((issue) => issue.code)).not.toContain(
        'checkpoint_required_before_source_materialization'
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('restarts checkpoint execution when existing receipt files are stale for the current transaction', () => {
    const root = createTempRoot('requirements-contract-checkpoint-resume-');
    try {
      const source = writeMinimalConsumerRequirement(root, 'docs/plans/checkpoint-resume.md');
      runAuthoring(root, source, 'REQ-CHECKPOINT-RESUME', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-CHECKPOINT-RESUME', 'REQ-CHECKPOINT-RESUME-SET');
      const cp00Before = readJson<Record<string, unknown>>(paths.checkpointReceiptPaths[0]);
      const cp01Before = readJson<Record<string, unknown>>(paths.checkpointReceiptPaths[1]);
      for (const receiptPath of paths.checkpointReceiptPaths.slice(2)) {
        rmSync(receiptPath, { force: true });
      }
      rmSync(paths.checkpointPersistenceEvidence, { force: true });

      const result = runAuthoring(root, source, 'REQ-CHECKPOINT-RESUME', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const progress = readJson<Record<string, unknown>>(paths.progress);
      const evidence = readJson<Record<string, unknown>>(paths.checkpointPersistenceEvidence);
      const ref = evidence.checkpointPersistenceRef as Record<string, unknown>;

      const cp00After = readJson<Record<string, unknown>>(paths.checkpointReceiptPaths[0]);
      const cp01After = readJson<Record<string, unknown>>(paths.checkpointReceiptPaths[1]);
      expect(cp00After.receiptHash).not.toBe(cp00Before.receiptHash);
      expect(cp01After.receiptHash).not.toBe(cp01Before.receiptHash);
      expect(cp00After.sourceDocumentHash).not.toBe(cp00Before.sourceDocumentHash);
      expect(cp01After.sourceDocumentHash).not.toBe(cp01Before.sourceDocumentHash);
      for (const receiptPath of paths.checkpointReceiptPaths) {
        expect(existsSync(receiptPath)).toBe(true);
      }
      expect((progress.resumeLedger as Record<string, unknown>).completedCheckpointIds).toHaveLength(9);
      expect(ref.checkpointReceiptRefs).toHaveLength(9);
      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'checkpoint_required_before_source_materialization'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
