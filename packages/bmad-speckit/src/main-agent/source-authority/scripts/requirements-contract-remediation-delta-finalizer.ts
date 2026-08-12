type JsonRecord = Record<string, unknown>;
import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  buildRequirementsContractJudgeRequest,
  type RequirementsContractJudgeRequestInput,
} from './requirements-contract-judge-request-identity';

export type RequirementsContractRemediationClassification =
  | 'compiler_gap'
  | 'new_business_decision'
  | 'projection_repair'
  | 'non_actionable_suggestion';

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function classificationFor(authorityBasis: unknown): RequirementsContractRemediationClassification {
  if (authorityBasis === 'missing_business_authority') return 'new_business_decision';
  if (authorityBasis === 'frozen_ir_contains_required_semantics') return 'projection_repair';
  if (authorityBasis === 'deterministic_compiler_omitted_frozen_semantics') return 'compiler_gap';
  return 'non_actionable_suggestion';
}

export function compileRequirementsContractRemediationPlan(input: {
  judgeRequestHash: string;
  findings: unknown[];
}) {
  if (!Array.isArray(input.findings) || input.findings.length === 0) {
    throw new Error('requirements_contract_remediation_findings_missing');
  }
  const repairSteps = input.findings
    .map((value) => {
      const finding = record(value, 'requirements_contract_remediation_finding_invalid');
      if (typeof finding.findingId !== 'string' || !finding.findingId.trim()) {
        throw new Error('requirements_contract_remediation_finding_id_invalid');
      }
      return {
        findingId: finding.findingId,
        classification: classificationFor(finding.authorityBasis),
        severity: finding.severity,
        summary: finding.summary,
        affectedMustRefs: Array.isArray(finding.affectedMustRefs)
          ? [...finding.affectedMustRefs].sort()
          : [],
        affectedArtifactRefs: Array.isArray(finding.affectedArtifactRefs)
          ? [...finding.affectedArtifactRefs].sort()
          : [],
        authorityBasis: finding.authorityBasis,
        earliestAffectedStage: finding.earliestAffectedStage,
      };
    })
    .sort((left, right) => {
      const stage = String(left.earliestAffectedStage).localeCompare(
        String(right.earliestAffectedStage),
        'en'
      );
      return stage || String(left.findingId).localeCompare(String(right.findingId), 'en');
    });
  const requiresBusinessDecision = repairSteps.some(
    (step) => step.classification === 'new_business_decision'
  );
  const hasBlockedStep = repairSteps.some(
    (step) => step.classification === 'non_actionable_suggestion'
  );
  const payload = {
    schemaVersion: 'requirements-contract-remediation-plan/v2' as const,
    judgeRequestHash: input.judgeRequestHash,
    state: requiresBusinessDecision
      ? ('business_decision_required' as const)
      : hasBlockedStep
        ? ('remediation_blocked' as const)
        : ('repair_planned' as const),
    repairSteps,
  };
  return {
    ...payload,
    remediationPlanHash: sha256Stable({
      domain: 'requirements-contract-remediation-plan/v2',
      payload,
    }),
  };
}

export function requirementsContractAutomaticRepairSteps(plan: JsonRecord) {
  const steps = Array.isArray(plan.repairSteps) ? plan.repairSteps : [];
  if (
    plan.state !== 'repair_planned' ||
    steps.length === 0 ||
    steps.some((value) => {
      const step = record(value, 'requirements_contract_remediation_step_invalid');
      return !['projection_repair', 'compiler_gap'].includes(String(step.classification));
    })
  ) {
    throw new Error('requirements_contract_remediation_blocked');
  }
  return steps.map((value) => record(value, 'requirements_contract_remediation_step_invalid'));
}

