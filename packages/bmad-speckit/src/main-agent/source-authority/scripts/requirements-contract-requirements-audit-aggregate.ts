import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;
type RequirementsAuditDecision = 'pass' | 'block';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REQUIREMENTS_ACTOR = 'requirements_critical_auditor_judge';
const REQUIREMENTS_ROLE = 'requirements_critical_auditor';

export interface RequirementsAuditAggregate {
  schemaVersion: 'requirements-contract-requirements-audit-aggregate/v1';
  actorClass: typeof REQUIREMENTS_ACTOR;
  judgeRole: typeof REQUIREMENTS_ROLE;
  requestHash: string;
  attemptKeyHash: string;
  scopeManifestHash: string;
  evidenceManifestHash: string;
  providerInvocationReceiptHash: string;
  promptTemplateHash: string;
  assessmentSchemaHash: string;
  providerConfigurationHash: string;
  ledgerEntryHash: string;
  frozenCoverageUnitRefs: string[];
  observedCoverageUnitRefs: string[];
  unassessedScopeRefs: string[];
  missingEvidenceRefs: string[];
  blockingConditionRefs: string[];
  validatedGapRefs: string[];
  unresolvedPriorFindingRefs: string[];
  priorFindingDispositionRefs: string[];
  requirementsVetoRefs: string[];
  passedVetoRefs: string[];
  issueCodes: string[];
  aggregateHash: string;
  decision: RequirementsAuditDecision;
}

