const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} = require(
  __filename.endsWith('.ts')
    ? './canonical-hash.ts'
    : './canonical-hash'
);
const {
  canonicalPartitionImpactPlanBasis,
} = require(
  __filename.endsWith('.ts')
    ? './partition-impact-graph.ts'
    : './partition-impact-graph'
);
const {
  loadPartitionImpactPolicy,
} = require(
  __filename.endsWith('.ts')
    ? './partition-impact-policy.ts'
    : './partition-impact-policy'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts')
    ? './schema-registry.ts'
    : './schema-registry'
);

export type GoalContractPartitionClosureFeasibilityModule = never;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ALLOWED_INPUT_FIELDS = new Set([
  'impactGraph',
  'packageRoot',
  'partitionPlan',
]);

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareIds);
}

function assertNoAuthorityInjection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('partition_closure_feasibility_input_invalid');
  }
  const forbiddenFields = Object.keys(input)
    .filter((field) => !ALLOWED_INPUT_FIELDS.has(field))
    .sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_impact_authority_injection', {
      forbiddenFields,
    });
  }
}

function assertHash(value, failureClass) {
  if (!HASH_PATTERN.test(String(value || ''))) {
    throw failure(failureClass);
  }
  return value;
}

function validateGraphSelfHash(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw failure('partition_impact_graph_missing');
  }
  const { impactGraphHash, ...semanticGraph } = graph;
  assertHash(
    impactGraphHash,
    'partition_impact_graph_hash_mismatch'
  );
  if (impactGraphHash !== hashControlPlaneValue(semanticGraph)) {
    throw failure('partition_impact_graph_hash_mismatch');
  }
}

function validateOwners(graph) {
  const artifactById = new Map();
  const artifactByPath = new Map();
  for (const artifact of graph.artifactNodes || []) {
    if (
      !artifact ||
      typeof artifact.artifactId !== 'string' ||
      typeof artifact.path !== 'string'
    ) {
      throw failure('partition_impact_owner_missing');
    }
    if (
      typeof artifact.ownerPartitionId !== 'string' ||
      artifact.ownerPartitionId.length === 0
    ) {
      throw failure('partition_impact_owner_missing', {
        artifactPath: artifact.path,
      });
    }
    const byId = artifactById.get(artifact.artifactId);
    const byPath = artifactByPath.get(artifact.path);
    if (
      (byId &&
        stableControlPlaneStringify(byId) !==
          stableControlPlaneStringify(artifact)) ||
      (byPath &&
        stableControlPlaneStringify(byPath) !==
          stableControlPlaneStringify(artifact))
    ) {
      throw failure('partition_impact_owner_ambiguous', {
        artifactPath: artifact.path,
      });
    }
    artifactById.set(artifact.artifactId, artifact);
    artifactByPath.set(artifact.path, artifact);
  }
  const commandById = new Map();
  for (const command of graph.commandNodes || []) {
    if (
      !command ||
      typeof command.commandId !== 'string' ||
      typeof command.commandOwnerPartitionId !== 'string' ||
      command.commandOwnerPartitionId.length === 0
    ) {
      throw failure('partition_impact_owner_missing', {
        commandId: command?.commandId || null,
      });
    }
    const existing = commandById.get(command.commandId);
    if (
      existing &&
      stableControlPlaneStringify(existing) !==
        stableControlPlaneStringify(command)
    ) {
      throw failure('partition_impact_owner_ambiguous', {
        commandId: command.commandId,
      });
    }
    commandById.set(command.commandId, command);
  }
  return { artifactById, artifactByPath, commandById };
}

function validateGraphSchema(graph, packageRoot) {
  try {
    validateGoalContractSchema(
      'goal-contract-partition-impact-graph.schema.json',
      graph,
      { packageRoot }
    );
  } catch (error) {
    throw failure('partition_impact_graph_schema_invalid', {
      validationErrors: error.validationErrors || [],
    });
  }
}

