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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-pretooluse-preflight-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode pretooluse preflight', () => {
  it('blocks Agent launch and returns a main-agent ask template when no explicit intensity is selected', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-Mode: root cause analysis',
            subagent_type: 'party-mode-facilitator',
            prompt:
              '@"party-mode-facilitator (agent)"\n\n- 强度: 100轮 (final_solution_task_list_100)\n请给出 BUGFIX 最终方案与 §7 任务列表。',
          },
        }),
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
      expect(out.stopReason).toContain('先由主 Agent 询问用户选择 20/50/100 强度');
      expect(out.systemMessage).toContain('main Agent must ask the user to choose intensity');
      expect(out.systemMessage).toContain('请选择本次 Party-Mode 讨论强度');
      expect(out.systemMessage).toContain('推荐档位：`final_solution_task_list_100`');
      expect(out.systemMessage).toContain(
        '必须等待用户明确回复 `20` / `50` / `100` 后再继续'
      );
      expect(out.systemMessage).toContain('将所选档位显式传入 `gateProfileId` / `gate_profile_id`');
      expect(out.systemMessage).toContain('## 用户选择');
      expect(out.systemMessage).toContain('强度: 50 (decision_root_cause_50)');
      expect(out.systemMessage).toContain('只有这种专用“用户选择”确认块才算授权');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows Agent pretooluse to continue when the prompt carries a dedicated confirmed user selection block', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-mode: Cursor subagents recognition',
            subagent_type: 'party-mode-facilitator',
            prompt:
              '@"party-mode-facilitator (agent)"\n\n## 用户选择\n强度: 50 (decision_root_cause)\n\n## 用户问题\n讨论 Cursor 自定义 subagents 识别机制。',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).not.toContain('请选择本次 Party-Mode 讨论强度');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('blocks Agent launch when high-confidence final outputs omit the canonical markdown document path', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-mode: BUGFIX finalization',
            subagent_type: 'party-mode-facilitator',
            prompt:
              '@"party-mode-facilitator (agent)"\n\n## 用户选择\n强度: 100 (final_solution_task_list_100)\n\n请给出 BUGFIX 最终方案与 §7 最终任务列表。',
          },
        }),
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
      expect(out.stopReason).toContain('canonical 文档路径');
      expect(out.systemMessage).toContain(
        'high-confidence final outputs require a canonical markdown document path'
      );
      expect(out.systemMessage).toContain('_bmad-output/implementation-artifacts/_orphan/BUGFIX_<slug>.md');
      expect(out.systemMessage).toContain('must write/update that document directly');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows Agent pretooluse to continue when the prompt uses a plain 用户选择 heading line', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-mode: Cursor subagents recognition',
            subagent_type: 'party-mode-facilitator',
            prompt:
              '@"party-mode-facilitator (agent)"\n\n用户选择\n\n强度: 20 (quick_probe_20)\n\n用户问题\n讨论 Cursor 自定义 subagents 识别机制。',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).not.toContain('请选择本次 Party-Mode 讨论强度');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows Agent pretooluse to continue when the launch already carries explicit gateProfileId', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-Mode: standard RCA',
            subagent_type: 'party-mode-facilitator',
            gateProfileId: 'decision_root_cause_50',
            prompt: '@"party-mode-facilitator (agent)"\n\n请做标准 RCA。',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('fails closed with an immediate retry instruction when a user-selected intensity is acknowledged only in free text', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party Mode: Cursor subagent识别',
            subagent_type: 'party-mode-facilitator',
            prompt:
              '@"party-mode-facilitator (agent)"\n\n确认，用户选择 20 (quick_probe_20)。现在请按快速探查档位正式发起 facilitator。',
          },
        }),
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
      expect(out.stopReason).toContain('已检测到用户已选档位');
      expect(out.systemMessage).toContain(
        'a user-selected intensity was detected in free text'
      );
      expect(out.systemMessage).toContain('不要再次询问用户 20 / 50 / 100');
      expect(out.systemMessage).toContain('`gateProfileId` / `gate_profile_id`');
      expect(out.systemMessage).toContain('强度: 20 (quick_probe_20)');
      expect(out.systemMessage).toContain('然后立刻重新调用 `@"party-mode-facilitator (agent)"`');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('fails closed when the main Agent tries to wrap party-mode through general-purpose', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party-mode facilitator for Cursor subagents',
            subagent_type: 'general-purpose',
            prompt:
              'PARTY MODE ACTIVATED!\n\n讨论主题：如何让 Cursor 编辑器识别并调用其自定义的 Subagents',
          },
        }),
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
      expect(out.stopReason).toContain('general-purpose 包装调用已被阻止');
      expect(out.systemMessage).toContain(
        'Party-Mode facilitator must not be launched through `subagent_type: general-purpose`'
      );
      expect(out.systemMessage).toContain('`@"party-mode-facilitator (agent)"`');
      expect(out.systemMessage).toContain('Cursor custom subagents');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('fails closed when the Agent payload only contains prompt-level facilitator mention but no authoritative route token', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party mode facilitator for Cursor subagent recognition',
            gateProfileId: 'decision_root_cause_50',
            prompt:
              '@"party-mode-facilitator (agent)"\n\nParty Mode Session Bootstrap (JSON)\n{"gate_profile_id":"decision_root_cause_50"}',
          },
        }),
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
      expect(out.stopReason).toContain('未提供宿主可证明的 facilitator route');
      expect(out.systemMessage).toContain(
        'does not structurally identify the dedicated facilitator target'
      );
      expect(out.systemMessage).toContain('Observed route token: `unknown`');
      expect(out.systemMessage).toContain('Do not retry with different model parameters');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('allows Agent pretooluse to continue when the prompt carries embedded Session Bootstrap JSON with gate profile', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const prompt = [
        '@"party-mode-facilitator (agent)"',
        '',
        'Session Bootstrap (JSON)',
        '',
        '{',
        '  "session_key": "cursor-subagents-cont-001",',
        '  "gate_profile_id": "decision_root_cause_50",',
        '  "closure_level": "standard",',
        '  "current_batch_target_round": 20,',
        '  "target_rounds_total": 50',
        '}',
        '',
        '## Session 状态',
        '- 当前轮次: 已完成 Round 10',
      ].join('\n');

      const result = spawnSync(process.execPath, [inject], {
        cwd: ROOT,
        input: JSON.stringify({
          tool_name: 'Agent',
          tool_input: {
            description: 'Party Mode Round 11 - Continue',
            subagent_type: 'party-mode-facilitator',
            prompt,
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const out = JSON.parse(result.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).not.toContain('请选择本次 Party-Mode 讨论强度');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);
});
