import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export interface SequenceVerificationBindings {
  oracleRef: string;
  redTestRef: string;
  commandRefs: string[];
  evidenceRefs: string[];
}

export interface SequenceProofBindings {
  sourceSpanRefs: string[];
  sourceHashes: string[];
  semanticResolutionReceiptRefs: string[];
  repositoryRefs: string[];
  policyApplicabilityReceiptRefs: string[];
  decisionReceiptRefs: string[];
  requirementRefs: string[];
  targetRefs: string[];
  verificationBindings: SequenceVerificationBindings;
  semanticModelHash: string;
}

export interface SequenceParticipant extends SequenceProofBindings {
  id: string;
  kind: 'human_actor' | 'runtime_component' | 'data_store' | 'external_system' | 'queue_or_topic';
  label: string;
  owningSystem: string;
}

export interface SequenceStep extends SequenceProofBindings {
  id: string;
  order: number;
  type:
    | 'request'
    | 'response'
    | 'command'
    | 'query'
    | 'external_call'
    | 'persistence_read'
    | 'persistence_write'
    | 'event_publish'
    | 'event_consume'
    | 'state_transition'
    | 'authorization'
    | 'retry'
    | 'compensation'
    | 'idempotency'
    | 'user_visible_result';
  from: string;
  to: string;
  operation: string;
  owningSystem: string;
  integrationBoundaryRef: string | null;
}

export interface SequenceBranch extends SequenceProofBindings {
  id: string;
  condition: string;
  testScenarioRefs: string[];
  owningSystem: string;
}

export interface SequenceStateTransition extends SequenceProofBindings {
  id: string;
  fromState: string;
  toState: string;
  triggerStepRef: string;
  owningSystem: string;
}

export interface SequenceOrderingConstraint extends SequenceProofBindings {
  id: string;
  before: string;
  after: string;
  reason: string;
  oracleRef: string;
  testRefs: string[];
  owningSystem: string;
}

export interface SequenceTemporalConstraint extends SequenceProofBindings {
  id: string;
  stepRef: string;
  correlationKey: string;
  deadlineMs: number | null;
  eventualConsistencyWindowMs: number | null;
  duplicatePolicy: string;
  orderingPolicy: string;
  oracleRef: string;
  testRefs: string[];
  owningSystem: string;
}

export interface RequirementsContractSequenceContract {
  schemaVersion: 'requirements-contract-sequence-contract/v1';
  projectKind: 'consumer_product' | 'governance_framework' | 'hybrid';
  projectProfileHash: string;
  semanticModelHash: string;
  sequenceContractHash: string;
  integrationBoundaries: Array<{
    id: string;
    fromOwningSystem: string;
    toOwningSystem: string;
    proofRefs: string[];
  }>;
  sequenceScenarios: Array<{
    id: string;
    owningSystem: string;
    requirementRefs: string[];
    trigger: {
      actorRef: string;
      event: string;
      sourceRefs: string[];
    };
    participants: SequenceParticipant[];
    steps: SequenceStep[];
    branches: SequenceBranch[];
    orderingConstraints: SequenceOrderingConstraint[];
    temporalConstraints: SequenceTemporalConstraint[];
    stateTransitions: SequenceStateTransition[];
  }>;
}

export interface RequirementsContractDiagramSet {
  schemaVersion: 'requirements-contract-diagram-set/v1';
  diagramSetId: string;
  rootDiagramRef: string;
  diagrams: Array<{
    diagramRef: string;
    role:
      | 'scenario_overview'
      | 'primary_happy_path'
      | 'capability_drilldown'
      | 'failure_compensation'
      | 'lifecycle'
      | 'deployment_delta'
      | 'data_security';
    scenarioRef: string;
    messageRefs: string[];
    blockingChildRefs: string[];
    projectionHash: string;
  }>;
  transitionEdges: Array<{
    messageRef: string;
    expandsTo: string;
  }>;
  expandedMessageRefs: string[];
  blockingChildRefs: string[];
  sequenceContractHash: string;
  projectionHashes: string[];
}

export interface SequenceContractIssue {
  code:
    | 'schema_validation_failed'
    | 'duplicate_scenario_id'
    | 'duplicate_participant_id'
    | 'duplicate_local_id'
    | 'unknown_participant_ref'
    | 'unknown_sequence_step_ref'
    | 'unknown_integration_boundary_ref'
    | 'unauthorized_ownership_crossing'
    | 'semantic_model_hash_mismatch'
    | 'unknown_root_diagram_ref'
    | 'duplicate_diagram_ref'
    | 'unknown_diagram_ref';
  path: string;
  message: string;
}

