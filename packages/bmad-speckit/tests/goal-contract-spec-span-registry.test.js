const assert = require('node:assert');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');

const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  compileSpecSpanRegistry,
  resolveSpecSpan,
} = require('../src/utils/goal-contract/control-plane/spec-span-registry.ts');
const {
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

function fixture() {
  return compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: 'primary-plan',
        sourceRole: 'primary_implementation_authority',
        namespace: 'PRIMARY',
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/primary.md',
        rawBytes: Buffer.from('## 标题\r\n- MUST keep 字节。\r\n', 'utf8'),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: 'bounded-reviewer-design',
        sourceRole: 'subordinate_component_specification',
        namespace: 'BCR',
        sourceOrder: 1,
        pathOrSegmentId: 'docs/plans/bcr.md',
        rawBytes: Buffer.from('BCR-C01: adversarial review\n', 'utf8'),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: 'carrier-design',
        sourceRole: 'subordinate_component_specification',
        namespace: 'CARRIER',
        sourceOrder: 2,
        pathOrSegmentId: 'docs/plans/carrier.md',
        rawBytes: Buffer.from('CARRIER-C01: host parity\n', 'utf8'),
      },
    ],
  });
}

function snapshotById(snapshotSet, sourceArtifactId) {
  return snapshotSet.sourceSnapshots.find(
    (snapshot) => snapshot.sourceArtifactId === sourceArtifactId
  );
}

