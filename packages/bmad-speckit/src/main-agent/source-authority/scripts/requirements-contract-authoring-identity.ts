import {
  judgeRequestHash,
  requirementsContractDomainHash,
  semanticRevisionId,
} from './requirements-contract-hash-domains';
import {
  validateRequirementsContractRemediationDelta,
  type RequirementsContractRemediationDelta,
} from './requirements-contract-remediation-delta';
import {
  validateRequirementsContractRemediationPlan,
  type RequirementsContractRemediationPlan,
} from './requirements-contract-remediation-plan';

function identity(prefix: string, domain: string, payload: unknown): string {
  return `${prefix}-${requirementsContractDomainHash(domain, payload)
    .slice('sha256:'.length)
    .toUpperCase()}`;
}

export function createRequirementsContractAuthoringIdentity(input: {
  recordId: string;
  requestNonce: string;
  grillGraphHash: string;
  attemptNonce: string;
  parentSemanticRevisionId: string | null;
  scopeSemanticHash: string;
  compilerVersion: string;
  judgeRequestPayload: unknown;
  remediationPlan: RequirementsContractRemediationPlan;
  remediationDelta: RequirementsContractRemediationDelta;
}) {
  const planValidation = validateRequirementsContractRemediationPlan(input.remediationPlan);
  if (planValidation.decision === 'block') throw new Error(planValidation.issueCodes[0]);
  const deltaValidation = validateRequirementsContractRemediationDelta(input.remediationDelta, {
    remediationPlan: input.remediationPlan,
  });
  if (deltaValidation.decision === 'block') throw new Error(deltaValidation.issueCodes[0]);
  const authoringRequestId = identity('AUTHORING', 'requirements-authoring-request-id/v1', {
    recordId: input.recordId,
    requestNonce: input.requestNonce,
  });
  return {
    authoringRequestId,
    requestId: authoringRequestId,
    grillSessionId: identity('GRILL', 'requirements-grill-session-id/v1', {
      authoringRequestId,
      grillGraphHash: input.grillGraphHash,
    }),
    authoringAttemptId: identity('ATTEMPT', 'requirements-authoring-attempt-id/v1', {
      authoringRequestId,
      attemptNonce: input.attemptNonce,
    }),
    semanticRevisionId: semanticRevisionId({
      recordId: input.recordId,
      parentSemanticRevisionId: input.parentSemanticRevisionId,
      scopeSemanticHash: input.scopeSemanticHash,
      compilerVersion: input.compilerVersion,
    }),
    judgeRequestHash: judgeRequestHash(input.judgeRequestPayload),
    remediationPlanHash: input.remediationPlan.remediationPlanHash,
    remediationDeltaHash: input.remediationDelta.remediationDeltaHash,
  };
}

export function classifyRequirementsContractStaleness(input: {
  previousScopeSemanticHash: string;
  nextScopeSemanticHash: string;
  previousSourceBindingHash: string;
  nextSourceBindingHash: string;
}): 'current' | 'semantic_revision_stale' | 'citation_binding_stale' {
  if (input.previousScopeSemanticHash !== input.nextScopeSemanticHash) {
    return 'semantic_revision_stale';
  }
  if (input.previousSourceBindingHash !== input.nextSourceBindingHash) {
    return 'citation_binding_stale';
  }
  return 'current';
}
