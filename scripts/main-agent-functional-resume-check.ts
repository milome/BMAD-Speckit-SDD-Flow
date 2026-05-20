/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  registry?: string;
  outDir?: string;
  checkpointId?: string;
  expectedSourceDocumentHash?: string;
  expectedImplementationConfirmationHash?: string;
  expectedArchitectureConfirmationHash?: string;
  generatedAt?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

interface Check {
  id: string;
  decision: Decision;
  summary: string;
  details?: JsonObject;
}

interface RegistryValidationResult {
  rawPresent: boolean;
  status: string;
  groups: number;
  failureCases: number;
  recoveryActions: number;
  globalEventTypes: number;
  fullLinkRequiredFixtureCases: string[];
  exercisedFixtureCases: string[];
  unexercisedCases: string[];
  issues: string[];
}

interface RegistryPayloadKindContractPolicy {
  requiredFields: string[];
  forbiddenFields: string[];
  allowedControlWriteModes: string[];
}

interface RegistryControlWriteModePolicy {
  allowedWritesControlFields: string[];
}

interface RegistryEventSpecificRequirementPolicy {
  eventType: string;
  payloadKind?: string;
  requiredSourceRefs?: boolean;
  requiredFields: string[];
  forbiddenFields: string[];
  allowedControlWriteMode?: string;
}

interface GovernanceEventTypeRegistryPolicy {
  controlFieldVocabulary: Set<string>;
  payloadKindContracts: Map<string, RegistryPayloadKindContractPolicy>;
  controlWriteModePolicies: Map<string, RegistryControlWriteModePolicy>;
  eventSpecificRequirements: Map<string, RegistryEventSpecificRequirementPolicy>;
}

