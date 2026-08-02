import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  applySemanticFieldValue,
  isCanonicalJsonValue,
  isPolicyApplicabilityInput,
  isResolutionPremise,
  resolveSemanticField,
  semanticFieldRefsOverlap,
  sha256Stable,
  sha256Text,
  type PolicyApplicabilityInput,
  type RequirementsPolicyCatalog,
  type ResolutionAuthorityClass,
  type SemanticResolutionPremise,
  type SemanticResolutionReceipt,
  type TrustedPolicyCatalogAuthority,
  type TrustedPolicyFacts,
  type TrustedRepositoryEvidence,
  type TrustedResolverInvocationContext,
  type TrustedRuleEvaluation,
  type TrustedSourceSnapshot,
} from './requirements-contract-semantic-resolver';

export type InteractionCandidateKind =
  | 'participant'
  | 'step'
  | 'branch'
  | 'ordering'
  | 'temporal'
  | 'deployment'
  | 'diagram_applicability';

export interface InteractionDecisionReceipt {
  schemaVersion: 'requirements-decision-receipt/v1';
  receiptRef: string;
  questionId: string;
  questionHash: string;
  responseId: string;
  responseHash: string;
  selection:
    | { kind: 'option'; optionId: string }
    | { kind: 'custom_answer'; customAnswer: string };
  receiptHash: string;
  fieldRef: string;
  valueHash: string;
  authorityState: 'human_confirmed';
  sequenceModelHashBefore: string;
  sequenceModelHashAfter: string;
  affectedRequirementRefs: string[];
  invalidatedArtifactRefs: string[];
  confirmedAt: string;
}

export interface CreateInteractionDecisionReceiptInput {
  receiptRef: string;
  questionId: string;
  questionHash: string;
  responseId: string;
  responseHash: string;
  selection:
    | { kind: 'option'; optionId: string }
    | { kind: 'custom_answer'; customAnswer: string };
  fieldRef: string;
  value: unknown;
  sequenceModelBefore: Record<string, unknown>;
  sequenceModelAfter: Record<string, unknown>;
  affectedRequirementRefs: string[];
  invalidatedArtifactRefs: string[];
  confirmedAt: string;
}

export interface DecisionDocumentationEffects {
  authorityReceiptRef: string;
  contextUpdate: {
    applicability: 'domain_vocabulary_only' | 'not_applicable';
    entries: Array<{ term: string; definition: string }>;
  };
  adr: {
    applicability: 'required' | 'not_applicable';
    criteria: {
      hardToReverse: boolean;
      surprising: boolean;
      realTradeoff: boolean;
    };
    authorityReceiptRef: string;
  };
  conversationAuthority: false;
}

export interface TrustedDecisionReceiptReadback {
  receiptPath: string;
  receiptFileHash: string;
  schemaHash: string;
  receipt: InteractionDecisionReceipt;
}

export interface InteractionResolutionCandidate {
  interactionKind: InteractionCandidateKind;
  resolutionId: string;
  fieldRef: string;
  value: unknown;
  semanticKind: string;
  resolutionAuthorityClass: ResolutionAuthorityClass;
  premises: SemanticResolutionPremise[];
  derivationRule: string | null;
  applicabilityProof: PolicyApplicabilityInput | null;
  conflictingCandidates: string[];
  confidence?: number;
  decisionReceiptRef?: string;
}

export interface AuthorizedInteractionField {
  interactionKind: InteractionCandidateKind;
  fieldRef: string;
  authorityState: 'source_grounded' | 'derived' | 'human_confirmed';
  semanticResolutionReceipt: SemanticResolutionReceipt | null;
  decisionReceipt: InteractionDecisionReceipt | null;
}

export interface UnresolvedInteractionField {
  interactionKind: InteractionCandidateKind | 'unknown';
  fieldRef: string;
  blocking: true;
  reasonCode: string;
}

