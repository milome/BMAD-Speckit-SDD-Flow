import { encodeGoalSemanticDictionary, decodeGoalSemanticDictionary, type GoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { stableStringify } from './requirements-contract-semantic-resolver';
import { attachTypedSourceTaskExecutions, assertTypedSourceTaskExecutions } from './requirements-contract-typed-source-task-execution';

export const TYPED_SOURCE_AUTHORITY_VERSION = 'requirements-contract-typed-source-authority/v2' as const;
export const TYPED_SOURCE_GRAPH_VERSION = 'requirements-contract-typed-source-graph/v2' as const;
export const TYPED_SOURCE_ROLES = ['action', 'requirement', 'boundary', 'acceptance', 'guidance', 'binding', 'definition'] as const;
export type RequirementsSourceRole = (typeof TYPED_SOURCE_ROLES)[number];
export interface RequirementsTypedSourceNode {
  sourceRootId: string;
  executionRole: RequirementsSourceRole;
  text: string;
  polarity: string;
  normativeStrength: string;
  conditions: unknown[];
  scope: Record<string, unknown>;
  declaredIds: string[];
  [key: string]: unknown;
}
export interface RequirementsTypedSourceRelation {
  relationId: string;
  kind: string;
  from: string;
  to: string;
  blockId: string;
  [key: string]: unknown;
}
export interface RequirementsTypedSourceGraph {
  schemaVersion: typeof TYPED_SOURCE_GRAPH_VERSION;
  sourceNodes: RequirementsTypedSourceNode[];
  sourceRelations: RequirementsTypedSourceRelation[];
  sourceBlocks: Record<string, unknown>[];
  commandDeclarations: Record<string, unknown>[];
  workDeclarations: Record<string, unknown>[];
  scenarioDeclarations: Record<string, unknown>[];
  fixDeclarations: Record<string, unknown>[];
  sections: Record<string, unknown>[];
}
export interface RequirementsTypedSourceAuthority {
  schemaVersion: typeof TYPED_SOURCE_AUTHORITY_VERSION;
  graph: GoalSemanticDictionary;
  graphHash: string;
}
export interface RequirementsTypedSourceBinding {
  sourceArtifactRef: string;
  byteStart: number;
  byteEnd: number;
  [key: string]: unknown;
}
export interface RequirementsTypedCoverageRow {
  sourceRootId: string;
  executionRole: RequirementsSourceRole;
  coverageKind: RequirementsSourceRole;
  actionRefs: string[];
  relationRefs: string[];
}
export interface RequirementsTypedSourceCoverage {
  schemaVersion: 'requirements-contract-typed-source-coverage/v2';
  graphHash: string;
  coverage: GoalSemanticDictionary;
  coverageHash: string;
}

const PHYSICAL_KEYS = new Set(['sourceBinding', 'sourcePath', 'sourceArtifactRef', 'byteStart', 'byteEnd',
  'startByte', 'endByteExclusive', 'sourceLine', 'lineStart', 'lineEnd', 'physicalLocator']);
const NODE_KEYS = new Set(['sourceRootId', 'schemaVersion', 'executionRole', 'text', 'polarity', 'normativeStrength',
  'conditions', 'scope', 'declaredIds', 'sourceBlockId', 'sourceClauseId', 'sourceDisposition', 'expectedOutcome',
  'executionConstraints', 'executionConstraintRefs', 'atomDependencies', 'oracle', 'priority', 'typedReferences', 'taskExecution']);
function fail(code: string): never { throw new Error(`requirements_typed_source_${code}`); }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function assertNoPhysical(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(assertNoPhysical); return; }
  if (!object(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (PHYSICAL_KEYS.has(key)) fail('physical_binding_forbidden');
    assertNoPhysical(child);
  }
}

export function validateTypedSourceGraph(value: unknown, complete = false): asserts value is RequirementsTypedSourceGraph {
  if (!object(value) || value.schemaVersion !== TYPED_SOURCE_GRAPH_VERSION) fail('graph_schema_invalid');
  const fields = ['schemaVersion', 'sourceNodes', 'sourceRelations', 'sourceBlocks', 'commandDeclarations',
    'workDeclarations', 'scenarioDeclarations', 'fixDeclarations', 'sections'];
  if (Object.keys(value).some((key) => !fields.includes(key))) fail('graph_field_unknown');
  for (const key of fields.slice(1)) if (!Array.isArray(value[key])) fail('graph_collection_invalid');
  assertNoPhysical(value);
  const ids = new Set<string>();
  for (const node of value.sourceNodes as unknown[]) {
    if (!object(node) || !nonempty(node.sourceRootId) || !nonempty(node.text) ||
      !TYPED_SOURCE_ROLES.includes(node.executionRole as RequirementsSourceRole) ||
      !['required', 'forbidden', 'permitted', 'descriptive', 'preserve', 'mixed'].includes(String(node.polarity)) ||
      !['must', 'should', 'may', 'descriptive'].includes(String(node.normativeStrength)) ||
      !Array.isArray(node.conditions) || !object(node.scope) || !Array.isArray(node.declaredIds) ||
      !node.declaredIds.every(nonempty)) fail('node_schema_invalid');
    if (Object.keys(node).some((key) => !NODE_KEYS.has(key))) fail('node_field_unknown');
    if (ids.has(node.sourceRootId)) fail('node_id_duplicate');
    ids.add(node.sourceRootId);
    if (node.executionRole === 'action' && (node.polarity !== 'required' || node.normativeStrength !== 'must')) {
      fail('action_modality_invalid');
    }
  }
  const relationIds = new Set<string>();
  for (const relation of value.sourceRelations as unknown[]) {
    if (!object(relation) || !['relationId', 'kind', 'from', 'to', 'blockId'].every((key) => nonempty(relation[key]))) {
      fail('relation_schema_invalid');
    }
    const id = String(relation.relationId);
    if (relationIds.has(id)) fail('relation_id_duplicate');
    relationIds.add(id);
  }
  for (const key of fields.slice(3)) {
    if (!(value[key] as unknown[]).every(object)) fail('declaration_schema_invalid');
    const declarationIds = new Set<string>();
    for (const declaration of value[key] as Record<string, unknown>[]) {
      const validId = nonempty(declaration.id) || (key === 'sections' && Number.isSafeInteger(declaration.id) && Number(declaration.id) >= 0);
      if (!validId || declarationIds.has(String(declaration.id))) fail('declaration_identity_invalid');
      declarationIds.add(String(declaration.id));
    }
  }
  if (complete) {
    assertTypedSourceTaskExecutions(value as unknown as RequirementsTypedSourceGraph);
    const known = new Set<string>(ids);
    for (const node of value.sourceNodes as Record<string, unknown>[]) {
      for (const ref of [...node.declaredIds as string[], node.sourceClauseId]) if (nonempty(ref)) known.add(ref);
    }
    for (const key of fields.slice(3)) for (const declaration of value[key] as Record<string, unknown>[]) {
      known.add(key === 'sections' && typeof declaration.id === 'number' ? `SECTION-${declaration.id}` : String(declaration.id));
    }
    const blockIds = new Set((value.sourceBlocks as Record<string, unknown>[]).map((block) => String(block.id)));
    for (const relation of value.sourceRelations as RequirementsTypedSourceRelation[]) {
      if (!blockIds.has(relation.blockId)) fail('relation_block_unknown');
      if (relation.kind === 'source_mentions') continue;
      for (const endpoint of [relation.from, relation.to]) {
        if (/^(?:(?:WORK|REQ|AC|FIX|AUDIT|DIRTY|FIXTURE|CMD)-|B[0-9]{4}(?::C[0-9]+)?$)/u.test(endpoint) && !known.has(endpoint)) {
          fail('relation_endpoint_unknown');
        }
      }
    }
  }
}

export function createTypedSourceAuthority(graph: RequirementsTypedSourceGraph): RequirementsTypedSourceAuthority {
  validateTypedSourceGraph(graph);
  const normalized = attachTypedSourceTaskExecutions(graph);
  validateTypedSourceGraph(normalized, true);
  const dictionary = encodeGoalSemanticDictionary(normalized);
  return { schemaVersion: TYPED_SOURCE_AUTHORITY_VERSION, graph: dictionary, graphHash: dictionary.expandedHash };
}

export function resolveTypedSourceAuthority(value: unknown): RequirementsTypedSourceGraph {
  if (!object(value) || value.schemaVersion !== TYPED_SOURCE_AUTHORITY_VERSION ||
    Object.keys(value).some((key) => !['schemaVersion', 'graph', 'graphHash'].includes(key)) || !object(value.graph)) {
    fail('authority_schema_invalid');
  }
  if (value.graphHash !== value.graph.expandedHash) fail('graph_hash_mismatch');
  const graph = decodeGoalSemanticDictionary(value.graph);
  validateTypedSourceGraph(graph, true);
  return graph;
}

export function validateTypedSourceAuthority(value: unknown): boolean {
  try { resolveTypedSourceAuthority(value); return true; } catch { return false; }
}

export function resolveTypedSourceActionOracle(graph: RequirementsTypedSourceGraph, sourceRootId: string): string {
  const work = graph.workDeclarations.find((entry) => entry.id === sourceRootId);
  if (!work || !Array.isArray(work.pass) || work.pass.length === 0 ||
    !work.pass.every((entry) => object(entry) && nonempty(entry.text))) {
    throw new Error('requirements_typed_action_oracle_missing');
  }
  return (work.pass as Array<{ text: string }>).map((entry) => entry.text).join('\n');
}

function expectedCoverageRows(graph: RequirementsTypedSourceGraph): RequirementsTypedCoverageRow[] {
  const actions = new Set(graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId));
  const ownersByBlock = new Map<string, Set<string>>();
  const ownersByScope = new Map<string, Set<string>>();
  const add = (index: Map<string, Set<string>>, key: string, owner: string) => {
    const owners = index.get(key) ?? new Set<string>(); owners.add(owner); index.set(key, owners);
  };
  for (const work of graph.workDeclarations) {
    if (!actions.has(String(work.id))) fail('work_action_missing');
    for (const block of Array.isArray(work.blockIds) ? work.blockIds : []) add(ownersByBlock, String(block), String(work.id));
  }
  for (const scenario of graph.scenarioDeclarations) {
    for (const work of Array.isArray(scenario.works) ? scenario.works : []) {
      if (!actions.has(String(work))) fail('scenario_action_unknown');
      add(ownersByScope, String(scenario.id), String(work));
    }
  }
  const relationsByEndpoint = new Map<string, RequirementsTypedSourceRelation[]>();
  for (const relation of graph.sourceRelations) {
    for (const endpoint of new Set([relation.from, relation.to, relation.blockId])) {
      const list = relationsByEndpoint.get(endpoint) ?? []; list.push(relation); relationsByEndpoint.set(endpoint, list);
    }
    if (actions.has(relation.from) && /^SECTION-[0-9]+$/u.test(relation.to) && relation.kind !== 'source_mentions') {
      add(ownersByScope, relation.to, relation.from);
    }
  }
  return graph.sourceNodes.map((node) => {
    const actionRefs = new Set<string>();
    const relationRefs = new Set<string>();
    if (node.executionRole === 'action') actionRefs.add(node.sourceRootId);
    else {
      for (const owner of ownersByBlock.get(String(node.sourceBlockId)) ?? []) actionRefs.add(owner);
      const scopeOwner = String(node.scope.owner ?? node.scope.ownerId ?? '');
      if (actions.has(scopeOwner)) actionRefs.add(scopeOwner);
      for (const owner of ownersByScope.get(scopeOwner) ?? []) actionRefs.add(owner);
    }
    const refs = new Set([node.sourceRootId, String(node.sourceBlockId ?? ''), String(node.sourceClauseId ?? ''), ...node.declaredIds]);
    for (const ref of refs) for (const relation of relationsByEndpoint.get(ref) ?? []) {
      relationRefs.add(relation.relationId);
      if (node.executionRole === 'action' || relation.kind === 'source_mentions' || relation.kind === 'depends_on') continue;
      if (actions.has(relation.from)) actionRefs.add(relation.from);
      if (actions.has(relation.to)) actionRefs.add(relation.to);
      if (relation.kind === 'global_boundary' && relation.to === 'ALL_WORKS') for (const action of actions) actionRefs.add(action);
    }
    return { sourceRootId: node.sourceRootId, executionRole: node.executionRole, coverageKind: node.executionRole,
      actionRefs: [...actionRefs].sort(), relationRefs: [...relationRefs].sort() };
  }).sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
}

