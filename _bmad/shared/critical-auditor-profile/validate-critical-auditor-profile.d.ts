import type { CriticalAuditorProfile, CriticalAuditorStageProfile } from './load-critical-auditor-profile';

export interface CriticalAuditorProfileValidation {
  ok: boolean;
  blockingReasons: string[];
  stageProfile?: CriticalAuditorStageProfile;
}

export declare function validateCriticalAuditorProfile(input: {
  profile: CriticalAuditorProfile;
}): CriticalAuditorProfileValidation;

export declare function validateCriticalAuditorProfileForStage(input: {
  profile: CriticalAuditorProfile;
  stageProfileId: CriticalAuditorStageProfileId;
  expectedProfileHash?: string | null;
  expectedStageProfileHash?: string | null;
}): CriticalAuditorProfileValidation;

export type CriticalAuditorStageProfileId =
  | 'requirements_compiler'
  | 'implementation_readiness'
  | 'post_implementation_code_audit'
  | 'delivery_confirmation';
