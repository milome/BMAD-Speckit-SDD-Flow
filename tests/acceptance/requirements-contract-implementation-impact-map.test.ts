import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-impact-map.ts'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-implementation-impact-map.schema.json'
);

it('publishes the Implementation Impact Map owner and schema', () => {
  expect([ownerPath, schemaPath].filter((candidate) => !existsSync(candidate))).toEqual([]);
});

describe.runIf(existsSync(ownerPath) && existsSync(schemaPath))('Implementation Impact Map', () => {
  it('binds every Task to an owning component, exact path, symbol, Step, and proof', async () => {
    const { createRequirementsContractImplementationImpactMap } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-impact-map'
    );
    const result = createRequirementsContractImplementationImpactMap({
      sequenceContractHash: `sha256:${'2'.repeat(64)}`,
      taskDagHash: `sha256:${'3'.repeat(64)}`,
      tasks: [
        {
          taskId: 'TASK-CHECKOUT-001',
          scenarioRef: 'SCN-CHECKOUT-001',
          stepRef: 'MSG-001',
          traceRefs: ['TRACE-001'],
          requirementRefs: ['MUST-FR-001'],
        },
      ],
      ownership: [
        {
          taskId: 'TASK-CHECKOUT-001',
          owningComponent: 'checkout-service',
          path: 'src/checkout.ts',
          symbol: 'submitCheckout',
          changeType: 'modify',
          ownershipProofRefs: ['PROOF-OWNER-001'],
        },
      ],
    });

    expect(result.entries[0]).toMatchObject({
      taskId: 'TASK-CHECKOUT-001',
      scenarioRef: 'SCN-CHECKOUT-001',
      stepRef: 'MSG-001',
      traceRefs: ['TRACE-001'],
      owningComponent: 'checkout-service',
      path: 'src/checkout.ts',
      symbol: 'submitCheckout',
    });
    expect(result).toMatchObject({ unprovenImpactCount: 0, decision: 'pass' });
  });

  it('returns an auditable block when a Task has no proved owner', async () => {
    const { createRequirementsContractImplementationImpactMap } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-impact-map'
    );
    const result = createRequirementsContractImplementationImpactMap({
      sequenceContractHash: `sha256:${'2'.repeat(64)}`,
      taskDagHash: `sha256:${'3'.repeat(64)}`,
      tasks: [
        {
          taskId: 'TASK-CHECKOUT-001',
          scenarioRef: 'SCN-CHECKOUT-001',
          stepRef: 'MSG-001',
          traceRefs: ['TRACE-001'],
          requirementRefs: ['MUST-FR-001'],
        },
      ],
      ownership: [],
    });

    expect(result).toMatchObject({
      entries: [],
      unprovenTaskIds: ['TASK-CHECKOUT-001'],
      unprovenImpactCount: 1,
      decision: 'block',
    });
  });
});