function dependencyState(planBasis) {
  const partitionIds = new Set(planBasis.topologicalOrder);
  const outgoing = new Map(
    planBasis.topologicalOrder.map((partitionId) => [
      partitionId,
      [],
    ])
  );
  const directPredecessors = new Map(
    planBasis.topologicalOrder.map((partitionId) => [
      partitionId,
      [],
    ])
  );
  const position = new Map(
    planBasis.topologicalOrder.map((partitionId, index) => [
      partitionId,
      index,
    ])
  );
  for (const edge of planBasis.dependencyEdges) {
    if (
      !partitionIds.has(edge.fromPartitionId) ||
      !partitionIds.has(edge.toPartitionId) ||
      position.get(edge.fromPartitionId) >=
        position.get(edge.toPartitionId)
    ) {
      throw failure('partition_closure_dependency_cycle', {
        partitionDependencyPath: unique([
          edge.fromPartitionId,
          edge.toPartitionId,
        ]),
      });
    }
    outgoing.get(edge.fromPartitionId).push(edge.toPartitionId);
    directPredecessors
      .get(edge.toPartitionId)
      .push(edge.fromPartitionId);
  }
  const predecessors = new Map();
  for (const partitionId of planBasis.topologicalOrder) {
    const reached = new Set();
    const queue = unique(directPredecessors.get(partitionId) || []);
    while (queue.length > 0) {
      const predecessorId = queue.shift();
      if (reached.has(predecessorId)) continue;
      reached.add(predecessorId);
      queue.push(
        ...unique(directPredecessors.get(predecessorId) || [])
      );
      queue.sort(compareIds);
    }
    predecessors.set(partitionId, unique([...reached]));
  }
  return { outgoing, position, predecessors };
}

function shortestDependencyPath(outgoing, start, target) {
  if (start === target) return [start];
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const currentPath = queue.shift();
    const current = currentPath.at(-1);
    for (const next of unique(outgoing.get(current) || [])) {
      if (visited.has(next)) continue;
      const nextPath = [...currentPath, next];
      if (next === target) return nextPath;
      visited.add(next);
      queue.push(nextPath);
    }
    queue.sort(
      (left, right) =>
        left.length - right.length ||
        compareIds(left.join('|'), right.join('|'))
    );
  }
  return [];
}

function outgoingEdges(graph) {
  const outgoing = new Map();
  for (const edge of graph.relationEdges || []) {
    const records = outgoing.get(edge.fromNodeId) || [];
    records.push(edge);
    outgoing.set(
      edge.fromNodeId,
      records.sort((left, right) =>
        compareIds(left.edgeId, right.edgeId)
      )
    );
  }
  return outgoing;
}

function currentBytesOwnership(planBasis, artifactByPath) {
  const finalGovernorByPath = new Map();
  const governingPartitionIdsByPath = new Map();
  const artifactIdsByPartition = new Map(
    planBasis.topologicalOrder.map((partitionId) => [
      partitionId,
      [],
    ])
  );
  for (const partition of planBasis.partitions) {
    for (const artifactPath of partition.governedPaths || []) {
      finalGovernorByPath.set(artifactPath, partition.partitionId);
      const governingPartitionIds =
        governingPartitionIdsByPath.get(artifactPath) || [];
      governingPartitionIds.push(partition.partitionId);
      governingPartitionIdsByPath.set(
        artifactPath,
        unique(governingPartitionIds)
      );
    }
  }
  const ownerPartitionIdByArtifactId = new Map();
  const governingPartitionIdsByArtifactId = new Map();
  for (const artifact of artifactByPath.values()) {
    const currentOwnerPartitionId =
      finalGovernorByPath.get(artifact.path) ||
      artifact.ownerPartitionId;
    ownerPartitionIdByArtifactId.set(
      artifact.artifactId,
      currentOwnerPartitionId
    );
    governingPartitionIdsByArtifactId.set(
      artifact.artifactId,
      governingPartitionIdsByPath.get(artifact.path) || [
        artifact.ownerPartitionId,
      ]
    );
    if (
      artifact.mutable &&
      artifactIdsByPartition.has(currentOwnerPartitionId)
    ) {
      artifactIdsByPartition
        .get(currentOwnerPartitionId)
        .push(artifact.artifactId);
    }
  }
  for (const [partitionId, artifactIds] of artifactIdsByPartition) {
    artifactIdsByPartition.set(partitionId, unique(artifactIds));
  }
  return {
    artifactIdsByPartition,
    governingPartitionIdsByArtifactId,
    ownerPartitionIdByArtifactId,
  };
}

