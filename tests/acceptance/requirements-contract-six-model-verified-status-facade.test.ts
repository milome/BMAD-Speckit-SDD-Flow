import { describe, expect, it } from 'vitest';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import {
  resolveVerifiedSixModelPanorama,
  resolveVerifiedSixModelStatus,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/verified-six-model-status-facade';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function authorityRecord() {
  const record = {
    recordId: 'REQ-FACADE',
    requirementSetId: 'REQSET-FACADE',
    currentAttemptId: 'IMP-CURRENT',
    sourceDocumentHash: hash('1'),
    implementationConfirmationHash: hash('2'),
    semanticModelHash: hash('3'),
    sixModelResults: {},
    runtimeStatusDecisionReceipts: [],
    artifactIndex: [],
  };
  const update = createRuntimeStatusProjectionUpdate({
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    modelId: 'architecture_confirmation',
    implementationAttemptId: record.currentAttemptId,
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
    semanticModelHash: record.semanticModelHash,
    stageInputs: [{ role: 'page', path: 'evidence/page.json', hash: hash('4') }],
    deterministicGateOutputs: [{ role: 'gate', path: 'evidence/gate.json', hash: hash('5') }],
    blockerRefs: [],
    evidenceRefs: ['evidence/gate.json'],
    authorityClass: 'controlled_confirmation',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: '2026-07-15T00:00:00.000Z',
    receiptPath: 'evidence/status/architecture-confirmation.json',
    projection: { status: 'pass' },
  });
  const artifact = (
    artifactType: string,
    sourceOfTruthRole: 'control' | 'evidence',
    artifactPath: string,
    contentHash: string
  ) => ({
    artifactType,
    sourceOfTruthRole,
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    path: artifactPath,
    contentHash,
    producer: 'requirements-contract-six-model-verified-status-facade.test',
    purpose: `Fixture authority for ${artifactPath}.`,
    relatedRequirementIds: [record.recordId],
    status: 'active',
    inputVersion: 'fixture/v1',
    outputVersion: 'fixture/v1',
  });
  return {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'architecture_confirmation',
      update,
    }),
    artifactIndex: [
      artifact(
        'runtime_status_decision_receipt',
        'control',
        update.receiptRef!.path,
        update.receiptRef!.receipt.receiptHash
      ),
      artifact('runtime_status_stage_input', 'evidence', 'evidence/page.json', hash('4')),
      artifact('runtime_status_gate_output', 'evidence', 'evidence/gate.json', hash('5')),
    ],
  };
}

describe('verified six-model status facade', () => {
  it('returns complete current-receipt authority and preserves fixed panorama order', () => {
    const record = authorityRecord();
    const status = resolveVerifiedSixModelStatus({
      record,
      modelId: 'architecture_confirmation',
      currentImplementationAttemptId: 'IMP-CURRENT',
    });

    expect(status).toMatchObject({
      effectiveStatus: 'pass',
      projectionStatus: 'pass',
      projectionIntegrity: 'valid',
      authorityClass: 'controlled_confirmation',
      currentAttemptId: 'IMP-CURRENT',
      blockerRefs: [],
      evidenceRefs: ['evidence/gate.json'],
    });
    expect(status.decisionReceiptRef).toBe('evidence/status/architecture-confirmation.json');
    expect(status.decisionReceiptHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(
      resolveVerifiedSixModelPanorama({
        record,
        currentImplementationAttemptId: 'IMP-CURRENT',
      }).map((entry) => entry.modelId)
    ).toEqual([
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_confirmation',
    ]);
  });

  it('fails closed for missing, stale, mismatched, and blocked authority', () => {
    const missing = authorityRecord();
    missing.runtimeStatusDecisionReceipts = [];
    expect(
      resolveVerifiedSixModelStatus({
        record: missing,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'not_established',
      projectionIntegrity: 'missing',
      blockerRefs: ['runtime_status_decision_receipt_missing'],
    });

    const stale = authorityRecord();
    expect(
      resolveVerifiedSixModelStatus({
        record: stale,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-NEW',
      })
    ).toMatchObject({
      effectiveStatus: 'stale',
      projectionIntegrity: 'stale',
      blockerRefs: expect.arrayContaining(['runtime_status_receipt_attempt_stale']),
    });

    const mismatch = authorityRecord();
    mismatch.sixModelResults.architecture_confirmation.status = 'blocked';
    expect(
      resolveVerifiedSixModelStatus({
        record: mismatch,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'mismatch',
      blockerRefs: expect.arrayContaining(['runtime_status_projection_decision_mismatch']),
    });
  });

  it('fails closed when canonical receipt or gate artifacts are absent or hash-mismatched', () => {
    const missingReceiptArtifact = authorityRecord();
    missingReceiptArtifact.artifactIndex = missingReceiptArtifact.artifactIndex.filter(
      (artifact) => artifact.artifactType !== 'runtime_status_decision_receipt'
    );
    expect(
      resolveVerifiedSixModelStatus({
        record: missingReceiptArtifact,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'invalid',
      blockerRefs: ['runtime_status_receipt_artifact_missing'],
    });

    const mismatchedGateArtifact = authorityRecord();
    const gateArtifact = mismatchedGateArtifact.artifactIndex.find(
      (artifact) => artifact.path === 'evidence/gate.json'
    );
    gateArtifact!.contentHash = hash('9');
    expect(
      resolveVerifiedSixModelStatus({
        record: mismatchedGateArtifact,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'invalid',
      blockerRefs: ['runtime_status_bound_artifact_hash_mismatch:evidence/gate.json'],
    });
  });
});
