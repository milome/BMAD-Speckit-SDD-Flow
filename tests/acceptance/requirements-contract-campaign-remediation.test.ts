import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  validateRequirementsContractCampaignRemediationReceipt,
  verifyRequirementsContractCampaignRemediationCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-campaign-deterministic-verification';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function candidate(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    candidateId: 'candidate-a',
    commandExecutions: [
      {
        commandRef: 'CMD-J05-T04D-01',
        exactCommand: 'npm exec --offline -- vitest run --reporter=dot p18',
        inputByteHash: hash('candidate-a:command-input'),
        exitCode: 0,
      },
    ],
    originClosures: [
      { originId: 'origin-a', closureHash: hash('origin-a:closure'), decision: 'pass' },
      { originId: 'origin-b', closureHash: hash('origin-b:closure'), decision: 'pass' },
    ],
    expectedOriginIds: ['origin-a', 'origin-b'],
    sealedFileHashes: [hash('file-a'), hash('file-b')],
    postSealMutationDetected: false,
    ...overrides,
  };
}

describe('requirements contract campaign deterministic verification', () => {
  it('closes every origin with current evidence and produces a schema-valid campaign receipt', () => {
    const result = verifyRequirementsContractCampaignRemediationCandidate(candidate());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-campaign-remediation-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(result.receipt.closedOriginCount).toBe(2);
    expect(result.receipt.mandatoryCommandExecutionCount).toBe(1);
    expect(result.receipt.postSealMutationDetected).toBe(false);
    expect(validate(result.receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractCampaignRemediationReceipt(result.receipt, {
        campaignId: 'goal-campaign-001',
        candidateId: 'candidate-a',
        verificationDagHash: result.verificationDag.verificationDagHash,
        finalizationByteManifestHash: result.finalizationByteManifest.finalizationByteManifestHash,
        campaignRemediationReceiptHash: result.receipt.campaignRemediationReceiptHash,
      })
    ).toBe(result.receipt);
  });

  it('blocks stale, missing, duplicate, failed, and post-seal-mutated candidates', () => {
    expect(() =>
      verifyRequirementsContractCampaignRemediationCandidate(
        candidate({ postSealMutationDetected: true })
      )
    ).toThrow('campaign_remediation_post_seal_mutation');

    expect(() =>
      verifyRequirementsContractCampaignRemediationCandidate(
        candidate({ originClosures: [candidate().originClosures[0]] })
      )
    ).toThrow('verification_dag_origin_missing');

    expect(() =>
      verifyRequirementsContractCampaignRemediationCandidate(
        candidate({
          commandExecutions: [candidate().commandExecutions[0], candidate().commandExecutions[0]],
        })
      )
    ).toThrow('verification_dag_duplicate_command_execution');

    expect(() =>
      verifyRequirementsContractCampaignRemediationCandidate(
        candidate({ commandExecutions: [{ ...candidate().commandExecutions[0], exitCode: 1 }] })
      )
    ).toThrow('verification_dag_command_failed');

    const result = verifyRequirementsContractCampaignRemediationCandidate(candidate());
    expect(() =>
      validateRequirementsContractCampaignRemediationReceipt(result.receipt, {
        campaignId: 'goal-campaign-001',
        candidateId: 'candidate-a',
        verificationDagHash: hash('stale-dag'),
        finalizationByteManifestHash: result.finalizationByteManifest.finalizationByteManifestHash,
        campaignRemediationReceiptHash: result.receipt.campaignRemediationReceiptHash,
      })
    ).toThrow('campaign_remediation_receipt_stale');
  });
});
