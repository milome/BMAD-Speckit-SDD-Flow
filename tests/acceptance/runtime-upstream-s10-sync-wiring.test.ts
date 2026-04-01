/**
 * Upstream wiring S10: create-story, bmad-story-audit, Cursor skill contain story sync CLI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const CREATE_STORY = join(
  ROOT,
  '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml'
);
const STORY_AUDIT = join(ROOT, '_bmad/claude/agents/bmad-story-audit.md');
const CURSOR_SKILL = join(ROOT, '_bmad/cursor/skills/bmad-story-assistant/SKILL.md');

const SYNC = 'bmad-speckit sync-runtime-context-from-sprint';

describe('runtime-upstream-s10-sync-wiring', () => {
  it('create-story instructions.xml contains sync CLI and --story-key', () => {
    const content = readFileSync(CREATE_STORY, 'utf8');
    expect(content.includes(SYNC)).toBe(true);
    expect(content.includes('--story-key')).toBe(true);
  });

  it('bmad-story-audit.md contains sync CLI', () => {
    const content = readFileSync(STORY_AUDIT, 'utf8');
    expect(content.includes(SYNC)).toBe(true);
  });

  it('Cursor bmad-story-assistant SKILL contains sync CLI', () => {
    const content = readFileSync(CURSOR_SKILL, 'utf8');
    expect(content.includes(SYNC)).toBe(true);
  });
});
