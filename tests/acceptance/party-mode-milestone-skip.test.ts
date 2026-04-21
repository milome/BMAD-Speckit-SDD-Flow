import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HOOK = path.join(ROOT, '.claude', 'hooks', 'subagent-milestone-init.cjs');
const TEMP_ROOTS: string[] = [];

describe('party-mode milestone skip', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('does not create milestone files or inject bash append instructions for party-mode-facilitator', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-milestone-skip-'));
    TEMP_ROOTS.push(root);

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'pm-agent-001',
        agent_type: 'party-mode-facilitator',
        cwd: root,
      }),
    });

    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout || '{}') as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(out.hookSpecificOutput?.additionalContext ?? '').toBe('');
    expect(
      existsSync(path.join(root, '.claude', 'state', 'milestones', 'pm-agent-001.jsonl'))
    ).toBe(false);
  });

  it('keeps milestone tracking for ordinary subagents', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-milestone-ordinary-'));
    TEMP_ROOTS.push(root);

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'gp-agent-001',
        agent_type: 'general-purpose',
        cwd: root,
      }),
    });

    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout || '{}') as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(out.hookSpecificOutput?.additionalContext).toContain('MILESTONE TRACKING ACTIVE');
    expect(out.hookSpecificOutput?.additionalContext).toContain('Use Bash tool: echo');
    const milestonePath = path.join(root, '.claude', 'state', 'milestones', 'gp-agent-001.jsonl');
    expect(existsSync(milestonePath)).toBe(true);
    expect(readFileSync(milestonePath, 'utf8')).toContain('"event":"agent_start"');
  });
});
