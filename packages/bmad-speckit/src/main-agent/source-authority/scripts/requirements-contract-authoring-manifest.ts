import path from 'node:path';
import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';

export const REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES = [
  'semantic_kernel', 'decision_graph', 'must_decomposition_packet', 'id_registry',
  'semantic_ir', 'semantic_ir_freeze_receipt', 'source_binding',
  'source_binding_freeze_receipt', 'resolved_evidence_index', 'lint_report',
  'confirmation_projection', 'per_must_bundle', 'trace_matrix',
  'acceptance_contracts', 'failure_matrix', 'edge_matrix', 'diagram_set',
  'projection_reconciliation_report', 'authority_resolution_report',
  'renderability_probe_report', 'judge_audit_packet', 'judge_audit_packet_coverage',
  'remediation_plan', 'remediation_delta', 'effective_pass_receipt',
  'final_markdown', 'confirmation_html', 'confirmation_summary', 'promotion_receipt',
] as const;

export type RequirementsAuthoringArtifactRole =
  (typeof REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES)[number];

export interface RequirementsAuthoringArtifactEntry {
  role: RequirementsAuthoringArtifactRole;
  schemaVersion: string;
  artifactId: string;
  recordRelativePath: string;
  artifactHash: string;
}

export interface RequirementsCheckpointManifestRef {
  checkpointId: string;
  checkpointOrdinal?: number;
  path: string;
  hash: string;
}

export interface RequirementsContractCheckpointManifest {
  schemaVersion: 'requirements-contract-authoring-checkpoint-manifest/v1';
  authoringRequestId: string;
  authoringAttemptId: string;
  checkpointId: string;
  checkpointOrdinal: number;
  stage: string;
  status: string;
  inputManifestHash: string;
  previousCheckpointManifestRef: RequirementsCheckpointManifestRef | null;
  latestValidPredecessorCheckpoint: string | null;
  compilerIdentity: string;
  artifactEntries: RequirementsAuthoringArtifactEntry[];
  decisionReceiptRefs: Array<{ decisionReceiptId: string; path: string; hash: string }>;
  baseAuthorityRef: Record<string, unknown> | null;
  checkpointManifestHash: string;
}

