import { createRequire } from 'node:module';
import path from 'node:path';
import { resolvePackageOwnedBmadPath } from '../../runtime/package-bmad-root';
import {
  REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS,
  validateExecutionConstraintRegistry,
  type RequirementsContractSemanticIr,
  type RequirementsExecutionConstraint,
} from './requirements-contract-semantic-ir';
import { resolveEvidenceClaimAuthority } from './requirements-contract-span-registry';
import {
  activeAuthoringAttemptPointerHash,
  validateActiveAuthoringAttemptPointer,
  type ActiveAuthoringAttemptPointer,
} from './requirements-contract-active-authoring-attempt-pointer';
import { publishActiveAuthoringAttemptPointer } from './requirements-contract-active-authoring-attempt-pointer';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import {
  createRequirementsContractCheckpointManifest,
  type RequirementsAuthoringArtifactEntry,
  type RequirementsCheckpointManifestRef,
} from './requirements-contract-authoring-manifest';
import { createRequirementsContractLintReport } from './requirements-contract-lint-report';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';
import {
  buildRequirementsContractJudgeAuditPacket,
  validateRequirementsContractJudgeAuditPacketCoverage,
} from './requirements-contract-judge-audit-packet';
import { canonicalJson } from './requirements-contract-governed-write';

const runtimeRequire = createRequire(__filename);

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
  'activeAuthoringAttemptPointer',
  'cp08Snapshot',
  'reconciliationReport',
  'authorityResolutionReport',
  'renderabilityProbeReport',
  'auditPacket',
  'coverageManifest',
  'mandatoryDimensionRegistry',
  'payloadObservation',
  'finalBuildManifestInputs',
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
  return requirements.map((requirement) => {
    const requirementId = nonEmpty(requirement.id);
    const spans = semanticIr.semanticPayload.specSpanRegistry.filter((span) =>
      span.boundObligationIds.includes(requirementId)
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
  const pointerValidation = validateActiveAuthoringAttemptPointer(
    input.activeAuthoringAttemptPointer
  );
  issueCodes.push(
    ...pointerValidation.issueCodes.map((code) => `requirements_publication_ready_${code}`)
  );
  const pointer = input.activeAuthoringAttemptPointer as ActiveAuthoringAttemptPointer | undefined;
  const snapshot = input.cp08Snapshot as Record<string, unknown> | undefined;
  if (
    !snapshot ||
    snapshot.checkpointId !== 'cp08' ||
    snapshot.authoringAttemptId !== pointer?.authoringAttemptId ||
    snapshot.attemptManifestHash !== pointer?.attemptManifestHash ||
    !pointer?.attemptManifestPath.endsWith('/8-cp08.json')
  ) {
    issueCodes.push('requirements_publication_ready_cp08_snapshot_identity_invalid');
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
  const packetBody = record(packet?.body);
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
  const semanticIr = snapshot?.semanticIr as RequirementsContractSemanticIr | undefined;
  const resolvedEvidenceIndex = snapshot?.resolvedEvidenceIndex as
    | Parameters<typeof reconcileRequirementsContractProjectionLineage>[0]['resolvedEvidenceIndex']
    | undefined;
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
    semanticIr?.schemaVersion === 'requirements-contract-semantic-ir/v1' &&
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
    !Array.isArray(input.finalBuildManifestInputs) ||
    input.finalBuildManifestInputs.length === 0
  ) {
    issueCodes.push('requirements_publication_ready_build_inputs_missing');
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
    schemaVersion: 'requirements-contract-execution-manifest/v1';
    semanticRevisionId: string;
    scopeSemanticHash: string;
    constraints: RequirementsExecutionConstraint[];
  };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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

function artifactEntry(input: {
  attemptId: string;
  stage: RequirementsContractProjectionStage;
  role: RequirementsAuthoringArtifactEntry['role'];
  artifactId: string;
  fileName: string;
  value?: unknown;
  bytes?: string;
}): RequirementsAuthoringArtifactEntry & { value?: unknown; bytes?: string } {
  const recordRelativePath = `authoring/staging/${input.attemptId}/${input.stage}/${input.fileName}`;
  return {
    role: input.role,
    schemaVersion:
      input.bytes === undefined
        ? nonEmpty(record(input.value).schemaVersion) ||
          'requirements-contract-projection-artifact/v1'
        : 'text/markdown',
    artifactId: input.artifactId,
    recordRelativePath,
    artifactHash: input.bytes === undefined ? sha256Stable(input.value) : sha256Text(input.bytes),
    ...(input.bytes === undefined ? { value: input.value } : { bytes: input.bytes }),
  };
}

function publishProjectionArtifact(
  recordRoot: string,
  entry: RequirementsAuthoringArtifactEntry & { value?: unknown; bytes?: string }
): RequirementsAuthoringArtifactEntry {
  atomicNoClobberPublish({
    targetPath: path.join(recordRoot, ...entry.recordRelativePath.split('/')),
    ...(entry.bytes === undefined ? { value: entry.value } : { bytes: entry.bytes }),
    role: entry.role,
    mediaType: entry.bytes === undefined ? 'application/json' : 'text/markdown',
  });
  const { value: _value, bytes: _bytes, ...manifestEntry } = entry;
  return manifestEntry;
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
          .filter((span) => span.boundObligationIds.includes(id))
          .flatMap((span) => span.evidenceClaimRefs)
      ),
    };
  });
}

