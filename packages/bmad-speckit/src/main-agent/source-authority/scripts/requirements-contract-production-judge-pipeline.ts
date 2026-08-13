import * as fs from 'node:fs';
import * as path from 'node:path';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import { invokeRequirementsContractJudgeWithRecovery } from './requirements-contract-judge-capability-resolver';
import {
  applyRequirementsContractJudgeLifecycleEvent,
  advanceRequirementsContractJudgeActiveRequest,
  compareAndSwapRequirementsContractJudgeActiveRequest,
  createRequirementsContractJudgeActiveRequest,
  type RequirementsContractJudgeActiveRequest,
  validateRequirementsContractJudgeActiveRequest,
  validateRequirementsContractJudgeResponse,
} from './requirements-contract-judge-lifecycle';
import { buildRequirementsContractJudgeRequest } from './requirements-contract-judge-request-identity';
import { createRequirementsContractJudgeSelectionReceipt } from './requirements-contract-judge-selection';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';
import { requirementsContractJudgeRunFrozenRequest } from './requirements-contract-judge-command';
import type { PreparedRequirementsContractJudgeInvocation } from './requirements-contract-judge-invocation';
import { compileRequirementsAuditAggregateV2 } from './requirements-contract-requirements-audit-aggregate';
import { compileRequirementsEffectivePassReceiptV2 } from './requirements-contract-requirements-effective-pass-gate';
import { compileRequirementsContractRemediationPlan } from './requirements-contract-remediation-delta-finalizer';

type JsonRecord = Record<string, unknown>;
type JudgeInvocation = Awaited<ReturnType<typeof invokeRequirementsContractJudgeWithRecovery>>;
type ReplayedJudgeInvocation = {
  state: 'response_received';
  acceptedEvaluation: true;
  response: unknown;
  capacity: {
    actual: {
      requestSerializedBytes: unknown;
      auditPacketSerializedBytes: unknown;
    };
  };
};

function artifactManifest(buildManifest: JsonRecord, auditPacket: JsonRecord) {
  const body = auditPacket.body as JsonRecord;
  const entries = Array.isArray(buildManifest.artifactEntries) ? buildManifest.artifactEntries : [];
  const byId = new Map(entries.map((entry: JsonRecord) => [entry.artifactId, entry]));
  return (body.artifactIds as string[]).map((artifactId) => {
    const entry = byId.get(artifactId) as JsonRecord | undefined;
    return (
      entry ?? { artifactId, role: artifactId, artifactHash: sha256(canonicalJson(artifactId)) }
    );
  });
}

function publish(recordRoot: string, relativePath: string, value: unknown, enabled: boolean) {
  if (!enabled) return;
  atomicNoClobberPublish({
    targetPath: path.join(recordRoot, ...relativePath.split('/')),
    value,
    role: path.basename(relativePath, '.json'),
  });
}

function hashPathSegment(hash: string): string {
  if (!/^sha256:[a-f0-9]{64}$/u.test(hash))
    throw new Error('requirements_contract_hash_path_invalid');
  return hash.replace(':', '-');
}

function readRecordArtifact(recordRoot: string, relativePath: string): JsonRecord {
  const root = path.resolve(recordRoot);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_contract_judge_artifact_path_escape');
  }
  const value = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('requirements_contract_judge_artifact_invalid');
  }
  return value;
}

function maximumAttempts(provider: JsonRecord): number {
  const policy = provider.requestPolicy as JsonRecord | undefined;
  const configured = Number(policy?.maximumAttempts ?? 1);
  if (!Number.isSafeInteger(configured) || configured < 1) {
    throw new Error('requirements_contract_judge_maximum_attempts_invalid');
  }
  return configured;
}

