const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require('./canonical-hash.ts');
const {
  validateGoalContractSchema,
} = require('./schema-registry.ts');
const {
  preflightRequirementRecordPartitionAuthoritySupersession,
  resolveGoalContractSourceIdentity,
  validateImmutablePartitionAuthorityUnit,
} = require(
  `./partition-output-paths${__filename.endsWith('.ts') ? '.ts' : ''}`
);

export type GoalContractAuthoritySupersessionModule = never;

let supersessionReceiptValidator;
let sourceGroundedCoverageReceiptValidator;
const SUPERSESSION_MODES = new Set([
  'strict_equivalence',
  'source_grounded_hard_cut',
]);
const OUTPUT_AUTHORITY_SCHEMA =
  'goal-contract-partition-output-authority.schema.json';

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function validateSupersessionReceiptSchema(receipt) {
  if (!supersessionReceiptValidator) {
    const relative = path.join(
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-authority-supersession-receipt.schema.json'
    );
    const schemaPath = [
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        relative
      ),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        relative
      ),
    ].find((candidate) => fs.existsSync(candidate));
    if (!schemaPath) {
      throw failure('authority_supersession_receipt_schema_missing');
    }
    const schema = readJson(
      schemaPath,
      'authority_supersession_receipt_schema_invalid'
    );
    supersessionReceiptValidator = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(schema);
  }
  if (!supersessionReceiptValidator(receipt)) {
    throw failure('authority_supersession_receipt_schema_invalid', {
      validationErrors: supersessionReceiptValidator.errors,
    });
  }
}

function validateSourceGroundedCoverageReceiptSchema(receipt) {
  if (!sourceGroundedCoverageReceiptValidator) {
    const relative = path.join(
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-source-grounded-coverage-receipt.schema.json'
    );
    const schemaPath = [
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        relative
      ),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        relative
      ),
    ].find((candidate) => fs.existsSync(candidate));
    if (!schemaPath) {
      throw failure(
        'source_grounded_coverage_receipt_schema_missing'
      );
    }
    const schema = readJson(
      schemaPath,
      'source_grounded_coverage_receipt_schema_invalid'
    );
    sourceGroundedCoverageReceiptValidator = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(schema);
  }
  if (!sourceGroundedCoverageReceiptValidator(receipt)) {
    throw failure(
      'source_grounded_coverage_receipt_schema_invalid',
      {
        validationErrors:
          sourceGroundedCoverageReceiptValidator.errors,
      }
    );
  }
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function canonicalText(value) {
  return `${stableControlPlaneStringify(value)}\n`;
}

function normalizePath(value) {
  return path.resolve(value).replace(/\\/gu, '/');
}

function readJson(filePath, failureClass) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw failure(failureClass, { path: path.resolve(filePath) });
  }
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function sameValues(left, right) {
  return (
    stableControlPlaneStringify(uniqueStrings(left)) ===
    stableControlPlaneStringify(uniqueStrings(right))
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHash(value) {
  return /^sha256:[0-9a-f]{64}$/u.test(String(value || ''));
}

function assertFileHash(filePath, expectedHash, failureClass) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw failure(failureClass, {
      path: resolved,
      expectedHash,
      actualHash: null,
    });
  }
  const actualHash = sha256File(resolved);
  if (actualHash !== expectedHash) {
    throw failure(failureClass, {
      path: resolved,
      expectedHash,
      actualHash,
    });
  }
  return actualHash;
}

function taskKey(record) {
  const taskIds = uniqueStrings(record?.primaryTaskIds);
  if (taskIds.length === 0) {
    throw failure('authority_supersession_partition_task_missing', {
      partitionId: record?.partitionId,
    });
  }
  return stableControlPlaneStringify(taskIds);
}

function indexPartitions(records, authorityClass) {
  if (!Array.isArray(records) || records.length === 0) {
    throw failure('authority_supersession_partition_set_invalid', {
      authorityClass,
    });
  }
  const byId = new Map();
  const byTask = new Map();
  for (const record of records) {
    if (
      typeof record?.partitionId !== 'string' ||
      byId.has(record.partitionId)
    ) {
      throw failure('authority_supersession_partition_set_invalid', {
        authorityClass,
        partitionId: record?.partitionId,
      });
    }
    const key = taskKey(record);
    if (byTask.has(key)) {
      throw failure('authority_supersession_partition_mapping_ambiguous', {
        authorityClass,
        taskIds: JSON.parse(key),
      });
    }
    byId.set(record.partitionId, record);
    byTask.set(key, record);
  }
  return { byId, byTask };
}

function collect(records, field) {
  return uniqueStrings(
    records.flatMap((record) => record?.[field] || [])
  );
}

function compareDimension(dimension, oldValues, newValues) {
  const oldSet = uniqueStrings(oldValues);
  const newSet = uniqueStrings(newValues);
  if (!sameValues(oldSet, newSet)) {
    const oldIndex = new Set(oldSet);
    const newIndex = new Set(newSet);
    throw failure('authority_supersession_coverage_not_equivalent', {
      dimension,
      missing: oldSet.filter((value) => !newIndex.has(value)),
      extra: newSet.filter((value) => !oldIndex.has(value)),
    });
  }
  return {
    oldCount: oldSet.length,
    newCount: newSet.length,
    setHash: hashControlPlaneValue(oldSet),
  };
}

function diagnosticDimension(oldValues, newValues) {
  const oldSet = uniqueStrings(oldValues);
  const newSet = uniqueStrings(newValues);
  const oldIndex = new Set(oldSet);
  const newIndex = new Set(newSet);
  return {
    equivalent: sameValues(oldSet, newSet),
    oldCount: oldSet.length,
    newCount: newSet.length,
    missing: oldSet.filter((value) => !newIndex.has(value)),
    extra: newSet.filter((value) => !oldIndex.has(value)),
    oldSetHash: hashControlPlaneValue(oldSet),
    newSetHash: hashControlPlaneValue(newSet),
  };
}

function compareSourceGroundedDimension(
  dimension,
  requiredValues,
  coveredValues
) {
  const required = uniqueStrings(requiredValues);
  const covered = uniqueStrings(coveredValues);
  const requiredIndex = new Set(required);
  const coveredIndex = new Set(covered);
  const missing = required.filter((value) => !coveredIndex.has(value));
  const extra = covered.filter((value) => !requiredIndex.has(value));
  if (missing.length > 0 || extra.length > 0) {
    throw failure(
      'authority_supersession_source_grounded_coverage_invalid',
      {
        dimension,
        missing,
        extra,
      }
    );
  }
  return {
    requiredCount: required.length,
    coveredCount: covered.length,
    requiredSetHash: hashControlPlaneValue(required),
    coveredSetHash: hashControlPlaneValue(covered),
  };
}

function dependencyEdges(records, partitionIndex) {
  const edges = [];
  for (const record of records) {
    const consumerKey = taskKey(record);
    for (const dependencyId of record.dependencyPartitionIds || []) {
      const predecessor = partitionIndex.byId.get(dependencyId);
      if (!predecessor) {
        throw failure('authority_supersession_dependency_unknown', {
          partitionId: record.partitionId,
          dependencyPartitionId: dependencyId,
        });
      }
      edges.push(`${taskKey(predecessor)}->${consumerKey}`);
    }
  }
  return uniqueStrings(edges);
}

function assertSuccessorBundle({
  partitionPlan,
  partitionPlanBytes,
  executionProjectionBundle,
}) {
  const semanticPlan = structuredClone(partitionPlan);
  delete semanticPlan.partitionPlanHash;
  if (
    partitionPlan.partitionPlanHash !==
    hashControlPlaneValue(semanticPlan)
  ) {
    throw failure('successor_partition_plan_hash_mismatch');
  }
  let rereadPlan;
  try {
    rereadPlan = JSON.parse(partitionPlanBytes);
  } catch {
    throw failure('successor_partition_plan_bytes_invalid');
  }
  if (
    stableControlPlaneStringify(rereadPlan) !==
    stableControlPlaneStringify(partitionPlan)
  ) {
    throw failure('successor_partition_plan_bytes_mismatch');
  }
  const bundle = executionProjectionBundle;
  if (
    bundle?.partitionPlanHash !== partitionPlan.partitionPlanHash ||
    bundle?.partitionSetHash !== partitionPlan.partitionSetHash ||
    bundle?.partitionManifest?.partitionPlanHash !==
      partitionPlan.partitionPlanHash ||
    bundle?.partitionManifestHash !==
      bundle?.partitionManifest?.partitionManifestHash ||
    bundle?.partitionManifestDocumentHash !==
      sha256Bytes(bundle?.partitionManifestBytes || '')
  ) {
    throw failure('successor_execution_projection_bundle_mismatch');
  }
  let rereadManifest;
  try {
    rereadManifest = JSON.parse(bundle.partitionManifestBytes);
  } catch {
    throw failure('successor_partition_manifest_bytes_invalid');
  }
  if (
    stableControlPlaneStringify(rereadManifest) !==
      stableControlPlaneStringify(bundle.partitionManifest) ||
    !Array.isArray(bundle.childCompilationReceipts) ||
    !Array.isArray(bundle.childMembershipReceipts) ||
    bundle.childCompilationReceipts.length !==
      partitionPlan.topologicalOrder.length ||
    bundle.childMembershipReceipts.length !==
      partitionPlan.topologicalOrder.length
  ) {
    throw failure('successor_execution_projection_bundle_mismatch');
  }
  const childIds = bundle.childCompilationReceipts.map(
    ({ partitionId }) => partitionId
  );
  if (
    stableControlPlaneStringify(childIds) !==
    stableControlPlaneStringify(partitionPlan.topologicalOrder)
  ) {
    throw failure('successor_child_order_mismatch');
  }
}

function normalizeSuccessorReleaseContext(
  releaseContext,
  partitionPlan
) {
  if (releaseContext === undefined || releaseContext === null) {
    return null;
  }
  if (
    !isRecord(releaseContext) ||
    !isHash(releaseContext.methodologyProfileArtifactHash) ||
    !isHash(releaseContext.partitionPolicyArtifactHash) ||
    !isRecord(releaseContext.sequenceApplicabilityReceipt) ||
    !Array.isArray(releaseContext.renderEvidence)
  ) {
    throw failure('successor_release_context_invalid');
  }
  const renderEvidence = releaseContext.renderEvidence.map(
    (evidence) => {
      if (
        !isRecord(evidence) ||
        typeof evidence.partitionId !== 'string' ||
        typeof evidence.childContractPath !== 'string' ||
        typeof evidence.coverageReceiptPath !== 'string' ||
        typeof evidence.generationReceiptPath !== 'string' ||
        !isRecord(evidence.rendererAudit) ||
        !isRecord(evidence.deterministicPreflight) ||
        !isRecord(evidence.commandPortabilityAudit) ||
        !isRecord(evidence.coverageAudit) ||
        !isRecord(evidence.implementationProofAudit)
      ) {
        throw failure('successor_release_context_invalid');
      }
      return structuredClone(evidence);
    }
  );
  if (
    stableControlPlaneStringify(
      renderEvidence.map(({ partitionId }) => partitionId)
    ) !==
    stableControlPlaneStringify(partitionPlan.topologicalOrder)
  ) {
    throw failure('successor_release_context_partition_mismatch');
  }
  if (
    releaseContext.sequenceApplicabilityReceipt.decision !==
      partitionPlan.sequenceApplicability
  ) {
    throw failure('successor_release_context_sequence_mismatch');
  }
  return Object.freeze({
    methodologyProfileArtifactHash:
      releaseContext.methodologyProfileArtifactHash,
    partitionPolicyArtifactHash:
      releaseContext.partitionPolicyArtifactHash,
    sequenceApplicabilityReceipt: structuredClone(
      releaseContext.sequenceApplicabilityReceipt
    ),
    renderEvidence: Object.freeze(renderEvidence),
  });
}

