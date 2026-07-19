import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TEMPLATE_PATH = path.resolve(
  '_bmad/shared/requirements-contract/templates/product-prd-template.md'
);
const FORBIDDEN_PRODUCT_PRD_CONTENT = [
  { label: 'implementationConfirmation', pattern: /implementationConfirmation/iu },
  { label: 'Compact Trace', pattern: /compact\s+trace/iu },
  { label: 'Evidence', pattern: /\bevidence\b/iu },
  { label: 'Acceptance matrix', pattern: /acceptance\s+matrix/iu },
  { label: 'Target map', pattern: /target\s+map/iu },
  { label: 'Bundle', pattern: /\bbundle\b/iu },
  { label: 'confirmation-ready', pattern: /confirmation[-\s]ready/iu },
  { label: 'Source PRD authority', pattern: /source\s+prd\s+authority/iu },
] as const;

it('publishes the canonical Product PRD workflow template', () => {
  expect(existsSync(TEMPLATE_PATH)).toBe(true);
});

describe.runIf(existsSync(TEMPLATE_PATH))('canonical Product PRD template', () => {
  const template = existsSync(TEMPLATE_PATH)
    ? readFileSync(TEMPLATE_PATH, 'utf8').replace(/\r\n/gu, '\n')
    : '';

  it('is a discovery-fed product-background artifact rather than an implementation contract', () => {
    expect(template).toContain(
      'templateSchemaVersion: requirements-contract-product-prd/v1'
    );
    expect(template).toContain('artifactRole: product_prd');
    expect(template).toContain('authority: product_background');
    expect(template).toContain('workflowType: prd');
    expect(template).toContain('discoveryEnvelopeRefs: []');
    expect(template).toContain('inputDocuments: []');
    expect(template).toContain('# Product PRD Template');
    expect(template).toContain('## Discovery Inputs');
    expect(template).toContain('## Product Context');
    expect(template).toContain('## Product Outcomes');
    expect(template).toContain('## Workflow Handoff');
  });

  it.each(FORBIDDEN_PRODUCT_PRD_CONTENT)(
    'does not contain $label contract content',
    ({ pattern }) => {
      expect(template).not.toMatch(pattern);
    }
  );
});

describe('registered Product PRD renderer boundary', () => {
  it.each(FORBIDDEN_PRODUCT_PRD_CONTENT)(
    'rejects $label content',
    async ({ label }) => {
      const { renderProductPrd } = await import(
        '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prd-render-write-seam'
      );

      expect(() =>
        renderProductPrd({
          title: 'Checkout Product',
          sections: [{ heading: 'Product Context', body: `Forbidden ${label} content.` }],
        })
      ).toThrow(/Product PRD renderer forbids/iu);
    }
  );
});
