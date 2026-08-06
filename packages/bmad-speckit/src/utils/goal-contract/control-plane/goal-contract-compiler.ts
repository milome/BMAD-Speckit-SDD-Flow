const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  verifyCanonicalIntentBundle,
} = require(
  __filename.endsWith('.ts')
    ? './canonical-intent-compiler.ts'
    : './canonical-intent-compiler'
);
const {
  verifyCompositeSourceAuthorityBundle,
} = require(
  __filename.endsWith('.ts')
    ? './composite-source-authority-bundle.ts'
    : './composite-source-authority-bundle'
);
const {
  hashControlPlaneValue,
  hashReceiptPayload,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  goalContractSchemaArtifactHash,
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);
const {
  verifySourceCompositionPolicy,
} = require(
  __filename.endsWith('.ts')
    ? './source-composition-policy.ts'
    : './source-composition-policy'
);
const {
  resolveSpecSpan,
} = require(
  __filename.endsWith('.ts')
    ? './spec-span-registry.ts'
    : './spec-span-registry'
);
const {
  buildSlotData,
} = require(
  __filename.endsWith('.ts')
    ? '../slot-data-builder.ts'
    : '../slot-data-builder'
);

export type GoalContractCompilerModule = never;

const COMPILATION_RECEIPT_SCHEMA =
  'goal-contract-compilation-receipt.schema.json';
const DETERMINISTIC_GENERATED_AT = '1970-01-01T00:00:00.000Z';
const EFFECTIVE_REVISION_TASK_AUTHORITY = Object.freeze({
  'GH-R01': ['GH-T01', 'GH-T02'],
  'GH-R02': ['GH-T03'],
  'GH-R03': ['GH-T04'],
  'GH-R04': ['GH-T05'],
  'GH-R05': ['GH-T05'],
  'GH-R06': ['GH-T09'],
  'GH-R07': ['GH-T06'],
  'GH-R08': ['GH-T07', 'GH-T08'],
  'GH-R09': ['GH-T08'],
  'GH-R10': ['GH-T08', 'GH-T10'],
  'GH-R11': ['GH-T10', 'GH-T11'],
  'ER-GH-001': ['GH-T05'],
  'ER-GH-002': ['GH-T09'],
  'ER-GH-003': ['GH-T06', 'GH-T07'],
  'ER-GH-004': ['GH-T08'],
});
const ALLOWED_REQUEST_FIELDS = new Set([
  'sourceCompositionPolicy',
  'compositeSourceAuthorityBundle',
  'canonicalIntentBundle',
  'subordinateCoverageReceipts',
  'compilePolicy',
  'compilerIdentity',
  'contractProfileBytes',
  'templateBytes',
]);
const MAIN_AGENT_ALLOWED_REQUEST_FIELDS = new Set([
  'profile',
  'canonicalIntentBundle',
  'mainAgentAuthorityBindings',
  'implementationView',
  'acceptanceEvidenceView',
  'reconciledViews',
  'compilerIdentity',
]);
const MAIN_AGENT_AUTHORITY_BINDING_FIELDS = Object.freeze([
  'currentDispatchPointerHash',
  'transactionManifestHash',
  'requirementRecordId',
  'requirementRecordHash',
  'requirementRecordRevision',
  'requirementRecordEventChainHead',
  'activeBundleRevision',
  'activeBundleHash',
  'semanticIRHash',
  'semanticConservationManifestHash',
  'sourceAuthorityHash',
  'sourceSnapshotHash',
  'sourceRootToSpecSpanMappingHash',
  'modelPacketHash',
  'modelPacketParityReceiptHash',
  'goalExecutionHash',
]);
const MAIN_AGENT_HASH_BINDING_FIELDS = new Set(
  MAIN_AGENT_AUTHORITY_BINDING_FIELDS.filter(
    (field) => field.endsWith('Hash') || field.endsWith('Head')
  )
);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function requireSha256(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw failure('main_agent_goal_authority_binding_invalid', { field });
  }
  return value;
}

function normalizedBytes(value, field) {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw failure('goal_contract_compile_request_invalid', { field });
}

function normalizePathValue(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('goal_contract_compile_policy_invalid', { field });
  }
  return value.replace(/\\/gu, '/');
}

function compilePolicyPayload(policy) {
  const payload = { ...policy };
  delete payload.compilePolicyHash;
  return payload;
}

function verifyGoalContractPolicy(policy) {
  if (
    !isRecord(policy) ||
    policy.schemaVersion !== 'goal-contract-compile-policy/v1' ||
    hashControlPlaneValue(compilePolicyPayload(policy)) !==
      policy.compilePolicyHash
  ) {
    throw failure('goal_contract_compile_policy_invalid');
  }
  if (
    policy.entryScenario !== 'standalone_goal_contract' ||
    policy.generationMode !== 'source_plan_strict' ||
    policy.deterministicGeneratedAt !== DETERMINISTIC_GENERATED_AT
  ) {
    throw failure('goal_contract_compile_policy_invalid');
  }
  return policy;
}

