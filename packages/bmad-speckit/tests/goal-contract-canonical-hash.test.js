const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  canonicalizeControlPlaneValue,
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

describe('goal-contract canonical control-plane hashing', () => {
  it('canonicalizes object permutations without changing UTF-8 text', () => {
    const first = {
      z: '中文\r\ncafe\u0301',
      nested: { beta: true, alpha: 1 },
    };
    const second = {
      nested: { alpha: 1, beta: true },
      z: '中文\r\ncafe\u0301',
    };

    const firstBytes = stableControlPlaneStringify(first);
    const secondBytes = stableControlPlaneStringify(second);
    assert.equal(firstBytes, secondBytes);
    assert.equal(Buffer.from(firstBytes, 'utf8').equals(Buffer.from(secondBytes, 'utf8')), true);
    assert.equal(JSON.parse(firstBytes).z, first.z);
    assert.equal(hashControlPlaneValue(first), hashControlPlaneValue(second));
    assert.match(hashControlPlaneValue(first), HASH_PATTERN);
  });

  it('preserves ordered arrays and sorts only registered set-like arrays', () => {
    const value = {
      stages: ['verify', 'compile'],
      participants: [
        { id: 'z', role: 'consumer' },
        { id: 'a', role: 'owner' },
      ],
    };
    const options = {
      setLikeArrays: [{ path: '/participants', identityFields: ['id'] }],
    };

    const canonical = canonicalizeControlPlaneValue(value, options);
    assert.deepEqual(canonical.stages, ['verify', 'compile']);
    assert.deepEqual(canonical.participants.map(({ id }) => id), ['a', 'z']);
    assert.deepEqual(canonicalizeControlPlaneValue(value).participants, value.participants);
  });

  it('rejects unsupported values, sparse arrays, cycles, and custom prototypes', () => {
    const sparse = [];
    sparse[1] = 'value';
    const cyclic = {};
    cyclic.self = cyclic;
    const customPrototype = Object.create({ inherited: true });
    customPrototype.value = 1;
    const unsupported = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Date(),
      new Map(),
      new Set(),
      () => true,
      Symbol('value'),
      1n,
      sparse,
      cyclic,
      customPrototype,
      { nested: undefined },
    ];

    for (const value of unsupported) {
      assert.throws(
        () => stableControlPlaneStringify(value),
        (error) => error.failureClass === 'canonical_value_unsupported'
      );
    }
  });

  it('hashes and verifies receipt payloads without trusting an expected hash', () => {
    const payload = {
      writerIdentity: 'canonical-kernel/v1',
      monotonicSequence: 1,
      orderedInputHashes: ['sha256:' + 'a'.repeat(64)],
      receiptHash: 'ignored-while-hashing',
    };
    const receiptHash = hashReceiptPayload(payload);
    const receipt = { ...payload, receiptHash };

    assert.match(receiptHash, HASH_PATTERN);
    assert.equal(hashReceiptPayload({ ...payload, receiptHash: 'different' }), receiptHash);
    assert.equal(verifyReceiptSelfHash(receipt), true);
    assert.equal(
      verifyReceiptSelfHash({ ...receipt, monotonicSequence: 2 }),
      false
    );
    assert.throws(
      () => verifyReceiptSelfHash(receipt, { expectedHash: receiptHash }),
      (error) =>
        error.failureClass === 'canonical_value_unsupported' &&
        error.reason === 'caller_expected_hash_forbidden'
    );
  });
});
