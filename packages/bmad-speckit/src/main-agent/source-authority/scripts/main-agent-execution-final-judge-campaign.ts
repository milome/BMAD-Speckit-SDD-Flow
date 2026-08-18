import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isRecord,
  stableHash,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';
import {
  validateMainAgentExecutionFinalJudgeCampaignInput,
  type MainAgentExecutionFinalJudgeCampaignInput,
} from './main-agent-execution-final-judge-campaign-input';
import {
  canonicalGoalExecutionBytes,
  publishGoalExecutionImmutableArtifact,
} from './subcontract-evidence';

export type MainAgentExecutionFinalJudgeActorIntent = {
  actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge';
  dispatchMode: 'parallel';
  invocationMode: 'native';
  dispatchGroupId: string;
  preparedBeforeDispatch: true;
  blindInput: Record<string, unknown>;
  blindInputHash: string;
  invocationIntentHash: string;
};

export type MainAgentExecutionActorIsolationReceipt = {
  schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1';
  actorClass: MainAgentExecutionFinalJudgeActorIntent['actorClass'];
  dispatchGroupId: string;
  enforcement: 'codex_permission_profile' | 'claude_tool_free_inline_evidence';
  snapshotHash: string;
  peerOutputMaterialization: 'none';
  controlPlaneMaterialization: 'memory_only';
  transportPathsExposed: false;
  policyHash: string;
  isolationReceiptHash: string;
};

export function computeMainAgentExecutionActorIsolationPolicyHash(
  enforcement: MainAgentExecutionActorIsolationReceipt['enforcement']
): string {
  return stableHash({
    enforcement,
    readableScope:
      enforcement === 'codex_permission_profile'
        ? 'snapshot_workspace_root'
        : 'inline_evidence_only',
    peerOutputMaterialization: 'none',
    controlPlaneMaterialization: 'memory_only',
    transportPathsExposed: false,
  });
}

export type MainAgentExecutionReviewerResult = {
  sourceLedgerHash: string;
  actorIsolationReceipt: MainAgentExecutionActorIsolationReceipt;
  terminalOutcome: 'clean' | 'findings' | 'blocked';
  findingIds?: string[];
};

export type MainAgentExecutionFinalJudgeProducedResult = {
  sourceLedgerHash: string;
  actorIsolationReceipt: MainAgentExecutionActorIsolationReceipt;
  auditDecision: 'pass' | 'fail';
  verdict: 'coverage_satisfied' | 'findings_present' | 'insufficient_evidence' | 'blocked';
  findingIds?: string[];
  coveredDimensionIds?: string[];
  coveredArtifactIds?: string[];
  coveredObligationIds?: string[];
  coveredExecutionResultIds?: string[];
  coveredCommandIds?: string[];
  coveredEvidenceIds?: string[];
  coveredDeliveryClaimIds?: string[];
  findings?: ExecutionFinalFinding[];
};

type ExecutionFinalCandidateCoverage = {
  schemaVersion: 'ExecutionFinalCandidate/v1';
  profile: 'requirements_backed' | 'standalone';
  requiredDimensionIds: string[];
  requiredArtifactIds: string[];
  requiredObligationIds: string[];
  requiredExecutionResultIds: string[];
  requiredCommandIds: string[];
  requiredEvidenceIds: string[];
  requiredDeliveryClaimIds: string[];
};

export type ExecutionFinalFinding = {
  findingId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  dimensionId: string;
  subjectKind:
    | 'dimension'
    | 'artifact'
    | 'obligation'
    | 'execution_result'
    | 'command'
    | 'evidence'
    | 'delivery_claim';
  subjectId: string;
  evidenceRefs: string[];
  issueCode: string;
  remediationOwner:
    | 'requirements_successor'
    | 'architecture_successor'
    | 'readiness_recheck'
    | 'execution_authority'
    | 'campaign_closure'
    | 'delivery_claim';
};

export type MainAgentExecutionFinalJudgeNotProducedResult = {
  auditDecision: 'not_produced';
  sourceErrorCode: string;
};

export type MainAgentExecutionFinalJudgeResult =
  | MainAgentExecutionFinalJudgeProducedResult
  | MainAgentExecutionFinalJudgeNotProducedResult;

