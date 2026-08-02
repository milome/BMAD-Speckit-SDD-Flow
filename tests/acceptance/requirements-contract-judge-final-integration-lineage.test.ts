import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractJudgeFinalIntegrationLineage,
  validateRequirementsContractJudgeFinalIntegrationLineage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-final-integration-lineage';
import { compileRequirementsContractJudgeReviewCampaignController } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign';
import { compileRequirementsContractJudgeReviewCampaignTrace } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });
const partitionId = 'partition-edfcf2b359429b72ab86a9d6f380b0258be7dd576a4a9699cab599c5d39a0e39';
const governedPathAllowlist = [
  'packages/bmad-speckit/tests/judge-runtime-installed-parity.test.js',
  'tests/acceptance/requirements-contract-judge-final-integration-lineage.test.ts',
  'tests/acceptance/requirements-contract-judge-installed-journey.test.ts',
];
const governedBytes = governedPathAllowlist.map((path, index) => ({
  path,
  hash: hash(`governed-byte-${index}`),
}));
const governedByteManifestHash = sha256Stable({ partitionId, governedBytes });

function trace(mode: 'clean' | 'remediated') {
  return compileRequirementsContractJudgeReviewCampaignTrace({
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('initial-attempt'),
    mode,
    blindReviewAggregateHash: hash('blind-aggregate'),
    remediationLedgerHash: mode === 'remediated' ? hash('remediation-ledger') : null,
    repairTransactionManifestHash: mode === 'remediated' ? hash('repair-manifest') : null,
    remediationBaselineHash: mode === 'remediated' ? hash('baseline') : null,
    remediationJournalHash: mode === 'remediated' ? hash('journal') : null,
    remediationVerificationHash: mode === 'remediated' ? hash('verification') : null,
    publicationReceiptHash: mode === 'remediated' ? hash('publication') : null,
    finalizationByteManifestHash: mode === 'remediated' ? hash('final-bytes') : null,
    finalRejudgeInputHash: mode === 'remediated' ? hash('rejudge') : null,
    finalAcceptanceStateHash: hash(`final-state-${mode}`),
    effectivePassReceiptHash: hash(`effective-pass-${mode}`),
    transitionReceiptHashes: [hash(`transition-${mode}`)],
    originReceiptHashes: [hash('origin-a')],
    repairUnitReceiptHashes: mode === 'remediated' ? [hash('unit-a'), hash('unit-b')] : [],
    deterministicRetryReceiptHashes: mode === 'remediated' ? [hash('retry-a')] : [],
  });
}

function controller() {
  return compileRequirementsContractJudgeReviewCampaignController({
    campaignInputHash: hash('campaign-input'),
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('initial-attempt'),
    cleanTrace: trace('clean'),
    remediatedTrace: trace('remediated'),
    modelDiversityReceiptHash: hash('model-diversity'),
    mandatoryPortfolioHash: hash('portfolio'),
  });
}

function baseInput(overrides = {}) {
  const campaignController = controller();
  return {
    currentAuthority: {
      current: true,
      stale: false,
      decision: 'pass',
      partitionId,
      partitionPlanHash: 'sha256:5bc86c978dc1d578b23fb2ebbaba554b5c9a49040b4f18b198e0b87072ebb917',
      partitionSetHash: 'sha256:b35d623219de9a11e593346c808fc0ff3dcc529c1c0a9df2a4bfe23db948ba7a',
      selectionSetHash: 'sha256:5887799354734fc5b82491e7ba705ce322c0d7a6c6fd1dce9af520c6b37a0f06',
      sourceAuthorityBundleHash:
        'sha256:f9e3a57b16dabac7be0ed7ff0f0206054eac613753d4c4fd4f82caf5102581c2',
      sourceCompositionPolicyHash:
        'sha256:17fcc53cb7962f2c4f8b160b27566099520ce06ceae9944230c0079cfe560fdf',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('initial-attempt'),
      controllerHash: campaignController.controllerHash,
      governedPathAllowlist,
      governedByteManifestHash,
    },
    installedJourneyReceipt: {
      decision: 'pass',
      receiptHash: hash('installed-journey'),
      semanticCounts: { clean: 2, remediated: 3 },
      requirementsCallCountPerUnchangedSnapshot: 1,
      checkoutFallbackUsed: false,
    },
    judgeReviewCampaignController: campaignController,
    finalJudgeRole: 'final_acceptance_judge',
    governedBytes,
    ...overrides,
  };
}

