import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';
import { validateTypedObligationSources } from './standalone-goal-normative-roles';
import { validateStandaloneExecutionDeclarations } from './standalone-goal-constraint-bindings';
import {
  REQUIREMENTS_TYPED_SEMANTIC_VERSION,
  assertRequirementsTypedProjection,
  requirementsTypedConstraintMetadata,
  validateRequirementsTypedGoalIr,
} from './goal-requirements-typed-bridge';

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
  | 'EDGE'
  | 'GUIDANCE'
  | 'PERMISSION'
  | 'COMPOSITE'
  | 'DEFINITION';

export interface GoalExecutionObligation extends JsonObject {
  obligationId: string;
  kind: GoalObligationKind;
  text: string;
  oracle?: string;
  sourceRefs: string[];
  atomRefs: string[];
  evidenceClaimRefs: string[];
}

export interface GoalExecutionIR extends JsonObject {
  schemaVersion: 'GoalExecutionIR/v1' | 'GoalExecutionIR/v2';
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

function typedProfile(source: JsonObject): GoalExecutionProfile | null {
  if (source.schemaVersion === 'StandaloneGoalSemanticIR/v2') return 'standalone';
  if (source.schemaVersion === REQUIREMENTS_TYPED_SEMANTIC_VERSION) return 'requirements_backed';
  if (['typedSourceAuthority', 'typedSourceGraphHash', 'typedAtoms', 'typedExecutionConstraints'].some((field) => source[field] !== undefined) || (source.schemaVersion !== undefined &&
    !['StandaloneGoalSemanticIR/v1', 'requirements-contract-semantic-ir/v1'].includes(String(source.schemaVersion)))) {
    throw new Error('goal_execution_typed_version_invalid');
  }
  return null;
}

function dependencyDagIsValid(taskIds: string[], dependencies: JsonObject[]): boolean {
  const known = new Set(taskIds);
  const edges = new Map(taskIds.map((taskId) => [taskId, [] as string[]]));
  for (const dependency of dependencies) {
    const from = text(dependency.from);
    const to = text(dependency.to);
    if (!known.has(from) || !known.has(to) || from === to) return false;
    edges.get(from)!.push(to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (taskId: string): boolean => {
    if (visiting.has(taskId)) return false;
    if (visited.has(taskId)) return true;
    visiting.add(taskId);
    for (const dependency of edges.get(taskId) ?? []) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return true;
  };
  return taskIds.every(visit);
}

function taskRows(input: GoalExecutionCompilerInput, obligations: GoalExecutionObligation[]) {
  const sourceProfile = typedProfile(input.semanticSource);
  const typed = sourceProfile !== null;
  const obligationById = new Map(
    obligations.map((obligation) => [obligation.obligationId, obligation])
  );
  const atomRows = input.atoms
    .map((atom) => ({ ...atom }))
    .sort((left, right) =>
      (text(left.atomId) || text(left.id)).localeCompare(text(right.atomId) || text(right.id))
    );
  const atomUnits = atomRows.map((atom) => ({
    unitId: text(atom.atomId) || text(atom.id),
    obligationId: text(atom.coverageSeed) || text(atom.requirementRef),
    action: text(atom.action) || text(atom.text),
    oracle: sourceProfile === 'requirements_backed' && typeof atom.oracle === 'string' ? atom.oracle : text(atom.oracle),
    dependencyAtomRefs: sortedUnique(strings(atom.dependencies)),
  }));
  const coveredObligationIds = new Set(atomUnits.map((unit) => unit.obligationId));
  const fallbackUnits = obligations
    .filter((obligation) => !typed && !coveredObligationIds.has(obligation.obligationId))
    .map((obligation) => ({
      unitId: `${obligation.obligationId}-A1`,
      obligationId: obligation.obligationId,
      action: obligation.text,
      oracle: obligation.oracle,
      dependencyAtomRefs: [],
    }));
  const units = [...atomUnits, ...fallbackUnits];
  if (typed && (obligations.some((obligation) => obligation.executionRole === 'action' && !coveredObligationIds.has(obligation.obligationId)) ||
    units.some((unit) => obligationById.get(unit.obligationId)?.executionRole !== 'action'))) {
    throw new Error('goal_execution_action_membership_invalid');
  }
  const structureBasisRefs = constraintsOfKind(input, 'CTM').map((row) => text(row.constraintId));
  if (structureBasisRefs.length === 0 && input.profile === 'requirements_backed' && !typed) {
    throw new Error('architecture_successor_required:goal_task_decomposition');
  }
  const tasks = units.map((unit, index) => {
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
      ...(typed && obligation.taskExecution ? { taskExecution: structuredClone(obligation.taskExecution) } : {}),
    };
  });
  const taskIdByAtomRef = new Map(
    tasks.flatMap((task) => task.atomRefs.map((atomRef) => [atomRef, task.taskId] as const))
  );
  const dependencies: JsonObject[] = units
    .flatMap((unit, index) =>
      unit.dependencyAtomRefs.map((dependencyAtomRef) => {
        const dependsOnTaskId = taskIdByAtomRef.get(dependencyAtomRef);
        if (!dependsOnTaskId) {
          throw new Error('requirements_successor_required:goal_task_membership');
        }
        return {
          from: tasks[index].taskId,
          to: dependsOnTaskId,
          basisRefs: sortedUnique([dependencyAtomRef, unit.unitId]),
        };
      })
    )
    .filter((dependency, index, rows) => {
      const key = `${dependency.from}:${dependency.to}`;
      return rows.findIndex((row) => `${row.from}:${row.to}` === key) === index;
    })
    .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
  for (const dependency of aggregatePhaseDependencies(tasks)) {
    if (!dependencies.some((row) => row.from === dependency.from && row.to === dependency.to)) dependencies.push(dependency);
  }
  dependencies.sort((left, right) => text(left.from).localeCompare(text(right.from)) || text(left.to).localeCompare(text(right.to)));
  if (
    !dependencyDagIsValid(
      tasks.map((task) => task.taskId),
      dependencies
    )
  ) {
    throw new Error('requirements_successor_required:goal_task_dependency_dag');
  }
  return { tasks, dependencies };
}

function aggregatePhaseDependencies(tasks: JsonObject[]): JsonObject[] {
  return tasks.flatMap((task) => {
    const execution = object(task.taskExecution);
    if (execution.executionClass !== 'aggregate_only') return [];
    return tasks.filter((prerequisite) => prerequisite !== task &&
      (object(prerequisite.taskExecution).executionClass !== 'aggregate_only' ||
        (execution.aggregateGatePhase === 'final_aggregate' && object(prerequisite.taskExecution).aggregateGatePhase === 'post_child_execution')))
      .map((prerequisite) => ({ from: task.taskId, to: prerequisite.taskId, basisRefs: strings(execution.sourceRefs),
        derivationRuleId: 'explicit-aggregate-gate-phase/v1' }));
  });
}

function validateTaskExecutionProjection(ir: Partial<GoalExecutionIR>): void {
  const tasks = ir.atomicTasks ?? [];
  for (const obligation of ir.obligations ?? []) {
    const ownedTasks = tasks.filter((task) => strings(task.obligationRefs).includes(obligation.obligationId));
    if (ownedTasks.some((task) => sha256Stable(task.taskExecution ?? null) !== sha256Stable(obligation.taskExecution ?? null))) {
      throw new Error('goal_execution_task_execution_projection_invalid');
    }
    const execution = object(obligation.taskExecution);
    if (execution.executionClass !== 'aggregate_only') continue;
    const commandIds = new Set((ir.traceSlices ?? []).filter((trace) => strings(trace.obligationRefs).includes(obligation.obligationId)).flatMap((trace) => strings(trace.commandRefs)));
    const commands = new Set((ir.commands ?? []).filter((command) => commandIds.has(String(command.commandId)))
      .flatMap((command) => [String(command.commandId), ...strings(command.sourceDeclarationRefs)]));
    if (strings(execution.aggregateValidationCommands).some((ref) => !commands.has(ref)) ||
      (ir.executionDomains ?? []).flatMap((domain) => objects(domain.ownership)).some((owner) =>
        strings(owner.obligationRefs).includes(obligation.obligationId) || strings(owner.atomRefs).some((ref) => obligation.atomRefs.includes(ref)))) {
      throw new Error('goal_execution_aggregate_authority_invalid');
    }
  }
  if (aggregatePhaseDependencies(tasks).some((expected) => !(ir.dependencies ?? []).some((row) => row.from === expected.from && row.to === expected.to))) {
    throw new Error('goal_execution_aggregate_phase_invalid');
  }
}

function withoutHash(ir: GoalExecutionIR): Omit<GoalExecutionIR, 'goalExecutionIRHash'> {
  const { goalExecutionIRHash: _hash, ...payload } = ir;
  return payload;
}

export function goalExecutionIRHash(ir: GoalExecutionIR): string {
  return sha256Stable(withoutHash(ir));
}

function typedPathRestrictionsValid(ir: Partial<GoalExecutionIR>): boolean {
  const restrictions = objects(object(ir.logicalScopes).pathRestrictions);
  const obligations = new Map((ir.obligations ?? []).map((row) => [row.obligationId, row]));
  const sources = new Set([...obligations.values()].flatMap((row) => row.sourceRefs));
  const ids = restrictions.map((row) => text(row.constraintId));
  if (new Set(ids).size !== ids.length) return false;
  if (JSON.stringify(sortedUnique(restrictions.map((row) => text(row.canonicalValue)))) !==
    JSON.stringify(strings(object(ir.logicalScopes).forbiddenPaths))) return false;
  return restrictions.every((row) => {
    const refs = strings(row.applicableMustRefs);
    if (!refs.length || refs.some((ref) => !obligations.has(ref)) ||
      [...strings(row.sourceRefs), ...strings(row.premiseRefs)].some((ref) => !sources.has(ref))) return false;
    const atoms = new Set(refs.flatMap((ref) => obligations.get(ref)!.atomRefs));
    if (strings(row.applicableAtomRefs).some((ref) => !atoms.has(ref))) return false;
    return row.scope !== 'global' || refs.every((ref) => object(obligations.get(ref)!.applicability).scope === 'global');
  });
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function standaloneAuthorityLineageValid(ir: Partial<GoalExecutionIR> | GoalExecutionCompilerInput): boolean {
  if (ir.profile !== 'standalone') return true;
  const lineage = object(ir.standaloneLineage);
  const technical = object(ir.technicalAuthority);
  const internalGateHash = text(lineage.internalSemanticGateHash);
  return SHA256_PATTERN.test(internalGateHash) &&
    text(technical.internalSemanticGateHash) === internalGateHash;
}

export function compileGoalExecutionIR(input: GoalExecutionCompilerInput): GoalExecutionIR {
  const sourceProfile = typedProfile(input.semanticSource);
  const typed = sourceProfile !== null;
  if (!['requirements_backed', 'standalone'].includes(input.profile)) {
    throw new Error('goal_execution_profile_invalid');
  }
  if ((input.profile === 'requirements_backed') !== Boolean(input.requirementsLineage)) {
    throw new Error('goal_execution_profile_lineage_invalid');
  }
  if ((input.profile === 'standalone') !== Boolean(input.standaloneLineage)) {
    throw new Error('goal_execution_profile_lineage_invalid');
  }
  if (!standaloneAuthorityLineageValid(input)) {
    throw new Error('goal_execution_standalone_authority_lineage_invalid');
  }
  if (typed && input.profile !== sourceProfile) throw new Error('goal_execution_profile_lineage_invalid');
  if (!typed && input.obligations.some((row) => row.executionRole !== undefined || row.typedSourceNode !== undefined)) {
    throw new Error('goal_execution_typed_version_invalid');
  }
  const obligations: GoalExecutionObligation[] = [...input.obligations]
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
  if (sourceProfile === 'standalone') validateTypedObligationSources(obligations);
  if (sourceProfile === 'requirements_backed') assertRequirementsTypedProjection({ ...input, obligations });
  const { tasks, dependencies } = taskRows(input, obligations);
  const taskByObligation = new Map<string, string[]>();
  for (const task of tasks) {
    for (const obligationRef of task.obligationRefs) {
      taskByObligation.set(obligationRef, [
        ...(taskByObligation.get(obligationRef) ?? []),
        task.taskId,
      ]);
    }
  }
  const commands = constraintsOfKind(input, 'CMD')
    .filter((constraint) => sourceProfile !== 'standalone' || constraint.coverageRole !== 'non_action_declaration')
    .filter((constraint) => sourceProfile !== 'requirements_backed' || constraint.modality === undefined || constraint.modality === 'required')
    .map((constraint) => ({
    ...(sourceProfile === 'requirements_backed' ? requirementsTypedConstraintMetadata(constraint) : {}),
    commandId: text(constraint.constraintId),
    invocation: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    atomRefs: sortedUnique(strings(constraint.applicableAtomRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const targetConstraints = constraintsOfKind(input, 'PATH');
  const stopConstraints = constraintsOfKind(input, 'STOP');
  const stopConditions = sourceProfile === 'requirements_backed' ? stopConstraints.filter((row) => typeof row.scope === 'object') : [];
  const pathRestrictions = stopConstraints.filter((row) => !stopConditions.includes(row));
  const evidenceContracts = constraintsOfKind(input, 'EVDREQ')
    .filter((constraint) => sourceProfile !== 'standalone' || constraint.coverageRole !== 'non_action_declaration').map((constraint) => ({
    ...(sourceProfile === 'requirements_backed' ? requirementsTypedConstraintMetadata(constraint) : {}),
    evidenceContractId: text(constraint.constraintId),
    requirement: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    atomRefs: sortedUnique(strings(constraint.applicableAtomRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const artifacts = constraintsOfKind(input, 'ART').map((constraint) => ({
    ...(sourceProfile === 'requirements_backed' ? { ...requirementsTypedConstraintMetadata(constraint),
      atomRefs: sortedUnique(strings(constraint.applicableAtomRefs)) } : {}),
    artifactId: text(constraint.constraintId),
    logicalPath: text(constraint.canonicalValue),
    obligationRefs: sortedUnique(strings(constraint.applicableMustRefs)),
    basisRefs: sortedUnique([text(constraint.constraintId), ...strings(constraint.premiseRefs)]),
  }));
  const architecture = object(input.architecture);
  const isolation = object(architecture.isolation);
  const ownership = objects(architecture.ownership);
  const decisions = objects(architecture.architectureDecisions);
  const architectureLogicalScope = object(architecture.logicalScope);
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
          ...(typed ? { obligationRefs: sortedUnique(strings(row.obligationRefs)),
            atomRefs: sortedUnique(strings(row.atomRefs)), sourceRefs: sortedUnique(strings(row.sourceRefs)) } : {}),
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
  const traceSlices = obligations.filter((obligation) => !typed || obligation.executionRole === 'action').map((obligation, index) => {
    const traceTasks = tasks.filter((task) =>
      task.obligationRefs.includes(obligation.obligationId)
    );
    const traceAtomRefs = new Set(traceTasks.flatMap((task) => task.atomRefs));
    return {
      traceSliceId: `TRACE-${String(index + 1).padStart(3, '0')}`,
      executionDomainRef: 'DOMAIN-001',
      obligationRefs: [obligation.obligationId],
      taskRefs: sortedUnique(taskByObligation.get(obligation.obligationId) ?? []),
      commandRefs: commands
        .filter(
          (command) =>
            command.obligationRefs.includes(obligation.obligationId) ||
            command.atomRefs.some((atomRef) => traceAtomRefs.has(atomRef))
        )
        .map((command) => command.commandId),
      evidenceContractRefs: evidenceContracts
        .filter(
          (contract) =>
            contract.obligationRefs.includes(obligation.obligationId) ||
            contract.atomRefs.some((atomRef) => traceAtomRefs.has(atomRef))
        )
        .map((contract) => contract.evidenceContractId),
      basisRefs: sortedUnique([obligation.obligationId, ...obligation.sourceRefs]),
    };
  });
  const coExecutionConstraints = constraintsOfKind(input, 'CTM').map((constraint) => ({
    ...(sourceProfile === 'requirements_backed' ? requirementsTypedConstraintMetadata(constraint) : {}),
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
    schemaVersion: typed ? 'GoalExecutionIR/v2' as const : 'GoalExecutionIR/v1' as const,
    profile: input.profile,
    goalId: `GOAL-${goalIdentity.toUpperCase()}`,
    semanticSource: { ...input.semanticSource, ...(sourceProfile === 'standalone' && input.executionConstraints.some((row) => row.coverageRole !== undefined)
      ? { typedExecutionConstraints: structuredClone(input.executionConstraints), typedExecutionConstraintsHash: sha256Stable(input.executionConstraints) } : {}) },
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
    dependencies,
    logicalScopes: {
      ownedPaths: sortedUnique(targetConstraints.map((row) => text(row.canonicalValue))),
      forbiddenPaths: typed ? sortedUnique(pathRestrictions.map((row) => text(row.canonicalValue))) : sortedUnique([
        ...strings(architectureLogicalScope.forbiddenPaths),
        ...strings(isolation.forbiddenPaths),
      ]),
      ...(typed ? { pathRestrictions: structuredClone(pathRestrictions) } : {}),
      ...(stopConditions.length ? { stopConditions: structuredClone(stopConditions) } : {}),
    },
    commands,
    evidenceContracts,
    artifacts,
    coExecutionConstraints,
    goalExecutionIRHash: '',
  } satisfies GoalExecutionIR;
  const compiled = Object.freeze({ ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) });
  if (sourceProfile === 'standalone') validateStandaloneExecutionDeclarations(compiled);
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
  if (!['GoalExecutionIR/v1', 'GoalExecutionIR/v2'].includes(String(ir.schemaVersion))) issues.push('goal_execution_ir_schema_invalid');
  if (ir.schemaVersion === 'GoalExecutionIR/v2' && Array.isArray(ir.obligations)) {
    try {
      const profile = typedProfile(object(ir.semanticSource));
      if (profile !== ir.profile) throw new Error('profile_mismatch');
      if (profile === 'requirements_backed') validateRequirementsTypedGoalIr(ir as JsonObject);
      else {
        validateTypedObligationSources(ir.obligations);
        validateStandaloneExecutionDeclarations(ir as JsonObject);
      }
      validateTaskExecutionProjection(ir);
    } catch { issues.push('goal_execution_normative_source_binding_invalid'); }
    if (!typedPathRestrictionsValid(ir)) issues.push('goal_execution_path_restriction_binding_invalid');
  }
  if (ir.schemaVersion === 'GoalExecutionIR/v1') {
    try { if (typedProfile(object(ir.semanticSource)) || (ir.obligations ?? []).some((row) => row.executionRole !== undefined || row.typedSourceNode !== undefined)) issues.push('goal_execution_typed_version_invalid'); }
    catch { issues.push('goal_execution_typed_version_invalid'); }
  }
  if (!['requirements_backed', 'standalone'].includes(String(ir.profile)))
    issues.push('goal_execution_ir_profile_invalid');
  if (!standaloneAuthorityLineageValid(ir))
    issues.push('goal_execution_standalone_authority_lineage_invalid');
  if (!Array.isArray(ir.obligations) || ir.obligations.length === 0)
    issues.push('goal_execution_ir_obligations_missing');
  if (!Array.isArray(ir.atomicTasks) || ir.atomicTasks.length === 0)
    issues.push('goal_execution_ir_tasks_missing');
  if (!Array.isArray(ir.executionDomains) || ir.executionDomains.length === 0)
    issues.push('goal_execution_ir_domains_missing');
  if (!Array.isArray(ir.traceSlices) || ir.traceSlices.length === 0)
    issues.push('goal_execution_ir_traces_missing');
  if (
    Array.isArray(ir.atomicTasks) &&
    Array.isArray(ir.dependencies) &&
    !dependencyDagIsValid(
      ir.atomicTasks.map((task) => text(task.taskId)),
      ir.dependencies
    )
  ) {
    issues.push('goal_execution_dependency_dag_invalid');
  }
  if (
    !ir.goalExecutionIRHash ||
    goalExecutionIRHash(ir as GoalExecutionIR) !== ir.goalExecutionIRHash
  ) {
    issues.push('goal_execution_ir_hash_mismatch');
  }
  return { decision: issues.length === 0 ? 'pass' : 'block', issueCodes: sortedUnique(issues) };
}
