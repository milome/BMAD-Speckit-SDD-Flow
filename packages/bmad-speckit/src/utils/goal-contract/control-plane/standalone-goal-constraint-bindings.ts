import type { StandaloneGoalSemanticInput } from './standalone-goal-semantic-ir';
import type { GoalExecutionObligation } from './goal-execution-ir';
import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

export interface StandaloneGoalConstraintBinding {
  constraintId: string;
  sourceRefs: string[];
  applicableMustRefs: string[];
  applicableAtomRefs?: string[];
  premiseRefs: string[];
  scope?: 'declared' | 'global';
  coverageRole?: 'action_trace' | 'non_action_declaration';
  declarationRole?: string;
  sourceDeclarationRefs?: string[];
  declarationSource?: Record<string, unknown>;
}

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const refs = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  : [];

export function validateStandaloneDeclarationSpecSpans(
  logicalSpecSpans: Record<string, unknown>[],
  constraints: Array<StandaloneGoalConstraintBinding | Record<string, unknown>>,
  sourceSnapshotHash: string,
  failureClass = 'standalone_goal_declaration_span_invalid',
): void {
  const fail = (declarationId?: string): never => {
    throw Object.assign(new Error(failureClass), {
      failureClass,
      ...(declarationId ? { declarationId } : {}),
    });
  };
  const declarations = new Map<string, Record<string, unknown>>();
  for (const candidate of constraints) {
    const constraint = candidate as Record<string, unknown>;
    if (constraint.coverageRole !== 'non_action_declaration' ||
      refs(constraint.applicableMustRefs).length > 0 || refs(constraint.applicableAtomRefs).length > 0) continue;
    const declarationId = String(constraint.constraintId ?? '');
    if (!declarationId || declarations.has(declarationId)) fail(declarationId);
    declarations.set(declarationId, constraint);
  }
  const bound = new Set<string>();
  for (const span of logicalSpecSpans) {
    const declarationIds = refs(span.boundDeclarationIds);
    if (declarationIds.length === 0) continue;
    if (declarationIds.length !== new Set(declarationIds).size || refs(span.boundObligationIds).length > 0) fail();
    const spanStart = Number(span.startByte);
    const spanEnd = Number(span.endByteExclusive);
    const canonicalNodeRefs = new Set(refs(span.canonicalNodeRefs));
    for (const declarationId of declarationIds) {
      const declaration = declarations.get(declarationId);
      const declarationSource = declaration?.declarationSource as Record<string, unknown> | undefined;
      const declarationStart = Number(declarationSource?.startByte);
      const declarationEnd = Number(declarationSource?.endByteExclusive);
      const declarationLineStart = Number(declarationSource?.lineStart);
      const declarationLineEnd = Number(declarationSource?.lineEnd);
      const sourceBlockRefs = unique([
        ...refs(declaration?.sourceDeclarationRefs),
        ...refs(declarationSource?.sourceBlockRefs),
      ]);
      if (!declaration || bound.has(declarationId) || declaration.coverageRole !== 'non_action_declaration' ||
        refs(declaration.applicableMustRefs).length > 0 || refs(declaration.applicableAtomRefs).length > 0 ||
        !declarationSource || declarationSource.sourceArtifactId !== span.sourceArtifactId ||
        declarationSource.sourceSnapshotHash !== sourceSnapshotHash || span.sourceSnapshotHash !== sourceSnapshotHash ||
        declarationSource.exactTextHash !== span.exactTextHash ||
        !Number.isInteger(spanStart) || !Number.isInteger(spanEnd) ||
        !Number.isInteger(declarationStart) || !Number.isInteger(declarationEnd) ||
        spanStart !== declarationStart || spanEnd !== declarationEnd ||
        !Number.isInteger(declarationLineStart) || !Number.isInteger(declarationLineEnd) ||
        Number(span.lineStart) !== declarationLineStart || Number(span.lineEnd) !== declarationLineEnd ||
        !canonicalNodeRefs.has(declarationId) ||
        sourceBlockRefs.length === 0 || sourceBlockRefs.some((ref) => !canonicalNodeRefs.has(ref))) fail(declarationId);
      bound.add(declarationId);
    }
  }
  for (const declarationId of declarations.keys()) {
    if (!bound.has(declarationId)) fail(declarationId);
  }
}