describe('requirements contract judge final integration lineage', () => {
  it('binds installed judge journey, campaign controller, final judge role, and governed bytes', () => {
    const receipt = compileRequirementsContractJudgeFinalIntegrationLineage(baseInput());

    expect(receipt).toMatchObject({
      schemaVersion: 'requirements-contract-judge-final-integration-lineage/v1',
      partitionId,
      installedSemanticCounts: { clean: 2, remediated: 3 },
      requirementsCallCountPerUnchangedSnapshot: 1,
      checkoutFallbackUsed: false,
      finalJudgeRole: 'final_acceptance_judge',
      decision: 'pass',
    });
    expect(receipt.governedBytes.map((ref) => ref.path)).toEqual([...governedPathAllowlist].sort());
    expect(
      validateRequirementsContractJudgeFinalIntegrationLineage(receipt, {
        partitionId,
        partitionPlanHash: receipt.partitionPlanHash,
        partitionSetHash: receipt.partitionSetHash,
        selectionSetHash: receipt.selectionSetHash,
        sourceAuthorityBundleHash: receipt.sourceAuthorityBundleHash,
        sourceCompositionPolicyHash: receipt.sourceCompositionPolicyHash,
        campaignId: receipt.campaignId,
        campaignLineageKey: receipt.campaignLineageKey,
        controllerHash: receipt.controllerHash,
        lineageHash: receipt.lineageHash,
        governedByteRefs: receipt.governedBytes.map((ref) => `${ref.path}:${ref.hash}`),
      })
    ).toBe(receipt);
  });

  it('fails closed for stale, missing, duplicate, replayed, and non-governed product bytes', () => {
    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({ currentAuthority: { ...baseInput().currentAuthority, stale: true } })
      )
    ).toThrow('judge_final_integration_lineage_stale');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({ governedBytes: governedBytes.slice(0, 2) })
      )
    ).toThrow('judge_final_integration_lineage_governed_bytes_missing');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({ governedBytes: [governedBytes[0], governedBytes[0], governedBytes[2]] })
      )
    ).toThrow('judge_final_integration_lineage_governed_byte_duplicate');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({
          governedBytes: [
            governedBytes[0],
            { ...governedBytes[1], hash: governedBytes[0].hash },
            governedBytes[2],
          ],
        })
      )
    ).toThrow('judge_final_integration_lineage_governed_byte_replayed');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({
          governedBytes: [
            governedBytes[0],
            governedBytes[1],
            { path: 'tests/acceptance/unowned-product-change.test.ts', hash: hash('outside') },
          ],
        })
      )
    ).toThrow('judge_final_integration_lineage_non_governed_product_change');
  });

  it('rejects checkout fallback, semantic count drift, role substitution, and caller authority', () => {
    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({
          installedJourneyReceipt: {
            decision: 'pass',
            receiptHash: hash('installed-journey'),
            semanticCounts: { clean: 2, remediated: 3 },
            requirementsCallCountPerUnchangedSnapshot: 1,
            checkoutFallbackUsed: true,
          },
        })
      )
    ).toThrow('judge_final_integration_lineage_checkout_fallback_forbidden');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({
          installedJourneyReceipt: {
            decision: 'pass',
            receiptHash: hash('installed-journey'),
            semanticCounts: { clean: 2, remediated: 4 },
            requirementsCallCountPerUnchangedSnapshot: 1,
            checkoutFallbackUsed: false,
          },
        })
      )
    ).toThrow('judge_final_integration_lineage_semantic_counts_invalid');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({ finalJudgeRole: 'requirements_critical_auditor' })
      )
    ).toThrow('judge_final_integration_lineage_final_judge_role_invalid');

    expect(() =>
      compileRequirementsContractJudgeFinalIntegrationLineage(
        baseInput({ callerEffectivePass: true })
      )
    ).toThrow('judge_final_integration_lineage_authority_injection');
  });
});
