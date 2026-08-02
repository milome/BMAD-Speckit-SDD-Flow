import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateObservedSequenceCases,
  type ObservedSequenceEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  createObservedSequenceReceipt,
  validateObservedSequenceReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-observed-sequence-evidence';
import { compileRequirementsContractSequenceContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function sequenceFixture() {
  const identity = randomUUID().toUpperCase();
  const semanticModelHash = sha256Stable({ identity, kind: 'semantic-model' });
  const requirementRef = `REQUIREMENT-${identity}`;
  const scenarioId = `SCN-${identity}-001`;
  const actorId = `ACTOR-${identity}`;
  const componentId = `COMPONENT-${identity}`;
  const oracleRef = `ORACLE-${identity}`;
  const proof = () => ({
    sourceSpanRefs: [`SOURCE-SPAN-${identity}`],
    sourceHashes: [semanticModelHash],
    semanticResolutionReceiptRefs: [`RESOLUTION-${identity}`],
    repositoryRefs: [`REPOSITORY-${identity}`],
    policyApplicabilityReceiptRefs: [`POLICY-${identity}`],
    decisionReceiptRefs: [],
    requirementRefs: [requirementRef],
    targetRefs: [`src/${identity.toLowerCase()}.ts`],
    verificationBindings: {
      oracleRef,
      redTestRef: `RED-${identity}`,
      commandRefs: [`COMMAND-${identity}`],
      evidenceRefs: [`EVIDENCE-${identity}`],
    },
    semanticModelHash,
  });
  const contract = compileRequirementsContractSequenceContract({
    projectKind: 'consumer_product',
    projectProfileHash: sha256Stable({ identity, kind: 'project-profile' }),
    semanticModelHash,
    integrationBoundaries: [],
    sequenceScenarios: [
      {
        id: scenarioId,
        owningSystem: `system-${identity}`,
        requirementRefs: [requirementRef],
        trigger: {
          actorRef: actorId,
          event: `event-${identity}`,
          sourceRefs: [`SOURCE-SPAN-${identity}`],
        },
        participants: [
          {
            id: actorId,
            kind: 'human_actor',
            label: `Operator ${identity}`,
            owningSystem: `system-${identity}`,
            ...proof(),
          },
          {
            id: componentId,
            kind: 'runtime_component',
            label: `Service ${identity}`,
            owningSystem: `system-${identity}`,
            ...proof(),
          },
        ],
        steps: [
          {
            id: 'MSG-001',
            order: 1,
            type: 'command',
            from: actorId,
            to: componentId,
            operation: `command-${identity}`,
            owningSystem: `system-${identity}`,
            integrationBoundaryRef: null,
            ...proof(),
          },
          {
            id: 'MSG-002',
            order: 2,
            type: 'response',
            from: componentId,
            to: actorId,
            operation: `response-${identity}`,
            owningSystem: `system-${identity}`,
            integrationBoundaryRef: null,
            ...proof(),
          },
        ],
        branches: [
          {
            id: 'BR-001',
            condition: `condition-${identity}`,
            testScenarioRefs: [`TEST-SCENARIO-${identity}`],
            owningSystem: `system-${identity}`,
            ...proof(),
          },
        ],
        orderingConstraints: [],
        temporalConstraints: [],
        stateTransitions: [],
      },
    ],
  });
  return { contract, scenarioId, oracleRef, requirementRef };
}

function productionObservedSequenceCase(): ObservedSequenceEvaluationCase {
  const { contract, scenarioId, oracleRef, requirementRef } = sequenceFixture();
  const transactionId = `transaction-${randomUUID()}`;
  const implementationAttemptId = `attempt-${randomUUID()}`;
  const observations = contract.sequenceScenarios[0].steps.map((step, index) => ({
    stepRef: `${scenarioId}#${step.id}`,
    branchRefs: index === 0 ? [`${scenarioId}#BR-001`] : [],
    oracleRefs: [oracleRef],
    origin: {
      kind: 'test_assertion' as const,
      ref: `tests/${randomUUID()}.test.ts#${step.id}`,
      hash: sha256Stable({ scenarioId, stepId: step.id }),
    },
    observedAt: new Date(Date.now() + index).toISOString(),
  }));
  const receipt = createObservedSequenceReceipt({
    receiptId: `observed-sequence-${randomUUID()}`,
    requirementSetId: requirementRef,
    transactionId,
    implementationAttemptId,
    sequenceContract: contract,
    observations,
    violations: {
      ordering: [],
      temporal: [],
      sideEffect: [],
      compensation: [],
    },
    createdAt: new Date().toISOString(),
  });
  return {
    caseRef: receipt.receiptId,
    receiptValid: validateObservedSequenceReceipt(receipt),
    currentAttemptBound:
      receipt.transactionId === transactionId &&
      receipt.implementationAttemptId === implementationAttemptId,
    criticalStepCoverageRate:
      receipt.observedStepRefs.length /
      contract.sequenceScenarios.flatMap((scenario) => scenario.steps).length,
    criticalBranchCoverageRate:
      receipt.observedBranchRefs.length /
      contract.sequenceScenarios.flatMap((scenario) => scenario.branches).length,
    oracleCoverageRate: receipt.observedOracleRefs.includes(oracleRef) ? 1 : 0,
    unexpectedStepCount: receipt.unexpectedStepRefs.length,
    orderingViolationCount: receipt.violations.ordering.length,
    temporalViolationCount: receipt.violations.temporal.length,
    sideEffectViolationCount: receipt.violations.sideEffect.length,
    compensationViolationCount: receipt.violations.compensation.length,
    untrustedEvidenceCount: 0,
  };
}

describe('requirements contract Observed Sequence evaluation', () => {
  it('binds current-attempt observations to every critical Step, Branch, and Oracle', () => {
    const productionCase = productionObservedSequenceCase();

    const result = evaluateObservedSequenceCases([productionCase]);

    expect(result.invalidReceiptCount).toBe(0);
    expect(result.currentAttemptMismatchCount).toBe(0);
    expect(result.minimumCriticalStepCoverageRate).toBe(1);
    expect(result.minimumCriticalBranchCoverageRate).toBe(1);
    expect(result.minimumOracleCoverageRate).toBe(1);
    expect(result.violationCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks implementation-authored claims and missing current-attempt binding', () => {
    const invalid: ObservedSequenceEvaluationCase = {
      ...productionObservedSequenceCase(),
      currentAttemptBound: false,
      untrustedEvidenceCount: 1,
    };

    const result = evaluateObservedSequenceCases([invalid]);

    expect(result.currentAttemptMismatchCount).toBe(1);
    expect(result.untrustedEvidenceCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
