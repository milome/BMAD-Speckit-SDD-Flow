const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  createExecutionConstraintRegistry,
  validateExecutionConstraintRegistry,
} = require('../src/main-agent/source-authority/scripts/requirements-contract-semantic-ir.ts');

function typedSharedConstraint(refCount, overrides = {}) {
  const refs = Array.from(
    { length: refCount },
    (_, index) => `MUST-SHARED-${String(index + 1).padStart(3, '0')}`
  );
  return {
    constraintId: `CMD-SHARED-${String(refCount).padStart(3, '0')}`,
    kind: 'CMD',
    canonicalValue: `verify-shared-${refCount}`,
    applicableMustRefs: refs,
    applicableAtomRefs: refs.map((ref) => `${ref}-A1`),
    applicableSourceRefs: refs,
    premiseRefs: ['SOURCE-CMD-SHARED'],
    derivationReceiptRefs: [],
    sourceDeclarationRefs: ['SOURCE-CMD-SHARED'],
    disposition: 'proven',
    authorityKind: 'source_declared',
    conditions: [],
    scope: { kind: 'shared', owner: 'SOURCE-CMD-SHARED' },
    modality: 'required',
    coverageRole: 'action_trace',
    declarationRole: 'verification_command',
    ...overrides,
  };
}

describe('Requirements execution constraint authority', () => {
  it('accepts explicitly global sparse authority without an arbitrary edge budget', () => {
    const refs = Array.from(
      { length: 129 },
      (_, index) => `MUST-GLOBAL-${String(index + 1).padStart(3, '0')}`
    );
    const registry = createExecutionConstraintRegistry(
      Array.from({ length: 1000 }, (_, index) => ({
        constraintId: `CMD-GLOBAL-${String(index + 1).padStart(4, '0')}`,
        kind: 'CMD',
        canonicalValue: `verify-global-${index + 1}`,
        applicableMustRefs: refs,
        applicableAtomRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
        disposition: 'unresolved',
        scope: {
          kind: 'global',
          authorityRef: 'GLOBAL-AUTHORITY-001',
        },
      }))
    );

    assert.deepEqual(validateExecutionConstraintRegistry(registry), {
      decision: 'pass',
      issueCodes: [],
    });
    assert.equal(registry.executionConstraints.length, 1000);
    assert.equal(
      registry.executionConstraints.reduce(
        (total, constraint) => total + constraint.applicableMustRefs.length,
        0
      ),
      129000
    );
  });

  for (const refCount of [127, 128, 129]) {
    it(`accepts the same per-edge authorized shared relation at ${refCount} refs`, () => {
      const registry = createExecutionConstraintRegistry([
        typedSharedConstraint(refCount),
      ]);
      assert.deepEqual(validateExecutionConstraintRegistry(registry), {
        decision: 'pass',
        issueCodes: [],
      });
    });
  }

  for (const refCount of [3, 129]) {
    it(`rejects missing typed source-declaration authority at ${refCount} refs`, () => {
      const registry = createExecutionConstraintRegistry([
        typedSharedConstraint(refCount, { sourceDeclarationRefs: [] }),
      ]);
      const result = validateExecutionConstraintRegistry(registry);
      assert.equal(result.decision, 'block');
      assert.ok(result.issueCodes.includes('execution_constraint_source_declaration_missing'));
    });
  }

  it('rejects an applicability ref not present in the typed source-owner set', () => {
    const constraint = typedSharedConstraint(3);
    constraint.applicableMustRefs = [...constraint.applicableMustRefs, 'MUST-DANGLING-999'];
    constraint.applicableAtomRefs = [...constraint.applicableAtomRefs, 'MUST-DANGLING-999-A1'];
    const result = validateExecutionConstraintRegistry(
      createExecutionConstraintRegistry([constraint])
    );
    assert.equal(result.decision, 'block');
    assert.ok(result.issueCodes.includes('execution_constraint_applicability_ref_invalid'));
  });

  it('rejects a typed shared constraint without a semantic scope owner', () => {
    const result = validateExecutionConstraintRegistry(
      createExecutionConstraintRegistry([
        typedSharedConstraint(3, { scope: { kind: 'shared' } }),
      ])
    );
    assert.equal(result.decision, 'block');
    assert.ok(result.issueCodes.includes('execution_constraint_scope_owner_missing'));
  });

  it('rejects a pseudo-global constraint without explicit global authority', () => {
    const result = validateExecutionConstraintRegistry(
      createExecutionConstraintRegistry([
        {
          constraintId: 'CMD-PSEUDO-GLOBAL',
          kind: 'CMD',
          canonicalValue: 'verify-pseudo-global',
          applicableMustRefs: ['MUST-001'],
          applicableAtomRefs: [],
          premiseRefs: [],
          derivationReceiptRefs: [],
          disposition: 'unresolved',
          scope: { kind: 'global' },
        },
      ])
    );
    assert.equal(result.decision, 'block');
    assert.ok(result.issueCodes.includes('execution_constraint_global_authority_missing'));
  });
});
