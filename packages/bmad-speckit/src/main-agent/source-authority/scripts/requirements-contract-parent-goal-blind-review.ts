import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  strings,
  text,
  uniqueSorted,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

const ACTOR_ORDER = ['bounded_code_reviewer', 'final_acceptance_judge'] as const;
const TERMINAL_OUTCOMES = ['clean', 'findings', 'blocked'] as const;
const PEER_LEAKAGE_KEYS = [
  'peer',
  'peerrequest',
  'peerresponse',
  'peerfinding',
  'peerscore',
  'peerverdict',
  'peerreceipt',
];

export type RequirementsContractBlindReviewActorClass = (typeof ACTOR_ORDER)[number];
export type RequirementsContractBlindReviewTerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

export interface RequirementsContractBlindReviewInput {
  campaignId: string;
  campaignLineageKey: string;
  scopeManifestHash: string;
  portfolioHash: string;
  modelDiversityReceiptHash: string;
  initialReviewAttemptKey: string;
  frozenScopeBytesHash: string;
  frozenEvidenceHash: string;
  governedPathSetHash: string;
}

export interface RequirementsContractBlindReviewIntent {
  actorClass: RequirementsContractBlindReviewActorClass;
  dispatchMode: 'parallel';
  invocationMode: 'native';
  dispatchGroupId: string;
  preparedBeforeDispatch: true;
  modelRef: string;
  modelRevisionHash: string;
  blindInput: RequirementsContractBlindReviewInput;
  blindInputHash: string;
  invocationIntentHash: string;
}

export interface RequirementsContractBlindReviewActorReceipt {
  actorClass: RequirementsContractBlindReviewActorClass;
  dispatchGroupId: string;
  invocationMode: 'native';
  startedAfterBothIntentsPrepared: true;
  modelRef: string;
  modelRevisionHash: string;
  blindInputHash: string;
  invocationIntentHash: string;
  sourceLedgerHash: string;
  terminalOutcome: RequirementsContractBlindReviewTerminalOutcome;
  findingIds: string[];
  actorReceiptHash: string;
}

export interface RequirementsContractBlindnessProof {
  identicalBlindInputHash: string;
  frozenScopeBytesHash: string;
  frozenEvidenceHash: string;
  governedPathSetHash: string;
  preparedIntentHashes: string[];
  peerLeakageDetected: false;
}

export interface RequirementsContractBlindReviewInvocationCountReceipt {
  reviewerCalls: 1;
  finalJudgeCalls: 1;
  semanticInvocationCount: 2;
}

export interface RequirementsContractBlindReviewAggregateReceipt {
  schemaVersion: 'requirements-contract-blind-review-aggregate-receipt/v1';
  campaignId: string;
  campaignLineageKey: string;
  scopeManifestHash: string;
  portfolioHash: string;
  modelDiversityReceiptHash: string;
  initialReviewAttemptKey: string;
  actorReceipts: RequirementsContractBlindReviewActorReceipt[];
  blindnessProof: RequirementsContractBlindnessProof;
  invocationCountReceipt: RequirementsContractBlindReviewInvocationCountReceipt;
  sourceLedgerHashes: string[];
  decision: 'pass';
  aggregateHash: string;
}

export class RequirementsContractParentGoalBlindReviewError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractParentGoalBlindReviewError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractParentGoalBlindReviewError(code);
}

function isActorClass(value: unknown): value is RequirementsContractBlindReviewActorClass {
  return ACTOR_ORDER.includes(value as RequirementsContractBlindReviewActorClass);
}

function actorSortValue(actorClass: RequirementsContractBlindReviewActorClass): number {
  return ACTOR_ORDER.indexOf(actorClass);
}

function rejectPeerLeakage(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectPeerLeakage);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[-_]/gu, '').toLowerCase();
    if (PEER_LEAKAGE_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      fail('blind_review_peer_leakage_forbidden');
    }
    rejectPeerLeakage(child);
  }
}

function requireActorClass(value: unknown): RequirementsContractBlindReviewActorClass {
  if (!isActorClass(value)) fail('blind_review_actor_invalid');
  return value;
}

