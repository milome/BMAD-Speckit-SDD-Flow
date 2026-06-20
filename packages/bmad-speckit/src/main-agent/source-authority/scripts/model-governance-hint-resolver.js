"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModelGovernanceHintCandidate = resolveModelGovernanceHintCandidate;
exports.createStubModelGovernanceHintProvider = createStubModelGovernanceHintProvider;
const model_governance_hints_schema_1 = require("./model-governance-hints-schema");
async function resolveModelGovernanceHintCandidate(input, provider) {
    const candidate = await Promise.resolve(provider.resolve(input));
    if (!candidate) {
        return null;
    }
    (0, model_governance_hints_schema_1.assertValidModelGovernanceHintCandidate)(candidate);
    if (candidate.providerId !== provider.id) {
        throw new Error(`Model governance provider mismatch: candidate=${candidate.providerId}, provider=${provider.id}`);
    }
    if (candidate.providerMode !== provider.mode) {
        throw new Error(`Model governance provider mode mismatch: candidate=${candidate.providerMode}, provider=${provider.mode}`);
    }
    return candidate;
}
function createStubModelGovernanceHintProvider(candidate, id = 'stub-model-governance-provider') {
    return {
        id,
        mode: 'stub',
        resolve() {
            if (!candidate) {
                return null;
            }
            return {
                ...candidate,
                providerId: id,
                providerMode: 'stub',
            };
        },
    };
}
