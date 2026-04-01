/**
 * Upstream wiring S9: create-epics-and-stories step-04 contains sync and S9 marker.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const STEP04 = join(
  ROOT,
  '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md'
);

describe('runtime-upstream-s9-sync-wiring', () => {
  it('step-04-final-validation.md contains sync CLI and Runtime Governance (S9 marker', () => {
    const content = readFileSync(STEP04, 'utf8');
    expect(content.includes('bmad-speckit sync-runtime-context-from-sprint')).toBe(true);
    expect(content.includes('Runtime Governance (S9')).toBe(true);
  });
});
