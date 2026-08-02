import { sha256Stable } from './requirements-contract-semantic-resolver';
import type { RequirementsContractReviewerParentProjection } from './requirements-contract-reviewer-parent-projection';

export const BCR_COMPONENT_RECEIPT_KINDS = [
  'identity',
  'dispatch',
  'coverage',
  'terminal',
  'installed_parity',
] as const;

export type RequirementsContractBcrComponentReceiptKind =
  (typeof BCR_COMPONENT_RECEIPT_KINDS)[number];

type RecordValue = Record<string, unknown>;

export interface RequirementsContractBcrReceiptIngestion {
  schemaVersion: 'requirements-contract-bcr-receipt-ingestion/v1';
  campaignId: string;
  reviewerParentProjectionHash: string;
  componentByteHash: string;
  componentReceiptHashes: Array<{
    kind: RequirementsContractBcrComponentReceiptKind;
    receiptHash: string;
  }>;
  componentReceiptSetHash: string;
  decision: 'pass';
  ingestionHash: string;
}

export class RequirementsContractBcrReceiptIngestionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractBcrReceiptIngestionError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractBcrReceiptIngestionError(code);
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactSet(left: unknown, right: string[]): boolean {
  return (
    Array.isArray(left) &&
    left.every((value) => typeof value === 'string') &&
    JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
  );
}

function validateProjectionHash(projection: RequirementsContractReviewerParentProjection): void {
  const { projectionHash, ...payload } = projection;
  if (projectionHash !== sha256Stable(payload)) {
    fail('bcr_component_projection_invalid');
  }
}

export function ingestRequirementsContractBcrReceipts(input: {
  projection: RequirementsContractReviewerParentProjection;
  receipts: unknown[];
  currentComponentByteHash: string;
}): RequirementsContractBcrReceiptIngestion {
  if (!isRecord(input) || !isRecord(input.projection)) {
    fail('bcr_component_receipt_invalid');
  }
  const projection = input.projection as RequirementsContractReviewerParentProjection;
  validateProjectionHash(projection);
  if (projection.componentByteHash !== input.currentComponentByteHash) {
    fail('bcr_component_bytes_stale');
  }
  if (!Array.isArray(input.receipts)) {
    fail('bcr_component_receipt_missing');
  }
  for (const receipt of input.receipts) {
    if (!isRecord(receipt)) fail('bcr_component_receipt_invalid');
    if (
      typeof receipt.kind !== 'string' ||
      !BCR_COMPONENT_RECEIPT_KINDS.includes(
        receipt.kind as RequirementsContractBcrComponentReceiptKind
      )
    ) {
      fail('bcr_component_receipt_kind_unknown');
    }
  }
  const byKind = new Map(
    input.receipts.map((receipt) => [(receipt as RecordValue).kind, receipt as RecordValue])
  );
  if (byKind.size !== input.receipts.length) {
    fail('bcr_component_receipt_duplicate');
  }
  if (
    input.receipts.length !== BCR_COMPONENT_RECEIPT_KINDS.length ||
    BCR_COMPONENT_RECEIPT_KINDS.some((kind) => !byKind.has(kind))
  ) {
    fail('bcr_component_receipt_missing');
  }
  for (const kind of BCR_COMPONENT_RECEIPT_KINDS) {
    const receipt = byKind.get(kind)!;
    if (Object.keys(receipt).some((key) => /final.*judge|peer.*output/iu.test(key))) {
      fail('bcr_component_peer_output_forbidden');
    }
    if (receipt.campaignId !== projection.campaignId) {
      fail('bcr_component_campaign_replay');
    }
    if (
      receipt.componentByteHash !== input.currentComponentByteHash ||
      receipt.componentByteHash !== projection.componentByteHash
    ) {
      fail('bcr_component_bytes_stale');
    }
    if (
      receipt.componentAuthority !== 'BCR' ||
      receipt.reviewerIdentity !== 'bmad_code_reviewer' ||
      receipt.nativeAgentIdentity !== 'code-reviewer' ||
      receipt.readonlyMode !== projection.readonlyMode ||
      receipt.packageValidationDecision !== 'pass'
    ) {
      fail('bcr_component_identity_mismatch');
    }
    if (receipt.scopeSnapshotHash !== projection.scopeSnapshotHash) {
      fail('bcr_component_scope_replay');
    }
    if (receipt.invocationOrdinal !== 1) {
      fail('bcr_component_invocation_ordinal_invalid');
    }
    if (receipt.schemaVersion !== `requirements-contract-bcr-${kind}-receipt/v1`) {
      fail('bcr_component_receipt_invalid');
    }
    if (
      kind === 'coverage' &&
      !exactSet(receipt.observedCoverageUnits, projection.mandatoryCoverageUnits)
    ) {
      fail('bcr_component_coverage_mismatch');
    }
    if (kind === 'dispatch' && receipt.carrierMode !== 'native') {
      fail('bcr_component_fallback_forbidden');
    }
    if (
      kind === 'terminal' &&
      (typeof receipt.terminalStatus !== 'string' ||
        !['completed', 'failed', 'outcome_unknown'].includes(receipt.terminalStatus))
    ) {
      fail('bcr_component_receipt_invalid');
    }
    if (kind === 'installed_parity' && receipt.installedParityDecision !== 'pass') {
      fail('bcr_component_identity_mismatch');
    }
    const { receiptHash, ...payload } = receipt;
    if (receiptHash !== sha256Stable(payload)) {
      fail('bcr_component_receipt_hash_mismatch');
    }
  }
  const componentReceiptHashes = BCR_COMPONENT_RECEIPT_KINDS.map((kind) => ({
    kind,
    receiptHash: byKind.get(kind)!.receiptHash as string,
  }));
  const payload = {
    schemaVersion: 'requirements-contract-bcr-receipt-ingestion/v1' as const,
    campaignId: projection.campaignId,
    reviewerParentProjectionHash: projection.projectionHash,
    componentByteHash: input.currentComponentByteHash,
    componentReceiptHashes,
    componentReceiptSetHash: sha256Stable(componentReceiptHashes),
    decision: 'pass' as const,
  };
  return {
    ...payload,
    ingestionHash: sha256Stable(payload),
  };
}
