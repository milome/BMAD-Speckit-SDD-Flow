import {
  compileRequirementsContractFinalizationByteManifest,
  type RequirementsContractFinalizationByteManifest,
} from './requirements-contract-finalization-byte-manifest';
import {
  compileRequirementsContractVerificationDag,
  type RequirementsContractVerificationDag,
} from './requirements-contract-verification-dag';
import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractCampaignRemediationReceipt {
  schemaVersion: 'requirements-contract-campaign-remediation-receipt/v1';
  campaignId: string;
  candidateId: string;
  verificationDagHash: string;
  finalizationByteManifestHash: string;
  closedOriginCount: number;
  mandatoryCommandExecutionCount: number;
  postSealMutationDetected: false;
  decision: 'pass';
  campaignRemediationReceiptHash: string;
}

export interface RequirementsContractCampaignRemediationResult {
  verificationDag: RequirementsContractVerificationDag;
  finalizationByteManifest: RequirementsContractFinalizationByteManifest;
  receipt: RequirementsContractCampaignRemediationReceipt;
}

export class RequirementsContractCampaignDeterministicVerificationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractCampaignDeterministicVerificationError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractCampaignDeterministicVerificationError(code);
}

export function verifyRequirementsContractCampaignRemediationCandidate(
  input: unknown
): RequirementsContractCampaignRemediationResult {
  if (!isRecord(input)) fail('campaign_remediation_input_invalid');
  const campaignId = requireText(input, 'campaignId', 'campaign_remediation_campaign_invalid');
  const candidateId = requireText(input, 'candidateId', 'campaign_remediation_candidate_invalid');
  if (input.postSealMutationDetected === true) fail('campaign_remediation_post_seal_mutation');
  const verificationDag = compileRequirementsContractVerificationDag({
    candidateId,
    commandExecutions: input.commandExecutions,
    originClosures: input.originClosures,
    expectedOriginIds: input.expectedOriginIds,
  });
  const finalizationByteManifest = compileRequirementsContractFinalizationByteManifest({
    candidateId,
    originClosureHashes: verificationDag.originClosureHashes,
    mandatoryCommandIdentityHashes: verificationDag.mandatoryCommandIdentityHashes,
    sealedFileHashes: input.sealedFileHashes,
  });
  const payload = {
    schemaVersion: 'requirements-contract-campaign-remediation-receipt/v1' as const,
    campaignId,
    candidateId,
    verificationDagHash: verificationDag.verificationDagHash,
    finalizationByteManifestHash: finalizationByteManifest.finalizationByteManifestHash,
    closedOriginCount: verificationDag.originClosureHashes.length,
    mandatoryCommandExecutionCount: verificationDag.mandatoryCommandIdentityHashes.length,
    postSealMutationDetected: false as const,
    decision: 'pass' as const,
  };
  return {
    verificationDag,
    finalizationByteManifest,
    receipt: { ...payload, campaignRemediationReceiptHash: stableHash(payload) },
  };
}

export function validateRequirementsContractCampaignRemediationReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractCampaignRemediationReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('campaign_remediation_receipt_invalid');
  const receipt = value as unknown as RequirementsContractCampaignRemediationReceipt;
  const { campaignRemediationReceiptHash, ...payload } = receipt;
  if (campaignRemediationReceiptHash !== stableHash(payload)) {
    fail('campaign_remediation_receipt_hash_mismatch');
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-campaign-remediation-receipt/v1' ||
    receipt.decision !== 'pass' ||
    receipt.postSealMutationDetected !== false
  ) {
    fail('campaign_remediation_receipt_invalid');
  }
  for (const field of [
    'campaignId',
    'candidateId',
    'verificationDagHash',
    'finalizationByteManifestHash',
    'campaignRemediationReceiptHash',
  ] as const) {
    if (text(receipt[field]) !== text(currentAuthority[field])) {
      fail('campaign_remediation_receipt_stale');
    }
  }
  requireHash(receipt, 'verificationDagHash', 'campaign_remediation_receipt_invalid');
  requireHash(receipt, 'finalizationByteManifestHash', 'campaign_remediation_receipt_invalid');
  return receipt;
}
