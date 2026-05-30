import {
  loadCriticalAuditorProfile,
  profileHashFor,
  sha256Json,
  stableStringify,
} from '../_bmad/shared/critical-auditor-profile/load-critical-auditor-profile';
import {
  validateCriticalAuditorProfileForStage as validateSharedCriticalAuditorProfileForStage,
} from '../_bmad/shared/critical-auditor-profile/validate-critical-auditor-profile';

export type CriticalAuditorStageProfileId =
  | 'requirements_compiler'
  | 'implementation_readiness'
  | 'post_implementation_code_audit'
  | 'delivery_confirmation';

export type CriticalAuditorPerspectiveId =
  | 'product_intent'
  | 'model_projection'
  | 'main_agent_execution';

export interface CriticalAuditorStageProfile {
  stageProfileId: CriticalAuditorStageProfileId;
  owningStages: string[];
  dimensionContractId: string;
  dimensionMode: string;
  expectedDimensions: string[];
  requiredCheckItemIds: string[];
  vetoItemIds: string[];
  stageProfileHash: string;
}

export interface CriticalAuditorProfile {
  schemaVersion: 'critical-auditor-profile/v1';
  profileId: 'main-agent-six-mental-model-critical-auditor';
  profileHash: string;
  metadata: {
    profileId: 'main-agent-six-mental-model-critical-auditor';
    profileVersion: string;
    profileHash: string;
    schemaVersion: 'critical-auditor-profile/v1';
    createdAt: string;
    authoritativeFor: string[];
  };
  perspectives: CriticalAuditorPerspectiveId[];
  stageProfiles: Record<CriticalAuditorStageProfileId, CriticalAuditorStageProfile>;
  registryBindings: {
    codeReviewerConfigPath: string;
    auditItemMappingPath: string;
    dimensionContractsModule: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CriticalAuditorProfileValidation {
  ok: boolean;
  blockingReasons: string[];
  stageProfile?: CriticalAuditorStageProfile;
}

export { profileHashFor, sha256Json, stableStringify };

export function resolveCriticalAuditorProfile(projectRoot = process.cwd()): CriticalAuditorProfile {
  return loadCriticalAuditorProfile(projectRoot) as CriticalAuditorProfile;
}

export function stageProfileForCallPoint(callPoint: string): CriticalAuditorStageProfileId {
  switch (callPoint) {
    case 'implementation_readiness':
    case 'readiness_blocker_classification':
      return 'implementation_readiness';
    case 'execution_closure_evidence':
    case 'audit_review':
    case 'audit_scoring_materialization':
      return 'post_implementation_code_audit';
    case 'delivery_confirmation':
      return 'delivery_confirmation';
    case 'requirements_compiler':
    case 'must_atomic_decomposition':
    case 'packet_source_reconciliation':
    case 'compiler_projection':
    case 'goal_execution_contract':
    case 'docs_review':
    case 'grill_with_docs':
    default:
      return 'requirements_compiler';
  }
}

export function validateCriticalAuditorProfileForStage(input: {
  profile: CriticalAuditorProfile;
  stageProfileId: CriticalAuditorStageProfileId;
  expectedProfileHash?: string | null;
  expectedStageProfileHash?: string | null;
}): CriticalAuditorProfileValidation {
  return validateSharedCriticalAuditorProfileForStage(input) as CriticalAuditorProfileValidation;
}
