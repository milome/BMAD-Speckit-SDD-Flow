import * as fs from 'node:fs';
import * as path from 'node:path';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import { assessRequirementsContractJudgeRequestCapacity, invokeRequirementsContractJudgeWithRecovery } from './requirements-contract-judge-capability-resolver';
import {
  applyRequirementsContractJudgeLifecycleEvent,
  advanceRequirementsContractJudgeActiveRequest,
  compareAndSwapRequirementsContractJudgeActiveRequest,
  createRequirementsContractJudgeActiveRequest,
  type RequirementsContractJudgeActiveRequest,
  validateRequirementsContractJudgeActiveRequest,
  validateRequirementsContractJudgeResponse,
} from './requirements-contract-judge-lifecycle';
import { buildRequirementsContractJudgeRequestV3 } from './requirements-contract-judge-request-identity';
import { createRequirementsContractJudgeSelectionReceipt } from './requirements-contract-judge-selection';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';
import { buildPreparedRequirementsContractJudgeInvocationPayload, type PreparedRequirementsContractJudgeInvocation } from './requirements-contract-judge-invocation';
import { canonicalRequirementsJson, requirementsContractDomainHash, sourceBytesHash } from './requirements-contract-hash-domains';
import { measureJudgePayload } from './requirements-contract-judge-payload-budget';
import { compileRequirementsAuditAggregateV2 } from './requirements-contract-requirements-audit-aggregate';
import { compileRequirementsEffectivePassReceiptV2 } from './requirements-contract-requirements-effective-pass-gate';
import { compileRequirementsContractRemediationPlan } from './requirements-contract-remediation-delta-finalizer';
import {
  publishRequirementsContractJudgeAuditPacketRef,
  hydrateRequirementsContractJudgeAuditPacket,
  resolveRequirementsContractJudgeAuditPacket,
  REQUIREMENTS_JUDGE_AUDIT_PACKET_PROTOCOL,
  REQUIREMENTS_JUDGE_AUDIT_PACKET_V3_PROTOCOL,
} from './requirements-contract-judge-audit-packet';
import { createRequirementsContractAuditBinding } from './requirements-contract-audit-binding';
import {
  publishRequirementsContractJudgeDecision,
  readVerifiedRequirementsContractJudgeDecision,
} from './requirements-contract-judge-decision-store';
import {
  validateRequirementsContractBuildManifest,
  validateRequirementsContractBuildManifestV2,
} from './requirements-contract-authoring-manifest';
import { validateRequirementsActiveAuthorityTuple } from './requirements-contract-authority-publication-committer';
import { resolveRequirementsAuthoringArtifact } from './requirements-contract-artifact-resolver';

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

export interface RequirementsContractProductionJudgePipelineInput {
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
}

