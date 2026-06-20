"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACILITATOR_REGISTRY = exports.FACILITATOR_REGISTRY_VERSION = void 0;
exports.getFacilitatorRegistration = getFacilitatorRegistration;
exports.resolveFacilitatorRuntimeBindings = resolveFacilitatorRuntimeBindings;
const reviewer_contract_1 = require("./reviewer-contract");
const party_mode_runtime_assets_1 = require("./i18n/party-mode-runtime-assets");
exports.FACILITATOR_REGISTRY_VERSION = 'facilitator_registry_v1';
exports.FACILITATOR_REGISTRY = {
    identity: reviewer_contract_1.FACILITATOR_PRODUCT_IDENTITY,
    displayName: reviewer_contract_1.FACILITATOR_DISPLAY_NAME,
    registryVersion: exports.FACILITATOR_REGISTRY_VERSION,
    cursorDefinitionSourcePath: reviewer_contract_1.CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
    claudeTarget: {
        agentPath: reviewer_contract_1.CLAUDE_FACILITATOR_TARGET_PATH,
        agentMention: reviewer_contract_1.CLAUDE_FACILITATOR_AGENT_MENTION,
    },
    hosts: {
        cursor: {
            preferredRoute: {
                tool: 'cursor-task',
                subtypeOrExecutor: reviewer_contract_1.FACILITATOR_DISPLAY_NAME,
            },
            fallbackRoute: {
                tool: 'mcp_task',
                subtypeOrExecutor: 'generalPurpose',
            },
        },
        claude: {
            preferredRoute: {
                tool: 'Agent',
                subtypeOrExecutor: reviewer_contract_1.CLAUDE_FACILITATOR_AGENT_MENTION,
            },
            fallbackRoute: {
                tool: 'Agent',
                subtypeOrExecutor: 'general-purpose',
            },
        },
    },
};
function getFacilitatorRegistration() {
    return exports.FACILITATOR_REGISTRY;
}
function resolveFacilitatorRuntimeBindings(projectRoot, host, resolvedMode) {
    return {
        facilitator: (0, party_mode_runtime_assets_1.resolveFacilitatorSourceAsset)(projectRoot, host, resolvedMode),
        workflow: (0, party_mode_runtime_assets_1.resolveCanonicalPartyModeAsset)(projectRoot, 'workflow', resolvedMode),
        step01: (0, party_mode_runtime_assets_1.resolveCanonicalPartyModeAsset)(projectRoot, 'step-01-agent-loading', resolvedMode),
        step02: host === 'cursor'
            ? (0, party_mode_runtime_assets_1.resolveCursorPartyModeAsset)(projectRoot, 'step-02-discussion-orchestration', resolvedMode)
            : (0, party_mode_runtime_assets_1.resolveCanonicalPartyModeAsset)(projectRoot, 'step-02-discussion-orchestration', resolvedMode),
        step03: (0, party_mode_runtime_assets_1.resolveCanonicalPartyModeAsset)(projectRoot, 'step-03-graceful-exit', resolvedMode),
    };
}
