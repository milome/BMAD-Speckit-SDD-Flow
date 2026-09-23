import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArchitectureConfirmationContext } from './prepare-architecture-confirmation';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import type { RequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import { openRequirementsContractRecord } from './requirements-contract-record-boundary';
import {
  readRequirementsActiveBuildManifest,
  resolveRequirementsActiveArtifact,
} from './requirements-contract-durable-build-store';
import {
  assertTypedConfirmationProjection,
  resolveTypedSourceAuthority,
  resolveTypedSourceCoverage,
  type RequirementsTypedSourceAuthority,
  type RequirementsTypedSourceCoverage,
  type RequirementsTypedSourceGraph,
} from './requirements-contract-typed-source-semantics';

type JsonObject = Record<string, unknown>;

export interface ConfirmedRequirementsAuthorityLineage extends JsonObject {
  recordId: string;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  bindingRevisionId: string;
  sourceBindingHash: string;
  buildManifestHash: string;
  checkpointSummaryHash: string;
  confirmationProjectionHash: string;
  implementationConfirmationHash: string;
  finalMarkdownHash: string;
  requirementsEffectivePassHash: string;
  confirmationEventHash: string;
  promotionEvidenceHash: string;
  typedSourceGraphHash: string;
  typedCoverageHash: string;
  checkpointIds: string[];
}

export interface ConfirmedRequirementsAuthority extends JsonObject {
  schemaVersion: 'ConfirmedRequirementsAuthority/v1';
  requestId: string;
  recordPath: string;
  recordRoot: string;
  sourceDocumentPath: string;
  semanticIr: RequirementsContractSemanticIr;
  sourceBinding: ReturnType<typeof resolveArchitectureConfirmationContext>['sourceBinding'];
  confirmationProjection: JsonObject;
  implementationConfirmation: JsonObject;
  typedSourceAuthority: RequirementsTypedSourceAuthority;
  typedCoverage: RequirementsTypedSourceCoverage;
  typedSourceGraph: RequirementsTypedSourceGraph;
  lineage: ConfirmedRequirementsAuthorityLineage;
  architectureContext: ReturnType<typeof resolveArchitectureConfirmationContext>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function confined(recordRoot: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error('requirements_confirmed_artifact_path_invalid');
  }
  const root = path.resolve(recordRoot);
  const resolved = path.resolve(root, ...relativePath.replace(/\\/gu, '/').split('/'));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('requirements_confirmed_artifact_path_escape');
  }
  return resolved;
}

function sameValue(left: unknown, right: unknown): boolean {
  return sha256Stable(left) === sha256Stable(right);
}

export function hydrateConfirmedImplementationConfirmation(input: {
  semanticIr: RequirementsContractSemanticIr;
  confirmationProjection: JsonObject;
  lifecycle: string;
}): {
  implementationConfirmation: JsonObject;
  typedSourceAuthority: RequirementsTypedSourceAuthority;
  typedCoverage: RequirementsTypedSourceCoverage;
  typedSourceGraph: RequirementsTypedSourceGraph;
} {
  if (
    input.lifecycle !== 'user_confirmed' ||
    input.semanticIr.schemaVersion !== 'requirements-contract-semantic-ir/v2' ||
    text(input.confirmationProjection.schemaVersion) !==
      'requirements-contract-confirmation-projection/v2' ||
    text(input.confirmationProjection.semanticRevisionId) !== input.semanticIr.semanticRevisionId ||
    text(input.confirmationProjection.scopeSemanticHash) !== input.semanticIr.scopeSemanticHash
  ) {
    throw new Error('requirements_confirmed_projection_identity_mismatch');
  }

  const semantics = object(input.semanticIr.semanticPayload.semantics);
  const projectedConfirmation = object(input.confirmationProjection.implementationConfirmation);
  const semanticConfirmation = object(semantics.implementationConfirmation);
  const typedSourceAuthority = input.confirmationProjection
    .typedSourceAuthority as RequirementsTypedSourceAuthority;
  const typedCoverage = input.confirmationProjection.typedCoverage as RequirementsTypedSourceCoverage;

  if (!sameValue(projectedConfirmation, semanticConfirmation)) {
    throw new Error('requirements_confirmed_projection_semantics_mismatch');
  }
  if (!sameValue(typedSourceAuthority, semantics.typedSourceAuthority)) {
    throw new Error('requirements_confirmed_typed_authority_mismatch');
  }
  if (!sameValue(typedCoverage, semantics.typedCoverage)) {
    throw new Error('requirements_confirmed_typed_coverage_mismatch');
  }

  const authorityRef = object(projectedConfirmation.typedSourceAuthorityRef);
  const coverageRef = object(projectedConfirmation.typedCoverageRef);
  if (
    text(authorityRef.schemaVersion) !== 'requirements-contract-typed-source-authority-ref/v2' ||
    text(authorityRef.graphHash) !== text(typedSourceAuthority.graphHash)
  ) {
    throw new Error('requirements_confirmed_typed_authority_ref_mismatch');
  }
  if (
    text(coverageRef.schemaVersion) !== 'requirements-contract-typed-source-coverage-ref/v2' ||
    text(coverageRef.graphHash) !== text(typedSourceAuthority.graphHash) ||
    text(coverageRef.coverageHash) !== text(typedCoverage.coverageHash)
  ) {
    throw new Error('requirements_confirmed_typed_coverage_ref_mismatch');
  }

  const typedSourceGraph = resolveTypedSourceAuthority(typedSourceAuthority);
  resolveTypedSourceCoverage(typedCoverage, typedSourceAuthority);
  const implementationConfirmation = {
    ...structuredClone(projectedConfirmation),
    status: 'user_confirmed',
    typedSourceAuthority: structuredClone(typedSourceAuthority),
    typedCoverage: structuredClone(typedCoverage),
  };
  assertTypedConfirmationProjection(implementationConfirmation);
  return {
    implementationConfirmation,
    typedSourceAuthority,
    typedCoverage,
    typedSourceGraph,
  };
}