export function prepareRequirementsContractProductionJudgeRequest(input: Pick<RequirementsContractProductionJudgePipelineInput,
  'recordRoot' | 'activeAuthority' | 'buildManifest' | 'auditPacket' | 'judgePrompt' | 'providerSelection' | 'remediation' | 'persist'>) {
  const authorityValidation = validateRequirementsActiveAuthorityTuple(input.activeAuthority);
  if (authorityValidation.decision === 'block') throw new Error(authorityValidation.issueCodes[0]);
  const durableBuild = input.buildManifest.schemaVersion === 'requirements-contract-build-manifest/v2';
  if (durableBuild) {
    if (!validateRequirementsContractBuildManifestV2(input.buildManifest)) {
      throw new Error('requirements_contract_judge_build_manifest_invalid');
    }
  } else if (input.buildManifest.schemaVersion === 'requirements-contract-build-manifest/v1') {
    const validation = validateRequirementsContractBuildManifest(input.buildManifest);
    if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  }
  const activeBuildHash = input.activeAuthority.activeBuildHash ?? input.activeAuthority.activeBuildManifestHash;
  const manifestBuildHash = input.buildManifest.buildHash ?? input.buildManifest.buildManifestHash;
  if (
    activeBuildHash !== manifestBuildHash ||
    input.activeAuthority.activeScopeSemanticHash !==
      (input.buildManifest.scopeSemanticHash ?? input.activeAuthority.activeScopeSemanticHash) ||
    input.activeAuthority.activeSourceBindingHash !==
      (input.buildManifest.sourceBindingHash ?? input.activeAuthority.activeSourceBindingHash)
  ) throw new Error('requirements_contract_judge_active_build_mismatch');
  const durablePacketEntry = durableBuild
    ? (input.buildManifest.artifactEntries as JsonRecord[]).find((entry) => entry.role === 'judge_audit_packet')
    : null;
  const resolvedAuditPacket = input.auditPacket.schemaVersion === 'requirements-contract-judge-audit-packet/v3'
    ? hydrateRequirementsContractJudgeAuditPacket({
        recordRoot: input.recordRoot,
        packetRef: (durablePacketEntry?.contentRef ?? {}) as never,
      }) as JsonRecord
    : resolveRequirementsContractJudgeAuditPacket(input.auditPacket);
  const protocol = resolvedAuditPacket.schemaVersion === 'requirements-contract-judge-audit-packet/v2'
    ? REQUIREMENTS_JUDGE_AUDIT_PACKET_PROTOCOL
    : resolvedAuditPacket.schemaVersion === 'requirements-contract-judge-audit-packet/v3-hydrated'
      ? REQUIREMENTS_JUDGE_AUDIT_PACKET_V3_PROTOCOL
      : '';
  const judgePrompt = protocol
    ? { ...input.judgePrompt, systemPrompt: `${input.judgePrompt.systemPrompt}\n\n${protocol}` }
    : input.judgePrompt;
  const selection = createRequirementsContractJudgeSelectionReceipt(input.providerSelection);
  const packetBytes = Buffer.from(canonicalJson(input.auditPacket), 'utf8');
  const packetHash = sourceBytesHash(packetBytes);
  const packetHex = packetHash.slice('sha256:'.length);
  const auditPacketRef = durablePacketEntry && input.persist !== false
    ? durablePacketEntry.contentRef as never
    : input.persist === false
    ? {
        schemaVersion: 'requirements-content-ref/v1' as const,
        contentHash: packetHash,
        byteLength: packetBytes.length,
        mediaType: 'application/json',
        recordRelativePath: `authoring/objects/sha256/${packetHex.slice(0, 2)}/${packetHex.slice(2)}`,
      }
    : publishRequirementsContractJudgeAuditPacketRef({ recordRoot: input.recordRoot, packet: input.auditPacket });
  if (durableBuild) {
    if (!durablePacketEntry || canonicalRequirementsJson(durablePacketEntry.contentRef) !== canonicalRequirementsJson(auditPacketRef)) {
      throw new Error('requirements_contract_judge_active_packet_mismatch');
    }
    if (input.persist !== false) {
      const activePacket = resolveRequirementsAuthoringArtifact({
        recordRoot: input.recordRoot, entry: durablePacketEntry as never,
      });
      if (canonicalJson(activePacket) !== canonicalJson(input.auditPacket)) {
        throw new Error('requirements_contract_judge_active_packet_mismatch');
      }
    }
  }
  const body = resolvedAuditPacket.body && typeof resolvedAuditPacket.body === 'object'
    ? resolvedAuditPacket.body as JsonRecord : {};
  const auditBinding = createRequirementsContractAuditBinding({
    scopeSemanticHash: String(input.activeAuthority.activeScopeSemanticHash),
    semanticAuditSlices: [{
      role: 'judge_audit_packet',
      schemaVersion: String(input.auditPacket.schemaVersion ?? 'requirements-contract-judge-audit-packet/v1'),
      semanticHash: requirementsContractDomainHash('requirements-audit-slice:judge-packet/v1', resolvedAuditPacket),
    }],
    mandatoryDimensionIds: Array.isArray(body.mandatoryDimensionIds)
      ? body.mandatoryDimensionIds.map(String) : [],
    coverageSemanticHash: requirementsContractDomainHash('requirements-judge-coverage/v1', {
      requirementIds: Array.isArray(body.requirementIds) ? [...body.requirementIds].map(String).sort() : [],
      artifactIds: Array.isArray(body.artifactIds) ? [...body.artifactIds].map(String).sort() : [],
    }),
    judgeProtocolVersion: 'requirements-judge-protocol/v1',
    systemPromptHash: sha256(canonicalJson(judgePrompt.systemPrompt)),
    rubricHash: sha256(canonicalJson(judgePrompt.rubric)),
    responseSchemaHash: sha256(canonicalJson(judgePrompt.structuredOutputSchema)),
  });
  const request = buildRequirementsContractJudgeRequestV3({
    auditBinding,
    auditPacketRef,
    providerSelection: selection,
    prompt: judgePrompt,
    remediation: input.remediation ?? null,
  });
  return { resolvedAuditPacket, selection, request, auditBinding, auditPolicyHash: auditBinding.auditPolicyHash };
}

