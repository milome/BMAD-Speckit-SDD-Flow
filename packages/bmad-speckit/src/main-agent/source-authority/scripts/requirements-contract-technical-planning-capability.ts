import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  resolveTypedSourceAuthority,
  TYPED_SOURCE_COMMAND_DECLARATION_CLASSES,
  TYPED_SOURCE_COMMAND_EXECUTION_MODES,
  TYPED_SOURCE_COMMAND_ROLES,
  type RequirementsTypedSourceAuthority,
  type RequirementsTypedSourceRelation,
} from './requirements-contract-typed-source-semantics';

export const REQUIREMENTS_TECHNICAL_EXECUTION_KINDS = [
  'ART',
  'CMD',
  'CTM',
  'EVDREQ',
  'PATH',
  'STOP',
] as const;

export type RequirementsTechnicalExecutionKind =
  (typeof REQUIREMENTS_TECHNICAL_EXECUTION_KINDS)[number];

export interface RequirementsTechnicalExecutionEntry {
  kind: RequirementsTechnicalExecutionKind;
  id: string;
  value: string;
  authorityKind?: 'source_declared' | 'derived';
  applicableSourceRefs?: string[];
  premiseRefs?: string[];
  derivationReceiptRefs?: string[];
  conditions?: unknown[];
  scope?: Record<string, unknown>;
  modality?: 'required' | 'suggested' | 'prohibited' | 'template' | 'context';
  sourceDeclarationRefs?: string[];
  coverageRole?: 'action_trace' | 'non_action_declaration';
  declarationRole?: string;
}

export interface RequirementsTechnicalPlanningCapabilityInput {
  schemaVersion?: 'requirements-contract-technical-planning-input/v2';
  authoringRequestId: string;
  authoringAttemptId: string;
  checkpointId: 'cp02' | 'g02';
  capability: {
    capabilityId: string;
    status: 'available' | 'unavailable';
    capabilityHash: string;
    configHash: string;
  };
  premiseHash: string;
  candidates: RequirementsTechnicalExecutionEntry[];
}

export interface RequirementsTechnicalPlanningCapabilityResult {
  schemaVersion: 'requirements-contract-technical-planning-capability/v1' | 'requirements-contract-technical-planning-capability/v2';
  authoringRequestId: string;
  authoringAttemptId: string;
  checkpointId: 'cp02' | 'g02';
  capabilityId: string;
  capabilityStatus: 'available' | 'unavailable';
  capabilityHash: string;
  configHash: string;
  premiseHash: string;
  triggerIdentity: string;
  status: 'resolved' | 'technical_planning_pending';
  issueCode: 'requirements_technical_planning_pending' | null;
  resumable: boolean;
  executionRegistry: {
    schemaVersion: 'requirements-contract-typed-execution-registry/v1' | 'requirements-contract-typed-execution-registry/v2';
    entries: RequirementsTechnicalExecutionEntry[];
    registryHash: string;
  } | null;
  resultHash: string;
}

export interface RequirementsProductionTechnicalAuthorityCandidate {
  sourceRootId: string;
  semanticBody: Record<string, unknown>;
}