function terminalResult(recordRoot: string, activeRequest: RequirementsContractJudgeActiveRequest) {
  if (!activeRequest.responseRef || !activeRequest.aggregateRef) {
    throw new Error('requirements_contract_judge_terminal_refs_missing');
  }
  const response = readRecordArtifact(recordRoot, activeRequest.responseRef.path);
  if (sha256(canonicalJson(response)) !== activeRequest.responseRef.hash) {
    throw new Error('requirements_contract_judge_response_readback_mismatch');
  }
  const aggregate = readRecordArtifact(recordRoot, activeRequest.aggregateRef.path);
  if (aggregate.requirementsAuditAggregateHash !== activeRequest.aggregateRef.hash) {
    throw new Error('requirements_contract_judge_aggregate_readback_mismatch');
  }
  const request = readRecordArtifact(recordRoot, activeRequest.requestPath);
  if (request.judgeRequestHash !== activeRequest.judgeRequestHash) {
    throw new Error('requirements_contract_judge_request_readback_mismatch');
  }
  if (activeRequest.status === 'audited_pass') {
    if (!activeRequest.effectivePassRef) {
      throw new Error('requirements_contract_judge_effective_pass_ref_missing');
    }
    const effectivePass = readRecordArtifact(recordRoot, activeRequest.effectivePassRef.path);
    if (effectivePass.requirementsEffectivePassHash !== activeRequest.effectivePassRef.hash) {
      throw new Error('requirements_contract_judge_effective_pass_readback_mismatch');
    }
    return {
      status: 'audited_pass' as const,
      request,
      response,
      aggregate,
      effectivePass,
      activeRequest,
    };
  }
  if (!activeRequest.remediationPlanRef) {
    throw new Error('requirements_contract_judge_remediation_plan_ref_missing');
  }
  const remediationPlan = readRecordArtifact(recordRoot, activeRequest.remediationPlanRef.path);
  if (remediationPlan.remediationPlanHash !== activeRequest.remediationPlanRef.hash) {
    throw new Error('requirements_contract_judge_remediation_plan_readback_mismatch');
  }
  return {
    status: remediationPlan.state,
    request,
    response,
    aggregate,
    remediationPlan,
    activeRequest,
  };
}

