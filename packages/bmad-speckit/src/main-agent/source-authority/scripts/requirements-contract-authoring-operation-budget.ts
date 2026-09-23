import { requirementsContractDomainHash } from './requirements-contract-hash-domains';

export interface RequirementsAuthoringOperationBudget {
  schemaVersion: 'requirements-contract-authoring-operation-budget/v1';
  operationId: string;
  initialSemanticHash: string;
  auditPolicyHash: string;
  triggeringAuditBindingHash: string;
  triggeringJudgeDecisionHash: string;
  judgeInvocationCount: 0 | 1 | 2;
  automaticRepairCount: 0 | 1;
  terminalStatus: 'active' | 'ready_to_confirm' | 'blocked';
  budgetHash: string;
}

export function createRequirementsAuthoringOperationBudget(input: Omit<RequirementsAuthoringOperationBudget, 'schemaVersion' | 'budgetHash'>) {
  const payload = { schemaVersion: 'requirements-contract-authoring-operation-budget/v1' as const, ...input };
  return { ...payload, budgetHash: requirementsContractDomainHash('requirements-authoring-operation-budget/v1', payload) };
}

export function advanceRequirementsAuthoringOperationBudget(input: {
  budget: RequirementsAuthoringOperationBudget;
  operationId: string;
  judgeInvocation?: boolean;
  automaticRepair?: boolean;
  terminalStatus?: RequirementsAuthoringOperationBudget['terminalStatus'];
}) {
  const current = input.budget;
  if (!current.triggeringAuditBindingHash || !current.triggeringJudgeDecisionHash) {
    throw new Error('requirements_authoring_operation_budget_binding_invalid');
  }
  const judgeInvocationCount = (current.judgeInvocationCount + (input.judgeInvocation ? 1 : 0)) as 0 | 1 | 2;
  const automaticRepairCount = (current.automaticRepairCount + (input.automaticRepair ? 1 : 0)) as 0 | 1;
  if (judgeInvocationCount > 2) throw new Error('requirements_judge_invocation_budget_exhausted');
  if (automaticRepairCount > 1) throw new Error('requirements_automatic_repair_budget_exhausted');
  return createRequirementsAuthoringOperationBudget({
    operationId: input.operationId,
    initialSemanticHash: current.initialSemanticHash,
    auditPolicyHash: current.auditPolicyHash,
    triggeringAuditBindingHash: current.triggeringAuditBindingHash,
    triggeringJudgeDecisionHash: current.triggeringJudgeDecisionHash,
    judgeInvocationCount,
    automaticRepairCount,
    terminalStatus: input.terminalStatus ?? current.terminalStatus,
  });
}
