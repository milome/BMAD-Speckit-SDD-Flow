const { createHash } = require('node:crypto');
const path = require('node:path');

export type GoalContractPartitionCompilerModule = never;

type CanonicalIntentRecord = {
  intentRecordId: string;
  semanticOwnershipKey: string;
};

type SubordinateSourceDescriptor = {
  sourceArtifactId: string;
  parentTaskRefs: unknown[];
};

type SubordinateObligation = {
  intentRecordId: string;
  declaredSourceId: string;
  semanticOwnershipKey: string;
  namespace: string;
  sourceArtifactId: string;
  sourceSnapshotHash: string;
  sourceRole: string;
  parentTaskRefs: string[];
  specSpanRefs: string[];
};

type SubordinateCoverageReceipt = {
  sourceArtifactId: string;
  receiptHash: string;
};

type SpecSpanAuthority = {
  specSpanId: string;
  sourceArtifactId: string;
  namespace: string;
  sourceSnapshotHash: string;
};

type PartitionCompileRequest = {
  sourceCompositionPolicy?: unknown;
  orderedSourceSnapshotSet?: unknown;
  compositeSourceAuthorityBundle?: unknown;
  canonicalIntentBundle?: unknown;
  goalContractBundle?: unknown;
  subordinateCoverageReceipts?: unknown;
  sourceSnapshot?: {
    aggregateHash?: string;
    sourcePath?: string;
    sourceId?: string;
  };
  sourceObligationGraph?: {
    specSpanRegistryHash?: string;
    [key: string]: unknown;
  };
  methodologyProfile?: {
    methodologyProfileHash?: string;
  };
  partitionPolicyBinding?: unknown;
  reconciledGraph?: unknown;
  reconciliationReceiptHash?: string;
  sequenceApplicabilityReceipt?: unknown;
  sequenceConstraintInput?: unknown;
  sequenceExecutionState?: unknown;
  repositoryFacts?: unknown;
  [key: string]: unknown;
};

function modulePath(relativePath) {
  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
}

const { hashControlPlaneValue, stableControlPlaneStringify } = require(
  modulePath('./canonical-hash')
);
const { verifyCanonicalIntentBundle } = require(modulePath('./canonical-intent-compiler'));
const { verifyCompositeSourceAuthorityBundle } = require(
  modulePath('./composite-source-authority-bundle')
);
const { validateGoalContractSchema } = require(modulePath('./schema-registry'));
const { verifySourceCompositionPolicy } = require(modulePath('./source-composition-policy'));
const { verifyOrderedSourceSnapshotSet } = require(modulePath('./source-snapshot'));
const { compileExecutionProjection } = require(modulePath('../execution-projection'));
const { hashSourceObligationGraph } = require(modulePath('../source-obligation-extractor'));
const { buildPartitionComponents } = require(modulePath('../partition-components'));
const { optimizePartitions } = require(modulePath('../partition-optimizer'));
const { assertCurrentPartitionPolicyBinding } = require(modulePath('../partition-policy'));
const { finalizePartitionManifest } = require(modulePath('../partition-manifest'));
const { createPendingChildCompilationReceipt } = require(modulePath('../partition-receipts'));

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const COMMAND_KINDS = Object.freeze(['direct', 'impacted', 'integration', 'regression']);
const ALLOWED_REQUEST_FIELDS = new Set([
  'sourceCompositionPolicy',
  'orderedSourceSnapshotSet',
  'compositeSourceAuthorityBundle',
  'canonicalIntentBundle',
  'goalContractBundle',
  'subordinateCoverageReceipts',
  'methodologyProfile',
  'partitionPolicyBinding',
  'reconciledGraph',
  'reconciliationReceiptHash',
  'sequenceApplicabilityReceipt',
  'sequenceConstraintInput',
  'sequenceExecutionState',
  'repositoryFacts',
]);

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...extra,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareIds(left, right) {
  const normalizedLeft = String(left);
  const normalizedRight = String(right);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function canonicalIdentifierList(values = []) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(compareIds);
}

function unique(values = []) {
  return canonicalIdentifierList(values);
}