function closureForPartition({
  graph,
  partitionNode,
  rootArtifactIds,
  artifactById,
  commandById,
  currentBytes,
  availableOwners,
}) {
  const outgoing = outgoingEdges(graph);
  const chainByNodeId = new Map();
  const analyzedArtifactIds = new Set();
  const queue = [];
  for (const artifactId of unique(rootArtifactIds)) {
    chainByNodeId.set(artifactId, []);
    queue.push(artifactId);
  }
  for (const commandId of unique(partitionNode.commandIds)) {
    if (!commandById.has(commandId)) continue;
    const commandNodeId = `command:${commandId}`;
    chainByNodeId.set(commandNodeId, []);
    queue.push(commandNodeId);
  }
  while (queue.length > 0) {
    queue.sort((left, right) => {
      const leftChain = chainByNodeId.get(left) || [];
      const rightChain = chainByNodeId.get(right) || [];
      return (
        leftChain.length - rightChain.length ||
        compareIds(leftChain.join('|'), rightChain.join('|')) ||
        compareIds(left, right)
      );
    });
    const currentNodeId = queue.shift();
    const currentChain = chainByNodeId.get(currentNodeId) || [];
    if (artifactById.has(currentNodeId)) {
      analyzedArtifactIds.add(currentNodeId);
    }
    for (const edge of outgoing.get(currentNodeId) || []) {
      if (edge.relationKind === 'command_artifact') continue;
      const nextNodeId = edge.toNodeId;
      const nextChain = [...currentChain, edge.edgeId];
      const existing = chainByNodeId.get(nextNodeId);
      if (
        existing &&
        (existing.length < nextChain.length ||
          (existing.length === nextChain.length &&
            compareIds(existing.join('|'), nextChain.join('|')) <= 0))
      ) {
        continue;
      }
      chainByNodeId.set(nextNodeId, nextChain);
      const nextArtifact = artifactById.get(nextNodeId);
      const currentOwnerPartitionId = nextArtifact
        ? currentBytes.ownerPartitionIdByArtifactId.get(nextNodeId) ||
          nextArtifact.ownerPartitionId
        : null;
      if (
        nextArtifact &&
        (!nextArtifact.mutable ||
          availableOwners.has(currentOwnerPartitionId))
      ) {
        queue.push(nextNodeId);
      } else if (
        nextNodeId.startsWith('command:') &&
        commandById.has(nextNodeId.slice('command:'.length))
      ) {
        queue.push(nextNodeId);
      }
    }
  }
  return {
    analyzedArtifactIds: unique([...analyzedArtifactIds]),
    chainByNodeId,
    artifactIds: unique(
      [...chainByNodeId.keys()].filter((nodeId) =>
        artifactById.has(nodeId)
      )
    ),
    commandIds: unique(
      [...chainByNodeId.keys()]
        .filter((nodeId) => nodeId.startsWith('command:'))
        .map((nodeId) => nodeId.slice('command:'.length))
        .filter((commandId) => commandById.has(commandId))
    ),
  };
}

function issueSortKey(issue) {
  return [
    issue.partitionId,
    issue.issueCode,
    issue.blockingOwnerPartitionId,
    issue.affectedArtifactPaths.join('|'),
    issue.affectedCommandIds.join('|'),
    issue.minimalConflictChain.join('|'),
  ].join('::');
}

function issue({
  issueCode,
  partitionId,
  affectedArtifactPaths = [],
  affectedCommandIds = [],
  blockingOwnerPartitionId,
  partitionDependencyPath = [],
  minimalConflictChain = [],
  repairClass,
}) {
  return {
    issueCode,
    partitionId,
    affectedArtifactPaths: unique(affectedArtifactPaths),
    affectedCommandIds: unique(affectedCommandIds),
    currentOwnerPartitionId: partitionId,
    blockingOwnerPartitionId,
    partitionDependencyPath: [...partitionDependencyPath],
    minimalConflictChain: [...minimalConflictChain],
    provenanceRefs: unique(minimalConflictChain),
    repairClass,
  };
}