export class MainAgentExecutionFinalJudgeCampaignError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MainAgentExecutionFinalJudgeCampaignError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new MainAgentExecutionFinalJudgeCampaignError(code);
}

type ExecutionFinalHashRef = { path: string; hash: string };

export type ExecutionFinalAcceptedResult = {
  schemaVersion: 'ExecutionFinalAcceptedResult/v1';
  executionFinalCandidateHash: string;
  candidateRef: ExecutionFinalHashRef;
  requestRef: ExecutionFinalHashRef;
  responseRef: ExecutionFinalHashRef;
  aggregateRef: ExecutionFinalHashRef;
  campaignClosureHash: string;
  decision: 'pass' | 'fail';
  coverageDisposition: 'coverage_satisfied' | 'coverage_incomplete';
};

function requireSha256(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    fail(code);
  }
  return value;
}

function requireAcceptedRef(value: ExecutionFinalHashRef | undefined): ExecutionFinalHashRef {
  if (
    !value ||
    typeof value.path !== 'string' ||
    value.path.length === 0 ||
    value.path.includes('\\') ||
    path.posix.isAbsolute(value.path) ||
    path.win32.isAbsolute(value.path) ||
    value.path.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('execution_final_accepted_result_invalid');
  }
  return {
    path: value.path,
    hash: requireSha256(value.hash, 'execution_final_accepted_result_invalid'),
  };
}