export interface SequenceContractValidationResult {
  ok: boolean;
  issues: SequenceContractIssue[];
}

function schemaPath(fileName: string): string {
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      fileName
    ),
    path.resolve(__dirname, '..', 'schemas', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function schemaIssues(fileName: string, candidate: unknown): SequenceContractIssue[] {
  const schema = JSON.parse(readFileSync(schemaPath(fileName), 'utf8')) as Record<string, unknown>;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(candidate)) return [];
  return (validate.errors ?? []).map((error) => ({
    code: 'schema_validation_failed' as const,
    path: error.instancePath || '/',
    message: error.message ?? 'schema validation failed',
  }));
}

function addIssue(
  issues: SequenceContractIssue[],
  code: SequenceContractIssue['code'],
  issuePath: string,
  message: string
): void {
  if (issues.some((issue) => issue.code === code && issue.path === issuePath)) return;
  issues.push({ code, path: issuePath, message });
}

function validateProofHash(
  issues: SequenceContractIssue[],
  proof: SequenceProofBindings,
  semanticModelHash: string,
  proofPath: string
): void {
  if (proof.semanticModelHash !== semanticModelHash) {
    addIssue(
      issues,
      'semantic_model_hash_mismatch',
      `${proofPath}/semanticModelHash`,
      'proof binding does not use the current semantic model hash'
    );
  }
}

export function validateSequenceContract(
  candidate: RequirementsContractSequenceContract
): SequenceContractValidationResult {
  const issues = schemaIssues('requirements-contract-sequence-contract.schema.json', candidate);
  const scenarioIds = new Set<string>();
  const globalParticipantIds = new Set<string>();
  const boundaryIds = new Set(candidate.integrationBoundaries.map((boundary) => boundary.id));

  candidate.sequenceScenarios.forEach((scenario, scenarioIndex) => {
    const scenarioPath = `/sequenceScenarios/${scenarioIndex}`;
    if (scenarioIds.has(scenario.id)) {
      addIssue(
        issues,
        'duplicate_scenario_id',
        `${scenarioPath}/id`,
        `duplicate scenario ID: ${scenario.id}`
      );
    }
    scenarioIds.add(scenario.id);

    const participants = new Map<string, SequenceParticipant>();
    scenario.participants.forEach((participant, participantIndex) => {
      const participantPath = `${scenarioPath}/participants/${participantIndex}`;
      if (globalParticipantIds.has(participant.id)) {
        addIssue(
          issues,
          'duplicate_participant_id',
          `${participantPath}/id`,
          `participant ID must be globally unique: ${participant.id}`
        );
      }
      globalParticipantIds.add(participant.id);
      if (!participants.has(participant.id)) participants.set(participant.id, participant);
      validateProofHash(issues, participant, candidate.semanticModelHash, participantPath);
      if (
        candidate.projectKind === 'hybrid' &&
        participant.owningSystem !== scenario.owningSystem &&
        candidate.integrationBoundaries.length === 0
      ) {
        addIssue(
          issues,
          'unauthorized_ownership_crossing',
          `${participantPath}/owningSystem`,
          'hybrid ownership partition requires an authorized integration boundary'
        );
      }
    });

    const localIds = new Set<string>();
    const stepIds = new Set<string>();
    scenario.steps.forEach((step, stepIndex) => {
      const stepPath = `${scenarioPath}/steps/${stepIndex}`;
      if (localIds.has(step.id)) {
        addIssue(issues, 'duplicate_local_id', `${stepPath}/id`, `duplicate local ID: ${step.id}`);
      }
      localIds.add(step.id);
      stepIds.add(step.id);
      validateProofHash(issues, step, candidate.semanticModelHash, stepPath);

      const fromParticipant = participants.get(step.from);
      const toParticipant = participants.get(step.to);
      for (const [field, participant] of [
        ['from', fromParticipant],
        ['to', toParticipant],
      ] as const) {
        if (!participant) {
          addIssue(
            issues,
            'unknown_participant_ref',
            `${stepPath}/${field}`,
            `unknown participant ref: ${step[field]}`
          );
        }
      }
      if (step.integrationBoundaryRef && !boundaryIds.has(step.integrationBoundaryRef)) {
        addIssue(
          issues,
          'unknown_integration_boundary_ref',
          `${stepPath}/integrationBoundaryRef`,
          `unknown integration boundary: ${step.integrationBoundaryRef}`
        );
      }
      if (
        candidate.projectKind === 'hybrid' &&
        fromParticipant &&
        toParticipant &&
        fromParticipant.owningSystem !== toParticipant.owningSystem &&
        (!step.integrationBoundaryRef || !boundaryIds.has(step.integrationBoundaryRef))
      ) {
        addIssue(
          issues,
          'unauthorized_ownership_crossing',
          `${stepPath}/integrationBoundaryRef`,
          'cross-system message requires an authorized integration boundary'
        );
      }
    });

    const proofCollections: Array<
      [
        string,
        Array<
          | SequenceBranch
          | SequenceStateTransition
          | SequenceOrderingConstraint
          | SequenceTemporalConstraint
        >,
      ]
    > = [
      ['branches', scenario.branches],
      ['stateTransitions', scenario.stateTransitions],
      ['orderingConstraints', scenario.orderingConstraints],
      ['temporalConstraints', scenario.temporalConstraints],
    ];
    for (const [collectionName, collection] of proofCollections) {
      collection.forEach((item, itemIndex) => {
        const itemPath = `${scenarioPath}/${collectionName}/${itemIndex}`;
        if (localIds.has(item.id)) {
          addIssue(
            issues,
            'duplicate_local_id',
            `${itemPath}/id`,
            `duplicate local ID: ${item.id}`
          );
        }
        localIds.add(item.id);
        validateProofHash(issues, item, candidate.semanticModelHash, itemPath);
      });
    }

    scenario.stateTransitions.forEach((transition, index) => {
      if (!stepIds.has(transition.triggerStepRef)) {
        addIssue(
          issues,
          'unknown_sequence_step_ref',
          `${scenarioPath}/stateTransitions/${index}/triggerStepRef`,
          `unknown step ref: ${transition.triggerStepRef}`
        );
      }
    });
    scenario.orderingConstraints.forEach((constraint, index) => {
      for (const field of ['before', 'after'] as const) {
        if (!stepIds.has(constraint[field])) {
          addIssue(
            issues,
            'unknown_sequence_step_ref',
            `${scenarioPath}/orderingConstraints/${index}/${field}`,
            `unknown step ref: ${constraint[field]}`
          );
        }
      }
    });
    scenario.temporalConstraints.forEach((constraint, index) => {
      if (!stepIds.has(constraint.stepRef)) {
        addIssue(
          issues,
          'unknown_sequence_step_ref',
          `${scenarioPath}/temporalConstraints/${index}/stepRef`,
          `unknown step ref: ${constraint.stepRef}`
        );
      }
    });
  });

  return { ok: issues.length === 0, issues };
}

