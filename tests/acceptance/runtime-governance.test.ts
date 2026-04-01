/**
 * U-1.2b：`resolveRuntimePolicy` 与 legacy 对齐断言的机器可验证护栏（主干须全绿）。
 */

import { describe, it, expect } from 'vitest';
import {
  loadConfig,
  shouldAudit,
  shouldValidate,
  getStrictness,
  shouldGenerateDoc,
  getAuditConvergence,
  getStageConfig,
  type StageName,
} from '../../scripts/bmad-config';
import {
  resolveRuntimePolicy,
  type RuntimeFlowId,
  type RuntimePolicy,
} from '../../scripts/runtime-governance';

/** 与 `runtime-governance-matrix.test.ts` 同规则；抛出以便护栏测 `toThrow`。 */
export function assertLegacyAlignedRuntimePolicy(
  policy: RuntimePolicy,
  flow: RuntimeFlowId,
  stage: StageName,
  config: ReturnType<typeof loadConfig>
): void {
  const strictness = getStrictness(stage, config);
  if (policy.flow !== flow) {
    throw new Error(`flow mismatch: expected ${flow}, got ${policy.flow}`);
  }
  if (policy.stage !== stage) {
    throw new Error(`stage mismatch: expected ${stage}, got ${policy.stage}`);
  }
  if (policy.auditRequired !== shouldAudit(stage, config)) {
    throw new Error(`auditRequired mismatch for ${flow}/${stage}`);
  }
  if (policy.validationLevel !== shouldValidate(stage, config)) {
    throw new Error(`validationLevel mismatch for ${flow}/${stage}`);
  }
  if (policy.strictness !== strictness) {
    throw new Error(`strictness mismatch for ${flow}/${stage}`);
  }
  if (policy.generateDoc !== shouldGenerateDoc(stage, config)) {
    throw new Error(`generateDoc mismatch for ${flow}/${stage}`);
  }
  const conv = getAuditConvergence(strictness, config);
  if (JSON.stringify(policy.convergence) !== JSON.stringify(conv)) {
    throw new Error(`convergence mismatch for ${flow}/${stage}`);
  }
  const stageCfg = getStageConfig(stage, config);
  if (policy.skipAllowed !== (stageCfg?.optional === true)) {
    throw new Error(`skipAllowed mismatch for ${flow}/${stage}`);
  }
  if (policy.compatibilitySource !== 'governance') {
    throw new Error(`compatibilitySource expected governance for ${flow}/${stage}`);
  }
}

describe('runtime-governance (U-1.2b)', () => {
  it('canonical policy passes legacy alignment assert', () => {
    const config = loadConfig();
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'plan', config });
    expect(() => assertLegacyAlignedRuntimePolicy(policy, 'story', 'plan', config)).not.toThrow();
  });

  describe('U-1.2b guard', () => {
    it('throws when auditRequired is intentionally wrong vs legacy', () => {
      const config = loadConfig();
      const canonical = resolveRuntimePolicy({ flow: 'bugfix', stage: 'gaps', config });
      const tampered: RuntimePolicy = {
        ...canonical,
        auditRequired: !shouldAudit('gaps', config),
      };
      expect(() =>
        assertLegacyAlignedRuntimePolicy(tampered, 'bugfix', 'gaps', config)
      ).toThrow(/auditRequired mismatch/);
    });

    it('throws when validationLevel is intentionally wrong vs legacy', () => {
      const config = loadConfig();
      const canonical = resolveRuntimePolicy({ flow: 'standalone_tasks', stage: 'specify', config });
      const tampered: RuntimePolicy = {
        ...canonical,
        validationLevel:
          shouldValidate('specify', config) === 'basic' ? 'test_only' : 'basic',
      };
      expect(() =>
        assertLegacyAlignedRuntimePolicy(
          tampered,
          'standalone_tasks',
          'specify',
          config
        )
      ).toThrow(/validationLevel mismatch/);
    });
  });
});