function intersects(left = [], right = new Set<string>()) {
  return (left || []).some((value) => right.has(String(value)));
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function commandReferences(slice) {
  return unique(COMMAND_KINDS.flatMap((kind) => slice?.[`${kind}Commands`] || []));
}

function typedCommandAuthority(reconciledGraph) {
  const commands = isRecord(reconciledGraph?.commands) ? reconciledGraph.commands : {};
  const recordsById = new Map();
  for (const kind of COMMAND_KINDS) {
    const records = commands[kind] || [];
    if (!Array.isArray(records)) {
      throw failure('command_projection_type_leak', {
        commandKind: kind,
        reason: 'command_collection_not_array',
      });
    }
    for (const candidate of records) {
      if (!isRecord(candidate)) {
        throw failure('command_projection_type_leak', {
          commandKind: kind,
          reason: 'command_record_not_object',
        });
      }
      const commandId = typeof candidate.id === 'string' ? candidate.id.trim() : '';
      const literal = typeof candidate.literal === 'string' ? candidate.literal.trim() : '';
      const sourceBinding = isRecord(candidate.sourceBinding) ? candidate.sourceBinding : null;
      const specSpanRefs = sourceBinding?.specSpanRefs;
      const hasSourceDeclaration =
        typeof sourceBinding?.sourcePlanPath === 'string' &&
        sourceBinding.sourcePlanPath.length > 0 &&
        Number.isInteger(sourceBinding.lineStart) &&
        sourceBinding.lineStart > 0 &&
        Number.isInteger(sourceBinding.lineEnd) &&
        sourceBinding.lineEnd >= sourceBinding.lineStart &&
        HASH_PATTERN.test(String(sourceBinding.textHash || ''));
      const hasSpecSpanBinding =
        Array.isArray(specSpanRefs) &&
        specSpanRefs.length > 0 &&
        specSpanRefs.every(
          (specSpanRef) => typeof specSpanRef === 'string' && specSpanRef.length > 0
        );
      const missingFields = [
        ['id', commandId],
        ['literal', literal],
        ['commandTextHash', HASH_PATTERN.test(String(candidate.commandTextHash || ''))],
        [
          'workingDirectory',
          typeof candidate.workingDirectory === 'string' && candidate.workingDirectory.length > 0,
        ],
        ['shell', typeof candidate.shell === 'string' && candidate.shell.length > 0],
        ['runtime', typeof candidate.runtime === 'string' && candidate.runtime.length > 0],
        [
          'sourceBinding',
          Boolean(
            sourceBinding &&
            Array.isArray(specSpanRefs) &&
            (hasSourceDeclaration || hasSpecSpanBinding)
          ),
        ],
      ]
        .filter(([, present]) => !present)
        .map(([field]) => field);
      if (missingFields.length > 0) {
        throw failure('command_projection_type_leak', {
          commandId: commandId || null,
          commandKind: kind,
          missingFields,
        });
      }
      if (candidate.commandTextHash !== sha256Text(literal)) {
        throw failure('command_projection_command_hash_mismatch', {
          commandId,
          expectedHash: sha256Text(literal),
          actualHash: candidate.commandTextHash,
        });
      }
      const canonicalRecord = stableControlPlaneStringify(candidate);
      const existing = recordsById.get(commandId);
      if (existing && existing.canonicalRecord !== canonicalRecord) {
        throw failure('command_projection_duplicate_conflict', {
          commandId,
        });
      }
      recordsById.set(commandId, {
        canonicalRecord,
        record: candidate,
      });
    }
  }

  const referencedCommandIds = unique(
    (reconciledGraph?.traceSlices || []).flatMap(commandReferences)
  );
  for (const commandId of referencedCommandIds) {
    if (!recordsById.has(commandId)) {
      throw failure('command_projection_type_leak', {
        commandId,
        reason: 'typed_command_record_missing',
      });
    }
  }
  return {
    recordsById,
    referencedCommandIds,
  };
}

function requireHash(value, field) {
  if (!HASH_PATTERN.test(String(value || ''))) {
    throw failure('partition_authority_hash_invalid', { field, value });
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalizeSets(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeSets)
      .sort((left, right) =>
        stableControlPlaneStringify(left).localeCompare(stableControlPlaneStringify(right), 'en')
      );
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareIds)
      .map((key) => [key, canonicalizeSets(value[key])])
  );
}

function canonicalGraphHash(graph) {
  return hashControlPlaneValue(canonicalizeSets(graph));
}

function authorityInjectionFields(request) {
  return Object.keys(request).filter((field) => !ALLOWED_REQUEST_FIELDS.has(field));
}

function assertNoAuthorityInjection(request) {
  if (!isRecord(request)) {
    throw failure('partition_compile_request_invalid');
  }
  const forbiddenFields = authorityInjectionFields(request).sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_authority_injection', { forbiddenFields });
  }
}

function receiptPayloadHash(receipt) {
  if (!isRecord(receipt)) return null;
  const payload = { ...receipt };
  delete payload.receiptHash;
  return hashControlPlaneValue(payload);
}

function orderedSourceBindings(snapshotSet) {
  return snapshotSet.sourceSnapshots
    .map((snapshot) => ({
      sourceOrder: snapshot.sourceOrder,
      sourceArtifactId: snapshot.sourceArtifactId,
      sourceRole: snapshot.sourceRole,
      namespace: snapshot.namespace,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
    }))
    .sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder ||
        compareIds(left.sourceArtifactId, right.sourceArtifactId)
    );
}

function exactCoverageReceipts(goalContractBundle) {
  return [...(goalContractBundle.subordinateSourceCoverageReceipts || [])].sort((left, right) =>
    compareIds(left.receiptHash, right.receiptHash)
  );
}

function verifyCoverageReceipts(goalContractBundle, receipts) {
  if (!Array.isArray(receipts)) {
    throw failure('subordinate_coverage_incomplete');
  }
  for (const receipt of receipts) {
    if (
      !isRecord(receipt) ||
      !HASH_PATTERN.test(String(receipt.receiptHash || '')) ||
      receiptPayloadHash(receipt) !== receipt.receiptHash
    ) {
      throw failure('subordinate_source_stale');
    }
  }
  const expectedHashes = exactCoverageReceipts(goalContractBundle).map(
    ({ receiptHash }) => receiptHash
  );
  const actualHashes = receipts.map(({ receiptHash }) => receiptHash).sort(compareIds);
  if (stableControlPlaneStringify(expectedHashes) !== stableControlPlaneStringify(actualHashes)) {
    throw failure('subordinate_source_stale', {
      expectedReceiptHashes: expectedHashes,
      actualReceiptHashes: actualHashes,
    });
  }
  return receipts
    .map((receipt) => structuredClone(receipt))
    .sort((left, right) => compareIds(left.receiptHash, right.receiptHash));
}

