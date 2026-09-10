import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';
import { validateTypedObligationSources } from './standalone-goal-normative-roles';
import {
  validateStandaloneDeclarationSpecSpans,
  validateStandaloneExecutionDeclarations,
} from './standalone-goal-constraint-bindings';
import {
  REQUIREMENTS_TYPED_SEMANTIC_VERSION,
  assertRequirementsTypedProjection,
  requirementsTypedConstraintMetadata,
  validateRequirementsTypedGoalIr,
} from './goal-requirements-typed-bridge';
import {
  canonicalRequirementGraphRef,
  lintCanonicalRequirementGraph,
  normalizeCanonicalRequirementGraph,
  type CanonicalRequirementGraphV2,
} from './canonical-requirement-graph';
import {
  resolveTypedSourceAuthority,
  type RequirementsTypedSourceAuthority,
} from '../../../main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import {
  resolveRequirementsSpecSpanSourceNodeIds,
  type RequirementsSpecSpan,
} from '../../../main-agent/source-authority/scripts/requirements-contract-span-registry';

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

export interface GoalExecutionLogicalSpecSpan extends JsonObject {
  specSpanId: string;
  boundObligationIds: string[];
  boundDeclarationIds?: string[];
  authorityClass?: string;
  normalizedClaimHash?: string;
  boundTypedSourceGraphHash?: string;
  originSpecSpanRef?: string;
  sourceArtifactId?: string;
  sourceSnapshotHash?: string;
  startByte?: number;
  endByteExclusive?: number;
  lineStart?: number;
  lineEnd?: number;
  exactTextHash?: string;
  canonicalNodeRefs?: string[];
  sourceDocumentGraphHash?: string;
  canonicalRequirementGraphHash?: string;
}

export interface GoalExecutionSourceLineage extends JsonObject {
  schemaVersion: 'GoalExecutionSourceLineage/v1';
  authorities: Array<{
    authorityKind: 'standalone_source_document' | 'requirements_semantic_ir';
    authorityId: string;
    authorityHash: string;
    sourceSnapshotHash?: string;
    sourceDocumentGraphHash?: string;
    canonicalRequirementGraphHash?: string;
    canonicalSemanticHash?: string;
    typedSourceGraphHash?: string;
    sourceBindingHash?: string;
    upstreamCanonicalRequirementGraphHash?: string;
    logicalSpecSpanRefs: string[];
  }>;
  logicalSpecSpanRefs: string[];
  logicalSpecSpanSetHash: string;
  lineageHash: string;
}