const OPEN_RERUN_STATUSES = new Set(['open', 'in_progress', 'no_progress', 'blocked']);
const OPEN_RCA_STATUSES = new Set(['open', 'in_progress', 'blocked']);
const OPEN_FAILURE_STATUSES = new Set(['open', 'in_progress', 'blocked']);
const NON_TERMINAL_CLOSURE_STATUSES = new Set(['open', 'fail', 'blocked']);
const TERMINAL_TRACE_STATUSES = new Set(['PASS', 'PENDING', 'MISSING_EVIDENCE', 'BLOCKED']);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function hasOwn(value: unknown, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function readText(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonl(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function blockingIssue(code: string, message: string, refs: string[] = []): string {
  return refs.length ? `${code}:${message}:${refs.join(',')}` : `${code}:${message}`;
}

function architectureHash(record: JsonObject): string {
  const state = record.architectureConfirmationState as JsonObject | undefined;
  return text(state?.currentArchitectureConfirmationHash);
}

function extractImplementationConfirmation(sourceText: string): JsonObject | undefined {
  const blocks = [...sourceText.matchAll(/```yaml\s*\n([\s\S]*?)```/giu)];
  let latest: JsonObject | undefined;
  for (const match of blocks) {
    try {
      const parsed = yaml.load(match[1]) as unknown;
      const root = asObject(parsed);
      const confirmation = asObject(root?.implementationConfirmation);
      if (confirmation) latest = confirmation;
    } catch {
      continue;
    }
  }
  return latest;
}

function readRegistryFromArgs(args: ParsedArgs): { confirmation?: JsonObject; registry?: JsonObject; sourcePath?: string } {
  if (args.registry) {
    const parsed = yaml.load(readText(path.resolve(args.registry))) as unknown;
    const object = asObject(parsed);
    if (!object) throw new Error(`registry object expected: ${args.registry}`);
    return { registry: object, sourcePath: normalizePathForRecord(path.resolve(args.registry)) };
  }
  if (!args.source) return {};
  const sourcePath = path.resolve(args.source);
  const confirmation = extractImplementationConfirmation(readText(sourcePath));
  const registry = asObject(confirmation?.functionalResumeFailureCaseRegistry);
  return { confirmation, registry, sourcePath: normalizePathForRecord(sourcePath) };
}

function latestBy<T extends JsonObject>(items: T[], key: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    const id = text(item[key]);
    if (id) out.set(id, item);
  }
  return out;
}

function artifactHashMap(record: JsonObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const artifact of objects(record.artifactIndex)) {
    const artifactPath = normalizePathForRecord(text(artifact.path));
    const hash = text(artifact.hash ?? artifact.contentHash);
    if (artifactPath && hash) out[artifactPath] = hash;
  }
  return out;
}

function validatePayloadContract(
  eventType: string,
  eventRow: JsonObject,
  policy: GovernanceEventTypeRegistryPolicy | undefined,
  issues: string[]
): {
  requiredFields: string[];
  forbiddenFields: string[];
  requiredSourceRefs: boolean;
  allowedControlWriteMode: string;
} {
  const payloadKind = text(eventRow.payloadKind);
  const contract = asObject(eventRow.payloadContract);
  if (!contract) {
    issues.push(blockingIssue('governance_event_type_missing_payload_contract', `${eventType} missing payloadContract`, [eventType]));
    return {
      requiredFields: [],
      forbiddenFields: [],
      requiredSourceRefs: false,
      allowedControlWriteMode: '',
    };
  }
  const requiredFields = strings(contract.requiredFields);
  const forbiddenFields = strings(contract.forbiddenFields);
  const requiredSourceRefs = contract.requiredSourceRefs === true;
  const allowedControlWriteMode = text(contract.allowedControlWriteMode);
  const payloadKindPolicy = policy?.payloadKindContracts.get(payloadKind);
  const eventPolicy = policy?.eventSpecificRequirements.get(eventType);

  if (!payloadKindPolicy) {
    issues.push(blockingIssue('governance_event_type_invalid_payload_kind', `${eventType} has invalid payloadKind ${payloadKind}`, [eventType]));
  } else {
    for (const field of payloadKindPolicy.requiredFields) {
      if (!requiredFields.includes(field)) {
        issues.push(
          blockingIssue('governance_event_type_payload_contract_missing_required_field', `${eventType} payloadContract.requiredFields missing ${field}`, [
            eventType,
            field,
          ])
        );
      }
    }
    for (const field of payloadKindPolicy.forbiddenFields) {
      if (!forbiddenFields.includes(field)) {
        issues.push(
          blockingIssue('governance_event_type_payload_contract_missing_forbidden_field', `${eventType} payloadContract.forbiddenFields missing ${field}`, [
            eventType,
            field,
          ])
        );
      }
    }
    for (const field of payloadKindPolicy.requiredFields) {
      if (forbiddenFields.includes(field)) {
        issues.push(blockingIssue('governance_event_type_payload_contract_forbids_payload_field', `${eventType} payloadContract forbids ${field}`, [eventType, field]));
      }
    }
    if (!payloadKindPolicy.allowedControlWriteModes.includes(allowedControlWriteMode)) {
      issues.push(blockingIssue('governance_event_type_invalid_control_write_mode', `${eventType} invalid allowedControlWriteMode ${allowedControlWriteMode}`, [eventType]));
    }
  }
  if (eventPolicy) {
    if (eventPolicy.payloadKind && eventPolicy.payloadKind !== payloadKind) {
      issues.push(blockingIssue('governance_event_type_policy_payload_kind_mismatch', `${eventType} must use payloadKind ${eventPolicy.payloadKind}`, [eventType]));
    }
    for (const field of eventPolicy.requiredFields) {
      if (!requiredFields.includes(field)) {
        issues.push(blockingIssue('governance_event_type_policy_missing_required_field', `${eventType} policy requires ${field}`, [eventType, field]));
      }
    }
    for (const field of eventPolicy.forbiddenFields) {
      if (!forbiddenFields.includes(field)) {
        issues.push(blockingIssue('governance_event_type_policy_missing_forbidden_field', `${eventType} policy forbids ${field}`, [eventType, field]));
      }
    }
    if (eventPolicy.requiredSourceRefs === true && requiredSourceRefs !== true) {
      issues.push(blockingIssue('governance_event_type_payload_contract_missing_source_refs', `${eventType} must require sourceRefs`, [eventType]));
    }
    if (eventPolicy.allowedControlWriteMode && eventPolicy.allowedControlWriteMode !== allowedControlWriteMode) {
      issues.push(blockingIssue('governance_event_type_policy_wrong_write_mode', `${eventType} must use ${eventPolicy.allowedControlWriteMode}`, [eventType]));
    }
  }
  return { requiredFields, forbiddenFields, requiredSourceRefs, allowedControlWriteMode };
}

function normalizeStringListPolicy(value: unknown): string[] {
  return strings(value);
}

function normalizeGovernanceEventTypeRegistryPolicy(
  confirmation: JsonObject | undefined,
  issues: string[]
): GovernanceEventTypeRegistryPolicy | undefined {
  const raw = asObject(confirmation?.governanceEventTypeRegistryPolicy);
  if (!raw) {
    issues.push(blockingIssue('governance_event_type_registry_policy_missing', 'governanceEventTypeRegistryPolicy is required'));
    return undefined;
  }
  const controlFieldVocabulary = new Set<string>();
  for (const field of strings(raw.controlFieldVocabulary)) {
    if (controlFieldVocabulary.has(field)) {
      issues.push(blockingIssue('governance_event_type_policy_control_field_vocabulary_duplicate', `${field} duplicated`, [field]));
    }
    controlFieldVocabulary.add(field);
  }
  const payloadKindContracts = new Map<string, RegistryPayloadKindContractPolicy>();
  for (const [index, row] of objects(raw.payloadKindContracts).entries()) {
    const payloadKind = text(row.payloadKind);
    if (!payloadKind) {
      issues.push(blockingIssue('governance_event_type_policy_payload_kind_missing', `payloadKindContracts[${index}] missing payloadKind`));
      continue;
    }
    if (payloadKindContracts.has(payloadKind)) {
      issues.push(blockingIssue('governance_event_type_policy_payload_kind_duplicate', `${payloadKind} duplicated`, [payloadKind]));
    }
    payloadKindContracts.set(payloadKind, {
      requiredFields: normalizeStringListPolicy(row.requiredFields),
      forbiddenFields: normalizeStringListPolicy(row.forbiddenFields),
      allowedControlWriteModes: normalizeStringListPolicy(row.allowedControlWriteModes),
    });
  }
  const controlWriteModePolicies = new Map<string, RegistryControlWriteModePolicy>();
  for (const [index, row] of objects(raw.controlWriteModePolicies).entries()) {
    const mode = text(row.allowedControlWriteMode ?? row.mode);
    if (!mode) {
      issues.push(blockingIssue('governance_event_type_policy_write_mode_missing', `controlWriteModePolicies[${index}] missing allowedControlWriteMode`));
      continue;
    }
    if (controlWriteModePolicies.has(mode)) {
      issues.push(blockingIssue('governance_event_type_policy_write_mode_duplicate', `${mode} duplicated`, [mode]));
    }
    const allowedWritesControlFields = normalizeStringListPolicy(row.allowedWritesControlFields);
    for (const field of allowedWritesControlFields) {
      if (!controlFieldVocabulary.has(field)) {
        issues.push(blockingIssue('governance_event_type_policy_control_field_vocabulary_unknown', `${mode} references unknown ${field}`, [mode, field]));
      }
    }
    controlWriteModePolicies.set(mode, { allowedWritesControlFields });
  }
  const eventSpecificRequirements = new Map<string, RegistryEventSpecificRequirementPolicy>();
  for (const [index, row] of objects(raw.eventSpecificRequirements).entries()) {
    const eventType = text(row.eventType);
    if (!eventType) {
      issues.push(blockingIssue('governance_event_type_policy_event_requirement_missing', `eventSpecificRequirements[${index}] missing eventType`));
      continue;
    }
    if (eventSpecificRequirements.has(eventType)) {
      issues.push(blockingIssue('governance_event_type_policy_event_requirement_duplicate', `${eventType} duplicated`, [eventType]));
    }
    eventSpecificRequirements.set(eventType, {
      eventType,
      payloadKind: text(row.payloadKind) || undefined,
      requiredSourceRefs: row.requiredSourceRefs === true,
      requiredFields: normalizeStringListPolicy(row.requiredFields),
      forbiddenFields: normalizeStringListPolicy(row.forbiddenFields),
      allowedControlWriteMode: text(row.allowedControlWriteMode) || undefined,
    });
  }
  if (!payloadKindContracts.size) {
    issues.push(blockingIssue('governance_event_type_policy_payload_kind_contracts_missing', 'payloadKindContracts[] is required'));
  }
  if (!controlWriteModePolicies.size) {
    issues.push(blockingIssue('governance_event_type_policy_control_write_modes_missing', 'controlWriteModePolicies[] is required'));
  }
  if (!controlFieldVocabulary.size) {
    issues.push(blockingIssue('governance_event_type_policy_control_field_vocabulary_missing', 'controlFieldVocabulary[] is required'));
  }
  return { controlFieldVocabulary, payloadKindContracts, controlWriteModePolicies, eventSpecificRequirements };
}

function normalizeGovernanceEventTypeRegistry(confirmation: JsonObject | undefined, issues: string[]): Map<string, JsonObject> {
  const policy = normalizeGovernanceEventTypeRegistryPolicy(confirmation, issues);
  const eventTypes = new Map<string, JsonObject>();
  for (const [index, row] of objects(confirmation?.governanceEventTypeRegistry).entries()) {
    const eventType = text(row.eventType);
    if (!eventType) {
      issues.push(blockingIssue('governance_event_type_missing_id', `governanceEventTypeRegistry[${index}] missing eventType`));
      continue;
    }
    if (eventTypes.has(eventType)) {
      issues.push(blockingIssue('governance_event_type_duplicate_id', `${eventType} is duplicated`, [eventType]));
    }
    for (const field of ['ownerModel', 'payloadKind', 'canAffectControlFlow', 'payloadContract']) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        issues.push(blockingIssue('governance_event_type_missing_required_field', `${eventType} missing ${field}`, [eventType, field]));
      }
    }
    const writesControlFields = strings(row.writesControlFields);
    const payloadContract = validatePayloadContract(eventType, row, policy, issues);
    validateEventControlWriteMode(eventType, writesControlFields, payloadContract.allowedControlWriteMode, policy, issues);
    eventTypes.set(eventType, {
      eventType,
      payloadKind: text(row.payloadKind),
      writesControlFields,
      payloadContract,
      canAffectControlFlow: row.canAffectControlFlow === true,
    });
  }
  return eventTypes;
}

