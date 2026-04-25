import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('fallback plane cross-stage hard cut', () => {
  it('does not promote a queued rerun into another stage after the hard cut', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runtime-worker-cross-stage-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-cross-stage-01', {
        payload: {
          projectRoot: fixture.root,
          runnerInput: {
            rerunGate: 'brief-contract-gate',
            loopStateId: 'loop-cross-stage-01',
          },
        },
      });

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not materialize human-review hold state from queued fallback-plane events anymore', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runtime-worker-hold-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-cross-stage-02', {
        payload: {
          projectRoot: fixture.root,
          runnerInput: {
            rerunGate: 'story-stage4-gate',
            loopStateId: 'loop-cross-stage-02',
          },
        },
      });

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
