const {
  hashControlPlaneValue,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);
const {
  verifyOrderedSourceSnapshotSet,
} = require(
  __filename.endsWith('.ts') ? './source-snapshot.ts' : './source-snapshot'
);
const {
  verifySourceCompositionPolicy,
} = require(
  __filename.endsWith('.ts')
    ? './source-composition-policy.ts'
    : './source-composition-policy'
);

const BUNDLE_SCHEMA =
  'goal-contract-composite-source-authority-bundle.schema.json';
const COVERAGE_SCHEMA =
  'goal-contract-subordinate-source-coverage-receipt.schema.json';

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sortedStrings(value, field, allowEmpty = true) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length ||
    (!allowEmpty && value.length === 0)
  ) {
    throw failure('source_authority_descriptor_invalid', {
      reason: `${field}_invalid`,
    });
  }
  return [...value].sort();
}

function bindingPayload(value) {
  return {
    role: value.role,
    namespace: value.namespace,
    sourceArtifactId: value.sourceArtifactId,
    parentTaskRefs: [...value.parentTaskRefs].sort(),
    requiredRequirementIds: [...value.requiredRequirementIds].sort(),
    requiredTaskIds: [...value.requiredTaskIds].sort(),
  };
}

function equalBinding(left, right) {
  return hashControlPlaneValue(bindingPayload(left)) ===
    hashControlPlaneValue(bindingPayload(right));
}

function equalStringSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    hashControlPlaneValue([...left].sort()) ===
      hashControlPlaneValue([...right].sort())
  );
}

function sourceText(snapshot) {
  if (typeof snapshot.frozenBytesBase64 !== 'string') {
    throw failure(
      snapshot.sourceRole === 'subordinate_component_specification'
        ? 'subordinate_source_stale'
        : 'source_authority_conflict',
      { reason: 'frozen_bytes_missing' }
    );
  }
  return Buffer.from(snapshot.frozenBytesBase64, 'base64').toString('utf8');
}

function derivedCoverageObligations(snapshot, binding) {
  const requiredIds = new Set([
    ...binding.requiredRequirementIds,
    ...binding.requiredTaskIds,
  ]);
  const present = [
    ...new Set(
      (sourceText(snapshot).match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/gu) ||
        []).filter((id) => requiredIds.has(id))
    ),
  ].sort();
  return present.map((id) => ({
    id,
    semanticOwnershipKey: hashControlPlaneValue({
      sourceArtifactId: snapshot.sourceArtifactId,
      namespace: snapshot.namespace,
      declaredId: id,
      ownership: 'owned_obligation',
    }),
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    taskRefs: [...binding.parentTaskRefs],
    specSpanRefs: [
      `derived-span-${hashControlPlaneValue({
        sourceSnapshotHash: snapshot.sourceSnapshotHash,
        id,
      }).slice(7)}`,
    ],
    ownership: 'owned_obligation',
  }));
}

