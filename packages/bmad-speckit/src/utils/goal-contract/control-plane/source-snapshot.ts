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

export type GoalContractSourceSnapshotModule = never;

const SOURCE_SNAPSHOT_SCHEMA =
  'goal-contract-canonical-source-snapshot.schema.json';
const SOURCE_KINDS = new Set([
  'source_plan',
  'conversation_segment',
  'confirmed_block',
]);
const SOURCE_ROLES = new Set([
  'primary_implementation_authority',
  'subordinate_component_specification',
]);
const FORBIDDEN_PROVENANCE_FIELDS = new Set([
  'aggregateHash',
  'compilerProvenanceHash',
  'exactByteHash',
  'frozenBytesBase64',
  'lineIndex',
  'normalizedTextHash',
  'snapshotId',
  'sourceSnapshotHash',
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

function normalizeLocator(value) {
  return String(value || '').replace(/\\/gu, '/');
}

function assertUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw failure('source_snapshot_encoding_invalid', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function detectNewlineStyle(bytes) {
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10) {
      crlf += 1;
      index += 1;
    } else if (bytes[index] === 10) {
      lf += 1;
    } else if (bytes[index] === 13) {
      cr += 1;
    }
  }
  const present = [
    ['crlf', crlf],
    ['lf', lf],
    ['cr', cr],
  ].filter(([, count]) => count > 0);
  if (present.length === 0) return 'none';
  if (present.length === 1) return present[0][0];
  return 'mixed';
}

function buildLineIndex(bytes) {
  const lines = [];
  let startByte = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    let newline = '';
    let endByteExclusive = index + 1;
    if (bytes[index] === 13 && bytes[index + 1] === 10) {
      newline = '\r\n';
      endByteExclusive = index + 2;
      index += 1;
    } else if (bytes[index] === 10) {
      newline = '\n';
    } else if (bytes[index] === 13) {
      newline = '\r';
    } else {
      continue;
    }
    lines.push({
      lineNumber: lines.length + 1,
      startByte,
      contentEndByte: endByteExclusive - Buffer.byteLength(newline, 'utf8'),
      endByteExclusive,
      newline,
    });
    startByte = endByteExclusive;
  }
  lines.push({
    lineNumber: lines.length + 1,
    startByte,
    contentEndByte: bytes.length,
    endByteExclusive: bytes.length,
    newline: '',
  });
  return lines;
}

function lineNumberAtByte(lineIndex, offset, preferPrevious = false) {
  if (preferPrevious && offset > 0) offset -= 1;
  const line = lineIndex.find(
    (candidate, index) =>
      offset >= candidate.startByte &&
      (offset < candidate.endByteExclusive ||
        (index === lineIndex.length - 1 && offset === candidate.endByteExclusive))
  );
  return line?.lineNumber ?? lineIndex.at(-1).lineNumber;
}

function orderedSegments(input) {
  if (input.segments === undefined) {
    if (!Buffer.isBuffer(input.rawBytes)) {
      throw failure('source_snapshot_invalid', { reason: 'raw_bytes_missing' });
    }
    return [
      {
        segmentId: String(input.segmentId || 'SEG-001'),
        segmentOrder: 0,
        role: String(input.segmentRole || input.sourceKind),
        rawBytes: Buffer.from(input.rawBytes),
      },
    ];
  }
  if (
    input.sourceKind !== 'conversation_segment' ||
    !Array.isArray(input.segments) ||
    input.segments.length === 0 ||
    input.rawBytes !== undefined
  ) {
    throw failure('source_snapshot_invalid', {
      reason: 'segments_invalid_for_source_kind',
    });
  }
  const segments = input.segments.map((segment) => {
    if (
      !segment ||
      typeof segment !== 'object' ||
      typeof segment.segmentId !== 'string' ||
      segment.segmentId.length === 0 ||
      !Number.isInteger(segment.segmentOrder) ||
      segment.segmentOrder < 0 ||
      !Buffer.isBuffer(segment.rawBytes)
    ) {
      throw failure('source_snapshot_invalid', {
        reason: 'segment_invalid',
      });
    }
    const forbidden = Object.keys(segment).filter((key) =>
      FORBIDDEN_PROVENANCE_FIELDS.has(key)
    );
    if (forbidden.length > 0) {
      throw failure('source_snapshot_provenance_forbidden', {
        forbiddenFields: forbidden.sort(),
      });
    }
    return {
      segmentId: segment.segmentId,
      segmentOrder: segment.segmentOrder,
      role: String(segment.role || input.sourceKind),
      rawBytes: Buffer.from(segment.rawBytes),
    };
  });
  const orders = segments.map(({ segmentOrder }) => segmentOrder);
  if (new Set(orders).size !== orders.length) {
    throw failure('source_segment_order_duplicate');
  }
  segments.sort((left, right) => left.segmentOrder - right.segmentOrder);
  if (segments.some((segment, index) => segment.segmentOrder !== index)) {
    throw failure('source_segment_order_non_contiguous');
  }
  if (
    new Set(segments.map(({ segmentId }) => segmentId)).size !== segments.length
  ) {
    throw failure('source_segment_identity_duplicate');
  }
  return segments;
}