export interface InteractionResolutionInput {
  sequenceModelBefore: Record<string, unknown>;
  candidates: InteractionResolutionCandidate[];
  trustedInvocationContext?: Pick<
    TrustedResolverInvocationContext,
    'resolverId' | 'resolutionRunId'
  >;
  allowlistedDerivationRules?: readonly string[];
  policyCatalog?: RequirementsPolicyCatalog;
  trustedSourceSnapshots?: Readonly<Record<string, TrustedSourceSnapshot>>;
  trustedRuleEvaluations?: Readonly<Record<string, TrustedRuleEvaluation>>;
  trustedRepositoryEvidence?: Readonly<Record<string, TrustedRepositoryEvidence>>;
  trustedPolicyCatalogAuthority?: TrustedPolicyCatalogAuthority;
  trustedPolicyFacts?: TrustedPolicyFacts;
  trustedDecisionReceipts?: Readonly<Record<string, TrustedDecisionReceiptReadback>>;
}

export interface InteractionResolutionResult {
  sequenceModelBefore: Record<string, unknown>;
  sequenceModelAfter: Record<string, unknown>;
  sequenceModelHashBefore: string;
  sequenceModelHashAfter: string;
  authorized: AuthorizedInteractionField[];
  unresolved: UnresolvedInteractionField[];
}

const INTERACTION_KINDS = new Set<InteractionCandidateKind>([
  'participant',
  'step',
  'branch',
  'ordering',
  'temporal',
  'deployment',
  'diagram_applicability',
]);
const SYNTHETIC_PARTICIPANTS = new Set(['user', 'agent', 'record', 'gate']);
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const DECISION_RECEIPT_SCHEMA = 'requirements-decision-receipt.schema.json';
const RESOLUTION_AUTHORITY_CLASSES = new Set<ResolutionAuthorityClass>([
  'source_extracted',
  'rule_derived',
  'repository_derived',
  'policy_inherited',
  'model_hypothesis',
  'business_decision_required',
]);
const INTERACTION_KIND_ORDER = new Map<InteractionCandidateKind, number>([
  ['participant', 0],
  ['step', 1],
  ['branch', 2],
  ['ordering', 3],
  ['temporal', 4],
  ['deployment', 5],
  ['diagram_applicability', 6],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const permitted = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => permitted.has(key))
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isSyntheticParticipant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  const participant = value as Record<string, unknown>;
  const identity = [participant.id, participant.label]
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase());
  return identity.length === 0 || identity.some((item) => SYNTHETIC_PARTICIPANTS.has(item));
}

function decisionReceiptSchemaPath(): string {
  return path.resolve(__dirname, '..', 'schemas', DECISION_RECEIPT_SCHEMA);
}

export function validateInteractionDecisionReceipt(
  value: unknown
): value is InteractionDecisionReceipt {
  if (!isRecord(value)) return false;
  const schemaText = readFileSync(decisionReceiptSchemaPath(), 'utf8');
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(schemaText) as object
  );
  if (!validate(value)) return false;
  const { receiptHash, ...payload } = value;
  return (
    typeof receiptHash === 'string' &&
    SHA256.test(receiptHash) &&
    receiptHash === sha256Stable(payload)
  );
}