function compileGoalContractPolicy(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('goal_contract_compile_policy_invalid');
  }
  const allowed = new Set([
    'entryScenario',
    'generationMode',
    'sourcePlanPath',
    'outPath',
    'coverageReceiptPath',
    'generationReceiptPath',
    'profileBytesHash',
    'templateBytesHash',
  ]);
  const unknown = Object.keys(request).filter(
    (field) => !allowed.has(field)
  );
  if (unknown.length > 0) {
    throw failure('goal_contract_compile_policy_invalid', {
      unknownFields: unknown.sort(),
    });
  }
  const partial = {
    schemaVersion: 'goal-contract-compile-policy/v1',
    entryScenario: request.entryScenario,
    generationMode: request.generationMode,
    sourcePlanPath: normalizePathValue(
      request.sourcePlanPath,
      'sourcePlanPath'
    ),
    outPath: normalizePathValue(request.outPath, 'outPath'),
    coverageReceiptPath: normalizePathValue(
      request.coverageReceiptPath,
      'coverageReceiptPath'
    ),
    generationReceiptPath: normalizePathValue(
      request.generationReceiptPath,
      'generationReceiptPath'
    ),
    profileBytesHash: request.profileBytesHash,
    templateBytesHash: request.templateBytesHash,
    deterministicGeneratedAt: DETERMINISTIC_GENERATED_AT,
  };
  for (const field of ['profileBytesHash', 'templateBytesHash']) {
    if (!/^sha256:[0-9a-f]{64}$/u.test(partial[field])) {
      throw failure('goal_contract_compile_policy_invalid', { field });
    }
  }
  return verifyGoalContractPolicy({
    ...partial,
    compilePolicyHash: hashControlPlaneValue(partial),
  });
}

function compilerIdentityPayload(identity) {
  const payload = { ...identity };
  delete payload.compilerIdentityHash;
  return payload;
}

function goalContractCompilerIdentity() {
  const partial = {
    compilerVersion: 'goal-contract-compiler/v1',
    schemaArtifactHashes: [
      {
        schemaName: COMPILATION_RECEIPT_SCHEMA,
        schemaArtifactHash: goalContractSchemaArtifactHash(
          COMPILATION_RECEIPT_SCHEMA
        ),
      },
    ],
  };
  return {
    ...partial,
    compilerIdentityHash: hashControlPlaneValue(partial),
  };
}

function verifyCompilerIdentity(identity) {
  if (
    !isRecord(identity) ||
    hashControlPlaneValue(compilerIdentityPayload(identity)) !==
      identity.compilerIdentityHash
  ) {
    throw failure('goal_contract_compiler_identity_invalid');
  }
  const current = goalContractCompilerIdentity();
  if (
    hashControlPlaneValue(identity.schemaArtifactHashes) !==
      hashControlPlaneValue(current.schemaArtifactHashes) ||
    identity.compilerVersion !== current.compilerVersion
  ) {
    throw failure('goal_contract_compiler_identity_stale');
  }
  return identity;
}

function rendererModule() {
  const candidates = [
    path.resolve(
      __dirname,
      '../../../../../../_bmad/shared/goal-contract/scripts/render-goal-contract.js'
    ),
    path.resolve(
      __dirname,
      '../../../../_bmad/shared/goal-contract/scripts/render-goal-contract.js'
    ),
  ];
  const rendererPath = candidates.find((candidate) =>
    fs.existsSync(candidate)
  );
  if (!rendererPath) throw failure('goal_contract_renderer_missing');
  return require(rendererPath);
}

function exactCoverageSet(bundle) {
  const subordinateCoverage = bundle.subordinateCoverage;
  if (
    subordinateCoverage?.schemaVersion ===
    'goal-contract-subordinate-source-coverage-receipt-set/v1'
  ) {
    return subordinateCoverage.receipts;
  }
  return subordinateCoverage ? [subordinateCoverage] : [];
}

function assertCoverageReceipts(bundle, receipts) {
  if (!Array.isArray(receipts)) {
    throw failure('subordinate_coverage_incomplete');
  }
  if (
    hashControlPlaneValue(receipts) !==
    hashControlPlaneValue(exactCoverageSet(bundle))
  ) {
    throw failure('subordinate_coverage_incomplete');
  }
}

function sourceDescriptor(bundle, record) {
  return [
    bundle.primarySource,
    ...bundle.subordinateSources,
  ].find(
    ({ sourceArtifactId }) =>
      sourceArtifactId === record.sourceArtifactId
  );
}

