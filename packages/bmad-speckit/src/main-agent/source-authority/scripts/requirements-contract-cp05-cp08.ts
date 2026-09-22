import {
  REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS,
  validateExecutionConstraintRegistry,
  type RequirementsContractSemanticIr,
  type RequirementsExecutionConstraint,
} from './requirements-contract-semantic-ir';
import { resolveEvidenceClaimAuthority, resolveRequirementsSpecSpanSourceNodeIds } from './requirements-contract-span-registry';
import type { RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics';
import { createRequirementsContractLintReport } from './requirements-contract-lint-report';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';
import {
  buildRequirementsContractJudgeAuditDraft,
  validateRequirementsContractJudgeAuditPacketCoverage,
  validateRequirementsContractJudgeAuditDraft,
} from './requirements-contract-judge-audit-packet';
import { canonicalJson } from './requirements-contract-governed-write';
import { publishRequirementsContentObject } from './requirements-contract-content-store';
import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import { runRequirementsSemanticCheckpointUnits } from './requirements-contract-semantic-checkpoint-store';
import { withoutRequirementsAuthoringOperationMetadata } from './requirements-contract-projection-normalization';

type ProjectionCheckpointId = 'cp04';
export type RequirementsContractProjectionStage = 'cp05' | 'cp06' | 'cp07' | 'cp08';

export const REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES = {
  cp05: {
    profileId: 'requirements-contract-cp05-source-confirmation-projection/v1',
    artifactRoles: ['source_markdown', 'implementation_confirmation'],
    latestValidPredecessorCheckpoint: 'cp04',
  },
  cp06: {
    profileId: 'requirements-contract-cp06-execution-projection/v1',
    artifactRoles: ['per_must_bundle', 'execution_manifest', 'compact_trace_matrix'],
    latestValidPredecessorCheckpoint: 'cp05',
  },
  cp07: {
    profileId: 'requirements-contract-cp07-view-diagram-projection/v1',
    artifactRoles: ['human_view', 'diagram_set'],
    latestValidPredecessorCheckpoint: 'cp06',
  },
  cp08: {
    profileId: 'requirements-contract-cp08-reconciliation-renderability/v1',
    artifactRoles: [
      'projection_reconciliation_report',
      'authority_resolution_report',
      'renderability_probe_report',
      'judge_audit_packet',
    ],
    latestValidPredecessorCheckpoint: 'cp07',
  },
} as const;

export const REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS = [
  'semantic_projection_reconciliation',
  'authority_resolution',
  'renderability',
  'audit_packet_coverage',
] as const;

const REQUIREMENTS_CONTRACT_PREPUBLICATION_ARTIFACT_IDS = [
  'confirmation-projection',
  'final-markdown',
  'execution-manifest',
  'per-must-bundle',
  'trace-matrix',
  'diagram-set',
  'projection-reconciliation-report',
  'authority-resolution-report',
  'renderability-probe-report',
] as const;

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

type ProjectionArtifactRole =
  (typeof REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES)[RequirementsContractProjectionStage]['artifactRoles'][number];

export function lintRequirementsContractProjectionStage(input: {
  stage: RequirementsContractProjectionStage;
  identity: {
    authoringRequestId: string;
    authoringAttemptId: string;
    attemptManifestHash: string;
    scopeSemanticHash: string;
    sourceBindingHash: string;
  };
  artifacts: Array<{ artifactId: string; role: ProjectionArtifactRole | string; value: unknown }>;
  checkedRequirementIds: string[];
}) {
  const profile = REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES[input.stage];
  const allowed = new Set<string>(profile.artifactRoles);
  const issueCodes = input.artifacts
    .filter((artifact) => !allowed.has(artifact.role))
    .map((artifact) => `requirements_${input.stage}_artifact_role_invalid:${artifact.role}`);
  const checkedArtifactIds = input.artifacts
    .filter((artifact) => allowed.has(artifact.role))
    .map((artifact) => artifact.artifactId);
  for (const requiredRole of profile.artifactRoles) {
    if (!input.artifacts.some((artifact) => artifact.role === requiredRole)) {
      issueCodes.push(`requirements_${input.stage}_artifact_role_missing:${requiredRole}`);
    }
  }
  const decision = issueCodes.length > 0 ? ('block' as const) : ('pass' as const);
  const lintReport = createRequirementsContractLintReport({
    lintStage: input.stage,
    profileId: 'requirements-projection/v1',
    inputAuthorityRefs: [],
    inputIdentity: input.identity,
    ruleSetHash: sha256Stable(profile),
    validatorIdentity: profile.profileId,
    validatorVersion: 'v1',
    validatorHash: sha256Stable({ owner: 'requirements-contract-cp05-cp08', stage: input.stage }),
    checkedArtifactIds,
    checkedRequirementIds: input.checkedRequirementIds,
    issueCodes,
    earliestAffectedStage: decision === 'block' ? input.stage : null,
    latestValidPredecessorCheckpoint:
      decision === 'block' ? profile.latestValidPredecessorCheckpoint : null,
    decision,
  });
  return {
    checkpointProfileId: profile.profileId,
    decision,
    issueCodes: lintReport.issueCodes,
    earliestAffectedStage: lintReport.earliestAffectedStage,
    latestValidPredecessorCheckpoint: lintReport.latestValidPredecessorCheckpoint,
    lintReport,
  };
}

const PUBLICATION_READY_KEYS = new Set([
  'buildIdentity',
  'semanticIr',
  'resolvedEvidenceIndex',
  'reconciliationReport',
  'authorityResolutionReport',
  'renderabilityProbeReport',
  'auditPacket',
  'coverageManifest',
  'mandatoryDimensionRegistry',
  'payloadObservation',
  'buildArtifactRoles',
]);
const RENDERABILITY_PROBE_REPORT_KEYS = new Set([
  'schemaVersion',
  'semanticRevisionId',
  'scopeSemanticHash',
  'decision',
  'promotable',
  'providerInvocationCount',
  'committerInvocationCount',
  'renderedRequirementIds',
]);
const PAYLOAD_OBSERVATION_KEYS = new Set(['serializedBytes']);

function exactStringSet(value: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return false;
  const actual = sortedUnique(value);
  return (
    actual.length === value.length &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === sortedUnique(expected)[index])
  );
}

