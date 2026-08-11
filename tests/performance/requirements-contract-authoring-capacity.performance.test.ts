import { describe, expect, it } from 'vitest';
import { createSpecSpanRegistry } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';

describe('requirements authoring capacity', () => {
  it('canonicalizes five thousand logical spans within the declared node budget', () => {
    const spans = Array.from({ length: 5_000 }, (_, index) => ({
      authorityClass: 'derived' as const,
      normalizedClaimHash: `sha256:${index.toString(16).padStart(64, '0')}`,
      boundSemanticNodeIds: [`MUST-${index}`],
      boundObligationIds: [`OBL-${index}`],
      evidenceClaimRefs: [`CLAIM-${index}`],
      decisionReceiptRefs: [],
      derivationReceiptRefs: [`DERIVE-${index}`],
    }));
    const startedAt = performance.now();
    const registry = createSpecSpanRegistry(spans);
    expect(registry).toHaveLength(5_000);
    expect(new Set(registry.map((span) => span.specSpanId)).size).toBe(5_000);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });
});
