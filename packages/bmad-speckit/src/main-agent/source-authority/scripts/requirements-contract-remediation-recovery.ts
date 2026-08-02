import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
} from './requirements-contract-verification-evidence-normalizer';
import type { RequirementsContractRemediationJournalEntry } from './requirements-contract-remediation-journal';

export interface RequirementsContractRemediationRecoveryReceipt {
  schemaVersion: 'requirements-contract-remediation-recovery-receipt/v1';
  recoveredJournalHeadHash: string;
  trustedHeadHash: string;
  journalEntryCount: number;
  replayedUnknownWriteCount: number;
  decision: 'pass';
  recoveryReceiptHash: string;
}

export class RequirementsContractRemediationRecoveryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationRecoveryError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationRecoveryError(code);
}

function validateEntryHash(entry: RequirementsContractRemediationJournalEntry): void {
  const { entryHash, ...payload } = entry;
  if (entryHash !== stableHash(payload)) fail('remediation_recovery_hash_chain_invalid');
}

export function recoverRequirementsContractRemediationJournal(
  input: unknown
): RequirementsContractRemediationRecoveryReceipt {
  if (!isRecord(input)) fail('remediation_recovery_input_invalid');
  const journalEntries = Array.isArray(input.journalEntries)
    ? (input.journalEntries as RequirementsContractRemediationJournalEntry[])
    : [];
  if (journalEntries.length === 0) fail('remediation_recovery_journal_missing');
  const orderedEntries = [...journalEntries].sort(
    (left, right) => left.entryOrdinal - right.entryOrdinal
  );
  const knownWriteHashes = new Set(
    Array.isArray(input.knownWriteHashes)
      ? input.knownWriteHashes.map((hashValue) =>
          requireHash({ hashValue }, 'hashValue', 'remediation_recovery_known_hash_invalid')
        )
      : []
  );
  let previous = orderedEntries[0].previousEntryHash;
  for (const entry of orderedEntries) {
    validateEntryHash(entry);
    if (entry.previousEntryHash !== previous) fail('remediation_recovery_hash_chain_invalid');
    previous = entry.entryHash;
  }
  const head = orderedEntries.at(-1);
  const trustedHeadHash = requireHash(
    input,
    'trustedHeadHash',
    'remediation_recovery_trusted_hash_mismatch'
  );
  if (!head || head.entryHash !== trustedHeadHash)
    fail('remediation_recovery_trusted_hash_mismatch');
  const unknownWriteCount = orderedEntries.filter(
    (entry) => !knownWriteHashes.has(entry.payloadHash)
  ).length;
  if (unknownWriteCount > 0 && input.rerunUnknownWrites === true) {
    fail('remediation_recovery_unknown_write_rerun_forbidden');
  }
  const payload = {
    schemaVersion: 'requirements-contract-remediation-recovery-receipt/v1' as const,
    recoveredJournalHeadHash: head.entryHash,
    trustedHeadHash,
    journalEntryCount: orderedEntries.length,
    replayedUnknownWriteCount: 0,
    decision: 'pass' as const,
  };
  return { ...payload, recoveryReceiptHash: stableHash(payload) };
}

export function validateRequirementsContractRemediationRecoveryReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractRemediationRecoveryReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('remediation_recovery_receipt_invalid');
  const receipt = value as unknown as RequirementsContractRemediationRecoveryReceipt;
  const { recoveryReceiptHash, ...payload } = receipt;
  if (recoveryReceiptHash !== stableHash(payload)) {
    fail('remediation_recovery_receipt_hash_mismatch');
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-remediation-recovery-receipt/v1' ||
    receipt.decision !== 'pass'
  ) {
    fail('remediation_recovery_receipt_invalid');
  }
  if (
    receipt.recoveryReceiptHash !==
      requireHash(currentAuthority, 'recoveryReceiptHash', 'remediation_recovery_receipt_stale') ||
    receipt.recoveredJournalHeadHash !==
      requireHash(
        currentAuthority,
        'recoveredJournalHeadHash',
        'remediation_recovery_receipt_stale'
      )
  ) {
    fail('remediation_recovery_receipt_stale');
  }
  requireText(receipt, 'schemaVersion', 'remediation_recovery_receipt_invalid');
  return receipt;
}