function frozenPublicationLineageNodes(
  semanticIr: RequirementsContractSemanticIr
): RequirementsContractProjectionLineageNode[] {
  const semantics = record(semanticIr.semanticPayload.semantics);
  const requirements = records(semantics.requirements);
  const atoms = records(semantics.atoms);
  const spanIds = resolvedSpecSpanSourceIds(semanticIr);
  return requirements.map((requirement) => {
    const requirementId = nonEmpty(requirement.id);
    const spans = semanticIr.semanticPayload.specSpanRegistry.filter((span) =>
      spanIds.get(span.specSpanId)!.has(requirementId)
    );
    return {
      role: 'must',
      id: requirementId,
      factRefs: [],
      mustRefs: [requirementId],
      atomRefs: sortedUnique(
        atoms
          .filter((atom) => nonEmpty(atom.requirementRef) === requirementId)
          .map((atom) => nonEmpty(atom.id))
          .filter(Boolean)
      ),
      traceRefs: [],
      specSpanRefs: spans.map((span) => span.specSpanId),
      evidenceClaimRefs: sortedUnique(spans.flatMap((span) => span.evidenceClaimRefs)),
    };
  });
}

function resolvedSpecSpanSourceIds(semanticIr: RequirementsContractSemanticIr): Map<string, Set<string>> {
  const authority = semanticIr.semanticPayload.semantics.typedSourceAuthority as RequirementsTypedSourceAuthority | undefined;
  if (authority && semanticIr.schemaVersion !== 'requirements-contract-semantic-ir/v2') throw new Error('requirements_projection_typed_span_version_required');
  return new Map(semanticIr.semanticPayload.specSpanRegistry.map((span) => [span.specSpanId,
    new Set(resolveRequirementsSpecSpanSourceNodeIds(span, authority))]));
}

function validProjectionLineageNodeShape(value: Record<string, unknown>): boolean {
  return (
    ['fact', 'must', 'atom', 'trace', 'judge_finding_seed', 'page'].includes(
      nonEmpty(value.role)
    ) &&
    Boolean(nonEmpty(value.id)) &&
    [
      value.factRefs,
      value.mustRefs,
      value.atomRefs,
      value.traceRefs,
      value.specSpanRefs,
      value.evidenceClaimRefs,
    ].every(
      (refs) =>
        Array.isArray(refs) && refs.every((ref) => typeof ref === 'string' && ref.length > 0)
    )
  );
}