function compileSubordinateSourceCoverage(request: unknown = {}) {
  if (!isRecord(request) || !isRecord(request.binding)) {
    throw failure('subordinate_coverage_invalid');
  }
  const binding = bindingPayload(request.binding);
  if (!Array.isArray(request.obligations)) {
    throw failure('subordinate_coverage_invalid');
  }
  const obligations = request.obligations.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      item.id.length === 0
    ) {
      throw failure('subordinate_coverage_invalid');
    }
    if (
      item.sourceArtifactId !== binding.sourceArtifactId ||
      item.sourceRole !== binding.role ||
      item.namespace !== binding.namespace
    ) {
      throw failure('subordinate_scope_escape', {
        sourceObligationId: item.id,
      });
    }
    const taskRefs = sortedStrings(item.taskRefs ?? [], 'taskRefs');
    if (
      taskRefs.some((taskRef) => !binding.parentTaskRefs.includes(taskRef))
    ) {
      throw failure('subordinate_scope_escape', {
        sourceObligationId: item.id,
        taskRefs,
      });
    }
    if (!Array.isArray(item.specSpanRefs) || item.specSpanRefs.length === 0) {
      throw failure('subordinate_spec_span_missing', {
        sourceObligationId: item.id,
      });
    }
    const id = item.id;
    const specSpanRefs = sortedStrings(item.specSpanRefs, 'specSpanRefs');
    return {
      ...item,
      id,
      semanticOwnershipKey: item.semanticOwnershipKey,
      taskRefs,
      specSpanRefs,
    };
  });
  const duplicateIds = obligations
    .map(({ id }) => id)
    .filter((id, index, values) => values.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw failure('source_semantic_duplication', {
      duplicateIds: [...new Set(duplicateIds)].sort(),
    });
  }
  const semanticOwners = new Map();
  for (const obligation of obligations) {
    const semanticIdentity = obligation.semanticOwnershipKey;
    if (
      typeof semanticIdentity !== 'string' ||
      semanticIdentity.trim().length === 0
    ) {
      throw failure('source_semantic_identity_missing', {
        sourceObligationId: obligation.id,
      });
    }
    const owner = semanticOwners.get(semanticIdentity);
    if (owner) {
      throw failure('source_semantic_duplication', {
        sourceObligationIds: [owner, obligation.id].sort(),
      });
    }
    semanticOwners.set(semanticIdentity, obligation.id);
  }
  const ids = new Set(obligations.map(({ id }) => id));
  const missingRequirements = binding.requiredRequirementIds.filter(
    (id) => !ids.has(id)
  );
  if (missingRequirements.length > 0) {
    throw failure('subordinate_requirement_missing', {
      missingRequirementIds: missingRequirements,
    });
  }
  const missingTasks = binding.requiredTaskIds.filter((id) => !ids.has(id));
  if (missingTasks.length > 0) {
    throw failure('subordinate_task_missing', {
      missingTaskIds: missingTasks,
    });
  }
  const payload = {
    schemaVersion: 'goal-contract-subordinate-source-coverage-receipt/v1',
    sourceArtifactId: binding.sourceArtifactId,
    namespace: binding.namespace,
    parentTaskRefs: binding.parentTaskRefs,
    requiredRequirementIds: binding.requiredRequirementIds,
    coveredRequirementIds: binding.requiredRequirementIds,
    requiredTaskIds: binding.requiredTaskIds,
    coveredTaskIds: binding.requiredTaskIds,
    specSpanRefs: [
      ...new Set(obligations.flatMap(({ specSpanRefs }) => specSpanRefs)),
    ].sort(),
    unmappedRequirementCount: 0,
    unmappedTaskCount: 0,
    scopeEscapeCount: 0,
  };
  const receipt = {
    ...payload,
    receiptHash: hashControlPlaneValue(payload),
  };
  validateGoalContractSchema(COVERAGE_SCHEMA, receipt);
  return receipt;
}

function normalizeDescriptor(input, snapshot, expectedRole) {
  if (!isRecord(input) || !snapshot) {
    throw failure(
      expectedRole === 'subordinate_component_specification'
        ? 'subordinate_source_missing'
        : 'source_authority_conflict'
    );
  }
  if (
    input.role !== expectedRole ||
    input.role !== snapshot.sourceRole ||
    input.sourceArtifactId !== snapshot.sourceArtifactId
  ) {
    throw failure(
      expectedRole === 'subordinate_component_specification'
        ? 'subordinate_source_stale'
        : 'source_authority_conflict',
      { reason: 'source_identity_mismatch' }
    );
  }
  if (input.namespace !== snapshot.namespace) {
    throw failure(
      expectedRole === 'subordinate_component_specification'
        ? 'subordinate_scope_escape'
        : 'source_authority_conflict',
      { reason: 'namespace_mismatch' }
    );
  }
  for (const [field, expected] of [
    ['sourceSnapshotHash', snapshot.sourceSnapshotHash],
    ['pathOrSegmentId', snapshot.pathOrSegmentId],
    ['sourceOrder', snapshot.sourceOrder],
  ]) {
    if (input[field] !== undefined && input[field] !== expected) {
      throw failure(
        expectedRole === 'subordinate_component_specification'
          ? 'subordinate_source_stale'
          : 'source_authority_conflict',
        { reason: `${field}_mismatch` }
      );
    }
  }
  return {
    role: expectedRole,
    namespace: snapshot.namespace,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    pathOrSegmentId: snapshot.pathOrSegmentId,
    sourceOrder: snapshot.sourceOrder,
    ownedSemanticDomains: sortedStrings(
      input.ownedSemanticDomains ?? [],
      'ownedSemanticDomains'
    ),
    parentTaskRefs: sortedStrings(input.parentTaskRefs ?? [], 'parentTaskRefs'),
    requiredRequirementIds: sortedStrings(
      input.requiredRequirementIds ?? [],
      'requiredRequirementIds'
    ),
    requiredTaskIds: sortedStrings(
      input.requiredTaskIds ?? [],
      'requiredTaskIds'
    ),
  };
}

