import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';

type JsonObject = Record<string, unknown>;

export type GoalExecutionProfile = 'requirements_backed' | 'standalone';
export type GoalObligationKind =
  | 'MUST'
  | 'NEG'
  | 'OUT'
  | 'FR'
  | 'NFR'
  | 'ACCEPTANCE'
  | 'FAILURE'
  | 'EDGE';

export interface GoalExecutionObligation extends JsonObject {
  obligationId: string;
  kind: GoalObligationKind;
  text: string;
  oracle: string;
  sourceRefs: string[];
  atomRefs: string[];
  evidenceClaimRefs: string[];
}

export interface GoalExecutionIR extends JsonObject {
  schemaVersion: 'GoalExecutionIR/v1';
  profile: GoalExecutionProfile;
  goalId: string;
  semanticSource: JsonObject;
  requirementsLineage?: JsonObject;
  standaloneLineage?: JsonObject;
  technicalAuthority: JsonObject;
  obligations: GoalExecutionObligation[];
  aliases: Array<{ aliasId: string; obligationId: string; sourceRefs: string[] }>;
  logicalSpecSpans: JsonObject[];
  executionDomains: JsonObject[];
  traceSlices: JsonObject[];
  atomicTasks: JsonObject[];
  dependencies: JsonObject[];
  logicalScopes: JsonObject;
  commands: JsonObject[];
  evidenceContracts: JsonObject[];
  artifacts: JsonObject[];
  coExecutionConstraints: JsonObject[];
  goalExecutionIRHash: string;
}

