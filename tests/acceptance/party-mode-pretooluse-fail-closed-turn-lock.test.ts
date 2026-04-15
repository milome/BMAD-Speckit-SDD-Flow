import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const ROOT = process.cwd();

function makeHookReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-turn-lock-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode pretooluse fail-closed turn lock', () => {
  it('blocks follow-up main-thread tools after a party-mode Agent hard stop in the same turn', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const first = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-mode facilitator for Cursor subagents',
            subagent_type: 'general-purpose',
            prompt: 'PARTY MODE ACTIVATED!\n\n讨论主题：如何让 Cursor 编辑器识别并调用其自定义的 Subagents',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(first.status).toBe(0);
      const firstOut = JSON.parse(first.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
      };
      expect(firstOut.continue).toBe(false);
      expect(firstOut.stopReason).toContain('general-purpose 包装调用已被阻止');

      const lockPath = path.join(tempRoot, '.claude', 'state', 'runtime', 'party-mode-turn-lock.json');
      expect(fs.existsSync(lockPath)).toBe(true);

      const lockGuard = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-turn-lock.cjs');
      const second = spawnSync(process.execPath, [lockGuard], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Read',
          tool_input: {
            file_path: 'README.md',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(second.status).toBe(0);
      const secondOut = JSON.parse(second.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(secondOut.continue).toBe(false);
      expect(secondOut.stopReason).toContain('general-purpose 包装调用已被阻止');
      expect(secondOut.systemMessage).toContain(
        'Previous party-mode launch was already fail-closed in this assistant turn.'
      );
      expect(secondOut.systemMessage).toContain('Blocked follow-up tool: `Read`');
      expect(secondOut.systemMessage).toContain('Do not continue this party-mode request in the main thread');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('clears the turn lock on Stop so the next turn is not poisoned', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const lockGuard = require(path.join(
        ROOT,
        '_bmad',
        'runtime',
        'hooks',
        'party-mode-turn-lock.cjs'
      )) as {
        partyModeTurnLockPath: (projectRoot: string) => string;
        writePartyModeTurnLock: (
          projectRoot: string,
          payload: { reason: string; system_message: string }
        ) => unknown;
      };

      lockGuard.writePartyModeTurnLock(tempRoot, {
        reason: 'Party-Mode 必须使用正式 facilitator contract，当前 general-purpose 包装调用已被阻止。',
        system_message: 'blocked',
      });

      const lockPath = lockGuard.partyModeTurnLockPath(tempRoot);
      expect(fs.existsSync(lockPath)).toBe(true);

      const stop = require(path.join(ROOT, '_bmad', 'claude', 'hooks', 'stop.cjs')) as {
        stop: (options?: { projectRoot?: string; waitForWorker?: boolean }) => unknown;
      };
      stop.stop({ projectRoot: tempRoot, waitForWorker: false });

      expect(fs.existsSync(lockPath)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);
});