export function compileRequirementsAuditAggregateV2(input: {
  activeAuthority: JsonRecord;
  buildManifest: JsonRecord;
  request: JsonRecord;
  response: JsonRecord;
}): JsonRecord {
  const auditPacket = isRecord(input.request.auditPacket) ? input.request.auditPacket : {};
  const body = isRecord(auditPacket.body) ? auditPacket.body : {};
  const requiredDimensionIds = uniqueSorted(body.mandatoryDimensionIds);
  const reviewedArtifactRefs = uniqueSorted(input.response.reviewedArtifactRefs);
  const reviewedMustRefs = uniqueSorted(input.response.reviewedMustRefs);
  const findings = Array.isArray(input.response.findings) ? input.response.findings : [];
  const advisories = Array.isArray(input.response.advisoryObservations)
    ? input.response.advisoryObservations
    : [];
  const issueCodes: string[] = [];
  if (input.response.verdict === 'pass' && findings.length > 0) {
    issueCodes.push('requirements_judge_pass_with_findings');
  }
  if (input.response.verdict === 'fail' && findings.length === 0) {
    issueCodes.push('requirements_judge_fail_without_findings');
  }
  if (input.activeAuthority.activeBuildManifestHash !== input.buildManifest.buildManifestHash) {
    issueCodes.push('requirements_active_build_manifest_stale');
  }
  const requirementIds = new Set(uniqueSorted(body.requirementIds));
  const artifactIds = new Set(uniqueSorted(body.artifactIds));
  const classifiedFindings = findings.map((value) => {
    const finding = isRecord(value) ? value : {};
    const affectedMustRefs = uniqueSorted(finding.affectedMustRefs);
    const affectedArtifactRefs = uniqueSorted(finding.affectedArtifactRefs);
    const existingMustAuthority =
      affectedMustRefs.length > 0 && affectedMustRefs.every((ref) => requirementIds.has(ref));
    const projectionTargets =
      affectedArtifactRefs.length > 0 && affectedArtifactRefs.every((ref) => artifactIds.has(ref));
    const classification = existingMustAuthority && projectionTargets
      ? 'projection_repair' as const
      : 'non_actionable_suggestion' as const;
    return {
      ...finding,
      classification,
      authorityBasis: classification === 'projection_repair'
        ? 'frozen_ir_contains_required_semantics'
        : 'authority_basis_unproven',
      earliestAffectedStage: classification === 'projection_repair' ? 'cp05' : null,
      latestValidPredecessorCheckpoint: classification === 'projection_repair' ? 'cp04' : null,
      successorRequestAllowed: classification === 'projection_repair',
    };
  });
  const payload = {
    schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2' as const,
    semanticRevisionId: text(input.activeAuthority.activeSemanticRevisionId),
    scopeSemanticHash: requireHash(input.activeAuthority.activeScopeSemanticHash, 'scopeSemanticHash', issueCodes),
    sourceBindingHash: requireHash(input.activeAuthority.activeSourceBindingHash, 'sourceBindingHash', issueCodes),
    buildManifestHash: requireHash(input.buildManifest.buildManifestHash, 'buildManifestHash', issueCodes),
    auditPacketHash: requireHash(input.buildManifest.auditPacketRef && (input.buildManifest.auditPacketRef as JsonRecord).hash, 'auditPacketHash', issueCodes),
    providerSelectionHash: requireHash((input.request.providerSelection as JsonRecord)?.providerSelectionHash, 'providerSelectionHash', issueCodes),
    judgeRequestHash: requireHash(input.request.judgeRequestHash, 'judgeRequestHash', issueCodes),
    judgeResponseHash: sha256Stable(input.response),
    validatedDimensionIds: requiredDimensionIds,
    reviewedArtifactRefs,
    reviewedMustRefs,
    projectionReportRefs: Array.isArray(input.buildManifest.projectionReportRefs)
      ? input.buildManifest.projectionReportRefs
      : [],
    advisories,
    findings: classifiedFindings,
    issueCodes: [...new Set(issueCodes)].sort(),
    decision: input.response.verdict === 'pass' && issueCodes.length === 0 ? 'pass' as const : 'fail' as const,
  };
  return {
    ...payload,
    requirementsAuditAggregateHash: sha256Stable({
      domain: 'requirements-contract-requirements-audit-aggregate/v2',
      payload,
    }),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(text)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
    : [];
}

function uniqueSorted(value: unknown): string[] {
  return [...new Set(strings(value))].sort((left, right) => left.localeCompare(right));
}

function requireHash(value: unknown, field: string, issues: string[]): string {
  const hash = text(value);
  if (!HASH_PATTERN.test(hash)) issues.push(`${field}_missing_or_invalid`);
  return hash;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function missingFrom(expected: readonly string[], actual: readonly string[]): string[] {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function extraFrom(expected: readonly string[], actual: readonly string[]): string[] {
  const expectedSet = new Set(expected);
  return actual.filter((value) => !expectedSet.has(value));
}

function validatedGapRefs(assessment: JsonRecord): string[] {
  const gaps = Array.isArray(assessment.validatedGaps) ? assessment.validatedGaps : [];
  return gaps
    .filter(isRecord)
    .map((gap) => text(gap.id))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function compileRequirementsAuditAggregate(input: unknown): RequirementsAuditAggregate {
  if (!isRecord(input)) throw new Error('requirements_audit_aggregate_input_invalid');
  const issues: string[] = [];
  const request = isRecord(input.request) ? input.request : {};
  const assessment = isRecord(input.assessment) ? input.assessment : {};
  const frozenScope = isRecord(input.frozenScope) ? input.frozenScope : {};
  const coverage = isRecord(input.coverage) ? input.coverage : {};
  const evidence = isRecord(input.evidence) ? input.evidence : {};
  const veto = isRecord(input.veto) ? input.veto : {};
  const priorFindings = isRecord(input.priorFindings) ? input.priorFindings : {};
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};

  if (request.actorClass !== REQUIREMENTS_ACTOR || assessment.actorClass !== REQUIREMENTS_ACTOR) {
    issues.push('role_specific_request_invalid');
  }
  if (request.judgeRole !== REQUIREMENTS_ROLE || assessment.judgeRole !== REQUIREMENTS_ROLE) {
    issues.push('role_specific_request_invalid');
  }
  if (
    assessment.verdict !== 'no_new_valid_gap' &&
    assessment.verdict !== 'no_new_confirmation_blocking_gap'
  ) {
    issues.push('model_verdict_not_pass');
  }

  const requestHash = requireHash(request.requestHash, 'requestHash', issues);
  const attemptKeyHash = requireHash(
    request.attemptKeyHash ?? request.attemptKey,
    'attemptKeyHash',
    issues
  );
  const scopeManifestHash = requireHash(request.scopeManifestHash, 'scopeManifestHash', issues);
  const evidenceManifestHash = requireHash(
    evidence.evidenceManifestHash,
    'evidenceManifestHash',
    issues
  );
  const providerInvocationReceiptHash = requireHash(
    evidence.providerInvocationReceiptHash,
    'providerInvocationReceiptHash',
    issues
  );
  const promptTemplateHash = requireHash(request.promptTemplateHash, 'promptTemplateHash', issues);
  const assessmentSchemaHash = requireHash(
    request.assessmentSchemaHash,
    'assessmentSchemaHash',
    issues
  );
  const providerConfigurationHash = requireHash(
    isRecord(request.providerAuthority)
      ? request.providerAuthority.providerConfigurationHash
      : request.providerConfigurationHash,
    'providerConfigurationHash',
    issues
  );
  const ledgerEntryHash = requireHash(priorFindings.ledgerEntryHash, 'ledgerEntryHash', issues);

  const currentChecks: Array<[string, string, string]> = [
    ['attempt_key_stale', attemptKeyHash, text(currentAuthority.attemptKeyHash)],
    ['scope_manifest_stale', scopeManifestHash, text(currentAuthority.scopeManifestHash)],
    ['evidence_manifest_stale', evidenceManifestHash, text(currentAuthority.evidenceManifestHash)],
    [
      'provider_invocation_receipt_stale',
      providerInvocationReceiptHash,
      text(currentAuthority.providerInvocationReceiptHash),
    ],
    [
      'prompt_template_binding_stale',
      promptTemplateHash,
      text(currentAuthority.promptTemplateHash),
    ],
    [
      'assessment_schema_binding_stale',
      assessmentSchemaHash,
      text(currentAuthority.assessmentSchemaHash),
    ],
    [
      'provider_configuration_binding_stale',
      providerConfigurationHash,
      text(currentAuthority.providerConfigurationHash),
    ],
  ];
  for (const [issue, actual, expected] of currentChecks) {
    if (!expected || actual !== expected) issues.push(issue);
  }

  const frozenCoverageUnitRefs = uniqueSorted(frozenScope.coverageUnitRefs);
  const observedCoverageUnitRefs = uniqueSorted(coverage.observedCoverageUnitRefs);
  const missingCoverage = missingFrom(frozenCoverageUnitRefs, observedCoverageUnitRefs);
  const extraCoverage = extraFrom(frozenCoverageUnitRefs, observedCoverageUnitRefs);
  if (!sameSet(frozenCoverageUnitRefs, observedCoverageUnitRefs)) {
    if (missingCoverage.length > 0) issues.push('observed_coverage_missing_frozen_scope');
    if (extraCoverage.length > 0) issues.push('observed_coverage_extra_scope');
  }

  const unassessedScopeRefs = uniqueSorted(coverage.unassessedScopeRefs);
  const missingEvidenceRefs = uniqueSorted(evidence.missingEvidenceRefs);
  const blockingConditionRefs = uniqueSorted(coverage.blockingConditionRefs);
  const gapRefs = validatedGapRefs(assessment);
  const unresolvedPriorFindingRefs = uniqueSorted(priorFindings.unresolvedPriorFindingRefs);
  const requiredPriorFindingRefs = uniqueSorted(priorFindings.requiredPriorFindingRefs);
  const priorFindingDispositionRefs = uniqueSorted(priorFindings.currentDispositionRefs);
  const requirementsVetoRefs = uniqueSorted(veto.requirementsVetoRefs);
  const passedVetoRefs = uniqueSorted(veto.passedVetoRefs);

  if (unassessedScopeRefs.length > 0) issues.push('unassessed_scopes_not_empty');
  if (missingEvidenceRefs.length > 0) issues.push('missing_evidence_not_empty');
  if (blockingConditionRefs.length > 0) issues.push('blocking_conditions_not_empty');
  if (gapRefs.length > 0) issues.push('validated_gaps_not_empty');
  if (unresolvedPriorFindingRefs.length > 0) issues.push('unresolved_prior_findings_not_empty');
  if (!sameSet(requiredPriorFindingRefs, priorFindingDispositionRefs)) {
    issues.push('prior_finding_disposition_incomplete');
  }
  if (!sameSet(requirementsVetoRefs, passedVetoRefs)) {
    issues.push('requirements_veto_not_passed');
  }
  if (input && Object.hasOwn(input, 'callerPass')) issues.push('caller_pass_injected');
  if (input && Object.hasOwn(input, 'expectedCoverageUnitRefs'))
    issues.push('caller_expected_coverage_injected');
  if (input && Object.hasOwn(input, 'expectedDispositionRefs'))
    issues.push('caller_expected_disposition_injected');

  const payload = {
    schemaVersion: 'requirements-contract-requirements-audit-aggregate/v1' as const,
    actorClass: REQUIREMENTS_ACTOR as typeof REQUIREMENTS_ACTOR,
    judgeRole: REQUIREMENTS_ROLE as typeof REQUIREMENTS_ROLE,
    requestHash,
    attemptKeyHash,
    scopeManifestHash,
    evidenceManifestHash,
    providerInvocationReceiptHash,
    promptTemplateHash,
    assessmentSchemaHash,
    providerConfigurationHash,
    ledgerEntryHash,
    frozenCoverageUnitRefs,
    observedCoverageUnitRefs,
    unassessedScopeRefs,
    missingEvidenceRefs,
    blockingConditionRefs,
    validatedGapRefs: gapRefs,
    unresolvedPriorFindingRefs,
    priorFindingDispositionRefs,
    requirementsVetoRefs,
    passedVetoRefs,
    issueCodes: [...new Set(issues)].sort((left, right) => left.localeCompare(right)),
  };
  const aggregate: RequirementsAuditAggregate = {
    ...payload,
    aggregateHash: sha256Stable(payload),
    decision: payload.issueCodes.length === 0 ? 'pass' : 'block',
  };
  return aggregate;
}
