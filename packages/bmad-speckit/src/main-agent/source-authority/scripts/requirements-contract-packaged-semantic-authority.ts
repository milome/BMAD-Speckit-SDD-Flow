import * as fs from 'node:fs';
import * as path from 'node:path';
import { canonicalObjectHash, sourceBytesHash } from './requirements-contract-hash-domains';

const MANIFEST_SCHEMA = 'requirements-contract-packaged-semantic-authority/v1' as const;
const RECEIPT_SCHEMA = 'requirements-contract-packaged-semantic-authority-receipt/v1' as const;
const SHA256_HASH = /^sha256:[a-f0-9]{64}$/u;

export const PACKAGED_SEMANTIC_AUTHORITY_MANIFEST_RELATIVE_PATH =
  'dist/main-agent/requirements-contract-semantic-authority-manifest.json';
export const PACKAGED_SEMANTIC_AUTHORITY_RECEIPT_RELATIVE_PATH =
  'dist/main-agent/requirements-contract-semantic-authority-receipt.json';

export interface PackagedSemanticAuthorityEntryInput {
  moduleId: string;
  sourcePath: string;
  distPath: string;
}

export interface PackagedSemanticAuthorityEntry extends PackagedSemanticAuthorityEntryInput {
  sourceHash: string;
  distHash: string;
  packageVersion: string;
}

export interface PackagedSemanticAuthorityManifest {
  schemaVersion: typeof MANIFEST_SCHEMA;
  packageName: string;
  packageVersion: string;
  entries: PackagedSemanticAuthorityEntry[];
  entrySetHash: string;
  manifestHash: string;
}

export interface PackagedSemanticAuthorityReceipt {
  schemaVersion: typeof RECEIPT_SCHEMA;
  packageName: string;
  packageVersion: string;
  manifestHash: string;
  entrySetHash: string;
  receiptHash: string;
  decision: 'pass';
}

export interface PackagedSemanticModuleIdentity {
  id: string;
  hash: string;
  sourcePath: string;
  distPath: string;
  packageVersion: string;
}

interface JsonRecord {
  [key: string]: unknown;
}

function record(value: unknown, errorCode: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value as JsonRecord;
}

function readJson(filePath: string): JsonRecord {
  return record(
    JSON.parse(fs.readFileSync(filePath, 'utf8')),
    'packaged_semantic_authority_json_invalid'
  );
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function assertPackageRelativePath(value: string, label: string): string {
  const normalized = slash(value);
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`packaged_semantic_authority_${label}_path_invalid:${normalized}`);
  }
  return normalized;
}

function relativePackagePath(packageRoot: string, value: string): string {
  const relativePath = slash(path.relative(packageRoot, path.resolve(packageRoot, value)));
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`packaged_semantic_authority_path_outside_package:${value}`);
  }
  return relativePath;
}

function packageMetadata(packageRoot: string): { name: string; version: string } {
  const packageJson = readJson(path.join(packageRoot, 'package.json'));
  const name = String(packageJson.name ?? '');
  const version = String(packageJson.version ?? '');
  if (!name || !version) throw new Error('packaged_semantic_authority_package_metadata_invalid');
  return { name, version };
}

function normalizeEntry(entry: PackagedSemanticAuthorityEntry): PackagedSemanticAuthorityEntry {
  return {
    moduleId: String(entry.moduleId),
    sourcePath: assertPackageRelativePath(String(entry.sourcePath), 'source'),
    distPath: assertPackageRelativePath(String(entry.distPath), 'dist'),
    sourceHash: String(entry.sourceHash),
    distHash: String(entry.distHash),
    packageVersion: String(entry.packageVersion),
  };
}

function validateEntry(entry: unknown): PackagedSemanticAuthorityEntry {
  const value = record(entry, 'packaged_semantic_authority_entry_invalid');
  const normalized = normalizeEntry(value as unknown as PackagedSemanticAuthorityEntry);
  if (
    !normalized.moduleId ||
    !normalized.sourcePath ||
    !normalized.distPath ||
    !SHA256_HASH.test(normalized.sourceHash) ||
    !SHA256_HASH.test(normalized.distHash) ||
    !normalized.packageVersion
  ) {
    throw new Error(`packaged_semantic_authority_entry_invalid:${normalized.moduleId}`);
  }
  return normalized;
}

