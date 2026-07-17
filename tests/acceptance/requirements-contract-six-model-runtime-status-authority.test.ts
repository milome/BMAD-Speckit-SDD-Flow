import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveSixModelRuntimeDecision } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { createRuntimeStatusProjectionUpdate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import { main as initializeSixModelRequirementConfirmation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/initialize-six-model-requirement-confirmation';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';

const { resolveAiTddRuntimeDecision } = require(
  '../../packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision'
);

const HASHES = {
  source: `sha256:${'1'.repeat(64)}`,
  confirmation: `sha256:${'2'.repeat(64)}`,
  semanticModel: `sha256:${'3'.repeat(64)}`,
  gate: `sha256:${'4'.repeat(64)}`,
};

function statusReceipt(input: {
  attemptId: string;
  decision?: 'pass' | 'block';
  effectiveStatus?: 'pass' | 'blocked';
}) {
  const payload = {
    schemaVersion: 'requirements-contract-runtime-status-decision-receipt/v1' as const,
    recordId: 'REQ-RUNTIME-STATUS',
    requirementSetId: 'REQ-RUNTIME-STATUS-SET',
    modelId: 'architecture_confirmation',
    implementationAttemptId: input.attemptId,
    sourceDocumentHash: HASHES.source,
    implementationConfirmationHash: HASHES.confirmation,
    semanticModelHash: HASHES.semanticModel,
    stageInputs: [
      {
        role: 'architecture_confirmation',
        path: 'runtime/architecture-confirmation.json',
        hash: HASHES.gate,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'architecture_confirmation_gate',
        path: 'runtime/architecture-confirmation-gate.json',
        hash: HASHES.gate,
      },
    ],
    blockerRefs: input.decision === 'block' ? ['architecture_confirmation_blocked'] : [],
    evidenceRefs: ['runtime/architecture-confirmation-gate.json'],
    authorityClass: 'deterministic_gate',
    decision: input.decision ?? 'pass',
    effectiveStatus: input.effectiveStatus ?? 'pass',
    createdAt: '2026-07-15T00:00:00.000Z',
  };
  return {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
}

function record(input: {
  projectionStatus?: 'pass' | 'blocked';
  projectionAttemptId?: string;
  decisionReceiptHash?: string;
}) {
  const artifact = (path: string, contentHash: string, sourceOfTruthRole: 'control' | 'evidence') => ({
    artifactType:
      sourceOfTruthRole === 'control'
        ? 'runtime_status_decision_receipt'
        : 'runtime_status_bound_evidence',
    sourceOfTruthRole,
    recordId: 'REQ-RUNTIME-STATUS',
    requirementSetId: 'REQ-RUNTIME-STATUS-SET',
    path,
    contentHash,
    producer: 'requirements-contract-six-model-runtime-status-authority.test',
    purpose: `Fixture authority for ${path}.`,
    relatedRequirementIds: ['REQ-RUNTIME-STATUS'],
    status: 'active',
    inputVersion: 'fixture/v1',
    outputVersion: 'fixture/v1',
  });
  return {
    recordId: 'REQ-RUNTIME-STATUS',
    requirementSetId: 'REQ-RUNTIME-STATUS-SET',
    status: 'user_confirmed',
    currentMentalModel: 'architecture_confirmation',
    sourceDocumentHash: HASHES.source,
    implementationConfirmationHash: HASHES.confirmation,
    semanticModelHash: HASHES.semanticModel,
    artifactIndex: [
      artifact(
        'runtime/status/architecture-confirmation.json',
        input.decisionReceiptHash ?? HASHES.gate,
        'control'
      ),
      artifact('runtime/architecture-confirmation.json', HASHES.gate, 'evidence'),
      artifact('runtime/architecture-confirmation-gate.json', HASHES.gate, 'evidence'),
    ],
    sixModelResults: {
      architecture_confirmation: {
        status: input.projectionStatus ?? 'pass',
        currentAttemptId: input.projectionAttemptId ?? 'IMP-CURRENT',
        sourceDocumentHash: HASHES.source,
        implementationConfirmationHash: HASHES.confirmation,
        semanticModelHash: HASHES.semanticModel,
        decisionReceiptRef: 'runtime/status/architecture-confirmation.json',
        decisionReceiptHash: input.decisionReceiptHash ?? HASHES.gate,
      },
    },
  };
}

function resolve(input: {
  requirementRecord: Record<string, unknown>;
  attemptId?: string;
  receipts?: Array<{ path: string; receipt: Record<string, unknown> }>;
}) {
  return resolveSixModelRuntimeDecision({
    record: input.requirementRecord,
    attemptId: input.attemptId ?? 'IMP-CURRENT',
    statusDecisionReceipts: input.receipts ?? [],
  } as never);
}

describe('requirements contract six-model runtime status authority', () => {
  it('creates receipt binding only from a complete authority context', () => {
    const update = createRuntimeStatusProjectionUpdate({
      recordId: 'REQ-RUNTIME-STATUS',
      requirementSetId: 'REQ-RUNTIME-STATUS-SET',
      modelId: 'architecture_confirmation',
      implementationAttemptId: 'IMP-CURRENT',
      sourceDocumentHash: HASHES.source,
      implementationConfirmationHash: HASHES.confirmation,
      semanticModelHash: HASHES.semanticModel,
      stageInputs: [
        {
          role: 'architecture_confirmation',
          path: 'runtime/architecture-confirmation.json',
          hash: HASHES.gate,
        },
      ],
      deterministicGateOutputs: [
        {
          role: 'architecture_confirmation_gate',
          path: 'runtime/architecture-confirmation-gate.json',
          hash: HASHES.gate,
        },
      ],
      blockerRefs: [],
      evidenceRefs: ['runtime/architecture-confirmation-gate.json'],
      authorityClass: 'deterministic_gate',
      decision: 'pass',
      effectiveStatus: 'pass',
      createdAt: '2026-07-15T00:00:00.000Z',
      receiptPath: 'runtime/status/architecture-confirmation.json',
      projection: { status: 'pass', blockingReasons: [] },
    });

    expect(update.authorityEstablished).toBe(true);
    expect(update.receiptRef?.receipt.receiptHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(update.projection).toMatchObject({
      status: 'pass',
      currentAttemptId: 'IMP-CURRENT',
      semanticModelHash: HASHES.semanticModel,
      decisionReceiptRef: 'runtime/status/architecture-confirmation.json',
    });
  });

  it('keeps missing authority context non-authoritative without creating a receipt', () => {
    const update = createRuntimeStatusProjectionUpdate({
      recordId: 'REQ-RUNTIME-STATUS',
      requirementSetId: 'REQ-RUNTIME-STATUS-SET',
      modelId: 'audit_review',
      implementationAttemptId: 'IMP-CURRENT',
      sourceDocumentHash: HASHES.source,
      implementationConfirmationHash: HASHES.confirmation,
      semanticModelHash: '',
      stageInputs: [
        {
          role: 'audit_review_plan',
          path: 'runtime/audit-review-plan.json',
          hash: HASHES.gate,
        },
      ],
      deterministicGateOutputs: [
        {
          role: 'audit_review_gate',
          path: 'runtime/audit-review-report.json',
          hash: HASHES.gate,
        },
      ],
      blockerRefs: [],
      evidenceRefs: ['runtime/audit-review-report.json'],
      authorityClass: 'deterministic_gate',
      decision: 'pass',
      effectiveStatus: 'pass',
      createdAt: '2026-07-15T00:00:00.000Z',
      receiptPath: 'runtime/status/audit-review.json',
      projection: { status: 'pass', blockingReasons: [] },
    });

    expect(update.authorityEstablished).toBe(false);
    expect(update.receiptRef).toBeNull();
    expect(update.projection).toMatchObject({
      status: 'not_established',
      blockingReasons: ['runtime_status_authority_context_missing:semanticModelHash'],
    });
  });

  it('initializes only requirement confirmation with a current receipt', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'requirement_confirmation',
    });
    try {
      const requirementRecord = JSON.parse(
        fs.readFileSync(fixture.recordPath, 'utf8')
      ) as Record<string, any>;
      delete requirementRecord.sixModelResults;
      delete requirementRecord.runtimeStatusDecisionReceipts;
      fs.writeFileSync(
        fixture.recordPath,
        `${JSON.stringify(requirementRecord, null, 2)}\n`,
        'utf8'
      );

      expect(
        initializeSixModelRequirementConfirmation([
          '--cwd',
          fixture.root,
          '--requirement-record',
          fixture.recordPath,
          '--recorded-at',
          '2026-07-15T00:00:00.000Z',
          '--json',
        ])
      ).toBe(0);

      const updated = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      expect(updated.sixModelResults.requirement_confirmation).toMatchObject({
        status: 'pass',
        currentAttemptId: requirementRecord.currentAttemptId,
        semanticModelHash: requirementRecord.semanticModelHash,
        decisionReceiptRef: expect.any(String),
        decisionReceiptHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(updated.runtimeStatusDecisionReceipts).toHaveLength(1);
      expect(updated.runtimeStatusDecisionReceipts[0]).toMatchObject({
        path: updated.sixModelResults.requirement_confirmation.decisionReceiptRef,
        receipt: {
          modelId: 'requirement_confirmation',
          implementationAttemptId: requirementRecord.currentAttemptId,
          receiptHash: updated.sixModelResults.requirement_confirmation.decisionReceiptHash,
        },
      });
      for (const modelId of [
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_confirmation',
      ]) {
        expect(updated.sixModelResults[modelId].status).toBe('not_established');
        expect(updated.sixModelResults[modelId]).not.toHaveProperty('decisionReceiptRef');
      }
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('does not let an explicit sixModelResults PASS advance without a current receipt', () => {
    const decision = resolve({ requirementRecord: record({}) });

    expect(decision.currentModelStatus).toBe('not_established');
    expect(decision.nextAction).toBe('prepare_architecture_confirmation');
    expect(decision.ready).toBe(false);
    expect(decision.transitionMode).toBe('blocked');
  });

  it('advances only when the projection matches one canonical current-attempt receipt', () => {
    const receipt = statusReceipt({ attemptId: 'IMP-CURRENT' });
    const decision = resolve({
      requirementRecord: record({ decisionReceiptHash: receipt.receiptHash }),
      receipts: [
        {
          path: 'runtime/status/architecture-confirmation.json',
          receipt,
        },
      ],
    });

    expect(decision.currentModelStatus).toBe('pass');
    expect(decision.nextAction).toBe('run_implementation_readiness_gate');
    expect(decision.ready).toBe(true);
    expect(decision.transitionMode).toBe('auto_after_controlled_ingest');
  });

  it('rejects a valid receipt from a stale implementation attempt', () => {
    const receipt = statusReceipt({ attemptId: 'IMP-STALE' });
    const decision = resolve({
      requirementRecord: record({ decisionReceiptHash: receipt.receiptHash }),
      receipts: [
        {
          path: 'runtime/status/architecture-confirmation.json',
          receipt,
        },
      ],
    });

    expect(decision.currentModelStatus).toBe('stale');
    expect(decision.nextAction).toBe('prepare_architecture_confirmation');
    expect(decision.ready).toBe(false);
    expect(decision.transitionMode).toBe('blocked');
  });

  it('rejects projection PASS when the canonical receipt decision is BLOCK', () => {
    const receipt = statusReceipt({
      attemptId: 'IMP-CURRENT',
      decision: 'block',
      effectiveStatus: 'blocked',
    });
    const decision = resolve({
      requirementRecord: record({ decisionReceiptHash: receipt.receiptHash }),
      receipts: [
        {
          path: 'runtime/status/architecture-confirmation.json',
          receipt,
        },
      ],
    });

    expect(decision.currentModelStatus).toBe('blocked');
    expect(decision.nextAction).toBe('prepare_architecture_confirmation');
    expect(decision.ready).toBe(false);
    expect(decision.transitionMode).toBe('blocked');
  });

  it('does not infer architecture PASS from a bare architecture hash or active flag', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'architecture_confirmation',
    });
    try {
      const requirementRecord = JSON.parse(
        fs.readFileSync(fixture.recordPath, 'utf8')
      ) as Record<string, any>;
      delete requirementRecord.runtimeStatusDecisionReceipts;
      delete requirementRecord.sixModelResults.architecture_confirmation;
      requirementRecord.architectureConfirmationHash = HASHES.gate;
      requirementRecord.architectureConfirmationState = 'active';
      fs.writeFileSync(
        fixture.recordPath,
        `${JSON.stringify(requirementRecord, null, 2)}\n`,
        'utf8'
      );

      const runtime = resolveAiTddRuntimeDecision(fixture.root, {
        recordId: fixture.recordId,
      });

      expect(
        runtime.primaryRecord.modelStatuses.architecture_confirmation.status
      ).toBe('not_established');
      expect(runtime.primaryRecord.nextSafeAction).not.toBe(
        'implementation-readiness'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