function validateEventControlWriteMode(
  eventType: string,
  writesControlFields: string[],
  mode: string,
  policy: GovernanceEventTypeRegistryPolicy | undefined,
  issues: string[]
): void {
  const modePolicy = policy?.controlWriteModePolicies.get(mode);
  if (!modePolicy) {
    issues.push(blockingIssue('governance_event_type_unknown_control_write_mode_policy', `${eventType} missing policy for write mode ${mode}`, [eventType, mode]));
    return;
  }
  for (const field of writesControlFields) {
    if (!policy?.controlFieldVocabulary.has(field)) {
      issues.push(blockingIssue('governance_event_type_control_field_not_in_vocabulary', `${eventType} writes unknown control field ${field}`, [eventType, field]));
    }
    if (!modePolicy.allowedWritesControlFields.includes(field)) {
      issues.push(blockingIssue('governance_event_type_control_mode_unknown_field', `${eventType} ${mode} writes unsupported ${field}`, [eventType, field]));
    }
  }
}

function checkHashes(record: JsonObject, args: ParsedArgs): Check {
  const expected = {
    sourceDocumentHash: args.expectedSourceDocumentHash ?? text(record.sourceDocumentHash),
    implementationConfirmationHash:
      args.expectedImplementationConfirmationHash ?? text(record.implementationConfirmationHash),
    architectureConfirmationHash:
      args.expectedArchitectureConfirmationHash ?? architectureHash(record),
  };
  const actual = {
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(record),
  };
  const mismatches = Object.entries(expected)
    .filter(([, value]) => value)
    .filter(([key, value]) => actual[key as keyof typeof actual] !== value)
    .map(([key]) => key);
  return {
    id: 'resume-authority-hashes-current',
    decision: mismatches.length === 0 ? 'pass' : 'blocked',
    summary: mismatches.length === 0 ? 'Resume authority hashes match current record' : 'Resume authority hash drift detected',
    details: { expected, actual, mismatches },
  };
}

