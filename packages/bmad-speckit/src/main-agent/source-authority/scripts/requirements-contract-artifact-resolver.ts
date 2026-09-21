import { readRequirementsContentObject, type RequirementsContentRef } from './requirements-contract-content-store';
import { requirementsContractDomainHash } from './requirements-contract-hash-domains';
import {
  REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES,
  type RequirementsAuthoringArtifactRole,
} from './requirements-contract-authoring-manifest';
import { validateRequirementsContractSemanticIr } from './requirements-contract-semantic-ir';
import {
  validateRequirementsContractResolvedEvidenceIndex,
  validateRequirementsContractSourceBindingCapsule,
} from './requirements-contract-source-binding-capsule';
import { validateRequirementsContractExecutionManifest } from './requirements-contract-execution-manifest';
import {
  hydrateRequirementsContractJudgeAuditPacket,
  validateJudgeAuditPacketV3,
} from './requirements-contract-judge-audit-packet';

export interface RequirementsAuthoringArtifactEntryV2 {
  role: RequirementsAuthoringArtifactRole;
  schemaVersion: string;
  semanticHash: string;
  contentRef: RequirementsContentRef;
}

const ROLE_SCHEMA_VERSIONS: Partial<Record<RequirementsAuthoringArtifactRole, ReadonlySet<string>>> = {
  semantic_ir: new Set(['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2']),
  source_binding: new Set(['requirements-contract-source-binding/v1', 'requirements-contract-source-binding/v2']),
  resolved_evidence_index: new Set(['requirements-contract-resolved-evidence-index/v1']),
  execution_manifest: new Set(['requirements-contract-execution-manifest/v1', 'requirements-contract-execution-manifest/v2']),
  final_markdown: new Set(['markdown/v1']),
  confirmation_projection: new Set(['requirements-contract-confirmation-projection/v1', 'requirements-contract-confirmation-projection/v2']),
  per_must_bundle: new Set(['requirements-contract-per-must-bundle/v1']),
  trace_matrix: new Set(['requirements-contract-trace-matrix/v1']),
  diagram_set: new Set(['requirements-contract-diagram-set/v1']),
  projection_reconciliation_report: new Set(['requirements-contract-projection-reconciliation-report/v1']),
  authority_resolution_report: new Set(['requirements-contract-authority-resolution-report/v1']),
  renderability_probe_report: new Set(['requirements-contract-renderability-probe-report/v1']),
  judge_audit_packet: new Set(['requirements-contract-judge-audit-packet/v3']),
  judge_audit_packet_coverage: new Set(['requirements-contract-judge-audit-packet-coverage/v1']),
  semantic_kernel: new Set(['requirements-contract-semantic-kernel/v1']),
  must_decomposition_packet: new Set(['requirements-contract-must-decomposition-packet/v1']),
  id_registry: new Set(['requirements-contract-id-registry/v1']),
};

const ROLE_REQUIRED_FIELDS: Partial<Record<RequirementsAuthoringArtifactRole, readonly string[]>> = {
  semantic_kernel: ['sourceRoots'],
  must_decomposition_packet: ['atoms', 'candidateHash'],
  id_registry: ['sourceRootIds', 'atomIds'],
  confirmation_projection: ['semanticRevisionId', 'scopeSemanticHash', 'requirements'],
  per_must_bundle: ['semanticRevisionId', 'scopeSemanticHash', 'bundles'],
  trace_matrix: ['semanticRevisionId', 'scopeSemanticHash', 'rows'],
  diagram_set: ['semanticRevisionId', 'scopeSemanticHash', 'diagrams'],
  projection_reconciliation_report: ['semanticRevisionId', 'scopeSemanticHash', 'decision', 'nodes'],
  authority_resolution_report: ['semanticRevisionId', 'scopeSemanticHash', 'decision', 'resolutions'],
  renderability_probe_report: ['semanticRevisionId', 'scopeSemanticHash', 'decision', 'promotable'],
  judge_audit_packet_coverage: ['semanticRevisionId', 'scopeSemanticHash', 'artifactIds', 'allApplicableArtifactsIncluded'],
};

for (const role of REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES) {
  if (!ROLE_SCHEMA_VERSIONS[role]) {
    ROLE_SCHEMA_VERSIONS[role] = new Set([`requirements-contract-${role.replace(/_/gu, '-')}/v1`]);
  }
}