function partitionFeasibility({
  graph,
  partitionNode,
  dependency,
  artifacts,
  currentBytes,
  policy,
}) {
  const partitionId = partitionNode.partitionId;
  const availableOwnerSet = unique([
    'baseline',
    partitionId,
    ...(dependency.predecessors.get(partitionId) || []),
  ]);
  const availableOwners = new Set(availableOwnerSet);
  const closure = closureForPartition({
    graph,
    partitionNode,
    rootArtifactIds:
      currentBytes.artifactIdsByPartition.get(partitionId) || [],
    artifactById: artifacts.artifactById,
    commandById: artifacts.commandById,
    currentBytes,
    availableOwners,
  });
  const blockingIssues = [];
  const futureOwnerEvidence = new Map();
  for (const artifactId of closure.artifactIds) {
    const artifact = artifacts.artifactById.get(artifactId);
    const blockingOwnerPartitionId =
      currentBytes.ownerPartitionIdByArtifactId.get(artifactId) ||
      artifact.ownerPartitionId;
    const hasAvailableGovernor = (
      currentBytes.governingPartitionIdsByArtifactId.get(artifactId) || []
    ).some((governingPartitionId) =>
      availableOwners.has(governingPartitionId)
    );
    const currentPosition = dependency.position.get(partitionId);
    const blockingOwnerPosition = dependency.position.get(
      blockingOwnerPartitionId
    );
    const isPresentFutureInterface =
      artifact.existenceState === 'present' &&
      Number.isInteger(currentPosition) &&
      Number.isInteger(blockingOwnerPosition) &&
      blockingOwnerPosition > currentPosition;
    if (
      !artifact.mutable ||
      availableOwners.has(blockingOwnerPartitionId) ||
      hasAvailableGovernor ||
      isPresentFutureInterface
    ) {
      continue;
    }
    const dependencyPath = shortestDependencyPath(
      dependency.outgoing,
      partitionId,
      blockingOwnerPartitionId
    );
    const conflictChain = closure.chainByNodeId.get(artifactId) || [];
    blockingIssues.push(
      issue({
        issueCode: 'future_owned_artifact_dependency',
        partitionId,
        affectedArtifactPaths: [artifact.path],
        blockingOwnerPartitionId,
        partitionDependencyPath: dependencyPath,
        minimalConflictChain: conflictChain,
        repairClass: dependencyPath.length > 0
          ? 'source_task_colocation_required'
          : 'source_dependency_change_required',
      })
    );
    futureOwnerEvidence.set(blockingOwnerPartitionId, {
      affectedArtifactPaths: [artifact.path],
      affectedCommandIds: [],
      dependencyPath,
      conflictChain,
    });
  }
  for (const commandId of closure.commandIds) {
    const command = artifacts.commandById.get(commandId);
    if (availableOwners.has(command.commandOwnerPartitionId)) continue;
    const dependencyPath = shortestDependencyPath(
      dependency.outgoing,
      partitionId,
      command.commandOwnerPartitionId
    );
    const conflictChain =
      closure.chainByNodeId.get(`command:${commandId}`) || [];
    blockingIssues.push(
      issue({
        issueCode: 'future_owned_regression_dependency',
        partitionId,
        affectedCommandIds: [commandId],
        blockingOwnerPartitionId:
          command.commandOwnerPartitionId,
        partitionDependencyPath: dependencyPath,
        minimalConflictChain: conflictChain,
        repairClass: 'source_command_assignment_required',
      })
    );
    futureOwnerEvidence.set(command.commandOwnerPartitionId, {
      affectedArtifactPaths: [],
      affectedCommandIds: [commandId],
      dependencyPath,
      conflictChain,
    });
  }
  const closurePaths = new Set(
    closure.analyzedArtifactIds.map(
      (artifactId) => artifacts.artifactById.get(artifactId).path
    )
  );
  for (const unsupported of graph.unsupportedRelationRecords || []) {
    if (!closurePaths.has(unsupported.sourcePath)) continue;
    blockingIssues.push(
      issue({
        issueCode: 'partition_impact_coverage_incomplete',
        partitionId,
        affectedArtifactPaths: [unsupported.sourcePath],
        blockingOwnerPartitionId: partitionId,
        minimalConflictChain: [],
        repairClass: 'unsupported_relation_registration_required',
      })
    );
  }
  for (const [
    blockingOwnerPartitionId,
    evidence,
  ] of [...futureOwnerEvidence.entries()].sort(([left], [right]) =>
    compareIds(left, right)
  )) {
    if (evidence.dependencyPath.length === 0) continue;
    blockingIssues.push(
      issue({
        issueCode: 'partition_closure_dependency_cycle',
        partitionId,
        affectedArtifactPaths: evidence.affectedArtifactPaths,
        affectedCommandIds: evidence.affectedCommandIds,
        blockingOwnerPartitionId,
        partitionDependencyPath: evidence.dependencyPath,
        minimalConflictChain: evidence.conflictChain,
        repairClass: 'source_task_colocation_required',
      })
    );
  }
  const boundedIssues = blockingIssues
    .sort((left, right) =>
      compareIds(issueSortKey(left), issueSortKey(right))
    )
    .slice(0, policy.maxConflictChainsPerPartition);
  const semanticRecord = {
    partitionId,
    availableOwnerSet,
    closureRelevantArtifactIds: closure.artifactIds,
    closureRelevantCommandIds: closure.commandIds,
    blockingIssues: boundedIssues,
    decision: boundedIssues.length === 0 ? 'pass' : 'blocked',
  };
  return {
    ...semanticRecord,
    partitionClosureFeasibilityHash:
      hashControlPlaneValue(semanticRecord),
  };
}