export function validateRequirementsContractPublicationReady(value: unknown) {
  const issueCodes: string[] = [];
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  for (const key of Object.keys(input)) {
    if (!PUBLICATION_READY_KEYS.has(key)) {
      issueCodes.push(`requirements_publication_ready_task4_field_forbidden:${key}`);
    }
  }
  const buildIdentity = record(input.buildIdentity);
  const buildArtifactRoles = Array.isArray(buildIdentity.artifactRoles)
    ? buildIdentity.artifactRoles
    : [];
  const declaredBuildArtifactRoles = Array.isArray(input.buildArtifactRoles)
    ? input.buildArtifactRoles.filter((role): role is string => typeof role === 'string')
    : [];
  if (
    buildIdentity.schemaVersion !== 'requirements-contract-build-input/v2' ||
    !SHA256.test(nonEmpty(buildIdentity.scopeSemanticHash)) ||
    !SHA256.test(nonEmpty(buildIdentity.sourceBindingHash)) ||
    !Array.isArray(buildIdentity.artifactRoles) ||
    buildArtifactRoles.length === 0 ||
    !buildArtifactRoles.every((role) => typeof role === 'string' && role.length > 0) ||
    new Set(buildArtifactRoles).size !== buildArtifactRoles.length
  ) {
    issueCodes.push('requirements_publication_ready_build_identity_invalid');
  }
  const reconciliationReport = record(input.reconciliationReport);
  const authorityResolutionReport = record(input.authorityResolutionReport);
  const renderabilityProbeReport = record(input.renderabilityProbeReport);
  for (const [key, report] of [
    ['reconciliationReport', reconciliationReport],
    ['authorityResolutionReport', authorityResolutionReport],
    ['renderabilityProbeReport', renderabilityProbeReport],
  ] as const) {
    if (report.decision !== 'pass') {
      issueCodes.push(`requirements_publication_ready_${key}_blocked`);
    }
  }
  const probe = input.renderabilityProbeReport as Record<string, unknown> | undefined;
  if (probe?.promotable !== false) {
    issueCodes.push('requirements_publication_ready_probe_promotable_forbidden');
  }
  const packet = input.auditPacket as Record<string, unknown> | undefined;
  let packetBody: Record<string, unknown> = {};
  try { packetBody = record(validateRequirementsContractJudgeAuditDraft(packet).body); }
  catch (error) { issueCodes.push(error instanceof Error ? error.message : 'judge_audit_packet_coverage_gap'); }
  if (Object.keys(packetBody).length === 0) {
    issueCodes.push('judge_audit_packet_coverage_gap');
  }
  const packetPayloadCoverage = validateRequirementsContractJudgeAuditPacketCoverage({
    packet,
    expectedArtifactIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_ARTIFACT_IDS],
  });
  issueCodes.push(...packetPayloadCoverage.issueCodes);
  const coverage = input.coverageManifest as Record<string, unknown> | undefined;
  if (
    coverage?.allApplicableArtifactsIncluded !== true ||
    !Array.isArray(coverage.omittedArtifactIds) ||
    coverage.omittedArtifactIds.length > 0
  ) {
    issueCodes.push('judge_audit_packet_coverage_gap');
  }
  const dimensions = input.mandatoryDimensionRegistry as Record<string, unknown> | undefined;
  if (!Array.isArray(dimensions?.dimensionIds) || dimensions.dimensionIds.length === 0) {
    issueCodes.push('requirements_publication_ready_mandatory_dimensions_missing');
  }
  const semanticIr = input.semanticIr as RequirementsContractSemanticIr | undefined;
  const resolvedEvidenceIndex = input.resolvedEvidenceIndex as
    | Parameters<typeof reconcileRequirementsContractProjectionLineage>[0]['resolvedEvidenceIndex']
    | undefined;
  if (
    !semanticIr ||
    !resolvedEvidenceIndex ||
    buildIdentity.scopeSemanticHash !== semanticIr.scopeSemanticHash ||
    buildIdentity.sourceBindingHash !== nonEmpty(record(input.resolvedEvidenceIndex).sourceBindingHash)
  ) {
    issueCodes.push('requirements_publication_ready_build_identity_invalid');
  }
  const semanticPayload = record(semanticIr?.semanticPayload);
  const semantics = record(semanticPayload.semantics);
  const requirementRows = records(semantics.requirements);
  const frozenRequirementIds = requirementRows
    .map((requirement) => nonEmpty(requirement.id))
    .filter(Boolean);
  const specSpanRows = records(semanticPayload.specSpanRegistry);
  const evidenceClaimRows = records(semanticPayload.evidenceClaims);
  const specSpanRegistryValid =
    Array.isArray(semanticPayload.specSpanRegistry) &&
    specSpanRows.length === semanticPayload.specSpanRegistry.length &&
    specSpanRows.every(
      (span) =>
        Boolean(nonEmpty(span.specSpanId)) &&
        Array.isArray(span.boundObligationIds) &&
        span.boundObligationIds.every((ref) => typeof ref === 'string' && ref.length > 0) &&
        Array.isArray(span.evidenceClaimRefs) &&
        span.evidenceClaimRefs.every((ref) => typeof ref === 'string' && ref.length > 0)
    );
  const evidenceClaimRegistryValid =
    Array.isArray(semanticPayload.evidenceClaims) &&
    evidenceClaimRows.length === semanticPayload.evidenceClaims.length &&
    evidenceClaimRows.every(
      (claim) =>
        Boolean(nonEmpty(claim.evidenceClaimId)) &&
        ['source_grounded', 'human_confirmed', 'derived'].includes(nonEmpty(claim.authorityClass))
    );
  const frozenSemanticInputValid =
    ['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2'].includes(
      semanticIr?.schemaVersion
    ) &&
    frozenRequirementIds.length > 0 &&
    frozenRequirementIds.length === requirementRows.length &&
    specSpanRegistryValid &&
    evidenceClaimRegistryValid &&
    Array.isArray(resolvedEvidenceIndex?.resolutions);
  if (!frozenSemanticInputValid) {
    issueCodes.push('requirements_publication_ready_frozen_semantic_ir_invalid');
  } else {
    if (
      !exactStringSet(packetBody.requirementIds, frozenRequirementIds) ||
      !exactStringSet(coverage?.requirementIds, frozenRequirementIds)
    ) {
      issueCodes.push('requirements_publication_ready_requirement_coverage_gap');
    }
    if (
      !exactStringSet(packetBody.artifactIds, REQUIREMENTS_CONTRACT_PREPUBLICATION_ARTIFACT_IDS) ||
      !exactStringSet(coverage?.artifactIds, REQUIREMENTS_CONTRACT_PREPUBLICATION_ARTIFACT_IDS)
    ) {
      issueCodes.push('requirements_publication_ready_artifact_coverage_gap');
    }
    if (
      !exactStringSet(
        packetBody.mandatoryDimensionIds,
        REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS
      ) ||
      !exactStringSet(
        coverage?.mandatoryDimensionIds,
        REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS
      ) ||
      !exactStringSet(dimensions?.dimensionIds, REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS)
    ) {
      issueCodes.push('requirements_publication_ready_mandatory_dimensions_mismatch');
    }

    const expectedLineageNodes = frozenPublicationLineageNodes(semanticIr);
    const packetLineageRecords = records(packetBody.lineageNodes);
    const packetLineageShapeValid =
      Array.isArray(packetBody.lineageNodes) &&
      packetLineageRecords.length === packetBody.lineageNodes.length &&
      packetLineageRecords.every(validProjectionLineageNodeShape);
    const packetLineageNodes = packetLineageShapeValid
      ? (packetLineageRecords as unknown as RequirementsContractProjectionLineageNode[])
      : [];
    const expectedLineageIds = expectedLineageNodes.map((node) => node.id);
    const packetLineageIds = packetLineageNodes.map((node) => nonEmpty(node.id));
    if (!exactStringSet(packetLineageIds, expectedLineageIds)) {
      issueCodes.push('requirements_publication_ready_lineage_coverage_gap');
    }
    const packetLineageValidation = packetLineageShapeValid
      ? reconcileRequirementsContractProjectionLineage({
          semanticIr,
          nodes: packetLineageNodes,
          resolvedEvidenceIndex: resolvedEvidenceIndex!,
        })
      : { decision: 'block' as const };
    if (
      packetLineageValidation.decision === 'block' ||
      sha256Stable(packetLineageNodes) !== sha256Stable(expectedLineageNodes)
    ) {
      issueCodes.push('requirements_publication_ready_lineage_invalid');
    }

    const expectedAuthority = reconcileRequirementsContractProjectionLineage({
      semanticIr,
      nodes: expectedLineageNodes,
      resolvedEvidenceIndex: resolvedEvidenceIndex!,
    });
    const expectedReconciliationReport = {
      schemaVersion: 'requirements-contract-projection-reconciliation-report/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      decision: 'pass',
      requirementIds: frozenRequirementIds,
      nodes: expectedLineageNodes,
    };
    if (sha256Stable(reconciliationReport) !== sha256Stable(expectedReconciliationReport)) {
      issueCodes.push('requirements_publication_ready_reconciliation_report_invalid');
    }
    const expectedAuthorityReport = {
      schemaVersion: 'requirements-contract-authority-resolution-report/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      decision: 'pass',
      resolutions: expectedAuthority.authorityResolutions,
    };
    if (sha256Stable(authorityResolutionReport) !== sha256Stable(expectedAuthorityReport)) {
      issueCodes.push('requirements_publication_ready_authority_resolution_report_invalid');
    }
    const renderedRequirementIds = renderabilityProbeReport.renderedRequirementIds;
    if (
      renderabilityProbeReport.schemaVersion !==
        'requirements-contract-renderability-probe-report/v1' ||
      renderabilityProbeReport.semanticRevisionId !== semanticIr.semanticRevisionId ||
      renderabilityProbeReport.scopeSemanticHash !== semanticIr.scopeSemanticHash ||
      renderabilityProbeReport.promotable !== false ||
      renderabilityProbeReport.providerInvocationCount !== 0 ||
      renderabilityProbeReport.committerInvocationCount !== 0 ||
      Object.keys(renderabilityProbeReport).some(
        (key) => !RENDERABILITY_PROBE_REPORT_KEYS.has(key)
      ) ||
      !exactStringSet(renderedRequirementIds, frozenRequirementIds)
    ) {
      issueCodes.push('requirements_publication_ready_renderability_probe_report_invalid');
    }
    const packetAuthorityResolutions = records(packetBody.authorityResolutions);
    const expectedAuthorityIds = expectedAuthority.authorityResolutions.map(
      (resolution) => resolution.evidenceClaimId
    );
    const packetAuthorityIds = packetAuthorityResolutions.map((resolution) =>
      nonEmpty(resolution.evidenceClaimId)
    );
    if (!exactStringSet(packetAuthorityIds, expectedAuthorityIds)) {
      issueCodes.push('requirements_publication_ready_authority_resolution_coverage_gap');
    }
    if (
      expectedAuthority.decision === 'block' ||
      sha256Stable(packetAuthorityResolutions) !==
        sha256Stable(expectedAuthority.authorityResolutions)
    ) {
      issueCodes.push('requirements_publication_ready_authority_resolution_invalid');
    }
  }
  const payloadObservation = input.payloadObservation as Record<string, unknown> | undefined;
  if (
    !Number.isSafeInteger(payloadObservation?.serializedBytes) ||
    Object.keys(payloadObservation ?? {}).some((key) => !PAYLOAD_OBSERVATION_KEYS.has(key)) ||
    Number(payloadObservation?.serializedBytes) < 0 ||
    Number(payloadObservation?.serializedBytes) !==
      Buffer.byteLength(canonicalJson(input.auditPacket), 'utf8')
  ) {
    issueCodes.push('requirements_publication_ready_payload_observation_invalid');
  }
  if (
    declaredBuildArtifactRoles.length === 0 ||
    !exactStringSet(declaredBuildArtifactRoles, buildArtifactRoles)
  ) {
    issueCodes.push('requirements_publication_ready_build_artifact_roles_missing');
  }
  const uniqueIssues = sortedUnique(issueCodes);
  return {
    decision: uniqueIssues.length > 0 ? ('block' as const) : ('pass' as const),
    issueCodes: uniqueIssues,
    providerInvocationCount: 0 as const,
    committerInvocationCount: 0 as const,
  };
}

