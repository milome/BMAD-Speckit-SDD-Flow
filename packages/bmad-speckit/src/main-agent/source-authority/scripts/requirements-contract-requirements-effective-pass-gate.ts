import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { compileRequirementsAuditAggregate } from './requirements-contract-requirements-audit-aggregate';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_CALLER_FIELDS = new Set([
  'pass',
  'decision',
  'receiptHash',
  'expectedHash',
  'expectedCoverageUnitRefs',
  'expectedDispositionRefs',
]);

export interface RequirementsEffectivePassReceipt {
  schemaVersion: 'requirements-effective-pass-receipt/v1';
  actorClass: 'requirements_critical_auditor_judge';
  judgeRole: 'requirements_critical_auditor';
  attemptKeyHash: string;
  requestHash: string;
  scopeManifestHash: string;
  evidenceManifestHash: string;
  providerInvocationReceiptHash: string;
  promptTemplateHash: string;
  assessmentSchemaHash: string;
  providerConfigurationHash: string;
  ledgerEntryHash: string;
  requirementsAuditAggregateHash: string;
  effectivePassConditions: Record<string, true>;
  writeSemantics: 'create_only';
  writer: 'package_owned_requirements_effective_pass_writer';
  decisionFieldOrigin: 'package_calculated';
  decision: 'pass';
  receiptHash: string;
}

