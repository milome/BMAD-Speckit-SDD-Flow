import {
  requirementsContractDiagramProjectionHash,
} from './requirements-contract-diagram-set-planner';
import {
  type RequirementsContractDiagramSet,
  type RequirementsContractSequenceContract,
  validateDiagramSet,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { REQUIREMENTS_CONTRACT_DIAGRAM_POLICY } from './requirements-contract-project-profile';
import { sha256Text } from './requirements-contract-semantic-resolver';

const {
  minFontPx: FONT_SIZE_PX,
  minParticipantGapPx: PARTICIPANT_GAP_PX,
  minMessageRowHeightPx: MESSAGE_ROW_HEIGHT_PX,
  scale: SCALE,
} = REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.readability;

function renderDiagram(input: {
  contract: RequirementsContractSequenceContract;
  diagram: RequirementsContractDiagramSet['diagrams'][number];
}) {
  const scenario = input.contract.sequenceScenarios.find(
    (candidate) => candidate.id === input.diagram.scenarioRef
  );
  if (!scenario) throw new Error(`unknown diagram scenario: ${input.diagram.scenarioRef}`);
  const stepById = new Map(scenario.steps.map((step) => [step.id, step]));
  const steps = input.diagram.messageRefs.map((ref) => {
    const step = stepById.get(ref.split('#')[1]);
    if (!step) throw new Error(`unknown diagram message ref: ${ref}`);
    return step;
  });
  const participantIds = [...new Set(steps.flatMap((step) => [step.from, step.to]))];
  const participantById = new Map(
    scenario.participants.map((participant) => [participant.id, participant])
  );
  const aliases = new Map(participantIds.map((id, index) => [id, `P${index + 1}`]));
  const lines = [
    `%%{init: {"themeVariables":{"fontSize":"${FONT_SIZE_PX}px"},"sequence":{"actorMargin":${PARTICIPANT_GAP_PX},"messageMargin":${MESSAGE_ROW_HEIGHT_PX}}}%%`,
    'sequenceDiagram',
    ...participantIds.map((id) => {
      const participant = participantById.get(id);
      if (!participant) throw new Error(`unknown diagram participant: ${id}`);
      return `participant ${aliases.get(id)} as ${participant.label}`;
    }),
    ...steps.map(
      (step) => `${aliases.get(step.from)}->>${aliases.get(step.to)}: ${step.id}`
    ),
  ];
  const mermaid = `${lines.join('\n')}\n`;
  const expectedMembershipHash = requirementsContractDiagramProjectionHash({
    sequenceContractHash: input.contract.sequenceContractHash,
    diagram: {
      diagramRef: input.diagram.diagramRef,
      role: input.diagram.role,
      scenarioRef: input.diagram.scenarioRef,
      messageRefs: input.diagram.messageRefs,
      blockingChildRefs: input.diagram.blockingChildRefs,
    },
  });
  return {
    diagramId: input.diagram.diagramRef,
    role: input.diagram.role,
    mermaid,
    mermaidHash: sha256Text(mermaid),
    membershipProjectionHash: input.diagram.projectionHash,
    membershipProjectionHashMatches: input.diagram.projectionHash === expectedMembershipHash,
    participantCount: participantIds.length,
    messageCount: steps.length,
    controlBlockCount: scenario.branches.length,
    fontSizePx: FONT_SIZE_PX,
    participantGapPx: PARTICIPANT_GAP_PX,
    messageRowHeightPx: MESSAGE_ROW_HEIGHT_PX,
    scale: SCALE,
  };
}

export function renderRequirementsContractSequenceMermaid(input: {
  sequenceContract: RequirementsContractSequenceContract;
  diagramSet: RequirementsContractDiagramSet;
}) {
  if (!validateSequenceContract(input.sequenceContract).ok) {
    throw new Error('Mermaid projection requires a valid Sequence Contract');
  }
  if (!validateDiagramSet(input.diagramSet).ok) {
    throw new Error('Mermaid projection requires a valid Diagram Set');
  }
  if (input.diagramSet.sequenceContractHash !== input.sequenceContract.sequenceContractHash) {
    throw new Error('Mermaid projection Sequence Contract hash mismatch');
  }
  const diagrams = input.diagramSet.diagrams.map((diagram) =>
    renderDiagram({ contract: input.sequenceContract, diagram })
  );
  const duplicateDiagramRenderCount =
    diagrams.length - new Set(diagrams.map((diagram) => diagram.diagramId)).size;
  const diagramReadabilityViolationCount = diagrams.filter(
    (diagram) =>
      diagram.participantCount > 8 ||
      diagram.messageCount > 25 ||
      (diagram.role !== 'scenario_overview' && diagram.controlBlockCount > 5) ||
      diagram.fontSizePx < 14 ||
      diagram.participantGapPx < 24 ||
      diagram.messageRowHeightPx < 28 ||
      diagram.scale !== 1
  ).length;
  const sequenceMermaidProjectionDriftCount = diagrams.filter(
    (diagram) => !diagram.membershipProjectionHashMatches
  ).length;
  return {
    schemaVersion: 'requirements-contract-sequence-projection-report/v1',
    sequenceContractHash: input.sequenceContract.sequenceContractHash,
    diagramSetId: input.diagramSet.diagramSetId,
    diagrams,
    duplicateDiagramRenderCount,
    diagramReadabilityViolationCount,
    consumerGovernanceDiagramCount: 0,
    syntheticDiagramFallbackCount: 0,
    sequenceMermaidProjectionDriftCount,
    decision:
      duplicateDiagramRenderCount === 0 &&
      diagramReadabilityViolationCount === 0 &&
      sequenceMermaidProjectionDriftCount === 0
        ? ('pass' as const)
        : ('block' as const),
  };
}
