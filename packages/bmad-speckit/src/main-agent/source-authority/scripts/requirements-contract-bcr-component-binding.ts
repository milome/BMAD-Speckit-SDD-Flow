import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_PARENT_SEMANTICS =
  /(?:parent.*campaign|invocation.*budget|remediation|final.*judge|effective.*pass|kernel.*closure|subcontract.*closure|goal.*campaign.*closure)/iu;
const SCHEMA_FILE = 'requirements-contract-bcr-component-binding-receipt.schema.json';

type RecordValue = Record<string, unknown>;

export interface RequirementsContractBcrComponentBindingReceipt {
  schemaVersion: 'requirements-contract-bcr-component-binding-receipt/v1';
  namespace: 'BCR';
  sourceRole: 'subordinate_component_specification';
  sourceArtifactId: string;
  parentTaskRefs: string[];
  requiredRequirementIds: string[];
  requiredTaskIds: string[];
  subordinateSourceHash: string;
  specSpanRegistryHash: string;
  sourceObligationGraphHash: string;
  namespaceOwnershipHash: string;
  parentProjectionPolicyHash: string;
  sourceCompositionPolicyHash: string;
  bindingHash: string;
  decision: 'pass';
  receiptHash: string;
}

export class RequirementsContractBcrBindingError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractBcrBindingError';
    this.code = code;
  }
}

let validator: ValidateFunction | null = null;

function fail(code: string): never {
  throw new RequirementsContractBcrBindingError(code);
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredHash(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    fail('source_composition_binding_invalid');
  }
  return value;
}

function stringSet(
  value: unknown,
  duplicateIssueCode = 'source_composition_binding_invalid'
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    fail('source_composition_binding_invalid');
  }
  if (new Set(value).size !== value.length) {
    fail(duplicateIssueCode);
  }
  return [...value].sort();
}

