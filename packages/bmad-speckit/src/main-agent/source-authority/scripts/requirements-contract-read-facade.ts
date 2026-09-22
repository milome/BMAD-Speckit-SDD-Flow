import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  validateRequirementsContractDocument,
  type RequirementsContractValidationMode,
} from './requirements-contract-validation-facade';
import { readRequirementsContractV2Bundle } from './requirements-contract-v2-read-adapter';

export interface RequirementsContractReadEnvelope {
  requirementSetId: string;
  sourcePath: string;
  sourceHash: string;
  sourceFormatVersion: 'requirement-contract-model/v2';
  activeBundleRevision: string;
  bundleManifestPath?: string;
  semanticModelHash: string;
  traceGraphHash: string;
}

export const REQUIREMENTS_CONTRACT_CANONICAL_PROJECTION_ROLES = [
  'target_bindings',
  'task_graph',
  'red_contracts',
  'oracle_registry',
  'acceptance_manifest',
  'evidence_requirements',
  'business_behavior_delta',
  'implementation_impact_map',
] as const;

export type RequirementsContractCanonicalProjectionRole =
  (typeof REQUIREMENTS_CONTRACT_CANONICAL_PROJECTION_ROLES)[number];

export interface RequirementsContractCanonicalProjections {
  target_bindings: Record<string, unknown> | null;
  task_graph: Record<string, unknown> | null;
  red_contracts: Record<string, unknown> | null;
  oracle_registry: Record<string, unknown> | null;
  acceptance_manifest: Record<string, unknown> | null;
  evidence_requirements: Record<string, unknown> | null;
  business_behavior_delta: Record<string, unknown> | null;
  implementation_impact_map: Record<string, unknown> | null;
}

export interface RequirementsContractReadInput {
  projectRoot: string;
  consumerId: string;
  mode: RequirementsContractValidationMode;
  envelope: RequirementsContractReadEnvelope;
}

export interface RequirementsContractLogicalReadInput {
  projectRoot: string;
  consumerId: string;
  mode: RequirementsContractValidationMode;
  requirementSetId: string;
  expectedSemanticModelHash: string;
  expectedTraceGraphHash: string;
  requiredProjectionRoles?: RequirementsContractCanonicalProjectionRole[];
}

export interface RequirementsContractReadIssue {
  code:
    | 'consumer_registry_missing'
    | 'consumer_registry_invalid'
    | 'consumer_not_registered'
    | 'consumer_contract_mismatch'
    | 'source_envelope_invalid'
    | 'source_missing'
    | 'source_hash_mismatch'
    | 'unsupported_source_format'
    | 'adapter_blocked'
    | 'lifecycle_validation_blocked'
    | 'canonical_projection_missing'
    | 'canonical_projection_invalid'
    | 'requirement_record_missing'
    | 'requirement_record_invalid'
    | 'requirement_record_identity_mismatch'
    | 'requirement_record_hash_mismatch';
  path: string;
  message: string;
}

export interface RequirementsContractReadResult {
  ok: boolean;
  decision: 'pass' | 'block';
  adapterInvoked: boolean;
  issues: RequirementsContractReadIssue[];
  logicalModel: Record<string, unknown> | null;
  traceGraph: Record<string, unknown> | null;
  projections: RequirementsContractCanonicalProjections;
}

const CONSUMER_REGISTRY_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function emptyProjections(): RequirementsContractCanonicalProjections {
  return {
    target_bindings: null,
    task_graph: null,
    red_contracts: null,
    oracle_registry: null,
    acceptance_manifest: null,
    evidence_requirements: null,
    business_behavior_delta: null,
    implementation_impact_map: null,
  };
}

function blocked(
  code: RequirementsContractReadIssue['code'],
  issuePath: string,
  message: string
): RequirementsContractReadResult {
  return {
    ok: false,
    decision: 'block',
    adapterInvoked: false,
    issues: [{ code, path: issuePath, message }],
    logicalModel: null,
    traceGraph: null,
    projections: emptyProjections(),
  };
}

