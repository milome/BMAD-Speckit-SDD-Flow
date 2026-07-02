import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const STEP_12_PATH = path.join(
  ROOT,
  '_bmad',
  'bmm',
  'workflows',
  '2-plan-workflows',
  'bmad-create-prd',
  'steps-c',
  'step-12-complete.md'
);

describe('BMAD create-PRD source PRD lint handoff', () => {
  it('requires source PRD instance lint before source_prd_draft_ready', () => {
    const step = readFileSync(STEP_12_PATH, 'utf8');
    const lintIndex = step.indexOf('lint-requirements-contract-source-prd.ts');
    const readyIndex = step.indexOf('source_prd_draft_ready');

    expect(lintIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(lintIndex);
    expect(step).toContain('--entry-source bmad_prd');
    expect(step).toContain('workflow_status["sourcePrdDraftStatus"] = "source_prd_draft_ready"');
  });

  it('blocks ready state when lint fails and preserves staging repair path', () => {
    const step = readFileSync(STEP_12_PATH, 'utf8');

    expect(step).toContain('source_prd_draft_blocked');
    expect(step).toContain('preserve the PRD for staging repair');
    expect(step).toContain('must enter staging repair before any confirmation-ready claim');
    expect(step).toContain('Never state that source PRD draft readiness means confirmation');
  });
});