function validateSupersededAuthority(
  repositoryRoot,
  supersededAuthority
) {
  assertFileHash(
    supersededAuthority.parentPlanPath,
    supersededAuthority.parentPlanHash,
    'superseded_parent_hash_mismatch'
  );
  assertFileHash(
    supersededAuthority.partitionManifestPath,
    supersededAuthority.partitionManifestHash,
    'superseded_partition_manifest_hash_mismatch'
  );
  assertFileHash(
    supersededAuthority.childrenSummaryPath,
    supersededAuthority.childrenSummaryHash,
    'superseded_children_summary_hash_mismatch'
  );
  const manifest = readJson(
    supersededAuthority.partitionManifestPath,
    'superseded_partition_manifest_invalid'
  );
  const summary = readJson(
    supersededAuthority.childrenSummaryPath,
    'superseded_children_summary_invalid'
  );
  if (
    manifest.partitionSetHash !== supersededAuthority.partitionSetHash ||
    summary.ok !== true ||
    summary.sourceHash !== supersededAuthority.parentPlanHash ||
    summary.manifestHash !== supersededAuthority.partitionManifestHash ||
    summary.partitionSetHash !== supersededAuthority.partitionSetHash ||
    summary.expectedCount !== manifest.partitions?.length ||
    summary.generatedCount !== manifest.partitions?.length ||
    summary.children?.length !== manifest.partitions?.length
  ) {
    throw failure('superseded_authority_binding_mismatch');
  }
  const manifestIndex = indexPartitions(
    manifest.partitions,
    'superseded'
  );
  summary.children.forEach((child, index) => {
    const expectedPartitionId = manifest.topologicalOrder?.[index];
    const partition = manifestIndex.byId.get(child.partitionId);
    if (
      child.ordinal !== index + 1 ||
      child.partitionId !== expectedPartitionId ||
      !partition ||
      !sameValues(child.primaryTaskIds, partition.primaryTaskIds)
    ) {
      throw failure('superseded_child_set_mismatch', {
        ordinal: index + 1,
        partitionId: child.partitionId,
      });
    }
    const childPath = path.isAbsolute(child.outputPath)
      ? child.outputPath
      : path.resolve(repositoryRoot, child.outputPath);
    const actualHash = assertFileHash(
      childPath,
      child.outputHash,
      'superseded_child_hash_mismatch'
    );
    if (child.goalContractHash !== actualHash) {
      throw failure('superseded_child_hash_mismatch', {
        path: childPath,
      });
    }
  });
  return { manifest, summary, manifestIndex };
}

function mergeSuccessorRecords(partitionPlan, selectionManifest) {
  const selectionById = new Map(
    (partitionPlan.selections || []).map((selection) => [
      selection.partitionId,
      selection,
    ])
  );
  return (selectionManifest?.partitions || []).map((partition) => {
    const selection = selectionById.get(partition.partitionId);
    if (
      !selection ||
      !sameValues(selection.primaryTaskIds, partition.primaryTaskIds)
    ) {
      throw failure('successor_selection_manifest_mismatch', {
        partitionId: partition.partitionId,
      });
    }
    return {
      ...structuredClone(partition),
      specSpanRefs: selection.specSpanRefs || [],
      subordinateCoverageReceiptHashes:
        selection.subordinateCoverageReceiptHashes || [],
      namespacedObligations: selection.namespacedObligations || [],
    };
  });
}

function buildEquivalence({
  oldManifest,
  oldIndex,
  partitionPlan,
  successorRecords,
}) {
  const successorIndex = indexPartitions(successorRecords, 'successor');
  const dimensions = {
    sourceObligations: compareDimension(
      'sourceObligations',
      collect(oldManifest.partitions, 'primarySourceObligationIds'),
      collect(successorRecords, 'primarySourceObligationIds')
    ),
    traceSlices: compareDimension(
      'traceSlices',
      collect(oldManifest.partitions, 'primaryTraceSliceIds'),
      collect(successorRecords, 'primaryTraceSliceIds')
    ),
    tasks: compareDimension(
      'tasks',
      collect(oldManifest.partitions, 'primaryTaskIds'),
      collect(successorRecords, 'primaryTaskIds')
    ),
    acceptance: compareDimension(
      'acceptance',
      collect(oldManifest.partitions, 'completionPredicateIds'),
      collect(successorRecords, 'completionPredicateIds')
    ),
    commands: compareDimension(
      'commands',
      collect(oldManifest.partitions, 'commandIds'),
      collect(successorRecords, 'commandIds')
    ),
    evidence: compareDimension(
      'evidence',
      collect(oldManifest.partitions, 'evidenceContractIds'),
      collect(successorRecords, 'evidenceContractIds')
    ),
  };
  const partitionMappings = [];
  for (const oldRecord of oldManifest.partitions) {
    const key = taskKey(oldRecord);
    const successor = successorIndex.byTask.get(key);
    if (!successor) {
      throw failure('authority_supersession_partition_mapping_missing', {
        taskIds: JSON.parse(key),
      });
    }
    for (const [dimension, field] of [
      ['acceptance', 'completionPredicateIds'],
      ['commands', 'commandIds'],
      ['evidence', 'evidenceContractIds'],
      ['governedPaths', 'ownedArtifactPaths'],
    ]) {
      if (!sameValues(oldRecord[field], successor[field])) {
        throw failure(
          'authority_supersession_partition_mapping_mismatch',
          {
            dimension,
            taskIds: JSON.parse(key),
          }
        );
      }
    }
    partitionMappings.push({
      taskIds: JSON.parse(key),
      supersededPartitionId: oldRecord.partitionId,
      successorPartitionId: successor.partitionId,
      acceptanceIds: uniqueStrings(
        successor.completionPredicateIds
      ),
      governedPaths: uniqueStrings(successor.ownedArtifactPaths),
    });
  }
  if (partitionMappings.length !== successorRecords.length) {
    throw failure('authority_supersession_partition_mapping_incomplete');
  }
  const specSpanRefs = compareDimension(
    'specSpanRefs',
    collect(oldManifest.partitions, 'specSpanRefs'),
    collect(successorRecords, 'specSpanRefs')
  );
  const oldSubordinate = uniqueStrings([
    ...(oldManifest.subordinateCoverageReceiptHashes || []),
    ...collect(
      oldManifest.partitions,
      'subordinateCoverageReceiptHashes'
    ),
  ]);
  const newSubordinate = uniqueStrings([
    ...(partitionPlan.subordinateCoverageReceiptHashes || []),
    ...collect(
      successorRecords,
      'subordinateCoverageReceiptHashes'
    ),
  ]);
  const subordinateCoverage = compareDimension(
    'subordinateCoverage',
    oldSubordinate,
    newSubordinate
  );
  const oldEdges = dependencyEdges(oldManifest.partitions, oldIndex);
  const newEdges = dependencyEdges(successorRecords, successorIndex);
  const dependencyEdgeSet = compareDimension(
    'dependencyEdges',
    oldEdges,
    newEdges
  );
  return {
    partitionMappings,
    equivalence: {
      schemaVersion:
        'goal-contract-authority-supersession-equivalence/v1',
      decision: 'pass',
      dimensions,
      dependencyEdges: dependencyEdgeSet,
      specSpanRefs: {
        oldCount: specSpanRefs.oldCount,
        newCount: specSpanRefs.newCount,
      },
      specSpanSetHash: specSpanRefs.setHash,
      subordinateCoverage: {
        oldCount: subordinateCoverage.oldCount,
        newCount: subordinateCoverage.newCount,
      },
      subordinateCoverageSetHash: subordinateCoverage.setHash,
      partitionMappingHash:
        hashControlPlaneValue(partitionMappings),
    },
  };
}

function buildHistoricalPartitionMappings({
  oldManifest,
  successorRecords,
}) {
  const successorIndex = indexPartitions(successorRecords, 'successor');
  return oldManifest.partitions.flatMap((oldRecord) => {
    const key = taskKey(oldRecord);
    const successor = successorIndex.byTask.get(key);
    if (!successor) return [];
    return [
      {
        taskIds: JSON.parse(key),
        supersededPartitionId: oldRecord.partitionId,
        successorPartitionId: successor.partitionId,
        acceptanceIds: uniqueStrings(
          successor.completionPredicateIds
        ),
        governedPaths: uniqueStrings(successor.ownedArtifactPaths),
      },
    ];
  });
}

function buildLegacyComparisonDiagnostic({
  oldManifest,
  oldIndex,
  partitionPlan,
  successorRecords,
}) {
  const successorIndex = indexPartitions(successorRecords, 'successor');
  const dimensions = Object.fromEntries(
    [
      [
        'sourceObligations',
        'primarySourceObligationIds',
      ],
      ['traceSlices', 'primaryTraceSliceIds'],
      ['tasks', 'primaryTaskIds'],
      ['acceptance', 'completionPredicateIds'],
      ['commands', 'commandIds'],
      ['evidence', 'evidenceContractIds'],
    ].map(([dimension, field]) => [
      dimension,
      diagnosticDimension(
        collect(oldManifest.partitions, field),
        collect(successorRecords, field)
      ),
    ])
  );
  const oldSubordinate = uniqueStrings([
    ...(oldManifest.subordinateCoverageReceiptHashes || []),
    ...collect(
      oldManifest.partitions,
      'subordinateCoverageReceiptHashes'
    ),
  ]);
  const newSubordinate = uniqueStrings([
    ...(partitionPlan.subordinateCoverageReceiptHashes || []),
    ...collect(
      successorRecords,
      'subordinateCoverageReceiptHashes'
    ),
  ]);
  return {
    schemaVersion:
      'goal-contract-authority-supersession-diagnostic/v1',
    decision: 'diagnostic_only',
    authoritative: false,
    dimensions,
    dependencyEdges: diagnosticDimension(
      dependencyEdges(oldManifest.partitions, oldIndex),
      dependencyEdges(successorRecords, successorIndex)
    ),
    specSpanRefs: diagnosticDimension(
      collect(oldManifest.partitions, 'specSpanRefs'),
      collect(successorRecords, 'specSpanRefs')
    ),
    subordinateCoverage: diagnosticDimension(
      oldSubordinate,
      newSubordinate
    ),
  };
}

function requiredCoverageValues(partitionPlan, field) {
  const values = partitionPlan?.coverageObligations?.[field];
  if (!Array.isArray(values)) {
    throw failure(
      'authority_supersession_source_grounded_coverage_invalid',
      {
        dimension: field,
        reason: 'required_coverage_missing',
      }
    );
  }
  return values;
}

function buildSourceGroundedCoverage({
  partitionPlan,
  successorRecords,
}) {
  const topologicalOrder = partitionPlan.topologicalOrder || [];
  const successorIndex = indexPartitions(successorRecords, 'successor');
  if (
    topologicalOrder.length !== successorRecords.length ||
    new Set(topologicalOrder).size !== topologicalOrder.length ||
    topologicalOrder.some(
      (partitionId) => !successorIndex.byId.has(partitionId)
    )
  ) {
    throw failure(
      'authority_supersession_source_grounded_topology_invalid'
    );
  }
  const orderIndex = new Map(
    topologicalOrder.map((partitionId, index) => [
      partitionId,
      index,
    ])
  );
  for (const record of successorRecords) {
    for (const dependencyPartitionId of
      record.dependencyPartitionIds || []) {
      if (
        !orderIndex.has(dependencyPartitionId) ||
        orderIndex.get(dependencyPartitionId) >=
          orderIndex.get(record.partitionId)
      ) {
        throw failure(
          'authority_supersession_source_grounded_topology_invalid',
          {
            partitionId: record.partitionId,
            dependencyPartitionId,
          }
        );
      }
    }
  }
  const dimensions = {
    sourceObligations: compareSourceGroundedDimension(
      'sourceObligations',
      requiredCoverageValues(
        partitionPlan,
        'sourceObligationIds'
      ),
      collect(successorRecords, 'primarySourceObligationIds')
    ),
    traceSlices: compareSourceGroundedDimension(
      'traceSlices',
      requiredCoverageValues(partitionPlan, 'traceSliceIds'),
      collect(successorRecords, 'primaryTraceSliceIds')
    ),
    tasks: compareSourceGroundedDimension(
      'tasks',
      requiredCoverageValues(partitionPlan, 'atomicTaskIds'),
      collect(successorRecords, 'primaryTaskIds')
    ),
    acceptance: compareSourceGroundedDimension(
      'acceptance',
      requiredCoverageValues(
        partitionPlan,
        'completionPredicateIds'
      ),
      collect(successorRecords, 'completionPredicateIds')
    ),
    commands: compareSourceGroundedDimension(
      'commands',
      requiredCoverageValues(partitionPlan, 'commandIds'),
      collect(successorRecords, 'commandIds')
    ),
    evidence: compareSourceGroundedDimension(
      'evidence',
      requiredCoverageValues(
        partitionPlan,
        'evidenceContractIds'
      ),
      collect(successorRecords, 'evidenceContractIds')
    ),
    subordinateDeclaredSources:
      compareSourceGroundedDimension(
        'subordinateDeclaredSources',
        requiredCoverageValues(
          partitionPlan,
          'subordinateDeclaredSourceIds'
        ),
        successorRecords.flatMap((record) =>
          (record.namespacedObligations || []).map(
            ({ declaredSourceId }) => declaredSourceId
          )
        )
      ),
  };
  const specSpanRefs = uniqueStrings(
    successorRecords.flatMap(
      ({ specSpanRefs }) => specSpanRefs || []
    )
  );
  const receipt = {
    schemaVersion:
      'goal-contract-source-grounded-coverage-receipt/v1',
    decision: 'pass',
    sourceCoverageAuthority: 'canonical_parent_source',
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    specSpanRegistryHash: partitionPlan.specSpanRegistryHash,
    specSpanRefCount: specSpanRefs.length,
    specSpanRefSetHash: hashControlPlaneValue(specSpanRefs),
    partitionCount: successorRecords.length,
    topologicalOrderHash:
      hashControlPlaneValue(topologicalOrder),
    dependencyEdgeSetHash: hashControlPlaneValue(
      dependencyEdges(successorRecords, successorIndex)
    ),
    dimensions,
  };
  receipt.receiptHash = hashReceiptPayload(receipt);
  validateSourceGroundedCoverageReceiptSchema(receipt);
  return receipt;
}