function validateManifest(value: unknown): PackagedSemanticAuthorityManifest {
  const manifest = record(value, 'packaged_semantic_authority_manifest_invalid');
  if (manifest.schemaVersion !== MANIFEST_SCHEMA || !Array.isArray(manifest.entries)) {
    throw new Error('packaged_semantic_authority_manifest_invalid');
  }
  const entries = manifest.entries
    .map(validateEntry)
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  if (new Set(entries.map((entry) => entry.moduleId)).size !== entries.length) {
    throw new Error('packaged_semantic_authority_module_id_duplicate');
  }
  const entrySetHash = canonicalObjectHash(entries);
  if (manifest.entrySetHash !== entrySetHash) {
    throw new Error('packaged_semantic_authority_entry_set_hash_mismatch');
  }
  const core = {
    schemaVersion: MANIFEST_SCHEMA,
    packageName: String(manifest.packageName ?? ''),
    packageVersion: String(manifest.packageVersion ?? ''),
    entries,
    entrySetHash,
  };
  if (
    !core.packageName ||
    !core.packageVersion ||
    entries.some((entry) => entry.packageVersion !== core.packageVersion)
  ) {
    throw new Error('packaged_semantic_authority_package_version_binding_mismatch');
  }
  const manifestHash = canonicalObjectHash(core);
  if (manifest.manifestHash !== manifestHash) {
    throw new Error('packaged_semantic_authority_manifest_hash_mismatch');
  }
  return { ...core, manifestHash };
}

function validateReceipt(value: unknown): PackagedSemanticAuthorityReceipt {
  const receipt = record(value, 'packaged_semantic_authority_receipt_invalid');
  if (
    receipt.schemaVersion !== RECEIPT_SCHEMA ||
    receipt.decision !== 'pass' ||
    !SHA256_HASH.test(String(receipt.manifestHash ?? '')) ||
    !SHA256_HASH.test(String(receipt.entrySetHash ?? '')) ||
    !SHA256_HASH.test(String(receipt.receiptHash ?? ''))
  ) {
    throw new Error('packaged_semantic_authority_receipt_invalid');
  }
  const core = {
    schemaVersion: RECEIPT_SCHEMA,
    packageName: String(receipt.packageName ?? ''),
    packageVersion: String(receipt.packageVersion ?? ''),
    manifestHash: String(receipt.manifestHash),
    entrySetHash: String(receipt.entrySetHash),
    decision: 'pass' as const,
  };
  if (receipt.receiptHash !== canonicalObjectHash(core)) {
    throw new Error('packaged_semantic_authority_receipt_hash_mismatch');
  }
  return { ...core, receiptHash: String(receipt.receiptHash) };
}

export function packagedSemanticAuthorityPaths(packageRoot: string) {
  const root = path.resolve(packageRoot);
  return {
    manifestPath: path.join(root, PACKAGED_SEMANTIC_AUTHORITY_MANIFEST_RELATIVE_PATH),
    receiptPath: path.join(root, PACKAGED_SEMANTIC_AUTHORITY_RECEIPT_RELATIVE_PATH),
  };
}

