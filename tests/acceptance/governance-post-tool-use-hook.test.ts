import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { governancePendingQueueFilePath } from '../../scripts/governance-runtime-queue';
import type { GovernancePostToolUseResult } from '../../scripts/governance-hook-types';

const require = createRequire(import.meta.url);
const cursorHook = require('../../_bmad/cursor/hooks/post-tool-use.js');
const claudeHook = require('../../_bmad/claude/hooks/post-tool-use.js');

const originalCwd = process.cwd();
const originalSkipBackgroundDrain = process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN;
const tempRoots: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  if (originalSkipBackgroundDrain === undefined) {
    delete process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN;
  } else {
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = originalSkipBackgroundDrain;
  }
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('governance post-tool-use hook', () => {
  it.each([
    ['claude', claudeHook],
    ['cursor', cursorHook],
  ])('enqueues governance rerun events and keeps %s background trigger on the unified adapter contract', (_, hook) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
    process.chdir(root);
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = '1';

    const result = hook.postToolUse({
      type: 'governance-rerun-result',
      payload: {
        journeyContractHints: [
          {
            signal: 'smoke_task_chain',
            label: 'Smoke Task Chain',
            count: 1,
            affected_stages: ['tasks'],
            epic_stories: ['E14.S3'],
            recommendation:
              'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
          },
        ],
        runnerInput: {
          projectRoot: root,
          outputPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-2.md'),
          promptText: '继续 readiness 修复',
        },
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'fail',
        },
      },
    }) as GovernancePostToolUseResult;

    const queueRoot = path.join(root, '_bmad-output', 'runtime', 'governance', 'queue');
    const queueBuckets = ['pending', 'processing', 'done', 'failed'] as const;
    const queueFileCount = queueBuckets.reduce((count, bucket) => {
      const bucketDir = path.join(queueRoot, bucket);
      if (!existsSync(bucketDir)) {
        return count;
      }
      return count + readdirSync(bucketDir).filter((file) => file.endsWith('.json')).length;
    }, 0);

    expect(result?.projectRoot).toBe(root);
    expect(result?.backgroundTrigger?.skipped).toBe(true);
    expect(result?.backgroundTrigger?.executorRouting).toMatchObject({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: ['smoke_task_chain'],
    });
    expect(result?.backgroundTrigger?.governancePresentation?.structuredMetadataLines).toEqual(
      expect.arrayContaining([
        '## Governance Structured Metadata',
        '- Routing Mode: targeted',
        '- Executor Route: journey-contract-remediation',
      ])
    );
    expect(result?.backgroundTrigger?.governancePresentation?.rawEventLines).toEqual(
      expect.arrayContaining(['## Governance Latest Raw Event', '暂无 governance raw event 摘要'])
    );
    expect(result?.backgroundTrigger?.journeyContractHints?.map((item) => item.signal)).toEqual([
      'smoke_task_chain',
    ]);
    expect(result?.backgroundTrigger?.stopReason).toBeNull();
    expect(result?.backgroundTrigger).not.toHaveProperty('pendingJourneyContractHints');
    expect(queueFileCount).toBeGreaterThanOrEqual(1);
    const pendingFiles = readdirSync(path.join(queueRoot, 'pending')).filter((file) =>
      file.endsWith('.json')
    );
    expect(pendingFiles.length).toBeGreaterThanOrEqual(1);
    const queued = JSON.parse(
      readFileSync(governancePendingQueueFilePath(root, pendingFiles[0].replace(/\.json$/i, '')), 'utf8')
    ) as {
      payload?: { journeyContractHints?: Array<{ signal: string }> };
    };
    expect(queued.payload?.journeyContractHints?.map((item: { signal: string }) => item.signal)).toEqual([
      'smoke_task_chain',
    ]);
  });
});
