import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import {
  isRequirementsContractLintProfileApplicable,
  REQUIREMENTS_CONTRACT_LINT_STAGES,
  type RequirementsContractLintStage,
} from '../rules/requirements-contract-lint-profile-registry';

export type RequirementsContractLintDecision = 'pass' | 'block' | 'not_applicable';

export interface RequirementsContractLintReport {
  schemaVersion: 'requirements-contract-lint-report/v1';
  lintStage: RequirementsContractLintStage;
  profileId: string;
  inputAuthorityRefs: Array<{ artifactId: string; path: string; hash: string }>;
  inputIdentity: Record<string, unknown>;
  ruleSetHash: string;
  validatorIdentity: string;
  validatorVersion: string;
  validatorHash: string;
  checkedArtifactIds: string[];
  checkedRequirementIds: string[];
  issueCodes: string[];
  earliestAffectedStage: string | null;
  latestValidPredecessorCheckpoint: string | null;
  decision: RequirementsContractLintDecision;
  reportHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const REPORT_KEYS = new Set([
  'schemaVersion', 'lintStage', 'profileId', 'inputAuthorityRefs', 'inputIdentity',
  'ruleSetHash', 'validatorIdentity', 'validatorVersion', 'validatorHash',
  'checkedArtifactIds', 'checkedRequirementIds', 'issueCodes', 'earliestAffectedStage',
  'latestValidPredecessorCheckpoint', 'decision', 'reportHash',
]);

const IDENTITY_KEYS: Record<RequirementsContractLintStage, readonly string[]> = {
  intake: [
    'authoringRequestId', 'sourceSnapshotSetHash', 'sourceAuthorityManifestHash',
    'scopeSemanticHash', 'sourceBindingHash',
  ],
  cp00: [
    'authoringRequestId', 'authoringAttemptId', 'semanticKernelHash', 'decisionGraphHash',
    'scopeSemanticHash', 'sourceBindingHash',
  ],
  cp01: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp02: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp03: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp04: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp05: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp06: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp07: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  cp08: ['authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash', 'sourceBindingHash'],
  publication_ready: [
    'authoringRequestId', 'authoringAttemptId', 'attemptManifestHash', 'scopeSemanticHash',
    'sourceBindingHash', 'auditPacketHash', 'renderabilityProbeHash',
  ],
  dispatch_ready: [
    'authoringRequestId', 'activeAuthorityHash', 'buildManifestHash', 'providerSelectionHash',
    'judgeRequestHash', 'scopeSemanticHash', 'sourceBindingHash',
  ],
  final_render: [
    'authoringRequestId', 'activeAuthorityHash', 'buildManifestHash', 'effectivePassHash',
    'renderProjectionHash', 'scopeSemanticHash', 'sourceBindingHash',
  ],
};

const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

function canonicalInputIdentity(identity: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(identity).sort(([a], [b]) => a.localeCompare(b)));
}

function stageIdentityIssues(
  stage: RequirementsContractLintStage,
  identity: Record<string, unknown>
): string[] {
  const issues: string[] = [];
  const allowed = IDENTITY_KEYS[stage];
  if (Object.keys(identity).some((key) => !allowed.includes(key))) {
    issues.push('lint_report_stage_identity_unknown_field');
  }
  if (stage === 'intake') {
    if (
      !identity.authoringRequestId ||
      !SHA256.test(String(identity.sourceSnapshotSetHash)) ||
      !SHA256.test(String(identity.sourceAuthorityManifestHash)) ||
      identity.scopeSemanticHash !== null ||
      identity.sourceBindingHash !== null
    ) issues.push('lint_report_stage_identity_invalid');
    return issues;
  }
  if (stage === 'cp00') {
    if (
      !identity.authoringRequestId || !identity.authoringAttemptId ||
      !SHA256.test(String(identity.semanticKernelHash)) ||
      !SHA256.test(String(identity.decisionGraphHash)) ||
      identity.scopeSemanticHash !== null || identity.sourceBindingHash !== null
    ) issues.push('lint_report_stage_identity_invalid');
    return issues;
  }
  if (stage === 'dispatch_ready' || stage === 'final_render') {
    const stageHashes = stage === 'dispatch_ready'
      ? ['providerSelectionHash', 'judgeRequestHash']
      : ['effectivePassHash', 'renderProjectionHash'];
    if (
      !identity.authoringRequestId ||
      ['activeAuthorityHash', 'buildManifestHash', 'scopeSemanticHash', 'sourceBindingHash', ...stageHashes]
        .some((key) => !SHA256.test(String(identity[key])))
    ) issues.push('lint_report_stage_identity_invalid');
    return issues;
  }
  const preFreeze = ['cp01', 'cp02', 'cp03'].includes(stage);
  if (
    !identity.authoringRequestId || !identity.authoringAttemptId ||
    !SHA256.test(String(identity.attemptManifestHash)) ||
    (preFreeze
      ? ![null, undefined].includes(identity.scopeSemanticHash as null | undefined)
      : !SHA256.test(String(identity.scopeSemanticHash))) ||
    (preFreeze
      ? ![null, undefined].includes(identity.sourceBindingHash as null | undefined)
      : !SHA256.test(String(identity.sourceBindingHash)))
  ) issues.push('lint_report_stage_identity_invalid');
  if (stage === 'publication_ready' &&
      (!SHA256.test(String(identity.auditPacketHash)) ||
       !SHA256.test(String(identity.renderabilityProbeHash)))) {
    issues.push('lint_report_stage_identity_invalid');
  }
  return issues;
}

