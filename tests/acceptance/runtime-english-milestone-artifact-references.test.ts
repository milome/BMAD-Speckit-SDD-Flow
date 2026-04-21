import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime english milestone artifact references', () => {
  it('keeps milestone tests discoverable from the implementation plan', () => {
    const root = process.cwd();
    const implPlan = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md'),
      'utf8'
    );
    expect(implPlan).toContain('story-instance');
    expect(implPlan).toContain('Cursor native hooks');
  });
});
