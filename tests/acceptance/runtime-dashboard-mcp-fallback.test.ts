import { afterEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';

describe('runtime dashboard fallback behavior', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the live dashboard usable when no MCP process is running', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fixture = await createRuntimeDashboardFixture();
      roots.push(fixture.root);

      const server = await startLiveDashboardServer({
        root: fixture.root,
        host: '127.0.0.1',
        port: 0,
        dataPath: fixture.dataPath,
      });

      try {
        const health = await (await fetch(`${server.url}/health`)).json() as {
          ok: boolean;
          dashboard_url: string;
        };
        const overview = await (await fetch(`${server.url}/api/overview`)).json() as {
          status: string;
        };

        expect(health.ok).toBe(true);
        expect(health.dashboard_url).toBe(server.url);
        expect(overview.status).toBe('running');
        expect(consoleSpy.mock.calls.flat().join(' ')).not.toContain(
          'implement stage report has no parseable dimension_scores'
        );
      } finally {
        await server.close();
      }
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
