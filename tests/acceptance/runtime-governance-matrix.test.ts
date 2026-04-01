/**
 * U-1.2a：黄金矩阵 — `resolveRuntimePolicy` 与 legacy helper 可对齐字段一致（多 flow × 代表性 stage）。
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

function expectLegacyAlignedFields(
  policy: RuntimePolicy,
  flow: RuntimeFlowId,
  stage: StageName,
  config: ReturnType<typeof loadConfig>
): void {
  const strictness = getStrictness(stage, config);
  expect(policy.flow).toBe(flow);
  expect(policy.stage).toBe(stage);
  expect(policy.auditRequired).toBe(shouldAudit(stage, config));
  expect(policy.validationLevel).toBe(shouldValidate(stage, config));
  expect(policy.strictness).toBe(strictness);
  expect(policy.generateDoc).toBe(shouldGenerateDoc(stage, config));
  expect(policy.convergence).toEqual(getAuditConvergence(strictness, config));
  const stageCfg = getStageConfig(stage, config);
  expect(policy.skipAllowed).toBe(stageCfg?.optional === true);
  expect(policy.compatibilitySource).toBe('governance');
}

describe('runtime-governance matrix (U-1.2a)', () => {
  const config = loadConfig();

  const cases: Array<{ flow: RuntimeFlowId; stage: StageName; label: string }> = [
    { flow: 'story', stage: 'specify', label: 'story × specify' },
    { flow: 'story', stage: 'implement', label: 'story × implement' },
    { flow: 'story', stage: 'post_audit', label: 'story × post_audit' },
    { flow: 'bugfix', stage: 'specify', label: 'bugfix × specify' },
    { flow: 'bugfix', stage: 'post_audit', label: 'bugfix × post_audit' },
    { flow: 'standalone_tasks', stage: 'tasks', label: 'standalone_tasks × tasks' },
    { flow: 'standalone_tasks', stage: 'implement', label: 'standalone_tasks × implement' },
    { flow: 'epic', stage: 'epic_complete', label: 'epic × epic_complete' },
  ];

  it.each(cases)('$label: legacy-aligned policy fields match bmad-config helpers', ({ flow, stage }) => {
    const policy = resolveRuntimePolicy({ flow, stage, config });
    expectLegacyAlignedFields(policy, flow, stage, config);
    expect(policy.reason).toContain('legacy:');
  });
});

describe('U-1.7b mandatoryGate vs granularity-governed', () => {
  const config = loadConfig();

  it('post_audit + story: mandatoryGate true；审计仍开启（story 粒度不跳过 post_audit）', () => {
    const p = resolveRuntimePolicy({ flow: 'story', stage: 'post_audit', config });
    expect(p.mandatoryGate).toBe(true);
    expect(shouldAudit('post_audit', config)).toBe(true);
    expect(p.granularityGoverned).toBe(false);
  });

  it('implement + story: granularityGoverned true；非 mandatoryGate 门控占位', () => {
    const p = resolveRuntimePolicy({ flow: 'story', stage: 'implement', config });
    expect(p.granularityGoverned).toBe(true);
    expect(p.mandatoryGate).toBe(false);
  });
});

describe('U-1.7c triggerStage（与 scoring 注册 id 对齐）', () => {
  const config = loadConfig();

  it('bugfix × gaps → speckit_3_2', () => {
    const p = resolveRuntimePolicy({ flow: 'bugfix', stage: 'gaps', config });
    expect(p.triggerStage).toBe('speckit_3_2');
  });
});
