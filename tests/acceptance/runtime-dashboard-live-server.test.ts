import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../../packages/scoring/dashboard/live-server';

describe('runtime dashboard live server', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('boots on an ephemeral port and serves the static UI', async () => {
    const fixture = await createRuntimeDashboardFixture();
    roots.push(fixture.root);

    const server = await startLiveDashboardServer({
      root: fixture.root,
      host: '127.0.0.1',
      port: 0,
      dataPath: fixture.dataPath,
    });

    try {
      expect(server.port).toBeGreaterThan(0);
      const response = await fetch(`${server.url}/`);
      const html = await response.text();

      expect(response.ok).toBe(true);
      expect(html).toContain('Runtime Observatory');
      expect(html).toContain('Overview');
      expect(html).toContain('SFT Builder Summary');
    } finally {
      await server.close();
    }
  });
});