function verifyGoalContractBundle(bundle, authority) {
  if (!isRecord(bundle) || bundle.schemaVersion !== 'goal-contract-bundle/v1') {
    throw failure('goal_contract_bundle_invalid');
  }
  const fields = [
    ['sourceCompositionPolicyHash', authority.policy.sourceCompositionPolicyHash],
    ['orderedSourceSnapshotSetHash', authority.snapshotSet.orderedSourceSnapshotSetHash],
    ['sourceAuthorityBundleHash', authority.sourceAuthorityBundle.sourceAuthorityBundleHash],
    ['canonicalIntentSemanticHash', authority.canonicalIntentBundle.canonicalIntentSemanticHash],
    ['canonicalIntentBundleHash', authority.canonicalIntentBundle.canonicalIntentBundleHash],
    ['authorityAttestationHash', authority.canonicalIntentBundle.authorityAttestationHash],
  ];
  for (const [field, expected] of fields) {
    requireHash(bundle[field], field);
    if (bundle[field] !== expected) {
      throw failure('source_composition_policy_mismatch', {
        field,
        expected,
        actual: bundle[field],
      });
    }
  }
  for (const field of ['goalContractSemanticHash', 'goalContractHash', 'markdownHash']) {
    requireHash(bundle[field], field);
  }
  if (!isRecord(bundle.goalContractSemanticModel)) {
    throw failure('goal_contract_bundle_invalid');
  }
  return bundle;
}

