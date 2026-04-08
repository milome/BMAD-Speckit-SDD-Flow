import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeGovernanceRerunHistory } from '../write-rerun-history';

function readWrittenRecord(root: string, runId: string) {
  return JSON.parse(
    readFileSync(path.join(root, 'packages', 'scoring', 'data', `${runId}.json`), 'utf8')
  ) as { stage: string };
}

describe('writeGovernanceRerunHistory stage normalization', () => {
  it('maps story lifecycle governance stages into score schema stage=story', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gov-rerun-story-stage-'));
    try {
      const record = writeGovernanceRerunHistory({
        projectRoot: root,
        eventId: 'evt-story-create',
        timestamp: '2026-04-08T10:00:00.000Z',
        rerunGate: 'implementation-readiness',
        outcome: 'blocked',
        runtimeContext: {
          epicId: 'epic-7',
          storyId: '7.1',
          stage: 'story_create',
          runId: 'run-story-create',
        },
      });

      expect(record.stage).toBe('story');
      expect(readWrittenRecord(root, record.run_id).stage).toBe('story');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps post_audit to post_impl and epic lifecycle stages to epics', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gov-rerun-epic-stage-'));
    try {
      const postAudit = writeGovernanceRerunHistory({
        projectRoot: root,
        eventId: 'evt-post-audit',
        timestamp: '2026-04-08T10:00:00.000Z',
        rerunGate: 'implementation-readiness',
        outcome: 'blocked',
        runtimeContext: {
          epicId: 'epic-9',
          storyId: '9.2',
          stage: 'post_audit',
          runId: 'run-post-audit',
        },
      });

      const epicCreate = writeGovernanceRerunHistory({
        projectRoot: root,
        eventId: 'evt-epic-create',
        timestamp: '2026-04-08T10:01:00.000Z',
        rerunGate: 'implementation-readiness',
        outcome: 'blocked',
        runtimeContext: {
          epicId: 'epic-9',
          stage: 'epic_create',
          runId: 'run-epic-create',
        },
      });

      expect(postAudit.stage).toBe('post_impl');
      expect(epicCreate.stage).toBe('epics');
      expect(readWrittenRecord(root, postAudit.run_id).stage).toBe('post_impl');
      expect(readWrittenRecord(root, epicCreate.run_id).stage).toBe('epics');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
