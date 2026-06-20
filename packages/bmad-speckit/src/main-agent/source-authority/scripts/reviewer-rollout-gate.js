"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEWER_ROLLOUT_GATE_VERSION = void 0;
exports.buildReviewerRolloutGate = buildReviewerRolloutGate;
const reviewer_contract_1 = require("./reviewer-contract");
exports.REVIEWER_ROLLOUT_GATE_VERSION = 'reviewer_rollout_gate_v1';
function buildReviewerRolloutGate(input) {
    const completeProofs = [...new Set(input?.completeProofs ?? [])].filter((proof) => reviewer_contract_1.REVIEWER_REQUIRED_ROLLOUT_PROOFS.includes(proof));
    const blockingProofs = reviewer_contract_1.REVIEWER_REQUIRED_ROLLOUT_PROOFS.filter((proof) => !completeProofs.includes(proof));
    const ready = blockingProofs.length === 0;
    return {
        version: exports.REVIEWER_ROLLOUT_GATE_VERSION,
        status: ready ? 'ready' : 'blocked',
        requiredProofs: reviewer_contract_1.REVIEWER_REQUIRED_ROLLOUT_PROOFS,
        completeProofs,
        blockingProofs,
        cleanupAllowed: ready,
        canClaimFullIsomorphism: ready,
        summary: ready
            ? 'All reviewer rollout proofs are complete; legacy fallback cleanup and full-isomorphism claims are allowed.'
            : `Blocked until proofs are complete: ${blockingProofs.join(', ')}`,
    };
}
