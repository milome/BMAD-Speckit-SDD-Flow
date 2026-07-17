import { describe, expect, it } from 'vitest';
import {
  classifyAmend05SafeWritePath,
  resolveAmend05ReceiptCompleteTargetSet,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-amend05-safe-write-target-registry';

const context = {
  requirementSetId: 'REQ-001',
  implementationAttemptId: 'IMP-001',
  bundleRevision: 'BUNDLE-REV-001',
  activationAttemptId: 'ACT-ATTEMPT-001',
  sourcePrdPath: 'docs/requirements/REQ-001.md',
  goalExecutionApplicable: true,
  activationOutcome: 'success' as const,
};

describe('requirements contract AMEND-05 safe-write target registry', () => {
  it('resolves a deterministic exact set with conditional goal and activation members', () => {
    const first = resolveAmend05ReceiptCompleteTargetSet(context);
    const second = resolveAmend05ReceiptCompleteTargetSet(context);

    expect(second).toEqual(first);
    expect(first.targetSetHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.targets).toContain(
      '_bmad-output/runtime/requirement-records/REQ-001/trace-execution/IMP-001/goal_execution.md'
    );
    expect(first.targets).toContain(
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json'
    );
    expect(first.targets).toContain(
      'docs/plans/evidence/loop-engineering-remediation/recovery-lineage-finalization-receipt.json'
    );
    expect(
      first.targets.some((target) => target.includes('normalized-contract-activation-attempts/'))
    ).toBe(false);
  });

  it('uses the blocked activation path exclusively and omits inapplicable goal output', () => {
    const result = resolveAmend05ReceiptCompleteTargetSet({
      ...context,
      goalExecutionApplicable: false,
      activationOutcome: 'blocked',
    });

    expect(result.targets).not.toContain(
      '_bmad-output/runtime/requirement-records/REQ-001/trace-execution/IMP-001/goal_execution.md'
    );
    expect(result.targets).toContain(
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts/ACT-ATTEMPT-001.json'
    );
    expect(result.targets).not.toContain(
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json'
    );
  });

  it('classifies finalization control evidence without admitting it to the exact set', () => {
    expect(
      classifyAmend05SafeWritePath(
        'docs/plans/evidence/loop-engineering-remediation/recovery-finalization-transactions/TX-1/IMP-1/RUN-1/intent.json'
      )
    ).toBe('excluded_control_evidence');
    expect(
      classifyAmend05SafeWritePath(
        'docs/plans/evidence/loop-engineering-remediation/recovery-finalization-attempts/TX-1/IMP-1/RUN-1/1-CMD-1/failure-archive.json'
      )
    ).toBe('excluded_control_evidence');
    expect(
      classifyAmend05SafeWritePath(
        'docs/plans/evidence/loop-engineering-remediation/implementation-evidence.json'
      )
    ).toBe('excluded_control_evidence');
    expect(classifyAmend05SafeWritePath('docs/plans/evidence/unknown.json')).toBe(
      'unregistered'
    );
  });
});
