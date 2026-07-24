import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateCriticalAuditorReceiptBindingSequence,
  validateCriticalAuditorReceiptBinding,
  type CriticalAuditorReceiptBindingExpectation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

type JsonRecord = Record<string, unknown>;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
    .join(',')}}`;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function freshHash(label: string): string {
  return sha256Json({ label, nonce: randomUUID() });
}

function resignReceipt(receipt: JsonRecord): JsonRecord {
  const unsigned = { ...receipt };
  delete unsigned.receiptHash;
  return {
    ...unsigned,
    receiptHash: sha256Json(unsigned),
  };
}

function createRoundFixture(roundIndex: number, shared?: Partial<CriticalAuditorReceiptBindingExpectation>) {
  const expectation: CriticalAuditorReceiptBindingExpectation = {
    roundIndex,
    transactionId: shared?.transactionId ?? `tx-${randomUUID()}`,
    namespaceVersion: shared?.namespaceVersion ?? `namespace-${randomUUID()}`,
    auditInputHash: shared?.auditInputHash ?? freshHash('audit-input'),
    recordId: shared?.recordId ?? `record-${randomUUID()}`,
    sourceDocumentHash: shared?.sourceDocumentHash ?? freshHash('source-document'),
    semanticModelHash: shared?.semanticModelHash ?? freshHash('semantic-model'),
    implementationConfirmationHash:
      shared?.implementationConfirmationHash ?? freshHash('implementation-confirmation'),
    packetHash: shared?.packetHash ?? freshHash('packet'),
    projectionSetHash: shared?.projectionSetHash ?? freshHash('projection-set'),
    requestHash: freshHash(`request-${roundIndex}`),
    gateDryRunHash: freshHash(`gate-dry-run-${roundIndex}`),
  };
  const response: JsonRecord = {
    schemaVersion: 'critical-auditor-round-response/v1',
    roundIndex,
    transactionId: expectation.transactionId,
    namespaceVersion: expectation.namespaceVersion,
    requestHash: expectation.requestHash,
    gateDryRunHash: expectation.gateDryRunHash,
    sourceDocumentHash: expectation.sourceDocumentHash,
    semanticModelHash: expectation.semanticModelHash,
    implementationConfirmationHash: expectation.implementationConfirmationHash,
    packetHash: expectation.packetHash,
    projectionSetHash: expectation.projectionSetHash,
    verdict: 'no_new_valid_gap',
    reviewedProjectionRefs: [`projection-${randomUUID()}`],
  };
  const receipt = resignReceipt({
    schemaVersion: 'critical-auditor-receipt/v1',
    roundIndex,
    transactionId: expectation.transactionId,
    namespaceVersion: expectation.namespaceVersion,
    recordId: expectation.recordId,
    inputHash: expectation.auditInputHash,
    sourceDocumentHash: expectation.sourceDocumentHash,
    semanticModelHash: expectation.semanticModelHash,
    implementationConfirmationHash: expectation.implementationConfirmationHash,
    packetHash: expectation.packetHash,
    contentHash: expectation.packetHash,
    projectionSetHash: expectation.projectionSetHash,
    requestHash: expectation.requestHash,
    gateDryRunHash: expectation.gateDryRunHash,
    responseHash: sha256Json(response),
    independentProviderEvidence: {
      providerRunId: `provider-${randomUUID()}`,
    },
    convergenceDecision: {
      verdict: 'no_new_valid_gap',
      resetsConvergenceCounter: false,
    },
  });
  return { expectation, response, receipt };
}

function sharedExpectation(): Partial<CriticalAuditorReceiptBindingExpectation> {
  return {
    transactionId: `tx-${randomUUID()}`,
    namespaceVersion: `namespace-${randomUUID()}`,
    auditInputHash: freshHash('audit-input'),
    recordId: `record-${randomUUID()}`,
    sourceDocumentHash: freshHash('source-document'),
    semanticModelHash: freshHash('semantic-model'),
    implementationConfirmationHash: freshHash('implementation-confirmation'),
    packetHash: freshHash('packet'),
    projectionSetHash: freshHash('projection-set'),
  };
}

describe('Critical Auditor receipt binding', () => {
  it('accepts three current response-bound receipts as one consecutive sequence', () => {
    const shared = sharedExpectation();
    const rounds = [1, 2, 3].map((roundIndex) => createRoundFixture(roundIndex, shared));

    const result = evaluateCriticalAuditorReceiptBindingSequence(rounds);

    expect(result).toMatchObject({
      ok: true,
      consecutiveValidNoNewGapRounds: 3,
      issueCodes: [],
    });
    expect(result.latestReceiptHash).toBe(rounds[2].receipt.receiptHash);
  });

  it('rejects a provider run replay across otherwise current rounds', () => {
    const shared = sharedExpectation();
    const rounds = [1, 2, 3].map((roundIndex) => createRoundFixture(roundIndex, shared));
    const firstEvidence = rounds[0].receipt.independentProviderEvidence as JsonRecord;
    rounds[1].receipt = resignReceipt({
      ...rounds[1].receipt,
      independentProviderEvidence: {
        ...(rounds[1].receipt.independentProviderEvidence as JsonRecord),
        providerRunId: firstEvidence.providerRunId,
      },
    });

    const result = evaluateCriticalAuditorReceiptBindingSequence(rounds);

    expect(result.ok).toBe(false);
    expect(result.issueCodes).toContain('critical_auditor_cross_round_replay_detected');
  });

  it('rejects a missing receipt or response artifact', () => {
    const fixture = createRoundFixture(1);

    expect(
      validateCriticalAuditorReceiptBinding({
        ...fixture,
        receipt: null,
      }).issueCodes
    ).toContain('critical_auditor_receipt_missing');
    expect(
      validateCriticalAuditorReceiptBinding({
        ...fixture,
        response: null,
      }).issueCodes
    ).toContain('critical_auditor_response_artifact_missing');
  });

  it.each([undefined, null, ''])('rejects a missing or null responseHash: %s', (responseHash) => {
    const fixture = createRoundFixture(1);
    const receipt = resignReceipt({
      ...fixture.receipt,
      responseHash,
    });

    const result = validateCriticalAuditorReceiptBinding({
      ...fixture,
      receipt,
    });

    expect(result.issueCodes).toContain('critical_auditor_receipt_response_hash_missing');
  });

  it('rejects a fabricated responseHash even when the receipt is re-signed', () => {
    const fixture = createRoundFixture(1);
    const receipt = resignReceipt({
      ...fixture.receipt,
      responseHash: freshHash('fabricated-response'),
    });

    const result = validateCriticalAuditorReceiptBinding({
      ...fixture,
      receipt,
    });

    expect(result.issueCodes).toContain('critical_auditor_receipt_response_hash_mismatch');
  });

  it.each([
    ['transactionId', 'critical_auditor_receipt_transaction_id_mismatch'],
    ['semanticModelHash', 'critical_auditor_receipt_semantic_model_hash_mismatch'],
    ['packetHash', 'critical_auditor_receipt_packet_hash_mismatch'],
    ['requestHash', 'critical_auditor_receipt_request_hash_mismatch'],
    ['gateDryRunHash', 'critical_auditor_receipt_gate_dry_run_hash_mismatch'],
  ] as const)('rejects a re-signed receipt with stale %s', (field, issueCode) => {
    const fixture = createRoundFixture(1);
    const receipt = resignReceipt({
      ...fixture.receipt,
      [field]: field.endsWith('Hash') ? freshHash(`stale-${field}`) : `stale-${randomUUID()}`,
    });

    const result = validateCriticalAuditorReceiptBinding({
      ...fixture,
      receipt,
    });

    expect(result.issueCodes).toContain(issueCode);
  });

  it.each([
    ['transactionId', 'critical_auditor_response_transaction_id_mismatch'],
    ['semanticModelHash', 'critical_auditor_response_semantic_model_hash_mismatch'],
    ['packetHash', 'critical_auditor_response_packet_hash_mismatch'],
    ['requestHash', 'critical_auditor_response_request_hash_mismatch'],
    ['gateDryRunHash', 'critical_auditor_response_gate_dry_run_hash_mismatch'],
  ] as const)('rejects a stale response artifact with mismatched %s', (field, issueCode) => {
    const fixture = createRoundFixture(1);
    const response = {
      ...fixture.response,
      [field]: field.endsWith('Hash') ? freshHash(`stale-${field}`) : `stale-${randomUUID()}`,
    };

    const result = validateCriticalAuditorReceiptBinding({
      ...fixture,
      response,
    });

    expect(result.issueCodes).toContain(issueCode);
    expect(result.issueCodes).toContain('critical_auditor_receipt_response_hash_mismatch');
  });

  it('rejects response content drift even when all envelope bindings remain current', () => {
    const fixture = createRoundFixture(1);
    const response = {
      ...fixture.response,
      reviewedProjectionRefs: [...(fixture.response.reviewedProjectionRefs as string[]), randomUUID()],
    };

    const result = validateCriticalAuditorReceiptBinding({
      ...fixture,
      response,
    });

    expect(result.issueCodes).toContain('critical_auditor_receipt_response_hash_mismatch');
  });

  it.each([
    'transactionId',
    'semanticModelHash',
    'packetHash',
    'requestHash',
    'gateDryRunHash',
    'response',
  ] as const)('resets three-round convergence when the latest %s binding changes', (field) => {
    const shared = sharedExpectation();
    const rounds = [1, 2, 3].map((roundIndex) => createRoundFixture(roundIndex, shared));
    const latest = rounds[2];
    if (field === 'response') {
      latest.response = {
        ...latest.response,
        reviewedProjectionRefs: [randomUUID()],
      };
    } else {
      latest.receipt = resignReceipt({
        ...latest.receipt,
        [field]: field.endsWith('Hash') ? freshHash(`changed-${field}`) : `changed-${randomUUID()}`,
      });
    }

    const result = evaluateCriticalAuditorReceiptBindingSequence(rounds);

    expect(result.ok).toBe(false);
    expect(result.consecutiveValidNoNewGapRounds).toBe(0);
    expect(result.issueCodes.length).toBeGreaterThan(0);
  });
});