export function writePackagedSemanticAuthorityArtifacts(input: {
  packageRoot: string;
  packageVersion: string;
  entries: PackagedSemanticAuthorityEntryInput[];
}) {
  const packageRoot = path.resolve(input.packageRoot);
  const metadata = packageMetadata(packageRoot);
  if (metadata.version !== input.packageVersion) {
    throw new Error('packaged_semantic_authority_package_version_mismatch');
  }
  const entries = input.entries
    .map((entry) => {
      const sourcePath = relativePackagePath(packageRoot, entry.sourcePath);
      const distPath = relativePackagePath(packageRoot, entry.distPath);
      const sourceFile = path.join(packageRoot, sourcePath);
      const distFile = path.join(packageRoot, distPath);
      if (!fs.statSync(sourceFile).isFile()) {
        throw new Error(`packaged_semantic_authority_source_missing:${sourcePath}`);
      }
      if (!fs.statSync(distFile).isFile()) {
        throw new Error(`packaged_semantic_authority_dist_missing:${distPath}`);
      }
      return {
        moduleId: String(entry.moduleId),
        sourcePath,
        distPath,
        sourceHash: sourceBytesHash(fs.readFileSync(sourceFile)),
        distHash: sourceBytesHash(fs.readFileSync(distFile)),
        packageVersion: input.packageVersion,
      };
    })
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  const entrySetHash = canonicalObjectHash(entries);
  const manifestCoreValue = {
    schemaVersion: MANIFEST_SCHEMA,
    packageName: metadata.name,
    packageVersion: input.packageVersion,
    entries,
    entrySetHash,
  };
  const manifest: PackagedSemanticAuthorityManifest = {
    ...manifestCoreValue,
    manifestHash: canonicalObjectHash(manifestCoreValue),
  };
  const receiptCoreValue = {
    schemaVersion: RECEIPT_SCHEMA,
    packageName: metadata.name,
    packageVersion: input.packageVersion,
    manifestHash: manifest.manifestHash,
    entrySetHash,
    decision: 'pass' as const,
  };
  const receipt: PackagedSemanticAuthorityReceipt = {
    ...receiptCoreValue,
    receiptHash: canonicalObjectHash(receiptCoreValue),
  };
  const paths = packagedSemanticAuthorityPaths(packageRoot);
  fs.mkdirSync(path.dirname(paths.manifestPath), { recursive: true });
  fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { ...paths, manifest, receipt };
}

export function resolvePackagedSemanticModuleIdentity(input: {
  packageRoot: string;
  moduleId: string;
  manifestPath?: string;
  receiptPath?: string;
}): PackagedSemanticModuleIdentity {
  const packageRoot = path.resolve(input.packageRoot);
  const paths = packagedSemanticAuthorityPaths(packageRoot);
  const manifestPath = path.resolve(input.manifestPath ?? paths.manifestPath);
  const receiptPath = path.resolve(input.receiptPath ?? paths.receiptPath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error('packaged_semantic_authority_manifest_missing');
  }
  if (!fs.existsSync(receiptPath)) {
    throw new Error('packaged_semantic_authority_receipt_missing');
  }
  const manifest = validateManifest(readJson(manifestPath));
  const receipt = validateReceipt(readJson(receiptPath));
  const metadata = packageMetadata(packageRoot);
  if (
    manifest.packageName !== metadata.name ||
    manifest.packageVersion !== metadata.version ||
    receipt.packageName !== metadata.name ||
    receipt.packageVersion !== metadata.version ||
    receipt.manifestHash !== manifest.manifestHash ||
    receipt.entrySetHash !== manifest.entrySetHash
  ) {
    throw new Error('packaged_semantic_authority_package_binding_mismatch');
  }
  const entry = manifest.entries.find((candidate) => candidate.moduleId === input.moduleId);
  if (!entry) throw new Error(`packaged_semantic_authority_module_missing:${input.moduleId}`);
  const distPath = path.resolve(packageRoot, entry.distPath);
  if (!fs.existsSync(distPath) || !fs.statSync(distPath).isFile()) {
    throw new Error(`packaged_semantic_authority_dist_missing:${entry.distPath}`);
  }
  if (sourceBytesHash(fs.readFileSync(distPath)) !== entry.distHash) {
    throw new Error(`packaged_semantic_authority_dist_hash_mismatch:${entry.distPath}`);
  }
  return {
    id: entry.moduleId,
    hash: entry.sourceHash,
    sourcePath: entry.sourcePath,
    distPath: entry.distPath,
    packageVersion: entry.packageVersion,
  };
}

export function packageRootFromRuntimeModule(moduleDirectory: string): string {
  return path.resolve(moduleDirectory, '../../../..');
}