export interface RequirementsContractProjectionLineageNode {
  role: 'fact' | 'must' | 'atom' | 'trace' | 'judge_finding_seed' | 'page';
  id: string;
  factRefs: string[];
  mustRefs: string[];
  atomRefs: string[];
  traceRefs: string[];
  specSpanRefs: string[];
  evidenceClaimRefs: string[];
}

function semanticIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== 'object') return;
    const record = current as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id.length > 0) ids.add(record.id);
    Object.values(record).forEach(visit);
  };
  visit(value);
  return ids;
}

export function reconcileRequirementsContractProjectionLineage(input: {
  semanticIr: RequirementsContractSemanticIr;
  nodes: RequirementsContractProjectionLineageNode[];
  resolvedEvidenceIndex: {
    semanticRevisionId: string;
    resolutions: Array<{
      evidenceClaimId: string;
      authorityClass: 'source_grounded' | 'human_confirmed' | 'derived';
      sourceSpanRefs: string[];
      decisionReceiptRefs: string[];
      premiseRefs: string[];
      derivationReceiptRefs: string[];
    }>;
  };
}) {
  const issueCodes: string[] = [];
  const frozenIds = semanticIds(input.semanticIr.semanticPayload.semantics);
  const specSpanIds = new Set(
    input.semanticIr.semanticPayload.specSpanRegistry.map((span) => span.specSpanId)
  );
  const claimById = new Map(
    input.semanticIr.semanticPayload.evidenceClaims.map((claim) => [claim.evidenceClaimId, claim])
  );
  if (input.resolvedEvidenceIndex.semanticRevisionId !== input.semanticIr.semanticRevisionId) {
    issueCodes.push('requirements_projection_resolved_evidence_semantic_identity_mismatch');
  }
  const resolutionByClaim = new Map(
    input.resolvedEvidenceIndex.resolutions.map((resolution) => [
      resolution.evidenceClaimId,
      resolution,
    ])
  );
  for (const node of input.nodes) {
    for (const ref of [...node.factRefs, ...node.mustRefs, ...node.atomRefs, ...node.traceRefs]) {
      if (!frozenIds.has(ref)) {
        issueCodes.push(`requirements_projection_unknown_semantic_id:${ref}`);
      }
    }
    for (const ref of node.specSpanRefs) {
      if (!specSpanIds.has(ref))
        issueCodes.push(`requirements_projection_unknown_spec_span:${ref}`);
    }
    for (const ref of node.evidenceClaimRefs) {
      if (!claimById.has(ref))
        issueCodes.push(`requirements_projection_unknown_evidence_claim:${ref}`);
    }
  }
  const authorityResolutions = [...claimById.values()]
    .map((claim) => {
      const resolution = resolutionByClaim.get(claim.evidenceClaimId);
      if (!resolution || resolution.authorityClass !== claim.authorityClass) {
        issueCodes.push(
          `requirements_projection_authority_resolution_missing:${claim.evidenceClaimId}`
        );
        return null;
      }
      const validation = resolveEvidenceClaimAuthority(resolution);
      issueCodes.push(
        ...validation.issueCodes.map(
          (code) =>
            `requirements_projection_authority_resolution_invalid:${claim.evidenceClaimId}:${code}`
        )
      );
      return {
        evidenceClaimId: resolution.evidenceClaimId,
        authorityClass: resolution.authorityClass,
        branch: validation.branch,
        sourceSpanRefs: sortedUnique(resolution.sourceSpanRefs),
        decisionReceiptRefs: sortedUnique(resolution.decisionReceiptRefs),
        premiseRefs: sortedUnique(resolution.premiseRefs),
        derivationReceiptRefs: sortedUnique(resolution.derivationReceiptRefs),
      };
    })
    .filter((resolution): resolution is NonNullable<typeof resolution> => resolution !== null)
    .sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId));
  const uniqueIssues = sortedUnique(issueCodes);
  return {
    decision: uniqueIssues.length > 0 ? ('block' as const) : ('pass' as const),
    issueCodes: uniqueIssues,
    earliestAffectedStage: uniqueIssues.length > 0 ? ('cp05' as const) : null,
    latestValidPredecessorCheckpoint: uniqueIssues.length > 0 ? ('cp04' as const) : null,
    semanticMutationAccepted: false as const,
    nodes: structuredClone(input.nodes),
    authorityResolutions,
  };
}

