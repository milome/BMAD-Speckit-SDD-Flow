import { describe, expect, it } from 'vitest';
import {
  createRequirementsAuditPolicyUpgrade,
  verifyRequirementsAuditPolicyUpgrade,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-policy-upgrade';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements audit policy upgrade', () => {
  it('requires a monotonic explicit upgrade and verifies its hash', () => {
    const upgrade = createRequirementsAuditPolicyUpgrade({
      operationId: 'UPGRADE-1', fromPolicyVersion: 1, fromAuditPolicyHash: hash('1'),
      toPolicyVersion: 2, toAuditPolicyHash: hash('2'), scopeSemanticHash: hash('3'),
      supersedesDecisionHash: hash('4'), state: 'requested',
    });
    expect(verifyRequirementsAuditPolicyUpgrade(upgrade)).toEqual(upgrade);
    expect(() => createRequirementsAuditPolicyUpgrade({ ...upgrade, toPolicyVersion: 1 }))
      .toThrow('requirements_audit_policy_upgrade_not_monotonic');
  });
});
