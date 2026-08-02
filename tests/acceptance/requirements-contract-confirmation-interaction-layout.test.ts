import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-interaction-layout.ts'
);

it('publishes the consumer confirmation interaction layout owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('requirements-contract confirmation interaction layout', () => {
  it('renders the sequence-first order and collapses framework assurance for consumer products', async () => {
    const { renderRequirementsContractConfirmationInteractionLayout } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-interaction-layout'
    );
    const result = renderRequirementsContractConfirmationInteractionLayout({
      projectKind: 'consumer_product',
      businessBehaviorDeltaMarkdown: 'Current to target behavior.',
      primarySequenceMarkdown: 'Primary checkout sequence.',
      failureSequenceMarkdown: 'Failure and compensation sequence.',
      implementationImpactMapMarkdown: 'Checkout implementation impact.',
      compactTraceMarkdown: 'Step-level compact trace.',
      frameworkAssuranceMarkdown: 'Framework controls remain collapsed.',
      diagramReports: [
        {
          diagramId: 'DGM-CHECKOUT-PRIMARY-001',
          scope: 'product',
          fontSizePx: 14,
          participantGapPx: 24,
          messageRowHeightPx: 28,
          scale: 1,
        },
      ],
    });

    expect(result.sectionOrder).toEqual([
      'Business Behavior Delta',
      'Primary Sequence',
      'Failure And Compensation Sequence',
      'Implementation Impact Map',
      'Compact Trace Matrix',
      'Framework Assurance',
    ]);
    expect(result.content).toContain('<details>');
    expect(result).toMatchObject({
      consumerGovernanceDiagramCount: 0,
      duplicateDiagramRenderCount: 0,
      diagramReadabilityViolationCount: 0,
    });
  });

  it('derives diagram violations and rejects consumer governance diagrams', async () => {
    const { renderRequirementsContractConfirmationInteractionLayout } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-interaction-layout'
    );
    const base = {
      projectKind: 'consumer_product' as const,
      businessBehaviorDeltaMarkdown: 'Behavior.',
      primarySequenceMarkdown: 'Sequence.',
      implementationImpactMapMarkdown: 'Impact.',
      compactTraceMarkdown: 'Trace.',
      frameworkAssuranceMarkdown: 'Assurance.',
    };
    const result = renderRequirementsContractConfirmationInteractionLayout({
      ...base,
      diagramReports: [
        {
          diagramId: 'DGM-CHECKOUT-PRIMARY-001',
          scope: 'product',
          fontSizePx: 14,
          participantGapPx: 24,
          messageRowHeightPx: 28,
          scale: 1,
        },
        {
          diagramId: 'DGM-CHECKOUT-PRIMARY-001',
          scope: 'product',
          fontSizePx: 13,
          participantGapPx: 24,
          messageRowHeightPx: 28,
          scale: 1,
        },
      ],
    });

    expect(result.duplicateDiagramRenderCount).toBe(1);
    expect(result.diagramReadabilityViolationCount).toBe(1);
    expect(() =>
      renderRequirementsContractConfirmationInteractionLayout({
        ...base,
        diagramReports: [
          {
            diagramId: 'DGM-GOVERNANCE-001',
            scope: 'governance',
            fontSizePx: 14,
            participantGapPx: 24,
            messageRowHeightPx: 28,
            scale: 1,
          },
        ],
      })
    ).toThrow(/governance diagrams/iu);
  });
});
