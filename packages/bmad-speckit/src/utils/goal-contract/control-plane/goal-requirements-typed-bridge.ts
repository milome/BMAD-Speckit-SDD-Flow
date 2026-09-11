import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  resolveTypedSourceAuthority,
  resolveTypedSourceActionOracle,
  type RequirementsTypedSourceNode,
  type RequirementsTypedSourceAuthority,
} from '../../../main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { resolveTypedTechnicalDeclarations } from '../../../main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import {
  resolveRequirementsSpecSpanSourceNodeIds,
  type RequirementsSpecSpan,
} from '../../../main-agent/source-authority/scripts/requirements-contract-span-registry';
import type { GoalExecutionObligation } from './goal-execution-ir';
import {
  canonicalRequirementGraphRef,
  normalizeCanonicalRequirementGraph,
  type CanonicalRequirementGraphV2,
} from './canonical-requirement-graph';

type Row = Record<string, unknown>;
export const REQUIREMENTS_TYPED_SEMANTIC_VERSION = 'requirements-contract-semantic-ir/v2';
const record = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const unique = (value: string[]) =>
  [...new Set(value.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const fail = (code: string): never => {
  throw new Error(`requirements_goal_typed_${code}`);
};
const failRelationProjection = (relationId: string, relationKind: string): never => {
  throw new Error(
    `requirements_goal_typed_relation_projection_missing:${relationId}:${relationKind}`
  );
};

export type RequirementsTypedRelationDisposition =
  | 'canonical_relation'
  | 'obligation_projection'
  | 'execution_projection'
  | 'authority_only';

export interface RequirementsTypedRelationProjection extends Row {
  relationId: string;
  relationKind: string;
  fromRef: string;
  toRef: string;
  mandatory: boolean;
  disposition: RequirementsTypedRelationDisposition;
  carrierRefs: string[];
}

const KNOWN_TYPED_RELATION_KINDS = new Set([
  'accepted_by',
  'allows_product_file',
  'allows_test_file',
  'applies_to',
  'applies_to_requirement',
  'audit_declared_binding',
  'authority_precedence',
  'closed_comparison_field_set',
  'command_selects_test',
  'command_set_includes',
  'conditional_authoring_prohibition',
  'conditional_command_selection',
  'consumed_by',
  'declares_command',
  'defines',
  'depends_on',
  'dirty_worktree_protection',
  'effective_fix_boundary',
  'elaborates',
  'evidenced_by',
  'fix_facet',
  'fixture_required_coverage_point',
  'global_boundary',
  'globally_authorized_by',
  'guarded_by',
  'implemented_by',
  'includes_command',
  'legacy_contract_required_field',
  'non_goals',
  'optimization_allowlist_member',
  'ordered_ingress_step',
  'owned_by',
  'pending_human_review',
  'pending_source_confirmation',
  'precontract_fixture_gate',
  'preserve_user_semantics',
  'produced_by',
  'produces_artifact',
  'prohibited_architecture_alternative',
  'quality_gate',
  'real_verification_requirements',
  'refresh_when_trigger_occurs',
  'repair_target',
  'required_architecture_choice',
  'requires_scenario_state',
  'same_command_as',
  'same_source_boundary',
  'scenario_cross_reference',
  'scenario_evidence',
  'scenario_implemented_by',
  'scenario_product_file',
  'scenario_test_nodeid',
  'source_mentions',
  'uses_path',
  'validated_by',
  'work_evidence',
  'work_scope_declaration',
]);

const CONSTRAINT_RELATION_KINDS = new Set([
  'allows_product_file',
  'allows_test_file',
  'command_selects_test',
  'command_set_includes',
  'conditional_command_selection',
  'declares_command',
  'same_command_as',
  'scenario_evidence',
  'scenario_product_file',
  'scenario_test_nodeid',
  'work_evidence',
]);

const AUTHORITY_ONLY_RELATION_FIELDS = new Map<string, Set<string>>([
  ['defines', new Set(['relationId', 'kind', 'from', 'to', 'blockId'])],
  ['elaborates', new Set(['relationId', 'kind', 'from', 'to', 'blockId'])],
  ['fix_facet', new Set(['relationId', 'kind', 'from', 'to', 'blockId', 'facet'])],
  ['source_mentions', new Set(['relationId', 'kind', 'from', 'to', 'blockId'])],
  [
    'same_source_boundary',
    new Set([
      'relationId',
      'kind',
      'from',
      'to',
      'blockId',
      'relatedSourceLine',
      'relationshipBasis',
    ]),
  ],
]);

function addIndex(index: Map<string, Set<string>>, key: unknown, refs: string[]): void {
  const normalized = typeof key === 'string' ? key.trim() : '';
  if (!normalized || refs.length === 0) return;
  const values = index.get(normalized) ?? new Set<string>();
  refs.forEach((ref) => values.add(ref));
  index.set(normalized, values);
}

function relationNodeIndex(
  graph: ReturnType<typeof resolveTypedSourceAuthority>
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const known = new Set(graph.sourceNodes.map((node) => node.sourceRootId));
  for (const node of graph.sourceNodes) {
    addIndex(index, node.sourceRootId, [node.sourceRootId]);
    addIndex(index, node.sourceBlockId, [node.sourceRootId]);
    addIndex(index, node.sourceClauseId, [node.sourceRootId]);
    for (const declaredId of node.declaredIds) {
      addIndex(index, declaredId, [known.has(declaredId) ? declaredId : node.sourceRootId]);
    }
  }
  for (const work of graph.workDeclarations) {
    const id = String(work.id);
    if (known.has(id)) addIndex(index, id, [id]);
  }
  for (const scenario of graph.scenarioDeclarations) {
    addIndex(
      index,
      scenario.id,
      strings(scenario.works).filter((ref) => known.has(ref))
    );
  }
  for (const command of graph.commandDeclarations) {
    const owner = String(command.owner ?? '');
    if (known.has(owner)) addIndex(index, command.id, [owner]);
  }
  return index;
}

function independentlyDerivedExecutionConstraints(input: {
  authority: RequirementsTypedSourceAuthority;
  canonicalGraph: CanonicalRequirementGraphV2;
}): Row[] {
  const constraints = resolveTypedTechnicalDeclarations(input.authority).map((entry) => ({
    constraintId: entry.id,
    kind: entry.kind,
    canonicalValue: entry.value,
    applicableMustRefs: entry.applicableSourceRefs ?? [],
    applicableAtomRefs: (entry.applicableSourceRefs ?? []).map((id) => `${id}-A1`),
    premiseRefs: entry.premiseRefs ?? [],
    derivationReceiptRefs: entry.derivationReceiptRefs ?? [],
    disposition: 'proven',
    authorityKind: entry.authorityKind,
    applicableSourceRefs: entry.applicableSourceRefs ?? [],
    conditions: entry.conditions ?? [],
    scope: entry.scope ?? {},
    modality: entry.modality,
    sourceDeclarationRefs: entry.sourceDeclarationRefs ?? [],
    ...(entry.coverageRole ? { coverageRole: entry.coverageRole } : {}),
    ...(entry.declarationRole ? { declarationRole: entry.declarationRole } : {}),
  }));
  return normalizeRequirementsTypedExecutionConstraints({
    constraints,
    canonicalGraph: input.canonicalGraph,
    typedSourceAuthority: input.authority,
  });
}

function constraintAuthoritySignature(constraint: Row): Row {
  const fields = [
    'constraintId',
    'kind',
    'canonicalValue',
    'applicableMustRefs',
    'applicableAtomRefs',
    'applicableSourceRefs',
    'premiseRefs',
    'sourceDeclarationRefs',
    'derivationReceiptRefs',
    'conditions',
    'scope',
    'modality',
    'coverageRole',
    'declarationRole',
    'authorityKind',
    'disposition',
  ];
  return Object.fromEntries(
    fields
      .filter((field) => constraint[field] !== undefined)
      .map((field) => [field, structuredClone(constraint[field])])
  );
}

function projectRequirementsTypedRelations(input: {
  graph: ReturnType<typeof resolveTypedSourceAuthority>;
  canonicalGraph: CanonicalRequirementGraphV2;
  constraints: Row[];
  typedSourceAuthority: RequirementsTypedSourceAuthority;
}): { projections: RequirementsTypedRelationProjection[]; constraints: Row[] } {
  const constraints = input.constraints.map((constraint) => structuredClone(constraint));
  const canonicalRelationIds = new Set(
    rows(input.canonicalGraph.relations).map((relation) => String(relation.id))
  );
  const independentlyDerived = input.graph.sourceRelations.some(
    (relation) =>
      CONSTRAINT_RELATION_KINDS.has(relation.kind) && !canonicalRelationIds.has(relation.relationId)
  )
    ? independentlyDerivedExecutionConstraints({
        authority: input.typedSourceAuthority,
        canonicalGraph: input.canonicalGraph,
      })
    : [];
  const derivedConstraintsByRelation = new Map<string, Row[]>();
  for (const constraint of independentlyDerived) {
    for (const relationId of unique([
      ...strings(constraint.premiseRefs),
      ...strings(constraint.sourceDeclarationRefs),
    ])) {
      const carriers = derivedConstraintsByRelation.get(relationId) ?? [];
      carriers.push(constraint);
      derivedConstraintsByRelation.set(relationId, carriers);
    }
  }
  const constraintsById = new Map(
    constraints.map((constraint) => [String(constraint.constraintId), constraint])
  );
  const nodeIndex = relationNodeIndex(input.graph);
  const actionIds = unique(
    input.graph.sourceNodes
      .filter((node) => node.executionRole === 'action')
      .map((node) => node.sourceRootId)
  );
  const projections = input.graph.sourceRelations
    .map((relation): RequirementsTypedRelationProjection => {
      const relationId = relation.relationId;
      const relationKind = relation.kind;
      if (!KNOWN_TYPED_RELATION_KINDS.has(relationKind))
        failRelationProjection(relationId, relationKind);
      const nodeRefs = unique([
        ...(nodeIndex.get(relation.from) ?? []),
        ...(nodeIndex.get(relation.to) ?? []),
        ...(nodeIndex.get(relation.blockId) ?? []),
        ...(relationKind === 'global_boundary' ? actionIds : []),
      ]);
      const base = {
        relationId,
        relationKind,
        fromRef: relation.from,
        toRef: relation.to,
        ...(relation.sourceCondition === undefined
          ? {}
          : { sourceCondition: structuredClone(relation.sourceCondition) }),
      };
      if (canonicalRelationIds.has(relationId)) {
        return {
          ...base,
          mandatory: true,
          disposition: 'canonical_relation',
          carrierRefs: unique([
            `canonical_relation:${relationId}`,
            ...nodeRefs.map((ref) => `obligation:${ref}`),
          ]),
        };
      }
      if (relationKind === 'depends_on') {
        const work = input.graph.workDeclarations.find((entry) => entry.id === relation.from);
        if (!work || !strings(work.dependencies).includes(relation.to))
          failRelationProjection(relationId, relationKind);
        return {
          ...base,
          mandatory: true,
          disposition: 'execution_projection',
          carrierRefs: [`dependency:${relation.from}->${relation.to}`],
        };
      }
      if (CONSTRAINT_RELATION_KINDS.has(relationKind)) {
        const expectedCarriers = derivedConstraintsByRelation.get(relationId) ?? [];
        if (expectedCarriers.length === 0) failRelationProjection(relationId, relationKind);
        for (const expected of expectedCarriers) {
          const actual = constraintsById.get(String(expected.constraintId));
          if (
            !actual ||
            sha256Stable(constraintAuthoritySignature(actual)) !==
              sha256Stable(constraintAuthoritySignature(expected))
          ) {
            failRelationProjection(relationId, relationKind);
          }
        }
        return {
          ...base,
          mandatory: true,
          disposition: 'execution_projection',
          carrierRefs: unique(
            expectedCarriers.map((constraint) => `constraint:${String(constraint.constraintId)}`)
          ),
        };
      }
      const authorityOnlyFields = AUTHORITY_ONLY_RELATION_FIELDS.get(relationKind);
      if (!authorityOnlyFields) {
        if (nodeRefs.length === 0) failRelationProjection(relationId, relationKind);
        return {
          ...base,
          mandatory: true,
          disposition: 'obligation_projection',
          carrierRefs: nodeRefs.map((ref) => `obligation:${ref}`),
        };
      }
      if (Object.keys(relation).some((field) => !authorityOnlyFields.has(field))) {
        failRelationProjection(relationId, relationKind);
      }
      return { ...base, mandatory: false, disposition: 'authority_only', carrierRefs: [] };
    })
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
  return { projections, constraints };
}

export function requirementsTypedSemanticSource(semanticIr: Row): Row {
  const payload = record(semanticIr.semanticPayload);
  const semantics = record(payload.semantics);
  const authority = record(semantics.typedSourceAuthority);
  if (semanticIr.schemaVersion !== REQUIREMENTS_TYPED_SEMANTIC_VERSION) fail('version_invalid');
  resolveTypedSourceAuthority(authority);
  const confirmationRef = record(
    record(semantics.implementationConfirmation).typedSourceAuthorityRef
  );
  const semanticProvenance = record(payload.semanticProvenance);
  const anchorHashes = unique([
    String(confirmationRef.graphHash ?? ''),
    String(semanticProvenance.typedSourceGraph ?? ''),
  ]);
  if (anchorHashes.length !== 1 || anchorHashes[0] !== authority.graphHash) {
    fail('typed_source_graph_anchor_mismatch');
  }
  const canonicalGraph = normalizeCanonicalRequirementGraph({
    sourceAuthority: {
      kind: 'requirements_semantic_ir',
      schemaVersion: REQUIREMENTS_TYPED_SEMANTIC_VERSION,
      authorityId: String(semanticIr.semanticRevisionId),
      authorityHash: String(semanticIr.scopeSemanticHash),
    },
    typedSourceAuthority: authority as unknown as RequirementsTypedSourceAuthority,
    expectedTypedSourceGraphHash: anchorHashes[0],
  });
  const normalizedConstraints = normalizeRequirementsTypedExecutionConstraints({
    constraints: rows(payload.executionConstraints),
    canonicalGraph,
    typedSourceAuthority: authority as unknown as RequirementsTypedSourceAuthority,
  });
  const relationProjection = projectRequirementsTypedRelations({
    graph: resolveTypedSourceAuthority(authority),
    canonicalGraph,
    constraints: normalizedConstraints,
    typedSourceAuthority: authority as unknown as RequirementsTypedSourceAuthority,
  });
  return {
    kind: 'requirements_semantic_ir',
    schemaVersion: REQUIREMENTS_TYPED_SEMANTIC_VERSION,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    typedSourceAuthority: structuredClone(authority),
    typedSourceGraphHash: authority.graphHash,
    canonicalRequirementGraphRef: canonicalRequirementGraphRef(canonicalGraph),
    typedAtoms: structuredClone(rows(semantics.atoms)),
    typedExecutionConstraints: relationProjection.constraints,
    typedRelationProjections: relationProjection.projections,
  };
}

function canonicalOwnerClosure(node: Row, nodeById: Map<string, Row>): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  let owner = typeof node.ownerRef === 'string' ? node.ownerRef : '';
  while (owner && !visited.has(owner)) {
    visited.add(owner);
    result.push(owner);
    const ownerNode = nodeById.get(owner);
    owner = ownerNode && typeof ownerNode.ownerRef === 'string' ? ownerNode.ownerRef : '';
  }
  return unique(result);
}

const CANONICAL_CONSTRAINT_KINDS = new Map<string, string>([
  ['ART', 'ART'],
  ['EVD', 'EVDREQ'],
  ['DEP', 'CTM'],
  ['STOP', 'STOP'],
  ['PATH', 'PATH'],
] as const);

function actionRefsForCanonicalDeclaration(input: {
  node: Row;
  nodeById: Map<string, Row>;
  relations: Row[];
  actionIds: string[];
  actionIdSet: Set<string>;
}): string[] {
  const refs = new Set<string>();
  const addRef = (ref: string) => {
    if (input.actionIdSet.has(ref)) refs.add(ref);
    const node = input.nodeById.get(ref);
    if (node) {
      for (const owner of canonicalOwnerClosure(node, input.nodeById)) {
        if (input.actionIdSet.has(owner)) refs.add(owner);
      }
    }
  };
  for (const owner of canonicalOwnerClosure(input.node, input.nodeById)) addRef(owner);
  const nodeId = String(input.node.id);
  for (const relation of input.relations) {
    if (relation.toRef === nodeId) addRef(String(relation.fromRef));
    if (relation.fromRef === nodeId && relation.type === 'consumed_by') {
      addRef(String(relation.toRef));
    }
  }
  const dependency = String(record(input.node.attributes).dependency ?? '');
  if (dependency) addRef(dependency);
  return input.node.scope === 'global' ? input.actionIds : unique([...refs]);
}

function canonicalConstraintValue(node: Row, kind: string): string {
  const attributes = record(node.attributes);
  const value =
    kind === 'ART'
      ? attributes.path
      : kind === 'PATH'
        ? attributes.path
        : kind === 'EVDREQ'
          ? (node.statement ?? attributes.requiredState ?? attributes.evidenceStatus)
          : kind === 'CTM'
            ? (attributes.requiredState ?? node.statement ?? attributes.dependency)
            : (attributes.trigger ?? node.statement ?? attributes.requiredState);
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) fail('canonical_constraint_value_missing');
  return normalized;
}

