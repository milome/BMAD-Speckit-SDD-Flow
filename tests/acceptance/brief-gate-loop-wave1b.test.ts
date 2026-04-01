import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function load(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('wave 1B brief gate loop wiring', () => {
  it('preview skill and prompts require context gate, gap-driven questioning, and remediation routing', () => {
    const skill = load('_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/SKILL.md');
    const contextualDiscovery = load(
      '_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/prompts/contextual-discovery.md'
    );
    const guidedElicitation = load(
      '_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/prompts/guided-elicitation.md'
    );
    const draftAndReview = load(
      '_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/prompts/draft-and-review.md'
    );
    const finalize = load('_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/prompts/finalize.md');

    expect(skill).toContain('Known Unknowns');
    expect(skill).toContain('Contradiction Log');
    expect(contextualDiscovery).toContain('Context Digest');
    expect(contextualDiscovery).toContain('Research Digest');
    expect(contextualDiscovery).toContain('GateFailure');
    expect(contextualDiscovery).toContain('contract-translator');
    expect(guidedElicitation).toContain('evidence gaps');
    expect(guidedElicitation).toContain('missing contract fields');
    expect(draftAndReview).toContain('RemediationPlan');
    expect(draftAndReview).toContain('draft review pass');
    expect(finalize).toContain('distillate becomes mandatory handoff');
  });

  it('brief workflow steps add local gate checks before continue in canonical and mirror workflows', () => {
    const canonicalPaths = [
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-02-vision.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-03-users.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-04-metrics.md',
      '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-05-scope.md',
    ];
    const mirrorPaths = canonicalPaths.map((file) =>
      file.replace('/create-product-brief/', '/bmad-create-product-brief/')
    );

    const step01 = load(canonicalPaths[0]);
    expect(step01).toContain('Context Digest');
    expect(step01).toContain('Research Digest');
    expect(step01).toContain('Known Unknowns');
    expect(step01).toContain('Contradiction Log');

    for (const file of canonicalPaths.slice(1)) {
      const content = load(file);
      expect(content).toContain('GateFailure');
      expect(content).toContain('RemediationPlan');
      expect(content).toContain('success evidence');
      expect(content).toContain('current workaround');
      expect(content).toContain('failure cost');
      expect(content).toContain('role / permission boundary');
      expect(content).toContain('external dependency semantics');
      expect(content).toContain('do not show plain Continue');
    }

    for (const file of mirrorPaths) {
      const content = load(file);
      expect(content).toContain('GateFailure');
      expect(content).toContain('RemediationPlan');
    }
  });

  it('pm and party-mode define stage-aware gate ownership and exit criteria', () => {
    const pm = load('_bmad/bmm/agents/pm.md');
    const partyModeWorkflow = load('_bmad/core/workflows/party-mode/workflow.md');
    const partyModeStep02 = load('_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md');

    expect(pm).toContain('If a blocker gate fails');
    expect(pm).toContain('PM may not continue downstream');
    expect(pm).toContain('Remediation Attempt Log');

    expect(partyModeWorkflow).toContain('brief-gate');
    expect(partyModeWorkflow).toContain('prd-contract-gate');
    expect(partyModeWorkflow).toContain('architecture-contract-gate');
    expect(partyModeWorkflow).toContain('readiness-blocker-gate');
    expect(partyModeStep02).toContain('mandatory outputs');
    expect(partyModeStep02).toContain('stage-specific exit criteria');
    expect(partyModeStep02).toContain('resolved blockers');
    expect(partyModeStep02).toContain('unresolved blockers');
    expect(partyModeStep02).toContain('deferred risks');
  });
});
