import { requirementsContractDomainHash } from './requirements-contract-hash-domains';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export interface RequirementsAuditPolicyUpgrade {
  schemaVersion: 'requirements-contract-audit-policy-upgrade/v1';
  operationId: string;
  fromPolicyVersion: number;
  fromAuditPolicyHash: string;
  toPolicyVersion: number;
  toAuditPolicyHash: string;
  scopeSemanticHash: string;
  supersedesDecisionHash: string;
  state: 'requested' | 'audit_pending' | 'terminal' | 'blocked';
  operationHash: string;
}

export function createRequirementsAuditPolicyUpgrade(input: Omit<RequirementsAuditPolicyUpgrade, 'schemaVersion' | 'operationHash'>) {
  if (!Number.isSafeInteger(input.fromPolicyVersion) || !Number.isSafeInteger(input.toPolicyVersion) ||
    input.toPolicyVersion <= input.fromPolicyVersion) {
    throw new Error('requirements_audit_policy_upgrade_not_monotonic');
  }
  if (![input.fromAuditPolicyHash, input.toAuditPolicyHash, input.scopeSemanticHash, input.supersedesDecisionHash]
    .every((value) => SHA256.test(value))) {
    throw new Error('requirements_audit_policy_upgrade_hash_invalid');
  }
  const payload = { schemaVersion: 'requirements-contract-audit-policy-upgrade/v1' as const, ...input };
  return { ...payload, operationHash: requirementsContractDomainHash('requirements-audit-policy-upgrade/v1', payload) };
}

export function verifyRequirementsAuditPolicyUpgrade(value: unknown): RequirementsAuditPolicyUpgrade {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('requirements_audit_policy_upgrade_invalid');
  const upgrade = value as RequirementsAuditPolicyUpgrade & Record<string, unknown>;
  const { operationHash, ...payload } = upgrade;
  if (operationHash !== requirementsContractDomainHash('requirements-audit-policy-upgrade/v1', payload)) {
    throw new Error('requirements_audit_policy_upgrade_hash_mismatch');
  }
  return createRequirementsAuditPolicyUpgrade(payload as Omit<RequirementsAuditPolicyUpgrade, 'schemaVersion' | 'operationHash'>);
}
