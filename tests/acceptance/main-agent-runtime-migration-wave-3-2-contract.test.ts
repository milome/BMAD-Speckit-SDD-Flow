import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_REF =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/caller-inventory.json';
const INVENTORY_PATH = path.join(ROOT, INVENTORY_REF);
const MATRIX_PATH = path.join(WAVE_DIR, 'classification-matrix.md');
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const ANALYZER_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'analyze-main-agent-wave-3-2.cjs'
);
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-wave-3-2.cjs'
);

type CallerInventoryEntry = {
  entryId?: string;
  originalPath?: string;
  consumerReachability?: string;
  recommendedMigrationStrategy?: string;
  recommendedTargetPaths?: string[];
  evidenceRefs?: string[];
  deletionAllowed?: boolean;
};

type CallerInventory = {
  schemaVersion?: string;
  waveId?: string;
  wave3_2TargetEntries?: number;
  entries?: CallerInventoryEntry[];
};

type RegistryWave = {
  waveId?: string;
  entries?: CallerInventoryEntry[];
};

type ScriptMigrationRegistry = {
  registryKind?: string;
  installSurface?: string;
  consumerRuntimeDependency?: boolean;
  waves?: RegistryWave[];
};

function readInventory(): CallerInventory {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as CallerInventory;
}

function readRegistry(): ScriptMigrationRegistry {
  return yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8')) as ScriptMigrationRegistry;
}

describe('main-agent runtime migration wave 3.2 contract', () => {
  it('keeps the Wave 3.2 governance tools as maintenance assets', () => {
    expect(fs.existsSync(ANALYZER_PATH)).toBe(true);
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    expect(fs.existsSync(INVENTORY_PATH)).toBe(true);
    expect(fs.existsSync(MATRIX_PATH)).toBe(true);
    expect(fs.existsSync(REGISTRY_PATH)).toBe(true);
  });

  it('records the lightweight 25-entry caller inventory without approving deletion', () => {
    const inventory = readInventory();

    expect(inventory.schemaVersion).toBe('main-agent-wave-3-2-caller-inventory/v1');
    expect(inventory.waveId).toBe(WAVE_ID);
    expect(inventory.wave3_2TargetEntries).toBe(25);
    expect(inventory.entries).toHaveLength(25);
    expect((inventory.entries ?? []).filter((entry) => entry.deletionAllowed).length).toBe(0);

    for (const entry of inventory.entries ?? []) {
      expect(entry.entryId?.length).toBeGreaterThan(0);
      expect(entry.originalPath).toMatch(/^scripts\/main-agent-.+\.ts$/u);
      expect([
        'consumer_runtime_reachable',
        'installed_surface_reachable',
        'source_repo_only',
      ]).toContain(entry.consumerReachability);
      expect(['package_runtime_module', 'repo_internal_reclassify']).toContain(
        entry.recommendedMigrationStrategy
      );
      expect(entry.deletionAllowed).toBe(false);
      expect(entry.evidenceRefs).toContain(INVENTORY_REF);

      if (entry.recommendedMigrationStrategy === 'package_runtime_module') {
        expect(entry.recommendedTargetPaths?.some((targetPath) =>
          targetPath.startsWith('packages/bmad-speckit/src/main-agent/actions/')
        )).toBe(true);
      }
    }
  });

  it('keeps the classification matrix as a readable 25-row summary', () => {
    const matrix = fs.readFileSync(MATRIX_PATH, 'utf8');
    const entryRows = matrix
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('| main-agent-'));

    expect(matrix).toContain('| wave3.2TargetEntries | 25 |');
    expect(matrix).toContain('| deletionAllowedCount | 0 |');
    expect(entryRows).toHaveLength(25);
  });

  it('registers the same 25 entries in the source repo registry', () => {
    const inventory = readInventory();
    const registry = readRegistry();
    const wave = registry.waves?.find((candidate) => candidate.waveId === WAVE_ID);

    expect(registry.registryKind).toBe('source_repo_script_migration_registry');
    expect(registry.installSurface).toBe('excluded');
    expect(registry.consumerRuntimeDependency).toBe(false);
    expect(wave?.entries).toHaveLength(25);

    const inventoryEntryIds = (inventory.entries ?? []).map((entry) => entry.entryId).sort();
    const registryEntryIds = (wave?.entries ?? []).map((entry) => entry.entryId).sort();

    expect(registryEntryIds).toEqual(inventoryEntryIds);

    for (const entry of wave?.entries ?? []) {
      expect(entry.deletionAllowed).toBe(false);
      expect(entry.evidenceRefs).toContain(INVENTORY_REF);
    }
  });
});
