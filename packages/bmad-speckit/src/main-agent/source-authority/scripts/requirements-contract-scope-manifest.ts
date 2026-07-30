import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { createRequirementsContractAuthorityCounters } from './requirements-contract-audit-actor-class';
import { resolveRequirementsContractJudgeAuthority } from './requirements-contract-judge-role';
import { sha256Stable, stableStringify } from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const COMMON_ARRAY_FIELDS = [
  'includedRequirementRefs',
  'requiredCoverageUnits',
  'mandatoryDimensions',
  'requiredVetoItems',
  'allowedEvidenceRefs',
  'explicitOutOfScope',
] as const;
const COMMON_INPUT_FIELDS = [
  'actorClass',
  'judgeRole',
  'purpose',
  'attemptId',
  ...COMMON_ARRAY_FIELDS,
  'priorFindingLedgerHash',
  'sourceAuthorityHash',
  'policyHash',
  'currentAuthority',
] as const;
const REQUIREMENTS_INPUT_FIELDS = new Set([
  ...COMMON_INPUT_FIELDS,
  'sourceDocumentHash',
  'semanticModelHash',
  'projectionSetHash',
  'confirmationCandidateHash',
  'requirementsQualityRulesHash',
  'priorRequirementsFindingsHash',
  'kernelImplementationLineage',
]);
const FINAL_INPUT_FIELDS = new Set([...COMMON_INPUT_FIELDS, 'kernelImplementationLineage']);
const FINAL_LINEAGE_FIELDS = new Set([
  'applicability',
  'parentGoalContractHash',
  'partitionManifestHash',
  'partitionSetHash',
  'sourceCompositionPolicyHash',
  'sourceSnapshotSetHash',
  'specSpanRegistryHash',
  'sourceObligationGraphHash',
  'compilerIdentityHash',
  'goalCampaignClosureReceiptHash',
  'subcontractClosureSetHash',
  'subcontractClosureReceiptHashes',
  'governedByteManifestHash',
  'productionReachabilityReceiptHash',
  'installedRuntimeIdentity',
  'packageAndConsumerIdentity',
]);

type SchemaRecord = Record<string, unknown>;

export interface RequirementsContractCommonScopeManifest {
  actorClass: 'requirements_critical_auditor_judge' | 'final_acceptance_judge';
  judgeRole: 'requirements_critical_auditor' | 'final_acceptance_judge';
  purpose: string;
  attemptId: string;
  includedRequirementRefs: string[];
  requiredCoverageUnits: string[];
  mandatoryDimensions: string[];
  requiredVetoItems: string[];
  allowedEvidenceRefs: string[];
  explicitOutOfScope: string[];
  priorFindingLedgerHash: string;
  sourceAuthorityHash: string;
  policyHash: string;
  scopeManifestHash: string;
}

export interface RequirementsAuditKernelImplementationLineage {
  applicability: 'not_applicable';
  authorityReason: 'requirements_scope_has_no_kernel_implementation_authority';
}

export interface FinalAcceptanceKernelImplementationLineage {
  applicability: 'applicable';
  parentGoalContractHash: string;
  partitionManifestHash: string;
  partitionSetHash: string;
  sourceCompositionPolicyHash: string;
  sourceSnapshotSetHash: string;
  specSpanRegistryHash: string;
  sourceObligationGraphHash: string;
  compilerIdentityHash: string;
  goalCampaignClosureReceiptHash: string;
  subcontractClosureSetHash: string;
  subcontractClosureReceiptHashes: string[];
  governedByteManifestHash: string;
  productionReachabilityReceiptHash: string;
  installedRuntimeIdentity: string;
  packageAndConsumerIdentity: string;
}

export interface RequirementsAuditScopeManifest extends RequirementsContractCommonScopeManifest {
  schemaVersion: 'requirements-contract-requirements-audit-scope-manifest/v1';
  actorClass: 'requirements_critical_auditor_judge';
  judgeRole: 'requirements_critical_auditor';
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  confirmationCandidateHash: string;
  requirementsQualityRulesHash: string;
  priorRequirementsFindingsHash: string;
  kernelImplementationLineage: RequirementsAuditKernelImplementationLineage;
}

