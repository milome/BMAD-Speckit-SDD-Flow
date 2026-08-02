import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_PROJECT_CLASSIFICATION_AUTHORITY_KINDS,
  REQUIREMENTS_CONTRACT_PROJECT_KINDS,
  REQUIREMENTS_CONTRACT_PROJECT_PROFILE_COMPONENT_ROLES,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile';

const rootManifestPath = path.resolve(
  '_bmad/shared/requirements-contract/requirements-contract-project-profile-manifest.json'
);
const packageManifestPath = path.resolve(
  'packages/bmad-speckit/_bmad/shared/requirements-contract/requirements-contract-project-profile-manifest.json'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-project-profile-manifest.schema.json'
);

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract Project Profile manifest', () => {
  it('exports the canonical component-role inventory from the Project Profile owner', () => {
    expect(Array.isArray(REQUIREMENTS_CONTRACT_PROJECT_PROFILE_COMPONENT_ROLES)).toBe(true);
    expect(REQUIREMENTS_CONTRACT_PROJECT_PROFILE_COMPONENT_ROLES.length).toBeGreaterThan(0);
  });

  it('publishes schema-valid source owners for the complete interaction compiler chain', () => {
    expect(existsSync(rootManifestPath)).toBe(true);
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const manifest = JSON.parse(readFileSync(rootManifestPath, 'utf8')) as {
      owner: { path: string; hash: string };
      projectKinds: string[];
      classificationAuthorityKinds: string[];
      diagramPolicyRegistry: { path: string; hash: string };
      components: Array<{ role: string; path: string; hash: string }>;
    };
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const requiredRoles = new Set(REQUIREMENTS_CONTRACT_PROJECT_PROFILE_COMPONENT_ROLES);

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.owner.hash).toBe(sha256File(path.resolve(manifest.owner.path)));
    expect(manifest.projectKinds).toEqual(REQUIREMENTS_CONTRACT_PROJECT_KINDS);
    expect(manifest.classificationAuthorityKinds).toEqual(
      REQUIREMENTS_CONTRACT_PROJECT_CLASSIFICATION_AUTHORITY_KINDS
    );
    expect(manifest.diagramPolicyRegistry.hash).toBe(
      sha256File(path.resolve(manifest.diagramPolicyRegistry.path))
    );
    expect(manifest.components).toHaveLength(requiredRoles.size);
    expect(new Set(manifest.components.map((component) => component.role))).toEqual(
      requiredRoles
    );
    for (const component of manifest.components) {
      const componentPath = path.resolve(component.path);
      expect(existsSync(componentPath), component.path).toBe(true);
      expect(component.hash, component.path).toBe(sha256File(componentPath));
    }
  });

  it('keeps the package projection byte-identical to the canonical manifest', () => {
    expect(existsSync(packageManifestPath)).toBe(true);
    expect(readFileSync(packageManifestPath)).toEqual(readFileSync(rootManifestPath));
  });
});
