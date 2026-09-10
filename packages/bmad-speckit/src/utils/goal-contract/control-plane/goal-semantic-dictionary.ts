import { types } from 'node:util';
import { createHash } from 'node:crypto';
import { sha256Stable, stableStringify } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonScalar = null | boolean | number | string;
export type GoalDictionaryValue = JsonScalar | GoalDictionaryValue[] | { [key: string]: GoalDictionaryValue };
export type GoalDictionaryNode = JsonScalar | Array<number | string>;
export interface GoalSemanticDictionary {
  schemaVersion: 'GoalSemanticDictionary/v1';
  nodeEncoding?: 'GoalDictionaryNodes/base36-v1' | 'GoalDictionaryNodes/base36-run-v2';
  nodes: GoalDictionaryNode[];
  root: number;
  expandedBytes: number;
  expandedHash: string;
}
export type GoalDictionaryNodeEncoding = NonNullable<GoalSemanticDictionary['nodeEncoding']>;
interface GoalDictionaryDerivedString {
  value: string;
  preimage: string;
  prefix: string;
}

export const GOAL_DICTIONARY_MAX_EXPANDED_BYTES = 16 * 1024 * 1024;
export const GOAL_DICTIONARY_MAX_DEPTH = 128;
export const GOAL_DICTIONARY_MAX_OBJECT_ENTRIES = 1_048_576;
export const GOAL_DICTIONARY_MAX_LOGICAL_NODES = 1_048_576;

export function isGoalDictionaryRunV2Eligible(logicalNodeCount: number): boolean {
  return Number.isSafeInteger(logicalNodeCount) && logicalNodeCount >= 0
    && logicalNodeCount <= GOAL_DICTIONARY_MAX_LOGICAL_NODES;
}
export const GOAL_SEMANTIC_DICTIONARY_PROTOCOL = 'GoalSemanticDictionary/v1 is a lossless JSON DAG, not a semantic summary. '
  + 'Decode nodes in array order; every reference is a zero-based earlier node index. Scalars decode unchanged. '
  + '[0,...refs] is an array. [1,keyRef,valueRef,...] is an object. '
  + '[2,stringRef,prefixLength,suffix] takes that many UTF-16 code units from the referenced string then appends suffix. '
  + '[3,shapeRef,...valueRefs] is an object whose shape is an array of string keys. '
  + '[4,objectRef,keyRef,valueRef,...] copies the referenced object and replaces the listed existing keys. '
  + '[8,objectRef,keySlot,valueRef,...] does the same using zero-based slots in the base object sorted keys. '
  + '[5,...parts] concatenates parts: a string is literal text; each integer begins a three-integer '
  + 'stringRef,start,length slice measured in UTF-16 code units. root selects the complete semantic payload. '
  + '[6,stringRef,prefix] is prefix followed by lowercase SHA-256 hex of the complete referenced UTF-8 string. '
  + 'prefix may be a literal string or an earlier string-node reference. '
  + 'The preimage remains explicitly present; derived hashes do not summarize or replace its content. '
  + '[9,prefixStringRef,base64urlDigest] restores an identity string: decode the canonical unpadded base64url '
  + 'digest to exactly 32 bytes, render 64 lowercase hex digits, then prepend the referenced literal prefix. '
  + '[7,"b36v1:tag.ref.ref..."] is a compact integer tuple: parse each dot-delimited token in base 36, '
  + 'then decode the resulting tag 0,1,3,4 tuple normally. Literal strings never use tuple parsing. '
  + 'When nodeEncoding is GoalDictionaryNodes/base36-v1, strings starting ~~ decode to the literal after removing one ~. '
  + 'A string ~tag.token.token represents an absolute-base36 tag 0,1,3,4,8 tuple; ~tag:token.token instead '
  + 'uses backward distances, so each reference equals the current node index minus its base36 token. '
  + 'In tag 8, keySlot tokens remain absolute slot numbers even in backward-distance tuples. '
  + 'The same nodeEncoding also permits concise tuple markers: ! means tag0, @ tag1, # tag3, ^ tag4, % tag8; '
  + 'the marker is followed by dot-delimited absolute base36 operands, or : followed by backward-distance operands. '
  + 'GoalDictionaryNodes/base36-run-v2 retains the v1 logical encoding and may replace consecutive marker nodes '
  + 'with ~R<count>:<length>:<node> runs. Count and lengths are canonical lowercase base36; lengths count UTF-16 '
  + 'code units. Expand runs before resolving references, limits, depth, bytes, or the root logical node index. '
  + 'A v2 run expands to at most 1048576 logical nodes; this limit counts logical nodes after run expansion. '
  + 'The encoder excludes v2 candidates above that limit while retaining the compatible v1 encoding. '
  + '~H followed by a canonical 43-character unpadded base64url digest restores sha256: followed by 64 lowercase hex digits. '
  + '$prefixRef.base64urlDigest is the concise tag9 form (prefixRef is absolute base36). '
  + '&stringRef:prefix is tag6, with an absolute base36 reference and all text after the first colon as prefix. '
  + '&stringRef.prefixRef is tag6 with two absolute base36 string references. '
  + '=stringRef.prefixLength:suffix is tag2, with base36 operands and all text after the first colon as suffix. '
  + 'Literal strings starting ~,!,@,#,^,%,$,&,= are escaped by prepending ~. '
  + 'All other strings remain literal. Without nodeEncoding, every string remains literal, including ~ prefixes. '
  + 'Object keys are unique and sorted by UTF-16 order. Preserve every field, item, condition, modality and reference. '
  + 'expandedBytes is canonical JSON UTF-8 length; expandedHash is sha256 of canonical sorted-key JSON. '
  + 'Expansion is bounded to 16777216 bytes and depth 128; cumulative object metadata is bounded to 1048576 entries. '
  + 'These work limits do not increase the request budget.';
