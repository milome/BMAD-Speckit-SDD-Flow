import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sequenceCompilerFixture } from './helpers/requirements-contract-sequence-compiler-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-task-dag.ts'
);

it('publishes the implementation Task DAG owner and schema', () => {
  expect(existsSync(ownerPath)).toBe(true);
  expect(
    existsSync(
      path.resolve(
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-implementation-task-dag.schema.json'
      )
    )
  ).toBe(true);
});

describe.runIf(existsSync(ownerPath))('requirements-contract implementation Task DAG', () => {
  it('maps each critical Step to one target-bound dependency-correct task', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const { compileRequirementsContractImplementationTaskDag } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-task-dag'
    );
    const contract = compileRequirementsContractSequenceContract(sequenceCompilerFixture());
    const dag = compileRequirementsContractImplementationTaskDag({
      sequenceContract: contract,
      criticalSteps: [
        {
          scenarioId: 'SCN-CHECKOUT-001',
          stepId: 'MSG-001',
          taskId: 'TASK-CHECKOUT-001',
          targetRef: 'src/checkout.ts',
          symbolRef: 'submitCheckout',
          authorizedBehavior: 'Submit checkout.',
          forbiddenBehaviors: ['Skip validation.'],
          redRef: 'RED-CHECKOUT-001',
          evidenceRefs: ['EVD-CHECKOUT-001'],
        },
        {
          scenarioId: 'SCN-CHECKOUT-001',
          stepId: 'MSG-002',
          taskId: 'TASK-CHECKOUT-002',
          targetRef: 'src/checkout.ts',
          symbolRef: 'publishCheckoutResult',
          authorizedBehavior: 'Publish the result after submission.',
          forbiddenBehaviors: ['Publish early.'],
          redRef: 'RED-CHECKOUT-002',
          evidenceRefs: ['EVD-CHECKOUT-002'],
        },
      ],
    });

    expect(dag.tasks).toHaveLength(2);
    expect(dag.tasks[1].dependencies).toEqual(['TASK-CHECKOUT-001']);
    expect(dag).toMatchObject({
      cycleCount: 0,
      unresolvedDependencyCount: 0,
      decision: 'pass',
    });
  });

  it('rejects one task identity reused across different critical Steps', async () => {
    const { compileRequirementsContractSequenceContract } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler'
    );
    const { compileRequirementsContractImplementationTaskDag } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-task-dag'
    );
    const contract = compileRequirementsContractSequenceContract(sequenceCompilerFixture());
    const shared = {
      taskId: 'TASK-SHARED-001',
      targetRef: 'src/checkout.ts',
      symbolRef: 'checkout',
      authorizedBehavior: 'Preserve the authorized Step.',
      forbiddenBehaviors: ['Skip the Step.'],
      redRef: 'RED-CHECKOUT-001',
      evidenceRefs: ['EVD-CHECKOUT-001'],
    };

    expect(() =>
      compileRequirementsContractImplementationTaskDag({
        sequenceContract: contract,
        criticalSteps: [
          { ...shared, scenarioId: 'SCN-CHECKOUT-001', stepId: 'MSG-001' },
          { ...shared, scenarioId: 'SCN-CHECKOUT-001', stepId: 'MSG-002' },
        ],
      })
    ).toThrow(/duplicate taskId/iu);
  });
});
