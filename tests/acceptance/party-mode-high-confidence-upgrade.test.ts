import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertGateProfileSelectionAllowed,
  inferGateProfileId,
} from '../../scripts/party-mode-runtime';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const ROOT = process.cwd();

function makeHookReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-upgrade-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode high-confidence upgrade', () => {
  it('rejects quick_probe_20 when the prompt asks for high-confidence final outputs', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task: 'Run quick_probe_20 party-mode-facilitator for BUGFIX final solution and §7 task list',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('upgrade to final_solution_task_list_100');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('rejects decision_root_cause_50 when callers try to use it for high-confidence final outputs', () => {
    expect(() =>
      assertGateProfileSelectionAllowed(
        'decision_root_cause_50',
        'Run facilitator for BUGFIX final solution and §7 task list'
      )
    ).toThrow(/upgrade to final_solution_task_list_100/);
  });

  it('defaults unqualified final-output requests to final_solution_task_list_100', () => {
    expect(inferGateProfileId('Run facilitator for BUGFIX final solution and §7 task list')).toBe(
      'final_solution_task_list_100'
    );
  });
});
