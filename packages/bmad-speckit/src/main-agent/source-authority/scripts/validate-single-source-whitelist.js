"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const ROOT = process.cwd();
const CONTRACT_PATH = '_bmad/_config/orchestration-governance.contract.yaml';
const MAPPING_PATH = '_bmad-output/runtime/requirement-records/index.json';
const CONTRACT_FIELDS = new Set([
    'version',
    'contract_id',
    'owner',
    'status',
    'updated_at',
    'description',
    'sources_of_truth',
    'consumption_rules',
    'signals',
    'stage_requirements',
    'mapping_contract',
    'adaptive_intake_governance_gate',
    'observability_targets',
    'gate_policy',
]);
const CONTRACT_FORBIDDEN_FIELDS = new Set([
    'pendingPacket',
    'sessionId',
    'retryCount',
    'lastTaskReport',
    'executionRecordId',
    'updatedItems',
]);
const MAPPING_TOP_FIELDS = new Set(['version', 'updatedAt', 'source', 'items']);
const MAPPING_ITEM_FIELDS = new Set([
    'requirementId',
    'sourceType',
    'epicId',
    'storyId',
    'flow',
    'sprintId',
    'allowedWriteScope',
    'status',
    'acceptanceRefs',
    'lastPacketId',
    'updatedAt',
]);
const MAPPING_FORBIDDEN_FIELDS = new Set([
    'signal_overrides',
    'required_signals',
    'severity_default',
    'gateThreshold',
    'strictness',
]);
function fail(message, failures) {
    failures.push(message);
}
function readYamlObject(relativePath) {
    const fullPath = node_path_1.default.join(ROOT, relativePath);
    if (!node_fs_1.default.existsSync(fullPath)) {
        throw new Error(`missing file: ${relativePath}`);
    }
    const parsed = js_yaml_1.default.load(node_fs_1.default.readFileSync(fullPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`expected YAML object: ${relativePath}`);
    }
    return parsed;
}
function readJsonObject(relativePath) {
    const fullPath = node_path_1.default.join(ROOT, relativePath);
    if (!node_fs_1.default.existsSync(fullPath)) {
        throw new Error(`missing file: ${relativePath}`);
    }
    const parsed = JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`expected JSON object: ${relativePath}`);
    }
    return parsed;
}
function validateObjectFields(input) {
    for (const key of Object.keys(input.object)) {
        if (!input.allowed.has(key)) {
            fail(`${input.label}: field is not whitelisted: ${key}`, input.failures);
        }
        if (input.forbidden.has(key)) {
            fail(`${input.label}: field is forbidden: ${key}`, input.failures);
        }
    }
}
function validateContract(contract, failures) {
    validateObjectFields({
        object: contract,
        allowed: CONTRACT_FIELDS,
        forbidden: CONTRACT_FORBIDDEN_FIELDS,
        label: CONTRACT_PATH,
        failures,
    });
    if (contract.sources_of_truth && typeof contract.sources_of_truth === 'object') {
        const sources = contract.sources_of_truth;
        if (sources.strategy_contract !== CONTRACT_PATH) {
            fail(`${CONTRACT_PATH}: sources_of_truth.strategy_contract must point to ${CONTRACT_PATH}`, failures);
        }
        if (sources.runtime_index !== MAPPING_PATH) {
            fail(`${CONTRACT_PATH}: sources_of_truth.runtime_index must point to ${MAPPING_PATH}`, failures);
        }
    }
    else {
        fail(`${CONTRACT_PATH}: missing sources_of_truth object`, failures);
    }
}
function validateMapping(mapping, failures) {
    validateObjectFields({
        object: mapping,
        allowed: MAPPING_TOP_FIELDS,
        forbidden: MAPPING_FORBIDDEN_FIELDS,
        label: MAPPING_PATH,
        failures,
    });
    if (mapping.source !== MAPPING_PATH) {
        fail(`${MAPPING_PATH}: source must point to itself`, failures);
    }
    if (!Array.isArray(mapping.items)) {
        fail(`${MAPPING_PATH}: items must be an array`, failures);
        return;
    }
    mapping.items.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            fail(`${MAPPING_PATH}: items[${index}] must be an object`, failures);
            return;
        }
        validateObjectFields({
            object: item,
            allowed: MAPPING_ITEM_FIELDS,
            forbidden: MAPPING_FORBIDDEN_FIELDS,
            label: `${MAPPING_PATH}: items[${index}]`,
            failures,
        });
    });
}
function main() {
    const failures = [];
    try {
        validateContract(readYamlObject(CONTRACT_PATH), failures);
        validateMapping(readJsonObject(MAPPING_PATH), failures);
    }
    catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    }
    if (failures.length > 0) {
        console.error('single-source whitelist validation failed');
        for (const failure of failures) {
            console.error(`- ${failure}`);
        }
        return 1;
    }
    console.log('single-source whitelist validation passed');
    console.log(`contract: ${CONTRACT_PATH}`);
    console.log(`mapping: ${MAPPING_PATH}`);
    return 0;
}
if (require.main === module) {
    process.exit(main());
}