export interface RequirementsTypedTechnicalRelationIndex {
  relationCount: number;
  buildVisitCount: number;
  indexedReferenceCount: number;
  byKind: (kind: string) => RequirementsTypedSourceRelation[];
  byKindFromTo: (kind: string, from: string, to: string) => RequirementsTypedSourceRelation[];
  byKindsTo: (kinds: readonly string[], to: string) => RequirementsTypedSourceRelation[];
  byKindsIncident: (kinds: readonly string[], nodeId: string) => RequirementsTypedSourceRelation[];
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const executionKinds = new Set<string>(REQUIREMENTS_TECHNICAL_EXECUTION_KINDS);

const relationKey = (...parts: string[]) => parts.join('\u0000');

export function indexTypedTechnicalRelations(
  relations: RequirementsTypedSourceRelation[]
): RequirementsTypedTechnicalRelationIndex {
  const byKind = new Map<string, RequirementsTypedSourceRelation[]>();
  const byKindFrom = new Map<string, RequirementsTypedSourceRelation[]>();
  const byKindTo = new Map<string, RequirementsTypedSourceRelation[]>();
  const byKindFromTo = new Map<string, RequirementsTypedSourceRelation[]>();
  const sourceOrder = new Map<string, number>();
  const add = (
    index: Map<string, RequirementsTypedSourceRelation[]>,
    key: string,
    relation: RequirementsTypedSourceRelation
  ) => {
    const bucket = index.get(key) ?? [];
    bucket.push(relation);
    index.set(key, bucket);
  };
  let buildVisitCount = 0;
  for (const relation of relations) {
    buildVisitCount += 1;
    sourceOrder.set(relation.relationId, buildVisitCount - 1);
    add(byKind, relation.kind, relation);
    add(byKindFrom, relationKey(relation.kind, relation.from), relation);
    add(byKindTo, relationKey(relation.kind, relation.to), relation);
    add(byKindFromTo, relationKey(relation.kind, relation.from, relation.to), relation);
  }
  const orderedUnique = (values: RequirementsTypedSourceRelation[]) =>
    [...new Map(values.map((relation) => [relation.relationId, relation])).values()]
      .sort((left, right) =>
        (sourceOrder.get(left.relationId) ?? 0) - (sourceOrder.get(right.relationId) ?? 0));
  const indexedReferenceCount = [...byKind.values(), ...byKindFrom.values(),
    ...byKindTo.values(), ...byKindFromTo.values()]
    .reduce((count, bucket) => count + bucket.length, 0);
  return Object.freeze({
    relationCount: relations.length,
    buildVisitCount,
    indexedReferenceCount,
    byKind: (kind: string) => [...(byKind.get(kind) ?? [])],
    byKindFromTo: (kind: string, from: string, to: string) =>
      [...(byKindFromTo.get(relationKey(kind, from, to)) ?? [])],
    byKindsTo: (kinds: readonly string[], to: string) => orderedUnique(
      kinds.flatMap((kind) => byKindTo.get(relationKey(kind, to)) ?? [])
    ),
    byKindsIncident: (kinds: readonly string[], nodeId: string) => orderedUnique(
      kinds.flatMap((kind) => [
        ...(byKindFrom.get(relationKey(kind, nodeId)) ?? []),
        ...(byKindTo.get(relationKey(kind, nodeId)) ?? []),
      ])
    ),
  });
}

function normalized(value: string, issueCode: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(issueCode);
  return value.normalize('NFC');
}

function canonicalEntries(
  entries: RequirementsTechnicalExecutionEntry[],
  typed = false
): RequirementsTechnicalExecutionEntry[] {
  if (!Array.isArray(entries)) throw new Error('requirements_technical_candidates_invalid');
  const normalizedEntries = entries.map((entry) => {
    if (!entry || !executionKinds.has(entry.kind)) {
      throw new Error('requirements_technical_candidate_kind_invalid');
    }
    const canonical = {
      kind: entry.kind,
      id: normalized(entry.id, 'requirements_technical_candidate_id_invalid'),
      value: normalized(entry.value, 'requirements_technical_candidate_value_invalid'),
    };
    if (!typed) {
      if (Object.keys(entry).some((key) => !['kind', 'id', 'value'].includes(key))) {
        throw new Error('requirements_technical_typed_entry_version_required');
      }
      return canonical;
    }
    if (!['source_declared', 'derived'].includes(String(entry.authorityKind)) ||
      !Array.isArray(entry.conditions) || !entry.scope || typeof entry.scope !== 'object' || Array.isArray(entry.scope)) {
      throw new Error('requirements_technical_typed_entry_invalid');
    }
    const refs: Record<string, string[]> = {};
    for (const key of ['applicableSourceRefs', 'premiseRefs', 'derivationReceiptRefs'] as const) {
      if (!Array.isArray(entry[key]) || !entry[key]!.every((ref) => typeof ref === 'string' && ref.length > 0)) {
        throw new Error('requirements_technical_typed_entry_refs_invalid');
      }
      refs[key] = [...new Set(entry[key])].sort();
    }
    if (Object.keys(entry).some((key) => !['kind', 'id', 'value', 'authorityKind',
      'applicableSourceRefs', 'premiseRefs', 'derivationReceiptRefs', 'conditions', 'scope', 'modality', 'sourceDeclarationRefs',
      'coverageRole', 'declarationRole'].includes(key))) {
      throw new Error('requirements_technical_typed_entry_field_unknown');
    }
    if (entry.modality !== undefined && !['required', 'suggested', 'prohibited', 'template', 'context'].includes(entry.modality)) {
      throw new Error('requirements_technical_typed_entry_modality_invalid');
    }
    if (entry.sourceDeclarationRefs !== undefined && (!Array.isArray(entry.sourceDeclarationRefs) ||
      !entry.sourceDeclarationRefs.every((ref) => typeof ref === 'string' && ref.length > 0) ||
      new Set(entry.sourceDeclarationRefs).size !== entry.sourceDeclarationRefs.length)) {
      throw new Error('requirements_technical_typed_entry_declaration_refs_invalid');
    }
    if (entry.coverageRole !== undefined &&
      !['action_trace', 'non_action_declaration'].includes(entry.coverageRole)) {
      throw new Error('requirements_technical_typed_entry_coverage_role_invalid');
    }
    if (entry.declarationRole !== undefined &&
      (typeof entry.declarationRole !== 'string' || entry.declarationRole.length === 0)) {
      throw new Error('requirements_technical_typed_entry_declaration_role_invalid');
    }
    return { ...canonical, authorityKind: entry.authorityKind, ...refs,
      conditions: structuredClone(entry.conditions), scope: structuredClone(entry.scope),
      ...(entry.modality === undefined ? {} : { modality: entry.modality }),
      ...(entry.sourceDeclarationRefs === undefined ? {} : { sourceDeclarationRefs: [...entry.sourceDeclarationRefs].sort() }),
      ...(entry.coverageRole === undefined ? {} : { coverageRole: entry.coverageRole }),
      ...(entry.declarationRole === undefined ? {} : { declarationRole: entry.declarationRole }) };
  });
  normalizedEntries.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)
  );
  const identities = normalizedEntries.map((entry) => `${entry.kind}:${entry.id}`);
  if (new Set(identities).size !== identities.length) {
    throw new Error('requirements_technical_candidate_duplicate');
  }
  return normalizedEntries;
}

