import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  createAutonomousFallbackDisabledFixture,
  writePendingGovernanceQueueItem,
} from '../helpers/autonomous-fallback-disabled-fixture';

describe('fallback plane scoring-event hard cut', () => {
  it('does not append governance rerun history after the hard cut', async () => {
    const fixture = createAutonomousFallbackDisabledFixture('gov-runtime-worker-scoring-');
    try {
      const scoreDir = path.join(fixture.root, 'packages', 'scoring', 'data');
      mkdirSync(scoreDir, { recursive: true });
      const scorePath = path.join(scoreDir, 'dev-e14-s2-plan-001.json');
      writeFileSync(
        scorePath,
        JSON.stringify(
          {
            run_id: 'dev-e14-s2-plan-001',
            stage: 'plan',
            iteration_count: 0,
          },
          null,
          2
        ),
        'utf8'
      );
      const before = readFileSync(scorePath, 'utf8');

      writePendingGovernanceQueueItem(fixture.root, 'queue-scoring-01');
      await processQueue(fixture.root, { allowAutonomousFallback: true });

      expect(readFileSync(scorePath, 'utf8')).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });
});
