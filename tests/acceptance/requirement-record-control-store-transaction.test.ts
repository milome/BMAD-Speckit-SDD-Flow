import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  eventLogPathForRecord,
  receiptPathForEvent,
  sha256Json,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';

type Boundary =
  | 'after_stage'
  | 'before_event_log'
  | 'before_record'
  | 'before_receipt'
  | 'before_commit_boundary'
  | 'after_transaction_promotion'
  | 'after_commit_boundary';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validRecord(recordId = 'REQ-CONTROL-TX') {
  const sourceDocumentHash = `sha256:${'1'.repeat(64)}`;
  const implementationConfirmationHash = `sha256:${'2'.repeat(64)}`;
  const controlledIngestWriterRegistry = [
    {
      writerId: 'transaction-test-writer',
      eventTypes: ['transaction_test_recorded', 'transaction_test_auto_recorded'],
      writerHash: `sha256:${'5'.repeat(64)}`,
    },
    {
      writerId: 'foreign-event-writer',
      eventTypes: ['transaction_test_recorded'],
      writerHash: `sha256:${'6'.repeat(64)}`,
    },
  ];
  return {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId: recordId,
    status: 'user_confirmed',
    sourcePath: 'docs/design/source.md',
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticModelHash: `sha256:${'3'.repeat(64)}`,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId: recordId,
        confirmedAt: '2026-07-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/source.md',
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash: `sha256:${'4'.repeat(64)}`,
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation/render-report.json',
        htmlPath: 'confirmation/confirmation.html',
      },
    ],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry,
    controlledIngestWriterRegistryHash: sha256Json({
      schemaVersion: 'controlled-ingest-writer-registry/v1',
      sourceDocumentHash,
      implementationConfirmationHash,
      writers: controlledIngestWriterRegistry,
    }),
    updatedAt: '2026-07-19T00:00:00.000Z',
  };
}

function append(
  recordPath: string,
  eventId: string,
  options: {
    expectedBeforeRecordHash?: string;
    failAt?: Boundary;
  } = {}
) {
  return appendControlEventAndReplay(
    {
      recordPath,
      writerId: 'transaction-test-writer',
      eventType: 'transaction_test_recorded',
      eventId,
      expectedBeforeRecordHash: options.expectedBeforeRecordHash,
      payload: { eventId },
      recordedAt: '2026-07-19T00:00:01.000Z',
      reduce: (record) => ({
        ...record,
        lastEventType: 'transaction_test_recorded',
        updatedAt: '2026-07-19T00:00:01.000Z',
      }),
    },
    options.failAt
      ? {
          beforeBoundary: (boundary: Boundary) => {
            if (boundary === options.failAt) throw new Error(`fault:${boundary}`);
          },
        }
      : undefined
  );
}

function appendAuto(recordPath: string, recordedAt: string) {
  return appendControlEventAndReplay({
    recordPath,
    writerId: 'transaction-test-writer',
    eventType: 'transaction_test_auto_recorded',
    payload: { kind: 'auto-generated' },
    recordedAt,
    reduce: (record) => ({
      ...record,
      lastEventType: 'transaction_test_auto_recorded',
      updatedAt: recordedAt,
    }),
  });
}

function appendGlobalIndex(
  recordPath: string,
  eventId: string,
  globalIndexPath: string,
  beforeArtifactIndex?: (targetPath: string, index: number) => void
) {
  return appendControlEventAndReplay(
    {
      recordPath,
      writerId: 'transaction-test-writer',
      eventType: 'transaction_test_recorded',
      eventId,
      payload: { eventId },
      recordedAt: '2026-07-19T00:00:01.000Z',
      artifactIndexUpdates: [
        {
          path: globalIndexPath,
          entries: [{ artifactId: eventId }],
        },
      ],
      reduce: (record) => ({
        ...record,
        lastEventType: 'transaction_test_recorded',
        updatedAt: '2026-07-19T00:00:01.000Z',
      }),
    },
    beforeArtifactIndex ? { beforeArtifactIndex } : undefined
  );
}