export function finalizeRequirementsContractRemediationDelta(input: {
  plan: JsonRecord;
  beforeAuthority: JsonRecord;
  afterAuthority: JsonRecord;
  executedRepairStepRefs: string[];
  deferredRepairStepRefs: string[];
  changedArtifactRoles: string[];
  changedArtifactRefs: string[];
  automaticRemediationCount: number;
  maxAutomaticRemediations: number;
}) {
  if (input.plan.state === 'business_decision_required') {
    throw new Error('requirements_contract_remediation_business_decision_required');
  }
  if (
    !Number.isSafeInteger(input.automaticRemediationCount) ||
    !Number.isSafeInteger(input.maxAutomaticRemediations) ||
    input.automaticRemediationCount >= input.maxAutomaticRemediations
  ) {
    throw new Error('judge_remediation_limit_reached');
  }
  const steps = Array.isArray(input.plan.repairSteps) ? input.plan.repairSteps : [];
  const stepRefs = steps.map((value) => String(record(value, 'requirements_contract_remediation_step_invalid').findingId));
  const executed = [...new Set(input.executedRepairStepRefs)].sort();
  const deferred = [...new Set(input.deferredRepairStepRefs)].sort();
  if (deferred.length > 0 || executed.length !== stepRefs.length || executed.some((ref) => !stepRefs.includes(ref))) {
    throw new Error('requirements_contract_remediation_steps_incomplete');
  }
  const changedArtifactRoles = [...new Set(input.changedArtifactRoles)].sort();
  const changedArtifactRefs = [...new Set(input.changedArtifactRefs)].sort();
  const affectedArtifactRefs = [
    ...new Set(
      steps.flatMap((value) => {
        const step = record(value, 'requirements_contract_remediation_step_invalid');
        return Array.isArray(step.affectedArtifactRefs)
          ? step.affectedArtifactRefs.map(String)
          : [];
      })
    ),
  ].sort();
  if (
    changedArtifactRoles.length === 0 ||
    affectedArtifactRefs.length === 0 ||
    affectedArtifactRefs.some((ref) => !changedArtifactRefs.includes(ref))
  ) {
    throw new Error('judge_remediation_no_progress');
  }
  const beforeAuthorityHash = sha256Stable(input.beforeAuthority);
  const afterAuthorityHash = sha256Stable(input.afterAuthority);
  if (beforeAuthorityHash === afterAuthorityHash) {
    throw new Error('judge_remediation_no_progress');
  }
  const payload = {
    schemaVersion: 'requirements-remediation-delta/v1' as const,
    remediatesRequestHash: String(input.plan.judgeRequestHash),
    remediationPlanHash: String(input.plan.remediationPlanHash),
    beforeAuthorityHash,
    afterAuthorityHash,
    executedRepairStepRefs: executed,
    deferredRepairStepRefs: deferred,
    changedArtifactRoles,
  };
  return {
    ...payload,
    remediationDeltaHash: sha256Stable({
      domain: 'requirements-remediation-delta/v1',
      payload,
    }),
  };
}

export function buildRequirementsContractSuccessorJudgeRequest(input: {
  currentJudgeRequestHash: string;
  remediationAggregateHash: string;
  plan: JsonRecord;
  beforeAuthority: JsonRecord;
  afterAuthority: JsonRecord;
  executedRepairStepRefs: string[];
  deferredRepairStepRefs: string[];
  changedArtifactRoles: string[];
  changedArtifactRefs: string[];
  automaticRemediationCount: number;
  maxAutomaticRemediations: number;
  successorRequestInput: Omit<RequirementsContractJudgeRequestInput, 'remediation'>;
}) {
  if (input.plan.judgeRequestHash !== input.currentJudgeRequestHash) {
    throw new Error('requirements_contract_remediation_request_mismatch');
  }
  const delta = finalizeRequirementsContractRemediationDelta({
    plan: input.plan,
    beforeAuthority: input.beforeAuthority,
    afterAuthority: input.afterAuthority,
    executedRepairStepRefs: input.executedRepairStepRefs,
    deferredRepairStepRefs: input.deferredRepairStepRefs,
    changedArtifactRoles: input.changedArtifactRoles,
    changedArtifactRefs: input.changedArtifactRefs,
    automaticRemediationCount: input.automaticRemediationCount,
    maxAutomaticRemediations: input.maxAutomaticRemediations,
  });
  const successorRequest = buildRequirementsContractJudgeRequest({
    ...input.successorRequestInput,
    remediation: {
      remediatesRequestHash: input.currentJudgeRequestHash,
      remediationAggregateHash: input.remediationAggregateHash,
      remediationDeltaHash: delta.remediationDeltaHash,
    },
  });
  if (successorRequest.judgeRequestHash === input.currentJudgeRequestHash) {
    throw new Error('judge_remediation_no_progress');
  }
  return { delta, successorRequest };
}