function checkArchitecture(record: JsonObject): Check {
  const state = record.architectureConfirmationState as JsonObject | undefined;
  const active = text(state?.status) === 'active' && Boolean(text(state?.currentArchitectureConfirmationHash));
  return {
    id: 'architecture-confirmation-active',
    decision: active ? 'pass' : 'blocked',
    summary: active ? 'Architecture confirmation is active for resume' : 'Architecture confirmation is not active',
    details: {
      status: text(state?.status),
      currentArchitectureConfirmationHash: text(state?.currentArchitectureConfirmationHash),
    },
  };
}

function checkControlledSources(record: JsonObject): Check {
  const requiredArrays = [
    'confirmationHistory',
    'executionIterations',
    'gateChecks',
    'requirementClosures',
    'artifactIndex',
  ];
  const missing = requiredArrays.filter((key) => !Array.isArray(record[key]));
  return {
    id: 'controlled-record-sources-present',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary: missing.length === 0 ? 'Required controlled RequirementRecord arrays are present' : 'Required controlled source arrays are missing',
    details: { requiredArrays, missing },
  };
}

function checkBlockers(record: JsonObject): Check {
  const openFailures = objects(record.failureRecords).filter((item) =>
    OPEN_FAILURE_STATUSES.has(text(item.status))
  );
  const openReruns = objects(record.rerunLoops).filter((item) =>
    OPEN_RERUN_STATUSES.has(text(item.status))
  );
  const openRca = objects(record.rcaRecords).filter((item) => OPEN_RCA_STATUSES.has(text(item.status)));
  const latestClosures = [...latestBy(objects(record.requirementClosures), 'requirementId').values()];
  const openClosures = latestClosures.filter((item) =>
    NON_TERMINAL_CLOSURE_STATUSES.has(text(item.status))
  );
  const issues = [
    ...openFailures.map((item) => `open_failure:${text(item.failureId) || '<missing>'}`),
    ...openReruns.map((item) => `pending_rerun:${text(item.rerunLoopId) || '<missing>'}`),
    ...openRca.map((item) => `open_rca:${text(item.rcaId) || '<missing>'}`),
    ...openClosures.map((item) => `non_terminal_closure:${text(item.requirementId) || '<missing>'}`),
  ];
  return {
    id: 'resume-open-blockers-clear',
    decision: issues.length === 0 ? 'pass' : 'blocked',
    summary: issues.length === 0 ? 'No open blocker prevents resume' : 'Open blocker requires fail-closed resume',
    details: { issues },
  };
}