function canonicalConstraintId(nodeId: string, kind: string): string {
  if (kind === 'EVDREQ') return `EVDREQ-${nodeId.replace(/^EVD-/u, '')}`;
  if (kind === 'CTM') return `CTM-${nodeId.replace(/^DEP-/u, '')}`;
  return nodeId;
}

function synthesizeCanonicalExecutionConstraints(input: {
  constraints: Row[];
  canonicalGraph: CanonicalRequirementGraphV2;
  nodeById: Map<string, Row>;
  actionIds: string[];
  actionIdSet: Set<string>;
}): Row[] {
  const canonicalNodes = rows(input.canonicalGraph.nodes);
  const relations = rows(input.canonicalGraph.relations);
  const hasCanonicalPaths = canonicalNodes.some((node) => node.kind === 'PATH');
  const constraints = input.constraints.filter(
    (constraint) => !(hasCanonicalPaths && constraint.kind === 'PATH')
  );
  const declared = new Set(
    constraints.flatMap((constraint) => strings(constraint.sourceDeclarationRefs))
  );
  for (const node of canonicalNodes) {
    const sourceKind = String(node.kind);
    const kind = CANONICAL_CONSTRAINT_KINDS.get(sourceKind);
    const nodeId = String(node.id);
    if (!kind || declared.has(nodeId)) continue;
    const actionRefs = actionRefsForCanonicalDeclaration({
      node,
      nodeById: input.nodeById,
      relations,
      actionIds: input.actionIds,
      actionIdSet: input.actionIdSet,
    });
    const relationRefs = relations
      .filter((relation) => relation.fromRef === nodeId || relation.toRef === nodeId)
      .map((relation) => String(relation.id));
    const ownerRefs = canonicalOwnerClosure(node, input.nodeById);
    constraints.push({
      constraintId: canonicalConstraintId(nodeId, kind),
      kind,
      canonicalValue: canonicalConstraintValue(node, kind),
      applicableMustRefs: unique([...ownerRefs, ...actionRefs]),
      applicableAtomRefs: actionRefs.map((ref) => `${ref}-A1`),
      applicableSourceRefs: actionRefs,
      premiseRefs: unique([nodeId, ...relationRefs]),
      sourceDeclarationRefs: [nodeId],
      sourceRefs: unique([nodeId, ...relationRefs]),
      derivationReceiptRefs: [],
      disposition: 'proven',
      authorityKind: 'source_declared',
      modality: 'required',
      conditions:
        sourceKind === 'STOP'
          ? [{ trigger: record(node.attributes).trigger ?? node.statement }]
          : [],
      scope: {
        kind: sourceKind === 'STOP' ? 'stop_condition' : 'canonical_declaration',
        owner: node.ownerRef ?? null,
      },
      coverageRole: actionRefs.length > 0 ? 'action_trace' : 'non_action_declaration',
      declarationRole:
        sourceKind === 'ART'
          ? 'artifact_contract'
          : sourceKind === 'EVD'
            ? 'evidence_contract'
            : sourceKind === 'DEP'
              ? 'dependency_constraint'
              : sourceKind === 'STOP'
                ? 'stop_condition'
                : 'path_constraint',
    });
    declared.add(nodeId);
  }
  return constraints;
}

