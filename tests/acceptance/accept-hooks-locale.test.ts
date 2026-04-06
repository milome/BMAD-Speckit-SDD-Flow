/**
 * TC.1–TC.3: hooks user-visible strings follow BMAD_HOOKS_LOCALE (en/zh).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');

describe('accept-hooks-locale', () => {
  const prevQuiet = process.env.BMAD_HOOKS_QUIET;

  beforeEach(() => {
    delete process.env.BMAD_HOOKS_QUIET;
  });

  afterEach(() => {
    if (prevQuiet === undefined) delete process.env.BMAD_HOOKS_QUIET;
    else process.env.BMAD_HOOKS_QUIET = prevQuiet;
  });

  it('loads English messages for runtime governance prefix (TC.3)', () => {
    if (!existsSync(path.join(HOOKS, 'messages.en.json'))) {
      expect.fail('missing .claude/hooks/messages.en.json');
    }
    const en = JSON.parse(readFileSync(path.join(HOOKS, 'messages.en.json'), 'utf8')) as {
      runtimeGovernance: { jsonBlockPrefix: string };
    };
    const hookLoad = path.join(HOOKS, 'hook-load-messages.cjs');
    const out = execFileSync(
      process.execPath,
      [
        '-e',
        `process.env.BMAD_HOOKS_LOCALE='en';
const { loadHookMessages } = require(${JSON.stringify(hookLoad)});
const m = loadHookMessages(${JSON.stringify(HOOKS)});
process.stdout.write(String(m.runtimeGovernance.jsonBlockPrefix));`,
      ],
      { encoding: 'utf8', env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' } }
    ).trim();
    expect(out).toBe(en.runtimeGovernance.jsonBlockPrefix);
  });

  it('pre-agent-summary stderr uses English labels when BMAD_HOOKS_LOCALE=en (TC.1)', () => {
    const en = JSON.parse(readFileSync(path.join(HOOKS, 'messages.en.json'), 'utf8')) as {
      preAgentSummary: { title: string; labels: Record<string, string> };
    };
    const stdin = JSON.stringify({
      tool_name: 'Agent',
      tool_input: {
        description: 'test-desc',
        subagent_type: 'generalPurpose',
        prompt: 'hello world',
      },
    });
    const script = path.join(HOOKS, 'pre-agent-summary.cjs');
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' },
    });
    const stderr = r.stderr ?? '';
    expect(stderr).toContain(en.preAgentSummary.title);
    expect(stderr).toContain(en.preAgentSummary.labels.desc);
    expect(stderr).toContain(en.preAgentSummary.labels.type);
    expect(stderr).toContain(en.preAgentSummary.labels.prompt);
    expect(stderr).toContain(en.preAgentSummary.labels.preview);
  });

  it('subagent-result-summary stderr uses English labels when BMAD_HOOKS_LOCALE=en (TC.2)', () => {
    const en = JSON.parse(readFileSync(path.join(HOOKS, 'messages.en.json'), 'utf8')) as {
      subagentResult: {
        title: string;
        milestonesEmpty: string;
        resultSummary: string;
      };
    };
    const stdin = JSON.stringify({
      agent_id: 'test-agent-locale',
      agent_type: 'generalPurpose',
      last_assistant_message: 'done',
      cwd: ROOT,
    });
    const script = path.join(HOOKS, 'subagent-result-summary.cjs');
    const r = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, BMAD_HOOKS_LOCALE: 'en' },
    });
    const stderr = r.stderr ?? '';
    expect(stderr).toContain(en.subagentResult.title);
    expect(stderr).toContain(en.subagentResult.milestonesEmpty);
    expect(stderr).toContain(en.subagentResult.resultSummary);
  });
});