function checkRequiredArtifacts(record: JsonObject): Check {
  const deliveryEvidence = record.deliveryEvidence as JsonObject | undefined;
  const requiredCommands = objects(deliveryEvidence?.requiredCommands);
  const indexed = artifactHashMap(record);
  const missing: string[] = [];
  for (const command of requiredCommands) {
    for (const artifact of objects(command.artifactRefs)) {
      const artifactPath = normalizePathForRecord(text(artifact.path));
      const expectedHash = text(artifact.hash ?? artifact.contentHash);
      if (!artifactPath || !expectedHash) {
        missing.push(`artifact_metadata_missing:${text(command.commandId) || '<missing-command>'}`);
        continue;
      }
      if (indexed[artifactPath] !== expectedHash) {
        missing.push(`artifact_not_indexed_or_hash_mismatch:${artifactPath}`);
      }
    }
  }
  return {
    id: 'resume-required-artifacts-indexed',
    decision: missing.length === 0 ? 'pass' : 'blocked',
    summary: missing.length === 0 ? 'Required artifacts are indexed with matching hashes' : 'Required artifacts missing or hash mismatched',
    details: { checkedCommands: requiredCommands.length, missing },
  };
}

function validateFunctionalResumeFailureCaseRegistry(input: {
  confirmation?: JsonObject;
  registry?: JsonObject;
  sourcePath?: string;
}): RegistryValidationResult {
  const issues: string[] = [];
  const registry = input.registry;
  if (!registry) {
    issues.push('functional_resume_failure_case_registry_missing:functionalResumeFailureCaseRegistry is required');
    return {
      rawPresent: false,
      status: '',
      groups: 0,
      failureCases: 0,
      recoveryActions: 0,
      globalEventTypes: 0,
      fullLinkRequiredFixtureCases: [],
      exercisedFixtureCases: [],
      unexercisedCases: [],
      issues,
    };
  }

  const globalEventTypes = normalizeGovernanceEventTypeRegistry(input.confirmation, issues);
  if (hasOwn(registry, 'controlledRecordEventTypes')) {
    issues.push(
      blockingIssue(
        'resume_failure_second_event_registry_present',
        'functionalResumeFailureCaseRegistry.controlledRecordEventTypes is forbidden; use implementationConfirmation.governanceEventTypeRegistry[] only',
        ['functionalResumeFailureCaseRegistry.controlledRecordEventTypes']
      )
    );
  }

  const eventTypes = globalEventTypes;
  const groups = objects(registry.groups);
  const failureCases = objects(registry.failureCases);
  const actions = objects(registry.recoveryActionDefinitions);
  const groupDefs = new Map<string, JsonObject>();
  const groupByCase = new Map<string, string>();
  const actionDefs = new Map<string, JsonObject>();

  if (!groups.length && failureCases.length) {
    issues.push('resume_failure_groups_missing:functionalResumeFailureCaseRegistry.groups[] is required');
  }
  for (const [index, group] of groups.entries()) {
    const groupId = text(group.groupId);
    if (!groupId) {
      issues.push(blockingIssue('resume_failure_group_missing_id', `groups[${index}] missing groupId`));
      continue;
    }
    if (groupDefs.has(groupId)) issues.push(blockingIssue('resume_failure_group_duplicate_id', `${groupId} is duplicated`, [groupId]));
    if (!text(group.label ?? group.title)) issues.push(blockingIssue('resume_failure_group_missing_label', `${groupId} missing label`, [groupId]));
    const caseRefs = strings(group.caseRefs);
    if (!caseRefs.length) issues.push(blockingIssue('resume_failure_group_missing_case_refs', `${groupId} missing caseRefs[]`, [groupId]));
    groupDefs.set(groupId, { groupId, caseRefs });
    for (const caseId of caseRefs) {
      if (groupByCase.has(caseId) && groupByCase.get(caseId) !== groupId) {
        issues.push(blockingIssue('resume_failure_case_group_conflict', `${caseId} assigned to multiple groups`, [caseId, groupByCase.get(caseId) ?? '', groupId]));
      }
      groupByCase.set(caseId, groupId);
    }
  }

  if (!actions.length && failureCases.length) {
    issues.push('resume_failure_recovery_action_definitions_missing:functionalResumeFailureCaseRegistry.recoveryActionDefinitions[] is required');
  }
  for (const [index, action] of actions.entries()) {
    const actionId = text(action.actionId);
    if (!actionId) {
      issues.push(blockingIssue('resume_failure_recovery_action_missing_id', `recoveryActionDefinitions[${index}] missing actionId`));
      continue;
    }
    if (actionDefs.has(actionId)) {
      issues.push(blockingIssue('resume_failure_recovery_action_duplicate_id', `${actionId} is duplicated`, [actionId]));
    }
    if (!text(action.label ?? action.description)) {
      issues.push(blockingIssue('resume_failure_recovery_action_missing_required_field', `${actionId} missing label or description`, [actionId]));
    }
    const writesControlFields = strings(action.writesControlFields);
    const recordEventTypes = strings(action.recordEventTypes);
    if (writesControlFields.length && !recordEventTypes.length) {
      issues.push(blockingIssue('resume_failure_recovery_action_missing_record_event_types', `${actionId} writes control fields but missing recordEventTypes[]`, [actionId]));
    }
    const coveredControlFields = new Set<string>();
    for (const eventType of recordEventTypes) {
      const eventDef = eventTypes.get(eventType);
      if (!eventDef) {
        issues.push(blockingIssue('resume_failure_recovery_action_unknown_event_type', `${actionId} references unknown eventType ${eventType}`, [actionId, eventType]));
        continue;
      }
      strings(eventDef.writesControlFields).forEach((field) => coveredControlFields.add(field));
      const globalDef = globalEventTypes.get(eventType);
      if (!globalDef || !asObject(globalDef.payloadContract)) {
        issues.push(
          blockingIssue(
            'resume_failure_recovery_action_event_missing_payload_contract',
            `${eventType} must be defined in global governanceEventTypeRegistry[] with payloadContract`,
            [actionId, eventType]
          )
        );
      }
    }
    for (const field of writesControlFields) {
      if (!coveredControlFields.has(field)) {
        issues.push(blockingIssue('resume_failure_recovery_action_uncovered_control_field', `${actionId} writes ${field} but eventTypes do not cover it`, [actionId, field]));
      }
    }
    actionDefs.set(actionId, { actionId, writesControlFields, recordEventTypes });
  }

  const seenCases = new Set<string>();
  for (const [index, failureCase] of failureCases.entries()) {
    const caseId = text(failureCase.id);
    if (!caseId) {
      issues.push(blockingIssue('resume_failure_case_missing_id', `failureCases[${index}] missing id`));
      continue;
    }
    if (seenCases.has(caseId)) issues.push(blockingIssue('resume_failure_case_duplicate_id', `${caseId} is duplicated`, [caseId]));
    seenCases.add(caseId);
    const explicitGroupId = text(failureCase.groupId);
    const mappedGroupId = groupByCase.get(caseId) ?? '';
    const groupId = explicitGroupId || mappedGroupId;
    if (!groupId) {
      issues.push(blockingIssue('resume_failure_case_missing_group_ref', `${caseId} missing groupId and groups[].caseRefs`, [caseId]));
    } else if (!groupDefs.has(groupId)) {
      issues.push(blockingIssue('resume_failure_case_unknown_group', `${caseId} references unknown group ${groupId}`, [caseId, groupId]));
    }
    if (explicitGroupId && mappedGroupId && explicitGroupId !== mappedGroupId) {
      issues.push(blockingIssue('resume_failure_case_group_conflict', `${caseId} groupId conflicts with groups[].caseRefs`, [caseId, explicitGroupId, mappedGroupId]));
    }
    const expectedRecoveryActions = strings(failureCase.expectedRecoveryActions);
    if (!expectedRecoveryActions.length) {
      issues.push(blockingIssue('resume_failure_case_missing_recovery_actions', `${caseId} missing expectedRecoveryActions[]`, [caseId]));
    }
    for (const actionId of expectedRecoveryActions) {
      if (!actionDefs.has(actionId)) {
        issues.push(blockingIssue('resume_failure_case_unknown_recovery_action', `${caseId} references unknown recovery action ${actionId}`, [caseId, actionId]));
      }
    }
  }
  for (const [caseId, groupId] of groupByCase.entries()) {
    if (!seenCases.has(caseId)) {
      issues.push(blockingIssue('resume_failure_group_case_ref_unknown', `${groupId} references missing failure case ${caseId}`, [groupId, caseId]));
    }
  }

  const fullLinkRequiredFixtureCases = strings(registry.fullLinkRequiredFixtureCases ?? registry.p0RequiredFixtureCases);
  for (const required of ['resume_happy_path', 'sourceDocumentHash_changed']) {
    if (!fullLinkRequiredFixtureCases.includes(required)) {
      issues.push(blockingIssue('resume_failure_full_link_fixture_missing', `fullLinkRequiredFixtureCases[] missing ${required}`, [required]));
    }
  }
  const exercisedFixtureCases = failureCases
    .filter((item) => item.fullLinkRequired === true || fullLinkRequiredFixtureCases.includes(text(item.id)))
    .map((item) => text(item.id))
    .filter(Boolean)
    .sort();
  const unexercisedCases = failureCases
    .map((item) => text(item.id))
    .filter(Boolean)
    .filter((caseId) => !exercisedFixtureCases.includes(caseId))
    .sort();

  return {
    rawPresent: true,
    status: text(registry.status),
    groups: groups.length,
    failureCases: failureCases.length,
    recoveryActions: actions.length,
    globalEventTypes: globalEventTypes.size,
    fullLinkRequiredFixtureCases,
    exercisedFixtureCases,
    unexercisedCases,
    issues,
  };
}