const VERSION = 'GoalSemanticDictionary/v1';
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const TUPLE_MARKERS: Record<string, number> = { '!': 0, '@': 1, '#': 3, '^': 4, '%': 8 };
const LITERAL_MARKERS = new Set(['~', ...Object.keys(TUPLE_MARKERS), '$', '&', '=']);
const RUN_ENCODING = 'GoalDictionaryNodes/base36-run-v2';
const RUN_NODE = /^[!@#%^$&=]/u;
const fail = (code: string): never => { throw new Error(`goal_semantic_dictionary_${code}`); };
const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');
const scalar = (value: unknown): value is JsonScalar => value === null || typeof value === 'string'
  || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

function ownKeys(value: object, array = false): string[] {
  if (types.isProxy(value)) fail('non_json');
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('non_json');
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== 'string') fail('non_json');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || (!descriptor.enumerable && !(array && key === 'length'))) fail('non_json');
    if (UNSAFE_KEYS.has(key as string)) fail('unsafe_key');
  }
  if (array && keys.length !== (value as unknown[]).length + 1) fail('non_json');
  return keys.filter((key) => key !== 'length' || !array) as string[];
}

function checkBudget(size: number, depth: number): void {
  if (!Number.isSafeInteger(size) || size > GOAL_DICTIONARY_MAX_EXPANDED_BYTES) fail('expanded_bytes_exceeded');
  if (depth > GOAL_DICTIONARY_MAX_DEPTH) fail('max_depth_exceeded');
}

function objectEntryBudget(): (entries: number) => void {
  let retained = 0;
  return (entries) => {
    retained += entries;
    if (!Number.isSafeInteger(retained) || retained > GOAL_DICTIONARY_MAX_OBJECT_ENTRIES) fail('object_entries_exceeded');
  };
}

function packNode(node: GoalDictionaryNode, index: number): GoalDictionaryNode {
  if (typeof node === 'string') return LITERAL_MARKERS.has(node[0]) ? `~${node}` : node;
  if (Array.isArray(node) && node[0] === 9) return `$${(node[1] as number).toString(36)}.${node[2]}`;
  if (Array.isArray(node) && node[0] === 6) return typeof node[2] === 'number'
    ? `&${(node[1] as number).toString(36)}.${node[2].toString(36)}` : `&${(node[1] as number).toString(36)}:${node[2]}`;
  if (Array.isArray(node) && node[0] === 2) return `=${(node[1] as number).toString(36)}.${(node[2] as number).toString(36)}:${node[3]}`;
  if (!Array.isArray(node) || ![0, 1, 3, 4, 8].includes(node[0] as number) || node.length === 1) return node;
  const marker = Object.keys(TUPLE_MARKERS).find((key) => TUPLE_MARKERS[key] === node[0])!;
  const absolute = `${marker}${node.slice(1).map((ref) => (ref as number).toString(36)).join('.')}`;
  const relative = `${marker}:${node.slice(1).map((ref, offset) => (node[0] === 8 && offset % 2 === 1
    ? ref as number : index - (ref as number)).toString(36)).join('.')}`;
  const compact = relative.length < absolute.length ? relative : absolute;
  return bytes(compact) < bytes(node) ? compact : node;
}

function packNodeRuns(nodes: GoalDictionaryNode[]): GoalDictionaryNode[] {
  const packed: GoalDictionaryNode[] = [];
  for (let index = 0; index < nodes.length;) {
    if (typeof nodes[index] !== 'string' || !RUN_NODE.test(nodes[index] as string)) {
      packed.push(nodes[index]);
      index += 1;
      continue;
    }
    let end = index;
    const run: string[] = [];
    while (end < nodes.length && typeof nodes[end] === 'string' && RUN_NODE.test(nodes[end] as string)) {
      run.push(nodes[end] as string);
      end += 1;
    }
    const encoded = `~R${run.length.toString(36)}:${run
      .map((node) => `${node.length.toString(36)}:${node}`)
      .join('')}`;
    if (bytes(encoded) < bytes(run)) packed.push(encoded);
    else packed.push(...run);
    index = end;
  }
  return packed;
}

function compactShaNodes(nodes: GoalDictionaryNode[]): GoalDictionaryNode[] {
  const retainedPrefixes = new Set<number>();
  return nodes.map((node) => {
    if (typeof node !== 'string' || !node.startsWith('$')) return node;
    const identity = /^\$(0|[1-9a-z][0-9a-z]*)\.([A-Za-z0-9_-]{43})$/u.exec(node);
    if (!identity) return node;
    const prefixRef = Number.parseInt(identity[1], 36);
    if (nodes[prefixRef] !== 'sha256:') return node;
    if (!retainedPrefixes.has(prefixRef)) {
      retainedPrefixes.add(prefixRef);
      return node;
    }
    return `~H${identity[2]}`;
  });
}

