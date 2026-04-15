import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');

describe('pre-agent-summary party-mode facilitator behavior', () => {
  it('skips audit template preview for explicit party-mode facilitator mention calls', () => {
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: 'Party-Mode: Cursor native subagent analysis',
        subagent_type: 'general-purpose',
        prompt:
          '@"party-mode-facilitator (agent)"\n\n## Party-Mode Session Bootstrap\n**Session Key**: demo\n**Gate Profile**: final_solution_task_list_100',
      },
    });
    const script = path.join(HOOKS, 'pre-agent-summary.cjs');
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' },
    });

    const stderr = r.stderr ?? '';
    expect(stderr).toContain('Agent call summary');
    expect(stderr).toContain('@"party-mode-facilitator (agent)"');
    expect(stderr).not.toContain('[i18n audit template preview]');
    expect(stderr).not.toContain('Audit Scope');
  });

  it('keeps audit template preview for auditor/code-reviewer Agent calls', () => {
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: 'spec auditor',
        subagent_type: 'auditor-spec',
        prompt: 'review the generated spec artifact',
      },
    });
    const script = path.join(HOOKS, 'pre-agent-summary.cjs');
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' },
    });

    const stderr = r.stderr ?? '';
    expect(stderr).toContain('Agent call summary');
    expect(stderr).toContain('[i18n audit template preview]');
    expect(stderr).toContain('Critical Auditor Conclusion');
  });

  it('does not inject audit template preview for non-auditor exploratory Agent calls', () => {
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: '探索 agents 配置结构',
        subagent_type: 'oh-my-claudecode:explore',
        prompt:
          '探索代码库中关于 agents、subagents 的配置文件和结构。查找任何 agent 定义文件或配置。',
      },
    });
    const script = path.join(HOOKS, 'pre-agent-summary.cjs');
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' },
    });

    const stderr = r.stderr ?? '';
    expect(stderr).toContain('Agent call summary');
    expect(stderr).toContain('oh-my-claudecode:explore');
    expect(stderr).not.toContain('[i18n audit template preview]');
    expect(stderr).not.toContain('Critical Auditor Conclusion');
  });
});
