import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  publishRequirementsContractRemediationCandidate,
  validateRequirementsContractRemediationPublicationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-publisher';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function publicationInput(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    candidateId: 'candidate-a',
    finalizationByteManifestHash: hash('finalization'),
    campaignRemediationReceiptHash: hash('campaign-remediation'),
    candidateFiles: [
      { path: 'packages/bmad-speckit/src/a.ts', byteHash: hash('a') },
      { path: 'packages/bmad-speckit/src/b.ts', byteHash: hash('b') },
    ],
    dirtyPreservation: {
      preservedPathHashes: [hash('user-dirty-a')],
      unrelatedDirtyChanged: false,
      userChangesOverwritten: false,
    },
    conflictDetected: false,
    replayOfPublishedAttempt: false,
    partialPromotionDetected: false,
    markdownAuthorityPublished: false,
    ...overrides,
  };
}

describe('requirements contract remediation publication', () => {
  it('publishes a clean verified candidate once and calculates a post remediation attempt key', () => {
    const receipt = publishRequirementsContractRemediationCandidate(publicationInput());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-remediation-publication-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(receipt.publicationOrdinal).toBe(1);
    expect(receipt.markdownAuthorityPublished).toBe(false);
    expect(receipt.recoveredFromPartialPromotion).toBe(false);
    expect(
      validateRequirementsContractRemediationPublicationReceipt(receipt, {
        campaignId: 'goal-campaign-001',
        candidateId: 'candidate-a',
        postRemediationAttemptKey: receipt.postRemediationAttemptKey,
        publicationReceiptHash: receipt.publicationReceiptHash,
      })
    ).toBe(receipt);
  });

  it('preserves dirty work, recovers partial promotion, and fails closed for conflict and replay', () => {
    const recovered = publishRequirementsContractRemediationCandidate(
      publicationInput({ partialPromotionDetected: true })
    );
    expect(recovered.recoveredFromPartialPromotion).toBe(true);

    expect(() =>
      publishRequirementsContractRemediationCandidate(
        publicationInput({
          dirtyPreservation: { preservedPathHashes: [hash('x')], unrelatedDirtyChanged: true },
        })
      )
    ).toThrow('remediation_publication_dirty_preservation_failed');

    expect(() =>
      publishRequirementsContractRemediationCandidate(publicationInput({ conflictDetected: true }))
    ).toThrow('remediation_publication_conflict');

    expect(() =>
      publishRequirementsContractRemediationCandidate(
        publicationInput({ replayOfPublishedAttempt: true })
      )
    ).toThrow('remediation_publication_replay');

    const receipt = publishRequirementsContractRemediationCandidate(publicationInput());
    expect(() =>
      validateRequirementsContractRemediationPublicationReceipt(receipt, {
        campaignId: 'goal-campaign-001',
        candidateId: 'candidate-a',
        postRemediationAttemptKey: hash('stale'),
        publicationReceiptHash: receipt.publicationReceiptHash,
      })
    ).toThrow('remediation_publication_receipt_stale');
  });
});
