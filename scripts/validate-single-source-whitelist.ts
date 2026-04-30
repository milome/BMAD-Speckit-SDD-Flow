import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;

const ROOT = process.cwd();

const CONTRACT_PATH = '_bmad/_config/orchestration-governance.contract.yaml';
const MAPPING_PATH = '_bmad-output/runtime/governance/user_story_mapping.json';

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

function fail(message: string, failures: string[]): void {
  failures.push(message);
}

function readYamlObject(relativePath: string): JsonObject {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  const parsed = yaml.load(fs.readFileSync(fullPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`expected YAML object: ${relativePath}`);
  }
  return parsed as JsonObject;
}

function readJsonObject(relativePath: string): JsonObject {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`expected JSON object: ${relativePath}`);
  }
  return parsed as JsonObject;
}

function validateObjectFields(input: {
  object: JsonObject;
  allowed: Set<string>;
  forbidden: Set<string>;
  label: string;
  failures: string[];
}): void {
  for (const key of Object.keys(input.object)) {
    if (!input.allowed.has(key)) {
      fail(`${input.label}: field is not whitelisted: ${key}`, input.failures);
    }
    if (input.forbidden.has(key)) {
      fail(`${input.label}: field is forbidden: ${key}`, input.failures);
    }
  }
}

function validateContract(contract: JsonObject, failures: string[]): void {
  validateObjectFields({
    object: contract,
    allowed: CONTRACT_FIELDS,
    forbidden: CONTRACT_FORBIDDEN_FIELDS,
    label: CONTRACT_PATH,
    failures,
  });

  if (contract.sources_of_truth && typeof contract.sources_of_truth === 'object') {
    const sources = contract.sources_of_truth as JsonObject;
    if (sources.strategy_contract !== CONTRACT_PATH) {
      fail(`${CONTRACT_PATH}: sources_of_truth.strategy_contract must point to ${CONTRACT_PATH}`, failures);
    }
    if (sources.runtime_index !== MAPPING_PATH) {
      fail(`${CONTRACT_PATH}: sources_of_truth.runtime_index must point to ${MAPPING_PATH}`, failures);
    }
  } else {
    fail(`${CONTRACT_PATH}: missing sources_of_truth object`, failures);
  }
}

function validateMapping(mapping: JsonObject, failures: string[]): void {
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
      object: item as JsonObject,
      allowed: MAPPING_ITEM_FIELDS,
      forbidden: MAPPING_FORBIDDEN_FIELDS,
      label: `${MAPPING_PATH}: items[${index}]`,
      failures,
    });
  });
}

function main(): number {
  const failures: string[] = [];
  try {
    validateContract(readYamlObject(CONTRACT_PATH), failures);
    validateMapping(readJsonObject(MAPPING_PATH), failures);
  } catch (error) {
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