export function createInteractionDecisionReceipt(
  input: CreateInteractionDecisionReceiptInput
): InteractionDecisionReceipt {
  if (
    !isNonEmptyString(input.receiptRef) ||
    !isNonEmptyString(input.questionId) ||
    !SHA256.test(input.questionHash) ||
    !isNonEmptyString(input.responseId) ||
    !SHA256.test(input.responseHash) ||
    !isNonEmptyString(input.fieldRef) ||
    !isCanonicalJsonValue(input.value) ||
    !isCanonicalJsonValue(input.sequenceModelBefore) ||
    !isCanonicalJsonValue(input.sequenceModelAfter) ||
    !isStringArray(input.affectedRequirementRefs) ||
    input.affectedRequirementRefs.length === 0 ||
    !isStringArray(input.invalidatedArtifactRefs) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(input.confirmedAt)
  ) {
    throw new Error('decision_receipt_input_invalid');
  }
  const selection = input.selection;
  if (
    !isRecord(selection) ||
    !(
      (selection.kind === 'option' &&
        hasExactKeys(selection, ['kind', 'optionId']) &&
        isNonEmptyString(selection.optionId)) ||
      (selection.kind === 'custom_answer' &&
        hasExactKeys(selection, ['kind', 'customAnswer']) &&
        isNonEmptyString(selection.customAnswer))
    )
  ) {
    throw new Error('decision_receipt_selection_invalid');
  }
  const affectedRequirementRefs = [...new Set(input.affectedRequirementRefs)];
  const invalidatedArtifactRefs = [...new Set(input.invalidatedArtifactRefs)];
  if (
    affectedRequirementRefs.length !== input.affectedRequirementRefs.length ||
    invalidatedArtifactRefs.length !== input.invalidatedArtifactRefs.length
  ) {
    throw new Error('decision_receipt_refs_duplicate');
  }
  const payload = {
    schemaVersion: 'requirements-decision-receipt/v1' as const,
    receiptRef: input.receiptRef,
    questionId: input.questionId,
    questionHash: input.questionHash,
    responseId: input.responseId,
    responseHash: input.responseHash,
    selection: clone(input.selection),
    fieldRef: input.fieldRef,
    valueHash: sha256Stable(input.value),
    authorityState: 'human_confirmed' as const,
    sequenceModelHashBefore: sha256Stable(input.sequenceModelBefore),
    sequenceModelHashAfter: sha256Stable(input.sequenceModelAfter),
    affectedRequirementRefs,
    invalidatedArtifactRefs,
    confirmedAt: input.confirmedAt,
  };
  const receipt: InteractionDecisionReceipt = {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
  if (!validateInteractionDecisionReceipt(receipt)) {
    throw new Error('decision_receipt_schema_invalid');
  }
  return receipt;
}

export function deriveDecisionDocumentationEffects(input: {
  receiptRef: string;
  domainVocabulary?: Array<{ term: string; definition: string }>;
  adrCriteria: {
    hardToReverse: boolean;
    surprising: boolean;
    realTradeoff: boolean;
  };
}): DecisionDocumentationEffects {
  if (
    !isNonEmptyString(input.receiptRef) ||
    !isRecord(input.adrCriteria) ||
    !['hardToReverse', 'surprising', 'realTradeoff'].every(
      (key) => typeof input.adrCriteria[key as keyof typeof input.adrCriteria] === 'boolean'
    )
  ) {
    throw new Error('decision_documentation_effects_input_invalid');
  }
  const entries = (input.domainVocabulary ?? []).map((entry) => {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ['term', 'definition']) ||
      !isNonEmptyString(entry.term) ||
      !isNonEmptyString(entry.definition)
    ) {
      throw new Error('decision_domain_vocabulary_invalid');
    }
    return { term: entry.term, definition: entry.definition };
  });
  const adrRequired =
    input.adrCriteria.hardToReverse &&
    input.adrCriteria.surprising &&
    input.adrCriteria.realTradeoff;
  return {
    authorityReceiptRef: input.receiptRef,
    contextUpdate: {
      applicability: entries.length > 0 ? 'domain_vocabulary_only' : 'not_applicable',
      entries,
    },
    adr: {
      applicability: adrRequired ? 'required' : 'not_applicable',
      criteria: { ...input.adrCriteria },
      authorityReceiptRef: input.receiptRef,
    },
    conversationAuthority: false,
  };
}

