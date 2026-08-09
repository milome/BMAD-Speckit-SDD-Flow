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

function sourceInputManifestHash(packageRoot: string, manifest: JsonRecord): string {
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const sources = [
    ...new Set(
      entries.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const source = String((entry as JsonRecord).source ?? '');
        return source ? [source] : [];
      })
    ),
  ]
    .map((relativePath) => {
      const absolutePath = path.resolve(packageRoot, relativePath);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new Error(`runtime_build_authority_source_missing:${relativePath}`);
      }
      return {
        path: relativePath.replace(/\\/gu, '/'),
        sourceBytesHash: sourceBytesHash(fs.readFileSync(absolutePath)),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  return canonicalObjectHash(sources);
}

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
  const preimage = {
    schemaVersion: 'bmad-speckit-runtime-build-authority/v1' as const,
    hashDomainRegistry: requirementsContractHashDomainRegistry(),
    sourceInputManifestHash: sourceInputManifestHash(packageRoot, manifest),
    buildScriptHash: sourceBytesHash(fs.readFileSync(buildScriptPath)),
    dependencyLockHash: sourceBytesHash(fs.readFileSync(dependencyLockPath)),
    runtimeAssetManifestHash: distManifestHash(manifest),
    distRuntimeHash: distRuntimeHashFor(packageRoot),
    packageRuntimeHash: packageRuntimeHashFor(packageRoot),
    decision: 'pass' as const,
  };
  return {
    ...preimage,
    distBuildHash: canonicalObjectHash(preimage),
  };
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