function verifyAuthority(request) {
  const rawPolicy = request.sourceCompositionPolicy;
  const rawAuthorityBundle = request.compositeSourceAuthorityBundle;
  if (
    rawPolicy?.mode === 'single_source' &&
    Array.isArray(rawAuthorityBundle?.subordinateSources) &&
    rawAuthorityBundle.subordinateSources.length > 0
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  const policy = verifySourceCompositionPolicy(rawPolicy);
  const snapshotSet = verifyOrderedSourceSnapshotSet(request.orderedSourceSnapshotSet);
  const sourceAuthorityBundle = verifyCompositeSourceAuthorityBundle(rawAuthorityBundle);
  const canonicalIntentBundle = verifyCanonicalIntentBundle(request.canonicalIntentBundle);
  if (
    policy.sourceCompositionPolicyHash !== sourceAuthorityBundle.sourceCompositionPolicyHash ||
    policy.sourceCompositionPolicyHash !== canonicalIntentBundle.sourceCompositionPolicyHash ||
    snapshotSet.orderedSourceSnapshotSetHash !==
      sourceAuthorityBundle.orderedSourceSnapshotSetHash ||
    snapshotSet.orderedSourceSnapshotSetHash !==
      canonicalIntentBundle.orderedSourceSnapshotSetHash ||
    sourceAuthorityBundle.sourceAuthorityBundleHash !==
      canonicalIntentBundle.sourceAuthorityBundleHash
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    policy.mode === 'single_source' &&
    (sourceAuthorityBundle.subordinateSources.length > 0 ||
      snapshotSet.sourceSnapshots.length !== 1)
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  if (
    policy.mode === 'composite_required' &&
    sourceAuthorityBundle.subordinateSources.length === 0
  ) {
    throw failure('subordinate_source_missing');
  }
  const goalContractBundle = verifyGoalContractBundle(request.goalContractBundle, {
    policy,
    snapshotSet,
    sourceAuthorityBundle,
    canonicalIntentBundle,
  });
  const subordinateCoverageReceipts = verifyCoverageReceipts(
    goalContractBundle,
    request.subordinateCoverageReceipts
  );
  const methodologyProfile = request.methodologyProfile;
  requireHash(methodologyProfile?.methodologyProfileHash, 'methodologyProfileHash');
  if (!isRecord(request.reconciledGraph)) {
    throw failure('partition_reconciled_graph_missing');
  }
  requireHash(request.reconciliationReceiptHash, 'reconciliationReceiptHash');
  return {
    policy,
    snapshotSet,
    sourceAuthorityBundle,
    canonicalIntentBundle,
    goalContractBundle,
    subordinateCoverageReceipts,
    methodologyProfile,
  };
}

function sourceAuthorityProjection(authority) {
  return {
    sourceCompositionMode: authority.policy.mode,
    sourceCompositionPolicyHash: authority.policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
    orderedSourceBindings: orderedSourceBindings(authority.snapshotSet),
    sourceAuthorityBundleHash: authority.sourceAuthorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash: authority.canonicalIntentBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash: authority.canonicalIntentBundle.canonicalIntentBundleHash,
    specSpanRegistryHash: authority.canonicalIntentBundle.specSpanRegistry.specSpanRegistryHash,
    intentAuthorityAttestationHash: authority.canonicalIntentBundle.authorityAttestationHash,
    subordinateCoverageReceiptHashes: authority.subordinateCoverageReceipts.map(
      ({ receiptHash }) => receiptHash
    ),
    goalContractSemanticHash: authority.goalContractBundle.goalContractSemanticHash,
    goalContractHash: authority.goalContractBundle.goalContractHash,
  };
}

function semanticRecordIndex(authority): Map<string, CanonicalIntentRecord> {
  return new Map<string, CanonicalIntentRecord>(
    authority.canonicalIntentBundle.canonicalIntentIR.map(
      (record) => [record.intentRecordId, record] as [string, CanonicalIntentRecord]
    )
  );
}

function subordinateObligations(authority): SubordinateObligation[] {
  const records = semanticRecordIndex(authority);
  const descriptors = new Map<string, SubordinateSourceDescriptor>(
    authority.sourceAuthorityBundle.subordinateSources.map(
      (descriptor) =>
        [descriptor.sourceArtifactId, descriptor] as [string, SubordinateSourceDescriptor]
    )
  );
  return authority.goalContractBundle.goalContractSemanticModel.records
    .filter(
      (record) =>
        record.sourceRole === 'subordinate_component_specification' &&
        record.ownership === 'owned_obligation' &&
        record.declaredSourceId
    )
    .map((record) => {
      const canonicalRecord = records.get(record.intentRecordId);
      const descriptor = descriptors.get(record.sourceArtifactId);
      if (!canonicalRecord || !descriptor) {
        throw failure('subordinate_source_stale', {
          intentRecordId: record.intentRecordId,
        });
      }
      return {
        intentRecordId: record.intentRecordId,
        declaredSourceId: record.declaredSourceId,
        semanticOwnershipKey: canonicalRecord.semanticOwnershipKey,
        namespace: record.namespace,
        sourceArtifactId: record.sourceArtifactId,
        sourceSnapshotHash: record.sourceSnapshotHash,
        sourceRole: record.sourceRole,
        parentTaskRefs: unique(descriptor.parentTaskRefs),
        specSpanRefs: unique(record.specSpanRefs),
      };
    })
    .sort((left, right) => compareIds(left.declaredSourceId, right.declaredSourceId));
}

function findPartitionForParentTasks(partitions, obligation) {
  const owners = partitions.filter((partition) =>
    obligation.parentTaskRefs.some((taskRef) => partition.primaryTaskIds.includes(taskRef))
  );
  if (owners.length !== 1) {
    throw failure('subordinate_scope_escape', {
      declaredSourceId: obligation.declaredSourceId,
      parentTaskRefs: obligation.parentTaskRefs,
      ownerPartitionIds: owners.map(({ partitionId }) => partitionId),
    });
  }
  return owners[0].partitionId;
}

function projectOwnedArtifactPaths({ components, fileScopeById, sharedArtifactOwnership = [] }) {
  const componentIds = new Set(components.map(({ componentId }) => componentId));
  const ownershipByPath = new Map(
    (sharedArtifactOwnership || []).map((ownership) => [ownership.path, ownership])
  );
  return unique(
    components.flatMap(({ fileScopeIds }) =>
      (fileScopeIds || [])
        .map((fileScopeId) => fileScopeById.get(fileScopeId))
        .filter((artifactPath) => {
          if (!artifactPath) return false;
          const ownership = ownershipByPath.get(artifactPath);
          return !ownership || componentIds.has(ownership.ownerComponentId);
        })
    )
  );
}

function partitionRecords(
  optimization,
  componentGraph,
  projection,
  reconciledGraph,
  commandAuthority
) {
  const componentById = new Map(
    componentGraph.components.map((component) => [component.componentId, component])
  );
  const fileScopeById = new Map(
    projection.fileScopeIndex.map((scope) => [scope.fileScopeId, scope.path])
  );
  return optimization.topologicalOrder.map((partitionId) => {
    const optimized = optimization.partitions.find(
      (partition) => partition.partitionId === partitionId
    );
    if (!optimized) {
      throw failure('partition_optimizer_currentness_mismatch', {
        partitionId,
      });
    }
    const components = optimized.primaryComponentIds.map((componentId) => {
      const component = componentById.get(componentId);
      if (!component) {
        throw failure('partition_component_unknown', {
          componentId,
          partitionId,
        });
      }
      return component;
    });
    const taskIds = new Set(unique(optimized.primaryTaskIds));
    const traceSliceIds = new Set(unique(optimized.primaryTraceSliceIds));
    const slices = (projection.traceSlices || []).filter(
      (slice) => traceSliceIds.has(String(slice.sliceId)) || intersects(slice.taskIds, taskIds)
    );
    const reconciledSlices = (
      Array.isArray(reconciledGraph?.traceSlices) ? reconciledGraph.traceSlices : []
    ).filter(
      (slice) =>
        traceSliceIds.has(String(slice.id || slice.sliceId)) ||
        intersects(slice.taskIds || slice.goalIds, taskIds)
    );
    const completionPredicateIds = unique(
      components.flatMap(({ completionPredicateIds: predicateIds }) => predicateIds || [])
    );
    const closureMinuteBreakdown = {
      declaredTaskMinutes: optimized.closureMinuteBreakdown.declaredTaskMinutes || 0,
      derivedTaskMinutes: optimized.closureMinuteBreakdown.derivedTaskMinutes || 0,
      verificationMinutes: optimized.closureMinuteBreakdown.verificationMinutes || 0,
      coordinationMinutes: optimized.closureMinuteBreakdown.coordinationMinutes || 0,
      totalMinutes: optimized.closureMinuteBreakdown.totalMinutes,
    };
    return {
      ...structuredClone(optimized),
      primaryComponentIds: unique(optimized.primaryComponentIds),
      primaryTraceSliceIds: unique(optimized.primaryTraceSliceIds),
      primaryTaskIds: unique(optimized.primaryTaskIds),
      outcome:
        unique(slices.map(({ observableOutcome }) => observableOutcome).filter(Boolean)).join(
          ' | '
        ) || `Complete ${unique(optimized.primaryTraceSliceIds).join(', ')}`,
      primaryEpicIds: unique(
        (projection.executionEpics || [])
          .filter(
            (epic) =>
              intersects(epic.taskIds, taskIds) || intersects(epic.traceSliceIds, traceSliceIds)
          )
          .map(({ epicId }) => epicId)
      ),
      dependencyPartitionIds: unique(optimized.dependencyPartitionIds),
      primarySourceObligationIds: unique(components.flatMap(({ sourceIds }) => sourceIds || [])),
      inheritedConstraintIds: unique(
        slices.flatMap(({ sequenceConstraintIds }) => sequenceConstraintIds || [])
      ),
      acceptanceIds: completionPredicateIds,
      commandIds: unique(
        reconciledSlices
          .flatMap(commandReferences)
          .filter((commandId) => commandAuthority.recordsById.has(commandId))
      ),
      completionPredicateIds,
      evidenceContractIds: unique(
        components.flatMap(({ evidenceContractIds }) => evidenceContractIds || [])
      ),
      ownedArtifactPaths: projectOwnedArtifactPaths({
        components,
        fileScopeById,
        sharedArtifactOwnership: componentGraph.sharedArtifactOwnership,
      }),
      blockedConditions: [],
      failureClasses: [],
      estimatedClosureCost: {
        unit: 'minutes',
        total: optimized.estimatedClosureMinutes,
        breakdown: closureMinuteBreakdown,
      },
      closureMinuteBreakdown,
    };
  });
}

function selectionRecords({
  partitions,
  obligations,
  reconciledGraph,
  sourceCompositionPolicyHash,
  subordinateCoverageReceiptHashes,
}) {
  const sourceObligationsById = new Map(
    (reconciledGraph.sourceObligations || []).map((obligation) => [obligation.id, obligation])
  );
  const obligationsByPartition = new Map<string, SubordinateObligation[]>(
    partitions.map(({ partitionId }) => [partitionId, []] as [string, SubordinateObligation[]])
  );
  for (const obligation of obligations) {
    obligationsByPartition
      .get(findPartitionForParentTasks(partitions, obligation))
      .push(obligation);
  }
  return partitions.map((partition) => {
    const primarySpecSpanRefs = unique(
      partition.primarySourceObligationIds.flatMap((sourceId) => {
        const source = sourceObligationsById.get(sourceId);
        return [...(source?.specSpanRefs || []), ...(source?.sourceBinding?.specSpanRefs || [])];
      })
    );
    const namespacedObligations = obligationsByPartition
      .get(partition.partitionId)
      .sort((left, right) => compareIds(left.declaredSourceId, right.declaredSourceId));
    const semantic = {
      partitionId: partition.partitionId,
      sourceCompositionPolicyHash,
      primaryComponentIds: partition.primaryComponentIds,
      primaryTraceSliceIds: partition.primaryTraceSliceIds,
      primaryTaskIds: partition.primaryTaskIds,
      dependencyPartitionIds: partition.dependencyPartitionIds,
      primarySourceObligationIds: partition.primarySourceObligationIds,
      completionPredicateIds: partition.completionPredicateIds,
      evidenceContractIds: partition.evidenceContractIds,
      ownedArtifactPaths: partition.ownedArtifactPaths,
      namespacedObligations,
      namespaceRefs: unique(namespacedObligations.map(({ namespace }) => namespace)),
      sourceArtifactRefs: unique(
        namespacedObligations.map(({ sourceArtifactId }) => sourceArtifactId)
      ),
      specSpanRefs: unique([
        ...primarySpecSpanRefs,
        ...namespacedObligations.flatMap(({ specSpanRefs }) => specSpanRefs),
      ]),
      subordinateCoverageReceiptHashes:
        namespacedObligations.length > 0 ? subordinateCoverageReceiptHashes : [],
    };
    return {
      ...semantic,
      selectionHash: hashControlPlaneValue(semantic),
    };
  });
}

function coverageObligations(projection, obligations, commandAuthority) {
  return {
    sourceObligationIds: unique(projection.traceSlices.flatMap(({ sourceIds }) => sourceIds)),
    traceSliceIds: unique(projection.traceSlices.map(({ sliceId }) => sliceId)),
    atomicTaskIds: unique(projection.atomicTasks.map(({ taskId }) => taskId)),
    completionPredicateIds: unique(
      projection.completionPredicates.map(({ predicateId }) => predicateId)
    ),
    commandIds: commandAuthority.referencedCommandIds,
    evidenceContractIds: unique(
      projection.evidenceContracts.map(({ evidenceContractId }) => evidenceContractId)
    ),
    subordinateDeclaredSourceIds: unique(
      obligations.map(({ declaredSourceId }) => declaredSourceId)
    ),
  };
}

function dependencyEdges(partitions) {
  return partitions
    .flatMap((partition) =>
      partition.dependencyPartitionIds.map((fromPartitionId) => ({
        fromPartitionId,
        toPartitionId: partition.partitionId,
      }))
    )
    .sort((left, right) =>
      compareIds(
        `${left.fromPartitionId}|${left.toPartitionId}`,
        `${right.fromPartitionId}|${right.toPartitionId}`
      )
    );
}

function projectOwnerConsumerRecords(componentGraph, partitions) {
  const partitionByComponent = new Map(
    partitions.flatMap((partition) =>
      partition.primaryComponentIds.map((componentId) => [componentId, partition.partitionId])
    )
  );
  return (componentGraph.sharedArtifactOwnership || [])
    .map((ownership) => ({
      artifactPath: ownership.path,
      ownerPartitionId: partitionByComponent.get(ownership.ownerComponentId),
      consumerPartitionIds: unique(
        ownership.participatingComponentIds
          .map((componentId) => partitionByComponent.get(componentId))
          .filter(
            (partitionId) =>
              partitionId && partitionId !== partitionByComponent.get(ownership.ownerComponentId)
          )
      ),
    }))
    .filter(({ artifactPath, ownerPartitionId, consumerPartitionIds }) =>
      Boolean(artifactPath && ownerPartitionId && consumerPartitionIds.length > 0)
    )
    .sort((left, right) => compareIds(left.artifactPath, right.artifactPath));
}

function candidateSummaries(optimization) {
  return optimization.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    selected: candidate.selected,
    partitionCount: candidate.partitions.length,
    partitionIds: candidate.partitions.map(({ partitionId }) => partitionId),
    score: Number(candidate.score?.total || 0),
  }));
}

