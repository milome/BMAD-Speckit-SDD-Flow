import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const WAVE_ID = 'main-agent-runtime-migration-wave-4.0-rebaseline';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');

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

function readJson(fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(WAVE_DIR, fileName), 'utf8'));
}

describe('main agent runtime migration wave 4.0 rebaseline contract', () => {
  it('records a rebaseline-only registry wave without claiming script migration completion', () => {
    const registry = yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8')) as any;
    const wave = registry.waves.find((item: any) => item.waveId === WAVE_ID);

    expect(wave).toBeTruthy();
    expect(wave.refinesWaveId).toBe('main-agent-runtime-migration-wave-3.13');
    expect(wave.status).toBe('in_progress');
    expect(wave.completedAt).toBeNull();
    expect(wave.entries).toHaveLength(1);

    const entry = wave.entries[0];
    expect(entry.migrationStatus).toBe('in_progress');
    expect(entry.validationStatus).toBe('partial');
    expect(entry.evidenceRefs).toEqual([]);
    expect(entry.migrationBlockers).toContain('wave_4_rebaseline_only_no_scripts_migrated');
    expect(entry.targetPaths).toContain(
      'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json'
    );
    expect(entry.targetPaths).toContain(
      'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json'
    );
    expect(entry.targetPaths).toContain(
      'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json'
    );
  });

  it('writes source inventory and package source parity baseline for every current scripts file', () => {
    const scripts = physicalScripts();
    const inventory = readJson('source-inventory.json');
    const baseline = readJson('package-source-parity-baseline.json');

    expect(inventory.schemaVersion).toBe('main-agent-runtime-migration-source-inventory/v1');
    expect(baseline.schemaVersion).toBe(
      'main-agent-runtime-migration-package-source-parity-baseline/v1'
    );
    expect(inventory.waveId).toBe(WAVE_ID);
    expect(baseline.waveId).toBe(WAVE_ID);
    expect(inventory.totalScripts).toBe(scripts.length);
    expect(inventory.scripts).toHaveLength(scripts.length);
    expect(baseline.entries).toHaveLength(scripts.length);

    const inventoryPaths = new Set(inventory.scripts.map((entry: any) => entry.path));
    const baselinePaths = new Set(baseline.entries.map((entry: any) => entry.originalPath));
    expect([...inventoryPaths].sort()).toEqual(scripts);
    expect([...baselinePaths].sort()).toEqual(scripts);

    for (const entry of inventory.scripts) {
      expect(entry.rawBytes).toBeGreaterThan(0);
      expect(entry.normalizedBytes).toBeGreaterThanOrEqual(0);
      expect(entry.normalizedLoc).toBeGreaterThanOrEqual(0);
      expect(entry.entryType).toBeTruthy();
      expect(entry.callers.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('queues only current backlog entries and groups them by strategy, blocker, and priority', () => {
    const inventory = readJson('source-inventory.json');
    const queue = readJson('migration-queue.json');
    const inventoryPaths = new Set(inventory.scripts.map((entry: any) => entry.path));

    expect(queue.schemaVersion).toBe('main-agent-runtime-migration-queue/v1');
    expect(queue.waveId).toBe(WAVE_ID);
    expect(queue.sourceInventoryRef).toBe(
      'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json'
    );
    expect(queue.packageSourceParityBaselineRef).toBe(
      'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json'
    );
    expect(queue.totals.backlog).toBe(queue.queue.length);
    expect(queue.queue.length).toBeGreaterThan(0);
    expect(Object.keys(queue.groups.byPriority).length).toBeGreaterThan(0);
    expect(Object.keys(queue.groups.byStrategy).length).toBeGreaterThan(0);
    expect(Object.keys(queue.groups.byBlocker).length).toBeGreaterThan(0);

    for (const entry of queue.queue) {
      expect(inventoryPaths.has(entry.originalPath)).toBe(true);
      expect(entry.priority).toMatch(/^P[0-4]-/);
      expect(entry.migrationStatus === 'validated' && entry.validationStatus === 'passed').toBe(
        false
      );
      expect(entry.recommendedNextAction).toBeTruthy();
    }
  });
});
