import { describe, expect, it } from 'vitest';
import {
  evaluateLintProfileMutationCases,
  type LintProfileMutationEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY,
  validateRequirementsContractLintProfileRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-lint-profile-registry';

function mutationCases(): LintProfileMutationEvaluationCase[] {
  const canonical = structuredClone(REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY) as any;
  const removedRule = structuredClone(canonical);
  delete removedRule.draft.requireValidAuthority;
  const weakenedReady = structuredClone(canonical);
  weakenedReady['confirmation-ready'].allowBlockingUnresolved = true;
  const reinterpretedRule = structuredClone(canonical);
  reinterpretedRule.draft.requireCompleteRenderCoverage = 'when-applicable';
  const duplicatedCoreProfile = structuredClone(canonical);
  duplicatedCoreProfile['confirmation-ready-copy'] = structuredClone(
    canonical['confirmation-ready']
  );
  return [
    { mutationKind: 'remove_core_rule', candidate: removedRule },
    { mutationKind: 'override_core_rule', candidate: weakenedReady },
    { mutationKind: 'reinterpret_core_rule', candidate: reinterpretedRule },
    { mutationKind: 'duplicate_core_profile', candidate: duplicatedCoreProfile },
  ].map((item) => ({
    caseRef: item.mutationKind,
    mutationKind: item.mutationKind,
    mutationDetected:
      validateRequirementsContractLintProfileRegistry(item.candidate).decision === 'block',
  }));
}

describe('requirements contract lint-profile mutation evaluation', () => {
  it('accepts the canonical registry and detects every core-rule mutation', () => {
    expect(
      validateRequirementsContractLintProfileRegistry(
        REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY
      ).decision
    ).toBe('pass');
    const cases = mutationCases();

    const result = evaluateLintProfileMutationCases(cases);

    expect(result.mutationDetectionRate).toBe(1);
    expect(result.undetectedMutationCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks when a core-rule mutation is not detected', () => {
    const cases = mutationCases();
    const mutated = cases.map((item, index) =>
      index === 0 ? { ...item, mutationDetected: false } : item
    );

    const result = evaluateLintProfileMutationCases(mutated);

    expect(result.mutationDetectionRate).toBeLessThan(1);
    expect(result.undetectedMutationCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
