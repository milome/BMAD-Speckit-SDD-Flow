import {
  classifyRequirementsContractArtifactRole,
  type RequirementsContractArtifactRole,
} from './requirements-contract-artifact-role-classifier';
import {
  getRequirementsContractBmadConsumer,
  type RequirementsContractBmadConsumer,
} from './requirements-contract-bmad-consumer-registry';
import type { RequirementsContractDiscoverySession } from './requirements-contract-discovery-session';
import {
  createRequirementsContractSemanticCandidateBatch,
  type SemanticCandidateKind,
} from './requirements-contract-semantic-candidate-batch';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface AdvancedElicitationFinding {
  findingId: string;
  findingKind: Exclude<SemanticCandidateKind, 'requirement' | 'negative_requirement'>;
  statement: string;
  sourceExcerptIds: string[];
}

export function createAdvancedElicitationCandidateBatch(input: {
  requirementSetId: string;
  discoverySession: RequirementsContractDiscoverySession;
  findings: AdvancedElicitationFinding[];
}): {
  consumer: RequirementsContractBmadConsumer;
  batch: ReturnType<typeof createRequirementsContractSemanticCandidateBatch>;
} {
  const consumer = getRequirementsContractBmadConsumer(
    'bmad-advanced-elicitation-requirements'
  );
  return {
    consumer,
    batch: createRequirementsContractSemanticCandidateBatch({
      requirementSetId: input.requirementSetId,
      discoverySession: input.discoverySession,
      producedByConsumerId: consumer.consumerId,
      candidates: input.findings.map((finding) => ({
        candidateId: finding.findingId,
        candidateKind: finding.findingKind,
        statement: finding.statement,
        sourceExcerptIds: finding.sourceExcerptIds,
      })),
    }),
  };
}

export type BmadCreatePrdStage =
  | 'discovery'
  | 'advanced_elicitation'
  | 'automatic_semantic_resolution'
  | 'requirements_grill'
  | 'draft_validation'
  | 'confirmation_ready_validation'
  | 'canonical_source_prd_render'
  | 'registered_product_prd_render'
  | 'semantic_candidate_capture'
  | 'safe_write'
  | 'runtime_registration'
  | 'receipt_generation';

export interface BmadCreatePrdStageReceipt {
  schemaVersion: 'requirements-contract-orchestration-stage-receipt/v1';
  order: number;
  stage: BmadCreatePrdStage;
  inputHash: string;
  outputHash: string;
  receiptHash: string;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function stagesFor(role: RequirementsContractArtifactRole): BmadCreatePrdStage[] {
  if (role === 'requirement_source_prd') {
    return [
      'discovery',
      'advanced_elicitation',
      'automatic_semantic_resolution',
      'requirements_grill',
      'draft_validation',
      'confirmation_ready_validation',
      'canonical_source_prd_render',
      'safe_write',
      'runtime_registration',
      'receipt_generation',
    ];
  }
  if (role === 'product_prd') {
    return ['discovery', 'registered_product_prd_render', 'safe_write', 'receipt_generation'];
  }
  return ['discovery', 'semantic_candidate_capture', 'receipt_generation'];
}

export async function executeBmadCreatePrdOrchestration(input: {
  requestedArtifactRole: RequirementsContractArtifactRole;
  runStage: (
    stage: BmadCreatePrdStage
  ) => Promise<{ stage: BmadCreatePrdStage; outputHash: string }>;
}): Promise<{
  schemaVersion: 'requirements-contract-bmad-create-prd-orchestration/v1';
  artifactRole: RequirementsContractArtifactRole;
  consumerId: 'bmad-create-prd-source-authoring';
  manualSkillChainingRequired: false;
  directPrdWriteCount: 0;
  finalImplementationAuthority: 'source_authority' | 'none';
  stageReceipts: BmadCreatePrdStageReceipt[];
  decision: 'completed';
}> {
  const classification = classifyRequirementsContractArtifactRole({
    requestedArtifactRole: input.requestedArtifactRole,
  });
  if (!classification.ok || !classification.classification) {
    throw new Error(`Create PRD artifact-role classification failed: ${JSON.stringify(classification.issues)}`);
  }
  const consumer = getRequirementsContractBmadConsumer('bmad-create-prd-source-authoring');
  let inputHash = sha256Stable({
    consumerId: consumer.consumerId,
    artifactRole: classification.classification.artifactRole,
  });
  const stageReceipts: BmadCreatePrdStageReceipt[] = [];
  for (const [index, stage] of stagesFor(classification.classification.artifactRole).entries()) {
    const result = await input.runStage(stage);
    if (result.stage !== stage || !HASH_PATTERN.test(result.outputHash)) {
      throw new Error(`Create PRD stage returned an invalid receipt: ${stage}`);
    }
    const preimage = {
      schemaVersion: 'requirements-contract-orchestration-stage-receipt/v1' as const,
      order: index + 1,
      stage,
      inputHash,
      outputHash: result.outputHash,
    };
    const receipt = { ...preimage, receiptHash: sha256Stable(preimage) };
    stageReceipts.push(receipt);
    inputHash = receipt.receiptHash;
  }
  return {
    schemaVersion: 'requirements-contract-bmad-create-prd-orchestration/v1',
    artifactRole: classification.classification.artifactRole,
    consumerId: consumer.consumerId,
    manualSkillChainingRequired: false,
    directPrdWriteCount: 0,
    finalImplementationAuthority:
      classification.classification.outputPolicy.finalImplementationAuthority,
    stageReceipts,
    decision: 'completed',
  };
}
