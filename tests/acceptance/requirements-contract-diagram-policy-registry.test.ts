import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_DIAGRAM_POLICY } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile';

const rootRegistryPath = path.resolve(
  '_bmad/shared/requirements-contract/requirements-contract-diagram-policy-registry.json'
);
const packageRegistryPath = path.resolve(
  'packages/bmad-speckit/_bmad/shared/requirements-contract/requirements-contract-diagram-policy-registry.json'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-diagram-policy-registry.schema.json'
);

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract Diagram Policy Registry', () => {
  it('exports the canonical policy from the Project Profile owner', () => {
    expect(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY).toBeDefined();
    expect(Array.isArray(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY?.views)).toBe(true);
  });

  it('freezes all seven sequence-first views and readability/decomposition thresholds', () => {
    expect(existsSync(rootRegistryPath)).toBe(true);
    expect(existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const registry = JSON.parse(readFileSync(rootRegistryPath, 'utf8')) as {
      owner: { path: string; hash: string };
      sequenceFirst: boolean;
      views: Array<{
        view: string;
        consumerProductPolicy: string;
      }>;
      readability: Record<string, number>;
      decomposition: Record<string, number>;
      syntheticFallbackAllowed: boolean;
    };
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(registry), JSON.stringify(validate.errors)).toBe(true);
    expect(registry.sequenceFirst).toBe(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.sequenceFirst);
    expect(registry.syntheticFallbackAllowed).toBe(
      REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.syntheticFallbackAllowed
    );
    expect(new Set(registry.views.map((view) => view.view))).toEqual(
      new Set(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.views.map((view) => view.view))
    );
    expect(
      registry.views.map(({ view, consumerProductPolicy }) => ({
        view,
        consumerProductPolicy,
      }))
    ).toEqual(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.views);
    expect(
      registry.views.find((view) => view.view === 'governance_flow')
        ?.consumerProductPolicy
    ).toBe(
      REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.views.find(
        (view) => view.view === 'governance_flow'
      )?.consumerProductPolicy
    );
    expect(registry.readability).toEqual(REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.readability);
    expect(registry.decomposition).toEqual(
      REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.decomposition
    );
    expect(registry.owner.hash).toBe(sha256File(path.resolve(registry.owner.path)));
  });

  it('keeps the package projection byte-identical to the canonical registry', () => {
    expect(existsSync(packageRegistryPath)).toBe(true);
    expect(readFileSync(packageRegistryPath)).toEqual(readFileSync(rootRegistryPath));
  });
});