export function normalizeRequirementsTypedExecutionConstraints(input: {
  constraints: Row[];
  canonicalGraph: CanonicalRequirementGraphV2;
  typedSourceAuthority: RequirementsTypedSourceAuthority;
}): Row[] {
  const typedGraph = resolveTypedSourceAuthority(input.typedSourceAuthority);
  const actionIds = unique(
    typedGraph.sourceNodes
      .filter((node) => node.executionRole === 'action')
      .map((node) => node.sourceRootId)
  );
  const actionIdSet = new Set(actionIds);
  const canonicalNodes = rows(input.canonicalGraph.nodes);
  const nodeById = new Map(canonicalNodes.map((node) => [String(node.id), node]));

  const normalized = input.constraints.map((constraint) => {
    if (constraint.kind !== 'CMD') return structuredClone(constraint);
    const declaration = strings(constraint.sourceDeclarationRefs)
      .map((ref) => nodeById.get(ref))
      .find((node) => node?.kind === 'CMD');
    if (!declaration) return structuredClone(constraint);

    const attributes = record(declaration.attributes);
    const executionMode = String(attributes.executionMode ?? '');
    const declaredRole = String(attributes.commandRole ?? 'verification_command');
    const ownerRefs = canonicalOwnerClosure(declaration, nodeById);
    const existingActionRefs = unique(
      [
        ...strings(constraint.applicableMustRefs),
        ...strings(constraint.applicableSourceRefs),
      ].filter((ref) => actionIdSet.has(ref))
    );
    const ownerActionRefs = ownerRefs.filter((ref) => actionIdSet.has(ref));
    const global = declaration.scope === 'global';
    const actionRefs = unique(global ? actionIds : [...existingActionRefs, ...ownerActionRefs]);
    const executable = executionMode !== 'template' && executionMode !== 'prohibited';
    const coverageRole =
      executable && actionRefs.length > 0 ? 'action_trace' : 'non_action_declaration';
    const modality =
      executionMode === 'template'
        ? 'template'
        : executionMode === 'prohibited'
          ? 'prohibited'
          : constraint.modality;

    return {
      ...structuredClone(constraint),
      applicableMustRefs: unique([...ownerRefs, ...actionRefs]),
      applicableAtomRefs: actionRefs.map((ref) => `${ref}-A1`),
      applicableSourceRefs: actionRefs,
      coverageRole,
      declarationRole:
        coverageRole === 'action_trace'
          ? global
            ? 'global_verification_command'
            : 'verification_command'
          : declaredRole,
      ...(modality === undefined ? {} : { modality }),
      scope: global
        ? { kind: 'global_source_command', owner: declaration.ownerRef }
        : structuredClone(record(constraint.scope)),
    };
  });
  return synthesizeCanonicalExecutionConstraints({
    constraints: normalized,
    canonicalGraph: input.canonicalGraph,
    nodeById,
    actionIds,
    actionIdSet,
  }).sort((left, right) => String(left.constraintId).localeCompare(String(right.constraintId)));
}

