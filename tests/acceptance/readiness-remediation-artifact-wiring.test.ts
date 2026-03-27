import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('readiness remediation artifact wiring', () => {
  it('canonical readiness workflow and final assessment wire governance-remediation-runner generation', () => {
    const root = process.cwd();
    const workflow = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'check-implementation-readiness',
        'workflow.md'
      ),
      'utf8'
    );
    const step05 = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'check-implementation-readiness',
        'steps',
        'step-05-epic-quality-review.md'
      ),
      'utf8'
    );
    const file = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'check-implementation-readiness',
        'steps',
        'step-06-final-assessment.md'
      ),
      'utf8'
    );

    expect(workflow).toContain('The final assessment produces both the readiness report and a governance remediation artifact for blocker-driven follow-up.');
    expect(step05).toContain("nextStepFile: './step-06-final-assessment.md'");
    expect(file).toContain("remediationArtifactFile: '{planning_artifacts}/{branch}/implementation-readiness-remediation-{{date}}.md'");
    expect(file).toContain('scripts/governance-remediation-runner.ts');
    expect(file).toContain('_bmad/_config/governance-remediation.yaml');
    expect(file).toContain('cursor packet generated');
    expect(file).toContain('claude packet generated');
    expect(file).toContain('`PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`');
    expect(file).toContain('Blocker ownership affected: no');
    expect(file).toContain('Remediation artifact generated: {remediationArtifactFile}');
  });

  it('bmad readiness workflow and final assessment mirror wire governance-remediation-runner generation', () => {
    const root = process.cwd();
    const workflow = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'bmad-check-implementation-readiness',
        'workflow.md'
      ),
      'utf8'
    );
    const step05 = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'bmad-check-implementation-readiness',
        'steps',
        'step-05-epic-quality-review.md'
      ),
      'utf8'
    );
    const file = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'bmad-check-implementation-readiness',
        'steps',
        'step-06-final-assessment.md'
      ),
      'utf8'
    );

    expect(workflow).toContain('The final assessment produces both the readiness report and a governance remediation artifact for blocker-driven follow-up.');
    expect(step05).toContain('Load ./step-06-final-assessment.md for final readiness assessment');
    expect(file).toContain("remediationArtifactFile: '{planning_artifacts}/implementation-readiness-remediation-{{date}}.md'");
    expect(file).toContain('scripts/governance-remediation-runner.ts');
    expect(file).toContain('_bmad/_config/governance-remediation.yaml');
    expect(file).toContain('cursor packet generated');
    expect(file).toContain('claude packet generated');
    expect(file).toContain('`PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`');
    expect(file).toContain('Blocker ownership affected: no');
    expect(file).toContain('Remediation artifact generated: {remediationArtifactFile}');
  });
});
