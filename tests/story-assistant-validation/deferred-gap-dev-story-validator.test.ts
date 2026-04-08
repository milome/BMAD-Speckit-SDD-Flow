import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('Deferred Gap Dev Story validator', () => {
  it('keeps speckit-workflow English/Chinese distributed variants aligned with deferred-gap stage contracts', () => {
    const claudeEn = read('_bmad/claude/skills/speckit-workflow/SKILL.en.md');
    const claudeZh = read('_bmad/claude/skills/speckit-workflow/SKILL.zh.md');
    const cursorEn = read('_bmad/cursor/skills/speckit-workflow/SKILL.en.md');
    const cursorZh = read('_bmad/cursor/skills/speckit-workflow/SKILL.zh.md');

    for (const englishVariant of [claudeEn, cursorEn]) {
      expect(englishVariant).toContain('deferred-gap-register.yaml');
      expect(englishVariant).toContain('Deferred Gap Task Binding');
      expect(englishVariant).toContain('Journey -> Task -> Test -> Closure');
      expect(englishVariant).toContain('closure_evidence');
      expect(englishVariant).toContain('carry_forward_evidence');
    }

    for (const chineseVariant of [claudeZh, cursorZh]) {
      expect(chineseVariant).toContain('deferred-gap-register.yaml');
      expect(chineseVariant).toContain('Deferred Gap Task Binding');
      expect(chineseVariant).toContain('Journey -> Task -> Test -> Closure');
      expect(chineseVariant).toContain('closure_evidence');
      expect(chineseVariant).toContain('carry_forward_evidence');
    }
  });

  it('keeps bmad-story-assistant English/Chinese distributed variants aligned with deferred-gap dev-story guardrails', () => {
    const claudeEn = read('_bmad/claude/skills/bmad-story-assistant/SKILL.en.md');
    const claudeZh = read('_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md');
    const cursorEn = read('_bmad/cursor/skills/bmad-story-assistant/SKILL.en.md');
    const cursorZh = read('_bmad/cursor/skills/bmad-story-assistant/SKILL.zh.md');

    for (const englishVariant of [claudeEn, cursorEn]) {
      expect(englishVariant).toContain('deferred-gap-register.yaml');
      expect(englishVariant).toContain('journey-ledger');
      expect(englishVariant).toContain('trace-map');
      expect(englishVariant).toContain('closure-notes');
      expect(englishVariant).toContain('module complete but journey not runnable');
    }

    for (const chineseVariant of [claudeZh, cursorZh]) {
      expect(chineseVariant).toContain('deferred-gap-register.yaml');
      expect(chineseVariant).toContain('journey-ledger');
      expect(chineseVariant).toContain('trace-map');
      expect(chineseVariant).toContain('closure-notes');
      expect(chineseVariant).toContain('module complete but journey not runnable');
    }
  });
});
