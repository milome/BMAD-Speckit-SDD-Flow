import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const seamPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam.ts'
);

it('publishes the registered PRD renderer and write-seam owner', () => {
  expect(existsSync(seamPath)).toBe(true);
});

describe.runIf(existsSync(seamPath))('canonical PRD render/write seam', () => {
  it('writes only sealed output from the renderer registered for the classified artifact role', async () => {
    const {
      renderCanonicalRequirementSourcePrd,
      renderProductPrd,
      writeRegisteredPrdRender,
    } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam'
    );
    const root = path.join(tmpdir(), `bmad-render-seam-${process.pid}-${Date.now()}`);
    const productPath = path.join(root, 'product-prd.md');
    const sourcePath = path.join(root, 'requirement-source-prd.md');

    try {
      const product = renderProductPrd({
        title: 'Checkout Product',
        sections: [{ heading: 'Vision', body: 'Fast, recoverable checkout.' }],
      });
      const source = renderCanonicalRequirementSourcePrd({
        requirementSetId: 'REQ-CHECKOUT',
        title: 'Checkout Requirements',
        semanticModelHash: `sha256:${'1'.repeat(64)}`,
        sourceAuthorityHash: `sha256:${'2'.repeat(64)}`,
        proofRefs: {
          intakeReceipt: { path: 'intake-receipt.json', hash: `sha256:${'3'.repeat(64)}` },
          intentLineageLedger: {
            path: 'intent-lineage-ledger.json',
            hash: `sha256:${'4'.repeat(64)}`,
          },
          semanticConservationManifest: {
            path: 'semantic-conservation-manifest.json',
            hash: `sha256:${'5'.repeat(64)}`,
          },
        },
        sections: [{ heading: 'Requirements', body: '- MUST retry exactly three times.' }],
        implementationConfirmation: {
          compactTraceMarkdown: '| Requirement | Acceptance |\\n|---|---|\\n| MUST-001 | AC-001 |',
        },
      });

      expect(product.content).not.toContain('implementationConfirmation');
      expect(source.content).toContain('implementationConfirmation');
      expect(source.content).toContain('REQ-CHECKOUT');
      expect(writeRegisteredPrdRender({ rendered: product, targetPath: productPath }).targetRef.hash)
        .toBe(product.renderedContentHash);
      expect(writeRegisteredPrdRender({ rendered: source, targetPath: sourcePath }).targetRef.hash)
        .toBe(source.renderedContentHash);
      expect(readFileSync(sourcePath, 'utf8')).toBe(source.content);
      expect(() =>
        writeRegisteredPrdRender({
          rendered: { ...source } as typeof source,
          targetPath: path.join(root, 'forged.md'),
        })
      ).toThrow(/registered renderer output/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
