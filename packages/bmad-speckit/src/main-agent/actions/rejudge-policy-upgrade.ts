import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from '../source-authority/scripts/requirement-record-control-store';
import { createRequirementsAuditPolicyUpgrade } from '../source-authority/scripts/requirements-contract-audit-policy-upgrade';

export function rejudgePolicyUpgradeAction(context: { cwd: string; args: Record<string, unknown> }) {
  const requestId = String(context.args.requestId ?? '');
  const recordRoot = path.join(context.cwd, '_bmad-output', 'runtime', 'requirement-records', requestId);
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  if (!requestId || !fs.existsSync(recordPath)) throw new Error('requirements_audit_policy_upgrade_record_missing');
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown> & {
    pinnedAuditPolicy?: { version: number; hash: string };
    activeAuthority?: { activeScopeSemanticHash?: string };
  };
  const current = record.pinnedAuditPolicy ?? { version: 0, hash: String(context.args.fromAuditPolicyHash ?? '') };
  const upgrade = createRequirementsAuditPolicyUpgrade({
    operationId: String(context.args.operationId ?? ''),
    fromPolicyVersion: Number(context.args.fromPolicyVersion ?? current.version),
    fromAuditPolicyHash: String(context.args.fromAuditPolicyHash ?? current.hash),
    toPolicyVersion: Number(context.args.toPolicyVersion),
    toAuditPolicyHash: String(context.args.toAuditPolicyHash),
    scopeSemanticHash: String(record.activeAuthority?.activeScopeSemanticHash ?? ''),
    supersedesDecisionHash: String(context.args.supersedesDecisionHash ?? ''),
    state: 'requested',
  });
  writeJsonAtomic(path.join(recordRoot, 'quality', 'audit-policy-upgrades', upgrade.operationId, 'operation.json'), upgrade);
  writeJsonAtomic(recordPath, { ...record, pinnedAuditPolicy: { version: upgrade.toPolicyVersion, hash: upgrade.toAuditPolicyHash } });
  return { ok: true, status: 'audit_policy_upgrade_requested', upgrade };
}