function spanRequest(snapshot, text, sourceObligationIds, headingPath = []) {
  const frozen = Buffer.from(snapshot.frozenBytesBase64, 'base64');
  const exact = Buffer.from(text, 'utf8');
  const startByte = frozen.indexOf(exact);
  assert.notEqual(startByte, -1);
  return {
    sourceArtifactId: snapshot.sourceArtifactId,
    sourceSnapshotHash: snapshot.sourceSnapshotHash,
    namespace: snapshot.namespace,
    startByte,
    endByteExclusive: startByte + exact.length,
    expectedExactTextHash: sha256(exact),
    expectedNormalizedTextHash: sha256(
      Buffer.from(normalizeLineEndings(text), 'utf8')
    ),
    headingPath,
    sourceObligationIds,
  };
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract unified SpecSpan registry', () => {
  it('compiles source-bound spans deterministically across input permutations', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const bcr = snapshotById(snapshotSet, 'bounded-reviewer-design');
    const carrier = snapshotById(snapshotSet, 'carrier-design');
    const spans = [
      spanRequest(primary, 'MUST keep 字节。', ['CK02-AC02'], ['Kernel']),
      spanRequest(bcr, 'BCR-C01', ['BCR-C01'], ['Requirements']),
      spanRequest(carrier, 'host parity', ['CARRIER-C01'], ['Carrier']),
    ];

    const first = compileSpecSpanRegistry({
      orderedSourceSnapshotSet: snapshotSet,
      spans: [spans[2], spans[0], spans[1]],
    });
    const second = compileSpecSpanRegistry({
      orderedSourceSnapshotSet: snapshotSet,
      spans: [spans[1], spans[2], spans[0]],
    });

    assert.equal(
      stableControlPlaneStringify(first),
      stableControlPlaneStringify(second)
    );
    assert.equal(first.specSpanRegistryHash, second.specSpanRegistryHash);
    assert.match(first.specSpanRegistryHash, HASH_PATTERN);
    assert.deepEqual(
      first.specSpans.map(({ sourceArtifactId }) => sourceArtifactId),
      ['primary-plan', 'bounded-reviewer-design', 'carrier-design']
    );
    for (const span of first.specSpans) {
      assert.match(span.specSpanId, /^spec-span-[0-9a-f]{64}$/u);
      assert.match(span.exactTextHash, HASH_PATTERN);
      assert.match(span.normalizedTextHash, HASH_PATTERN);
      assert.equal(typeof span.startLine, 'number');
      assert.equal(typeof span.startColumn, 'number');
      assert.equal(typeof span.endLine, 'number');
      assert.equal(typeof span.endColumn, 'number');
      assert.ok(Object.isFrozen(span));
    }
  });

  it('resolves exact Chinese and ASCII text from frozen source bytes', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const bcr = snapshotById(snapshotSet, 'bounded-reviewer-design');
    const registry = compileSpecSpanRegistry({
      orderedSourceSnapshotSet: snapshotSet,
      spans: [
        spanRequest(primary, 'MUST keep 字节。', ['CK02-AC02']),
        spanRequest(bcr, 'adversarial review', ['BCR-C01']),
      ],
    });

    const chinese = resolveSpecSpan({
      registry,
      specSpanId: registry.specSpans[0].specSpanId,
      currentSources: [
        {
          sourceArtifactId: primary.sourceArtifactId,
          rawBytes: Buffer.from(primary.frozenBytesBase64, 'base64'),
        },
      ],
    });
    const ascii = resolveSpecSpan({
      registry,
      specSpanId: registry.specSpans[1].specSpanId,
    });

    assert.equal(chinese.exactText, 'MUST keep 字节。');
    assert.equal(chinese.stale, false);
    assert.equal(chinese.staleSourceArtifactId, null);
    assert.equal(ascii.exactText, 'adversarial review');
  });

  it('returns frozen original text and identifies the exact stale source', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const bcr = snapshotById(snapshotSet, 'bounded-reviewer-design');
    const registry = compileSpecSpanRegistry({
      orderedSourceSnapshotSet: snapshotSet,
      spans: [
        spanRequest(primary, 'MUST keep 字节。', ['CK02-AC04']),
        spanRequest(bcr, 'BCR-C01', ['BCR-C01']),
      ],
    });

    for (const span of registry.specSpans) {
      const resolved = resolveSpecSpan({
        registry,
        specSpanId: span.specSpanId,
        currentSources: [
          {
            sourceArtifactId: span.sourceArtifactId,
            rawBytes: Buffer.from('mutated source\n', 'utf8'),
          },
        ],
      });
      assert.equal(resolved.stale, true);
      assert.equal(resolved.staleSourceArtifactId, span.sourceArtifactId);
      assert.notEqual(resolved.exactText, 'mutated source');
    }
  });

  it('rejects invalid ranges, UTF-8 splits, and hash tamper', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const valid = spanRequest(primary, '字节', ['CK02-AC03']);
    const frozen = Buffer.from(primary.frozenBytesBase64, 'base64');
    const chineseStart = frozen.indexOf(Buffer.from('字', 'utf8'));

    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [
            {
              ...valid,
              startByte: chineseStart + 1,
              endByteExclusive: chineseStart + 4,
              expectedExactTextHash: undefined,
              expectedNormalizedTextHash: undefined,
            },
          ],
        }),
      'spec_span_utf8_boundary_invalid'
    );
    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [{ ...valid, endByteExclusive: frozen.length + 1 }],
        }),
      'spec_span_range_invalid'
    );
    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [
            { ...valid, expectedExactTextHash: `sha256:${'a'.repeat(64)}` },
          ],
        }),
      'spec_span_exact_hash_mismatch'
    );
    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [
            { ...valid, expectedNormalizedTextHash: `sha256:${'b'.repeat(64)}` },
          ],
        }),
      'spec_span_normalized_hash_mismatch'
    );
  });

  it('rejects cross-source substitution and caller-authored provenance', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const bcr = snapshotById(snapshotSet, 'bounded-reviewer-design');
    const valid = spanRequest(primary, 'MUST', ['CK02-AC08']);

    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [{ ...valid, sourceArtifactId: bcr.sourceArtifactId }],
        }),
      'spec_span_source_identity_mismatch'
    );
    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [{ ...valid, namespace: 'BCR' }],
        }),
      'spec_span_namespace_mismatch'
    );
    expectFailure(
      () =>
        compileSpecSpanRegistry({
          orderedSourceSnapshotSet: snapshotSet,
          spans: [{ ...valid, sourceRole: 'primary_implementation_authority' }],
        }),
      'spec_span_provenance_forbidden'
    );
  });

  it('fails closed when registry source bytes or span bindings are missing or changed', () => {
    const snapshotSet = fixture();
    const primary = snapshotById(snapshotSet, 'primary-plan');
    const registry = compileSpecSpanRegistry({
      orderedSourceSnapshotSet: snapshotSet,
      spans: [spanRequest(primary, 'MUST', ['CK02-AC03'])],
    });
    const missingBytes = structuredClone(registry);
    delete missingBytes.sourceSnapshots[0].frozenBytesBase64;
    const wrongSnapshot = structuredClone(registry);
    wrongSnapshot.specSpans[0].sourceSnapshotHash = `sha256:${'c'.repeat(64)}`;

    expectFailure(
      () =>
        resolveSpecSpan({
          registry: missingBytes,
          specSpanId: missingBytes.specSpans[0].specSpanId,
        }),
      'spec_span_frozen_bytes_missing'
    );
    expectFailure(
      () =>
        resolveSpecSpan({
          registry: wrongSnapshot,
          specSpanId: wrongSnapshot.specSpans[0].specSpanId,
        }),
      'spec_span_source_hash_mismatch'
    );
  });
});