function canonicalSourceProjection(canonicalBundle, authorityBundle) {
  const registry = canonicalBundle.specSpanRegistry;
  const rows = canonicalBundle.canonicalIntentIR
    .map((record) => {
      if (!Array.isArray(record.specSpanRefs) || record.specSpanRefs.length === 0) {
        throw failure('source_specific_spec_span_missing', {
          intentRecordId: record.intentRecordId,
        });
      }
      const citations = record.specSpanRefs.map((specSpanId) =>
        resolveSpecSpan({ registry, specSpanId })
      );
      const descriptor = sourceDescriptor(authorityBundle, record);
      if (
        !descriptor ||
        citations.some(
          (citation) =>
            citation.sourceArtifactId !== record.sourceArtifactId ||
            citation.namespace !== record.namespace
        )
      ) {
        throw failure('source_specific_spec_span_missing', {
          intentRecordId: record.intentRecordId,
        });
      }
      const firstCitation = citations[0];
      const sourceSnapshot = registry.sourceSnapshots.find(
        ({ sourceArtifactId }) =>
          sourceArtifactId === record.sourceArtifactId
      );
      return {
        record,
        descriptor,
        citations,
        sourceSnapshot,
        firstCitation,
      };
    })
    .sort(
      (left, right) =>
        left.record.sourceOrder - right.record.sourceOrder ||
        left.firstCitation.startByte - right.firstCitation.startByte ||
        left.record.intentRecordId.localeCompare(
          right.record.intentRecordId,
          'en'
        )
    );
  const sourceObligations = rows.map(
    (
      { record, descriptor, citations, sourceSnapshot, firstCitation },
      index
    ) => ({
      id: `SRC${String(index + 1).padStart(3, '0')}`,
      kind: record.sourceKind,
      text: firstCitation.exactText,
      summary: record.requiredOutcome,
      headingPath:
        registry.specSpans.find(
          ({ specSpanId }) => specSpanId === record.specSpanRefs[0]
        )?.headingPath || [],
      sourcePlanPath: sourceSnapshot.pathOrSegmentId,
      sourcePlanHash: record.sourceSnapshotHash,
      lineStart:
        registry.specSpans.find(
          ({ specSpanId }) => specSpanId === record.specSpanRefs[0]
        )?.startLine || 1,
      lineEnd:
        registry.specSpans.find(
          ({ specSpanId }) => specSpanId === record.specSpanRefs[0]
        )?.endLine || 1,
      textHash: firstCitation.exactTextHash,
      canonicalIntentRecordId: record.intentRecordId,
      declaredSourceId: record.declaredSourceId,
      classification: record.classification,
      ownership: record.ownership,
      sourceArtifactId: record.sourceArtifactId,
      sourceSnapshotHash: record.sourceSnapshotHash,
      sourceRole: record.sourceRole,
      namespace: record.namespace,
      specSpanRefs: [...record.specSpanRefs],
      parentTaskRefs:
        descriptor.role === 'subordinate_component_specification'
          ? [...descriptor.parentTaskRefs]
          : [],
      dependencyRefs: [...record.dependencyRefs],
      resolvedCitations: citations,
    })
  );
  const primarySnapshot = registry.sourceSnapshots.find(
    ({ sourceArtifactId }) =>
      sourceArtifactId === authorityBundle.primarySource.sourceArtifactId
  );
  return {
    sourcePlanPath: primarySnapshot.pathOrSegmentId,
    sourcePlanHash: primarySnapshot.sourceSnapshotHash,
    sourceBytes: primarySnapshot.sourceBytes,
    sourceLines: primarySnapshot.sourceLines,
    sourceObligations,
  };
}

function normalizeGoalContractSourceCoverageMappings(
  sourceObligations: unknown
) {
  if (!Array.isArray(sourceObligations)) {
    throw failure('source_coverage_unmapped', {
      field: 'sourceObligations',
    });
  }
  return sourceObligations.map((obligation) => {
    if (!isRecord(obligation) || typeof obligation.id !== 'string') {
      throw failure('source_coverage_unmapped', {
        field: 'sourceObligations',
      });
    }
    const existing = Array.isArray(obligation.stopConditionRefs)
      ? obligation.stopConditionRefs.filter(
          (value) => typeof value === 'string' && value.length > 0
        )
      : [];
    return {
      ...obligation,
      goalTaskRefs:
        EFFECTIVE_REVISION_TASK_AUTHORITY[obligation.id] ||
        obligation.goalTaskRefs,
      stopConditionRefs:
        existing.length > 0 ? [...new Set(existing)].sort() : ['STOP002'],
    };
  });
}

function buildGoalContractSourceCoverageMatrix(sourceObligations) {
  return [
    '| Source ID | Intent Record | Declared ID | Source Artifact | Namespace | SpecSpan Refs | Parent Tasks | Goal Tasks | Acceptance | Commands | Evidence | Stop Conditions |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...sourceObligations.map(
      (obligation) =>
        `| ${obligation.id} | ${
          obligation.canonicalIntentRecordId || 'none'
        } | ${obligation.declaredSourceId || 'none'} | ${
          obligation.sourceArtifactId
        } | ${obligation.namespace} | ${(
          obligation.specSpanRefs || []
        ).join(', ')} | ${(obligation.parentTaskRefs || []).join(', ') || 'none'} | ${(
          obligation.goalTaskRefs || []
        ).join(', ')} | ${(obligation.acceptanceRefs || []).join(', ')} | ${(
          obligation.commandRefs || []
        ).join(', ')} | ${(obligation.evidenceRefs || []).join(', ')} | ${(
          obligation.stopConditionRefs || []
        ).join(', ')} |`
    ),
  ].join('\n');
}