export function preflightStandaloneRelationGraph(input: StandaloneGoalSemanticInput): void {
  validateStandaloneDeclarationSpecSpans(
    input.logicalSpecSpans,
    input.technicalSnapshot.constraintBindings ?? [],
    input.sourceSnapshotHash,
  );
  const ownersBySourceRef = new Map<string, Set<string>>();
  const addOwner = (sourceRef: string, obligationRef: string) => {
    if (!sourceRef || !obligationRef) return;
    const owners = ownersBySourceRef.get(sourceRef) ?? new Set<string>();
    owners.add(obligationRef);
    ownersBySourceRef.set(sourceRef, owners);
  };
  for (const obligation of input.sourceObligations) {
    const obligationRef = String(obligation.id ?? '');
    for (const sourceRef of (obligation.specSpanRefs as string[] | undefined) ?? []) {
      addOwner(sourceRef, obligationRef);
    }
  }
  for (const span of input.logicalSpecSpans) {
    const sourceRef = String(span.specSpanId ?? span.sourceSpanId ?? '');
    for (const obligationRef of [
      ...((span.boundObligationIds as string[] | undefined) ?? []),
      ...((span.sourceObligationIds as string[] | undefined) ?? []),
    ]) {
      addOwner(sourceRef, obligationRef);
    }
  }
  for (const binding of input.technicalSnapshot.constraintBindings ?? []) {
    const allowedOwners = new Set<string>();
    for (const sourceRef of [...binding.sourceRefs, ...binding.premiseRefs]) {
      for (const owner of ownersBySourceRef.get(sourceRef) ?? []) allowedOwners.add(owner);
    }
    if (allowedOwners.size === 0 && binding.applicableMustRefs.length > 0) {
      throw Object.assign(new Error('standalone_goal_constraint_semantic_owner_missing'), {
        failureClass: 'standalone_goal_constraint_semantic_owner_missing',
        constraintId: binding.constraintId,
      });
    }
    if (binding.scope === 'global') continue;
    if (
      binding.applicableMustRefs.some((ref) => !allowedOwners.has(ref)) ||
      (binding.applicableAtomRefs ?? []).some((ref) => {
        const ownerRef = ref.endsWith('-A1') ? ref.slice(0, -3) : '';
        return !allowedOwners.has(ownerRef);
      })
    ) {
      throw Object.assign(new Error('standalone_goal_constraint_applicability_invalid'), {
        failureClass: 'standalone_goal_constraint_applicability_invalid',
        constraintId: binding.constraintId,
      });
    }
  }
}

export function declaredConstraintBuilder(input: StandaloneGoalSemanticInput, obligations: GoalExecutionObligation[]) {
  const bindings = input.technicalSnapshot.constraintBindings;
  if (!bindings) throw new Error('standalone_goal_constraint_binding_missing');
  const fail = (reason = 'invalid', constraintId?: string): never => {
    throw Object.assign(new Error('standalone_goal_constraint_binding_invalid'), {
      reason,
      ...(constraintId ? { constraintId } : {}),
    });
  };
  const byId = new Map(bindings.map((binding) => [binding.constraintId, binding]));
  if (byId.size !== bindings.length) fail('duplicate_constraint_id');
  const obligationById = new Map(obligations.map((row) => [row.obligationId, row]));
  const sourceRefs = new Set(obligations.flatMap((row) => row.sourceRefs));
  const consumed = new Set<string>();
  const make = (constraintId: string, kind: string, canonicalValue: string) => {
    const binding = byId.get(constraintId);
    if (!binding) throw new Error('standalone_goal_constraint_binding_missing');
    const applicableMustRefs = unique(binding.applicableMustRefs);
    const externalDeclaration = binding.declarationSource &&
      binding.declarationSource.sourceSnapshotHash === input.sourceSnapshotHash;
    const nonActionDeclaration = binding.coverageRole === 'non_action_declaration' && externalDeclaration;
    if (!binding.sourceRefs.length || !binding.premiseRefs.length || (!applicableMustRefs.length && !nonActionDeclaration) ||
      !['declared', 'global'].includes(binding.scope ?? 'declared') ||
      (!externalDeclaration && [...binding.sourceRefs, ...binding.premiseRefs].some((ref) => !sourceRefs.has(ref))) ||
      applicableMustRefs.some((ref) => !obligationById.has(ref)) || consumed.has(constraintId)) fail('binding_shape_or_reference_invalid', constraintId);
    const applicableAtoms = new Set(applicableMustRefs.flatMap((ref) => obligationById.get(ref)!.atomRefs));
    const applicableAtomRefs = unique(binding.applicableAtomRefs ?? (binding.coverageRole === 'non_action_declaration' ? [] : [...applicableAtoms]));
    if (applicableAtomRefs.some((ref) => !applicableAtoms.has(ref))) fail('atom_reference_invalid', constraintId);
    consumed.add(constraintId);
    return { constraintId, kind, canonicalValue, applicableMustRefs, applicableAtomRefs,
      premiseRefs: unique(binding.premiseRefs), sourceRefs: unique(binding.sourceRefs),
      ...(binding.sourceDeclarationRefs ? { sourceDeclarationRefs: unique(binding.sourceDeclarationRefs) } : {}),
      ...(binding.declarationSource ? { declarationSource: structuredClone(binding.declarationSource) } : {}),
      ...(binding.coverageRole ? { coverageRole: binding.coverageRole,
        sourceDeclarationRefs: unique(binding.sourceDeclarationRefs ?? [constraintId]) } : {}),
      ...(binding.declarationRole ? { declarationRole: binding.declarationRole } : {}),
      scope: binding.scope ?? 'declared', disposition: 'source_declared',
      declarationStatus: 'source_declared_not_executed' };
  };
  return { make, finish() { if (consumed.size !== byId.size) fail('unconsumed_binding'); } };
}

