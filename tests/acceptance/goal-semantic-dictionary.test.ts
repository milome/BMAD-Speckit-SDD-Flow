import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sha256Stable, stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  decodeGoalSemanticDictionary as decode,
  encodeGoalSemanticDictionary as encode,
  GOAL_SEMANTIC_DICTIONARY_PROTOCOL,
  GOAL_DICTIONARY_MAX_DEPTH as MAX_DEPTH,
  GOAL_DICTIONARY_MAX_EXPANDED_BYTES as MAX_BYTES,
  GOAL_DICTIONARY_MAX_OBJECT_ENTRIES as MAX_ENTRIES,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
const require = createRequire(import.meta.url);
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });
const { buildSourceSnapshot } = require('../../packages/bmad-speckit/src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../../packages/bmad-speckit/src/utils/goal-contract/source-obligation-extractor.ts');
const { typedSourceObligation } = require('../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-normative-roles.ts');
const { standaloneTechnicalSnapshot } = require('../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-technical-snapshot.ts');
const { compileStandaloneGoalSemanticIR } = require('../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir.ts');
const { runStandaloneGoalInternalSemanticGate } = require('../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate.ts');
const commonCodec = require('../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary.ts');

const raw = (nodes: unknown[], root = nodes.length - 1) => ({
  schemaVersion: 'GoalSemanticDictionary/v1', nodes, root,
  expandedBytes: 2, expandedHash: sha256Stable([]),
});
const depthValue = (depth: number) => {
  let value: unknown = [];
  for (let index = 1; index < depth; index++) value = [value];
  return value;
};