function requireTerminalOutcome(value: unknown): RequirementsContractBlindReviewTerminalOutcome {
  if (!TERMINAL_OUTCOMES.includes(value as RequirementsContractBlindReviewTerminalOutcome)) {
    fail('blind_review_terminal_outcome_invalid');
  }
  return value as RequirementsContractBlindReviewTerminalOutcome;
}

function requireBlindInput(
  value: unknown,
  campaignInput: JsonRecord
): RequirementsContractBlindReviewInput {
  if (!isRecord(value)) fail('blind_review_input_invalid');
  rejectPeerLeakage(value);
  const blindInput = {
    campaignId: requireText(value, 'campaignId', 'blind_review_scope_mismatch'),
    campaignLineageKey: requireHash(value, 'campaignLineageKey', 'blind_review_scope_mismatch'),
    scopeManifestHash: requireHash(value, 'scopeManifestHash', 'blind_review_scope_mismatch'),
    portfolioHash: requireHash(value, 'portfolioHash', 'blind_review_scope_mismatch'),
    modelDiversityReceiptHash: requireHash(
      value,
      'modelDiversityReceiptHash',
      'blind_review_scope_mismatch'
    ),
    initialReviewAttemptKey: requireHash(
      value,
      'initialReviewAttemptKey',
      'blind_review_scope_mismatch'
    ),
    frozenScopeBytesHash: requireHash(value, 'frozenScopeBytesHash', 'blind_review_byte_mismatch'),
    frozenEvidenceHash: requireHash(value, 'frozenEvidenceHash', 'blind_review_byte_mismatch'),
    governedPathSetHash: requireHash(value, 'governedPathSetHash', 'blind_review_byte_mismatch'),
  };
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'scopeManifestHash',
    'portfolioHash',
    'modelDiversityReceiptHash',
    'initialReviewAttemptKey',
  ] as const) {
    if (blindInput[field] !== campaignInput[field]) fail('blind_review_scope_mismatch');
  }
  return blindInput;
}

function requireIntent(
  value: unknown,
  campaignInput: JsonRecord
): RequirementsContractBlindReviewIntent {
  if (!isRecord(value)) fail('blind_review_intent_invalid');
  const actorClass = requireActorClass(value.actorClass);
  if (value.dispatchMode !== 'parallel' || value.invocationMode !== 'native') {
    fail('blind_review_intent_invalid');
  }
  if (value.preparedBeforeDispatch !== true) fail('blind_review_intent_invalid');
  const blindInput = requireBlindInput(value.blindInput, campaignInput);
  const blindInputHash = requireHash(value, 'blindInputHash', 'blind_review_intent_hash_mismatch');
  if (blindInputHash !== stableHash(blindInput)) fail('blind_review_intent_hash_mismatch');
  const intentPayload = {
    actorClass,
    dispatchMode: 'parallel' as const,
    invocationMode: 'native' as const,
    dispatchGroupId: requireText(value, 'dispatchGroupId', 'blind_review_intent_invalid'),
    preparedBeforeDispatch: true as const,
    modelRef: requireText(value, 'modelRef', 'blind_review_model_mismatch'),
    modelRevisionHash: requireHash(value, 'modelRevisionHash', 'blind_review_model_mismatch'),
    blindInput,
  };
  const invocationIntentHash = requireHash(
    value,
    'invocationIntentHash',
    'blind_review_intent_hash_mismatch'
  );
  if (invocationIntentHash !== stableHash(intentPayload)) {
    fail('blind_review_intent_hash_mismatch');
  }
  return { ...intentPayload, blindInputHash, invocationIntentHash };
}

