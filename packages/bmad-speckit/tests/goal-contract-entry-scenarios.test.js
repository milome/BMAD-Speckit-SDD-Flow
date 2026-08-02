const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const PROFILE = require(path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-profile.json'
));
const {
  ENTRY_SCENARIOS,
  resolveEntryScenario,
  resolveEntryProfileOverlay,
  validateEntryAuthority,
  validateEntryProfile,
} = require('../src/utils/goal-contract/entry-scenarios.ts');

const FOUR_ARTIFACTS = [
  'model_packet.json',
  'human_prompt.txt',
  'audit_receipt.json',
  'goal_execution.md',
];

function capturedFailureClass(run) {
  try {
    run();
    return null;
  } catch (error) {
    return error.failureClass;
  }
}

describe('goal-contract entry scenarios', () => {
  it('freezes the three exact entry authority contracts', () => {
    assert.deepEqual(Object.keys(ENTRY_SCENARIOS).sort(), [
      'main_agent_compile',
      'req_trace_direct',
      'standalone_goal_contract',
    ]);

    for (const entryId of ['req_trace_direct', 'main_agent_compile']) {
      const entry = ENTRY_SCENARIOS[entryId];
      assert.deepEqual(entry.requiredOutputs, FOUR_ARTIFACTS);
      assert.equal(entry.finalArtifactAuthority, 'model_packet.json');
      assert.equal(entry.compilerRoute, 'shared_requirement_trace_compiler');
      assert.equal(entry.dualViewPolicy, 'forbidden');
      assert.equal(entry.artifactRoles['human_prompt.txt'], 'projection');
      assert.equal(entry.artifactRoles['audit_receipt.json'], 'receipt');
      assert.equal(entry.artifactRoles['goal_execution.md'], 'projection');
    }

    const standalone = ENTRY_SCENARIOS.standalone_goal_contract;
    assert.deepEqual(standalone.requiredOutputs, ['*-goal-execution-plan.md']);
    assert.equal(
      standalone.finalArtifactAuthority,
      'standalone_goal_execution_plan_markdown'
    );
    assert.equal(standalone.dualViewPolicy, 'required');
    assert.equal(
      standalone.compilerRoute,
      'standalone_dual_view_goal_contract_generator'
    );
  });

  it('resolves the backward-compatible 2.1 standalone overlay', () => {
    const validation = validateEntryProfile(PROFILE, 'standalone_goal_contract');
    const resolved = resolveEntryProfileOverlay(
      PROFILE,
      'standalone_goal_contract'
    );

    assert.equal(validation.decision, 'pass');
    assert.equal(PROFILE.profileVersion, '2.1.0');
    assert.equal(resolved.entryScenario, 'standalone_goal_contract');
    assert.equal(
      resolved.finalArtifactAuthority,
      'standalone_goal_execution_plan_markdown'
    );
    assert.ok(
      resolved.requiredSections.includes('Trace Slice Tracking Matrix')
    );
    assert.ok(resolved.requiredSections.includes('Expected Evidence Freeze'));
    assert.ok(
      resolved.invariantFragments.includes(
        'standalone Markdown contract is the frozen execution authority'
      )
    );
    assert.deepEqual(
      resolveEntryProfileOverlay(PROFILE, 'req_trace_direct').requiredSections,
      PROFILE.requiredSections
    );
  });

  it('fails closed on unsupported required entry semantics', () => {
    const unsupported = structuredClone(PROFILE);
    unsupported.entryProfiles.standalone_goal_contract.requiredSemantics.push(
      'future_semantic_contract'
    );

    const validation = validateEntryProfile(
      unsupported,
      'standalone_goal_contract'
    );

    assert.equal(validation.decision, 'block');
    assert.equal(
      validation.failureClass,
      'entry_profile_unsupported_semantics'
    );
    assert.deepEqual(validation.unsupportedSemantics, [
      'future_semantic_contract',
    ]);
  });

  it('requires one exact normalized entry token', () => {
    assert.equal(capturedFailureClass(() => resolveEntryScenario([])), 'entry_missing');
    assert.equal(
      capturedFailureClass(() => resolveEntryScenario(['standalone_goal_contract', 'standalone_goal_contract'])),
      'entry_duplicated'
    );
    assert.equal(
      capturedFailureClass(() => resolveEntryScenario(['goal-execution-plan.md'])),
      'entry_unknown'
    );
    assert.equal(
      resolveEntryScenario(['standalone_goal_contract']).entryScenario,
      'standalone_goal_contract'
    );
  });

  it('fails closed on authority, output, and dual-view mismatches', () => {
    assert.equal(
      validateEntryAuthority({
        entryScenario: 'standalone_goal_contract',
        sourceAuthority: null,
        requestedOutputs: ['example-goal-execution-plan.md'],
      }).failureClass,
      'entry_source_authority_missing'
    );
    assert.equal(
      validateEntryAuthority({
        entryScenario: 'standalone_goal_contract',
        sourceAuthority: 'confirmed_implementation_confirmation_and_requirement_record',
        requestedOutputs: ['example-goal-execution-plan.md'],
      }).failureClass,
      'entry_authority_mismatch'
    );
    assert.equal(
      validateEntryAuthority({
        entryScenario: 'standalone_goal_contract',
        sourceAuthority: 'source_plan_or_bounded_conversation_snapshot',
        requestedOutputs: ['model_packet.json'],
      }).failureClass,
      'entry_output_set_mismatch'
    );
    assert.equal(
      validateEntryAuthority({
        entryScenario: 'req_trace_direct',
        sourceAuthority: 'confirmed_implementation_confirmation_and_requirement_record',
        requestedOutputs: FOUR_ARTIFACTS,
        dualViewRequested: true,
      }).failureClass,
      'entry_dual_view_forbidden'
    );
  });
});