function resolvedEvidencePath(repositoryRoot, value) {
  return path.isAbsolute(String(value || ''))
    ? path.resolve(String(value))
    : path.resolve(repositoryRoot, String(value || ''));
}

function consistentBinding(values, field, checkpointPath) {
  const uniqueValues = uniqueStrings(values);
  if (uniqueValues.length !== 1) {
    throw failure('authority_supersession_checkpoint_binding_mismatch', {
      checkpointPath,
      field,
      values: uniqueValues,
    });
  }
  return uniqueValues[0];
}

function checkpointEvidencePacket({
  repositoryRoot,
  checkpointPath,
  checkpoint,
}) {
  const reference = checkpoint.evidencePacket;
  if (!isRecord(reference) || typeof reference.path !== 'string') {
    return {
      packet: null,
      packetPath: null,
      packetHash: null,
    };
  }
  const packetPath = resolvedEvidencePath(
    repositoryRoot,
    reference.path
  );
  const packetHash = consistentBinding(
    [reference.hash, reference.sha256],
    'evidencePacketHash',
    checkpointPath
  );
  assertFileHash(
    packetPath,
    packetHash,
    'authority_supersession_checkpoint_evidence_stale'
  );
  return {
    packet: readJson(
      packetPath,
      'authority_supersession_checkpoint_evidence_invalid'
    ),
    packetPath,
    packetHash,
  };
}

function normalizedTaskBinding({
  checkpoint,
  packet,
  oldRecord,
  checkpointPath,
}) {
  const candidates = [
    checkpoint.taskIds,
    checkpoint.primaryTaskIds,
    checkpoint.authorityBindings?.primaryTaskIds,
    packet?.taskIds,
    packet?.primaryTaskIds,
    packet?.partition?.taskIds,
    packet?.partition?.primaryTaskIds,
  ]
    .filter((value) => Array.isArray(value) && value.length > 0)
    .map(uniqueStrings);
  if (candidates.length === 0) {
    return {
      taskIds: uniqueStrings(oldRecord.primaryTaskIds),
      taskBindingSource: 'superseded_manifest',
    };
  }
  if (
    candidates.some(
      (candidate) => !sameValues(candidate, candidates[0])
    )
  ) {
    throw failure('authority_supersession_checkpoint_binding_mismatch', {
      checkpointPath,
      field: 'taskIds',
    });
  }
  return {
    taskIds: candidates[0],
    taskBindingSource: 'checkpoint',
  };
}

function normalizedGovernedFiles(checkpoint, packet) {
  const sources = [
    checkpoint.governedFiles,
    checkpoint.sourceTree?.governedFiles,
    checkpoint.governedFileManifest,
    packet?.governedFiles,
    packet?.sourceTree?.governedFiles,
    packet?.governedFileManifest,
  ];
  const source = sources.find(
    (candidate) => Array.isArray(candidate) && candidate.length > 0
  );
  if (!source) return [];
  const byPath = new Map();
  for (const entry of source) {
    const filePath = String(entry?.path || '');
    const checkpointHash = String(
      entry?.hash || entry?.sha256 || ''
    );
    if (
      !filePath ||
      !/^sha256:[0-9a-f]{64}$/u.test(checkpointHash) ||
      byPath.has(filePath)
    ) {
      throw failure('authority_supersession_checkpoint_invalid', {
        field: 'governedFiles',
        path: filePath || null,
      });
    }
    byPath.set(filePath, {
      path: filePath,
      checkpointHash,
    });
  }
  return [...byPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

function normalizedCommandEvidence({
  checkpoint,
  packet,
  checkpointPath,
}) {
  const commandSources = [
    checkpoint.commands,
    checkpoint.verification?.commands,
    checkpoint.verification?.passingResults,
    packet?.verification?.commands,
    packet?.verification?.passingResults,
  ];
  const commands =
    commandSources.find(
      (candidate) =>
        Array.isArray(candidate) && candidate.length > 0
    ) || [];
  const expectedRedNames = new Set(
    uniqueStrings([
      ...(checkpoint.tdd?.redEvidence || []),
      ...(packet?.tdd?.redEvidence || []),
    ]).map((value) => path.basename(value))
  );
  return commands.map((command, index) => {
    const logPath =
      command.logPath || command.log?.path || command.path || null;
    const logHash =
      command.logHash ||
      command.logSha256 ||
      command.log?.sha256 ||
      command.sha256 ||
      null;
    const expectedRed =
      Boolean(logPath) &&
      expectedRedNames.has(path.basename(String(logPath)));
    const hasExitCode = Number.isInteger(command.exitCode);
    const hasFailCount = Number.isInteger(command.failCount);
    const failed =
      (hasExitCode && command.exitCode !== 0) ||
      (hasFailCount && command.failCount > 0);
    const passed =
      (hasExitCode && command.exitCode === 0) ||
      (hasFailCount && command.failCount === 0);
    if (failed && !expectedRed) {
      throw failure(
        'authority_supersession_checkpoint_command_failed',
        {
          checkpointPath,
          commandId: command.id || command.commandId || index,
        }
      );
    }
    if (expectedRed && !failed) {
      throw failure(
        'authority_supersession_checkpoint_expected_red_missing',
        {
          checkpointPath,
          commandId: command.id || command.commandId || index,
        }
      );
    }
    return {
      commandId:
        command.id ||
        command.commandId ||
        String(logPath || `command-${index + 1}`),
      result:
        expectedRed && failed
          ? 'expected_red'
          : passed
            ? 'pass'
            : 'observed',
      logPath: logPath ? String(logPath) : null,
      logHash: logHash ? String(logHash) : null,
    };
  });
}

function normalizeCheckpoint({
  repositoryRoot,
  checkpointPath,
  checkpoint,
  oldRecord,
}) {
  const evidence = checkpointEvidencePacket({
    repositoryRoot,
    checkpointPath,
    checkpoint,
  });
  const packet = evidence.packet;
  const { taskIds, taskBindingSource } = normalizedTaskBinding({
    checkpoint,
    packet,
    oldRecord,
    checkpointPath,
  });
  return {
    checkpointFormat: packet
      ? 'evidence_packet'
      : checkpoint.authorityBindings
        ? 'rich'
        : 'flat',
    partitionId: consistentBinding(
      [checkpoint.partitionId, packet?.partition?.partitionId],
      'partitionId',
      checkpointPath
    ),
    parentPlanHash: consistentBinding(
      [
        checkpoint.parentPlanHash,
        checkpoint.authorityBindings?.parentPlan?.sha256,
        checkpoint.authorityBindings?.parentPlan?.hash,
        packet?.authority?.parentPlan?.sha256,
        packet?.authority?.parentPlan?.hash,
      ],
      'parentPlanHash',
      checkpointPath
    ),
    partitionManifestHash: consistentBinding(
      [
        checkpoint.partitionManifestHash,
        checkpoint.authorityBindings?.partitionManifest?.sha256,
        checkpoint.authorityBindings?.partitionManifest?.hash,
        packet?.authority?.partitionManifest?.sha256,
        packet?.authority?.partitionManifest?.hash,
      ],
      'partitionManifestHash',
      checkpointPath
    ),
    partitionSetHash: consistentBinding(
      [
        checkpoint.partitionSetHash,
        checkpoint.authorityBindings?.partitionSetHash,
        packet?.authority?.partitionSetHash,
      ],
      'partitionSetHash',
      checkpointPath
    ),
    childContractHash: consistentBinding(
      [
        checkpoint.childContractHash,
        checkpoint.authorityBindings?.childContract?.sha256,
        checkpoint.authorityBindings?.childContract?.hash,
        packet?.partition?.childContractHash,
      ],
      'childContractHash',
      checkpointPath
    ),
    taskIds,
    taskBindingSource,
    governedFiles: normalizedGovernedFiles(checkpoint, packet),
    commands: normalizedCommandEvidence({
      checkpoint,
      packet,
      checkpointPath,
    }),
    evidencePacketPath: evidence.packetPath,
    evidencePacketHash: evidence.packetHash,
  };
}

function validateCheckpoint({
  repositoryRoot,
  checkpointPath,
  supersededAuthority,
  supersededSummary,
  oldIndex,
  mappingByOldPartition,
  disposition = 'revalidation_required',
}) {
  const historicalEvidenceOnly =
    disposition === 'historical_evidence_only';
  const checkpoint = readJson(
    checkpointPath,
    'authority_supersession_checkpoint_invalid'
  );
  const initialPartitionId =
    checkpoint.partitionId ||
    checkpoint.evidencePacket?.partitionId ||
    null;
  const oldRecord = oldIndex.byId.get(initialPartitionId);
  if (!oldRecord) {
    const evidence = checkpointEvidencePacket({
      repositoryRoot,
      checkpointPath,
      checkpoint,
    });
    const packetPartitionId = evidence.packet?.partition?.partitionId;
    if (packetPartitionId) {
      checkpoint.partitionId = packetPartitionId;
    }
  }
  const resolvedOldRecord = oldIndex.byId.get(checkpoint.partitionId);
  const normalized = normalizeCheckpoint({
    repositoryRoot,
    checkpointPath,
    checkpoint,
    oldRecord: resolvedOldRecord,
  });
  const mapping = mappingByOldPartition.get(normalized.partitionId);
  const child = supersededSummary.children.find(
    ({ partitionId }) => partitionId === normalized.partitionId
  );
  if (
    !resolvedOldRecord ||
    !mapping ||
    !child ||
    normalized.parentPlanHash !==
      supersededAuthority.parentPlanHash ||
    normalized.partitionManifestHash !==
      supersededAuthority.partitionManifestHash ||
    normalized.partitionSetHash !==
      supersededAuthority.partitionSetHash ||
    normalized.childContractHash !== child.outputHash ||
    !sameValues(
      normalized.taskIds,
      resolvedOldRecord.primaryTaskIds
    )
  ) {
    throw failure('authority_supersession_checkpoint_binding_mismatch', {
      checkpointPath,
    });
  }
  const governedFiles = normalized.governedFiles.map(
    (entry) => {
      const withinSuccessorScope =
        mapping.governedPaths.includes(entry.path);
      if (!withinSuccessorScope && !historicalEvidenceOnly) {
        throw failure(
          'authority_supersession_checkpoint_scope_escape',
          {
            checkpointPath,
            path: entry.path,
          }
        );
      }
      const filePath = path.resolve(repositoryRoot, entry.path);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw failure(
          'authority_supersession_checkpoint_bytes_stale',
          {
            checkpointPath,
            path: entry.path,
            expectedHash: entry.checkpointHash,
            actualHash: null,
          }
        );
      }
      const currentHash = sha256File(filePath);
      return {
        path: entry.path,
        checkpointHash: entry.checkpointHash,
        currentHash,
        bytes: fs.statSync(filePath).size,
        current: currentHash === entry.checkpointHash,
        withinSuccessorScope,
      };
    }
  );
  const historicalScopeEscapePaths = governedFiles
    .filter(({ withinSuccessorScope }) => !withinSuccessorScope)
    .map(({ path: governedPath }) => governedPath)
    .sort();
  for (const command of normalized.commands) {
    if (command.logPath && command.logHash) {
      assertFileHash(
        resolvedEvidencePath(repositoryRoot, command.logPath),
        command.logHash,
        'authority_supersession_checkpoint_log_stale'
      );
    }
  }
  const staleGovernedPaths = governedFiles
    .filter(({ current }) => !current)
    .map(({ path: governedPath }) => governedPath)
    .sort();
  const checkpointGovernedFiles = governedFiles.map(
    ({ path: governedPath, checkpointHash }) => ({
      path: governedPath,
      hash: checkpointHash,
    })
  );
  const currentGovernedFiles = governedFiles.map(
    ({ path: governedPath, currentHash, bytes }) => ({
      path: governedPath,
      hash: currentHash,
      bytes,
    })
  );
  return {
    checkpointPath: path.resolve(checkpointPath).replace(/\\/gu, '/'),
    checkpointHash: sha256File(checkpointPath),
    checkpointFormat: normalized.checkpointFormat,
    evidencePacketPath: normalized.evidencePacketPath
      ? normalized.evidencePacketPath.replace(/\\/gu, '/')
      : null,
    evidencePacketHash: normalized.evidencePacketHash,
    supersededPartitionId: normalized.partitionId,
    successorPartitionId: mapping.successorPartitionId,
    taskIds: mapping.taskIds,
    taskBindingSource: normalized.taskBindingSource,
    acceptanceIds: mapping.acceptanceIds,
    checkpointGovernedByteSetHash: hashControlPlaneValue(
      checkpointGovernedFiles
    ),
    currentGovernedByteSetHash:
      hashControlPlaneValue(currentGovernedFiles),
    governedByteSetHash: hashControlPlaneValue(
      currentGovernedFiles
    ),
    governedByteSetCurrent: staleGovernedPaths.length === 0,
    staleGovernedPaths,
    historicalScopeEscapePaths,
    validatedCommandCount: normalized.commands.filter(
      ({ result }) => result === 'pass'
    ).length,
    expectedRedCommandCount: normalized.commands.filter(
      ({ result }) => result === 'expected_red'
    ).length,
    validatedLogCount: normalized.commands.filter(
      ({ logPath, logHash }) => logPath && logHash
    ).length,
    disposition,
  };
}

function prepareAuthoritySupersession(request = {}) {
  const {
    repositoryRoot,
    attemptId,
    supersededAuthority,
    successorAuthority,
    checkpointPaths = [],
    supersessionMode = 'strict_equivalence',
  } = request;
  if (
    typeof repositoryRoot !== 'string' ||
    typeof attemptId !== 'string' ||
    !supersededAuthority ||
    !successorAuthority
  ) {
    throw failure('authority_supersession_request_invalid');
  }
  if (!SUPERSESSION_MODES.has(supersessionMode)) {
    throw failure('authority_supersession_mode_invalid', {
      supersessionMode,
    });
  }
  const superseded = validateSupersededAuthority(
    repositoryRoot,
    supersededAuthority
  );
  const {
    partitionPlan,
    partitionPlanBytes,
    executionProjectionBundle,
    successorSelectionManifest,
    compilerIdentityHash,
    sourceIdentity,
    releaseContext,
  } = successorAuthority;
  assertSuccessorBundle({
    partitionPlan,
    partitionPlanBytes,
    executionProjectionBundle,
  });
  if (
    sourceIdentity?.sourceHash !==
      supersededAuthority.parentPlanHash ||
    path.resolve(sourceIdentity?.sourcePath || '') !==
      path.resolve(supersededAuthority.parentPlanPath) ||
    typeof compilerIdentityHash !== 'string'
  ) {
    throw failure('successor_source_identity_mismatch');
  }
  const normalizedReleaseContext =
    normalizeSuccessorReleaseContext(
      releaseContext,
      partitionPlan
    );
  const releaseContextHash = normalizedReleaseContext
    ? hashControlPlaneValue(normalizedReleaseContext)
    : null;
  const successorRecords = mergeSuccessorRecords(
    partitionPlan,
    successorSelectionManifest
  );
  const sourceGroundedCoverage =
    supersessionMode === 'source_grounded_hard_cut'
      ? buildSourceGroundedCoverage({
          partitionPlan,
          successorRecords,
        })
      : null;
  const { partitionMappings, equivalence } =
    supersessionMode === 'strict_equivalence'
      ? buildEquivalence({
          oldManifest: superseded.manifest,
          oldIndex: superseded.manifestIndex,
          partitionPlan,
          successorRecords,
        })
      : {
          partitionMappings:
            buildHistoricalPartitionMappings({
              oldManifest: superseded.manifest,
              successorRecords,
            }),
          equivalence: buildLegacyComparisonDiagnostic({
            oldManifest: superseded.manifest,
            oldIndex: superseded.manifestIndex,
            partitionPlan,
            successorRecords,
          }),
        };
  const mappingByOldPartition = new Map(
    partitionMappings.map((mapping) => [
      mapping.supersededPartitionId,
      mapping,
    ])
  );
  const checkpointMappings = checkpointPaths.map((checkpointPath) =>
    validateCheckpoint({
      repositoryRoot,
      checkpointPath,
      supersededAuthority,
      supersededSummary: superseded.summary,
      oldIndex: superseded.manifestIndex,
      mappingByOldPartition,
      disposition:
        supersessionMode === 'source_grounded_hard_cut'
          ? 'historical_evidence_only'
          : 'revalidation_required',
    })
  );
  const activationMode = 'successor_only';
  const sourceCoverageAuthority =
    supersessionMode === 'source_grounded_hard_cut'
      ? 'canonical_parent_source'
      : 'superseded_equivalence';
  const supersededDisposition = 'superseded_non_executable';
  const attemptKey = hashControlPlaneValue({
    attemptId,
    supersessionMode,
    activationMode,
    sourceCoverageAuthority,
    supersededDisposition,
    supersededAuthority: {
      parentPlanHash: supersededAuthority.parentPlanHash,
      partitionManifestHash:
        supersededAuthority.partitionManifestHash,
      partitionSetHash: supersededAuthority.partitionSetHash,
      childrenSummaryHash:
        supersededAuthority.childrenSummaryHash,
    },
    successorAuthority: {
      partitionPlanHash: partitionPlan.partitionPlanHash,
      partitionManifestHash:
        executionProjectionBundle.partitionManifestHash,
      partitionManifestDocumentHash:
        executionProjectionBundle.partitionManifestDocumentHash,
      partitionSetHash: partitionPlan.partitionSetHash,
      sourceAuthorityBundleHash:
        partitionPlan.sourceAuthorityBundleHash,
      releaseContextHash,
    },
    compilerIdentityHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    sourceHash: sourceIdentity.sourceHash,
    sourceGroundedCoverageHash:
      sourceGroundedCoverage?.receiptHash || null,
  });
  return Object.freeze({
    schemaVersion:
      'goal-contract-authority-supersession-preparation/v1',
    attemptId,
    attemptKey,
    supersessionMode,
    activationMode,
    sourceCoverageAuthority,
    supersededDisposition,
    repositoryRoot: path.resolve(repositoryRoot),
    supersededAuthority: structuredClone(supersededAuthority),
    successorAuthority: {
      partitionPlan: structuredClone(partitionPlan),
      partitionPlanBytes,
      executionProjectionBundle:
        structuredClone(executionProjectionBundle),
      compilerIdentityHash,
      sourceIdentity: structuredClone(sourceIdentity),
      releaseContext: normalizedReleaseContext,
      releaseContextHash,
    },
    equivalence: Object.freeze(equivalence),
    sourceGroundedCoverage: sourceGroundedCoverage
      ? Object.freeze(sourceGroundedCoverage)
      : null,
    partitionMappings: Object.freeze(partitionMappings),
    checkpointMappings: Object.freeze(checkpointMappings),
  });
}

function normalizeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('authority_supersession_artifact_path_invalid');
  }
  const normalized = value.replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    throw failure('authority_supersession_artifact_path_escape', {
      artifactPath: value,
    });
  }
  return path.posix.normalize(normalized);
}

