import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendControlEventAndReplay } from '../../scripts/requirement-record-control-store';

type JsonObject = Record<string, unknown>;

function baseRecord(): JsonObject {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-EXTERNAL-BOARD',
    requirementSetId: 'REQSET-EXTERNAL-BOARD',
    status: 'closed',
    sourcePath: 'docs/requirements/external-board.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-EXTERNAL-BOARD',
        requirementSetId: 'REQSET-EXTERNAL-BOARD',
        confirmedAt: '2026-05-28T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath: 'docs/requirements/external-board.md',
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText: 'confirmed',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQSET-EXTERNAL-BOARD/confirmation/report.json',
        htmlPath:
          '_bmad-output/runtime/requirement-records/REQSET-EXTERNAL-BOARD/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'delivery_confirmation',
    bmadAssociation: {
      relationship: 'story',
      associationDecisionKey: 'story:1',
    },
    lastEventType: 'record_closed',
  };
}

function withRecord<T>(run: (recordPath: string) => T): T {
  const root = mkdtempSync(path.join(os.tmpdir(), 'external-board-boundary-'));
  try {
    const recordPath = path.join(
      root,
      '_bmad-output/runtime/requirement-records/REQSET-EXTERNAL-BOARD/requirement-record.json'
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(baseRecord(), null, 2)}\n`, 'utf8');
    return run(recordPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('external board evidence-only boundary', () => {
  it('records external board receipts without mutating control authority fields', () => {
    withRecord((recordPath) => {
      const before = JSON.parse(readFileSync(recordPath, 'utf8'));
      appendControlEventAndReplay({
        recordPath,
        writerId: 'external-board-receipt-writer',
        eventType: 'external_board_sync_receipt_recorded',
        recordedAt: '2026-05-28T00:00:01.000Z',
        payload: {
          receiptId: 'external-board-receipt-001',
          board: 'github',
          status: 'accepted',
          outboxRef: 'outbox-001',
          patchBackRef: 'patch-back-001',
        },
        reduce: (record, payload) => ({
          ...record,
          externalBoardSyncReceipts: [
            ...((record.externalBoardSyncReceipts as unknown[]) ?? []),
            payload,
          ],
          lastEventType: 'external_board_sync_receipt_recorded',
        }),
      });

      const after = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(after.externalBoardSyncReceipts.at(-1)).toMatchObject({
        receiptId: 'external-board-receipt-001',
        board: 'github',
        status: 'accepted',
      });
      expect(after.currentMentalModel).toBe(before.currentMentalModel);
      expect(after.bmadAssociation).toEqual(before.bmadAssociation);
      expect(after.status).toBe(before.status);
      expect(after.sprintStatusUpdateAuthorizations ?? []).toEqual([]);
    });
  });

  it('rejects patch-back attempts that mutate currentMentalModel, bmadAssociation, record_closed, or sprint-status authority', () => {
    withRecord((recordPath) => {
      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'external-board-patch-back-writer',
          eventType: 'external_board_patch_back_receipt_recorded',
          recordedAt: '2026-05-28T00:00:02.000Z',
          payload: {
            receiptId: 'patch-back-001',
            board: 'github',
            status: 'accepted',
          },
          reduce: (record) => {
            const forbidden = {
              ...record,
              currentMentalModel: 'implementation_readiness',
              bmadAssociation: { relationship: 'linked' },
              lastEventType: 'record_closed',
              sprintStatusUpdateAuthorizations: [
                {
                  authorizationId: 'forbidden',
                  status: 'current',
                  targetPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
                },
              ],
            };
            if (
              forbidden.currentMentalModel !== record.currentMentalModel ||
              JSON.stringify(forbidden.bmadAssociation) !==
                JSON.stringify(record.bmadAssociation) ||
              ((forbidden.sprintStatusUpdateAuthorizations as unknown[]) ?? []).length > 0
            ) {
              throw new Error('external_board_patch_back_is_evidence_only');
            }
            return forbidden;
          },
        })
      ).toThrow('external_board_patch_back_is_evidence_only');
    });
  });
});
