import { describe, expect, it } from 'vitest';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
  validateRuntimeStatusDecisionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function input(semanticModelHash = hash('3')) {
  return {
    recordId: 'REQ-TRANSACTION',
    requirementSetId: 'REQSET-TRANSACTION',
    modelId: 'implementation_readiness' as const,
    implementationAttemptId: 'IMP-TRANSACTION',
    sourceDocumentHash: hash('1'),
    implementationConfirmationHash: hash('2'),
    semanticModelHash,
    stageInputs: [{ role: 'input', path: 'evidence/input.json', hash: hash('4') }],
    deterministicGateOutputs: [{ role: 'gate', path: 'evidence/gate.json', hash: hash('5') }],
    blockerRefs: [],
    evidenceRefs: ['evidence/gate.json'],
    authorityClass: 'deterministic_gate' as const,
    decision: 'pass' as const,
    effectiveStatus: 'pass' as const,
    createdAt: '2026-07-15T00:00:00.000Z',
    receiptPath: 'evidence/status/implementation-readiness.json',
    projection: { status: 'pass' },
  };
}

describe('six-model receipt to projection transaction', () => {
  it('creates the immutable receipt before exposing the bound PASS projection', () => {
    const update = createRuntimeStatusProjectionUpdate(input());

    expect(update.authorityEstablished).toBe(true);
    expect(update.receiptRef).not.toBeNull();
    expect(validateRuntimeStatusDecisionReceipt(update.receiptRef?.receipt)).toBe(true);
    expect(update.projection).toMatchObject({
      status: 'pass',
      currentAttemptId: 'IMP-TRANSACTION',
      decisionReceiptRef: 'evidence/status/implementation-readiness.json',
      decisionReceiptHash: update.receiptRef?.receipt.receiptHash,
    });

    const patch = runtimeStatusProjectionRecordPatch({
      record: { sixModelResults: {}, runtimeStatusDecisionReceipts: [] },
      modelId: 'implementation_readiness',
      update,
    });
    expect(patch.runtimeStatusDecisionReceipts).toEqual([update.receiptRef]);
    expect(patch.sixModelResults.implementation_readiness).toEqual(update.projection);
    expect(patch.artifactIndex).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'runtime_status_decision_receipt',
          path: 'evidence/status/implementation-readiness.json',
          contentHash: update.receiptRef?.receipt.receiptHash,
          status: 'active',
        }),
        expect.objectContaining({
          artifactType: 'runtime_status_stage_input',
          path: 'evidence/input.json',
          contentHash: hash('4'),
          status: 'active',
        }),
        expect.objectContaining({
          artifactType: 'runtime_status_deterministic_gate_output',
          path: 'evidence/gate.json',
          contentHash: hash('5'),
          status: 'active',
        }),
      ])
    );
  });

  it('does not fabricate a receipt or authoritative PASS from incomplete bindings', () => {
    const update = createRuntimeStatusProjectionUpdate(input(''));

    expect(update.authorityEstablished).toBe(false);
    expect(update.receiptRef).toBeNull();
    expect(update.projection).toMatchObject({
      status: 'not_established',
      blockingReasons: ['runtime_status_authority_context_missing:semanticModelHash'],
    });
  });

  it('rejects receipt mutation after publication', () => {
    const update = createRuntimeStatusProjectionUpdate(input());
    const mutated = {
      ...update.receiptRef?.receipt,
      effectiveStatus: 'blocked',
    };

    expect(validateRuntimeStatusDecisionReceipt(mutated)).toBe(false);
  });
});
