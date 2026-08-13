import { describe, expect, it } from 'vitest';
import {
  createExecutionConstraintRegistry,
  validateExecutionConstraintRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';

describe('execution constraint authority', () => {
  it('accepts all closed typed constraint kinds with premise-backed disposition', () => {
    const registry = createExecutionConstraintRegistry(
      (['PATH', 'CMD', 'ART', 'CTM', 'EVDREQ', 'STOP'] as const).map((kind, index) => ({
        constraintId: `${kind}-${String(index + 1).padStart(3, '0')}`,
        kind,
        canonicalValue: `${kind.toLowerCase()}:value`,
        applicableMustRefs: ['MUST-001'],
        applicableAtomRefs: [],
        premiseRefs: ['POLICY-001'],
        derivationReceiptRefs: ['DERIVE-001'],
        disposition: 'proven' as const,
      }))
    );
    expect(validateExecutionConstraintRegistry(registry)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(registry.executionConstraintRegistryHash).toMatch(/^sha256:/u);
  });

  it('rejects an observed value presented as proven authority', () => {
    const result = validateExecutionConstraintRegistry({
      executionConstraints: [{ constraintId: 'CMD-001', kind: 'CMD', canonicalValue: 'npm test', applicableMustRefs: [], applicableAtomRefs: [], premiseRefs: [], derivationReceiptRefs: [], disposition: 'proven', observedEvidenceRefs: ['run-1'] }],
      executionConstraintRegistryHash: 'sha256:invalid',
    });
    expect(result.issueCodes).toContain('execution_constraint_observed_evidence_forbidden');
    expect(result.issueCodes).toContain('execution_constraint_proven_premise_missing');
  });
});
