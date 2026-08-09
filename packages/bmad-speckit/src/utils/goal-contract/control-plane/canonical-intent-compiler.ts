const {
  compileSubordinateSourceCoverage,
  verifyCompositeSourceAuthorityBundle,
} = require('./composite-source-authority-bundle.ts');
const {
  goalContractSchemaArtifactHash,
  validateGoalContractSchema,
} = require('./schema-registry.ts');
const { hashControlPlaneValue } = require('./canonical-hash.ts');
const { verifyIntentAuthorityEnvelope } = require('./intent-authority.ts');
const { verifyOrderedSourceSnapshotSet } = require('./source-snapshot.ts');
const { verifySourceCompositionPolicy } = require('./source-composition-policy.ts');
const { compileSpecSpanRegistry, resolveSpecSpan } = require('./spec-span-registry.ts');
const { extractSourceObligations } = require('../source-obligation-extractor.ts');

export type GoalContractCanonicalIntentCompilerModule = never;

interface CanonicalIntentRecordShape {
  intentRecordId: string;
  declaredSourceId: string | null;
  classification:
    | 'positive'
    | 'negative'
    | 'boundary'
    | 'evidence'
    | 'dependency'
    | 'applicability'
    | 'context';
  ownership: 'owned_obligation' | 'cross_source_reference';
  referenceTargetId: string | null;
  polarity: 'positive' | 'negative';
  requiredOutcome: string;
  semanticCoordinateKey: string;
  semanticOwnershipKey: string;
  dependencyRefs: string[];
  specSpanRefs: string[];
}

interface SpecSpanRegistryShape {
  specSpans: Array<{ specSpanId: string }>;
  specSpanRegistryHash: string;
}

interface CompilerIdentityShape {
  compilerVersion: string;
  schemaArtifactHashes: Array<{
    schemaName: string;
    schemaArtifactHash: string;
  }>;
  compilerIdentityHash: string;
}

interface CanonicalIntentBundleShape {
  schemaVersion: string;
  canonicalIntentBundleHash: string;
  compilerIdentity: CompilerIdentityShape;
  subordinateCoverage: Record<string, unknown>;
  sourceObligationGraph: object;
  sourceObligationGraphHash: string;
  canonicalIntentSemanticHash: string;
  canonicalIntentIR: CanonicalIntentRecordShape[];
  specSpanRegistry: SpecSpanRegistryShape;
  authorityState: 'candidate_only' | 'authoritative';
  orderedSourceSnapshotSetHash: string;
  sourceCompositionPolicyHash: string;
  sourceAuthorityBundleHash: string;
  intentAuthorityEnvelope?: unknown;
  authorityAttestationHash?: string;
}

type CanonicalIntentBundleWithoutHash = Omit<
  CanonicalIntentBundleShape,
  'canonicalIntentBundleHash'
>;

type CanonicalIntentBundleCore = Omit<
  CanonicalIntentBundleWithoutHash,
  'canonicalIntentSemanticHash' | 'intentAuthorityEnvelope' | 'authorityAttestationHash'
>;

const CANONICAL_INTENT_SCHEMA = 'goal-contract-canonical-intent-bundle.schema.json';
const SCHEMA_NAMES = [
  CANONICAL_INTENT_SCHEMA,
  'goal-contract-composite-source-authority-bundle.schema.json',
  'goal-contract-intent-authority-envelope.schema.json',
  'goal-contract-source-composition-policy.schema.json',
  'goal-contract-subordinate-source-coverage-receipt.schema.json',
].sort();
const DECLARED_ID_PATTERN = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/gu;

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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\r\n?/gu, '\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizedSemanticToken(value, fallback) {
  const normalized = normalizedText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_:/.-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return normalized || fallback;
}

function extractDeclaredIds(value) {
  return [...new Set(normalizedText(value).match(DECLARED_ID_PATTERN) ?? [])].sort();
}