export function createRequirementsContractLintReport(
  input: Omit<RequirementsContractLintReport, 'schemaVersion' | 'reportHash'>
): RequirementsContractLintReport {
  const payload = {
    schemaVersion: 'requirements-contract-lint-report/v1' as const,
    lintStage: input.lintStage,
    profileId: input.profileId,
    inputAuthorityRefs: [...input.inputAuthorityRefs].sort((a, b) => a.path.localeCompare(b.path)),
    inputIdentity: canonicalInputIdentity(input.inputIdentity),
    ruleSetHash: input.ruleSetHash,
    validatorIdentity: input.validatorIdentity,
    validatorVersion: input.validatorVersion,
    validatorHash: input.validatorHash,
    checkedArtifactIds: sortedUnique(input.checkedArtifactIds),
    checkedRequirementIds: sortedUnique(input.checkedRequirementIds),
    issueCodes: sortedUnique(input.issueCodes),
    earliestAffectedStage: input.earliestAffectedStage,
    latestValidPredecessorCheckpoint: input.latestValidPredecessorCheckpoint,
    decision: input.decision,
  };
  const report = {
    ...payload,
    reportHash: requirementsContractDomainHash('requirements-contract-lint-report/v1', payload),
  };
  const validation = validateRequirementsContractLintReport(report);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return report;
}

export function validateRequirementsContractLintReport(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['lint_report_invalid'] };
  }
  const report = value as RequirementsContractLintReport & Record<string, unknown>;
  if (Object.keys(report).some((key) => !REPORT_KEYS.has(key))) issueCodes.push('lint_report_unknown_field');
  if (report.schemaVersion !== 'requirements-contract-lint-report/v1') issueCodes.push('lint_report_schema_version_invalid');
  if (!REQUIREMENTS_CONTRACT_LINT_STAGES.includes(report.lintStage)) issueCodes.push('lint_report_stage_invalid');
  if (!isRequirementsContractLintProfileApplicable(report.profileId, report.lintStage)) issueCodes.push('lint_report_profile_stage_mismatch');
  if (!['pass', 'block', 'not_applicable'].includes(report.decision)) issueCodes.push('lint_report_decision_invalid');
  if (![report.ruleSetHash, report.validatorHash].every((hash) => SHA256.test(String(hash)))) issueCodes.push('lint_report_validator_hash_invalid');
  if (!report.inputIdentity || typeof report.inputIdentity !== 'object' || Array.isArray(report.inputIdentity)) {
    issueCodes.push('lint_report_stage_identity_invalid');
  } else if (REQUIREMENTS_CONTRACT_LINT_STAGES.includes(report.lintStage)) {
    issueCodes.push(...stageIdentityIssues(report.lintStage, report.inputIdentity));
  }
  const { reportHash, ...payload } = report;
  if (
    !SHA256.test(String(reportHash)) ||
    reportHash !== requirementsContractDomainHash('requirements-contract-lint-report/v1', payload)
  ) issueCodes.push('lint_report_hash_mismatch');
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}

export function lintReportsCanonicallyEqual(
  left: RequirementsContractLintReport,
  right: RequirementsContractLintReport
): boolean {
  return canonicalRequirementsJson(left) === canonicalRequirementsJson(right);
}
