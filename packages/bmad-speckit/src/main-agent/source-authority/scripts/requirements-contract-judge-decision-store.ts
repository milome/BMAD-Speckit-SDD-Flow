import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import { canonicalRequirementsJson, requirementsContractDomainHash } from './requirements-contract-hash-domains';
import type { RequirementsContractAuditBinding } from './requirements-contract-audit-binding';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const REF_KEYS = new Set(['path', 'hash']);
const DECISION_KEYS = new Set([
  'schemaVersion', 'scopeSemanticHash', 'judgeInputSemanticHash', 'auditPolicyHash',
  'auditBindingHash', 'verdict', 'judgeRequestRef', 'judgeResponseRef', 'aggregateRef', 'decisionHash',
]);

export interface RequirementsContractJudgeDecisionV1 {
  schemaVersion: 'requirements-contract-judge-decision/v1';
  scopeSemanticHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
  verdict: 'audited_pass' | 'audited_fail';
  judgeRequestRef: { path: string; hash: string };
  judgeResponseRef: { path: string; hash: string };
  aggregateRef: { path: string; hash: string };
  decisionHash: string;
}

function decisionPath(recordRoot: string, auditBindingHash: string): string {
  if (!SHA256.test(auditBindingHash)) throw new Error('requirements_judge_decision_binding_invalid');
  return path.join(
    recordRoot, 'quality', 'semantic-decisions', auditBindingHash.slice('sha256:'.length), 'decision.json'
  );
}

function validateRef(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return Object.keys(ref).length === REF_KEYS.size && Object.keys(ref).every((key) => REF_KEYS.has(key)) &&
    typeof ref.path === 'string' && ref.path.length > 0 && !ref.path.includes('..') && !path.isAbsolute(ref.path) &&
    SHA256.test(String(ref.hash));
}

function validateDecision(
  decision: unknown,
  binding: RequirementsContractAuditBinding
): RequirementsContractJudgeDecisionV1 {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('requirements_judge_decision_invalid');
  }
  const value = decision as RequirementsContractJudgeDecisionV1 & Record<string, unknown>;
  if (
    Object.keys(value).length !== DECISION_KEYS.size ||
    Object.keys(value).some((key) => !DECISION_KEYS.has(key)) ||
    value.schemaVersion !== 'requirements-contract-judge-decision/v1' ||
    value.scopeSemanticHash !== binding.scopeSemanticHash ||
    value.judgeInputSemanticHash !== binding.judgeInputSemanticHash ||
    value.auditPolicyHash !== binding.auditPolicyHash ||
    value.auditBindingHash !== binding.auditBindingHash ||
    !['audited_pass', 'audited_fail'].includes(value.verdict) ||
    !validateRef(value.judgeRequestRef) || !validateRef(value.judgeResponseRef) || !validateRef(value.aggregateRef)
  ) throw new Error('requirements_judge_decision_invalid');
  const { decisionHash, ...payload } = value;
  if (decisionHash !== requirementsContractDomainHash('requirements-contract-judge-decision/v1', payload)) {
    throw new Error('requirements_judge_decision_hash_mismatch');
  }
  return value;
}

export function publishRequirementsContractJudgeDecision(input: {
  recordRoot: string;
  binding: RequirementsContractAuditBinding;
  verdict: 'audited_pass' | 'audited_fail';
  judgeRequestRef: { path: string; hash: string };
  judgeResponseRef: { path: string; hash: string };
  aggregateRef: { path: string; hash: string };
}): RequirementsContractJudgeDecisionV1 {
  const payload = {
    schemaVersion: 'requirements-contract-judge-decision/v1' as const,
    scopeSemanticHash: input.binding.scopeSemanticHash,
    judgeInputSemanticHash: input.binding.judgeInputSemanticHash,
    auditPolicyHash: input.binding.auditPolicyHash,
    auditBindingHash: input.binding.auditBindingHash,
    verdict: input.verdict,
    judgeRequestRef: input.judgeRequestRef,
    judgeResponseRef: input.judgeResponseRef,
    aggregateRef: input.aggregateRef,
  };
  const decision = {
    ...payload,
    decisionHash: requirementsContractDomainHash('requirements-contract-judge-decision/v1', payload),
  };
  validateDecision(decision, input.binding);
  atomicNoClobberPublish({
    targetPath: decisionPath(input.recordRoot, input.binding.auditBindingHash),
    value: decision,
    role: 'requirements_judge_decision',
    mediaType: 'application/json',
  });
  return decision;
}

export function readVerifiedRequirementsContractJudgeDecision(input: {
  recordRoot: string;
  binding: RequirementsContractAuditBinding;
}): RequirementsContractJudgeDecisionV1 | null {
  const target = decisionPath(input.recordRoot, input.binding.auditBindingHash);
  if (!existsSync(target)) return null;
  const decision = validateDecision(JSON.parse(readFileSync(target, 'utf8')), input.binding);
  if (canonicalRequirementsJson(decision) !== canonicalRequirementsJson(JSON.parse(readFileSync(target, 'utf8')))) {
    throw new Error('requirements_judge_decision_canonical_mismatch');
  }
  return decision;
}
