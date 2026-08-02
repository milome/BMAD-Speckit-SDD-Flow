const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileOrderedSourceSnapshotSet,
  compileSourceSnapshot,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function source(overrides = {}) {
  return {
    sourceKind: 'source_plan',
    sourceArtifactId: 'canonical-kernel-plan',
    sourceRole: 'primary_implementation_authority',
    namespace: 'PRIMARY',
    sourceOrder: 0,
    pathOrSegmentId: 'docs/plans/kernel.md',
    rawBytes: Buffer.from('# Kernel\r\n\n必须保留原文。\r\n', 'utf8'),
    ...overrides,
  };
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract canonical source snapshots', () => {
  it('compiles all source kinds with frozen original bytes and deterministic indexes', () => {
    const sourcePlan = compileSourceSnapshot(source());
    const conversation = compileSourceSnapshot({
      sourceKind: 'conversation_segment',
      sourceArtifactId: 'conversation-authority',
      sourceRole: 'primary_implementation_authority',
      namespace: 'PRIMARY',
      sourceOrder: 0,
      pathOrSegmentId: 'conversation:2026-07-29',
      segments: [
        {
          segmentId: 'SEG-B',
          segmentOrder: 1,
          rawBytes: Buffer.from('第二段\r\n', 'utf8'),
        },
        {
          segmentId: 'SEG-A',
          segmentOrder: 0,
          rawBytes: Buffer.from('第一段\r\n', 'utf8'),
        },
      ],
    });
    const confirmed = compileSourceSnapshot({
      sourceKind: 'confirmed_block',
      sourceArtifactId: 'confirmation-authority',
      sourceRole: 'primary_implementation_authority',
      namespace: 'PRIMARY',
      sourceOrder: 0,
      pathOrSegmentId: 'confirmation:CK',
      rawBytes: Buffer.from('confirmed: true\n', 'utf8'),
    });

    assert.equal(sourcePlan.schemaVersion, 'goal-contract-source-snapshot/v1');
    assert.equal(sourcePlan.encoding, 'utf8');
    assert.equal(sourcePlan.newlineStyle, 'mixed');
    assert.equal(
      sourcePlan.sourceBytes,
      Buffer.byteLength('# Kernel\r\n\n必须保留原文。\r\n')
    );
    assert.equal(
      Buffer.from(sourcePlan.frozenBytesBase64, 'base64').toString('utf8'),
      '# Kernel\r\n\n必须保留原文。\r\n'
    );
    assert.match(sourcePlan.sourceSnapshotHash, HASH_PATTERN);
    assert.match(sourcePlan.normalizedTextHash, HASH_PATTERN);
    assert.match(sourcePlan.compilerProvenanceHash, HASH_PATTERN);
    assert.ok(Object.isFrozen(sourcePlan));
    assert.ok(Object.isFrozen(sourcePlan.lineIndex));
    assert.deepEqual(
      conversation.segments.map(({ segmentId }) => segmentId),
      ['SEG-A', 'SEG-B']
    );
    assert.equal(
      Buffer.from(conversation.frozenBytesBase64, 'base64').toString('utf8'),
      '第一段\r\n第二段\r\n'
    );
    assert.equal(confirmed.sourceKind, 'confirmed_block');
  });

  it('keeps exact CRLF and LF hashes distinct while normalized hashes match', () => {
    const crlf = compileSourceSnapshot(
      source({ rawBytes: Buffer.from('alpha\r\nbeta\r\n', 'utf8') })
    );
    const lf = compileSourceSnapshot(
      source({ rawBytes: Buffer.from('alpha\nbeta\n', 'utf8') })
    );

    assert.notEqual(crlf.sourceSnapshotHash, lf.sourceSnapshotHash);
    assert.notEqual(crlf.exactByteHash, lf.exactByteHash);
    assert.equal(crlf.normalizedTextHash, lf.normalizedTextHash);
  });

  it('orders a composite source set by declared order, not input order', () => {
    const primary = source();
    const componentA = source({
      sourceArtifactId: 'bounded-reviewer-design',
      sourceRole: 'subordinate_component_specification',
      namespace: 'BCR',
      sourceOrder: 1,
      pathOrSegmentId: 'docs/superpowers/plans/bounded-reviewer.md',
      rawBytes: Buffer.from('BCR-C01\n', 'utf8'),
    });
    const componentB = source({
      sourceArtifactId: 'carrier-design',
      sourceRole: 'subordinate_component_specification',
      namespace: 'CARRIER',
      sourceOrder: 2,
      pathOrSegmentId: 'docs/plans/carrier.md',
      rawBytes: Buffer.from('CARRIER-C01\n', 'utf8'),
    });

    const first = compileOrderedSourceSnapshotSet({
      sources: [componentB, primary, componentA],
    });
    const second = compileOrderedSourceSnapshotSet({
      sources: [componentA, componentB, primary],
    });

    assert.deepEqual(
      first.sourceSnapshots.map(({ sourceArtifactId }) => sourceArtifactId),
      ['canonical-kernel-plan', 'bounded-reviewer-design', 'carrier-design']
    );
    assert.equal(
      stableControlPlaneStringify(first),
      stableControlPlaneStringify(second)
    );
    assert.equal(
      first.orderedSourceSnapshotSetHash,
      second.orderedSourceSnapshotSetHash
    );
    assert.match(first.orderedSourceSnapshotSetHash, HASH_PATTERN);
  });

  it('rejects invalid ordering and ambiguous source identities', () => {
    expectFailure(
      () =>
        compileOrderedSourceSnapshotSet({
          sources: [source({ sourceOrder: -1 })],
        }),
      'source_order_invalid'
    );
    expectFailure(
      () =>
        compileOrderedSourceSnapshotSet({
          sources: [
            source(),
            source({
              sourceArtifactId: 'component',
              namespace: 'BCR',
              sourceRole: 'subordinate_component_specification',
            }),
          ],
        }),
      'source_order_duplicate'
    );
    expectFailure(
      () =>
        compileOrderedSourceSnapshotSet({
          sources: [
            source(),
            source({
              sourceArtifactId: 'component',
              namespace: 'BCR',
              sourceRole: 'subordinate_component_specification',
              sourceOrder: 2,
            }),
          ],
        }),
      'source_order_non_contiguous'
    );
    expectFailure(
      () =>
        compileOrderedSourceSnapshotSet({
          sources: [
            source(),
            source({
              namespace: 'BCR',
              sourceRole: 'subordinate_component_specification',
              sourceOrder: 1,
              rawBytes: Buffer.from('different\n', 'utf8'),
            }),
          ],
        }),
      'source_identity_duplicate'
    );
    expectFailure(
      () =>
        compileOrderedSourceSnapshotSet({
          sources: [
            source(),
            source({
              sourceArtifactId: 'same-bytes-different-id',
              namespace: 'BCR',
              sourceRole: 'subordinate_component_specification',
              sourceOrder: 1,
            }),
          ],
        }),
      'source_snapshot_identity_collision'
    );
  });

  it('rejects missing authority metadata, unsupported kinds, and caller provenance', () => {
    expectFailure(
      () => compileSourceSnapshot(source({ sourceRole: undefined })),
      'source_role_missing'
    );
    expectFailure(
      () => compileSourceSnapshot(source({ namespace: undefined })),
      'source_namespace_missing'
    );
    expectFailure(
      () => compileSourceSnapshot(source({ sourceOrder: undefined })),
      'source_order_invalid'
    );
    expectFailure(
      () => compileSourceSnapshot(source({ sourceKind: 'web_page' })),
      'source_snapshot_type_unsupported'
    );
    expectFailure(
      () =>
        compileSourceSnapshot(
          source({ compilerProvenanceHash: `sha256:${'a'.repeat(64)}` })
        ),
      'source_snapshot_provenance_forbidden'
    );
  });
});