function createGoalContractSourceCoverageReceipt(request: unknown) {
  if (
    !isRecord(request) ||
    typeof request.sourcePlanHash !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/u.test(request.sourcePlanHash) ||
    !Array.isArray(request.sourceObligations) ||
    !isRecord(request.coverageAudit)
  ) {
    throw failure('source_coverage_unmapped');
  }
  const requiredFields = [
    'goalTaskRefs',
    'acceptanceRefs',
    'commandRefs',
    'evidenceRefs',
    'stopConditionRefs',
  ];
  for (const obligation of request.sourceObligations) {
    if (!isRecord(obligation) || typeof obligation.id !== 'string') {
      throw failure('source_coverage_unmapped', {
        field: 'sourceObligations',
      });
    }
    for (const field of requiredFields) {
      if (
        !Array.isArray(obligation[field]) ||
        obligation[field].length === 0
      ) {
        throw failure('source_coverage_unmapped', {
          sourceObligationId: obligation.id,
          field,
        });
      }
    }
  }
  const unmappedSourceObligations = Array.isArray(
    request.coverageAudit.unmappedSourceObligations
  )
    ? [...request.coverageAudit.unmappedSourceObligations]
    : [];
  if (
    request.coverageAudit.decision !== 'pass' ||
    unmappedSourceObligations.length > 0
  ) {
    throw failure('source_coverage_unmapped', {
      coverageAudit: request.coverageAudit,
    });
  }
  return Object.freeze({
    sourcePlanHash: request.sourcePlanHash,
    sourceObligations: request.sourceObligations,
    unmappedSourceObligations,
  });
}

function verifyGoalContractGeneratorHardeningProvenance(request: unknown) {
  if (
    !isRecord(request) ||
    !isRecord(request.provenance) ||
    typeof request.repositoryRoot !== 'string' ||
    typeof request.baselineCommit !== 'string'
  ) {
    throw failure('predecessor_provenance_mismatch');
  }
  const provenance = request.provenance;
  if (
    provenance.schemaVersion !==
      'goal-contract-generator-hardening-provenance/v1' ||
    provenance.baselineCommit !== request.baselineCommit ||
    !isRecord(provenance.successorSource) ||
    !isRecord(provenance.successorGoalContract) ||
    !Array.isArray(provenance.predecessorInputs) ||
    !isRecord(provenance.judgeBoundary) ||
    !Array.isArray(provenance.judgeBoundary.runtimeActionBindings)
  ) {
    throw failure('predecessor_provenance_mismatch');
  }
  const repositoryRoot = path.resolve(request.repositoryRoot);
  const bindings = [
    provenance.successorSource,
    provenance.successorGoalContract,
    ...provenance.predecessorInputs,
    ...provenance.judgeBoundary.runtimeActionBindings,
  ];
  for (const binding of bindings) {
    if (
      !isRecord(binding) ||
      typeof binding.path !== 'string' ||
      typeof binding.hash !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/u.test(binding.hash)
    ) {
      throw failure('predecessor_provenance_mismatch', {
        path: isRecord(binding) ? binding.path : null,
      });
    }
    const resolvedPath = path.resolve(repositoryRoot, binding.path);
    if (
      path.isAbsolute(binding.path) ||
      (resolvedPath !== repositoryRoot &&
        !resolvedPath.startsWith(`${repositoryRoot}${path.sep}`)) ||
      !fs.existsSync(resolvedPath)
    ) {
      throw failure('predecessor_provenance_mismatch', {
        path: binding.path,
      });
    }
    const actualHash = sha256(fs.readFileSync(resolvedPath));
    if (actualHash !== binding.hash) {
      throw failure('predecessor_provenance_mismatch', {
        path: binding.path,
        expectedHash: binding.hash,
        actualHash,
      });
    }
  }
  return Object.freeze({
    decision: 'pass',
    baselineCommit: provenance.baselineCommit,
    verifiedBindingCount: bindings.length,
  });
}