function validDecisionReceipt(
  receiptRef: string,
  registry: InteractionResolutionInput['trustedDecisionReceipts'],
  candidate: InteractionResolutionCandidate,
  beforeHash: string,
  afterHash: string
): InteractionDecisionReceipt | null {
  if (!isRecord(registry)) return null;
  const readback = registry[receiptRef];
  if (
    !isRecord(readback) ||
    !hasExactKeys(readback, ['receiptPath', 'receiptFileHash', 'schemaHash', 'receipt']) ||
    !isNonEmptyString(readback.receiptPath) ||
    !isNonEmptyString(readback.receiptFileHash) ||
    !isNonEmptyString(readback.schemaHash) ||
    !isRecord(readback.receipt)
  ) {
    return null;
  }
  const receipt = readback.receipt;
  if (
    readback.receiptPath !== receiptRef ||
    readback.receiptFileHash !== sha256Stable(receipt) ||
    receipt.receiptRef !== receiptRef
  ) {
    return null;
  }
  const schemaText = readFileSync(decisionReceiptSchemaPath(), 'utf8');
  if (
    readback.schemaHash !== sha256Text(schemaText) ||
    !validateInteractionDecisionReceipt(receipt)
  ) {
    return null;
  }
  return (
    receipt.fieldRef === candidate.fieldRef &&
    receipt.valueHash === sha256Stable(candidate.value) &&
    receipt.authorityState === 'human_confirmed' &&
    receipt.sequenceModelHashBefore === beforeHash &&
    receipt.sequenceModelHashAfter === afterHash
  )
    ? (receipt as unknown as InteractionDecisionReceipt)
    : null;
}

function unresolved(
  candidate: Partial<InteractionResolutionCandidate> | null,
  reasonCode: string
): UnresolvedInteractionField {
  return {
    interactionKind:
      candidate?.interactionKind && INTERACTION_KINDS.has(candidate.interactionKind)
        ? candidate.interactionKind
        : 'unknown',
    fieldRef: typeof candidate?.fieldRef === 'string' ? candidate.fieldRef : '',
    blocking: true,
    reasonCode,
  };
}

function parseInteractionCandidate(value: unknown): InteractionResolutionCandidate | null {
  if (!isRecord(value)) return null;
  if (
    !hasExactKeys(
      value,
      [
        'interactionKind',
        'resolutionId',
        'fieldRef',
        'value',
        'semanticKind',
        'resolutionAuthorityClass',
        'premises',
        'derivationRule',
        'applicabilityProof',
        'conflictingCandidates',
      ],
      ['confidence', 'decisionReceiptRef']
    ) ||
    !isNonEmptyString(value.interactionKind) ||
    !isNonEmptyString(value.resolutionId) ||
    !isNonEmptyString(value.fieldRef) ||
    !isCanonicalJsonValue(value.value) ||
    !isNonEmptyString(value.semanticKind) ||
    !isNonEmptyString(value.resolutionAuthorityClass) ||
    !Array.isArray(value.premises) ||
    !value.premises.every(isResolutionPremise) ||
    !(value.derivationRule === null || isNonEmptyString(value.derivationRule)) ||
    !(value.applicabilityProof === null || isPolicyApplicabilityInput(value.applicabilityProof)) ||
    !isStringArray(value.conflictingCandidates) ||
    !(value.confidence === undefined ||
      (typeof value.confidence === 'number' && Number.isFinite(value.confidence))) ||
    !(value.decisionReceiptRef === undefined || isNonEmptyString(value.decisionReceiptRef))
  ) {
    return null;
  }
  return value as unknown as InteractionResolutionCandidate;
}

function semanticOrder(candidate: InteractionResolutionCandidate): number {
  if (!isRecord(candidate.value)) return Number.MAX_SAFE_INTEGER;
  const order = candidate.value.order;
  return Number.isSafeInteger(order) && Number(order) >= 0
    ? Number(order)
    : Number.MAX_SAFE_INTEGER;
}

