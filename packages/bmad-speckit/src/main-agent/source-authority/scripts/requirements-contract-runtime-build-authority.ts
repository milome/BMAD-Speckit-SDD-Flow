import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  canonicalObjectHash,
  distManifestHash,
  requirementsContractHashDomainRegistry,
  sourceBytesHash,
} from './requirements-contract-hash-domains';
import {
  distRuntimeHashFor,
  packageRuntimeHashFor,
} from './requirements-contract-package-runtime-index';

type JsonRecord = Record<string, unknown>;
const SHA256_HASH = /^sha256:[a-f0-9]{64}$/u;

export interface RuntimeBuildAuthorityReceipt {
  schemaVersion: 'bmad-speckit-runtime-build-authority/v1';
  hashDomainRegistry: ReturnType<typeof requirementsContractHashDomainRegistry>;
  sourceInputManifestHash: string;
  buildScriptHash: string;
  dependencyLockHash: string;
  runtimeAssetManifestHash: string;
  distRuntimeHash: string;
  packageRuntimeHash: string;
  distBuildHash: string;
  decision: 'pass';
}

const RUNTIME_BUILD_AUTHORITY_CORE_KEYS = [
  'schemaVersion',
  'hashDomainRegistry',
  'sourceInputManifestHash',
  'buildScriptHash',
  'dependencyLockHash',
  'runtimeAssetManifestHash',
  'distRuntimeHash',
  'packageRuntimeHash',
  'distBuildHash',
  'decision',
] as const;

function readJson(filePath: string): JsonRecord {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`runtime_build_authority_json_invalid:${filePath}`);
  }
  return parsed as JsonRecord;
}

function sourceInputManifestEntries(manifest: JsonRecord): Array<{
  path: string;
  sourceBytesHash: string;
}> {
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const byPath = new Map<string, string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as JsonRecord;
    const source = String(record.source ?? '').replace(/\\/gu, '/');
    if (!source) continue;
    const sourceBytesHash = String(record.sourceBytesHash ?? '');
    if (!SHA256_HASH.test(sourceBytesHash)) {
      throw new Error(`runtime_build_authority_source_hash_missing:${source}`);
    }
    const previous = byPath.get(source);
    if (previous && previous !== sourceBytesHash) {
      throw new Error(`runtime_build_authority_source_hash_conflict:${source}`);
    }
    byPath.set(source, sourceBytesHash);
  }
  return [...byPath.entries()]
    .map(([source, sourceBytesHash]) => ({ path: source, sourceBytesHash }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function sourceInputManifestHashFromPublishedManifest(manifest: JsonRecord): string {
  return canonicalObjectHash(sourceInputManifestEntries(manifest));
}

function sourceBytesHashForFile(filePath: string): string {
  return sourceBytesHash(fs.readFileSync(filePath));
}

function requiredReceiptHash(receipt: JsonRecord, key: string): string {
  const value = String(receipt[key] ?? '');
  if (!SHA256_HASH.test(value)) {
    throw new Error(`runtime_build_authority_receipt_hash_missing:${key}`);
  }
  return value;
}

function receiptRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('runtime_build_authority_receipt_invalid');
  }
  return value as JsonRecord;
}

function runtimeBuildAuthorityPreimage(input: {
  sourceInputManifestHash: string;
  buildScriptHash: string;
  dependencyLockHash: string;
  runtimeAssetManifestHash: string;
  distRuntimeHash: string;
  packageRuntimeHash: string;
}) {
  return {
    schemaVersion: 'bmad-speckit-runtime-build-authority/v1' as const,
    hashDomainRegistry: requirementsContractHashDomainRegistry(),
    sourceInputManifestHash: input.sourceInputManifestHash,
    buildScriptHash: input.buildScriptHash,
    dependencyLockHash: input.dependencyLockHash,
    runtimeAssetManifestHash: input.runtimeAssetManifestHash,
    distRuntimeHash: input.distRuntimeHash,
    packageRuntimeHash: input.packageRuntimeHash,
    decision: 'pass' as const,
  };
}

function receiptFromPreimage(
  preimage: ReturnType<typeof runtimeBuildAuthorityPreimage>
): RuntimeBuildAuthorityReceipt {
  return {
    ...preimage,
    distBuildHash: canonicalObjectHash(preimage),
  };
}

