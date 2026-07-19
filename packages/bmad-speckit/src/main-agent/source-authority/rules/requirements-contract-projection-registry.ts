import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_PROJECTION_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-projection-registry.ts';

export const REQUIREMENTS_CONTRACT_PROJECTION_REGISTRY_CANONICAL_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-projection-registry.json';

const SHARED_REQUIREMENTS_CONTRACT_SURFACE_ROOTS = [
  '_bmad/shared/requirements-contract',
  '.codex/shared/requirements-contract',
  '.cursor/shared/requirements-contract',
  '.claude/shared/requirements-contract',
  'packages/bmad-speckit/_bmad/shared/requirements-contract',
  'packages/bmad-speckit/dist/main-agent/source-authority/_bmad/shared/requirements-contract',
] as const;

const PROJECTION_ASSETS = [
  {
    projectionId: 'canonical_markdown_source_parser',
    fileName: 'markdown-source-parser.js',
  },
  {
    projectionId: 'artifact_role_registry',
    fileName: 'requirements-contract-artifact-role-registry.json',
  },
  {
    projectionId: 'diagram_policy_registry',
    fileName: 'requirements-contract-diagram-policy-registry.json',
  },
  {
    projectionId: 'lint_profile_registry',
    fileName: 'requirements-contract-lint-profile-registry.json',
  },
  {
    projectionId: 'judge_provider_registry',
    fileName: 'requirements-contract-judge-provider-registry.json',
  },
  {
    projectionId: 'package_runtime_action_binding_manifest',
    fileName: 'requirements-contract-package-runtime-action-binding-manifest.json',
  },
  {
    projectionId: 'project_profile_manifest',
    fileName: 'requirements-contract-project-profile-manifest.json',
  },
  {
    projectionId: 'safe_write_target_registry',
    fileName: 'requirements-contract-safe-write-target-registry.json',
  },
  {
    projectionId: 'trace_edge_type_registry',
    fileName: 'requirements-contract-trace-edge-type-registry.json',
  },
  {
    projectionId: 'requirements_policy_catalog',
    fileName: 'requirements-policy-catalog.yaml',
  },
] as const;

export interface RequirementsContractProjectionRegistryEntry {
  projectionId: string;
  canonicalPath: string;
  canonicalHash: string;
  surfacePaths: string[];
  surfaceHashes: Record<string, string>;
  allowedDifferences: string[];
  authority: 'none';
}

function normalize(value: string): string {
  return value.replace(/\\/gu, '/');
}

function fileHash(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  return `sha256:${createHash('sha256').update(readFileSync(resolved)).digest('hex')}`;
}

function projectionEntry(
  root: string,
  asset: (typeof PROJECTION_ASSETS)[number]
): RequirementsContractProjectionRegistryEntry {
  const surfacePaths = SHARED_REQUIREMENTS_CONTRACT_SURFACE_ROOTS.map((surfaceRoot) =>
    normalize(path.posix.join(surfaceRoot, asset.fileName))
  );
  const canonicalPath = surfacePaths[0];
  return {
    projectionId: asset.projectionId,
    canonicalPath,
    canonicalHash: fileHash(root, canonicalPath),
    surfacePaths,
    surfaceHashes: Object.fromEntries(
      surfacePaths.map((surfacePath) => [surfacePath, fileHash(root, surfacePath)])
    ),
    allowedDifferences: [],
    authority: 'none',
  };
}

export function createRequirementsContractProjectionRegistry(root = process.cwd()) {
  const ownerHash = fileHash(root, REQUIREMENTS_CONTRACT_PROJECTION_REGISTRY_OWNER_PATH);
  const projections = PROJECTION_ASSETS.map((asset) => projectionEntry(root, asset));
  const schemaVersion = 'requirements-contract-projection-registry/v1';
  return {
    schemaVersion,
    owner: {
      path: REQUIREMENTS_CONTRACT_PROJECTION_REGISTRY_OWNER_PATH,
      hash: ownerHash,
    },
    registryHash: sha256Stable({ schemaVersion, projections }),
    projections,
    authority: 'none',
  } as const;
}

export const REQUIREMENTS_CONTRACT_PROJECTION_ASSETS = PROJECTION_ASSETS;
export const REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS =
  SHARED_REQUIREMENTS_CONTRACT_SURFACE_ROOTS;
