import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime-policy structure mirror', () => {
  it('exposes identity/control/language substructures while preserving top-level compatibility fields', () => {
    const config = loadConfig();
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'implement', config });

    expect(policy.identity).toBeDefined();
    expect(policy.control).toBeDefined();
    expect(policy.language).toBeDefined();

    expect(policy.control.triggerStage).toBe(policy.triggerStage);
    expect(policy.control.scoringEnabled).toBe(policy.scoringEnabled);
    expect(policy.control.mandatoryGate).toBe(policy.mandatoryGate);
    expect(policy.control.granularityGoverned).toBe(policy.granularityGoverned);
  });

  it('keeps legacy-aligned top-level fields readable after substructure introduction', () => {
    const config = loadConfig();
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'specify', config });

    expect(policy.auditRequired).toBe(policy.control.auditRequired);
    expect(policy.validationLevel).toBe(policy.control.validationLevel);
    expect(policy.strictness).toBe(policy.control.strictness);
    expect(policy.generateDoc).toBe(policy.control.generateDoc);
    expect(policy.convergence).toEqual(policy.control.convergence);
    expect(policy.reason).toBe(policy.control.reason);
  });

  it('keeps bmad-help top-level routing fields mirrored from helpRouting', async () => {
    const { resolveBmadHelpRuntimePolicy } = await import('../../scripts/bmad-config');
    const policy = resolveBmadHelpRuntimePolicy({
      flow: 'story',
      stage: 'specify',
      config: loadConfig(),
    });

    expect(policy.contextMaturity).toBe(policy.helpRouting.contextMaturity);
    expect(policy.complexity).toBe(policy.helpRouting.complexity);
    expect(policy.implementationReadinessStatus).toBe(
      policy.helpRouting.implementationReadinessStatus
    );
    expect(policy.implementationEntryRecommended).toBe(
      policy.helpRouting.implementationEntryRecommended
    );
    expect(policy.implementationEntryDecision).toBe(
      policy.helpRouting.implementationEntryDecision
    );
    expect(policy.implementationEntryGate.decision).toBe(policy.implementationEntryDecision);
  });
});