export interface GoalExecutionIR extends JsonObject {
  schemaVersion: 'GoalExecutionIR/v1' | 'GoalExecutionIR/v2' | 'GoalExecutionIR/v3';
  profile: GoalExecutionProfile;
  goalId: string;
  semanticSource: JsonObject;
  requirementsLineage?: JsonObject;
  standaloneLineage?: JsonObject;
  technicalAuthority: JsonObject;
  obligations: GoalExecutionObligation[];
  aliases: Array<{ aliasId: string; obligationId: string; sourceRefs: string[] }>;
  logicalSpecSpans: GoalExecutionLogicalSpecSpan[];
  sourceLineage?: GoalExecutionSourceLineage;
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
  sourceLineage?: GoalExecutionSourceLineage;
  executionConstraints: JsonObject[];
  architecture: JsonObject;
  readiness?: JsonObject;
  canonicalRequirementGraph?: JsonObject;
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

function traceReferenceIndex(rows: JsonObject[], idField: string): {
  byObligation: Map<string, Set<string>>;
  byAtom: Map<string, Set<string>>;
} {
  const byObligation = new Map<string, Set<string>>();
  const byAtom = new Map<string, Set<string>>();
  const add = (index: Map<string, Set<string>>, ref: string, value: string) => {
    const values = index.get(ref) ?? new Set<string>();
    values.add(value);
    index.set(ref, values);
  };
  for (const row of rows) {
    const value = text(row[idField]);
    for (const ref of strings(row.obligationRefs)) add(byObligation, ref, value);
    for (const ref of strings(row.atomRefs)) add(byAtom, ref, value);
  }
  return { byObligation, byAtom };
}

function indexedTraceRefs(
  index: ReturnType<typeof traceReferenceIndex>,
  obligationRef: string,
  atomRefs: string[]
): string[] {
  return sortedUnique([
    ...(index.byObligation.get(obligationRef) ?? []),
    ...atomRefs.flatMap((atomRef) => [...(index.byAtom.get(atomRef) ?? [])]),
  ]);
}

function constraintsOfKind(input: GoalExecutionCompilerInput, kind: string): JsonObject[] {
  return sortedObjects(
    input.executionConstraints.filter((constraint) => text(constraint.kind) === kind),
    'constraintId'
  );
}

function preflightGoalExecutionRelationGraph(input: GoalExecutionCompilerInput): void {
  if (input.profile === 'standalone') {
    validateStandaloneDeclarationSpecSpans(
      input.logicalSpecSpans,
      input.executionConstraints,
      text(object(input.standaloneLineage).sourceSnapshotHash),
      'goal_execution_declaration_span_invalid',
    );
  }
  const ownersBySourceRef = new Map<string, Set<string>>();
  const addOwner = (sourceRef: string, obligationRef: string) => {
    if (!sourceRef || !obligationRef) return;
    const owners = ownersBySourceRef.get(sourceRef) ?? new Set<string>();
    owners.add(obligationRef);
    ownersBySourceRef.set(sourceRef, owners);
  };
  for (const obligation of input.obligations) {
    for (const sourceRef of obligation.sourceRefs) addOwner(sourceRef, obligation.obligationId);
  }
  for (const span of input.logicalSpecSpans) {
    const sourceRef = text(span.specSpanId) || text(span.sourceSpanId);
    for (const obligationRef of [
      ...strings(span.boundObligationIds),
      ...strings(span.sourceObligationIds),
    ]) {
      addOwner(sourceRef, obligationRef);
    }
  }
  const atomOwners = new Map<string, string>();
  const obligationIds = new Set(input.obligations.map((obligation) => obligation.obligationId));
  for (const obligation of input.obligations) {
    for (const atomRef of obligation.atomRefs) atomOwners.set(atomRef, obligation.obligationId);
  }
  for (const atom of input.atoms) {
    const atomRef = text(atom.atomId) || text(atom.id);
    const obligationRef = text(atom.coverageSeed) || text(atom.requirementRef);
    if (atomRef && obligationRef) atomOwners.set(atomRef, obligationRef);
  }
  const canonicalNodes = new Map(
    objects(object(input.canonicalRequirementGraph).nodes).map((node) => [text(node.id), node])
  );
  for (const constraint of input.executionConstraints) {
    const scope = object(constraint.scope);
    const declarationNodes = strings(constraint.sourceDeclarationRefs)
      .map((ref) => canonicalNodes.get(ref))
      .filter((node): node is JsonObject => Boolean(node));
    const allowedOwners = new Set<string>();
    for (const sourceRef of [
      ...strings(constraint.sourceRefs),
      ...strings(constraint.premiseRefs),
      ...strings(constraint.applicableSourceRefs),
    ]) {
      for (const owner of ownersBySourceRef.get(sourceRef) ?? []) allowedOwners.add(owner);
    }
    for (const node of declarationNodes) {
      let ownerRef = text(node.ownerRef) || text(node.id);
      const visited = new Set<string>();
      while (ownerRef && !visited.has(ownerRef)) {
        visited.add(ownerRef);
        allowedOwners.add(ownerRef);
        ownerRef = text(canonicalNodes.get(ownerRef)?.ownerRef);
      }
    }
    const obligationRefs = strings(constraint.applicableMustRefs);
    const atomRefs = strings(constraint.applicableAtomRefs);
    if (
      obligationRefs.some((ref) => !obligationIds.has(ref)) ||
      atomRefs.some((ref) => !atomOwners.has(ref))
    ) {
      throw Object.assign(new Error('goal_execution_constraint_applicability_invalid'), {
        failureClass: 'goal_execution_constraint_applicability_invalid',
        constraintId: text(constraint.constraintId),
      });
    }
    if (allowedOwners.size === 0) {
      if (obligationRefs.length === 0 && atomRefs.length === 0) continue;
      const normalizedObligationRefs = sortedUnique(obligationRefs);
      const atomOwnerRefs = sortedUnique(atomRefs.map((ref) => atomOwners.get(ref) ?? ''));
      const exactLegacyAtomOwners =
        atomRefs.length > 0 &&
        atomOwnerRefs.length === normalizedObligationRefs.length &&
        atomOwnerRefs.every((ref, index) => ref === normalizedObligationRefs[index]);
      const legacyUntyped = typedProfile(input.semanticSource) === null;
      const legacySingleOwner = legacyUntyped && normalizedObligationRefs.length === 1 && exactLegacyAtomOwners;
      const legacyExplicitCoExecution = legacyUntyped && text(constraint.kind) === 'CTM' &&
        normalizedObligationRefs.length > 1 && exactLegacyAtomOwners;
      if (legacySingleOwner || legacyExplicitCoExecution) continue;
      throw Object.assign(new Error('goal_execution_constraint_semantic_owner_missing'), {
        failureClass: 'goal_execution_constraint_semantic_owner_missing',
        constraintId: text(constraint.constraintId),
      });
    }
    const explicitlyGlobal =
      constraint.scope === 'global' ||
      text(scope.kind) === 'global' ||
      text(scope.scope) === 'global' ||
      text(scope.bindingScope) === 'global' ||
      declarationNodes.some((node) => node.scope === 'global');
    if (explicitlyGlobal) continue;
    if (
      obligationRefs.some((ref) => !allowedOwners.has(ref)) ||
      atomRefs.some((ref) => !allowedOwners.has(atomOwners.get(ref) ?? ''))
    ) {
      throw Object.assign(new Error('goal_execution_constraint_applicability_invalid'), {
        failureClass: 'goal_execution_constraint_applicability_invalid',
        constraintId: text(constraint.constraintId),
      });
    }
  }
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
    const aggregateTaskIds = new Set(ownedTasks.map((task) => text(task.taskId)));
    const prerequisiteTaskIds = new Set(
      (ir.dependencies ?? [])
        .filter((dependency) => aggregateTaskIds.has(text(dependency.from)))
        .map((dependency) => text(dependency.to))
    );
    const commandIds = new Set(
      (ir.traceSlices ?? [])
        .filter((trace) =>
          strings(trace.obligationRefs).includes(obligation.obligationId) ||
          strings(trace.taskRefs).some((taskRef) => prerequisiteTaskIds.has(taskRef))
        )
        .flatMap((trace) => strings(trace.commandRefs))
    );
    const commands = new Set((ir.commands ?? []).filter((command) => commandIds.has(String(command.commandId)))
      .flatMap((command) => [String(command.commandId), ...strings(command.sourceDeclarationRefs)]));
    const missingCommandRefs = strings(execution.aggregateValidationCommands)
      .filter((ref) => !commands.has(ref));
    const invalidOwners = (ir.executionDomains ?? [])
      .flatMap((domain) => objects(domain.ownership))
      .filter((owner) =>
        strings(owner.obligationRefs).includes(obligation.obligationId) ||
        strings(owner.atomRefs).some((ref) => obligation.atomRefs.includes(ref))
      );
    if (missingCommandRefs.length > 0 || invalidOwners.length > 0) {
      throw Object.assign(new Error('goal_execution_aggregate_authority_invalid'), {
        obligationId: obligation.obligationId,
        reason: missingCommandRefs.length > 0
          ? 'aggregate_command_unbound'
          : 'aggregate_owns_execution_path',
        ...(missingCommandRefs.length > 0 ? { missingCommandRefs } : {}),
        ...(invalidOwners.length > 0
          ? { ownedPaths: sortedUnique(invalidOwners.map((owner) => text(owner.targetPath))) }
          : {}),
      });
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

function normalizeLogicalSpecSpan(value: JsonObject): GoalExecutionLogicalSpecSpan {
  const specSpanId = text(value.specSpanId) || text(value.sourceSpanId);
  const boundObligationIds = sortedUnique([
    ...strings(value.boundObligationIds),
    ...strings(value.sourceObligationIds),
  ]);
  const boundDeclarationIds = sortedUnique(strings(value.boundDeclarationIds));
  if (!specSpanId || (boundObligationIds.length === 0) === (boundDeclarationIds.length === 0)) {
    throw new Error('goal_execution_source_span_invalid');
  }
  const common = {
    ...value,
    specSpanId,
    boundObligationIds,
    ...(boundDeclarationIds.length ? { boundDeclarationIds } : {}),
    ...(strings(value.canonicalNodeRefs).length
      ? { canonicalNodeRefs: sortedUnique(strings(value.canonicalNodeRefs)) }
      : {}),
    ...(text(value.originSpecSpanRef)
      ? { originSpecSpanRef: text(value.originSpecSpanRef) }
      : {}),
  };
  const physical = value.sourceArtifactId !== undefined || value.startByte !== undefined;
  if (!physical) {
    const normalizedClaimHash = text(value.normalizedClaimHash);
    const boundTypedSourceGraphHash = text(value.boundTypedSourceGraphHash);
    if ((normalizedClaimHash && !SHA256_PATTERN.test(normalizedClaimHash)) ||
      (boundTypedSourceGraphHash && !SHA256_PATTERN.test(boundTypedSourceGraphHash))) {
      throw new Error('goal_execution_spec_span_invalid');
    }
    if (text(value.authorityClass) === 'derived' && !text(value.originSpecSpanRef)) {
      throw new Error('goal_execution_spec_span_invalid');
    }
    return {
      ...common,
      ...(text(value.authorityClass) ? { authorityClass: text(value.authorityClass) } : {}),
      ...(normalizedClaimHash ? { normalizedClaimHash } : {}),
      ...(boundTypedSourceGraphHash ? { boundTypedSourceGraphHash } : {}),
    };
  }
  const sourceArtifactId = text(value.sourceArtifactId);
  const sourceSnapshotHash = text(value.sourceSnapshotHash);
  const startByte = Number(value.startByte);
  const endByteExclusive = Number(value.endByteExclusive);
  const lineStart = Number(value.lineStart ?? value.startLine);
  const lineEnd = Number(value.lineEnd ?? value.endLine);
  const exactTextHash = text(value.exactTextHash);
  if (!sourceArtifactId || !SHA256_PATTERN.test(sourceSnapshotHash) ||
    !Number.isInteger(startByte) || startByte < 0 || !Number.isInteger(endByteExclusive) ||
    endByteExclusive <= startByte || !Number.isInteger(lineStart) || lineStart < 1 ||
    !Number.isInteger(lineEnd) || lineEnd < lineStart || !SHA256_PATTERN.test(exactTextHash)) {
    throw new Error('goal_execution_source_span_invalid');
  }
  return {
    ...common,
    sourceArtifactId,
    sourceSnapshotHash,
    startByte,
    endByteExclusive,
    lineStart,
    lineEnd,
    exactTextHash,
    ...(SHA256_PATTERN.test(text(value.sourceDocumentGraphHash))
      ? { sourceDocumentGraphHash: text(value.sourceDocumentGraphHash) }
      : {}),
    ...(SHA256_PATTERN.test(text(value.canonicalRequirementGraphHash))
      ? { canonicalRequirementGraphHash: text(value.canonicalRequirementGraphHash) }
      : {}),
  };
}

function sourceLineagePayload(lineage: GoalExecutionSourceLineage): Omit<GoalExecutionSourceLineage, 'lineageHash'> {
  const { lineageHash: _hash, ...payload } = lineage;
  return payload;
}

function buildSourceLineage(
  input: GoalExecutionCompilerInput,
  logicalSpecSpans: JsonObject[],
): { spans: GoalExecutionLogicalSpecSpan[]; lineage?: GoalExecutionSourceLineage } {
  const typed = typedProfile(input.semanticSource) !== null;
  if (!typed) return { spans: logicalSpecSpans as GoalExecutionLogicalSpecSpan[] };
  const canonicalNodeIds = new Set(objects(object(input.canonicalRequirementGraph).nodes)
    .map((node) => text(node.id))
    .filter(Boolean));
  const requirementsAuthority = object(input.semanticSource).typedSourceAuthority as unknown as RequirementsTypedSourceAuthority;
  const requirementsGraph = input.profile === 'requirements_backed'
    ? resolveTypedSourceAuthority(requirementsAuthority)
    : undefined;
  const spans = logicalSpecSpans.map((span) => {
    const resolvedCanonicalRefs = input.profile === 'requirements_backed'
      ? resolveRequirementsSpecSpanSourceNodeIds(
        span as unknown as RequirementsSpecSpan,
        requirementsAuthority,
        requirementsGraph
      ).filter((ref) => canonicalNodeIds.has(ref))
      : [];
    return normalizeLogicalSpecSpan({
      ...span,
      ...(resolvedCanonicalRefs.length > 0 || strings(span.canonicalNodeRefs).length > 0
        ? { canonicalNodeRefs: sortedUnique([
          ...strings(span.canonicalNodeRefs),
          ...resolvedCanonicalRefs,
        ]) }
        : {}),
    });
  })
    .sort((left, right) => left.specSpanId.localeCompare(right.specSpanId));
  if (new Set(spans.map((span) => span.specSpanId)).size !== spans.length) {
    throw new Error('goal_execution_source_span_duplicate');
  }
  const provided = input.sourceLineage;
  const semanticSource = object(input.semanticSource);
  const typedSourceGraphHash = text(semanticSource.typedSourceGraphHash);
  const canonicalRef = object(semanticSource.canonicalRequirementGraphRef);
  const canonicalRequirementGraphHash = text(canonicalRef.graphHash);
  const canonicalSemanticHash = text(canonicalRef.semanticHash);
  const upstreamCanonicalRequirementGraphHash = text(
    canonicalRef.upstreamCanonicalRequirementGraphHash
  );
  const sourceBindingHash = text(object(input.requirementsLineage).sourceBindingHash);
  const authorities = input.profile === 'requirements_backed'
    ? [{
      authorityKind: 'requirements_semantic_ir' as const,
      authorityId: text(semanticSource.semanticRevisionId),
      authorityHash: text(semanticSource.scopeSemanticHash),
      typedSourceGraphHash,
      canonicalRequirementGraphHash,
      canonicalSemanticHash,
      ...(sourceBindingHash ? { sourceBindingHash } : {}),
      ...(upstreamCanonicalRequirementGraphHash
        ? { upstreamCanonicalRequirementGraphHash }
        : {}),
      logicalSpecSpanRefs: spans.map((span) => span.specSpanId),
    }]
    : [...new Map(spans.map((span) => {
      const key = `${span.sourceArtifactId}:${span.sourceSnapshotHash}`;
       return [key, {
         authorityKind: 'standalone_source_document' as const,
         authorityId: text(span.sourceArtifactId),
         authorityHash: text(span.sourceSnapshotHash),
         sourceSnapshotHash: text(span.sourceSnapshotHash),
         ...(span.sourceDocumentGraphHash ? { sourceDocumentGraphHash: span.sourceDocumentGraphHash } : {}),
         ...(canonicalRequirementGraphHash
           ? { canonicalRequirementGraphHash, canonicalSemanticHash }
           : span.canonicalRequirementGraphHash
             ? { canonicalRequirementGraphHash: span.canonicalRequirementGraphHash }
             : {}),
         ...(upstreamCanonicalRequirementGraphHash
           ? { upstreamCanonicalRequirementGraphHash }
           : {}),
         logicalSpecSpanRefs: spans.filter((candidate) =>
          candidate.sourceArtifactId === span.sourceArtifactId && candidate.sourceSnapshotHash === span.sourceSnapshotHash
        ).map((candidate) => candidate.specSpanId),
      }];
    })).values()].sort((left, right) => `${left.authorityId}:${left.authorityHash}`.localeCompare(`${right.authorityId}:${right.authorityHash}`));
  if (authorities.some((authority) => !authority.authorityId || !SHA256_PATTERN.test(authority.authorityHash))) {
    throw new Error('goal_execution_source_lineage_invalid');
  }
  if (input.profile === 'requirements_backed' && (!SHA256_PATTERN.test(canonicalRequirementGraphHash) ||
    !SHA256_PATTERN.test(canonicalSemanticHash))) {
    throw new Error('goal_execution_canonical_requirement_graph_missing');
  }
  const lineageBase = {
    schemaVersion: 'GoalExecutionSourceLineage/v1' as const,
    authorities,
    logicalSpecSpanRefs: spans.map((span) => span.specSpanId),
    logicalSpecSpanSetHash: sha256Stable(spans),
  };
  const lineage = provided
    ? {
      ...lineageBase,
      ...provided,
      authorities: provided.authorities,
      logicalSpecSpanRefs: provided.logicalSpecSpanRefs,
      lineageHash: provided.lineageHash,
    }
    : { ...lineageBase, lineageHash: sha256Stable(lineageBase) };
  const lineageFailureReason = lineage.schemaVersion !== 'GoalExecutionSourceLineage/v1'
    ? 'schema_version'
    : !SHA256_PATTERN.test(lineage.lineageHash)
      ? 'lineage_hash_format'
      : sha256Stable(sourceLineagePayload(lineage)) !== lineage.lineageHash
        ? 'lineage_hash'
        : sha256Stable(lineage.logicalSpecSpanRefs) !== sha256Stable(spans.map((span) => span.specSpanId))
          ? 'logical_spec_span_refs'
          : sha256Stable(lineage.authorities) !== sha256Stable(authorities)
            ? 'authorities'
            : null;
  if (lineageFailureReason) {
    throw Object.assign(new Error('goal_execution_source_lineage_invalid'), {
      failureClass: 'goal_execution_source_lineage_invalid',
      reason: lineageFailureReason,
    });
  }
  return { spans, lineage };
}

function sourceLineageFailureReason(ir: Partial<GoalExecutionIR>): string | null {
  if (ir.schemaVersion !== 'GoalExecutionIR/v3') return null;
  const spans = objects(ir.logicalSpecSpans).map((span) => {
    try { return normalizeLogicalSpecSpan(span); } catch { return null; }
  });
  if (spans.some((span) => span === null) || spans.length === 0) return 'logical_spec_spans';
  const lineage = object(ir.sourceLineage) as Partial<GoalExecutionSourceLineage>;
  if (lineage.schemaVersion !== 'GoalExecutionSourceLineage/v1' || !SHA256_PATTERN.test(text(lineage.lineageHash))) return 'lineage_identity';
  if (sha256Stable(sourceLineagePayload(lineage as GoalExecutionSourceLineage)) !== lineage.lineageHash) return 'lineage_hash';
  const spanIds = new Set(spans.map((span) => span!.specSpanId));
  const resolvableRefs = new Set(spans.flatMap((span) => [
    span!.specSpanId,
    ...span!.boundObligationIds,
    ...strings(span!.boundDeclarationIds),
    ...strings(span!.canonicalNodeRefs),
  ]));
  if (sha256Stable(sortedUnique(strings(lineage.logicalSpecSpanRefs))) !== sha256Stable(sortedUnique([...spanIds]))) return 'logical_spec_span_refs';
  if (text(lineage.logicalSpecSpanSetHash) !== sha256Stable(spans)) return 'logical_spec_span_set_hash';
  const authorities = objects(lineage.authorities);
  if (authorities.length === 0 || authorities.some((authority) =>
    !['standalone_source_document', 'requirements_semantic_ir'].includes(text(authority.authorityKind)) ||
    !text(authority.authorityId) || !SHA256_PATTERN.test(text(authority.authorityHash)) ||
    strings(authority.logicalSpecSpanRefs).some((ref) => !spanIds.has(ref)))) return 'authority_identity';
  const authoritySpanIds = sortedUnique(authorities.flatMap((authority) => strings(authority.logicalSpecSpanRefs)));
  if (sha256Stable(authoritySpanIds) !== sha256Stable(sortedUnique([...spanIds]))) return 'authority_span_coverage';
  if (ir.profile === 'standalone' && spans.some((span) =>
    !authorities.some((authority) => authority.authorityKind === 'standalone_source_document' &&
      authority.authorityId === span!.sourceArtifactId && authority.authorityHash === span!.sourceSnapshotHash))) return 'standalone_authority_binding';
  if (ir.profile === 'requirements_backed') {
    const semantic = object(ir.semanticSource);
    const canonicalRef = object(semantic.canonicalRequirementGraphRef);
    const requirementsLineage = object(ir.requirementsLineage);
    if (!authorities.some((authority) => authority.authorityKind === 'requirements_semantic_ir' &&
      authority.authorityId === semantic.semanticRevisionId && authority.authorityHash === semantic.scopeSemanticHash &&
      authority.typedSourceGraphHash === semantic.typedSourceGraphHash &&
      authority.canonicalRequirementGraphHash === canonicalRef.graphHash &&
      authority.canonicalSemanticHash === canonicalRef.semanticHash &&
      (!requirementsLineage.sourceBindingHash ||
        authority.sourceBindingHash === requirementsLineage.sourceBindingHash) &&
       canonicalRef.typedSourceGraphHash === semantic.typedSourceGraphHash)) return 'requirements_authority_binding';
    try {
      const graph = resolveTypedSourceAuthority(
        semantic.typedSourceAuthority as unknown as RequirementsTypedSourceAuthority
      );
      for (const node of graph.sourceNodes) {
        resolvableRefs.add(node.sourceRootId);
        for (const ref of node.declaredIds) resolvableRefs.add(ref);
        for (const ref of [text(node.sourceBlockId), text(node.sourceClauseId)]) {
          if (ref) resolvableRefs.add(ref);
        }
      }
      for (const relation of graph.sourceRelations) resolvableRefs.add(relation.relationId);
      for (const collection of [
        graph.commandDeclarations,
        graph.workDeclarations,
        graph.scenarioDeclarations,
        graph.fixDeclarations,
      ]) {
        for (const declaration of collection) {
          const id = text(declaration.id);
          if (id) resolvableRefs.add(id);
        }
      }
    } catch {
      return 'requirements_typed_source_authority';
    }
  }
  if (ir.profile === 'standalone') {
    const canonicalRef = object(object(ir.semanticSource).canonicalRequirementGraphRef);
    if (Object.keys(canonicalRef).length > 0 && !authorities.some((authority) =>
      authority.authorityKind === 'standalone_source_document' &&
      authority.canonicalRequirementGraphHash === canonicalRef.graphHash &&
      authority.canonicalSemanticHash === canonicalRef.semanticHash)) return 'standalone_canonical_graph_binding';
  }
  for (const obligation of ir.obligations ?? []) {
    const refs = strings(obligation.sourceRefs);
    const unresolved = refs.filter((ref) => !resolvableRefs.has(ref));
    if (refs.length === 0 || unresolved.length > 0) {
      return `obligation_source_refs:${obligation.obligationId}:${unresolved.join(',')}`;
    }
  }
  const constraints = objects(object(ir.semanticSource).typedExecutionConstraints);
  const invalidConstraint = constraints.find((constraint) => {
    const referenceSets = [
      strings(constraint.sourceRefs),
      strings(constraint.applicableSourceRefs),
      strings(constraint.premiseRefs),
      strings(constraint.sourceDeclarationRefs),
    ];
    return !referenceSets.some((refs) => refs.length > 0) ||
      !referenceSets.every((refs) => refs.every((ref) => resolvableRefs.has(ref)));
  });
  return invalidConstraint ? `constraint_source_refs:${text(invalidConstraint.constraintId)}` : null;
}

function sourceLineageValid(ir: Partial<GoalExecutionIR>): boolean {
  return sourceLineageFailureReason(ir) === null;
}

function standaloneAuthorityLineageValid(ir: Partial<GoalExecutionIR> | GoalExecutionCompilerInput): boolean {
  if (ir.profile !== 'standalone') return true;
  const lineage = object(ir.standaloneLineage);
  const technical = object(ir.technicalAuthority);
  const internalGateHash = text(lineage.internalSemanticGateHash);
  return SHA256_PATTERN.test(internalGateHash) &&
    text(technical.internalSemanticGateHash) === internalGateHash;
}

function resolvedCanonicalGraph(input: GoalExecutionCompilerInput): CanonicalRequirementGraphV2 | null {
  const semanticSource = object(input.semanticSource);
  const provided = object(input.canonicalRequirementGraph);
  if (provided.schemaVersion === 'CanonicalRequirementGraph/v2') {
    const graph = provided as unknown as CanonicalRequirementGraphV2;
    const lint = lintCanonicalRequirementGraph(graph);
    if (lint.decision !== 'pass') throw new Error(`canonical_requirement_graph_${lint.issueCodes[0]}`);
    if (input.profile === 'requirements_backed' &&
      (graph.sourceAuthority.kind !== 'requirements_semantic_ir' ||
        graph.typedSourceGraphHash !== text(semanticSource.typedSourceGraphHash))) {
      throw new Error('canonical_requirement_graph_source_authority_mismatch');
    }
    return graph;
  }
  if (input.profile === 'standalone' && provided.schemaVersion === 'CanonicalRequirementGraph/v1') {
    const standalone = object(input.standaloneLineage);
    return normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'standalone_source_plan',
        schemaVersion: 'standalone-source-plan/v1',
        authorityId: text(provided.sourcePlanId),
        authorityHash: text(standalone.sourceSnapshotHash) || text(standalone.sourcePlanHash),
      },
      standaloneGraph: provided,
    });
  }
  if (input.profile === 'requirements_backed' &&
    semanticSource.schemaVersion === REQUIREMENTS_TYPED_SEMANTIC_VERSION) {
    return normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'requirements_semantic_ir',
        schemaVersion: REQUIREMENTS_TYPED_SEMANTIC_VERSION,
        authorityId: text(semanticSource.semanticRevisionId),
        authorityHash: text(semanticSource.scopeSemanticHash),
      },
      typedSourceAuthority: semanticSource.typedSourceAuthority as RequirementsTypedSourceAuthority,
      expectedTypedSourceGraphHash: text(semanticSource.typedSourceGraphHash),
    });
  }
  return null;
}

