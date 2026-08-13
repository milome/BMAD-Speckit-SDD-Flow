import { isCanonicalJsonValue, sha256Stable } from './requirements-contract-semantic-resolver';
import {
  validateRequirementsContractSemanticIr,
  type RequirementsContractSemanticIr,
} from './requirements-contract-semantic-ir';

export type RequirementsRenderFieldAuthorityClass =
  | 'source_grounded'
  | 'rule_derived'
  | 'repository_derived'
  | 'policy_inherited'
  | 'human_confirmed'
  | 'none';

export interface RequirementsConfirmationRenderField {
  fieldRef: string;
  value: unknown;
  semanticModelHash: string;
  authorityClass: RequirementsRenderFieldAuthorityClass;
  provenanceRefs: string[];
  applicability: 'applicable' | 'not_applicable' | 'unresolved';
  derivationRule: string | null;
  synthetic: boolean;
}

export interface RequirementsConfirmationRenderInput {
  schemaVersion: 'requirements-confirmation-render-input/v2';
  requirementSetId: string;
  semanticModelHash: string;
  authority: 'none';
  fields: RequirementsConfirmationRenderField[];
  requiredRenderFieldCount: number;
  coveredFieldCount: number;
  blockingUnresolvedCount: number;
  syntheticFieldCount: number;
  authorityInvalidCount: number;
  requiredFieldSetHash: string;
  fieldSetHash: string;
  renderInputHash: string;
}

export interface RequirementsConfirmationRender {
  schemaVersion: 'requirements-confirmation-render/v2';
  requirementSetId: string;
  semanticModelHash: string;
  renderInputHash: string;
  authority: 'none';
  proofRole: 'semantic_authorization_projection';
  fields: RequirementsConfirmationRenderField[];
  renderHash: string;
}

export interface RequirementsCloseoutEvidenceRef {
  path: string;
  hash: string;
}