function acceptedResultBytesHash(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function publishExecutionFinalAcceptedResult(input: {
  projectRoot: string;
  artifactRoot?: string;
  executionFinalCandidateHash: string;
  candidateRef: ExecutionFinalHashRef;
  requestRef: ExecutionFinalHashRef;
  responseRef: ExecutionFinalHashRef;
  aggregateRef: ExecutionFinalHashRef;
  campaignClosureHash: string;
  decision: 'pass' | 'fail';
  coverageDisposition: 'coverage_satisfied' | 'coverage_incomplete';
}): {
  acceptedResult: ExecutionFinalAcceptedResult;
  path: string;
  hash: string;
  reused: boolean;
} {
  const executionFinalCandidateHash = requireSha256(
    input.executionFinalCandidateHash,
    'execution_final_accepted_result_invalid'
  );
  const candidateRef = requireAcceptedRef(input.candidateRef);
  const requestRef = requireAcceptedRef(input.requestRef);
  const responseRef = requireAcceptedRef(input.responseRef);
  const aggregateRef = requireAcceptedRef(input.aggregateRef);
  const campaignClosureHash = requireSha256(
    input.campaignClosureHash,
    'execution_final_accepted_result_invalid'
  );
  if (
    candidateRef.hash !== executionFinalCandidateHash ||
    !['pass', 'fail'].includes(input.decision) ||
    !['coverage_satisfied', 'coverage_incomplete'].includes(input.coverageDisposition) ||
    (input.decision === 'pass' && input.coverageDisposition !== 'coverage_satisfied')
  ) {
    fail('execution_final_accepted_result_invalid');
  }
  const acceptedResult: ExecutionFinalAcceptedResult = Object.freeze({
    schemaVersion: 'ExecutionFinalAcceptedResult/v1',
    executionFinalCandidateHash,
    candidateRef,
    requestRef,
    responseRef,
    aggregateRef,
    campaignClosureHash,
    decision: input.decision,
    coverageDisposition: input.coverageDisposition,
  });
  const hex = executionFinalCandidateHash.slice('sha256:'.length);
  const artifactRoot = input.artifactRoot ?? '';
  if (
    artifactRoot &&
    (artifactRoot.includes('\\') ||
      path.posix.isAbsolute(artifactRoot) ||
      path.win32.isAbsolute(artifactRoot) ||
      artifactRoot.split('/').some((segment) => !segment || segment === '.' || segment === '..'))
  ) {
    fail('execution_final_accepted_result_invalid');
  }
  const relativePath = `${artifactRoot ? `${artifactRoot}/` : ''}accepted/sha256-${hex}.json`;
  const targetPath = path.resolve(input.projectRoot, ...relativePath.split('/'));
  const bytes = canonicalGoalExecutionBytes(acceptedResult);
  const reused = fs.existsSync(targetPath);
  try {
    publishGoalExecutionImmutableArtifact({
      projectRoot: input.projectRoot,
      outRoot: input.projectRoot,
      targetPath,
      bytes,
      hash: acceptedResultBytesHash(bytes),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'goal_execution_immutable_artifact_conflict') {
      fail('execution_final_accepted_result_conflict');
    }
    fail('execution_final_accepted_result_invalid');
  }
  const publishedBytes = fs.readFileSync(targetPath);
  let published: unknown;
  try {
    published = JSON.parse(publishedBytes.toString('utf8'));
  } catch {
    fail('execution_final_accepted_result_invalid');
  }
  if (
    !published ||
    typeof published !== 'object' ||
    Array.isArray(published) ||
    (published as Record<string, unknown>).executionFinalCandidateHash !==
      executionFinalCandidateHash
  ) {
    fail('execution_final_accepted_result_invalid');
  }
  return Object.freeze({
    acceptedResult,
    path: relativePath,
    hash: acceptedResultBytesHash(publishedBytes),
    reused,
  });
}

export function compileExecutionFinalJudgeEffectivePass(input: {
  acceptedResult: ExecutionFinalAcceptedResult;
  aggregateHash: string;
  campaignClosureHash: string;
  [key: string]: unknown;
}) {
  const acceptedResult = input.acceptedResult;
  const aggregateHash = requireSha256(
    input.aggregateHash,
    'execution_final_effective_pass_invalid'
  );
  const campaignClosureHash = requireSha256(
    input.campaignClosureHash,
    'execution_final_effective_pass_invalid'
  );
  if (
    acceptedResult?.schemaVersion !== 'ExecutionFinalAcceptedResult/v1' ||
    requireSha256(
      acceptedResult.executionFinalCandidateHash,
      'execution_final_effective_pass_invalid'
    ) !== acceptedResult.candidateRef?.hash ||
    acceptedResult.aggregateRef?.hash !== aggregateHash ||
    acceptedResult.campaignClosureHash !== campaignClosureHash ||
    acceptedResult.decision !== 'pass' ||
    acceptedResult.coverageDisposition !== 'coverage_satisfied'
  ) {
    fail('execution_final_effective_pass_decision_mismatch');
  }
  const payload = {
    schemaVersion: 'main-agent-execution-final-judge-effective-pass-receipt/v1' as const,
    effectivePass: true as const,
    executionFinalCandidateHash: acceptedResult.executionFinalCandidateHash,
    aggregateHash,
    campaignClosureHash,
    decision: 'pass' as const,
  };
  return Object.freeze({ ...payload, effectivePassReceiptHash: stableHash(payload) });
}

function campaignBlindInput(input: MainAgentExecutionFinalJudgeCampaignInput) {
  return {
    campaignId: input.campaignId,
    campaignLineageKey: input.campaignLineageKey,
    closureReceiptHash: input.closureReceiptHash,
    candidateBytesHash: input.candidateBytesHash,
    currentImplementationHash: input.currentImplementationHash,
    currentEvidenceHash: input.currentEvidenceHash,
    initialReviewAttemptKey: input.initialReviewAttemptKey,
    ...(input.executionFinalCandidate
      ? { executionFinalCandidate: input.executionFinalCandidate }
      : {}),
  };
}

function actorIntent(
  actorClass: MainAgentExecutionFinalJudgeActorIntent['actorClass'],
  dispatchGroupId: string,
  blindInput: Record<string, unknown>
): MainAgentExecutionFinalJudgeActorIntent {
  const payload = {
    actorClass,
    dispatchMode: 'parallel' as const,
    invocationMode: 'native' as const,
    dispatchGroupId,
    preparedBeforeDispatch: true as const,
    blindInput,
  };
  return {
    ...payload,
    blindInputHash: stableHash(blindInput),
    invocationIntentHash: stableHash(payload),
  };
}

function actorReceipt(
  intent: MainAgentExecutionFinalJudgeActorIntent,
  result: Pick<
    MainAgentExecutionReviewerResult,
    'sourceLedgerHash' | 'actorIsolationReceipt' | 'findingIds'
  >,
  terminalOutcome: MainAgentExecutionReviewerResult['terminalOutcome']
) {
  if (!/^sha256:[0-9a-f]{64}$/u.test(result.sourceLedgerHash)) {
    fail('main_agent_execution_final_judge_actor_receipt_invalid');
  }
  const isolation = validateMainAgentExecutionActorIsolationReceipt(
    intent,
    result.actorIsolationReceipt
  );
  const payload = {
    actorClass: intent.actorClass,
    dispatchGroupId: intent.dispatchGroupId,
    invocationMode: 'native' as const,
    startedAfterBothIntentsPrepared: true as const,
    blindInputHash: intent.blindInputHash,
    invocationIntentHash: intent.invocationIntentHash,
    sourceLedgerHash: result.sourceLedgerHash,
    actorIsolationReceipt: isolation,
    actorIsolationReceiptHash: isolation.isolationReceiptHash,
    terminalOutcome,
    findingIds: uniqueSorted(result.findingIds ?? []),
  };
  return { ...payload, actorReceiptHash: stableHash(payload) };
}

export function validateMainAgentExecutionActorIsolationReceipt(
  intent: MainAgentExecutionFinalJudgeActorIntent,
  value: unknown
): MainAgentExecutionActorIsolationReceipt {
  const isolation = isRecord(value)
    ? (value as unknown as MainAgentExecutionActorIsolationReceipt)
    : null;
  const isolationPayload = {
    schemaVersion: isolation?.schemaVersion,
    actorClass: isolation?.actorClass,
    dispatchGroupId: isolation?.dispatchGroupId,
    enforcement: isolation?.enforcement,
    snapshotHash: isolation?.snapshotHash,
    peerOutputMaterialization: isolation?.peerOutputMaterialization,
    controlPlaneMaterialization: isolation?.controlPlaneMaterialization,
    transportPathsExposed: isolation?.transportPathsExposed,
    policyHash: isolation?.policyHash,
  };
  if (
    !isolation ||
    Object.keys(isolation).sort().join('\u0000') !==
      [...Object.keys(isolationPayload), 'isolationReceiptHash'].sort().join('\u0000') ||
    isolation.schemaVersion !== 'GoalFinalizationActorIsolationReceipt/v1' ||
    isolation.actorClass !== intent.actorClass ||
    isolation.dispatchGroupId !== intent.dispatchGroupId ||
    !['codex_permission_profile', 'claude_tool_free_inline_evidence'].includes(
      isolation.enforcement
    ) ||
    isolation.peerOutputMaterialization !== 'none' ||
    isolation.controlPlaneMaterialization !== 'memory_only' ||
    isolation.transportPathsExposed !== false ||
    !/^sha256:[0-9a-f]{64}$/u.test(isolation.snapshotHash) ||
    !/^sha256:[0-9a-f]{64}$/u.test(isolation.policyHash) ||
    isolation.policyHash !==
      computeMainAgentExecutionActorIsolationPolicyHash(isolation.enforcement) ||
    isolation.isolationReceiptHash !== stableHash(isolationPayload)
  ) {
    fail('main_agent_execution_final_judge_actor_isolation_invalid');
  }
  return isolation;
}

function finalJudgeTerminalOutcome(
  verdict: MainAgentExecutionFinalJudgeProducedResult['verdict']
): MainAgentExecutionReviewerResult['terminalOutcome'] {
  if (verdict === 'coverage_satisfied') return 'clean';
  if (verdict === 'findings_present') return 'findings';
  return 'blocked';
}

const COVERAGE_KEYS = Object.freeze([
  ['requiredDimensionIds', 'coveredDimensionIds'],
  ['requiredArtifactIds', 'coveredArtifactIds'],
  ['requiredObligationIds', 'coveredObligationIds'],
  ['requiredExecutionResultIds', 'coveredExecutionResultIds'],
  ['requiredCommandIds', 'coveredCommandIds'],
  ['requiredEvidenceIds', 'coveredEvidenceIds'],
  ['requiredDeliveryClaimIds', 'coveredDeliveryClaimIds'],
] as const);

const SUBJECT_SET_KEYS = Object.freeze({
  dimension: 'requiredDimensionIds',
  artifact: 'requiredArtifactIds',
  obligation: 'requiredObligationIds',
  execution_result: 'requiredExecutionResultIds',
  command: 'requiredCommandIds',
  evidence: 'requiredEvidenceIds',
  delivery_claim: 'requiredDeliveryClaimIds',
} as const);

const REMEDIATION_OWNERS = new Set<ExecutionFinalFinding['remediationOwner']>([
  'requirements_successor',
  'architecture_successor',
  'readiness_recheck',
  'execution_authority',
  'campaign_closure',
  'delivery_claim',
]);

function exactStringSet(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (
    !left.every((value) => typeof value === 'string' && value.length > 0) ||
    !right.every((value) => typeof value === 'string' && value.length > 0) ||
    new Set(left).size !== left.length ||
    new Set(right).size !== right.length
  ) {
    return false;
  }
  return uniqueSorted(left).join('\n') === uniqueSorted(right).join('\n');
}

function coverageIsExact(
  candidate: ExecutionFinalCandidateCoverage,
  finalJudge: MainAgentExecutionFinalJudgeProducedResult
): boolean {
  return COVERAGE_KEYS.every(([requiredKey, coveredKey]) =>
    exactStringSet(candidate[requiredKey], finalJudge[coveredKey])
  );
}

function findingOwnerIsConsistent(
  candidate: ExecutionFinalCandidateCoverage,
  finding: ExecutionFinalFinding
): boolean {
  if (finding.subjectKind === 'delivery_claim') {
    return finding.remediationOwner === 'delivery_claim';
  }
  if (candidate.profile === 'standalone') {
    return !['requirements_successor', 'architecture_successor', 'readiness_recheck'].includes(
      finding.remediationOwner
    );
  }
  const dimensionOwner = {
    requirement_confirmation: 'requirements_successor',
    architecture_confirmation: 'architecture_successor',
    implementation_readiness: 'readiness_recheck',
    delivery_confirmation: 'delivery_claim',
  } as const;
  const requiredOwner = dimensionOwner[finding.dimensionId as keyof typeof dimensionOwner];
  return requiredOwner ? finding.remediationOwner === requiredOwner : true;
}

function findingsAreValid(
  candidate: ExecutionFinalCandidateCoverage,
  finalJudge: MainAgentExecutionFinalJudgeProducedResult
): boolean {
  const findings = finalJudge.findings;
  if (!Array.isArray(findings)) return false;
  if (
    !exactStringSet(
      finalJudge.findingIds ?? [],
      findings.map((finding) => finding.findingId)
    )
  ) {
    return false;
  }
  const evidenceIds = new Set(candidate.requiredEvidenceIds);
  return findings.every((finding) => {
    const subjectSetKey = SUBJECT_SET_KEYS[finding.subjectKind];
    const subjectIds = subjectSetKey ? candidate[subjectSetKey] : [];
    return (
      typeof finding.findingId === 'string' &&
      finding.findingId.length > 0 &&
      ['critical', 'high', 'medium', 'low'].includes(finding.severity) &&
      candidate.requiredDimensionIds.includes(finding.dimensionId) &&
      subjectIds.includes(finding.subjectId) &&
      Array.isArray(finding.evidenceRefs) &&
      new Set(finding.evidenceRefs).size === finding.evidenceRefs.length &&
      finding.evidenceRefs.every((evidenceRef) => evidenceIds.has(evidenceRef)) &&
      typeof finding.issueCode === 'string' &&
      finding.issueCode.length > 0 &&
      REMEDIATION_OWNERS.has(finding.remediationOwner) &&
      findingOwnerIsConsistent(candidate, finding)
    );
  });
}

export function mergeMainAgentExecutionFinalJudgeCampaign(input: {
  candidate?: ExecutionFinalCandidateCoverage;
  reviewer: MainAgentExecutionReviewerResult;
  finalJudge: MainAgentExecutionFinalJudgeResult;
}): {
  status: 'not_produced' | 'blocked' | 'remediation_required' | 'effective_pass_ready';
} {
  if (input.finalJudge.auditDecision === 'not_produced') return { status: 'not_produced' };
  if (
    input.candidate &&
    (!coverageIsExact(input.candidate, input.finalJudge) ||
      !findingsAreValid(input.candidate, input.finalJudge))
  ) {
    return { status: 'blocked' };
  }
  if (
    input.reviewer.terminalOutcome === 'blocked' ||
    input.finalJudge.verdict === 'insufficient_evidence' ||
    input.finalJudge.verdict === 'blocked'
  ) {
    return { status: 'blocked' };
  }
  if (
    input.reviewer.terminalOutcome === 'findings' ||
    input.finalJudge.verdict === 'findings_present'
  ) {
    return { status: 'remediation_required' };
  }
  if (
    input.reviewer.terminalOutcome === 'clean' &&
    input.finalJudge.verdict === 'coverage_satisfied'
  ) {
    return { status: 'effective_pass_ready' };
  }
  return { status: 'blocked' };
}

function compileExecutionFinalJudgeAggregate(input: {
  campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
  intents: MainAgentExecutionFinalJudgeActorIntent[];
  receipts: ReturnType<typeof actorReceipt>[];
  decision: 'pass' | 'fail';
}) {
  const blindInput = campaignBlindInput(input.campaignInput);
  const actorBindingPayload = {
    reviewerActorClass: input.campaignInput.reviewerActorClass,
    finalJudgeActorClass: input.campaignInput.finalJudgeActorClass,
    providerRef: input.campaignInput.providerRef,
  };
  if (input.campaignInput.actorBindingHash !== stableHash(actorBindingPayload)) {
    fail('main_agent_execution_final_judge_campaign_input_invalid');
  }
  const actorClasses = input.receipts.map((receipt) => receipt.actorClass);
  if (
    input.intents.length !== 2 ||
    input.receipts.length !== 2 ||
    new Set(actorClasses).size !== 2 ||
    !actorClasses.includes('bounded_code_reviewer') ||
    !actorClasses.includes('final_acceptance_judge')
  ) {
    fail('main_agent_execution_final_judge_actor_count_invalid');
  }
  const sortedReceipts = [...input.receipts].sort((left, right) =>
    left.actorClass.localeCompare(right.actorClass)
  );
  const payload = {
    schemaVersion: 'main-agent-execution-final-judge-aggregate/v1' as const,
    ...blindInput,
    campaignInputHash: input.campaignInput.inputHash,
    campaignClosureHash: input.campaignInput.closureReceiptHash,
    ...(input.campaignInput.executionFinalCandidate
      ? {
          executionFinalCandidateHash:
            input.campaignInput.executionFinalCandidate.executionFinalCandidateHash,
        }
      : {}),
    reviewerActorClass: input.campaignInput.reviewerActorClass,
    finalJudgeActorClass: input.campaignInput.finalJudgeActorClass,
    providerRef: input.campaignInput.providerRef,
    actorBindingHash: input.campaignInput.actorBindingHash,
    actorReceipts: sortedReceipts,
    blindnessProof: {
      identicalBlindInputHash: stableHash(blindInput),
      preparedIntentHashes: uniqueSorted(
        input.intents.map((intent) => intent.invocationIntentHash)
      ),
      actorIsolationReceiptHashes: uniqueSorted(
        sortedReceipts.map((receipt) => receipt.actorIsolationReceiptHash)
      ),
      peerOutputMaterialization: 'none' as const,
    },
    invocationCountReceipt: {
      reviewerCalls: 1 as const,
      finalJudgeCalls: 1 as const,
      semanticInvocationCount: 2 as const,
    },
    sourceLedgerHashes: uniqueSorted(sortedReceipts.map((receipt) => receipt.sourceLedgerHash)),
    decision: input.decision,
  };
  return { ...payload, aggregateHash: stableHash(payload) };
}

export function validateMainAgentExecutionFinalJudgeCampaignArtifacts(input: {
  campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
  reviewer: MainAgentExecutionReviewerResult;
  finalJudge: MainAgentExecutionFinalJudgeResult;
  reviewerReceipt: unknown;
  finalJudgeReceipt: unknown;
  aggregate: unknown;
  finalJudgeIntent?: unknown;
}) {
  const campaignInput = validateMainAgentExecutionFinalJudgeCampaignInput(
    input.campaignInput,
    input.campaignInput
  );
  const candidate =
    campaignInput.executionFinalCandidate ??
    fail('main_agent_execution_final_judge_campaign_candidate_missing');
  if (
    input.finalJudge.auditDecision === 'not_produced' ||
    !isRecord(input.reviewerReceipt) ||
    !isRecord(input.finalJudgeReceipt) ||
    !isRecord(input.aggregate)
  ) {
    fail('main_agent_execution_final_judge_artifact_binding_invalid');
  }
  const blindInput = campaignBlindInput(campaignInput);
  const dispatchGroupId = stableHash({
    campaignInputHash: campaignInput.inputHash,
    initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
  });
  const reviewerIntent = actorIntent('bounded_code_reviewer', dispatchGroupId, blindInput);
  const finalJudgeIntent = actorIntent('final_acceptance_judge', dispatchGroupId, blindInput);
  const reviewerReceipt = actorReceipt(
    reviewerIntent,
    input.reviewer,
    input.reviewer.terminalOutcome
  );
  const finalJudgeReceipt = actorReceipt(
    finalJudgeIntent,
    input.finalJudge,
    finalJudgeTerminalOutcome(input.finalJudge.verdict)
  );
  const merge = mergeMainAgentExecutionFinalJudgeCampaign({
    candidate,
    reviewer: input.reviewer,
    finalJudge: input.finalJudge,
  });
  const aggregate = compileExecutionFinalJudgeAggregate({
    campaignInput,
    intents: [reviewerIntent, finalJudgeIntent],
    receipts: [reviewerReceipt, finalJudgeReceipt],
    decision: merge.status === 'effective_pass_ready' ? 'pass' : 'fail',
  });
  if (
    stableHash(input.reviewerReceipt) !== stableHash(reviewerReceipt) ||
    stableHash(input.finalJudgeReceipt) !== stableHash(finalJudgeReceipt) ||
    stableHash(input.aggregate) !== stableHash(aggregate) ||
    (input.finalJudgeIntent !== undefined &&
      stableHash(input.finalJudgeIntent) !== stableHash(finalJudgeIntent))
  ) {
    fail('main_agent_execution_final_judge_artifact_binding_invalid');
  }
  return Object.freeze({
    merge,
    reviewerIntent,
    finalJudgeIntent,
    reviewerReceipt,
    finalJudgeReceipt,
    aggregate,
  });
}

export async function executeMainAgentExecutionFinalJudgeCampaign(
  input: {
    campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
    reusedFinalJudge?: {
      result: MainAgentExecutionFinalJudgeProducedResult;
      receipt: Record<string, unknown>;
    };
  },
  dependencies: {
    invokeReviewer: (
      intent: MainAgentExecutionFinalJudgeActorIntent
    ) => Promise<MainAgentExecutionReviewerResult>;
    invokeFinalJudge: (
      intent: MainAgentExecutionFinalJudgeActorIntent
    ) => Promise<MainAgentExecutionFinalJudgeResult>;
  }
) {
  const campaignInput = validateMainAgentExecutionFinalJudgeCampaignInput(
    input.campaignInput,
    input.campaignInput
  );
  const executionFinalCandidate =
    campaignInput.executionFinalCandidate ??
    fail('main_agent_execution_final_judge_campaign_candidate_missing');
  const blindInput = campaignBlindInput(campaignInput);
  const dispatchGroupId = stableHash({
    campaignInputHash: campaignInput.inputHash,
    initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
  });
  const reviewerIntent = actorIntent('bounded_code_reviewer', dispatchGroupId, blindInput);
  const finalJudgeIntent = actorIntent('final_acceptance_judge', dispatchGroupId, blindInput);
  const [reviewerOutcome, finalJudgeOutcome] = await Promise.allSettled([
    dependencies.invokeReviewer(reviewerIntent),
    input.reusedFinalJudge
      ? Promise.resolve(input.reusedFinalJudge.result)
      : dependencies.invokeFinalJudge(finalJudgeIntent),
  ]);
  const finalJudgeReused = input.reusedFinalJudge !== undefined;
  const reusableFinalJudgeReceipt = (finalJudge: MainAgentExecutionFinalJudgeProducedResult) => {
    const expected = actorReceipt(
      finalJudgeIntent,
      finalJudge,
      finalJudgeTerminalOutcome(finalJudge.verdict)
    );
    if (
      input.reusedFinalJudge &&
      stableHash(input.reusedFinalJudge.receipt) !== stableHash(expected)
    ) {
      fail('main_agent_execution_final_judge_campaign_stale');
    }
    return expected;
  };
  if (reviewerOutcome.status === 'rejected') {
    const finalJudge = finalJudgeOutcome.status === 'fulfilled' ? finalJudgeOutcome.value : null;
    const finalJudgeReceipt =
      finalJudge && finalJudge.auditDecision !== 'not_produced'
        ? reusableFinalJudgeReceipt(finalJudge)
        : null;
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'bounded_code_reviewer' as const,
      sourceError: reviewerOutcome.reason,
      reviewer: null,
      finalJudge,
      reviewerReceipt: null,
      finalJudgeReceipt,
      reviewerIntent,
      finalJudgeIntent,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const reviewer = reviewerOutcome.value;
  if (finalJudgeOutcome.status === 'rejected') {
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'final_acceptance_judge' as const,
      sourceError: finalJudgeOutcome.reason,
      reviewer,
      finalJudge: null,
      reviewerReceipt: actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome),
      finalJudgeReceipt: null,
      reviewerIntent,
      finalJudgeIntent,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const finalJudge = finalJudgeOutcome.value;
  if (finalJudge.auditDecision === 'not_produced') {
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'final_acceptance_judge' as const,
      sourceError: finalJudge.sourceErrorCode,
      reviewer,
      finalJudge,
      reviewerReceipt: actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome),
      finalJudgeReceipt: null,
      reviewerIntent,
      finalJudgeIntent,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const merge = mergeMainAgentExecutionFinalJudgeCampaign({
    candidate: executionFinalCandidate,
    reviewer,
    finalJudge,
  });
  const reviewerReceipt = actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome);
  const finalJudgeReceipt = reusableFinalJudgeReceipt(finalJudge);
  const aggregate = compileExecutionFinalJudgeAggregate({
    campaignInput,
    intents: [reviewerIntent, finalJudgeIntent],
    receipts: [reviewerReceipt, finalJudgeReceipt],
    decision: merge.status === 'effective_pass_ready' ? 'pass' : 'fail',
  });
  const campaignArtifacts = validateMainAgentExecutionFinalJudgeCampaignArtifacts({
    campaignInput,
    reviewer,
    finalJudge,
    reviewerReceipt,
    finalJudgeReceipt,
    aggregate,
    finalJudgeIntent,
  });
  if (campaignArtifacts.merge.status !== 'effective_pass_ready') {
    return Object.freeze({
      status: campaignArtifacts.merge.status,
      reviewer,
      finalJudge,
      reviewerReceipt: campaignArtifacts.reviewerReceipt,
      finalJudgeReceipt: campaignArtifacts.finalJudgeReceipt,
      reviewerIntent: campaignArtifacts.reviewerIntent,
      finalJudgeIntent: campaignArtifacts.finalJudgeIntent,
      aggregate: campaignArtifacts.aggregate,
      effectivePassReceipt: null,
      finalJudgeReused,
    });
  }
  return Object.freeze({
    status: campaignArtifacts.merge.status,
    reviewer,
    finalJudge,
    reviewerReceipt: campaignArtifacts.reviewerReceipt,
    finalJudgeReceipt: campaignArtifacts.finalJudgeReceipt,
    reviewerIntent: campaignArtifacts.reviewerIntent,
    finalJudgeIntent: campaignArtifacts.finalJudgeIntent,
    aggregate: campaignArtifacts.aggregate,
    effectivePassReceipt: null,
    finalJudgeReused,
  });
}