function requireCampaignInput(value: unknown): JsonRecord {
  if (!isRecord(value)) fail('blind_review_campaign_input_invalid');
  return {
    campaignId: requireText(value, 'campaignId', 'blind_review_campaign_input_invalid'),
    campaignLineageKey: requireHash(
      value,
      'campaignLineageKey',
      'blind_review_campaign_input_invalid'
    ),
    scopeManifestHash: requireHash(
      value,
      'scopeManifestHash',
      'blind_review_campaign_input_invalid'
    ),
    portfolioHash: requireHash(value, 'portfolioHash', 'blind_review_campaign_input_invalid'),
    modelDiversityReceiptHash: requireHash(
      value,
      'modelDiversityReceiptHash',
      'blind_review_campaign_input_invalid'
    ),
    initialReviewAttemptKey: requireHash(
      value,
      'initialReviewAttemptKey',
      'blind_review_campaign_input_invalid'
    ),
  };
}

function requireOnePerActor<T extends { actorClass: RequirementsContractBlindReviewActorClass }>(
  records: readonly T[]
): void {
  const counts = new Map<RequirementsContractBlindReviewActorClass, number>();
  for (const record of records) {
    counts.set(record.actorClass, (counts.get(record.actorClass) ?? 0) + 1);
  }
  if (records.length !== 2 || ACTOR_ORDER.some((actorClass) => counts.get(actorClass) !== 1)) {
    fail('blind_review_actor_count_invalid');
  }
}

function requireMatchingBlindBytes(intents: readonly RequirementsContractBlindReviewIntent[]) {
  const [first, second] = intents;
  if (!first || !second) fail('blind_review_actor_count_invalid');
  if (first.blindInput.scopeManifestHash !== second.blindInput.scopeManifestHash) {
    fail('blind_review_scope_mismatch');
  }
  for (const field of [
    'frozenScopeBytesHash',
    'frozenEvidenceHash',
    'governedPathSetHash',
  ] as const) {
    if (first.blindInput[field] !== second.blindInput[field]) fail('blind_review_byte_mismatch');
  }
  return first.blindInput;
}

function requireActorReceipt(
  value: unknown,
  intentByActor: ReadonlyMap<
    RequirementsContractBlindReviewActorClass,
    RequirementsContractBlindReviewIntent
  >
): RequirementsContractBlindReviewActorReceipt {
  if (!isRecord(value)) fail('blind_review_actor_receipt_invalid');
  const actorClass = requireActorClass(value.actorClass);
  const intent = intentByActor.get(actorClass);
  if (!intent) fail('blind_review_actor_count_invalid');
  if (value.invocationMode !== 'native' || value.startedAfterBothIntentsPrepared !== true) {
    fail('blind_review_actor_receipt_invalid');
  }
  const dispatchGroupId = requireText(
    value,
    'dispatchGroupId',
    'blind_review_actor_receipt_invalid'
  );
  const modelRef = requireText(value, 'modelRef', 'blind_review_model_mismatch');
  const modelRevisionHash = requireHash(value, 'modelRevisionHash', 'blind_review_model_mismatch');
  const blindInputHash = requireHash(value, 'blindInputHash', 'blind_review_actor_receipt_invalid');
  const invocationIntentHash = requireHash(
    value,
    'invocationIntentHash',
    'blind_review_actor_receipt_invalid'
  );
  if (
    dispatchGroupId !== intent.dispatchGroupId ||
    modelRef !== intent.modelRef ||
    modelRevisionHash !== intent.modelRevisionHash ||
    blindInputHash !== intent.blindInputHash ||
    invocationIntentHash !== intent.invocationIntentHash
  ) {
    fail('blind_review_model_mismatch');
  }
  const payload = {
    actorClass,
    dispatchGroupId,
    invocationMode: 'native' as const,
    startedAfterBothIntentsPrepared: true as const,
    modelRef,
    modelRevisionHash,
    blindInputHash,
    invocationIntentHash,
    sourceLedgerHash: requireHash(value, 'sourceLedgerHash', 'blind_review_actor_receipt_invalid'),
    terminalOutcome: requireTerminalOutcome(value.terminalOutcome),
    findingIds: uniqueSorted(strings(value.findingIds)),
  };
  const actorReceiptHash = requireHash(
    value,
    'actorReceiptHash',
    'blind_review_actor_receipt_hash_mismatch'
  );
  if (actorReceiptHash !== stableHash(payload)) fail('blind_review_actor_receipt_hash_mismatch');
  return { ...payload, actorReceiptHash };
}