function namespaceOwnership(authority) {
  return [
    authority.sourceAuthorityBundle.primarySource,
    ...authority.sourceAuthorityBundle.subordinateSources,
  ]
    .map((descriptor) => ({
      namespace: descriptor.namespace,
      sourceArtifactId: descriptor.sourceArtifactId,
      sourceRole: descriptor.role,
      sourceSnapshotHash: descriptor.sourceSnapshotHash,
      parentTaskRefs: unique(descriptor.parentTaskRefs),
    }))
    .sort((left, right) => compareIds(left.namespace, right.namespace));
}

function subordinateTaskMappings({ authority, obligations, partitions }) {
  const coverageBySource = new Map<string, SubordinateCoverageReceipt>(
    authority.subordinateCoverageReceipts.map(
      (receipt) => [receipt.sourceArtifactId, receipt] as [string, SubordinateCoverageReceipt]
    )
  );
  return authority.sourceAuthorityBundle.subordinateSources
    .map((descriptor) => {
      const sourceObligations = obligations.filter(
        ({ sourceArtifactId }) => sourceArtifactId === descriptor.sourceArtifactId
      );
      const partitionIds = unique(
        sourceObligations.map((obligation) => findPartitionForParentTasks(partitions, obligation))
      );
      if (partitionIds.length !== 1) {
        throw failure('subordinate_scope_escape', {
          sourceArtifactId: descriptor.sourceArtifactId,
          partitionIds,
        });
      }
      const receipt = coverageBySource.get(descriptor.sourceArtifactId);
      if (!receipt) throw failure('subordinate_coverage_incomplete');
      return {
        namespace: descriptor.namespace,
        sourceArtifactId: descriptor.sourceArtifactId,
        parentTaskRefs: unique(descriptor.parentTaskRefs),
        declaredSourceIds: unique(
          sourceObligations.map(({ declaredSourceId }) => declaredSourceId)
        ),
        coverageReceiptHash: receipt.receiptHash,
        partitionId: partitionIds[0],
      };
    })
    .sort((left, right) => compareIds(left.namespace, right.namespace));
}

