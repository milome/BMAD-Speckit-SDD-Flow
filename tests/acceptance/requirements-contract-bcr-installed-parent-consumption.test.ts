import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  BCR_COMPONENT_RECEIPT_KINDS,
  ingestRequirementsContractBcrReceipts,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bcr-receipt-ingestion';
import { compileRequirementsContractReviewerParentProjection } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reviewer-parent-projection';

type ReceiptKind = (typeof BCR_COMPONENT_RECEIPT_KINDS)[number];

const hash = (label: string) => sha256Stable({ label });
const hosts = ['codex', 'cursor', 'claude'] as const;

function projectionInput(hostId: (typeof hosts)[number]) {
  return {
    actorClass: 'bounded_code_reviewer' as const,
    reviewerProfileId: 'bmad_code_reviewer',
    campaignId: 'judge-review-campaign-001',
    scopeSnapshotPath: 'runtime/reviewer-scope-snapshot.json',
    scopeSnapshotHash: hash('scope'),
    implementationByteManifestHash: hash('implementation'),
    evidenceManifestHash: hash('evidence'),
    allowedEvidenceRefs: ['EVD-002', 'EVD-001'],
    mandatoryCoverageUnits: ['coverage:security', 'coverage:correctness'],
    semanticPromptHash: hash('semantic-prompt'),
    promptTemplateHash: hash('prompt-template'),
    resultSchemaHash: hash('result-schema'),
    policyHash: hash('policy'),
    hostId,
    nativeAgentIdentity: 'code-reviewer' as const,
    componentByteHash: hash('component'),
    resolvedReviewerModelId: 'reviewer-model-current',
    resolvedReviewerProviderFamily: 'provider-family-a',
    readonlyMode: 'read-only',
    invocationOrdinal: 1 as const,
    reviewerAttemptKey: hash(`${hostId}-attempt`),
    expectedReceiptIdentityHash: hash('receipt-identity'),
    currentAuthority: {
      campaignId: 'judge-review-campaign-001',
      scopeSnapshotHash: hash('scope'),
      implementationByteManifestHash: hash('implementation'),
      evidenceManifestHash: hash('evidence'),
      componentByteHash: hash('component'),
    },
  };
}

function componentReceipt(kind: ReceiptKind, projection: ReturnType<typeof compileRequirementsContractReviewerParentProjection>) {
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
  return { ...payload, receiptHash: sha256Stable(payload) };
}

describe('requirements contract BCR installed parent consumption', () => {
  it('keeps all installed hosts on one BCR semantic identity and readonly one-shot behavior', () => {
    const projections = hosts.map((hostId) =>
      compileRequirementsContractReviewerParentProjection(projectionInput(hostId))
    );

    expect(new Set(projections.map((projection) => projection.componentByteHash)).size).toBe(1);
    expect(new Set(projections.map((projection) => projection.scopeSnapshotHash)).size).toBe(1);
    expect(new Set(projections.map((projection) => projection.implementationByteManifestHash)).size).toBe(1);
    expect(projections.map((projection) => projection.readonlyMode)).toEqual([
      'read-only',
      'read-only',
      'read-only',
    ]);
    expect(projections.map((projection) => projection.invocationOrdinal)).toEqual([1, 1, 1]);
  });

  it('lets the parent consume only hash-only component receipts and rejects component verdict substitution', () => {
    const projection = compileRequirementsContractReviewerParentProjection(projectionInput('codex'));
    const ingestion = ingestRequirementsContractBcrReceipts({
      projection,
      receipts: BCR_COMPONENT_RECEIPT_KINDS.map((kind) => componentReceipt(kind, projection)),
      currentComponentByteHash: projection.componentByteHash,
    });

    expect(ingestion.decision).toBe('pass');
    expect(ingestion.componentReceiptHashes.map((entry) => entry.kind)).toEqual(
      BCR_COMPONENT_RECEIPT_KINDS
    );
    expect(JSON.stringify(ingestion)).not.toContain('packageValidationDecision');
    expect(() =>
      ingestRequirementsContractBcrReceipts({
        projection,
        receipts: BCR_COMPONENT_RECEIPT_KINDS.map((kind) => ({
          ...componentReceipt(kind, projection),
          ...(kind === 'identity' ? { peerFinalJudgeOutput: { decision: 'pass' } } : {}),
        })),
        currentComponentByteHash: projection.componentByteHash,
      })
    ).toThrow('bcr_component_peer_output_forbidden');
  });
});
