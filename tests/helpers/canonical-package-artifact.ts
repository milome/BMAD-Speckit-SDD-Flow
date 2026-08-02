import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const {
  preparePackageArtifact,
  validatePackageDescriptor,
} = require('../../tools/ci/prepare-package-artifact.cjs');
const { readCanonicalArtifact } = require('../../tools/ci/canonical-artifact.cjs');

let localTarballPath: string | undefined;
const LOCAL_DESCRIPTOR = '.artifacts/test-portfolio/package/canonical-package.json';
const LOCAL_PREPARE_LOCK = '.artifacts/test-portfolio/package.prepare.lock';
const LOCAL_PREPARE_TIMEOUT_MS = 15 * 60 * 1000;
const waitArray = new Int32Array(new SharedArrayBuffer(4));

type PackageDescriptor = {
  commitSha: string;
  tarballPath: string;
};

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

function requiredExistingPath(value: string, code: string): string {
  const target = isAbsolute(value) ? value : resolve(process.cwd(), value);
  if (!existsSync(target)) throw new Error(code);
  return target;
}

function canonicalPath(value: string): string {
  const realPath = realpathSync(value);
  return process.platform === 'win32' ? realPath.toLowerCase() : realPath;
}

function currentCommitSha(repoRoot: string, fallback?: string): string {
  const configured = process.env.CI_COMMIT_SHA?.trim().toLowerCase();
  if (configured && /^[0-9a-f]{40}$/u.test(configured)) return configured;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase();
  } catch {
    if (fallback && /^[0-9a-f]{40}$/u.test(fallback)) return fallback;
    throw new Error('CANONICAL_PACKAGE_COMMIT_REQUIRED');
  }
}

function readValidatedDescriptor(
  repoRoot: string,
  descriptorPath: string,
  commitSha: string
): PackageDescriptor {
  const descriptor = readCanonicalArtifact({
    repoRoot,
    filePath: descriptorPath,
  }).artifact as PackageDescriptor;
  validatePackageDescriptor({
    repoRoot,
    descriptor,
    descriptorPath,
    expectedCommitSha: commitSha,
  });
  return descriptor;
}

function tryExistingLocalTarball(repoRoot: string, commitSha: string): string | undefined {
  const descriptorPath = resolve(repoRoot, LOCAL_DESCRIPTOR);
  if (!existsSync(descriptorPath)) return undefined;
  try {
    const descriptor = readValidatedDescriptor(repoRoot, descriptorPath, commitSha);
    return resolve(repoRoot, descriptor.tarballPath);
  } catch {
    return undefined;
  }
}

function withLocalPreparationLock<T>(repoRoot: string, action: () => T): T {
  const lockPath = resolve(repoRoot, LOCAL_PREPARE_LOCK);
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + LOCAL_PREPARE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let descriptor: number;
    try {
      descriptor = openSync(lockPath, 'wx');
    } catch (error: unknown) {
      if (
        !['EEXIST', 'EACCES', 'EPERM'].includes(errorCode(error) || '') ||
        !existsSync(lockPath)
      ) {
        throw error;
      }
      Atomics.wait(waitArray, 0, 0, 100);
      continue;
    }
    let result: T | undefined;
    let actionError: unknown;
    try {
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid })}\n`, 'utf8');
      result = action();
    } catch (error: unknown) {
      actionError = error;
    }
    let cleanupError: unknown;
    try {
      closeSync(descriptor);
      unlinkSync(lockPath);
    } catch (error: unknown) {
      if (errorCode(error) !== 'ENOENT') cleanupError = error;
    }
    if (actionError) throw actionError;
    if (cleanupError) throw cleanupError;
    return result as T;
  }
  throw new Error('CANONICAL_PACKAGE_PREPARATION_TIMEOUT');
}

export function resolveCanonicalPackageTarball(repoRoot: string): string {
  const configuredTarball = process.env.BMAD_SPECKIT_TARBALL;
  if (configuredTarball) {
    const tarballPath = requiredExistingPath(
      configuredTarball,
      'CANONICAL_PACKAGE_TARBALL_MISSING'
    );
    const descriptorPath = process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR;
    if (descriptorPath) {
      const resolvedDescriptorPath = requiredExistingPath(
        descriptorPath,
        'CANONICAL_PACKAGE_DESCRIPTOR_MISSING'
      );
      const storedDescriptor = readCanonicalArtifact({
        repoRoot,
        filePath: resolvedDescriptorPath,
      }).artifact as PackageDescriptor;
      const commitSha = currentCommitSha(repoRoot, storedDescriptor.commitSha);
      const descriptor = readValidatedDescriptor(repoRoot, resolvedDescriptorPath, commitSha);
      const descriptorTarball = requiredExistingPath(
        resolve(repoRoot, descriptor.tarballPath),
        'CANONICAL_PACKAGE_TARBALL_MISSING'
      );
      if (canonicalPath(tarballPath) !== canonicalPath(descriptorTarball)) {
        throw new Error('CANONICAL_PACKAGE_TARBALL_DESCRIPTOR_MISMATCH');
      }
    } else if (process.env.CI || process.env.CI_RUN_MANIFEST) {
      throw new Error('CANONICAL_PACKAGE_DESCRIPTOR_REQUIRED');
    }
    return tarballPath;
  }

  if (process.env.CI || process.env.CI_RUN_MANIFEST) {
    throw new Error('CANONICAL_PACKAGE_TARBALL_REQUIRED');
  }
  if (localTarballPath) return localTarballPath;
  const commitSha = currentCommitSha(repoRoot);
  const existing = tryExistingLocalTarball(repoRoot, commitSha);
  if (existing) {
    localTarballPath = existing;
    return localTarballPath;
  }
  localTarballPath = withLocalPreparationLock(repoRoot, () => {
    const preparedByPeer = tryExistingLocalTarball(repoRoot, commitSha);
    if (preparedByPeer) return preparedByPeer;
    const prepared = preparePackageArtifact({ repoRoot, commitSha });
    return resolve(repoRoot, prepared.tarballPath);
  });
  return localTarballPath;
}

export default function prepareCanonicalPackageForVitest(): void {
  if (process.env.BMAD_SPECKIT_TARBALL) return;
  const repoRoot = process.cwd();
  const tarballPath = resolveCanonicalPackageTarball(repoRoot);
  const descriptorPath = resolve(repoRoot, LOCAL_DESCRIPTOR);
  process.env.BMAD_SPECKIT_TARBALL = tarballPath;
  process.env.BMAD_SPECKIT_PACKAGE_DESCRIPTOR = descriptorPath;
}
