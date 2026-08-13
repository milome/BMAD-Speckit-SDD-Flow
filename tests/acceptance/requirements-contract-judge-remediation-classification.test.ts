import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractRemediationPlan,
  finalizeRequirementsContractRemediationDelta,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta-finalizer';

describe('requirements contract Judge remediation classification', () => {
  it('routes missing existing authority to deterministic repair and unknown business rules to Grill', () => {
    const plan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: `sha256:${'1'.repeat(64)}`,
      findings: [
        {
          findingId: 'F-2',
          severity: 'Major',
          summary: '审批超时后的业务结果未定义',
          affectedMustRefs: ['MUST-002'],
          authorityBasis: 'missing_business_authority',
          earliestAffectedStage: 'cp00',
        },
        {
          findingId: 'F-1',
          severity: 'Major',
          summary: '已冻结的重复提交规则未投影到文档',
          affectedMustRefs: ['MUST-001'],
          authorityBasis: 'frozen_ir_contains_required_semantics',
          earliestAffectedStage: 'cp05',
        },
      ],
    });

    expect(plan.repairSteps.map((step) => [step.findingId, step.classification])).toEqual([
      ['F-2', 'new_business_decision'],
      ['F-1', 'projection_repair'],
    ]);
    expect(plan.state).toBe('business_decision_required');
    expect(plan.remediationPlanHash).toMatch(/^sha256:/u);
  });

  it('finalizes an actual deterministic delta and blocks missing progress or authority', () => {
    const plan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: `sha256:${'2'.repeat(64)}`,
      findings: [{
        findingId: 'F-1', severity: 'Major', summary: 'Frozen rule missing from projection',
        affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
        authorityBasis: 'frozen_ir_contains_required_semantics',
        earliestAffectedStage: 'cp05',
      }],
    });
    const input = {
      plan,
      beforeAuthority: { build: 'before' },
      afterAuthority: { build: 'after' },
      executedRepairStepRefs: ['F-1'],
      deferredRepairStepRefs: [],
      changedArtifactRoles: ['final_markdown'],
      changedArtifactRefs: ['final-markdown'],
      automaticRemediationCount: 0,
      maxAutomaticRemediations: 1,
    };
    const delta = finalizeRequirementsContractRemediationDelta(input);
    expect(delta).toMatchObject({
      schemaVersion: 'requirements-remediation-delta/v1',
      remediatesRequestHash: plan.judgeRequestHash,
      remediationPlanHash: plan.remediationPlanHash,
      executedRepairStepRefs: ['F-1'],
    });
    expect(delta.remediationDeltaHash).toMatch(/^sha256:/u);
    expect(() => finalizeRequirementsContractRemediationDelta({
      ...input, afterAuthority: input.beforeAuthority,
    })).toThrow('judge_remediation_no_progress');
    expect(() => finalizeRequirementsContractRemediationDelta({
      ...input, automaticRemediationCount: 1,
    })).toThrow('judge_remediation_limit_reached');
    expect(() => finalizeRequirementsContractRemediationDelta({
      ...input,
      changedArtifactRoles: ['judge_audit_packet'],
      changedArtifactRefs: ['judge-audit-packet'],
    })).toThrow('judge_remediation_no_progress');
  });

  it('does not finalize repair while a business decision is required', () => {
    const plan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: `sha256:${'3'.repeat(64)}`,
      findings: [{
        findingId: 'F-BUSINESS', severity: 'Major', summary: 'Business outcome unknown',
        affectedMustRefs: ['MUST-002'], affectedArtifactRefs: ['final-markdown'],
        authorityBasis: 'missing_business_authority',
        earliestAffectedStage: 'cp00',
      }],
    });
    expect(() => finalizeRequirementsContractRemediationDelta({
      plan, beforeAuthority: { a: 1 }, afterAuthority: { a: 2 },
      executedRepairStepRefs: ['F-BUSINESS'], deferredRepairStepRefs: [],
      changedArtifactRoles: ['semantic_ir'], changedArtifactRefs: ['semantic-ir'],
      automaticRemediationCount: 0,
      maxAutomaticRemediations: 1,
    })).toThrow('requirements_contract_remediation_business_decision_required');
  });
});