export interface GoalExecutionCompilerInput {
  profile: GoalExecutionProfile;
  semanticSource: JsonObject;
  requirementsLineage?: JsonObject;
  standaloneLineage?: JsonObject;
  technicalAuthority: JsonObject;
  obligations: GoalExecutionObligation[];
  atoms: JsonObject[];
  logicalSpecSpans: JsonObject[];
  executionConstraints: JsonObject[];
  architecture: JsonObject;
  readiness?: JsonObject;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function sortedObjects(values: JsonObject[], idField: string): JsonObject[] {
  return values
    .map((value) => ({ ...value }))
    .sort((left, right) => text(left[idField]).localeCompare(text(right[idField])));
}

function constraintsOfKind(input: GoalExecutionCompilerInput, kind: string): JsonObject[] {
  return sortedObjects(
    input.executionConstraints.filter((constraint) => text(constraint.kind) === kind),
    'constraintId'
  );
}

function taskRows(input: GoalExecutionCompilerInput, obligations: GoalExecutionObligation[]) {
  const obligationById = new Map(
    obligations.map((obligation) => [obligation.obligationId, obligation])
  );
  const atomRows = sortedObjects(input.atoms, 'id');
  const atomUnits = atomRows.map((atom) => ({
    unitId: text(atom.id),
    obligationId: text(atom.requirementRef),
    action: text(atom.action) || text(atom.text),
    oracle: text(atom.oracle),
  }));
  const coveredObligationIds = new Set(atomUnits.map((unit) => unit.obligationId));
  const fallbackUnits = obligations
    .filter((obligation) => !coveredObligationIds.has(obligation.obligationId))
    .map((obligation) => ({
      unitId: `${obligation.obligationId}-A1`,
      obligationId: obligation.obligationId,
      action: obligation.text,
      oracle: obligation.oracle,
    }));
  const units = [...atomUnits, ...fallbackUnits];
  const structureBasisRefs = constraintsOfKind(input, 'CTM').map((row) => text(row.constraintId));
  if (structureBasisRefs.length === 0) {
    throw new Error('architecture_successor_required:goal_task_decomposition');
  }
  return units.map((unit, index) => {
    const obligation = obligationById.get(unit.obligationId);
    if (!unit.unitId || !obligation) {
      throw new Error('requirements_successor_required:goal_task_membership');
    }
    return {
      taskId: `TASK-${String(index + 1).padStart(3, '0')}`,
      title: unit.action || obligation.text,
      obligationRefs: [unit.obligationId],
      atomRefs: [unit.unitId],
      expectedEffortMinutes: 150,
      upperBoundEffortMinutes: 180,
      effortBasisRefs: sortedUnique([
        'POLICY-goal-atomic-effort-v1',
        unit.unitId,
        ...structureBasisRefs,
      ]),
      oracle: unit.oracle || obligation.oracle,
    };
  });
}

function withoutHash(ir: GoalExecutionIR): Omit<GoalExecutionIR, 'goalExecutionIRHash'> {
  const { goalExecutionIRHash: _hash, ...payload } = ir;
  return payload;
}

export function goalExecutionIRHash(ir: GoalExecutionIR): string {
  return sha256Stable(withoutHash(ir));
}

export function compileGoalExecutionIR(input: GoalExecutionCompilerInput): GoalExecutionIR {
  if (!['requirements_backed', 'standalone'].includes(input.profile)) {
    throw new Error('goal_execution_profile_invalid');
  }
  if ((input.profile === 'requirements_backed') !== Boolean(input.requirementsLineage)) {
    throw new Error('goal_execution_profile_lineage_invalid');
  }
  if ((input.profile === 'standalone') !== Boolean(input.standaloneLineage)) {
    throw new Error('goal_execution_profile_lineage_invalid');
  }
  const obligations = [...input.obligations]
    .map((obligation) => ({
      ...obligation,
      sourceRefs: sortedUnique(obligation.sourceRefs),
      atomRefs: sortedUnique(obligation.atomRefs),
      evidenceClaimRefs: sortedUnique(obligation.evidenceClaimRefs),
    }))
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  if (
    obligations.length === 0 ||
    new Set(obligations.map((row) => row.obligationId)).size !== obligations.length
  ) {
    throw new Error('goal_execution_obligation_set_invalid');
  }
  const tasks = taskRows(input, obligations);
  const taskByObligation = new Map<string, string[]>();
  for (const task of tasks) {
    for (const obligationRef of task.obligationRefs) {
      taskByObligation.set(obligationRef, [
        ...(taskByObligation.get(obligationRef) ?? []),
        task.taskId,
      ]);
    }
  }
  const commands = constraintsOfKind(input, 'CMD').map((constraint) => ({
    commandId: text(constraint.constraintId),
    invocation: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    atomRefs: sortedUnique(strings(constraint.applicableAtomRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const targetConstraints = constraintsOfKind(input, 'PATH');
  const forbiddenConstraints = constraintsOfKind(input, 'STOP');
  const evidenceContracts = constraintsOfKind(input, 'EVDREQ').map((constraint) => ({
    evidenceContractId: text(constraint.constraintId),
    requirement: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const artifacts = constraintsOfKind(input, 'ART').map((constraint) => ({
    artifactId: text(constraint.constraintId),
    logicalPath: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const architecture = object(input.architecture);
  const isolation = object(architecture.isolation);
  const ownership = objects(architecture.ownership);
  const decisions = objects(architecture.architectureDecisions);
  const domainBasisRefs = sortedUnique([
    ...decisions.map((decision) => text(decision.decisionId)),
    ...commands.flatMap((command) => command.basisRefs),
    ...targetConstraints.map((constraint) => text(constraint.constraintId)),
  ]);
  if (!text(isolation.mode) || ownership.length === 0 || commands.length === 0) {
    throw new Error('architecture_successor_required:goal_execution_domain');
  }
  const executionDomains = [
    {
      executionDomainId: 'DOMAIN-001',
      isolationMode: text(isolation.mode),
      ownership: ownership
        .map((row) => ({
          targetPath: text(row.targetPath),
          owner: text(row.owner),
          basisRefs: sortedUnique(strings(row.basisRefs)),
        }))
        .sort(
          (left, right) =>
            left.targetPath.localeCompare(right.targetPath) || left.owner.localeCompare(right.owner)
        ),
      commandRefs: commands.map((command) => command.commandId),
      logicalTargetPaths: targetConstraints.map((constraint) => text(constraint.canonicalValue)),
      basisRefs: domainBasisRefs,
    },
  ];
  const traceSlices = obligations.map((obligation, index) => ({
    traceSliceId: `TRACE-${String(index + 1).padStart(3, '0')}`,
    executionDomainRef: 'DOMAIN-001',
    obligationRefs: [obligation.obligationId],
    taskRefs: sortedUnique(taskByObligation.get(obligation.obligationId) ?? []),
    commandRefs: commands
      .filter((command) => command.obligationRefs.includes(obligation.obligationId))
      .map((command) => command.commandId),
    evidenceContractRefs: evidenceContracts
      .filter((contract) => contract.obligationRefs.includes(obligation.obligationId))
      .map((contract) => contract.evidenceContractId),
    basisRefs: sortedUnique([obligation.obligationId, ...obligation.sourceRefs]),
  }));
  const coExecutionConstraints = constraintsOfKind(input, 'CTM').map((constraint) => ({
    constraintId: text(constraint.constraintId),
    kind: 'must_link',
    taskRefs: tasks
      .filter((task) =>
        strings(constraint.applicableAtomRefs).some((ref) => task.atomRefs.includes(ref))
      )
      .map((task) => task.taskId),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const goalIdentity = sha256Stable({
    profile: input.profile,
    semanticSource: input.semanticSource,
    technicalAuthority: input.technicalAuthority,
  }).slice('sha256:'.length, 'sha256:'.length + 16);
  const draft = {
    schemaVersion: 'GoalExecutionIR/v1' as const,
    profile: input.profile,
    goalId: `GOAL-${goalIdentity.toUpperCase()}`,
    semanticSource: input.semanticSource,
    ...(input.requirementsLineage ? { requirementsLineage: input.requirementsLineage } : {}),
    ...(input.standaloneLineage ? { standaloneLineage: input.standaloneLineage } : {}),
    technicalAuthority: input.technicalAuthority,
    obligations,
    aliases: obligations.map((obligation) => ({
      aliasId: `${input.profile}:${obligation.obligationId}`,
      obligationId: obligation.obligationId,
      sourceRefs: obligation.sourceRefs,
    })),
    logicalSpecSpans: sortedObjects(input.logicalSpecSpans, 'specSpanId'),
    executionDomains,
    traceSlices,
    atomicTasks: tasks,
    dependencies: [],
    logicalScopes: {
      ownedPaths: sortedUnique(targetConstraints.map((row) => text(row.canonicalValue))),
      forbiddenPaths: sortedUnique(forbiddenConstraints.map((row) => text(row.canonicalValue))),
    },
    commands,
    evidenceContracts,
    artifacts,
    coExecutionConstraints,
    goalExecutionIRHash: '',
  } satisfies GoalExecutionIR;
  const compiled = Object.freeze({ ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) });
  validateGoalContractSchema('goal-execution-ir.schema.json', compiled);
  return compiled;
}

export function validateGoalExecutionIR(value: unknown): {
  decision: 'pass' | 'block';
  issueCodes: string[];
} {
  const issues: string[] = [];
  const ir = object(value) as Partial<GoalExecutionIR>;
  try {
    validateGoalContractSchema('goal-execution-ir.schema.json', value);
  } catch {
    issues.push('goal_execution_ir_schema_invalid');
  }
  if (ir.schemaVersion !== 'GoalExecutionIR/v1') issues.push('goal_execution_ir_schema_invalid');
  if (!['requirements_backed', 'standalone'].includes(String(ir.profile)))
    issues.push('goal_execution_ir_profile_invalid');
  if (!Array.isArray(ir.obligations) || ir.obligations.length === 0)
    issues.push('goal_execution_ir_obligations_missing');
  if (!Array.isArray(ir.atomicTasks) || ir.atomicTasks.length === 0)
    issues.push('goal_execution_ir_tasks_missing');
  if (!Array.isArray(ir.executionDomains) || ir.executionDomains.length === 0)
    issues.push('goal_execution_ir_domains_missing');
  if (!Array.isArray(ir.traceSlices) || ir.traceSlices.length === 0)
    issues.push('goal_execution_ir_traces_missing');
  if (
    !ir.goalExecutionIRHash ||
    goalExecutionIRHash(ir as GoalExecutionIR) !== ir.goalExecutionIRHash
  ) {
    issues.push('goal_execution_ir_hash_mismatch');
  }
  return { decision: issues.length === 0 ? 'pass' : 'block', issueCodes: sortedUnique(issues) };
}