export function compileRequirementsEffectivePassReceiptV2(input: {
  activeAuthority: JsonRecord;
  aggregate: JsonRecord;
}): JsonRecord {
  const aggregate = input.aggregate;
  if (
    aggregate.schemaVersion !== 'requirements-contract-requirements-audit-aggregate/v2' ||
    aggregate.decision !== 'pass' ||
    !Array.isArray(aggregate.findings) || aggregate.findings.length > 0 ||
    !Array.isArray(aggregate.issueCodes) || aggregate.issueCodes.length > 0
  ) {
    throw new Error('requirements_effective_pass_blocked');
  }
  if (
    input.activeAuthority.activeSemanticRevisionId !== aggregate.semanticRevisionId ||
    input.activeAuthority.activeScopeSemanticHash !== aggregate.scopeSemanticHash ||
    input.activeAuthority.activeSourceBindingHash !== aggregate.sourceBindingHash ||
    input.activeAuthority.activeBuildManifestHash !== aggregate.buildManifestHash
  ) {
    throw new Error('requirements_effective_pass_authority_stale');
  }
  const payload = {
    schemaVersion: 'requirements-effective-pass-receipt/v2' as const,
    semanticRevisionId: String(aggregate.semanticRevisionId),
    scopeSemanticHash: requireHash(aggregate.scopeSemanticHash, 'scope_semantic_hash_invalid'),
    sourceBindingHash: requireHash(aggregate.sourceBindingHash, 'source_binding_hash_invalid'),
    buildManifestHash: requireHash(aggregate.buildManifestHash, 'build_manifest_hash_invalid'),
    providerSelectionHash: requireHash(aggregate.providerSelectionHash, 'provider_selection_hash_invalid'),
    judgeRequestHash: requireHash(aggregate.judgeRequestHash, 'judge_request_hash_invalid'),
    judgeResponseHash: requireHash(aggregate.judgeResponseHash, 'judge_response_hash_invalid'),
    requirementsAuditAggregateHash: requireHash(
      aggregate.requirementsAuditAggregateHash,
      'requirements_audit_aggregate_hash_invalid'
    ),
    validatedDimensionIds: aggregate.validatedDimensionIds,
    reviewedArtifactRefs: aggregate.reviewedArtifactRefs,
    reviewedMustRefs: aggregate.reviewedMustRefs,
    decision: 'pass' as const,
    writer: 'requirements-contract-requirements-effective-pass-gate.ts' as const,
  };
  return {
    ...payload,
    requirementsEffectivePassHash: sha256Stable({
      domain: 'requirements-effective-pass-receipt/v2',
      payload,
    }),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireHash(value: unknown, code: string): string {
  const hash = text(value);
  if (!HASH_PATTERN.test(hash)) throw new Error(code);
  return hash;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function receiptPayloadHash(payload: JsonRecord): string {
  return sha256Stable(payload);
}

function receiptSchemaValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-requirements-effective-pass-receipt.schema.json'
  );
  return new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
}

function verifyReceipt(receipt: unknown): RequirementsEffectivePassReceipt {
  if (!isRecord(receipt)) throw new Error('requirements_effective_pass_receipt_invalid');
  const validate = receiptSchemaValidator();
  if (!validate(receipt)) {
    throw new Error(
      `requirements_effective_pass_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const { receiptHash: _receiptHash, ...payload } = receipt;
  if (receipt.receiptHash !== receiptPayloadHash(payload)) {
    throw new Error('requirements_effective_pass_receipt_hash_mismatch');
  }
  return receipt as unknown as RequirementsEffectivePassReceipt;
}

function rejectForbiddenCallerFields(input: JsonRecord): void {
  const forbidden = Object.keys(input).filter((field) => FORBIDDEN_CALLER_FIELDS.has(field));
  if (forbidden.length > 0) {
    throw new Error(
      `requirements_effective_pass_caller_authority_injection:${forbidden.join(',')}`
    );
  }
}

function noReplayOrDuplicateIdentity(input: JsonRecord): boolean {
  const identity = isRecord(input.identity) ? input.identity : {};
  return identity.replayDetected !== true && identity.duplicateIdentityDetected !== true;
}

function conditionFailureFromAggregate(issueCodes: readonly string[]): string {
  if (issueCodes.includes('role_specific_request_invalid')) return 'role_specific_request_invalid';
  if (issueCodes.includes('attempt_key_stale')) return 'attempt_key_stale';
  if (issueCodes.includes('model_verdict_not_pass')) return 'model_verdict_not_pass';
  if (
    issueCodes.includes('observed_coverage_missing_frozen_scope') ||
    issueCodes.includes('observed_coverage_extra_scope')
  ) {
    return 'observed_coverage_not_exact';
  }
  if (issueCodes.includes('unassessed_scopes_not_empty')) return 'unassessed_scopes_not_empty';
  if (issueCodes.includes('missing_evidence_not_empty')) return 'missing_evidence_not_empty';
  if (issueCodes.includes('blocking_conditions_not_empty')) return 'blocking_conditions_not_empty';
  if (issueCodes.includes('validated_gaps_not_empty')) return 'validated_gaps_not_empty';
  if (issueCodes.includes('unresolved_prior_findings_not_empty')) {
    return 'unresolved_prior_findings_not_empty';
  }
  if (issueCodes.includes('prior_finding_disposition_incomplete')) {
    return 'prior_finding_disposition_incomplete';
  }
  if (issueCodes.includes('requirements_veto_not_passed')) return 'requirements_veto_not_passed';
  if (issueCodes.includes('scope_manifest_stale')) return 'scope_manifest_stale';
  if (issueCodes.includes('evidence_manifest_stale')) return 'evidence_manifest_stale';
  if (issueCodes.includes('provider_invocation_receipt_stale')) {
    return 'provider_invocation_receipt_stale';
  }
  if (issueCodes.includes('prompt_template_binding_stale')) return 'prompt_template_binding_stale';
  if (issueCodes.includes('assessment_schema_binding_stale')) {
    return 'assessment_schema_binding_stale';
  }
  if (issueCodes.includes('provider_configuration_binding_stale')) {
    return 'provider_configuration_binding_stale';
  }
  return issueCodes[0] ?? 'requirements_effective_pass_blocked';
}

export function compileRequirementsEffectivePassReceipt(
  input: unknown
): RequirementsEffectivePassReceipt {
  if (!isRecord(input)) throw new Error('requirements_effective_pass_input_invalid');
  rejectForbiddenCallerFields(input);
  const aggregate = compileRequirementsAuditAggregate(input);
  if (aggregate.decision !== 'pass') {
    throw new Error(conditionFailureFromAggregate(aggregate.issueCodes));
  }
  if (!noReplayOrDuplicateIdentity(input)) {
    throw new Error('replay_or_duplicate_identity');
  }
  const payload = {
    schemaVersion: 'requirements-effective-pass-receipt/v1' as const,
    actorClass: 'requirements_critical_auditor_judge' as const,
    judgeRole: 'requirements_critical_auditor' as const,
    attemptKeyHash: requireHash(aggregate.attemptKeyHash, 'attempt_key_invalid'),
    requestHash: requireHash(aggregate.requestHash, 'request_hash_invalid'),
    scopeManifestHash: requireHash(aggregate.scopeManifestHash, 'scope_manifest_hash_invalid'),
    evidenceManifestHash: requireHash(
      aggregate.evidenceManifestHash,
      'evidence_manifest_hash_invalid'
    ),
    providerInvocationReceiptHash: requireHash(
      aggregate.providerInvocationReceiptHash,
      'provider_invocation_receipt_hash_invalid'
    ),
    promptTemplateHash: requireHash(aggregate.promptTemplateHash, 'prompt_template_hash_invalid'),
    assessmentSchemaHash: requireHash(
      aggregate.assessmentSchemaHash,
      'assessment_schema_hash_invalid'
    ),
    providerConfigurationHash: requireHash(
      aggregate.providerConfigurationHash,
      'provider_configuration_hash_invalid'
    ),
    ledgerEntryHash: requireHash(aggregate.ledgerEntryHash, 'ledger_entry_hash_invalid'),
    requirementsAuditAggregateHash: requireHash(
      aggregate.aggregateHash,
      'requirements_audit_aggregate_hash_invalid'
    ),
    effectivePassConditions: {
      roleSpecificRequestValid: true,
      attemptKeyCurrent: true,
      modelVerdictPermitsRequirementsPass: true,
      observedCoverageExactlyEqualsFrozenScope: true,
      unassessedScopesIsEmpty: true,
      missingEvidenceIsEmpty: true,
      blockingConditionsIsEmpty: true,
      validatedGapsIsEmpty: true,
      unresolvedPriorFindingsIsEmpty: true,
      everyPriorFindingHasCurrentDisposition: true,
      everyRequirementsVetoEvaluatedAndPassed: true,
      scopeManifestCurrent: true,
      evidenceManifestCurrent: true,
      providerInvocationReceiptCurrent: true,
      promptTemplateBindingCurrent: true,
      assessmentSchemaBindingCurrent: true,
      providerConfigurationBindingCurrent: true,
      noReplayOrDuplicateIdentity: true,
    },
    writeSemantics: 'create_only' as const,
    writer: 'package_owned_requirements_effective_pass_writer' as const,
    decisionFieldOrigin: 'package_calculated' as const,
    decision: 'pass' as const,
  };
  return verifyReceipt({ ...payload, receiptHash: receiptPayloadHash(payload) });
}

export function writeRequirementsEffectivePassReceipt(input: {
  receiptPath: string;
  evidence: unknown;
}): RequirementsEffectivePassReceipt {
  if (!input.receiptPath) throw new Error('requirements_effective_pass_receipt_path_missing');
  const resolvedPath = path.resolve(input.receiptPath);
  if (fs.existsSync(resolvedPath)) throw new Error('requirements_effective_pass_receipt_exists');
  const receipt = compileRequirementsEffectivePassReceipt(input.evidence);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  const readback = verifyReceipt(readJson(resolvedPath));
  if (JSON.stringify(readback) !== JSON.stringify(receipt)) {
    throw new Error('requirements_effective_pass_receipt_readback_mismatch');
  }
  return readback;
}

export function validateRequirementsEffectivePassReceipt(
  receipt: unknown
): RequirementsEffectivePassReceipt {
  return verifyReceipt(receipt);
}
