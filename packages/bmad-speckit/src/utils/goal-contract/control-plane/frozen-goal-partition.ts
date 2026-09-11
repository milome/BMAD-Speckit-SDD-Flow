const { createHash } = require('node:crypto');
const { hashControlPlaneValue, stableControlPlaneStringify } = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const { validateGoalContractSchema } = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);
const { renderNormativeDetails } = require(
  __filename.endsWith('.ts') ? './goal-normative-renderer.ts' : './goal-normative-renderer'
);
const { resolveRequirementsSpecSpanSourceNodeIds } = require(
  __filename.endsWith('.ts')
    ? '../../../main-agent/source-authority/scripts/requirements-contract-span-registry.ts'
    : '../../../main-agent/source-authority/scripts/requirements-contract-span-registry'
);

export type FrozenGoalPartitionModule = never;

type JsonObject = Record<string, unknown>;

const ELIGIBILITY_SCHEMA = 'goal-contract-execution-eligibility.schema.json';
const MANIFEST_SCHEMA = 'goal-contract-frozen-partition-manifest.schema.json';
const CHILD_SCHEMA = 'goal-child-execution-contract.schema.json';
const CHILD_PACKAGE_SCHEMA = 'goal-contract-child-execution-package.schema.json';
const SPEC_SPAN_REF_CACHE = new WeakMap<object, string[]>();
const GROUP_AUTHORITY_REF_CACHE = new WeakMap<object, Map<string, JsonObject>>();
const PARTITION_HARD_POLICY = Object.freeze({
  schemaVersion: 'PartitionHardCompatibilityPolicy/v1',
  upperBoundEffortMinutes: { max: 240 },
  requireDependencyClosure: true,
  requireDirectModeAdmissibility: true,
  requireLogicalScopeClosure: true,
  requireNonOverlappingOwnedPaths: true,
  requireIsolationCompatibility: true,
  requireObligationConservation: true,
  requireSpecSpanConservation: true,
  requireCommandClosure: true,
  requireEvidenceClosure: true,
  requireArtifactConservation: true,
});
const PARTITION_SELECTOR_POLICY = Object.freeze({
  schemaVersion: 'PartitionSelectorPolicy/v1',
  targetClosureMinutesPerPartition: { min: 120, max: 180 },
  weights: {
    dependency_cut: 1_000_000,
    shared_file_churn: 100_000,
    closure_fragmentation: 10_000,
    effort_balance: 100,
    semantic_cohesion: 10,
    evidence_locality: 1,
  },
  orderedSignals: [
    'dependency_cut',
    'shared_file_churn',
    'closure_fragmentation',
    'effort_balance',
    'semantic_cohesion',
    'evidence_locality',
  ],
  deterministicTieBreak: 'lexical_component_membership',
});

