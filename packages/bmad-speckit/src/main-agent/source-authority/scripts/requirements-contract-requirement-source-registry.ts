import {
  type RequirementSourceIdentityAuthorityKind,
} from './requirements-contract-project-profile';
import { resolvePlanningArtifactPath } from './requirements-contract-planning-artifact-resolver';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementSourceRegistryEntry {
  recordId: string;
  requirementSetId: string;
  branch: string;
  source: {
    path: string;
    hash: string;
    sourceKind: 'requirement_source_prd';
  };
  identityAuthority: {
    kind: RequirementSourceIdentityAuthorityKind;
    ref: string;
    hash: string;
  };
}

export interface RequirementSourceRegistry {
  schemaVersion: 'requirements-contract-requirement-source-registry/v1';
  registryId: string;
  entries: RequirementSourceRegistryEntry[];
  registryHash: string;
}

export interface CreateRequirementSourceRegistryInput {
  registryId: string;
  entries: RequirementSourceRegistryEntry[];
}

const HASH = /^sha256:[a-f0-9]{64}$/u;
const AUTHORITY_KINDS = new Set<RequirementSourceIdentityAuthorityKind>([
  'registered_requirement_record',
  'source_prd_identity_block',
  'discovery_session_receipt',
  'legacy_migration_receipt',
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEntry(entry: unknown): entry is RequirementSourceRegistryEntry {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const value = entry as RequirementSourceRegistryEntry;
  if (
    !nonEmpty(value.recordId) ||
    !nonEmpty(value.requirementSetId) ||
    !nonEmpty(value.branch) ||
    !value.source ||
    value.source.sourceKind !== 'requirement_source_prd' ||
    !nonEmpty(value.source.path) ||
    !HASH.test(value.source.hash) ||
    !value.identityAuthority ||
    !AUTHORITY_KINDS.has(value.identityAuthority.kind) ||
    !nonEmpty(value.identityAuthority.ref) ||
    !HASH.test(value.identityAuthority.hash)
  ) {
    return false;
  }
  try {
    return (
      value.source.path ===
      resolvePlanningArtifactPath({
        role: 'requirement_source_prd',
        branch: value.branch,
        requirementSetId: value.requirementSetId,
      })
    );
  } catch {
    return false;
  }
}

export function validateRequirementSourceRegistry(
  value: unknown
): value is RequirementSourceRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const registry = value as RequirementSourceRegistry;
  if (
    registry.schemaVersion !==
      'requirements-contract-requirement-source-registry/v1' ||
    !nonEmpty(registry.registryId) ||
    !Array.isArray(registry.entries) ||
    !registry.entries.every(validateEntry) ||
    !HASH.test(registry.registryHash)
  ) {
    return false;
  }
  const requirementSetIds = new Set<string>();
  const recordIds = new Set<string>();
  const sourcePaths = new Set<string>();
  for (const entry of registry.entries) {
    if (
      requirementSetIds.has(entry.requirementSetId) ||
      recordIds.has(entry.recordId) ||
      sourcePaths.has(entry.source.path)
    ) {
      return false;
    }
    requirementSetIds.add(entry.requirementSetId);
    recordIds.add(entry.recordId);
    sourcePaths.add(entry.source.path);
  }
  const { registryHash, ...payload } = registry;
  return registryHash === sha256Stable(payload);
}

export function createRequirementSourceRegistry(
  input: CreateRequirementSourceRegistryInput
): RequirementSourceRegistry {
  const entries = structuredClone(input.entries).sort((left, right) =>
    left.requirementSetId.localeCompare(right.requirementSetId)
  );
  const payload = {
    schemaVersion:
      'requirements-contract-requirement-source-registry/v1' as const,
    registryId: input.registryId,
    entries,
  };
  const registry = { ...payload, registryHash: sha256Stable(payload) };
  if (!validateRequirementSourceRegistry(registry)) {
    throw new Error('requirement_source_registry_invalid');
  }
  return registry;
}

export function resolveRequirementSourceBinding(input: {
  registry: RequirementSourceRegistry;
  requirementSetId: string;
  observedSourceHash?: string;
}): RequirementSourceRegistryEntry {
  if (!validateRequirementSourceRegistry(input.registry)) {
    throw new Error('requirement_source_registry_invalid');
  }
  const matches = input.registry.entries.filter(
    (entry) => entry.requirementSetId === input.requirementSetId
  );
  if (matches.length === 0) throw new Error('requirement_source_not_registered');
  if (matches.length !== 1) throw new Error('requirement_source_ambiguous');
  const resolved = matches[0];
  if (
    input.observedSourceHash !== undefined &&
    input.observedSourceHash !== resolved.source.hash
  ) {
    throw new Error('requirement_source_hash_mismatch');
  }
  return structuredClone(resolved);
}
