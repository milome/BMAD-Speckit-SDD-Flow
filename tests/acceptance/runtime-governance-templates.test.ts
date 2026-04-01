/**
 * §A.7 T9：模板覆盖、reason 含 template:<id>、test:scoring 由 CI 闸门覆盖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { assertValidRuntimePolicyTemplatePatch } from '../../scripts/runtime-governance-template-schema';
import { resetTriggerConfigCache } from '../../packages/scoring/trigger/trigger-loader';

describe('runtime-governance templates (T9)', () => {
  beforeEach(() => {
    resetTriggerConfigCache();
  });

  const config = loadConfig();

  it('未传 templateId 时不应用模板', () => {
    const base = resolveRuntimePolicy({ flow: 'story', stage: 'specify', config });
    const withTpl = resolveRuntimePolicy({
      flow: 'story',
      stage: 'specify',
      config,
      templateId: 'audit_heavy',
    });
    expect(base.strictness).not.toBe(withTpl.strictness);
    expect(withTpl.strictness).toBe('strict');
    expect(withTpl.reason).toContain('| template:audit_heavy');
  });

  it('模板可改变 strictness 且 convergence 随 strictness 更新', () => {
    const withTpl = resolveRuntimePolicy({
      flow: 'story',
      stage: 'specify',
      config,
      templateId: 'audit_heavy',
    });
    expect(withTpl.strictness).toBe('strict');
    expect(withTpl.convergence).toEqual(config.audit_convergence.strict);
  });

  it('schema 拒绝模板 patch triggerStage（与 stage-mapping / loader 链一致）', () => {
    expect(() =>
      assertValidRuntimePolicyTemplatePatch({ triggerStage: 'speckit_1_2' }, 'bad_tpl')
    ).toThrow(/must NOT have additional properties/i);
  });

  it('schema 拒绝模板 patch scoringEnabled', () => {
    expect(() => assertValidRuntimePolicyTemplatePatch({ scoringEnabled: false }, 'bad_tpl')).toThrow(
      /must NOT have additional properties/i
    );
  });
});
