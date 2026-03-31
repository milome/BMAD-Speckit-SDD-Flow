import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';

describe('runtime dashboard selection api', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('defaults snapshot selection to the selected run board group and honors board/work item query params', async () => {
    const fixture = await createRuntimeDashboardFixture();
    roots.push(fixture.root);

    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures', 'sample-implement-report-high-score.md'),
        'utf-8'
      ),
      stage: 'implement',
      runId: 'run-standalone-ops-001',
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: fixture.dataPath,
      artifactDocPath: '_bmad-output/implementation-artifacts/_orphan/standalone_tasks/improve-audit-rollup.md',
      baseCommitHash: 'selection-api-standalone-base-commit',
    });

    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures', 'sample-plan-report.md'),
        'utf-8'
      ),
      stage: 'plan',
      runId: 'run-bugfix-queue-001',
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath: fixture.dataPath,
      artifactDocPath: '_bmad-output/implementation-artifacts/_orphan/bugfix/fix-runtime-dashboard-findings-duplication.md',
      baseCommitHash: 'selection-api-bugfix-base-commit',
    });

    const server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    try {
      const defaultSnapshot = await (await fetch(`${server.url}/api/snapshot`)).json() as {
        selection: { board_group_id: string | null; work_item_id: string | null };
        workboard: { active_board_group_id: string | null; active_work_item_id: string | null };
      };

      expect(defaultSnapshot.selection.board_group_id).toBe('queue:bugfix');
      expect(defaultSnapshot.workboard.active_board_group_id).toBe('queue:bugfix');
      expect(defaultSnapshot.selection.work_item_id).toBe('bugfix:orphan:fix-runtime-dashboard-findings-duplication');
      expect(defaultSnapshot.workboard.active_work_item_id).toBe('bugfix:orphan:fix-runtime-dashboard-findings-duplication');

      const standaloneSnapshot = await (await fetch(
        `${server.url}/api/snapshot?board_group_id=queue%3Astandalone-ops`
      )).json() as {
        selection: { board_group_id: string | null; work_item_id: string | null };
        workboard: { active_board_group_id: string | null; active_work_item_id: string | null };
      };

      expect(standaloneSnapshot.selection.board_group_id).toBe('queue:standalone-ops');
      expect(standaloneSnapshot.workboard.active_board_group_id).toBe('queue:standalone-ops');
      expect(standaloneSnapshot.selection.work_item_id).toBe('standalone_task:orphan:scores');
      expect(standaloneSnapshot.workboard.active_work_item_id).toBe('standalone_task:orphan:scores');

      const storyWorkItemSnapshot = await (await fetch(
        `${server.url}/api/snapshot?board_group_id=epic%3Aepic-15&work_item_id=story%3A15-1-runtime-dashboard-sft`
      )).json() as {
        selection: { board_group_id: string | null; work_item_id: string | null };
        workboard: { active_board_group_id: string | null; active_work_item_id: string | null };
        runtime_context: { work_item?: { board_group_id: string; work_item_id: string } | null };
      };

      expect(storyWorkItemSnapshot.selection.board_group_id).toBe('epic:epic-15');
      expect(storyWorkItemSnapshot.workboard.active_board_group_id).toBe('epic:epic-15');
      expect(storyWorkItemSnapshot.selection.work_item_id).toBe('story:15-1-runtime-dashboard-sft');
      expect(storyWorkItemSnapshot.workboard.active_work_item_id).toBe('story:15-1-runtime-dashboard-sft');
      expect(storyWorkItemSnapshot.runtime_context.work_item?.board_group_id).toBe('epic:epic-15');
      expect(storyWorkItemSnapshot.runtime_context.work_item?.work_item_id).toBe('story:15-1-runtime-dashboard-sft');

      const workboardSelection = await (await fetch(
        `${server.url}/api/workboard?board_group_id=queue%3Astandalone-ops&work_item_id=standalone_task%3Aorphan%3Ascores`
      )).json() as {
        active_board_group_id: string | null;
        active_work_item_id: string | null;
      };

      expect(workboardSelection.active_board_group_id).toBe('queue:standalone-ops');
      expect(workboardSelection.active_work_item_id).toBe('standalone_task:orphan:scores');
    } finally {
      await server.close();
    }
  });
});
