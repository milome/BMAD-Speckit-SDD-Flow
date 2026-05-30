export type CriticalAuditorStageProfileId =
  | 'requirements_compiler'
  | 'implementation_readiness'
  | 'post_implementation_code_audit'
  | 'delivery_confirmation';

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
  perspectives: Array<'product_intent' | 'model_projection' | 'main_agent_execution'>;
  stageProfiles: Record<CriticalAuditorStageProfileId, CriticalAuditorStageProfile>;
  registryBindings: Record<string, unknown>;
  [key: string]: unknown;
}

export declare function loadCriticalAuditorProfile(projectRoot?: string): CriticalAuditorProfile;
export declare function profileHashFor(profile: unknown): string;
export declare function sha256Json(value: unknown): string;
export declare function stableStringify(value: unknown): string;
