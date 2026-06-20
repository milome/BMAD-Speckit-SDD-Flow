"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDeterministicSplit = assignDeterministicSplit;
const node_crypto_1 = require("node:crypto");
function assignDeterministicSplit(options) {
    const strategy = options.strategy ?? 'story_hash_v1';
    const stableKey = `${options.seed}:${options.groupKey ?? 'ungrouped'}`;
    const hash = (0, node_crypto_1.createHash)('sha256').update(stableKey).digest('hex');
    const bucket = parseInt(hash.slice(0, 8), 16) % 100;
    let assignment = 'train';
    if (bucket >= 80 && bucket < 90)
        assignment = 'validation';
    if (bucket >= 90)
        assignment = 'test';
    return {
        assignment,
        seed: options.seed,
        strategy,
        group_key: options.groupKey,
    };
}