export function createTypedSourceCoverage(authority: RequirementsTypedSourceAuthority): RequirementsTypedSourceCoverage {
  const coverage = encodeGoalSemanticDictionary({ nodes: expectedCoverageRows(resolveTypedSourceAuthority(authority)) });
  return { schemaVersion: 'requirements-contract-typed-source-coverage/v2', graphHash: authority.graphHash,
    coverage, coverageHash: coverage.expandedHash };
}

export function resolveTypedSourceCoverage(value: unknown, authority: RequirementsTypedSourceAuthority): { nodes: RequirementsTypedCoverageRow[] } {
  const graph = resolveTypedSourceAuthority(authority);
  if (!object(value) || value.schemaVersion !== 'requirements-contract-typed-source-coverage/v2' ||
    value.graphHash !== authority.graphHash || !object(value.coverage) || value.coverageHash !== value.coverage.expandedHash ||
    Object.keys(value).some((key) => !['schemaVersion', 'graphHash', 'coverage', 'coverageHash'].includes(key))) fail('coverage_identity_invalid');
  const decoded = decodeGoalSemanticDictionary(value.coverage);
  const expected = { nodes: expectedCoverageRows(graph) };
  if (stableStringify(decoded) !== stableStringify(expected)) fail('coverage_semantics_mismatch');
  return expected;
}

