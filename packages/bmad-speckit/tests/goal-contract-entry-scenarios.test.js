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
  resolveEntryProfileOverlay,
  validateEntryProfile,
} = require('../src/utils/goal-contract/entry-scenarios.ts');

const FOUR_ARTIFACTS = [
  'model_packet.json',
  'human_prompt.txt',
  'audit_receipt.json',
  'goal_execution.md',
];

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
});
