import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';

export const REQUIREMENTS_REMEDIATION_ROUTES = [
  'new_business_decision',
  'compiler_gap',
  'projection_repair',
] as const;

export type RequirementsRemediationRoute = (typeof REQUIREMENTS_REMEDIATION_ROUTES)[number];

export interface RequirementsRemediationRepairStep {
  stepId: string;
  route: RequirementsRemediationRoute;
  findingDispositionRefs: string[];
  authorityBasisRefs: string[];
  affectedIds: string[];
  earliestAffectedStage: string;
  latestValidPredecessorCheckpoint: string | null;
  expectedChangedArtifactRoles: string[];
  initialDisposition: string;
}

export interface RequirementsContractRemediationPlan {
  schemaVersion: 'requirements-remediation-plan/v1';
  remediatesRequestHash: string;
  remediationAggregateHash: string;
  repairSteps: RequirementsRemediationRepairStep[];
  authorityBasisRefs: string[];
  findingDispositionRefs: string[];
  affectedIds: string[];
  earliestAffectedStage: string;
  latestValidPredecessorCheckpoint: string | null;
  beforeState: Record<string, string>;
  expectedChangedArtifactRoles: string[];
  compilerIdentity: string;
  remediationPlanHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const PLAN_KEYS = new Set([
  'schemaVersion', 'remediatesRequestHash', 'remediationAggregateHash', 'repairSteps',
  'authorityBasisRefs', 'findingDispositionRefs', 'affectedIds', 'earliestAffectedStage',
  'latestValidPredecessorCheckpoint', 'beforeState', 'expectedChangedArtifactRoles',
  'compilerIdentity', 'remediationPlanHash',
]);
const STEP_KEYS = new Set([
  'stepId', 'route', 'findingDispositionRefs', 'authorityBasisRefs', 'affectedIds',
  'earliestAffectedStage', 'latestValidPredecessorCheckpoint',
  'expectedChangedArtifactRoles', 'initialDisposition',
]);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function canonicalStep(step: RequirementsRemediationRepairStep): RequirementsRemediationRepairStep {
  return {
    stepId: step.stepId,
    route: step.route,
    findingDispositionRefs: sortedUnique(step.findingDispositionRefs),
    authorityBasisRefs: sortedUnique(step.authorityBasisRefs),
    affectedIds: sortedUnique(step.affectedIds),
    earliestAffectedStage: step.earliestAffectedStage,
    latestValidPredecessorCheckpoint: step.latestValidPredecessorCheckpoint,
    expectedChangedArtifactRoles: sortedUnique(step.expectedChangedArtifactRoles),
    initialDisposition: step.initialDisposition,
  };
}

function compareStep(left: RequirementsRemediationRepairStep, right: RequirementsRemediationRepairStep): number {
  return (
    REQUIREMENTS_REMEDIATION_ROUTES.indexOf(left.route) -
      REQUIREMENTS_REMEDIATION_ROUTES.indexOf(right.route) ||
    canonicalRequirementsJson(left.findingDispositionRefs).localeCompare(
      canonicalRequirementsJson(right.findingDispositionRefs)
    ) ||
    left.stepId.localeCompare(right.stepId)
  );
}

export function requirementsRemediationStepHash(step: RequirementsRemediationRepairStep): string {
  return requirementsContractDomainHash('requirements-remediation-step/v1', canonicalStep(step));
}

export function createRequirementsContractRemediationPlan(
  input: Omit<RequirementsContractRemediationPlan, 'schemaVersion' | 'remediationPlanHash'>
): RequirementsContractRemediationPlan {
  const payload = {
    schemaVersion: 'requirements-remediation-plan/v1' as const,
    remediatesRequestHash: input.remediatesRequestHash,
    remediationAggregateHash: input.remediationAggregateHash,
    repairSteps: input.repairSteps.map(canonicalStep).sort(compareStep),
    authorityBasisRefs: sortedUnique(input.authorityBasisRefs),
    findingDispositionRefs: sortedUnique(input.findingDispositionRefs),
    affectedIds: sortedUnique(input.affectedIds),
    earliestAffectedStage: input.earliestAffectedStage,
    latestValidPredecessorCheckpoint: input.latestValidPredecessorCheckpoint,
    beforeState: Object.fromEntries(Object.entries(input.beforeState).sort(([a], [b]) => a.localeCompare(b))),
    expectedChangedArtifactRoles: sortedUnique(input.expectedChangedArtifactRoles),
    compilerIdentity: input.compilerIdentity,
  };
  const plan = {
    ...payload,
    remediationPlanHash: requirementsContractDomainHash(
      'requirements-remediation-plan/v1', payload
    ),
  };
  const validation = validateRequirementsContractRemediationPlan(plan);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return plan;
}

export function validateRequirementsContractRemediationPlan(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['remediation_plan_invalid'] };
  }
  const plan = value as RequirementsContractRemediationPlan & Record<string, unknown>;
  if (Object.keys(plan).some((key) => !PLAN_KEYS.has(key))) issueCodes.push('remediation_plan_unknown_field');
  if (plan.schemaVersion !== 'requirements-remediation-plan/v1') issueCodes.push('remediation_plan_schema_version_invalid');
  if (![plan.remediatesRequestHash, plan.remediationAggregateHash].every((hash) => SHA256.test(String(hash)))) {
    issueCodes.push('remediation_plan_authority_hash_invalid');
  }
  if (!Array.isArray(plan.repairSteps) || plan.repairSteps.length === 0) {
    issueCodes.push('remediation_plan_repair_step_missing');
  } else {
    const findingOwners = new Map<string, number>();
    const stepIds = new Set<string>();
    for (const step of plan.repairSteps) {
      if (Object.keys(step).some((key) => !STEP_KEYS.has(key))) issueCodes.push('remediation_plan_step_unknown_field');
      if (!REQUIREMENTS_REMEDIATION_ROUTES.includes(step.route)) issueCodes.push('remediation_plan_route_invalid');
      if (stepIds.has(step.stepId)) issueCodes.push('remediation_plan_step_identity_duplicate');
      stepIds.add(step.stepId);
      for (const findingRef of step.findingDispositionRefs ?? []) {
        findingOwners.set(findingRef, (findingOwners.get(findingRef) ?? 0) + 1);
      }
    }
    const declared = sortedUnique(plan.findingDispositionRefs ?? []);
    if (
      declared.some((ref) => findingOwners.get(ref) !== 1) ||
      [...findingOwners].some(([ref, count]) => count !== 1 || !declared.includes(ref))
    ) {
      issueCodes.push('remediation_plan_finding_coverage_invalid');
    }
    const sorted = [...plan.repairSteps].map(canonicalStep).sort(compareStep);
    if (canonicalRequirementsJson(sorted) !== canonicalRequirementsJson(plan.repairSteps)) {
      issueCodes.push('remediation_plan_step_order_invalid');
    }
  }
  for (const field of [
    'authorityBasisRefs', 'findingDispositionRefs', 'affectedIds', 'expectedChangedArtifactRoles',
  ] as const) {
    if (canonicalRequirementsJson(sortedUnique(plan[field] ?? [])) !== canonicalRequirementsJson(plan[field])) {
      issueCodes.push('remediation_plan_set_order_invalid');
    }
  }
  const { remediationPlanHash, ...payload } = plan;
  if (
    !SHA256.test(String(remediationPlanHash)) ||
    remediationPlanHash !== requirementsContractDomainHash('requirements-remediation-plan/v1', payload)
  ) {
    issueCodes.push('remediation_plan_hash_mismatch');
  }
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}
