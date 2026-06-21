"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRuntimePolicyAugmenter = registerRuntimePolicyAugmenter;
exports.applyRegisteredAugmenters = applyRegisteredAugmenters;
exports.clearAugmentersForTest = clearAugmentersForTest;
const augmenters = [];
/**
 * Register an augmenter (append order). Idempotent duplicate ids append another entry (tests should clear).
 * @param {string} id - Augmenter identifier.
 * @param {(policy: object, ctx: object) => object} fn - Augmenter function.
 */
function registerRuntimePolicyAugmenter(id, fn) {
    augmenters.push({ id, fn });
}
function applyRegisteredAugmenters(policy, ctx) {
    let p = policy;
    for (const { fn } of augmenters) {
        p = fn(p, ctx);
    }
    return p;
}
/** Vitest isolation */
function clearAugmentersForTest() {
    augmenters.length = 0;
}
