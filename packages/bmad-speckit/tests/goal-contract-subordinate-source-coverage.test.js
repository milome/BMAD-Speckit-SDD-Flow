const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileSubordinateSourceCoverage,
} = require('../src/utils/goal-contract/control-plane/composite-source-authority-bundle.ts');
const {
  readFixtureMetadata,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

function binding(overrides = {}) {
  return subordinateBinding(overrides);
}

function obligations() {
  const fixture = readFixtureMetadata();
  return [...fixture.requirementIds, ...fixture.taskIds].map((id) => ({
    id,
    semanticOwnershipKey: `ownership:${fixture.namespace}:${id}`,
    sourceArtifactId: fixture.sourceArtifactId,
    sourceRole: 'subordinate_component_specification',
    namespace: fixture.namespace,
    taskRefs: fixture.parentTaskRefs,
    specSpanRefs: [`span-${id.toLowerCase()}`],
    ownership: 'owned_obligation',
  }));
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract subordinate source coverage', () => {
  it('emits a hashed coverage receipt for requirements, tasks, and spans', () => {
    const fixture = readFixtureMetadata();
    const receipt = compileSubordinateSourceCoverage({
      binding: binding(),
      obligations: obligations(),
    });
    assert.deepEqual(receipt.requiredRequirementIds, fixture.requirementIds);
    assert.deepEqual(receipt.coveredRequirementIds, fixture.requirementIds);
    assert.deepEqual(receipt.coveredTaskIds, fixture.taskIds);
    assert.equal(receipt.unmappedRequirementCount, 0);
    assert.equal(receipt.unmappedTaskCount, 0);
    assert.equal(receipt.scopeEscapeCount, 0);
    assert.match(receipt.receiptHash, /^sha256:[0-9a-f]{64}$/u);
  });

  it('fails closed for missing IDs, missing spans, and parent-task scope escape', () => {
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding({ requiredRequirementIds: ['MISSING-REQ'] }),
          obligations: obligations(),
        }),
      'subordinate_requirement_missing'
    );
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding({ requiredTaskIds: ['MISSING-TASK'] }),
          obligations: obligations(),
        }),
      'subordinate_task_missing'
    );
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding(),
          obligations: obligations().map((item, index) =>
            index === 0 ? { ...item, specSpanRefs: [] } : item
          ),
        }),
      'subordinate_spec_span_missing'
    );
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding(),
          obligations: obligations().map((item, index) =>
            index === 0 ? { ...item, taskRefs: ['OTHER-TASK'] } : item
          ),
        }),
      'subordinate_scope_escape'
    );
  });

  it('rejects duplicated subordinate ownership and foreign source records', () => {
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding(),
          obligations: [
            ...obligations(),
            {
              ...obligations()[0],
              id: `${obligations()[0].id}-alternate-record`,
            },
          ],
        }),
      'source_semantic_duplication'
    );
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding(),
          obligations: obligations().map((item, index) => {
            if (index !== 0) {
              return item;
            }
            const {
              semanticOwnershipKey: _semanticOwnershipKey,
              ...withoutOwnershipKey
            } = item;
            return withoutOwnershipKey;
          }),
        }),
      'source_semantic_identity_missing'
    );
    expectFailure(
      () =>
        compileSubordinateSourceCoverage({
          binding: binding(),
          obligations: [
            ...obligations(),
            {
              ...obligations()[0],
              id: 'FOREIGN-ID',
              sourceArtifactId: 'other-source',
            },
          ],
        }),
      'subordinate_scope_escape'
    );
  });
});