function coverageRecords(policy, authorityBundle, canonicalBundle) {
  const records = canonicalBundle.canonicalIntentIR;
  const primaryRecords = records.filter(
    ({ sourceArtifactId, ownership }) =>
      sourceArtifactId === authorityBundle.primarySource.sourceArtifactId &&
      ownership === 'owned_obligation'
  );
  const primarySourceCoverage = {
    sourceArtifactId: authorityBundle.primarySource.sourceArtifactId,
    sourceSnapshotHash: authorityBundle.primarySource.sourceSnapshotHash,
    discoveredIds: primaryRecords.map(
      ({ declaredSourceId, intentRecordId }) =>
        declaredSourceId || intentRecordId
    ),
    mappedIds: primaryRecords.map(
      ({ declaredSourceId, intentRecordId }) =>
        declaredSourceId || intentRecordId
    ),
    missingIds: [],
    duplicateIds: [],
    unmappedIds: [],
    scopeEscapeIds: [],
  };
  const subordinateSourceCoverageReceipts =
    policy.requiredSubordinateBindings.map((binding) => {
      const descriptor = authorityBundle.subordinateSources.find(
        ({ sourceArtifactId }) =>
          sourceArtifactId === binding.sourceArtifactId
      );
      if (!descriptor) throw failure('subordinate_source_missing');
      const sourceRecords = records.filter(
        ({ sourceArtifactId, ownership }) =>
          sourceArtifactId === binding.sourceArtifactId &&
          ownership === 'owned_obligation'
      );
      const discoveredIds = sourceRecords.map(
        ({ declaredSourceId, intentRecordId }) =>
          declaredSourceId || intentRecordId
      );
      const duplicateIds = discoveredIds.filter(
        (id, index, values) => values.indexOf(id) !== index
      );
      const requiredIds = [
        ...binding.requiredRequirementIds,
        ...binding.requiredTaskIds,
      ];
      const missingIds = requiredIds.filter(
        (id) => !discoveredIds.includes(id)
      );
      const scopeEscapeIds = sourceRecords
        .filter(
          (record) =>
            record.namespace !== binding.namespace ||
            descriptor.parentTaskRefs.length !== 1 ||
            record.specSpanRefs.length === 0
        )
        .map(
          ({ declaredSourceId, intentRecordId }) =>
            declaredSourceId || intentRecordId
        );
      const mappedIds = discoveredIds.filter(
        (id) => !scopeEscapeIds.includes(id)
      );
      const unmappedIds = discoveredIds.filter(
        (id) => !mappedIds.includes(id)
      );
      if (
        missingIds.length > 0 ||
        duplicateIds.length > 0 ||
        unmappedIds.length > 0 ||
        scopeEscapeIds.length > 0
      ) {
        throw failure(
          scopeEscapeIds.length > 0
            ? 'subordinate_scope_escape'
            : 'subordinate_coverage_incomplete',
          {
            sourceArtifactId: binding.sourceArtifactId,
            missingIds,
            duplicateIds,
            unmappedIds,
            scopeEscapeIds,
          }
        );
      }
      const payload = {
        schemaVersion:
          'goal-contract-compiler-subordinate-coverage-receipt/v1',
        sourceArtifactId: binding.sourceArtifactId,
        sourceSnapshotHash: descriptor.sourceSnapshotHash,
        sourceAuthorityBundleHash:
          authorityBundle.sourceAuthorityBundleHash,
        namespace: binding.namespace,
        declaredParentTaskRefs: binding.parentTaskRefs,
        requiredRequirementIds: binding.requiredRequirementIds,
        requiredTaskIds: binding.requiredTaskIds,
        discoveredIds,
        mappedIds,
        missingIds,
        duplicateIds,
        unmappedIds,
        scopeEscapeIds,
        specSpanRefs: [
          ...new Set(
            sourceRecords.flatMap(({ specSpanRefs }) => specSpanRefs)
          ),
        ].sort(),
      };
      return {
        ...payload,
        receiptHash: hashControlPlaneValue(payload),
      };
    });
  return {
    primarySourceCoverage,
    subordinateSourceCoverageReceipts,
  };
}

function semanticModelRecords(canonicalBundle) {
  return canonicalBundle.canonicalIntentIR.map((obligation) =>
    Object.fromEntries(
      Object.entries({
        intentRecordId: obligation.intentRecordId,
        declaredSourceId: obligation.declaredSourceId,
        classification: obligation.classification,
        ownership: obligation.ownership,
        sourceArtifactId: obligation.sourceArtifactId,
        sourceSnapshotHash: obligation.sourceSnapshotHash,
        sourceRole: obligation.sourceRole,
        namespace: obligation.namespace,
        specSpanRefs: obligation.specSpanRefs,
        parentTaskRefs: obligation.parentTaskRefs,
        dependencyRefs: obligation.dependencyRefs,
      }).filter(([, value]) => value !== undefined)
    )
  );
}

function canonicalSubordinateCoverageReceipts(canonicalBundle) {
  const coverage = canonicalBundle.subordinateCoverage;
  if (
    coverage?.schemaVersion ===
    'goal-contract-subordinate-source-coverage-receipt-set/v1'
  ) {
    return structuredClone(coverage.receipts);
  }
  return coverage?.receiptHash ? [structuredClone(coverage)] : [];
}

function verifyMainAgentAuthorityBindings(value) {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (field) => !MAIN_AGENT_AUTHORITY_BINDING_FIELDS.includes(field)
    ) ||
    MAIN_AGENT_AUTHORITY_BINDING_FIELDS.some(
      (field) => value[field] === undefined
    )
  ) {
    throw failure('main_agent_goal_authority_binding_invalid');
  }
  for (const field of MAIN_AGENT_HASH_BINDING_FIELDS) {
    requireSha256(value[field], field);
  }
  if (
    typeof value.requirementRecordId !== 'string' ||
    value.requirementRecordId.length === 0 ||
    !(
      (Number.isInteger(value.requirementRecordRevision) &&
        value.requirementRecordRevision >= 0) ||
      (typeof value.requirementRecordRevision === 'string' &&
        value.requirementRecordRevision.length > 0)
    ) ||
    !(
      (Number.isInteger(value.activeBundleRevision) &&
        value.activeBundleRevision >= 0) ||
      (typeof value.activeBundleRevision === 'string' &&
        value.activeBundleRevision.length > 0)
    )
  ) {
    throw failure('main_agent_goal_authority_binding_invalid');
  }
  return structuredClone(value);
}