function validatePlanSchema(plan) {
  try {
    validateGoalContractSchema('goal-contract-partition-plan.schema.json', plan);
  } catch (error) {
    if (error?.failureClass === 'canonical_schema_invalid' && error.phase === 'validate') {
      throw failure('partition_plan_schema_invalid', {
        validationErrors: error.validationErrors || [],
      });
    }
    throw error;
  }
}

function compilePartitionBundle(request, authority) {
  const authorityProjection = sourceAuthorityProjection(authority);
  const reconciledGraphHash = canonicalGraphHash(request.reconciledGraph);
  const commandAuthority = typedCommandAuthority(request.reconciledGraph);
  const projectionAuthority = {
    ...authorityProjection,
    sourceSnapshotHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
    sourceObligationGraphHash: hashSourceObligationGraph(
      authority.canonicalIntentBundle.sourceObligationGraph
    ),
    methodologyProfileHash: authority.methodologyProfile.methodologyProfileHash,
    semanticModelHash: authority.goalContractBundle.goalContractSemanticHash,
    traceGraphHash: reconciledGraphHash,
    reconciledGraph: request.reconciledGraph,
    reconciledGraphHash,
    sequenceApplicabilityReceipt: request.sequenceApplicabilityReceipt,
    sequenceConstraintInput: request.sequenceConstraintInput,
    sequenceExecutionState: request.sequenceExecutionState,
  };
  const executionProjection = compileExecutionProjection(projectionAuthority);
  const partitionPolicyBinding = assertCurrentPartitionPolicyBinding({
    policyBinding: request.partitionPolicyBinding,
    sourceSnapshotHash: executionProjection.sourceSnapshotHash,
    semanticModelHash: executionProjection.semanticModelHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
  });
  const componentGraph = buildPartitionComponents({
    executionProjection,
    policy: partitionPolicyBinding.policy,
  });
  const optimization = optimizePartitions({
    componentGraph,
    executionProjection,
    policyBinding: partitionPolicyBinding,
    projectionAuthority,
  });
  const partitions = partitionRecords(
    optimization,
    componentGraph,
    executionProjection,
    request.reconciledGraph,
    commandAuthority
  );
  const obligations = subordinateObligations(authority);
  const selections = selectionRecords({
    partitions,
    obligations,
    reconciledGraph: request.reconciledGraph,
    sourceCompositionPolicyHash: authority.policy.sourceCompositionPolicyHash,
    subordinateCoverageReceiptHashes: authorityProjection.subordinateCoverageReceiptHashes,
  });
  const partitionSetHash = hashControlPlaneValue(
    selections.map(({ partitionId, selectionHash, dependencyPartitionIds }) => ({
      partitionId,
      selectionHash,
      dependencyPartitionIds,
    }))
  );
  const semanticPlan = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    ...authorityProjection,
    methodologyProfileHash: authority.methodologyProfile.methodologyProfileHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
    taskDagHash: executionProjection.taskDagHash,
    integrationJoinGraphHash: executionProjection.integrationJoinGraphHash,
    partitionPolicyHash: partitionPolicyBinding.partitionPolicyHash,
    optimizerVersion: optimization.optimizerVersion,
    selectedCandidateId: optimization.selectedCandidateId,
    sequenceMode: executionProjection.sequenceConstraintBinding.sequenceMode,
    sequenceApplicability: executionProjection.sequenceConstraintBinding.applicabilityDecision,
    sequenceCoverage: executionProjection.sequenceConstraintBinding.sequenceCoverage,
    sequenceClosureStatus: executionProjection.sequenceConstraintBinding.sequenceClosureStatus,
    childContractAuthority: executionProjection.sequenceConstraintBinding.childContractAuthority,
    namespaceOwnership: namespaceOwnership(authority),
    subordinateTaskMappings: subordinateTaskMappings({
      authority,
      obligations,
      partitions,
    }),
    partitionCandidates: candidateSummaries(optimization),
    topologicalOrder: optimization.topologicalOrder,
    partitions,
    selections,
    coverageObligations: coverageObligations(executionProjection, obligations, commandAuthority),
    dependencyEdges: dependencyEdges(partitions),
    ownerConsumerRecords: projectOwnerConsumerRecords(componentGraph, partitions),
    childProjectionInputs: selections.map((selection) => ({
      ...selection,
      goalContractHash: authority.goalContractBundle.goalContractHash,
      orderedSourceSnapshotSetHash: authority.snapshotSet.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: authority.sourceAuthorityBundle.sourceAuthorityBundleHash,
      partitionSetHash,
    })),
    partitionSetHash,
  };
  const partitionPlan = {
    ...semanticPlan,
    partitionPlanHash: hashControlPlaneValue(semanticPlan),
  };
  validatePlanSchema(partitionPlan);
  const partitionPlanBytes = `${stableControlPlaneStringify(partitionPlan)}\n`;
  return deepFreeze({
    schemaVersion: 'goal-contract-partition-bundle/v1',
    executionProjection,
    projectionAuthority,
    reconciledGraphAuthority: canonicalizeSets(request.reconciledGraph),
    componentGraph,
    optimization,
    partitionPolicyBinding,
    partitionPlan,
    partitionPlanBytes,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash,
  });
}

