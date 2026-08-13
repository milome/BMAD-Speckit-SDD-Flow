import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateDiagramGoldenCorpusCases,
  type DiagramGoldenCorpusEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  planRequirementsContractDiagramSet,
  requirementsContractDiagramProjectionHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-set-planner';
import { compileRequirementsContractSequenceContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler';
import { validateDiagramSet } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-model';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function compiledSequence(stepCount: number) {
  const identity = randomUUID().toUpperCase();
  const hash = sha256Stable({ identity, kind: 'semantic-model' });
  const requirementRef = `REQUIREMENT-${identity}`;
  const scenarioId = `SCN-${identity}-001`;
  const actorId = `ACTOR-${identity}`;
  const componentId = `COMPONENT-${identity}`;
  const proof = () => ({
    sourceSpanRefs: [`SOURCE-SPAN-${identity}`],
    sourceHashes: [hash],
    semanticResolutionReceiptRefs: [`RESOLUTION-${identity}`],
    repositoryRefs: [`REPOSITORY-${identity}`],
    policyApplicabilityReceiptRefs: [`POLICY-${identity}`],
    decisionReceiptRefs: [],
    requirementRefs: [requirementRef],
    targetRefs: [`src/${identity.toLowerCase()}.ts`],
    verificationBindings: {
      oracleRef: `ORACLE-${identity}`,
      redTestRef: `RED-${identity}`,
      commandRefs: [`COMMAND-${identity}`],
      evidenceRefs: [`EVIDENCE-${identity}`],
    },
    semanticModelHash: hash,
  });
  const contract = compileRequirementsContractSequenceContract({
    projectKind: 'consumer_product',
    projectProfileHash: sha256Stable({ identity, kind: 'project-profile' }),
    semanticModelHash: hash,
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
        steps: Array.from({ length: stepCount }, (_, index) => ({
          id: `MSG-${String(index + 1).padStart(3, '0')}`,
          order: index + 1,
          type: index % 2 === 0 ? ('command' as const) : ('response' as const),
          from: index % 2 === 0 ? actorId : componentId,
          to: index % 2 === 0 ? componentId : actorId,
          operation: `operation-${index + 1}`,
          owningSystem: `system-${identity}`,
          integrationBoundaryRef: null,
          ...proof(),
        })),
        branches: [],
        orderingConstraints: [],
        temporalConstraints: [],
        stateTransitions: [],
      },
    ],
  });
  return { contract, scenarioId };
}

function evaluateDiagram(stepCount: number): DiagramGoldenCorpusEvaluationCase {
  const { contract, scenarioId } = compiledSequence(stepCount);
  const diagramSet = planRequirementsContractDiagramSet({
    sequenceContract: contract,
    scenarioId,
    frozenDiagramIdentity: {
      diagramSetId: `DSET-${scenarioId}`,
      rootDiagramRef: `DGM-${scenarioId}-ROOT-001`,
      diagramRefs:
        stepCount > 25
          ? [
              `DGM-${scenarioId}-ROOT-001`,
              `DGM-${scenarioId}-CHILD-001`,
              `DGM-${scenarioId}-CHILD-002`,
            ]
          : [`DGM-${scenarioId}-ROOT-001`],
    },
  });
  const scenario = contract.sequenceScenarios.find((item) => item.id === scenarioId)!;
  const expectedMessageRefs = scenario.steps.map((step) => `${scenarioId}#${step.id}`);
  const projectionHashMismatchCount = diagramSet.diagrams.filter((diagram) => {
    const { projectionHash, ...projection } = diagram;
    return (
      projectionHash !==
      requirementsContractDiagramProjectionHash({
        sequenceContractHash: contract.sequenceContractHash,
        diagram: projection,
      })
    );
  }).length;
  const coveredBlockingChildren = diagramSet.blockingChildRefs.filter(
    (diagramRef) =>
      diagramSet.diagrams.some((diagram) => diagram.diagramRef === diagramRef) &&
      diagramSet.transitionEdges.some((edge) => edge.expandsTo === diagramRef)
  ).length;
  return {
    caseRef: diagramSet.diagramSetId,
    diagramSetValid: validateDiagramSet(diagramSet).ok,
    sourceCoverageRate:
      diagramSet.expandedMessageRefs.filter((ref) => expectedMessageRefs.includes(ref)).length /
      expectedMessageRefs.length,
    blockingChildCoverageRate:
      diagramSet.blockingChildRefs.length === 0
        ? 1
        : coveredBlockingChildren / diagramSet.blockingChildRefs.length,
    projectionHashMismatchCount,
    duplicateDiagramCount:
      diagramSet.diagrams.length -
      new Set(diagramSet.diagrams.map((diagram) => diagram.diagramRef)).size,
    syntheticParticipantCount: 0,
    inapplicableDiagramCount: 0,
  };
}

describe('requirements contract Diagram Set golden corpus', () => {
  it('preserves source coverage for primary and decomposed sequence projections', () => {
    const cases = [evaluateDiagram(2), evaluateDiagram(26)];

    const result = evaluateDiagramGoldenCorpusCases(cases);

    expect(result.invalidDiagramSetCount).toBe(0);
    expect(result.minimumSourceCoverageRate).toBe(1);
    expect(result.minimumBlockingChildCoverageRate).toBe(1);
    expect(result.projectionHashMismatchCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks projection hash drift', () => {
    const invalid: DiagramGoldenCorpusEvaluationCase = {
      ...evaluateDiagram(26),
      projectionHashMismatchCount: 1,
    };

    const result = evaluateDiagramGoldenCorpusCases([invalid]);

    expect(result.projectionHashMismatchCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
