import {
  type RequirementsContractDiagramSet,
  type RequirementsContractSequenceContract,
  validateDiagramSet,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { REQUIREMENTS_CONTRACT_DIAGRAM_POLICY } from './requirements-contract-project-profile';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const {
  maxParticipants: MAX_PARTICIPANTS,
  maxMessages: MAX_MESSAGES,
  maxControlBlocks: MAX_CONTROL_BLOCKS,
} = REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.decomposition;

type Diagram = RequirementsContractDiagramSet['diagrams'][number];

function scenarioStem(scenarioId: string): string {
  return scenarioId.replace(/^SCN-/u, '').replace(/-[0-9]{3}$/u, '');
}

function messageRef(scenarioId: string, stepId: string): string {
  return `${scenarioId}#${stepId}`;
}

function chunksForScenario(
  scenario: RequirementsContractSequenceContract['sequenceScenarios'][number]
): string[][] {
  const participantIds = new Set<string>();
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const step of [...scenario.steps].sort((left, right) => left.order - right.order)) {
    const nextParticipants = new Set(participantIds);
    nextParticipants.add(step.from);
    nextParticipants.add(step.to);
    if (
      current.length > 0 &&
      (current.length >= MAX_MESSAGES || nextParticipants.size > MAX_PARTICIPANTS)
    ) {
      chunks.push(current);
      current = [];
      participantIds.clear();
    }
    current.push(messageRef(scenario.id, step.id));
    participantIds.add(step.from);
    participantIds.add(step.to);
  }
  if (current.length > 0) chunks.push(current);
  if (scenario.branches.length > MAX_CONTROL_BLOCKS && chunks.length === 1) {
    const splitAt = Math.ceil(chunks[0].length / 2);
    chunks.splice(0, 1, chunks[0].slice(0, splitAt), chunks[0].slice(splitAt));
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

export function requirementsContractDiagramProjectionHash(input: {
  sequenceContractHash: string;
  diagram: Omit<Diagram, 'projectionHash'>;
}): string {
  return sha256Stable(input);
}

function diagram(
  sequenceContractHash: string,
  input: Omit<Diagram, 'projectionHash'>
): Diagram {
  return {
    ...input,
    projectionHash: requirementsContractDiagramProjectionHash({
      sequenceContractHash,
      diagram: input,
    }),
  };
}

export function planRequirementsContractDiagramSet(input: {
  sequenceContract: RequirementsContractSequenceContract;
  scenarioId: string;
}): RequirementsContractDiagramSet {
  const contractValidation = validateSequenceContract(input.sequenceContract);
  if (!contractValidation.ok) {
    throw new Error(`Diagram Set requires a valid Sequence Contract`);
  }
  const scenario = input.sequenceContract.sequenceScenarios.find(
    (candidate) => candidate.id === input.scenarioId
  );
  if (!scenario) throw new Error(`unknown Sequence Scenario: ${input.scenarioId}`);
  const stem = scenarioStem(scenario.id);
  const chunks = chunksForScenario(scenario);
  const requiresDecomposition =
    scenario.participants.length > MAX_PARTICIPANTS ||
    scenario.steps.length > MAX_MESSAGES ||
    scenario.branches.length > MAX_CONTROL_BLOCKS;
  let diagrams: Diagram[];
  let rootDiagramRef: string;
  let transitionEdges: RequirementsContractDiagramSet['transitionEdges'] = [];
  let blockingChildRefs: string[] = [];

  if (!requiresDecomposition) {
    rootDiagramRef = `DGM-${stem}-PRIMARY-001`;
    diagrams = [
      diagram(input.sequenceContract.sequenceContractHash, {
        diagramRef: rootDiagramRef,
        role: 'primary_happy_path',
        scenarioRef: scenario.id,
        messageRefs: chunks[0],
        blockingChildRefs: [],
      }),
    ];
  } else {
    rootDiagramRef = `DGM-${stem}-OVERVIEW-001`;
    blockingChildRefs = chunks.map(
      (_, index) => `DGM-${stem}-DRILLDOWN-${String(index + 1).padStart(3, '0')}`
    );
    diagrams = [
      diagram(input.sequenceContract.sequenceContractHash, {
        diagramRef: rootDiagramRef,
        role: 'scenario_overview',
        scenarioRef: scenario.id,
        messageRefs: [],
        blockingChildRefs,
      }),
      ...chunks.map((messageRefs, index) =>
        diagram(input.sequenceContract.sequenceContractHash, {
          diagramRef: blockingChildRefs[index],
          role: 'capability_drilldown',
          scenarioRef: scenario.id,
          messageRefs,
          blockingChildRefs: [],
        })
      ),
    ];
    transitionEdges = chunks.map((messageRefs, index) => ({
      messageRef: messageRefs[0],
      expandsTo: blockingChildRefs[index],
    }));
  }

  const diagramSet: RequirementsContractDiagramSet = {
    schemaVersion: 'requirements-contract-diagram-set/v1',
    diagramSetId: `DSET-${stem}-001`,
    rootDiagramRef,
    diagrams,
    transitionEdges,
    expandedMessageRefs: chunks.flat(),
    blockingChildRefs,
    sequenceContractHash: input.sequenceContract.sequenceContractHash,
    projectionHashes: diagrams.map((candidate) => candidate.projectionHash),
  };
  const validation = validateDiagramSet(diagramSet);
  if (!validation.ok) {
    throw new Error(`Diagram Set validation failed: ${JSON.stringify(validation.issues)}`);
  }
  return diagramSet;
}