function compilePartitions(request: PartitionCompileRequest = {}) {
  assertNoAuthorityInjection(request);
  return compilePartitionBundle(request, verifyAuthority(request));
}

function normalizeProjectedChildPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('partition_child_path_invalid');
  }
  const normalized = value.replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw failure('partition_child_path_escape', {
      childContractPath: value,
    });
  }
  return path.posix.normalize(normalized);
}

function projectExecutionArtifacts({ partitionPlan, renderChildContract }) {
  if (!partitionPlan || typeof renderChildContract !== 'function') {
    throw failure('execution_projection_request_invalid');
  }
  const childPaths = new Set();
  const childCompilationReceipts = partitionPlan.childProjectionInputs.map(
    (childProjectionInput, index) => {
      const displayOrdinal = index + 1;
      const rendered = renderChildContract({
        partitionPlan: structuredClone(partitionPlan),
        childProjectionInput: structuredClone(childProjectionInput),
        displayOrdinal,
      });
      if (
        !rendered ||
        (!Buffer.isBuffer(rendered.childContractBytes) &&
          typeof rendered.childContractBytes !== 'string')
      ) {
        throw failure('partition_child_render_invalid', {
          partitionId: childProjectionInput.partitionId,
        });
      }
      const childContractPath = normalizeProjectedChildPath(rendered.childContractPath);
      if (childPaths.has(childContractPath)) {
        throw failure('partition_child_path_duplicate', {
          childContractPath,
        });
      }
      childPaths.add(childContractPath);
      return createPendingChildCompilationReceipt({
        partitionPlan,
        childProjectionInput,
        displayOrdinal,
        childContractPath,
        childContractBytes: rendered.childContractBytes,
      });
    }
  );
  const finalized = finalizePartitionManifest({
    partitionPlan,
    childCompilationReceipts,
  });
  return deepFreeze({
    schemaVersion: 'goal-contract-execution-projection-bundle/v1',
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    childCompilationReceipts,
    orderedChildContractHashes: finalized.orderedChildContractHashes,
    partitionManifest: finalized.manifest,
    partitionManifestBytes: finalized.partitionManifestBytes,
    partitionManifestHash: finalized.partitionManifestHash,
    partitionManifestDocumentHash: finalized.partitionManifestDocumentHash,
    childMembershipReceipts: finalized.childMembershipReceipts,
  });
}

function compileLegacySingleSourcePartitions(request: PartitionCompileRequest = {}) {
  const allowed = new Set([
    'sourceSnapshot',
    'sourceObligationGraph',
    'methodologyProfile',
    'partitionPolicyBinding',
    'reconciledGraph',
    'reconciliationReceiptHash',
    'sequenceApplicabilityReceipt',
    'sequenceConstraintInput',
    'sequenceExecutionState',
    'repositoryFacts',
  ]);
  if (!isRecord(request)) {
    throw failure('partition_compile_request_invalid');
  }
  const forbiddenFields = Object.keys(request)
    .filter((field) => !allowed.has(field))
    .sort(compareIds);
  if (forbiddenFields.length > 0) {
    throw failure('partition_authority_injection', {
      forbiddenFields,
    });
  }
  const sourceSnapshot = request.sourceSnapshot;
  const sourceSnapshotHash = requireHash(
    sourceSnapshot?.aggregateHash,
    'sourceSnapshot.aggregateHash'
  );
  const sourceArtifactId = `standalone-source-${sourceSnapshotHash.slice(7)}`;
  const namespace = `STANDALONE_${sourceSnapshotHash.slice(7).toUpperCase()}`;
  const sourceCompositionPolicyHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-source-composition-policy/v1',
    mode: 'single_source',
    sourceSnapshotHash,
  });
  const orderedSourceSnapshotSetHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-ordered-source-snapshot-set/v1',
    sourceSnapshots: [
      {
        sourceOrder: 0,
        sourceArtifactId,
        sourceSnapshotHash,
      },
    ],
  });
  const sourceAuthorityBundleHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-source-authority-bundle/v1',
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash,
    primarySourceArtifactId: sourceArtifactId,
    namespace,
  });
  const sourceObligationGraphHash = hashSourceObligationGraph(request.sourceObligationGraph);
  const reconciledGraphHash = canonicalGraphHash(request.reconciledGraph);
  const specSpanRegistryHash =
    request.sourceObligationGraph?.specSpanRegistryHash ||
    hashControlPlaneValue({
      schemaVersion: 'goal-contract-spec-span-registry/v1',
      sourceSnapshotHash,
      specSpans: [],
    });
  const canonicalIntentSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-canonical-intent/v1',
    sourceObligationGraphHash,
    reconciledGraphHash,
  });
  const canonicalIntentBundleHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-canonical-intent-bundle/v1',
    canonicalIntentSemanticHash,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash,
    specSpanRegistryHash,
  });
  const authorityAttestationHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-intent-attestation/v1',
    canonicalIntentBundleHash,
    sourceSnapshotHash,
  });
  const goalContractSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-parent-semantics/v1',
    canonicalIntentSemanticHash,
    reconciledGraphHash,
  });
  const goalContractHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-legacy-parent-authority/v1',
    goalContractSemanticHash,
    authorityAttestationHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
  });
  const primarySource = {
    role: 'primary_implementation_authority',
    namespace,
    sourceArtifactId,
    sourceSnapshotHash,
    pathOrSegmentId: sourceSnapshot.sourcePath || sourceSnapshot.sourceId,
    sourceOrder: 0,
    ownedSemanticDomains: [],
    parentTaskRefs: [],
  };
  const authority = {
    policy: {
      mode: 'single_source',
      sourceCompositionPolicyHash,
    },
    snapshotSet: {
      orderedSourceSnapshotSetHash,
      sourceSnapshots: [
        {
          sourceOrder: 0,
          sourceArtifactId,
          sourceRole: primarySource.role,
          namespace,
          sourceSnapshotHash,
        },
      ],
    },
    sourceAuthorityBundle: {
      sourceAuthorityBundleHash,
      primarySource,
      subordinateSources: [],
    },
    canonicalIntentBundle: {
      canonicalIntentSemanticHash,
      canonicalIntentBundleHash,
      authorityAttestationHash,
      sourceObligationGraph: request.sourceObligationGraph,
      sourceObligationGraphHash,
      canonicalIntentIR: [],
      specSpanRegistry: {
        specSpanRegistryHash,
        specSpans: [],
      },
    },
    goalContractBundle: {
      goalContractSemanticHash,
      goalContractHash,
      goalContractSemanticModel: {
        records: [],
      },
      subordinateSourceCoverageReceipts: [],
    },
    subordinateCoverageReceipts: [],
    methodologyProfile: request.methodologyProfile,
  };
  requireHash(authority.methodologyProfile?.methodologyProfileHash, 'methodologyProfileHash');
  if (!isRecord(request.reconciledGraph)) {
    throw failure('partition_reconciled_graph_missing');
  }
  requireHash(request.reconciliationReceiptHash, 'reconciliationReceiptHash');
  return compilePartitionBundle(request, authority);
}

