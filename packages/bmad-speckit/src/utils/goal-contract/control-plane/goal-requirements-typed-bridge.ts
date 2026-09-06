import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  resolveTypedSourceAuthority,
  resolveTypedSourceActionOracle,
  type RequirementsTypedSourceNode,
  type RequirementsTypedSourceAuthority,
} from '../../../main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import {
  resolveRequirementsSpecSpanSourceNodeIds,
  type RequirementsSpecSpan,
} from '../../../main-agent/source-authority/scripts/requirements-contract-span-registry';
import type { GoalExecutionObligation } from './goal-execution-ir';

type Row = Record<string, unknown>;
export const REQUIREMENTS_TYPED_SEMANTIC_VERSION = 'requirements-contract-semantic-ir/v2';
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const unique = (value: string[]) => [...new Set(value.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const fail = (code: string): never => { throw new Error(`requirements_goal_typed_${code}`); };

export function requirementsTypedSemanticSource(semanticIr: Row): Row {
  const payload = record(semanticIr.semanticPayload);
  const semantics = record(payload.semantics);
  const authority = record(semantics.typedSourceAuthority);
  if (semanticIr.schemaVersion !== REQUIREMENTS_TYPED_SEMANTIC_VERSION) fail('version_invalid');
  resolveTypedSourceAuthority(authority);
  return { kind: 'requirements_semantic_ir', schemaVersion: REQUIREMENTS_TYPED_SEMANTIC_VERSION,
    semanticRevisionId: semanticIr.semanticRevisionId, scopeSemanticHash: semanticIr.scopeSemanticHash,
    typedSourceAuthority: structuredClone(authority), typedSourceGraphHash: authority.graphHash,
    typedAtoms: structuredClone(rows(semantics.atoms)), typedExecutionConstraints: structuredClone(rows(payload.executionConstraints)) };
}

function graphOf(source: Row) {
  if (source.schemaVersion !== REQUIREMENTS_TYPED_SEMANTIC_VERSION || source.kind !== 'requirements_semantic_ir') fail('version_invalid');
  if (!Array.isArray(source.typedAtoms) || !Array.isArray(source.typedExecutionConstraints)) fail('semantic_payload_missing');
  const authority = record(source.typedSourceAuthority);
  const graph = resolveTypedSourceAuthority(authority);
  if (source.typedSourceGraphHash !== authority.graphHash) fail('graph_hash_mismatch');
  return graph;
}

function obligationKind(node: RequirementsTypedSourceNode): GoalExecutionObligation['kind'] {
  if (node.polarity === 'mixed' || node.normativeStrength === 'mixed') return 'COMPOSITE';
  if (node.normativeStrength === 'may') return 'PERMISSION';
  if (node.normativeStrength === 'should' || node.executionRole === 'guidance') return 'GUIDANCE';
  if (node.executionRole === 'definition') return 'DEFINITION';
  if (node.polarity === 'forbidden') return 'NEG';
  if (node.executionRole === 'boundary') return 'OUT';
  return node.executionRole === 'acceptance' ? 'ACCEPTANCE' : 'MUST';
}

export function projectRequirementsTypedGoalObligations(source: Row, spans: Row[]): GoalExecutionObligation[] {
  const graph = graphOf(source);
  const actionIds = new Set(graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId));
  const spanBindings = spans.map((span) => ({ span, ids: new Set(resolveRequirementsSpecSpanSourceNodeIds(
    span as unknown as RequirementsSpecSpan, source.typedSourceAuthority as RequirementsTypedSourceAuthority)) }));
  return graph.sourceNodes.map((node) => {
    const id = node.sourceRootId;
    const matchedSpans = spanBindings.filter((binding) => binding.ids.has(id)).map((binding) => binding.span);
    const sourceRefs = unique([id, ...node.declaredIds, ...[node.sourceBlockId, node.sourceClauseId].filter((value): value is string => typeof value === 'string'),
      ...matchedSpans.map((span) => String(span.specSpanId))]);
    const owner = node.scope.ownerId ?? node.scope.owner;
    const applicability = node.scope.kind === 'global' ? { scope: 'global', sourceRefs }
      : typeof owner === 'string' && actionIds.has(owner) ? { scope: 'obligations', obligationRefs: [owner], sourceRefs }
        : { scope: 'source_scope', sourceScope: structuredClone(node.scope), sourceRefs };
    const conditions = node.conditions.map((value) => {
      const condition = record(value);
      if (typeof condition.text !== 'string' || !condition.text.length) fail('condition_invalid');
      return { ...structuredClone(condition), sourceRefs: unique([...strings(condition.sourceRefs), ...sourceRefs]), state: 'unevaluated' };
    });
    return { obligationId: id, kind: obligationKind(node), text: node.text, sourceRefs,
      ...(node.executionRole === 'action' ? { oracle: resolveTypedSourceActionOracle(graph, id) } : {}),
      atomRefs: node.executionRole === 'action' ? [`${id}-A1`] : [], evidenceClaimRefs: unique(matchedSpans.flatMap((span) => strings(span.evidenceClaimRefs))),
      executionRole: node.executionRole, normativeStrength: node.normativeStrength, polarity: node.polarity,
      ...(record(node).taskExecution !== undefined ? { taskExecution: structuredClone(record(node).taskExecution) } : {}),
      conditions, applicability, typedSourceNode: structuredClone(node),
      ...(node.priority !== undefined ? { priority: structuredClone(node.priority) } : {}) };
  }).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

export function assertRequirementsTypedProjection(input: { semanticSource: Row; obligations: GoalExecutionObligation[]; logicalSpecSpans: Row[]; atoms?: Row[]; executionConstraints?: Row[] }): void {
  const expected = projectRequirementsTypedGoalObligations(input.semanticSource, input.logicalSpecSpans);
  const actual = [...input.obligations].sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  if (sha256Stable(expected) !== sha256Stable(actual)) fail('obligation_projection_mismatch');
  if (input.atoms) {
    const action = expected.filter((row) => row.executionRole === 'action');
    if (input.atoms.length !== action.length || action.some((row) => {
      const atoms = input.atoms!.filter((atom) => (atom.requirementRef ?? atom.coverageSeed) === row.obligationId);
      return atoms.length !== 1 || (atoms[0].id ?? atoms[0].atomId) !== row.atomRefs[0] || atoms[0].oracle !== row.oracle;
    })) fail('action_membership_invalid');
    if (!Array.isArray(input.semanticSource.typedAtoms) || sha256Stable(input.atoms) !== sha256Stable(input.semanticSource.typedAtoms)) fail('atom_projection_mismatch');
  }
  if (input.executionConstraints && (!Array.isArray(input.semanticSource.typedExecutionConstraints) ||
    sha256Stable(input.executionConstraints) !== sha256Stable(input.semanticSource.typedExecutionConstraints))) fail('constraint_projection_mismatch');
}

export function requirementsTypedConstraintMetadata(constraint: Row): Row {
  const fields = ['conditions', 'scope', 'disposition', 'authorityKind', 'applicableSourceRefs', 'sourceRefs', 'premiseRefs',
    'derivationReceiptRefs', 'declarationStatus', 'modality', 'sourceDeclarationRefs'];
  return Object.fromEntries(fields.filter((field) => constraint[field] !== undefined).map((field) => [field, structuredClone(constraint[field])]));
}

function validateConstraintProjections(ir: Row): void {
  const constraints = rows(record(ir.semanticSource).typedExecutionConstraints);
  const sorted = (values: Row[], key: string) => [...values].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  for (const [kind, collection, id, value] of [['CMD', 'commands', 'commandId', 'invocation'], ['ART', 'artifacts', 'artifactId', 'logicalPath'],
    ['EVDREQ', 'evidenceContracts', 'evidenceContractId', 'requirement'], ['CTM', 'coExecutionConstraints', 'constraintId', '']] as const) {
    const expected = constraints.filter((row) => row.kind === kind && (kind !== 'CMD' || row.modality === undefined || row.modality === 'required')).map((row) => ({
      [id]: row.constraintId, ...requirementsTypedConstraintMetadata(row),
      ...(kind === 'CTM' ? { kind: 'must_link', taskRefs: rows(ir.atomicTasks).filter((task) =>
        strings(row.applicableAtomRefs).some((ref) => strings(task.atomRefs).includes(ref))).map((task) => task.taskId) }
        : { [value]: String(row.canonicalValue).trim(), obligationRefs: unique(strings(row.applicableMustRefs)),
          atomRefs: unique(strings(row.applicableAtomRefs)) }),
      basisRefs: unique([String(row.constraintId), ...strings(row.premiseRefs)]),
    }));
    if (sha256Stable(sorted(expected, id)) !== sha256Stable(sorted(rows(ir[collection]), id))) fail('constraint_projection_mismatch');
  }
  const stops = constraints.filter((row) => row.kind === 'STOP');
  if (sha256Stable(rows(record(ir.logicalScopes).pathRestrictions)) !== sha256Stable(sorted(stops.filter((row) => typeof row.scope !== 'object'), 'constraintId')) ||
    sha256Stable(rows(record(ir.logicalScopes).stopConditions)) !== sha256Stable(sorted(stops.filter((row) => typeof row.scope === 'object'), 'constraintId')) ||
    sha256Stable(record(ir.logicalScopes).ownedPaths) !== sha256Stable(unique(constraints.filter((row) => row.kind === 'PATH').map((row) => String(row.canonicalValue).trim())))) {
    fail('constraint_projection_mismatch');
  }
}

export function validateRequirementsTypedGoalIr(ir: Row): void {
  const source = record(ir.semanticSource);
  assertRequirementsTypedProjection({ semanticSource: source, obligations: rows(ir.obligations) as GoalExecutionObligation[], logicalSpecSpans: rows(ir.logicalSpecSpans),
    atoms: rows(source.typedAtoms), executionConstraints: rows(source.typedExecutionConstraints) });
  const actions = rows(ir.obligations).filter((row) => row.executionRole === 'action');
  const tasks = rows(ir.atomicTasks);
  if (tasks.length !== actions.length || actions.some((row) => {
    const matches = tasks.filter((task) => strings(task.obligationRefs).includes(String(row.obligationId)));
    return matches.length !== 1 || sha256Stable(matches[0].atomRefs) !== sha256Stable(row.atomRefs) || matches[0].oracle !== row.oracle;
  })) fail('task_projection_mismatch');
  validateConstraintProjections(ir);
}

export function assertRequirementsTypedAuthorityMatchesGoal(semanticIr: Row, goalExecutionIr: Row): void {
  const expectedSource = requirementsTypedSemanticSource(semanticIr);
  if (goalExecutionIr.schemaVersion !== 'GoalExecutionIR/v2' || goalExecutionIr.profile !== 'requirements_backed' ||
    sha256Stable(expectedSource) !== sha256Stable(goalExecutionIr.semanticSource)) fail('external_authority_mismatch');
}
