import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageManifest {
  name?: unknown;
  version?: unknown;
  files?: unknown;
  dependencies?: unknown;
  bundleDependencies?: unknown;
  bundledDependencies?: unknown;
}

export interface BundledRuntimePackageSummary {
  packageId: string;
  workspacePackageRoot: string;
  installedPackageRoot: string;
  fileCount: number;
}

export interface BundledRuntimeSyncResult {
  packageCount: number;
  fileCount: number;
  packages: BundledRuntimePackageSummary[];
}

function portable(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readManifest(filePath: string): PackageManifest {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`bundled_runtime_manifest_invalid:${filePath}`);
  }
  return parsed as PackageManifest;
}

function assertWithin(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`bundled_runtime_path_escape:${target}`);
  }
}

function removeTreeWithin(root: string, target: string): void {
  assertWithin(root, target);
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

function renameWithRetry(source: string, target: string): void {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (error) {
      if (
        attempt === 19 ||
        !['EPERM', 'EACCES', 'ENOTEMPTY'].includes(
          (error as NodeJS.ErrnoException).code ?? ''
        )
      ) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

function filesBelow(root: string, base = root): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return filesBelow(target, base);
    return entry.isFile() ? [portable(path.relative(base, target))] : [];
  });
}

function globPattern(value: string): RegExp {
  const escaped = portable(value)
    .replace(/[.+?^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*/gu, '[^/]*');
  return new RegExp(`^${escaped}$`, 'u');
}

function publishEntryMatches(filePath: string, entry: string): boolean {
  const normalizedEntry = portable(entry).replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (!normalizedEntry) return false;
  if (!normalizedEntry.includes('*')) {
    return filePath === normalizedEntry || filePath.startsWith(`${normalizedEntry}/`);
  }
  const matcher = globPattern(normalizedEntry);
  const segments = filePath.split('/');
  return segments.some((_segment, index) =>
    matcher.test(segments.slice(0, index + 1).join('/'))
  );
}

function selectedPublishedFiles(
  workspacePackageRoot: string,
  manifest: PackageManifest
): string[] {
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`bundled_runtime_files_manifest_missing:${manifest.name ?? ''}`);
  }
  const entries = manifest.files.map((entry) => String(entry));
  const selected = filesBelow(workspacePackageRoot).filter(
    (filePath) =>
      filePath === 'package.json' ||
      entries.some((entry) => publishEntryMatches(filePath, entry))
  );
  const forbidden = selected.filter(
    (filePath) =>
      filePath === 'src' ||
      filePath.startsWith('src/') ||
      filePath === 'tests' ||
      filePath.startsWith('tests/') ||
      filePath === 'test-nonempty' ||
      filePath.startsWith('test-nonempty/') ||
      filePath
        .split('/')
        .some(
          (segment) =>
            segment === '__tests__' || segment.startsWith('__fixtures')
        ) ||
      filePath.startsWith('node_modules/')
  );
  if (forbidden.length > 0) {
    throw new Error(
      `bundled_runtime_forbidden_publish_files:${forbidden.slice(0, 25).join(',')}`
    );
  }
  if (!selected.includes('package.json')) {
    throw new Error(`bundled_runtime_package_manifest_missing:${manifest.name ?? ''}`);
  }
  return [...new Set(selected)].sort();
}