function validateReceipt(receipt, packageRoot) {
  try {
    validateGoalContractSchema(
      'goal-contract-partition-closure-feasibility-receipt.schema.json',
      receipt,
      { packageRoot }
    );
  } catch (error) {
    throw failure('partition_closure_feasibility_schema_invalid', {
      validationErrors: error.validationErrors || [],
    });
  }
}

function compilePartitionClosureFeasibility(input = {}) {
  assertNoAuthorityInjection(input);
  validateGraphSelfHash(input.impactGraph);
  const owners = validateOwners(input.impactGraph);
  validateGraphSchema(input.impactGraph, input.packageRoot);
  const partitionPlan = input.partitionPlan;
  if (!partitionPlan || typeof partitionPlan !== 'object') {
    throw failure('partition_closure_feasibility_input_invalid');
  }
  assertHash(
    partitionPlan.partitionPlanHash,
    'partition_plan_hash_mismatch'
  );
  const planBasis =
    canonicalPartitionImpactPlanBasis(partitionPlan);
  const partitionPlanBasisHash = hashControlPlaneValue(planBasis);
  if (
    input.impactGraph.partitionPlanBasisHash !==
    partitionPlanBasisHash
  ) {
    throw failure('partition_impact_plan_binding_mismatch');
  }
  const policy = loadPartitionImpactPolicy({
    packageRoot: input.packageRoot,
  });
  if (
    input.impactGraph.partitionImpactPolicyHash !==
    policy.partitionImpactPolicyHash
  ) {
    throw failure('partition_impact_policy_mismatch');
  }
  const dependency = dependencyState(planBasis);
  const currentBytes = currentBytesOwnership(
    planBasis,
    owners.artifactByPath
  );
  const graphPartitionById = new Map(
    input.impactGraph.partitionNodes.map((partition) => [
      partition.partitionId,
      partition,
    ])
  );
  const partitionRecords = planBasis.topologicalOrder.map(
    (partitionId) => {
      const partitionNode = graphPartitionById.get(partitionId);
      if (!partitionNode) {
        throw failure('partition_impact_coverage_incomplete', {
          partitionId,
          reason: 'partition_node_missing',
        });
      }
      return partitionFeasibility({
        graph: input.impactGraph,
        partitionNode,
        dependency,
        artifacts: owners,
        currentBytes,
        policy,
      });
    }
  );
  const blockingIssues = partitionRecords
    .flatMap((record) => record.blockingIssues)
    .sort((left, right) =>
      compareIds(issueSortKey(left), issueSortKey(right))
    );
  const payload = {
    schemaVersion:
      'goal-contract-partition-closure-feasibility-receipt/v1',
    partitionPlanBasisHash,
    partitionImpactGraphHash:
      input.impactGraph.impactGraphHash,
    repositoryTreeHash: input.impactGraph.repositoryTreeHash,
    partitionImpactPolicyHash:
      input.impactGraph.partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash:
      input.impactGraph.analyzerIdentityHash,
    partitionRecords,
    blockingIssues,
    decision: blockingIssues.length === 0 ? 'pass' : 'blocked',
  };
  const receipt = {
    ...payload,
    receiptHash: hashControlPlaneValue(payload),
  };
  validateReceipt(receipt, input.packageRoot);
  return deepFreeze(receipt);
}

function verifyPartitionClosureFeasibility(input = {}) {
  const receipt = input.receipt;
  if (!receipt || typeof receipt !== 'object') {
    throw failure('partition_closure_feasibility_receipt_missing');
  }
  const { receiptHash, ...payload } = receipt;
  if (
    !HASH_PATTERN.test(String(receiptHash || '')) ||
    receiptHash !== hashControlPlaneValue(payload)
  ) {
    throw failure(
      'partition_closure_feasibility_receipt_hash_mismatch'
    );
  }
  const { receipt: _ignored, ...compileInput } = input;
  const current =
    compilePartitionClosureFeasibility(compileInput);
  if (
    stableControlPlaneStringify(current) !==
    stableControlPlaneStringify(receipt)
  ) {
    throw failure(
      'partition_closure_feasibility_receipt_stale',
      {
        expectedReceiptHash: current.receiptHash,
        actualReceiptHash: receipt.receiptHash,
      }
    );
  }
  return Object.freeze({
    decision: 'pass',
    receiptHash: receipt.receiptHash,
  });
}

module.exports = {
  compilePartitionClosureFeasibility,
  verifyPartitionClosureFeasibility,
};