export interface RequirementsContractBuildManifest {
  schemaVersion: 'requirements-contract-build-manifest/v1';
  authoringRequestId: string;
  authoringAttemptId: string;
  inputManifestHash: string;
  terminalCheckpointManifestRef: RequirementsCheckpointManifestRef;
  semanticAuthorityRef: { semanticRevisionId: string; path: string; hash: string };
  bindingAuthorityRef: { bindingRevisionId: string; path: string; hash: string };
  artifactEntries: RequirementsAuthoringArtifactEntry[];
  decisionReceiptRefs: Array<{ decisionReceiptId: string; path: string; hash: string }>;
  auditPacketRef: { artifactId: string; path: string; hash: string };
  projectionReportRefs: Array<{ artifactId: string; path: string; hash: string }>;
  buildManifestHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CLOSED_CHECKPOINT_IDS = new Set(
  Array.from({ length: 9 }, (_, ordinal) => `cp${String(ordinal).padStart(2, '0')}`)
);
const CLOSED_CHECKPOINT_STATUSES = new Set(['pending', 'passed', 'blocked']);
const CHECKPOINT_KEYS = new Set([
  'schemaVersion', 'authoringRequestId', 'authoringAttemptId', 'checkpointId',
  'checkpointOrdinal', 'stage', 'status', 'inputManifestHash',
  'previousCheckpointManifestRef', 'latestValidPredecessorCheckpoint',
  'compilerIdentity', 'artifactEntries', 'decisionReceiptRefs', 'baseAuthorityRef',
  'checkpointManifestHash',
]);
const BUILD_KEYS = new Set([
  'schemaVersion', 'authoringRequestId', 'authoringAttemptId', 'inputManifestHash',
  'terminalCheckpointManifestRef', 'semanticAuthorityRef', 'bindingAuthorityRef',
  'artifactEntries', 'decisionReceiptRefs', 'auditPacketRef', 'projectionReportRefs',
  'buildManifestHash',
]);

function canonicalPath(value: string): boolean {
  return Boolean(value) && !value.includes('\\') && !path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value && value !== '..' && !value.startsWith('../');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

const ARTIFACT_KEYS = new Set(['role', 'schemaVersion', 'artifactId', 'recordRelativePath', 'artifactHash']);
const DECISION_REF_KEYS = new Set(['decisionReceiptId', 'path', 'hash']);
const CHECKPOINT_REF_KEYS = new Set(['checkpointId', 'checkpointOrdinal', 'path', 'hash']);
const AUTHORITY_REF_KEYS = new Set(['semanticRevisionId', 'path', 'hash']);
const BINDING_REF_KEYS = new Set(['bindingRevisionId', 'path', 'hash']);
const ARTIFACT_REF_KEYS = new Set(['artifactId', 'path', 'hash']);

function refIssues(
  value: unknown,
  keys: ReadonlySet<string>,
  identityKey: string,
  code: string
): string[] {
  if (!isRecord(value) || !hasExactKeys(value, keys)) return [code];
  if (!nonEmptyString(value[identityKey]) || !canonicalPath(String(value.path)) || !SHA256.test(String(value.hash))) {
    return [code];
  }
  return [];
}

function decisionRefIssues(value: unknown): string[] {
  return refIssues(value, DECISION_REF_KEYS, 'decisionReceiptId', 'authoring_manifest_decision_ref_invalid');
}

function normalizeArtifacts(entries: RequirementsAuthoringArtifactEntry[]) {
  return [...entries]
    .map((entry) => ({
      role: entry.role,
      schemaVersion: entry.schemaVersion,
      artifactId: entry.artifactId,
      recordRelativePath: entry.recordRelativePath,
      artifactHash: entry.artifactHash,
    }))
    .sort((left, right) => left.role.localeCompare(right.role) ||
      left.recordRelativePath.localeCompare(right.recordRelativePath));
}

function normalizeRefs<T extends { path: string; hash: string }>(refs: T[]): T[] {
  return [...refs].sort((left, right) => left.path.localeCompare(right.path));
}

function setLikeRefIssues<T extends { path: string; hash: string }>(
  refs: T[],
  identityKey: keyof T,
  orderCode: string,
  duplicateCode: string
): string[] {
  const issues: string[] = [];
  const identities = refs.map((ref) => `${String(ref[identityKey])}\n${ref.path}`);
  if (new Set(identities).size !== identities.length) issues.push(duplicateCode);
  if (canonicalRequirementsJson(refs) !== canonicalRequirementsJson(normalizeRefs(refs))) {
    issues.push(orderCode);
  }
  return issues;
}

function artifactIssues(entries: RequirementsAuthoringArtifactEntry[]): string[] {
  const issues: string[] = [];
  const identities = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry) || !hasExactKeys(entry, ARTIFACT_KEYS)) {
      issues.push('authoring_manifest_artifact_shape_invalid');
      continue;
    }
    if (!REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES.includes(entry.role)) {
      issues.push('authoring_manifest_artifact_role_unknown');
    }
    if (!nonEmptyString(entry.schemaVersion) || !nonEmptyString(entry.artifactId)) {
      issues.push('authoring_manifest_artifact_identity_invalid');
    }
    if (!canonicalPath(entry.recordRelativePath)) issues.push('authoring_manifest_artifact_path_invalid');
    if (!SHA256.test(entry.artifactHash)) issues.push('authoring_manifest_artifact_hash_invalid');
    const identity = `${entry.role}\n${entry.recordRelativePath}`;
    if (identities.has(identity)) issues.push('authoring_manifest_artifact_duplicate');
    identities.add(identity);
  }
  if (canonicalRequirementsJson(entries) !== canonicalRequirementsJson(normalizeArtifacts(entries))) {
    issues.push('authoring_manifest_artifact_order_invalid');
  }
  return issues;
}

export function createRequirementsContractCheckpointManifest(
  input: Omit<RequirementsContractCheckpointManifest, 'schemaVersion' | 'checkpointManifestHash'>
): RequirementsContractCheckpointManifest {
  const payload = {
    schemaVersion: 'requirements-contract-authoring-checkpoint-manifest/v1' as const,
    ...input,
    artifactEntries: normalizeArtifacts(input.artifactEntries),
    decisionReceiptRefs: normalizeRefs(input.decisionReceiptRefs),
  };
  const manifest = {
    ...payload,
    checkpointManifestHash: requirementsContractDomainHash(
      'requirements-contract-authoring-checkpoint-manifest/v1', payload
    ),
  };
  const validation = validateRequirementsContractCheckpointManifest(manifest);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return manifest;
}

