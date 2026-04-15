import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');

describe('pre-agent-summary party-mode facilitator behavior', () => {
  it('skips audit template preview for party-mode-facilitator Agent calls', () => {
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: 'Party-Mode: Cursor native subagent analysis',
        subagent_type: 'party-mode-facilitator',
        prompt:
          '## Party-Mode Session Bootstrap\n**Session Key**: demo\n**Gate Profile**: final_solution_task_list_100',
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
    expect(stderr).toContain('party-mode-facilitator');
    expect(stderr).not.toContain('[i18n audit template preview]');
    expect(stderr).not.toContain('Audit Scope');
  });

  it('keeps audit template preview for normal Agent calls', () => {
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: 'spec auditor',
        subagent_type: 'general-purpose',
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
});
