import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type FileRef = {
  path: string;
  hash: string;
};

type ActionBindingManifest = {
  actions: Array<{
    actionId: string;
    sourceHandlerRef: FileRef;
    distHandlerRef: FileRef;
    packageDistRef: FileRef;
    installedSurfaceRefs: FileRef[];
  }>;
};

const ROOT = process.cwd();
const RELATIVE_MANIFEST_PATH = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const CANONICAL_PATH = path.join(ROOT, '_bmad', RELATIVE_MANIFEST_PATH);
const SURFACE_PATHS = [
  CANONICAL_PATH,
  path.join(ROOT, '.codex', RELATIVE_MANIFEST_PATH),
  path.join(ROOT, '.cursor', RELATIVE_MANIFEST_PATH),
  path.join(ROOT, '.claude', RELATIVE_MANIFEST_PATH),
  path.join(ROOT, 'packages', 'bmad-speckit', '_bmad', RELATIVE_MANIFEST_PATH),
  path.join(
    ROOT,
    'packages',
    'bmad-speckit',
    'dist',
    'main-agent',
    'source-authority',
    '_bmad',
    RELATIVE_MANIFEST_PATH
  ),
];

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function requireCanonicalManifest(): ActionBindingManifest | null {
  expect(existsSync(CANONICAL_PATH), 'canonical package runtime action manifest is missing').toBe(
    true
  );
  return existsSync(CANONICAL_PATH)
    ? (JSON.parse(readFileSync(CANONICAL_PATH, 'utf8')) as ActionBindingManifest)
    : null;
}

describe('requirements contract package runtime action binding surface parity', () => {
  it('projects the canonical manifest byte-for-byte to package and host surfaces', () => {
    const manifest = requireCanonicalManifest();
    if (!manifest) return;

    const canonicalHash = fileHash(CANONICAL_PATH);
    for (const surfacePath of SURFACE_PATHS) {
      expect(existsSync(surfacePath), `manifest surface is missing: ${surfacePath}`).toBe(true);
      if (existsSync(surfacePath)) expect(fileHash(surfacePath)).toBe(canonicalHash);
    }
  });

  it('keeps source, dist, package, and installed handler hashes bijective', () => {
    const manifest = requireCanonicalManifest();
    if (!manifest) return;

    for (const action of manifest.actions) {
      const sourcePath = path.resolve(ROOT, action.sourceHandlerRef.path);
      const distPath = path.resolve(ROOT, action.distHandlerRef.path);
      const packagePath = path.resolve(ROOT, 'packages', 'bmad-speckit', action.packageDistRef.path);

      expect(existsSync(sourcePath), `${action.actionId} source handler is missing`).toBe(true);
      expect(existsSync(distPath), `${action.actionId} dist handler is missing`).toBe(true);
      expect(existsSync(packagePath), `${action.actionId} package handler is missing`).toBe(true);
      if (existsSync(sourcePath)) expect(action.sourceHandlerRef.hash).toBe(fileHash(sourcePath));
      if (existsSync(distPath)) expect(action.distHandlerRef.hash).toBe(fileHash(distPath));
      if (existsSync(packagePath)) expect(action.packageDistRef.hash).toBe(fileHash(packagePath));
      expect(action.packageDistRef.hash).toBe(action.distHandlerRef.hash);
      expect(action.installedSurfaceRefs.length).toBeGreaterThan(0);
      expect(action.installedSurfaceRefs.every((ref) => ref.hash === action.packageDistRef.hash)).toBe(
        true
      );
    }
  });
});
