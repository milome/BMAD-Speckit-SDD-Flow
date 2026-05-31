#!/usr/bin/env node
/* eslint-disable no-console */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { validateCriticalAuditorProfile } = require('./validate-critical-auditor-profile');

const SHARED_DIR = __dirname;
const PROFILE_PATH = path.join(SHARED_DIR, 'critical-auditor-profile.json');
const SCHEMA_VERSION = 'critical-auditor-profile/v1';
const PROFILE_ID = 'main-agent-six-mental-model-critical-auditor';

const CONTRACT_BY_STAGE = {
  prd: { dimensionMode: 'prd', dimensionContractId: 'prd_document' },
  spec: { dimensionMode: 'prd', dimensionContractId: 'prd_document' },
  specify: { dimensionMode: 'prd', dimensionContractId: 'prd_document' },
  plan: { dimensionMode: 'prd', dimensionContractId: 'prd_document' },
  gaps: { dimensionMode: 'prd', dimensionContractId: 'prd_document' },
  arch: { dimensionMode: 'arch', dimensionContractId: 'architecture_design' },
  architecture: { dimensionMode: 'arch', dimensionContractId: 'architecture_design' },
  implementation_readiness: {
    dimensionMode: 'readiness',
    dimensionContractId: 'implementation_readiness',
  },
  readiness: { dimensionMode: 'readiness', dimensionContractId: 'implementation_readiness' },
  delivery_confirmation: { dimensionMode: 'delivery', dimensionContractId: 'delivery_confirmation' },
  delivery: { dimensionMode: 'delivery', dimensionContractId: 'delivery_confirmation' },
  story: { dimensionMode: 'story', dimensionContractId: 'story_document' },
  tasks: { dimensionMode: 'tasks', dimensionContractId: 'tasks_decomposition' },
  standalone_tasks: { dimensionMode: 'tasks', dimensionContractId: 'tasks_decomposition' },
  bugfix: { dimensionMode: 'bugfix', dimensionContractId: 'bugfix_implementation' },
  implement: { dimensionMode: 'code', dimensionContractId: 'code_implementation' },
  post_impl: { dimensionMode: 'code', dimensionContractId: 'code_implementation' },
  pr_review: { dimensionMode: 'pr', dimensionContractId: 'pull_request_review' },
};

const EXPECTED_DIMENSIONS_BY_MODE = {
  code: ['Functionality', 'Code Quality', 'Test Coverage', 'Security'],
  prd: ['Requirements Completeness', 'Testability', 'Consistency', 'Traceability'],
  arch: ['Technical Feasibility', 'Scalability', 'Security', 'Cost-Benefit'],
  pr: ['CI Status', 'Code Review', 'Test Coverage', 'Impact Assessment'],
  readiness: [
    'P0 Journey Coverage',
    'Smoke E2E Readiness',
    'Evidence Proof Chain',
    'Cross-Document Traceability',
  ],
  story: [
    'Story Scope Integrity',
    'Story Acceptance Coverage',
    'Story Evidence Traceability',
    'Story Execution Readiness',
  ],
  tasks: [
    'Task Atomicity',
    'Task Dependency Order',
    'Task Evidence Binding',
    'Task Execution Readiness',
  ],
  bugfix: [
    'Root Cause Accuracy',
    'Fix Correctness',
    'Regression Protection',
    'Bugfix Evidence Closure',
  ],
  delivery: [
    'Delivery Evidence Closure',
    'Current Attempt Binding',
    'Audit Convergence Receipt',
    'Closeout Authority',
  ],
};

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function resolveProjectPath(projectRoot, repoRelativePath) {
  return path.resolve(projectRoot, repoRelativePath);
}

function resolveDimensionContract(stage) {
  const key = text(stage).toLowerCase();
  const contract = CONTRACT_BY_STAGE[key];
  if (!contract) {
    return {
      status: key ? 'blocked' : 'ambiguous',
      dimensionMode: null,
      dimensionContractId: null,
      expectedDimensions: [],
      blockingReasons: [key ? 'dimension_contract_unresolved' : 'dimension_contract_ambiguous'],
    };
  }
  return {
    status: 'resolved',
    dimensionMode: contract.dimensionMode,
    dimensionContractId: contract.dimensionContractId,
    expectedDimensions: EXPECTED_DIMENSIONS_BY_MODE[contract.dimensionMode] || [],
    blockingReasons: [],
  };
}