function validateSpecSpanOwnership(plan, authority) {
  const spanById = new Map<string, SpecSpanAuthority>(
    authority.canonicalIntentBundle.specSpanRegistry.specSpans.map(
      (span) => [span.specSpanId, span] as [string, SpecSpanAuthority]
    )
  );
  for (const selection of plan.selections || []) {
    for (const obligation of selection.namespacedObligations || []) {
      for (const specSpanId of obligation.specSpanRefs || []) {
        const span = spanById.get(specSpanId);
        if (
          !span ||
          span.sourceArtifactId !== obligation.sourceArtifactId ||
          span.namespace !== obligation.namespace ||
          span.sourceSnapshotHash !== obligation.sourceSnapshotHash
        ) {
          throw failure('cross_source_spec_span_substitution', {
            declaredSourceId: obligation.declaredSourceId,
            specSpanId,
          });
        }
      }
    }
  }
}

function validateSubordinatePlacement(plan, authority) {
  const expected = subordinateObligations(authority);
  const actual = (plan.selections || []).flatMap((selection) =>
    (selection.namespacedObligations || []).map((obligation) => ({
      partitionId: selection.partitionId,
      primaryTaskIds: selection.primaryTaskIds || [],
      obligation,
    }))
  );
  const expectedIds = expected.map(({ declaredSourceId }) => declaredSourceId);
  const actualIds = actual.map(({ obligation }) => obligation.declaredSourceId);
  if (
    stableControlPlaneStringify(expectedIds) !==
    stableControlPlaneStringify([...actualIds].sort(compareIds))
  ) {
    throw failure('subordinate_coverage_incomplete', {
      expectedIds,
      actualIds: [...actualIds].sort(compareIds),
    });
  }
  for (const { primaryTaskIds, obligation } of actual) {
    if (!obligation.parentTaskRefs.some((taskRef) => primaryTaskIds.includes(taskRef))) {
      throw failure('subordinate_scope_escape', {
        declaredSourceId: obligation.declaredSourceId,
      });
    }
  }
}

function validatePolicyBindings(plan, authority) {
  const expected = authority.policy.sourceCompositionPolicyHash;
  if (
    plan.sourceCompositionPolicyHash !== expected ||
    (plan.selections || []).some(
      (selection) => selection.sourceCompositionPolicyHash !== expected
    ) ||
    (plan.childProjectionInputs || []).some(
      (projection) => projection.sourceCompositionPolicyHash !== expected
    )
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    authority.policy.mode === 'composite_required' &&
    plan.sourceCompositionMode === 'single_source'
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
}

function verifyPartitionPlan(plan, request: PartitionCompileRequest = {}) {
  if (!isRecord(plan)) throw failure('partition_plan_invalid');
  assertNoAuthorityInjection(request);
  const authority = verifyAuthority(request);
  validatePolicyBindings(plan, authority);
  validateSubordinatePlacement(plan, authority);
  validateSpecSpanOwnership(plan, authority);
  const { partitionPlanHash: _ignored, ...semanticPlan } = plan;
  if (plan.partitionPlanHash !== hashControlPlaneValue(semanticPlan)) {
    throw failure('partition_plan_hash_mismatch');
  }
  validatePlanSchema(plan);
  const expected = compilePartitions(request).partitionPlan;
  if (stableControlPlaneStringify(plan) !== stableControlPlaneStringify(expected)) {
    throw failure('partition_plan_currentness_mismatch');
  }
  return Object.freeze({ decision: 'pass' });
}

module.exports = {
  canonicalIdentifierList,
  compileLegacySingleSourcePartitions,
  compilePartitions,
  projectOwnerConsumerRecords,
  projectOwnedArtifactPaths,
  projectExecutionArtifacts,
  verifyPartitionPlan,
};