type AttemptPointerCas = Parameters<
  typeof publishActiveAuthoringAttemptPointer
>[0]['compareAndSwap'];

export function publishRequirementsContractCp05Cp08Stages(input: {
  recordRoot: string;
  sourcePath: string;
  authoringRequestId: string;
  authoringAttemptId: string;
  inputManifestHash: string;
  previousCheckpointManifestRef: RequirementsCheckpointManifestRef;
  expectedCurrentPointerHash: string;
  compareAndSwapAttemptPointer: AttemptPointerCas;
  deferAttemptPointerActivation?: boolean;
  semanticIr: RequirementsContractSemanticIr;
  sourceBinding: Record<string, unknown>;
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
  decisionReceiptRefs: Array<{ decisionReceiptId: string; path: string; hash: string }>;
}) {
  const requirements = semanticRequirementRows(input.semanticIr);
  const requirementIds = requirements.map((row) => row.id);
  const atoms = records(record(input.semanticIr.semanticPayload.semantics).atoms);
  const lineageNodes: RequirementsContractProjectionLineageNode[] = requirements.map((row) => ({
    role: 'must',
    id: row.id,
    factRefs: [],
    mustRefs: [row.id],
    atomRefs: row.atomRefs,
    traceRefs: [],
    specSpanRefs: input.semanticIr.semanticPayload.specSpanRegistry
      .filter((span) => span.boundObligationIds.includes(row.id))
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
    schemaVersion: 'requirements-contract-confirmation-projection/v1',
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirements,
  };
  const markdown = [
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
  ].join('\n');
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
  const auditPacketBuild = buildRequirementsContractJudgeAuditPacket({
    semanticRevisionId: input.semanticIr.semanticRevisionId,
    scopeSemanticHash: input.semanticIr.scopeSemanticHash,
    requirementIds,
    mandatoryDimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    lineageNodes,
    authorityResolutions: reconciliation.authorityResolutions,
    artifacts: [
      { artifactId: 'confirmation-projection', payload: cp05Projection },
      { artifactId: 'final-markdown', payload: markdown },
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
  const auditPacketBody = auditPacket.body;
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

  const stageDefinitions = [
    {
      stage: 'cp05' as const,
      abstractArtifacts: [
        { artifactId: 'final-markdown', role: 'source_markdown', value: markdown },
        {
          artifactId: 'confirmation-projection',
          role: 'implementation_confirmation',
          value: cp05Projection,
        },
      ],
      entries: [
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp05',
          role: 'confirmation_projection',
          artifactId: 'confirmation-projection',
          fileName: 'confirmation-projection.json',
          value: cp05Projection,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp05',
          role: 'final_markdown',
          artifactId: 'final-markdown',
          fileName: 'final-source.md',
          bytes: markdown,
        }),
      ],
    },
    {
      stage: 'cp06' as const,
      abstractArtifacts: [
        { artifactId: 'per-must-bundle', role: 'per_must_bundle', value: perMustBundle },
        {
          artifactId: 'execution-manifest',
          role: 'execution_manifest',
          value: cp06Execution.executionManifest,
        },
        { artifactId: 'trace-matrix', role: 'compact_trace_matrix', value: traceMatrix },
      ],
      entries: [
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp06',
          role: 'execution_manifest',
          artifactId: 'execution-manifest',
          fileName: 'execution-manifest.json',
          value: cp06Execution.executionManifest,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp06',
          role: 'per_must_bundle',
          artifactId: 'per-must-bundle',
          fileName: 'per-must-bundle.json',
          value: perMustBundle,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp06',
          role: 'trace_matrix',
          artifactId: 'trace-matrix',
          fileName: 'trace-matrix.json',
          value: traceMatrix,
        }),
      ],
    },
    {
      stage: 'cp07' as const,
      abstractArtifacts: [
        { artifactId: 'confirmation-view', role: 'human_view', value: markdown },
        { artifactId: 'diagram-set', role: 'diagram_set', value: diagramSet },
      ],
      entries: [
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp07',
          role: 'diagram_set',
          artifactId: 'diagram-set',
          fileName: 'diagram-set.json',
          value: diagramSet,
        }),
      ],
    },
    {
      stage: 'cp08' as const,
      abstractArtifacts: [
        {
          artifactId: 'projection-reconciliation-report',
          role: 'projection_reconciliation_report',
          value: reconciliationReport,
        },
        {
          artifactId: 'authority-resolution-report',
          role: 'authority_resolution_report',
          value: authorityResolutionReport,
        },
        {
          artifactId: 'renderability-probe-report',
          role: 'renderability_probe_report',
          value: renderabilityProbeReport,
        },
        { artifactId: 'judge-audit-packet', role: 'judge_audit_packet', value: auditPacket },
      ],
      entries: [
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp08',
          role: 'projection_reconciliation_report',
          artifactId: 'projection-reconciliation-report',
          fileName: 'projection-reconciliation-report.json',
          value: reconciliationReport,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp08',
          role: 'authority_resolution_report',
          artifactId: 'authority-resolution-report',
          fileName: 'authority-resolution-report.json',
          value: authorityResolutionReport,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp08',
          role: 'renderability_probe_report',
          artifactId: 'renderability-probe-report',
          fileName: 'renderability-probe-report.json',
          value: renderabilityProbeReport,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp08',
          role: 'judge_audit_packet',
          artifactId: 'judge-audit-packet',
          fileName: 'judge-audit-packet.json',
          value: auditPacket,
        }),
        artifactEntry({
          attemptId: input.authoringAttemptId,
          stage: 'cp08',
          role: 'judge_audit_packet_coverage',
          artifactId: 'judge-audit-packet-coverage',
          fileName: 'judge-audit-packet-coverage.json',
          value: coverageManifest,
        }),
      ],
    },
  ];

  let previousRef = input.previousCheckpointManifestRef;
  let terminalManifest: ReturnType<typeof createRequirementsContractCheckpointManifest> | null =
    null;
  for (const definition of stageDefinitions) {
    const identity = projectionIdentity({
      ...input,
      attemptManifestHash: previousRef.hash,
    });
    const lint = lintRequirementsContractProjectionStage({
      stage: definition.stage,
      identity,
      artifacts: definition.abstractArtifacts,
      checkedRequirementIds: requirementIds,
    });
    if (lint.decision === 'block') throw new Error(lint.issueCodes[0]);
    const lintEntry = artifactEntry({
      attemptId: input.authoringAttemptId,
      stage: definition.stage,
      role: 'lint_report',
      artifactId: `${definition.stage}-lint-report`,
      fileName: 'lint-report.json',
      value: lint.lintReport,
    });
    const entries = [...definition.entries, lintEntry].map((entry) =>
      publishProjectionArtifact(input.recordRoot, entry)
    );
    const ordinal = Number(definition.stage.slice(2));
    const manifest = createRequirementsContractCheckpointManifest({
      authoringRequestId: input.authoringRequestId,
      authoringAttemptId: input.authoringAttemptId,
      checkpointId: definition.stage,
      checkpointOrdinal: ordinal,
      stage: definition.stage,
      status: 'passed',
      inputManifestHash: input.inputManifestHash,
      previousCheckpointManifestRef: previousRef,
      latestValidPredecessorCheckpoint: previousRef.checkpointId,
      compilerIdentity:
        REQUIREMENTS_CONTRACT_PROJECTION_CHECKPOINT_PROFILES[definition.stage].profileId,
      artifactEntries: entries,
      decisionReceiptRefs: input.decisionReceiptRefs,
      baseAuthorityRef: null,
    });
    const manifestPath = `authoring/staging/${input.authoringAttemptId}/manifests/${ordinal}-${definition.stage}.json`;
    atomicNoClobberPublish({
      targetPath: path.join(input.recordRoot, ...manifestPath.split('/')),
      value: manifest,
      role: 'requirements_contract_checkpoint_manifest',
    });
    previousRef = {
      checkpointId: definition.stage,
      checkpointOrdinal: ordinal,
      path: manifestPath,
      hash: manifest.checkpointManifestHash,
    };
    terminalManifest = manifest;
  }
  if (!terminalManifest) throw new Error('requirements_cp08_manifest_missing');
  const pointer: ActiveAuthoringAttemptPointer = {
    schemaVersion: 'ActiveAuthoringAttemptPointer/v1',
    authoringAttemptId: input.authoringAttemptId,
    attemptManifestPath: previousRef.path,
    attemptManifestHash: previousRef.hash,
    latestValidPredecessorCheckpoint: 'cp07',
    inputManifestHash: input.inputManifestHash,
  };
  const publicationReady = validateRequirementsContractPublicationReady({
    activeAuthoringAttemptPointer: pointer,
    cp08Snapshot: {
      checkpointId: 'cp08',
      authoringAttemptId: input.authoringAttemptId,
      attemptManifestHash: previousRef.hash,
      semanticIr: input.semanticIr,
      resolvedEvidenceIndex: input.resolvedEvidenceIndex,
    },
    reconciliationReport,
    authorityResolutionReport,
    renderabilityProbeReport,
    auditPacket,
    coverageManifest,
    mandatoryDimensionRegistry: {
      dimensionIds: [...REQUIREMENTS_CONTRACT_PREPUBLICATION_DIMENSIONS],
    },
    payloadObservation: {
      serializedBytes,
    },
    finalBuildManifestInputs: ['cp08-snapshot', 'audit-packet'],
  });
  const publicationLint = createRequirementsContractLintReport({
    lintStage: 'publication_ready',
    profileId: 'requirements-publication-ready/v1',
    inputAuthorityRefs: [],
    inputIdentity: {
      ...projectionIdentity({ ...input, attemptManifestHash: previousRef.hash }),
      auditPacketHash: sha256Stable(auditPacket),
      renderabilityProbeHash: sha256Stable(renderabilityProbeReport),
    },
    ruleSetHash: sha256Stable({
      owner: 'requirements-contract-cp05-cp08',
      stage: 'publication_ready',
    }),
    validatorIdentity:
      'requirements-contract-cp05-cp08.ts#validateRequirementsContractPublicationReady',
    validatorVersion: 'v1',
    validatorHash: sha256Stable({
      owner: 'requirements-contract-cp05-cp08',
      validator: 'publication-ready',
    }),
    checkedArtifactIds: auditPacketBody.artifactIds,
    checkedRequirementIds: requirementIds,
    issueCodes: publicationReady.issueCodes,
    earliestAffectedStage: publicationReady.decision === 'block' ? 'cp08' : null,
    latestValidPredecessorCheckpoint: publicationReady.decision === 'block' ? 'cp07' : null,
    decision: publicationReady.decision,
  });
  atomicNoClobberPublish({
    targetPath: path.join(
      input.recordRoot,
      'authoring',
      'staging',
      input.authoringAttemptId,
      'publication-ready-lint.json'
    ),
    value: publicationLint,
    role: 'lint_report',
  });
  if (publicationReady.decision === 'block') throw new Error(publicationReady.issueCodes[0]);
  const canonicalAuditPacketPath = `authoring/staging/${input.authoringAttemptId}/judge-audit-packet.json`;
  atomicNoClobberPublish({
    targetPath: path.join(input.recordRoot, ...canonicalAuditPacketPath.split('/')),
    value: auditPacket,
    role: 'judge_audit_packet',
  });
  const attemptPointer = input.deferAttemptPointerActivation
    ? {
        pointer,
        pointerHash: activeAuthoringAttemptPointerHash(pointer),
        readbackVerified: true as const,
        deferred: true as const,
      }
    : publishActiveAuthoringAttemptPointer({
        pointer,
        expectedCurrentPointerHash: input.expectedCurrentPointerHash,
        readAttemptManifest: () => terminalManifest,
        compareAndSwap: input.compareAndSwapAttemptPointer,
      });
  const gateModule = runtimeRequire(
    resolvePackageOwnedBmadPath(
      'skills',
      'requirements-contract-authoring',
      'scripts',
      'pre_render_must_decomposition_gate.js'
    )
  ) as {
    validatePrepublicationAttempt(value: { sourcePath: string; recordRoot: string }): {
      exitCode: number;
      report: { failedChecks: string[] };
    };
  };
  const prepublication = gateModule.validatePrepublicationAttempt({
    sourcePath: path.join(
      input.recordRoot,
      'authoring',
      'staging',
      input.authoringAttemptId,
      'cp05',
      'final-source.md'
    ),
    recordRoot: input.recordRoot,
    attemptPointer: input.deferAttemptPointerActivation ? pointer : undefined,
  });
  if (prepublication.exitCode !== 0) {
    throw new Error(prepublication.report.failedChecks[0] || 'requirements_prepublication_blocked');
  }
  return {
    status: 'published' as const,
    terminalManifest,
    terminalManifestRef: previousRef,
    attemptPointer,
    publicationReady,
    prepublication,
    canonicalAuditPacketRef: {
      artifactId: 'judge-audit-packet',
      path: canonicalAuditPacketPath,
      hash: sha256Stable(auditPacket),
    },
    projectionReportRefs: terminalManifest.artifactEntries
      .filter((entry) =>
        [
          'projection_reconciliation_report',
          'authority_resolution_report',
          'renderability_probe_report',
        ].includes(entry.role)
      )
      .map((entry) => ({
        artifactId: entry.artifactId,
        path: entry.recordRelativePath,
        hash: entry.artifactHash,
      })),
    providerInvocationCount: 0 as const,
    committerInvocationCount: 0 as const,
  };
}

function cloneConstraint(
  constraint: RequirementsExecutionConstraint
): RequirementsExecutionConstraint {
  return {
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

function emptyManifest(input: RequirementsContractFrozenProjectionInput) {
  return {
    schemaVersion: 'requirements-contract-execution-manifest/v1' as const,
    semanticRevisionId: String(input.semanticIr?.semanticRevisionId ?? ''),
    scopeSemanticHash: String(input.semanticIr?.scopeSemanticHash ?? ''),
    constraints: [] as RequirementsExecutionConstraint[],
  };
}

export function projectRequirementsContractCp06ExecutionManifest(
  input: RequirementsContractFrozenProjectionInput & { requiredConstraintIds: string[] }
): RequirementsContractCp06ExecutionProjectionResult {
  if (
    input.checkpointId !== 'cp04' ||
    input.checkpointStatus !== 'passed' ||
    input.readbackVerified !== true ||
    input.semanticIr?.schemaVersion !== 'requirements-contract-semantic-ir/v1'
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
      schemaVersion: 'requirements-contract-execution-manifest/v1',
      semanticRevisionId: input.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.semanticIr.scopeSemanticHash,
      constraints: projected.sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId)
      ),
    },
  };
}