export function validateDiagramSet(
  candidate: RequirementsContractDiagramSet
): SequenceContractValidationResult {
  const issues = schemaIssues('requirements-contract-diagram-set.schema.json', candidate);
  const diagramRefs = new Set<string>();
  candidate.diagrams.forEach((diagram, index) => {
    if (diagramRefs.has(diagram.diagramRef)) {
      addIssue(
        issues,
        'duplicate_diagram_ref',
        `/diagrams/${index}/diagramRef`,
        `duplicate diagram ref: ${diagram.diagramRef}`
      );
    }
    diagramRefs.add(diagram.diagramRef);
  });
  if (!diagramRefs.has(candidate.rootDiagramRef)) {
    addIssue(
      issues,
      'unknown_root_diagram_ref',
      '/rootDiagramRef',
      `unknown root diagram ref: ${candidate.rootDiagramRef}`
    );
  }
  candidate.transitionEdges.forEach((edge, index) => {
    if (!diagramRefs.has(edge.expandsTo)) {
      addIssue(
        issues,
        'unknown_diagram_ref',
        `/transitionEdges/${index}/expandsTo`,
        `unknown expanded diagram ref: ${edge.expandsTo}`
      );
    }
  });
  for (const [index, childRef] of candidate.blockingChildRefs.entries()) {
    if (!diagramRefs.has(childRef)) {
      addIssue(
        issues,
        'unknown_diagram_ref',
        `/blockingChildRefs/${index}`,
        `unknown blocking child diagram ref: ${childRef}`
      );
    }
  }
  return { ok: issues.length === 0, issues };
}
