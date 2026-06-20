"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTemplateManifest = validateTemplateManifest;
const protected_token_check_1 = require("./protected-token-check");
const REQUIRED_BLOCKS = [
    'control',
    'localization',
    'strings',
    'anchors',
];
function extractPlaceholders(value) {
    return [...value.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((match) => match[1]);
}
function collectReferencedProtectedTokens(variants, protectedTokens) {
    const values = Object.values(variants).filter((value) => typeof value === 'string');
    return protectedTokens.filter((token) => values.some((value) => value.includes(token)));
}
function validateTemplateManifest(manifest) {
    const errors = [];
    for (const block of REQUIRED_BLOCKS) {
        if (!manifest[block]) {
            errors.push(`Missing required block: ${block}`);
        }
    }
    const anchorValues = Object.values(manifest.anchors ?? {});
    const seenAnchors = new Set();
    for (const anchor of anchorValues) {
        if (seenAnchors.has(anchor)) {
            errors.push(`Duplicate anchor value: ${anchor}`);
        }
        seenAnchors.add(anchor);
    }
    for (const [key, variants] of Object.entries(manifest.strings ?? {})) {
        const providedValues = Object.values(variants).filter((value) => Boolean(value));
        if (providedValues.length === 0) {
            errors.push(`Missing all language variants for strings.${key}`);
            continue;
        }
        for (const [language, value] of Object.entries(variants)) {
            for (const placeholder of extractPlaceholders(value ?? '')) {
                if (!manifest.control?.placeholders?.[placeholder]) {
                    errors.push(`Undeclared placeholder: ${placeholder} in strings.${key}.${language}`);
                }
            }
        }
    }
    const protectedTokens = (0, protected_token_check_1.collectProtectedTokens)(manifest);
    for (const [key, variants] of Object.entries(manifest.strings ?? {})) {
        const referencedTokens = collectReferencedProtectedTokens(variants, protectedTokens);
        if (referencedTokens.length === 0) {
            continue;
        }
        for (const [language, value] of Object.entries(variants)) {
            if (!value) {
                continue;
            }
            const result = (0, protected_token_check_1.assertProtectedTokensPreserved)(referencedTokens, [value]);
            for (const error of result.errors) {
                const missing = error.replace('Protected token missing from output: ', '');
                errors.push(`Protected token missing from strings.${key}.${language}: ${missing}`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