function loadGoalContractModule(relativePath) {
  return require(
    __filename.endsWith('.ts')
      ? `../${relativePath}.ts`
      : `../${relativePath}`
  );
}

function canonicalReceiptBytes(schemaId, payload) {
  const { canonicalizeForSchema } = loadGoalContractModule(
    'partition-receipts'
  );
  const { stableStringify } = require(
    __filename.endsWith('.ts')
      ? '../../large-document-writer/receipts.ts'
      : '../../large-document-writer/receipts'
  );
  return stableStringify(
    canonicalizeForSchema(schemaId, payload)
  );
}

function absoluteFinalPath(finalRoot, relativePath) {
  return path
    .join(
      path.resolve(finalRoot),
      ...normalizeRelativePath(relativePath).split('/')
    )
    .replace(/\\/gu, '/');
}

function buildSuccessorFinalizationArtifacts({
  prepared,
  finalRoot,
}) {
  const releaseContext =
    prepared.successorAuthority.releaseContext;
  if (!releaseContext) return [];
  const {
    buildPartitionPlanGlobalCoverageReceipt,
    buildPartitionPlanSelectionReceipt,
  } = loadGoalContractModule('partition-selector');
  const {
    buildPartitionChildCoverageReceipt,
    buildPartitionChildGenerationReceipt,
  } = loadGoalContractModule('goal-contract-receipts');
  const partitionPlan =
    prepared.successorAuthority.partitionPlan;
  const bundle =
    prepared.successorAuthority.executionProjectionBundle;
  const manifest = bundle.partitionManifest;
  const manifestDocumentHash = sha256Bytes(
    Buffer.from(bundle.partitionManifestBytes, 'utf8')
  );
  const artifacts = [];
  const appendReceipt = (schemaId, relativePath, payload) => {
    const bytes = canonicalReceiptBytes(schemaId, payload);
    artifacts.push({
      relativePath: normalizeRelativePath(relativePath),
      bytes,
    });
    return {
      payload: JSON.parse(bytes),
      hash: sha256Bytes(Buffer.from(bytes, 'utf8')),
    };
  };

  artifacts.push({
    relativePath: normalizeRelativePath(
      manifest.partitionAnalysisReceiptPath
    ),
    bytes: prepared.successorAuthority.partitionPlanBytes,
  });
  const globalCoverage = buildPartitionPlanGlobalCoverageReceipt({
    partitionPlan,
    candidateManifest: manifest,
  });
  if (globalCoverage.decision !== 'pass') {
    throw failure('successor_global_coverage_blocked', {
      blockingReasons: globalCoverage.blockingReasons,
    });
  }
  const globalReceipt = appendReceipt(
    globalCoverage.schemaVersion,
    manifest.globalCoverageReceiptPath,
    globalCoverage
  );
  const evidenceByPartition = new Map(
    releaseContext.renderEvidence.map((evidence) => [
      evidence.partitionId,
      evidence,
    ])
  );
  const childByPartition = new Map(
    bundle.childCompilationReceipts.map((receipt) => [
      receipt.partitionId,
      receipt,
    ])
  );
  const selectionReceipts = new Map();
  for (const partition of manifest.partitions) {
    const selection = buildPartitionPlanSelectionReceipt({
      partitionPlan,
      partitionManifest: manifest,
      partitionId: partition.partitionId,
    });
    const selectionReceipt = appendReceipt(
      selection.schemaVersion,
      partition.selectionReceiptPath,
      selection
    );
    selectionReceipts.set(
      partition.partitionId,
      selectionReceipt
    );
  }

  for (const partition of manifest.partitions) {
    const evidence = evidenceByPartition.get(partition.partitionId);
    const child = childByPartition.get(partition.partitionId);
    const selectionReceipt = selectionReceipts.get(
      partition.partitionId
    );
    if (
      !evidence ||
      !child ||
      normalizeRelativePath(evidence.childContractPath) !==
        normalizeRelativePath(child.childContractPath) ||
      evidence.coverageAudit.decision !== 'pass' ||
      evidence.implementationProofAudit.decision !== 'pass'
    ) {
      throw failure('successor_child_finalization_evidence_invalid', {
        partitionId: partition.partitionId,
      });
    }
    const selection = selectionReceipt.payload;
    const excludedObligationIds = uniqueStrings([
      ...selection.excludedSourceObligationIds,
      ...selection.excludedTraceSliceIds,
      ...selection.excludedAtomicTaskIds,
      ...selection.excludedAcceptanceIds,
      ...selection.excludedCommandIds,
      ...selection.excludedEvidenceContractIds,
    ]);
    const coveragePayload = buildPartitionChildCoverageReceipt({
      partitionId: partition.partitionId,
      partitionManifestHash: manifestDocumentHash,
      selectionReceiptHash: selectionReceipt.hash,
      globalCoverageReceiptHash: globalReceipt.hash,
      selectedPrimaryObligationIds:
        selection.selectedPrimarySourceObligationIds,
      inheritedConstraintIds: selection.inheritedConstraintIds,
      excludedObligationIds,
      unmappedSelectedObligations:
        evidence.coverageAudit.unmappedSourceObligations || [],
      orphanGeneratedTaskIds:
        evidence.coverageAudit.orphanGeneratedTaskIds || [],
      orphanGeneratedAcceptanceIds:
        evidence.coverageAudit.orphanGeneratedAcceptanceIds || [],
    });
    if (coveragePayload.decision !== 'pass') {
      throw failure('successor_child_coverage_blocked', {
        partitionId: partition.partitionId,
        blockingReasons: coveragePayload.blockingReasons,
      });
    }
    const coverageReceipt = appendReceipt(
      coveragePayload.schemaVersion,
      evidence.coverageReceiptPath,
      coveragePayload
    );
    const goalContractPath = absoluteFinalPath(
      finalRoot,
      child.childContractPath
    );
    const generationPayload =
      buildPartitionChildGenerationReceipt({
        masterSourcePath: manifest.masterSourcePath,
        masterSourceHash: manifest.masterSourceHash,
        sourceSnapshotHash: manifest.sourceSnapshotHash,
        methodologyProfileHash: manifest.methodologyProfileHash,
        methodologyProfileArtifactHash:
          releaseContext.methodologyProfileArtifactHash,
        executionProjectionHash: manifest.executionProjectionHash,
        taskDagHash: manifest.taskDagHash,
        sequenceMode: manifest.sequenceMode,
        sequenceApplicability: manifest.sequenceApplicability,
        sequenceCoverage: manifest.sequenceCoverage,
        sequenceClosureStatus: manifest.sequenceClosureStatus,
        childContractAuthority: manifest.childContractAuthority,
        partitionPolicyHash: manifest.partitionPolicyHash,
        partitionPolicyArtifactHash:
          releaseContext.partitionPolicyArtifactHash,
        partitionManifestPath: absoluteFinalPath(
          finalRoot,
          'partition-manifest.json'
        ),
        partitionManifestHash: manifestDocumentHash,
        partitionAnalysisReceiptHash:
          manifest.partitionAnalysisReceiptHash,
        partitionSetHash: manifest.partitionSetHash,
        partitionId: partition.partitionId,
        partitionRole: partition.partitionRole,
        selectionReceiptPath: absoluteFinalPath(
          finalRoot,
          partition.selectionReceiptPath
        ),
        selectionReceiptHash: selectionReceipt.hash,
        selectionSetHash: partition.selectionSetHash,
        globalCoverageReceiptPath: absoluteFinalPath(
          finalRoot,
          manifest.globalCoverageReceiptPath
        ),
        globalCoverageReceiptHash: globalReceipt.hash,
        goalContractPath,
        goalContractHash: child.childContractHash,
        coverageReceiptPath: absoluteFinalPath(
          finalRoot,
          evidence.coverageReceiptPath
        ),
        coverageReceiptHash: coverageReceipt.hash,
        selectedAtomicTaskCount: partition.primaryTaskIds.length,
        inheritedConstraintCount:
          partition.inheritedConstraintIds.length,
        rendererAudit: evidence.rendererAudit,
        deterministicPreflight:
          evidence.deterministicPreflight,
        commandPortabilityAudit:
          evidence.commandPortabilityAudit,
        writeReceipt: {
          mode: 'atomic_authority_supersession',
          finalHash: child.childContractHash,
        },
      });
    if (generationPayload.decision !== 'pass') {
      throw failure('successor_child_generation_blocked', {
        partitionId: partition.partitionId,
        blockingReasons: generationPayload.blockingReasons,
      });
    }
    appendReceipt(
      generationPayload.schemaVersion,
      evidence.generationReceiptPath,
      generationPayload
    );
  }

  const sequenceApplicabilityReceiptPath =
    'receipts/sequence-applicability.receipt.json';
  const sequenceApplicabilityBytes = canonicalText(
    releaseContext.sequenceApplicabilityReceipt
  );
  artifacts.push({
    relativePath: sequenceApplicabilityReceiptPath,
    bytes: sequenceApplicabilityBytes,
  });
  const releaseAuthorityPayload = {
    schemaVersion:
      'goal-contract-successor-release-authority/v1',
    authorityMode: 'successor_pinned',
    activationMode: prepared.activationMode,
    attemptKey: prepared.attemptKey,
    releaseContextHash:
      prepared.successorAuthority.releaseContextHash,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionManifestHash: bundle.partitionManifestHash,
    partitionManifestDocumentHash: manifestDocumentHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    methodologyProfileHash: partitionPlan.methodologyProfileHash,
    methodologyProfileArtifactHash:
      releaseContext.methodologyProfileArtifactHash,
    executionProjectionHash:
      partitionPlan.executionProjectionHash,
    taskDagHash: partitionPlan.taskDagHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    partitionPolicyArtifactHash:
      releaseContext.partitionPolicyArtifactHash,
    sequenceApplicabilityReceiptPath,
    sequenceApplicabilityReceiptHash: sha256Bytes(
      Buffer.from(sequenceApplicabilityBytes, 'utf8')
    ),
    sequenceState: {
      sequenceMode: partitionPlan.sequenceMode,
      applicabilityDecision:
        partitionPlan.sequenceApplicability,
      sequenceCoverage: partitionPlan.sequenceCoverage,
      sequenceClosureStatus:
        partitionPlan.sequenceClosureStatus,
      childContractAuthority:
        partitionPlan.childContractAuthority,
    },
  };
  releaseAuthorityPayload.releaseAuthorityHash =
    hashControlPlaneValue(releaseAuthorityPayload);
  artifacts.push({
    relativePath: 'release-authority.json',
    bytes: canonicalText(releaseAuthorityPayload),
  });
  return artifacts;
}

