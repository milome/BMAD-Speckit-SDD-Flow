import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const renderer = require(
  '../../_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts'
) as {
  readRequirementRecord?: (
    args: Record<string, string>,
    recordId: string
  ) => {
    path: string;
    snapshotPath?: string;
    found: boolean;
    record: Record<string, unknown> | null;
  };
};

describe('requirements confirmation record snapshot', () => {
  it('reads projected state from a snapshot without replacing the authoritative record path', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-record-snapshot-'));
    try {
      const recordId = `REQ-${randomUUID()}`;
      const requirementSetId = `RSET-${randomUUID()}`;
      const authorityPath = path.join(tempRoot, 'requirement-record.json');
      const snapshotPath = path.join(tempRoot, 'render-snapshot.json');
      const authoritativeRecord = {
        recordId,
        requirementSetId,
        currentMentalModel: 'delivery_confirmation',
      };
      const projectedRecord = {
        ...authoritativeRecord,
        closeout: {
          status: 'awaiting_user_acceptance',
        },
      };
      fs.writeFileSync(authorityPath, `${JSON.stringify(authoritativeRecord, null, 2)}\n`, 'utf8');
      fs.writeFileSync(snapshotPath, `${JSON.stringify(projectedRecord, null, 2)}\n`, 'utf8');

      expect(typeof renderer.readRequirementRecord).toBe('function');
      const state = renderer.readRequirementRecord!(
        {
          requirementRecord: authorityPath,
          requirementRecordSnapshot: snapshotPath,
        },
        recordId
      );

      expect(state.path).toBe(path.resolve(authorityPath));
      expect(state.snapshotPath).toBe(path.resolve(snapshotPath));
      expect(state.found).toBe(true);
      expect(state.record).toEqual(projectedRecord);
      expect(JSON.parse(fs.readFileSync(authorityPath, 'utf8'))).toEqual(authoritativeRecord);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects a render snapshot bound to a different requirement authority', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-record-snapshot-'));
    try {
      const recordId = `REQ-${randomUUID()}`;
      const authorityPath = path.join(tempRoot, 'requirement-record.json');
      const snapshotPath = path.join(tempRoot, 'render-snapshot.json');
      const authoritativeRecord = {
        recordId,
        requirementSetId: `RSET-${randomUUID()}`,
      };
      const projectedRecord = {
        ...authoritativeRecord,
        requirementSetId: `RSET-${randomUUID()}`,
      };
      fs.writeFileSync(authorityPath, `${JSON.stringify(authoritativeRecord, null, 2)}\n`, 'utf8');
      fs.writeFileSync(snapshotPath, `${JSON.stringify(projectedRecord, null, 2)}\n`, 'utf8');

      expect(() =>
        renderer.readRequirementRecord!(
          {
            requirementRecord: authorityPath,
            requirementRecordSnapshot: snapshotPath,
          },
          recordId
        )
      ).toThrow('requirement_record_snapshot_identity_mismatch:requirementSetId');
      expect(JSON.parse(fs.readFileSync(authorityPath, 'utf8'))).toEqual(authoritativeRecord);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