function hashPayload(
  input: Omit<RequirementsTechnicalPlanningCapabilityResult, 'resultHash'>
): string {
  return sha256Stable({
    domain: input.schemaVersion === 'requirements-contract-technical-planning-capability/v2'
      ? 'requirements-contract-technical-planning-capability-result/v2' : 'requirements-contract-technical-planning-capability-result/v1',
    payload: input,
  });
}

export function resolveRequirementsTechnicalPlanningCapability(
  input: RequirementsTechnicalPlanningCapabilityInput
): RequirementsTechnicalPlanningCapabilityResult {
  const authoringRequestId = normalized(
    input.authoringRequestId,
    'requirements_technical_authoring_request_id_invalid'
  );
  const authoringAttemptId = normalized(
    input.authoringAttemptId,
    'requirements_technical_authoring_attempt_id_invalid'
  );
  const capabilityId = normalized(
    input.capability?.capabilityId,
    'requirements_technical_capability_id_invalid'
  );
  if (!['cp02', 'g02'].includes(input.checkpointId)) {
    throw new Error('requirements_technical_checkpoint_invalid');
  }
  if (!['available', 'unavailable'].includes(input.capability?.status)) {
    throw new Error('requirements_technical_capability_status_invalid');
  }
  if (
    !SHA256.test(input.capability.capabilityHash) ||
    !SHA256.test(input.capability.configHash) ||
    !SHA256.test(input.premiseHash)
  ) {
    throw new Error('requirements_technical_identity_hash_invalid');
  }
  const typed = input.schemaVersion === 'requirements-contract-technical-planning-input/v2';
  const entries = canonicalEntries(input.candidates, typed);
  const triggerIdentity = sha256Stable({
    domain: 'requirements-technical-planning-trigger/v1',
    authoringRequestId,
    authoringAttemptId,
    checkpointId: input.checkpointId,
    capabilityId,
    capabilityHash: input.capability.capabilityHash,
    configHash: input.capability.configHash,
    premiseHash: input.premiseHash,
  });
  const pending = input.capability.status === 'unavailable';
  const executionRegistry = pending
    ? null
    : {
        schemaVersion: typed ? 'requirements-contract-typed-execution-registry/v2' as const : 'requirements-contract-typed-execution-registry/v1' as const,
        entries,
        registryHash: sha256Stable({
          domain: typed ? 'requirements-contract-typed-execution-registry/v2' : 'requirements-contract-typed-execution-registry/v1',
          entries,
        }),
      };
  const payload: Omit<RequirementsTechnicalPlanningCapabilityResult, 'resultHash'> = {
    schemaVersion: typed ? 'requirements-contract-technical-planning-capability/v2' : 'requirements-contract-technical-planning-capability/v1',
    authoringRequestId,
    authoringAttemptId,
    checkpointId: input.checkpointId,
    capabilityId,
    capabilityStatus: input.capability.status,
    capabilityHash: input.capability.capabilityHash,
    configHash: input.capability.configHash,
    premiseHash: input.premiseHash,
    triggerIdentity,
    status: pending ? 'technical_planning_pending' : 'resolved',
    issueCode: pending ? 'requirements_technical_planning_pending' : null,
    resumable: pending,
    executionRegistry,
  };
  return { ...payload, resultHash: hashPayload(payload) };
}

