import * as fs from 'node:fs';
import * as path from 'node:path';

export type GovernanceQueueBucket = 'pending' | 'processing' | 'done' | 'failed';

export interface GovernanceRuntimeQueueItem<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  timestamp: string;
  processedAt?: string;
  result?: unknown;
  error?: string;
}

export function governanceQueueDir(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}

export function governanceQueueBucketDir(
  projectRoot: string,
  bucket: GovernanceQueueBucket
): string {
  return path.join(governanceQueueDir(projectRoot), bucket);
}

export function governancePendingQueueFilePath(projectRoot: string, id: string): string {
  return path.join(governanceQueueBucketDir(projectRoot, 'pending'), `${id}.json`);
}

export function governanceProcessingQueueFilePath(projectRoot: string, id: string): string {
  return path.join(governanceQueueBucketDir(projectRoot, 'processing'), `${id}.json`);
}

export function governanceDoneQueueFilePath(projectRoot: string, id: string): string {
  return path.join(governanceQueueBucketDir(projectRoot, 'done'), `${id}.json`);
}

export function governanceFailedQueueFilePath(projectRoot: string, id: string): string {
  return path.join(governanceQueueBucketDir(projectRoot, 'failed'), `${id}.json`);
}

export function governanceCurrentRunPath(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'current-run.json');
}

export function ensureGovernanceQueueDirs(projectRoot: string): void {
  for (const bucket of ['pending', 'processing', 'done', 'failed'] as const) {
    fs.mkdirSync(governanceQueueBucketDir(projectRoot, bucket), { recursive: true });
  }
}

export function readGovernanceCurrentRun(
  projectRoot: string
): GovernanceRuntimeQueueItem<unknown>[] {
  const file = governanceCurrentRunPath(projectRoot);
  if (!fs.existsSync(file)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GovernanceRuntimeQueueItem<unknown>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendGovernanceCurrentRun(
  projectRoot: string,
  entry: GovernanceRuntimeQueueItem<unknown>
): void {
  const file = governanceCurrentRunPath(projectRoot);
  const current = readGovernanceCurrentRun(projectRoot);
  current.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
}
