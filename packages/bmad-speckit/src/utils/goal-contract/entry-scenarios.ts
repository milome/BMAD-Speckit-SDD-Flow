const FOUR_ARTIFACTS = Object.freeze([
  'model_packet.json',
  'human_prompt.txt',
  'audit_receipt.json',
  'goal_execution.md',
]);

const FOUR_ARTIFACT_ROLES = Object.freeze({
  'model_packet.json': 'machine_authority',
  'human_prompt.txt': 'projection',
  'audit_receipt.json': 'receipt',
  'goal_execution.md': 'projection',
});

const ENTRY_SCENARIOS = Object.freeze({
  req_trace_direct: Object.freeze({
    entryId: 'ENTRY-01',
    entryScenario: 'req_trace_direct',
    sourceAuthority: 'confirmed_implementation_confirmation_and_requirement_record',
    requiredOutputs: FOUR_ARTIFACTS,
    finalArtifactAuthority: 'model_packet.json',
    compilerRoute: 'shared_requirement_trace_compiler',
    dualViewPolicy: 'forbidden',
    artifactRoles: FOUR_ARTIFACT_ROLES,
  }),
  main_agent_compile: Object.freeze({
    entryId: 'ENTRY-02',
    entryScenario: 'main_agent_compile',
    sourceAuthority:
      'confirmed_implementation_confirmation_and_execution_discipline_profile',
    requiredOutputs: FOUR_ARTIFACTS,
    finalArtifactAuthority: 'model_packet.json',
    compilerRoute: 'shared_requirement_trace_compiler',
    dualViewPolicy: 'forbidden',
    artifactRoles: FOUR_ARTIFACT_ROLES,
  }),
  standalone_goal_contract: Object.freeze({
    entryId: 'ENTRY-03',
    entryScenario: 'standalone_goal_contract',
    sourceAuthority: 'source_plan_or_bounded_conversation_snapshot',
    requiredOutputs: Object.freeze(['*-goal-execution-plan.md']),
    finalArtifactAuthority: 'standalone_goal_execution_plan_markdown',
    compilerRoute: 'standalone_dual_view_goal_contract_generator',
    dualViewPolicy: 'required',
    artifactRoles: Object.freeze({
      '*-goal-execution-plan.md': 'frozen_execution_authority',
    }),
  }),
});

const SUPPORTED_REQUIRED_SEMANTICS = new Set([
  'four_artifact_authority',
  'dual_view_forbidden',
  'standalone_trace_slice_tracking',
  'standalone_expected_evidence_registry',
  'deterministic_validation',
  'hash_bound_three_perspective_audit',
]);

function unique(values) {
  return [...new Set(values || [])];
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validationBlock(failureClass, extra = {}) {
  return { decision: 'block', failureClass, ...extra };
}

function validateEntryProfile(profile, entryScenario) {
  const scenario = ENTRY_SCENARIOS[entryScenario];
  if (!scenario) {
    return validationBlock('entry_profile_unknown_entry', { entryScenario });
  }
  if (profile?.profileVersion !== '2.1.0') {
    return validationBlock('entry_profile_version_unsupported', {
      profileVersion: profile?.profileVersion ?? null,
    });
  }
  const overlay = profile.entryProfiles?.[entryScenario];
  if (!overlay) {
    return validationBlock('entry_profile_missing', { entryScenario });
  }
  for (const field of [
    'sourceAuthority',
    'requiredOutputs',
    'finalArtifactAuthority',
    'compilerRoute',
    'dualViewPolicy',
    'artifactRoles',
  ]) {
    if (!sameValue(overlay[field], scenario[field])) {
      return validationBlock('entry_profile_authority_mismatch', {
        entryScenario,
        field,
      });
    }
  }
  const unsupportedSemantics = unique(overlay.requiredSemantics).filter(
    (semantic) => !SUPPORTED_REQUIRED_SEMANTICS.has(semantic)
  );
  if (unsupportedSemantics.length > 0) {
    return validationBlock('entry_profile_unsupported_semantics', {
      entryScenario,
      unsupportedSemantics,
    });
  }
  return {
    decision: 'pass',
    entryScenario,
    profileVersion: profile.profileVersion,
  };
}

function resolveEntryProfileOverlay(profile, entryScenario) {
  const validation = validateEntryProfile(profile, entryScenario);
  if (validation.decision !== 'pass') {
    const error = new Error(validation.failureClass);
    Object.assign(error, validation);
    throw error;
  }
  const overlay = profile.entryProfiles[entryScenario];
  return {
    ...ENTRY_SCENARIOS[entryScenario],
    requiredSections: unique([
      ...profile.requiredSections,
      ...(overlay.requiredSections || []),
    ]),
    requiredFrontMatterFields: unique([
      ...profile.requiredFrontMatterFields,
      ...(overlay.requiredFrontMatterFields || []),
    ]),
    requiredSlots: unique([
      ...profile.requiredSlots,
      ...(overlay.requiredSlots || []),
    ]),
    invariantFragments: unique([
      ...profile.invariantFragments,
      ...(overlay.invariantFragments || []),
    ]),
    requiredSemantics: unique(overlay.requiredSemantics),
  };
}

module.exports = {
  ENTRY_SCENARIOS,
  resolveEntryProfileOverlay,
  validateEntryProfile,
};