export async function runRequirementsContractProductionJudgePipeline(input: RequirementsContractProductionJudgePipelineInput) {
  const persist = input.persist !== false;
  const { resolvedAuditPacket, selection, request, auditBinding, auditPolicyHash } = prepareRequirementsContractProductionJudgeRequest(input);
  const reusable = persist
    ? readVerifiedRequirementsContractJudgeDecision({ recordRoot: input.recordRoot, binding: auditBinding })
    : null;
  if (reusable) {
    const reusedRequest = readRecordArtifact(input.recordRoot, reusable.judgeRequestRef.path);
    const response = readRecordArtifact(input.recordRoot, reusable.judgeResponseRef.path);
    const aggregate = readRecordArtifact(input.recordRoot, reusable.aggregateRef.path);
    const reusedActiveRequest = fs.existsSync(path.join(input.recordRoot, 'quality', 'active-request.json'))
      ? readRecordArtifact(input.recordRoot, 'quality/active-request.json') : null;
    if (reusable.verdict === 'audited_pass') {
      const effectivePass = readRecordArtifact(input.recordRoot, 'quality/requirements-effective-pass-receipt.json');
      return { status: 'audited_pass' as const, reused: true, decision: reusable, request: reusedRequest, response, aggregate, effectivePass, activeRequest: reusedActiveRequest };
    }
    const remediationPlan = compileRequirementsContractRemediationPlan({
      judgeRequestHash: String(reusedRequest.judgeRequestHash),
      findings: Array.isArray(aggregate.findings) ? aggregate.findings : [],
    });
    return { status: remediationPlan.state, reused: true, decision: reusable, request: reusedRequest, response, aggregate, remediationPlan, activeRequest: reusedActiveRequest };
  }
  const selectionPath = `quality/selections/${hashPathSegment(selection.providerSelectionHash)}/provider-selection-receipt.json`;
  const requestDirectory = `quality/requests/${hashPathSegment(request.judgeRequestHash)}`;
  const requestPath = `${requestDirectory}/judge-request.json`;
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
  const maxAttempts = maximumAttempts(input.providerSelection.provider);
  const attemptOrdinal = activeRequest.attemptCount + 1;
  const attemptPath = `${requestDirectory}/dispatch-attempts/${attemptOrdinal}.json`;
  const existingAttempt = persist && fs.existsSync(path.join(input.recordRoot, ...attemptPath.split('/')))
    ? readRecordArtifact(input.recordRoot, attemptPath) : null;
  if (existingAttempt && (existingAttempt.judgeRequestHash !== request.judgeRequestHash ||
    existingAttempt.providerSelectionHash !== selection.providerSelectionHash ||
    existingAttempt.attemptOrdinal !== attemptOrdinal)) {
    throw new Error('requirements_contract_judge_attempt_identity_mismatch');
  }
  const replayedAttempt = existingAttempt?.outcome === 'response_received';
  if (existingAttempt && !replayedAttempt) {
    throw new Error('requirements_contract_judge_attempt_recovery_state_invalid');
  }
  const invocationPayload = buildPreparedRequirementsContractJudgeInvocationPayload({
    prepared: input.preparedInvocation,
    request,
    providerSelection: selection,
    hydratedAuditPacket: input.auditPacket,
    allowEphemeralAuditPacket: !persist,
    executionContext: {
      projectRoot: input.recordRoot,
      requestPath,
      outputDir: `${requestDirectory}/provider-output/${activeRequest.attemptCount + 1}`,
      requestFileContent: canonicalRequirementsJson(request),
    },
  });
  const capacityBeforePublication = assessRequirementsContractJudgeRequestCapacity({
    request: invocationPayload.request, provider: input.providerSelection.provider,
  });
  if (!replayedAttempt && capacityBeforePublication.decision === 'capacity_blocked') {
    return {
      status: 'audit_pending' as const,
      issueCode: capacityBeforePublication.issueCode,
      capacity: capacityBeforePublication, request, activeRequest,
    };
  }
  const requestFileContent = canonicalRequirementsJson(request);
  const executionContext = invocationPayload.executionContext as JsonRecord;
  if (!replayedAttempt && attemptOrdinal <= maxAttempts) {
    measureJudgePayload({
      serializedPayload: requestFileContent, stage: 'requirements_request',
      candidateHash: request.judgeRequestHash,
    });
    input.preparedInvocation.preflight(invocationPayload);
  }
  publish(input.recordRoot, selectionPath, selection, persist);
  publish(input.recordRoot, requestPath, request, persist);
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
  if (attemptOrdinal > maxAttempts) {
    return {
      status: 'audit_pending' as const,
      issueCode: 'attempts_exhausted',
      request,
      activeRequest,
    };
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
        request: invocationPayload.request,
        provider: input.providerSelection.provider,
        attemptOrdinal,
        invoke: () => input.preparedInvocation.invoke(invocationPayload),
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
  const body = resolvedAuditPacket.body as JsonRecord;
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
    request: invocationPayload.request,
    response,
  });
  const aggregatePath = `${requestDirectory}/requirements-audit-aggregate.json`;
  publish(input.recordRoot, aggregatePath, aggregate, persist);
  activeRequest = {
    ...auditedRequest,
    aggregateRef: { path: aggregatePath, hash: aggregate.requirementsAuditAggregateHash },
  };
  if (persist) {
    publishRequirementsContractJudgeDecision({
      recordRoot: input.recordRoot,
      binding: auditBinding,
      verdict: response.verdict === 'pass' ? 'audited_pass' : 'audited_fail',
      judgeRequestRef: { path: requestPath, hash: request.judgeRequestHash },
      judgeResponseRef: { path: responsePath, hash: responseHash },
      aggregateRef: { path: aggregatePath, hash: String(aggregate.requirementsAuditAggregateHash) },
    });
  }
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