export function validateStandaloneExecutionDeclarations(ir: Record<string, unknown>): void {
  const semanticSource = ir.semanticSource as Record<string, unknown>;
  if (!Array.isArray(semanticSource.typedExecutionConstraints)) return;
  const constraints = semanticSource.typedExecutionConstraints as Record<string, unknown>[];
  const obligations = ir.obligations as GoalExecutionObligation[];
  const known = new Set(obligations.map((row) => row.obligationId));
  const sources = new Set(obligations.flatMap((row) => row.sourceRefs));
  const actions = new Set(obligations.filter((row) => row.executionRole === 'action').map((row) => row.obligationId));
  const fail = (): never => { throw new Error('goal_execution_declaration_binding_invalid'); };
  validateStandaloneDeclarationSpecSpans(
    ir.logicalSpecSpans as Record<string, unknown>[],
    constraints,
    String((ir.standaloneLineage as Record<string, unknown>).sourceSnapshotHash ?? ''),
    'goal_execution_declaration_span_invalid',
  );
  if (semanticSource.typedExecutionConstraintsHash !== sha256Stable(constraints)) fail();
  const ids = constraints.map((row) => row.constraintId);
  if (new Set(ids).size !== ids.length) fail();
  for (const row of constraints.filter((constraint) => ['CMD', 'EVDREQ'].includes(String(constraint.kind)))) {
    const declarationSource = row.declarationSource as Record<string, unknown> | undefined;
    const externalDeclaration = declarationSource &&
      declarationSource.sourceSnapshotHash === (ir.standaloneLineage as Record<string, unknown>).sourceSnapshotHash &&
      Number.isInteger(declarationSource.startByte) && Number.isInteger(declarationSource.endByteExclusive) &&
      Number(declarationSource.endByteExclusive) > Number(declarationSource.startByte);
    if (!['action_trace', 'non_action_declaration'].includes(String(row.coverageRole)) || !row.declarationRole ||
      !refs(row.sourceDeclarationRefs).length || !refs(row.sourceRefs).length ||
      (!externalDeclaration && refs(row.sourceRefs).some((ref) => !sources.has(ref))) ||
      refs(row.applicableMustRefs).some((ref) => !known.has(ref)) ||
      (row.coverageRole === 'action_trace' && !refs(row.applicableMustRefs).some((ref) => actions.has(ref))) ||
      (row.coverageRole === 'action_trace' && !['verification_command', 'global_verification_command', 'evidence_requirement'].includes(String(row.declarationRole)))) fail();
  }
  for (const [kind, field, id, value] of [['CMD', 'commands', 'commandId', 'invocation'], ['EVDREQ', 'evidenceContracts', 'evidenceContractId', 'requirement']]) {
    const expected = constraints.filter((row) => row.kind === kind && row.coverageRole === 'action_trace');
    const actual = ir[field] as Record<string, unknown>[];
    if (expected.length !== actual.length) fail();
    for (const constraint of expected) {
      const projected = actual.find((row) => row[id] === constraint.constraintId);
      if (!projected || projected[value] !== constraint.canonicalValue ||
        JSON.stringify(projected.obligationRefs) !== JSON.stringify(unique(refs(constraint.applicableMustRefs))) ||
        JSON.stringify(projected.atomRefs) !== JSON.stringify(unique(refs(constraint.applicableAtomRefs)))) fail();
    }
  }
}