function canonicalBase36(token: string, code: string): number {
  if (!/^(?:0|[1-9a-z][0-9a-z]*)$/u.test(token)) fail(code);
  const value = Number.parseInt(token, 36);
  if (!Number.isSafeInteger(value) || value.toString(36) !== token) fail(code);
  return value;
}

function unpackNodeRuns(encodedNodes: GoalDictionaryNode[]): GoalDictionaryNode[] {
  const nodes: GoalDictionaryNode[] = [];
  for (const encoded of encodedNodes) {
    if (typeof encoded !== 'string' || !encoded.startsWith('~R')) {
      nodes.push(encoded);
      if (nodes.length > GOAL_DICTIONARY_MAX_LOGICAL_NODES) fail('logical_nodes_exceeded');
      continue;
    }
    const countEnd = encoded.indexOf(':', 2);
    if (countEnd < 0) fail('packed_run_count');
    const count = canonicalBase36(encoded.slice(2, countEnd), 'packed_run_count');
    if (count < 1) fail('packed_run_count');
    if (count > GOAL_DICTIONARY_MAX_LOGICAL_NODES - nodes.length) fail('logical_nodes_exceeded');
    let cursor = countEnd + 1;
    for (let offset = 0; offset < count; offset += 1) {
      if (cursor >= encoded.length) fail('packed_run_truncated');
      const lengthEnd = encoded.indexOf(':', cursor);
      if (lengthEnd < 0) fail('packed_run_truncated');
      const length = canonicalBase36(encoded.slice(cursor, lengthEnd), 'packed_run_length');
      if (length < 1) fail('packed_run_length');
      cursor = lengthEnd + 1;
      if (length > encoded.length - cursor) fail('packed_run_truncated');
      const node = encoded.slice(cursor, cursor + length);
      if (!RUN_NODE.test(node)) fail('packed_run_node');
      nodes.push(node);
      cursor += length;
    }
    if (cursor !== encoded.length) fail('packed_run_trailing');
  }
  return nodes;
}