export function validateRequirementsContractCheckpointManifest(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['authoring_checkpoint_manifest_invalid'] };
  }
  const manifest = value as RequirementsContractCheckpointManifest & Record<string, unknown>;
  if (Object.keys(manifest).some((key) => !CHECKPOINT_KEYS.has(key))) issueCodes.push('authoring_checkpoint_manifest_unknown_field');
  if ([...CHECKPOINT_KEYS].some((key) => !Object.hasOwn(manifest, key))) {
    issueCodes.push('authoring_checkpoint_manifest_required_field_missing');
  }
  if (manifest.schemaVersion !== 'requirements-contract-authoring-checkpoint-manifest/v1') issueCodes.push('authoring_checkpoint_manifest_schema_version_invalid');
  if (![manifest.authoringRequestId, manifest.authoringAttemptId, manifest.checkpointId, manifest.compilerIdentity].every(nonEmptyString)) {
    issueCodes.push('authoring_checkpoint_identity_invalid');
  }
  if (!Number.isSafeInteger(manifest.checkpointOrdinal) || manifest.checkpointOrdinal < 0) issueCodes.push('authoring_checkpoint_ordinal_invalid');
  if (!CLOSED_CHECKPOINT_IDS.has(String(manifest.stage)) || manifest.stage !== manifest.checkpointId) {
    issueCodes.push('authoring_checkpoint_stage_invalid');
  }
  if (!CLOSED_CHECKPOINT_STATUSES.has(String(manifest.status))) issueCodes.push('authoring_checkpoint_status_invalid');
  if (!SHA256.test(String(manifest.inputManifestHash))) issueCodes.push('authoring_checkpoint_input_hash_invalid');
  const expectedCheckpointId = Number.isSafeInteger(manifest.checkpointOrdinal)
    ? `cp${String(manifest.checkpointOrdinal).padStart(2, '0')}`
    : null;
  if (expectedCheckpointId !== manifest.checkpointId) issueCodes.push('authoring_checkpoint_id_ordinal_mismatch');
  if (manifest.checkpointOrdinal === 0 &&
      (manifest.previousCheckpointManifestRef !== null || manifest.latestValidPredecessorCheckpoint !== null)) {
    issueCodes.push('authoring_checkpoint_previous_lineage_invalid');
  }
  if (manifest.checkpointOrdinal > 0) {
    const previous = manifest.previousCheckpointManifestRef;
    if (refIssues(previous, CHECKPOINT_REF_KEYS, 'checkpointId', 'authoring_checkpoint_previous_lineage_invalid').length > 0) {
      issueCodes.push('authoring_checkpoint_previous_lineage_invalid');
    } else if (previous) {
      if (previous.checkpointOrdinal !== manifest.checkpointOrdinal - 1) {
        issueCodes.push('authoring_checkpoint_previous_ordinal_invalid');
      }
      const expectedPreviousPath = `authoring/staging/${manifest.authoringAttemptId}/manifests/${previous.checkpointOrdinal}-${previous.checkpointId}.json`;
      if (previous.path !== expectedPreviousPath) issueCodes.push('authoring_checkpoint_previous_path_identity_mismatch');
      if (manifest.latestValidPredecessorCheckpoint !== previous.checkpointId) {
        issueCodes.push('authoring_checkpoint_latest_predecessor_mismatch');
      }
    }
  }
  if (!Array.isArray(manifest.artifactEntries)) issueCodes.push('authoring_checkpoint_artifacts_invalid');
  else issueCodes.push(...artifactIssues(manifest.artifactEntries));
  if (!Array.isArray(manifest.decisionReceiptRefs)) issueCodes.push('authoring_checkpoint_decision_refs_invalid');
  else {
    for (const ref of manifest.decisionReceiptRefs) issueCodes.push(...decisionRefIssues(ref));
    issueCodes.push(...setLikeRefIssues(
      manifest.decisionReceiptRefs,
      'decisionReceiptId',
      'authoring_manifest_decision_ref_order_invalid',
      'authoring_manifest_decision_ref_duplicate'
    ));
  }
  if (manifest.baseAuthorityRef !== null && !isRecord(manifest.baseAuthorityRef)) {
    issueCodes.push('authoring_checkpoint_base_authority_invalid');
  }
  const { checkpointManifestHash, ...payload } = manifest;
  if (
    !SHA256.test(String(checkpointManifestHash)) ||
    checkpointManifestHash !== requirementsContractDomainHash(
      'requirements-contract-authoring-checkpoint-manifest/v1', payload
    )
  ) issueCodes.push('authoring_checkpoint_manifest_hash_mismatch');
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: [...new Set(issueCodes)].sort() };
}

export function createRequirementsContractBuildManifest(
  input: Omit<RequirementsContractBuildManifest, 'schemaVersion' | 'buildManifestHash'>
): RequirementsContractBuildManifest {
  const payload = {
    schemaVersion: 'requirements-contract-build-manifest/v1' as const,
    ...input,
    artifactEntries: normalizeArtifacts(input.artifactEntries),
    decisionReceiptRefs: normalizeRefs(input.decisionReceiptRefs),
    projectionReportRefs: normalizeRefs(input.projectionReportRefs),
  };
  const manifest = {
    ...payload,
    buildManifestHash: requirementsContractDomainHash(
      'requirements-contract-build-manifest/v1', payload
    ),
  };
  const validation = validateRequirementsContractBuildManifest(manifest);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return manifest;
}