function checkResumeFailureCaseRegistry(registryCoverage: RegistryValidationResult): Check {
  return {
    id: 'resume-failure-case-registry-valid',
    decision: registryCoverage.issues.length === 0 ? 'pass' : 'blocked',
    summary:
      registryCoverage.issues.length === 0
        ? 'Functional resume failure case registry is explicit and machine-checkable'
        : 'Functional resume failure case registry has blocking schema or coverage issues',
    details: {
      ...registryCoverage,
    },
  };
}

function traceCheckpoint(record: JsonObject, checkpointId: string, generatedAt: string): JsonObject {
  const executions = objects(record.executionIterations);
  const closures = latestBy(objects(record.requirementClosures), 'requirementId');
  const gateChecks = objects(record.gateChecks);
  const traceRows = [...new Set(executions.flatMap((item) => strings(item.traceRows)))].sort();
  const closedIds = [...closures.entries()]
    .filter(([, item]) => text(item.status) === 'pass')
    .map(([id]) => id)
    .sort();
  const pendingIds = [...closures.entries()]
    .filter(([, item]) => text(item.status) !== 'pass')
    .map(([id]) => id)
    .sort();
  const gateSummary = gateChecks.map((gate) => ({
    checkId: text(gate.checkId),
    gate: text(gate.gate),
    decision: text(gate.decision),
  }));
  const payload = {
    checkpointId,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    generatedAt,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(record),
    traceRows,
    closedIds,
    pendingIds,
    gateSummary,
    artifactIndexHash: sha256Text(JSON.stringify(artifactHashMap(record))),
    latestExecutionIterationId: text(executions.at(-1)?.executionIterationId),
  };
  return {
    ...payload,
    checkpointHash: sha256Text(JSON.stringify(payload)),
  };
}

