/**
 * Upstream wiring: dev-story + bmad-story-assistant (Cursor + Claude) contain ensure-run-runtime-context for S11.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const DEV_STORY = join(
  ROOT,
  '_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml'
);
const CURSOR_SKILL = join(ROOT, '_bmad/cursor/skills/bmad-story-assistant/SKILL.md');
const CLAUDE_SKILL = join(ROOT, '_bmad/claude/skills/bmad-story-assistant/SKILL.md');

const CMD = 'bmad-speckit ensure-run-runtime-context';

describe('runtime-upstream-s11-sync-wiring', () => {
  it('dev-story instructions.xml contains ensure-run for dev_story lifecycle', () => {
    const content = readFileSync(DEV_STORY, 'utf8');
    expect(content.includes(CMD)).toBe(true);
    expect(content.includes('--lifecycle dev_story')).toBe(true);
  });

  it('Cursor bmad-story-assistant SKILL contains ensure-run and post_audit for post-audit', () => {
    const content = readFileSync(CURSOR_SKILL, 'utf8');
    expect(content.includes(CMD)).toBe(true);
    expect(content.includes('post_audit')).toBe(true);
  });

  it('Claude bmad-story-assistant SKILL contains ensure-run and post_audit for post-audit', () => {
    const content = readFileSync(CLAUDE_SKILL, 'utf8');
    expect(content.includes(CMD)).toBe(true);
    expect(content.includes('post_audit')).toBe(true);
  });
});
