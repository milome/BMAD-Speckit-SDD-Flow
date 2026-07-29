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
  const source = canonicalSourceProjection(
    canonicalBundle,
    authorityBundle
  );
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
  const rendererInput = {
    profile,
    slotData: built.slotData,
    validateHashes: true,
    coverageReceipt: {
      sourcePlanHash: source.sourcePlanHash,
      sourceObligations: built.registries.sourceObligations,
      unmappedSourceObligations: [],
    },
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
    registries: built.registries,
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
  createGoalContractCompilationReceipt,
  goalContractCompilerIdentity,
};