export async function runRequirementsContractProductionJudgePipeline(input: {
  authoringRequestId: string;
  recordRoot: string;
  activeAuthority: JsonRecord;
  buildManifest: JsonRecord;
  auditPacket: JsonRecord;
  judgePrompt: {
    systemPrompt: string;
    rubric: JsonRecord;
    structuredOutputSchema: JsonRecord;
    outputTokenReserve: number;
  };
  providerSelection: {
    providerRef: string;
    provider: JsonRecord;
    adapterRef: string;
    providerRegistryHash: string;
  };
  preparedInvocation: PreparedRequirementsContractJudgeInvocation;
  remediation?: {
    remediatesRequestHash: string;
    remediationAggregateHash: string;
    remediationDeltaHash: string;
  } | null;
  persist?: boolean;
}) {
  const persist = input.persist !== false;
  const selection = createRequirementsContractJudgeSelectionReceipt(input.providerSelection);
  const selectionPath = `quality/selections/${hashPathSegment(selection.providerSelectionHash)}/provider-selection-receipt.json`;
  const request = buildRequirementsContractJudgeRequest({
    authority: input.activeAuthority,
    providerSelection: selection,
    prompt: input.judgePrompt,
    auditPacket: input.auditPacket,
    auditPacketArtifactManifest: artifactManifest(input.buildManifest, input.auditPacket),
    remediation: input.remediation ?? null,
  });
  const requestDirectory = `quality/requests/${hashPathSegment(request.judgeRequestHash)}`;
  const requestPath = `${requestDirectory}/judge-request.json`;
  const auditPolicyHash = sha256(
    canonicalJson({ prompt: request.prompt, responseSchema: request.prompt.structuredOutputSchema })
  );
  const activeRequestPath = path.join(input.recordRoot, 'quality', 'active-request.json');
  const currentActiveRequest =
    persist && fs.existsSync(activeRequestPath)
      ? (JSON.parse(
          fs.readFileSync(activeRequestPath, 'utf8')
        ) as RequirementsContractJudgeActiveRequest)
      : null;
  if (currentActiveRequest) {
    validateRequirementsContractJudgeActiveRequest(currentActiveRequest);
    if (currentActiveRequest.acceptedEvaluation) {
      if (!input.remediation) {
        if (
          currentActiveRequest.semanticRevisionId !==
            input.activeAuthority.activeSemanticRevisionId ||
          currentActiveRequest.auditPolicyHash !== auditPolicyHash
        ) {
          throw new Error('requirements_contract_judge_terminal_policy_mismatch');
        }
        return terminalResult(input.recordRoot, currentActiveRequest);
      }
      if (
        currentActiveRequest.status !== 'audited_fail' ||
        currentActiveRequest.judgeRequestHash !== input.remediation.remediatesRequestHash ||
        currentActiveRequest.aggregateRef?.hash !== input.remediation.remediationAggregateHash ||
        currentActiveRequest.remediationDeltaRef?.hash !== input.remediation.remediationDeltaHash ||
        !currentActiveRequest.remediationPlanRef
      ) {
        throw new Error('requirements_contract_judge_successor_lineage_invalid');
      }
      if (request.judgeRequestHash === currentActiveRequest.judgeRequestHash) {
        throw new Error('judge_remediation_no_progress');
      }
    }
    if (
      !currentActiveRequest.acceptedEvaluation &&
      (currentActiveRequest.judgeRequestHash !== request.judgeRequestHash ||
        currentActiveRequest.providerSelectionHash !== selection.providerSelectionHash ||
        currentActiveRequest.semanticRevisionId !==
          input.activeAuthority.activeSemanticRevisionId ||
        currentActiveRequest.auditPolicyHash !== auditPolicyHash ||
        currentActiveRequest.requestPath !== requestPath)
    ) {
      throw new Error('requirements_contract_judge_pending_request_mismatch');
    }
  }
  publish(input.recordRoot, selectionPath, selection, persist);
  publish(input.recordRoot, requestPath, request, persist);
  const successorPredecessor =
    currentActiveRequest?.acceptedEvaluation && input.remediation ? currentActiveRequest : null;
  let persistedActiveRequest = currentActiveRequest;
  let activeRequest = successorPredecessor
    ? createRequirementsContractJudgeActiveRequest({
        version: successorPredecessor.version + 1,
        previousVersion: successorPredecessor.version,
        semanticRevisionId: input.activeAuthority.activeSemanticRevisionId,
        auditPolicyHash,
        providerSelectionHash: selection.providerSelectionHash,
        judgeRequestHash: request.judgeRequestHash,
        requestPath,
      })
    : (currentActiveRequest ??
      createRequirementsContractJudgeActiveRequest({
        version: 1,
        previousVersion: null,
        semanticRevisionId: input.activeAuthority.activeSemanticRevisionId,
        auditPolicyHash,
        providerSelectionHash: selection.providerSelectionHash,
        judgeRequestHash: request.judgeRequestHash,
        requestPath,
      }));
  const persistTransition = (next: RequirementsContractJudgeActiveRequest) => {
    if (persist) {
      compareAndSwapRequirementsContractJudgeActiveRequest({
        recordRoot: input.recordRoot,
        expected: persistedActiveRequest,
        next,
      });
      persistedActiveRequest = next;
    }
    activeRequest = next;
  };
  const maxAttempts = maximumAttempts(input.providerSelection.provider);
  if (persist && (currentActiveRequest === null || successorPredecessor !== null)) {
    persistTransition(activeRequest);
  } else if (persist && ['audit_pending', 'retry_scheduled'].includes(activeRequest.status)) {
    if (activeRequest.attemptCount >= maxAttempts) {
      return {
        status: 'audit_pending' as const,
        issueCode: 'attempts_exhausted' as const,
        request,
        activeRequest,
      };
    }
    const scheduled = applyRequirementsContractJudgeLifecycleEvent(activeRequest, {
      type: 'dispatch_scheduled',
    });
    persistTransition(scheduled);
  }
  if (activeRequest.status !== 'dispatch_pending') {
    return {
      status: 'audit_pending' as const,
      issueCode: activeRequest.lastIssueCode ?? 'attempts_exhausted',
      request,
      activeRequest,
    };
  }
  const attemptOrdinal = activeRequest.attemptCount + 1;
  if (attemptOrdinal > maxAttempts) {
    return {
      status: 'audit_pending' as const,
      issueCode: 'attempts_exhausted',
      request,
      activeRequest,
    };
  }
  const attemptPath = `${requestDirectory}/dispatch-attempts/${attemptOrdinal}.json`;
  const existingAttempt =
    persist && fs.existsSync(path.join(input.recordRoot, ...attemptPath.split('/')))
      ? readRecordArtifact(input.recordRoot, attemptPath)
      : null;
  if (
    existingAttempt &&
    (existingAttempt.judgeRequestHash !== request.judgeRequestHash ||
      existingAttempt.providerSelectionHash !== selection.providerSelectionHash ||
      existingAttempt.attemptOrdinal !== attemptOrdinal)
  ) {
    throw new Error('requirements_contract_judge_attempt_identity_mismatch');
  }
  const replayedAttempt = existingAttempt?.outcome === 'response_received';
  if (existingAttempt && !replayedAttempt) {
    throw new Error('requirements_contract_judge_attempt_recovery_state_invalid');
  }
  const invocation: JudgeInvocation | ReplayedJudgeInvocation = replayedAttempt
    ? {
        state: 'response_received',
        acceptedEvaluation: true,
        response: existingAttempt.rawResponse,
        capacity: {
          actual: {
            requestSerializedBytes: existingAttempt.requestSerializedBytes,
            auditPacketSerializedBytes: existingAttempt.auditPacketSerializedBytes,
          },
        },
      }
    : await invokeRequirementsContractJudgeWithRecovery({
        request,
        provider: input.providerSelection.provider,
        attemptOrdinal,
        invoke: (frozenRequest) =>
          requirementsContractJudgeRunFrozenRequest({
            prepared: input.preparedInvocation,
            request: frozenRequest,
            providerSelection: selection,
            executionContext: {
              projectRoot: input.recordRoot,
              requestPath,
              outputDir: `${requestDirectory}/provider-output/${attemptOrdinal}`,
            },
          }),
      });
  const capacity = invocation.capacity ?? invocation;
  if (invocation.decision === 'capacity_blocked') {
    const next = advanceRequirementsContractJudgeActiveRequest(activeRequest, {
      status: 'audit_pending',
      lastIssueCode: invocation.issueCode,
    });
    persistTransition(next);
    return {
      status: 'audit_pending' as const,
      issueCode: invocation.issueCode,
      capacity,
      request,
      activeRequest,
    };
  }
  if (invocation.state === 'audit_pending') {
    const retryScheduled =
      attemptOrdinal < maxAttempts && invocation.issueCode !== 'judge_provider_payload_rejected';
    const attempt = {
      schemaVersion: 'requirements-contract-judge-attempt/v1',
      judgeRequestHash: request.judgeRequestHash,
      providerSelectionHash: selection.providerSelectionHash,
      attemptOrdinal,
      outcome: 'transport_failure',
      acceptedEvaluation: false,
      requestSerializedBytes: capacity.actual.requestSerializedBytes,
      auditPacketSerializedBytes: capacity.actual.auditPacketSerializedBytes,
      validationIssueCodes: [invocation.issueCode],
      nextEligibleAt: retryScheduled ? new Date().toISOString() : null,
      rawResponse: null,
    };
    publish(input.recordRoot, attemptPath, attempt, persist);
    const next = applyRequirementsContractJudgeLifecycleEvent(activeRequest, {
      type: 'transport_failed',
      attemptOrdinal,
      attemptPath,
      issueCode: invocation.issueCode,
      retryScheduled,
    });
    persistTransition(next);
    return {
      status: 'audit_pending' as const,
      issueCode: retryScheduled ? 'retry_scheduled' : invocation.issueCode,
      capacity,
      request,
      activeRequest,
    };
  }
  const rawResponse = invocation.response;
  const body = input.auditPacket.body as JsonRecord;
  let response;
  try {
    response = validateRequirementsContractJudgeResponse({
      response: rawResponse,
      judgeRequestHash: request.judgeRequestHash,
      requiredDimensionIds: body.mandatoryDimensionIds,
      requiredArtifactRefs: body.artifactIds,
      requiredMustRefs: body.requirementIds,
    });
  } catch (error) {
    const validationIssue =
      error instanceof Error
        ? error.message
        : 'requirements_contract_judge_response_validation_failed';
    const retryScheduled = attemptOrdinal < maxAttempts;
    const attempt = {
      schemaVersion: 'requirements-contract-judge-attempt/v1',
      judgeRequestHash: request.judgeRequestHash,
      providerSelectionHash: selection.providerSelectionHash,
      attemptOrdinal,
      outcome: 'response_validation_failure',
      acceptedEvaluation: false,
      requestSerializedBytes: capacity.actual.requestSerializedBytes,
      auditPacketSerializedBytes: capacity.actual.auditPacketSerializedBytes,
      validationIssueCodes: [validationIssue],
      nextEligibleAt: retryScheduled ? new Date().toISOString() : null,
      rawResponse,
    };
    publish(input.recordRoot, attemptPath, attempt, persist);
    const next = applyRequirementsContractJudgeLifecycleEvent(activeRequest, {
      type: 'response_rejected',
      attemptOrdinal,
      attemptPath,
      issueCode: retryScheduled
        ? 'requirements_contract_judge_response_validation_failed'
        : 'attempts_exhausted',
      retryScheduled,
    });
    persistTransition(next);
    return {
      status: 'audit_pending' as const,
      issueCode: retryScheduled
        ? 'requirements_contract_judge_response_validation_failed'
        : 'attempts_exhausted',
      capacity,
      request,
      activeRequest: next,
    };
  }
  const responseHash = sha256(canonicalJson(response));
  const attempt = {
    schemaVersion: 'requirements-contract-judge-attempt/v1',
    judgeRequestHash: request.judgeRequestHash,
    providerSelectionHash: selection.providerSelectionHash,
    attemptOrdinal,
    outcome: 'response_received',
    acceptedEvaluation: true,
    requestSerializedBytes: capacity.actual.requestSerializedBytes,
    auditPacketSerializedBytes: capacity.actual.auditPacketSerializedBytes,
    validationIssueCodes: [],
    nextEligibleAt: null,
    rawResponse: response,
  };
  if (!replayedAttempt) publish(input.recordRoot, attemptPath, attempt, persist);
  const responsePath = `${requestDirectory}/judge-response.json`;
  publish(input.recordRoot, responsePath, response, persist);
  const auditedRequest = applyRequirementsContractJudgeLifecycleEvent(activeRequest, {
    type: 'response_accepted',
    attemptOrdinal,
    attemptPath,
    responsePath,
    responseHash,
    verdict: response.verdict as 'pass' | 'fail',
  });
  const aggregate = compileRequirementsAuditAggregateV2({
    activeAuthority: input.activeAuthority,
    buildManifest: input.buildManifest,
    request,
    response,
  });
  const aggregatePath = `${requestDirectory}/requirements-audit-aggregate.json`;
  publish(input.recordRoot, aggregatePath, aggregate, persist);
  activeRequest = {
    ...auditedRequest,
    aggregateRef: { path: aggregatePath, hash: aggregate.requirementsAuditAggregateHash },
  };
  if (response.verdict === 'fail') {
    const remediationPlan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: request.judgeRequestHash,
      findings: aggregate.findings,
    });
    const remediationPlanPath = `${requestDirectory}/remediation-plan.json`;
    publish(input.recordRoot, remediationPlanPath, remediationPlan, persist);
    activeRequest = {
      ...activeRequest,
      remediationPlanRef: {
        path: remediationPlanPath,
        hash: remediationPlan.remediationPlanHash,
      },
    };
    persistTransition(activeRequest);
    return {
      status: remediationPlan.state,
      request,
      response,
      aggregate,
      remediationPlan,
      activeRequest,
      capacity,
    };
  }
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority: input.activeAuthority,
    aggregate,
  });
  const passPath = 'quality/requirements-effective-pass-receipt.json';
  publish(input.recordRoot, passPath, effectivePass, persist);
  activeRequest = {
    ...activeRequest,
    effectivePassRef: { path: passPath, hash: effectivePass.requirementsEffectivePassHash },
  };
  persistTransition(activeRequest);
  return {
    status: 'audited_pass' as const,
    request,
    response,
    aggregate,
    effectivePass,
    activeRequest,
    capacity,
  };
}
