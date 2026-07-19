import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  classifyRequirementsContractArtifactRole,
  REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier';

const ROOT = process.cwd();
const REGISTRY_OWNER_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'rules',
  'requirements-contract-discovery-envelope-registry.ts'
);
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface DiscoveryEnvelopeRegistry {
  schemaVersion: string;
  templateSchemaVersion: string;
  artifactRole: 'discovery_envelope';
  ownerPath: string;
  surfacePaths: string[];
  manifestBindings: Array<{
    manifestPath: string;
    declaredPath: string;
  }>;
  requiredFragments: string[];
  forbiddenFragments: string[];
  authority: 'none';
}

function loadRegistry(): DiscoveryEnvelopeRegistry {
  const script = [
    `import { REQUIREMENTS_CONTRACT_DISCOVERY_ENVELOPE_REGISTRY } from ${JSON.stringify(
      pathToFileURL(REGISTRY_OWNER_PATH).href
    )};`,
    'process.stdout.write(JSON.stringify(REQUIREMENTS_CONTRACT_DISCOVERY_ENVELOPE_REGISTRY));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, [TSX, '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    })
  ) as DiscoveryEnvelopeRegistry;
}

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('requirements contract Discovery Envelope surface parity', () => {
  it('publishes one registry owner bound to the discovery-envelope artifact role', () => {
    expect(existsSync(REGISTRY_OWNER_PATH)).toBe(true);
    if (!existsSync(REGISTRY_OWNER_PATH)) return;

    const registry = loadRegistry();
    expect(REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.allowedRoles).toContain(
      registry.artifactRole
    );
    const classification = classifyRequirementsContractArtifactRole({
      requestedArtifactRole: registry.artifactRole,
    });
    expect(classification.ok).toBe(true);
    expect(classification.classification?.outputPolicy).toEqual(
      REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.rolePolicies[
        registry.artifactRole
      ]
    );
  });

  it('keeps every declared host, package, and dist template byte-identical', () => {
    expect(existsSync(REGISTRY_OWNER_PATH)).toBe(true);
    if (!existsSync(REGISTRY_OWNER_PATH)) return;

    const registry = loadRegistry();
    const ownerPath = path.resolve(ROOT, registry.ownerPath);
    expect(existsSync(ownerPath)).toBe(true);
    if (!existsSync(ownerPath)) return;

    const ownerHash = fileHash(ownerPath);
    for (const surfacePath of registry.surfacePaths) {
      const resolved = path.resolve(ROOT, surfacePath);
      expect(existsSync(resolved), `Discovery Envelope surface missing: ${surfacePath}`).toBe(
        true
      );
      if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ownerHash);
    }
  });

  it('binds manifest hashes and discovery-only semantics to the canonical owner', () => {
    expect(existsSync(REGISTRY_OWNER_PATH)).toBe(true);
    if (!existsSync(REGISTRY_OWNER_PATH)) return;

    const registry = loadRegistry();
    const ownerPath = path.resolve(ROOT, registry.ownerPath);
    expect(existsSync(ownerPath)).toBe(true);
    if (!existsSync(ownerPath)) return;

    const ownerText = readFileSync(ownerPath, 'utf8');
    const ownerHash = fileHash(ownerPath);
    for (const fragment of registry.requiredFragments) {
      expect(ownerText).toContain(fragment);
    }
    for (const fragment of registry.forbiddenFragments) {
      expect(ownerText).not.toContain(fragment);
    }
    for (const binding of registry.manifestBindings) {
      const manifestPath = path.resolve(ROOT, binding.manifestPath);
      expect(existsSync(manifestPath)).toBe(true);
      if (!existsSync(manifestPath)) continue;

      const manifest = readFileSync(manifestPath, 'utf8');
      expect(manifest).toContain(`"${binding.declaredPath}","${ownerHash}"`);
    }
  });
});
