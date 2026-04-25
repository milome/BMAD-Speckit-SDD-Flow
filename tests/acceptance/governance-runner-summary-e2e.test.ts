import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('governance runner summary end-to-end flow', () => {
  it('does not generate runner summary output because the worker no longer runs', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runner-summary-e2e-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-runner-summary-01');

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
