import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  text,
  uniqueSorted,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

export type RequirementsContractJudgeReviewCampaignTraceMode = 'clean' | 'remediated';

export interface RequirementsContractJudgeReviewCampaignInvocationCounts {
  reviewerCalls: 1;
  initialFinalJudgeCalls: 1;
  finalRejudgeCalls: 0 | 1;
  semanticInvocationCount: 2 | 3;
}

export interface RequirementsContractJudgeReviewCampaignRemediationCounts {
  repairUnitCount: number;
  deterministicRetryCount: number;
  transactionCount: 0 | 1;
  publicationCount: 0 | 1;
}

export interface RequirementsContractJudgeReviewCampaignJ06TraceOutput {
  schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  mode: RequirementsContractJudgeReviewCampaignTraceMode;
  semanticInvocationCount: 2 | 3;
  reviewerInvocationCount: 1;
  finalJudgeInvocationCount: 1 | 2;
  completeReceiptSet: true;
  traceHash: string;
  outputHash: string;
}

export interface RequirementsContractJudgeReviewCampaignTrace {
  schemaVersion: 'requirements-contract-judge-review-campaign-trace/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  mode: RequirementsContractJudgeReviewCampaignTraceMode;
  blindReviewAggregateHash: string;
  remediationLedgerHash: string | null;
  repairTransactionManifestHash: string | null;
  remediationBaselineHash: string | null;
  remediationJournalHash: string | null;
  remediationVerificationHash: string | null;
  publicationReceiptHash: string | null;
  finalizationByteManifestHash: string | null;
  finalRejudgeInputHash: string | null;
  finalAcceptanceStateHash: string;
  effectivePassReceiptHash: string;
  transitionReceiptHashes: string[];
  originReceiptHashes: string[];
  repairUnitReceiptHashes: string[];
  deterministicRetryReceiptHashes: string[];
  invocationCounts: RequirementsContractJudgeReviewCampaignInvocationCounts;
  remediationCounts: RequirementsContractJudgeReviewCampaignRemediationCounts;
  secondReviewerPath: false;
  completeReceiptSet: true;
  j06StableOutput: RequirementsContractJudgeReviewCampaignJ06TraceOutput;
  traceHash: string;
  decision: 'pass';
}

export class RequirementsContractJudgeReviewCampaignTraceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractJudgeReviewCampaignTraceError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractJudgeReviewCampaignTraceError(code);
}

function nullableHash(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined || value === '') return null;
  return requireHash(record, key, 'judge_review_campaign_trace_hash_invalid');
}

function hashList(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const hashes = requireNonEmptyUniqueStrings(value, code);
  for (const hash of hashes) requireHash({ hash }, 'hash', code);
  return uniqueSorted(hashes);
}

function optionalHashList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const hashes = requireNonEmptyUniqueStrings(value, 'judge_review_campaign_trace_hash_invalid');
  for (const hash of hashes) {
    requireHash({ hash }, 'hash', 'judge_review_campaign_trace_hash_invalid');
  }
  return uniqueSorted(hashes);
}

function traceMode(value: unknown): RequirementsContractJudgeReviewCampaignTraceMode {
  if (value === 'clean' || value === 'remediated') return value;
  fail('judge_review_campaign_trace_mode_invalid');
}

function explicitReviewerCalls(input: JsonRecord): number {
  return typeof input.reviewerCalls === 'number' ? input.reviewerCalls : 1;
}

function requireRemediatedReceiptSet(input: {
  remediationLedgerHash: string | null;
  repairTransactionManifestHash: string | null;
  remediationBaselineHash: string | null;
  remediationJournalHash: string | null;
  remediationVerificationHash: string | null;
  publicationReceiptHash: string | null;
  finalizationByteManifestHash: string | null;
  finalRejudgeInputHash: string | null;
  repairUnitReceiptHashes: string[];
}): void {
  if (
    !input.remediationLedgerHash ||
    !input.repairTransactionManifestHash ||
    !input.remediationBaselineHash ||
    !input.remediationJournalHash ||
    !input.remediationVerificationHash ||
    !input.publicationReceiptHash ||
    !input.finalizationByteManifestHash ||
    !input.finalRejudgeInputHash ||
    input.repairUnitReceiptHashes.length === 0
  ) {
    fail('judge_review_campaign_trace_receipts_incomplete');
  }
}

function requireCleanReceiptSet(input: {
  remediationLedgerHash: string | null;
  repairTransactionManifestHash: string | null;
  remediationBaselineHash: string | null;
  remediationJournalHash: string | null;
  remediationVerificationHash: string | null;
  publicationReceiptHash: string | null;
  finalizationByteManifestHash: string | null;
  finalRejudgeInputHash: string | null;
  repairUnitReceiptHashes: string[];
  deterministicRetryReceiptHashes: string[];
}): void {
  if (
    input.remediationLedgerHash ||
    input.repairTransactionManifestHash ||
    input.remediationBaselineHash ||
    input.remediationJournalHash ||
    input.remediationVerificationHash ||
    input.publicationReceiptHash ||
    input.finalizationByteManifestHash ||
    input.finalRejudgeInputHash ||
    input.repairUnitReceiptHashes.length > 0 ||
    input.deterministicRetryReceiptHashes.length > 0
  ) {
    fail('judge_review_campaign_trace_clean_receipts_invalid');
  }
}

