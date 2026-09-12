import { describe, expect, it } from 'vitest';
import {
  createExecutionConstraintRegistry,
  validateExecutionConstraintRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';

function typedSharedConstraint(refCount: number, overrides: Record<string, unknown> = {}) {
  const refs = Array.from(
    { length: refCount },
    (_, index) => `MUST-SHARED-${String(index + 1).padStart(3, '0')}`
  );
  return {
    constraintId: `CMD-SHARED-${String(refCount).padStart(3, '0')}`,
    kind: 'CMD' as const,
    canonicalValue: `verify-shared-${refCount}`,
    applicableMustRefs: [...refs],
    applicableAtomRefs: refs.map((ref) => `${ref}-A1`),
    applicableSourceRefs: [...refs],
    premiseRefs: ['SOURCE-CMD-SHARED'],
    derivationReceiptRefs: [],
    sourceDeclarationRefs: ['SOURCE-CMD-SHARED'],
    disposition: 'proven' as const,
    authorityKind: 'source_declared' as const,
    conditions: [],
    scope: { kind: 'shared', owner: 'SOURCE-CMD-SHARED' },
    modality: 'required' as const,
    coverageRole: 'action_trace' as const,
    declarationRole: 'verification_command',
    ...overrides,
  };
}

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

  it('accepts a large explicitly global sparse authority without an arbitrary edge budget', () => {
    const refs = Array.from(
      { length: 129 },
      (_, index) => `MUST-GLOBAL-${String(index + 1).padStart(3, '0')}`
    );
    const registry = createExecutionConstraintRegistry(
      Array.from({ length: 1000 }, (_, index) => ({
        constraintId: `CMD-GLOBAL-${String(index + 1).padStart(4, '0')}`,
        kind: 'CMD' as const,
        canonicalValue: `verify-global-${index + 1}`,
        applicableMustRefs: refs,
        applicableAtomRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
        disposition: 'unresolved' as const,
        scope: {
          kind: 'global',
          authorityRef: 'GLOBAL-AUTHORITY-001',
        },
      }))
    );

    expect(validateExecutionConstraintRegistry(registry)).toEqual({
      decision: 'pass',
      issueCodes: [],
    });
    expect(registry.executionConstraints).toHaveLength(1000);
    expect(
      registry.executionConstraints.reduce(
        (total, constraint) => total + constraint.applicableMustRefs.length,
        0
      )
    ).toBe(129000);
  });

  it('rejects an observed value presented as proven authority', () => {
    const result = validateExecutionConstraintRegistry({
      executionConstraints: [{ constraintId: 'CMD-001', kind: 'CMD', canonicalValue: 'npm test', applicableMustRefs: [], applicableAtomRefs: [], premiseRefs: [], derivationReceiptRefs: [], disposition: 'proven', observedEvidenceRefs: ['run-1'] }],
      executionConstraintRegistryHash: 'sha256:invalid',
    });
    expect(result.issueCodes).toContain('execution_constraint_observed_evidence_forbidden');
    expect(result.issueCodes).toContain('execution_constraint_proven_premise_missing');
  });

  it.each([127, 128, 129])(
    'accepts the same per-edge authorized shared relation at %i refs',
    (refCount) => {
      const registry = createExecutionConstraintRegistry([typedSharedConstraint(refCount)]);
      expect(validateExecutionConstraintRegistry(registry)).toEqual({
        decision: 'pass',
        issueCodes: [],
      });
    }
  );

  it.each([3, 129])(
    'rejects missing typed source-declaration authority at %i refs',
    (refCount) => {
      const registry = createExecutionConstraintRegistry([
        typedSharedConstraint(refCount, { sourceDeclarationRefs: [] }),
      ]);
      expect(validateExecutionConstraintRegistry(registry).issueCodes)
        .toContain('execution_constraint_source_declaration_missing');
    }
  );

  it('rejects dangling applicability and pseudo-global authority', () => {
    const dangling = typedSharedConstraint(3);
    dangling.applicableMustRefs.push('MUST-DANGLING-999');
    dangling.applicableAtomRefs.push('MUST-DANGLING-999-A1');
    expect(validateExecutionConstraintRegistry(
      createExecutionConstraintRegistry([dangling])
    ).issueCodes).toContain('execution_constraint_applicability_ref_invalid');

    const pseudoGlobal = createExecutionConstraintRegistry([{
      constraintId: 'CMD-PSEUDO-GLOBAL', kind: 'CMD' as const,
      canonicalValue: 'verify-pseudo-global', applicableMustRefs: ['MUST-001'],
      applicableAtomRefs: [], premiseRefs: [], derivationReceiptRefs: [],
      disposition: 'unresolved' as const, scope: { kind: 'global' },
    }]);
    expect(validateExecutionConstraintRegistry(pseudoGlobal).issueCodes)
      .toContain('execution_constraint_global_authority_missing');
  });
});
