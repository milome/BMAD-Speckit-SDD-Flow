/**
 * Runtime policy（§D.2）：对 specify + flow story，policy 中与 bmad-config 可对齐的字段须与 legacy helper 一致。
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
} from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

describe('runtime-governance policy (legacy parity, story/specify)', () => {
  it('specify + flow story: legacy-aligned fields match bmad-config helpers', () => {
    const config = loadConfig();
    const stage = 'specify' as const;
    const flow = 'story' as const;

    const policy = resolveRuntimePolicy({ flow, stage, config });

    const strictness = getStrictness(stage, config);

    expect(policy.flow).toBe('story');
    expect(policy.stage).toBe('specify');
    expect(policy.auditRequired).toBe(shouldAudit(stage, config));
    expect(policy.validationLevel).toBe(shouldValidate(stage, config));
    expect(policy.strictness).toBe(strictness);
    expect(policy.generateDoc).toBe(shouldGenerateDoc(stage, config));
    expect(policy.convergence).toEqual(getAuditConvergence(strictness, config));

    const stageCfg = getStageConfig(stage, config);
    expect(policy.skipAllowed).toBe(stageCfg?.optional === true);

    expect(policy.compatibilitySource).toBe('governance');
    expect(policy.reason).toContain('legacy:');
  });
});