function compileMainAgentGoalAuthorityBundle(request: unknown = {}) {
  if (
    !isRecord(request) ||
    request.profile !== 'main_agent_compiled'
  ) {
    throw failure('main_agent_goal_authority_request_invalid');
  }
  const unknown = Object.keys(request).filter(
    (field) => !MAIN_AGENT_ALLOWED_REQUEST_FIELDS.has(field)
  );
  if (unknown.length > 0) {
    throw failure('goal_contract_authority_injection', {
      forbiddenFields: unknown.sort(),
    });
  }
  const canonicalBundle = verifyCanonicalIntentBundle(
    request.canonicalIntentBundle
  );
  if (
    canonicalBundle.authorityState !== 'authoritative' ||
    !canonicalBundle.authorityAttestationHash
  ) {
    throw failure('goal_contract_authority_missing');
  }
  const compilerIdentity = verifyCompilerIdentity(
    request.compilerIdentity ?? goalContractCompilerIdentity()
  );
  const authorityBindings = verifyMainAgentAuthorityBindings(
    request.mainAgentAuthorityBindings
  );
  for (const field of [
    'implementationView',
    'acceptanceEvidenceView',
    'reconciledViews',
  ]) {
    if (!isRecord(request[field])) {
      throw failure('main_agent_goal_authority_request_invalid', { field });
    }
  }
  const implementationView = structuredClone(request.implementationView);
  const acceptanceEvidenceView = structuredClone(
    request.acceptanceEvidenceView
  );
  const reconciledViews = structuredClone(request.reconciledViews);
  const mainAgentProfileBindings = {
    ...authorityBindings,
    specSpanRegistryHash:
      canonicalBundle.specSpanRegistry.specSpanRegistryHash,
    implementationViewHash: hashControlPlaneValue(implementationView),
    acceptanceEvidenceViewHash: hashControlPlaneValue(
      acceptanceEvidenceView
    ),
    reconciliationReceiptHash: hashControlPlaneValue(reconciledViews),
  };
  const mainAgentProfileBindingsHash = hashControlPlaneValue(
    mainAgentProfileBindings
  );
  const subordinateSourceCoverageReceipts =
    canonicalSubordinateCoverageReceipts(canonicalBundle);
  const goalContractSemanticModel = {
    schemaVersion: 'goal-contract-semantic-model/v1',
    authorityProfile: 'main_agent_compiled',
    records: semanticModelRecords(canonicalBundle),
    implementationView,
    acceptanceEvidenceView,
    reconciledViews,
  };
  const goalContractSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-semantics/v2',
    authorityProfile: 'main_agent_compiled',
    canonicalIntentSemanticHash:
      canonicalBundle.canonicalIntentSemanticHash,
    goalContractSemanticModel,
    mainAgentProfileBindingsHash,
  });
  const goalContractHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-authority/v2',
    authorityProfile: 'main_agent_compiled',
    goalContractSemanticHash,
    authorityAttestationHash:
      canonicalBundle.authorityAttestationHash,
    sourceCompositionPolicyHash:
      canonicalBundle.sourceCompositionPolicyHash,
    mainAgentProfileBindingsHash,
    compilerIdentityHash: compilerIdentity.compilerIdentityHash,
  });
  const bundleCore = {
    schemaVersion: 'goal-contract-bundle/v1',
    authorityProfile: 'main_agent_compiled',
    sourceCompositionPolicyHash:
      canonicalBundle.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      canonicalBundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      canonicalBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      canonicalBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      canonicalBundle.canonicalIntentBundleHash,
    authorityAttestationHash:
      canonicalBundle.authorityAttestationHash,
    compilerIdentity,
    compilerIdentityHash: compilerIdentity.compilerIdentityHash,
    goalContractSemanticModel,
    goalContractSemanticHash,
    mainAgentProfileBindings,
    mainAgentProfileBindingsHash,
    implementationView,
    acceptanceEvidenceView,
    reconciledViews,
    goalContractHash,
    goalProjectionHash: mainAgentProfileBindings.goalExecutionHash,
    markdownHash: mainAgentProfileBindings.goalExecutionHash,
    subordinateSourceCoverageReceipts,
  };
  const goalContractBundleHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-bundle-authority/v1',
    ...bundleCore,
  });
  const sourceReceiptPayload = {
    schemaVersion:
      'main-agent-goal-source-authority-compilation-receipt/v1',
    authorityProfile: 'main_agent_compiled',
    goalContractBundleHash,
    goalContractSemanticHash,
    goalContractHash,
    mainAgentProfileBindingsHash,
    sourceAuthorityHash: mainAgentProfileBindings.sourceAuthorityHash,
    sourceSnapshotHash: mainAgentProfileBindings.sourceSnapshotHash,
    specSpanRegistryHash: mainAgentProfileBindings.specSpanRegistryHash,
    sourceRootToSpecSpanMappingHash:
      mainAgentProfileBindings.sourceRootToSpecSpanMappingHash,
    implementationViewHash:
      mainAgentProfileBindings.implementationViewHash,
    acceptanceEvidenceViewHash:
      mainAgentProfileBindings.acceptanceEvidenceViewHash,
    reconciliationReceiptHash:
      mainAgentProfileBindings.reconciliationReceiptHash,
  };
  return Object.freeze({
    ...bundleCore,
    goalContractBundleHash,
    sourceAuthorityCompilationReceipt: Object.freeze({
      ...sourceReceiptPayload,
      receiptHash: hashReceiptPayload(sourceReceiptPayload),
    }),
  });
}

