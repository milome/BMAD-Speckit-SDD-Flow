import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './requirement-record-control-store';
import { requirementsContractDomainHash } from './requirements-contract-hash-domains';
import { DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY } from './requirements-contract-retention-policy';

type JsonRecord = Record<string, unknown>;

export interface RequirementsRecordGcPlan {
  schemaVersion: 'requirements-record-gc-plan/v1';
  rootSetHash: string;
  expectedActiveAuthorityHash: string;
  retainedPaths: string[];
  deletionPaths: string[];
  reclaimBytes: number;
  planHash: string;
}

function jsonObject(filePath: string): JsonRecord | null {
  if (!existsSync(filePath)) return null;
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
  } catch {
    return null;
  }
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function children(recordRoot: string, relativeDirectory: string): string[] {
  const directory = path.join(recordRoot, ...relativeDirectory.split('/'));
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) return [];
  return readdirSync(directory).sort().map((entry) => `${relativeDirectory}/${entry}`);
}

function treeBytes(target: string): number {
  if (!existsSync(target)) return 0;
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) return 0;
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(target).reduce((total, child) => total + treeBytes(path.join(target, child)), 0);
}

function collectJsonPaths(value: unknown, retained: Set<string>): void {
  if (Array.isArray(value)) {
    for (const child of value) collectJsonPaths(child, retained);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (
      typeof child === 'string' &&
      ['path', 'recordRelativePath', 'activeBuildManifestPath', 'previousBuildManifestPath', 'requestPath'].includes(key) &&
      !path.posix.isAbsolute(child) && !child.includes('..') && !child.includes('\\')
    ) retained.add(child);
    collectJsonPaths(child, retained);
  }
}

function rootSnapshot(recordRoot: string, nowMs: number) {
  const record = jsonObject(path.join(recordRoot, 'record', 'requirement-record.json')) ?? {};
  const authority = record.activeAuthority && typeof record.activeAuthority === 'object'
    ? record.activeAuthority as JsonRecord : null;
  const retained = new Set<string>();
  collectJsonPaths(authority, retained);
  collectJsonPaths(record.currentPromotionEvidence, retained);
  collectJsonPaths(record.finalPromotionEvidence, retained);
  collectJsonPaths(record.confirmationEventRef, retained);
  const activeAttemptPointer = jsonObject(path.join(
    recordRoot, 'record', 'active-authoring-request.json'
  ));
  if (activeAttemptPointer) {
    collectJsonPaths(activeAttemptPointer, retained);
    const manifestPath = String(activeAttemptPointer.attemptManifestPath ?? '');
    if (manifestPath) {
      retained.add(path.posix.dirname(manifestPath));
    }
  }
  const liveOperations: JsonRecord[] = [];
  for (const operationPath of children(recordRoot, 'authoring/operations')) {
    const manifestPath = `${operationPath}/operation.json`;
    const operation = jsonObject(path.join(recordRoot, ...manifestPath.split('/')));
    const lease = operation ? Date.parse(String(operation.leaseExpiresAt ?? '')) : Number.NaN;
    if (operation && Number.isFinite(lease) && lease > nowMs) {
      retained.add(operationPath);
      collectJsonPaths(operation, retained);
      liveOperations.push({ operationPath, ...operation });
    }
  }
  const activeRequest = jsonObject(path.join(recordRoot, 'quality', 'active-request.json'));
  if (activeRequest) {
    retained.add('quality/active-request.json');
    collectJsonPaths(activeRequest, retained);
  }
  if (existsSync(path.join(recordRoot, 'quality', 'failures', 'latest.json'))) {
    retained.add('quality/failures/latest.json');
  }
  const rootPayload = {
    authority,
    liveOperations,
    activeRequest,
    currentPromotionEvidence: record.currentPromotionEvidence ?? null,
    finalPromotionEvidence: record.finalPromotionEvidence ?? null,
    confirmationEventRef: record.confirmationEventRef ?? null,
  };
  return {
    expectedActiveAuthorityHash: requirementsContractDomainHash('requirements-active-authority-cas/v1', authority),
    rootSetHash: requirementsContractDomainHash('requirements-record-gc-root-set/v1', rootPayload),
    retained,
  };
}

