import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const VALIDATOR_PATH = path.join(ROOT, 'tools', 'script-migration', 'validate-registry.cjs');
const EVIDENCE_PATH = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'script-migration-registry-bootstrap',
  'evidence.json'
);

const EXPECTED_STRATEGIES = [
  'package_runtime_module',
  'runtime_emit_cjs',
  'durable_helper_copy',
  'skill_local_helper',
  'test_helper_move',
  'repo_internal_reclassify',
  'public_cli_de_surface',
  'compatibility_alias',
  'deprecated_no_migration',
];

const EXPECTED_MIGRATION_STATUSES = [
  'planned',
  'in_progress',
  'migrated',
  'caller_switched',
  'validated',
  'blocked',
  'superseded',
];

const EXPECTED_VALIDATION_STATUSES = ['pending', 'partial', 'passed', 'failed', 'blocked'];

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function readRegistry(registryPath = REGISTRY_PATH): any {
  return yaml.load(fs.readFileSync(registryPath, 'utf8'));
}

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-migration-registry-'));
  tempDirs.push(dir);
  return dir;
}

function writeYaml(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value, { lineWidth: 120 }), 'utf8');
}

function runValidator(args: string[] = []) {
  return spawnSync(process.execPath, [VALIDATOR_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function getWave(registry: any, waveId: string): any {
  return registry.waves.find((wave: any) => wave.waveId === waveId);
}

function getEntry(wave: any, entryId: string): any {
  return wave.entries.find((entry: any) => entry.entryId === entryId);
}

describe('script migration registry contract', () => {
  it('keeps the registry at the top-level source repository governance path', () => {
    expect(fs.existsSync(REGISTRY_PATH)).toBe(true);
    const misplaced = fs
      .readdirSync(path.join(ROOT, '_bmad'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name === 'script-migration-registry.yaml');
    expect(misplaced).toHaveLength(0);
  });

  it('defines the registry schema, allowed enums, and source-only boundary fields', () => {
    const registry = readRegistry();
    expect(registry.registryVersion).toBe(1);
    expect(registry.registryKind).toBe('source_repo_script_migration_registry');
    expect(registry.installSurface).toBe('excluded');
    expect(registry.consumerRuntimeDependency).toBe(false);
    expect(registry.allowedMigrationStrategies).toEqual(EXPECTED_STRATEGIES);
    expect(registry.allowedMigrationStatuses).toEqual(EXPECTED_MIGRATION_STATUSES);
    expect(registry.allowedValidationStatuses).toEqual(EXPECTED_VALIDATION_STATUSES);
    expect(Array.isArray(registry.waves)).toBe(true);
    expect(registry.waves.length).toBeGreaterThan(0);
  });

  it('records bootstrap and main-agent migration wave entries without approving deletion', () => {
    const registry = readRegistry();
    const bootstrapWave = getWave(registry, 'script-migration-registry-bootstrap');
    const mainAgentWave = getWave(registry, 'main-agent-migration-wave-1');
    expect(bootstrapWave).toBeTruthy();
    expect(mainAgentWave).toBeTruthy();

    const registryEntry = getEntry(bootstrapWave, 'script-migration-registry');
    expect(registryEntry.originalClassBeforeMigration).toBe('source_repo_governance');
    expect(registryEntry.deletionAllowed).toBe(false);

    const mainAgentEntry = getEntry(mainAgentWave, 'main-agent-orchestration');
    expect(mainAgentWave.status).toBe('validated');
    expect(mainAgentEntry.originalPath).toBe('scripts/main-agent-orchestration.ts');
    expect(mainAgentEntry.migrationStrategy).toBe('package_runtime_module');
    expect(mainAgentEntry.migrationStatus).toBe('validated');
    expect(mainAgentEntry.validationStatus).toBe('passed');
    expect(mainAgentEntry.oldPathDisposition).toBe('retained_source_dev_only');
    expect(mainAgentEntry.deletionAllowed).toBe(false);
    expect(mainAgentEntry.deletionApprovalRef).toBeNull();
  });

  it('allows pre-evidence bootstrap state only when no entry claims validated or passed', () => {
    const registry = readRegistry();
    const claimsValidated = registry.waves.flatMap((wave: any) =>
      wave.entries.filter(
        (entry: any) =>
          (entry.migrationStatus === 'validated' || entry.validationStatus === 'passed') &&
          (!Array.isArray(entry.evidenceRefs) || entry.evidenceRefs.length === 0)
      )
    );
    expect(claimsValidated).toHaveLength(0);

    if (fs.existsSync(EVIDENCE_PATH)) {
      const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
      expect(evidence.waveId).toBe('script-migration-registry-bootstrap');
      const commands = evidence.entries.flatMap((entry: any) => entry.commands);
      for (const commandId of ['CMD-03', 'CMD-04', 'CMD-05', 'CMD-06']) {
        expect(commands.some((command: any) => String(command.command).includes(commandId))).toBe(true);
      }
      for (const row of commands) {
        expect(row.exitCode).toBe(0);
        expect(row.stdoutHash).toMatch(/^sha256:/);
        expect(row.stderrHash).toMatch(/^sha256:/);
      }
    }
  });

  it('keeps repo-governance out of install-surface package manifests', () => {
    for (const manifest of [
      path.join(ROOT, 'package.json'),
      path.join(ROOT, 'packages', 'bmad-speckit', 'package.json'),
    ]) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      expect(pkg.files ?? []).not.toContain('repo-governance');
      expect(pkg.files ?? []).not.toContain('repo-governance/');
    }
  });

  it('rejects a registry path placed under _bmad', () => {
    const registry = readRegistry();
    const dir = tempDir();
    const fixturePath = path.join(dir, '_bmad', 'script-migration-registry.yaml');
    writeYaml(fixturePath, registry);
    const result = runValidator(['--registry', fixturePath]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('_bmad');
  });

  it('rejects a registry marked as consumer runtime material', () => {
    const registry = readRegistry();
    registry.installSurface = 'included';
    registry.consumerRuntimeDependency = true;
    const fixturePath = path.join(tempDir(), 'script-migration-registry.yaml');
    writeYaml(fixturePath, registry);
    const result = runValidator(['--registry', fixturePath]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('installSurface');
  });

  it('rejects repo-governance leakage in a synthetic pack list fixture', () => {
    const fixturePath = path.join(tempDir(), 'leaking-pack-list.json');
    fs.writeFileSync(
      fixturePath,
      JSON.stringify(
        [
          {
            files: [{ path: 'repo-governance/script-migration-registry.yaml' }],
          },
        ],
        null,
        2
      ),
      'utf8'
    );
    const result = runValidator(['--check-pack-exclusion', '--pack-list-fixture', fixturePath]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('repo-governance');
  });

  it('rejects deletionAllowed without an approval reference in a temp registry fixture', () => {
    const registry = readRegistry();
    registry.waves[0].entries[0].deletionAllowed = true;
    registry.waves[0].entries[0].deletionApprovalRef = null;
    const fixturePath = path.join(tempDir(), 'script-migration-registry.yaml');
    writeYaml(fixturePath, registry);
    const result = runValidator(['--registry', fixturePath]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('deletionApprovalRef');
  });

  it('passes the canonical registry validator once registry infrastructure exists', () => {
    const result = runValidator();
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain('"status":"passed"');
  });
});