function containsAuthorityRef(value, authorityRef) {
  const escaped = authorityRef.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[^A-Z0-9_-])${escaped}(?:$|[^A-Z0-9_-])`, 'u').test(
    normalizedText(value)
  );
}

function stripDeclaredPrefix(text, declaredSourceId) {
  let body = normalizedText(text).replace(/^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?/u, '');
  if (declaredSourceId) {
    const escaped = declaredSourceId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    body = body.replace(new RegExp(`^${escaped}\\b\\s*(?::|：|-)?\\s*`, 'u'), '');
  }
  return normalizedText(body);
}

function classifyRecord(obligation) {
  const heading = normalizedText(obligation.headingPath.join(' '));
  const text = normalizedText(obligation.exactText);
  const combined = `${heading} ${text}`;
  if (/^(?:>\s*)+$/u.test(text)) {
    return 'context';
  }
  if (
    /deterministic\s+not\s+done|\bnot\s+done\b|\bexcluded\b|out[\s-]+of[\s-]+scope/iu.test(combined)
  ) {
    return 'boundary';
  }
  if (obligation.dependencyRefs.length > 0 || /\bdependencies?\b|依赖/u.test(heading)) {
    return 'dependency';
  }
  if (
    [
      'acceptance_condition',
      'command_block',
      'completion_criteria',
      'evidence_contract',
      'observability',
      'verification_command',
    ].includes(obligation.kind) ||
    /\bacceptance\b|\bevidence\b|\breceipt\b|\bcommands?\b/u.test(heading.toLowerCase())
  ) {
    return 'evidence';
  }
  if (/\bapplicability\b|\bapplicable\b|\bapplies\b|sequence\s+mode/iu.test(combined)) {
    return 'applicability';
  }
  if (/\bMUST\s+NOT\b|\bSHALL\s+NOT\b|\bforbidden\b|\bdeny\b|\breject\b/iu.test(text)) {
    return 'negative';
  }
  return 'positive';
}

function semanticFields(obligation, classification) {
  const polarity = /\bMUST\s+NOT\b|\bSHALL\s+NOT\b|\bforbidden\b|\bdeny\b|\breject\b/iu.test(
    obligation.exactText
  )
    ? 'negative'
    : 'positive';
  const withoutId = stripDeclaredPrefix(obligation.exactText, obligation.declaredSourceId);
  const modalFree = normalizedText(
    withoutId.replace(/^(?:MUST\s+NOT|SHALL\s+NOT|MUST|SHALL|SHOULD|MAY)\b\s*/iu, '')
  );
  const requiredOutcome = normalizedSemanticToken(
    modalFree,
    normalizedSemanticToken(
      obligation.declaredSourceId,
      `${obligation.namespace}:${classification}`
    )
  );
  const [firstToken, ...remainingTokens] = requiredOutcome.split(' ');
  const subject = normalizedSemanticToken(
    obligation.headingPath.at(-1),
    obligation.namespace.toLowerCase()
  );
  const action = firstToken || classification;
  const target =
    remainingTokens.join(' ') ||
    normalizedSemanticToken(
      obligation.declaredSourceId,
      `${obligation.namespace}:${obligation.kind}`
    );
  const applicabilityCondition =
    classification === 'applicability' ? requiredOutcome : 'applicable';
  const coordinate = {
    subject,
    action,
    target,
    applicabilityCondition,
  };
  return {
    polarity,
    subject,
    action,
    target,
    applicabilityCondition,
    requiredOutcome,
    semanticCoordinateKey: hashControlPlaneValue(coordinate),
    semanticOwnershipKey: hashControlPlaneValue({
      ...coordinate,
      polarity,
      requiredOutcome,
    }),
  };
}

function extractSnapshotObligations(snapshot) {
  const extractorSnapshot =
    snapshot.sourceOrder === 0
      ? snapshot
      : {
          ...snapshot,
          sourceOrder: 0,
        };
  const extracted = extractSourceObligations({
    snapshot: extractorSnapshot,
  });
  return extracted.sourceObligations.map((obligation) => ({
    sourceRootId: obligation.id,
    declaredSourceId: obligation.declaredId ? obligation.id : null,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    sourceOrder: snapshot.sourceOrder,
    kind: obligation.kind,
    exactText: obligation.exactText,
    headingPath: [...obligation.headingPath],
    startByte: obligation.startByte,
    endByteExclusive: obligation.endByteExclusive,
    dependencyRefs: [...obligation.dependencyRefs].sort(),
  }));
}

function compileVerifiedObligationBases(request, snapshotSet) {
  if (request.verifiedObligationBases === undefined) {
    return snapshotSet.sourceSnapshots.flatMap(extractSnapshotObligations);
  }
  if (!Array.isArray(request.verifiedObligationBases)) {
    throw failure('verified_obligation_bases_invalid');
  }
  const extractedBases = snapshotSet.sourceSnapshots.flatMap(extractSnapshotObligations);
  if (request.verifiedObligationBases.length !== extractedBases.length) {
    throw failure('verified_obligation_base_authority_mismatch', {
      expectedCount: extractedBases.length,
      actualCount: request.verifiedObligationBases.length,
    });
  }
  const snapshotsByArtifact = new Map(
    snapshotSet.sourceSnapshots.map((snapshot) => [snapshot.sourceArtifactId, snapshot])
  );
  return request.verifiedObligationBases.map((base, index) => {
    if (
      !isRecord(base) ||
      typeof base.sourceRootId !== 'string' ||
      base.sourceRootId.length === 0 ||
      typeof base.sourceArtifactId !== 'string' ||
      typeof base.sourceSnapshotHash !== 'string' ||
      typeof base.sourceRole !== 'string' ||
      typeof base.namespace !== 'string' ||
      typeof base.sourceOrder !== 'number' ||
      typeof base.kind !== 'string' ||
      typeof base.exactText !== 'string' ||
      (base.declaredSourceId !== null && typeof base.declaredSourceId !== 'string') ||
      !Array.isArray(base.headingPath) ||
      base.headingPath.some((value) => typeof value !== 'string') ||
      typeof base.startByte !== 'number' ||
      typeof base.endByteExclusive !== 'number' ||
      !Array.isArray(base.dependencyRefs) ||
      base.dependencyRefs.some((value) => typeof value !== 'string')
    ) {
      throw failure('verified_obligation_base_invalid', {
        index,
      });
    }
    const snapshot = snapshotsByArtifact.get(base.sourceArtifactId);
    if (
      !snapshot ||
      snapshot.sourceSnapshotHash !== base.sourceSnapshotHash ||
      snapshot.sourceRole !== base.sourceRole ||
      snapshot.namespace !== base.namespace ||
      snapshot.sourceOrder !== base.sourceOrder
    ) {
      throw failure('verified_obligation_base_authority_mismatch', {
        index,
        sourceArtifactId: base.sourceArtifactId,
      });
    }
    if (base.startByte < 0 || base.endByteExclusive <= base.startByte) {
      throw failure('verified_obligation_base_span_invalid', {
        index,
      });
    }
    const verifiedBase = {
      sourceRootId: base.sourceRootId,
      declaredSourceId: base.declaredSourceId,
      sourceArtifactId: base.sourceArtifactId,
      sourceSnapshotHash: base.sourceSnapshotHash,
      sourceRole: base.sourceRole,
      namespace: base.namespace,
      sourceOrder: base.sourceOrder,
      kind: base.kind,
      exactText: base.exactText,
      headingPath: [...base.headingPath],
      startByte: base.startByte,
      endByteExclusive: base.endByteExclusive,
      dependencyRefs: [...base.dependencyRefs].sort(),
    };
    if (hashControlPlaneValue(verifiedBase) !== hashControlPlaneValue(extractedBases[index])) {
      throw failure('verified_obligation_base_authority_mismatch', {
        index,
        sourceArtifactId: base.sourceArtifactId,
      });
    }
    return extractedBases[index];
  });
}

function verifyAuthorityInputs(policy, snapshotSet, bundle) {
  if (bundle.sourceCompositionPolicyHash !== policy.sourceCompositionPolicyHash) {
    throw failure('source_composition_policy_mismatch');
  }
  if (bundle.orderedSourceSnapshotSetHash !== snapshotSet.orderedSourceSnapshotSetHash) {
    throw failure('source_authority_bundle_stale');
  }
  const descriptors = [bundle.primarySource, ...bundle.subordinateSources];
  if (descriptors.length !== snapshotSet.sourceSnapshots.length) {
    throw failure('source_authority_bundle_stale');
  }
  for (const snapshot of snapshotSet.sourceSnapshots) {
    const descriptor = descriptors.find(
      ({ sourceArtifactId }) => sourceArtifactId === snapshot.sourceArtifactId
    );
    if (
      !descriptor ||
      descriptor.sourceSnapshotHash !== snapshot.sourceSnapshotHash ||
      descriptor.pathOrSegmentId !== snapshot.pathOrSegmentId ||
      descriptor.role !== snapshot.sourceRole ||
      descriptor.namespace !== snapshot.namespace ||
      descriptor.sourceOrder !== snapshot.sourceOrder
    ) {
      throw failure(
        snapshot.sourceRole === 'subordinate_component_specification'
          ? 'subordinate_source_stale'
          : 'source_authority_bundle_stale',
        { sourceArtifactId: snapshot.sourceArtifactId }
      );
    }
  }
}

function ownedDraft(base) {
  const classification = classifyRecord(base);
  const semantics = semanticFields(base, classification);
  const identity = {
    sourceArtifactId: base.sourceArtifactId,
    sourceSnapshotHash: base.sourceSnapshotHash,
    sourceOrder: base.sourceOrder,
    startByte: base.startByte,
    endByteExclusive: base.endByteExclusive,
    declaredSourceId: base.declaredSourceId,
    ownership: 'owned_obligation',
  };
  return {
    record: {
      intentRecordId: `intent-${hashControlPlaneValue(identity).slice(7)}`,
      declaredSourceId: base.declaredSourceId,
      classification,
      ownership: 'owned_obligation',
      referenceTargetId: null,
      sourceArtifactId: base.sourceArtifactId,
      sourceSnapshotHash: base.sourceSnapshotHash,
      sourceRole: base.sourceRole,
      namespace: base.namespace,
      sourceOrder: base.sourceOrder,
      sourceKind: base.kind,
      ...semantics,
      dependencyRefs: base.dependencyRefs,
    },
    base,
  };
}

function crossSourceDraft(base, targetId, owner, descriptor) {
  const sourceContext = `${base.headingPath.join(' ')} ${base.exactText}`;
  if (
    descriptor.parentTaskRefs.length > 0 &&
    !descriptor.parentTaskRefs.some((taskRef) => containsAuthorityRef(sourceContext, taskRef))
  ) {
    throw failure('subordinate_scope_escape', {
      sourceArtifactId: base.sourceArtifactId,
      referenceTargetId: targetId,
    });
  }
  const identity = {
    sourceArtifactId: base.sourceArtifactId,
    sourceSnapshotHash: base.sourceSnapshotHash,
    startByte: base.startByte,
    endByteExclusive: base.endByteExclusive,
    ownership: 'cross_source_reference',
    targetId,
    targetSemanticOwnershipKey: owner.record.semanticOwnershipKey,
  };
  return {
    record: {
      intentRecordId: `intent-${hashControlPlaneValue(identity).slice(7)}`,
      declaredSourceId: null,
      classification: 'dependency',
      ownership: 'cross_source_reference',
      referenceTargetId: targetId,
      sourceArtifactId: base.sourceArtifactId,
      sourceSnapshotHash: base.sourceSnapshotHash,
      sourceRole: base.sourceRole,
      namespace: base.namespace,
      sourceOrder: base.sourceOrder,
      sourceKind: base.kind,
      polarity: owner.record.polarity,
      subject: owner.record.subject,
      action: 'reference',
      target: owner.record.semanticOwnershipKey,
      applicabilityCondition: owner.record.applicabilityCondition,
      requiredOutcome: `resolve ${targetId.toLowerCase()}`,
      semanticCoordinateKey: hashControlPlaneValue({
        ownership: 'cross_source_reference',
        targetSemanticOwnershipKey: owner.record.semanticOwnershipKey,
      }),
      semanticOwnershipKey: hashControlPlaneValue(identity),
      dependencyRefs: [],
    },
    base,
  };
}

function assertSemanticOwnership(drafts) {
  const semanticOwners = new Map();
  const coordinateOwners = new Map();
  for (const draft of drafts) {
    const record = draft.record;
    if (record.classification === 'context') {
      continue;
    }
    const duplicate = semanticOwners.get(record.semanticOwnershipKey);
    if (duplicate) {
      throw failure('source_semantic_duplication', {
        sourceObligationIds: [duplicate.intentRecordId, record.intentRecordId].sort(),
      });
    }
    semanticOwners.set(record.semanticOwnershipKey, record);
    const coordinate = coordinateOwners.get(record.semanticCoordinateKey);
    if (
      coordinate &&
      (coordinate.polarity !== record.polarity ||
        coordinate.requiredOutcome !== record.requiredOutcome)
    ) {
      throw failure('source_authority_conflict', {
        sourceObligationIds: [coordinate.intentRecordId, record.intentRecordId].sort(),
      });
    }
    coordinateOwners.set(record.semanticCoordinateKey, record);
  }
}

function bindSpecSpans(snapshotSet, drafts) {
  const specSpanRegistry = compileSpecSpanRegistry({
    orderedSourceSnapshotSet: snapshotSet,
    spans: drafts.map(({ base, record }) => ({
      sourceArtifactId: base.sourceArtifactId,
      sourceSnapshotHash: base.sourceSnapshotHash,
      namespace: base.namespace,
      startByte: base.startByte,
      endByteExclusive: base.endByteExclusive,
      headingPath: base.headingPath,
      sourceObligationIds: [record.intentRecordId],
    })),
  });
  const spansByRecordId = new Map(
    specSpanRegistry.specSpans.flatMap((span) =>
      span.sourceObligationIds.map((recordId) => [recordId, span.specSpanId])
    )
  );
  const records = drafts.map(({ record }) => {
    const specSpanId = spansByRecordId.get(record.intentRecordId);
    if (!specSpanId) {
      throw failure('source_obligation_spec_span_missing', {
        sourceObligationId: record.intentRecordId,
      });
    }
    return {
      ...record,
      specSpanRefs: [specSpanId],
    };
  });
  return { records, specSpanRegistry };
}

function recordIndexByDeclaredId(records) {
  const index = new Map();
  for (const record of records) {
    if (record.ownership !== 'owned_obligation' || !record.declaredSourceId) {
      continue;
    }
    const owners = index.get(record.declaredSourceId) ?? [];
    owners.push(record);
    index.set(record.declaredSourceId, owners);
  }
  return index;
}

function buildSourceObligationGraph(snapshotSet, records, registry) {
  const declaredOwners = recordIndexByDeclaredId(records);
  const dependencyEdges = [];
  for (const record of records) {
    for (const dependencyId of record.dependencyRefs) {
      const owners = declaredOwners.get(dependencyId) ?? [];
      if (owners.length === 0) {
        throw failure('source_obligation_dependency_unknown', {
          sourceObligationId: record.intentRecordId,
          dependencyId,
        });
      }
      if (owners.length > 1) {
        throw failure('source_obligation_dependency_ambiguous', {
          sourceObligationId: record.intentRecordId,
          dependencyId,
        });
      }
      dependencyEdges.push({
        fromId: record.intentRecordId,
        toId: owners[0].intentRecordId,
        dependencyId,
      });
    }
  }
  const crossSourceReferenceEdges = records
    .filter(({ ownership }) => ownership === 'cross_source_reference')
    .map((record) => {
      const owners = declaredOwners.get(record.referenceTargetId) ?? [];
      if (owners.length === 0) {
        throw failure('cross_source_reference_missing', {
          referenceTargetId: record.referenceTargetId,
        });
      }
      if (owners.length > 1) {
        throw failure('cross_source_reference_ambiguous', {
          referenceTargetId: record.referenceTargetId,
        });
      }
      return {
        fromId: record.intentRecordId,
        toId: owners[0].intentRecordId,
        targetId: record.referenceTargetId,
      };
    });
  return {
    schemaVersion: 'goal-contract-unified-source-obligation-graph/v1',
    orderedSourceSnapshotSetHash: snapshotSet.orderedSourceSnapshotSetHash,
    specSpanRegistryHash: registry.specSpanRegistryHash,
    obligations: records,
    dependencyEdges: dependencyEdges.sort((left, right) =>
      `${left.fromId}|${left.toId}|${left.dependencyId}`.localeCompare(
        `${right.fromId}|${right.toId}|${right.dependencyId}`,
        'en'
      )
    ),
    crossSourceReferenceEdges: crossSourceReferenceEdges.sort((left, right) =>
      `${left.fromId}|${left.toId}|${left.targetId}`.localeCompare(
        `${right.fromId}|${right.toId}|${right.targetId}`,
        'en'
      )
    ),
  };
}

function compileCoverage(bundle, records) {
  const receipts = bundle.subordinateSources.map((descriptor) => {
    const obligations = records
      .filter(
        (record) =>
          record.ownership === 'owned_obligation' &&
          record.sourceArtifactId === descriptor.sourceArtifactId &&
          record.declaredSourceId
      )
      .map((record) => ({
        id: record.declaredSourceId,
        semanticOwnershipKey: record.semanticOwnershipKey,
        sourceArtifactId: record.sourceArtifactId,
        sourceRole: record.sourceRole,
        namespace: record.namespace,
        taskRefs: descriptor.parentTaskRefs,
        specSpanRefs: record.specSpanRefs,
        ownership: record.ownership,
      }));
    return compileSubordinateSourceCoverage({
      binding: descriptor,
      obligations,
    });
  });
  if (receipts.length === 1) return receipts[0];
  return {
    schemaVersion: 'goal-contract-subordinate-source-coverage-receipt-set/v1',
    receipts,
    receiptSetHash: hashControlPlaneValue(receipts),
  };
}

function compilerIdentity() {
  const partial: Omit<CompilerIdentityShape, 'compilerIdentityHash'> = {
    compilerVersion: 'goal-contract-canonical-intent-compiler/v1',
    schemaArtifactHashes: SCHEMA_NAMES.map((schemaName) => ({
      schemaName,
      schemaArtifactHash: goalContractSchemaArtifactHash(schemaName),
    })),
  };
  return {
    ...partial,
    compilerIdentityHash: hashControlPlaneValue(partial),
  };
}

function semanticPayload(bundle) {
  return {
    schemaVersion: 'goal-contract-canonical-intent-semantics/v1',
    sourceCompositionPolicyHash: bundle.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: bundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: bundle.sourceAuthorityBundleHash,
    canonicalIntentIR: bundle.canonicalIntentIR,
    specSpanRegistryHash: bundle.specSpanRegistry.specSpanRegistryHash,
    sourceObligationGraphHash: bundle.sourceObligationGraphHash,
    subordinateCoverage: bundle.subordinateCoverage,
  };
}

function bundlePayload(bundle) {
  const payload = { ...bundle };
  delete payload.canonicalIntentBundleHash;
  return payload;
}

function verifyCoverageReceipt(coverage) {
  if (coverage.schemaVersion === 'goal-contract-subordinate-source-coverage-receipt-set/v1') {
    if (
      !Array.isArray(coverage.receipts) ||
      hashControlPlaneValue(coverage.receipts) !== coverage.receiptSetHash
    ) {
      throw failure('subordinate_coverage_hash_mismatch');
    }
    coverage.receipts.forEach(verifyCoverageReceipt);
    return;
  }
  const payload = { ...coverage };
  const receiptHash = payload.receiptHash;
  delete payload.receiptHash;
  if (hashControlPlaneValue(payload) !== receiptHash) {
    throw failure('subordinate_coverage_hash_mismatch');
  }
}

function verifyCompilerIdentity(identity) {
  const partial: Omit<CompilerIdentityShape, 'compilerIdentityHash'> = {
    compilerVersion: identity.compilerVersion,
    schemaArtifactHashes: identity.schemaArtifactHashes,
  };
  if (hashControlPlaneValue(partial) !== identity.compilerIdentityHash) {
    throw failure('compiler_identity_hash_mismatch');
  }
  const expected = compilerIdentity();
  if (
    hashControlPlaneValue(expected.schemaArtifactHashes) !==
    hashControlPlaneValue(identity.schemaArtifactHashes)
  ) {
    throw failure('compiler_identity_stale');
  }
}

function verifyCanonicalIntentBundle(bundle: CanonicalIntentBundleShape) {
  if (
    !isRecord(bundle) ||
    hashControlPlaneValue(bundlePayload(bundle)) !== bundle.canonicalIntentBundleHash
  ) {
    throw failure('canonical_intent_bundle_hash_mismatch');
  }
  validateGoalContractSchema(CANONICAL_INTENT_SCHEMA, bundle);
  verifyCompilerIdentity(bundle.compilerIdentity);
  verifyCoverageReceipt(bundle.subordinateCoverage);
  if (hashControlPlaneValue(bundle.sourceObligationGraph) !== bundle.sourceObligationGraphHash) {
    throw failure('source_obligation_graph_hash_mismatch');
  }
  if (hashControlPlaneValue(semanticPayload(bundle)) !== bundle.canonicalIntentSemanticHash) {
    throw failure('canonical_intent_semantic_hash_mismatch');
  }
  const spanIds = new Set(bundle.specSpanRegistry.specSpans.map(({ specSpanId }) => specSpanId));
  for (const record of bundle.canonicalIntentIR) {
    for (const specSpanId of record.specSpanRefs) {
      if (!spanIds.has(specSpanId)) {
        throw failure('source_obligation_spec_span_missing', {
          sourceObligationId: record.intentRecordId,
        });
      }
      resolveSpecSpan({
        registry: bundle.specSpanRegistry,
        specSpanId,
      });
    }
  }
  const ownedRecords = bundle.canonicalIntentIR.filter(
    ({ ownership }) => ownership === 'owned_obligation'
  );
  assertSemanticOwnership(
    ownedRecords.map((record) => ({
      record,
      base: null,
    }))
  );
  const expectedGraph = buildSourceObligationGraph(
    {
      orderedSourceSnapshotSetHash: bundle.orderedSourceSnapshotSetHash,
    },
    bundle.canonicalIntentIR,
    bundle.specSpanRegistry
  );
  if (
    hashControlPlaneValue(expectedGraph) !== hashControlPlaneValue(bundle.sourceObligationGraph)
  ) {
    throw failure('source_obligation_graph_projection_mismatch');
  }
  if (bundle.authorityState === 'authoritative') {
    const envelope = verifyIntentAuthorityEnvelope(bundle.intentAuthorityEnvelope);
    if (
      envelope.authorityAttestationHash !== bundle.authorityAttestationHash ||
      envelope.subject.sourceSnapshotHash !== bundle.orderedSourceSnapshotSetHash ||
      envelope.subject.canonicalIntentSemanticHash !== bundle.canonicalIntentSemanticHash ||
      envelope.subject.specSpanRegistryHash !== bundle.specSpanRegistry.specSpanRegistryHash ||
      envelope.subject.sourceCompositionPolicyHash !== bundle.sourceCompositionPolicyHash ||
      envelope.subject.sourceAuthorityBundleHash !== bundle.sourceAuthorityBundleHash
    ) {
      throw failure('authority_subject_mismatch');
    }
  }
  return deepFreeze(bundle);
}

function compileCanonicalIntent(request: unknown = {}) {
  if (!isRecord(request)) throw failure('canonical_intent_request_invalid');
  const policy = verifySourceCompositionPolicy(request.sourceCompositionPolicy);
  const snapshotSet = verifyOrderedSourceSnapshotSet(request.orderedSourceSnapshotSet);
  const sourceAuthorityBundle = verifyCompositeSourceAuthorityBundle(
    request.compositeSourceAuthorityBundle
  );
  verifyAuthorityInputs(policy, snapshotSet, sourceAuthorityBundle);
  if (request.authorityState !== 'candidate_only' && request.authorityState !== 'authoritative') {
    throw failure('authority_state_invalid');
  }
  const authorityState = request.authorityState;
  if (authorityState === 'candidate_only' && request.intentAuthorityEnvelope !== undefined) {
    throw failure('authority_state_mismatch');
  }

  const bases = compileVerifiedObligationBases(request, snapshotSet);
  const subordinateDescriptors = new Map(
    sourceAuthorityBundle.subordinateSources.map((descriptor) => [
      descriptor.sourceArtifactId,
      descriptor,
    ])
  );
  const requiredSubordinateIds = new Set(
    sourceAuthorityBundle.subordinateSources.flatMap((descriptor) => [
      ...descriptor.requiredRequirementIds,
      ...descriptor.requiredTaskIds,
    ])
  );
  const ownedDrafts = bases
    .filter(
      (base) =>
        !(
          base.sourceRole === 'primary_implementation_authority' &&
          base.declaredSourceId &&
          requiredSubordinateIds.has(base.declaredSourceId)
        )
    )
    .map(ownedDraft);
  assertSemanticOwnership(ownedDrafts);

  const subordinateOwners = new Map();
  for (const draft of ownedDrafts) {
    const record = draft.record;
    if (record.sourceRole !== 'subordinate_component_specification' || !record.declaredSourceId) {
      continue;
    }
    const owners = subordinateOwners.get(record.declaredSourceId) ?? [];
    owners.push(draft);
    subordinateOwners.set(record.declaredSourceId, owners);
  }
  for (const descriptor of sourceAuthorityBundle.subordinateSources) {
    for (const id of [...descriptor.requiredRequirementIds, ...descriptor.requiredTaskIds]) {
      const owners = subordinateOwners.get(id) ?? [];
      if (owners.length === 0) {
        throw failure(
          descriptor.requiredRequirementIds.includes(id)
            ? 'subordinate_requirement_missing'
            : 'subordinate_task_missing',
          { missingId: id }
        );
      }
      if (owners.length > 1) {
        throw failure('source_semantic_duplication', {
          declaredSourceId: id,
        });
      }
    }
  }

  const crossSourceDrafts = [];
  for (const base of bases.filter(
    ({ sourceRole }) => sourceRole === 'primary_implementation_authority'
  )) {
    for (const targetId of extractDeclaredIds(base.exactText)) {
      const owners = subordinateOwners.get(targetId);
      if (!owners) continue;
      if (owners.length !== 1) {
        throw failure('cross_source_reference_ambiguous', {
          referenceTargetId: targetId,
        });
      }
      const descriptor = subordinateDescriptors.get(owners[0].record.sourceArtifactId);
      crossSourceDrafts.push(crossSourceDraft(base, targetId, owners[0], descriptor));
    }
  }
  const allDrafts = [...ownedDrafts, ...crossSourceDrafts].sort(
    (left, right) =>
      left.base.sourceOrder - right.base.sourceOrder ||
      left.base.startByte - right.base.startByte ||
      left.base.endByteExclusive - right.base.endByteExclusive ||
      left.record.ownership.localeCompare(right.record.ownership, 'en') ||
      left.record.intentRecordId.localeCompare(right.record.intentRecordId, 'en')
  );
  const { records, specSpanRegistry } = bindSpecSpans(snapshotSet, allDrafts);
  const sourceObligationGraph = buildSourceObligationGraph(snapshotSet, records, specSpanRegistry);
  const sourceObligationGraphHash = hashControlPlaneValue(sourceObligationGraph);
  const subordinateCoverage = compileCoverage(sourceAuthorityBundle, records);
  const partial: CanonicalIntentBundleCore = {
    schemaVersion: 'goal-contract-canonical-intent-bundle/v1',
    authorityState,
    sourceCompositionPolicyHash: policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: snapshotSet.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: sourceAuthorityBundle.sourceAuthorityBundleHash,
    canonicalIntentIR: records,
    specSpanRegistry,
    sourceObligationGraph,
    sourceObligationGraphHash,
    subordinateCoverage,
    compilerIdentity: compilerIdentity(),
  };
  const canonicalIntentSemanticHash = hashControlPlaneValue(semanticPayload(partial));

  if (Array.isArray(request.projectionObligations)) {
    const knownIds = new Set(
      records.flatMap((record) => [record.intentRecordId, record.declaredSourceId]).filter(Boolean)
    );
    const expanded = request.projectionObligations.filter(
      (projection) =>
        !isRecord(projection) || typeof projection.id !== 'string' || !knownIds.has(projection.id)
    );
    if (expanded.length > 0) {
      throw failure('projection_semantic_expansion');
    }
  } else if (request.projectionObligations !== undefined) {
    throw failure('projection_semantic_expansion');
  }

  let authorityFields: Pick<
    CanonicalIntentBundleShape,
    'intentAuthorityEnvelope' | 'authorityAttestationHash'
  > = {};
  if (authorityState === 'authoritative') {
    if (!request.intentAuthorityEnvelope) {
      throw failure('authority_missing');
    }
    const envelope = verifyIntentAuthorityEnvelope(request.intentAuthorityEnvelope);
    if (
      envelope.subject.sourceSnapshotHash !== snapshotSet.orderedSourceSnapshotSetHash ||
      envelope.subject.canonicalIntentSemanticHash !== canonicalIntentSemanticHash ||
      envelope.subject.specSpanRegistryHash !== specSpanRegistry.specSpanRegistryHash ||
      envelope.subject.sourceCompositionPolicyHash !== policy.sourceCompositionPolicyHash ||
      envelope.subject.sourceAuthorityBundleHash !== sourceAuthorityBundle.sourceAuthorityBundleHash
    ) {
      throw failure('authority_subject_mismatch');
    }
    authorityFields = {
      intentAuthorityEnvelope: envelope,
      authorityAttestationHash: envelope.authorityAttestationHash,
    };
  }
  const bundle: CanonicalIntentBundleWithoutHash = {
    ...partial,
    canonicalIntentSemanticHash,
    ...authorityFields,
  };
  return verifyCanonicalIntentBundle({
    ...bundle,
    canonicalIntentBundleHash: hashControlPlaneValue(bundlePayload(bundle)),
  });
}

module.exports = {
  compileCanonicalIntent,
  verifyCanonicalIntentBundle,
};