export interface RequirementsContractFrozenProjectionInput {
  checkpointId: ProjectionCheckpointId;
  checkpointStatus: 'passed';
  readbackVerified: true;
  semanticIr: Pick<
    RequirementsContractSemanticIr,
    'schemaVersion' | 'semanticRevisionId' | 'scopeSemanticHash'
  > & {
    semanticPayload: Pick<
      RequirementsContractSemanticIr['semanticPayload'],
      'executionConstraints' | 'executionConstraintRegistryHash'
    >;
  };
}

export interface RequirementsContractCp06ExecutionProjectionResult {
  decision: 'pass' | 'block';
  issueCodes: string[];
  earliestAffectedStage: 'cp02' | 'cp04' | null;
  latestValidPredecessorCheckpoint: 'cp01' | 'cp03' | null;
  nextAction: 'await_shared_technical_resolver_input_change' | 'restore_cp04_frozen_ir' | null;
  executionManifest: {
    schemaVersion: 'requirements-contract-execution-manifest/v1' | 'requirements-contract-execution-manifest/v2';
    semanticRevisionId: string;
    scopeSemanticHash: string;
    constraints: RequirementsExecutionConstraint[];
  };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneConstraint(
  constraint: RequirementsExecutionConstraint
): RequirementsExecutionConstraint {
  return {
    ...structuredClone(constraint),
    constraintId: constraint.constraintId,
    kind: constraint.kind,
    canonicalValue: constraint.canonicalValue,
    applicableMustRefs: sortedUnique(constraint.applicableMustRefs),
    applicableAtomRefs: sortedUnique(constraint.applicableAtomRefs),
    premiseRefs: sortedUnique(constraint.premiseRefs),
    derivationReceiptRefs: sortedUnique(constraint.derivationReceiptRefs),
    disposition: constraint.disposition,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(record).filter((entry) => Object.keys(entry).length > 0)
    : [];
}

function nonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function projectionIdentity(input: {
  authoringRequestId: string;
  authoringAttemptId: string;
  attemptManifestHash: string;
  semanticIr: RequirementsContractSemanticIr;
  sourceBinding: Record<string, unknown>;
}) {
  return {
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    attemptManifestHash: input.attemptManifestHash,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    sourceBindingHash: nonEmpty(input.sourceBinding.sourceBindingHash),
  };
}

function semanticRequirementRows(semanticIr: RequirementsContractSemanticIr) {
  const semantics = record(semanticIr.semanticPayload.semantics);
  const rows = records(semantics.requirements);
  const spanIds = resolvedSpecSpanSourceIds(semanticIr);
  if (rows.length === 0) throw new Error('requirements_cp05_frozen_requirement_rows_missing');
  return rows.map((row) => {
    const id = nonEmpty(row.id);
    const requirementKind = nonEmpty(row.requirementKind);
    const polarity = nonEmpty(row.polarity);
    if (!id) throw new Error('requirements_cp05_frozen_requirement_id_missing');
    if (!['functional', 'nonfunctional', 'negative'].includes(requirementKind)) {
      throw new Error(`requirements_cp05_frozen_requirement_kind_invalid:${id}`);
    }
    if (
      !['positive', 'negative'].includes(polarity) ||
      (requirementKind === 'negative' && polarity !== 'negative') ||
      (requirementKind !== 'negative' && polarity !== 'positive')
    ) {
      throw new Error(`requirements_cp05_frozen_requirement_polarity_invalid:${id}`);
    }
    const negativeAssertion = nonEmpty(row.negativeAssertion);
    const blockingCondition = nonEmpty(row.blockingCondition);
    if (requirementKind === 'negative' && (!negativeAssertion || !blockingCondition)) {
      throw new Error(`requirements_cp05_frozen_negative_fields_missing:${id}`);
    }
    return {
      id,
      text: nonEmpty(row.text),
      oracle: nonEmpty(row.oracle),
      requirementKind,
      polarity,
      ...(requirementKind === 'negative' ? { negativeAssertion, blockingCondition } : {}),
      atomRefs: sortedUnique(
        records(semantics.atoms)
          .filter((atom) => nonEmpty(atom.requirementRef) === id)
          .map((atom) => nonEmpty(atom.id))
          .filter(Boolean)
      ),
      evidenceClaimRefs: sortedUnique(
        semanticIr.semanticPayload.specSpanRegistry
          .filter((span) => spanIds.get(span.specSpanId)!.has(id))
          .flatMap((span) => span.evidenceClaimRefs)
      ),
    };
  });
}

type ProjectionInput = {
  semanticIr: RequirementsContractSemanticIr;
  resolvedEvidenceIndex: {
    semanticRevisionId: string;
    resolutions: Array<{
      evidenceClaimId: string;
      authorityClass: 'source_grounded' | 'human_confirmed' | 'derived';
      sourceSpanRefs: string[];
      decisionReceiptRefs: string[];
      premiseRefs: string[];
      derivationReceiptRefs: string[];
    }>;
  };
};

function projectionContext(input: ProjectionInput) {
  const requirements = semanticRequirementRows(input.semanticIr);
  const requirementIds = requirements.map((row) => row.id);
  const atoms = records(record(input.semanticIr.semanticPayload.semantics).atoms);
  const spanIds = resolvedSpecSpanSourceIds(input.semanticIr);
  const lineageNodes: RequirementsContractProjectionLineageNode[] = requirements.map((row) => ({
    role: 'must', id: row.id, factRefs: [], mustRefs: [row.id], atomRefs: row.atomRefs,
    traceRefs: [],
    specSpanRefs: input.semanticIr.semanticPayload.specSpanRegistry
      .filter((span) => spanIds.get(span.specSpanId)!.has(row.id))
      .map((span) => span.specSpanId),
    evidenceClaimRefs: row.evidenceClaimRefs,
  }));
  const reconciliation = reconcileRequirementsContractProjectionLineage({
    semanticIr: input.semanticIr,
    nodes: lineageNodes,
    resolvedEvidenceIndex: input.resolvedEvidenceIndex,
  });
  if (reconciliation.decision === 'block') throw new Error(reconciliation.issueCodes[0]);
  return { requirements, requirementIds, atoms, lineageNodes, reconciliation };
}

export function prepareRequirementsContractCp05Projection(input: ProjectionInput) {
  const { requirements, requirementIds } = projectionContext(input);
  const cp05Projection = {
    schemaVersion: input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2'
      ? 'requirements-contract-confirmation-projection/v2' : 'requirements-contract-confirmation-projection/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirements,
    ...(input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2' ? {
      typedSourceAuthority: input.semanticIr.semanticPayload.semantics.typedSourceAuthority,
      typedCoverage: input.semanticIr.semanticPayload.semantics.typedCoverage,
      implementationConfirmation: input.semanticIr.semanticPayload.semantics.implementationConfirmation,
    } : {}),
  };
  const markdownParts: Array<string | { canonicalJson: unknown }> = [
    '# Requirements', '',
    ...requirements.flatMap((row) => [
      `## ${row.id}`, '', row.text, '', `Oracle: ${row.oracle}`, '',
    ]),
    ...(input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2' ? [
      '## Typed Source Authority', '', '```json', { canonicalJson: {
        schemaVersion: 'requirements-contract-source-projection/v2',
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        typedSourceAuthority: input.semanticIr.semanticPayload.semantics.typedSourceAuthority,
        typedCoverage: input.semanticIr.semanticPayload.semantics.typedCoverage,
      } }, '```', '',
    ] : []),
  ];
  const markdownComposition = {
    schemaVersion: 'RequirementsMarkdownComposition/v2' as const,
    separator: '\n',
    parts: markdownParts,
  };
  const markdown = markdownParts
    .map((part) => typeof part === 'string' ? part : canonicalJson(part.canonicalJson))
    .join('\n');
  return { requirements, requirementIds, cp05Projection, markdown, markdownComposition };
}