export function resolveConfirmedRequirementsAuthority(input: {
  projectRoot: string;
  requirementRecordPath: string;
}): ConfirmedRequirementsAuthority {
  const projectRoot = path.resolve(input.projectRoot);
  const requirementRecordPath = path.resolve(input.requirementRecordPath);
  const recordsRoot = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records'
  );
  if (
    !fs.existsSync(requirementRecordPath) ||
    !fs.statSync(requirementRecordPath).isFile() ||
    (requirementRecordPath !== recordsRoot &&
      !requirementRecordPath.startsWith(`${recordsRoot}${path.sep}`))
  ) {
    throw new Error('requirements_confirmed_record_path_invalid');
  }
  const realProjectRoot = fs.realpathSync(projectRoot);
  const realRecordPath = fs.realpathSync(requirementRecordPath);
  if (!realRecordPath.startsWith(`${realProjectRoot}${path.sep}`)) {
    throw new Error('requirements_confirmed_record_path_invalid');
  }

  const record = openRequirementsContractRecord(requirementRecordPath);
  const requestId = text(record.recordId);
  const recordRoot = path.join(recordsRoot, requestId);
  const expectedRecordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  if (!requestId || requirementRecordPath !== expectedRecordPath) {
    throw new Error('requirements_confirmed_record_path_invalid');
  }

  const architectureContext = resolveArchitectureConfirmationContext({ projectRoot, requestId });
  if (path.resolve(architectureContext.recordPath) !== requirementRecordPath) {
    throw new Error('requirements_confirmed_record_path_invalid');
  }
  const activeAuthority = architectureContext.activeAuthority;
  const buildManifest = readRequirementsActiveBuildManifest({ recordRoot, activeAuthority });
  const projectionArtifact = resolveRequirementsActiveArtifact({
    recordRoot,
    activeAuthority,
    role: 'confirmation_projection',
  });
  const finalMarkdownArtifact = resolveRequirementsActiveArtifact({
    recordRoot,
    activeAuthority,
    role: 'final_markdown',
  });
  const confirmationProjection = object(projectionArtifact.value);
  const sourceDocumentPath = confined(
    recordRoot,
    finalMarkdownArtifact.entry.contentRef.recordRelativePath
  );

  const hydrated = hydrateConfirmedImplementationConfirmation({
    semanticIr: architectureContext.semanticIr,
    confirmationProjection,
    lifecycle: text(record.lifecycle),
  });
  const lineage: ConfirmedRequirementsAuthorityLineage = {
    recordId: requestId,
    semanticRevisionId: architectureContext.semanticIr.semanticRevisionId,
    scopeSemanticHash: architectureContext.semanticIr.scopeSemanticHash,
    bindingRevisionId: architectureContext.sourceBinding.bindingRevisionId,
    sourceBindingHash: architectureContext.sourceBinding.sourceBindingHash,
    buildManifestHash: activeAuthority.activeBuildHash,
    checkpointSummaryHash: buildManifest.checkpointSummary.checkpointSummaryHash,
    confirmationProjectionHash: projectionArtifact.entry.semanticHash,
    implementationConfirmationHash: sha256Stable(
      object(confirmationProjection.implementationConfirmation)
    ),
    finalMarkdownHash: finalMarkdownArtifact.entry.contentRef.contentHash,
    requirementsEffectivePassHash: text(
      architectureContext.effectivePass.requirementsEffectivePassHash
    ),
    confirmationEventHash: architectureContext.confirmationEventHash,
    promotionEvidenceHash: text(object(record.currentPromotionEvidence).artifactBytesHash),
    typedSourceGraphHash: hydrated.typedSourceAuthority.graphHash,
    typedCoverageHash: hydrated.typedCoverage.coverageHash,
    checkpointIds: buildManifest.checkpointSummary.checkpointIds,
  };

  return Object.freeze({
    schemaVersion: 'ConfirmedRequirementsAuthority/v1',
    requestId,
    recordPath: requirementRecordPath,
    recordRoot,
    sourceDocumentPath,
    semanticIr: architectureContext.semanticIr,
    sourceBinding: architectureContext.sourceBinding,
    confirmationProjection,
    implementationConfirmation: hydrated.implementationConfirmation,
    typedSourceAuthority: hydrated.typedSourceAuthority,
    typedCoverage: hydrated.typedCoverage,
    typedSourceGraph: hydrated.typedSourceGraph,
    lineage: Object.freeze(lineage),
    architectureContext,
  });
}
