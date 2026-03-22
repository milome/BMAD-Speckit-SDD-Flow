import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('skill governance boundary', () => {
  it('runtime governance terms doc, not skill text, owns canonical dynamic control field definitions', () => {
    const repoRoot = process.cwd();
    const skill = readFileSync(
      path.join(repoRoot, '_bmad', 'claude', 'skills', 'bmad-story-assistant', 'SKILL.md'),
      'utf8'
    );
    const terms = readFileSync(
      path.join(repoRoot, 'docs/reference/runtime-governance-terms.md'),
      'utf8'
    );

    expect(terms).toContain('mandatoryGate');
    expect(terms).toContain('granularityGoverned');
    expect(terms).toContain('triggerStage');
    expect(terms).toContain('scoringEnabled');
    expect(skill.includes('第二控制面')).toBe(false);
    expect(skill.includes('第二语言判断')).toBe(false);
  });
});