function resumePacket(input: {
  checkpoint: JsonObject;
  checks: Check[];
  registryCoverage: RegistryValidationResult;
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  const blockingIssues = input.checks
    .filter((check) => check.decision === 'blocked')
    .flatMap((check) => {
      const detailIssues = Array.isArray(check.details?.issues)
        ? (check.details.issues as string[])
        : Array.isArray(check.details?.missing)
          ? (check.details.missing as string[])
          : Array.isArray(check.details?.mismatches)
            ? (check.details.mismatches as string[])
            : [check.id];
      return detailIssues.map((issue) => `${check.id}:${issue}`);
    });
  const decision: Decision = blockingIssues.length === 0 ? 'pass' : 'blocked';
  return {
    packetType: 'functional_resume_packet',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    decision,
    resumeAllowed: decision === 'pass',
    checkpointId: text(input.checkpoint.checkpointId),
    checkpointHash: text(input.checkpoint.checkpointHash),
    modelChecks: [
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_closeout',
    ],
    resumeFailureCaseRegistryCoverage: input.registryCoverage,
    blockingIssues,
    checks: input.checks,
  };
}

function buildProof(input: {
  record: JsonObject;
  checkpoint: JsonObject;
  packet: JsonObject;
  checkpointPath: string;
  packetPath: string;
  generatedAt: string;
  generatedBy: string;
}): JsonObject {
  return {
    proofType: 'functional_resume_proof',
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId),
    decision: text(input.packet.decision),
    resumeAllowed: input.packet.resumeAllowed === true,
    checkpointRef: {
      path: normalizePathForRecord(input.checkpointPath),
      hash: sha256File(input.checkpointPath),
    },
    resumePacketRef: {
      path: normalizePathForRecord(input.packetPath),
      hash: sha256File(input.packetPath),
    },
    coveredMentalModels: input.packet.modelChecks,
    resumeFailureCaseRegistryCoverage: input.packet.resumeFailureCaseRegistryCoverage,
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash: architectureHash(input.record),
  };
}

