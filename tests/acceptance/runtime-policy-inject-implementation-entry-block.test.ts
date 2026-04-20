import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();

function makeImplementBlockedRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-impl-block-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, {
    flow: 'story',
    stage: 'implement',
    epicId: 'epic-14',
    storyId: '14.1',
    runId: 'run-14-1',
  });
  return tempRoot;
}

describe('runtime-policy-inject implementation-entry block', () => {
  it('fails closed for implementation-like preToolUse when implementation-entry gate is blocked', () => {
    const tempRoot = makeImplementBlockedRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'general-purpose',
          prompt: 'Execute Dev Story implementation now.',
        },
      });
      const result = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('Implementation Entry Gate');
      expect(out.systemMessage).toContain('Implementation Entry Gate blocked');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
