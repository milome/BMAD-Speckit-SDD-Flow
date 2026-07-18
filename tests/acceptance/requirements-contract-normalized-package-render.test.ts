import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizedPackageFixture } from './helpers/requirements-contract-normalized-package-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer.ts'
);

it('publishes the Normalized Contract Package renderer owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('Normalized Contract Package renderer', () => {
  it('renders deterministic JSON and Markdown without copying semantic bodies into edges', async () => {
    const { renderRequirementsContractNormalizedPackage } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer'
    );
    const rendered = renderRequirementsContractNormalizedPackage(normalizedPackageFixture());

    expect(rendered).toEqual(
      renderRequirementsContractNormalizedPackage(normalizedPackageFixture())
    );
    expect(rendered).toMatchObject({
      semanticBodyCount: 3,
      nodeCount: 3,
      edgeCount: 1,
      duplicateSemanticBodyInEdgeCount: 0,
      decision: 'pass',
    });
    expect(rendered.markdown).toContain('EDGE-REQ-SCENARIO-001');
    expect(rendered.markdown).not.toContain('Checkout returns a stable result.');
  });
});