export function mainFunctionalResumeCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-functional-resume-check --requirement-record <json> [--source <contract.md>|--registry <registry.yaml|json>] [--out-dir <dir>] [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const registryInput = readRegistryFromArgs(args);
  const registryCoverage = validateFunctionalResumeFailureCaseRegistry(registryInput);
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const generatedBy = args.generatedBy ?? 'agent';
  const checkpointId = args.checkpointId ?? `checkpoint-${Date.now()}`;
  const outDir = path.resolve(args.outDir ?? path.join(path.dirname(recordPath), 'resume'));
  fs.mkdirSync(outDir, { recursive: true });

  const checks = [
    checkHashes(record, args),
    checkArchitecture(record),
    checkControlledSources(record),
    checkBlockers(record),
    checkRequiredArtifacts(record),
    checkResumeFailureCaseRegistry(registryCoverage),
  ];
  const checkpoint = traceCheckpoint(record, checkpointId, generatedAt);
  const packet = resumePacket({ checkpoint, checks, registryCoverage, generatedAt, generatedBy });
  const checkpointPath = path.join(outDir, 'trace-checkpoints.jsonl');
  const packetPath = path.join(outDir, 'resume-packets.jsonl');
  appendJsonl(checkpointPath, checkpoint);
  appendJsonl(packetPath, packet);
  const proof = buildProof({
    record,
    checkpoint,
    packet,
    checkpointPath,
    packetPath,
    generatedAt,
    generatedBy,
  });
  const proofPath = path.join(outDir, 'functional-resume-proof.json');
  writeJson(proofPath, proof);
  const output = {
    ok: true,
    decision: packet.decision,
    resumeAllowed: packet.resumeAllowed,
    checkpointPath: normalizePathForRecord(checkpointPath),
    resumePacketPath: normalizePathForRecord(packetPath),
    proofPath: normalizePathForRecord(proofPath),
    blockingIssues: packet.blockingIssues,
    resumeFailureCaseRegistryCoverage: registryCoverage,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `functional_resume=${packet.decision}\n`);
  return packet.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainFunctionalResumeCheck(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