export interface FinalAcceptanceScopeManifest extends RequirementsContractCommonScopeManifest {
  schemaVersion: 'requirements-contract-final-acceptance-scope-manifest/v1';
  actorClass: 'final_acceptance_judge';
  judgeRole: 'final_acceptance_judge';
  kernelImplementationLineage: FinalAcceptanceKernelImplementationLineage;
}

export class RequirementsContractScopeManifestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractScopeManifestError';
    this.code = code;
  }
}

const validators = new Map<string, ValidateFunction>();

function fail(code: string): never {
  throw new RequirementsContractScopeManifestError(code);
}

function isRecord(value: unknown): value is SchemaRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(record: SchemaRecord, key: string): boolean {
  return Object.hasOwn(record, key);
}

function requiredText(record: SchemaRecord, key: string): string {
  if (!own(record, key)) fail('scope_manifest_field_missing');
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('scope_manifest_field_invalid');
  }
  return value.trim().normalize('NFC');
}

function requiredHash(record: SchemaRecord, key: string): string {
  const value = requiredText(record, key);
  if (!HASH_PATTERN.test(value)) fail('scope_manifest_hash_invalid');
  return value;
}

function canonicalSet(record: SchemaRecord, key: string): string[] {
  if (!own(record, key)) fail('scope_manifest_field_missing');
  const value = record[key];
  if (!Array.isArray(value)) fail('scope_manifest_field_invalid');
  const normalized = value.map((item) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      fail('scope_manifest_field_invalid');
    }
    return item.trim().normalize('NFC');
  });
  if (new Set(normalized).size !== normalized.length) {
    fail('scope_manifest_duplicate_value');
  }
  const sorted = [...normalized].sort();
  if (key === 'explicitOutOfScope' && sorted.length === 0) {
    fail('scope_manifest_field_invalid');
  }
  return sorted;
}

function rejectUntrustedInput(record: SchemaRecord, allowedFields: ReadonlySet<string>): void {
  for (const key of Object.keys(record)) {
    const normalized = key.toLowerCase();
    if (key === 'scopeManifestHash' || key === 'expectedScopeManifestHash') {
      fail('scope_manifest_expected_hash_forbidden');
    }
    if (normalized.includes('model') && normalized.includes('scope')) {
      fail('scope_manifest_model_authority_forbidden');
    }
    if (!allowedFields.has(key)) fail('scope_manifest_unknown_field');
  }
}

function currentAuthority(record: SchemaRecord): SchemaRecord {
  if (!isRecord(record.currentAuthority)) fail('scope_manifest_field_missing');
  return record.currentAuthority;
}

function assertCurrentAuthority(record: SchemaRecord, authority: SchemaRecord): void {
  if (
    requiredHash(record, 'sourceAuthorityHash') !==
      requiredHash(authority, 'sourceAuthorityHash') ||
    requiredHash(record, 'policyHash') !== requiredHash(authority, 'policyHash')
  ) {
    fail('scope_manifest_stale');
  }
}

function commonPayload(record: SchemaRecord) {
  const authority = currentAuthority(record);
  assertCurrentAuthority(record, authority);
  const resolved = resolveRequirementsContractJudgeAuthority(
    {
      actorClass: record.actorClass,
      judgeRole: record.judgeRole,
    },
    createRequirementsContractAuthorityCounters()
  );
  if (resolved.judgeRole === null) fail('scope_manifest_role_mismatch');
  return {
    authority,
    payload: {
      actorClass: resolved.actorClass,
      judgeRole: resolved.judgeRole,
      purpose: requiredText(record, 'purpose'),
      attemptId: requiredText(record, 'attemptId'),
      includedRequirementRefs: canonicalSet(record, 'includedRequirementRefs'),
      requiredCoverageUnits: canonicalSet(record, 'requiredCoverageUnits'),
      mandatoryDimensions: canonicalSet(record, 'mandatoryDimensions'),
      requiredVetoItems: canonicalSet(record, 'requiredVetoItems'),
      allowedEvidenceRefs: canonicalSet(record, 'allowedEvidenceRefs'),
      explicitOutOfScope: canonicalSet(record, 'explicitOutOfScope'),
      priorFindingLedgerHash: requiredHash(record, 'priorFindingLedgerHash'),
      sourceAuthorityHash: requiredHash(record, 'sourceAuthorityHash'),
      policyHash: requiredHash(record, 'policyHash'),
    },
  };
}