function sourceSnapshotProvenancePayload(snapshot) {
  const payload = { ...snapshot };
  delete payload.compilerProvenanceHash;
  return payload;
}

function compileSourceSnapshot(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('source_snapshot_invalid');
  }
  const forbidden = Object.keys(input).filter((key) =>
    FORBIDDEN_PROVENANCE_FIELDS.has(key)
  );
  if (forbidden.length > 0) {
    throw failure('source_snapshot_provenance_forbidden', {
      forbiddenFields: forbidden.sort(),
    });
  }
  if (!SOURCE_KINDS.has(input.sourceKind)) {
    throw failure('source_snapshot_type_unsupported', {
      sourceKind: input.sourceKind,
    });
  }
  if (
    typeof input.sourceArtifactId !== 'string' ||
    input.sourceArtifactId.length === 0
  ) {
    throw failure('source_identity_missing');
  }
  if (!SOURCE_ROLES.has(input.sourceRole)) {
    throw failure('source_role_missing');
  }
  if (typeof input.namespace !== 'string' || input.namespace.length === 0) {
    throw failure('source_namespace_missing');
  }
  if (!Number.isInteger(input.sourceOrder) || input.sourceOrder < 0) {
    throw failure('source_order_invalid');
  }
  const pathOrSegmentId = normalizeLocator(input.pathOrSegmentId);
  if (!pathOrSegmentId) {
    throw failure('source_identity_missing', {
      reason: 'path_or_segment_id_missing',
    });
  }

  const segmentInputs = orderedSegments(input);
  const rawBytes = Buffer.concat(segmentInputs.map(({ rawBytes }) => rawBytes));
  const content = assertUtf8(rawBytes);
  const lineIndex = buildLineIndex(rawBytes);
  let byteStart = 0;
  const segments = segmentInputs.map((segment) => {
    const segmentContent = assertUtf8(segment.rawBytes);
    const byteEnd = byteStart + segment.rawBytes.length;
    const record = {
      segmentId: segment.segmentId,
      segmentOrder: segment.segmentOrder,
      role: segment.role,
      content: segmentContent,
      contentHash: sha256(segment.rawBytes),
      normalizedTextHash: sha256(
        Buffer.from(normalizeLineEndings(segmentContent), 'utf8')
      ),
      boundary: {
        ...(input.sourceKind === 'source_plan'
          ? { sourcePath: pathOrSegmentId }
          : { pathOrSegmentId }),
        byteStart,
        byteEnd,
        lineStart: lineNumberAtByte(lineIndex, byteStart),
        lineEnd:
          input.sourceKind === 'source_plan' && segmentInputs.length === 1
            ? lineIndex.length
            : lineNumberAtByte(lineIndex, byteEnd, true),
      },
    };
    byteStart = byteEnd;
    return record;
  });
  const sourceSnapshotHash = sha256(rawBytes);
  const record = {
    schemaVersion: 'goal-contract-source-snapshot/v1',
    sourceKind: input.sourceKind,
    sourceType: input.sourceKind,
    snapshotId: `source-snapshot-${sourceSnapshotHash.slice(7)}`,
    sourceArtifactId: input.sourceArtifactId,
    sourceRole: input.sourceRole,
    namespace: input.namespace,
    sourceOrder: input.sourceOrder,
    pathOrSegmentId,
    encoding: 'utf8',
    newlineStyle: detectNewlineStyle(rawBytes),
    sourceSnapshotHash,
    aggregateHash: sourceSnapshotHash,
    exactByteHash: sourceSnapshotHash,
    normalizedTextHash: sha256(
      Buffer.from(normalizeLineEndings(content), 'utf8')
    ),
    sourceBytes: rawBytes.length,
    sourceLines: lineIndex.length,
    frozenBytesBase64: rawBytes.toString('base64'),
    sourcePath: input.sourceKind === 'source_plan' ? pathOrSegmentId : null,
    sourceId: input.sourceKind === 'source_plan' ? null : pathOrSegmentId,
    sourcePlanSemanticHash: input.sourcePlanSemanticHash || null,
    segments,
    lineIndex,
  };
  const snapshot = {
    ...record,
    compilerProvenanceHash: hashControlPlaneValue(record),
  };
  validateGoalContractSchema(SOURCE_SNAPSHOT_SCHEMA, snapshot);
  return deepFreeze(snapshot);
}

