#!/usr/bin/env node
/* eslint-disable no-console */

const FIXED_PERSPECTIVES = ['product_intent', 'model_projection', 'main_agent_execution'];
const REQUIRED_STAGE_PROFILES = [
  'requirements_compiler',
  'implementation_readiness',
  'post_implementation_code_audit',
  'delivery_confirmation',
];
const REQUIRED_TOP_LEVEL_SECTIONS = [
  'metadata',
  'registryBindings',
  'stageProfiles',
  'perspectives',
  'dimensionContractBinding',
  'checkItemSetBinding',
  'auditRoundPolicy',
  'roundReceiptContract',
  'convergenceReceiptContract',
  'failClosedPolicy',
  'auditCallPointRegistry',
  'triadOrchestrationPolicy',
  'subagentIndependencePolicy',
  'mainAgentRepairPolicy',
  'repairReceiptFeedbackPolicy',
];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function isSha256(value) {
  return /^sha256:[a-f0-9]{64}$/u.test(text(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function validateCriticalAuditorProfile(input) {
  const profile = object(input.profile);
  const metadata = object(profile.metadata);
  const stageProfiles = object(profile.stageProfiles);
  const blockingReasons = [];

  for (const section of REQUIRED_TOP_LEVEL_SECTIONS) {
    if (!isObject(profile[section]) && section !== 'perspectives') {
      blockingReasons.push(`critical_auditor_profile_section_missing:${section}`);
    }
  }

  if (metadata.schemaVersion !== 'critical-auditor-profile/v1') {
    blockingReasons.push('critical_auditor_profile_schema_invalid');
  }
  if (metadata.profileId !== 'main-agent-six-mental-model-critical-auditor') {
    blockingReasons.push('critical_auditor_profile_id_invalid');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/u.test(text(metadata.profileVersion))) {
    blockingReasons.push('critical_auditor_profile_version_invalid');
  }
  if (!isSha256(metadata.profileHash)) {
    blockingReasons.push('critical_auditor_profile_hash_missing');
  }

  const perspectives = strings(profile.perspectives);
  for (const perspective of FIXED_PERSPECTIVES) {
    if (!perspectives.includes(perspective)) {
      blockingReasons.push(`critical_auditor_perspective_missing:${perspective}`);
    }
  }
  if (new Set(perspectives).size !== perspectives.length) {
    blockingReasons.push('critical_auditor_perspective_duplicate');
  }

  for (const stageProfileId of REQUIRED_STAGE_PROFILES) {
    const stageProfile = object(stageProfiles[stageProfileId]);
    if (Object.keys(stageProfile).length === 0) {
      blockingReasons.push(`critical_auditor_stage_profile_missing:${stageProfileId}`);
      continue;
    }
    if (stageProfile.stageProfileId !== stageProfileId) {
      blockingReasons.push(`critical_auditor_stage_profile_id_mismatch:${stageProfileId}`);
    }
    if (strings(stageProfile.owningStages).length === 0) {
      blockingReasons.push(`critical_auditor_stage_owning_stages_missing:${stageProfileId}`);
    }
    if (!text(stageProfile.dimensionContractId)) {
      blockingReasons.push(`critical_auditor_dimension_contract_missing:${stageProfileId}`);
    }
    if (!text(stageProfile.dimensionMode)) {
      blockingReasons.push(`critical_auditor_dimension_mode_missing:${stageProfileId}`);
    }
    if (strings(stageProfile.expectedDimensions).length === 0) {
      blockingReasons.push(`critical_auditor_expected_dimensions_missing:${stageProfileId}`);
    }
    if (strings(stageProfile.requiredCheckItemIds).length === 0) {
      blockingReasons.push(`critical_auditor_required_check_items_missing:${stageProfileId}`);
    }
    if (!isSha256(stageProfile.stageProfileHash)) {
      blockingReasons.push(`critical_auditor_stage_profile_hash_missing:${stageProfileId}`);
    }
  }

  return {
    ok: blockingReasons.length === 0,
    blockingReasons: unique(blockingReasons),
  };
}

function validateCriticalAuditorProfileForStage(input) {
  const profile = object(input.profile);
  const validation = validateCriticalAuditorProfile({ profile });
  const blockingReasons = [...validation.blockingReasons];
  const stageProfiles = object(profile.stageProfiles);
  const stageProfileId = text(input.stageProfileId);
  const stageProfile = object(stageProfiles[stageProfileId]);

  if (!stageProfileId || Object.keys(stageProfile).length === 0) {
    blockingReasons.push('critical_auditor_stage_profile_missing');
  }
  const profileHash = text(profile.profileHash) || text(object(profile.metadata).profileHash);
  if (input.expectedProfileHash && profileHash !== text(input.expectedProfileHash)) {
    blockingReasons.push('critical_auditor_profile_hash_stale');
  }
  if (
    input.expectedStageProfileHash &&
    text(stageProfile.stageProfileHash) !== text(input.expectedStageProfileHash)
  ) {
    blockingReasons.push('critical_auditor_stage_profile_hash_stale');
  }
  if (strings(stageProfile.requiredCheckItemIds).length === 0) {
    blockingReasons.push('critical_auditor_required_check_items_missing');
  }

  return {
    ok: blockingReasons.length === 0,
    blockingReasons: unique(blockingReasons),
    stageProfile: Object.keys(stageProfile).length > 0 ? stageProfile : undefined,
  };
}

function main() {
  const { loadCriticalAuditorProfile } = require('./load-critical-auditor-profile');
  const profile = loadCriticalAuditorProfile(process.cwd());
  const result = validateCriticalAuditorProfile({ profile });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 3;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 3;
  }
}

module.exports = {
  FIXED_PERSPECTIVES,
  REQUIRED_STAGE_PROFILES,
  validateCriticalAuditorProfile,
  validateCriticalAuditorProfileForStage,
};