function schemaMatchesRole(role: RequirementsAuthoringArtifactRole, schemaVersion: string): boolean {
  const exact = ROLE_SCHEMA_VERSIONS[role];
  if (exact) return exact.has(schemaVersion);
  const roleName = role.replace(/_/gu, '-');
  return schemaVersion.startsWith(`requirements-contract-${roleName}/`);
}

function validateRegisteredProjectionShape(role: RequirementsAuthoringArtifactRole, value: Record<string, unknown>): boolean {
  const required = ROLE_REQUIRED_FIELDS[role] ?? [];
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false;
  return Object.keys(value).length > 1;
}

export function resolveRequirementsAuthoringArtifact(input: {
  recordRoot: string;
  entry: RequirementsAuthoringArtifactEntryV2;
}): unknown {
  if (!REQUIREMENTS_CONTRACT_AUTHORING_ARTIFACT_ROLES.includes(input.entry.role)) {
    throw new Error('requirements_authoring_artifact_role_invalid');
  }
  if (!/^[-A-Za-z0-9_.]+\/v[0-9]+$/u.test(input.entry.schemaVersion)) {
    throw new Error('requirements_authoring_artifact_schema_invalid');
  }
  if (!schemaMatchesRole(input.entry.role, input.entry.schemaVersion)) {
    throw new Error('requirements_authoring_artifact_schema_invalid');
  }
  const bytes = readRequirementsContentObject({ recordRoot: input.recordRoot, ref: input.entry.contentRef });
  if (/^text\/(?:markdown|plain)(?:;|$)/iu.test(input.entry.contentRef.mediaType)) {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const expected = requirementsContractDomainHash(`requirements-projection:${input.entry.role}/v1`, value);
    if (input.entry.semanticHash !== expected) throw new Error('requirements_authoring_artifact_semantic_hash_mismatch');
    return value;
  }
  if (!/^application\/(?:json|[^;]+\+json)(?:;|$)/iu.test(input.entry.contentRef.mediaType)) {
    throw new Error('requirements_authoring_artifact_media_type_unsupported');
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('requirements_authoring_artifact_json_invalid');
  }
  if (
    !value || typeof value !== 'object' || Array.isArray(value) ||
    (value as Record<string, unknown>).schemaVersion !== input.entry.schemaVersion
  ) throw new Error('requirements_authoring_artifact_schema_invalid');
  if (!validateRegisteredProjectionShape(input.entry.role, value as Record<string, unknown>)) {
    throw new Error('requirements_authoring_artifact_schema_invalid');
  }
  if (
    input.entry.role === 'semantic_ir' &&
    input.entry.schemaVersion.startsWith('requirements-contract-semantic-ir/') &&
    validateRequirementsContractSemanticIr(value).decision !== 'pass'
  ) throw new Error('requirements_authoring_artifact_schema_invalid');
  if (
    input.entry.role === 'source_binding' &&
    input.entry.schemaVersion.startsWith('requirements-contract-source-binding/') &&
    validateRequirementsContractSourceBindingCapsule(value).decision !== 'pass'
  ) throw new Error('requirements_authoring_artifact_schema_invalid');
  if (input.entry.role === 'resolved_evidence_index') {
    const validation = validateRequirementsContractResolvedEvidenceIndex(value);
    if (validation.decision !== 'pass') {
      throw new Error('requirements_authoring_artifact_schema_invalid');
    }
  }
  if (
    input.entry.role === 'execution_manifest' &&
    validateRequirementsContractExecutionManifest(value).decision !== 'pass'
  ) throw new Error('requirements_authoring_artifact_schema_invalid');
  if (
    input.entry.role === 'judge_audit_packet' &&
    input.entry.schemaVersion === 'requirements-contract-judge-audit-packet/v3'
  ) {
    try {
      validateJudgeAuditPacketV3(value);
      hydrateRequirementsContractJudgeAuditPacket({
        recordRoot: input.recordRoot,
        packetRef: input.entry.contentRef,
      });
    } catch {
      throw new Error('requirements_authoring_artifact_schema_invalid');
    }
  }
  const expected = requirementsContractDomainHash(
    `requirements-projection:${input.entry.role}/v1`,
    value
  );
  if (input.entry.semanticHash !== expected) {
    throw new Error('requirements_authoring_artifact_semantic_hash_mismatch');
  }
  return value;
}