function assertOwnership(descriptors) {
  const namespaceOwners = new Map();
  const domainOwners = new Map();
  for (const descriptor of descriptors) {
    const namespaceOwner = namespaceOwners.get(descriptor.namespace);
    if (
      namespaceOwner &&
      namespaceOwner.sourceArtifactId !== descriptor.sourceArtifactId
    ) {
      throw failure('source_authority_conflict', {
        namespace: descriptor.namespace,
      });
    }
    namespaceOwners.set(descriptor.namespace, descriptor);
    for (const domain of descriptor.ownedSemanticDomains) {
      const domainOwner = domainOwners.get(domain.toLowerCase());
      if (
        domainOwner &&
        domainOwner.sourceArtifactId !== descriptor.sourceArtifactId
      ) {
        throw failure(
          descriptor.role === 'subordinate_component_specification'
            ? 'subordinate_scope_escape'
            : 'source_authority_conflict',
          { semanticDomain: domain }
        );
      }
      domainOwners.set(domain.toLowerCase(), descriptor);
    }
  }
}

function bundlePayload(bundle) {
  return {
    schemaVersion: bundle.schemaVersion,
    sourceCompositionPolicyHash: bundle.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: bundle.orderedSourceSnapshotSetHash,
    primarySource: bundle.primarySource,
    subordinateSources: bundle.subordinateSources,
    namespaceOwnership: bundle.namespaceOwnership,
    conflictPolicy: bundle.conflictPolicy,
    subordinateCoverage: bundle.subordinateCoverage,
  };
}

function verifyCompositeSourceAuthorityBundle(bundle) {
  validateGoalContractSchema(BUNDLE_SCHEMA, bundle);
  if (
    hashControlPlaneValue(bundlePayload(bundle)) !==
    bundle.sourceAuthorityBundleHash
  ) {
    throw failure('source_authority_bundle_hash_mismatch');
  }
  return bundle;
}