function verifySourceSnapshot(snapshot) {
  validateGoalContractSchema(SOURCE_SNAPSHOT_SCHEMA, snapshot);
  if (typeof snapshot.frozenBytesBase64 !== 'string') {
    throw failure('source_snapshot_bytes_missing');
  }
  const bytes = Buffer.from(snapshot.frozenBytesBase64, 'base64');
  const content = assertUtf8(bytes);
  if (
    bytes.length !== snapshot.sourceBytes ||
    sha256(bytes) !== snapshot.sourceSnapshotHash ||
    snapshot.aggregateHash !== snapshot.sourceSnapshotHash ||
    snapshot.exactByteHash !== snapshot.sourceSnapshotHash
  ) {
    throw failure('source_snapshot_hash_mismatch', {
      sourceArtifactId: snapshot.sourceArtifactId,
    });
  }
  if (
    sha256(Buffer.from(normalizeLineEndings(content), 'utf8')) !==
    snapshot.normalizedTextHash
  ) {
    throw failure('source_snapshot_normalized_hash_mismatch', {
      sourceArtifactId: snapshot.sourceArtifactId,
    });
  }
  if (
    hashControlPlaneValue(sourceSnapshotProvenancePayload(snapshot)) !==
    snapshot.compilerProvenanceHash
  ) {
    throw failure('source_snapshot_provenance_invalid', {
      sourceArtifactId: snapshot.sourceArtifactId,
    });
  }
  return snapshot;
}

function compileOrderedSourceSnapshotSet(request = {}) {
  if (!Array.isArray(request.sources) || request.sources.length === 0) {
    throw failure('ordered_source_snapshot_set_invalid');
  }
  const snapshots = request.sources.map((source) =>
    verifySourceSnapshot(compileSourceSnapshot(source))
  );
  const orders = snapshots.map(({ sourceOrder }) => sourceOrder);
  if (new Set(orders).size !== orders.length) {
    throw failure('source_order_duplicate');
  }
  snapshots.sort((left, right) => left.sourceOrder - right.sourceOrder);
  if (snapshots.some((snapshot, index) => snapshot.sourceOrder !== index)) {
    throw failure('source_order_non_contiguous');
  }
  const artifactIds = snapshots.map(({ sourceArtifactId }) => sourceArtifactId);
  if (new Set(artifactIds).size !== artifactIds.length) {
    throw failure('source_identity_duplicate');
  }
  const hashOwners = new Map();
  for (const snapshot of snapshots) {
    const owner = hashOwners.get(snapshot.sourceSnapshotHash);
    if (owner && owner !== snapshot.sourceArtifactId) {
      throw failure('source_snapshot_identity_collision', {
        sourceSnapshotHash: snapshot.sourceSnapshotHash,
        sourceArtifactIds: [owner, snapshot.sourceArtifactId].sort(),
      });
    }
    hashOwners.set(snapshot.sourceSnapshotHash, snapshot.sourceArtifactId);
  }
  const identityRecords = snapshots.map((snapshot) => ({
    sourceOrder: snapshot.sourceOrder,
    sourceRole: snapshot.sourceRole,
    namespace: snapshot.namespace,
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
  }));
  return deepFreeze({
    schemaVersion: 'goal-contract-ordered-source-snapshot-set/v1',
    sourceSnapshots: snapshots,
    orderedSourceSnapshotSetHash: hashControlPlaneValue({
      schemaVersion: 'goal-contract-ordered-source-snapshot-set/v1',
      identityRecords,
    }),
  });
}

function verifyOrderedSourceSnapshotSet(snapshotSet) {
  if (
    !snapshotSet ||
    snapshotSet.schemaVersion !==
      'goal-contract-ordered-source-snapshot-set/v1' ||
    !Array.isArray(snapshotSet.sourceSnapshots) ||
    snapshotSet.sourceSnapshots.length === 0
  ) {
    throw failure('ordered_source_snapshot_set_invalid');
  }
  const snapshots = snapshotSet.sourceSnapshots.map(verifySourceSnapshot);
  if (snapshots.some((snapshot, index) => snapshot.sourceOrder !== index)) {
    throw failure('source_order_non_contiguous');
  }
  const expectedHash = hashControlPlaneValue({
    schemaVersion: snapshotSet.schemaVersion,
    identityRecords: snapshots.map((snapshot) => ({
      sourceOrder: snapshot.sourceOrder,
      sourceRole: snapshot.sourceRole,
      namespace: snapshot.namespace,
      sourceArtifactId: snapshot.sourceArtifactId,
      sourceSnapshotHash: snapshot.sourceSnapshotHash,
    })),
  });
  if (expectedHash !== snapshotSet.orderedSourceSnapshotSetHash) {
    throw failure('ordered_source_snapshot_set_hash_mismatch');
  }
  return snapshotSet;
}

module.exports = {
  compileOrderedSourceSnapshotSet,
  compileSourceSnapshot,
  verifyOrderedSourceSnapshotSet,
  verifySourceSnapshot,
};
