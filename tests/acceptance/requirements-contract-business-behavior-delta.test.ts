import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-business-behavior-delta.ts'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-business-behavior-delta.schema.json'
);

it('publishes the Business Behavior Delta owner and schema', () => {
  expect([ownerPath, schemaPath].filter((candidate) => !existsSync(candidate))).toEqual([]);
});

describe.runIf(existsSync(ownerPath) && existsSync(schemaPath))('Business Behavior Delta', () => {
  it('preserves an unproved current behavior as unknown without synthetic baseline text', async () => {
    const { createRequirementsContractBusinessBehaviorDelta } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-business-behavior-delta'
    );
    const delta = createRequirementsContractBusinessBehaviorDelta({
      requirementSetId: 'checkout',
      semanticModelHash: `sha256:${'1'.repeat(64)}`,
      scenarios: [
        {
          scenarioId: 'SCN-CHECKOUT-001',
          currentBehavior: { status: 'unknown', proofRefs: [] },
          targetBehavior: {
            description: 'Checkout retries exactly three times.',
            requirementRefs: ['MUST-FR-001'],
          },
        },
      ],
    });

    expect(delta.scenarios[0].currentBehavior).toEqual({ status: 'unknown', proofRefs: [] });
    expect(delta).toMatchObject({
      syntheticCurrentBehaviorCount: 0,
      decision: 'pass',
    });
  });

  it('rejects current behavior that is neither proved nor typed unknown', async () => {
    const { createRequirementsContractBusinessBehaviorDelta } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-business-behavior-delta'
    );

    expect(() =>
      createRequirementsContractBusinessBehaviorDelta({
        requirementSetId: 'checkout',
        semanticModelHash: `sha256:${'1'.repeat(64)}`,
        scenarios: [
          {
            scenarioId: 'SCN-CHECKOUT-001',
            currentBehavior: {
              status: 'synthetic',
              description: 'Checkout probably retries.',
              proofRefs: ['PROOF-SYNTHETIC-001'],
            } as never,
            targetBehavior: {
              description: 'Checkout retries exactly three times.',
              requirementRefs: ['MUST-FR-001'],
            },
          },
        ],
      })
    ).toThrow(/unsupported current behavior status/u);
  });
});
