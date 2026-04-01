import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRuntimeDashboardFixture } from '../helpers/runtime-dashboard-fixture';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';

const { startRuntimeDashboardServer, stopServerByState } = require('../../scripts/start-runtime-dashboard-server.cjs');
const { clearServerState } = require('../../scripts/runtime-dashboard-server-state.cjs');
const childProcess = require('node:child_process');

describe('runtime dashboard stable launcher', () => {
  const roots: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      stopServerByState(root);
      clearServerState(root);
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Background child teardown on Windows can lag briefly; root temp dir is force-cleaned by OS later.
      }
    }
  });

  it('reuses a healthy server from existing state without spawning a new child', async () => {
    const fixture = await createRuntimeDashboardFixture();
    roots.push(fixture.root);

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
      baseCommitHash: 'stable-launcher-bugfix',
    });

    const started = await startRuntimeDashboardServer({
      root: fixture.root,
      dataPath: fixture.dataPath,
      port: 0,
    });

    expect(started.mode).toBe('started');
    expect(started.url).toContain('http://127.0.0.1:');
    expect(started.state_path).toContain(path.join('outputs', 'runtime', 'runtime-dashboard', 'server.json'));
    expect(fs.existsSync(started.state_path)).toBe(true);

    const spawnSpy = vi.spyOn(childProcess, 'spawn');

    const reused = await startRuntimeDashboardServer({
      root: fixture.root,
      dataPath: fixture.dataPath,
      port: 0,
    });

    expect(reused.mode).toBe('reused');
    expect(reused.url).toBe(started.url);
    expect(reused.pid).toBe(started.pid);
    expect(spawnSpy).not.toHaveBeenCalled();
  }, 60000);

  it('reports session restriction instead of falling back to a foreground server when detached spawn is blocked', async () => {
    const fixture = await createRuntimeDashboardFixture();
    roots.push(fixture.root);

    const prev = process.env.BMAD_SESSION_RESTRICT_BACKGROUND;
    process.env.BMAD_SESSION_RESTRICT_BACKGROUND = '1';
    const spawnSpy = vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error('spawn EPERM');
      error.code = 'EPERM';
      throw error;
    });

    try {
      await expect(
        startRuntimeDashboardServer({
          root: fixture.root,
          dataPath: fixture.dataPath,
          port: 43124,
        })
      ).rejects.toMatchObject({
        code: 'DASHBOARD_SESSION_RESTRICTED',
      });

      expect(spawnSpy).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(fixture.root, 'outputs', 'runtime', 'runtime-dashboard', 'server.json'))).toBe(false);
    } finally {
      if (prev == null) {
        delete process.env.BMAD_SESSION_RESTRICT_BACKGROUND;
      } else {
        process.env.BMAD_SESSION_RESTRICT_BACKGROUND = prev;
      }
    }
  });
});
