"use strict";
/**
 * Deterministic JSON serialization for `RuntimePolicy` emit / tests (deep-sorted object keys).
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringifyPolicy = stableStringifyPolicy;
function sortKeysDeep(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep);
    }
    const rec = value;
    const keys = Object.keys(rec).sort();
    const out = {};
    for (const k of keys) {
        out[k] = sortKeysDeep(rec[k]);
    }
    return out;
}
/** Stable JSON for policy objects; arrays preserve element order. */
function stableStringifyPolicy(policy) {
    return JSON.stringify(sortKeysDeep(policy));
}
