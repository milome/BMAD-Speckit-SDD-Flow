import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type SourceObligationId = `S${string}`;

export interface EvidenceClosureExploitCase {
  caseId: string;
  exploitClass: string;
  expectedTerminalState: 'blocked' | 'unresolved' | 'expected_red';
  expectedIssueCode: string;
  sourceObligationIds: SourceObligationId[];
  sourceHash: string;
  source: Record<string, unknown>;
}

export interface EvidenceClosureExploitCorpus {
  schemaVersion: 'requirements-contract-evidence-closure-exploit-corpus/v1';
  cases: EvidenceClosureExploitCase[];
}

export interface BaselineFileEntry {
  path: string;
  pathRole: string;
  tracked: boolean;
  dirtyClass: string;
  exists: boolean;
  fileType: string;
  bytes: number;
  sha256: string;
}

export interface BaselineRepositoryIdentity {
  gitHeadSha: string;
  branch: string;
  repositoryRootHash: string;
  contractPath: string;
  contractHash: string;
  gitStatusPorcelainV2Hash: string;
  dependencyLockHashes: Array<{
    path: string;
    sha256: string;
  }>;
  nodeVersion: string;
  platform: string;
  architecture: string;
}

export interface BaselineFileIndex {
  schemaVersion: 'requirements-contract-g00-baseline-file-index/v1';
  capturedAt: string;
  hashDomains: Record<string, string>;
  repositoryIdentity: BaselineRepositoryIdentity;
  summary: {
    entryCount: number;
    trackedCount: number;
    untrackedCount: number;
    trackedCleanCount: number;
    trackedDirtyCount: number;
    preExistingDirtyCount: number;
    missingTrackedCount: number;
    pathSetHash: string;
    fileIndexHash: string;
    preExistingDirtyPathHashesHash: string;
    baselineSnapshotHash: string;
  };
  preExistingDirtyPaths: Array<{
    path: string;
    dirtyClass: string;
    pathRole: string;
    exists: boolean;
    bytes: number;
    sha256: string;
  }>;
  entries: BaselineFileEntry[];
}

export interface LoadedBaselineFileIndex extends BaselineFileIndex {
  hashText(value: string): string;
  hashJson(value: unknown): string;
}

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, '../../..');

export const exploitCorpusPath = path.join(
  repositoryRoot,
  'tests',
  'acceptance',
  'fixtures',
  'requirements-contract-evidence-closure',
  'exploit-cases.json'
);

export const baselineFileIndexPath = path.join(
  repositoryRoot,
  'tests',
  'acceptance',
  'fixtures',
  'requirements-contract-evidence-closure',
  'baseline-file-index.json'
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

export function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function sha256CanonicalJson(value: unknown): string {
  return sha256Text(stableStringify(value));
}

export function sha256Json(value: unknown): string {
  return sha256Text(JSON.stringify(value));
}

export function loadExploitCorpus(): EvidenceClosureExploitCorpus {
  return readJson<EvidenceClosureExploitCorpus>(exploitCorpusPath);
}

export function loadBaselineFileIndex(): LoadedBaselineFileIndex {
  const baseline = readJson<BaselineFileIndex>(baselineFileIndexPath);
  return {
    ...baseline,
    hashText: sha256Text,
    hashJson: sha256Json,
  };
}