function stageAuthoritySupersessionAttempt({
  prepared,
  finalRoot,
  additionalArtifacts = [],
}) {
  if (
    prepared?.schemaVersion !==
      'goal-contract-authority-supersession-preparation/v1' ||
    typeof finalRoot !== 'string'
  ) {
    throw failure('authority_supersession_stage_request_invalid');
  }
  const resolvedFinalRoot = path.resolve(finalRoot);
  const finalParent = path.dirname(resolvedFinalRoot);
  const stageRoot = path.join(
    finalParent,
    `.${path.basename(resolvedFinalRoot)}.staging-${prepared.attemptKey.slice(
      'sha256:'.length,
      'sha256:'.length + 16
    )}`
  );
  if (fs.existsSync(stageRoot)) {
    throw failure('authority_supersession_stage_exists', {
      stageRoot,
    });
  }
  if (fs.existsSync(resolvedFinalRoot)) {
    const verified = verifyAuthoritySupersessionReceipt({
      authorityRoot: resolvedFinalRoot,
      expected: { attemptKey: prepared.attemptKey },
    });
    return Object.freeze({
      stageRoot,
      finalRoot: resolvedFinalRoot,
      attemptKey: prepared.attemptKey,
      alreadyPromoted: true,
      verified,
    });
  }
  fs.mkdirSync(stageRoot, { recursive: true });
  const entries = [];
  const paths = new Set();
  const writeArtifact = (relativePath, bytes) => {
    const normalized = normalizeRelativePath(relativePath);
    if (paths.has(normalized)) {
      throw failure('authority_supersession_artifact_duplicate', {
        artifactPath: normalized,
      });
    }
    paths.add(normalized);
    const targetPath = path.join(stageRoot, ...normalized.split('/'));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const buffer = Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(String(bytes), 'utf8');
    fs.writeFileSync(targetPath, buffer);
    const reread = fs.readFileSync(targetPath);
    if (!reread.equals(buffer)) {
      throw failure('authority_supersession_stage_reread_mismatch', {
        artifactPath: normalized,
      });
    }
    entries.push({
      path: normalized,
      bytes: reread.length,
      sha256: sha256Bytes(reread),
    });
  };
  const { successorAuthority } = prepared;
  const bundle = successorAuthority.executionProjectionBundle;
  writeArtifact(
    'partition-plan.json',
    successorAuthority.partitionPlanBytes
  );
  writeArtifact(
    'partition-manifest.json',
    bundle.partitionManifestBytes
  );
  for (const receipt of bundle.childCompilationReceipts) {
    writeArtifact(
      receipt.childContractPath,
      receipt.childContractBytes
    );
    const pending = structuredClone(receipt);
    delete pending.childContractBytes;
    writeArtifact(
      `receipts/pending/${receipt.partitionId}.receipt.json`,
      canonicalText(pending)
    );
  }
  for (const receipt of bundle.childMembershipReceipts) {
    writeArtifact(
      `receipts/membership/${receipt.partitionId}.receipt.json`,
      canonicalText(receipt)
    );
  }
  if (prepared.supersessionMode === 'source_grounded_hard_cut') {
    writeArtifact(
      'receipts/source-grounded-coverage.receipt.json',
      canonicalText(prepared.sourceGroundedCoverage)
    );
    writeArtifact(
      'receipts/legacy-comparison.diagnostic.json',
      canonicalText(prepared.equivalence)
    );
  } else {
    writeArtifact(
      'receipts/equivalence.receipt.json',
      canonicalText(prepared.equivalence)
    );
  }
  writeArtifact(
    'receipts/checkpoint-mappings.json',
    canonicalText({
      schemaVersion:
        'goal-contract-authority-supersession-checkpoint-mappings/v1',
      mappings: prepared.checkpointMappings,
      mappingHash: hashControlPlaneValue(
        prepared.checkpointMappings
      ),
    })
  );
  for (const artifact of additionalArtifacts) {
    writeArtifact(artifact.relativePath, artifact.bytes);
  }
  for (const artifact of buildSuccessorFinalizationArtifacts({
    prepared,
    finalRoot: resolvedFinalRoot,
  })) {
    writeArtifact(artifact.relativePath, artifact.bytes);
  }
  entries.sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const stagedPayloadHash = hashControlPlaneValue(entries);
  const receipt = {
    schemaVersion:
      'goal-contract-authority-supersession-receipt/v1',
    attemptId: prepared.attemptId,
    attemptKey: prepared.attemptKey,
    supersessionMode: prepared.supersessionMode,
    activationMode: prepared.activationMode,
    sourceCoverageAuthority:
      prepared.sourceCoverageAuthority,
    supersededDisposition:
      prepared.supersededDisposition,
    supersededAuthority: {
      parentPlanHash:
        prepared.supersededAuthority.parentPlanHash,
      partitionManifestHash:
        prepared.supersededAuthority.partitionManifestHash,
      partitionSetHash:
        prepared.supersededAuthority.partitionSetHash,
      childrenSummaryHash:
        prepared.supersededAuthority.childrenSummaryHash,
    },
    successorAuthority: {
      partitionPlanHash:
        successorAuthority.partitionPlan.partitionPlanHash,
      partitionManifestHash: bundle.partitionManifestHash,
      partitionManifestDocumentHash:
        bundle.partitionManifestDocumentHash,
      partitionSetHash:
        successorAuthority.partitionPlan.partitionSetHash,
      orderedChildContractHashes:
        bundle.orderedChildContractHashes,
      sourceCompositionPolicyHash:
        successorAuthority.partitionPlan
          .sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        successorAuthority.partitionPlan.sourceAuthorityBundleHash,
      specSpanRegistryHash:
        successorAuthority.partitionPlan.specSpanRegistryHash,
      ...(successorAuthority.releaseContextHash
        ? {
            releaseContextHash:
              successorAuthority.releaseContextHash,
          }
        : {}),
    },
    compilerIdentityHash:
      successorAuthority.compilerIdentityHash,
    partitionPolicyHash:
      successorAuthority.partitionPlan.partitionPolicyHash,
    sourceIdentity: successorAuthority.sourceIdentity,
    equivalenceHash: hashControlPlaneValue(prepared.equivalence),
    ...(prepared.sourceGroundedCoverage
      ? {
          sourceGroundedCoverageHash:
            prepared.sourceGroundedCoverage.receiptHash,
        }
      : {}),
    partitionMappingHash: hashControlPlaneValue(
      prepared.partitionMappings
    ),
    checkpointMappingHash: hashControlPlaneValue(
      prepared.checkpointMappings
    ),
    stagedPayloadHash,
    promotionMode: 'atomic_directory_rename',
    decision: 'pass',
  };
  receipt.receiptHash = hashReceiptPayload(receipt);
  writeArtifact(
    'authority-supersession.receipt.json',
    canonicalText(receipt)
  );
  entries.sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const bundleManifest = {
    schemaVersion:
      'goal-contract-authority-supersession-byte-manifest/v1',
    attemptKey: prepared.attemptKey,
    entries,
    bundleHash: hashControlPlaneValue(entries),
  };
  const bundleManifestPath = path.join(
    stageRoot,
    'bundle-manifest.json'
  );
  fs.writeFileSync(
    bundleManifestPath,
    canonicalText(bundleManifest),
    'utf8'
  );
  verifyAuthoritySupersessionReceipt({
    authorityRoot: stageRoot,
    expected: { attemptKey: prepared.attemptKey },
  });
  return Object.freeze({
    stageRoot,
    finalRoot: resolvedFinalRoot,
    attemptKey: prepared.attemptKey,
    bundleHash: bundleManifest.bundleHash,
    alreadyPromoted: false,
  });
}