export function resolveRequirementsProductionTechnicalPlanningCapability(input: {
  authoringRequestId: string;
  authoringAttemptId: string;
  premiseHash: string;
  sourceRootCandidates: RequirementsProductionTechnicalAuthorityCandidate[];
  typedSourceAuthority?: RequirementsTypedSourceAuthority;
}): RequirementsTechnicalPlanningCapabilityResult {
  if (!Array.isArray(input.sourceRootCandidates)) {
    throw new Error('requirements_technical_authority_candidates_invalid');
  }
  const candidates = input.sourceRootCandidates.flatMap((candidate) => {
    if (!normalized(candidate.sourceRootId, 'requirements_technical_source_root_id_invalid')) {
      throw new Error('requirements_technical_source_root_id_invalid');
    }
    const declared = candidate.semanticBody?.executionConstraints;
    if (declared === undefined) return [];
    if (!Array.isArray(declared)) {
      throw new Error('requirements_technical_candidates_invalid');
    }
    return declared as RequirementsTechnicalExecutionEntry[];
  });
  if (input.typedSourceAuthority) candidates.push(...resolveTypedTechnicalDeclarations(input.typedSourceAuthority));
  const status = candidates.length > 0 ? 'available' as const : 'unavailable' as const;
  const typed = input.sourceRootCandidates.some((candidate) => candidate.semanticBody.schemaVersion === 'requirements-contract-source-node/v2');
  const capabilityId = 'requirements-production-technical-planner';
  return resolveRequirementsTechnicalPlanningCapability({
    ...(typed ? { schemaVersion: 'requirements-contract-technical-planning-input/v2' as const } : {}),
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    checkpointId: 'cp02',
    capability: {
      capabilityId,
      status,
      capabilityHash: sha256Stable({
        domain: 'requirements-production-technical-planner-capability/v1',
        capabilityId,
        status,
      }),
      configHash: sha256Stable({
        domain: 'requirements-production-technical-planner-config/v1',
        candidates: canonicalEntries(candidates, typed),
      }),
    },
    premiseHash: input.premiseHash,
    candidates,
  });
}