export function compileRequirementsContractJudgeReviewCampaignTrace(
  input: unknown
): RequirementsContractJudgeReviewCampaignTrace {
  if (!isRecord(input)) fail('judge_review_campaign_trace_invalid');
  const mode = traceMode(input.mode);
  const reviewerCalls = explicitReviewerCalls(input);
  if (reviewerCalls !== 1) fail('judge_review_campaign_trace_second_reviewer_forbidden');
  const transitionReceiptHashes = hashList(
    input.transitionReceiptHashes,
    'judge_review_campaign_trace_receipts_incomplete'
  );
  const originReceiptHashes = hashList(
    input.originReceiptHashes,
    'judge_review_campaign_trace_receipts_incomplete'
  );
  const repairUnitReceiptHashes = optionalHashList(input.repairUnitReceiptHashes);
  const deterministicRetryReceiptHashes = optionalHashList(input.deterministicRetryReceiptHashes);
  const receiptSet = {
    remediationLedgerHash: nullableHash(input, 'remediationLedgerHash'),
    repairTransactionManifestHash: nullableHash(input, 'repairTransactionManifestHash'),
    remediationBaselineHash: nullableHash(input, 'remediationBaselineHash'),
    remediationJournalHash: nullableHash(input, 'remediationJournalHash'),
    remediationVerificationHash: nullableHash(input, 'remediationVerificationHash'),
    publicationReceiptHash: nullableHash(input, 'publicationReceiptHash'),
    finalizationByteManifestHash: nullableHash(input, 'finalizationByteManifestHash'),
    finalRejudgeInputHash: nullableHash(input, 'finalRejudgeInputHash'),
  };
  if (mode === 'clean') {
    requireCleanReceiptSet({
      ...receiptSet,
      repairUnitReceiptHashes,
      deterministicRetryReceiptHashes,
    });
  } else {
    requireRemediatedReceiptSet({
      ...receiptSet,
      repairUnitReceiptHashes,
    });
  }
  const finalRejudgeCalls = mode === 'remediated' ? 1 : 0;
  const semanticInvocationCount = mode === 'remediated' ? 3 : 2;
  const invocationCounts = {
    reviewerCalls: 1 as const,
    initialFinalJudgeCalls: 1 as const,
    finalRejudgeCalls: finalRejudgeCalls as 0 | 1,
    semanticInvocationCount: semanticInvocationCount as 2 | 3,
  };
  const remediationCounts = {
    repairUnitCount: repairUnitReceiptHashes.length,
    deterministicRetryCount: deterministicRetryReceiptHashes.length,
    transactionCount: (mode === 'remediated' ? 1 : 0) as 0 | 1,
    publicationCount: (mode === 'remediated' ? 1 : 0) as 0 | 1,
  };
  const payload = {
    schemaVersion: 'requirements-contract-judge-review-campaign-trace/v1' as const,
    campaignId: requireText(input, 'campaignId', 'judge_review_campaign_trace_identity_invalid'),
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'judge_review_campaign_trace_identity_invalid'
    ),
    initialReviewAttemptKey: requireHash(
      input,
      'initialReviewAttemptKey',
      'judge_review_campaign_trace_identity_invalid'
    ),
    mode,
    blindReviewAggregateHash: requireHash(
      input,
      'blindReviewAggregateHash',
      'judge_review_campaign_trace_receipts_incomplete'
    ),
    ...receiptSet,
    finalAcceptanceStateHash: requireHash(
      input,
      'finalAcceptanceStateHash',
      'judge_review_campaign_trace_receipts_incomplete'
    ),
    effectivePassReceiptHash: requireHash(
      input,
      'effectivePassReceiptHash',
      'judge_review_campaign_trace_receipts_incomplete'
    ),
    transitionReceiptHashes,
    originReceiptHashes,
    repairUnitReceiptHashes,
    deterministicRetryReceiptHashes,
    invocationCounts,
    remediationCounts,
    secondReviewerPath: false as const,
    completeReceiptSet: true as const,
  };
  const traceHash = stableHash(payload);
  const j06Payload = {
    schemaVersion: 'requirements-contract-judge-review-campaign-j06-trace-output/v1' as const,
    campaignId: payload.campaignId,
    campaignLineageKey: payload.campaignLineageKey,
    initialReviewAttemptKey: payload.initialReviewAttemptKey,
    mode,
    semanticInvocationCount: semanticInvocationCount as 2 | 3,
    reviewerInvocationCount: 1 as const,
    finalJudgeInvocationCount: (mode === 'remediated' ? 2 : 1) as 1 | 2,
    completeReceiptSet: true as const,
    traceHash,
  };
  const j06StableOutput = { ...j06Payload, outputHash: stableHash(j06Payload) };
  return {
    ...payload,
    j06StableOutput,
    traceHash,
    decision: 'pass' as const,
  };
}

export function validateRequirementsContractJudgeReviewCampaignTrace(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractJudgeReviewCampaignTrace {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('judge_review_campaign_trace_invalid');
  }
  const trace = value as unknown as RequirementsContractJudgeReviewCampaignTrace;
  const { traceHash, decision, j06StableOutput, ...payload } = trace;
  if (
    decision !== 'pass' ||
    trace.schemaVersion !== 'requirements-contract-judge-review-campaign-trace/v1' ||
    trace.secondReviewerPath !== false ||
    trace.completeReceiptSet !== true ||
    traceHash !== stableHash(payload)
  ) {
    fail('judge_review_campaign_trace_hash_mismatch');
  }
  if (
    trace.j06StableOutput.schemaVersion !==
      'requirements-contract-judge-review-campaign-j06-trace-output/v1' ||
    trace.j06StableOutput.traceHash !== trace.traceHash
  ) {
    fail('judge_review_campaign_trace_output_invalid');
  }
  const { outputHash, ...j06Payload } = trace.j06StableOutput;
  if (outputHash !== stableHash(j06Payload)) {
    fail('judge_review_campaign_trace_output_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'initialReviewAttemptKey',
    'traceHash',
  ] as const) {
    if (text(trace[field]) !== text(currentAuthority[field])) {
      fail('judge_review_campaign_trace_stale');
    }
  }
  return trace;
}