function verifyAuthoritySupersessionReceipt({
  authorityRoot,
  expected = {},
}) {
  const root = path.resolve(authorityRoot);
  const bundleManifest = readJson(
    path.join(root, 'bundle-manifest.json'),
    'authority_supersession_bundle_manifest_invalid'
  );
  const receipt = readJson(
    path.join(root, 'authority-supersession.receipt.json'),
    'authority_supersession_receipt_invalid'
  );
  validateSupersessionReceiptSchema(receipt);
  if (
    bundleManifest.schemaVersion !==
      'goal-contract-authority-supersession-byte-manifest/v1' ||
    receipt.schemaVersion !==
      'goal-contract-authority-supersession-receipt/v1' ||
    receipt.decision !== 'pass' ||
    !verifyReceiptSelfHash(receipt)
  ) {
    throw failure('authority_supersession_receipt_invalid');
  }
  const entries = bundleManifest.entries || [];
  if (
    bundleManifest.bundleHash !== hashControlPlaneValue(entries) ||
    new Set(entries.map((entry) => entry.path)).size !==
      entries.length
  ) {
    throw failure('authority_supersession_bundle_manifest_invalid');
  }
  for (const entry of entries) {
    const relativePath = normalizeRelativePath(entry.path);
    const filePath = path.join(root, ...relativePath.split('/'));
    if (
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).size !== entry.bytes ||
      sha256File(filePath) !== entry.sha256
    ) {
      throw failure('authority_supersession_stage_tampered', {
        artifactPath: relativePath,
      });
    }
  }
  if (receipt.supersessionMode === 'source_grounded_hard_cut') {
    const coverageReceipt = readJson(
      path.join(
        root,
        'receipts',
        'source-grounded-coverage.receipt.json'
      ),
      'source_grounded_coverage_receipt_invalid'
    );
    validateSourceGroundedCoverageReceiptSchema(coverageReceipt);
    if (
      !verifyReceiptSelfHash(coverageReceipt) ||
      coverageReceipt.receiptHash !==
        receipt.sourceGroundedCoverageHash ||
      coverageReceipt.partitionPlanHash !==
        receipt.successorAuthority.partitionPlanHash ||
      coverageReceipt.partitionSetHash !==
        receipt.successorAuthority.partitionSetHash ||
      coverageReceipt.sourceAuthorityBundleHash !==
        receipt.successorAuthority.sourceAuthorityBundleHash ||
      coverageReceipt.specSpanRegistryHash !==
        receipt.successorAuthority.specSpanRegistryHash
    ) {
      throw failure(
        'source_grounded_coverage_receipt_invalid'
      );
    }
    const diagnostic = readJson(
      path.join(
        root,
        'receipts',
        'legacy-comparison.diagnostic.json'
      ),
      'authority_supersession_diagnostic_invalid'
    );
    if (
      diagnostic.decision !== 'diagnostic_only' ||
      diagnostic.authoritative !== false ||
      hashControlPlaneValue(diagnostic) !==
        receipt.equivalenceHash
    ) {
      throw failure(
        'authority_supersession_diagnostic_invalid'
      );
    }
  } else {
    const equivalence = readJson(
      path.join(root, 'receipts', 'equivalence.receipt.json'),
      'authority_supersession_equivalence_invalid'
    );
    if (
      equivalence.decision !== 'pass' ||
      hashControlPlaneValue(equivalence) !==
        receipt.equivalenceHash
    ) {
      throw failure(
        'authority_supersession_equivalence_invalid'
      );
    }
  }
  const expectedBindings = {
    attemptKey: receipt.attemptKey,
    supersessionMode: receipt.supersessionMode,
    supersededDisposition: receipt.supersededDisposition,
    supersededPartitionManifestHash:
      receipt.supersededAuthority.partitionManifestHash,
    successorPartitionManifestHash:
      receipt.successorAuthority.partitionManifestHash,
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (
      expectedValue !== undefined &&
      expectedBindings[field] !== expectedValue
    ) {
      throw failure('authority_supersession_replay_rejected', {
        field,
        expected: expectedValue,
        actual: expectedBindings[field],
      });
    }
  }
  return Object.freeze({
    decision: 'pass',
    authorityRoot: root.replace(/\\/gu, '/'),
    attemptKey: receipt.attemptKey,
    receiptHash: receipt.receiptHash,
    bundleHash: bundleManifest.bundleHash,
    artifactHashes: Object.freeze(
      Object.fromEntries(
        entries.map((entry) => [entry.path, entry.sha256])
      )
    ),
    receipt,
  });
}

function resolveAuthorityArtifactPath(
  authorityRoot,
  relativePath,
  failureClass
) {
  const root = path.resolve(authorityRoot);
  const normalized = normalizeRelativePath(relativePath);
  const resolved = path.resolve(
    root,
    ...normalized.split('/')
  );
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw failure(failureClass, {
      authorityRoot: root,
      artifactPath: relativePath,
    });
  }
  return resolved;
}

function loadAuthoritySupersessionForRelease({
  authorityRoot,
  partitionManifestPath,
  goalPath,
  expectedPartitionPlanHash,
}) {
  const canonicalGeneration =
    loadCanonicalStandaloneGenerationForRelease({
      authorityRoot,
      partitionManifestPath,
      goalPath,
      expectedPartitionPlanHash,
    });
  if (canonicalGeneration) return canonicalGeneration;
  const verified = verifyAuthoritySupersessionReceipt({
    authorityRoot,
  });
  const root = path.resolve(authorityRoot);
  const receipt = verified.receipt;
  if (
    receipt.activationMode !== 'successor_only' ||
    receipt.supersededDisposition !==
      'superseded_non_executable'
  ) {
    throw failure('authority_supersession_not_executable');
  }
  const expectedManifestPath = path.join(
    root,
    'partition-manifest.json'
  );
  if (
    path.resolve(partitionManifestPath || '') !==
      expectedManifestPath
  ) {
    throw failure('successor_partition_manifest_path_mismatch', {
      expectedPath: expectedManifestPath,
      actualPath: path.resolve(partitionManifestPath || ''),
    });
  }
  const partitionPlan = readJson(
    path.join(root, 'partition-plan.json'),
    'successor_partition_plan_invalid'
  );
  const manifest = readJson(
    expectedManifestPath,
    'successor_partition_manifest_invalid'
  );
  const releaseAuthority = readJson(
    path.join(root, 'release-authority.json'),
    'successor_release_authority_missing'
  );
  const {
    releaseAuthorityHash,
    ...releaseAuthoritySemantic
  } = releaseAuthority;
  if (
    releaseAuthority.schemaVersion !==
      'goal-contract-successor-release-authority/v1' ||
    releaseAuthority.authorityMode !== 'successor_pinned' ||
    releaseAuthority.activationMode !== 'successor_only' ||
    releaseAuthorityHash !==
      hashControlPlaneValue(releaseAuthoritySemantic) ||
    releaseAuthority.attemptKey !== receipt.attemptKey ||
    releaseAuthority.releaseContextHash !==
      receipt.successorAuthority.releaseContextHash
  ) {
    throw failure('successor_release_authority_invalid');
  }
  const semanticPlan = structuredClone(partitionPlan);
  delete semanticPlan.partitionPlanHash;
  const manifestDocumentHash = sha256File(expectedManifestPath);
  if (
    partitionPlan.partitionPlanHash !==
      hashControlPlaneValue(semanticPlan) ||
    partitionPlan.partitionPlanHash !==
      receipt.successorAuthority.partitionPlanHash ||
    manifest.partitionPlanHash !== partitionPlan.partitionPlanHash ||
    manifest.partitionManifestHash !==
      receipt.successorAuthority.partitionManifestHash ||
    manifestDocumentHash !==
      receipt.successorAuthority.partitionManifestDocumentHash ||
    releaseAuthority.partitionPlanHash !==
      partitionPlan.partitionPlanHash ||
    releaseAuthority.partitionManifestHash !==
      manifest.partitionManifestHash ||
    releaseAuthority.partitionManifestDocumentHash !==
      manifestDocumentHash ||
    releaseAuthority.partitionSetHash !==
      partitionPlan.partitionSetHash ||
    (expectedPartitionPlanHash &&
      expectedPartitionPlanHash !== partitionPlan.partitionPlanHash)
  ) {
    throw failure('successor_release_authority_binding_mismatch');
  }
  const sequenceReceiptPath = resolveAuthorityArtifactPath(
    root,
    releaseAuthority.sequenceApplicabilityReceiptPath,
    'successor_sequence_applicability_path_invalid'
  );
  const sequenceReceipt = readJson(
    sequenceReceiptPath,
    'successor_sequence_applicability_receipt_invalid'
  );
  if (
    sha256File(sequenceReceiptPath) !==
      releaseAuthority.sequenceApplicabilityReceiptHash ||
    sequenceReceipt.decision !== manifest.sequenceApplicability
  ) {
    throw failure(
      'successor_sequence_applicability_receipt_invalid'
    );
  }
  const resolvedGoalPath = path.resolve(goalPath || '');
  const child = (manifest.partitions || []).find(
    (partition) =>
      resolveAuthorityArtifactPath(
        root,
        partition.childContractPath,
        'successor_child_path_invalid'
      ) === resolvedGoalPath
  );
  if (
    !child ||
    !fs.existsSync(resolvedGoalPath) ||
    sha256File(resolvedGoalPath) !== child.childContractHash
  ) {
    throw failure('successor_child_membership_invalid', {
      goalPath: resolvedGoalPath,
    });
  }
  return Object.freeze({
    authorityMode: 'successor_pinned',
    authorityRoot: root.replace(/\\/gu, '/'),
    supersessionReceiptHash: verified.receiptHash,
    artifactHashes: verified.artifactHashes,
    releaseAuthorityHash,
    releaseAuthority,
    partitionPlan,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    methodology: Object.freeze({
      methodologyProfileHash:
        releaseAuthority.methodologyProfileHash,
      methodologyProfileArtifactHash:
        releaseAuthority.methodologyProfileArtifactHash,
    }),
    optimizerPolicyBinding: Object.freeze({
      partitionPolicyHash:
        releaseAuthority.partitionPolicyHash,
      partitionPolicyArtifactHash:
        releaseAuthority.partitionPolicyArtifactHash,
    }),
    projection: Object.freeze({
      executionProjectionHash:
        releaseAuthority.executionProjectionHash,
      taskDagHash: releaseAuthority.taskDagHash,
      sequenceConstraintBinding: Object.freeze({
        ...releaseAuthority.sequenceState,
      }),
    }),
    compiled: Object.freeze({
      manifest,
      partitionManifestHash: manifestDocumentHash,
    }),
  });
}