function compileGoalContract(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('goal_contract_compile_request_invalid');
  }
  const unknown = Object.keys(request).filter(
    (field) => !ALLOWED_REQUEST_FIELDS.has(field)
  );
  if (unknown.length > 0) {
    throw failure('goal_contract_authority_injection', {
      forbiddenFields: unknown.sort(),
    });
  }
  const policy = verifySourceCompositionPolicy(
    request.sourceCompositionPolicy
  );
  const authorityBundle = verifyCompositeSourceAuthorityBundle(
    request.compositeSourceAuthorityBundle
  );
  const canonicalBundle = verifyCanonicalIntentBundle(
    request.canonicalIntentBundle
  );
  const compilePolicy = verifyGoalContractPolicy(request.compilePolicy);
  const compilerIdentity = verifyCompilerIdentity(
    request.compilerIdentity
  );
  if (
    canonicalBundle.authorityState !== 'authoritative' ||
    !canonicalBundle.authorityAttestationHash
  ) {
    throw failure('goal_contract_authority_missing');
  }
  if (
    policy.sourceCompositionPolicyHash !==
      authorityBundle.sourceCompositionPolicyHash ||
    policy.sourceCompositionPolicyHash !==
      canonicalBundle.sourceCompositionPolicyHash ||
    authorityBundle.sourceAuthorityBundleHash !==
      canonicalBundle.sourceAuthorityBundleHash ||
    authorityBundle.orderedSourceSnapshotSetHash !==
      canonicalBundle.orderedSourceSnapshotSetHash
  ) {
    throw failure('goal_contract_authority_mismatch');
  }
  assertCoverageReceipts(
    authorityBundle,
    request.subordinateCoverageReceipts
  );
  const profileBytes = normalizedBytes(
    request.contractProfileBytes,
    'contractProfileBytes'
  );
  const templateBytes = normalizedBytes(
    request.templateBytes,
    'templateBytes'
  );
  if (sha256(profileBytes) !== compilePolicy.profileBytesHash) {
    throw failure('profile_bytes_stale');
  }
  if (sha256(templateBytes) !== compilePolicy.templateBytesHash) {
    throw failure('template_bytes_stale');
  }
  let profile;
  try {
    profile = JSON.parse(profileBytes.toString('utf8'));
  } catch (error) {
    throw failure('profile_bytes_invalid', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const coverage = coverageRecords(
    policy,
    authorityBundle,
    canonicalBundle
  );
  const sourceProjection = canonicalSourceProjection(
    canonicalBundle,
    authorityBundle
  );
  const source = {
    ...sourceProjection,
    sourceObligations: normalizeGoalContractSourceCoverageMappings(
      sourceProjection.sourceObligations
    ),
  };
  const goalContractSemanticModel = {
    schemaVersion: 'goal-contract-semantic-model/v1',
    sources: [
      authorityBundle.primarySource,
      ...authorityBundle.subordinateSources,
    ],
    records: source.sourceObligations.map((obligation) => ({
      intentRecordId: obligation.canonicalIntentRecordId,
      declaredSourceId: obligation.declaredSourceId,
      classification: obligation.classification,
      ownership: obligation.ownership,
      sourceArtifactId: obligation.sourceArtifactId,
      sourceSnapshotHash: obligation.sourceSnapshotHash,
      sourceRole: obligation.sourceRole,
      namespace: obligation.namespace,
      specSpanRefs: obligation.specSpanRefs,
      parentTaskRefs: obligation.parentTaskRefs,
      dependencyRefs: obligation.dependencyRefs,
    })),
    primarySourceCoverage: coverage.primarySourceCoverage,
    subordinateSourceCoverageReceipts:
      coverage.subordinateSourceCoverageReceipts,
  };
  const goalContractSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-semantics/v1',
    canonicalIntentSemanticHash:
      canonicalBundle.canonicalIntentSemanticHash,
    compilePolicyHash: compilePolicy.compilePolicyHash,
    goalContractSemanticModel,
  });
  const goalContractHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-authority/v1',
    goalContractSemanticHash,
    authorityAttestationHash:
      canonicalBundle.authorityAttestationHash,
    sourceCompositionPolicyHash:
      policy.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      authorityBundle.sourceAuthorityBundleHash,
    compilerIdentityHash: compilerIdentity.compilerIdentityHash,
  });
  const runtimeRecordId = `GOAL-CONTRACT-${goalContractHash.slice(7)}`;
  const authorityBindings = {
    sourceCompositionPolicyHash:
      policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      canonicalBundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      authorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      canonicalBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      canonicalBundle.canonicalIntentBundleHash,
    authorityAttestationHash:
      canonicalBundle.authorityAttestationHash,
    goalContractSemanticHash,
    goalContractHash,
  };
  const built = buildSlotData({
    source,
    profile,
    outPath: compilePolicy.outPath,
    coverageReceiptPath: compilePolicy.coverageReceiptPath,
    generationReceiptPath: compilePolicy.generationReceiptPath,
    generatedAt: compilePolicy.deterministicGeneratedAt,
    runtimeRecordId,
    authorityBindings,
  });
  const mappedSourceObligations =
    normalizeGoalContractSourceCoverageMappings(
      built.registries.sourceObligations
    );
  const sourceCoverageReceipt = createGoalContractSourceCoverageReceipt({
    sourcePlanHash: source.sourcePlanHash,
    sourceObligations: mappedSourceObligations,
    coverageAudit: built.coverageAudit,
  });
  const rendererInput = {
    profile,
    slotData: {
      ...built.slotData,
      sourceCoverageMatrix: buildGoalContractSourceCoverageMatrix(
        mappedSourceObligations
      ),
    },
    validateHashes: true,
    coverageReceipt: sourceCoverageReceipt,
    generationMode: compilePolicy.generationMode,
  };
  const rendered = rendererModule().renderGoalContract({
    templateText: templateBytes.toString('utf8'),
    ...rendererInput,
  });
  const markdown = rendered.document;
  const result = {
    schemaVersion: 'goal-contract-bundle/v1',
    sourceCompositionPolicyHash:
      policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      canonicalBundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      authorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      canonicalBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      canonicalBundle.canonicalIntentBundleHash,
    authorityAttestationHash:
      canonicalBundle.authorityAttestationHash,
    compilePolicyHash: compilePolicy.compilePolicyHash,
    compilerIdentityHash: compilerIdentity.compilerIdentityHash,
    profileBytesHash: compilePolicy.profileBytesHash,
    templateBytesHash: compilePolicy.templateBytesHash,
    goalContractSemanticModel,
    goalContractSemanticHash,
    goalContractHash,
    runtimeRecordId,
    deterministicRendererInput: rendererInput,
    deterministicRendererInputHash:
      hashControlPlaneValue(rendererInput),
    markdown,
    markdownHash: sha256(Buffer.from(markdown, 'utf8')),
    primarySourceCoverage: coverage.primarySourceCoverage,
    subordinateSourceCoverageReceipts:
      coverage.subordinateSourceCoverageReceipts,
    boundaryObligations: canonicalBundle.canonicalIntentIR
      .filter(({ classification }) => classification === 'boundary')
      .map(({ intentRecordId }) => intentRecordId),
    evidenceObligations: canonicalBundle.canonicalIntentIR
      .filter(({ classification }) => classification === 'evidence')
      .map(({ intentRecordId }) => intentRecordId),
    sourceSpecificSpecSpanRefs: [
      ...new Set(
        canonicalBundle.canonicalIntentIR.flatMap(
          ({ specSpanRefs }) => specSpanRefs
        )
      ),
    ].sort(),
    registries: {
      ...built.registries,
      sourceObligations: mappedSourceObligations,
    },
    sourceCoverageAudit: built.coverageAudit,
    implementationProofAudit: built.implementationProofAudit,
    rendererAudit: rendered.audit,
  };
  return Object.freeze(result);
}

