import type { GoalExecutionObligation } from './goal-execution-ir';

type JsonObject = Record<string, unknown>;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};

export function typedSourceObligation(row: JsonObject): GoalExecutionObligation {
  const role = String(row.executionRole ?? '');
  const strength = String(row.normativeStrength ?? '');
  const polarity = String(row.polarity ?? '');
  if (!['action', 'requirement', 'acceptance', 'binding', 'definition', 'boundary', 'guidance'].includes(role) ||
    !['must', 'should', 'may', 'mixed', 'descriptive'].includes(strength) ||
    !['required', 'forbidden', 'permitted', 'preserve', 'mixed', 'descriptive'].includes(polarity) ||
    (role === 'action' && strength !== 'must') || (strength === 'may' && polarity !== 'permitted')) {
    throw new Error('standalone_goal_normative_role_invalid');
  }
  const kind: GoalExecutionObligation['kind'] = strength === 'may' ? 'PERMISSION' : strength === 'should' ? 'GUIDANCE'
    : strength === 'mixed' ? 'COMPOSITE' : role === 'definition' ? 'DEFINITION'
      : polarity === 'forbidden' ? 'NEG' : row.classification === 'boundary' ? 'OUT'
        : role === 'acceptance' || row.classification === 'evidence' ? 'ACCEPTANCE' : 'MUST';
  const id = String(row.id);
  return { obligationId: id, kind, text: String(row.exactText),
    ...(role === 'action' ? { oracle: String(row.requiredOutcome) } : {}),
    sourceRefs: unique([id, ...strings(row.specSpanRefs), ...strings(row.provenanceRefs)]),
    atomRefs: role === 'action' ? [`${id}-A1`] : [], evidenceClaimRefs: strings(row.evidenceClaimRefs),
    normativeStrength: strength, polarity, executionRole: role,
    ...(row.taskExecution ? { taskExecution: structuredClone(row.taskExecution) } : {}),
    conditions: structuredClone(row.conditions), applicability: structuredClone(row.applicability),
    ...(Array.isArray(row.clauseRefs) ? { clauseRefs: unique(strings(row.clauseRefs)) } : {}),
    ...(Array.isArray(row.typedRefs) ? { typedRefs: structuredClone(row.typedRefs) } : {}),
    ...(Array.isArray(row.normativeClauses) ? { normativeClauses: structuredClone(row.normativeClauses) } : {}),
  };
}

export function validateTypedObligationSources(obligations: GoalExecutionObligation[]): void {
  const known = new Set(obligations.map((row) => row.obligationId));
  const sourceRefs = new Set(obligations.flatMap((row) => row.sourceRefs));
  const boundSources = (value: unknown) => Array.isArray(value) && value.length > 0 &&
    strings(value).length === value.length && strings(value).every((ref) => sourceRefs.has(ref));
  for (const row of obligations) {
    if (row.taskExecution !== undefined) {
      const task = object(row.taskExecution);
      const owned = String(task.ownedProductionPaths ?? '').trim().replace(/^`([^`]+)`$/u, '$1');
      if (row.executionRole !== 'action' || !['executable_child', 'aggregate_only'].includes(String(task.executionClass)) ||
        !boundSources(task.sourceRefs) || (task.executionClass === 'aggregate_only' && (owned.toLowerCase() !== 'none' ||
          !['post_child_execution', 'final_aggregate'].includes(String(task.aggregateGatePhase)) || !strings(task.aggregateValidationCommands).length))) {
        throw new Error('standalone_goal_task_execution_invalid');
      }
    }
    const applicability = object(row.applicability);
    if (!Array.isArray(row.conditions) || !boundSources(applicability.sourceRefs) ||
      !['global', 'obligations', 'source_scope'].includes(String(applicability.scope)) ||
      (applicability.scope === 'source_scope' && (!object(applicability.sourceScope).kind ||
        !Array.isArray(object(applicability.sourceScope).ownerBlockRefs) ||
        strings(object(applicability.sourceScope).ownerBlockRefs).some((ref) => !sourceRefs.has(ref)))) ||
      (applicability.scope === 'obligations' && (!Array.isArray(applicability.obligationRefs) ||
        !applicability.obligationRefs.length || strings(applicability.obligationRefs).some((ref) => !known.has(ref)))) ||
      row.conditions.some((value) => { const condition = object(value);
        return typeof condition.text !== 'string' || !condition.text.trim() || condition.state !== 'unevaluated' || !boundSources(condition.sourceRefs);
      })) throw new Error('standalone_goal_normative_source_binding_invalid');
  }
}