export function compileGoalExecutionIR(input: GoalExecutionCompilerInput): GoalExecutionIR {
  const canonicalGraph = resolvedCanonicalGraph(input);
  if (canonicalGraph) {
    const graphRef = canonicalRequirementGraphRef(canonicalGraph);
    const suppliedRef = object(input.semanticSource.canonicalRequirementGraphRef);
    if (Object.keys(suppliedRef).length > 0 && sha256Stable(suppliedRef) !== sha256Stable(graphRef)) {
      throw new Error('canonical_requirement_graph_ref_mismatch');
    }
    input = {
      ...input,
      canonicalRequirementGraph: canonicalGraph,
      semanticSource: { ...input.semanticSource, canonicalRequirementGraphRef: graphRef },
    };
  }
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
  preflightGoalExecutionRelationGraph(input);
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
  const sourceSpanResult = buildSourceLineage(input, input.logicalSpecSpans);
  const { tasks, dependencies } = taskRows(input, obligations);
  const taskByObligation = new Map<string, string[]>();
  const atomRefsByObligation = new Map<string, string[]>();
  for (const task of tasks) {
    for (const obligationRef of task.obligationRefs) {
      taskByObligation.set(obligationRef, [
        ...(taskByObligation.get(obligationRef) ?? []),
        task.taskId,
      ]);
      atomRefsByObligation.set(obligationRef, sortedUnique([
        ...(atomRefsByObligation.get(obligationRef) ?? []),
        ...task.atomRefs,
      ]));
    }
  }
  const commands = constraintsOfKind(input, 'CMD')
    .filter((constraint) => constraint.coverageRole !== 'non_action_declaration')
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
  const stopConditions = stopConstraints.filter((row) =>
    sourceProfile === 'requirements_backed'
      ? typeof row.scope === 'object'
      : row.declarationRole === 'stop_condition'
  );
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
  const commandTraceIndex = traceReferenceIndex(commands, 'commandId');
  const evidenceTraceIndex = traceReferenceIndex(evidenceContracts, 'evidenceContractId');
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
    const traceAtomRefs = atomRefsByObligation.get(obligation.obligationId) ?? [];
    return {
      traceSliceId: `TRACE-${String(index + 1).padStart(3, '0')}`,
      executionDomainRef: 'DOMAIN-001',
      obligationRefs: [obligation.obligationId],
      taskRefs: sortedUnique(taskByObligation.get(obligation.obligationId) ?? []),
      commandRefs: indexedTraceRefs(
        commandTraceIndex,
        obligation.obligationId,
        traceAtomRefs
      ),
      evidenceContractRefs: indexedTraceRefs(
        evidenceTraceIndex,
        obligation.obligationId,
        traceAtomRefs
      ),
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
    schemaVersion: typed ? 'GoalExecutionIR/v3' as const : 'GoalExecutionIR/v1' as const,
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
    logicalSpecSpans: sourceSpanResult.lineage
      ? sourceSpanResult.spans
      : sortedObjects(input.logicalSpecSpans, 'specSpanId') as GoalExecutionLogicalSpecSpan[],
    ...(sourceSpanResult.lineage ? { sourceLineage: sourceSpanResult.lineage } : {}),
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
  const sourceLineageIssue = sourceLineageFailureReason(compiled);
  if (sourceLineageIssue) {
    throw Object.assign(new Error('goal_execution_source_lineage_invalid'), {
      failureClass: 'goal_execution_source_lineage_invalid',
      reason: sourceLineageIssue,
    });
  }
  validateGoalContractSchema('goal-execution-ir.schema.json', compiled);
  return compiled;
}

export function validateGoalExecutionIR(value: unknown): {
  decision: 'pass' | 'block';
  issueCodes: string[];
  issueDetails?: Array<Record<string, unknown>>;
} {
  const issues: string[] = [];
  const issueDetails: Array<Record<string, unknown>> = [];
  const ir = object(value) as Partial<GoalExecutionIR>;
  try {
    validateGoalContractSchema('goal-execution-ir.schema.json', value);
  } catch {
    issues.push('goal_execution_ir_schema_invalid');
  }
  if (!['GoalExecutionIR/v1', 'GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(String(ir.schemaVersion))) issues.push('goal_execution_ir_schema_invalid');
  if (['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(String(ir.schemaVersion)) && Array.isArray(ir.obligations)) {
    try {
      const profile = typedProfile(object(ir.semanticSource));
      if (profile !== ir.profile) throw new Error('profile_mismatch');
      if (profile === 'requirements_backed') validateRequirementsTypedGoalIr(ir as JsonObject);
      else {
        validateTypedObligationSources(ir.obligations);
        validateStandaloneExecutionDeclarations(ir as JsonObject);
      }
      validateTaskExecutionProjection(ir);
    } catch (error) {
      issues.push('goal_execution_normative_source_binding_invalid');
      issueDetails.push({
        issueCode: 'goal_execution_normative_source_binding_invalid',
        causeCode: error instanceof Error ? error.message : String(error),
        ...(error && typeof error === 'object' && 'obligationId' in error
          ? { obligationId: String(error.obligationId) }
          : {}),
        ...(error && typeof error === 'object' && 'reason' in error
          ? { reason: String(error.reason) }
          : {}),
        ...(error && typeof error === 'object' && 'missingCommandRefs' in error
          ? { missingCommandRefs: [...(error.missingCommandRefs as string[])] }
          : {}),
        ...(error && typeof error === 'object' && 'ownedPaths' in error
          ? { ownedPaths: [...(error.ownedPaths as string[])] }
          : {}),
      });
    }
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
  if (!sourceLineageValid(ir)) issues.push('goal_execution_source_lineage_invalid');
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
  return {
    decision: issues.length === 0 ? 'pass' : 'block',
    issueCodes: sortedUnique(issues),
    ...(issueDetails.length > 0 ? { issueDetails } : {}),
  };
}