function blockedWithIssues(input: {
  adapterInvoked: boolean;
  issues: RequirementsContractReadIssue[];
}): RequirementsContractReadResult {
  return {
    ok: false,
    decision: 'block',
    adapterInvoked: input.adapterInvoked,
    issues: input.issues,
    logicalModel: null,
    traceGraph: null,
    projections: emptyProjections(),
  };
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function resolvesInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readCanonicalProjections(input: {
  projectRoot: string;
  manifest: Record<string, unknown>;
}): {
  projections: RequirementsContractCanonicalProjections;
  issues: RequirementsContractReadIssue[];
} {
  const projections = emptyProjections();
  const issues: RequirementsContractReadIssue[] = [];
  const members = Array.isArray(input.manifest.members) ? input.manifest.members : [];
  for (const member of members) {
    if (!isRecord(member)) continue;
    const role = member.role;
    if (
      typeof role !== 'string' ||
      !(REQUIREMENTS_CONTRACT_CANONICAL_PROJECTION_ROLES as readonly string[]).includes(role)
    ) {
      continue;
    }
    if (projections[role as RequirementsContractCanonicalProjectionRole]) {
      issues.push({
        code: 'canonical_projection_invalid',
        path: String(member.path ?? role),
        message: `duplicate canonical Bundle projection role: ${role}`,
      });
      continue;
    }
    const memberPath = path.resolve(input.projectRoot, String(member.path ?? ''));
    if (!resolvesInside(path.resolve(input.projectRoot), memberPath) || !existsSync(memberPath)) {
      issues.push({
        code: 'canonical_projection_missing',
        path: String(member.path ?? role),
        message: `canonical Bundle projection is missing: ${role}`,
      });
      continue;
    }
    try {
      if (typeof member.hash !== 'string' || sha256File(memberPath) !== member.hash) {
        throw new Error('canonical Bundle projection hash mismatch');
      }
      const parsed: unknown = JSON.parse(readFileSync(memberPath, 'utf8'));
      if (!isRecord(parsed)) throw new Error('canonical Bundle projection root must be an object');
      projections[role as RequirementsContractCanonicalProjectionRole] = parsed;
    } catch (error) {
      issues.push({
        code: 'canonical_projection_invalid',
        path: String(member.path ?? role),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { projections, issues };
}

function activationSelector(registry: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(registry.activation)) return registry.activation;
  if (
    'shadowOutputEnabled' in registry ||
    'v1OutputEnabled' in registry ||
    'productionReadModelVersion' in registry
  ) {
    return registry;
  }
  return null;
}

function consumerModes(consumer: Record<string, unknown>): string[] {
  if (Array.isArray(consumer.supportedModes)) {
    return consumer.supportedModes.filter((value): value is string => typeof value === 'string');
  }
  if (Array.isArray(consumer.validationModes)) {
    return consumer.validationModes.filter((value): value is string => typeof value === 'string');
  }
  return typeof consumer.validationMode === 'string' ? [consumer.validationMode] : [];
}

function consumerContractMatches(input: {
  consumer: Record<string, unknown>;
  mode: RequirementsContractValidationMode;
  sourceFormatVersion: RequirementsContractReadEnvelope['sourceFormatVersion'];
}): boolean {
  return (
    new Set(['requirements-contract-read-facade', 'requirements-contract-read-facade/v1']).has(
      String(input.consumer.readFacadeRef)
    ) &&
    new Set([
      'requirements-contract-v2-read-adapter',
      'requirements-contract-v2-read-adapter/v1',
    ]).has(String(input.consumer.adapterRef)) &&
    new Set(['v2', 'requirement-contract-model/v2']).has(
      String(input.consumer.sourceFormatVersion)
    ) &&
    consumerModes(input.consumer).includes(input.mode)
  );
}

function validateSourceEnvelope(
  projectRoot: string,
  envelope: RequirementsContractReadEnvelope
): RequirementsContractReadIssue[] {
  const issues: RequirementsContractReadIssue[] = [];
  if (
    !envelope.requirementSetId.trim() ||
    !envelope.sourcePath.trim() ||
    !/^sha256:[a-f0-9]{64}$/u.test(envelope.sourceHash) ||
    !/^sha256:[a-f0-9]{64}$/u.test(envelope.semanticModelHash) ||
    !/^sha256:[a-f0-9]{64}$/u.test(envelope.traceGraphHash)
  ) {
    issues.push({
      code: 'source_envelope_invalid',
      path: '/envelope',
      message: 'requirements contract source envelope is structurally invalid',
    });
    return issues;
  }
  const sourcePath = path.resolve(projectRoot, envelope.sourcePath);
  if (!resolvesInside(projectRoot, sourcePath) || !existsSync(sourcePath)) {
    issues.push({
      code: 'source_missing',
      path: envelope.sourcePath,
      message: 'requirements contract source is missing or outside the project root',
    });
  } else if (sha256File(sourcePath) !== envelope.sourceHash) {
    issues.push({
      code: 'source_hash_mismatch',
      path: envelope.sourcePath,
      message: 'requirements contract source bytes do not match the envelope hash',
    });
  }
  return issues;
}

function lifecycleResult(input: {
  mode: RequirementsContractValidationMode;
  logicalModel: Record<string, unknown>;
  traceGraph: Record<string, unknown> | null;
  projections: RequirementsContractCanonicalProjections;
}): RequirementsContractReadResult {
  const lifecycle = validateRequirementsContractDocument(input.logicalModel, input.mode);
  if (!lifecycle.ok) {
    return blockedWithIssues({
      adapterInvoked: true,
      issues: lifecycle.issues.map((issue) => ({
        code: 'lifecycle_validation_blocked',
        path: issue.path,
        message: `${issue.code}:${issue.message}`,
      })),
    });
  }
  return {
    ok: true,
    decision: 'pass',
    adapterInvoked: true,
    issues: [],
    logicalModel: input.logicalModel,
    traceGraph: input.traceGraph,
    projections: input.projections,
  };
}

export function readRequirementsContract(
  input: RequirementsContractReadInput
): RequirementsContractReadResult {
  const registryPath = path.resolve(input.projectRoot, CONSUMER_REGISTRY_PATH);
  if (!existsSync(registryPath)) {
    return blocked(
      'consumer_registry_missing',
      registryPath,
      'canonical requirements contract Consumer Registry is missing'
    );
  }

  let registry: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
    if (!isRecord(parsed)) throw new Error('Consumer Registry root must be an object');
    registry = parsed;
  } catch (error) {
    return blocked(
      'consumer_registry_invalid',
      registryPath,
      error instanceof Error ? error.message : String(error)
    );
  }
  const activation = activationSelector(registry);
  if (
    ![
      'requirements-contract-consumer-registry/v1',
      'requirements-contract-consumer-registry/v2',
    ].includes(String(registry.schemaVersion)) ||
    !activation ||
    activation.shadowOutputEnabled !== false ||
    activation.v1OutputEnabled !== false ||
    activation.productionReadModelVersion !== 'v2' ||
    !Array.isArray(registry.consumers)
  ) {
    return blocked(
      'consumer_registry_invalid',
      registryPath,
      'Consumer Registry schema or V2 production activation selector is invalid'
    );
  }
  const consumer = registry.consumers.find(
    (candidate) => isRecord(candidate) && candidate.consumerId === input.consumerId
  );
  if (!isRecord(consumer)) {
    return blocked(
      'consumer_not_registered',
      registryPath,
      `production semantic consumer is not registered: ${input.consumerId}`
    );
  }
  if (
    !consumerContractMatches({
      consumer,
      mode: input.mode,
      sourceFormatVersion: input.envelope.sourceFormatVersion,
    })
  ) {
    return blocked(
      'consumer_contract_mismatch',
      registryPath,
      'registered consumer does not bind the requested facade, adapter, format, and lifecycle mode'
    );
  }

  const projectRoot = path.resolve(input.projectRoot);
  const envelopeIssues = validateSourceEnvelope(projectRoot, input.envelope);
  if (envelopeIssues.length > 0) {
    return blockedWithIssues({ adapterInvoked: false, issues: envelopeIssues });
  }

  if (input.envelope.sourceFormatVersion === 'requirement-contract-model/v2') {
    const bundleManifestPath = input.envelope.bundleManifestPath
      ? path.resolve(projectRoot, input.envelope.bundleManifestPath)
      : path.resolve(
          projectRoot,
          '_bmad-output',
          'runtime',
          'requirement-records',
          input.envelope.requirementSetId,
          'authoring',
          'revisions',
          input.envelope.activeBundleRevision,
          'bundle-manifest.json'
        );
    const adapter = readRequirementsContractV2Bundle({
      projectRoot,
      bundleManifestPath,
      expectedRequirementSetId: input.envelope.requirementSetId,
      expectedSemanticModelHash: input.envelope.semanticModelHash,
      expectedTraceGraphHash: input.envelope.traceGraphHash,
    });
    if (!adapter.ok || !adapter.logicalModel) {
      return blockedWithIssues({
        adapterInvoked: true,
        issues: adapter.issues.map((issue) => ({
          code: 'adapter_blocked',
          path: issue.path,
          message: `${issue.code}:${issue.message}`,
        })),
      });
    }
    const projectionRead = readCanonicalProjections({
      projectRoot,
      manifest: adapter.manifest ?? {},
    });
    if (projectionRead.issues.length > 0) {
      return blockedWithIssues({
        adapterInvoked: true,
        issues: projectionRead.issues,
      });
    }
    return lifecycleResult({
      mode: input.mode,
      logicalModel: adapter.logicalModel,
      traceGraph: adapter.traceGraph,
      projections: projectionRead.projections,
    });
  }

  return blocked(
    'unsupported_source_format',
    input.envelope.sourcePath,
    `unsupported source format: ${String(input.envelope.sourceFormatVersion)}`
  );
}

function recordPath(projectRoot: string, requirementSetId: string): string {
  return path.resolve(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'requirement-record.json'
  );
}

export function readRequirementsContractForRequirementRecord(
  input: RequirementsContractLogicalReadInput
): RequirementsContractReadResult {
  const canonicalRecordPath = recordPath(input.projectRoot, input.requirementSetId);
  if (!existsSync(canonicalRecordPath)) {
    return blocked(
      'requirement_record_missing',
      canonicalRecordPath,
      'canonical Requirement Record is missing for the requested logical identity'
    );
  }

  let record: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(canonicalRecordPath, 'utf8'));
    if (!isRecord(parsed)) throw new Error('Requirement Record root must be an object');
    record = parsed;
  } catch (error) {
    return blocked(
      'requirement_record_invalid',
      canonicalRecordPath,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (
    record.requirementSetId !== input.requirementSetId ||
    typeof record.sourcePath !== 'string' ||
    typeof record.sourceDocumentHash !== 'string' ||
    typeof record.activeBundleRevision !== 'string'
  ) {
    return blocked(
      'requirement_record_identity_mismatch',
      canonicalRecordPath,
      'Requirement Record does not expose the requested logical identity and active revision'
    );
  }
  if (
    record.semanticModelHash !== input.expectedSemanticModelHash ||
    record.traceGraphHash !== input.expectedTraceGraphHash
  ) {
    return blocked(
      'requirement_record_hash_mismatch',
      canonicalRecordPath,
      'Requirement Record semantic or Trace Graph hash does not match the caller expectation'
    );
  }

  const result = readRequirementsContract({
    projectRoot: input.projectRoot,
    consumerId: input.consumerId,
    mode: input.mode,
    envelope: {
      requirementSetId: input.requirementSetId,
      sourcePath: record.sourcePath,
      sourceHash: record.sourceDocumentHash,
      sourceFormatVersion: 'requirement-contract-model/v2',
      activeBundleRevision: record.activeBundleRevision,
      semanticModelHash: input.expectedSemanticModelHash,
      traceGraphHash: input.expectedTraceGraphHash,
    },
  });
  if (!result.ok || !input.requiredProjectionRoles?.length) return result;
  const missing = input.requiredProjectionRoles.filter((role) => result.projections[role] === null);
  if (missing.length === 0) return result;
  return blockedWithIssues({
    adapterInvoked: result.adapterInvoked,
    issues: missing.map((role) => ({
      code: 'canonical_projection_missing',
      path: `#/projections/${role}`,
      message: `required canonical Bundle projection is unavailable: ${role}`,
    })),
  });
}
