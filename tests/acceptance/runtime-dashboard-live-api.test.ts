import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';

describe('runtime dashboard live api', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('serves overview, runtime, timeline, score detail, and sft summary from the shared query core', async () => {
    const fixture = await createRuntimeDashboardFixture();
    roots.push(fixture.root);

    const server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    try {
      const overview = await (await fetch(`${server.url}/api/overview`)).json() as {
        status: string;
        health_score: number | null;
      };
      const runtimeContext = await (await fetch(`${server.url}/api/runtime-context`)).json() as {
        run_id: string;
        current_stage: string;
      };
      const timeline = await (await fetch(`${server.url}/api/stage-timeline`)).json() as Array<{
        stage: string;
        phase_score: number | null;
      }>;
      const scoreDetail = await (await fetch(`${server.url}/api/score-detail`)).json() as {
        run_id: string;
        records: Array<{ stage: string }>;
      };
      const sftSummary = await (await fetch(`${server.url}/api/sft-summary`)).json() as {
        total_candidates: number;
      };

      expect(overview.status).toBe('running');
      expect(overview.health_score).toBeTypeOf('number');
      expect(runtimeContext.run_id).toBe(fixture.runId);
      expect(runtimeContext.current_stage).toBe('implement');
      expect(timeline).toEqual([
        expect.objectContaining({
          stage: 'implement',
        }),
      ]);
      expect(scoreDetail.run_id).toBe(fixture.runId);
      expect(scoreDetail.records[0]?.stage).toBe('implement');
      expect(sftSummary.total_candidates).toBe(0);
    } finally {
      await server.close();
    }
  });
});