function modeCheckItems(auditItemMapping, mode) {
  const section = object(auditItemMapping[mode]);
  const direct = (Array.isArray(section.checks) ? section.checks : []).flatMap((item) => {
    const row = object(item);
    return strings([row.item_id]);
  });
  const nested = (Array.isArray(section.dimensions) ? section.dimensions : []).flatMap((dimension) =>
    (Array.isArray(object(dimension).checks) ? object(dimension).checks : []).flatMap((item) => {
      const row = object(item);
      return strings([row.item_id]);
    })
  );
  return [...new Set([...direct, ...nested])].sort();
}

function modeVetoItems(checkItemIds) {
  return checkItemIds.filter((id) => id.startsWith('veto_')).sort();
}

function buildStageProfile(input) {
  const dimension = resolveDimensionContract(input.stageForDimensionContract);
  if (dimension.status !== 'resolved') {
    throw new Error(`critical_auditor_dimension_contract_unresolved:${input.stageProfileId}`);
  }
  const requiredCheckItemIds = modeCheckItems(input.auditItemMapping, input.checkItemMode);
  if (requiredCheckItemIds.length === 0) {
    throw new Error(`critical_auditor_check_items_missing:${input.stageProfileId}`);
  }
  const profileWithoutHash = {
    stageProfileId: input.stageProfileId,
    owningStages: strings(input.owningStages),
    dimensionContractId: dimension.dimensionContractId,
    dimensionMode: dimension.dimensionMode,
    expectedDimensions: dimension.expectedDimensions,
    requiredCheckItemIds,
    vetoItemIds: modeVetoItems(requiredCheckItemIds),
  };
  return {
    ...profileWithoutHash,
    stageProfileHash: sha256Json(profileWithoutHash),
  };
}

function withoutGeneratedHashes(profile) {
  const clone = JSON.parse(JSON.stringify(profile));
  if (clone.metadata) clone.metadata.profileHash = undefined;
  return clone;
}

function profileHashFor(profile) {
  return sha256Json(withoutGeneratedHashes(profile));
}

function loadCriticalAuditorProfile(projectRoot = process.cwd()) {
  const baseProfile = readJson(PROFILE_PATH);
  const registryBindings = object(baseProfile.registryBindings);
  const auditItemMappingPath = resolveProjectPath(
    projectRoot,
    text(registryBindings.auditItemMappingPath) || '_bmad/_config/audit-item-mapping.yaml'
  );
  const auditItemMapping = readYaml(auditItemMappingPath);
  const stageProfiles = {};
  for (const [stageProfileId, definition] of Object.entries(
    object(baseProfile.stageProfileDefinitions)
  )) {
    const row = object(definition);
    stageProfiles[stageProfileId] = buildStageProfile({
      stageProfileId,
      owningStages: strings(row.owningStages),
      stageForDimensionContract: text(row.stageForDimensionContract),
      checkItemMode: text(row.checkItemMode),
      auditItemMapping,
    });
  }
  const profile = {
    ...baseProfile,
    metadata: {
      ...object(baseProfile.metadata),
      profileId: PROFILE_ID,
      schemaVersion: SCHEMA_VERSION,
    },
    registryBindings: {
      ...registryBindings,
      codeReviewerConfigPath: resolveProjectPath(
        projectRoot,
        text(registryBindings.codeReviewerConfigPath) || '_bmad/_config/code-reviewer-config.yaml'
      ),
      auditItemMappingPath,
      dimensionContractsModule:
        text(registryBindings.dimensionContractsModule) ||
        'packages/scoring/contracts/dimension-contracts.ts',
    },
    stageProfiles,
    perspectives: strings(baseProfile.perspectives),
  };
  profile.metadata.profileHash = profileHashFor(profile);
  const validation = validateCriticalAuditorProfile({ profile });
  if (!validation.ok) {
    const error = new Error(`critical_auditor_profile_invalid:${validation.blockingReasons.join(',')}`);
    error.validation = validation;
    throw error;
  }
  profile.profileHash = profile.metadata.profileHash;
  profile.schemaVersion = profile.metadata.schemaVersion;
  profile.profileId = profile.metadata.profileId;
  return profile;
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const profile = loadCriticalAuditorProfile(process.cwd());
  process.stdout.write(json ? `${JSON.stringify(profile, null, 2)}\n` : `${profile.metadata.profileHash}\n`);
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
  EXPECTED_DIMENSIONS_BY_MODE,
  PROFILE_ID,
  SCHEMA_VERSION,
  loadCriticalAuditorProfile,
  profileHashFor,
  resolveDimensionContract,
  sha256Json,
  stableStringify,
};