export function validateTypedSourceCoverage(value: unknown, authority: RequirementsTypedSourceAuthority): boolean {
  try { resolveTypedSourceCoverage(value, authority); return true; } catch { return false; }
}

export function assertTypedConfirmationProjection(confirmation: Record<string, unknown>): void {
  const authority = confirmation.typedSourceAuthority as RequirementsTypedSourceAuthority;
  const graph = resolveTypedSourceAuthority(authority);
  resolveTypedSourceCoverage(confirmation.typedCoverage, authority);
  const actionIds = graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId).sort();
  const must = Array.isArray(confirmation.must) ? confirmation.must as Record<string, unknown>[] : [];
  if (stableStringify(must.map((row) => String(row.id)).sort()) !== stableStringify(actionIds)) fail('confirmation_action_set_mismatch');
  const tasks = Array.isArray(confirmation.implementationTasks) ? confirmation.implementationTasks as Record<string, unknown>[] : [];
  if (stableStringify(tasks.map((row) => String(row.id)).sort()) !== stableStringify(actionIds.map((id) => `${id}-A1`).sort())) {
    fail('confirmation_task_set_mismatch');
  }
  for (const task of tasks) {
    const owner = String(task.id).replace(/-A1$/u, '');
    if (stableStringify(task.requirementRefs) !== stableStringify([owner])) fail('confirmation_task_owner_mismatch');
    const node = graph.sourceNodes.find((entry) => entry.sourceRootId === owner)!;
    if (stableStringify(task.taskExecution ?? null) !== stableStringify(node.taskExecution ?? null)) fail('confirmation_task_execution_mismatch');
  }
}

export function assertTypedSourceAtomRoles(semantics: Record<string, unknown>): void {
  const graph = semantics.typedSourceAuthority
    ? resolveTypedSourceAuthority(semantics.typedSourceAuthority)
    : semantics.schemaVersion === 'requirements-contract-typed-source-semantics/v2' && Array.isArray(semantics.sourceNodes)
      ? { sourceNodes: semantics.sourceNodes as RequirementsTypedSourceNode[] } : null;
  if (!graph) return;
  const nodeById = new Map(graph.sourceNodes.map((node) => [node.sourceRootId, node]));
  for (const atom of (Array.isArray(semantics.atoms) ? semantics.atoms : []) as Record<string, unknown>[]) {
    const refs = [atom.sourceRootId, atom.requirementRef, ...(Array.isArray(atom.authorityRefs) ? atom.authorityRefs : [])]
      .filter((ref): ref is string => typeof ref === 'string');
    if (refs.length === 0 || refs.some((ref) => nodeById.get(ref)?.executionRole !== 'action')) {
      throw new Error('requirements_semantic_atom_source_role_invalid');
    }
  }
}
