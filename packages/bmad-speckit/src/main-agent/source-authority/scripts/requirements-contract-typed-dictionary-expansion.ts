import { encodeGoalSemanticDictionary, decodeGoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;
const VERSION = 'RequirementsTypedDictionaryExpansion/v2';
const object = (value: unknown): value is JsonRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: string): never => { throw new Error(`requirements_typed_dictionary_expansion_${code}`); };

export const REQUIREMENTS_TYPED_DICTIONARY_EXPANSION_PROTOCOL =
  'RequirementsTypedDictionaryExpansion/v2 preserves a complete typed-source graph or coverage dictionary. '
  + 'Its semanticValue is the complete decoded JSON, not a summary. Re-encode it with the canonical '
  + 'GoalSemanticDictionary/v1 encoder and verify dictionaryHash as SHA-256 of canonical sorted-key JSON. '
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
      const encoded = encodeGoalSemanticDictionary(semanticValue);
      const expanded = canonicalJson(encoded) === canonical
        ? { schemaVersion: VERSION, dictionaryHash: sha256(canonical), semanticValue } : child;
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
      if (Object.keys(current).sort().join('|') !== ['schemaVersion', 'dictionaryHash', 'semanticValue'].sort().join('|') ||
        typeof current.dictionaryHash !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(current.dictionaryHash)) fail('fields_invalid');
      const canonical = canonicalJson(current);
      if (cache.has(canonical)) return cache.get(canonical);
      const dictionary = encodeGoalSemanticDictionary(current.semanticValue);
      if (sha256(canonicalJson(dictionary)) !== current.dictionaryHash) fail('dictionary_hash_mismatch');
      cache.set(canonical, dictionary);
      return dictionary;
    }
    return Object.fromEntries(Object.entries(current).map(([key, child]) => [key, walk(child)]));
  }
  return walk(value);
}
