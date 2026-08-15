import type { GoalExecutionIR } from './goal-execution-ir';
import { validateGoalExecutionIR } from './goal-execution-ir';
import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';

export interface GoalExecutionClosure {
  schemaVersion: 'GoalExecutionClosure/v1';
  goalExecutionIRHash: string;
  profile: 'requirements_backed' | 'standalone';
  coverage: {
    obligationIds: string[];
    traceSliceIds: string[];
    taskIds: string[];
    commandIds: string[];
    evidenceContractIds: string[];
  };
  decision: 'pass';
  issueCodes: [];
  goalExecutionClosureHash: string;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function fail(issueCode: string): never {
  throw Object.assign(new Error(issueCode), { issueCode });
}

export function compileGoalExecutionClosure(ir: GoalExecutionIR): GoalExecutionClosure {
  const validation = validateGoalExecutionIR(ir);
  if (validation.decision !== 'pass') fail(validation.issueCodes[0]);
  const obligationIds = sortedUnique(ir.obligations.map((row) => row.obligationId));
  const taskIds = sortedUnique(ir.atomicTasks.map((row) => String(row.taskId || '')));
  const domainIds = new Set(ir.executionDomains.map((row) => String(row.executionDomainId || '')));
  const traceTaskRefs = sortedUnique(
    ir.traceSlices.flatMap((row) => (Array.isArray(row.taskRefs) ? row.taskRefs.map(String) : []))
  );
  const traceObligationRefs = sortedUnique(
    ir.traceSlices.flatMap((row) =>
      Array.isArray(row.obligationRefs) ? row.obligationRefs.map(String) : []
    )
  );
  if (JSON.stringify(traceTaskRefs) !== JSON.stringify(taskIds))
    fail('goal_execution_task_coverage_incomplete');
  if (JSON.stringify(traceObligationRefs) !== JSON.stringify(obligationIds))
    fail('goal_execution_obligation_coverage_incomplete');
  for (const trace of ir.traceSlices) {
    if (!Array.isArray(trace.taskRefs) || trace.taskRefs.length === 0) {
      fail('goal_execution_trace_task_membership_empty');
    }
    if (!domainIds.has(String(trace.executionDomainRef || '')))
      fail('goal_execution_domain_closure_invalid');
  }
  for (const task of ir.atomicTasks) {
    if (
      !Number.isInteger(task.expectedEffortMinutes) ||
      !Number.isInteger(task.upperBoundEffortMinutes) ||
      Number(task.expectedEffortMinutes) <= 0 ||
      Number(task.upperBoundEffortMinutes) < Number(task.expectedEffortMinutes) ||
      Number(task.upperBoundEffortMinutes) > 240 ||
      !Array.isArray(task.effortBasisRefs) ||
      task.effortBasisRefs.length === 0
    )
      fail('goal_execution_effort_bound_invalid');
  }
  const coverage = {
    obligationIds,
    traceSliceIds: sortedUnique(ir.traceSlices.map((row) => String(row.traceSliceId || ''))),
    taskIds,
    commandIds: sortedUnique(ir.commands.map((row) => String(row.commandId || ''))),
    evidenceContractIds: sortedUnique(
      ir.evidenceContracts.map((row) => String(row.evidenceContractId || ''))
    ),
  };
  const payload = {
    schemaVersion: 'GoalExecutionClosure/v1' as const,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    profile: ir.profile,
    coverage,
    decision: 'pass' as const,
    issueCodes: [] as [],
  };
  const closure = Object.freeze({
    ...payload,
    goalExecutionClosureHash: sha256Stable(payload),
  });
  validateGoalContractSchema('goal-execution-closure.schema.json', closure);
  return closure;
}