function compileCompositeSourceAuthorityBundle(request: unknown = {}) {
  if (!isRecord(request) || !request.sourceCompositionPolicy) {
    throw failure('source_composition_policy_missing');
  }
  const policy = verifySourceCompositionPolicy(
    request.sourceCompositionPolicy
  );
  const snapshotSet = verifyOrderedSourceSnapshotSet(
    request.orderedSourceSnapshotSet
  );
  if (
    policy.mode === 'single_source' &&
    policy.policyAuthorityBinding.declaredMode === 'composite_required'
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  const primarySnapshots = snapshotSet.sourceSnapshots.filter(
    ({ sourceRole }) => sourceRole === 'primary_implementation_authority'
  );
  const subordinateSnapshots = snapshotSet.sourceSnapshots.filter(
    ({ sourceRole }) => sourceRole === 'subordinate_component_specification'
  );
  if (primarySnapshots.length !== 1) {
    throw failure('source_authority_conflict', {
      reason: 'primary_source_count_invalid',
    });
  }
  const requestedSubordinates = request.subordinateSources ?? [];
  if (!Array.isArray(requestedSubordinates)) {
    throw failure('source_composition_policy_mismatch');
  }
  if (policy.mode === 'single_source') {
    if (
      policy.requiredSubordinateBindings.length > 0 ||
      requestedSubordinates.length > 0 ||
      subordinateSnapshots.length > 0
    ) {
      throw failure('source_composition_policy_mismatch');
    }
  } else {
    if (
      requestedSubordinates.length === 0 ||
      subordinateSnapshots.length === 0
    ) {
      throw failure('subordinate_source_missing');
    }
    if (
      requestedSubordinates.length !==
        policy.requiredSubordinateBindings.length ||
      subordinateSnapshots.length !==
        policy.requiredSubordinateBindings.length
    ) {
      throw failure('source_composition_policy_mismatch');
    }
  }
  const primarySource = normalizeDescriptor(
    request.primarySource,
    primarySnapshots[0],
    'primary_implementation_authority'
  );
  const snapshotByArtifact = new Map(
    subordinateSnapshots.map((snapshot) => [snapshot.sourceArtifactId, snapshot])
  );
  const requestedArtifactIds = new Set(
    requestedSubordinates
      .filter(isRecord)
      .map(({ sourceArtifactId }) => sourceArtifactId)
  );
  const hasMissingExpectedArtifact =
    policy.requiredSubordinateBindings.some(
      ({ sourceArtifactId }) => !requestedArtifactIds.has(sourceArtifactId)
    );
  const subordinateSources = requestedSubordinates
    .map((input) => {
      if (!isRecord(input)) {
        throw failure('source_composition_policy_mismatch');
      }
      const expected = policy.requiredSubordinateBindings.find(
        (binding) => binding.sourceArtifactId === input.sourceArtifactId
      );
      if (!expected) {
        throw failure(
          hasMissingExpectedArtifact
            ? 'subordinate_source_stale'
            : 'source_composition_policy_mismatch'
        );
      }
      if (input.role !== expected.role) {
        throw failure('subordinate_source_stale', {
          reason: 'source_role_mismatch',
        });
      }
      if (input.namespace !== expected.namespace) {
        throw failure('subordinate_scope_escape', {
          reason: 'namespace_mismatch',
        });
      }
      if (!equalStringSet(input.parentTaskRefs, expected.parentTaskRefs)) {
        throw failure('subordinate_scope_escape', {
          reason: 'parent_task_refs_mismatch',
        });
      }
      if (!equalBinding(input, expected)) {
        throw failure('source_composition_policy_mismatch');
      }
      const snapshot = snapshotByArtifact.get(input.sourceArtifactId);
      if (!snapshot) throw failure('subordinate_source_missing');
      return normalizeDescriptor(
        input,
        snapshot,
        'subordinate_component_specification'
      );
    })
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  assertOwnership([primarySource, ...subordinateSources]);
  const coverageReceipts = subordinateSources.map((descriptor) => {
    const snapshot = snapshotByArtifact.get(descriptor.sourceArtifactId);
    const requestedObligations = request.sourceObligations;
    const obligations =
      (Array.isArray(requestedObligations)
        ? requestedObligations.filter(
        ({ sourceArtifactId }) =>
          sourceArtifactId === descriptor.sourceArtifactId
          )
        : null) ?? derivedCoverageObligations(snapshot, descriptor);
    return compileSubordinateSourceCoverage({
      binding: descriptor,
      obligations,
    });
  });
  const subordinateCoverage =
    coverageReceipts.length === 1
      ? coverageReceipts[0]
      : {
          schemaVersion:
            'goal-contract-subordinate-source-coverage-receipt-set/v1',
          receipts: coverageReceipts,
          receiptSetHash: hashControlPlaneValue(coverageReceipts),
        };
  const namespaceOwnership = [primarySource, ...subordinateSources]
    .map((descriptor) => ({
      namespace: descriptor.namespace,
      sourceArtifactId: descriptor.sourceArtifactId,
      sourceRole: descriptor.role,
      ownedSemanticDomains: descriptor.ownedSemanticDomains,
    }))
    .sort((left, right) => left.namespace.localeCompare(right.namespace, 'en'));
  const partial = {
    schemaVersion: 'goal-contract-composite-source-authority-bundle/v1',
    sourceCompositionPolicyHash: policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      snapshotSet.orderedSourceSnapshotSetHash,
    primarySource,
    subordinateSources,
    namespaceOwnership,
    conflictPolicy: 'fail_closed',
    subordinateCoverage,
  };
  return verifyCompositeSourceAuthorityBundle({
    ...partial,
    sourceAuthorityBundleHash: hashControlPlaneValue(
      bundlePayload(partial)
    ),
  });
}

module.exports = {
  compileCompositeSourceAuthorityBundle,
  compileSubordinateSourceCoverage,
  verifyCompositeSourceAuthorityBundle,
};
