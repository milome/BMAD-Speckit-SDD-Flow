import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  text,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractRemediationPublicationReceipt {
  schemaVersion: 'requirements-contract-remediation-publication-receipt/v1';
  campaignId: string;
  candidateId: string;
  postRemediationAttemptKey: string;
  publicationOrdinal: 1;
  publishedPathHashes: string[];
  dirtyPreservationHash: string;
  markdownAuthorityPublished: false;
  recoveredFromPartialPromotion: boolean;
  decision: 'pass';
  publicationReceiptHash: string;
}

export class RequirementsContractRemediationPublisherError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationPublisherError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationPublisherError(code);
}

function publishedPathHashes(value: unknown): string[] {
  const records = Array.isArray(value) ? value : [];
  if (records.length === 0) fail('remediation_publication_candidate_missing');
  return uniqueSorted(
    records.map((record) => {
      if (!isRecord(record)) fail('remediation_publication_candidate_missing');
      return stableHash({
        path: requireText(record, 'path', 'remediation_publication_candidate_missing'),
        byteHash: requireHash(record, 'byteHash', 'remediation_publication_candidate_missing'),
      });
    })
  );
}

function dirtyPreservationHash(value: unknown): string {
  if (!isRecord(value)) fail('remediation_publication_dirty_preservation_failed');
  if (value.unrelatedDirtyChanged === true || value.userChangesOverwritten === true) {
    fail('remediation_publication_dirty_preservation_failed');
  }
  return stableHash({
    preservedPathHashes: requireNonEmptyUniqueStrings(
      value.preservedPathHashes,
      'remediation_publication_dirty_preservation_failed'
    ),
  });
}

export function publishRequirementsContractRemediationCandidate(
  input: unknown
): RequirementsContractRemediationPublicationReceipt {
  if (!isRecord(input)) fail('remediation_publication_input_invalid');
  const campaignId = requireText(input, 'campaignId', 'remediation_publication_campaign_invalid');
  const candidateId = requireText(
    input,
    'candidateId',
    'remediation_publication_candidate_missing'
  );
  if (input.markdownAuthorityPublished === true) fail('remediation_publication_markdown_authority');
  if (input.conflictDetected === true) fail('remediation_publication_conflict');
  if (input.replayOfPublishedAttempt === true) fail('remediation_publication_replay');
  const finalizationByteManifestHash = requireHash(
    input,
    'finalizationByteManifestHash',
    'remediation_publication_candidate_missing'
  );
  const campaignRemediationReceiptHash = requireHash(
    input,
    'campaignRemediationReceiptHash',
    'remediation_publication_candidate_missing'
  );
  const publishedHashes = publishedPathHashes(input.candidateFiles);
  const preservationHash = dirtyPreservationHash(input.dirtyPreservation);
  const recoveredFromPartialPromotion = input.partialPromotionDetected === true;
  const payload = {
    schemaVersion: 'requirements-contract-remediation-publication-receipt/v1' as const,
    campaignId,
    candidateId,
    postRemediationAttemptKey: stableHash({
      campaignId,
      candidateId,
      finalizationByteManifestHash,
      campaignRemediationReceiptHash,
      publishedPathHashes: publishedHashes,
      dirtyPreservationHash: preservationHash,
    }),
    publicationOrdinal: 1 as const,
    publishedPathHashes: publishedHashes,
    dirtyPreservationHash: preservationHash,
    markdownAuthorityPublished: false as const,
    recoveredFromPartialPromotion,
    decision: 'pass' as const,
  };
  return { ...payload, publicationReceiptHash: stableHash(payload) };
}

export function validateRequirementsContractRemediationPublicationReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractRemediationPublicationReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('remediation_publication_receipt_invalid');
  }
  const receipt = value as unknown as RequirementsContractRemediationPublicationReceipt;
  const { publicationReceiptHash, ...payload } = receipt;
  if (publicationReceiptHash !== stableHash(payload)) {
    fail('remediation_publication_receipt_hash_mismatch');
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-remediation-publication-receipt/v1' ||
    receipt.decision !== 'pass' ||
    receipt.publicationOrdinal !== 1 ||
    receipt.markdownAuthorityPublished !== false
  ) {
    fail('remediation_publication_receipt_invalid');
  }
  for (const field of [
    'campaignId',
    'candidateId',
    'postRemediationAttemptKey',
    'publicationReceiptHash',
  ] as const) {
    if (text(receipt[field]) !== text(currentAuthority[field])) {
      fail('remediation_publication_receipt_stale');
    }
  }
  return receipt;
}
