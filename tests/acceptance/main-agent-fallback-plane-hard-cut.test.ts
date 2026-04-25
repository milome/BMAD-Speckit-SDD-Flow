import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';
import { listUnexpectedLegacyConsumerHookFiles } from '../../packages/bmad-speckit/src/services/install-surface-manifest';

describe('main-agent fallback plane hard cut', () => {
  it('keeps remediation queue items pending after the hard cut', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runtime-worker-');
    try {
      const queuePath = writePendingGovernanceQueueItem(fixture.root, 'queue-item-01');

      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(existsSync(queuePath)).toBe(true);
      expect(existsSync(fixture.currentRunPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('removes legacy hook-local worker wrappers from the accepted repo surface', async () => {
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '_bmad', 'runtime', 'hooks'))).toHaveLength(0);
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '.claude', 'hooks'))).toHaveLength(0);
    expect(listUnexpectedLegacyConsumerHookFiles(path.join(process.cwd(), '.cursor', 'hooks'))).toHaveLength(0);
  });
});