export function prepareRequirementsContractCp06Projection(input: ProjectionInput) {
  const { requirements, lineageNodes } = projectionContext(input);
  const cp06Execution = projectRequirementsContractCp06ExecutionManifest({
    checkpointId: 'cp04', checkpointStatus: 'passed', readbackVerified: true,
    semanticIr: input.semanticIr,
    requiredConstraintIds: input.semanticIr.semanticPayload.executionConstraints.map(
      (constraint) => constraint.constraintId
    ),
  });
  if (cp06Execution.decision === 'block') throw new Error(cp06Execution.issueCodes[0]);
  const perMustBundle = {
    schemaVersion: 'requirements-contract-per-must-bundle/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    bundles: requirements.map((row) => ({
      mustId: row.id,
      atomRefs: row.atomRefs,
      evidenceClaimRefs: row.evidenceClaimRefs,
      executionConstraintRefs: input.semanticIr.semanticPayload.executionConstraints
        .filter((constraint) => constraint.applicableMustRefs.includes(row.id))
        .map((constraint) => constraint.constraintId),
    })),
  };
  const traceMatrix = {
    schemaVersion: 'requirements-contract-trace-matrix/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    rows: lineageNodes,
  };
  return { cp06Execution, perMustBundle, traceMatrix };
}

export function prepareRequirementsContractCp07Projection(input: ProjectionInput) {
  const { requirementIds, atoms } = projectionContext(input);
  return {
    diagramSet: {
      schemaVersion: 'requirements-contract-diagram-set/v1',
      semanticRevisionId: input.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.semanticIr.scopeSemanticHash,
      diagrams: [{
        diagramId: 'DIAGRAM-REQUIREMENTS',
        nodeRefs: requirementIds,
        edges: atoms.map((atom) => ({
          from: nonEmpty(atom.requirementRef),
          to: nonEmpty(atom.id),
        })),
      }],
    },
  };
}