describe('requirement record control-store transaction', () => {
  it('rejects incomplete historical authority instead of synthesizing user_confirmed', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-migration-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      const incomplete = {
        recordId: 'REQ-INCOMPLETE',
        requirementSetId: 'REQ-INCOMPLETE',
        sourcePath: 'docs/design/source.md',
        sourceDocumentHash: `sha256:${'1'.repeat(64)}`,
        implementationConfirmationHash: `sha256:${'2'.repeat(64)}`,
      };
      writeJson(recordPath, incomplete);
      const before = readFileSync(recordPath, 'utf8');

      const canonicalized = canonicalizeRequirementRecord(incomplete);
      expect(canonicalized.status).toBe('blocked');
      expect(canonicalized.confirmationHistory).toEqual([]);
      expect(JSON.stringify(canonicalized)).not.toContain(
        'canonicalized historical confirmation baseline'
      );
      expect(() => append(recordPath, 'EVENT-INCOMPLETE')).toThrow(
        /control_store_migration_required/u
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps generated event IDs unique across commits and rejects generated-event replay', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-auto-event-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());

      const first = appendAuto(recordPath, '2026-07-19T00:00:01.000Z');
      const second = appendAuto(recordPath, '2026-07-19T00:00:02.000Z');
      expect(second.event.eventId).not.toBe(first.event.eventId);

      const recordBeforeReplay = readFileSync(recordPath, 'utf8');
      const logBeforeReplay = readFileSync(eventLogPathForRecord(recordPath), 'utf8');
      expect(() => appendAuto(recordPath, '2026-07-19T00:00:02.000Z')).toThrow(
        /control_store_duplicate_event/u
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(recordBeforeReplay);
      expect(readFileSync(eventLogPathForRecord(recordPath), 'utf8')).toBe(logBeforeReplay);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('canonicalizes historical records without consulting the current clock', () => {
    const record = validRecord() as Record<string, unknown>;
    delete record.updatedAt;
    record.sixModelResults = {
      requirement_confirmation: {
        status: 'pass',
      },
    };

    const first = canonicalizeRequirementRecord(record);
    const second = canonicalizeRequirementRecord(record);
    const requirementConfirmation = (
      first.sixModelResults as Record<string, Record<string, unknown>>
    ).requirement_confirmation;

    expect(first).toEqual(second);
    expect(first.updatedAt).toBe('2026-07-19T00:00:00.000Z');
    expect(requirementConfirmation.resultRecordedAt).toBe(
      '2026-07-19T00:00:00.000Z'
    );
  });

  it('rejects held locks, stale CAS values, and duplicate event IDs without mutation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-conflict-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const lockPath = path.join(root, 'events', 'control-store', '.lock');
      mkdirSync(path.dirname(lockPath), { recursive: true });
      writeFileSync(lockPath, '{}\n', 'utf8');
      const lockedBefore = readFileSync(recordPath, 'utf8');
      expect(() => append(recordPath, 'EVENT-LOCKED')).toThrow(/control_store_lock_held/u);
      expect(readFileSync(recordPath, 'utf8')).toBe(lockedBefore);
      rmSync(lockPath);

      expect(() =>
        append(recordPath, 'EVENT-STALE', {
          expectedBeforeRecordHash: `sha256:${'f'.repeat(64)}`,
        })
      ).toThrow(/control_store_compare_and_swap_failed/u);
      expect(readFileSync(recordPath, 'utf8')).toBe(lockedBefore);

      const expectedHash = sha256Json(
        canonicalizeRequirementRecord(JSON.parse(lockedBefore))
      );
      append(recordPath, 'EVENT-DUPLICATE', {
        expectedBeforeRecordHash: expectedHash,
      });
      const committedRecord = readFileSync(recordPath, 'utf8');
      const committedLog = readFileSync(eventLogPathForRecord(recordPath), 'utf8');
      expect(() => append(recordPath, 'EVENT-DUPLICATE')).toThrow(
        /control_store_duplicate_event/u
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(committedRecord);
      expect(readFileSync(eventLogPathForRecord(recordPath), 'utf8')).toBe(committedLog);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed without deleting a lock that changes ownership during commit', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-lock-ownership-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const before = readFileSync(recordPath, 'utf8');
      const lockPath = path.join(root, 'events', 'control-store', '.lock');

      expect(() =>
        appendControlEventAndReplay(
          {
            recordPath,
            writerId: 'transaction-test-writer',
            eventType: 'transaction_test_recorded',
            eventId: 'EVENT-LOCK-OWNERSHIP',
            payload: { eventId: 'EVENT-LOCK-OWNERSHIP' },
            recordedAt: '2026-07-19T00:00:01.000Z',
            reduce: (record) => ({
              ...record,
              lastEventType: 'transaction_test_recorded',
              updatedAt: '2026-07-19T00:00:01.000Z',
            }),
          },
          {
            beforeBoundary: (boundary) => {
              if (boundary !== 'after_stage') return;
              writeJson(lockPath, {
                schemaVersion: 'requirement-record-control-lock/v1',
                transactionId: 'CTRL-FOREIGN',
                writerId: 'foreign-writer',
                eventType: 'foreign_event',
                processId: process.pid,
                acquiredAt: '2026-07-19T00:00:02.000Z',
              });
            },
          }
        )
      ).toThrow(/control_store_lock_ownership_lost/u);

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
      expect(JSON.parse(readFileSync(lockPath, 'utf8')).transactionId).toBe('CTRL-FOREIGN');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an event type when a different writer already owns its event chain', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-event-owner-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      append(recordPath, 'EVENT-OWNER-ESTABLISHED');
      const before = readFileSync(recordPath, 'utf8');
      const logBefore = readFileSync(eventLogPathForRecord(recordPath), 'utf8');

      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'foreign-event-writer',
          eventType: 'transaction_test_recorded',
          eventId: 'EVENT-OWNER-HIJACK',
          payload: { eventId: 'EVENT-OWNER-HIJACK' },
          recordedAt: '2026-07-19T00:00:02.000Z',
          reduce: (record) => ({
            ...record,
            lastEventType: 'transaction_test_recorded',
            updatedAt: '2026-07-19T00:00:02.000Z',
          }),
        })
      ).toThrow(/control_store_event_writer_ownership_mismatch/u);

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(readFileSync(eventLogPathForRecord(recordPath), 'utf8')).toBe(logBefore);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an unregistered writer before it can establish event ownership', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-unregistered-writer-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const before = readFileSync(recordPath, 'utf8');

      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'unregistered-writer',
          eventType: 'transaction_test_recorded',
          eventId: 'EVENT-UNREGISTERED-WRITER',
          payload: { eventId: 'EVENT-UNREGISTERED-WRITER' },
          recordedAt: '2026-07-19T00:00:02.000Z',
          reduce: (record) => record,
        })
      ).toThrow(/control_store_writer_not_authorized/u);
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an event type outside the registered writer event set', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-unregistered-event-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const before = readFileSync(recordPath, 'utf8');

      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'transaction-test-writer',
          eventType: 'foreign_event',
          eventId: 'EVENT-UNREGISTERED-TYPE',
          payload: { eventId: 'EVENT-UNREGISTERED-TYPE' },
          recordedAt: '2026-07-19T00:00:02.000Z',
          reduce: (record) => record,
        })
      ).toThrow(/control_store_writer_event_not_authorized/u);
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a writer registry that is not bound to the current source hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-registry-hash-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      const record = validRecord();
      record.controlledIngestWriterRegistryHash = `sha256:${'f'.repeat(64)}`;
      writeJson(recordPath, record);
      const before = readFileSync(recordPath, 'utf8');

      expect(() => append(recordPath, 'EVENT-TAMPERED-REGISTRY')).toThrow(
        /control_store_writer_registry_hash_mismatch/u
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('repairs projections from the current commit marker before the next commit', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-recovery-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const first = append(recordPath, 'EVENT-FIRST');
      const markerPath = path.join(root, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
        transactionId: string;
        committedTransactionPath: string;
      };
      expect(marker.transactionId).toBeTruthy();

      writeFileSync(recordPath, '{"partial":true}\n', 'utf8');
      writeFileSync(eventLogPathForRecord(recordPath), '', 'utf8');
      writeFileSync(first.receiptPath, '{}\n', 'utf8');
      const lockPath = path.join(root, 'events', 'control-store', '.lock');
      writeJson(lockPath, {
        schemaVersion: 'requirement-record-control-lock/v1',
        transactionId: marker.transactionId,
        writerId: 'crashed-writer',
        eventType: 'transaction_test_recorded',
        processId: Number.MAX_SAFE_INTEGER,
        acquiredAt: '2026-07-19T00:00:00.000Z',
      });

      const recovered = append(recordPath, 'EVENT-RECOVERED');
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      const eventLog = readFileSync(eventLogPathForRecord(recordPath), 'utf8');

      expect(recovered.event.eventId).toBe('EVENT-RECOVERED');
      expect(record.lastAppliedEventId).toBe('EVENT-RECOVERED');
      expect(eventLog).toContain('"eventId":"EVENT-FIRST"');
      expect(eventLog).toContain('"eventId":"EVENT-RECOVERED"');
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(marker.committedTransactionPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('recovers an uncommitted promoted transaction to the previous complete snapshot', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-orphan-recovery-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      append(recordPath, 'EVENT-UNCOMMITTED');
      const markerPath = path.join(root, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
        transactionId: string;
        committedTransactionPath: string;
      };
      rmSync(markerPath);
      writeJson(path.join(root, 'events', 'control-store', '.lock'), {
        schemaVersion: 'requirement-record-control-lock/v1',
        transactionId: marker.transactionId,
        writerId: 'crashed-writer',
        eventType: 'transaction_test_recorded',
        processId: Number.MAX_SAFE_INTEGER,
        acquiredAt: '2026-07-19T00:00:00.000Z',
      });

      append(recordPath, 'EVENT-AFTER-RECOVERY');
      const eventLog = readFileSync(eventLogPathForRecord(recordPath), 'utf8');
      expect(eventLog).not.toContain('"eventId":"EVENT-UNCOMMITTED"');
      expect(eventLog).toContain('"eventId":"EVENT-AFTER-RECOVERY"');
      expect(existsSync(marker.committedTransactionPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before restoring a tampered previous transaction snapshot', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-tampered-previous-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      append(recordPath, 'EVENT-UNCOMMITTED-TAMPERED');
      const markerPath = path.join(root, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
        transactionId: string;
        committedTransactionPath: string;
      };
      const authorityBeforeRecovery = readFileSync(recordPath, 'utf8');
      writeFileSync(
        path.join(marker.committedTransactionPath, 'previous', 'requirement-record.json'),
        '{"tampered":true}\n',
        'utf8'
      );
      rmSync(markerPath);
      const lockPath = path.join(root, 'events', 'control-store', '.lock');
      writeJson(lockPath, {
        schemaVersion: 'requirement-record-control-lock/v1',
        transactionId: marker.transactionId,
        writerId: 'crashed-writer',
        eventType: 'transaction_test_recorded',
        processId: Number.MAX_SAFE_INTEGER,
        acquiredAt: '2026-07-19T00:00:00.000Z',
      });

      expect(() => append(recordPath, 'EVENT-RECOVERY-MUST-BLOCK')).toThrow(
        /control_store_previous_snapshot_invalid/u
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(authorityBeforeRecovery);
      expect(existsSync(lockPath)).toBe(true);
      expect(existsSync(marker.committedTransactionPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each<Boundary>([
    'after_stage',
    'before_event_log',
    'before_record',
    'before_receipt',
    'before_commit_boundary',
    'after_transaction_promotion',
  ])('rolls back every pre-commit fault at %s', (boundary) => {
    const root = mkdtempSync(path.join(os.tmpdir(), `control-store-fault-${boundary}-`));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const before = readFileSync(recordPath, 'utf8');
      const eventId = `EVENT-${boundary}`;

      expect(() => append(recordPath, eventId, { failAt: boundary })).toThrow(
        `fault:${boundary}`
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
      expect(existsSync(receiptPathForEvent(recordPath, eventId))).toBe(false);
      const transactionRoot = path.join(root, 'events', 'control-store', 'transactions');
      expect(existsSync(transactionRoot) ? readdirSync(transactionRoot) : []).toEqual([]);
      expect(existsSync(path.join(root, 'events', 'control-store', '.lock'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the complete next snapshot when a fault occurs after the commit boundary', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-post-commit-fault-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());

      expect(() =>
        append(recordPath, 'EVENT-COMMITTED-THEN-FAULTED', {
          failAt: 'after_commit_boundary',
        })
      ).toThrow('fault:after_commit_boundary');

      const markerPath = path.join(root, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as Record<string, unknown>;
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      expect(marker.eventId).toBe('EVENT-COMMITTED-THEN-FAULTED');
      expect(record.lastAppliedEventId).toBe('EVENT-COMMITTED-THEN-FAULTED');
      expect(readFileSync(eventLogPathForRecord(recordPath), 'utf8')).toContain(
        '"eventId":"EVENT-COMMITTED-THEN-FAULTED"'
      );
      expect(existsSync(receiptPathForEvent(recordPath, 'EVENT-COMMITTED-THEN-FAULTED'))).toBe(
        true
      );
      expect(existsSync(path.join(root, 'events', 'control-store', '.lock'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('commits artifact indexes with the same transaction and rolls them back together', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-index-'));
    try {
      const recordRoot = path.join(root, 'requirement-records', 'REQ-CONTROL-TX');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      const localIndexPath = path.join(recordRoot, 'artifact-index.jsonl');
      const globalIndexPath = path.join(root, 'requirement-records', 'artifact-index.jsonl');
      writeJson(recordPath, validRecord());
      writeFileSync(localIndexPath, `${JSON.stringify({ artifactId: 'EXISTING' })}\n`, 'utf8');
      const before = readFileSync(recordPath, 'utf8');
      const localBefore = readFileSync(localIndexPath, 'utf8');

      expect(() =>
        appendControlEventAndReplay(
          {
            recordPath,
            writerId: 'transaction-test-writer',
            eventType: 'transaction_test_recorded',
            eventId: 'EVENT-ARTIFACT-FAULT',
            payload: { eventId: 'EVENT-ARTIFACT-FAULT' },
            recordedAt: '2026-07-19T00:00:01.000Z',
            artifactIndexUpdates: [
              {
                path: localIndexPath,
                entries: [{ artifactId: 'LOCAL-NEW' }],
              },
              {
                path: globalIndexPath,
                entries: [{ artifactId: 'GLOBAL-NEW' }],
              },
            ],
            reduce: (record) => ({
              ...record,
              lastEventType: 'transaction_test_recorded',
              updatedAt: '2026-07-19T00:00:01.000Z',
            }),
          },
          {
            beforeArtifactIndex: (_targetPath, index) => {
              if (index === 1) throw new Error('fault:before_artifact_index:1');
            },
          }
        )
      ).toThrow('fault:before_artifact_index:1');

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(readFileSync(localIndexPath, 'utf8')).toBe(localBefore);
      expect(existsSync(globalIndexPath)).toBe(false);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);

      const result = appendControlEventAndReplay({
        recordPath,
        writerId: 'transaction-test-writer',
        eventType: 'transaction_test_recorded',
        eventId: 'EVENT-ARTIFACT-COMMIT',
        payload: { eventId: 'EVENT-ARTIFACT-COMMIT' },
        recordedAt: '2026-07-19T00:00:02.000Z',
        artifactIndexUpdates: [
          {
            path: localIndexPath,
            entries: [{ artifactId: 'LOCAL-NEW' }],
          },
          {
            path: globalIndexPath,
            entries: [{ artifactId: 'GLOBAL-NEW' }],
          },
        ],
        reduce: (record) => ({
          ...record,
          lastEventType: 'transaction_test_recorded',
          updatedAt: '2026-07-19T00:00:02.000Z',
        }),
      });

      expect(result.artifactIndexPaths).toEqual([
        localIndexPath.replace(/\\/gu, '/'),
        globalIndexPath.replace(/\\/gu, '/'),
      ]);
      expect(readFileSync(localIndexPath, 'utf8')).toContain('"artifactId":"LOCAL-NEW"');
      expect(readFileSync(globalIndexPath, 'utf8')).toContain('"artifactId":"GLOBAL-NEW"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('commits controlled artifact writes with the same transaction and rolls them back together', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-write-'));
    try {
      const recordRoot = path.join(root, 'requirement-records', 'REQ-CONTROL-TX');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      const reportPath = path.join(recordRoot, 'audit', 'report.json');
      const runtimeReceiptPath = path.join(
        recordRoot,
        'runtime',
        'status-decisions',
        'attempt-001',
        'audit_review.json'
      );
      const previousReport = `${JSON.stringify({ status: 'previous' }, null, 2)}\n`;
      const nextReport = `${JSON.stringify({ status: 'pass' }, null, 2)}\n`;
      const nextReceipt = `${JSON.stringify({ decision: 'pass' }, null, 2)}\n`;
      writeJson(recordPath, validRecord());
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, previousReport, 'utf8');
      const before = readFileSync(recordPath, 'utf8');

      expect(() =>
        appendControlEventAndReplay(
          {
            recordPath,
            writerId: 'transaction-test-writer',
            eventType: 'transaction_test_recorded',
            eventId: 'EVENT-ARTIFACT-WRITE-FAULT',
            payload: { eventId: 'EVENT-ARTIFACT-WRITE-FAULT' },
            recordedAt: '2026-07-19T00:00:01.000Z',
            artifactWrites: [
              {
                path: reportPath,
                content: nextReport,
                contentHash: sha256Text(nextReport),
              },
              {
                path: runtimeReceiptPath,
                content: nextReceipt,
                contentHash: sha256Text(nextReceipt),
              },
            ],
            reduce: (record) => ({
              ...record,
              lastEventType: 'transaction_test_recorded',
              updatedAt: '2026-07-19T00:00:01.000Z',
            }),
          },
          {
            beforeArtifactWrite: (_targetPath, index) => {
              if (index === 1) throw new Error('fault:before_artifact_write:1');
            },
          }
        )
      ).toThrow('fault:before_artifact_write:1');

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(readFileSync(reportPath, 'utf8')).toBe(previousReport);
      expect(existsSync(runtimeReceiptPath)).toBe(false);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);

      const result = appendControlEventAndReplay({
        recordPath,
        writerId: 'transaction-test-writer',
        eventType: 'transaction_test_recorded',
        eventId: 'EVENT-ARTIFACT-WRITE-COMMIT',
        payload: { eventId: 'EVENT-ARTIFACT-WRITE-COMMIT' },
        recordedAt: '2026-07-19T00:00:02.000Z',
        artifactWrites: [
          {
            path: reportPath,
            content: nextReport,
            contentHash: sha256Text(nextReport),
          },
          {
            path: runtimeReceiptPath,
            content: nextReceipt,
            contentHash: sha256Text(nextReceipt),
          },
        ],
        reduce: (record) => ({
          ...record,
          lastEventType: 'transaction_test_recorded',
          updatedAt: '2026-07-19T00:00:02.000Z',
        }),
      });

      expect(result.artifactPaths).toEqual([
        reportPath.replace(/\\/gu, '/'),
        runtimeReceiptPath.replace(/\\/gu, '/'),
      ]);
      expect(readFileSync(reportPath, 'utf8')).toBe(nextReport);
      expect(readFileSync(runtimeReceiptPath, 'utf8')).toBe(nextReceipt);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('replays committed controlled artifacts from the current marker before the next commit', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-recovery-'));
    try {
      const recordRoot = path.join(root, 'requirement-records', 'REQ-CONTROL-TX');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      const artifactPath = path.join(recordRoot, 'runtime', 'status-decisions', 'audit.json');
      const artifactText = `${JSON.stringify({ decision: 'pass' }, null, 2)}\n`;
      writeJson(recordPath, validRecord());
      appendControlEventAndReplay({
        recordPath,
        writerId: 'transaction-test-writer',
        eventType: 'transaction_test_recorded',
        eventId: 'EVENT-ARTIFACT-RECOVERY-SOURCE',
        payload: { eventId: 'EVENT-ARTIFACT-RECOVERY-SOURCE' },
        recordedAt: '2026-07-19T00:00:01.000Z',
        artifactWrites: [
          {
            path: artifactPath,
            content: artifactText,
            contentHash: sha256Text(artifactText),
          },
        ],
        reduce: (record) => ({
          ...record,
          lastEventType: 'transaction_test_recorded',
          updatedAt: '2026-07-19T00:00:01.000Z',
        }),
      });
      const markerPath = path.join(recordRoot, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
        transactionId: string;
      };
      writeFileSync(artifactPath, '{"tampered":true}\n', 'utf8');
      writeJson(path.join(recordRoot, 'events', 'control-store', '.lock'), {
        schemaVersion: 'requirement-record-control-lock/v1',
        transactionId: marker.transactionId,
        writerId: 'crashed-writer',
        eventType: 'transaction_test_recorded',
        artifactIndexTargets: [],
        artifactWriteTargets: [artifactPath.replace(/\\/gu, '/')],
        processId: Number.MAX_SAFE_INTEGER,
        acquiredAt: '2026-07-19T00:00:00.000Z',
      });

      append(recordPath, 'EVENT-AFTER-ARTIFACT-RECOVERY');

      expect(readFileSync(artifactPath, 'utf8')).toBe(artifactText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('restores prior controlled artifacts from an orphaned uncommitted transaction', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-orphan-'));
    try {
      const recordRoot = path.join(root, 'requirement-records', 'REQ-CONTROL-TX');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      const artifactPath = path.join(recordRoot, 'audit', 'report.json');
      const previousText = `${JSON.stringify({ status: 'previous' }, null, 2)}\n`;
      const nextText = `${JSON.stringify({ status: 'pass' }, null, 2)}\n`;
      writeJson(recordPath, validRecord());
      mkdirSync(path.dirname(artifactPath), { recursive: true });
      writeFileSync(artifactPath, previousText, 'utf8');
      appendControlEventAndReplay({
        recordPath,
        writerId: 'transaction-test-writer',
        eventType: 'transaction_test_recorded',
        eventId: 'EVENT-ARTIFACT-ORPHAN',
        payload: { eventId: 'EVENT-ARTIFACT-ORPHAN' },
        recordedAt: '2026-07-19T00:00:01.000Z',
        artifactWrites: [
          {
            path: artifactPath,
            content: nextText,
            contentHash: sha256Text(nextText),
          },
        ],
        reduce: (record) => ({
          ...record,
          lastEventType: 'transaction_test_recorded',
          updatedAt: '2026-07-19T00:00:01.000Z',
        }),
      });
      const markerPath = path.join(recordRoot, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as {
        transactionId: string;
      };
      rmSync(markerPath);
      writeJson(path.join(recordRoot, 'events', 'control-store', '.lock'), {
        schemaVersion: 'requirement-record-control-lock/v1',
        transactionId: marker.transactionId,
        writerId: 'crashed-writer',
        eventType: 'transaction_test_recorded',
        artifactIndexTargets: [],
        artifactWriteTargets: [artifactPath.replace(/\\/gu, '/')],
        processId: Number.MAX_SAFE_INTEGER,
        acquiredAt: '2026-07-19T00:00:00.000Z',
      });

      append(recordPath, 'EVENT-AFTER-ARTIFACT-ORPHAN');

      expect(readFileSync(artifactPath, 'utf8')).toBe(previousText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects controlled artifact writes that escape through a symlinked parent', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-symlink-'));
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'control-store-artifact-outside-'));
    try {
      const recordRoot = path.join(root, 'requirement-records', 'REQ-CONTROL-TX');
      const recordPath = path.join(recordRoot, 'requirement-record.json');
      const linkedRoot = path.join(recordRoot, 'linked-output');
      const escapedArtifactPath = path.join(linkedRoot, 'escaped.json');
      const artifactText = `${JSON.stringify({ escaped: true }, null, 2)}\n`;
      writeJson(recordPath, validRecord());
      symlinkSync(
        outsideRoot,
        linkedRoot,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      const before = readFileSync(recordPath, 'utf8');

      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'transaction-test-writer',
          eventType: 'transaction_test_recorded',
          eventId: 'EVENT-ARTIFACT-SYMLINK-ESCAPE',
          payload: { eventId: 'EVENT-ARTIFACT-SYMLINK-ESCAPE' },
          recordedAt: '2026-07-19T00:00:01.000Z',
          artifactWrites: [
            {
              path: escapedArtifactPath,
              content: artifactText,
              contentHash: sha256Text(artifactText),
            },
          ],
          reduce: (record) => ({
            ...record,
            lastEventType: 'transaction_test_recorded',
            updatedAt: '2026-07-19T00:00:01.000Z',
          }),
        })
      ).toThrow('control_store_artifact_write_target_invalid');

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
      expect(existsSync(path.join(outsideRoot, 'escaped.json'))).toBe(false);
      expect(existsSync(eventLogPathForRecord(recordPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('does not replay a record-local commit marker over newer global index entries', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-global-index-replay-'));
    try {
      const requirementRecordsRoot = path.join(root, 'requirement-records');
      const recordAPath = path.join(requirementRecordsRoot, 'REQ-A', 'requirement-record.json');
      const recordBPath = path.join(requirementRecordsRoot, 'REQ-B', 'requirement-record.json');
      const globalIndexPath = path.join(requirementRecordsRoot, 'artifact-index.jsonl');
      writeJson(recordAPath, validRecord('REQ-A'));
      writeJson(recordBPath, validRecord('REQ-B'));

      appendGlobalIndex(recordAPath, 'EVENT-A-1', globalIndexPath);
      appendGlobalIndex(recordBPath, 'EVENT-B-1', globalIndexPath);
      appendGlobalIndex(recordAPath, 'EVENT-A-2', globalIndexPath);

      const artifactIds = readFileSync(globalIndexPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => (JSON.parse(line) as { artifactId: string }).artifactId);
      expect(artifactIds).toEqual(['EVENT-A-1', 'EVENT-B-1', 'EVENT-A-2']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when another record tries to mutate a locked global artifact index', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-global-index-lock-'));
    try {
      const requirementRecordsRoot = path.join(root, 'requirement-records');
      const recordAPath = path.join(requirementRecordsRoot, 'REQ-A', 'requirement-record.json');
      const recordBPath = path.join(requirementRecordsRoot, 'REQ-B', 'requirement-record.json');
      const globalIndexPath = path.join(requirementRecordsRoot, 'artifact-index.jsonl');
      writeJson(recordAPath, validRecord('REQ-A'));
      writeJson(recordBPath, validRecord('REQ-B'));
      let nestedError: unknown;

      appendGlobalIndex(recordAPath, 'EVENT-A', globalIndexPath, () => {
        try {
          appendGlobalIndex(recordBPath, 'EVENT-B', globalIndexPath);
        } catch (error) {
          nestedError = error;
        }
      });

      expect(nestedError).toBeInstanceOf(Error);
      expect((nestedError as Error).message).toMatch(
        /control_store_artifact_index_lock_held/u
      );
      expect(readFileSync(globalIndexPath, 'utf8')).toContain('"artifactId":"EVENT-A"');
      expect(readFileSync(globalIndexPath, 'utf8')).not.toContain('"artifactId":"EVENT-B"');
      expect(existsSync(eventLogPathForRecord(recordBPath))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('publishes the complete event, record, receipt, and commit boundary together', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'control-store-commit-'));
    try {
      const recordPath = path.join(root, 'requirement-record.json');
      writeJson(recordPath, validRecord());
      const result = append(recordPath, 'EVENT-COMMIT');
      const markerPath = path.join(root, 'events', 'control-store', 'current-commit.json');
      const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));

      expect(marker).toMatchObject({
        schemaVersion: 'requirement-record-control-commit-marker/v1',
        eventId: 'EVENT-COMMIT',
        eventHash: result.event.eventHash,
        afterRecordHash: result.afterRecordHash,
      });
      expect(record).toMatchObject({
        lastAppliedEventId: 'EVENT-COMMIT',
        lastAppliedEventHash: result.event.eventHash,
        eventChainHead: result.event.eventHash,
      });
      expect(readFileSync(eventLogPathForRecord(recordPath), 'utf8')).toContain(
        '"eventId":"EVENT-COMMIT"'
      );
      expect(existsSync(result.receiptPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