export interface RequirementsCloseoutRender {
  schemaVersion: 'requirements-closeout-render/v1';
  requirementSetId: string;
  semanticModelHash: string;
  authority: 'none';
  proofRole: 'execution_evidence_projection';
  executionEvidenceRefs: RequirementsCloseoutEvidenceRef[];
  renderHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const AUTHORITY_CLASSES = new Set<RequirementsRenderFieldAuthorityClass>([
  'source_grounded',
  'rule_derived',
  'repository_derived',
  'policy_inherited',
  'human_confirmed',
  'none',
]);
const RENDER_INPUT_KEYS = new Set([
  'schemaVersion',
  'requirementSetId',
  'semanticModelHash',
  'authority',
  'fields',
  'requiredRenderFieldCount',
  'coveredFieldCount',
  'blockingUnresolvedCount',
  'syntheticFieldCount',
  'authorityInvalidCount',
  'requiredFieldSetHash',
  'fieldSetHash',
  'renderInputHash',
]);
const RENDER_FIELD_KEYS = new Set([
  'fieldRef',
  'value',
  'semanticModelHash',
  'authorityClass',
  'provenanceRefs',
  'applicability',
  'derivationRule',
  'synthetic',
]);
const CONFIRMATION_RENDER_KEYS = new Set([
  'schemaVersion',
  'requirementSetId',
  'semanticModelHash',
  'renderInputHash',
  'authority',
  'proofRole',
  'fields',
  'renderHash',
]);
const CLOSEOUT_RENDER_KEYS = new Set([
  'schemaVersion',
  'requirementSetId',
  'semanticModelHash',
  'authority',
  'proofRole',
  'executionEvidenceRefs',
  'renderHash',
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty) && new Set(value).size === value.length;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createRequirementsConfirmationIrBoundRenderInput(input: {
  semanticIr: RequirementsContractSemanticIr;
  fields: Array<{
    fieldRef: string;
    value: unknown;
    specSpanRefs: string[];
    evidenceClaimRefs: string[];
  }>;
}) {
  const validation = validateRequirementsContractSemanticIr(input.semanticIr);
  if (validation.decision === 'block') {
    throw new Error(`requirements_render_frozen_ir_invalid:${validation.issueCodes[0]}`);
  }
  const spanById = new Map(
    input.semanticIr.semanticPayload.specSpanRegistry.map((span) => [span.specSpanId, span])
  );
  const claimIds = new Set(
    input.semanticIr.semanticPayload.evidenceClaims.map((claim) => claim.evidenceClaimId)
  );
  const fields = input.fields
    .map((field) => {
      if (
        !nonEmpty(field.fieldRef) ||
        !isCanonicalJsonValue(field.value) ||
        !uniqueStrings(field.specSpanRefs) ||
        field.specSpanRefs.length === 0 ||
        !uniqueStrings(field.evidenceClaimRefs) ||
        field.evidenceClaimRefs.length === 0
      ) {
        throw new Error('requirements_render_logical_binding_invalid');
      }
      const specSpanRefs = [...field.specSpanRefs].sort();
      const evidenceClaimRefs = [...field.evidenceClaimRefs].sort();
      if (specSpanRefs.some((ref) => !spanById.has(ref))) {
        throw new Error('requirements_render_unknown_spec_span');
      }
      if (evidenceClaimRefs.some((ref) => !claimIds.has(ref))) {
        throw new Error('requirements_render_unknown_evidence_claim');
      }
      const boundClaimRefs = new Set(
        specSpanRefs.flatMap((ref) => spanById.get(ref)?.evidenceClaimRefs ?? [])
      );
      if (evidenceClaimRefs.some((ref) => !boundClaimRefs.has(ref))) {
        throw new Error('requirements_render_span_claim_binding_mismatch');
      }
      return {
        fieldRef: field.fieldRef,
        value: clone(field.value),
        specSpanRefs,
        evidenceClaimRefs,
      };
    })
    .sort((left, right) => left.fieldRef.localeCompare(right.fieldRef));
  if (new Set(fields.map((field) => field.fieldRef)).size !== fields.length) {
    throw new Error('requirements_render_field_identity_duplicate');
  }
  const payload = {
    schemaVersion: 'requirements-confirmation-ir-bound-render-input/v1' as const,
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    authority: 'none' as const,
    fields,
  };
  return { ...payload, renderInputHash: sha256Stable(payload) };
}

function fieldAuthorityInvalid(field: RequirementsConfirmationRenderField): boolean {
  if (!AUTHORITY_CLASSES.has(field.authorityClass)) return true;
  if (field.applicability === 'applicable') return field.authorityClass === 'none';
  return field.authorityClass !== 'none';
}

function validateField(
  field: unknown,
  semanticModelHash: string
): field is RequirementsConfirmationRenderField {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return false;
  const row = field as RequirementsConfirmationRenderField;
  return (
    Object.keys(row).length === RENDER_FIELD_KEYS.size &&
    Object.keys(row).every((key) => RENDER_FIELD_KEYS.has(key)) &&
    nonEmpty(row.fieldRef) &&
    isCanonicalJsonValue(row.value) &&
    row.semanticModelHash === semanticModelHash &&
    AUTHORITY_CLASSES.has(row.authorityClass) &&
    uniqueStrings(row.provenanceRefs) &&
    row.provenanceRefs.length > 0 &&
    ['applicable', 'not_applicable', 'unresolved'].includes(row.applicability) &&
    (row.derivationRule === null || nonEmpty(row.derivationRule)) &&
    typeof row.synthetic === 'boolean'
  );
}

function renderInputPayload(input: Omit<RequirementsConfirmationRenderInput, 'renderInputHash'>) {
  return clone(input);
}

export function validateRequirementsConfirmationRenderInput(
  value: unknown
): value is RequirementsConfirmationRenderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as RequirementsConfirmationRenderInput;
  if (
    Object.keys(input).length !== RENDER_INPUT_KEYS.size ||
    Object.keys(input).some((key) => !RENDER_INPUT_KEYS.has(key)) ||
    input.schemaVersion !== 'requirements-confirmation-render-input/v2' ||
    !nonEmpty(input.requirementSetId) ||
    !SHA256.test(input.semanticModelHash) ||
    input.authority !== 'none' ||
    !Array.isArray(input.fields) ||
    !input.fields.every((field) => validateField(field, input.semanticModelHash)) ||
    !Number.isSafeInteger(input.requiredRenderFieldCount) ||
    !Number.isSafeInteger(input.coveredFieldCount) ||
    !Number.isSafeInteger(input.blockingUnresolvedCount) ||
    !Number.isSafeInteger(input.syntheticFieldCount) ||
    !Number.isSafeInteger(input.authorityInvalidCount) ||
    !SHA256.test(input.requiredFieldSetHash) ||
    !SHA256.test(input.fieldSetHash) ||
    !SHA256.test(input.renderInputHash)
  ) {
    return false;
  }
  const fieldRefs = input.fields.map((field) => field.fieldRef);
  if (
    new Set(fieldRefs).size !== fieldRefs.length ||
    fieldRefs.join('|') !== [...fieldRefs].sort().join('|') ||
    input.requiredRenderFieldCount !== input.fields.length ||
    input.coveredFieldCount !==
      input.fields.filter((field) => field.provenanceRefs.length > 0).length ||
    input.blockingUnresolvedCount !==
      input.fields.filter((field) => field.applicability === 'unresolved').length ||
    input.syntheticFieldCount !== input.fields.filter((field) => field.synthetic).length ||
    input.authorityInvalidCount !== input.fields.filter(fieldAuthorityInvalid).length ||
    input.requiredFieldSetHash !== sha256Stable(fieldRefs) ||
    input.fieldSetHash !== sha256Stable(input.fields)
  ) {
    return false;
  }
  const { renderInputHash, ...payload } = input;
  return renderInputHash === sha256Stable(payload);
}

export function createRequirementsConfirmationRenderInput(input: {
  requirementSetId: string;
  semanticModelHash: string;
  requiredFieldRefs: string[];
  fields: RequirementsConfirmationRenderField[];
}): RequirementsConfirmationRenderInput {
  if (
    !nonEmpty(input.requirementSetId) ||
    !SHA256.test(input.semanticModelHash) ||
    !uniqueStrings(input.requiredFieldRefs) ||
    input.requiredFieldRefs.length === 0 ||
    !Array.isArray(input.fields) ||
    !input.fields.every((field) => validateField(field, input.semanticModelHash))
  ) {
    throw new Error('confirmation_render_input_invalid');
  }
  const requiredFieldRefs = [...input.requiredFieldRefs].sort();
  const fields = clone(input.fields).sort((left, right) =>
    left.fieldRef.localeCompare(right.fieldRef)
  );
  const observedFieldRefs = fields.map((field) => field.fieldRef);
  if (requiredFieldRefs.join('|') !== observedFieldRefs.join('|')) {
    throw new Error('confirmation_render_field_bijection_failed');
  }
  const payload = {
    schemaVersion: 'requirements-confirmation-render-input/v2' as const,
    requirementSetId: input.requirementSetId,
    semanticModelHash: input.semanticModelHash,
    authority: 'none' as const,
    fields,
    requiredRenderFieldCount: requiredFieldRefs.length,
    coveredFieldCount: fields.filter((field) => field.provenanceRefs.length > 0).length,
    blockingUnresolvedCount: fields.filter((field) => field.applicability === 'unresolved').length,
    syntheticFieldCount: fields.filter((field) => field.synthetic).length,
    authorityInvalidCount: fields.filter(fieldAuthorityInvalid).length,
    requiredFieldSetHash: sha256Stable(requiredFieldRefs),
    fieldSetHash: sha256Stable(fields),
  };
  const result: RequirementsConfirmationRenderInput = {
    ...payload,
    renderInputHash: sha256Stable(renderInputPayload(payload)),
  };
  if (!validateRequirementsConfirmationRenderInput(result)) {
    throw new Error('confirmation_render_input_validation_failed');
  }
  return result;
}

export function createRequirementsConfirmationRender(
  input: RequirementsConfirmationRenderInput
): RequirementsConfirmationRender {
  if (
    !validateRequirementsConfirmationRenderInput(input) ||
    input.blockingUnresolvedCount !== 0 ||
    input.syntheticFieldCount !== 0 ||
    input.authorityInvalidCount !== 0 ||
    input.coveredFieldCount !== input.requiredRenderFieldCount
  ) {
    throw new Error('confirmation_render_not_ready');
  }
  const payload = {
    schemaVersion: 'requirements-confirmation-render/v2' as const,
    requirementSetId: input.requirementSetId,
    semanticModelHash: input.semanticModelHash,
    renderInputHash: input.renderInputHash,
    authority: 'none' as const,
    proofRole: 'semantic_authorization_projection' as const,
    fields: clone(input.fields),
  };
  return { ...payload, renderHash: sha256Stable(payload) };
}

export function createRequirementsCloseoutRender(input: {
  requirementSetId: string;
  semanticModelHash: string;
  executionEvidenceRefs: RequirementsCloseoutEvidenceRef[];
}): RequirementsCloseoutRender {
  if (
    !nonEmpty(input.requirementSetId) ||
    !SHA256.test(input.semanticModelHash) ||
    !Array.isArray(input.executionEvidenceRefs) ||
    input.executionEvidenceRefs.length === 0 ||
    !input.executionEvidenceRefs.every((ref) => nonEmpty(ref.path) && SHA256.test(ref.hash)) ||
    new Set(input.executionEvidenceRefs.map((ref) => ref.path)).size !==
      input.executionEvidenceRefs.length
  ) {
    throw new Error('closeout_render_input_invalid');
  }
  const payload = {
    schemaVersion: 'requirements-closeout-render/v1' as const,
    requirementSetId: input.requirementSetId,
    semanticModelHash: input.semanticModelHash,
    authority: 'none' as const,
    proofRole: 'execution_evidence_projection' as const,
    executionEvidenceRefs: clone(input.executionEvidenceRefs).sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
  };
  return { ...payload, renderHash: sha256Stable(payload) };
}

export function validateRequirementsRenderSeparation(
  confirmation: RequirementsConfirmationRender,
  closeout: RequirementsCloseoutRender
): boolean {
  if (
    !confirmation ||
    typeof confirmation !== 'object' ||
    Array.isArray(confirmation) ||
    Object.keys(confirmation).length !== CONFIRMATION_RENDER_KEYS.size ||
    Object.keys(confirmation).some((key) => !CONFIRMATION_RENDER_KEYS.has(key)) ||
    !closeout ||
    typeof closeout !== 'object' ||
    Array.isArray(closeout) ||
    Object.keys(closeout).length !== CLOSEOUT_RENDER_KEYS.size ||
    Object.keys(closeout).some((key) => !CLOSEOUT_RENDER_KEYS.has(key)) ||
    confirmation.schemaVersion !== 'requirements-confirmation-render/v2' ||
    closeout.schemaVersion !== 'requirements-closeout-render/v1' ||
    confirmation.requirementSetId !== closeout.requirementSetId ||
    confirmation.semanticModelHash !== closeout.semanticModelHash ||
    confirmation.authority !== 'none' ||
    closeout.authority !== 'none' ||
    confirmation.proofRole !== 'semantic_authorization_projection' ||
    closeout.proofRole !== 'execution_evidence_projection'
  ) {
    return false;
  }
  const { renderHash: confirmationHash, ...confirmationPayload } = confirmation;
  const { renderHash: closeoutHash, ...closeoutPayload } = closeout;
  return (
    SHA256.test(confirmationHash) &&
    SHA256.test(closeoutHash) &&
    confirmationHash === sha256Stable(confirmationPayload) &&
    closeoutHash === sha256Stable(closeoutPayload)
  );
}
