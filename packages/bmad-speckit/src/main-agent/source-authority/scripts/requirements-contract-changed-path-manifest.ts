import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;
type ChangeType = 'added' | 'modified' | 'deleted';

export interface RequirementsContractChangedPathManifestOptions {
  cwd?: string;
  contract: string;
  baseline: string;
  snapshotBeforeWrite: boolean;
  out: string;
  json?: boolean;
}

function resolveFrom(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`changed_path_manifest_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function repositoryPaths(root: string): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
    .split('\0')
    .filter(Boolean)
    .map(slash)
    .sort();
}

function pathRole(relativePath: string): string {
  if (/^(?:tests?|__tests__)\//u.test(relativePath)) return 'test';
  if (/^(?:docs?|README|CHANGELOG)/iu.test(relativePath)) return 'documentation';
  return 'implementation';
}

function contractAuthority(contract: string, relativePath: string): JsonRecord {
  const lines = contract.split(/\r?\n/u);
  const literal = `\`${relativePath}\``;
  const lineIndex = lines.findIndex((line) => line.includes(literal));
  if (lineIndex < 0) {
    return {
      requirementRefs: [],
      acceptanceRefs: [],
      traceRefs: [],
      targetRefs: [relativePath],
    };
  }
  let start = lineIndex;
  let end = lineIndex + 1;
  while (start > 0 && !/^#{2,4}\s/u.test(lines[start])) start -= 1;
  while (end < lines.length && !/^#{2,4}\s/u.test(lines[end])) end += 1;
  const section = lines.slice(start, end).join('\n');
  const refs = (pattern: RegExp) => [...new Set(section.match(pattern) ?? [])].sort();
  return {
    requirementRefs: refs(/\bS\d{3}\b/gu),
    acceptanceRefs: refs(/\bAC-\d+\b/gu),
    traceRefs: refs(/\bTR-\d+\b/gu),
    targetRefs: [relativePath],
  };
}

function baselineIndexPath(root: string, baselinePath: string, baseline: JsonRecord): string {
  const ref = baseline.baselineFileIndexRef;
  const value = typeof ref === 'string' ? ref : ref?.path;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('changed_path_manifest_baseline_file_index_ref_missing');
  }
  return path.isAbsolute(value)
    ? value
    : fs.existsSync(path.resolve(root, value))
      ? path.resolve(root, value)
      : path.resolve(path.dirname(baselinePath), value);
}

function validateManifest(manifest: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-changed-path-manifest.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  if (!validate(manifest)) {
    throw new Error(`changed_path_manifest_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
}

export async function requirementsContractChangedPathManifestCommand(
  options: RequirementsContractChangedPathManifestOptions
): Promise<JsonRecord> {
  if (options.snapshotBeforeWrite !== true) {
    throw new Error('changed_path_manifest_snapshot_before_write_required');
  }
  const root = path.resolve(options.cwd ?? process.cwd());
  const contractPath = resolveFrom(root, options.contract);
  const baselinePath = resolveFrom(root, options.baseline);
  const outputPath = resolveFrom(root, options.out);
  const baseline = readJson(baselinePath);
  const indexPath = baselineIndexPath(root, baselinePath, baseline);
  const expectedIndexHash =
    baseline.baselineFileIndexHash ??
    (typeof baseline.baselineFileIndexRef === 'object'
      ? baseline.baselineFileIndexRef.hash
      : undefined);
  if (expectedIndexHash && fileHash(indexPath) !== expectedIndexHash) {
    throw new Error('changed_path_manifest_baseline_file_index_hash_mismatch');
  }
  const baselineIndex = readJson(indexPath);
  const baselineEntries = new Map<string, JsonRecord>(
    (baselineIndex.entries ?? []).map((entry: JsonRecord) => [slash(entry.path), entry])
  );
  const excluded = new Set(
    [baselinePath, indexPath, outputPath, `${outputPath}.safe-write-receipt.json`].map((value) =>
      slash(path.relative(root, value))
    )
  );
  const candidateFileIndex = repositoryPaths(root)
    .filter((relativePath) => !excluded.has(relativePath))
    .filter((relativePath) => fs.existsSync(path.join(root, relativePath)))
    .map((relativePath) => {
      const absolutePath = path.join(root, relativePath);
      return {
        path: relativePath,
        pathRole: pathRole(relativePath),
        tracked: baselineEntries.has(relativePath),
        bytes: fs.statSync(absolutePath).size,
        hash: fileHash(absolutePath),
      };
    });
  const candidateByPath = new Map(candidateFileIndex.map((entry) => [entry.path, entry]));
  const allPaths = [...new Set([...baselineEntries.keys(), ...candidateByPath.keys()])].sort();
  const contract = fs.readFileSync(contractPath, 'utf8');
  const changedPaths = allPaths.flatMap((relativePath) => {
    const before = baselineEntries.get(relativePath);
    const after = candidateByPath.get(relativePath);
    const beforeHash = before?.sha256 ?? before?.hash ?? null;
    const afterHash = after?.hash ?? null;
    if (beforeHash === afterHash) return [];
    const changeType: ChangeType = !before ? 'added' : !after ? 'deleted' : 'modified';
    const authorityRefs = contractAuthority(contract, relativePath);
    const authorizationDecision =
      authorityRefs.requirementRefs.length > 0 ||
      authorityRefs.acceptanceRefs.length > 0 ||
      authorityRefs.traceRefs.length > 0
        ? 'pass'
        : 'block';
    return [{
      path: relativePath,
      changeType,
      pathRole: after?.pathRole ?? before?.pathRole ?? pathRole(relativePath),
      beforeHash,
      afterHash,
      authorityRefs,
      authorizationDecision,
      authorizationReasonRefs:
        authorizationDecision === 'pass' ? ['contract_declared_target'] : ['undeclared_path'],
    }];
  });
  const unauthorizedPathCount = changedPaths.filter(
    (entry) => entry.authorizationDecision !== 'pass'
  ).length;
  const candidateFileIndexHash = sha256(canonicalJson(candidateFileIndex));
  const manifest = {
    schemaVersion: 'requirements-contract-changed-path-manifest/v1',
    transactionId: baseline.transactionId,
    implementationAttemptId: baseline.implementationAttemptId,
    baselineSnapshotHash: baseline.baselineSnapshotHash,
    candidateSnapshotHash: sha256(`candidate-snapshot/v1\n${candidateFileIndexHash}\n`),
    candidateSnapshotCapturedBefore: 'CMD-21',
    candidateFileIndex,
    candidateFileIndexHash,
    gitDiffHash: sha256(canonicalJson(changedPaths)),
    changedPaths,
    untrackedPaths: changedPaths.filter((entry) => entry.changeType === 'added').map((entry) => entry.path),
    deletedPaths: changedPaths.filter((entry) => entry.changeType === 'deleted').map((entry) => entry.path),
    unauthorizedPathCount,
    decision: unauthorizedPathCount === 0 ? 'pass' : 'block',
  };
  validateManifest(manifest);
  if (unauthorizedPathCount !== 0) {
    throw new Error(`changed_path_manifest_unauthorized_paths:${JSON.stringify(changedPaths.filter(
      (entry) => entry.authorizationDecision !== 'pass'
    ).map((entry) => entry.path))}`);
  }
  writeGovernedJson(outputPath, manifest);
  if (options.json) process.stdout.write(`${JSON.stringify(manifest)}\n`);
  return manifest;
}
