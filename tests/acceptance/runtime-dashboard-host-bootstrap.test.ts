import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime dashboard host bootstrap skeleton', () => {
  it('cursor hooks declare runtime dashboard auto-start on session start', () => {
    const hooksJson = readFileSync(path.join(process.cwd(), '.cursor', 'hooks.json'), 'utf8');
    expect(hooksJson).toContain('runtime-dashboard-session-start.js');
  });

  it('claude session-start hook calls runtime dashboard auto-start helper', () => {
    const sessionStart = readFileSync(path.join(process.cwd(), '.claude', 'hooks', 'session-start.js'), 'utf8');
    expect(sessionStart).toContain('autoStartRuntimeDashboard');
    expect(sessionStart).toContain('shouldAnnounceAutoStart');
  });

  it('shared runtime auto-start helper exists under _bmad runtime hooks', () => {
    const helper = readFileSync(path.join(process.cwd(), '_bmad', 'runtime', 'hooks', 'runtime-dashboard-auto-start.js'), 'utf8');
    expect(helper).toContain('ensureRuntimeDashboardServer');
    expect(helper).toContain('BMAD_RUNTIME_DASHBOARD_AUTOSTART');
    expect(helper).toContain('shouldAnnounceAutoStart');
  });
});
