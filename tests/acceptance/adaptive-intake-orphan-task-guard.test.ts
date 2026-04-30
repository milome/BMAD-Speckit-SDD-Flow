import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateAdaptiveIntakeProof } from '../../scripts/adaptive-intake-proof-gate';
import {
  writeUserStoryMappingIndex,
  type UserStoryMappingItem,
} from '../../scripts/user-story-mapping';

function writeQueueSync(root: string, item: UserStoryMappingItem): void {
  const file = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'adaptive-intake-queue-sync',
    `${item.requirementId}.json`
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        decision: {
          applied: true,
          route: {
            requirementId: item.requirementId,
            storyId: item.storyId,
            allowedWriteScope: item.allowedWriteScope,
          },
        },
      },
      null,
      2
    ),
    'utf8'
  );
}

describe('adaptive intake orphan task guard', () => {
  it('fails CP1 proof when any active execution unit lacks story binding or queue sync', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-orphan-'));
    try {
      const mapped: UserStoryMappingItem = {
        requirementId: 'REQ-story',
        sourceType: 'prd',
        epicId: 'E1',
        storyId: 'S1',
        flow: 'story',
        sprintId: 'Sprint-1',
        allowedWriteScope: ['src/story/**'],
        status: 'planned',
      };
      const orphan: UserStoryMappingItem = {
        ...mapped,
        requirementId: 'REQ-orphan',
        storyId: '',
      };
      writeUserStoryMappingIndex(root, {
        version: 1,
        source: '',
        updatedAt: '2026-04-27T00:00:00.000Z',
        items: [mapped, orphan],
      });
      writeQueueSync(root, mapped);

      const report = evaluateAdaptiveIntakeProof(root);
      expect(report.critical_failures).toBeGreaterThan(0);
      expect(report.checks.find((check) => check.id === 'orphan-task-zero')?.passed).toBe(false);
      expect(report.orphanTaskCount).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