function frontCodeStrings(original: GoalDictionaryNode[], root: number) {
  const nodes: GoalDictionaryNode[] = [];
  const remap = new Map<number, number>();
  const intern = new Map<string, number>();
  const shapes = new Map<string, number>();
  const objectHistory = new Map<string, Array<{ ref: number; entries: number[]; depth: number }>>();
  const shapeKey = (node: Array<number | string>) => node.filter((_, index) => index % 2 === 1).join(',');
  function append(node: GoalDictionaryNode): number {
    const key = JSON.stringify(node);
    if (intern.has(key)) return intern.get(key)!;
    const index = nodes.length;
    nodes.push(node); intern.set(key, index);
    return index;
  }
  const objectKeys = new Set<number>();
  const uses = new Map<number, number>();
  for (const node of original) if (Array.isArray(node)) {
    const refs = [2, 9].includes(node[0] as number) ? node.slice(1, 2) : node.slice(1);
    for (const ref of refs) uses.set(ref as number, (uses.get(ref as number) ?? 0) + 1);
  }
  for (const node of original) if (Array.isArray(node) && node[0] === 1) {
    shapes.set(shapeKey(node), (shapes.get(shapeKey(node)) ?? 0) + 1);
    for (let index = 1; index < node.length; index += 2) objectKeys.add(node[index] as number);
  }
  // Keep ubiquitous keys and empty values at short indexes before inserting long source strings.
  for (const [index, node] of [...original.entries()].sort((left, right) => (uses.get(right[0]) ?? 0) - (uses.get(left[0]) ?? 0) || left[0] - right[0])) {
    if (objectKeys.has(index) || node === null || typeof node === 'boolean' ||
      (Array.isArray(node) && node.length === 1) || (scalar(node) && (uses.get(index) ?? 0) >= 8)) {
      remap.set(index, append(node));
    }
  }
  const strings = original.flatMap((node, index) => typeof node === 'string' ? [{ value: node, index }] : [])
    .sort((left, right) => right.value.length - left.value.length || (left.value < right.value ? -1 : left.value > right.value ? 1 : 0));
  const fragmentIndex = new Map<string, Array<{ ref: number; start: number }>>();
  const stringValues = new Map<number, string>();
  const stringDepths = new Map<number, number>();
  const WINDOW = 16;
  function fragments(value: string): { node: GoalDictionaryNode; depth: number } {
    const parts: Array<number | string> = [5];
    let literalStart = 0;
    let offset = 0;
    let depth = 0;
    while (offset + WINDOW <= value.length) {
      let best: { ref: number; start: number; length: number } | undefined;
      for (const match of fragmentIndex.get(value.slice(offset, offset + WINDOW)) ?? []) {
        if ((stringDepths.get(match.ref) ?? 0) >= GOAL_DICTIONARY_MAX_DEPTH) continue;
        const base = stringValues.get(match.ref)!;
        let length = WINDOW;
        while (offset + length < value.length && match.start + length < base.length
          && value.charCodeAt(offset + length) === base.charCodeAt(match.start + length)) length++;
        if (length >= 24 && (!best || best.length < length)) best = { ...match, length };
      }
      if (!best) { offset++; continue; }
      if (offset > literalStart) parts.push(value.slice(literalStart, offset));
      parts.push(best.ref, best.start, best.length);
      depth = Math.max(depth, (stringDepths.get(best.ref) ?? 0) + 1);
      offset += best.length;
      literalStart = offset;
    }
    if (literalStart < value.length) parts.push(value.slice(literalStart));
    return { node: parts, depth };
  }
  let previous = '';
  let previousIndex = -1;
  let ropeDepth = 0;
  for (const { value, index } of strings) {
    let prefix = 0;
    while (prefix < previous.length && prefix < value.length && previous.charCodeAt(prefix) === value.charCodeAt(prefix)) prefix++;
    let encoded: GoalDictionaryNode = [2, previousIndex, prefix, value.slice(prefix)];
    let compressed = !remap.has(index) && previousIndex >= 0 && ropeDepth < GOAL_DICTIONARY_MAX_DEPTH && bytes(encoded) < bytes(value);
    let depth = compressed ? ropeDepth + 1 : 0;
    const fragmented = fragments(value);
    if (!remap.has(index) && bytes(fragmented.node) < bytes(compressed ? encoded : value)) {
      encoded = fragmented.node;
      depth = fragmented.depth;
      compressed = true;
    }
    if (!remap.has(index)) {
      remap.set(index, append(compressed ? encoded : value));
    }
    ropeDepth = depth;
    previous = value;
    previousIndex = remap.get(index)!;
    stringValues.set(previousIndex, value);
    stringDepths.set(previousIndex, depth);
    for (let start = 0; start + WINDOW <= value.length; start += 8) {
      const key = value.slice(start, start + WINDOW);
      if (!fragmentIndex.has(key) && fragmentIndex.size >= 131_072) continue;
      const matches = fragmentIndex.get(key) ?? [];
      if (matches.length < 4) matches.push({ ref: previousIndex, start });
      fragmentIndex.set(key, matches);
    }
  }
  for (const [index, node] of original.entries()) {
    if (remap.has(index)) continue;
    let encoded = Array.isArray(node) ? [2, 9].includes(node[0] as number) ? [node[0], remap.get(node[1] as number)!, ...node.slice(2)]
      : [node[0], ...node.slice(1).map((ref) => remap.get(ref as number)!)] : node;
    let plannedShape: number[] | undefined;
    let overlayDepth = 0;
    if (Array.isArray(node) && node[0] === 1 && node.length >= 5) {
      const keyRefs = node.filter((_, offset) => offset % 2 === 1).map((ref) => remap.get(ref as number)!);
      const valueRefs = node.filter((_, offset) => offset > 0 && offset % 2 === 0).map((ref) => remap.get(ref as number)!);
      const shape = [0, ...keyRefs];
      const existing = intern.get(JSON.stringify(shape));
      const candidate = [3, existing ?? nodes.length, ...valueRefs];
      const savings = (bytes(encoded) - bytes(candidate)) * shapes.get(shapeKey(node))!;
      if (savings > (existing === undefined ? bytes(shape) + 1 : 0)) {
        encoded = candidate;
        plannedShape = shape;
      }
      const entries = node.slice(1).map((ref) => remap.get(ref as number)!);
      const history = objectHistory.get(shapeKey(node)) ?? [];
      for (const base of history) {
        if (base.depth >= GOAL_DICTIONARY_MAX_DEPTH) continue;
        const delta = [4, base.ref];
        const slots = [8, base.ref];
        for (let offset = 1; offset < entries.length; offset += 2) {
          if (base.entries[offset] !== entries[offset]) {
            delta.push(entries[offset - 1], entries[offset]);
            slots.push((offset - 1) / 2, entries[offset]);
          }
        }
        const overlay = bytes(packNode(slots, nodes.length)) < bytes(packNode(delta, nodes.length)) ? slots : delta;
        if (overlay.length > 2 && bytes(packNode(overlay, nodes.length)) < bytes(packNode(encoded, nodes.length))) {
          encoded = overlay;
          overlayDepth = base.depth + 1;
        }
      }
      if (Array.isArray(encoded) && encoded[0] === 3) encoded[1] = append(plannedShape!);
      const ref = append(encoded);
      history.push({ ref, entries, depth: overlayDepth });
      if (history.length > 32) history.shift();
      objectHistory.set(shapeKey(node), history);
      remap.set(index, ref);
      continue;
    }
    remap.set(index, append(encoded));
  }
  return { nodeEncoding: 'GoalDictionaryNodes/base36-v1' as const, nodes: nodes.map(packNode), root: remap.get(root)! };
}

export function encodeGoalSemanticDictionary(value: unknown): GoalSemanticDictionary {
  return encodeValue(value, undefined, 'smallest');
}

export function encodeGoalSemanticDictionaryForEncoding(
  value: unknown,
  nodeEncoding: GoalSemanticDictionary['nodeEncoding'],
): GoalSemanticDictionary {
  if (nodeEncoding !== undefined && !['GoalDictionaryNodes/base36-v1', RUN_ENCODING].includes(nodeEncoding)) {
    fail('node_encoding');
  }
  return encodeValue(value, undefined, nodeEncoding);
}

