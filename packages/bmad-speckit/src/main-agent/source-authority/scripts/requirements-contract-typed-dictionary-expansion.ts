import { encodeGoalSemanticDictionaryForEncoding, decodeGoalSemanticDictionary,
  type GoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;
const VERSION = 'RequirementsTypedDictionaryExpansion/v2';
const NODE_ENCODINGS = ['GoalDictionaryNodes/base36-v1', 'GoalDictionaryNodes/base36-run-v2'] as const;
const object = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string): never => { throw new Error(`requirements_typed_dictionary_expansion_${code}`); };
type NodeEncoding = GoalSemanticDictionary['nodeEncoding'];

export const REQUIREMENTS_TYPED_DICTIONARY_EXPANSION_PROTOCOL =
  'RequirementsTypedDictionaryExpansion/v2 preserves a complete typed-source graph or coverage dictionary. '
  + 'Its semanticValue is the complete decoded JSON, not a summary. Re-encode it with the canonical encoder '
  + 'matching its bound GoalSemanticDictionary nodeEncoding and verify dictionaryHash as SHA-256 of canonical sorted-key JSON. '
  + 'A frozen three-field recipe without nodeEncoding is restored only by an exact hash match against a canonical legacy, v1 or v2 encoding. '
  + 'Replace this recipe with that exact dictionary before validating the enclosing Requirements authority. '
  + 'All source text, modality, conditions, relations and coverage rows remain part of the audit input.';

export function expandRequirementsTypedDictionaries(value: unknown): unknown {
  const cache = new Map<string, unknown>();
  function walk(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(walk);
    if (!object(current)) return current;
    const dictionaryField = current.schemaVersion === 'requirements-contract-typed-source-authority/v2' ? 'graph'
      : current.schemaVersion === 'requirements-contract-typed-source-coverage/v2' ? 'coverage' : null;
    return Object.fromEntries(Object.entries(current).map(([key, child]) => {
      if (key !== dictionaryField) return [key, walk(child)];
      const canonical = canonicalJson(child);
      if (cache.has(canonical)) return [key, cache.get(canonical)];
      const semanticValue = decodeGoalSemanticDictionary(child);
      // Noncanonical but valid dictionaries retain their original representation exactly.
      const nodeEncoding = Object.hasOwn(child as object, 'nodeEncoding')
        ? (child as GoalSemanticDictionary).nodeEncoding : undefined;
      const encoded = encodeGoalSemanticDictionaryForEncoding(semanticValue, nodeEncoding);
      const expanded = canonicalJson(encoded) === canonical
        ? { schemaVersion: VERSION, dictionaryHash: sha256(canonical), nodeEncoding: nodeEncoding ?? null, semanticValue } : child;
      cache.set(canonical, expanded);
      return [key, expanded];
    }));
  }
  return walk(value);
}

export function restoreRequirementsTypedDictionaries(value: unknown): unknown {
  const cache = new Map<string, unknown>();
  function walk(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(walk);
    if (!object(current)) return current;
    if (typeof current.schemaVersion === 'string' && current.schemaVersion.startsWith('RequirementsTypedDictionaryExpansion/')) {
      if (current.schemaVersion !== VERSION) fail('version_unknown');
      const keys = Object.keys(current).sort().join('|');
      const legacyKeys = ['schemaVersion', 'dictionaryHash', 'semanticValue'].sort().join('|');
      const boundKeys = ['schemaVersion', 'dictionaryHash', 'nodeEncoding', 'semanticValue'].sort().join('|');
      if (![legacyKeys, boundKeys].includes(keys) ||
        typeof current.dictionaryHash !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(current.dictionaryHash)) fail('fields_invalid');
      const hasBoundEncoding = Object.hasOwn(current, 'nodeEncoding');
      if (hasBoundEncoding && current.nodeEncoding !== null &&
        !NODE_ENCODINGS.includes(current.nodeEncoding as typeof NODE_ENCODINGS[number])) fail('node_encoding_unknown');
      const canonical = canonicalJson(current);
      if (cache.has(canonical)) return cache.get(canonical);
      const encodings: NodeEncoding[] = hasBoundEncoding ? [current.nodeEncoding === null ? undefined : current.nodeEncoding as NodeEncoding]
        : [undefined, ...NODE_ENCODINGS];
      const dictionaries = encodings.map((nodeEncoding) =>
        encodeGoalSemanticDictionaryForEncoding(current.semanticValue, nodeEncoding));
      const matches = dictionaries.filter((dictionary) => sha256(canonicalJson(dictionary)) === current.dictionaryHash);
      if (matches.length !== 1) fail('dictionary_hash_mismatch');
      const dictionary = matches[0];
      cache.set(canonical, dictionary);
      return dictionary;
    }
    return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, walk(child)]));
  }
  return walk(value);
}
