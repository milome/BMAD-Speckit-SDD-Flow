/**
 * Deterministic JSON serialization for `RuntimePolicy` emit / tests (deep-sorted object keys).
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = sortKeysDeep(rec[k]);
  }
  return out;
}

/** Stable JSON for policy objects; arrays preserve element order. */
export function stableStringifyPolicy(policy: unknown): string {
  return JSON.stringify(sortKeysDeep(policy));
}
