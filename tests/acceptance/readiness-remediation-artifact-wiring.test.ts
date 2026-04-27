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
    const template = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'check-implementation-readiness',
        'templates',
        'readiness-report-template.md'
      ),
      'utf8'
    );

    expect(workflow).toContain(
      'The final assessment produces both the readiness report and a governance remediation artifact for blocker-driven follow-up.'
    );
    expect(step05).toContain("nextStepFile: './step-06-final-assessment.md'");
    expect(file).toContain(
      "remediationArtifactFile: '{planning_artifacts}/{branch}/implementation-readiness-remediation-{{date}}.md'"
    );
    expect(file).toContain('Deferred Gaps Tracking');
    expect(file).toContain('## 可解析评分块（供 parseAndWriteScore）');
    expect(file).toContain('P0 Journey Coverage');
    expect(file).toContain('Smoke E2E Readiness');
    expect(file).toContain('Evidence Proof Chain');
    expect(file).toContain('Cross-Document Traceability');
    expect(file).toContain(
      'the generated remediation artifact must include a `## Structured Deferred Gaps` section'
    );
    expect(file).toContain('scripts/governance-remediation-runner.ts');
    expect(file).toContain('_bmad/_config/governance-remediation.yaml');
    expect(file).toContain('cursor packet generated');
    expect(file).toContain('claude packet generated');
    expect(file).toContain('Do not manually write `.cursor-packet.md` or `.claude-packet.md`');
    expect(file).toContain(
      'Packets must be derived only from `scripts/governance-remediation-runner.ts`'
    );
    expect(file).toContain(
      'The only allowed host-specific differences are `Host Kind` and `Execution Mode`'
    );
    expect(file).toContain(
      'Host packet files must be blocked at PreToolUse if the model attempts to write them directly'
    );
    expect(file).toContain(
      '`PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`'
    );
    expect(file).toContain('Blocker ownership affected: no');
    expect(file).toContain('Remediation artifact generated: {remediationArtifactFile}');
    expect(template).toContain('## Deferred Gaps Tracking');
    expect(template).toContain('| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |');
    expect(template).toContain('## 可解析评分块（供 parseAndWriteScore）');
    expect(template).toContain('P0 Journey Coverage');
    expect(template).toContain('Smoke E2E Readiness');
    expect(template).toContain('Evidence Proof Chain');
    expect(template).toContain('Cross-Document Traceability');
  });

  it('bmad readiness workflow and final assessment mirror also use branch-scoped remediation outputs', () => {
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
    const template = readFileSync(
      path.join(
        root,
        '_bmad',
        'bmm',
        'workflows',
        '3-solutioning',
        'bmad-check-implementation-readiness',
        'templates',
        'readiness-report-template.md'
      ),
      'utf8'
    );

    expect(workflow).toContain(
      'The final assessment produces both the readiness report and a governance remediation artifact for blocker-driven follow-up.'
    );
    expect(step05).toContain('Load ./step-06-final-assessment.md for final readiness assessment');
    expect(file).toContain(
      "remediationArtifactFile: '{planning_artifacts}/{branch}/implementation-readiness-remediation-{{date}}.md'"
    );
    expect(file).toContain('Deferred Gaps Tracking');
    expect(file).toContain('## 可解析评分块（供 parseAndWriteScore）');
    expect(file).toContain('P0 Journey Coverage');
    expect(file).toContain('Smoke E2E Readiness');
    expect(file).toContain('Evidence Proof Chain');
    expect(file).toContain('Cross-Document Traceability');
    expect(file).toContain(
      'the generated remediation artifact must include a `## Structured Deferred Gaps` section'
    );
    expect(file).toContain('scripts/governance-remediation-runner.ts');
    expect(file).toContain('_bmad/_config/governance-remediation.yaml');
    expect(file).toContain('cursor packet generated');
    expect(file).toContain('claude packet generated');
    expect(file).toContain('Do not manually write `.cursor-packet.md` or `.claude-packet.md`');
    expect(file).toContain(
      'Packets must be derived only from `scripts/governance-remediation-runner.ts`'
    );
    expect(file).toContain(
      'The only allowed host-specific differences are `Host Kind` and `Execution Mode`'
    );
    expect(file).toContain(
      'Host packet files must be blocked at PreToolUse if the model attempts to write them directly'
    );
    expect(file).toContain(
      '`PromptRoutingHints` are consumed only after `stage context -> gate failure -> artifact state`'
    );
    expect(file).toContain('Blocker ownership affected: no');
    expect(file).toContain('Remediation artifact generated: {remediationArtifactFile}');
    expect(template).toContain('## Deferred Gaps Tracking');
    expect(template).toContain('| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |');
    expect(template).toContain('## 可解析评分块（供 parseAndWriteScore）');
    expect(template).toContain('P0 Journey Coverage');
    expect(template).toContain('Smoke E2E Readiness');
    expect(template).toContain('Evidence Proof Chain');
    expect(template).toContain('Cross-Document Traceability');
  });
});