function copyPublishedPackage(
  workspacePackageRoot: string,
  installedPackageRoot: string,
  manifest: PackageManifest
): number {
  const selected = selectedPublishedFiles(workspacePackageRoot, manifest);
  for (const relativePath of selected) {
    const source = path.join(workspacePackageRoot, relativePath);
    const target = path.join(installedPackageRoot, relativePath);
    assertWithin(workspacePackageRoot, source);
    assertWithin(installedPackageRoot, target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return selected.length;
}

function bundledPackageIds(manifest: PackageManifest): string[] {
  const raw = manifest.bundleDependencies ?? manifest.bundledDependencies;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('bundled_runtime_package_ids_missing');
  }
  const packageIds = raw.map((entry) => String(entry));
  if (
    new Set(packageIds).size !== packageIds.length ||
    packageIds.some((packageId) => !/^@bmad-speckit\/[a-z0-9-]+$/u.test(packageId))
  ) {
    throw new Error('bundled_runtime_package_ids_invalid');
  }
  return [...packageIds].sort();
}

export function syncBundledWorkspaceRuntime(input: {
  repoRoot: string;
  packageRoot: string;
}): BundledRuntimeSyncResult {
  const repoRoot = path.resolve(input.repoRoot);
  const packageRoot = path.resolve(input.packageRoot);
  const packageManifest = readManifest(path.join(packageRoot, 'package.json'));
  const dependencies =
    packageManifest.dependencies &&
    typeof packageManifest.dependencies === 'object' &&
    !Array.isArray(packageManifest.dependencies)
      ? (packageManifest.dependencies as Record<string, unknown>)
      : {};
  const packageIds = bundledPackageIds(packageManifest);
  const nodeModulesRoot = path.join(packageRoot, 'node_modules');
  const installedScopeRoot = path.join(nodeModulesRoot, '@bmad-speckit');
  const stagingRoot = path.join(
    nodeModulesRoot,
    `@bmad-speckit.staging-${process.pid}-${Date.now()}`
  );
  const backupRoot = path.join(
    nodeModulesRoot,
    `@bmad-speckit.backup-${process.pid}-${Date.now()}`
  );
  assertWithin(nodeModulesRoot, installedScopeRoot);
  assertWithin(nodeModulesRoot, stagingRoot);
  assertWithin(nodeModulesRoot, backupRoot);
  removeTreeWithin(nodeModulesRoot, stagingRoot);
  removeTreeWithin(nodeModulesRoot, backupRoot);
  fs.mkdirSync(stagingRoot, { recursive: true });

  const packages: BundledRuntimePackageSummary[] = [];
  try {
    for (const packageId of packageIds) {
      const packageName = packageId.slice('@bmad-speckit/'.length);
      const workspacePackageRoot = path.join(repoRoot, 'packages', packageName);
      const workspaceManifest = readManifest(
        path.join(workspacePackageRoot, 'package.json')
      );
      if (workspaceManifest.name !== packageId) {
        throw new Error(`bundled_runtime_workspace_owner_mismatch:${packageId}`);
      }
      if (
        typeof workspaceManifest.version !== 'string' ||
        dependencies[packageId] !== workspaceManifest.version
      ) {
        throw new Error(`bundled_runtime_workspace_version_mismatch:${packageId}`);
      }
      const installedPackageRoot = path.join(stagingRoot, packageName);
      const fileCount = copyPublishedPackage(
        workspacePackageRoot,
        installedPackageRoot,
        workspaceManifest
      );
      packages.push({
        packageId,
        workspacePackageRoot: portable(path.relative(repoRoot, workspacePackageRoot)),
        installedPackageRoot: portable(path.relative(packageRoot, installedPackageRoot)),
        fileCount,
      });
    }

    if (fs.existsSync(installedScopeRoot)) {
      renameWithRetry(installedScopeRoot, backupRoot);
    }
    try {
      renameWithRetry(stagingRoot, installedScopeRoot);
    } catch (error) {
      if (fs.existsSync(backupRoot) && !fs.existsSync(installedScopeRoot)) {
        renameWithRetry(backupRoot, installedScopeRoot);
      }
      throw error;
    }
    removeTreeWithin(nodeModulesRoot, backupRoot);
  } catch (error) {
    removeTreeWithin(nodeModulesRoot, stagingRoot);
    throw error;
  }

  return {
    packageCount: packages.length,
    fileCount: packages.reduce((total, entry) => total + entry.fileCount, 0),
    packages,
  };
}
