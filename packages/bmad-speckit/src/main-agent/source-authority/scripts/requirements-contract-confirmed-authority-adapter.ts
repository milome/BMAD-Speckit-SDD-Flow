import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateRequirementsContractBuildManifest,
  validateRequirementsContractCheckpointManifest,
  type RequirementsContractCheckpointManifest,
} from './requirements-contract-authoring-manifest';
import { resolveArchitectureConfirmationContext } from './prepare-architecture-confirmation';
import {
  sha256Stable,
  sha256Text,
} from './requirements-contract-semantic-resolver';
import type { RequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
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
  terminalCheckpointManifestHash: string;
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

const CHECKPOINT_IDS = Array.from(
  { length: 9 },
  (_, ordinal) => `cp${String(ordinal).padStart(2, '0')}`
);

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

function readJson(filePath: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('requirements_confirmed_json_object_required');
  }
  return value as JsonObject;
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

function singleArtifact(
  manifest: RequirementsContractCheckpointManifest,
  role: string
): JsonObject {
  const entries = objects(manifest.artifactEntries).filter((entry) => text(entry.role) === role);
  if (entries.length !== 1) {
    throw new Error(`requirements_confirmed_${role}_entry_invalid`);
  }
  return entries[0];
}

function readCheckpointChain(input: {
  recordRoot: string;
  buildManifest: JsonObject;
}): RequirementsContractCheckpointManifest[] {
  const manifests: RequirementsContractCheckpointManifest[] = [];
  const visited = new Set<string>();
  let checkpointRef = object(input.buildManifest.terminalCheckpointManifestRef);
  let expectedOrdinal = 8;

  while (text(checkpointRef.path)) {
    const relativePath = text(checkpointRef.path);
    if (visited.has(relativePath)) {
      throw new Error('requirements_confirmed_checkpoint_lineage_cycle');
    }
    visited.add(relativePath);
    const manifest = readJson(confined(input.recordRoot, relativePath));
    const validation = validateRequirementsContractCheckpointManifest(manifest);
    if (validation.decision !== 'pass') {
      throw new Error(
        `requirements_confirmed_checkpoint_manifest_invalid:${validation.issueCodes[0]}`
      );
    }
    if (
      text(manifest.checkpointId) !== text(checkpointRef.checkpointId) ||
      Number(manifest.checkpointOrdinal) !== Number(checkpointRef.checkpointOrdinal) ||
      text(manifest.checkpointManifestHash) !== text(checkpointRef.hash) ||
      Number(manifest.checkpointOrdinal) !== expectedOrdinal ||
      text(manifest.checkpointId) !== CHECKPOINT_IDS[expectedOrdinal] ||
      text(manifest.authoringRequestId) !== text(input.buildManifest.authoringRequestId) ||
      text(manifest.authoringAttemptId) !== text(input.buildManifest.authoringAttemptId) ||
      text(manifest.inputManifestHash) !== text(input.buildManifest.inputManifestHash)
    ) {
      throw new Error('requirements_confirmed_checkpoint_lineage_invalid');
    }
    manifests.push(manifest as unknown as RequirementsContractCheckpointManifest);
    checkpointRef = object(manifest.previousCheckpointManifestRef);
    expectedOrdinal -= 1;
  }
  if (expectedOrdinal !== -1) {
    throw new Error('requirements_confirmed_checkpoint_lineage_incomplete');
  }
  return manifests;
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

  const record = readJson(requirementRecordPath);
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
  const activeAuthority = object(record.activeAuthority);
  const buildManifest = readJson(
    confined(recordRoot, text(activeAuthority.activeBuildManifestPath))
  );
  const buildValidation = validateRequirementsContractBuildManifest(buildManifest);
  if (buildValidation.decision !== 'pass') {
    throw new Error(
      `requirements_confirmed_build_manifest_invalid:${buildValidation.issueCodes[0]}`
    );
  }
  const checkpoints = readCheckpointChain({ recordRoot, buildManifest });
  const cp05 = checkpoints.find((manifest) => manifest.checkpointId === 'cp05');
  if (
    !cp05 ||
    cp05.status !== 'passed' ||
    cp05.checkpointOrdinal !== 5 ||
    cp05.compilerIdentity !== 'requirements-contract-cp05-source-confirmation-projection/v1'
  ) {
    throw new Error('requirements_confirmed_cp05_manifest_invalid');
  }

  const projectionEntry = singleArtifact(cp05, 'confirmation_projection');
  const finalMarkdownEntry = singleArtifact(cp05, 'final_markdown');
  const projectionPath = confined(recordRoot, text(projectionEntry.recordRelativePath));
  const sourceDocumentPath = confined(recordRoot, text(finalMarkdownEntry.recordRelativePath));
  const confirmationProjection = readJson(projectionPath);
  if (sha256Stable(confirmationProjection) !== text(projectionEntry.artifactHash)) {
    throw new Error('requirements_confirmed_projection_hash_mismatch');
  }
  if (
    sha256Text(fs.readFileSync(sourceDocumentPath, 'utf8')) !== text(finalMarkdownEntry.artifactHash)
  ) {
    throw new Error('requirements_confirmed_final_markdown_hash_mismatch');
  }

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
    buildManifestHash: text(activeAuthority.activeBuildManifestHash),
    terminalCheckpointManifestHash: text(object(buildManifest.terminalCheckpointManifestRef).hash),
    confirmationProjectionHash: text(projectionEntry.artifactHash),
    implementationConfirmationHash: sha256Stable(
      object(confirmationProjection.implementationConfirmation)
    ),
    finalMarkdownHash: text(finalMarkdownEntry.artifactHash),
    requirementsEffectivePassHash: text(
      architectureContext.effectivePass.requirementsEffectivePassHash
    ),
    confirmationEventHash: architectureContext.confirmationEventHash,
    promotionEvidenceHash: text(object(record.currentPromotionEvidence).artifactBytesHash),
    typedSourceGraphHash: hydrated.typedSourceAuthority.graphHash,
    typedCoverageHash: hydrated.typedCoverage.coverageHash,
    checkpointIds: checkpoints.map((manifest) => manifest.checkpointId).reverse(),
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
