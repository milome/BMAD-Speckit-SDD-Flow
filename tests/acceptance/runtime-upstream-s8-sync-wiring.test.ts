/**
 * Upstream wiring S8: sprint-planning and sprint-status instructions contain sync-runtime-context-from-sprint.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const SPRINT_PLANNING = join(
  ROOT,
  '_bmad/bmm/workflows/4-implementation/sprint-planning/instructions.md'
);
const SPRINT_STATUS = join(
  ROOT,
  '_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md'
);

const SUB = 'bmad-speckit sync-runtime-context-from-sprint';

describe('runtime-upstream-s8-sync-wiring', () => {
  it('sprint-planning instructions.md contains sync CLI', () => {
    const content = readFileSync(SPRINT_PLANNING, 'utf8');
    expect(content.includes(SUB)).toBe(true);
  });

  it('sprint-status instructions.md contains sync CLI', () => {
    const content = readFileSync(SPRINT_STATUS, 'utf8');
    expect(content.includes(SUB)).toBe(true);
  });
});
