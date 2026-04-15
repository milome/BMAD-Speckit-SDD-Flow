import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveBatchCheckpointPaths,
  markBatchCheckpointReady,
  markBatchCompleted,
  startSession,
  writeBatchReceipt,
} from '../../scripts/party-mode-runtime';

describe('party-mode batch state commit', () => {
  it('commits pending -> checkpoint_ready -> completed through meta.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-batch-state-'));
    try {
      const meta = startSession(root, {
        sessionKey: 'pm-batch-state-001',
        gateProfileId: 'decision_root_cause_50',
      });

      expect(meta.current_batch_status).toBe('pending');

      const checkpointPaths = deriveBatchCheckpointPaths(root, 'pm-batch-state-001', 20);
      fs.mkdirSync(path.dirname(checkpointPaths.checkpointJsonPath), { recursive: true });
      fs.writeFileSync(checkpointPaths.checkpointJsonPath, '{}\n', 'utf8');
      fs.writeFileSync(checkpointPaths.checkpointMarkdownPath, '# checkpoint\n', 'utf8');

      const receiptPaths = writeBatchReceipt(root, 'pm-batch-state-001');
      expect(fs.existsSync(receiptPaths.receiptPath)).toBe(true);

      const checkpointReady = markBatchCheckpointReady(root, 'pm-batch-state-001');
      expect(checkpointReady.current_batch_status).toBe('checkpoint_ready');

      const completed = markBatchCompleted(root, 'pm-batch-state-001');
      expect(completed.current_batch_status).toBe('completed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
