import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GovernanceRerunStage } from './governance-remediation-runner';
export type GovernanceQueueBucket = 'pending' | 'processing' | 'done' | 'failed';

export interface GovernanceRuntimeQueueItem<TPayload = unknown, TResult = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  timestamp: string;
  processedAt?: string;
  result?: TResult;
  error?: string;
}

export interface GovernancePreContinuePayload {
  projectRoot?: string;
  workflow?: string;
  step?: string;
  artifactPath?: string;
  branch?: string;
  epicId?: string;
  storyId?: string;
  gate?: string;
  status?: 'pass' | 'fail';
  rerunGate?: string;
  sourceGateFailureIds?: string[];
  failures?: string[];
  deferred_gap_count?: number;
  deferred_gaps_explicit?: boolean;
  deferred_gaps?: Array<{
    gap_id?: string;
    description?: string;
    reason?: string;
    resolution_target?: string;
    owner?: string;
    status?: string;
    current_risk?: string;
    journey_refs?: string[];
    prod_path_refs?: string[];
    smoke_test_refs?: string[];
    full_e2e_refs?: string[];
    closure_note_refs?: string[];
  }>;
  removed_without_evidence?: string[];
  previous_report_path?: string | null;
  rerunChain?: GovernanceRerunStage[];
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

export function governancePreContinueQueueFilePath(projectRoot: string, id: string): string {
  return path.join(governanceQueueBucketDir(projectRoot, 'pending'), `${id}.json`);
}

export function ensureGovernanceQueueDirs(projectRoot: string): void {
  for (const bucket of ['pending', 'processing', 'done', 'failed'] as const) {
    fs.mkdirSync(governanceQueueBucketDir(projectRoot, bucket), { recursive: true });
  }
}

export function readGovernanceCurrentRun<TResult = unknown, TPayload = unknown>(
  projectRoot: string
): GovernanceRuntimeQueueItem<TPayload, TResult>[] {
  const file = governanceCurrentRunPath(projectRoot);
  if (!fs.existsSync(file)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GovernanceRuntimeQueueItem<
      TPayload,
      TResult
    >[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendGovernanceCurrentRun(
  projectRoot: string,
  entry: GovernanceRuntimeQueueItem<unknown, unknown>
): void {
  const file = governanceCurrentRunPath(projectRoot);
  const current = readGovernanceCurrentRun(projectRoot);
  current.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
}
