import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const AUDIT_TOOL_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'audit-full-physical-script-closure.cjs'
);
const WAVE_ID = 'main-agent-runtime-migration-wave-3.12';
const AUDIT_PATH = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  WAVE_ID,
  'full-physical-script-closure-audit.json'
);

function physicalScripts(): string[] {
  const result = spawnSync('rg', ['--files', 'scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean)
    .sort();
}

function readRegistry(): any {
  return yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

describe('script migration full physical closure', () => {
  it('keeps the audit tool runnable and the physical scripts universe at 240 files', () => {
    expect(fs.existsSync(AUDIT_TOOL_PATH)).toBe(true);
    const scripts = physicalScripts();
    expect(scripts).toHaveLength(240);

    const result = spawnSync(process.execPath, [AUDIT_TOOL_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 40 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"physicalScriptsTotal":240');
  });

  it('requires every physical scripts path to have a registry entry', () => {
    const registry = readRegistry();
    const registered = new Set<string>();
    for (const wave of registry.waves ?? []) {
      for (const entry of wave.entries ?? []) {
        const originalPath = String(entry.originalPath ?? '').replace(/\\/g, '/');
        if (originalPath.startsWith('scripts/')) registered.add(originalPath);
      }
    }

    const missing = physicalScripts().filter((scriptPath) => !registered.has(scriptPath));
    expect(missing).toEqual([]);
  });

  it('records Wave 3.12 as validated without claiming root scripts are direct consumer surfaces', () => {
    const registry = readRegistry();
    const wave = registry.waves.find((item: any) => item.waveId === WAVE_ID);
    expect(wave).toBeTruthy();
    expect(wave.refinesWaveId).toBe('main-agent-runtime-migration-wave-3.11');
    expect(wave.status).toBe('validated');
    expect(wave.contractPath).toBe(
      'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md'
    );
    expect(wave.entries).toHaveLength(129);

    const consumerReachable = wave.entries.filter((entry: any) =>
      ['consumer_runtime_reachable', 'public_cli', 'package_runtime_helper'].includes(
        entry.originalClassBeforeMigration
      )
    );
    expect(consumerReachable.length).toBeGreaterThan(0);
    for (const entry of consumerReachable) {
      expect(entry.migrationStatus).toBe('validated');
      expect(entry.validationStatus).toBe('passed');
      expect(entry.evidenceRefs).toContain(
        `repo-governance/script-migrations/${WAVE_ID}/evidence.json`
      );
      expect(entry.deletionAllowed).toBe(false);
      expect(entry.deletionApprovalRef).toBeNull();
    }

    const registryOnlyEvidence = wave.entries.filter((entry: any) =>
      entry.evidenceRefs?.includes(`repo-governance/script-migrations/${WAVE_ID}/registry-evidence.json`)
    );
    expect(registryOnlyEvidence.length).toBeGreaterThan(0);
    for (const entry of registryOnlyEvidence) {
      expect(entry.migrationStatus).toBe('validated');
      expect(entry.evidenceRefs).toContain(
        `repo-governance/script-migrations/${WAVE_ID}/registry-evidence.json`
      );
    }

    const summary = fs.readFileSync(
      path.join(
        ROOT,
        'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/summary.md'
      ),
      'utf8'
    );
    expect(summary).toContain(
      'It does not claim every original root `scripts/**` file is directly executable by consumers'
    );
  });

  it('writes audit evidence with the pre-wave 129 unregistered count and current zero gap', () => {
    expect(fs.existsSync(AUDIT_PATH)).toBe(true);
    const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
    expect(audit.physicalScriptsTotal).toBe(240);
    expect(audit.registryCoverageWithoutWave.unregistered).toBe(129);
    expect(audit.currentRegistryCoverage.unregistered).toBe(0);
    expect(audit.proposedWave.entries).toHaveLength(129);
    expect(audit.consumerReachableMigrationQueue.length).toBeGreaterThan(0);
    expect(audit.internalOrDeprecatedSettled.length).toBeGreaterThan(0);
  });
});
