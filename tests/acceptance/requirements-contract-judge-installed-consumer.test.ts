import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const CLI_ENTRY = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const ACTION_MANIFEST = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'source-authority');
const PACKAGE_MIRROR_ROOT = path.join(PACKAGE_ROOT, '_bmad', 'shared', 'requirements-contract');
const CONSUMER_SURFACE_ROOTS = [
  '_bmad/shared/requirements-contract',
  '.codex/shared/requirements-contract',
  '.cursor/shared/requirements-contract',
  '.claude/shared/requirements-contract',
  'packages/bmad-speckit/_bmad/shared/requirements-contract',
];

const runtimeModules = [
  'scripts/requirements-contract-judge-provider-registry.js',
  'scripts/requirements-contract-judge-credential-resolver.js',
  'scripts/requirements-contract-openai-compatible-judge-adapter.js',
  'scripts/requirements-contract-anthropic-compatible-judge-adapter.js',
];

describe('requirements contract judge installed consumer surface', () => {
  it('packages the built Judge runtime and package _bmad mirror for installed consumers', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
      files: string[];
      scripts: Record<string, string>;
    };

    expect(pkg.files).toContain('dist/');
    expect(pkg.files).toContain('_bmad/');
    expect(pkg.scripts.prepack).toContain('build:main-agent-dist');
    expect(pkg.scripts.prepack).toContain('prepublish-check.cjs');
    for (const relativePath of runtimeModules) {
      expect(existsSync(path.join(DIST_ROOT, relativePath)), relativePath).toBe(true);
    }
  });

  it('binds installed Judge CLI routing to the runtime action manifest', () => {
    const cli = readFileSync(CLI_ENTRY, 'utf8');
    const manifest = JSON.parse(readFileSync(ACTION_MANIFEST, 'utf8')) as {
      actions: Array<{
        actionId: string;
        semanticGate: { sourceSymbol: string; distSymbol: string };
        runtimeRefs: Array<{ role: string; packagePath: string }>;
      }>;
    };
    const action = manifest.actions.find(
      (entry) => entry.actionId === 'requirements-contract-judge-run'
    );

    expect(cli).toContain(".command('judge')");
    expect(cli).toContain(".command('run')");
    expect(cli).toContain('runJudgePublicCommand');
    expect(cli).not.toContain(".command('requirements-contract-judge-run')");
    expect(action).toBeDefined();
    expect(action?.semanticGate).toMatchObject({
      sourceSymbol: 'requirementsContractJudgeRunCommand',
      distSymbol: 'requirementsContractJudgeRunCommand',
    });
    expect(action?.runtimeRefs.map((ref) => ref.role)).toEqual(
      expect.arrayContaining([
        'judge-provider-registry',
        'judge-credential-resolver',
        'openai-compatible-judge-adapter',
        'anthropic-compatible-judge-adapter',
        'claude-code-cli-judge-adapter',
        'codex-cli-judge-adapter',
      ])
    );
    expect(manifest.actions.some((entry) => entry.actionId === 'judge-run')).toBe(false);
  });

  it('projects the active Judge provider registry to every consumer host surface plus package mirror', () => {
    const registryName = 'requirements-contract-judge-provider-registry.json';
    const registries = CONSUMER_SURFACE_ROOTS.map((root) => {
      const registryPath = path.join(ROOT, root, registryName);
      expect(existsSync(registryPath), registryPath).toBe(true);
      const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
        schemaVersion: string;
        activeProviderRef: string;
        providers: Array<{ adapterRef: string }>;
        registryHash: string;
      };
      expect(registry.schemaVersion).toBe('requirements-contract-judge-provider-registry/v1');
      expect(registry.activeProviderRef).toBeTruthy();
      expect(registry.providers).toHaveLength(1);
      return { root, registry };
    });

    expect(registries.map((entry) => entry.registry.registryHash)).toEqual(
      Array(registries.length).fill(registries[0].registry.registryHash)
    );
    expect(existsSync(path.join(PACKAGE_MIRROR_ROOT, registryName))).toBe(true);
  });
});
