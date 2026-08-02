import { describe, expect, it } from 'vitest';
import {
  checkpointEqualityReceipt,
  closedModelForSource,
  modelHashFromProjection,
  projectModelToSource,
  semanticModelHash,
} from './helpers/requirements-contract-autonomous-compiler-fixture';

describe('requirements contract authoring round trip proof', () => {
  it('preserves semantic hash across source to model to projection to model', () => {
    const model = closedModelForSource(
      [
        '# Round Trip Source',
        '',
        '## Functional Requirements',
        '',
        'FR ID 1: The autonomous compiler MUST preserve semantic hashes through projection.',
        '',
        'Target path: `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`',
        'Command: `npx vitest run tests/acceptance/requirements-contract-authoring-round-trip.test.ts`',
      ].join('\n')
    );
    const projection = projectModelToSource(model);

    expect(modelHashFromProjection(projection)).toBe(semanticModelHash(model));
  });

  it('keeps uninterrupted and checkpoint-resumed hashes identical', () => {
    const model = closedModelForSource(
      [
        '# Checkpoint Resume Source',
        '',
        'FR-001: The autonomous compiler MUST resume checkpoint proof without semantic drift.',
      ].join('\n')
    );
    const receipt = checkpointEqualityReceipt(model);

    expect(receipt.checkpointIds).toHaveLength(9);
    expect(receipt.equal).toBe(true);
    expect(receipt.uninterruptedHash).toBe(receipt.resumedHash);
    expect(receipt.uninterruptedHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });
});
