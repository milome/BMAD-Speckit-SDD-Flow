import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../../utils/goal-contract/control-plane/canonical-hash';
import { validateGoalContractSchema } from '../../../utils/goal-contract/control-plane/schema-registry';

type JsonRecord = Record<string, unknown>;

export interface PublishedGoalArtifact {
  absolutePath: string;
  projectRelativePath: string;
  outRootRelativePath: string;
  hash: string;
}

export function canonicalGoalExecutionBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function normalizedRelative(root: string, target: string): string {
  const relative = path.relative(path.resolve(root), path.resolve(target)).replace(/\\/gu, '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_artifact_path_invalid');
  }
  return relative;
}

function assertPhysicalConfinement(root: string, target: string, includeTarget = true): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = normalizedRelative(resolvedRoot, resolvedTarget);
  try {
    const rootStat = fs.lstatSync(resolvedRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new Error('invalid');
    }
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let current = resolvedRoot;
    const segments = relative.split('/');
    for (const segment of includeTarget ? segments : segments.slice(0, -1)) {
      current = path.join(current, segment);
      if (!fs.existsSync(current)) break;
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('invalid');
      const realCurrent = fs.realpathSync.native(current);
      if (realCurrent !== realRoot && !realCurrent.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error('invalid');
      }
    }
  } catch {
    throw new Error('goal_execution_artifact_path_invalid');
  }
}

export function assertGoalExecutionPhysicalConfinement(input: {
  root: string;
  targetPath: string;
}): void {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.root, targetPath);
  assertPhysicalConfinement(input.root, targetPath);
}

export function assertGoalExecutionPhysicalParentConfinement(input: {
  root: string;
  targetPath: string;
}): void {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.root, targetPath);
  assertPhysicalConfinement(input.root, targetPath, false);
}

function writeImmutableBytes(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  bytes: Buffer;
}): Omit<PublishedGoalArtifact, 'hash'> {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.outRoot, targetPath);
  assertPhysicalConfinement(input.outRoot, targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  assertPhysicalConfinement(input.outRoot, targetPath);
  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('goal_execution_artifact_path_invalid');
    }
    if (!fs.readFileSync(targetPath).equals(input.bytes)) {
      throw new Error('goal_execution_immutable_artifact_conflict');
    }
  } else {
    const descriptor = fs.openSync(targetPath, 'wx');
    try {
      assertPhysicalConfinement(input.outRoot, targetPath);
      const descriptorStat = fs.fstatSync(descriptor);
      const targetStat = fs.lstatSync(targetPath);
      if (
        !targetStat.isFile() ||
        targetStat.isSymbolicLink() ||
        descriptorStat.dev !== targetStat.dev ||
        descriptorStat.ino !== targetStat.ino
      ) {
        throw new Error('goal_execution_artifact_path_invalid');
      }
      fs.writeFileSync(descriptor, input.bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  }
  if (!fs.readFileSync(targetPath).equals(input.bytes)) {
    throw new Error('goal_execution_immutable_artifact_invalid');
  }
  return Object.freeze({
    absolutePath: targetPath,
    projectRelativePath: normalizedRelative(input.projectRoot, targetPath),
    outRootRelativePath: normalizedRelative(input.outRoot, targetPath),
  });
}

export function publishGoalExecutionImmutableArtifact(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  bytes: Buffer;
  hash: string;
}): PublishedGoalArtifact {
  return Object.freeze({ ...writeImmutableBytes(input), hash: input.hash });
}

export function publishGoalExecutionCanonicalRecord(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  schemaName: string;
  hashField: string;
  payload: JsonRecord;
}): PublishedGoalArtifact & { record: JsonRecord } {
  const record = {
    ...input.payload,
    [input.hashField]: hashControlPlaneValue(input.payload),
  };
  validateGoalContractSchema(input.schemaName, record);
  const published = publishGoalExecutionImmutableArtifact({
    ...input,
    bytes: canonicalGoalExecutionBytes(record),
    hash: String(record[input.hashField]),
  });
  return Object.freeze({ ...published, record: Object.freeze(record) });
}

export function publishGoalExecutionObservedEvidence(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  authorityFileId: string;
  payload: JsonRecord;
}) {
  return publishGoalExecutionCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'evidence', `${input.authorityFileId}.json`),
    schemaName: 'goal-execution-observed-evidence.schema.json',
    hashField: 'evidenceHash',
    payload: input.payload,
  });
}

export function publishGoalExecutionDiagnosticRecord(input: {
  projectRoot: string;
  outRoot: string;
  targetPath: string;
  payload: JsonRecord;
}) {
  const published = writeImmutableBytes({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: input.targetPath,
    bytes: canonicalGoalExecutionBytes(input.payload),
  });
  return Object.freeze({ ...published, record: Object.freeze({ ...input.payload }) });
}

export function readGoalExecutionConfinedBytes(input: {
  root: string;
  targetPath: string;
}): Buffer {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.root, targetPath);
  assertPhysicalConfinement(input.root, targetPath);
  let descriptor: number | null = null;
  try {
    const targetStat = fs.lstatSync(targetPath);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) throw new Error('invalid');
    descriptor = fs.openSync(targetPath, 'r');
    const descriptorStat = fs.fstatSync(descriptor);
    assertPhysicalConfinement(input.root, targetPath);
    const currentStat = fs.lstatSync(targetPath);
    if (
      !currentStat.isFile() ||
      currentStat.isSymbolicLink() ||
      descriptorStat.dev !== currentStat.dev ||
      descriptorStat.ino !== currentStat.ino
    ) {
      throw new Error('invalid');
    }
    const bytes = fs.readFileSync(descriptor);
    assertPhysicalConfinement(input.root, targetPath);
    const finalStat = fs.lstatSync(targetPath);
    if (descriptorStat.dev !== finalStat.dev || descriptorStat.ino !== finalStat.ino) {
      throw new Error('invalid');
    }
    return bytes;
  } catch {
    throw new Error('goal_execution_artifact_path_invalid');
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

export function readGoalExecutionConfinedJson(input: {
  root: string;
  targetPath: string;
}): JsonRecord {
  try {
    return JSON.parse(readGoalExecutionConfinedBytes(input).toString('utf8')) as JsonRecord;
  } catch (error) {
    if (error instanceof Error && error.message === 'goal_execution_artifact_path_invalid') {
      throw error;
    }
    throw new Error('goal_execution_artifact_invalid');
  }
}

export function readGoalExecutionConfinedBytesIfExists(input: {
  root: string;
  targetPath: string;
}): Buffer | null {
  const targetPath = path.resolve(input.targetPath);
  normalizedRelative(input.root, targetPath);
  assertPhysicalConfinement(input.root, targetPath);
  return fs.existsSync(targetPath)
    ? readGoalExecutionConfinedBytes({ ...input, targetPath })
    : null;
}

export function readGoalExecutionConfinedJsonIfExists(input: {
  root: string;
  targetPath: string;
}): JsonRecord | null {
  const bytes = readGoalExecutionConfinedBytesIfExists(input);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString('utf8')) as JsonRecord;
  } catch {
    throw new Error('goal_execution_artifact_invalid');
  }
}
