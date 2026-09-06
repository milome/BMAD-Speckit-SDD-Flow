import { describe, expect, it } from 'vitest';
import { typedAggregateExecution, typedConsumerProbe } from '../helpers/standalone-goal-typed-consumers';
import { typedActivationProbe } from '../helpers/standalone-goal-typed-activation';
import { normalizeGoalExecutionAuthority, resolveGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';
import { goalExecutionIRHash, validateGoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';

describe('explicit aggregate-only task authority', () => {
  it('keeps aggregate actions executable, phase-ordered and ownership-free in child packages', async () => {
    const compiled = await typedAggregateExecution();
    const ir = compiled.goalExecutionIr;
    expect(ir.atomicTasks).toHaveLength(3);
    expect(resolveGoalExecutionAuthority(normalizeGoalExecutionAuthority(ir))).toEqual(ir);
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.children).toHaveLength(3);
    const children = result.manifest.topologicalOrder.map((id: string) => result.children.find((child: any) => child.partitionId === id));
    expect(children.map((child: any) => child.atomicTasks[0].taskExecution?.aggregateGatePhase ?? 'implementation'))
      .toEqual(['implementation', 'post_child_execution', 'final_aggregate']);
    expect(children.map((child: any) => child.logicalScopes.ownedPaths)).toEqual([['src/export.ts'], [], []]);
    expect(children.slice(1).every((child: any) => child.atomicTasks[0].taskExecution.executionClass === 'aggregate_only')).toBe(true);
    expect(children.slice(1).every((child: any) => child.commands.length > 0)).toBe(true);
  }, 120000);

  it.each(['unknown-class', 'borrowed-path', 'missing-phase-dependency', 'missing-task-metadata'])(
    'rejects rehashed aggregate projection drift: %s', async (mutation) => {
      const ir = structuredClone((await typedAggregateExecution()).goalExecutionIr);
      const aggregate = ir.atomicTasks.find((task) => (task.taskExecution as Record<string, unknown>)?.executionClass === 'aggregate_only')!;
      if (mutation === 'unknown-class') (aggregate.taskExecution as Record<string, unknown>).executionClass = 'unknown';
      if (mutation === 'borrowed-path') (ir.executionDomains[0].ownership as Record<string, unknown>[]).push({ targetPath: 'src/export.ts', obligationRefs: aggregate.obligationRefs });
      if (mutation === 'missing-phase-dependency') ir.dependencies = ir.dependencies.filter((edge) => edge.from !== aggregate.taskId);
      if (mutation === 'missing-task-metadata') delete aggregate.taskExecution;
      ir.goalExecutionIRHash = goalExecutionIRHash(ir);
      expect(validateGoalExecutionIR(ir).decision).toBe('block');
    });

  it('activates and resumes explicit aggregate children without borrowing production paths', async () => {
    const result = await typedActivationProbe('aggregate');
    expect(result.error).toBeUndefined();
    expect(result.first.executionMode).toBe('partitioned_goal');
    expect(result.resumed).toBeDefined();
    const authorities = result.resumed.executionAuthorities;
    expect(authorities.filter((row: any) => row.executionClass === 'aggregate_only')).toHaveLength(2);
    expect(authorities.slice(1).every((row: any) => row.ownedPaths.length === 0 && row.taskExecutions.length === 1)).toBe(true);
  }, 120000);
});