function createGoalContractCompilationReceipt(
  bundle: unknown,
  request: unknown = {}
) {
  if (
    !isRecord(bundle) ||
    !isRecord(request) ||
    bundle.schemaVersion !== 'goal-contract-bundle/v1' ||
    typeof request.compiledAt !== 'string'
  ) {
    throw failure('goal_contract_compilation_receipt_invalid');
  }
  const compilationBundle = bundle as {
    goalContractSemanticHash: string;
    goalContractHash: string;
    markdownHash: string;
    sourceCompositionPolicyHash: string;
    orderedSourceSnapshotSetHash: string;
    sourceAuthorityBundleHash: string;
    canonicalIntentSemanticHash: string;
    canonicalIntentBundleHash: string;
    authorityAttestationHash: string;
    subordinateSourceCoverageReceipts: Array<{ receiptHash: string }>;
    compilePolicyHash: string;
    compilerIdentityHash: string;
    profileBytesHash: string;
    templateBytesHash: string;
    runtimeRecordId: string;
  };
  const payload = {
    schemaVersion: 'goal-contract-compilation-receipt/v1',
    goalContractSemanticHash: compilationBundle.goalContractSemanticHash,
    goalContractHash: compilationBundle.goalContractHash,
    goalContractDocumentHash: compilationBundle.markdownHash,
    sourceCompositionPolicyHash:
      compilationBundle.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      compilationBundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      compilationBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      compilationBundle.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      compilationBundle.canonicalIntentBundleHash,
    authorityAttestationHash:
      compilationBundle.authorityAttestationHash,
    subordinateCoverageReceiptHashes:
      compilationBundle.subordinateSourceCoverageReceipts.map(
        ({ receiptHash }) => receiptHash
      ),
    compilePolicyHash: compilationBundle.compilePolicyHash,
    compilerIdentityHash: compilationBundle.compilerIdentityHash,
    profileBytesHash: compilationBundle.profileBytesHash,
    templateBytesHash: compilationBundle.templateBytesHash,
    runtimeRecordId: compilationBundle.runtimeRecordId,
    compiledAt: request.compiledAt,
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  validateGoalContractSchema(COMPILATION_RECEIPT_SCHEMA, receipt);
  return Object.freeze(receipt);
}

module.exports = {
  compileGoalContract,
  compileGoalContractPolicy,
  compileMainAgentGoalAuthorityBundle,
  createGoalContractSourceCoverageReceipt,
  createGoalContractCompilationReceipt,
  goalContractCompilerIdentity,
  normalizeGoalContractSourceCoverageMappings,
  verifyGoalContractGeneratorHardeningProvenance,
};