function graphOf(source: Row) {
  if (
    source.schemaVersion !== REQUIREMENTS_TYPED_SEMANTIC_VERSION ||
    source.kind !== 'requirements_semantic_ir'
  )
    fail('version_invalid');
  if (!Array.isArray(source.typedAtoms) || !Array.isArray(source.typedExecutionConstraints))
    fail('semantic_payload_missing');
  const authority = record(source.typedSourceAuthority);
  const graph = resolveTypedSourceAuthority(authority);
  if (source.typedSourceGraphHash !== authority.graphHash) fail('graph_hash_mismatch');
  const canonicalGraph = normalizeCanonicalRequirementGraph({
    sourceAuthority: {
      kind: 'requirements_semantic_ir',
      schemaVersion: REQUIREMENTS_TYPED_SEMANTIC_VERSION,
      authorityId: String(source.semanticRevisionId),
      authorityHash: String(source.scopeSemanticHash),
    },
    typedSourceAuthority: authority as unknown as RequirementsTypedSourceAuthority,
    expectedTypedSourceGraphHash: String(source.typedSourceGraphHash),
  });
  if (
    sha256Stable(source.canonicalRequirementGraphRef) !==
    sha256Stable(canonicalRequirementGraphRef(canonicalGraph))
  ) {
    fail('semantic_source_projection_mismatch');
  }
  const projections = rows(source.typedRelationProjections);
  const expectedProjection = projectRequirementsTypedRelations({
    graph,
    canonicalGraph,
    constraints: rows(source.typedExecutionConstraints),
    typedSourceAuthority: authority as unknown as RequirementsTypedSourceAuthority,
  });
  if (
    sha256Stable(projections) !== sha256Stable(expectedProjection.projections) ||
    sha256Stable(source.typedExecutionConstraints) !== sha256Stable(expectedProjection.constraints)
  ) {
    fail('relation_projection_mismatch');
  }
  const projectionById = new Map(
    projections.map((projection) => [String(projection.relationId), projection])
  );
  if (
    projections.length !== graph.sourceRelations.length ||
    projectionById.size !== projections.length ||
    graph.sourceRelations.some((relation) => {
      const projection = projectionById.get(relation.relationId);
      if (!KNOWN_TYPED_RELATION_KINDS.has(relation.kind)) return true;
      const disposition = String(projection?.disposition);
      const expectedMandatory = !AUTHORITY_ONLY_RELATION_FIELDS.has(relation.kind);
      return (
        !projection ||
        projection.relationKind !== relation.kind ||
        projection.fromRef !== relation.from ||
        projection.toRef !== relation.to ||
        ![
          'canonical_relation',
          'obligation_projection',
          'execution_projection',
          'authority_only',
        ].includes(disposition) ||
        projection.mandatory !== expectedMandatory ||
        !Array.isArray(projection.carrierRefs) ||
        (projection.mandatory === true &&
          (projection.disposition === 'authority_only' || projection.carrierRefs.length === 0))
      );
    }) ||
    projections.some((projection) =>
      strings(projection.carrierRefs).some((carrier) => {
        if (!carrier.startsWith('constraint:')) return false;
        const constraint = rows(source.typedExecutionConstraints).find(
          (row) => String(row.constraintId) === carrier.slice('constraint:'.length)
        );
        return (
          !constraint ||
          !strings(constraint.premiseRefs).includes(String(projection.relationId)) ||
          !strings(constraint.sourceDeclarationRefs).includes(String(projection.relationId))
        );
      })
    )
  )
    fail('relation_projection_missing');
  return graph;
}