function encodeValue(
  value: unknown,
  derivedStrings: GoalDictionaryDerivedString[] | undefined,
  requestedEncoding: 'smallest' | GoalSemanticDictionary['nodeEncoding'],
): GoalSemanticDictionary {
  const retainObjectEntries = objectEntryBudget();
  const nodes: GoalDictionaryNode[] = [];
  const sizes: number[] = [];
  const depths: number[] = [];
  const intern = new Map<string, number>();
  const active = new WeakSet<object>();
  const seen = new WeakMap<object, number>();
  const recipes = new Map<string, GoalDictionaryDerivedString>();
  const activeRecipes = new Set<string>();
  const recipeRefs = new Map<string, number>();
  let hashingBytes = 0;
  function digestRecipe(recipe: GoalDictionaryDerivedString): string {
    const text = recipe.preimage;
    hashingBytes += Buffer.byteLength(text);
    checkBudget(hashingBytes, 0);
    return recipe.prefix + createHash('sha256').update(text, 'utf8').digest('hex');
  }
  for (const recipe of derivedStrings ?? []) {
    if (recipes.has(recipe.value)) fail('derived_duplicate');
    recipes.set(recipe.value, recipe);
  }
  function visit(current: unknown, pathDepth: number): number {
    if (pathDepth > GOAL_DICTIONARY_MAX_DEPTH) fail('max_depth_exceeded');
    let node: GoalDictionaryNode;
    let size: number;
    let depth = 0;
    if (typeof current === 'string' && recipes.has(current)) {
      if (recipeRefs.has(current)) return recipeRefs.get(current)!;
      const recipe = recipes.get(current)!;
      if (activeRecipes.has(current)) fail('derived_cycle');
      activeRecipes.add(current);
      const preimage = visit(recipe.preimage, pathDepth + 1);
      if (digestRecipe(recipe) !== current) fail('derived_mismatch');
      activeRecipes.delete(current);
      node = [6, preimage, visit(recipe.prefix, pathDepth)];
      size = bytes(current);
    } else if (typeof current === 'string' && /^([A-Za-z][A-Za-z0-9_:-]*?[-:])([a-f0-9]{64})(:[A-Za-z0-9_-]+)?$/u.test(current)) {
      const [, prefix, digest, suffix] = /^([A-Za-z][A-Za-z0-9_:-]*?[-:])([a-f0-9]{64})(:[A-Za-z0-9_-]+)?$/u.exec(current)!;
      node = suffix ? [2, visit(prefix + digest, pathDepth), prefix.length + digest.length, suffix]
        : [9, visit(prefix, pathDepth), Buffer.from(digest, 'hex').toString('base64url')];
      size = bytes(current);
    } else if (scalar(current)) { node = current; size = bytes(current); }
    else {
      if (!current || typeof current !== 'object') fail('non_json');
      const object = current as object;
      if (types.isProxy(object)) fail('non_json');
      if (active.has(object)) fail('cycle');
      const cached = seen.get(object);
      if (cached !== undefined) {
        checkBudget(sizes[cached], pathDepth + depths[cached]);
        return cached;
      }
      const array = Array.isArray(current);
      const keys = ownKeys(object, array).sort();
      active.add(object);
      node = [array ? 0 : 1];
      size = 2;
      depth = 1;
      const children = array ? Array.from({ length: current.length }, (_, index) => String(index)) : keys;
      for (const [position, key] of children.entries()) {
        if (!Object.hasOwn(object, key)) fail('non_json');
        if (!array) node.push(visit(key, pathDepth));
        const ref = visit((current as Record<string, unknown>)[key], pathDepth + 1);
        node.push(ref);
        size += sizes[ref] + (position ? 1 : 0) + (array ? 0 : bytes(key) + 1);
        depth = Math.max(depth, depths[ref] + 1);
        checkBudget(size, depth);
      }
      active.delete(object);
    }
    checkBudget(size!, pathDepth + depth);
    const identity = JSON.stringify(node!);
    let index = intern.get(identity);
    if (index === undefined) {
      if (Array.isArray(node!) && node![0] === 1) retainObjectEntries((node!.length - 1) / 2);
      index = nodes.length;
      intern.set(identity, index);
      nodes.push(node!); sizes.push(size!); depths.push(depth);
    }
    if (current && typeof current === 'object') seen.set(current, index);
    if (typeof current === 'string' && recipes.has(current)) recipeRefs.set(current, index);
    return index;
  }
  const root = visit(value, 0);
  if (!derivedStrings) {
    const literals = nodes.flatMap((node) => typeof node === 'string' ? [node]
      : Array.isArray(node) && node[0] === 9 ? [String(nodes[node[1] as number]) + Buffer.from(node[2] as string, 'base64url').toString('hex')] : []);
    const hashes = new Map<string, string>();
    for (const literal of literals) hashes.set(createHash('sha256').update(literal, 'utf8').digest('hex'), literal);
    const automatic = literals.flatMap((literal) => {
      if (literal.length < 64) return [];
      const digest = literal.slice(-64);
      const preimage = hashes.get(digest);
      return preimage !== undefined ? [{ value: literal, preimage, prefix: literal.slice(0, -64) }] : [];
    });
    if (automatic.length) return encodeValue(value, automatic, requestedEncoding);
  }
  const v1 = frontCodeStrings(nodes, root);
  const legacy: Pick<GoalSemanticDictionary, 'nodes' | 'root'> = { nodes, root };
  const v2Candidates: Array<Pick<GoalSemanticDictionary, 'nodeEncoding' | 'nodes' | 'root'>> = [];
  if (isGoalDictionaryRunV2Eligible(v1.nodes.length)) v2Candidates.push(
    { nodeEncoding: RUN_ENCODING, nodes: packNodeRuns(v1.nodes), root: v1.root },
    { nodeEncoding: RUN_ENCODING, nodes: packNodeRuns(compactShaNodes(v1.nodes)), root: v1.root },
  );
  if (requestedEncoding === RUN_ENCODING && v2Candidates.length === 0) fail('logical_nodes_exceeded');
  const candidates = requestedEncoding === 'smallest' ? [v1, ...v2Candidates]
    : requestedEncoding === 'GoalDictionaryNodes/base36-v1' ? [v1]
      : requestedEncoding === RUN_ENCODING ? v2Candidates : [legacy];
  const candidateSizes = candidates.map(bytes);
  let smallestIndex = 0;
  for (let index = 1; index < candidates.length; index += 1) {
    if (candidateSizes[index] < candidateSizes[smallestIndex]) smallestIndex = index;
  }
  const physical = candidates[smallestIndex];
  const dictionary: GoalSemanticDictionary = { schemaVersion: VERSION, ...physical,
    expandedBytes: sizes[root], expandedHash: sha256Stable(value) };
  decodeGoalSemanticDictionary(dictionary);
  return dictionary;
}

