import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listGovernancePacketExecutionRecords } from '../../scripts/governance-packet-execution-store';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('governance packet closure end-to-end', () => {
  it('never enters running or gate_passed because autonomous fallback execution is gone', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-packet-closure-e2e-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-closure-e2e-01');

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
      expect(listGovernancePacketExecutionRecords(fixture.root)).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });
});