function requirementsLineage(record: SchemaRecord) {
  if (!isRecord(record.kernelImplementationLineage)) {
    fail('scope_manifest_field_missing');
  }
  const lineage = record.kernelImplementationLineage;
  if (
    Object.keys(lineage).some((key) => key !== 'applicability' && key !== 'authorityReason') ||
    lineage.applicability !== 'not_applicable' ||
    lineage.authorityReason !== 'requirements_scope_has_no_kernel_implementation_authority'
  ) {
    fail('scope_manifest_requirements_lineage_invalid');
  }
  return {
    applicability: 'not_applicable' as const,
    authorityReason: 'requirements_scope_has_no_kernel_implementation_authority' as const,
  };
}

function finalLineage(record: SchemaRecord) {
  if (!isRecord(record.kernelImplementationLineage)) {
    fail('scope_manifest_field_missing');
  }
  const lineage = record.kernelImplementationLineage;
  if (Object.keys(lineage).some((key) => !FINAL_LINEAGE_FIELDS.has(key))) {
    fail('scope_manifest_unknown_field');
  }
  if (lineage.applicability !== 'applicable') {
    fail('scope_manifest_final_lineage_invalid');
  }
  return {
    applicability: 'applicable' as const,
    parentGoalContractHash: requiredHash(lineage, 'parentGoalContractHash'),
    partitionManifestHash: requiredHash(lineage, 'partitionManifestHash'),
    partitionSetHash: requiredHash(lineage, 'partitionSetHash'),
    sourceCompositionPolicyHash: requiredHash(lineage, 'sourceCompositionPolicyHash'),
    sourceSnapshotSetHash: requiredHash(lineage, 'sourceSnapshotSetHash'),
    specSpanRegistryHash: requiredHash(lineage, 'specSpanRegistryHash'),
    sourceObligationGraphHash: requiredHash(lineage, 'sourceObligationGraphHash'),
    compilerIdentityHash: requiredHash(lineage, 'compilerIdentityHash'),
    goalCampaignClosureReceiptHash: requiredHash(lineage, 'goalCampaignClosureReceiptHash'),
    subcontractClosureSetHash: requiredHash(lineage, 'subcontractClosureSetHash'),
    subcontractClosureReceiptHashes: canonicalSet(lineage, 'subcontractClosureReceiptHashes'),
    governedByteManifestHash: requiredHash(lineage, 'governedByteManifestHash'),
    productionReachabilityReceiptHash: requiredHash(lineage, 'productionReachabilityReceiptHash'),
    installedRuntimeIdentity: requiredText(lineage, 'installedRuntimeIdentity'),
    packageAndConsumerIdentity: requiredText(lineage, 'packageAndConsumerIdentity'),
  };
}

function schemaValidator(schemaFile: string): ValidateFunction {
  const cached = validators.get(schemaFile);
  if (cached) return cached;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', schemaFile), 'utf8'))
  );
  validators.set(schemaFile, validator);
  return validator;
}

function validateManifest(
  value: unknown,
  current: unknown,
  expected: {
    schemaVersion: string;
    actorClass: string;
    judgeRole: string;
    schemaFile: string;
    finalLineage: boolean;
  }
): SchemaRecord {
  if (!isRecord(value)) fail('scope_manifest_schema_invalid');
  if (
    value.schemaVersion !== expected.schemaVersion ||
    value.actorClass !== expected.actorClass ||
    value.judgeRole !== expected.judgeRole
  ) {
    fail('scope_manifest_role_mismatch');
  }
  if (!schemaValidator(expected.schemaFile)(value)) {
    fail('scope_manifest_schema_invalid');
  }
  const { scopeManifestHash, ...payload } = value;
  if (typeof scopeManifestHash !== 'string' || scopeManifestHash !== sha256Stable(payload)) {
    fail('scope_manifest_hash_mismatch');
  }
  if (!isRecord(current)) fail('scope_manifest_field_missing');
  assertCurrentAuthority(value, current);
  if (
    expected.finalLineage &&
    requiredHash(current, 'kernelImplementationLineageHash') !==
      sha256Stable(value.kernelImplementationLineage)
  ) {
    fail('scope_manifest_stale');
  }
  for (const field of COMMON_ARRAY_FIELDS) {
    if (stableStringify(value[field]) !== stableStringify(canonicalSet(value, field))) {
      fail('scope_manifest_non_canonical');
    }
  }
  return value;
}