export function requirementsTypedDependencyRelationRefs(
  source: Row,
  from: string,
  to: string
): string[] {
  const carrier = `dependency:${from}->${to}`;
  return unique(
    rows(source.typedRelationProjections)
      .filter((projection) => strings(projection.carrierRefs).includes(carrier))
      .map((projection) => String(projection.relationId))
  );
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

export function projectRequirementsTypedGoalObligations(
  source: Row,
  spans: Row[]
): GoalExecutionObligation[] {
  const graph = graphOf(source);
  const actionIds = new Set(
    graph.sourceNodes
      .filter((node) => node.executionRole === 'action')
      .map((node) => node.sourceRootId)
  );
  const spansByNodeId = new Map<string, Row[]>();
  for (const span of spans) {
    for (const nodeId of resolveRequirementsSpecSpanSourceNodeIds(
      span as unknown as RequirementsSpecSpan,
      source.typedSourceAuthority as RequirementsTypedSourceAuthority,
      graph
    )) {
      const bindings = spansByNodeId.get(nodeId) ?? [];
      bindings.push(span);
      spansByNodeId.set(nodeId, bindings);
    }
  }
  return graph.sourceNodes
    .map((node) => {
      const id = node.sourceRootId;
      const matchedSpans = spansByNodeId.get(id) ?? [];
      const relationRefs = rows(source.typedRelationProjections)
        .filter((projection) => strings(projection.carrierRefs).includes(`obligation:${id}`))
        .map((projection) => String(projection.relationId));
      const sourceRefs = unique([
        id,
        ...node.declaredIds,
        ...relationRefs,
        ...[node.sourceBlockId, node.sourceClauseId].filter(
          (value): value is string => typeof value === 'string'
        ),
        ...matchedSpans.map((span) => String(span.specSpanId)),
      ]);
      const owner = node.scope.ownerId ?? node.scope.owner;
      const applicability =
        node.scope.kind === 'global'
          ? { scope: 'global', sourceRefs }
          : typeof owner === 'string' && actionIds.has(owner)
            ? { scope: 'obligations', obligationRefs: [owner], sourceRefs }
            : { scope: 'source_scope', sourceScope: structuredClone(node.scope), sourceRefs };
      const conditions = node.conditions.map((value) => {
        const condition = record(value);
        if (typeof condition.text !== 'string' || !condition.text.length) fail('condition_invalid');
        return {
          ...structuredClone(condition),
          sourceRefs: unique([...strings(condition.sourceRefs), ...sourceRefs]),
          state: 'unevaluated',
        };
      });
      const canonicalProjection = record(record(node).typedReferences).canonicalProjection;
      const executionAttributes = record(record(canonicalProjection).attributes);
      const executionClass = text(executionAttributes.executionClass);
      const ownedProductionPaths = Array.isArray(executionAttributes.ownedProductionPaths)
        ? strings(executionAttributes.ownedProductionPaths).join(', ')
        : text(executionAttributes.ownedProductionPaths);
      const aggregateGatePhase = text(executionAttributes.aggregateGatePhase);
      const aggregateValidationCommands = strings(executionAttributes.aggregateValidationCommands);
      const declaredTaskExecution = record(node).taskExecution;
      const taskExecution =
        declaredTaskExecution !== undefined
          ? structuredClone(declaredTaskExecution)
          : executionClass && ownedProductionPaths
            ? {
                executionClass,
                ownedProductionPaths,
                sourceRefs: unique([
                  id,
                  ...[node.sourceBlockId].filter(
                    (value): value is string => typeof value === 'string'
                  ),
                ]),
                ...(aggregateGatePhase ? { aggregateGatePhase } : {}),
                ...(aggregateValidationCommands.length > 0 ? { aggregateValidationCommands } : {}),
              }
            : undefined;
      return {
        obligationId: id,
        kind: obligationKind(node),
        text: node.text,
        sourceRefs,
        ...(node.executionRole === 'action'
          ? { oracle: resolveTypedSourceActionOracle(graph, id) }
          : {}),
        atomRefs: node.executionRole === 'action' ? [`${id}-A1`] : [],
        evidenceClaimRefs: unique(matchedSpans.flatMap((span) => strings(span.evidenceClaimRefs))),
        executionRole: node.executionRole,
        normativeStrength: node.normativeStrength,
        polarity: node.polarity,
        ...(taskExecution ? { taskExecution } : {}),
        conditions,
        applicability,
        typedSourceNode: structuredClone(node),
        ...(node.priority !== undefined ? { priority: structuredClone(node.priority) } : {}),
      };
    })
    .sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

export function assertRequirementsTypedProjection(input: {
  semanticSource: Row;
  obligations: GoalExecutionObligation[];
  logicalSpecSpans: Row[];
  atoms?: Row[];
  executionConstraints?: Row[];
}): void {
  const expected = projectRequirementsTypedGoalObligations(
    input.semanticSource,
    input.logicalSpecSpans
  );
  const actual = [...input.obligations].sort((a, b) =>
    a.obligationId.localeCompare(b.obligationId)
  );
  if (sha256Stable(expected) !== sha256Stable(actual)) fail('obligation_projection_mismatch');
  if (input.atoms) {
    const action = expected.filter((row) => row.executionRole === 'action');
    if (
      input.atoms.length !== action.length ||
      action.some((row) => {
        const atoms = input.atoms!.filter(
          (atom) => (atom.requirementRef ?? atom.coverageSeed) === row.obligationId
        );
        return (
          atoms.length !== 1 ||
          (atoms[0].id ?? atoms[0].atomId) !== row.atomRefs[0] ||
          atoms[0].oracle !== row.oracle
        );
      })
    )
      fail('action_membership_invalid');
    if (
      !Array.isArray(input.semanticSource.typedAtoms) ||
      sha256Stable(input.atoms) !== sha256Stable(input.semanticSource.typedAtoms)
    )
      fail('atom_projection_mismatch');
  }
  if (
    input.executionConstraints &&
    (!Array.isArray(input.semanticSource.typedExecutionConstraints) ||
      sha256Stable(input.executionConstraints) !==
        sha256Stable(input.semanticSource.typedExecutionConstraints))
  )
    fail('constraint_projection_mismatch');
}

export function requirementsTypedConstraintMetadata(constraint: Row): Row {
  const fields = [
    'conditions',
    'scope',
    'disposition',
    'authorityKind',
    'applicableSourceRefs',
    'sourceRefs',
    'premiseRefs',
    'derivationReceiptRefs',
    'declarationStatus',
    'modality',
    'sourceDeclarationRefs',
    'coverageRole',
    'declarationRole',
  ];
  return Object.fromEntries(
    fields
      .filter((field) => constraint[field] !== undefined)
      .map((field) => [field, structuredClone(constraint[field])])
  );
}

function validateConstraintProjections(ir: Row): void {
  const constraints = rows(record(ir.semanticSource).typedExecutionConstraints);
  const sorted = (values: Row[], key: string) =>
    [...values].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  for (const [kind, collection, id, value] of [
    ['CMD', 'commands', 'commandId', 'invocation'],
    ['ART', 'artifacts', 'artifactId', 'logicalPath'],
    ['EVDREQ', 'evidenceContracts', 'evidenceContractId', 'requirement'],
    ['CTM', 'coExecutionConstraints', 'constraintId', ''],
  ] as const) {
    const expected = constraints
      .filter(
        (row) =>
          row.kind === kind &&
          (kind !== 'CTM' || row.declarationRole !== 'dependency_constraint') &&
          (kind !== 'CMD' ||
            ((row.modality === undefined || row.modality === 'required') &&
              row.coverageRole !== 'non_action_declaration'))
      )
      .map((row) => ({
        [id]: row.constraintId,
        ...requirementsTypedConstraintMetadata(row),
        ...(kind === 'CTM'
          ? {
              kind: 'must_link',
              taskRefs: rows(ir.atomicTasks)
                .filter((task) =>
                  strings(row.applicableAtomRefs).some((ref) =>
                    strings(task.atomRefs).includes(ref)
                  )
                )
                .map((task) => task.taskId),
            }
          : {
              [value]: String(row.canonicalValue).trim(),
              obligationRefs: unique(strings(row.applicableMustRefs)),
              atomRefs: unique(strings(row.applicableAtomRefs)),
            }),
        basisRefs: unique([String(row.constraintId), ...strings(row.premiseRefs)]),
      }));
    if (sha256Stable(sorted(expected, id)) !== sha256Stable(sorted(rows(ir[collection]), id)))
      fail('constraint_projection_mismatch');
  }
  const stops = constraints.filter((row) => row.kind === 'STOP');
  if (
    sha256Stable(rows(record(ir.logicalScopes).pathRestrictions)) !==
      sha256Stable(
        sorted(
          stops.filter((row) => typeof row.scope !== 'object'),
          'constraintId'
        )
      ) ||
    sha256Stable(rows(record(ir.logicalScopes).stopConditions)) !==
      sha256Stable(
        sorted(
          stops.filter((row) => typeof row.scope === 'object'),
          'constraintId'
        )
      ) ||
    sha256Stable(record(ir.logicalScopes).ownedPaths) !==
      sha256Stable(
        unique(
          constraints
            .filter((row) => row.kind === 'PATH')
            .map((row) => String(row.canonicalValue).trim())
        )
      )
  ) {
    fail('constraint_projection_mismatch');
  }
}

export function validateRequirementsTypedGoalIr(ir: Row): void {
  const source = record(ir.semanticSource);
  assertRequirementsTypedProjection({
    semanticSource: source,
    obligations: rows(ir.obligations) as GoalExecutionObligation[],
    logicalSpecSpans: rows(ir.logicalSpecSpans),
    atoms: rows(source.typedAtoms),
    executionConstraints: rows(source.typedExecutionConstraints),
  });
  const actions = rows(ir.obligations).filter((row) => row.executionRole === 'action');
  const tasks = rows(ir.atomicTasks);
  if (
    tasks.length !== actions.length ||
    actions.some((row) => {
      const matches = tasks.filter((task) =>
        strings(task.obligationRefs).includes(String(row.obligationId))
      );
      return (
        matches.length !== 1 ||
        sha256Stable(matches[0].atomRefs) !== sha256Stable(row.atomRefs) ||
        matches[0].oracle !== row.oracle
      );
    })
  )
    fail('task_projection_mismatch');
  const taskByObligation = new Map(
    tasks.flatMap((task) =>
      strings(task.obligationRefs).map((ref) => [ref, String(task.taskId)] as const)
    )
  );
  for (const projection of rows(source.typedRelationProjections).filter((row) =>
    strings(row.carrierRefs).some((carrier) => carrier.startsWith('dependency:'))
  )) {
    const carrier = strings(projection.carrierRefs).find((ref) => ref.startsWith('dependency:'))!;
    const [from, to] = carrier.slice('dependency:'.length).split('->');
    const fromTask = taskByObligation.get(from);
    const toTask = taskByObligation.get(to);
    const dependency = rows(ir.dependencies).find(
      (row) => row.from === fromTask && row.to === toTask
    );
    if (!dependency || !strings(dependency.basisRefs).includes(String(projection.relationId))) {
      fail('relation_projection_missing');
    }
  }
  validateConstraintProjections(ir);
}

export function assertRequirementsTypedAuthorityMatchesGoal(
  semanticIr: Row,
  goalExecutionIr: Row
): void {
  const expectedSource = requirementsTypedSemanticSource(semanticIr);
  if (
    !['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(String(goalExecutionIr.schemaVersion)) ||
    goalExecutionIr.profile !== 'requirements_backed' ||
    sha256Stable(expectedSource) !== sha256Stable(goalExecutionIr.semanticSource)
  )
    fail('external_authority_mismatch');
}
