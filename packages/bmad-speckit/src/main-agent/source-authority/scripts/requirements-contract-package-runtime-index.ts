import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  installedRuntimeHash,
  sourceBytesHash,
} from './requirements-contract-hash-domains';

export interface PackageRuntimeIndexEntry {
  path: string;
  bytes: number;
  sourceBytesHash: string;
}

const RUNTIME_ROOTS = [
  'package.json',
  'bin',
  'dist',
  '_bmad',
  'node_modules/@bmad-speckit',
] as const;
const EXCLUDED_RUNTIME_PATHS = new Set([
  'dist/main-agent/runtime-build-authority-receipt.json',
]);

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function filesBelow(root: string, base = root): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return filesBelow(target, base);
    return entry.isFile() ? [target] : [];
  });
}

export function createPackageRuntimeIndex(packageRoot: string): PackageRuntimeIndexEntry[] {
  const root = path.resolve(packageRoot);
  const files = RUNTIME_ROOTS.flatMap((relativePath) =>
    filesBelow(path.join(root, relativePath))
  );
  return [...new Set(files.map((filePath) => path.resolve(filePath)))]
    .map((filePath) => {
      const relativePath = slash(path.relative(root, filePath));
      if (
        relativePath.startsWith('../') ||
        path.isAbsolute(relativePath) ||
        EXCLUDED_RUNTIME_PATHS.has(relativePath)
      ) {
        return null;
      }
      const bytes = fs.readFileSync(filePath);
      return {
        path: relativePath,
        bytes: bytes.length,
        sourceBytesHash: sourceBytesHash(bytes),
      };
    })
    .filter((entry): entry is PackageRuntimeIndexEntry => entry !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function createDistRuntimeIndex(packageRoot: string): PackageRuntimeIndexEntry[] {
  return createPackageRuntimeIndex(packageRoot).filter((entry) =>
    entry.path.startsWith('dist/')
  );
}

export function packageRuntimeHashFor(packageRoot: string): string {
  return installedRuntimeHash(createPackageRuntimeIndex(packageRoot));
}

export function distRuntimeHashFor(packageRoot: string): string {
  return installedRuntimeHash(createDistRuntimeIndex(packageRoot));
}

export function forbiddenPublishedSourceSnapshots(paths: readonly string[]): string[] {
  return paths.filter((entry) => {
    const normalized = slash(entry).replace(/^package\//u, '');
    return (
      normalized === 'src' ||
      normalized.startsWith('src/') ||
      normalized === 'tests' ||
      normalized.startsWith('tests/') ||
      normalized === 'test-nonempty' ||
      normalized.startsWith('test-nonempty/')
    );
  });
}
