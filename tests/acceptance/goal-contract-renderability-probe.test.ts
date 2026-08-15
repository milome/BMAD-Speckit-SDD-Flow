import { describe, expect, it } from 'vitest';
import { probeGoalContractRenderability } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-contract-renderability-probe';
import { validateGoalContractSchema } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/schema-registry';

const HASH = `sha256:${'a'.repeat(64)}`;
const ir = {
  goalExecutionIRHash: HASH,
  obligations: [{ obligationId: 'MUST-001' }, { obligationId: 'NEG-001' }],
  atomicTasks: [{ taskId: 'TASK-001' }, { taskId: 'TASK-002' }],
};

describe('Goal parent renderability probe', () => {
  it('passes only when the parent projection contains the exact IR closed set', () => {
    const report = probeGoalContractRenderability({
      goalExecutionIr: ir,
      markdown: `# Goal\n\n${HASH}\n\nMUST-001\nNEG-001\nTASK-001\nTASK-002\n`,
    });

    expect(report.decision).toBe('pass');
    expect(report.missingObligationIds).toEqual([]);
    expect(report.missingTaskIds).toEqual([]);
    expect(report.goalExecutionIRHash).toBe(HASH);
  });

  it('blocks a projection that drops negative evidence or renders undefined data', () => {
    const missing = probeGoalContractRenderability({
      goalExecutionIr: ir,
      markdown: `# Goal\n\n${HASH}\n\nMUST-001\nTASK-001\nTASK-002\nundefined\n`,
    });

    expect(missing.decision).toBe('block');
    expect(missing.missingObligationIds).toEqual(['NEG-001']);
    expect(missing.issueCodes).toEqual([
      'goal_parent_projection_obligation_missing',
      'goal_parent_projection_undefined_value',
    ]);
  });

  it('validates reports with a closed canonical schema before promotion', () => {
    const report = probeGoalContractRenderability({
      goalExecutionIr: ir,
      markdown: `# Goal\n\n${HASH}\n\nMUST-001\nNEG-001\nTASK-001\nTASK-002\n`,
    });

    expect(() =>
      validateGoalContractSchema('goal-contract-renderability-probe.schema.json', {
        ...report,
        undeclaredProjectionAuthority: true,
      })
    ).toThrow('canonical_schema_invalid');
  });
});
