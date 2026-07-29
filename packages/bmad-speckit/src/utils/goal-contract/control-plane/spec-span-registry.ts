const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');

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

export type GoalContractSpecSpanRegistryModule = never;

const SPEC_SPAN_SCHEMA = 'goal-contract-spec-span-registry.schema.json';
const ALLOWED_REQUEST_FIELDS = new Set([
  'sourceArtifactId',
  'sourceSnapshotHash',
  'namespace',
  'startByte',
  'endByteExclusive',
  'expectedExactTextHash',
  'expectedNormalizedTextHash',
  'headingPath',
  'sourceObligationIds',
]);
const FORBIDDEN_PROVENANCE_FIELDS = new Set([
  'compilerProvenanceHash',
  'exactTextHash',
  'normalizedTextHash',
  'sourceOrder',
  'sourceRole',
  'specSpanId',
]);

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function normalizeLineEndings(text) {
  return String(text).replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

function decodeExactUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw failure('spec_span_utf8_boundary_invalid', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function sourceBytes(snapshot) {
  if (typeof snapshot?.frozenBytesBase64 !== 'string') {
    throw failure('spec_span_frozen_bytes_missing', {
      sourceArtifactId: snapshot?.sourceArtifactId,
    });
  }
  return Buffer.from(snapshot.frozenBytesBase64, 'base64');
}

function sourceForRequest(snapshotSet, request) {
  const source = snapshotSet.sourceSnapshots.find(
    (candidate) => candidate.sourceArtifactId === request.sourceArtifactId
  );
  if (!source) {
    throw failure('spec_span_source_identity_mismatch', {
      sourceArtifactId: request.sourceArtifactId,
    });
  }
  if (request.sourceSnapshotHash !== source.sourceSnapshotHash) {
    const otherOwner = snapshotSet.sourceSnapshots.find(
      (candidate) =>
        candidate.sourceSnapshotHash === request.sourceSnapshotHash
    );
    throw failure(
      otherOwner
        ? 'spec_span_source_identity_mismatch'
        : 'spec_span_source_hash_mismatch',
      {
        sourceArtifactId: request.sourceArtifactId,
        sourceSnapshotHash: request.sourceSnapshotHash,
      }
    );
  }
  if (request.namespace !== source.namespace) {
    throw failure('spec_span_namespace_mismatch', {
      sourceArtifactId: request.sourceArtifactId,
      expectedNamespace: source.namespace,
      actualNamespace: request.namespace,
    });
  }
  return source;
}

function positionAtByte(snapshot, bytes, offset) {
  const line = snapshot.lineIndex.find(
    (candidate, index) =>
      offset >= candidate.startByte &&
      (offset < candidate.endByteExclusive ||
        (index === snapshot.lineIndex.length - 1 &&
          offset === candidate.endByteExclusive))
  );
  if (!line) throw failure('spec_span_range_invalid', { offset });
  const prefixEnd = Math.min(offset, line.contentEndByte);
  const prefix = decodeExactUtf8(bytes.subarray(line.startByte, prefixEnd));
  return {
    line: line.lineNumber,
    column: [...prefix].length + 1,
  };
}

function specSpanIdentityPayload(span) {
  return {
    sourceArtifactId: span.sourceArtifactId,
    sourceSnapshotHash: span.sourceSnapshotHash,
    namespace: span.namespace,
    startByte: span.startByte,
    endByteExclusive: span.endByteExclusive,
    exactTextHash: span.exactTextHash,
    headingPath: span.headingPath,
  };
}

function specSpanProvenancePayload(span) {
  const payload = { ...span };
  delete payload.compilerProvenanceHash;
  return payload;
}

function compileSpan(snapshotSet, request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw failure('spec_span_request_invalid');
  }
  const forbidden = Object.keys(request).filter((key) =>
    FORBIDDEN_PROVENANCE_FIELDS.has(key)
  );
  if (forbidden.length > 0) {
    throw failure('spec_span_provenance_forbidden', {
      forbiddenFields: forbidden.sort(),
    });
  }
  const unknown = Object.keys(request).filter(
    (key) => !ALLOWED_REQUEST_FIELDS.has(key)
  );
  if (unknown.length > 0) {
    throw failure('spec_span_request_invalid', {
      unknownFields: unknown.sort(),
    });
  }
  const source = sourceForRequest(snapshotSet, request);
  const bytes = sourceBytes(source);
  if (
    !Number.isInteger(request.startByte) ||
    !Number.isInteger(request.endByteExclusive) ||
    request.startByte < 0 ||
    request.endByteExclusive <= request.startByte ||
    request.endByteExclusive > bytes.length
  ) {
    throw failure('spec_span_range_invalid', {
      sourceArtifactId: source.sourceArtifactId,
      startByte: request.startByte,
      endByteExclusive: request.endByteExclusive,
      sourceBytes: bytes.length,
    });
  }
  const exactBytes = bytes.subarray(
    request.startByte,
    request.endByteExclusive
  );
  const exactText = decodeExactUtf8(exactBytes);
  const exactTextHash = sha256(exactBytes);
  const normalizedTextHash = sha256(
    Buffer.from(normalizeLineEndings(exactText), 'utf8')
  );
  if (
    request.expectedExactTextHash !== undefined &&
    request.expectedExactTextHash !== exactTextHash
  ) {
    throw failure('spec_span_exact_hash_mismatch', {
      sourceArtifactId: source.sourceArtifactId,
    });
  }
  if (
    request.expectedNormalizedTextHash !== undefined &&
    request.expectedNormalizedTextHash !== normalizedTextHash
  ) {
    throw failure('spec_span_normalized_hash_mismatch', {
      sourceArtifactId: source.sourceArtifactId,
    });
  }
  if (
    !Array.isArray(request.headingPath) ||
    request.headingPath.some((item) => typeof item !== 'string') ||
    !Array.isArray(request.sourceObligationIds) ||
    request.sourceObligationIds.length === 0 ||
    request.sourceObligationIds.some(
      (item) => typeof item !== 'string' || item.length === 0
    )
  ) {
    throw failure('spec_span_request_invalid', {
      reason: 'citation_metadata_invalid',
    });
  }
  const start = positionAtByte(source, bytes, request.startByte);
  const end = positionAtByte(source, bytes, request.endByteExclusive);
  const partial = {
    sourceArtifactId: source.sourceArtifactId,
    sourceSnapshotHash: source.sourceSnapshotHash,
    sourceRole: source.sourceRole,
    namespace: source.namespace,
    sourceOrder: source.sourceOrder,
    startByte: request.startByte,
    endByteExclusive: request.endByteExclusive,
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    exactTextHash,
    normalizedTextHash,
    headingPath: [...request.headingPath],
    sourceObligationIds: [...new Set(request.sourceObligationIds)].sort(),
  };
  const span = {
    specSpanId: `spec-span-${hashControlPlaneValue(
      specSpanIdentityPayload(partial)
    ).slice(7)}`,
    ...partial,
  };
  return {
    ...span,
    compilerProvenanceHash: hashControlPlaneValue(span),
  };
}

function compileSpecSpanRegistry(request = {}) {
  const snapshotSet = verifyOrderedSourceSnapshotSet(
    request.orderedSourceSnapshotSet
  );
  if (!Array.isArray(request.spans)) {
    throw failure('spec_span_registry_invalid');
  }
  const merged = new Map();
  for (const compiled of request.spans.map((span) =>
    compileSpan(snapshotSet, span)
  )) {
    const previous = merged.get(compiled.specSpanId);
    if (!previous) {
      merged.set(compiled.specSpanId, compiled);
      continue;
    }
    const combined = {
      ...previous,
      sourceObligationIds: [
        ...new Set([
          ...previous.sourceObligationIds,
          ...compiled.sourceObligationIds,
        ]),
      ].sort(),
    };
    combined.compilerProvenanceHash = hashControlPlaneValue(
      specSpanProvenancePayload(combined)
    );
    merged.set(compiled.specSpanId, combined);
  }
  const specSpans = [...merged.values()].sort(
    (left, right) =>
      left.sourceOrder - right.sourceOrder ||
      left.startByte - right.startByte ||
      left.endByteExclusive - right.endByteExclusive ||
      left.specSpanId.localeCompare(right.specSpanId, 'en')
  );
  const payload = {
    schemaVersion: 'goal-contract-spec-span-registry/v1',
    orderedSourceSnapshotSetHash:
      snapshotSet.orderedSourceSnapshotSetHash,
    sourceSnapshots: snapshotSet.sourceSnapshots,
    specSpans,
  };
  const registry = {
    ...payload,
    specSpanRegistryHash: hashControlPlaneValue(payload),
  };
  validateGoalContractSchema(SPEC_SPAN_SCHEMA, registry);
  return deepFreeze(registry);
}

function verifySpanAgainstSource(span, source) {
  if (span.sourceSnapshotHash !== source.sourceSnapshotHash) {
    throw failure('spec_span_source_hash_mismatch', {
      sourceArtifactId: span.sourceArtifactId,
    });
  }
  if (span.namespace !== source.namespace) {
    throw failure('spec_span_namespace_mismatch', {
      sourceArtifactId: span.sourceArtifactId,
    });
  }
  if (
    span.sourceRole !== source.sourceRole ||
    span.sourceOrder !== source.sourceOrder
  ) {
    throw failure('spec_span_source_identity_mismatch', {
      sourceArtifactId: span.sourceArtifactId,
    });
  }
}

function resolveSpecSpan(request = {}) {
  const registry = request.registry;
  if (
    !registry ||
    !Array.isArray(registry.specSpans) ||
    !Array.isArray(registry.sourceSnapshots)
  ) {
    throw failure('spec_span_registry_invalid');
  }
  const span = registry.specSpans.find(
    (candidate) => candidate.specSpanId === request.specSpanId
  );
  if (!span) throw failure('spec_span_not_found');
  const source = registry.sourceSnapshots.find(
    (candidate) => candidate.sourceArtifactId === span.sourceArtifactId
  );
  if (!source) {
    throw failure('spec_span_source_identity_mismatch', {
      sourceArtifactId: span.sourceArtifactId,
    });
  }
  const bytes = sourceBytes(source);
  verifySpanAgainstSource(span, source);
  if (
    sha256(bytes) !== source.sourceSnapshotHash ||
    bytes.length !== source.sourceBytes
  ) {
    throw failure('source_snapshot_hash_mismatch', {
      sourceArtifactId: source.sourceArtifactId,
    });
  }
  if (
    !Number.isInteger(span.startByte) ||
    !Number.isInteger(span.endByteExclusive) ||
    span.startByte < 0 ||
    span.endByteExclusive <= span.startByte ||
    span.endByteExclusive > bytes.length
  ) {
    throw failure('spec_span_range_invalid');
  }
  const exactBytes = bytes.subarray(span.startByte, span.endByteExclusive);
  const exactText = decodeExactUtf8(exactBytes);
  if (sha256(exactBytes) !== span.exactTextHash) {
    throw failure('spec_span_exact_hash_mismatch');
  }
  if (
    sha256(Buffer.from(normalizeLineEndings(exactText), 'utf8')) !==
    span.normalizedTextHash
  ) {
    throw failure('spec_span_normalized_hash_mismatch');
  }
  if (
    `spec-span-${hashControlPlaneValue(
      specSpanIdentityPayload(span)
    ).slice(7)}` !== span.specSpanId ||
    hashControlPlaneValue(specSpanProvenancePayload(span)) !==
      span.compilerProvenanceHash
  ) {
    throw failure('spec_span_provenance_invalid');
  }
  const payload = {
    schemaVersion: registry.schemaVersion,
    orderedSourceSnapshotSetHash:
      registry.orderedSourceSnapshotSetHash,
    sourceSnapshots: registry.sourceSnapshots,
    specSpans: registry.specSpans,
  };
  if (hashControlPlaneValue(payload) !== registry.specSpanRegistryHash) {
    throw failure('spec_span_registry_hash_mismatch');
  }

  let stale = false;
  if (request.currentSources !== undefined) {
    if (!Array.isArray(request.currentSources)) {
      throw failure('spec_span_current_sources_invalid');
    }
    const matches = request.currentSources.filter(
      (candidate) => candidate.sourceArtifactId === source.sourceArtifactId
    );
    if (matches.length > 1) {
      throw failure('spec_span_current_sources_invalid', {
        reason: 'duplicate_source_artifact_id',
      });
    }
    if (matches.length === 1) {
      if (!Buffer.isBuffer(matches[0].rawBytes)) {
        throw failure('spec_span_current_sources_invalid', {
          reason: 'raw_bytes_missing',
        });
      }
      stale = sha256(matches[0].rawBytes) !== source.sourceSnapshotHash;
    }
  }
  return deepFreeze({
    schemaVersion: 'goal-contract-resolved-source-citation/v1',
    specSpanId: span.specSpanId,
    sourceArtifactId: source.sourceArtifactId,
    sourceSnapshotHash: source.sourceSnapshotHash,
    sourceRole: source.sourceRole,
    namespace: source.namespace,
    startByte: span.startByte,
    endByteExclusive: span.endByteExclusive,
    exactText,
    exactTextHash: span.exactTextHash,
    normalizedTextHash: span.normalizedTextHash,
    stale,
    staleSourceArtifactId: stale ? source.sourceArtifactId : null,
  });
}

module.exports = {
  compileSpecSpanRegistry,
  resolveSpecSpan,
};