export function planRequirementsContractRecordGc(input: {
  recordRoot: string;
  now?: string;
}): RequirementsRecordGcPlan {
  const nowMs = input.now ? Date.parse(input.now) : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('requirements_record_gc_now_invalid');
  const snapshot = rootSnapshot(input.recordRoot, nowMs);
  const retained = snapshot.retained;
  const deletion = new Set<string>();
  for (const buildPath of children(input.recordRoot, 'authoring/builds')) {
    if (![...retained].some((root) => root === buildPath || root.startsWith(`${buildPath}/`))) {
      deletion.add(buildPath);
    }
  }
  for (const operationPath of children(input.recordRoot, 'authoring/operations')) {
    if (!retained.has(operationPath)) deletion.add(operationPath);
  }
  for (const stagingPath of children(input.recordRoot, 'authoring/.staging')) {
    const operationId = path.posix.basename(stagingPath);
    if (retained.has(`authoring/operations/${operationId}`)) {
      retained.add(stagingPath);
      continue;
    }
    const modified = lstatSync(path.join(input.recordRoot, ...stagingPath.split('/'))).mtimeMs;
    if (nowMs - modified > DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY.orphanTtlMs) deletion.add(stagingPath);
    else retained.add(stagingPath);
  }
  const deletionPaths = [...deletion].sort();
  const retainedPaths = [...retained].sort();
  const payload = {
    schemaVersion: 'requirements-record-gc-plan/v1' as const,
    rootSetHash: snapshot.rootSetHash,
    expectedActiveAuthorityHash: snapshot.expectedActiveAuthorityHash,
    retainedPaths,
    deletionPaths,
    reclaimBytes: deletionPaths.reduce(
      (total, relativePath) => total + treeBytes(path.join(input.recordRoot, ...relativePath.split('/'))), 0
    ),
  };
  return { ...payload, planHash: requirementsContractDomainHash('requirements-record-gc-plan/v1', payload) };
}

function assertDeletionPath(recordRoot: string, relativePath: string): string {
  const allowed = [
    'authoring/.staging/', 'authoring/operations/', 'authoring/builds/',
    'authoring/objects/', 'quality/requests/', 'quality/selections/', 'confirmation/',
  ];
  if (relativePath.includes('..') || relativePath.includes('\\') || path.posix.isAbsolute(relativePath) ||
      !allowed.some((prefix) => relativePath.startsWith(prefix))) {
    throw new Error('requirements_record_gc_path_invalid');
  }
  const realRoot = realpathSync.native(path.resolve(recordRoot));
  const target = path.resolve(realRoot, ...relativePath.split('/'));
  const outside = path.relative(realRoot, target);
  if (outside.startsWith('..') || path.isAbsolute(outside)) throw new Error('requirements_record_gc_path_invalid');
  let cursor = realRoot;
  for (const segment of relativePath.split('/')) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) throw new Error('requirements_record_gc_path_invalid');
    const realCursor = realpathSync.native(cursor);
    const relative = path.relative(realRoot, realCursor);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('requirements_record_gc_path_invalid');
  }
  return target;
}

export function executeRequirementsContractRecordGc(input: {
  recordRoot: string;
  plan: RequirementsRecordGcPlan;
  now: string;
}) {
  const targets = input.plan.deletionPaths.map((relativePath) => ({
    relativePath,
    target: assertDeletionPath(input.recordRoot, relativePath),
  }));
  const current = planRequirementsContractRecordGc({ recordRoot: input.recordRoot, now: input.now });
  if (
    current.rootSetHash !== input.plan.rootSetHash ||
    current.expectedActiveAuthorityHash !== input.plan.expectedActiveAuthorityHash
  ) throw new Error('requirements_record_gc_root_set_changed');
  const { planHash: _planHash, ...planPayload } = input.plan;
  if (requirementsContractDomainHash('requirements-record-gc-plan/v1', planPayload) !== input.plan.planHash) {
    throw new Error('requirements_record_gc_plan_invalid');
  }
  let deletedCount = 0;
  for (const { target } of targets) {
    if (!existsSync(target)) continue;
    rmSync(target, { recursive: true, force: true });
    deletedCount += 1;
  }
  writeJsonAtomic(path.join(input.recordRoot, 'runtime', 'gc-summary.json'), {
    schemaVersion: 'requirements-record-gc-summary/v1',
    deletedCount,
    reclaimedBytes: input.plan.reclaimBytes,
    rootSetHash: input.plan.rootSetHash,
  });
  return { decision: 'pass' as const, deletedCount, reclaimedBytes: input.plan.reclaimBytes };
}