function sourceInputManifestHash(packageRoot: string, manifest: JsonRecord): string {
  const sources = sourceInputManifestEntries(manifest).map(({ path: relativePath, sourceBytesHash }) => {
    const absolutePath = path.resolve(packageRoot, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`runtime_build_authority_source_missing:${relativePath}`);
    }
    const actualSourceBytesHash = sourceBytesHashForFile(absolutePath);
    if (actualSourceBytesHash !== sourceBytesHash) {
      throw new Error(`runtime_build_authority_source_hash_mismatch:${relativePath}`);
    }
    return {
      path: relativePath,
      sourceBytesHash: actualSourceBytesHash,
    };
  });
  return canonicalObjectHash(sources);
}

/*
 * Build-time authority is intentionally source-backed. The published package
 * uses the separate packaged-runtime assertion below and never needs src/.
 */

export function createRuntimeBuildAuthorityReceipt(input: {
  packageRoot: string;
  runtimeAssetManifestPath: string;
  buildScriptPath: string;
  dependencyLockPath: string;
}): RuntimeBuildAuthorityReceipt {
  const packageRoot = path.resolve(input.packageRoot);
  const runtimeAssetManifestPath = path.resolve(input.runtimeAssetManifestPath);
  const buildScriptPath = path.resolve(input.buildScriptPath);
  const dependencyLockPath = path.resolve(input.dependencyLockPath);
  const manifest = readJson(runtimeAssetManifestPath);
  return receiptFromPreimage(
    runtimeBuildAuthorityPreimage({
      sourceInputManifestHash: sourceInputManifestHash(packageRoot, manifest),
      buildScriptHash: sourceBytesHashForFile(buildScriptPath),
      dependencyLockHash: sourceBytesHashForFile(dependencyLockPath),
      runtimeAssetManifestHash: distManifestHash(manifest),
      distRuntimeHash: distRuntimeHashFor(packageRoot),
      packageRuntimeHash: packageRuntimeHashFor(packageRoot),
    })
  );
}

export function createPackagedRuntimeBuildAuthorityReceipt(input: {
  receipt: unknown;
  packageRoot: string;
  runtimeAssetManifestPath: string;
}): RuntimeBuildAuthorityReceipt {
  const receipt = receiptRecord(input.receipt);
  const manifest = readJson(path.resolve(input.runtimeAssetManifestPath));
  return receiptFromPreimage(
    runtimeBuildAuthorityPreimage({
      sourceInputManifestHash: sourceInputManifestHashFromPublishedManifest(manifest),
      buildScriptHash: requiredReceiptHash(receipt, 'buildScriptHash'),
      dependencyLockHash: requiredReceiptHash(receipt, 'dependencyLockHash'),
      runtimeAssetManifestHash: distManifestHash(manifest),
      distRuntimeHash: distRuntimeHashFor(path.resolve(input.packageRoot)),
      packageRuntimeHash: packageRuntimeHashFor(path.resolve(input.packageRoot)),
    })
  );
}

function runtimeBuildAuthorityCoreProjection(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as JsonRecord;
  return Object.fromEntries(RUNTIME_BUILD_AUTHORITY_CORE_KEYS.map((key) => [key, record[key]]));
}

export function assertRuntimeBuildAuthorityCurrent(input: {
  receipt: unknown;
  packageRoot: string;
  runtimeAssetManifestPath: string;
  buildScriptPath: string;
  dependencyLockPath: string;
}): RuntimeBuildAuthorityReceipt {
  const expected = createRuntimeBuildAuthorityReceipt(input);
  const actualCore = runtimeBuildAuthorityCoreProjection(input.receipt);
  const expectedCore = runtimeBuildAuthorityCoreProjection(expected);
  if (
    !actualCore ||
    !expectedCore ||
    canonicalObjectHash(actualCore) !== canonicalObjectHash(expectedCore)
  ) {
    throw new Error('runtime_build_authority_receipt_stale');
  }
  return expected;
}

export function assertPackagedRuntimeBuildAuthorityCurrent(input: {
  receipt: unknown;
  packageRoot: string;
  runtimeAssetManifestPath: string;
}): RuntimeBuildAuthorityReceipt {
  const expected = createPackagedRuntimeBuildAuthorityReceipt(input);
  const actualCore = runtimeBuildAuthorityCoreProjection(input.receipt);
  const expectedCore = runtimeBuildAuthorityCoreProjection(expected);
  if (
    !actualCore ||
    !expectedCore ||
    canonicalObjectHash(actualCore) !== canonicalObjectHash(expectedCore)
  ) {
    throw new Error('runtime_build_authority_receipt_stale');
  }
  return expected;
}
