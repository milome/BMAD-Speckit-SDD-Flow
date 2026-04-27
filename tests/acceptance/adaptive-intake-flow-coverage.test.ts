import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateAdaptiveIntakeProof } from '../../scripts/adaptive-intake-proof-gate';
import {
  writeUserStoryMappingIndex,
  type UserStoryMappingFlow,
  type UserStoryMappingItem,
} from '../../scripts/user-story-mapping';

function item(flow: UserStoryMappingFlow): UserStoryMappingItem {
  return {
    requirementId: `REQ-${flow}`,
    sourceType: flow === 'bugfix' ? 'bugfix' : flow === 'standalone_tasks' ? 'standalone' : 'prd',
    epicId: `E-${flow}`,
    storyId: `S-${flow}`,
    flow,
    sprintId: 'Sprint-1',
    allowedWriteScope: [`src/${flow}/**`],
    status: 'planned',
  };
}

function writeQueueSync(root: string, mapping: UserStoryMappingItem): void {
  const file = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'adaptive-intake-queue-sync',
    `${mapping.requirementId}.json`
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({
      decision: {
        applied: true,
        route: {
          requirementId: mapping.requirementId,
          storyId: mapping.storyId,
          allowedWriteScope: mapping.allowedWriteScope,
        },
      },
    }),
    'utf8'
  );
}

describe('adaptive intake flow coverage', () => {
  it('proves story bugfix and standalone_tasks share the same queue-sync contract', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-flow-'));
    try {
      const items = [item('story'), item('bugfix'), item('standalone_tasks')];
      writeUserStoryMappingIndex(root, {
        version: 1,
        source: '',
        updatedAt: '2026-04-27T00:00:00.000Z',
        items,
      });
      for (const mapping of items) {
        writeQueueSync(root, mapping);
      }

      const report = evaluateAdaptiveIntakeProof(root);
      expect(report.critical_failures).toBe(0);
      expect(report.coveredFlows).toEqual(['story', 'bugfix', 'standalone_tasks']);
      expect(
        report.checks.find((check) => check.id === 'queue-sync-dependency-proof')?.passed
      ).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
