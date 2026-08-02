import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sequenceCompilerFixture } from './helpers/requirements-contract-sequence-compiler-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-mermaid-projection.ts'
);

it('publishes the Sequence Mermaid projection owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('requirements-contract Mermaid projection', () => {
  it('renders each diagram once with fixed readability and concise MSG labels', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const { planRequirementsContractDiagramSet } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-set-planner'
    );
    const { renderRequirementsContractSequenceMermaid } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-mermaid-projection'
    );
    const contract = compileRequirementsContractSequenceContract(sequenceCompilerFixture());
    const diagramSet = planRequirementsContractDiagramSet({
      sequenceContract: contract,
      scenarioId: 'SCN-CHECKOUT-001',
    });
    const report = renderRequirementsContractSequenceMermaid({
      sequenceContract: contract,
      diagramSet,
    });

    expect(report).toMatchObject({
      duplicateDiagramRenderCount: 0,
      diagramReadabilityViolationCount: 0,
      sequenceMermaidProjectionDriftCount: 0,
      decision: 'pass',
    });
    expect(report.diagrams[0]).toMatchObject({
      fontSizePx: 14,
      participantGapPx: 24,
      messageRowHeightPx: 28,
      scale: 1,
    });
    expect(report.diagrams[0].mermaid).toContain('MSG-001');
    expect(report.diagrams[0].mermaid).not.toContain('MUST-FR-001');
  });
});