export function resolveTypedTechnicalDeclarations(
  authority: RequirementsTypedSourceAuthority,
  options: { commandSemantics?: 'normalized' | 'legacy_v2' } = {}
): RequirementsTechnicalExecutionEntry[] {
  const graph = resolveTypedSourceAuthority(authority);
  const commandSemantics = options.commandSemantics ?? 'normalized';
  const actions = new Set(graph.sourceNodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId));
  const entries: RequirementsTechnicalExecutionEntry[] = [];
  const add = (kind: RequirementsTechnicalExecutionKind, key: string, value: string, owners: string[], declarationRefs: string[],
    scope: Record<string, unknown>, conditions: unknown[] = [], modality: RequirementsTechnicalExecutionEntry['modality'] = 'required',
    declaration?: Pick<RequirementsTechnicalExecutionEntry, 'coverageRole' | 'declarationRole'>) => {
    if (!value.trim()) throw new Error('requirements_technical_source_declaration_value_missing');
    entries.push({ kind, id: `${kind}-${sha256Stable({ key, value }).slice(7, 31)}`, value,
      authorityKind: 'source_declared', applicableSourceRefs: [...new Set(owners)].sort(),
      premiseRefs: [...declarationRefs].sort(), derivationReceiptRefs: [], conditions, scope, modality,
      sourceDeclarationRefs: [...declarationRefs].sort(), ...declaration });
  };
  const commandOwners = new Map<string, Set<string>>();
  const includedCommands = new Map<string, string[]>();
  const relationIndex = indexTypedTechnicalRelations(graph.sourceRelations);
  for (const relation of relationIndex.byKind('command_set_includes')) {
    const children = includedCommands.get(relation.from) ?? []; children.push(relation.to); includedCommands.set(relation.from, children);
  }
  const bindCommand = (id: string, owner: string, visited = new Set<string>()) => {
    if (visited.has(id)) return;
    visited.add(id);
    const owners = commandOwners.get(id) ?? new Set<string>(); owners.add(owner); commandOwners.set(id, owners);
    for (const child of includedCommands.get(id) ?? []) bindCommand(child, owner, visited);
  };
  for (const work of graph.workDeclarations) {
    const owner = String(work.id);
    if (!actions.has(owner)) throw new Error('requirements_technical_work_action_unknown');
    for (const command of Array.isArray(work.commandIds) ? work.commandIds : []) bindCommand(String(command), owner);
    for (const field of ['productPaths', 'testPaths'] as const) {
      for (const target of Array.isArray(work[field]) ? work[field] : []) {
        const value = typeof target === 'string' ? target : target && typeof target === 'object' &&
          typeof target.raw === 'string' && typeof target.resolved === 'string' ? target.resolved : null;
        if (!value) throw new Error('requirements_technical_source_path_invalid');
        const relationKind = field === 'productPaths' ? 'allows_product_file' : 'allows_test_file';
        const relationRefs = relationIndex.byKindFromTo(relationKind, owner, value)
          .map((relation) => relation.relationId);
        add('PATH', `${owner}:${field}:${value}`, value, [owner], [owner, ...relationRefs], { kind: 'work', owner },
          typeof target === 'string' ? [] : [{ kind: 'source_declared_path', declaration: structuredClone(target) }]);
      }
    }
    for (const stop of Array.isArray(work.stop) ? work.stop as Record<string, unknown>[] : []) {
      add('STOP', `${owner}:${String(stop.blockId)}`, String(stop.text ?? ''), [owner], [String(stop.blockId)], { kind: 'work', owner });
    }
  }
  for (const scenario of graph.scenarioDeclarations) {
    const scenarioOwners = (Array.isArray(scenario.works) ? scenario.works : []).map(String);
    for (const owner of scenarioOwners) {
      if (!actions.has(String(owner))) throw new Error('requirements_technical_scenario_action_unknown');
      for (const command of Array.isArray(scenario.commandIds) ? scenario.commandIds : []) bindCommand(String(command), String(owner));
    }
    for (const [field, relationKind] of [['productPaths', 'scenario_product_file']] as const) {
      for (const target of Array.isArray(scenario[field]) ? scenario[field] : []) {
        const value = typeof target === 'string' ? target : target && typeof target === 'object' &&
          typeof target.raw === 'string' && typeof target.resolved === 'string' ? target.resolved : null;
        if (!value) throw new Error('requirements_technical_source_path_invalid');
        const relationRefs = relationIndex.byKindFromTo(relationKind, String(scenario.id), value)
          .map((relation) => relation.relationId);
        add('PATH', `${String(scenario.id)}:${field}:${value}`, value, scenarioOwners, relationRefs,
          { kind: 'scenario', owner: scenario.id }, typeof target === 'string' ? [] :
            [{ kind: 'source_declared_path', declaration: structuredClone(target) }]);
      }
    }
    const nodeid = String(scenario.nodeid ?? '').trim();
    if (nodeid) {
      const relationRefs = relationIndex.byKindFromTo('scenario_test_nodeid', String(scenario.id), nodeid)
        .map((relation) => relation.relationId);
      add('PATH', `${String(scenario.id)}:nodeid:${nodeid}`, nodeid, scenarioOwners, relationRefs,
        { kind: 'scenario_test', owner: scenario.id });
    }
  }
  const legacyRunnableRoles = new Set([
    'global_verification_command',
    'green_command',
    'red_command',
    'regression_command',
    'verification_command',
  ]);
  const blocks = new Map(graph.sourceBlocks.map((block) => [String(block.id), block]));
  const nodeById = new Map(graph.sourceNodes.map((node) => [node.sourceRootId, node]));
  for (const command of graph.commandDeclarations) {
    const id = String(command.id);
    const sourceOwner = String(command.owner ?? '').trim();
    if (!sourceOwner) throw new Error('requirements_technical_source_declaration_owner_missing');
    if (commandSemantics === 'legacy_v2') {
      const role = String(command.role);
      if (!legacyRunnableRoles.has(role)) continue;
      const owners = [...(commandOwners.get(id) ?? [])];
      if (actions.has(String(command.owner))) owners.push(String(command.owner));
      const block = blocks.get(String(command.blockId));
      const blockScope = block?.scope as Record<string, unknown> | undefined;
      const scopeRelations = blockScope ? relationIndex.byKindsTo(
        ['dirty_worktree_protection', 'quality_gate', 'real_verification_requirements'],
        String(blockScope.owner)
      ).filter((relation) => actions.has(relation.from)) : [];
      owners.push(...scopeRelations.map((relation) => relation.from));
      add('CMD', id, String(command.expression ?? ''), owners,
        [id, ...scopeRelations.map((relation) => relation.relationId)],
        { kind: 'source_command', owner: command.owner,
          ...(scopeRelations.length ? { inheritedScope: blockScope } : {}) },
        [{ role, worktree: command.worktree ?? null, expectedExit: command.expectedExit ?? null,
          declaredContext: command.declaredContext ?? '', authorization: command.authorization ?? null }]);
      continue;
    }
    const sourceNode = nodeById.get(id);
    const projection = sourceNode?.typedReferences && typeof sourceNode.typedReferences === 'object'
      ? (sourceNode.typedReferences as Record<string, unknown>).canonicalProjection
      : null;
    const canonical = projection && typeof projection === 'object' && !Array.isArray(projection)
      ? projection as Record<string, unknown>
      : {};
    const canonicalAttributes = canonical.attributes && typeof canonical.attributes === 'object' && !Array.isArray(canonical.attributes)
      ? canonical.attributes as Record<string, unknown>
      : {};
    const hasCanonicalProjection = Object.keys(canonical).length > 0;
    const attributes = hasCanonicalProjection ? canonicalAttributes : command;
    const metadataFields = ['commandDeclarationClass', 'commandRole', 'executionMode'] as const;
    const metadataCount = metadataFields.filter((field) =>
      typeof attributes[field] === 'string' && String(attributes[field]).trim().length > 0).length;
    const legacyRole = String(command.role ?? '');
    const legacyExpression = String(command.expression ?? '').trim();
    if (metadataCount > 0 && metadataCount < metadataFields.length) {
      throw new Error('requirements_technical_source_declaration_metadata_partial');
    }
    if (metadataCount === 0 && hasCanonicalProjection) {
      throw new Error('requirements_technical_source_declaration_class_missing');
    }
    if (metadataCount === 0 && !TYPED_SOURCE_COMMAND_ROLES.includes(
      legacyRole as typeof TYPED_SOURCE_COMMAND_ROLES[number])) {
      throw new Error('requirements_technical_source_declaration_role_invalid');
    }
    if (metadataCount === 0 && legacyRole === 'source_command_set') {
      throw new Error('requirements_technical_source_declaration_metadata_required');
    }
    if (metadataCount === 0 && !legacyExpression) {
      throw new Error('requirements_technical_source_declaration_value_missing');
    }
    const declarationClass = metadataCount === 0
      ? 'executable_expression'
      : String(attributes.commandDeclarationClass);
    if (!TYPED_SOURCE_COMMAND_DECLARATION_CLASSES.includes(
      declarationClass as typeof TYPED_SOURCE_COMMAND_DECLARATION_CLASSES[number])) {
      throw new Error('requirements_technical_source_declaration_class_invalid');
    }
    const role = metadataCount === 0 ? legacyRole : String(attributes.commandRole);
    if (!TYPED_SOURCE_COMMAND_ROLES.includes(role as typeof TYPED_SOURCE_COMMAND_ROLES[number])) {
      throw new Error('requirements_technical_source_declaration_role_invalid');
    }
    const executionMode = metadataCount === 0
      ? role === 'command_template'
        ? 'template'
        : role === 'prohibited_command'
          ? 'prohibited'
          : 'executable'
      : String(attributes.executionMode);
    if (!TYPED_SOURCE_COMMAND_EXECUTION_MODES.includes(
      executionMode as typeof TYPED_SOURCE_COMMAND_EXECUTION_MODES[number])) {
      throw new Error('requirements_technical_source_declaration_execution_mode_invalid');
    }
    const commandRelations = relationIndex.byKindsIncident(
      ['declares_command', 'command_set_includes', 'conditional_command_selection', 'command_selects_test', 'same_command_as'],
      id
    );
    if (['source_command_set', 'conditional_selector'].includes(declarationClass)) {
      const sourceCondition = commandRelations.find((relation) =>
        relation.kind === 'conditional_command_selection')?.sourceCondition;
      const value = declarationClass === 'conditional_selector'
        ? String(sourceCondition ?? '')
        : commandRelations.filter((relation) => relation.kind === 'command_set_includes')
          .map((relation) => relation.to).sort().join('\n');
      add('CMD', id, value, [], [id, ...commandRelations.map((relation) => relation.relationId)],
        { kind: 'source_command_declaration', owner: sourceOwner },
        sourceCondition === undefined ? [] : [{ kind: 'source_condition', sourceCondition }], 'context',
        { coverageRole: 'non_action_declaration', declarationRole: declarationClass });
      continue;
    }
    const owners = [...(commandOwners.get(id) ?? [])];
    if (actions.has(String(command.owner))) owners.push(String(command.owner));
    const global = canonical.scope === 'global' || sourceNode?.scope?.kind === 'global';
    if (global) owners.push(...actions);
    const block = blocks.get(String(command.blockId));
    const blockScope = block?.scope as Record<string, unknown> | undefined;
    const scopeRelations = blockScope ? relationIndex.byKindsTo(
      ['dirty_worktree_protection', 'quality_gate', 'real_verification_requirements'],
      String(blockScope.owner)
    ).filter((relation) => actions.has(relation.from)) : [];
    owners.push(...scopeRelations.map((relation) => relation.from));
    const actionOwners = [...new Set(owners)].filter((owner) => actions.has(owner)).sort();
    const coverageRole = executionMode !== 'template' && executionMode !== 'prohibited' && actionOwners.length > 0
      ? 'action_trace' as const
      : 'non_action_declaration' as const;
    const modality = executionMode === 'template'
      ? 'template' as const
      : executionMode === 'prohibited'
        ? 'prohibited' as const
        : 'required' as const;
    add('CMD', id, String(canonicalAttributes.command ?? command.expression ?? ''), actionOwners,
      [id, ...commandRelations.map((relation) => relation.relationId), ...scopeRelations.map((relation) => relation.relationId)],
      global
        ? { kind: 'global_source_command', owner: sourceOwner }
        : { kind: 'source_command', owner: sourceOwner, ...(scopeRelations.length ? { inheritedScope: blockScope } : {}) },
      [{ role, worktree: command.worktree ?? null, expectedExit: command.expectedExit ?? null,
        declaredContext: command.declaredContext ?? '', authorization: command.authorization ?? null }],
      modality,
      { coverageRole, declarationRole: coverageRole === 'action_trace'
        ? global ? 'global_verification_command' : 'verification_command'
        : role });
  }
  const scenarioById = new Map(graph.scenarioDeclarations.map((scenario) => [String(scenario.id), scenario]));
  for (const relation of [
    ...relationIndex.byKind('work_evidence'),
    ...relationIndex.byKind('scenario_evidence'),
  ]) {
    const owners = actions.has(relation.from) ? [relation.from]
      : (scenarioById.get(relation.from)?.works ?? []) as string[];
    const scope = { kind: relation.kind === 'work_evidence' ? 'work' : 'scenario', owner: relation.from };
    add('ART', relation.relationId, relation.to, owners, [relation.relationId], scope);
    add('EVDREQ', relation.relationId, relation.to, owners, [relation.relationId], scope);
  }
  return canonicalEntries(entries, true);
}

