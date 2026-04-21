import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveBatchCheckpointPaths,
  markBatchCheckpointReady,
  markBatchCompleted,
  recoverBatchProgress,
  startSession,
  writeBatchReceipt,
} from '../../scripts/party-mode-runtime';

function writeCheckpointArtifacts(root: string, sessionKey: string, batchTargetRound: number): void {
  const checkpointPaths = deriveBatchCheckpointPaths(root, sessionKey, batchTargetRound);
  fs.mkdirSync(path.dirname(checkpointPaths.checkpointJsonPath), { recursive: true });
  fs.writeFileSync(checkpointPaths.checkpointJsonPath, '{}\n', 'utf8');
  fs.writeFileSync(checkpointPaths.checkpointMarkdownPath, '# checkpoint\n', 'utf8');
}

describe('party-mode checkpoint delivery state', () => {
  it('replays the current batch when pending has no checkpoint artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-delivery-pending-'));
    try {
      startSession(root, {
        sessionKey: 'pm-delivery-pending-001',
        gateProfileId: 'decision_root_cause_50',
      });

      const recovery = recoverBatchProgress(root, 'pm-delivery-pending-001');
      expect(recovery.action).toBe('replay_current_batch');
      expect(recovery.hasCheckpointArtifacts).toBe(false);
      expect(recovery.hasReceipt).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('replays the checkpoint when checkpoint_ready has already been written', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-delivery-ready-'));
    try {
      startSession(root, {
        sessionKey: 'pm-delivery-ready-001',
        gateProfileId: 'decision_root_cause_50',
      });
      writeCheckpointArtifacts(root, 'pm-delivery-ready-001', 20);
      writeBatchReceipt(root, 'pm-delivery-ready-001');
      markBatchCheckpointReady(root, 'pm-delivery-ready-001');

      const recovery = recoverBatchProgress(root, 'pm-delivery-ready-001');
      expect(recovery.action).toBe('replay_checkpoint');
      expect(recovery.hasCheckpointArtifacts).toBe(true);
      expect(recovery.hasReceipt).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('advances to the next batch when the current batch is already completed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-delivery-completed-'));
    try {
      startSession(root, {
        sessionKey: 'pm-delivery-completed-001',
        gateProfileId: 'decision_root_cause_50',
      });
      writeCheckpointArtifacts(root, 'pm-delivery-completed-001', 20);
      writeBatchReceipt(root, 'pm-delivery-completed-001');
      markBatchCheckpointReady(root, 'pm-delivery-completed-001');
      markBatchCompleted(root, 'pm-delivery-completed-001');

      const recovery = recoverBatchProgress(root, 'pm-delivery-completed-001');
      expect(recovery.action).toBe('advance_next_batch');
      expect(recovery.nextBatchIndex).toBe(2);
      expect(recovery.nextBatchStartRound).toBe(21);
      expect(recovery.nextBatchTargetRound).toBe(40);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
