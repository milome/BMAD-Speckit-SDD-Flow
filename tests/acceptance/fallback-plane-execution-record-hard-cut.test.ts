import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listGovernancePacketExecutionRecords } from '../../scripts/governance-packet-execution-store';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('fallback plane execution record hard cut', () => {
  it('does not create execution records once autonomous fallback has been hard cut', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runtime-worker-exec-record-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-item-01');

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
      expect(listGovernancePacketExecutionRecords(fixture.root)).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });
});
