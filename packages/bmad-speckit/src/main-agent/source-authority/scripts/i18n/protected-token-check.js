"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectProtectedTokens = collectProtectedTokens;
exports.assertProtectedTokensPreserved = assertProtectedTokensPreserved;
function collectProtectedTokens(manifest) {
    const tokens = new Set();
    for (const token of manifest.control?.protected_tokens ?? []) {
        tokens.add(token);
    }
    for (const anchor of Object.values(manifest.anchors ?? {})) {
        tokens.add(anchor);
    }
    return [...tokens];
}
function assertProtectedTokensPreserved(protectedTokens, renderedOutputs) {
    const errors = [];
    const joinedOutput = renderedOutputs.join('\n');
    for (const token of protectedTokens) {
        if (!joinedOutput.includes(token)) {
            errors.push(`Protected token missing from output: ${token}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
