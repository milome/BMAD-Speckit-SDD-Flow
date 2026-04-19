import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ralph-method script-enforced subset contract', () => {
  it('documents the script-enforced subset in the project-local Ralph skill', () => {
    const skill = readFileSync('_bmad/skills/ralph-method/SKILL.md', 'utf8');

    expect(skill).toContain('Script-Enforced Subset');
    expect(skill).toContain('create/prepare tracking files');
    expect(skill).toContain('record TDD-RED/TDD-GREEN/TDD-REFACTOR phase traces');
    expect(skill).toContain('final compliance verification');
    expect(skill).toContain('bmad-speckit ralph record-phase');
    expect(skill).toContain('bmad-speckit ralph verify');
  });

  it('keeps speckit implement command and agent aligned with the script-enforced subset', () => {
    const command = readFileSync('_bmad/speckit/commands/speckit.implement.md', 'utf8');
    const agent = readFileSync('.claude/agents/speckit-implement.md', 'utf8');

    expect(command).toContain('Script-Enforced Subset');
    expect(command).toContain('bmad-speckit ralph record-phase');
    expect(command).toContain('bmad-speckit ralph verify');

    expect(agent).toContain('Script-Enforced Subset');
    expect(agent).toContain('bmad-speckit ralph record-phase');
    expect(agent).toContain('bmad-speckit ralph verify');
  });
});
