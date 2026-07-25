import { describe, expect, it } from 'vitest';
import {
  evaluateConsumerConfirmationProjection,
  type ConsumerConfirmationOracleInput,
  type ConsumerConfirmationOraclePolicy,
} from './helpers/requirements-contract-consumer-confirmation-oracle';

const REQUIRED_SECTION_ROLES = [
  'business-goal-and-scope',
  'business-behavior-delta',
  'primary-business-sequence',
  'failure-compensation-sequence',
  'implementation-impact-map',
  'deployment-delta',
  'applicable-state-data-security-view',
  'compact-step-trace-coverage',
  'red-and-acceptance-plan',
  'blocking-unresolved-decisions',
  'framework-assurance',
] as const;

function policy(): ConsumerConfirmationOraclePolicy {
  return {
    projectKind: 'consumer_product',
    requiredSectionRoles: REQUIRED_SECTION_ROLES,
    minFontPx: 14,
    minParticipantGapPx: 24,
    minMessageRowHeightPx: 28,
    requiredScale: 1,
  };
}

function compliantInput(seed: string): ConsumerConfirmationOracleInput {
  const diagramId = `DIAGRAM-${seed.toUpperCase()}`;
  const messageId = `MSG-${seed.toUpperCase()}`;
  const sectionHtml = REQUIRED_SECTION_ROLES.map((role) => {
    const collapsed = role === 'framework-assurance' ? ' data-collapsed="true"' : '';
    return `<section class="card" data-confirmation-role="${role}"${collapsed}></section>`;
  }).join('');
  const diagramHtml = [
    '<article data-diagram-card data-diagram-scope="business">',
    `<pre data-mermaid-source>sequenceDiagram\nClient->>Service: ${messageId} Publish result</pre>`,
    `<div data-mermaid-render data-diagram-id="${diagramId}"></div>`,
    `<span data-message-trace-id="${messageId}"></span>`,
    '</article>',
  ].join('');
  const renderedSectionOrder = REQUIRED_SECTION_ROLES.map((role) => `section-${role}`);
  return {
    html: `${sectionHtml}${diagramHtml}`,
    summary: { renderedSectionOrder },
    report: { renderedSectionOrder, childFlowApplicability: 'not_applicable' },
    measurements: [
      {
        diagramId,
        fontPx: 14,
        participantGapPx: 24,
        messageRowHeightPx: 28,
        scale: 1,
      },
    ],
    policy: policy(),
  };
}

describe('consumer confirmation independent oracle', () => {
  it('passes only independently observable sequence-first confirmation evidence', () => {
    const result = evaluateConsumerConfirmationProjection(compliantInput('clean'));

    expect(result.decision).toBe('pass');
    expect(result.counts).toEqual({
      duplicateDiagramRenderCount: 0,
      diagramReadabilityViolationCount: 0,
      consumerGovernanceDiagramCount: 0,
      forbiddenArrowMetadataCount: 0,
      missingChildExpansionCount: 0,
      sectionOrderMismatchCount: 0,
    });
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('marks missing external measurement evidence as unverifiable', () => {
    const input = compliantInput('missing-measurement');
    input.measurements = [];

    const result = evaluateConsumerConfirmationProjection(input);

    expect(result.decision).toBe('unverifiable');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'diagram-readability',
          status: 'unverifiable',
        }),
      ])
    );
  });

  it('blocks duplicate renders, authority-bearing arrows, unreadable diagrams, and expanded assurance', () => {
    const input = compliantInput('tamper');
    const diagramId = input.measurements[0]!.diagramId;
    input.html = input.html
      .replace('data-collapsed="true"', 'data-collapsed="false"')
      .replace('MSG-TAMPER Publish result', 'MUST-FR-777 EVD-777')
      .concat(`<div data-mermaid-render data-diagram-id="${diagramId}"></div>`);
    input.measurements[0] = {
      diagramId,
      fontPx: 12,
      participantGapPx: 20,
      messageRowHeightPx: 20,
      scale: 0.8,
    };

    const result = evaluateConsumerConfirmationProjection(input);

    expect(result.decision).toBe('block');
    expect(result.counts).toMatchObject({
      duplicateDiagramRenderCount: 1,
      diagramReadabilityViolationCount: 1,
      forbiddenArrowMetadataCount: 1,
    });
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'framework-assurance-collapsed', status: 'block' }),
      ])
    );
  });
});
