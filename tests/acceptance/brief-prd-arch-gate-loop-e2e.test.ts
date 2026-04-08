import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function load(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('wave 1B brief -> prd -> arch gate/rerun e2e wiring', () => {
  it('keeps cross-stage gate profiles, exit criteria, and PM-owned rerun routes aligned', () => {
    const matrix = load('_bmad/bmm/data/governance-executor-routing-matrix.md');
    const profiles = load('_bmad/bmm/data/party-mode-stage-profiles.md');
    const exitCriteria = load('_bmad/bmm/data/stage-specific-exit-criteria.md');

    expect(matrix).toContain('brief-definition-gap');
    expect(matrix).toContain('party-mode brief-gate round');
    expect(matrix).toContain('prd-contract-gap');
    expect(matrix).toContain('party-mode prd-contract-gate round');
    expect(matrix).toContain('architecture-contract-gap');
    expect(matrix).toContain('party-mode architecture-contract-gate round');

    const orderedProfiles = ['## brief-gate', '## prd-contract-gate', '## architecture-contract-gate'];
    const orderedExits = ['## brief-gate', '## prd-contract-gate', '## architecture-contract-gate'];

    expect(
      orderedProfiles
        .map((marker) => profiles.indexOf(marker))
        .every((index, i, indexes) => index >= 0 && (i === 0 || index > indexes[i - 1]))
    ).toBe(true);

    expect(
      orderedExits
        .map((marker) => exitCriteria.indexOf(marker))
        .every((index, i, indexes) => index >= 0 && (i === 0 || index > indexes[i - 1]))
    ).toBe(true);
  });

  it('prd workflows block continue until prd contract gaps are remediated in canonical and mirror flows', () => {
    const prdStepPaths = [
      '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-04-journeys.md',
      '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-11-polish.md',
      '_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/steps-c/step-04-journeys.md',
      '_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/steps-c/step-11-polish.md',
    ];

    for (const file of prdStepPaths) {
      const content = load(file);
      expect(content).toContain('GateFailure');
      expect(content).toContain('RemediationPlan');
      expect(content).toContain('do not show plain Continue');
      expect(content).toContain('prd-contract-gate');
      expect(content).toContain('party-mode');
      expect(content).toContain('current blocker/gap context');
    }
  });

  it('architecture workflows block continue until architecture contract gaps are remediated in canonical and mirror flows', () => {
    const architectureStepPaths = [
      '_bmad/bmm/workflows/3-solutioning/create-architecture/steps/step-04-decisions.md',
      '_bmad/bmm/workflows/3-solutioning/create-architecture/steps/step-07-validation.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-architecture/steps/step-04-decisions.md',
      '_bmad/bmm/workflows/3-solutioning/bmad-create-architecture/steps/step-07-validation.md',
    ];

    for (const file of architectureStepPaths) {
      const content = load(file);
      expect(content).toContain('GateFailure');
      expect(content).toContain('RemediationPlan');
      expect(content).toContain('do not show plain Continue');
      expect(content).toContain('Continue is blocked until the local gate passes');
      expect(content).toContain('[C] Continue` is forbidden');
      expect(content).toContain('Only valid when the Architecture Contract Gate has passed');
      expect(content).toContain('architecture-contract-gate');
      expect(content).toContain('party-mode');
      expect(content).toContain('current blocker/gap context');
    }
  });
});