function loadCanonicalStandaloneGenerationForRelease({
  authorityRoot,
  partitionManifestPath,
  goalPath,
  expectedPartitionPlanHash,
}) {
  const root = path.resolve(authorityRoot || '');
  if (fs.existsSync(path.join(root, 'bundle-manifest.json'))) {
    return null;
  }
  const generationsRoot = path.dirname(root);
  if (path.basename(generationsRoot) !== 'generations') {
    return null;
  }
  const activePointerPath = path.join(
    path.dirname(generationsRoot),
    'active-generation.json'
  );
  if (
    !fs.existsSync(activePointerPath) ||
    !fs.statSync(activePointerPath).isFile()
  ) {
    return null;
  }
  const pointer = readJson(
    activePointerPath,
    'partition_active_pointer_invalid'
  );
  validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, pointer);
  const expectedManifestPath = path.resolve(
    pointer.partitionManifestPath || ''
  );
  if (
    pointer.authorityMode !== 'standalone_bootstrap' ||
    path.resolve(pointer.generationRoot || '') !== root ||
    path.resolve(partitionManifestPath || '') !==
      expectedManifestPath ||
    path.resolve(pointer.partitionPlanPath || '') !==
      path.join(root, 'partition-plan.json') ||
    expectedManifestPath !==
      path.join(root, 'partition-manifest.json')
  ) {
    throw failure('partition_active_pointer_stale');
  }
  const sourceIdentity = resolveGoalContractSourceIdentity({
    profile: 'standalone_frozen',
    nativeGoalHandoff: {
      masterImplementationPlanHash: pointer.sourceHash,
    },
  });
  const authoritySourceRoot = path.dirname(generationsRoot);
  const repositoryRoot = path.resolve(
    authoritySourceRoot,
    '..',
    '..',
    '..',
    '..'
  );
  const expectedAuthoritySourceRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'goal-contract-partition-bootstrap',
    sourceIdentity.sourceIdentityHash.slice('sha256:'.length)
  );
  if (path.resolve(expectedAuthoritySourceRoot) !== authoritySourceRoot) {
    throw failure('partition_active_pointer_stale');
  }
  const authority = {
    authorityMode: pointer.authorityMode,
    repositoryRoot,
    sourceHash: sourceIdentity.sourceIdentityHash,
    generationKey: pointer.generationKey,
    unitRoot: root,
    activePointerPath,
    partitionPlanPath: pointer.partitionPlanPath,
    partitionManifestPath: pointer.partitionManifestPath,
  };
  const validated = validateImmutablePartitionAuthorityUnit({
    authority,
    expectedSourceHash: sourceIdentity.sourceIdentityHash,
    expectedGenerationKey: pointer.generationKey,
    expectedPartitionPlanHash: pointer.partitionPlanHash,
    expectedPartitionManifestHash: pointer.partitionManifestHash,
    expectedPartitionManifestDocumentHash:
      pointer.partitionManifestDocumentHash,
  });
  if (
    expectedPartitionPlanHash &&
    expectedPartitionPlanHash !== validated.partitionPlanHash
  ) {
    throw failure('successor_release_authority_binding_mismatch');
  }
  const partitionPlan = readJson(
    pointer.partitionPlanPath,
    'partition_generation_incomplete'
  );
  const manifest = validated.manifest;
  const resolvedGoalPath = path.resolve(goalPath || '');
  const child = (manifest.partitions || []).find((partition) => {
    const validatedChild = validated.childContractHashes.find(
      (entry) => entry.hash === partition.childContractHash
    );
    return (
      validatedChild &&
      path.resolve(root, validatedChild.path) === resolvedGoalPath
    );
  });
  if (
    !child ||
    !fs.existsSync(resolvedGoalPath) ||
    sha256File(resolvedGoalPath) !== child.childContractHash
  ) {
    throw failure('successor_child_membership_invalid', {
      goalPath: resolvedGoalPath,
    });
  }
  const childGeneration = readJson(
    path.join(
      root,
      'receipts',
      'children',
      `${child.partitionId}.generation.json`
    ),
    'partition_child_generation_receipt_invalid'
  );
  validateGoalContractSchema(
    'goal-contract-partition-child-generation-receipt.schema.json',
    childGeneration
  );
  return Object.freeze({
    authorityMode: 'standalone_bootstrap',
    authorityRoot: root.replace(/\\/gu, '/'),
    activePointerPath: activePointerPath.replace(/\\/gu, '/'),
    sourceIdentity,
    artifactHashes: Object.freeze({
      ...Object.fromEntries(
        validated.childContractHashes.map((entry) => [
          entry.path,
          entry.hash,
        ])
      ),
      ...Object.fromEntries(
        validated.requiredReceiptHashes.map((entry) => [
          entry.path,
          entry.hash,
        ])
      ),
    }),
    partitionPlan,
    partitionPlanHash: validated.partitionPlanHash,
    methodology: Object.freeze({
      methodologyProfileHash:
        partitionPlan.methodologyProfileHash,
      methodologyProfileArtifactHash:
        childGeneration.methodologyProfileArtifactHash,
    }),
    optimizerPolicyBinding: Object.freeze({
      partitionPolicyHash: partitionPlan.partitionPolicyHash,
      partitionPolicyArtifactHash:
        childGeneration.partitionPolicyArtifactHash,
    }),
    projection: Object.freeze({
      executionProjectionHash: manifest.executionProjectionHash,
      taskDagHash: manifest.taskDagHash,
      sequenceConstraintBinding: Object.freeze({
        sequenceMode: manifest.sequenceMode,
        applicabilityDecision:
          manifest.sequenceApplicability,
        sequenceCoverage: manifest.sequenceCoverage,
        sequenceClosureStatus: manifest.sequenceClosureStatus,
        childContractAuthority:
          manifest.childContractAuthority,
      }),
    }),
    compiled: Object.freeze({
      manifest,
      partitionManifestHash: manifest.partitionManifestHash,
    }),
  });
}

function promoteAuthoritySupersessionAttempt({ staged }) {
  if (!staged || typeof staged.finalRoot !== 'string') {
    throw failure('authority_supersession_promotion_request_invalid');
  }
  if (fs.existsSync(staged.finalRoot)) {
    const verified = verifyAuthoritySupersessionReceipt({
      authorityRoot: staged.finalRoot,
      expected: { attemptKey: staged.attemptKey },
    });
    return Object.freeze({
      ...verified,
      idempotent: true,
    });
  }
  if (
    !fs.existsSync(staged.stageRoot) ||
    path.dirname(path.resolve(staged.stageRoot)) !==
      path.dirname(path.resolve(staged.finalRoot))
  ) {
    throw failure('authority_supersession_stage_missing');
  }
  verifyAuthoritySupersessionReceipt({
    authorityRoot: staged.stageRoot,
    expected: { attemptKey: staged.attemptKey },
  });
  fs.renameSync(staged.stageRoot, staged.finalRoot);
  const verified = verifyAuthoritySupersessionReceipt({
    authorityRoot: staged.finalRoot,
    expected: { attemptKey: staged.attemptKey },
  });
  return Object.freeze({
    ...verified,
    idempotent: false,
  });
}

function requirePartitionAuthorityHash(value, field) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw failure('partition_authority_binding_invalid', { field });
  }
  return value;
}

function requirementRecordGoalSourceIdentity(
  record,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const handoff = record?.nativeGoalHandoff;
  try {
    return resolveGoalContractSourceIdentity({
      profile: sourceIdentityProfile,
      nativeGoalHandoff: handoff,
    });
  } catch (error) {
    if (error?.failureClass === 'goal_contract_source_identity_missing') {
      throw failure('partition_authority_source_identity_missing');
    }
    throw error;
  }
}

function requirementRecordEventChainProjection(payload) {
  return hashControlPlaneValue({
    requirementSetId: payload.requirementSetId,
    sourceHash: payload.sourceHash,
    partitionRunId: payload.partitionRunId,
    partitionManifestHash: payload.partitionManifestHash,
    partitionManifestDocumentHash:
      payload.partitionManifestDocumentHash,
  });
}

function bindCompiledSourceIdentityProjection({
  payload,
  declaredProjection,
  sourceIdentity,
  sourceIdentityProfile,
}) {
  if (sourceIdentityProfile !== 'main_agent_compiled') {
    return declaredProjection;
  }
  const expectedProjection =
    requirementRecordEventChainProjection(payload);
  if (declaredProjection !== expectedProjection) {
    throw failure('partition_authority_source_identity_mismatch', {
      field: 'eventChainProjection',
      expectedSourceHash: expectedProjection,
      actualSourceHash: declaredProjection,
    });
  }
  return hashControlPlaneValue({
    eventChainProjection: declaredProjection,
    sourceIdentityResolutionHash: sourceIdentity.resolutionHash,
  });
}

function assertCompiledSourceIdentityProjection({
  payload,
  sourceIdentity,
  sourceIdentityProfile,
}) {
  if (sourceIdentityProfile !== 'main_agent_compiled') return;
  const expected = hashControlPlaneValue({
    eventChainProjection:
      requirementRecordEventChainProjection(payload),
    sourceIdentityResolutionHash: sourceIdentity.resolutionHash,
  });
  if (payload.eventChainProjection !== expected) {
    throw failure('partition_authority_source_identity_mismatch', {
      field: 'eventChainProjection',
      expectedSourceHash: expected,
      actualSourceHash: payload.eventChainProjection,
    });
  }
}

function prepareRequirementRecordPartitionAuthoritySupersession(input) {
  if (!input?.record || typeof input.record !== 'object') {
    throw failure('partition_authority_record_invalid');
  }
  const sourceIdentityProfile =
    input.sourceIdentityProfile ?? 'standalone_frozen';
  const requirementSetId = input.record.requirementSetId;
  if (
    typeof requirementSetId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(requirementSetId)
  ) {
    throw failure('partition_authority_requirement_set_invalid');
  }
  const boundSourceIdentity = requirementRecordGoalSourceIdentity(
    input.record,
    sourceIdentityProfile
  );
  const boundSourceHash = boundSourceIdentity.sourceIdentityHash;
  const sourceHash = requirePartitionAuthorityHash(
    input.sourceHash,
    'sourceHash'
  );
  if (boundSourceHash !== sourceHash) {
    throw failure('partition_authority_source_identity_mismatch', {
      expectedSourceHash: boundSourceHash,
      actualSourceHash: sourceHash,
    });
  }
  if (
    typeof input.partitionRunId !== 'string' ||
    !/^partition-run-[0-9a-f]{64}$/u.test(input.partitionRunId)
  ) {
    throw failure('partition_authority_partition_run_invalid');
  }
  if (
    typeof input.authorityRoot !== 'string' ||
    input.authorityRoot.length === 0 ||
    input.authorityRoot.replace(/\\/gu, '/').split('/').includes('..')
  ) {
    throw failure('partition_authority_root_invalid');
  }
  const payloadFields = {
    schemaVersion: 'goal-contract-partition-authority-supersession/v1',
    requirementSetId,
    sourceHash,
    partitionRunId: input.partitionRunId,
    authorityRoot: input.authorityRoot.replace(/\\/gu, '/'),
    partitionPlanHash: requirePartitionAuthorityHash(
      input.partitionPlanHash,
      'partitionPlanHash'
    ),
    partitionManifestHash: requirePartitionAuthorityHash(
      input.partitionManifestHash,
      'partitionManifestHash'
    ),
    partitionManifestDocumentHash: requirePartitionAuthorityHash(
      input.partitionManifestDocumentHash,
      'partitionManifestDocumentHash'
    ),
    partitionSetHash: requirePartitionAuthorityHash(
      input.partitionSetHash,
      'partitionSetHash'
    ),
  };
  const declaredEventChainProjection =
    requirePartitionAuthorityHash(
      input.eventChainProjection,
      'eventChainProjection'
    );
  const payload = Object.freeze({
    ...payloadFields,
    eventChainProjection: bindCompiledSourceIdentityProjection({
      payload: payloadFields,
      declaredProjection: declaredEventChainProjection,
      sourceIdentity: boundSourceIdentity,
      sourceIdentityProfile,
    }),
  });
  return Object.freeze({
    writerId: 'goal-contract-authority-supersession',
    eventType: 'goal_contract_partition_authority_superseded',
    payload,
    reduce(record) {
      const currentSourceIdentity =
        requirementRecordGoalSourceIdentity(
          record,
          sourceIdentityProfile
        );
      const currentSourceHash =
        currentSourceIdentity.sourceIdentityHash;
      assertCompiledSourceIdentityProjection({
        payload,
        sourceIdentity: currentSourceIdentity,
        sourceIdentityProfile,
      });
      if (currentSourceHash !== payload.sourceHash) {
        throw failure('partition_authority_source_identity_mismatch', {
          expectedSourceHash: currentSourceHash,
          actualSourceHash: payload.sourceHash,
        });
      }
      return {
        ...record,
        nativeGoalHandoff: {
          ...(record.nativeGoalHandoff || {}),
          goalContractPartitionAuthority: payload,
        },
        lastEventType: 'goal_contract_partition_authority_superseded',
      };
    },
  });
}