function failure(failureClass: string, details: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function isTypedGoalExecutionIr(value: unknown): boolean {
  return ['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(String(value));
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function bytesHash(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function withoutHash(value: JsonObject, hashField: string): JsonObject {
  const payload = { ...value };
  delete payload[hashField];
  return payload;
}

function partitionPolicyIdentity(version = 'GoalExecutionIR/v1') {
  if (
    ![
      'GoalExecutionIR/v1',
      'GoalExecutionIR/v2',
      'GoalExecutionIR/v3',
      'GoalContractPartitionManifest/v1',
      'GoalContractPartitionManifest/v2',
    ].includes(version)
  ) {
    throw failure('goal_partition_policy_version_unsupported');
  }
  const typed = isTypedGoalExecutionIr(version) || version === 'GoalContractPartitionManifest/v2';
  const hardPolicy = typed
    ? {
        ...PARTITION_HARD_POLICY,
        schemaVersion: 'PartitionHardCompatibilityPolicy/v2',
        nonActionConservation: 'source_scoped_inheritance',
        sharedReferences: 'declared_applicability',
      }
    : PARTITION_HARD_POLICY;
  return {
    hardPolicy,
    selectorPolicy: PARTITION_SELECTOR_POLICY,
    hardCompatibilityPolicyHash: hashControlPlaneValue(hardPolicy),
    selectorPolicyHash: hashControlPlaneValue(PARTITION_SELECTOR_POLICY),
  };
}

function componentOwnedPaths(ir: JsonObject, component: JsonObject): string[] {
  const frozenOwnedPaths = unique(strings(component.ownedPaths));
  if (frozenOwnedPaths.length > 0 || isTypedGoalExecutionIr(ir.schemaVersion))
    return frozenOwnedPaths;
  const domainRefs = new Set(strings(component.executionDomainRefs));
  return unique(
    objects(ir.executionDomains)
      .filter((domain) => domainRefs.has(String(domain.executionDomainId)))
      .flatMap((domain) => strings(domain.logicalTargetPaths))
  );
}

function materializePartitionGroup(ir: JsonObject, components: JsonObject[]): JsonObject {
  return {
    componentRefs: unique(components.map((component) => String(component.componentId))),
    executionDomainRefs: unique(
      components.flatMap((component) => strings(component.executionDomainRefs))
    ),
    traceSliceRefs: unique(components.flatMap((component) => strings(component.traceSliceRefs))),
    taskRefs: unique(components.flatMap((component) => strings(component.taskRefs))),
    expectedEffortMinutes: components.reduce(
      (total, component) => total + Number(component.expectedEffortMinutes),
      0
    ),
    upperBoundEffortMinutes: components.reduce(
      (total, component) => total + Number(component.upperBoundEffortMinutes),
      0
    ),
    basisRefs: unique(components.flatMap((component) => strings(component.basisRefs))),
    ownedPaths: unique(components.flatMap((component) => componentOwnedPaths(ir, component))),
  };
}

function specSpanObligationRefs(span: JsonObject, ir: JsonObject): string[] {
  const cached = SPEC_SPAN_REF_CACHE.get(span);
  if (cached) return cached;
  let result: string[];
  if (span.boundTypedSourceGraphHash !== undefined) {
    if (!isTypedGoalExecutionIr(ir.schemaVersion) || ir.profile !== 'requirements_backed')
      throw failure('goal_partition_spec_span_binding_invalid');
    result = resolveRequirementsSpecSpanSourceNodeIds(
      span,
      object(ir.semanticSource).typedSourceAuthority
    );
  } else if (isTypedGoalExecutionIr(ir.schemaVersion) && ir.profile === 'standalone') {
    result = unique(strings(span.boundObligationIds));
  } else {
    result = unique([
      ...strings(span.boundObligationIds),
      ...strings(span.obligationRefs),
      ...(typeof span.obligationRef === 'string' ? [span.obligationRef] : []),
    ]);
  }
  SPEC_SPAN_REF_CACHE.set(span, result);
  return result;
}

function standaloneExecutionConstraints(ir: JsonObject): JsonObject[] | null {
  return isTypedGoalExecutionIr(ir.schemaVersion) &&
    ir.profile === 'standalone' &&
    Array.isArray(object(ir.semanticSource).typedExecutionConstraints)
    ? objects(object(ir.semanticSource).typedExecutionConstraints)
    : null;
}

function parentOnlyDeclarationRefs(ir: JsonObject): {
  constraints: Set<string>;
  obligations: Set<string>;
} {
  const declarations = (standaloneExecutionConstraints(ir) ?? []).filter(
    (row) =>
      row.coverageRole === 'non_action_declaration' &&
      ['authoring_command', 'example_command', 'source_reference', 'unselected_option'].includes(
        String(row.declarationRole)
      ) &&
      row.scope !== 'global' &&
      !strings(row.applicableAtomRefs).length
  );
  const constraints = new Set(declarations.map((row) => String(row.constraintId)));
  const declarationOwners = new Set(declarations.flatMap((row) => strings(row.applicableMustRefs)));
  const obligations = new Set(
    objects(ir.obligations)
      .filter(
        (row) =>
          row.executionRole !== 'action' &&
          object(row.applicability).scope !== 'global' &&
          (row.executionRole === 'definition' || declarationOwners.has(String(row.obligationId)))
      )
      .map((row) => String(row.obligationId))
  );
  return { constraints, obligations };
}

function requirementsParentOnlyObligationRefs(ir: JsonObject): Set<string> {
  return new Set(
    objects(ir.obligations)
      .filter(
        (row) =>
          row.executionRole !== 'action' &&
          !['guidance', 'acceptance'].includes(String(row.executionRole)) &&
          object(row.applicability).scope === 'source_scope'
      )
      .map((row) => String(row.obligationId))
  );
}

function deriveGroupAuthorityRefs(ir: JsonObject, group: JsonObject): JsonObject {
  const cacheKey = [
    ...unique(strings(group.taskRefs)),
    '|',
    ...unique(strings(group.traceSliceRefs)),
  ].join('\u0000');
  let cache = GROUP_AUTHORITY_REF_CACHE.get(ir);
  if (!cache) {
    cache = new Map();
    GROUP_AUTHORITY_REF_CACHE.set(ir, cache);
  }
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const taskRefs = new Set(strings(group.taskRefs));
  const traceRefs = new Set(strings(group.traceSliceRefs));
  const tasks = objects(ir.atomicTasks).filter((task) => taskRefs.has(String(task.taskId)));
  const traces = objects(ir.traceSlices).filter((trace) =>
    traceRefs.has(String(trace.traceSliceId))
  );
  const actionRefs = unique(traces.flatMap((trace) => strings(trace.obligationRefs)));
  const constraints = standaloneExecutionConstraints(ir);
  const parentOnlyObligationRefs = isTypedGoalExecutionIr(ir.schemaVersion)
    ? requirementsParentOnlyObligationRefs(ir)
    : new Set<string>();
  const selectedConstraints = (constraints ?? []).filter(
    (row) =>
      row.scope === 'global' ||
      strings(row.applicableMustRefs).some((ref) => actionRefs.includes(ref))
  );
  const constraintObligations = new Set(
    selectedConstraints.flatMap((row) => strings(row.applicableMustRefs))
  );
  const inheritedObligationRefs = isTypedGoalExecutionIr(ir.schemaVersion)
    ? objects(ir.obligations)
        .filter(
          (row) =>
            row.executionRole !== 'action' &&
            (object(row.applicability).scope === 'global' ||
              strings(object(row.applicability).obligationRefs).some((ref) =>
                actionRefs.includes(ref)
              ) ||
              (ir.profile === 'requirements_backed' &&
                object(row.applicability).scope === 'source_scope' &&
                !parentOnlyObligationRefs.has(String(row.obligationId))) ||
              constraintObligations.has(String(row.obligationId)))
        )
        .map((row) => String(row.obligationId))
    : [];
  const obligationRefs = unique([...actionRefs, ...inheritedObligationRefs]);
  const obligationRefSet = new Set(obligationRefs);
  const atomRefSet = new Set(tasks.flatMap((task) => strings(task.atomRefs)));
  const commandRefs = unique(traces.flatMap((trace) => strings(trace.commandRefs)));
  const evidenceContractRefs = unique(
    traces.flatMap((trace) => strings(trace.evidenceContractRefs))
  );
  const logicalSpecSpanRefs = unique(
    objects(ir.logicalSpecSpans)
      .filter((span) =>
        specSpanObligationRefs(span, ir).some((obligationRef) =>
          obligationRefSet.has(obligationRef)
        )
      )
      .map((span) => String(span.specSpanId))
  );
  const artifactRefs = unique(
    objects(ir.artifacts)
      .filter(
        (artifact) =>
          strings(artifact.obligationRefs).some((ref) => obligationRefSet.has(ref)) ||
          strings(artifact.atomRefs).some((ref) => atomRefSet.has(ref))
      )
      .map((artifact) => String(artifact.artifactId))
  );
  const result = {
    taskRefs: unique([...taskRefs]),
    traceSliceRefs: unique([...traceRefs]),
    obligationRefs,
    ...(isTypedGoalExecutionIr(ir.schemaVersion)
      ? { inheritedObligationRefs: unique(inheritedObligationRefs) }
      : {}),
    ...(constraints
      ? {
          executionConstraintRefs: unique(
            selectedConstraints.map((row) => String(row.constraintId))
          ),
        }
      : {}),
    logicalSpecSpanRefs,
    commandRefs,
    evidenceContractRefs,
    artifactRefs,
  };
  cache.set(cacheKey, result);
  return result;
}

function hasExactUniqueAssignment(parentRefs: string[], assignedRefs: string[][]): boolean {
  const expected = unique(parentRefs);
  const assigned = assignedRefs.flat();
  return (
    expected.length === parentRefs.length &&
    assigned.length === new Set(assigned).size &&
    JSON.stringify(unique(assigned)) === JSON.stringify(expected)
  );
}

function validateTypedPartitionChild(
  ir: JsonObject,
  components: JsonObject[],
  row: JsonObject,
  child: JsonObject
): void {
  if (!isTypedGoalExecutionIr(ir.schemaVersion)) return;
  const componentRefs = strings(row.componentRefs);
  const selected = components.filter((component) =>
    componentRefs.includes(String(component.componentId))
  );
  if (!componentRefs.length || selected.length !== componentRefs.length) {
    throw failure('goal_partition_child_authority_mismatch', { field: 'componentRefs' });
  }
  const group = materializePartitionGroup(ir, selected);
  const expected = deriveGroupAuthorityRefs(ir, group);
  const same = (left: unknown, right: unknown) =>
    stableControlPlaneStringify(left) === stableControlPlaneStringify(right);
  for (const field of ['componentRefs', 'taskRefs', 'traceSliceRefs']) {
    if (!same(row[field], group[field]) || !same(child[field], group[field])) {
      throw failure('goal_partition_child_authority_mismatch', { field });
    }
  }
  for (const field of ['obligationRefs', 'inheritedObligationRefs']) {
    if (!same(row[field], expected[field]) || !same(child[field], expected[field])) {
      throw failure('goal_partition_child_authority_mismatch', { field });
    }
  }
  if (standaloneExecutionConstraints(ir)) {
    if (
      !same(row.executionConstraintRefs, expected.executionConstraintRefs) ||
      !same(child.executionConstraintRefs, expected.executionConstraintRefs) ||
      !same(
        child.executionConstraints,
        standaloneExecutionConstraints(ir)!.filter((constraint) =>
          strings(expected.executionConstraintRefs).includes(String(constraint.constraintId))
        )
      )
    ) {
      throw failure('goal_partition_child_authority_mismatch', { field: 'executionConstraints' });
    }
  }
  const collections = [
    ['obligations', 'obligationId', 'obligationRefs'],
    ['atomicTasks', 'taskId', 'taskRefs'],
    ['traceSlices', 'traceSliceId', 'traceSliceRefs'],
    ['logicalSpecSpans', 'specSpanId', 'logicalSpecSpanRefs'],
    ['commands', 'commandId', 'commandRefs'],
    ['evidenceContracts', 'evidenceContractId', 'evidenceContractRefs'],
    ['artifacts', 'artifactId', 'artifactRefs'],
  ] as const;
  for (const [field, idField, refsField] of collections) {
    const refs = new Set(strings(expected[refsField]));
    if (
      !same(
        child[field],
        objects(ir[field]).filter((item) => refs.has(String(item[idField])))
      )
    ) {
      throw failure('goal_partition_child_authority_mismatch', { field });
    }
  }
  const scopes = scopedPartitionLogicalScopes(ir, group, expected);
  if (
    !same(child.logicalScopes, scopes) ||
    !same(row.ownedPaths, scopes.ownedPaths) ||
    !same(row.forbiddenPaths, scopes.forbiddenPaths)
  ) {
    throw failure('goal_partition_child_authority_mismatch', { field: 'logicalScopes' });
  }
  const tasks = new Set(strings(group.taskRefs));
  const extraCollections = {
    executionDomains: scopedPartitionDomains(ir, group, expected),
    dependencies: objects(ir.dependencies).filter(
      (edge) => tasks.has(String(edge.from)) && tasks.has(String(edge.to))
    ),
    coExecutionConstraints: objects(ir.coExecutionConstraints).filter((constraint) =>
      strings(constraint.taskRefs).some((ref) => tasks.has(ref))
    ),
  };
  for (const [field, values] of Object.entries(extraCollections)) {
    if (!same(child[field], values))
      throw failure('goal_partition_child_authority_mismatch', { field });
  }
  for (const field of ['expectedEffortMinutes', 'upperBoundEffortMinutes']) {
    if (row[field] !== group[field] || child[field] !== group[field]) {
      throw failure('goal_partition_child_authority_mismatch', { field });
    }
  }
}

function scopedPartitionDomains(
  ir: JsonObject,
  group: JsonObject,
  authorityRefs: JsonObject
): JsonObject[] {
  const domainRefs = new Set(strings(group.executionDomainRefs));
  const paths = new Set(strings(group.ownedPaths));
  const commands = new Set(strings(authorityRefs.commandRefs));
  return objects(ir.executionDomains)
    .filter((domain) => domainRefs.has(String(domain.executionDomainId)))
    .map((domain) =>
      !isTypedGoalExecutionIr(ir.schemaVersion)
        ? domain
        : {
            ...domain,
            ownership: objects(domain.ownership).filter((owner) =>
              paths.has(String(owner.targetPath))
            ),
            logicalTargetPaths: strings(domain.logicalTargetPaths).filter((target) =>
              paths.has(target)
            ),
            commandRefs: strings(domain.commandRefs).filter((command) => commands.has(command)),
          }
    );
}

function scopedPartitionLogicalScopes(
  ir: JsonObject,
  group: JsonObject,
  authorityRefs: JsonObject
): JsonObject {
  const parentScope = object(ir.logicalScopes);
  if (!isTypedGoalExecutionIr(ir.schemaVersion))
    return {
      ownedPaths: unique(strings(group.ownedPaths)),
      forbiddenPaths: unique(strings(parentScope.forbiddenPaths)),
    };
  const refs = new Set(strings(authorityRefs.obligationRefs));
  const pathRestrictions = objects(parentScope.pathRestrictions).filter(
    (restriction) =>
      restriction.scope === 'global' ||
      strings(restriction.applicableMustRefs).some((ref) => refs.has(ref))
  );
  return {
    ownedPaths: unique(strings(group.ownedPaths)),
    forbiddenPaths: unique(
      pathRestrictions.map((restriction) => String(restriction.canonicalValue))
    ),
    pathRestrictions,
    ...(Array.isArray(parentScope.stopConditions)
      ? {
          stopConditions: objects(parentScope.stopConditions).filter(
            (condition) =>
              object(condition.scope).kind === 'global' ||
              strings(condition.applicableMustRefs).some((ref) => refs.has(ref))
          ),
        }
      : {}),
  };
}

function groupsHaveCompatibleIsolation(ir: JsonObject, groups: JsonObject[]): boolean {
  const domainById = new Map(
    objects(ir.executionDomains).map((domain) => [String(domain.executionDomainId), domain])
  );
  return groups.every((group) => {
    const selectedPaths = new Set(strings(group.ownedPaths));
    const domains = strings(group.executionDomainRefs)
      .map((domainRef) => domainById.get(domainRef))
      .filter((domain): domain is JsonObject => Boolean(domain));
    const isolationModes = unique(
      domains.map((domain) => String(domain.isolationMode ?? '')).filter(Boolean)
    );
    if (isolationModes.length > 1) return false;
    const ownerByPath = new Map<string, string>();
    for (const ownership of domains
      .flatMap((domain) => objects(domain.ownership))
      .filter((ownership) => selectedPaths.has(String(ownership.targetPath ?? '')))) {
      const targetPath = String(ownership.targetPath ?? '');
      const owner = String(ownership.owner ?? '');
      if (!targetPath || !owner) continue;
      const existing = ownerByPath.get(targetPath);
      if (existing && existing !== owner && !isTypedGoalExecutionIr(ir.schemaVersion)) return false;
      ownerByPath.set(targetPath, owner);
    }
    return true;
  });
}

function partitionAuthorityConserved(ir: JsonObject, groups: JsonObject[]): boolean {
  if (!groupsHaveCompatibleIsolation(ir, groups)) return false;
  const assignments = groups.map((group) => deriveGroupAuthorityRefs(ir, group));
  if (isTypedGoalExecutionIr(ir.schemaVersion)) {
    const uniqueChecks = [
      [objects(ir.atomicTasks), 'taskId', 'taskRefs'],
      [objects(ir.traceSlices), 'traceSliceId', 'traceSliceRefs'],
    ] as const;
    if (
      !uniqueChecks.every(([rows, id, ref]) =>
        hasExactUniqueAssignment(
          rows.map((row) => String(row[id])),
          assignments.map((assignment) => strings(assignment[ref]))
        )
      )
    )
      return false;
    const actionIds = new Set(
      objects(ir.obligations)
        .filter((row) => row.executionRole === 'action')
        .map((row) => String(row.obligationId))
    );
    if (
      !hasExactUniqueAssignment(
        [...actionIds],
        assignments.map((assignment) =>
          strings(assignment.obligationRefs).filter((ref) => actionIds.has(ref))
        )
      )
    )
      return false;
    const parentOnly = standaloneExecutionConstraints(ir)
      ? parentOnlyDeclarationRefs(ir)
      : {
          constraints: new Set<string>(),
          obligations: requirementsParentOnlyObligationRefs(ir),
        };
    const inheritedObligations = objects(ir.obligations).filter(
      (row) =>
        !parentOnly.obligations.has(String(row.obligationId)) ||
        assignments.some((assignment) =>
          strings(assignment.obligationRefs).includes(String(row.obligationId))
        )
    );
    const inheritedIds = new Set(inheritedObligations.map((row) => String(row.obligationId)));
    const constraints = standaloneExecutionConstraints(ir);
    if (
      constraints &&
      constraints.some(
        (constraint) =>
          !parentOnly.constraints.has(String(constraint.constraintId)) &&
          !assignments.some((assignment) =>
            strings(assignment.executionConstraintRefs).includes(String(constraint.constraintId))
          )
      )
    )
      return false;
    const expectedSpanRefs = constraints
      ? objects(ir.logicalSpecSpans).filter((span) =>
          specSpanObligationRefs(span, ir).some((ref) => inheritedIds.has(ref))
        )
      : ir.profile === 'requirements_backed'
        ? objects(ir.logicalSpecSpans).filter((span) =>
            specSpanObligationRefs(span, ir).some(
              (ref) => inheritedIds.has(ref) || actionIds.has(ref)
            )
          )
        : objects(ir.logicalSpecSpans);
    const inheritedChecks = [
      [inheritedObligations, 'obligationId', 'obligationRefs'],
      [expectedSpanRefs, 'specSpanId', 'logicalSpecSpanRefs'],
      [objects(ir.commands), 'commandId', 'commandRefs'],
      [objects(ir.evidenceContracts), 'evidenceContractId', 'evidenceContractRefs'],
      [objects(ir.artifacts), 'artifactId', 'artifactRefs'],
    ] as const;
    return inheritedChecks.every(([rows, id, ref]) => {
      const expected = new Set(rows.map((row) => String(row[id])));
      const assigned = assignments.flatMap((assignment) => strings(assignment[ref]));
      return (
        assigned.every((value) => expected.has(value)) &&
        [...expected].every((value) => assigned.includes(value))
      );
    });
  }
  const checks: Array<[JsonObject[], string, string]> = [
    [objects(ir.atomicTasks), 'taskId', 'taskRefs'],
    [objects(ir.traceSlices), 'traceSliceId', 'traceSliceRefs'],
    [objects(ir.obligations), 'obligationId', 'obligationRefs'],
    [objects(ir.logicalSpecSpans), 'specSpanId', 'logicalSpecSpanRefs'],
    [objects(ir.commands), 'commandId', 'commandRefs'],
    [objects(ir.evidenceContracts), 'evidenceContractId', 'evidenceContractRefs'],
    [objects(ir.artifacts), 'artifactId', 'artifactRefs'],
  ];
  return checks.every(([rows, idField, assignmentField]) => {
    if (rows.length === 0) return true;
    return hasExactUniqueAssignment(
      rows.map((row) => String(row[idField] ?? '')),
      assignments.map((assignment) => strings(assignment[assignmentField]))
    );
  });
}

function hardValidExecutionGroups(ir: JsonObject, groups: JsonObject[][]): JsonObject[] | null {
  const materialized = groups.map((group) => materializePartitionGroup(ir, group));
  const invalidGroup = materialized.find((group) => {
    const refs = new Set(strings(group.taskRefs));
    const tasks = objects(ir.atomicTasks).filter((task) => refs.has(String(task.taskId)));
    const aggregates = tasks.filter(
      (task) => object(task.taskExecution).executionClass === 'aggregate_only'
    );
    const aggregateOnly =
      isTypedGoalExecutionIr(ir.schemaVersion) &&
      tasks.length > 0 &&
      aggregates.length === tasks.length;
    return (
      Number(group.upperBoundEffortMinutes) > 240 ||
      (aggregates.length > 0 && !aggregateOnly) ||
      (aggregateOnly &&
        (strings(group.ownedPaths).length > 0 ||
          new Set(aggregates.map((task) => object(task.taskExecution).aggregateGatePhase)).size !==
            1)) ||
      (!aggregateOnly &&
        !tasks.every(
          (task) =>
            object(task.taskExecution).executionClass === 'executable_child' &&
            ['none', '`none`'].includes(String(object(task.taskExecution).ownedProductionPaths))
        ) &&
        strings(group.ownedPaths).length === 0)
    );
  });
  if (invalidGroup) {
    return null;
  }
  if (!partitionAuthorityConserved(ir, materialized)) return null;
  const ownedPaths = materialized.flatMap((group) => strings(group.ownedPaths));
  const expectedOwnedPaths = unique(strings(object(ir.logicalScopes).ownedPaths));
  if (
    (!isTypedGoalExecutionIr(ir.schemaVersion) && ownedPaths.length !== new Set(ownedPaths).size) ||
    JSON.stringify(unique(ownedPaths)) !== JSON.stringify(expectedOwnedPaths)
  ) {
    return null;
  }
  return materialized;
}

function directGoalExecutionTopologyAdmissible(ir: JsonObject, component: JsonObject): boolean {
  return hardValidExecutionGroups(ir, [[component]]) !== null;
}

function hardValidPartitionGroups(ir: JsonObject, groups: JsonObject[][]): JsonObject[] | null {
  if (groups.length < 2) return null;
  return hardValidExecutionGroups(ir, groups);
}

function partitionSelectorRank(
  ir: JsonObject,
  groups: JsonObject[][],
  materialized: JsonObject[]
): string {
  const groupIndexByComponent = new Map<string, number>();
  const groupIndexByTask = new Map<string, number>();
  groups.forEach((group, groupIndex) => {
    for (const component of group) {
      groupIndexByComponent.set(String(component.componentId), groupIndex);
      for (const taskRef of strings(component.taskRefs)) groupIndexByTask.set(taskRef, groupIndex);
    }
  });
  const dependencyCut = objects(ir.dependencies).filter(
    (dependency) =>
      groupIndexByTask.has(String(dependency.from)) &&
      groupIndexByTask.has(String(dependency.to)) &&
      groupIndexByTask.get(String(dependency.from)) !== groupIndexByTask.get(String(dependency.to))
  ).length;
  const sharedFileChurn = groups.reduce((total, group) => {
    const counts = new Map<string, number>();
    for (const component of group) {
      for (const ownedPath of componentOwnedPaths(ir, component)) {
        counts.set(ownedPath, (counts.get(ownedPath) ?? 0) + 1);
      }
    }
    return total + [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  }, 0);
  const closureFragmentation = Math.max(0, materialized.length - 2);
  const effortBalance = materialized.reduce((total, group) => {
    const effort = Number(group.expectedEffortMinutes);
    if (effort < 120) return total + (120 - effort);
    if (effort > 180) return total + (effort - 180);
    return total;
  }, 0);
  const crossGroupRefCount = (refsForComponent: (component: JsonObject) => string[]): number => {
    const groupsByRef = new Map<string, Set<number>>();
    for (const [componentId, groupIndex] of groupIndexByComponent) {
      const component = groups.flat().find((row) => String(row.componentId) === componentId);
      if (!component) continue;
      for (const ref of refsForComponent(component)) {
        const indexes = groupsByRef.get(ref) ?? new Set<number>();
        indexes.add(groupIndex);
        groupsByRef.set(ref, indexes);
      }
    }
    return [...groupsByRef.values()].reduce(
      (total, indexes) => total + Math.max(0, indexes.size - 1),
      0
    );
  };
  const semanticCohesion = crossGroupRefCount((component) => strings(component.basisRefs));
  const traceById = new Map(
    objects(ir.traceSlices).map((trace) => [String(trace.traceSliceId), trace])
  );
  const evidenceLocality = crossGroupRefCount((component) =>
    strings(component.traceSliceRefs).flatMap((traceRef) =>
      strings(traceById.get(traceRef)?.evidenceContractRefs)
    )
  );
  const metrics = {
    dependency_cut: dependencyCut,
    shared_file_churn: sharedFileChurn,
    closure_fragmentation: closureFragmentation,
    effort_balance: effortBalance,
    semantic_cohesion: semanticCohesion,
    evidence_locality: evidenceLocality,
  };
  const weights = PARTITION_SELECTOR_POLICY.weights;
  const score = Object.entries(metrics).reduce(
    (total, [signal, value]) => total + value * weights[signal as keyof typeof weights],
    0
  );
  return [
    String(score).padStart(16, '0'),
    stableControlPlaneStringify(metrics),
    stableControlPlaneStringify(materialized.map((group) => group.componentRefs)),
  ].join(':');
}

function componentOrder(ir: JsonObject, components: JsonObject[]): JsonObject[] {
  const componentByTask = new Map<string, string>();
  for (const component of components) {
    for (const taskRef of strings(component.taskRefs)) {
      componentByTask.set(taskRef, String(component.componentId));
    }
  }
  const outgoing = new Map(
    components.map((component) => [String(component.componentId), new Set<string>()])
  );
  const indegree = new Map(components.map((component) => [String(component.componentId), 0]));
  for (const dependency of objects(ir.dependencies)) {
    const dependent = componentByTask.get(String(dependency.from));
    const prerequisite = componentByTask.get(String(dependency.to));
    if (!dependent || !prerequisite || dependent === prerequisite) continue;
    if (!outgoing.get(prerequisite)!.has(dependent)) {
      outgoing.get(prerequisite)!.add(dependent);
      indegree.set(dependent, (indegree.get(dependent) ?? 0) + 1);
    }
  }
  const byId = new Map(components.map((component) => [String(component.componentId), component]));
  const ready = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([componentId]) => componentId)
    .sort();
  const ordered: JsonObject[] = [];
  while (ready.length > 0) {
    const componentId = ready.shift()!;
    ordered.push(byId.get(componentId)!);
    for (const dependent of [...(outgoing.get(componentId) ?? [])].sort()) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
    ready.sort();
  }
  if (ordered.length !== components.length) {
    throw failure('partition_no_valid_solution', { reason: 'component_dependency_cycle' });
  }
  return ordered;
}

function renderChildPrompt(child: JsonObject): string {
  return [
    '# Child Goal Execution',
    '',
    `Child Contract: ${String(child.childContractId)}`,
    `Parent Goal Execution IR: ${String(child.goalExecutionIRHash)}`,
    `Partition: ${String(child.partitionId)}`,
    '',
    'Execute only this immutable child authority and its declared logical scope.',
    '',
    ...(child.schemaVersion === 'GoalChildExecutionContract/v2'
      ? [
          '## Obligations',
          ...objects(child.obligations).flatMap((row) => [
            `- ${String(row.kind)} ${String(row.obligationId)}: ${String(row.text)}`,
            ...renderNormativeDetails(row),
          ]),
          '',
        ]
      : []),
    '## Tasks',
    ...objects(child.atomicTasks).map((task) => `- ${String(task.taskId)}: ${String(task.title)}`),
    '',
    '## Validation Commands',
    ...objects(child.commands).map(
      (command) => `- ${String(command.commandId)}: ${String(command.invocation)}`
    ),
    '',
  ].join('\n');
}

function renderChildExecution(child: JsonObject): string {
  return [
    '# Goal Child Execution Contract',
    '',
    `Child Contract: ${String(child.childContractId)}`,
    `Parent Goal Execution IR: ${String(child.goalExecutionIRHash)}`,
    `Partition: ${String(child.partitionId)}`,
    '',
    '## Obligations',
    ...objects(child.obligations).flatMap((obligation) => [
      `- ${String(obligation.kind)} ${String(obligation.obligationId)}: ${String(obligation.text)}`,
      ...(child.schemaVersion === 'GoalChildExecutionContract/v2'
        ? renderNormativeDetails(obligation)
        : []),
    ]),
    '',
    '## Atomic Tasks',
    ...objects(child.atomicTasks).map((task) => `- ${String(task.taskId)}: ${String(task.title)}`),
    '',
  ].join('\n');
}

function compileChildPackage(
  child: JsonObject,
  executionAdapterRef: { path: string; hash: string }
): {
  childPackage: JsonObject;
  files: Map<string, Buffer>;
} {
  const modelPacketPayload = {
    schemaVersion: 'GoalChildExecutionModelPacket/v1',
    childContractId: child.childContractId,
    partitionId: child.partitionId,
    profile: child.profile,
    goalId: child.goalId,
    goalExecutionIRHash: child.goalExecutionIRHash,
    partitionMembershipHash: child.partitionMembershipHash,
    logicalScopes: child.logicalScopes,
    obligations: child.obligations,
    logicalSpecSpans: child.logicalSpecSpans,
    executionDomains: child.executionDomains,
    traceSlices: child.traceSlices,
    atomicTasks: child.atomicTasks,
    dependencies: child.dependencies,
    commands: child.commands,
    evidenceContracts: child.evidenceContracts,
    artifacts: child.artifacts,
    coExecutionConstraints: child.coExecutionConstraints,
    ...(child.executionConstraintRefs
      ? {
          executionConstraintRefs: child.executionConstraintRefs,
          executionConstraints: child.executionConstraints,
        }
      : {}),
  };
  const modelPacket = {
    ...modelPacketPayload,
    modelPacketHash: hashControlPlaneValue(modelPacketPayload),
  };
  const modelBytes = canonicalBytes(modelPacket);
  const promptBytes = Buffer.from(renderChildPrompt(child), 'utf8');
  const executionBytes = Buffer.from(renderChildExecution(child), 'utf8');
  const auditPayload = {
    schemaVersion: 'GoalExecutionPackageAuditReceipt/v1',
    profile: child.profile,
    goalId: child.goalId,
    goalExecutionIRHash: child.goalExecutionIRHash,
    executionMode: 'partitioned_goal',
    partitionId: child.partitionId,
    childContractHash: child.childContractHash,
    artifacts: [
      {
        role: 'model_packet',
        path: 'package/model_packet.json',
        hash: modelPacket.modelPacketHash,
        bytesHash: bytesHash(modelBytes),
      },
      {
        role: 'human_prompt',
        path: 'package/human_prompt.txt',
        hash: bytesHash(promptBytes),
        bytesHash: bytesHash(promptBytes),
      },
      {
        role: 'goal_execution_projection',
        path: 'package/goal_execution.md',
        hash: bytesHash(executionBytes),
        bytesHash: bytesHash(executionBytes),
      },
    ],
    decision: 'pass',
  };
  const auditReceipt = {
    ...auditPayload,
    auditReceiptHash: hashControlPlaneValue(auditPayload),
  };
  const packagePayload = {
    schemaVersion: 'GoalContractChildExecutionPackage/v2',
    profile: child.profile,
    goalId: child.goalId,
    goalExecutionIRHash: child.goalExecutionIRHash,
    executionMode: 'partitioned_goal',
    partitionId: child.partitionId,
    childContractRef: {
      path: 'child-execution-contract.json',
      hash: child.childContractHash,
    },
    executionAdapterRef,
    artifacts: [
      {
        role: 'model_packet',
        path: 'package/model_packet.json',
        hash: modelPacket.modelPacketHash,
      },
      { role: 'human_prompt', path: 'package/human_prompt.txt', hash: bytesHash(promptBytes) },
      {
        role: 'audit_receipt',
        path: 'package/audit_receipt.json',
        hash: auditReceipt.auditReceiptHash,
      },
      {
        role: 'goal_execution_projection',
        path: 'package/goal_execution.md',
        hash: bytesHash(executionBytes),
      },
    ],
  };
  const childPackage = {
    ...packagePayload,
    childExecutionPackageHash: hashControlPlaneValue(packagePayload),
  };
  validateGoalContractSchema(CHILD_PACKAGE_SCHEMA, childPackage);
  return {
    childPackage,
    files: new Map([
      ['package/model_packet.json', modelBytes],
      ['package/human_prompt.txt', promptBytes],
      ['package/audit_receipt.json', canonicalBytes(auditReceipt)],
      ['package/goal_execution.md', executionBytes],
      ['package/child-execution-package.json', canonicalBytes(childPackage)],
    ]),
  };
}

function selectByIds(values: JsonObject[], idField: string, ids: Set<string>): JsonObject[] {
  return values.filter((value) => ids.has(String(value[idField])));
}

function selectFrozenGoalPartition(input: {
  goalExecutionIr: JsonObject;
  eligibility: JsonObject;
  solverEnvelope?: { maxSearchStates?: number };
}): JsonObject {
  const ir = object(input.goalExecutionIr);
  const components = componentOrder(ir, objects(object(input.eligibility).components));
  const maxSearchStates = Math.max(
    1,
    Math.min(100_000, Number(input.solverEnvelope?.maxSearchStates ?? 4_096))
  );
  if (isTypedGoalExecutionIr(ir.schemaVersion) && ir.profile === 'requirements_backed') {
    const singletonGroups = componentOrder(ir, components).map((component) =>
      materializePartitionGroup(ir, [component])
    );
    const taskRefs = singletonGroups.flatMap((group) => strings(group.taskRefs));
    const traceRefs = singletonGroups.flatMap((group) => strings(group.traceSliceRefs));
    const expectedTasks = objects(ir.atomicTasks).map((task) => String(task.taskId));
    const expectedTraces = objects(ir.traceSlices).map((trace) => String(trace.traceSliceId));
    const singletonValid =
      singletonGroups.length > 1 &&
      singletonGroups.every((group) => Number(group.upperBoundEffortMinutes) <= 240) &&
      new Set(taskRefs).size === taskRefs.length &&
      new Set(traceRefs).size === traceRefs.length &&
      JSON.stringify(unique(taskRefs)) === JSON.stringify(unique(expectedTasks)) &&
      JSON.stringify(unique(traceRefs)) === JSON.stringify(unique(expectedTraces));
    if (singletonValid) {
      const policies = partitionPolicyIdentity(String(ir.schemaVersion));
      return {
        partitionOutcome: 'complete_valid',
        searchedStateCount: 1,
        groups: singletonGroups,
        hardCompatibilityPolicyHash: policies.hardCompatibilityPolicyHash,
        selectorPolicyHash: policies.selectorPolicyHash,
        selectionIdentityHash: hashControlPlaneValue({
          schemaVersion: 'FrozenGoalPartitionSelectionIdentity/v1',
          goalExecutionIRHash: String(ir.goalExecutionIRHash ?? ''),
          hardCompatibilityPolicyHash: policies.hardCompatibilityPolicyHash,
          selectorPolicyHash: policies.selectorPolicyHash,
          groups: singletonGroups.map((group) => ({
            componentRefs: group.componentRefs,
            taskRefs: group.taskRefs,
            ownedPaths: group.ownedPaths,
          })),
        }),
      };
    }
  }
  let searchedStateCount = 0;
  let truncated = false;
  const best: { groups: JsonObject[] | null; rank: string } = {
    groups: null,
    rank: '',
  };

  const evaluate = (groups: JsonObject[][]): void => {
    if (searchedStateCount >= maxSearchStates) {
      truncated = true;
      return;
    }
    searchedStateCount += 1;
    const materialized = hardValidPartitionGroups(ir, groups);
    if (!materialized) return;
    const rank = partitionSelectorRank(ir, groups, materialized);
    if (best.groups === null || rank < best.rank) {
      best.groups = materialized;
      best.rank = rank;
    }
  };

  const search = (index: number, groups: JsonObject[][]): void => {
    if (truncated) return;
    if (index === components.length) {
      evaluate(groups);
      return;
    }
    const component = components[index];
    search(index + 1, [...groups, [component]]);
    for (let groupIndex = 0; groupIndex < groups.length && !truncated; groupIndex += 1) {
      const nextGroups = groups.map((group) => [...group]);
      nextGroups[groupIndex].push(component);
      search(index + 1, nextGroups);
    }
  };

  if (components.length > 0) {
    search(1, [[components[0]]]);
  }
  const selectedGroups = ((): JsonObject[] | null => best.groups)();
  const partitionOutcome = selectedGroups
    ? truncated
      ? 'bounded_valid'
      : 'complete_valid'
    : truncated
      ? 'partition_search_inconclusive'
      : 'partition_no_valid_solution';
  const policies = partitionPolicyIdentity(
    typeof ir.schemaVersion === 'string' ? ir.schemaVersion : undefined
  );
  const groups = selectedGroups ?? [];
  const selectionIdentityHash = hashControlPlaneValue({
    schemaVersion: 'FrozenGoalPartitionSelectionIdentity/v1',
    goalExecutionIRHash: String(ir.goalExecutionIRHash ?? ''),
    hardCompatibilityPolicyHash: policies.hardCompatibilityPolicyHash,
    selectorPolicyHash: policies.selectorPolicyHash,
    groups: groups.map((group) => ({
      componentRefs: group.componentRefs,
      taskRefs: group.taskRefs,
      ownedPaths: group.ownedPaths,
    })),
  });
  return {
    partitionOutcome,
    searchedStateCount,
    groups,
    hardCompatibilityPolicyHash: policies.hardCompatibilityPolicyHash,
    selectorPolicyHash: policies.selectorPolicyHash,
    selectionIdentityHash,
  };
}

function compilePartitionFromFrozenGoalAuthority(input: {
  goalExecutionIr: JsonObject;
  eligibility: JsonObject;
  executionAdapterRef: { path: string; hash: string };
  solverEnvelope?: { maxSearchStates?: number };
}): {
  eligibility: JsonObject;
  manifest: JsonObject;
  files: Map<string, Buffer>;
  childPackages: Array<{ partitionId: string; relativePath: string; hash: string }>;
  selectionIdentityHash: string;
} {
  const ir = input.goalExecutionIr;
  const components = objects(input.eligibility.components);
  if (components.length < 2) {
    throw failure('partition_no_valid_solution', { reason: 'multiple_components_required' });
  }
  const selection = selectFrozenGoalPartition(input);
  if (
    selection.partitionOutcome === 'partition_no_valid_solution' ||
    selection.partitionOutcome === 'partition_search_inconclusive'
  ) {
    throw failure(String(selection.partitionOutcome), {
      executionMode: 'partitioned_goal',
      partitionOutcome: selection.partitionOutcome,
    });
  }
  const selectedGroups = objects(selection.groups);

  const partitionIdByComponent = new Map(
    selectedGroups.flatMap((group, index) =>
      strings(group.componentRefs).map((componentRef) => [
        componentRef,
        `PART-${String(index + 1).padStart(3, '0')}`,
      ])
    )
  );
  const componentByTask = new Map<string, string>();
  for (const group of selectedGroups) {
    const componentRef = strings(group.componentRefs)[0];
    for (const taskRef of strings(group.taskRefs)) {
      componentByTask.set(taskRef, componentRef);
    }
  }
  const traceSlices = objects(ir.traceSlices);
  const tasks = objects(ir.atomicTasks);
  const obligations = objects(ir.obligations);
  const spans = objects(ir.logicalSpecSpans);
  const commands = objects(ir.commands);
  const evidenceContracts = objects(ir.evidenceContracts);
  const artifacts = objects(ir.artifacts);
  const dependencies = objects(ir.dependencies);
  const files = new Map<string, Buffer>();
  const childPackages: Array<{ partitionId: string; relativePath: string; hash: string }> = [];
  const partitionRows: JsonObject[] = [];

  const coExecutionConstraints = objects(ir.coExecutionConstraints);
  for (const [index, group] of selectedGroups.entries()) {
    const componentRefs = unique(strings(group.componentRefs));
    const partitionId = `PART-${String(index + 1).padStart(3, '0')}`;
    const taskRefs = unique(strings(group.taskRefs));
    const taskRefSet = new Set(taskRefs);
    const traceSliceRefs = unique(strings(group.traceSliceRefs));
    const traceSliceRefSet = new Set(traceSliceRefs);
    const selectedTraces = traceSlices.filter((trace) =>
      traceSliceRefSet.has(String(trace.traceSliceId))
    );
    const authorityRefs = deriveGroupAuthorityRefs(ir, group);
    const obligationRefs = strings(authorityRefs.obligationRefs);
    const obligationRefSet = new Set(obligationRefs);
    const spanRefSet = new Set(strings(authorityRefs.logicalSpecSpanRefs));
    const commandRefs = new Set(strings(authorityRefs.commandRefs));
    const evidenceRefs = new Set(strings(authorityRefs.evidenceContractRefs));
    const artifactRefs = new Set(strings(authorityRefs.artifactRefs));
    const dependencyPartitionRefs = unique(
      dependencies.flatMap((dependency) => {
        if (!taskRefSet.has(String(dependency.from))) return [];
        const prerequisiteComponent = componentByTask.get(String(dependency.to));
        if (!prerequisiteComponent || componentRefs.includes(prerequisiteComponent)) return [];
        return [partitionIdByComponent.get(prerequisiteComponent)!];
      })
    );
    const ownedPaths = unique(strings(group.ownedPaths));
    const logicalScopes = scopedPartitionLogicalScopes(ir, group, authorityRefs);
    const forbiddenPaths = strings(logicalScopes.forbiddenPaths);
    const partitionMembership = {
      partitionId,
      componentRefs,
      taskRefs,
      traceSliceRefs,
      obligationRefs,
      ...(isTypedGoalExecutionIr(ir.schemaVersion)
        ? { inheritedObligationRefs: authorityRefs.inheritedObligationRefs }
        : {}),
      ...(standaloneExecutionConstraints(ir)
        ? { executionConstraintRefs: authorityRefs.executionConstraintRefs }
        : {}),
      dependencyPartitionRefs,
      expectedEffortMinutes: Number(group.expectedEffortMinutes),
      upperBoundEffortMinutes: Number(group.upperBoundEffortMinutes),
      ownedPaths,
      forbiddenPaths,
    };
    const partitionMembershipHash = hashControlPlaneValue(partitionMembership);
    const childContractId = `CHILD-${partitionMembershipHash
      .slice('sha256:'.length, 'sha256:'.length + 16)
      .toUpperCase()}`;
    const childPayload = {
      schemaVersion: isTypedGoalExecutionIr(ir.schemaVersion)
        ? 'GoalChildExecutionContract/v2'
        : 'GoalChildExecutionContract/v1',
      childContractId,
      partitionId,
      profile: ir.profile,
      goalId: ir.goalId,
      goalExecutionIRHash: ir.goalExecutionIRHash,
      partitionMembershipHash,
      componentRefs: partitionMembership.componentRefs,
      taskRefs: partitionMembership.taskRefs,
      traceSliceRefs: partitionMembership.traceSliceRefs,
      obligationRefs: partitionMembership.obligationRefs,
      ...(isTypedGoalExecutionIr(ir.schemaVersion)
        ? { inheritedObligationRefs: partitionMembership.inheritedObligationRefs }
        : {}),
      ...(standaloneExecutionConstraints(ir)
        ? {
            executionConstraintRefs: partitionMembership.executionConstraintRefs,
            executionConstraints: standaloneExecutionConstraints(ir)!.filter((row) =>
              strings(partitionMembership.executionConstraintRefs).includes(
                String(row.constraintId)
              )
            ),
          }
        : {}),
      dependencyPartitionRefs: partitionMembership.dependencyPartitionRefs,
      expectedEffortMinutes: partitionMembership.expectedEffortMinutes,
      upperBoundEffortMinutes: partitionMembership.upperBoundEffortMinutes,
      logicalScopes,
      obligations: obligations.filter((obligation) =>
        obligationRefSet.has(String(obligation.obligationId))
      ),
      logicalSpecSpans: spans.filter((span) => spanRefSet.has(String(span.specSpanId))),
      executionDomains: scopedPartitionDomains(ir, group, authorityRefs),
      traceSlices: selectedTraces,
      atomicTasks: selectByIds(tasks, 'taskId', taskRefSet),
      dependencies: dependencies.filter(
        (dependency) =>
          taskRefSet.has(String(dependency.from)) && taskRefSet.has(String(dependency.to))
      ),
      commands: commands.filter((command) => commandRefs.has(String(command.commandId))),
      evidenceContracts: evidenceContracts.filter((contract) =>
        evidenceRefs.has(String(contract.evidenceContractId))
      ),
      artifacts: artifacts.filter((artifact) => artifactRefs.has(String(artifact.artifactId))),
      coExecutionConstraints: coExecutionConstraints.filter((constraint) =>
        strings(constraint.taskRefs).some((taskRef) => taskRefSet.has(taskRef))
      ),
    };
    const childContract = {
      ...childPayload,
      childContractHash: hashControlPlaneValue(childPayload),
    };
    validateTypedPartitionChild(ir, components, partitionMembership, childContract);
    validateGoalContractSchema(CHILD_SCHEMA, childContract);
    const packaged = compileChildPackage(childContract, input.executionAdapterRef);
    const childRoot = `partition/children/${partitionId}`;
    files.set(`${childRoot}/child-execution-contract.json`, canonicalBytes(childContract));
    for (const [relativePath, bytes] of packaged.files) {
      files.set(`${childRoot}/${relativePath}`, bytes);
    }
    const packageRelativePath = `${childRoot}/package/child-execution-package.json`;
    childPackages.push({
      partitionId,
      relativePath: packageRelativePath,
      hash: String(packaged.childPackage.childExecutionPackageHash),
    });
    partitionRows.push({
      ...partitionMembership,
      childContractRef: {
        path: `children/${partitionId}/child-execution-contract.json`,
        hash: childContract.childContractHash,
      },
      childExecutionPackageRef: {
        path: `children/${partitionId}/package/child-execution-package.json`,
        hash: packaged.childPackage.childExecutionPackageHash,
      },
    });
  }

  if (!partitionAuthorityConserved(ir, selectedGroups)) {
    throw failure('partition_no_valid_solution', { reason: 'authority_conservation_invalid' });
  }

  const finalizedEligibilityPayload = {
    ...withoutHash(input.eligibility, 'eligibilityHash'),
    partitionOutcome: selection.partitionOutcome,
  };
  const finalizedEligibility = {
    ...finalizedEligibilityPayload,
    eligibilityHash: hashControlPlaneValue(finalizedEligibilityPayload),
  };
  validateGoalContractSchema(ELIGIBILITY_SCHEMA, finalizedEligibility);
  const manifestPayload = {
    schemaVersion: isTypedGoalExecutionIr(ir.schemaVersion)
      ? 'GoalContractPartitionManifest/v2'
      : 'GoalContractPartitionManifest/v1',
    profile: ir.profile,
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    hardCompatibilityPolicyHash: selection.hardCompatibilityPolicyHash,
    selectorPolicyHash: selection.selectorPolicyHash,
    partitionOutcome: selection.partitionOutcome,
    partitionCount: partitionRows.length,
    topologicalOrder: partitionRows.map((partition) => String(partition.partitionId)),
    partitions: partitionRows,
  };
  const manifest = {
    ...manifestPayload,
    partitionManifestHash: hashControlPlaneValue(manifestPayload),
  };
  validateGoalContractSchema(MANIFEST_SCHEMA, manifest);
  files.set('partition/manifest.json', canonicalBytes(manifest));
  return {
    eligibility: finalizedEligibility,
    manifest,
    files,
    childPackages,
    selectionIdentityHash: String(selection.selectionIdentityHash),
  };
}

export {
  compilePartitionFromFrozenGoalAuthority,
  directGoalExecutionTopologyAdmissible,
  partitionPolicyIdentity,
  validateTypedPartitionChild,
  selectFrozenGoalPartition,
};

module.exports = {
  compilePartitionFromFrozenGoalAuthority,
  directGoalExecutionTopologyAdmissible,
  partitionPolicyIdentity,
  validateTypedPartitionChild,
  selectFrozenGoalPartition,
};
