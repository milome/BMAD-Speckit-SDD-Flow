import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
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
  it('enqueues governance rerun events and triggers detached background drain', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
    process.chdir(root);
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = '1';

    const result = claudeHook.postToolUse({
      type: 'governance-rerun-result',
      payload: {
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
    });

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
    expect(queueFileCount).toBeGreaterThanOrEqual(1);
  });
});