export function compileRequirementsContractParentGoalBlindReviewAggregate(
  input: unknown
): RequirementsContractBlindReviewAggregateReceipt {
  if (!isRecord(input)) fail('blind_review_aggregate_input_invalid');
  const campaignInput = requireCampaignInput(input.campaignInput);
  const rawIntents = Array.isArray(input.preparedIntents) ? input.preparedIntents : [];
  const preparedIntents = rawIntents.map((candidate) => requireIntent(candidate, campaignInput));
  requireOnePerActor(preparedIntents);
  const blindInput = requireMatchingBlindBytes(preparedIntents);
  const intentByActor = new Map(preparedIntents.map((intent) => [intent.actorClass, intent]));
  const rawReceipts = Array.isArray(input.actorReceipts) ? input.actorReceipts : [];
  const actorReceipts = rawReceipts.map((candidate) =>
    requireActorReceipt(candidate, intentByActor)
  );
  requireOnePerActor(actorReceipts);
  const sortedReceipts = [...actorReceipts].sort(
    (left, right) => actorSortValue(left.actorClass) - actorSortValue(right.actorClass)
  );
  const preparedIntentHashes = uniqueSorted(
    preparedIntents.map((intent) => intent.invocationIntentHash)
  );
  const payload = {
    schemaVersion: 'requirements-contract-blind-review-aggregate-receipt/v1' as const,
    campaignId: requireText(campaignInput, 'campaignId', 'blind_review_campaign_input_invalid'),
    campaignLineageKey: requireHash(
      campaignInput,
      'campaignLineageKey',
      'blind_review_campaign_input_invalid'
    ),
    scopeManifestHash: requireHash(
      campaignInput,
      'scopeManifestHash',
      'blind_review_campaign_input_invalid'
    ),
    portfolioHash: requireHash(
      campaignInput,
      'portfolioHash',
      'blind_review_campaign_input_invalid'
    ),
    modelDiversityReceiptHash: requireHash(
      campaignInput,
      'modelDiversityReceiptHash',
      'blind_review_campaign_input_invalid'
    ),
    initialReviewAttemptKey: requireHash(
      campaignInput,
      'initialReviewAttemptKey',
      'blind_review_campaign_input_invalid'
    ),
    actorReceipts: sortedReceipts,
    blindnessProof: {
      identicalBlindInputHash: stableHash(blindInput),
      frozenScopeBytesHash: blindInput.frozenScopeBytesHash,
      frozenEvidenceHash: blindInput.frozenEvidenceHash,
      governedPathSetHash: blindInput.governedPathSetHash,
      preparedIntentHashes,
      peerLeakageDetected: false as const,
    },
    invocationCountReceipt: {
      reviewerCalls: 1 as const,
      finalJudgeCalls: 1 as const,
      semanticInvocationCount: 2 as const,
    },
    sourceLedgerHashes: uniqueSorted(sortedReceipts.map((receipt) => receipt.sourceLedgerHash)),
    decision: 'pass' as const,
  };
  return { ...payload, aggregateHash: stableHash(payload) };
}

export function validateRequirementsContractParentGoalBlindReviewAggregate(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractBlindReviewAggregateReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('blind_review_aggregate_invalid');
  const aggregate = value as unknown as RequirementsContractBlindReviewAggregateReceipt;
  const { aggregateHash, ...payload } = aggregate;
  if (aggregateHash !== stableHash(payload)) fail('blind_review_aggregate_hash_mismatch');
  if (
    aggregate.decision !== 'pass' ||
    aggregate.schemaVersion !== 'requirements-contract-blind-review-aggregate-receipt/v1'
  ) {
    fail('blind_review_aggregate_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'initialReviewAttemptKey',
    'aggregateHash',
  ] as const) {
    if (text(aggregate[field]) !== text(currentAuthority[field])) {
      fail('blind_review_aggregate_stale');
    }
  }
  return aggregate;
}
