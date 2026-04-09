import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('consumer-governance-validation skill mirrors', () => {
  const canonicalRoot = '_bmad/skills/consumer-governance-validation';
  const cursorRoot = '.cursor/skills/consumer-governance-validation';
  const claudeRoot = '.claude/skills/consumer-governance-validation';
  const referenceFile = 'references/consumer-governance-validation.md';

  it('canonical skill exists under _bmad/skills', () => {
    expect(existsSync(`${canonicalRoot}/SKILL.md`)).toBe(true);
    expect(existsSync(`${canonicalRoot}/${referenceFile}`)).toBe(true);
  });

  it('cursor and claude mirrors both exist', () => {
    expect(existsSync(`${cursorRoot}/SKILL.md`)).toBe(true);
    expect(existsSync(`${claudeRoot}/SKILL.md`)).toBe(true);
    expect(existsSync(`${cursorRoot}/${referenceFile}`)).toBe(true);
    expect(existsSync(`${claudeRoot}/${referenceFile}`)).toBe(true);
  });

  it('mirror file counts match canonical skill', () => {
    const canonicalEntries = readdirSync(canonicalRoot);
    const cursorEntries = readdirSync(cursorRoot);
    const claudeEntries = readdirSync(claudeRoot);
    expect(cursorEntries.length).toBe(canonicalEntries.length);
    expect(claudeEntries.length).toBe(canonicalEntries.length);
  });

  it('mirror contents match canonical skill text', () => {
    const canonicalSkill = readFileSync(`${canonicalRoot}/SKILL.md`, 'utf8');
    const cursorSkill = readFileSync(`${cursorRoot}/SKILL.md`, 'utf8');
    const claudeSkill = readFileSync(`${claudeRoot}/SKILL.md`, 'utf8');
    const canonicalReference = readFileSync(`${canonicalRoot}/${referenceFile}`, 'utf8');
    const cursorReference = readFileSync(`${cursorRoot}/${referenceFile}`, 'utf8');
    const claudeReference = readFileSync(`${claudeRoot}/${referenceFile}`, 'utf8');

    expect(cursorSkill).toBe(canonicalSkill);
    expect(claudeSkill).toBe(canonicalSkill);
    expect(cursorReference).toBe(canonicalReference);
    expect(claudeReference).toBe(canonicalReference);
  });

  it('skill content points to the validation script and packet closure evidence', () => {
    const skill = readFileSync(`${canonicalRoot}/SKILL.md`, 'utf8');
    const reference = readFileSync(`${canonicalRoot}/${referenceFile}`, 'utf8');
    expect(skill).toContain('scripts/validate-consumer-governance.ps1');
    expect(skill).toContain('绝不能删除 `_bmad-output`');
    expect(skill).toContain('post-tool-use');
    expect(reference).toContain('gate_passed');
    expect(reference).toContain('pending_dispatch');
    expect(reference).toContain('保留 `_bmad-output`');
  });
});
