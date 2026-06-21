import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const CONTRACT_PATH =
  'docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md';
const CLOSURE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-p1-p4-runtime-migration'
);

const WAVE_EXPECTATIONS = [
  {
    waveId: 'main-agent-runtime-migration-wave-3.6',
    count: 22,
    strategies: { package_runtime_module: 22 },
  },
  {
    waveId: 'main-agent-runtime-migration-wave-3.7',
    count: 8,
    strategies: { package_runtime_module: 8 },
  },
  {
    waveId: 'main-agent-runtime-migration-wave-3.8',
    count: 38,
    strategies: {
      package_runtime_module: 21,
      repo_internal_reclassify: 15,
      deprecated_no_migration: 2,
    },
  },
  {
    waveId: 'main-agent-runtime-migration-wave-3.9',
    count: 14,
    strategies: { durable_helper_copy: 14 },
  },
];

const REQUIRED_CLOSURE_TOOLS = [
  'tools/script-migration/run-main-agent-p1-p4-install-matrix.cjs',
  'tools/script-migration/validate-main-agent-p1-p4-no-root-ts-dispatch.cjs',
  'tools/script-migration/validate-main-agent-p1-p4-no-root-script-deletion.cjs',
];

function readRegistry(): any {
  return yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function getWave(registry: any, waveId: string): any {
  return registry.waves.find((wave: any) => wave.waveId === waveId);
}

function countStrategies(entries: any[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.migrationStrategy] = (counts[entry.migrationStrategy] ?? 0) + 1;
    return counts;
  }, {});
}

function p1p4Entries(registry: any): any[] {
  return WAVE_EXPECTATIONS.flatMap(({ waveId }) =>
    getWave(registry, waveId).entries.map((entry: any) => ({ waveId, ...entry }))
  );
}

function expectFailClosedBlockedEntry(entry: any): void {
  expect(entry.migrationStatus, entry.entryId).toBe('blocked');
  expect(['blocked', 'partial'], entry.entryId).toContain(entry.validationStatus);
  expect(String(entry.implementationState || ''), entry.entryId).toMatch(/^blocked_/);
  expect(entry.migrationBlockers, entry.entryId).toEqual(expect.any(Array));
  expect(entry.migrationBlockers.length, entry.entryId).toBeGreaterThan(0);
  expect(String(entry.parityEvidenceStatus || ''), entry.entryId).toMatch(/^(failed|missing)_/);
  expect(entry.evidenceRefs?.length ?? 0, entry.entryId).toBeGreaterThan(0);
}

describe('main-agent runtime migration P1-P4 contract closure', () => {
  it('keeps the P1-P4 closure under one frozen goal contract', () => {
    expect(fs.existsSync(path.join(ROOT, CONTRACT_PATH))).toBe(true);
    for (const tool of REQUIRED_CLOSURE_TOOLS) {
      expect(fs.existsSync(path.join(ROOT, tool)), tool).toBe(true);
    }
    expect(fs.existsSync(CLOSURE_DIR)).toBe(true);
  });

  it('records Waves 3.6 through 3.9 in one registry with the expected counts', () => {
    const registry = readRegistry();
    for (const expectation of WAVE_EXPECTATIONS) {
      const wave = getWave(registry, expectation.waveId);
      expect(wave, expectation.waveId).toBeTruthy();
      expect(wave.contractPath).toBe(CONTRACT_PATH);
      expect(wave.status).toBe('blocked');
      expect(wave.completedAt ?? null, expectation.waveId).toBeNull();
      expect(wave.entries).toHaveLength(expectation.count);
      expect(countStrategies(wave.entries)).toEqual(expectation.strategies);
    }
    expect(p1p4Entries(registry)).toHaveLength(82);
  });

  it('keeps every P1-P4 original root script retained and deletion-unapproved', () => {
    const registry = readRegistry();
    const entries = p1p4Entries(registry);
    const originalPaths = new Set<string>();

    for (const entry of entries) {
      expect(entry.originalPath, entry.entryId).toMatch(/^scripts\//);
      expect(fs.existsSync(path.join(ROOT, entry.originalPath)), entry.originalPath).toBe(true);
      expect(entry.originalPathStatus, entry.entryId).toBe('retained');
      expect(entry.deletionAllowed, entry.entryId).toBe(false);
      expect(entry.deletionApprovalRef, entry.entryId).toBeNull();
      expect(String(entry.oldPathDisposition || ''), entry.entryId).not.toMatch(/deletion[-_ ]?ready/i);
      if (entry.migrationStatus === 'blocked') expectFailClosedBlockedEntry(entry);
      expect(originalPaths.has(entry.originalPath), entry.originalPath).toBe(false);
      originalPaths.add(entry.originalPath);
    }
  });

  it('keeps the conclusion narrow for P3 exclusions and P4 durable helpers', () => {
    const registry = readRegistry();
    const entries = p1p4Entries(registry);
    const p3Exclusions = entries.filter((entry) =>
      ['repo_internal_reclassify', 'deprecated_no_migration'].includes(entry.migrationStrategy)
    );
    const p4Helpers = entries.filter((entry) => entry.migrationStrategy === 'durable_helper_copy');

    expect(p3Exclusions).toHaveLength(17);
    for (const entry of p3Exclusions) {
      expect(entry.validationStatus, entry.entryId).toBe('passed');
      expect(entry.migrationStatus, entry.entryId).toBe('validated');
    }

    expect(p4Helpers).toHaveLength(14);
    for (const entry of p4Helpers) {
      expectFailClosedBlockedEntry(entry);
      expect(entry.publicCommandsAfterMigration, entry.entryId).toEqual([]);
      expect(entry.callerSwitchStatus, entry.entryId).toBe('not_applicable');
      expect(entry.targetPaths.some((target: string) => target.includes('/helpers/')), entry.entryId).toBe(
        true
      );
    }
  });
});
