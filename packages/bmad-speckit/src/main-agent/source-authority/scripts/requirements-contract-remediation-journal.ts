import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
} from './requirements-contract-verification-evidence-normalizer';

export type RequirementsContractRemediationJournalEventType =
  | 'prepare'
  | 'apply'
  | 'verify'
  | 'rollback'
  | 'seal'
  | 'recovery';

export interface RequirementsContractRemediationJournalEntry {
  schemaVersion: 'requirements-contract-remediation-journal-entry/v1';
  transactionManifestHash: string;
  entryOrdinal: number;
  eventType: RequirementsContractRemediationJournalEventType;
  unitId: string;
  previousEntryHash: string;
  payloadHash: string;
  decision: 'pass';
  entryHash: string;
}

export class RequirementsContractRemediationJournalError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationJournalError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationJournalError(code);
}

const EVENT_TYPES = ['prepare', 'apply', 'verify', 'rollback', 'seal', 'recovery'] as const;

export function createRequirementsContractRemediationJournalEntry(input: {
  transactionManifestHash: string;
  entryOrdinal: number;
  eventType: RequirementsContractRemediationJournalEventType;
  unitId: string;
  previousEntryHash: string;
  payload: unknown;
}): RequirementsContractRemediationJournalEntry {
  if (!EVENT_TYPES.includes(input.eventType)) fail('remediation_journal_event_invalid');
  const payload = {
    schemaVersion: 'requirements-contract-remediation-journal-entry/v1' as const,
    transactionManifestHash: input.transactionManifestHash,
    entryOrdinal: input.entryOrdinal,
    eventType: input.eventType,
    unitId: input.unitId,
    previousEntryHash: input.previousEntryHash,
    payloadHash: stableHash(input.payload),
    decision: 'pass' as const,
  };
  return { ...payload, entryHash: stableHash(payload) };
}

export function validateRequirementsContractRemediationJournalEntry(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractRemediationJournalEntry {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('remediation_journal_entry_invalid');
  const entry = value as unknown as RequirementsContractRemediationJournalEntry;
  const { entryHash, ...payload } = entry;
  if (entryHash !== stableHash(payload)) fail('remediation_journal_entry_hash_mismatch');
  if (
    entry.schemaVersion !== 'requirements-contract-remediation-journal-entry/v1' ||
    entry.decision !== 'pass' ||
    !EVENT_TYPES.includes(entry.eventType)
  ) {
    fail('remediation_journal_entry_invalid');
  }
  if (
    entry.entryHash !==
    requireHash(currentAuthority, 'entryHash', 'remediation_journal_entry_stale')
  ) {
    fail('remediation_journal_entry_stale');
  }
  if (
    text(currentAuthority.transactionManifestHash) &&
    entry.transactionManifestHash !==
      requireHash(currentAuthority, 'transactionManifestHash', 'remediation_journal_entry_stale')
  ) {
    fail('remediation_journal_entry_stale');
  }
  requireText(entry, 'unitId', 'remediation_journal_entry_invalid');
  return entry;
}