export function prepareRequirementsContractCp08Projection(input: ProjectionInput & {
  cp05Projection: unknown;
  markdown: string;
  markdownComposition: RequirementsContractJudgeAuditArtifact['composition'];
  executionManifest: unknown;
  perMustBundle: unknown;
  traceMatrix: unknown;
  diagramSet: unknown;
}) {
  const { requirementIds, lineageNodes, reconciliation } = projectionContext(input);
  const reconciliationReport = {
    schemaVersion: 'requirements-contract-projection-reconciliation-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass', requirementIds, nodes: reconciliation.nodes,
  };
  const authorityResolutionReport = {
    schemaVersion: 'requirements-contract-authority-resolution-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass', resolutions: reconciliation.authorityResolutions,
  };
  const renderabilityProbeReport = {
    schemaVersion: 'requirements-contract-renderability-probe-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass', promotable: false, providerInvocationCount: 0, committerInvocationCount: 0,
    renderedRequirementIds: requirementIds,
  };
  const auditPacketBuild = buildRequirementsContractJudgeAuditDraft({
    semanticIr: input.semanticIr,
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirementIds,
    mandatoryDimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    lineageNodes,
    authorityResolutions: reconciliation.authorityResolutions,
    artifacts: [
      { artifactId: 'confirmation-projection', payload: input.cp05Projection },
      { artifactId: 'final-markdown', payload: input.markdown, composition: input.markdownComposition },
      { artifactId: 'execution-manifest', payload: input.executionManifest },
      { artifactId: 'per-must-bundle', payload: input.perMustBundle },
      { artifactId: 'trace-matrix', payload: input.traceMatrix },
      { artifactId: 'diagram-set', payload: input.diagramSet },
      { artifactId: 'projection-reconciliation-report', payload: reconciliationReport },
      { artifactId: 'authority-resolution-report', payload: authorityResolutionReport },
      { artifactId: 'renderability-probe-report', payload: renderabilityProbeReport },
    ],
  });
  const auditPacket = auditPacketBuild.packet;
  const auditPacketBody = record(validateRequirementsContractJudgeAuditDraft(auditPacket).body);
  const coverageManifest = {
    schemaVersion: 'requirements-contract-judge-audit-packet-coverage/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirementIds,
    artifactIds: auditPacketBody.artifactIds,
    mandatoryDimensionIds: auditPacketBody.mandatoryDimensionIds,
    omittedArtifactIds: [],
    allApplicableArtifactsIncluded: true,
  };
  return { requirementIds, lineageNodes, reconciliation, reconciliationReport,
    authorityResolutionReport, renderabilityProbeReport, auditPacketBuild, auditPacket,
    auditPacketBody, serializedBytes: auditPacketBuild.serializedBytes, coverageManifest };
}

export function prepareRequirementsContractCp05Cp08Projection(
  input: Pick<RequirementsContractCp05Cp08PublicationInput, 'semanticIr' | 'resolvedEvidenceIndex'>
) {
  const requirements = semanticRequirementRows(input.semanticIr);
  const requirementIds = requirements.map((row) => row.id);
  const atoms = records(record(input.semanticIr.semanticPayload.semantics).atoms);
  const spanIds = resolvedSpecSpanSourceIds(input.semanticIr);
  const lineageNodes: RequirementsContractProjectionLineageNode[] = requirements.map((row) => ({
    role: 'must',
    id: row.id,
    factRefs: [],
    mustRefs: [row.id],
    atomRefs: row.atomRefs,
    traceRefs: [],
    specSpanRefs: input.semanticIr.semanticPayload.specSpanRegistry
      .filter((span) => spanIds.get(span.specSpanId)!.has(row.id))
      .map((span) => span.specSpanId),
    evidenceClaimRefs: row.evidenceClaimRefs,
  }));
  const reconciliation = reconcileRequirementsContractProjectionLineage({
    semanticIr: input.semanticIr,
    nodes: lineageNodes,
    resolvedEvidenceIndex: input.resolvedEvidenceIndex,
  });
  if (reconciliation.decision === 'block') throw new Error(reconciliation.issueCodes[0]);

  const cp05Projection = {
    schemaVersion: input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2'
      ? 'requirements-contract-confirmation-projection/v2' : 'requirements-contract-confirmation-projection/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirements,
    ...(input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2' ? {
      typedSourceAuthority: input.semanticIr.semanticPayload.semantics.typedSourceAuthority,
      typedCoverage: input.semanticIr.semanticPayload.semantics.typedCoverage,
      implementationConfirmation: input.semanticIr.semanticPayload.semantics.implementationConfirmation,
    } : {}),
  };
  const markdownParts: Array<string | { canonicalJson: unknown }> = [
    '# Requirements',
    '',
    ...requirements.flatMap((row) => [
      `## ${row.id}`,
      '',
      row.text,
      '',
      `Oracle: ${row.oracle}`,
      '',
    ]),
    ...(input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2' ? [
      '## Typed Source Authority', '', '```json', { canonicalJson: {
        schemaVersion: 'requirements-contract-source-projection/v2',
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        typedSourceAuthority: input.semanticIr.semanticPayload.semantics.typedSourceAuthority,
        typedCoverage: input.semanticIr.semanticPayload.semantics.typedCoverage,
      } }, '```', '',
    ] : []),
  ];
  const markdownComposition = { schemaVersion: 'RequirementsMarkdownComposition/v2' as const,
    separator: '\n', parts: markdownParts };
  const markdown = markdownParts.map((part) => typeof part === 'string' ? part : canonicalJson(part.canonicalJson)).join('\n');
  const cp06Execution = projectRequirementsContractCp06ExecutionManifest({
    checkpointId: 'cp04',
    checkpointStatus: 'passed',
    readbackVerified: true,
    semanticIr: input.semanticIr,
    requiredConstraintIds: input.semanticIr.semanticPayload.executionConstraints.map(
      (constraint) => constraint.constraintId
    ),
  });
  if (cp06Execution.decision === 'block') throw new Error(cp06Execution.issueCodes[0]);
  const perMustBundle = {
    schemaVersion: 'requirements-contract-per-must-bundle/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    bundles: requirements.map((row) => ({
      mustId: row.id,
      atomRefs: row.atomRefs,
      evidenceClaimRefs: row.evidenceClaimRefs,
      executionConstraintRefs: input.semanticIr.semanticPayload.executionConstraints
        .filter((constraint) => constraint.applicableMustRefs.includes(row.id))
        .map((constraint) => constraint.constraintId),
    })),
  };
  const traceMatrix = {
    schemaVersion: 'requirements-contract-trace-matrix/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    rows: lineageNodes,
  };
  const diagramSet = {
    schemaVersion: 'requirements-contract-diagram-set/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    diagrams: [
      {
        diagramId: 'DIAGRAM-REQUIREMENTS',
        nodeRefs: requirementIds,
        edges: atoms.map((atom) => ({
          from: nonEmpty(atom.requirementRef),
          to: nonEmpty(atom.id),
        })),
      },
    ],
  };
  const reconciliationReport = {
    schemaVersion: 'requirements-contract-projection-reconciliation-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass',
    requirementIds,
    nodes: reconciliation.nodes,
  };
  const authorityResolutionReport = {
    schemaVersion: 'requirements-contract-authority-resolution-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass',
    resolutions: reconciliation.authorityResolutions,
  };
  const renderabilityProbeReport = {
    schemaVersion: 'requirements-contract-renderability-probe-report/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    decision: 'pass',
    promotable: false,
    providerInvocationCount: 0,
    committerInvocationCount: 0,
    renderedRequirementIds: requirementIds,
  };
  const auditPacketBuild = buildRequirementsContractJudgeAuditDraft({
    semanticIr: input.semanticIr,
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirementIds,
    mandatoryDimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    lineageNodes,
    authorityResolutions: reconciliation.authorityResolutions,
    artifacts: [
      { artifactId: 'confirmation-projection', payload: cp05Projection },
      { artifactId: 'final-markdown', payload: markdown, composition: markdownComposition },
      { artifactId: 'execution-manifest', payload: cp06Execution.executionManifest },
      { artifactId: 'per-must-bundle', payload: perMustBundle },
      { artifactId: 'trace-matrix', payload: traceMatrix },
      { artifactId: 'diagram-set', payload: diagramSet },
      { artifactId: 'projection-reconciliation-report', payload: reconciliationReport },
      { artifactId: 'authority-resolution-report', payload: authorityResolutionReport },
      { artifactId: 'renderability-probe-report', payload: renderabilityProbeReport },
    ],
  });
  const auditPacket = auditPacketBuild.packet;
  const auditPacketBody = record(validateRequirementsContractJudgeAuditDraft(auditPacket).body);
  const serializedBytes = auditPacketBuild.serializedBytes;
  const coverageManifest = {
    schemaVersion: 'requirements-contract-judge-audit-packet-coverage/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirementIds,
    artifactIds: auditPacketBody.artifactIds,
    mandatoryDimensionIds: auditPacketBody.mandatoryDimensionIds,
    omittedArtifactIds: [],
    allApplicableArtifactsIncluded: true,
  };

  return { requirements, requirementIds, atoms, lineageNodes, reconciliation, cp05Projection, markdown,
    cp06Execution, perMustBundle, traceMatrix, diagramSet, reconciliationReport, authorityResolutionReport,
    renderabilityProbeReport, auditPacketBuild, auditPacket, auditPacketBody, serializedBytes, coverageManifest };
}

