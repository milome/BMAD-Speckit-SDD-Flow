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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-intensity-preflight-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode intensity preflight', () => {
  it('blocks facilitator startup when no explicit 20/50/100 selection is provided', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task:
            'Run party-mode-facilitator with 100 rounds (final_solution_task_list_100) for BUGFIX final solution and §7 task list',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Party-Mode preflight: main Agent must ask the user to choose intensity'
      );
      expect(result.stderr).toContain('请直接向用户发送以下模板，不要直接启动 facilitator');
      expect(result.stderr).toContain('quick_probe_20');
      expect(result.stderr).toContain('decision_root_cause_50');
      expect(result.stderr).toContain('final_solution_task_list_100');
      expect(result.stderr).toContain('推荐档位：`final_solution_task_list_100`');
      expect(result.stderr).toContain(
        '必须等待用户明确回复 `20` / `50` / `100` 后再继续'
      );
      expect(result.stderr).toContain('## 用户选择');
      expect(result.stderr).toContain('强度: 50 (decision_root_cause_50)');
      expect(result.stderr).toContain('只有这种专用“用户选择”确认块才算授权');

      const sessionsDir = path.join(tempRoot, '_bmad-output', 'party-mode', 'sessions');
      expect(fs.existsSync(sessionsDir)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows facilitator startup once an explicit gateProfileId is provided', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          gateProfileId: 'decision_root_cause_50',
          task: 'Run party-mode-facilitator for RCA comparison',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = output.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('Party Mode Session Bootstrap');
      expect(additionalContext).toContain('"gate_profile_id": "decision_root_cause_50"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows facilitator startup once the task carries a dedicated confirmed user selection block', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task:
            '## 用户选择\n强度: 50 (decision_root_cause)\n\nRun party-mode-facilitator for RCA comparison',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = output.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('Party Mode Session Bootstrap');
      expect(additionalContext).toContain('"gate_profile_id": "decision_root_cause_50"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows facilitator startup once the task uses a plain 用户选择 heading line', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task:
            '用户选择\n\n强度: 20 (quick_probe_20)\n\nRun party-mode-facilitator for quick probe',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = output.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('Party Mode Session Bootstrap');
      expect(additionalContext).toContain('"gate_profile_id": "quick_probe_20"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('fails with a retry instruction instead of re-asking the user when free text already acknowledges the chosen intensity', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task:
            '确认，用户选择 20 (quick_probe_20)。请立即按该档位正式启动 party-mode-facilitator。',
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'a user-selected intensity was detected in free text'
      );
      expect(result.stderr).toContain('不要再次询问用户 20 / 50 / 100');
      expect(result.stderr).toContain('强度: 20 (quick_probe_20)');
      expect(result.stderr).toContain('然后立刻重新调用 `@"party-mode-facilitator (agent)"`');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows facilitator startup when the task carries embedded Session Bootstrap JSON with gate profile', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const task = [
        'Session Bootstrap (JSON)',
        '',
        '{',
        '  "session_key": "cursor-subagents-cont-001",',
        '  "gate_profile_id": "quick_probe_20",',
        '  "closure_level": "none",',
        '  "current_batch_target_round": 20,',
        '  "target_rounds_total": 20',
        '}',
        '',
        '## Session 状态',
        '- 当前轮次: 已完成 Round 10',
      ].join('\n');

      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task,
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = output.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('本回合 Runtime Governance（JSON）');
      expect(additionalContext).not.toContain('请选择本次 Party-Mode 讨论强度');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);
});
