import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from '../../scripts/critical-auditor-profile';

describe('CriticalAuditorProfile stage-aware contract', () => {
  it('provides the required shared contract files and resolves them through the runtime wrapper', () => {
    const sharedDir = path.join(process.cwd(), '_bmad', 'shared', 'critical-auditor-profile');
    for (const fileName of [
      'critical-auditor-profile.schema.json',
      'critical-auditor-profile.json',
      'load-critical-auditor-profile.js',
      'validate-critical-auditor-profile.js',
    ]) {
      expect(fs.existsSync(path.join(sharedDir, fileName)), fileName).toBe(true);
    }

    const loader = require('../../_bmad/shared/critical-auditor-profile/load-critical-auditor-profile');
    const validator = require('../../_bmad/shared/critical-auditor-profile/validate-critical-auditor-profile');
    const sharedProfile = loader.loadCriticalAuditorProfile(process.cwd());
    expect(validator.validateCriticalAuditorProfile({ profile: sharedProfile }).ok).toBe(true);
    expect(sharedProfile.metadata.profileHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(sharedProfile.profileHash).toBe(sharedProfile.metadata.profileHash);
  });

  it('resolves stage-specific dimensions, fixed perspectives, check items, and hashes from shared config', () => {
    const profile = resolveCriticalAuditorProfile(process.cwd());

    expect(profile.schemaVersion).toBe('critical-auditor-profile/v1');
    expect(profile.profileHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(profile.perspectives).toEqual([
      'product_intent',
      'model_projection',
      'main_agent_execution',
    ]);
    expect(Object.keys(profile.stageProfiles).sort()).toEqual([
      'delivery_confirmation',
      'implementation_readiness',
      'post_implementation_code_audit',
      'requirements_compiler',
    ]);
    for (const stageProfile of Object.values(profile.stageProfiles)) {
      expect(stageProfile.dimensionContractId).toBeTruthy();
      expect(stageProfile.dimensionMode).toBeTruthy();
      expect(stageProfile.expectedDimensions.length).toBeGreaterThan(0);
      expect(stageProfile.requiredCheckItemIds.length).toBeGreaterThan(0);
      expect(stageProfile.stageProfileHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(validateCriticalAuditorProfileForStage({
        profile,
        stageProfileId: stageProfile.stageProfileId,
        expectedProfileHash: profile.profileHash,
        expectedStageProfileHash: stageProfile.stageProfileHash,
      }).ok).toBe(true);
    }
    expect(stageProfileForCallPoint('requirements_compiler')).toBe('requirements_compiler');
    expect(stageProfileForCallPoint('implementation_readiness')).toBe('implementation_readiness');
    expect(stageProfileForCallPoint('audit_review')).toBe('post_implementation_code_audit');
    expect(stageProfileForCallPoint('delivery_confirmation')).toBe('delivery_confirmation');
    expect(profile.stageProfiles.delivery_confirmation.dimensionContractId).toBe('delivery_confirmation');
    expect(profile.stageProfiles.delivery_confirmation.dimensionMode).toBe('delivery');
    expect(profile.stageProfiles.delivery_confirmation.expectedDimensions).toEqual([
      'Delivery Evidence Closure',
      'Current Attempt Binding',
      'Audit Convergence Receipt',
      'Closeout Authority',
    ]);
    expect(profile.stageProfiles.delivery_confirmation.requiredCheckItemIds).toEqual([
      'delivery_audit_convergence_receipt',
      'delivery_closeout_authority',
      'delivery_current_attempt_binding',
      'delivery_evidence_closure',
    ]);
  });
});
