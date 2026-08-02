import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractFinalScopeManifest,
  validateRequirementsContractFinalScopeManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-scope-compiler';
import {
  compileRequirementsContractJudgeFinalIntegrationLineage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-final-integration-lineage';
import { compileRequirementsContractJudgeReviewCampaignController } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign';
import { compileRequirementsContractJudgeReviewCampaignTrace } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });
const p29PartitionId =
  'partition-edfcf2b359429b72ab86a9d6f380b0258be7dd576a4a9699cab599c5d39a0e39';
const p30PartitionId =
  'partition-128b694a1d517dcedcc177c893135fae232f314021a3ac0ab41d2148142eacfb';
const governedPathAllowlist = [
  'tests/acceptance/requirements-contract-judge-release-gate.test.ts',
  'tests/acceptance/requirements-contract-judge-review-campaign-integration.test.ts',
];
const governedBytes = governedPathAllowlist.map((path, index) => ({
  path,
  hash: hash(`release-governed-${index}`),
}));

function trace(mode: 'clean' | 'remediated') {
  return compileRequirementsContractJudgeReviewCampaignTrace({
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('initial-attempt'),
    mode,
    blindReviewAggregateHash: hash(`${mode}-blind-aggregate`),
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

function lineage() {
  const campaignController = controller();
  return compileRequirementsContractJudgeFinalIntegrationLineage({
    currentAuthority: {
      current: true,
      stale: false,
      decision: 'pass',
      partitionId: p30PartitionId,
      partitionPlanHash: 'sha256:5bc86c978dc1d578b23fb2ebbaba554b5c9a49040b4f18b198e0b87072ebb917',
      partitionSetHash: 'sha256:b35d623219de9a11e593346c808fc0ff3dcc529c1c0a9df2a4bfe23db948ba7a',
      selectionSetHash: 'sha256:4e87fbfbbdac42a18ce5a9b26043dfd0488e906b94618dafb51669a2acc8a7c0',
      sourceAuthorityBundleHash:
        'sha256:f9e3a57b16dabac7be0ed7ff0f0206054eac613753d4c4fd4f82caf5102581c2',
      sourceCompositionPolicyHash:
        'sha256:17fcc53cb7962f2c4f8b160b27566099520ce06ceae9944230c0079cfe560fdf',
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('initial-attempt'),
      controllerHash: campaignController.controllerHash,
      governedPathAllowlist,
      governedByteManifestHash: sha256Stable({ partitionId: p30PartitionId, governedBytes }),
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
  });
}

function childClosure(partitionId: string, seed: string) {
  return {
    partitionId,
    decision: 'pass',
    childContractHash: hash(`${seed}-contract`),
    receiptHash: hash(`${seed}-receipt`),
    governedFileManifestHash: hash(`${seed}-governed-files`),
    subcontractEvidenceHash: hash(`${seed}-evidence`),
    productionReachabilityReceiptHash: hash(`${seed}-reachability`),
    dependencyClosureHash: hash(`${seed}-dependency`),
  };
}

describe('requirements contract Judge release gate', () => {
  it('closes only through package-owned final scope while reporting product EffectivePass separately', () => {
    const currentLineage = lineage();
    const scope = compileRequirementsContractFinalScopeManifest({
      campaignId: 'goal-campaign-001',
      attemptId: 'goal-closure-attempt-001',
      expectedPartitionIds: [p29PartitionId, p30PartitionId],
      partitionManifestHash: currentLineage.partitionPlanHash,
      partitionSetHash: currentLineage.partitionSetHash,
      sourceAuthorityBundleHash: currentLineage.sourceAuthorityBundleHash,
      sourceCompositionPolicyHash: currentLineage.sourceCompositionPolicyHash,
      currentImplementationLineage: {
        decision: 'pass',
        current: true,
        stale: false,
        partitionManifestHash: currentLineage.partitionPlanHash,
        partitionSetHash: currentLineage.partitionSetHash,
        implementationLineageHash: currentLineage.lineageHash,
      },
      childClosureReceipts: [
        childClosure(p29PartitionId, 'p29'),
        childClosure(p30PartitionId, 'p30'),
      ],
      governedPathRefs: governedPathAllowlist,
      taskReportProvenanceRefs: ['task-report:p30'],
      priorFindingRefs: ['prior-finding:closed'],
      deliverySurfaceRefs: ['delivery-surface:judge-review-campaign'],
      policyRefs: ['policy:goal-closure-owned-by-package'],
    });

    expect(currentLineage.decision).toBe('pass');
    expect(currentLineage.installedJourneyReceiptHash).toBeTruthy();
    expect(currentLineage.finalJudgeRole).toBe('final_acceptance_judge');
    expect(scope.implementationLineageHash).toBe(currentLineage.lineageHash);
    expect(scope.childClosureCount).toBe(2);
    expect(
      validateRequirementsContractFinalScopeManifest(scope, {
        campaignId: scope.campaignId,
        attemptId: scope.attemptId,
        partitionManifestHash: scope.partitionManifestHash,
        partitionSetHash: scope.partitionSetHash,
        implementationLineageHash: scope.implementationLineageHash,
        campaignLineageKey: scope.campaignLineageKey,
        scopeManifestHash: scope.scopeManifestHash,
      })
    ).toBe(scope);
  });

  it('rejects product EffectivePass as a substitute for package Goal closure authority', () => {
    const currentLineage = lineage();

    expect(() =>
      compileRequirementsContractFinalScopeManifest({
        campaignId: 'goal-campaign-001',
        attemptId: 'goal-closure-attempt-001',
        expectedPartitionIds: [p29PartitionId, p30PartitionId],
        partitionManifestHash: currentLineage.partitionPlanHash,
        partitionSetHash: currentLineage.partitionSetHash,
        sourceAuthorityBundleHash: currentLineage.sourceAuthorityBundleHash,
        sourceCompositionPolicyHash: currentLineage.sourceCompositionPolicyHash,
        currentImplementationLineage: {
          decision: 'pass',
          current: true,
          stale: false,
          partitionManifestHash: currentLineage.partitionPlanHash,
          partitionSetHash: currentLineage.partitionSetHash,
          implementationLineageHash: currentLineage.lineageHash,
        },
        childClosureReceipts: [
          childClosure(p29PartitionId, 'p29'),
          childClosure(p30PartitionId, 'p30'),
        ],
        governedPathRefs: governedPathAllowlist,
        taskReportProvenanceRefs: ['task-report:p30'],
        deliverySurfaceRefs: ['delivery-surface:judge-review-campaign'],
        policyRefs: ['policy:goal-closure-owned-by-package'],
        fallbackEffectivePass: currentLineage.installedJourneyReceiptHash,
      })
    ).toThrow('campaign_scope_forbidden_authority_field');
  });
});
