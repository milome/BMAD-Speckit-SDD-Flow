const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileSourceCompositionPolicy,
  verifySourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  authorityRecord: buildAuthorityRecord,
  extractRequiredSubordinateBinding,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

function authorityRecord(mode, requiredSubordinateBindings = []) {
  return buildAuthorityRecord(
    mode,
    requiredSubordinateBindings,
    hashControlPlaneValue
  );
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract source composition policy', () => {
  it('extracts subordinate bindings without assuming authority ID prefixes', () => {
    const sourceArtifactId = 'component-specification';
    const binding = extractRequiredSubordinateBinding(
      [
        'sourceCompositionPolicy:',
        '  mode: composite_required',
        '  requiredSubordinateBindings:',
        '    - role: subordinate_component_specification',
        '      namespace: COMPONENT',
        `      sourceArtifactId: ${sourceArtifactId}`,
        '      parentTaskRefs:',
        '        - PARENT-TASK',
        '      requiredRequirementIds:',
        '        - REQUIREMENT-ALPHA',
        '        - REQUIREMENT-BETA',
        '      requiredTaskIds:',
        '        - TASK-ONE',
        '        - TASK-TWO',
      ].join('\n'),
      sourceArtifactId
    );

    assert.deepEqual(binding, {
      role: 'subordinate_component_specification',
      namespace: 'COMPONENT',
      sourceArtifactId,
      parentTaskRefs: ['PARENT-TASK'],
      requiredRequirementIds: ['REQUIREMENT-ALPHA', 'REQUIREMENT-BETA'],
      requiredTaskIds: ['TASK-ONE', 'TASK-TWO'],
    });
  });

  it('compiles closed single_source and composite_required policies deterministically', () => {
    const single = compileSourceCompositionPolicy({
      authorityRecord: authorityRecord('single_source'),
    });
    const composite = compileSourceCompositionPolicy({
      authorityRecord: authorityRecord('composite_required', [
        subordinateBinding(),
      ]),
    });
    const compositeReordered = compileSourceCompositionPolicy({
      authorityRecord: authorityRecord('composite_required', [
        subordinateBinding({
          requiredRequirementIds: [
            ...subordinateBinding().requiredRequirementIds,
          ].reverse(),
          requiredTaskIds: [...subordinateBinding().requiredTaskIds].reverse(),
        }),
      ]),
    });

    assert.equal(single.mode, 'single_source');
    assert.deepEqual(single.requiredSubordinateBindings, []);
    assert.equal(composite.mode, 'composite_required');
    assert.equal(composite.requiredSubordinateBindings.length, 1);
    assert.equal(
      composite.sourceCompositionPolicyHash,
      compositeReordered.sourceCompositionPolicyHash
    );
    assert.deepEqual(verifySourceCompositionPolicy(composite), composite);
  });

  it('rejects caller-authored authority fields and unsupported policy modes', () => {
    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          mode: 'single_source',
          declaredMode: 'single_source',
        }),
      'source_composition_policy_authority_rejected'
    );
    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          authorityRecord: authorityRecord('auto'),
        }),
      'source_composition_policy_invalid'
    );
    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          authorityRecord: authorityRecord('composite_required'),
        }),
      'source_composition_policy_invalid'
    );
  });

  it('rejects duplicate bindings, forged authority evidence, and policy replay mutation', () => {
    const duplicate = subordinateBinding();
    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          authorityRecord: authorityRecord('composite_required', [
            duplicate,
            duplicate,
          ]),
        }),
      'source_composition_policy_invalid'
    );

    const forged = authorityRecord('single_source');
    forged.authorityEvidenceHash = 'sha256:' + '0'.repeat(64);
    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          authorityRecord: forged,
        }),
      'source_composition_policy_replay_rejected'
    );

    const policy = compileSourceCompositionPolicy({
      authorityRecord: authorityRecord('composite_required', [
        subordinateBinding(),
      ]),
    });
    const mutated = {
      ...policy,
      mode: 'single_source',
    };
    expectFailure(
      () => verifySourceCompositionPolicy(mutated),
      'source_composition_downgrade_rejected'
    );

    expectFailure(
      () =>
        compileSourceCompositionPolicy({
          authorityRecord: authorityRecord('single_source'),
          mode: 'composite_required',
        }),
      'source_composition_policy_mismatch'
    );

    const replayed = structuredClone(policy);
    replayed.requiredSubordinateBindings[0].requiredTaskIds =
      replayed.requiredSubordinateBindings[0].requiredTaskIds.slice(1);
    expectFailure(
      () => verifySourceCompositionPolicy(replayed),
      'source_composition_policy_replay_rejected'
    );
  });
});
