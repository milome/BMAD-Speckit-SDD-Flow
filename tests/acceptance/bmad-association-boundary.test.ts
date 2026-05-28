import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlEventAndReplay,
} from '../../scripts/requirement-record-control-store';

type JsonObject = Record<string, unknown>;

const RELATIONSHIPS = ['orphan', 'linked', 'adopted_by_story', 'promoted_to_story', 'story'] as const;
const SPRINT_STATUS_PATH = '_bmad-output/implementation-artifacts/sprint-status.yaml';

function baseRecord(): JsonObject {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-BMAD-ASSOCIATION',
    requirementSetId: 'REQSET-BMAD-ASSOCIATION',
    status: 'closed',
    sourcePath: 'docs/requirements/bmad-association.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-BMAD-ASSOCIATION',
        requirementSetId: 'REQSET-BMAD-ASSOCIATION',
        confirmedAt: '2026-05-28T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath: 'docs/requirements/bmad-association.md',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText: 'confirmed',
        renderReportPath: '_bmad-output/runtime/requirement-records/REQSET-BMAD-ASSOCIATION/confirmation/report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQSET-BMAD-ASSOCIATION/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'delivery_confirmation',
  };
}

function withRecord<T>(run: (recordPath: string, root: string) => T): T {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-association-boundary-'));
  try {
    const recordPath = path.join(
      root,
      '_bmad-output/runtime/requirement-records/REQSET-BMAD-ASSOCIATION/requirement-record.json'
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(baseRecord(), null, 2)}\n`, 'utf8');
    return run(recordPath, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('BMAD association boundary', () => {
  it.each(RELATIONSHIPS)('replays bmadAssociation relationship %s', (relationship) => {
    withRecord((recordPath) => {
      appendControlEventAndReplay({
        recordPath,
        writerId: 'bmad-association-writer',
        eventType: 'bmad_association_recorded',
        recordedAt: '2026-05-28T00:00:01.000Z',
        payload: {
          relationship,
          associationDecisionKey: `association:${relationship}`,
          sourceRefs: [{ sourceType: 'bmad_story', id: `story-${relationship}` }],
          sprintStatusUpdateCandidate: relationship === 'story',
        },
        reduce: (record, payload) => ({
          ...record,
          bmadAssociation: payload,
          lastEventType: 'bmad_association_recorded',
        }),
      });

      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.bmadAssociation.relationship).toBe(relationship);
    });
  });

  it('authorizes sprint-status writes only from current sprintStatusUpdateAuthorizations', () => {
    withRecord((recordPath, root) => {
      const sprintStatusPath = path.join(root, SPRINT_STATUS_PATH);
      expect(() => {
        const record = JSON.parse(readFileSync(recordPath, 'utf8'));
        const currentAuth = ((record.sprintStatusUpdateAuthorizations as JsonObject[]) ?? [])
          .find((authorization) => authorization.status === 'current');
        if (!currentAuth) throw new Error('sprint_status_update_requires_current_authorization');
        writeFileSync(sprintStatusPath, 'story: done\n', 'utf8');
      }).toThrow('sprint_status_update_requires_current_authorization');

      appendControlEventAndReplay({
        recordPath,
        writerId: 'sprint-status-authorization-writer',
        eventType: 'sprint_status_update_authorization_recorded',
        recordedAt: '2026-05-28T00:00:02.000Z',
        payload: {
          authorizationId: 'sprint-auth-001',
          status: 'current',
          targetPath: SPRINT_STATUS_PATH,
          authorizationScope: 'delivery_confirmation',
        },
        reduce: (record, payload) => ({
          ...record,
          sprintStatusUpdateAuthorizations: [
            ...((record.sprintStatusUpdateAuthorizations as unknown[]) ?? []),
            payload,
          ],
          lastEventType: 'sprint_status_update_authorization_recorded',
        }),
      });

      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.sprintStatusUpdateAuthorizations.at(-1)).toMatchObject({
        authorizationId: 'sprint-auth-001',
        status: 'current',
        targetPath: SPRINT_STATUS_PATH,
      });
    });
  });
});
