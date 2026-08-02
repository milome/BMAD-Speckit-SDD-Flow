import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sequenceCompilerFixture } from './helpers/requirements-contract-sequence-compiler-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-set-planner.ts'
);

it('publishes the Diagram Set planner owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('requirements-contract Diagram Set planner', () => {
  it('decomposes scenarios above 25 messages with complete blocking-child coverage', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const { planRequirementsContractDiagramSet } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-set-planner'
    );
    const { validateDiagramSet } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-model'
    );
    const contract = compileRequirementsContractSequenceContract(sequenceCompilerFixture(30));
    const diagramSet = planRequirementsContractDiagramSet({
      sequenceContract: contract,
      scenarioId: 'SCN-CHECKOUT-001',
    });

    expect(diagramSet.diagrams).toHaveLength(3);
    expect(diagramSet.blockingChildRefs).toHaveLength(2);
    expect(diagramSet.expandedMessageRefs).toHaveLength(30);
    expect(Math.max(...diagramSet.diagrams.slice(1).map((row) => row.messageRefs.length))).toBeLessThanOrEqual(
      25
    );
    expect(validateDiagramSet(diagramSet)).toEqual({ ok: true, issues: [] });
  });
});
