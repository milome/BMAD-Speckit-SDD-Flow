import {
  REQUIREMENTS_CONTRACT_STAGE_REGISTRY,
  REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY,
} from './requirements-contract-model';

export const REQUIREMENTS_CONTRACT_STAGE_REGISTRY_SCHEMA_VERSION =
  'requirements-contract-stage-registry/v1' as const;

export const REQUIREMENTS_CONTRACT_DISPATCH_HOST_REGISTRY = [
  { entryId: 'codex', executionHost: 'codex', nativeGoalEligible: true },
  { entryId: 'claude-code', executionHost: 'claude-code', nativeGoalEligible: true },
  { entryId: 'cursor-ide', executionHost: 'cursor-ide', nativeGoalEligible: false },
  { entryId: 'cursor-cli', executionHost: 'cursor-cli', nativeGoalEligible: false },
  { entryId: 'generic', executionHost: 'generic', nativeGoalEligible: false },
] as const;

export const REQUIREMENTS_CONTRACT_PRODUCTION_STAGE_REGISTRY = {
  schemaVersion: REQUIREMENTS_CONTRACT_STAGE_REGISTRY_SCHEMA_VERSION,
  stages: REQUIREMENTS_CONTRACT_STAGE_REGISTRY,
  taskOwnerStages: REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY,
  dispatchHosts: REQUIREMENTS_CONTRACT_DISPATCH_HOST_REGISTRY,
} as const;