export function projectRequirementsContractCp06ExecutionManifest(
  input: RequirementsContractFrozenProjectionInput & { requiredConstraintIds: string[] }
): RequirementsContractCp06ExecutionProjectionResult {
  if (
    input.checkpointId !== 'cp04' ||
    input.checkpointStatus !== 'passed' ||
    input.readbackVerified !== true ||
    !['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2'].includes(input.semanticIr?.schemaVersion)
  ) {
    return {
      decision: 'block',
      issueCodes: ['requirements_cp06_cp04_frozen_ir_required'],
      earliestAffectedStage: 'cp04',
      latestValidPredecessorCheckpoint: 'cp03',
      nextAction: 'restore_cp04_frozen_ir',
      executionManifest: emptyManifest(input),
    };
  }
  const registry = input.semanticIr.semanticPayload;
  const validation = validateExecutionConstraintRegistry(registry);
  if (validation.decision === 'block') {
    return {
      decision: 'block',
      issueCodes: validation.issueCodes.map((code) => `requirements_cp06_${code}`),
      earliestAffectedStage: 'cp02',
      latestValidPredecessorCheckpoint: 'cp01',
      nextAction: 'await_shared_technical_resolver_input_change',
      executionManifest: emptyManifest(input),
    };
  }
  const constraints = registry.executionConstraints;
  const byId = new Map(constraints.map((constraint) => [constraint.constraintId, constraint]));
  const issueCodes: string[] = [];
  const projected: RequirementsExecutionConstraint[] = [];
  for (const constraintId of sortedUnique(input.requiredConstraintIds)) {
    const constraint = byId.get(constraintId);
    if (!constraint) {
      issueCodes.push(`requirements_cp06_execution_constraint_missing:${constraintId}`);
      continue;
    }
    if (
      !REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS.includes(constraint.kind) ||
      !constraint.constraintId.startsWith(`${constraint.kind}-`)
    ) {
      issueCodes.push(`requirements_cp06_execution_constraint_invalid:${constraintId}`);
      continue;
    }
    if (constraint.disposition !== 'proven') {
      issueCodes.push(`requirements_cp06_execution_constraint_unresolved:${constraintId}`);
      continue;
    }
    projected.push(cloneConstraint(constraint));
  }
  const blocked = issueCodes.length > 0;
  return {
    decision: blocked ? 'block' : 'pass',
    issueCodes: sortedUnique(issueCodes),
    earliestAffectedStage: blocked ? 'cp02' : null,
    latestValidPredecessorCheckpoint: blocked ? 'cp01' : null,
    nextAction: blocked ? 'await_shared_technical_resolver_input_change' : null,
    executionManifest: {
      schemaVersion: input.semanticIr.schemaVersion === 'requirements-contract-semantic-ir/v2'
        ? 'requirements-contract-execution-manifest/v2' : 'requirements-contract-execution-manifest/v1',
      semanticRevisionId: input.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.semanticIr.scopeSemanticHash,
      constraints: projected.sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId)
      ),
    },
  };
}
