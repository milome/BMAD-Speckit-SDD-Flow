import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractCampaignRemediationLedger,
  validateRequirementsContractCampaignRemediationLedger,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-campaign-finding-merge';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function origin(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    actorClass: 'bounded_code_reviewer' as const,
    sourceLedgerHash: hash('reviewer-ledger'),
    sourceLineageHash: hash('source-lineage-a'),
    findingId: 'R-001',
    canonicalObservationHash: hash('same-observation'),
    message: 'Reviewer phrased this one way',
    ...overrides,
  };
}

function originId(item: ReturnType<typeof origin>) {
  return sha256Stable({
    campaignId: item.campaignId,
    campaignLineageKey: item.campaignLineageKey,
    initialReviewAttemptKey: item.initialReviewAttemptKey,
    actorClass: item.actorClass,
    sourceLedgerHash: item.sourceLedgerHash,
    sourceLineageHash: item.sourceLineageHash,
    findingId: item.findingId,
  });
}

function findings() {
  return [
    origin(),
    origin({
      actorClass: 'final_acceptance_judge',
      sourceLedgerHash: hash('final-ledger'),
      sourceLineageHash: hash('source-lineage-b'),
      findingId: 'F-009',
      message: 'Final judge used different words for the same observation',
    }),
    origin({
      findingId: 'R-002',
      sourceLineageHash: hash('source-lineage-c'),
      canonicalObservationHash: hash('other-observation'),
      message: 'Different observation',
    }),
  ];
}

function validInput(overrides = {}) {
  const sourceFindings = findings();
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('attempt-1'),
    blindReviewAggregateHash: hash('blind-aggregate'),
    sourceFindings,
    finalDispositions: sourceFindings.map((item) => ({
      originId: originId(item),
      disposition: 'accepted',
      dispositionRef: `disposition/${item.findingId}`,
    })),
    ...overrides,
  };
}

describe('requirements contract campaign finding merge', () => {
  it('deduplicates equivalent findings deterministically while preserving every origin', () => {
    const ledger = compileRequirementsContractCampaignRemediationLedger(validInput());
    const reversed = compileRequirementsContractCampaignRemediationLedger({
      ...validInput(),
      sourceFindings: [...validInput().sourceFindings].reverse(),
      finalDispositions: [...validInput().finalDispositions].reverse(),
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-campaign-remediation-ledger.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(reversed).toEqual(ledger);
    expect(ledger.originCount).toBe(3);
    expect(ledger.mergedFindings).toHaveLength(2);
    expect(ledger.mergedFindings[0].origins).toHaveLength(2);
    expect(ledger.originPreservationMatrix.map((row) => row.originId)).toEqual(
      [...ledger.originPreservationMatrix.map((row) => row.originId)].sort()
    );
    expect(validate(ledger), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractCampaignRemediationLedger(ledger, {
        campaignId: ledger.campaignId,
        campaignLineageKey: ledger.campaignLineageKey,
        initialReviewAttemptKey: ledger.initialReviewAttemptKey,
        ledgerHash: ledger.ledgerHash,
      })
    ).toBe(ledger);
  });

  it.each([
    [
      'missing origin disposition',
      { finalDispositions: validInput().finalDispositions.slice(1) },
      'campaign_finding_disposition_missing',
    ],
    [
      'duplicate origin disposition',
      { finalDispositions: [validInput().finalDispositions[0], ...validInput().finalDispositions] },
      'campaign_finding_disposition_duplicate',
    ],
    [
      'cross campaign replay',
      { sourceFindings: [origin({ campaignId: 'other-campaign' })] },
      'campaign_finding_origin_replay',
    ],
    [
      'message wording identity',
      { sourceFindings: [origin({ canonicalObservationHash: undefined })] },
      'campaign_finding_message_identity_forbidden',
    ],
    [
      'fixer waiver',
      {
        finalDispositions: validInput().finalDispositions.map((item, index) =>
          index === 0 ? { ...item, disposition: 'fixer_waiver' } : item
        ),
      },
      'campaign_finding_fixer_waiver_forbidden',
    ],
    [
      'unknown origin disposition',
      {
        finalDispositions: [
          ...validInput().finalDispositions,
          { originId: hash('unknown-origin'), disposition: 'accepted', dispositionRef: 'unknown' },
        ],
      },
      'campaign_finding_disposition_unknown_origin',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractCampaignRemediationLedger({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects ledger tampering', () => {
    const ledger = compileRequirementsContractCampaignRemediationLedger(validInput());

    expect(() =>
      validateRequirementsContractCampaignRemediationLedger(
        { ...ledger, originCount: 99 },
        {
          campaignId: ledger.campaignId,
          campaignLineageKey: ledger.campaignLineageKey,
          initialReviewAttemptKey: ledger.initialReviewAttemptKey,
          ledgerHash: ledger.ledgerHash,
        }
      )
    ).toThrow('campaign_finding_ledger_hash_mismatch');
  });
});
