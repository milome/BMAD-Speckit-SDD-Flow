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

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function fail(issueCode: string): never {
  throw Object.assign(new Error(issueCode), { issueCode });
}

function assertUniqueIds(values: string[], issueCode: string): void {
  if (new Set(values).size !== values.length || values.some((value) => !value)) fail(issueCode);
}

export function compileGoalExecutionClosure(ir: GoalExecutionIR): GoalExecutionClosure {
  const validation = validateGoalExecutionIR(ir);
  if (validation.decision !== 'pass') fail(validation.issueCodes[0]);
  const rawObligationIds = ir.obligations.map((row) => row.obligationId);
  const rawTaskIds = ir.atomicTasks.map((row) => String(row.taskId || ''));
  const rawTraceSliceIds = ir.traceSlices.map((row) => String(row.traceSliceId || ''));
  const rawCommandIds = ir.commands.map((row) => String(row.commandId || ''));
  const rawEvidenceContractIds = ir.evidenceContracts.map((row) =>
    String(row.evidenceContractId || '')
  );
  assertUniqueIds(rawObligationIds, 'goal_execution_obligation_id_duplicate');
  assertUniqueIds(rawTaskIds, 'goal_execution_task_id_duplicate');
  assertUniqueIds(rawTraceSliceIds, 'goal_execution_trace_id_duplicate');
  assertUniqueIds(rawCommandIds, 'goal_execution_command_id_duplicate');
  assertUniqueIds(rawEvidenceContractIds, 'goal_execution_evidence_id_duplicate');
  const obligationIds = sortedUnique(rawObligationIds);
  const taskIds = sortedUnique(rawTaskIds);
  const traceSliceIds = sortedUnique(rawTraceSliceIds);
  const commandIds = sortedUnique(rawCommandIds);
  const evidenceContractIds = sortedUnique(rawEvidenceContractIds);
  if (
    !ir.dependencies.every(
      (dependency) =>
        dependency.from !== dependency.to &&
        taskIds.includes(String(dependency.from || '')) &&
        taskIds.includes(String(dependency.to || ''))
    )
  ) {
    fail('goal_execution_dependency_dag_invalid');
  }
  const taskById = new Map(ir.atomicTasks.map((row) => [String(row.taskId || ''), row]));
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
  const traceCommandRefs = sortedUnique(
    ir.traceSlices.flatMap((row) =>
      Array.isArray(row.commandRefs) ? row.commandRefs.map(String) : []
    )
  );
  const traceEvidenceRefs = sortedUnique(
    ir.traceSlices.flatMap((row) =>
      Array.isArray(row.evidenceContractRefs) ? row.evidenceContractRefs.map(String) : []
    )
  );
  if (JSON.stringify(traceCommandRefs) !== JSON.stringify(commandIds))
    fail('goal_execution_command_coverage_incomplete');
  if (JSON.stringify(traceEvidenceRefs) !== JSON.stringify(evidenceContractIds))
    fail('goal_execution_evidence_coverage_incomplete');
  const commandById = new Map(ir.commands.map((row) => [String(row.commandId || ''), row]));
  const evidenceById = new Map(
    ir.evidenceContracts.map((row) => [String(row.evidenceContractId || ''), row])
  );
  const traceMembership = ir.traceSlices.map((trace) => {
    const taskRefs = strings(trace.taskRefs);
    return {
      traceId: String(trace.traceSliceId || ''),
      obligationRefs: new Set(strings(trace.obligationRefs)),
      atomRefs: new Set(taskRefs.flatMap((taskRef) => strings(taskById.get(taskRef)?.atomRefs))),
      commandRefs: new Set(strings(trace.commandRefs)),
      evidenceContractRefs: new Set(strings(trace.evidenceContractRefs)),
    };
  });
  for (const command of ir.commands) {
    const commandId = String(command.commandId || '');
    const expectedTraceIds = traceMembership
      .filter(
        (trace) =>
          strings(command.obligationRefs).some((ref) => trace.obligationRefs.has(ref)) ||
          strings(command.atomRefs).some((ref) => trace.atomRefs.has(ref))
      )
      .map((trace) => trace.traceId)
      .sort();
    const actualTraceIds = traceMembership
      .filter((trace) => trace.commandRefs.has(commandId))
      .map((trace) => trace.traceId)
      .sort();
    if (JSON.stringify(actualTraceIds) !== JSON.stringify(expectedTraceIds)) {
      fail('goal_execution_trace_command_membership_mismatch');
    }
  }
  for (const evidence of ir.evidenceContracts) {
    const evidenceId = String(evidence.evidenceContractId || '');
    const expectedTraceIds = traceMembership
      .filter(
        (trace) =>
          strings(evidence.obligationRefs).some((ref) => trace.obligationRefs.has(ref)) ||
          strings(evidence.atomRefs).some((ref) => trace.atomRefs.has(ref))
      )
      .map((trace) => trace.traceId)
      .sort();
    const actualTraceIds = traceMembership
      .filter((trace) => trace.evidenceContractRefs.has(evidenceId))
      .map((trace) => trace.traceId)
      .sort();
    if (JSON.stringify(actualTraceIds) !== JSON.stringify(expectedTraceIds)) {
      fail('goal_execution_trace_evidence_membership_mismatch');
    }
  }
  for (const trace of ir.traceSlices) {
    if (!Array.isArray(trace.taskRefs) || trace.taskRefs.length === 0) {
      fail('goal_execution_trace_task_membership_empty');
    }
    if (!domainIds.has(String(trace.executionDomainRef || '')))
      fail('goal_execution_domain_closure_invalid');
    const obligationRefs = new Set(
      Array.isArray(trace.obligationRefs) ? trace.obligationRefs.map(String) : []
    );
    const taskRefs = Array.isArray(trace.taskRefs) ? trace.taskRefs.map(String) : [];
    const traceAtomRefs = new Set(
      taskRefs.flatMap((taskRef) => strings(taskById.get(taskRef)?.atomRefs))
    );
    for (const commandRef of Array.isArray(trace.commandRefs)
      ? trace.commandRefs.map(String)
      : []) {
      const command = commandById.get(commandRef);
      if (
        !command ||
        (!strings(command.obligationRefs).some((ref) => obligationRefs.has(ref)) &&
          !strings(command.atomRefs).some((ref) => traceAtomRefs.has(ref)))
      ) {
        fail('goal_execution_trace_command_membership_invalid');
      }
    }
    for (const evidenceRef of Array.isArray(trace.evidenceContractRefs)
      ? trace.evidenceContractRefs.map(String)
      : []) {
      const evidence = evidenceById.get(evidenceRef);
      if (
        !evidence ||
        (!strings(evidence.obligationRefs).some((ref) => obligationRefs.has(ref)) &&
          !strings(evidence.atomRefs).some((ref) => traceAtomRefs.has(ref)))
      ) {
        fail('goal_execution_trace_evidence_membership_invalid');
      }
    }
  }
  for (const trace of ir.traceSlices) {
    const obligationRefs = new Set(
      Array.isArray(trace.obligationRefs) ? trace.obligationRefs.map(String) : []
    );
    const taskRefs = Array.isArray(trace.taskRefs) ? trace.taskRefs.map(String) : [];
    const traceTasks = taskRefs.map((taskRef) => taskById.get(taskRef));
    if (
      traceTasks.some(
        (task) =>
          !task ||
          !Array.isArray(task.obligationRefs) ||
          !task.obligationRefs
            .map(String)
            .some((obligationRef) => obligationRefs.has(obligationRef))
      ) ||
      [...obligationRefs].some(
        (obligationRef) =>
          !traceTasks.some(
            (task) =>
              task &&
              Array.isArray(task.obligationRefs) &&
              task.obligationRefs.map(String).includes(obligationRef)
          )
      )
    ) {
      fail('goal_execution_trace_task_membership_mismatch');
    }
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
    traceSliceIds,
    taskIds,
    commandIds,
    evidenceContractIds,
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
