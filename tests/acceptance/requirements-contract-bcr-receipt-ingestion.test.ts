import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  BCR_COMPONENT_RECEIPT_KINDS,
  ingestRequirementsContractBcrReceipts,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bcr-receipt-ingestion';
import { compileRequirementsContractReviewerParentProjection } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reviewer-parent-projection';

type ReceiptKind = (typeof BCR_COMPONENT_RECEIPT_KINDS)[number];

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function reviewerProjectionInput() {
  return {
    actorClass: 'bounded_code_reviewer' as const,
    reviewerProfileId: 'bmad_code_reviewer',
    campaignId: 'judge-review-campaign-001',
    scopeSnapshotPath: 'runtime/reviewer-scope-snapshot.json',
    scopeSnapshotHash: hash('a'),
    implementationByteManifestHash: hash('b'),
    evidenceManifestHash: hash('c'),
    allowedEvidenceRefs: ['EVD-002', 'EVD-001'],
    mandatoryCoverageUnits: ['coverage:security', 'coverage:correctness'],
    semanticPromptHash: hash('d'),
    promptTemplateHash: hash('e'),
    resultSchemaHash: hash('f'),
    policyHash: hash('1'),
    hostId: 'codex' as const,
    nativeAgentIdentity: 'code-reviewer' as const,
    componentByteHash: hash('2'),
    resolvedReviewerModelId: 'reviewer-model-current',
    resolvedReviewerProviderFamily: 'provider-family-a',
    readonlyMode: 'read-only',
    invocationOrdinal: 1 as const,
    reviewerAttemptKey: hash('3'),
    expectedReceiptIdentityHash: hash('4'),
    currentAuthority: {
      campaignId: 'judge-review-campaign-001',
      scopeSnapshotHash: hash('a'),
      implementationByteManifestHash: hash('b'),
      evidenceManifestHash: hash('c'),
      componentByteHash: hash('2'),
    },
  };
}

function componentReceipt(kind: ReceiptKind) {
  const projection = compileRequirementsContractReviewerParentProjection(reviewerProjectionInput());
  const payload = {
    schemaVersion: `requirements-contract-bcr-${kind}-receipt/v1`,
    kind,
    componentAuthority: 'BCR',
    reviewerIdentity: 'bmad_code_reviewer',
    campaignId: projection.campaignId,
    scopeSnapshotHash: projection.scopeSnapshotHash,
    componentByteHash: projection.componentByteHash,
    invocationOrdinal: 1,
    nativeAgentIdentity: 'code-reviewer',
    readonlyMode: 'read-only',
    packageValidationDecision: 'pass',
    observedCoverageUnits: kind === 'coverage' ? projection.mandatoryCoverageUnits : [],
    carrierMode: kind === 'dispatch' ? 'native' : 'not_applicable',
    terminalStatus: kind === 'terminal' ? 'completed' : 'not_applicable',
    installedParityDecision: kind === 'installed_parity' ? 'pass' : 'not_applicable',
  };
  return {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
}

function validReceipts() {
  return BCR_COMPONENT_RECEIPT_KINDS.map(componentReceipt);
}

describe('requirements contract BCR receipt ingestion', () => {
  it('ingests exactly the package-validated component receipt set by hash', () => {
    const projection =
      compileRequirementsContractReviewerParentProjection(reviewerProjectionInput());
    const result = ingestRequirementsContractBcrReceipts({
      projection,
      receipts: [...validReceipts()].reverse(),
      currentComponentByteHash: projection.componentByteHash,
    });

    expect(result.componentReceiptHashes.map((entry) => entry.kind)).toEqual(
      BCR_COMPONENT_RECEIPT_KINDS
    );
    expect(result.componentReceiptHashes).toHaveLength(5);
    expect(JSON.stringify(result)).not.toContain('packageValidationDecision');
    expect(JSON.stringify(result)).not.toContain('componentDecision');
  });

  it.each([
    ['missing', 'bcr_component_receipt_missing'],
    ['unknown-kind', 'bcr_component_receipt_kind_unknown'],
    ['duplicate', 'bcr_component_receipt_duplicate'],
    ['identity', 'bcr_component_identity_mismatch'],
    ['coverage', 'bcr_component_coverage_mismatch'],
    ['peer-output', 'bcr_component_peer_output_forbidden'],
    ['stale-bytes', 'bcr_component_bytes_stale'],
    ['ordinal', 'bcr_component_invocation_ordinal_invalid'],
    ['campaign', 'bcr_component_campaign_replay'],
    ['fallback', 'bcr_component_fallback_forbidden'],
    ['tamper', 'bcr_component_receipt_hash_mismatch'],
  ])('rejects %s receipt input with stable code', (kind, code) => {
    const projection =
      compileRequirementsContractReviewerParentProjection(reviewerProjectionInput());
    const receipts = validReceipts() as Array<Record<string, any>>;
    if (kind === 'missing') receipts.pop();
    if (kind === 'unknown-kind') receipts[0].kind = 'verdict';
    if (kind === 'duplicate') receipts[1].kind = receipts[0].kind;
    if (kind === 'identity') receipts[0].reviewerIdentity = 'generic-reviewer';
    if (kind === 'coverage') {
      receipts.find((entry) => entry.kind === 'coverage')!.observedCoverageUnits = [
        'coverage:security',
      ];
    }
    if (kind === 'peer-output') receipts[0].peerFinalJudgeOutput = {};
    if (kind === 'stale-bytes') receipts[0].componentByteHash = `sha256:${'0'.repeat(64)}`;
    if (kind === 'ordinal') receipts[0].invocationOrdinal = 2;
    if (kind === 'campaign') receipts[0].campaignId = 'other-campaign';
    if (kind === 'fallback') {
      receipts.find((entry) => entry.kind === 'dispatch')!.carrierMode = 'fallback';
    }
    if (kind === 'tamper') receipts[0].receiptHash = `sha256:${'0'.repeat(64)}`;

    expect(() =>
      ingestRequirementsContractBcrReceipts({
        projection,
        receipts,
        currentComponentByteHash: projection.componentByteHash,
      })
    ).toThrow(code);
  });
});
