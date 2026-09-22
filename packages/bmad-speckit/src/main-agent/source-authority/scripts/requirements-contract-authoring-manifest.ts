import path from 'node:path';
import {
  buildHash,
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import type { RequirementsContentRef } from './requirements-contract-content-store';

export const REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES = [
  'semantic_kernel',
  'decision_graph',
  'must_decomposition_packet',
  'id_registry',
  'semantic_ir',
  'semantic_ir_freeze_receipt',
  'source_binding',
  'source_binding_freeze_receipt',
  'resolved_evidence_index',
  'lint_report',
  'confirmation_projection',
  'per_must_bundle',
  'trace_matrix',
  'execution_manifest',
  'acceptance_contracts',
  'failure_matrix',
  'edge_matrix',
  'diagram_set',
  'projection_reconciliation_report',
  'authority_resolution_report',
  'renderability_probe_report',
  'judge_audit_packet',
  'judge_audit_packet_coverage',
  'remediation_plan',
  'remediation_delta',
  'effective_pass_receipt',
  'final_markdown',
  'confirmation_html',
  'confirmation_summary',
  'promotion_receipt',
] as const;

export type RequirementsAuthoringArtifactRole =
  (typeof REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES)[number];

export interface RequirementsAuthoringArtifactEntryV2 {
  role: RequirementsAuthoringArtifactRole;
  schemaVersion: string;
  semanticHash: string;
  contentRef: RequirementsContentRef;
}

export interface RequirementsContractBuildManifestV2 {
  schemaVersion: 'requirements-contract-build-manifest/v2';
  scopeSemanticHash: string;
  sourceBindingHash: string;
  compilerIdentity: string;
  projectionSetHash: string;
  checkpointSummary: {
    checkpointIds: string[];
    terminalStateHashes: string[];
    checkpointSummaryHash: string;
  };
  validationSummary: {
    decision: 'pass';
    checkIds: string[];
    validationHash: string;
  };
  artifactEntries: RequirementsAuthoringArtifactEntryV2[];
  buildHash: string;
}

export function createRequirementsContractBuildManifestV2(input: {
  scopeSemanticHash: string;
  sourceBindingHash: string;
  compilerIdentity: string;
  projectionSetHash: string;
  checkpointSummary: {
    checkpointIds: string[];
    terminalStateHashes: string[];
  };
  validationSummary: { decision: 'pass'; checkIds: string[] };
  artifactEntries: RequirementsAuthoringArtifactEntryV2[];
}): RequirementsContractBuildManifestV2 {
  const checkpointIds = [...new Set(input.checkpointSummary.checkpointIds)].sort();
  const terminalStateHashes = [...new Set(input.checkpointSummary.terminalStateHashes)].sort();
  if (
    checkpointIds.length !== input.checkpointSummary.checkpointIds.length ||
    terminalStateHashes.length !== input.checkpointSummary.terminalStateHashes.length ||
    checkpointIds.length !== terminalStateHashes.length ||
    checkpointIds.some((checkpointId) => !CLOSED_CHECKPOINT_IDS.has(checkpointId)) ||
    terminalStateHashes.some((hash) => !SHA256.test(hash))
  ) throw new Error('requirements_build_checkpoint_summary_invalid');
  const checkpointSummary = {
    checkpointIds,
    terminalStateHashes,
    checkpointSummaryHash: requirementsContractDomainHash(
      'requirements-checkpoint-summary/v1',
      { checkpointIds, terminalStateHashes }
    ),
  };
  const checkIds = [...new Set(input.validationSummary.checkIds)].sort();
  const validationSummary = {
    decision: 'pass' as const,
    checkIds,
    validationHash: requirementsContractDomainHash(
      'requirements-validation-summary/v1',
      { decision: 'pass', checkIds }
    ),
  };
  const artifactEntries = input.artifactEntries.map(({ role, schemaVersion, semanticHash, contentRef }) => ({
    role,
    schemaVersion,
    semanticHash,
    contentRef,
  })).sort((left, right) =>
    `${left.role}\0${left.schemaVersion}\0${left.contentRef.contentHash}`.localeCompare(
      `${right.role}\0${right.schemaVersion}\0${right.contentRef.contentHash}`
    )
  );
  const payload = {
    schemaVersion: 'requirements-contract-build-manifest/v2' as const,
    scopeSemanticHash: input.scopeSemanticHash,
    sourceBindingHash: input.sourceBindingHash,
    compilerIdentity: input.compilerIdentity,
    projectionSetHash: input.projectionSetHash,
    checkpointSummary,
    validationSummary,
    artifactEntries,
  };
  const buildIdentity = buildHash({
    scopeSemanticHash: input.scopeSemanticHash,
    sourceBindingHash: input.sourceBindingHash,
    compilerIdentity: input.compilerIdentity,
    projectionSetHash: input.projectionSetHash,
    checkpointSummaryHash: checkpointSummary.checkpointSummaryHash,
    validationHash: validationSummary.validationHash,
    artifacts: artifactEntries.map((entry) => ({
      role: entry.role,
      schemaVersion: entry.schemaVersion,
      semanticHash: entry.semanticHash,
      blobHash: entry.contentRef.contentHash,
      mediaType: entry.contentRef.mediaType,
      byteLength: entry.contentRef.byteLength,
    })),
  });
  return { ...payload, buildHash: buildIdentity };
}

export function validateRequirementsContractBuildManifestV2(value: unknown): boolean {
  if (!isRecord(value) || value.schemaVersion !== 'requirements-contract-build-manifest/v2') return false;
  try {
    const manifest = value as unknown as RequirementsContractBuildManifestV2;
    if (
      !SHA256.test(manifest.scopeSemanticHash) ||
      !SHA256.test(manifest.sourceBindingHash) ||
      !SHA256.test(manifest.projectionSetHash) ||
      !Array.isArray(manifest.artifactEntries) ||
      manifest.artifactEntries.some((entry) =>
        !entry || Object.keys(entry).some((key) => !['role', 'schemaVersion', 'semanticHash', 'contentRef'].includes(key)) ||
        !nonEmptyString(entry.role) || !REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES.includes(entry.role as RequirementsAuthoringArtifactRole) || !nonEmptyString(entry.schemaVersion) ||
        !SHA256.test(entry.semanticHash) || !entry.contentRef ||
        entry.contentRef.schemaVersion !== 'requirements-content-ref/v1' ||
        !SHA256.test(entry.contentRef.contentHash) ||
        !Number.isSafeInteger(entry.contentRef.byteLength) || entry.contentRef.byteLength < 0 ||
        !nonEmptyString(entry.contentRef.mediaType) ||
        !canonicalPath(entry.contentRef.recordRelativePath) ||
        entry.contentRef.recordRelativePath !== canonicalContentObjectPath(entry.contentRef.contentHash)
      )
    ) return false;
    const recreated = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: manifest.scopeSemanticHash,
      sourceBindingHash: manifest.sourceBindingHash,
      compilerIdentity: manifest.compilerIdentity,
      projectionSetHash: manifest.projectionSetHash,
      checkpointSummary: {
        checkpointIds: manifest.checkpointSummary.checkpointIds,
        terminalStateHashes: manifest.checkpointSummary.terminalStateHashes,
      },
      validationSummary: {
        decision: manifest.validationSummary.decision,
        checkIds: manifest.validationSummary.checkIds,
      },
      artifactEntries: manifest.artifactEntries,
    });
    return canonicalRequirementsJson(recreated) === canonicalRequirementsJson(manifest);
  } catch {
    return false;
  }
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CLOSED_CHECKPOINT_IDS = new Set(
  Array.from({ length: 9 }, (_, ordinal) => `cp${String(ordinal).padStart(2, '0')}`)
);
function canonicalPath(value: string): boolean {
  return (
    Boolean(value) &&
    !value.includes('\\') &&
    !path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    value !== '..' &&
    !value.startsWith('../')
  );
}

function canonicalContentObjectPath(contentHash: string): string {
  return `authoring/objects/sha256/${contentHash.slice('sha256:'.length, 'sha256:'.length + 2)}/${contentHash.slice('sha256:'.length + 2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
