import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const BIN = join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

describe('provider-smoke CLI', () => {
  it('exposes provider-smoke and runs a stub provider preflight', () => {
    const root = mkdtempSync(join(tmpdir(), 'provider-smoke-cli-'));
    try {
      const configPath = join(root, '_bmad', '_config', 'governance-remediation.yaml');
      mkdirSync(join(root, '_bmad', '_config'), { recursive: true });
      writeFileSync(
        configPath,
        [
          'version: 2',
          'primaryHost: cursor',
          'packetHosts:',
          '  - cursor',
          'provider:',
          '  mode: stub',
          '  id: provider-smoke-cli-stub',
        ].join('\n'),
        'utf8'
      );

      const help = spawnSync(process.execPath, [BIN, 'provider-smoke', '--help'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(help.status).toBe(0);
      expect((help.stdout || '') + (help.stderr || '')).toContain('provider-smoke');

      const run = spawnSync(process.execPath, [BIN, 'provider-smoke', '--config', configPath], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(run.status).toBe(0);
      const payload = JSON.parse((run.stdout || '').trim()) as {
        ok: boolean;
        provider: { id: string; mode: string };
        transport: string;
      };
      expect(payload.ok).toBe(true);
      expect(payload.provider.id).toBe('provider-smoke-cli-stub');
      expect(payload.provider.mode).toBe('stub');
      expect(payload.transport).toBe('stub');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
