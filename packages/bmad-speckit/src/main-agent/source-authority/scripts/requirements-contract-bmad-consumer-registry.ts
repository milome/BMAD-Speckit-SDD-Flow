export type RequirementsContractBmadConsumerId =
  | 'bmad-create-prd-source-authoring'
  | 'bmad-advanced-elicitation-requirements';

export interface RequirementsContractBmadConsumer {
  consumerId: RequirementsContractBmadConsumerId;
  role: 'authoring_orchestrator' | 'advisory_analysis';
  allowedOutputs: readonly string[];
  directPrdWrite: false;
  localValidatorOwnership: false;
  basenameIdentityCreation: false;
  syntheticSemanticCompletion: false;
  stepsCompletedReadiness: false;
  semanticAuthorityMutation: false;
  recommendationSelection: false;
  decisionReceiptCreation: false;
  readinessGrant: false;
  passGrant: false;
}

const CONSUMERS: readonly RequirementsContractBmadConsumer[] = Object.freeze([
  Object.freeze({
    consumerId: 'bmad-create-prd-source-authoring',
    role: 'authoring_orchestrator',
    allowedOutputs: Object.freeze([
      'requirements-contract-discovery-session/v1',
      'requirements-contract-semantic-candidate-batch/v1',
      'requirements-contract-orchestration-receipt/v1',
      'requirements-contract-authoring-status/v1',
    ]),
    directPrdWrite: false,
    localValidatorOwnership: false,
    basenameIdentityCreation: false,
    syntheticSemanticCompletion: false,
    stepsCompletedReadiness: false,
    semanticAuthorityMutation: false,
    recommendationSelection: false,
    decisionReceiptCreation: false,
    readinessGrant: false,
    passGrant: false,
  }),
  Object.freeze({
    consumerId: 'bmad-advanced-elicitation-requirements',
    role: 'advisory_analysis',
    allowedOutputs: Object.freeze(['requirements-contract-semantic-candidate-batch/v1']),
    directPrdWrite: false,
    localValidatorOwnership: false,
    basenameIdentityCreation: false,
    syntheticSemanticCompletion: false,
    stepsCompletedReadiness: false,
    semanticAuthorityMutation: false,
    recommendationSelection: false,
    decisionReceiptCreation: false,
    readinessGrant: false,
    passGrant: false,
  }),
]);

export const REQUIREMENTS_CONTRACT_BMAD_CONSUMERS = CONSUMERS;

export function getRequirementsContractBmadConsumer(
  consumerId: RequirementsContractBmadConsumerId
): RequirementsContractBmadConsumer {
  const consumer = CONSUMERS.find((candidate) => candidate.consumerId === consumerId);
  if (!consumer) throw new Error(`unregistered requirements-contract BMAD consumer: ${consumerId}`);
  return consumer;
}