describe('GoalSemanticDictionary/v1 lossless bounded codec', () => {
  it.each([null, false, true, 0, -0, 1.25, '', 'ASCII', '\u4e2d\u6587 \u{1f680}', '\ud800'])(
    'round-trips a JSON scalar %# with canonical hash identity', (value) => {
      const dictionary = encode(value);
      expect(stableStringify(decode(dictionary))).toBe(stableStringify(value));
      expect(dictionary.expandedHash).toBe(sha256Stable(value));
      expect(dictionary.expandedBytes).toBe(Buffer.byteLength(stableStringify(value)));
    }
  );

  it('sorts keys deterministically, including integer-like keys and nested arrays', () => {
    const first = { z: [{ b: 2, a: null }], '10': true, '2': '\u4e2d\u6587' };
    const second = { '2': '\u4e2d\u6587', '10': true, z: [{ a: null, b: 2 }] };
    expect(encode(first)).toEqual(encode(second));
    expect(decode(encode(first))).toEqual(first);
    expect(encode(decode(encode(first)))).toEqual(encode(first));
  });

  it('interns repeated structures but expands independent JSON objects', () => {
    const item = { text: 'preserve conditions and proof', refs: ['SPAN-001', 'SPAN-002'] };
    const value = Array.from({ length: 10_000 }, () => ({ ...item, refs: [...item.refs] }));
    const dictionary = encode(value);
    expect(dictionary.nodes.length).toBeLessThan(12);
    expect(Buffer.byteLength(JSON.stringify(dictionary))).toBeLessThan(30_000);
    const decoded = decode(dictionary) as typeof value;
    expect(decoded).toEqual(value);
    expect(decoded[0]).not.toBe(decoded[1]);
    expect(decoded[0].refs).not.toBe(decoded[1].refs);
  });

  it('front-codes only smaller strings and preserves a prefix splitting a non-BMP pair', () => {
    const prefix = 'a'.repeat(200);
    const value = [`${prefix}\u{1f680}x`, `${prefix}\u{1f681}x`, 'tiny'];
    const dictionary = encode(value);
    const rope = dictionary.nodes.find((node) => typeof node === 'string' && node.startsWith('=')) as string;
    expect(rope.split(':')[0].split('.')[1]).toBe((201).toString(36));
    expect(rope.slice(rope.indexOf(':') + 1)).toBe('\ude81x');
    expect(dictionary.nodes).toContain('tiny');
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
  });

  it('reuses object shapes without losing keys, values or independent object identities', () => {
    const value = Array.from({ length: 40 }, (_, index) => ({
      condition: `condition-${index}`, effect: `effect-${index}`, proof: `proof-${index}`, source: `source-${index}`,
    }));
    const dictionary = encode(value);
    expect(dictionary.nodes.some((node) => Array.isArray(node) ? node[0] === 3 : typeof node === 'string' && /^(?:~3[.:]|#)/u.test(node))).toBe(true);
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
  });

  it('encodes only differing object values against a prior object with the same shape', () => {
    const value = Array.from({ length: 50 }, (_, index) => ({
      applicability: 'all', condition: 'required', effect: 'preserve', index, proof: 'source', source: 'declared',
    }));
    const dictionary = encode(value);
    expect(dictionary.nodes.some((node) => Array.isArray(node) ? [4, 8].includes(node[0] as number)
      : typeof node === 'string' && /^(?:~[48][.:]|[%^])/u.test(node))).toBe(true);
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
  });

  it('shares embedded string fragments without changing Unicode or literal tuple-looking strings', () => {
    const fragment = 'shared source text with conditions and evidence '.repeat(5);
    const value = [`longest-source-header:${fragment}:footer`, `copy:${fragment}:changed`, '[5,0,0,3]', '\u{1f680}'];
    const dictionary = encode(value);
    expect(dictionary.nodes.some((node) => Array.isArray(node) && node[0] === 5)).toBe(true);
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
    expect(GOAL_SEMANTIC_DICTIONARY_PROTOCOL).toContain('[5,...parts]');
    const unicode = '\u{1f680}';
    const fragmented = { ...raw([unicode, [5, 0, 0, 1, '\ude80']]),
      expandedBytes: Buffer.byteLength(JSON.stringify(unicode)), expandedHash: sha256Stable(unicode) };
    expect(decode(fragmented)).toBe(unicode);
  });

  it('derives exact UTF-8 text hashes only when the full preimage is present', () => {
    const text = 'Exact \u4e2d\u6587 \u{1f680} text\n';
    const digest = createHash('sha256').update(text, 'utf8').digest('hex');
    const value = { text, hash: `sha256:${digest}`, identity: `CLAUSE-${digest}`, unrelated: `sha256:${'1'.repeat(64)}` };
    const dictionary = encode(value);
    expect(dictionary.nodes.filter((node) => typeof node === 'string' && node.startsWith('&'))).toHaveLength(2);
    expect(dictionary.nodes.some((node) => typeof node === 'string' && node.startsWith('$'))).toBe(true);
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
    const changed = structuredClone(dictionary);
    const derivedIndex = changed.nodes.findIndex((node) => typeof node === 'string' && node.startsWith('&'));
    const derived = changed.nodes[derivedIndex] as string;
    changed.nodes[derivedIndex] = `&${derived.slice(1).split('.')[0]}:MODIFY-`;
    expect(() => decode(changed)).toThrow(/expanded_bytes_mismatch|hash_mismatch|unused_nodes/);
  });

  it('uses versioned base36 integer tuples without interpreting literal strings', () => {
    const value = Array.from({ length: 3000 }, (_, index) => ({ index, values: [index, index + 1, index + 2, index + 3] }));
    const dictionary = encode(value);
    expect(dictionary.nodes.some((node) => typeof node === 'string' && /^[!@#%^]/u.test(node))).toBe(true);
    expect(decode(dictionary)).toEqual(value);
    expect(decode(encode('b36v1:0.0'))).toBe('b36v1:0.0');
    const literals = ['~0.0', '~~literal', '~', '~unsupported', '', '!0', '@title', '#heading', '^ref', '%value', '$price', '&value:prefix', '=x.0:suffix'];
    expect(decode(encode(literals))).toEqual(literals);
    const literal = '~0.0';
    expect(decode({ ...raw([literal]), expandedBytes: Buffer.byteLength(JSON.stringify(literal)), expandedHash: sha256Stable(literal) })).toBe(literal);
    expect(() => decode({ ...dictionary, nodeEncoding: 'unknown-v2' })).toThrow(/node_encoding/);
    for (const node of ['~0:0', '~0:-1', '~0:01', '~0.0', '~2.0', '~0.zzzzzzzzzzzzzzzz']) {
      expect(() => decode({ ...raw([node]), nodeEncoding: dictionary.nodeEncoding })).toThrow(/reference|compact/);
    }
  });

  it('compresses identity digests without changing ordinary text or accepting noncanonical base64url', () => {
    const hex = 'a1'.repeat(32);
    const value = [`SPEC-SPAN-${hex}`, `CLAUSE-${hex}`, `ordinary text ${hex}`, hex, `UPPER-${hex.toUpperCase()}`,
      `source-block-${hex}:clause-1`, `source-block-${hex}:clause-2`, `spec-span-${hex}`];
    const dictionary = encode(value);
    expect(dictionary.nodes.filter((node) => typeof node === 'string' && node.startsWith('$'))).toHaveLength(4);
    expect(dictionary.nodes).toContain(value[2]);
    expect(decode(dictionary)).toEqual(value);
    expect(encode(decode(dictionary))).toEqual(dictionary);
    const badBits = `${'A'.repeat(42)}B`;
    expect(() => decode(raw(['sha256:', [9, 0, badBits]]))).toThrow(/identity_encoding/);
    const changed = structuredClone(dictionary);
    const identityIndex = changed.nodes.findIndex((node) => typeof node === 'string' && node.startsWith('$'));
    const identity = changed.nodes[identityIndex] as string;
    changed.nodes[identityIndex] = identity.slice(0, identity.indexOf('.') + 1) + 'A'.repeat(43);
    expect(() => decode(changed)).toThrow(/hash_mismatch/);
  });

  it.each([undefined, NaN, Infinity, -Infinity, 1n, Symbol('x'), () => 1, new Date(), new Map(), new Set(), [undefined, 1]])(
    'rejects non-JSON input %#', (value) => expect(() => encode(value)).toThrow(/non_json/)
  );

  it('rejects cycles, inherited state, symbol keys, getters and pollution keys without invoking accessors', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => encode(cyclic)).toThrow(/cycle/);
    expect(() => encode(Object.create({ inherited: true }))).toThrow(/non_json/);
    expect(() => encode({ [Symbol('key')]: 1 })).toThrow(/non_json/);
    const getter = vi.fn(() => 1);
    expect(() => encode(Object.defineProperty({}, 'x', { get: getter, enumerable: true }))).toThrow(/non_json/);
    expect(getter).not.toHaveBeenCalled();
    const trap = vi.fn(() => Object.prototype);
    const proxy = new Proxy({}, { getPrototypeOf: trap });
    expect(() => encode(proxy)).toThrow(/non_json/);
    expect(() => decode(proxy)).toThrow(/non_json/);
    expect(trap).not.toHaveBeenCalled();
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    expect(() => encode(revoked.proxy)).toThrow(/non_json/);
    expect(() => decode(revoked.proxy)).toThrow(/non_json/);
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      const object = JSON.parse(`{"${key}":{"polluted":true}}`);
      expect(() => encode(object)).toThrow(/unsafe_key/);
      expect(() => decode(raw([key, true, [1, 0, 1]]))).toThrow(/unsafe_key/);
    }
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it.each([
    [raw([[0]], -1), 'root'], [raw([[0]], 0.5), 'root'],
    [raw([[0, 0]]), 'reference'], [raw([[0, 1], [0, 0]]), 'reference'],
    [raw([[0, -1]]), 'reference'], [raw([[0, 0.5]]), 'reference'],
    [raw([[99]]), 'tag'], [raw([[1, 0]]), 'object_shape'],
    [raw([[2]]), 'string_shape'], [raw([0, [2, 0, 0, 'x']]), 'string_reference'],
    [raw(['a', [2, 0, 2, 'x']]), 'string_reference'],
    [raw(['a', [2, 0, -1, 'x']]), 'string_reference'],
    [raw(['a', [2, 0, 0.5, 'x']]), 'string_reference'],
    [raw(['a', [2, 0, 1, 3]]), 'string_reference'],
    [raw(['a', [2, 1, 1, 'x']]), 'reference'],
    [raw([[3]]), 'reference'], [raw([[3, 0]]), 'reference'],
    [raw(['x', [3, 0, 0]]), 'object_shape'],
    [raw(['x', [0, 0], [3, 1]]), 'object_shape'],
    [raw([true, [0, 0], [3, 1, 0]]), 'object_key'],
    [raw(['x', [0, 0, 0], [3, 1, 0, 0]]), 'duplicate_key'],
    [raw(['z', 'a', [0, 0, 1], [3, 2, 0, 1]]), 'key_order'],
    [raw(['__proto__', [0, 0], [3, 1, 0]]), 'unsafe_key'],
    [raw([[4]]), 'overlay_shape'], [raw([[4, 0, 0, 0]]), 'reference'],
    [raw(['x', [4, 0, 0, 0]]), 'overlay_reference'],
    [raw(['x', 'y', true, [1, 0, 2], [4, 3, 1, 2]]), 'overlay_key'],
    [raw(['x', true, [1, 0, 1], [4, 2, 0, 1, 0, 1]]), 'overlay_key_order'],
    [raw([[5]]), 'fragment_shape'], [raw([[5, 0, 0, 1]]), 'reference'],
    [raw(['x', [5, 0]]), 'fragment_reference'], [raw([true, [5, 0, 0, 1]]), 'fragment_reference'],
    [raw(['x', [5, 0, -1, 1]]), 'fragment_reference'], [raw(['x', [5, 0, 0, -1]]), 'fragment_reference'],
    [raw(['x', [5, 0, 0.5, 1]]), 'fragment_reference'], [raw(['x', [5, 0, 0, 2]]), 'fragment_reference'],
    [raw([[6]]), 'derived_shape'], [raw([[6, 0, '']]), 'reference'],
    [raw([true, [6, 0, '']]), 'derived_preimage'],
    [raw(['x', [6, 0, '', 1]]), 'derived_shape'],
    [raw([[7]]), 'compact_shape'], [raw([[7, 'b36v2:0']]), 'compact_shape'],
    [raw([[7, 'b36v1:0.-1']]), 'compact_shape'], [raw([[7, 'b36v1:0.00']]), 'compact_shape'],
    [raw([[7, 'b36v1:2.0']]), 'compact_shape'], [raw([[7, 'b36v1:0.0']]), 'reference'],
    [raw([[7, 'b36v1:0.zzzzzzzzzzzzzzzz']]), 'compact_reference'],
    [raw([[8]]), 'overlay_shape'], [raw([[8, 0, 0, 0]]), 'reference'],
    [raw(['x', true, [1, 0, 1], [8, 2, -1, 1]]), 'overlay_slot'],
    [raw(['x', true, [1, 0, 1], [8, 2, 1, 1]]), 'overlay_slot'],
    [raw(['x', true, [1, 0, 1], [8, 2, 0.5, 1]]), 'overlay_slot'],
    [raw(['x', true, [1, 0, 1], [8, 2, 0, 1, 0, 1]]), 'overlay_key_order'],
    [raw([[9]]), 'identity_shape'], [raw([[9, 0, 'A'.repeat(43)]]), 'reference'],
    [raw([true, [9, 0, 'A'.repeat(43)]]), 'identity_prefix'],
    [raw(['sha256:', [9, 0, 'A'.repeat(44)]]), 'identity_shape'],
    [raw([false, null, [1, 0, 1]]), 'object_key'],
    [raw(['x', true, [1, 0, 1, 0, 1]]), 'duplicate_key'],
    [raw(['z', 'a', true, [1, 0, 2, 1, 2]]), 'key_order'],
    [raw([null, [0]]), 'unused_nodes'], [raw([{}]), 'node'],
  ])('rejects malformed dictionary %# before expansion', (dictionary, code) => {
    expect(() => decode(dictionary)).toThrow(`goal_semantic_dictionary_${code}`);
  });

  it('rejects version, unknown fields, sparse nodes and content/hash/byte-count tampering', () => {
    const dictionary = encode({ proof: 'source-declared', count: 2 });
    expect(() => decode({ ...dictionary, schemaVersion: 'GoalSemanticDictionary/v9' })).toThrow(/version/);
    expect(() => decode({ ...dictionary, ignored: true })).toThrow(/shape/);
    expect(() => decode(raw(new Array(2)))).toThrow(/non_json/);
    expect(() => decode({ ...dictionary, expandedBytes: dictionary.expandedBytes + 1 })).toThrow(/expanded_bytes_mismatch/);
    expect(() => decode({ ...dictionary, expandedHash: `sha256:${'0'.repeat(64)}` })).toThrow(/hash_mismatch/);
    const changed = structuredClone(dictionary);
    changed.nodes[changed.nodes.indexOf(2)] = 3;
    expect(() => decode(changed)).toThrow(/hash_mismatch/);
    const getter = vi.fn();
    expect(() => decode({ ...dictionary, expandedHash: { toString: getter } })).toThrow(/hash/);
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects exponential DAG expansion before allocating decoded values', () => {
    const nodes: unknown[] = ['x'];
    for (let index = 1; index < 32; index++) nodes.push([0, index - 1, index - 1]);
    expect(() => decode(raw(nodes))).toThrow(/expanded_bytes_exceeded/);
  });

  it('bounds cumulative object-entry metadata before expanding a wide overlay fan-out', () => {
    const width = 1024;
    const count = MAX_ENTRIES / width;
    const keys = Array.from({ length: width }, (_, index) => `k${String(index).padStart(4, '0')}`);
    const nodes: unknown[] = [...keys, false];
    const base = nodes.length;
    nodes.push([1, ...keys.flatMap((_, index) => [index, width])]);
    const overlays: number[] = [];
    for (let index = 0; index < count; index++) { overlays.push(nodes.length); nodes.push([8, base, 0, width]); }
    nodes.push([0, ...overlays]);
    expect(() => decode(raw(nodes))).toThrow(/object_entries_exceeded/);
    const template = Object.fromEntries(keys.map((key) => [key, false]));
    const value = Array.from({ length: count + 1 }, (_, index) => ({ ...template, k0000: index }));
    expect(() => encode(value)).toThrow(/object_entries_exceeded/);
  });

  it('enforces the fixed depth limit on encode and decode, including empty containers', () => {
    expect(decode(encode(depthValue(MAX_DEPTH)))).toEqual(depthValue(MAX_DEPTH));
    expect(() => encode(depthValue(MAX_DEPTH + 1))).toThrow(/max_depth_exceeded/);
    const nodes: unknown[] = [[0]];
    for (let index = 1; index <= MAX_DEPTH; index++) nodes.push([0, index - 1]);
    expect(() => decode(raw(nodes))).toThrow(/max_depth_exceeded/);
    const ropes: unknown[] = ['x'];
    for (let index = 1; index <= MAX_DEPTH + 1; index++) ropes.push([2, index - 1, 1, '']);
    expect(() => decode(raw(ropes))).toThrow(/max_depth_exceeded/);
    const fragments: unknown[] = ['x'];
    for (let index = 1; index <= MAX_DEPTH + 1; index++) fragments.push([5, index - 1, 0, 1]);
    expect(() => decode(raw(fragments))).toThrow(/max_depth_exceeded/);
    const overlays: unknown[] = ['x', true, [1, 0, 1]];
    for (let index = 0; index <= MAX_DEPTH; index++) overlays.push([4, overlays.length - 1, 0, 1]);
    expect(() => decode(raw(overlays))).toThrow(/max_depth_exceeded/);
  });

  it.each([-1, 0, 1])('measures the actual UTF-8 expansion boundary at limit%+d', (delta) => {
    const value = 'x'.repeat(MAX_BYTES - 2 + delta);
    if (delta > 0) {
      expect(() => encode(value)).toThrow(/expanded_bytes_exceeded/);
      expect(() => decode(raw([value]))).toThrow(/expanded_bytes_exceeded/);
    } else {
      const dictionary = encode(value);
      expect(dictionary.expandedBytes).toBe(MAX_BYTES + delta);
      expect(decode(dictionary)).toBe(value);
    }
  });

  it('round-trips the frozen real source and measures the complete production candidate against the unchanged budget', () => {
    const sourcePath = path.resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md');
    const sourceBytes = readFileSync(sourcePath);
    const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
    expect(sourceBytes.length).toBe(214296);
    expect(sourceHash).toBe('06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
    new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
    const extracted = extractSourceObligations({ snapshot: buildSourceSnapshot({ sourceType: 'source_plan',
      sourcePath: 'test-only/real-source-plan-20260904.md', rawBytes: sourceBytes }) });
    const value = extracted.sourceObligations;
    const dictionary = encode(value);
    const encodedBytes = Buffer.byteLength(JSON.stringify(dictionary));
    expect(sha256Stable(decode(dictionary))).toBe(sha256Stable(value));
    const typed = value.map((row: Record<string, unknown>) => typedSourceObligation({ ...row, requiredOutcome: row.exactText }));
    const typedDictionary = encode(typed);
    expect(sha256Stable(decode(typedDictionary))).toBe(sha256Stable(typed));
    const clauses = extracted.sourceBlocks.flatMap((block: { clauses: unknown[] }) => block.clauses);
    const clauseDictionary = encode(clauses);
    expect(sha256Stable(decode(clauseDictionary))).toBe(sha256Stable(clauses));
    const nodeCosts = (nodes: ReturnType<typeof encode>['nodes']) => {
      const costs: Record<string, { count: number; bytes: number }> = {};
      for (const node of nodes) {
        const kind = Array.isArray(node) ? `tag${node[0]}` : typeof node;
        costs[kind] ??= { count: 0, bytes: 0 };
        costs[kind].count++;
        costs[kind].bytes += Buffer.byteLength(JSON.stringify(node)) + 1;
      }
      return costs;
    };
    let fullPayload: Record<string, unknown> | undefined;
    let fullDictionary: ReturnType<typeof encode> | undefined;
    const originalEncode = commonCodec.encodeGoalSemanticDictionary;
    const observer = vi.spyOn(commonCodec, 'encodeGoalSemanticDictionary').mockImplementation((input) => {
      fullPayload = input as Record<string, unknown>;
      fullDictionary = originalEncode(input);
      return fullDictionary;
    });
    let candidateStatus = 'blocked';
    let candidateBytes = 0;
    let candidateIssue: string | null = null;
    let internalGate: {
      decision: string;
      gateHash: string;
      metrics: { candidateBytes: number; [key: string]: unknown };
    } | undefined;
    const rows = value.map((row: Record<string, unknown>) => ({ ...row, requiredOutcome: row.exactText }));
    const semanticInput = { sourcePlanHash: extracted.sourcePlanHash,
      sourceSnapshotHash: extracted.sourceSnapshotHash, sourceObligations: rows,
      technicalSnapshot: standaloneTechnicalSnapshot(extracted, rows), logicalSpecSpans: rows.flatMap((row: Record<string, unknown>) =>
        (row.specSpanRefs as string[]).map((specSpanId) => ({ specSpanId, boundObligationIds: [row.id], evidenceClaimRefs: [] }))) };
    try {
      const candidate = compileStandaloneGoalSemanticIR(semanticInput);
      candidateBytes = Buffer.byteLength(`${stableStringify(candidate)}\n`);
      internalGate = runStandaloneGoalInternalSemanticGate(semanticInput, candidate);
      candidateStatus = 'compiled';
    } catch (error) {
      const failure = error as { failureClass?: string; message: string; totalBytes?: number;
        issueCodes?: string[]; gate?: { metrics?: { candidateBytes?: number } } };
      candidateIssue = failure.issueCodes?.join(',') ?? failure.failureClass ?? failure.message;
      candidateBytes = failure.gate?.metrics?.candidateBytes ?? failure.totalBytes ?? 0;
    } finally {
      observer.mockRestore();
    }
    expect(fullPayload).toBeDefined();
    expect(fullDictionary).toBeDefined();
    expect(sha256Stable(decode(fullDictionary))).toBe(sha256Stable(fullPayload));
    const payloadCosts = Object.fromEntries(Object.entries(fullPayload!).map(([key, item]) => {
      const encoded = encode(item);
      return [key, { expandedBytes: encoded.expandedBytes, encodedBytes: Buffer.byteLength(JSON.stringify(encoded)),
        entries: Array.isArray(item) ? item.length : null }];
    }));
    const registryPressure = encode({ ...fullPayload, logicalSpecSpans: extracted.specSpanRegistry.specSpans });
    const stringFields: Record<string, { count: number; bytes: number }> = {};
    const seenStrings = new Set<string>();
    const measureStrings = (item: unknown, key: string): void => {
      if (typeof item === 'string' && !seenStrings.has(item)) {
        seenStrings.add(item);
        stringFields[key] ??= { count: 0, bytes: 0 };
        stringFields[key].count++;
        stringFields[key].bytes += Buffer.byteLength(JSON.stringify(item));
      } else if (Array.isArray(item)) item.forEach((child) => measureStrings(child, key));
      else if (item && typeof item === 'object') Object.entries(item).forEach(([field, child]) => measureStrings(child, field));
    };
    measureStrings(fullPayload, 'root');
    const derivedHashes = new Set<string>();
    for (const text of seenStrings) {
      derivedHashes.add(`sha256:${createHash('sha256').update(text).digest('hex')}`);
      derivedHashes.add(sha256Stable(text));
    }
    const presentHashes = [...seenStrings].filter((text) => /^sha256:[a-f0-9]{64}$/u.test(text));
    const reconstructibleHashes = presentHashes.filter((hash) => derivedHashes.has(hash));
    const measurement = { evidenceClass: 'lossless-codec-not-semantic-oracle-or-governed-acceptance',
      sourceHash, sourceBytes: sourceBytes.length, obligations: value.length,
      expandedBytes: dictionary.expandedBytes, encodedBytes, nodes: dictionary.nodes.length,
      typedExpandedBytes: typedDictionary.expandedBytes, typedEncodedBytes: Buffer.byteLength(JSON.stringify(typedDictionary)),
      typedNodeCosts: nodeCosts(typedDictionary.nodes),
      candidateStatus, candidateBytes, candidateIssue, candidatePayloadCosts: payloadCosts,
      registrySupersetPressure: { productionShape: false, encodedBytes: Buffer.byteLength(JSON.stringify(registryPressure)),
        expandedBytes: registryPressure.expandedBytes },
      internalGateDecision: internalGate?.decision ?? null,
      internalGateHash: internalGate?.gateHash ?? null,
      internalGateMetrics: internalGate?.metrics ?? null,
      candidateNodeCosts: nodeCosts(fullDictionary!.nodes), candidateExpandedHash: fullDictionary!.expandedHash,
      candidateDictionaryHash: sha256Stable(fullDictionary),
      largestUniqueStringFields: Object.entries(stringFields).sort((left, right) => right[1].bytes - left[1].bytes).slice(0, 15),
      hashDerivationFeasibility: { presentHashes: presentHashes.length, fromExistingStrings: reconstructibleHashes.length },
      clauseExpandedBytes: clauseDictionary.expandedBytes, clauseEncodedBytes: Buffer.byteLength(JSON.stringify(clauseDictionary)),
      expandedHash: dictionary.expandedHash, actualDispatchCount: 0, fullRepairAccepted: false };
    const evidence = path.resolve('.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z');
    mkdirSync(evidence, { recursive: true });
    const run = process.env.REQ_TRACE_BUDGET_RUN_ID ?? `${Date.now()}-${process.pid}`;
    writeFileSync(path.join(evidence, `${run}-codec-measurement.json`), JSON.stringify(measurement, null, 2), { encoding: 'utf8', flag: 'wx' });
    expect(dictionary.expandedBytes).toBeGreaterThan(1_048_576);
    expect(candidateStatus).toBe('compiled');
    expect(candidateBytes).toBeLessThanOrEqual(1_048_576);
    expect(internalGate?.decision).toBe('pass');
    expect(internalGate?.metrics.candidateBytes).toBe(candidateBytes);
    expect(measurement.actualDispatchCount).toBe(0);
  }, 120_000);
});
