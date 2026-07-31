import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BIN = path.join(ROOT, 'packages/bmad-speckit/bin/bmad-speckit.js');
const LEGACY_COMMAND = 'requirements-contract-critical-auditor-judge-adapter';
const BIN_SOURCE = readFileSync(BIN, 'utf8');
const SPECKIT_CLI_SOURCE = readFileSync(
  path.join(
    ROOT,
    'packages/bmad-speckit/src/main-agent/source-authority/scripts/speckit-cli.ts'
  ),
  'utf8'
);

describe('Judge public entry hard cut', () => {
  it('exposes only the canonical nested judge run public entry', () => {
    expect(BIN_SOURCE).toContain(".command('judge')");
    expect(BIN_SOURCE).toContain(".command('run')");
    expect(BIN_SOURCE).toContain('runJudgePublicCommand');
    expect(SPECKIT_CLI_SOURCE).toContain('runJudgePublicCommand');
    expect(SPECKIT_CLI_SOURCE).toContain("args[0] === 'judge'");
    expect(SPECKIT_CLI_SOURCE).toContain("args[1] !== 'run'");
    expect(BIN_SOURCE).not.toContain('--external-adapter-command');
    expect(BIN_SOURCE).not.toContain('--adapter-command');
    expect(BIN_SOURCE).not.toContain(LEGACY_COMMAND);
    expect(SPECKIT_CLI_SOURCE).not.toContain('resolveCriticalAuditorExternalAdapterCommand');
  });

  it('keeps canonical help reachable and rejects legacy public entry and override argv', () => {
    const canonical = spawnSync(process.execPath, [BIN, 'judge', 'run', '--help'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(canonical.status).toBe(0);
    expect(canonical.stdout).toContain('judge run');

    const legacyEntry = spawnSync(
      process.execPath,
      [BIN, LEGACY_COMMAND, '--help'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    expect(legacyEntry.error).toBeUndefined();
    expect(legacyEntry.signal).toBeNull();
    expect(legacyEntry.status).toBe(1);
    expect(legacyEntry.stderr).toContain('unknown command');
    expect(legacyEntry.stderr).toContain(LEGACY_COMMAND);

    const legacyOverride = spawnSync(
      process.execPath,
      [
        BIN,
        'judge',
        'run',
        '--project-root',
        ROOT,
        '--config',
        'config.yaml',
        '--request',
        'request.json',
        '--role',
        'requirements',
        '--attempt-id',
        'attempt-1',
        '--output-dir',
        'out',
        '--external-adapter-command',
        'codex',
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );
    expect(legacyOverride.status).not.toBe(0);
    expect(legacyOverride.stderr).toContain("unknown option '--external-adapter-command'");
  });
});