export function validateRequirementsContractBuildManifest(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['authoring_build_manifest_invalid'] };
  }
  const manifest = value as RequirementsContractBuildManifest & Record<string, unknown>;
  if (Object.keys(manifest).some((key) => !BUILD_KEYS.has(key))) issueCodes.push('authoring_build_manifest_unknown_field');
  if ([...BUILD_KEYS].some((key) => !Object.hasOwn(manifest, key))) {
    issueCodes.push('authoring_build_manifest_required_field_missing');
  }
  if (manifest.schemaVersion !== 'requirements-contract-build-manifest/v1') issueCodes.push('authoring_build_manifest_schema_version_invalid');
  if (![manifest.authoringRequestId, manifest.authoringAttemptId].every(nonEmptyString)) {
    issueCodes.push('authoring_build_manifest_identity_invalid');
  }
  if (!SHA256.test(String(manifest.inputManifestHash))) issueCodes.push('authoring_build_manifest_input_hash_invalid');
  if (!Array.isArray(manifest.artifactEntries)) issueCodes.push('authoring_build_manifest_artifacts_invalid');
  else issueCodes.push(...artifactIssues(manifest.artifactEntries));
  if (!Array.isArray(manifest.decisionReceiptRefs)) issueCodes.push('authoring_build_manifest_decision_refs_invalid');
  else {
    for (const ref of manifest.decisionReceiptRefs) issueCodes.push(...decisionRefIssues(ref));
    issueCodes.push(...setLikeRefIssues(
      manifest.decisionReceiptRefs,
      'decisionReceiptId',
      'authoring_manifest_decision_ref_order_invalid',
      'authoring_manifest_decision_ref_duplicate'
    ));
  }
  issueCodes.push(...refIssues(manifest.terminalCheckpointManifestRef, CHECKPOINT_REF_KEYS, 'checkpointId', 'authoring_build_terminal_checkpoint_ref_invalid'));
  issueCodes.push(...refIssues(manifest.semanticAuthorityRef, AUTHORITY_REF_KEYS, 'semanticRevisionId', 'authoring_build_semantic_ref_invalid'));
  issueCodes.push(...refIssues(manifest.bindingAuthorityRef, BINDING_REF_KEYS, 'bindingRevisionId', 'authoring_build_binding_ref_invalid'));
  issueCodes.push(...refIssues(manifest.auditPacketRef, ARTIFACT_REF_KEYS, 'artifactId', 'authoring_build_audit_packet_ref_invalid'));
  if (!Array.isArray(manifest.projectionReportRefs)) issueCodes.push('authoring_build_projection_refs_invalid');
  else {
    for (const ref of manifest.projectionReportRefs) {
      issueCodes.push(...refIssues(ref, ARTIFACT_REF_KEYS, 'artifactId', 'authoring_build_projection_ref_invalid'));
    }
    issueCodes.push(...setLikeRefIssues(
      manifest.projectionReportRefs,
      'artifactId',
      'authoring_build_projection_ref_order_invalid',
      'authoring_build_projection_ref_duplicate'
    ));
  }
  if (isRecord(manifest.terminalCheckpointManifestRef)) {
    const terminal = manifest.terminalCheckpointManifestRef;
    const expected = `authoring/staging/${manifest.authoringAttemptId}/manifests/${terminal.checkpointOrdinal}-${terminal.checkpointId}.json`;
    if (terminal.checkpointId !== 'cp08' || terminal.checkpointOrdinal !== 8 || terminal.path !== expected) {
      issueCodes.push('authoring_build_terminal_checkpoint_identity_mismatch');
    }
  }
  if (isRecord(manifest.semanticAuthorityRef) &&
      manifest.semanticAuthorityRef.path !== `authoring/semantic-revisions/${manifest.semanticAuthorityRef.semanticRevisionId}/semantic-ir.json`) {
    issueCodes.push('authoring_build_semantic_path_identity_mismatch');
  }
  if (isRecord(manifest.bindingAuthorityRef) &&
      manifest.bindingAuthorityRef.path !== `authoring/source-bindings/${manifest.bindingAuthorityRef.bindingRevisionId}/source-binding.json`) {
    issueCodes.push('authoring_build_binding_path_identity_mismatch');
  }
  if (isRecord(manifest.auditPacketRef) &&
      manifest.auditPacketRef.path !== `authoring/staging/${manifest.authoringAttemptId}/judge-audit-packet.json`) {
    issueCodes.push('authoring_build_audit_packet_path_identity_mismatch');
  }
  const { buildManifestHash, ...payload } = manifest;
  if (
    !SHA256.test(String(buildManifestHash)) ||
    buildManifestHash !== requirementsContractDomainHash(
      'requirements-contract-build-manifest/v1', payload
    )
  ) issueCodes.push('authoring_build_manifest_hash_mismatch');
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: [...new Set(issueCodes)].sort() };
}