function canonicalCandidateKey(candidate: InteractionResolutionCandidate): string {
  const kindOrder = INTERACTION_KIND_ORDER.get(candidate.interactionKind) ?? 99;
  return [
    String(semanticOrder(candidate)).padStart(16, '0'),
    String(kindOrder).padStart(2, '0'),
    candidate.fieldRef,
    candidate.resolutionId,
    sha256Stable(candidate.value),
  ].join('|');
}

function malformedCandidateKey(value: unknown): string {
  try {
    return `malformed|${sha256Stable(value)}`;
  } catch {
    return 'malformed|unhashable';
  }
}

function malformedInputResult(reasonCode: string): InteractionResolutionResult {
  const empty = {};
  return {
    sequenceModelBefore: empty,
    sequenceModelAfter: empty,
    sequenceModelHashBefore: sha256Stable(empty),
    sequenceModelHashAfter: sha256Stable(empty),
    authorized: [],
    unresolved: [unresolved(null, reasonCode)],
  };
}

export function resolveInteractionCandidates(
  inputValue: unknown
): InteractionResolutionResult {
  try {
    if (
      !isRecord(inputValue) ||
      !hasExactKeys(
        inputValue,
        ['sequenceModelBefore', 'candidates'],
        [
          'trustedInvocationContext',
          'allowlistedDerivationRules',
          'policyCatalog',
          'trustedSourceSnapshots',
          'trustedRuleEvaluations',
          'trustedRepositoryEvidence',
          'trustedPolicyCatalogAuthority',
          'trustedPolicyFacts',
          'trustedDecisionReceipts',
        ]
      ) ||
      !isRecord(inputValue.sequenceModelBefore) ||
      !Array.isArray(inputValue.candidates)
    ) {
      return malformedInputResult('malformed_interaction_input');
    }
    if (!isCanonicalJsonValue(inputValue.sequenceModelBefore)) {
      return malformedInputResult('noncanonical_sequence_model');
    }
    const input = inputValue as unknown as InteractionResolutionInput;
    const sequenceModelBefore = clone(input.sequenceModelBefore);
    let sequenceModelAfter = clone(input.sequenceModelBefore);
    const authorized: AuthorizedInteractionField[] = [];
    const unresolvedFields: UnresolvedInteractionField[] = [];
    const entries = input.candidates
      .map((raw) => {
        const candidate = parseInteractionCandidate(raw);
        return {
          candidate,
          key: candidate ? canonicalCandidateKey(candidate) : malformedCandidateKey(raw),
        };
      })
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    const fieldCounts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.candidate) continue;
      fieldCounts.set(
        entry.candidate.fieldRef,
        (fieldCounts.get(entry.candidate.fieldRef) ?? 0) + 1
      );
    }
    const overlappingCandidateKeys = new Set<string>();
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      if (!left.candidate) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        if (
          !right.candidate ||
          left.candidate.fieldRef === right.candidate.fieldRef ||
          !semanticFieldRefsOverlap(left.candidate.fieldRef, right.candidate.fieldRef)
        ) {
          continue;
        }
        overlappingCandidateKeys.add(left.key);
        overlappingCandidateKeys.add(right.key);
      }
    }

    for (const entry of entries) {
      const candidate = entry.candidate;
      if (!candidate) {
        unresolvedFields.push(unresolved(null, 'malformed_interaction_candidate'));
        continue;
      }
      if (!INTERACTION_KINDS.has(candidate.interactionKind)) {
        unresolvedFields.push(unresolved(candidate, 'unsupported_interaction_kind'));
        continue;
      }
      if (!RESOLUTION_AUTHORITY_CLASSES.has(candidate.resolutionAuthorityClass)) {
        unresolvedFields.push(unresolved(candidate, 'unsupported_resolution_authority_class'));
        continue;
      }
      if ((fieldCounts.get(candidate.fieldRef) ?? 0) !== 1) {
        unresolvedFields.push(unresolved(candidate, 'ambiguous_interaction_field'));
        continue;
      }
      if (overlappingCandidateKeys.has(entry.key)) {
        unresolvedFields.push(unresolved(candidate, 'overlapping_interaction_field'));
        continue;
      }
      if (candidate.interactionKind === 'participant' && isSyntheticParticipant(candidate.value)) {
        unresolvedFields.push(unresolved(candidate, 'synthetic_participant_forbidden'));
        continue;
      }
      const nextModelValue = applySemanticFieldValue(
        sequenceModelAfter,
        candidate.fieldRef,
        candidate.value
      );
      if (!isRecord(nextModelValue)) {
        unresolvedFields.push(unresolved(candidate, 'invalid_interaction_field_ref'));
        continue;
      }
      const nextModel = nextModelValue;
      const beforeHash = sha256Stable(sequenceModelAfter);
      const afterHash = sha256Stable(nextModel);
      if (afterHash === beforeHash) {
        unresolvedFields.push(unresolved(candidate, 'interaction_noop_forbidden'));
        continue;
      }
      const decisionReceipt = candidate.decisionReceiptRef
        ? validDecisionReceipt(
            candidate.decisionReceiptRef,
            input.trustedDecisionReceipts,
            candidate,
            beforeHash,
            afterHash
          )
        : null;
      if (candidate.decisionReceiptRef && !decisionReceipt) {
        unresolvedFields.push(unresolved(candidate, 'decision_receipt_invalid'));
        continue;
      }
      if (decisionReceipt) {
        sequenceModelAfter = nextModel;
        authorized.push({
          interactionKind: candidate.interactionKind,
          fieldRef: candidate.fieldRef,
          authorityState: 'human_confirmed',
          semanticResolutionReceipt: null,
          decisionReceipt,
        });
        continue;
      }
      const result = resolveSemanticField(
        {
          resolutionId: candidate.resolutionId,
          fieldRef: candidate.fieldRef,
          value: candidate.value,
          semanticKind: candidate.semanticKind,
          resolutionAuthorityClass: candidate.resolutionAuthorityClass,
          premises: candidate.premises,
          derivationRule: candidate.derivationRule,
          applicabilityProof: candidate.applicabilityProof,
          conflictingCandidates: candidate.conflictingCandidates,
          ...(candidate.confidence === undefined ? {} : { confidence: candidate.confidence }),
        },
        {
          allowlistedDerivationRules: input.allowlistedDerivationRules,
          policyCatalog: input.policyCatalog,
          trustedSourceSnapshots: input.trustedSourceSnapshots,
          trustedRuleEvaluations: input.trustedRuleEvaluations,
          trustedRepositoryEvidence: input.trustedRepositoryEvidence,
          trustedPolicyCatalogAuthority: input.trustedPolicyCatalogAuthority,
          trustedPolicyFacts: input.trustedPolicyFacts,
          trustedInvocationContext: input.trustedInvocationContext
            ? {
                ...input.trustedInvocationContext,
                sourceModelBefore: sequenceModelAfter,
              }
            : undefined,
        }
      );
      if (result.status === 'unresolved') {
        unresolvedFields.push(unresolved(candidate, result.reasonCode));
        continue;
      }
      sequenceModelAfter = nextModel;
      authorized.push({
        interactionKind: candidate.interactionKind,
        fieldRef: candidate.fieldRef,
        authorityState: result.authorityState,
        semanticResolutionReceipt: result.receipt,
        decisionReceipt: null,
      });
    }

    return {
      sequenceModelBefore,
      sequenceModelAfter,
      sequenceModelHashBefore: sha256Stable(sequenceModelBefore),
      sequenceModelHashAfter: sha256Stable(sequenceModelAfter),
      authorized,
      unresolved: unresolvedFields,
    };
  } catch {
    return malformedInputResult('malformed_interaction_input');
  }
}
