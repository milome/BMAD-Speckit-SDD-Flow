import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertRuntimeBuildAuthorityCurrent } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-build-authority';

const ROOT = process.cwd();
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const PREPUBLISH_CHECK = path.join(
  PACKAGE_ROOT,
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'prepublish-check.ts'
);
const ROOT_PREPUBLISH_CHECK = path.join(ROOT, 'scripts', 'prepublish-check.js');
const DIST_RUNTIME_MANIFEST = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'runtime-asset-manifest.json'
);
const DIST_AUTHORITY_RECEIPT = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'runtime-build-authority-receipt.json'
);

function sha256(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function gitNullList(args: string[]): string[] {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.replace(/\\/gu, '/'));
}

function gitNullListForPaths(prefix: string[], paths: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < paths.length; index += 100) {
    values.push(...gitNullList([...prefix, '--', ...paths.slice(index, index + 100)]));
  }
  return values;
}

describe.sequential('runtime build single producer authority', () => {
  it('binds the dist runtime receipt to build-main-agent-dist as the current producer', () => {
    const receipt = readJson(DIST_AUTHORITY_RECEIPT);
    const baseReceipt = Object.fromEntries(
      [
        'schemaVersion',
        'hashDomainRegistry',
        'sourceInputManifestHash',
        'buildScriptHash',
        'dependencyLockHash',
        'runtimeAssetManifestHash',
        'distRuntimeHash',
        'packageRuntimeHash',
        'decision',
        'distBuildHash',
      ].map((key) => [key, receipt[key]])
    );

    const current = assertRuntimeBuildAuthorityCurrent({
      receipt: baseReceipt,
      packageRoot: PACKAGE_ROOT,
      runtimeAssetManifestPath: DIST_RUNTIME_MANIFEST,
      buildScriptPath: BUILD_SCRIPT,
      dependencyLockPath: path.join(ROOT, 'package-lock.json'),
    });

    expect(current.decision).toBe('pass');
    expect(current.buildScriptHash).toBe(sha256(readFileSync(BUILD_SCRIPT)));
    expect(receipt.packageAssetCount).toBeGreaterThan(0);
    expect(
      (receipt.packageAssetEntries as Array<{ owner: string }>).every(
        (entry) => entry.owner === 'package-root-_bmad'
      )
    ).toBe(true);
  });

  it('pins raw build authority inputs to LF across clean Windows worktrees', () => {
    const receipt = readJson(DIST_AUTHORITY_RECEIPT);
    const runtimeManifest = readJson(DIST_RUNTIME_MANIFEST) as {
      entries: Array<{ source: string }>;
    };
    const packageAuthorityPaths = [
      ...new Set(
        [
          ...(receipt.packageAssetEntries as Array<{
            source: string;
          }>).map((entry) => entry.source),
          'package-lock.json',
        ]
      ),
    ].sort();
    const runtimeSourcePaths = runtimeManifest.entries.map((entry) =>
      path
        .relative(ROOT, path.resolve(PACKAGE_ROOT, entry.source))
        .replace(/\\/gu, '/')
    );
    const declaredPaths = [...new Set([...packageAuthorityPaths, ...runtimeSourcePaths])].sort();
    const trackedPaths = [
      ...new Set(gitNullListForPaths(['ls-files', '-z'], declaredPaths)),
    ].sort();
    const trackedPathSet = new Set(trackedPaths);
    for (const packageAuthorityPath of packageAuthorityPaths) {
      expect(
        trackedPathSet.has(packageAuthorityPath),
        `build authority source must be tracked: ${packageAuthorityPath}`
      ).toBe(true);
    }

    const attributeOutput = gitNullListForPaths(
      ['check-attr', '-z', 'eol'],
      trackedPaths
    );
    const attributeValues = new Map<string, string>();
    for (let index = 0; index + 2 < attributeOutput.length; index += 3) {
      attributeValues.set(attributeOutput[index], attributeOutput[index + 2]);
    }

    for (const trackedPath of trackedPaths) {
      expect(
        attributeValues.get(trackedPath),
        `${trackedPath} must use eol=lf because build authority hashes bind raw bytes`
      ).toBe('lf');
    }
  });

  it('accepts package-scoped receipt extensions while validating core authority', () => {
    const receipt = readJson(DIST_AUTHORITY_RECEIPT);

    const current = assertRuntimeBuildAuthorityCurrent({
      receipt,
      packageRoot: PACKAGE_ROOT,
      runtimeAssetManifestPath: DIST_RUNTIME_MANIFEST,
      buildScriptPath: BUILD_SCRIPT,
      dependencyLockPath: path.join(ROOT, 'package-lock.json'),
    });

    expect(current.decision).toBe('pass');
  });

  it('keeps prepublish as a readonly receipt verifier rather than a second package _bmad producer', () => {
    const source = readFileSync(PREPUBLISH_CHECK, 'utf8');

    expect(source).toContain('package `_bmad` 只能由 build-main-agent-dist.cjs 生成');
    expect(source).toContain('assertRuntimeBuildAuthorityCurrent');
    expect(source).toContain('verifyBmadMirror');
    expect(source).not.toContain('removeTree(SPECKIT_BMAD_MIRROR');
    expect(source).not.toContain('copyRecursive(repositoryBmadRoot');
  });

  it('delegates root prepublish to the canonical readonly package runtime', () => {
    const source = readFileSync(ROOT_PREPUBLISH_CHECK, 'utf8');

    expect(source).toContain('PACKAGE_PREPUBLISH_WRAPPER');
    expect(source).toContain("'prepublish-check.cjs'");
    expect(source).toContain('require(PACKAGE_PREPUBLISH_WRAPPER)');
    expect(source).not.toContain('syncBmadMirror();');
  });
});