export function validateRequirementsTechnicalPlanningCapabilityResult(
  value: unknown
): value is RequirementsTechnicalPlanningCapabilityResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as RequirementsTechnicalPlanningCapabilityResult;
  const keys = [
    'schemaVersion',
    'authoringRequestId',
    'authoringAttemptId',
    'checkpointId',
    'capabilityId',
    'capabilityStatus',
    'capabilityHash',
    'configHash',
    'premiseHash',
    'triggerIdentity',
    'status',
    'issueCode',
    'resumable',
    'executionRegistry',
    'resultHash',
  ];
  if (Object.keys(result).sort().join('|') !== [...keys].sort().join('|')) return false;
  if (
    !['requirements-contract-technical-planning-capability/v1', 'requirements-contract-technical-planning-capability/v2'].includes(result.schemaVersion) ||
    !['cp02', 'g02'].includes(result.checkpointId) ||
    !['available', 'unavailable'].includes(result.capabilityStatus) ||
    ![result.capabilityHash, result.configHash, result.premiseHash,
      result.triggerIdentity, result.resultHash].every((hash) => SHA256.test(hash))
  ) {
    return false;
  }
  const pending = result.status === 'technical_planning_pending';
  if (
    pending !== (result.capabilityStatus === 'unavailable') ||
    pending !== result.resumable ||
    (pending ? result.issueCode !== 'requirements_technical_planning_pending' : result.issueCode !== null) ||
    (pending ? result.executionRegistry !== null : result.executionRegistry === null)
  ) {
    return false;
  }
  try {
    const typed = result.schemaVersion === 'requirements-contract-technical-planning-capability/v2';
    const registryVersion = typed ? 'requirements-contract-typed-execution-registry/v2' : 'requirements-contract-typed-execution-registry/v1';
    const entries = result.executionRegistry
      ? canonicalEntries(result.executionRegistry.entries, typed)
      : [];
    if (
      result.executionRegistry &&
      (result.executionRegistry.schemaVersion !== registryVersion || JSON.stringify(entries) !== JSON.stringify(result.executionRegistry.entries) ||
        result.executionRegistry.registryHash !== sha256Stable({
          domain: registryVersion,
          entries,
        }))
    ) {
      return false;
    }
    const { resultHash, ...payload } = result;
    return resultHash === hashPayload(payload);
  } catch {
    return false;
  }
}