function sameSet(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function schemaValidator(): ValidateFunction {
  if (validator) return validator;
  validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function verifyPolicyHash(policy: RecordValue): void {
  if (policy.mode === 'single_source') {
    fail('source_composition_downgrade_rejected');
  }
  if (policy.mode !== 'composite_required') {
    fail('source_composition_policy_mismatch');
  }
  const payload = {
    schemaVersion: policy.schemaVersion,
    mode: policy.mode,
    policyAuthorityBinding: policy.policyAuthorityBinding,
    requiredSubordinateBindings: policy.requiredSubordinateBindings,
    conflictPolicy: policy.conflictPolicy,
  };
  if (
    policy.sourceCompositionPolicyHash !== sha256Stable(payload) ||
    policy.conflictPolicy !== 'fail_closed'
  ) {
    fail('source_composition_policy_replay_rejected');
  }
}

function exactCoverage(actual: string[], requirements: string[], tasks: string[]): void {
  const expected = [...requirements, ...tasks].sort();
  if (actual.some((id) => !expected.includes(id))) {
    fail('source_composition_scope_escape');
  }
  if (!sameSet(actual, expected)) {
    fail('source_composition_required_id_missing');
  }
}

export function compileRequirementsContractBcrComponentBinding(
  input: unknown
): RequirementsContractBcrComponentBindingReceipt {
  if (!isRecord(input)) fail('source_composition_binding_invalid');
  if (!isRecord(input.sourceCompositionPolicy)) {
    fail('source_composition_policy_mismatch');
  }
  const policy = input.sourceCompositionPolicy;
  verifyPolicyHash(policy);
  const bindings = Array.isArray(policy.requiredSubordinateBindings)
    ? policy.requiredSubordinateBindings.filter(
        (binding: unknown) =>
          isRecord(binding) &&
          binding.role === 'subordinate_component_specification' &&
          binding.namespace === 'BCR'
      )
    : [];
  if (bindings.length !== 1) fail('source_composition_namespace_mismatch');
  const binding = bindings[0];
  const requiredRequirementIds = stringSet(binding.requiredRequirementIds);
  const requiredTaskIds = stringSet(binding.requiredTaskIds);
  if (
    requiredRequirementIds.length !== 6 ||
    requiredTaskIds.length !== 8 ||
    requiredRequirementIds.some((id) => !/^BCR-C\d{2}$/u.test(id)) ||
    requiredTaskIds.some((id) => !/^BCR-T\d{2}$/u.test(id))
  ) {
    fail('source_composition_required_id_missing');
  }
  const parentTaskRefs = stringSet(binding.parentTaskRefs);
  if (!sameSet(parentTaskRefs, ['J04'])) {
    fail('source_composition_parent_ref_mismatch');
  }
  if (!isRecord(input.subordinateSource)) {
    fail('source_composition_subordinate_source_missing');
  }
  const source = input.subordinateSource;
  if (
    source.namespace !== 'BCR' ||
    source.role !== 'subordinate_component_specification' ||
    source.sourceArtifactId !== binding.sourceArtifactId
  ) {
    fail('source_composition_namespace_mismatch');
  }
  const sourceHash = requiredHash(source, 'sourceHash');
  if (sourceHash !== requiredHash(source, 'currentSourceHash')) {
    fail('source_composition_subordinate_source_stale');
  }
  const semanticDomains = stringSet(source.declaredSemanticDomains);
  if (semanticDomains.some((value) => FORBIDDEN_PARENT_SEMANTICS.test(value))) {
    fail('source_composition_parent_semantics_forbidden');
  }
  if (!isRecord(input.specSpanRegistry)) {
    fail('source_composition_required_id_missing');
  }
  const specSpanRegistry = input.specSpanRegistry;
  if (specSpanRegistry.sourceArtifactId !== binding.sourceArtifactId) {
    fail('source_composition_namespace_mismatch');
  }
  exactCoverage(
    stringSet(specSpanRegistry.coveredObligationIds),
    requiredRequirementIds,
    requiredTaskIds
  );
  if (!isRecord(input.sourceObligationGraph)) {
    fail('source_composition_required_id_missing');
  }
  const graph = input.sourceObligationGraph;
  const graphRequirements = stringSet(graph.requirementIds);
  const graphTasks = stringSet(graph.taskIds);
  if (
    graphRequirements.some((id) => !requiredRequirementIds.includes(id)) ||
    graphTasks.some((id) => !requiredTaskIds.includes(id))
  ) {
    fail('source_composition_scope_escape');
  }
  if (
    !sameSet(graphRequirements, requiredRequirementIds) ||
    !sameSet(graphTasks, requiredTaskIds)
  ) {
    fail('source_composition_required_id_missing');
  }
  const semanticObligationHashes = stringSet(
    graph.semanticObligationHashes,
    'source_composition_semantic_obligation_duplicate'
  );
  if (semanticObligationHashes.length !== 14) {
    fail('source_composition_semantic_obligation_duplicate');
  }
  if (!isRecord(input.namespaceOwnership)) {
    fail('source_composition_namespace_mismatch');
  }
  const ownership = input.namespaceOwnership;
  if (ownership.namespace !== 'BCR' || ownership.sourceArtifactId !== binding.sourceArtifactId) {
    fail('source_composition_namespace_mismatch');
  }
  if (!sameSet(stringSet(ownership.parentTaskRefs), ['J04'])) {
    fail('source_composition_parent_ref_mismatch');
  }
  if (
    !isRecord(input.parentProjectionPolicy) ||
    input.parentProjectionPolicy.parentRef !== 'J04' ||
    input.parentProjectionPolicy.projectionMode !== 'hash_only'
  ) {
    fail('source_composition_parent_ref_mismatch');
  }
  const bindingPayload = {
    namespace: 'BCR' as const,
    sourceRole: 'subordinate_component_specification' as const,
    sourceArtifactId: binding.sourceArtifactId as string,
    parentTaskRefs,
    requiredRequirementIds,
    requiredTaskIds,
    subordinateSourceHash: sourceHash,
    specSpanRegistryHash: requiredHash(specSpanRegistry, 'registryHash'),
    sourceObligationGraphHash: requiredHash(graph, 'graphHash'),
    namespaceOwnershipHash: requiredHash(ownership, 'ownershipHash'),
    parentProjectionPolicyHash: requiredHash(input.parentProjectionPolicy, 'policyHash'),
    sourceCompositionPolicyHash: requiredHash(policy, 'sourceCompositionPolicyHash'),
  };
  const payload = {
    schemaVersion: 'requirements-contract-bcr-component-binding-receipt/v1' as const,
    ...bindingPayload,
    bindingHash: sha256Stable(bindingPayload),
    decision: 'pass' as const,
  };
  return validateRequirementsContractBcrComponentBindingReceipt({
    ...payload,
    receiptHash: sha256Stable(payload),
  });
}

export function validateRequirementsContractBcrComponentBindingReceipt(
  value: unknown
): RequirementsContractBcrComponentBindingReceipt {
  if (!schemaValidator()(value) || !isRecord(value)) {
    fail('bcr_component_binding_receipt_invalid');
  }
  const { receiptHash, ...payload } = value;
  if (receiptHash !== sha256Stable(payload)) {
    fail('bcr_component_binding_receipt_hash_mismatch');
  }
  return value as unknown as RequirementsContractBcrComponentBindingReceipt;
}