function projectRequirementRecordPartitionAuthority(
  record,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const sourceIdentity = requirementRecordGoalSourceIdentity(
    record,
    sourceIdentityProfile
  );
  const sourceHash = sourceIdentity.sourceIdentityHash;
  const payload = record?.nativeGoalHandoff?.goalContractPartitionAuthority;
  if (!payload || typeof payload !== 'object') {
    throw failure('partition_authority_projection_missing');
  }
  if (
    payload.schemaVersion !==
      'goal-contract-partition-authority-supersession/v1' ||
    payload.requirementSetId !== record.requirementSetId ||
    payload.sourceHash !== sourceHash
  ) {
    throw failure('partition_authority_projection_invalid');
  }
  for (const field of [
    'partitionPlanHash',
    'partitionManifestHash',
    'partitionManifestDocumentHash',
    'partitionSetHash',
    'eventChainProjection',
  ]) {
    requirePartitionAuthorityHash(payload[field], field);
  }
  assertCompiledSourceIdentityProjection({
    payload,
    sourceIdentity,
    sourceIdentityProfile,
  });
  return Object.freeze({ ...payload });
}

function loadRequirementRecordControlStore() {
  const candidates = [
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'requirement-record-control-store.js'
    ),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'main-agent',
      'source-authority',
      'scripts',
      'requirement-record-control-store.js'
    ),
  ];
  const modulePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!modulePath) {
    throw failure('partition_authority_control_store_missing');
  }
  return require(modulePath);
}

function writePartitionAuthorityProjectionFile(
  activePointerPath,
  pointerBytes
) {
  fs.mkdirSync(path.dirname(activePointerPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(activePointerPath),
    `.${path.basename(activePointerPath)}.${process.pid}.tmp`
  );
  fs.writeFileSync(temporaryPath, pointerBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporaryPath, activePointerPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
  }
  if (fs.readFileSync(activePointerPath, 'utf8') !== pointerBytes) {
    throw failure('partition_authority_pointer_projection_readback_failed');
  }
}

function requirementRecordPartitionPointer(
  record,
  recordPath,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const authority = projectRequirementRecordPartitionAuthority(
    record,
    sourceIdentityProfile
  );
  const recordHash = record.recordHash;
  const eventChainHead = record.eventChainHead;
  if (
    !isHash(recordHash) ||
    !isHash(eventChainHead) ||
    !Number.isInteger(record.recordRevision) ||
    record.recordRevision < 0 ||
    typeof record.lastAppliedEventId !== 'string' ||
    record.lastAppliedEventId.length === 0
  ) {
    throw failure('partition_authority_record_revision_missing');
  }
  const pointer = {
    ...authority,
    schemaVersion: 'goal-contract-partition-active-requirement-record-run/v1',
    authorityMode: 'requirement_record',
    requirementSetId: record.requirementSetId,
    recordPath: normalizePath(recordPath),
    recordHash,
    recordRevision: record.recordRevision,
    eventChainHead,
    eventId: record.lastAppliedEventId,
  };
  const projected = {
    ...pointer,
    pointerProjectionHash: hashControlPlaneValue(pointer),
  };
  validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, projected);
  return Object.freeze(projected);
}

function pointerProjectionPaths(
  record,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const authority = projectRequirementRecordPartitionAuthority(
    record,
    sourceIdentityProfile
  );
  return Object.freeze({
    activePointerPath: path.join(
      authority.authorityRoot,
      'active-partition-run.json'
    ),
    blockedMarkerPath: path.join(
      authority.authorityRoot,
      'pointer-projection-blocked.json'
    ),
  });
}

function writeRequirementRecordPartitionAuthorityProjection(
  record,
  recordPath,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const pointer = requirementRecordPartitionPointer(
    record,
    recordPath,
    sourceIdentityProfile
  );
  const paths = pointerProjectionPaths(record, sourceIdentityProfile);
  writePartitionAuthorityProjectionFile(
    paths.activePointerPath,
    canonicalText(pointer)
  );
  if (fs.existsSync(paths.blockedMarkerPath)) {
    fs.rmSync(paths.blockedMarkerPath, { force: true });
  }
  return Object.freeze({
    ...pointer,
    pointerPath: paths.activePointerPath,
    pointerBytes: canonicalText(pointer),
  });
}

function markRequirementRecordPartitionAuthorityProjectionBlocked(
  record,
  details,
  sourceIdentityProfile = 'standalone_frozen'
) {
  const paths = pointerProjectionPaths(record, sourceIdentityProfile);
  const marker = {
    schemaVersion: 'goal-contract-partition-pointer-projection-blocked/v1',
    recordPath: normalizePath(
      path.join(
        paths.activePointerPath,
        '..',
        '..',
        'requirement-record.json'
      )
    ),
    recordHash: record.recordHash,
    eventChainHead: record.eventChainHead,
    failureClass: details.failureClass,
  };
  writePartitionAuthorityProjectionFile(
    paths.blockedMarkerPath,
    canonicalText(marker)
  );
  return paths;
}

function commitRequirementRecordPartitionAuthoritySupersession(input) {
  const recordPath = path.resolve(input?.recordPath || '');
  if (!input || !fs.existsSync(recordPath)) {
    throw failure('partition_authority_record_missing', { recordPath });
  }
  const record = readJson(recordPath, 'partition_authority_record_invalid');
  const repositoryRoot = path.resolve(input.repositoryRoot || '');
  const sourceIdentityProfile =
    input.sourceIdentityProfile ?? 'standalone_frozen';
  const requirementSetId = record.requirementSetId;
  const expectedRecordPath = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'requirement-record.json'
  );
  if (
    !repositoryRoot ||
    path.resolve(recordPath) !== path.resolve(expectedRecordPath)
  ) {
    throw failure('partition_requirement_record_path_invalid', {
      expectedRecordPath: normalizePath(expectedRecordPath),
      recordPath: normalizePath(recordPath),
    });
  }
  const expectedAuthorityRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'goal-contract'
  );
  if (
    path.resolve(input.authorityRoot) !== path.resolve(expectedAuthorityRoot)
  ) {
    throw failure('partition_governed_authority_override_rejected', {
      expectedAuthorityRoot: normalizePath(expectedAuthorityRoot),
    });
  }
  preflightRequirementRecordPartitionAuthoritySupersession({
    repositoryRoot,
    recordPath,
    requirementSetId,
    sourceHash: input.sourceHash,
    sourceIdentityProfile,
  });
  const validatedAuthority =
    validateImmutablePartitionAuthorityUnit({
      authority: {
        unitRoot: path.join(
          expectedAuthorityRoot,
          'partition-runs',
          input.partitionRunId
        ),
      },
      incompleteFailureClass:
        'partition_authority_run_incomplete',
      expectedSourceHash: input.sourceHash,
      expectedPartitionRunId: input.partitionRunId,
      expectedPartitionPlanHash: input.partitionPlanHash,
      expectedPartitionManifestHash:
        input.partitionManifestHash,
      expectedPartitionManifestDocumentHash:
        input.partitionManifestDocumentHash,
      expectedPartitionSetHash: input.partitionSetHash,
    });
  const prepared = prepareRequirementRecordPartitionAuthoritySupersession({
    record,
    ...input,
    sourceIdentityProfile,
    partitionPlanHash: validatedAuthority.partitionPlanHash,
    partitionManifestHash:
      validatedAuthority.partitionManifestHash,
    partitionManifestDocumentHash:
      validatedAuthority.partitionManifestDocumentHash,
    partitionSetHash: validatedAuthority.partitionSetHash,
  });
  const controlStore = loadRequirementRecordControlStore();
  let committed;
  try {
    committed = controlStore.appendControlEventAndReplay({
      recordPath,
      writerId: prepared.writerId,
      eventType: prepared.eventType,
      eventId: input.eventId,
      payload: prepared.payload,
      recordedAt: input.recordedAt,
      expectedBeforeRecordHash: input.expectedBeforeRecordHash,
      payloadSchemaVersion: prepared.payload.schemaVersion,
      reduce: prepared.reduce,
    });
  } catch (error) {
    if (
      String(error?.message || '').includes('writer_') ||
      String(error?.message || '').includes('writer_registry')
    ) {
      throw failure('partition_authority_writer_not_authorized', {
        cause: String(error?.message || error),
      });
    }
    throw error;
  }
  const committedRecord = readJson(
    recordPath,
    'partition_authority_record_commit_readback_failed'
  );
  try {
    const pointer = input.writeProjection
      ? input.writeProjection({
          record: committedRecord,
          committed,
          sourceIdentityProfile,
        })
      : writeRequirementRecordPartitionAuthorityProjection(
          committedRecord,
          recordPath,
          sourceIdentityProfile
        );
    return Object.freeze({ ...committed, pointer });
  } catch (error) {
    const paths = markRequirementRecordPartitionAuthorityProjectionBlocked(
      committedRecord,
      {
        failureClass: String(error?.message || 'projection_failed'),
      },
      sourceIdentityProfile
    );
    throw failure('partition_authority_pointer_projection_pending', {
      recordPath: normalizePath(recordPath),
      recordHash: committedRecord.recordHash,
      eventChainHead: committedRecord.eventChainHead,
      blockedMarkerPath: normalizePath(paths.blockedMarkerPath),
      cause: String(error?.message || error),
    });
  }
}

function readRequirementRecordPartitionAuthorityProjection(input) {
  const recordPath = path.resolve(input?.recordPath || '');
  const sourceIdentityProfile =
    input?.sourceIdentityProfile ?? 'standalone_frozen';
  const record = readJson(
    recordPath,
    'partition_authority_record_invalid'
  );
  const paths = pointerProjectionPaths(record, sourceIdentityProfile);
  if (fs.existsSync(paths.blockedMarkerPath)) {
    throw failure('partition_authority_pointer_projection_blocked', {
      blockedMarkerPath: normalizePath(paths.blockedMarkerPath),
    });
  }
  const pointer = readJson(
    paths.activePointerPath,
    'partition_authority_pointer_missing'
  );
  validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, pointer);
  const expected = requirementRecordPartitionPointer(
    record,
    recordPath,
    sourceIdentityProfile
  );
  if (stableControlPlaneStringify(pointer) !== stableControlPlaneStringify(expected)) {
    throw failure('partition_authority_pointer_stale');
  }
  return Object.freeze({
    ...pointer,
    pointerPath: paths.activePointerPath,
  });
}

function recoverRequirementRecordPartitionAuthorityProjection(input) {
  const recordPath = path.resolve(input?.recordPath || '');
  const sourceIdentityProfile =
    input?.sourceIdentityProfile ?? 'standalone_frozen';
  const record = readJson(
    recordPath,
    'partition_authority_record_invalid'
  );
  const pointer = writeRequirementRecordPartitionAuthorityProjection(
    record,
    recordPath,
    sourceIdentityProfile
  );
  return Object.freeze({
    ...pointer,
    pointerPath: pointer.pointerPath,
  });
}

module.exports = {
  commitRequirementRecordPartitionAuthoritySupersession,
  loadAuthoritySupersessionForRelease,
  prepareRequirementRecordPartitionAuthoritySupersession,
  prepareAuthoritySupersession,
  promoteAuthoritySupersessionAttempt,
  projectRequirementRecordPartitionAuthority,
  readRequirementRecordPartitionAuthorityProjection,
  recoverRequirementRecordPartitionAuthorityProjection,
  stageAuthoritySupersessionAttempt,
  verifyAuthoritySupersessionReceipt,
};