export function requirementsContractScopeManifestCanonicalBytes(value: unknown): string {
  return `${stableStringify(value)}\n`;
}

export function compileRequirementsAuditScopeManifest(
  input: unknown
): RequirementsAuditScopeManifest {
  if (!isRecord(input)) fail('scope_manifest_field_missing');
  rejectUntrustedInput(input, REQUIREMENTS_INPUT_FIELDS);
  const { payload } = commonPayload(input);
  if (
    payload.actorClass !== 'requirements_critical_auditor_judge' ||
    payload.judgeRole !== 'requirements_critical_auditor'
  ) {
    fail('scope_manifest_role_mismatch');
  }
  const manifestPayload = {
    schemaVersion: 'requirements-contract-requirements-audit-scope-manifest/v1',
    ...payload,
    sourceDocumentHash: requiredHash(input, 'sourceDocumentHash'),
    semanticModelHash: requiredHash(input, 'semanticModelHash'),
    projectionSetHash: requiredHash(input, 'projectionSetHash'),
    confirmationCandidateHash: requiredHash(input, 'confirmationCandidateHash'),
    requirementsQualityRulesHash: requiredHash(input, 'requirementsQualityRulesHash'),
    priorRequirementsFindingsHash: requiredHash(input, 'priorRequirementsFindingsHash'),
    kernelImplementationLineage: requirementsLineage(input),
  };
  const manifest = {
    ...manifestPayload,
    scopeManifestHash: sha256Stable(manifestPayload),
  } as RequirementsAuditScopeManifest;
  return validateRequirementsAuditScopeManifest(manifest, currentAuthority(input));
}

export function compileFinalAcceptanceScopeManifest(input: unknown): FinalAcceptanceScopeManifest {
  if (!isRecord(input)) fail('scope_manifest_field_missing');
  rejectUntrustedInput(input, FINAL_INPUT_FIELDS);
  const { authority, payload } = commonPayload(input);
  if (
    payload.actorClass !== 'final_acceptance_judge' ||
    payload.judgeRole !== 'final_acceptance_judge'
  ) {
    fail('scope_manifest_role_mismatch');
  }
  const kernelImplementationLineage = finalLineage(input);
  if (
    requiredHash(authority, 'kernelImplementationLineageHash') !==
    sha256Stable(kernelImplementationLineage)
  ) {
    fail('scope_manifest_stale');
  }
  const manifestPayload = {
    schemaVersion: 'requirements-contract-final-acceptance-scope-manifest/v1',
    ...payload,
    kernelImplementationLineage,
  };
  const manifest = {
    ...manifestPayload,
    scopeManifestHash: sha256Stable(manifestPayload),
  } as FinalAcceptanceScopeManifest;
  return validateFinalAcceptanceScopeManifest(manifest, authority);
}

export function validateRequirementsAuditScopeManifest(
  value: unknown,
  current: unknown
): RequirementsAuditScopeManifest {
  return validateManifest(value, current, {
    schemaVersion: 'requirements-contract-requirements-audit-scope-manifest/v1',
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    schemaFile: 'requirements-contract-requirements-audit-scope-manifest.schema.json',
    finalLineage: false,
  }) as unknown as RequirementsAuditScopeManifest;
}

export function validateFinalAcceptanceScopeManifest(
  value: unknown,
  current: unknown
): FinalAcceptanceScopeManifest {
  return validateManifest(value, current, {
    schemaVersion: 'requirements-contract-final-acceptance-scope-manifest/v1',
    actorClass: 'final_acceptance_judge',
    judgeRole: 'final_acceptance_judge',
    schemaFile: 'requirements-contract-final-acceptance-scope-manifest.schema.json',
    finalLineage: true,
  }) as unknown as FinalAcceptanceScopeManifest;
}
