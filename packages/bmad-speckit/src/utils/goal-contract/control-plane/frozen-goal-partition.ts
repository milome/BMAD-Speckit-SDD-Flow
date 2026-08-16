const { createHash } = require('node:crypto');
const { hashControlPlaneValue, stableControlPlaneStringify } = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const { validateGoalContractSchema } = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);

export type FrozenGoalPartitionModule = never;

type JsonObject = Record<string, unknown>;

const ELIGIBILITY_SCHEMA = 'goal-contract-execution-eligibility.schema.json';
const MANIFEST_SCHEMA = 'goal-contract-frozen-partition-manifest.schema.json';
const CHILD_SCHEMA = 'goal-child-execution-contract.schema.json';
const CHILD_PACKAGE_SCHEMA = 'goal-contract-child-execution-package.schema.json';
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

function partitionPolicyIdentity() {
  return {
    hardPolicy: PARTITION_HARD_POLICY,
    selectorPolicy: PARTITION_SELECTOR_POLICY,
    hardCompatibilityPolicyHash: hashControlPlaneValue(PARTITION_HARD_POLICY),
    selectorPolicyHash: hashControlPlaneValue(PARTITION_SELECTOR_POLICY),
  };
}

function componentOwnedPaths(ir: JsonObject, component: JsonObject): string[] {
  const frozenOwnedPaths = unique(strings(component.ownedPaths));
  if (frozenOwnedPaths.length > 0) return frozenOwnedPaths;
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

function specSpanObligationRefs(span: JsonObject): string[] {
  return unique([
    ...strings(span.boundObligationIds),
    ...strings(span.obligationRefs),
    ...(typeof span.obligationRef === 'string' ? [span.obligationRef] : []),
  ]);
}

function deriveGroupAuthorityRefs(ir: JsonObject, group: JsonObject): JsonObject {
  const taskRefs = new Set(strings(group.taskRefs));
  const traceRefs = new Set(strings(group.traceSliceRefs));
  const tasks = objects(ir.atomicTasks).filter((task) => taskRefs.has(String(task.taskId)));
  const traces = objects(ir.traceSlices).filter((trace) =>
    traceRefs.has(String(trace.traceSliceId))
  );
  const obligationRefs = unique(traces.flatMap((trace) => strings(trace.obligationRefs)));
  const obligationRefSet = new Set(obligationRefs);
  const atomRefSet = new Set(tasks.flatMap((task) => strings(task.atomRefs)));
  const commandRefs = unique(traces.flatMap((trace) => strings(trace.commandRefs)));
  const evidenceContractRefs = unique(
    traces.flatMap((trace) => strings(trace.evidenceContractRefs))
  );
  const logicalSpecSpanRefs = unique(
    objects(ir.logicalSpecSpans)
      .filter((span) =>
        specSpanObligationRefs(span).some((obligationRef) => obligationRefSet.has(obligationRef))
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
  return {
    taskRefs: unique([...taskRefs]),
    traceSliceRefs: unique([...traceRefs]),
    obligationRefs,
    logicalSpecSpanRefs,
    commandRefs,
    evidenceContractRefs,
    artifactRefs,
  };
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

function groupsHaveCompatibleIsolation(ir: JsonObject, groups: JsonObject[]): boolean {
  const domainById = new Map(
    objects(ir.executionDomains).map((domain) => [String(domain.executionDomainId), domain])
  );
  return groups.every((group) => {
    const domains = strings(group.executionDomainRefs)
      .map((domainRef) => domainById.get(domainRef))
      .filter((domain): domain is JsonObject => Boolean(domain));
    const isolationModes = unique(
      domains.map((domain) => String(domain.isolationMode ?? '')).filter(Boolean)
    );
    if (isolationModes.length > 1) return false;
    const ownerByPath = new Map<string, string>();
    for (const ownership of domains.flatMap((domain) => objects(domain.ownership))) {
      const targetPath = String(ownership.targetPath ?? '');
      const owner = String(ownership.owner ?? '');
      if (!targetPath || !owner) continue;
      const existing = ownerByPath.get(targetPath);
      if (existing && existing !== owner) return false;
      ownerByPath.set(targetPath, owner);
    }
    return true;
  });
}

function partitionAuthorityConserved(ir: JsonObject, groups: JsonObject[]): boolean {
  if (!groupsHaveCompatibleIsolation(ir, groups)) return false;
  const assignments = groups.map((group) => deriveGroupAuthorityRefs(ir, group));
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
  if (
    materialized.some(
      (group) =>
        Number(group.upperBoundEffortMinutes) > 240 || strings(group.ownedPaths).length === 0
    )
  ) {
    return null;
  }
  if (!partitionAuthorityConserved(ir, materialized)) return null;
  const ownedPaths = materialized.flatMap((group) => strings(group.ownedPaths));
  const expectedOwnedPaths = unique(strings(object(ir.logicalScopes).ownedPaths));
  if (
    ownedPaths.length !== new Set(ownedPaths).size ||
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
    ...objects(child.obligations).map(
      (obligation) =>
        `- ${String(obligation.kind)} ${String(obligation.obligationId)}: ${String(obligation.text)}`
    ),
    '',
    '## Atomic Tasks',
    ...objects(child.atomicTasks).map((task) => `- ${String(task.taskId)}: ${String(task.title)}`),
    '',
  ].join('\n');
}

function compileChildPackage(child: JsonObject): {
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
    schemaVersion: 'GoalContractChildExecutionPackage/v1',
    profile: child.profile,
    goalId: child.goalId,
    goalExecutionIRHash: child.goalExecutionIRHash,
    executionMode: 'partitioned_goal',
    partitionId: child.partitionId,
    childContractRef: {
      path: 'child-execution-contract.json',
      hash: child.childContractHash,
    },
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
  let searchedStateCount = 0;
  let truncated = false;
  let bestGroups: JsonObject[] | null = null;
  let bestRank = '';

  const evaluate = (groups: JsonObject[][]): void => {
    if (searchedStateCount >= maxSearchStates) {
      truncated = true;
      return;
    }
    searchedStateCount += 1;
    const materialized = hardValidPartitionGroups(ir, groups);
    if (!materialized) return;
    const rank = partitionSelectorRank(ir, groups, materialized);
    if (bestGroups === null || rank < bestRank) {
      bestGroups = materialized;
      bestRank = rank;
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
  const partitionOutcome = bestGroups
    ? truncated
      ? 'bounded_valid'
      : 'complete_valid'
    : truncated
      ? 'partition_search_inconclusive'
      : 'partition_no_valid_solution';
  const policies = partitionPolicyIdentity();
  const groups = bestGroups ?? [];
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
  const forbiddenPaths = unique(strings(object(ir.logicalScopes).forbiddenPaths));
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

  const executionDomains = objects(ir.executionDomains);
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
    const executionDomainRefs = unique(strings(group.executionDomainRefs));
    const executionDomainRefSet = new Set(executionDomainRefs);
    const ownedPaths = unique(strings(group.ownedPaths));
    const partitionMembership = {
      partitionId,
      componentRefs,
      taskRefs,
      traceSliceRefs,
      obligationRefs,
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
      schemaVersion: 'GoalChildExecutionContract/v1',
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
      dependencyPartitionRefs: partitionMembership.dependencyPartitionRefs,
      expectedEffortMinutes: partitionMembership.expectedEffortMinutes,
      upperBoundEffortMinutes: partitionMembership.upperBoundEffortMinutes,
      logicalScopes: { ownedPaths, forbiddenPaths },
      obligations: obligations.filter((obligation) =>
        obligationRefSet.has(String(obligation.obligationId))
      ),
      logicalSpecSpans: spans.filter((span) => spanRefSet.has(String(span.specSpanId))),
      executionDomains: executionDomains.filter((domain) =>
        executionDomainRefSet.has(String(domain.executionDomainId))
      ),
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
    validateGoalContractSchema(CHILD_SCHEMA, childContract);
    const packaged = compileChildPackage(childContract);
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
    schemaVersion: 'GoalContractPartitionManifest/v1',
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

module.exports = {
  compilePartitionFromFrozenGoalAuthority,
  directGoalExecutionTopologyAdmissible,
  partitionPolicyIdentity,
  selectFrozenGoalPartition,
};
