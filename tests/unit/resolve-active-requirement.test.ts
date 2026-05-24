import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  requirementRecordIndexPath,
  requirementRecordsRoot,
  resolveActiveRequirement,
} from '../../scripts/resolve-active-requirement';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-active-unit-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeRecord(requirementSetId: string, overrides: Record<string, unknown> = {}): string {
  const base = path.join(requirementRecordsRoot(root), requirementSetId);
  fs.mkdirSync(path.join(base, 'recovery'), { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  const record = {
    recordId: requirementSetId.replace('REQSET', 'REQ'),
    requirementSetId,
    status: 'user_confirmed',
    flow: 'standalone_tasks',
    stage: 'implement',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    sourcePath: 'docs/requirements.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash:
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    },
    updatedAt: '2026-05-20T00:00:00.000Z',
    ...overrides,
  };
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(base, 'recovery', 'recovery-context.json'),
    '{"kind":"recovery-context"}\n',
    'utf8'
  );
  return recordPath;
}

describe('resolveActiveRequirement fallback scanning', () => {
  it('recovers deterministic active requirement when index is missing', () => {
    const recordPath = writeRecord('REQSET-RECOVERED', {
      updatedAt: '2026-05-21T00:00:00.000Z',
    });

    const resolved = resolveActiveRequirement({ root });

    expect(resolved.requirementSetId).toBe('REQSET-RECOVERED');
    expect(resolved.recordPath).toBe(recordPath);
    expect(resolved.resolutionSource).toBe('record_scan_recovered');
    expect(resolved.repairProjection).toMatchObject({
      eventType: 'requirement_index_repair_projected',
      requirementSetId: 'REQSET-RECOVERED',
      safeToWrite: true,
    });
    expect(fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'))).toBe(false);
  });

  it('recovers when index active pointer is stale', () => {
    const recordPath = writeRecord('REQSET-CURRENT');
    fs.writeFileSync(
      requirementRecordIndexPath(root),
      JSON.stringify(
        {
          active: { requirementSetId: 'REQSET-MISSING', recordId: 'REQ-MISSING' },
          records: [],
        },
        null,
        2
      ),
      'utf8'
    );

    const resolved = resolveActiveRequirement({ root });

    expect(resolved.recordPath).toBe(recordPath);
    expect(resolved.repairProjection?.selectionReason).toBe(
      'index_pointer_missing_record:active_non_closeout'
    );
  });

  it('does not let a stale active pointer override an explicit requirementSetId', () => {
    writeRecord('REQSET-STALE');
    const desiredPath = writeRecord('REQSET-DESIRED', {
      recordId: 'REQ-DESIRED',
      workflowAdapter: 'speckit',
      architectureConfirmationState: undefined,
    });
    fs.writeFileSync(
      requirementRecordIndexPath(root),
      JSON.stringify(
        {
          active: { requirementSetId: 'REQSET-STALE', recordId: 'REQ-STALE' },
          records: [
            {
              requirementSetId: 'REQSET-STALE',
              recordId: 'REQ-STALE',
              recordPath: path.join(
                requirementRecordsRoot(root),
                'REQSET-STALE',
                'requirement-record.json'
              ),
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const resolved = resolveActiveRequirement({
      root,
      requirementSetId: 'REQSET-DESIRED',
    });

    expect(resolved.requirementSetId).toBe('REQSET-DESIRED');
    expect(resolved.recordPath).toBe(desiredPath);
    expect(resolved.resolutionSource).toBe('record_scan_match');
    expect(resolved.stage).toBe('implement');
  });

  it('fails closed and lists equal-priority candidates', () => {
    writeRecord('REQSET-AMBIGUOUS-A', {
      recordId: 'REQ-AMBIGUOUS-A',
      updatedAt: '2026-05-21T00:00:00.000Z',
    });
    writeRecord('REQSET-AMBIGUOUS-B', {
      recordId: 'REQ-AMBIGUOUS-B',
      updatedAt: '2026-05-21T00:00:00.000Z',
    });

    expect(() => resolveActiveRequirement({ root })).toThrow(
      /blocked_ambiguous_active_requirement/u
    );
    const projection = JSON.parse(
      fs.readFileSync(
        path.join(requirementRecordsRoot(root), 'index-repair-projection.json'),
        'utf8'
      )
    );
    expect(projection.rejectedCandidates.map((item: { requirementSetId: string }) => item.requirementSetId)).toEqual([
      'REQSET-AMBIGUOUS-A',
      'REQSET-AMBIGUOUS-B',
    ]);
    expect(projection.safeToWrite).toBe(false);
  });
});
