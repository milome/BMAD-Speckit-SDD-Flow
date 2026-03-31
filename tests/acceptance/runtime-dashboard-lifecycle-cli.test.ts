import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const BIN = join(PKG_ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const { startRuntimeDashboardServer, getRuntimeDashboardStatus, stopServerByState } = require('../../scripts/start-runtime-dashboard-server.cjs');

function run(cmd: string, cwd: string): string {
  const result = spawnSync('cmd.exe', ['/c', cmd], {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim());
  }
  return result.stdout;
}

describe('runtime dashboard lifecycle cli', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      try {
        stopServerByState(root);
      } catch {
        // ignore
      }
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Windows may still be releasing background process handles.
      }
    }
  });

  it('supports dashboard-start, dashboard-status, and dashboard-stop in a consumer install', async () => {
    const target = mkdtempSync(join(tmpdir(), 'accept-dashboard-lifecycle-'));
    roots.push(target);

    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }), 'utf8');
    const pkgPath = join(PKG_ROOT).replace(/\\/g, '/');
    run(`npm install --save-dev file:${pkgPath}`, target);

    const started = await startRuntimeDashboardServer({ root: target, port: 0 });
    expect(started.mode).toMatch(/started|restarted|reused/);
    expect(started.url).toContain('http://127.0.0.1:');

    const status = getRuntimeDashboardStatus(target);
    expect(status.url).toBe(started.url);
    expect(status.alive).toBe(true);

    stopServerByState(target);
    const stopped = getRuntimeDashboardStatus(target);
    expect(stopped.mode).toBe('stopped');
  }, 120000);
});