export function decodeGoalSemanticDictionary(input: unknown): GoalDictionaryValue {
  if (types.isProxy(input)) fail('non_json');
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('shape');
  const keys = ownKeys(input as object).sort();
  if (!['expandedBytes,expandedHash,nodes,root,schemaVersion', 'expandedBytes,expandedHash,nodeEncoding,nodes,root,schemaVersion'].includes(keys.join(','))) fail('shape');
  const dictionary = input as GoalSemanticDictionary;
  if (dictionary.schemaVersion !== VERSION) fail('version');
  if (Object.hasOwn(dictionary, 'nodeEncoding') &&
    !['GoalDictionaryNodes/base36-v1', RUN_ENCODING].includes(String(dictionary.nodeEncoding))) fail('node_encoding');
  const { nodes: encodedNodes, root } = dictionary;
  if (types.isProxy(encodedNodes)) fail('non_json');
  if (!Array.isArray(encodedNodes) || encodedNodes.length === 0) fail('nodes');
  ownKeys(encodedNodes, true);
  const nodes = dictionary.nodeEncoding === RUN_ENCODING ? unpackNodeRuns(encodedNodes) : [...encodedNodes];
  if (!Number.isSafeInteger(root) || root < 0 || root >= nodes.length) fail('root');
  const sizes: number[] = [];
  const depths: number[] = [];
  const stringValues: Array<string | undefined> = [];
  const ropeDepths: number[] = [];
  const objectEntries: Array<Array<[number, number]> | undefined> = [];
  const overlayDepths: number[] = [];
  const retainObjectEntries = objectEntryBudget();
  let stringBytes = 0;
  let hashingBytes = 0;
  function reference(ref: unknown, parent: number): asserts ref is number {
    if (!Number.isSafeInteger(ref) || (ref as number) < 0 || (ref as number) >= parent) fail('reference');
  }
  function retainString(value: string, index: number, ropeDepth: number): void {
    const size = bytes(value);
    stringBytes += size;
    checkBudget(stringBytes, ropeDepth);
    stringValues[index] = value; ropeDepths[index] = ropeDepth;
    sizes.push(size); depths.push(0);
  }
  for (const [index, originalNode] of nodes.entries()) {
    let node = originalNode;
    if (types.isProxy(node)) fail('non_json');
    let entriesReserved = false;
    if (dictionary.nodeEncoding === RUN_ENCODING && typeof node === 'string' && node.startsWith('~H')) {
      const hash = /^~H([A-Za-z0-9_-]{43})$/u.exec(node);
      const digestToken = hash?.[1] ?? fail('hash_shape');
      const digest = Buffer.from(digestToken, 'base64url');
      if (digest.length !== 32 || digest.toString('base64url') !== digestToken) fail('hash_encoding');
      node = `sha256:${digest.toString('hex')}`;
      nodes[index] = node;
    } else if (dictionary.nodeEncoding && typeof node === 'string' && Object.hasOwn(TUPLE_MARKERS, node[0])) {
      const tag = TUPLE_MARKERS[node[0]];
      node = `~${tag}${node[1] === ':' ? ':' + node.slice(2) : '.' + node.slice(1)}`;
    } else if (dictionary.nodeEncoding && typeof node === 'string' && node.startsWith('$')) {
      const identity = /^\$(0|[1-9a-z][0-9a-z]*)\.([A-Za-z0-9_-]{43})$/u.exec(node);
      if (!identity) fail('identity_shape');
      const ref = Number.parseInt(identity![1], 36);
      if (!Number.isSafeInteger(ref)) fail('compact_reference');
      node = [9, ref, identity![2]];
      nodes[index] = node;
    } else if (dictionary.nodeEncoding && typeof node === 'string' && /^&(?:0|[1-9a-z][0-9a-z]*)\.(?:0|[1-9a-z][0-9a-z]*)$/u.test(node)) {
      const refs = node.slice(1).split('.').map((token) => Number.parseInt(token, 36));
      if (refs.some((ref) => !Number.isSafeInteger(ref))) fail('compact_reference');
      node = [6, ...refs];
      nodes[index] = node;
    } else if (dictionary.nodeEncoding && typeof node === 'string' && /^[&=]/u.test(node)) {
      const framed = /^([&=])(0|[1-9a-z][0-9a-z]*)(?:\.(0|[1-9a-z][0-9a-z]*))?:([\s\S]*)$/u.exec(node);
      if (!framed || (framed[1] === '=') !== (framed[3] !== undefined)) fail('compact_shape');
      const ref = Number.parseInt(framed![2], 36);
      const length = framed![3] === undefined ? 0 : Number.parseInt(framed![3], 36);
      if (!Number.isSafeInteger(ref) || !Number.isSafeInteger(length)) fail('compact_reference');
      node = framed![1] === '&' ? [6, ref, framed![4]] : [2, ref, length, framed![4]];
      nodes[index] = node;
    }
    if (dictionary.nodeEncoding && typeof node === 'string' && node.startsWith('~')) {
      if (LITERAL_MARKERS.has(node[1])) node = node.slice(1);
      else {
        if (!/^~[01348][.:](?:0|[1-9a-z][0-9a-z]*)(?:\.(?:0|[1-9a-z][0-9a-z]*))*$/u.test(node)) fail('compact_shape');
        const relative = node[2] === ':';
        const refs = node.slice(3).split('.').map((token) => Number.parseInt(token, 36));
        if (refs.some((ref) => !Number.isSafeInteger(ref))) fail('compact_reference');
        const tag = Number(node[1]);
        node = [tag, ...refs.map((ref, offset) => relative && !(tag === 8 && offset % 2 === 1) ? index - ref : ref)];
      }
      nodes[index] = node;
    }
    if (typeof node === 'string') { retainString(node, index, 0); continue; }
    if (scalar(node)) { sizes.push(bytes(node)); depths.push(0); checkBudget(sizes[index], 0); continue; }
    if (!Array.isArray(node)) fail('node');
    ownKeys(node, true);
    if (node[0] === 7) {
      if (node.length !== 2 || typeof node[1] !== 'string' || !/^b36v1:[0134](?:\.(?:0|[1-9a-z][0-9a-z]*))*$/u.test(node[1])) fail('compact_shape');
      node = (node[1] as string).slice(6).split('.').map((token) => Number.parseInt(token, 36));
      if (node.some((value) => !Number.isSafeInteger(value))) fail('compact_reference');
      nodes[index] = node;
    }
    if (node[0] === 4 || node[0] === 8) {
      if (node.length < 4 || node.length % 2 !== 0) fail('overlay_shape');
      reference(node[1], index);
      const base = objectEntries[node[1] as number];
      if (!base) fail('overlay_reference');
      retainObjectEntries(base!.length);
      entriesReserved = true;
      overlayDepths[index] = (overlayDepths[node[1] as number] ?? 0) + 1;
      checkBudget(0, overlayDepths[index]);
      const entries = new Map(base);
      let previousKey: string | null = null;
      for (let offset = 2; offset < node.length; offset += 2) {
        const slot = node[offset];
        if (node[0] === 8 && (!Number.isSafeInteger(slot) || (slot as number) < 0 || (slot as number) >= base!.length)) fail('overlay_slot');
        const keyRef = node[0] === 8 ? base![slot as number][0] : node[offset] as number;
        reference(keyRef, index);
        reference(node[offset + 1], index);
        const key = stringValues[keyRef];
        if (!entries.has(keyRef) || typeof key !== 'string') fail('overlay_key');
        if (previousKey !== null && previousKey >= key!) fail('overlay_key_order');
        previousKey = key!;
        entries.set(keyRef, node[offset + 1] as number);
      }
      node = [1, ...[...entries].flat()];
    }
    const tag = node[0];
    if (tag === 9) {
      if (node.length !== 3 || typeof node[2] !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(node[2])) fail('identity_shape');
      reference(node[1], index);
      const prefix = stringValues[node[1] as number];
      if (typeof prefix !== 'string') fail('identity_prefix');
      const digest = Buffer.from(node[2] as string, 'base64url');
      if (digest.length !== 32 || digest.toString('base64url') !== node[2]) fail('identity_encoding');
      retainString(prefix! + digest.toString('hex'), index, ropeDepths[node[1] as number] + 1);
      continue;
    }
    if (tag === 6) {
      if (node.length !== 3 || !['string', 'number'].includes(typeof node[2])) fail('derived_shape');
      reference(node[1], index);
      const ref = node[1] as number;
      let prefix = node[2];
      if (typeof prefix === 'number') {
        reference(prefix, index);
        if (typeof stringValues[prefix] !== 'string') fail('derived_prefix');
        prefix = stringValues[prefix]!;
      }
      hashingBytes += sizes[ref];
      checkBudget(hashingBytes, depths[ref]);
      if (typeof stringValues[ref] !== 'string') fail('derived_preimage');
      retainString(prefix + createHash('sha256').update(stringValues[ref]!, 'utf8').digest('hex'), index,
        Math.max(ropeDepths[ref], typeof node[2] === 'number' ? ropeDepths[node[2]] : 0) + 1);
      continue;
    }
    if (tag === 5) {
      if (node.length < 2) fail('fragment_shape');
      const parts: string[] = [];
      let units = 0;
      let depth = 0;
      for (let offset = 1; offset < node.length;) {
        let part: string;
        if (typeof node[offset] === 'string') part = node[offset++] as string;
        else {
          const [ref, start, length] = node.slice(offset, offset + 3);
          reference(ref, index);
          const base = stringValues[ref];
          if (typeof base !== 'string' || !Number.isSafeInteger(start) || !Number.isSafeInteger(length)
            || (start as number) < 0 || (length as number) < 0 || (start as number) + (length as number) > base.length) fail('fragment_reference');
          depth = Math.max(depth, ropeDepths[ref] + 1);
          part = base!.slice(start as number, (start as number) + (length as number));
          offset += 3;
        }
        units += part!.length;
        checkBudget(stringBytes + units + 2, depth);
        parts.push(part!);
      }
      retainString(parts.join(''), index, depth);
      continue;
    }
    if (tag === 2) {
      if (node.length !== 4) fail('string_shape');
      const [, baseRef, prefix, suffix] = node;
      reference(baseRef, index);
      const base = stringValues[baseRef];
      if (typeof base !== 'string' || !Number.isSafeInteger(prefix) || (prefix as number) < 0
        || (prefix as number) > base.length || typeof suffix !== 'string') fail('string_reference');
      checkBudget(stringBytes + (prefix as number) + (suffix as string).length + 2, ropeDepths[baseRef] + 1);
      // Prefix lengths use UTF-16 code units; even a split surrogate pair is reconstructed exactly.
      retainString(base!.slice(0, prefix as number) + suffix, index, ropeDepths[baseRef] + 1);
      continue;
    }
    if (tag !== 0 && tag !== 1 && tag !== 3) fail('tag');
    if (tag === 1 && node.length % 2 !== 1) fail('object_shape');
    let shape: Array<number | string> | null = null;
    if (tag === 3) {
      reference(node[1], index);
      const candidate = nodes[node[1] as number];
      if (!Array.isArray(candidate) || candidate[0] !== 0 || node.length !== candidate.length + 1) fail('object_shape');
      shape = candidate as Array<number | string>;
    }
    if (tag !== 0 && !entriesReserved) retainObjectEntries(tag === 1 ? (node.length - 1) / 2 : shape!.length - 1);
    let size = 2;
    let depth = 1;
    let previousKey: string | null = null;
    const objectKeys = new Set<string>();
    const entries: Array<[number, number]> = [];
    const start = tag === 3 ? 2 : 1;
    for (let offset = start; offset < node.length; offset += tag === 1 ? 2 : 1) {
      const valueRef = node[offset + (tag === 1 ? 1 : 0)];
      reference(valueRef, index);
      if (tag === 1 || tag === 3) {
        const keyRef = shape ? shape[offset - 1] : node[offset];
        reference(keyRef, index);
        const key = stringValues[keyRef];
        if (typeof key !== 'string') fail('object_key');
        if (UNSAFE_KEYS.has(key as string)) fail('unsafe_key');
        if (objectKeys.has(key as string)) fail('duplicate_key');
        if (previousKey !== null && previousKey > (key as string)) fail('key_order');
        objectKeys.add(key as string); previousKey = key as string;
        entries.push([keyRef, valueRef]);
        size += sizes[keyRef] + 1;
      }
      size += sizes[valueRef] + (offset > start ? 1 : 0);
      depth = Math.max(depth, depths[valueRef] + 1);
      checkBudget(size, depth);
    }
    sizes.push(size); depths.push(depth);
    if (tag !== 0) objectEntries[index] = entries;
  }
  const reachable = new Set<number>();
  const stack = [root];
  while (stack.length) {
    const index = stack.pop()!;
    if (reachable.has(index)) continue;
    reachable.add(index);
    const node = nodes[index];
    if (Array.isArray(node)) {
      if (node[0] === 2 || node[0] === 6 || node[0] === 9) {
        stack.push(node[1] as number);
        if (node[0] === 6 && typeof node[2] === 'number') stack.push(node[2]);
      }
      else if (node[0] === 8) {
        stack.push(node[1] as number);
        for (let offset = 3; offset < node.length; offset += 2) stack.push(node[offset] as number);
      }
      else if (node[0] === 5) {
        for (let offset = 1; offset < node.length;) {
          if (typeof node[offset] === 'string') offset++;
          else { stack.push(node[offset] as number); offset += 3; }
        }
      }
      else for (let offset = 1; offset < node.length; offset++) stack.push(node[offset] as number);
    }
  }
  if (reachable.size !== nodes.length) fail('unused_nodes');
  if (dictionary.expandedBytes !== sizes[root]) fail('expanded_bytes_mismatch');
  if (typeof dictionary.expandedHash !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(dictionary.expandedHash)) fail('hash');
  // Expand only after every reference and the full expansion budget has been validated.
  function expand(index: number): GoalDictionaryValue {
    const node = nodes[index];
    if (!Array.isArray(node)) return node;
    if ([2, 5, 6, 9].includes(node[0] as number)) return stringValues[index]!;
    if (node[0] === 0) return node.slice(1).map((ref) => expand(ref as number));
    const object: Record<string, GoalDictionaryValue> = {};
    for (const [keyRef, valueRef] of objectEntries[index]!) {
      object[stringValues[keyRef]!] = expand(valueRef);
    }
    return object;
  }
  const value = expand(root);
  if (sha256Stable(value) !== dictionary.expandedHash || Buffer.byteLength(stableStringify(value)) !== sizes[root]) fail('hash_mismatch');
  return value;
}
