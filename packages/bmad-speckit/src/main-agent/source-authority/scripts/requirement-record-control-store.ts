/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateRequirementRecordSchemaObject,
  type JsonObject,
} from './requirement-record-live-schema-gate';

export type RequirementRecordReducer = (record: JsonObject, payload: JsonObject) => JsonObject;

export interface ControlEventEnvelope {
  eventId: string;
  eventType: string;
  eventSchemaVersion: 'control-event-envelope/v1';
  payloadSchemaVersion: string;
  writerId: string;
  recordId: string;
  requirementSetId: string;
  recordedAt: string;
  previousEventHash: string;
  eventHash: string;
  beforeRecordHash: string;
  afterRecordHash: string;
  payloadHash: string;
  writerRegistryHash?: string;
  writerHash?: string;
  payload: JsonObject;
}

export interface ControlCommitResult {
  event: ControlEventEnvelope;
  receiptPath: string;
  eventLogPath: string;
  beforeRecordHash: string;
  afterRecordHash: string;
  artifactIndexPaths: string[];
  artifactPaths: string[];
}

export interface ControlArtifactIndexUpdate {
  path: string;
  entries: JsonObject[];
}

export interface ControlArtifactWrite {
  path: string;
  content: string;
  contentHash: string;
  expectedBeforeHash?: string;
}

export interface AppendInput {
  recordPath: string;
  writerId: string;
  eventType: string;
  eventId?: string;
  payload: JsonObject;
  reduce: RequirementRecordReducer;
  bootstrapRecord?: JsonObject;
  expectedBeforeRecordHash?: string;
  artifactIndexUpdates?: ControlArtifactIndexUpdate[];
  artifactWrites?: ControlArtifactWrite[];
  recordedAt?: string;
  payloadSchemaVersion?: string;
  skipSchemaGate?: boolean;
  bootstrapConfirmation?: boolean;
}

export type ControlCommitBoundary =
  | 'after_stage'
  | 'before_event_log'
  | 'before_record'
  | 'before_receipt'
  | 'before_commit_boundary'
  | 'after_transaction_promotion'
  | 'after_commit_boundary';

export interface ControlStoreCommitDeps {
  beforeBoundary?: (boundary: ControlCommitBoundary) => void;
  beforeArtifactIndex?: (targetPath: string, index: number) => void;
  beforeArtifactWrite?: (targetPath: string, index: number) => void;
}

const ZERO_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== 'object') return value;
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(value as JsonObject)) {
    if (item !== undefined) out[key] = withoutUndefined(item);
  }
  return out;
}

export function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function sha256Json(value: unknown): string {
  return sha256Text(JSON.stringify(withoutUndefined(value)));
}

function sha256FileIfPresent(value: unknown): string {
  const file = text(value);
  if (!file || file === '<missing-path>') return '';
  const absolute = path.isAbsolute(file) ? file : path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return '';
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')}`;
}

export function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

export function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function writeTextAtomic(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, value, 'utf8');
  fs.renameSync(temp, file);
}

function removeDirectory(directory: string): void {
  fs.rmSync(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 20,
  });
}

interface PreparedArtifactIndexUpdate {
  targetPath: string;
  stagedRelativePath: string;
  previousRelativePath: string;
  previousText: string | null;
  nextText: string;
}

interface PreparedArtifactWrite {
  targetPath: string;
  stagedRelativePath: string;
  previousRelativePath: string;
  previousText: string | null;
  nextText: string;
  contentHash: string;
}

interface ArtifactIndexLock {
  targetPath: string;
  lockPath: string;
}

interface ControlWriterAuthorization {
  writerRegistryHash: string;
  writerHash: string;
}

export function eventLogPathForRecord(recordPath: string): string {
  return path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
}

export function receiptPathForEvent(recordPath: string, eventId: string): string {
  return path.join(path.dirname(recordPath), 'events', 'receipts', `${eventId}.json`);
}

function readEventLog(file: string): ControlEventEnvelope[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return [];
  return content.split(/\r?\n/u).map((line) => JSON.parse(line) as ControlEventEnvelope);
}

function controlStoreRoot(recordPath: string): string {
  return path.join(path.dirname(recordPath), 'events', 'control-store');
}

function acquireControlStoreLock(
  recordPath: string,
  transactionId: string,
  writerId: string,
  eventType: string,
  artifactIndexTargets: string[],
  artifactWriteTargets: string[]
): string {
  const lockPath = path.join(controlStoreRoot(recordPath), '.lock');
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let handle: number;
  try {
    handle = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('control_store_lock_held');
    }
    throw error;
  }
  try {
    fs.writeFileSync(
      handle,
      `${JSON.stringify(
        {
          schemaVersion: 'requirement-record-control-lock/v1',
          transactionId,
          writerId,
          eventType,
          artifactIndexTargets: artifactIndexTargets.map(normalizePathForRecord),
          artifactWriteTargets: artifactWriteTargets.map(normalizePathForRecord),
          processId: process.pid,
          acquiredAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  return lockPath;
}

function controlStoreLockOwnedBy(lockPath: string, transactionId: string): boolean {
  if (!fs.existsSync(lockPath)) return false;
  try {
    return text(readJson(lockPath).transactionId) === transactionId;
  } catch {
    return false;
  }
}

function assertControlStoreLockOwnership(
  lockPath: string,
  transactionId: string
): void {
  if (!controlStoreLockOwnedBy(lockPath, transactionId)) {
    throw new Error('control_store_lock_ownership_lost');
  }
}

function releaseControlStoreLock(lockPath: string, transactionId: string): void {
  if (controlStoreLockOwnedBy(lockPath, transactionId)) {
    fs.rmSync(lockPath, { force: true });
  }
}

function pathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pathAtOrWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function physicalPath(value: string): string {
  let existing = path.resolve(value);
  const missingSegments: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      throw new Error('control_store_artifact_write_target_invalid');
    }
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function artifactIndexTargetPath(recordPath: string, value: string): string {
  const targetPath = path.resolve(value);
  const recordRoot = path.dirname(recordPath);
  const requirementRecordsRoot = path.dirname(recordRoot);
  const localArtifactIndex = path.join(recordRoot, 'artifact-index.jsonl');
  const globalArtifactIndex = path.join(requirementRecordsRoot, 'artifact-index.jsonl');
  if (targetPath !== localArtifactIndex && targetPath !== globalArtifactIndex) {
    throw new Error('control_store_artifact_index_target_invalid');
  }
  return targetPath;
}

function artifactIndexTargetPaths(
  recordPath: string,
  updates: ControlArtifactIndexUpdate[]
): string[] {
  return [
    ...new Set(updates.map((update) => artifactIndexTargetPath(recordPath, update.path))),
  ].sort((left, right) => left.localeCompare(right));
}

interface ControlArtifactAuthorityContext {
  record: JsonObject;
  payload: JsonObject;
}

function authorityArtifactBindingMap(
  context: ControlArtifactAuthorityContext
): Map<string, string> {
  const history = objects(context.record.confirmationHistory);
  const latestConfirmation = history.at(-1) ?? {};
  const expectedPaths = new Map<string, string>([
    ['source_document', text(context.record.sourcePath)],
    ['confirmation_html', text(latestConfirmation.htmlPath)],
    ['confirmation_render_report', text(latestConfirmation.renderReportPath)],
  ]);
  const bindings = new Map<string, string>();
  for (const binding of objects(context.payload.authorityArtifactBindings)) {
    const role = text(binding.role);
    const expectedPath = expectedPaths.get(role);
    const bindingPath = text(binding.path);
    const contentHash = text(binding.contentHash);
    if (
      !expectedPath ||
      !bindingPath ||
      path.resolve(bindingPath) !== path.resolve(expectedPath) ||
      !isSha256(contentHash)
    ) {
      throw new Error('control_store_authority_artifact_binding_invalid');
    }
    const targetPath = path.resolve(bindingPath);
    if (bindings.has(targetPath)) {
      throw new Error('control_store_authority_artifact_binding_duplicate');
    }
    bindings.set(targetPath, contentHash);
  }
  return bindings;
}

function controlArtifactTargetPath(
  recordPath: string,
  value: string,
  contentHash?: string,
  authorityContext?: ControlArtifactAuthorityContext
): string {
  const recordRoot = path.dirname(recordPath);
  const targetPath = path.resolve(
    path.isAbsolute(value) ? value : path.join(recordRoot, value)
  );
  const eventRoot = path.join(recordRoot, 'events');
  const localArtifactIndex = path.join(recordRoot, 'artifact-index.jsonl');
  const physicalRecordRoot = physicalPath(recordRoot);
  const physicalTargetPath = physicalPath(targetPath);
  if (text(value) && pathWithin(recordRoot, targetPath)) {
    if (
      targetPath !== path.resolve(recordPath) &&
      targetPath !== path.resolve(localArtifactIndex) &&
      targetPath !== path.resolve(eventRoot) &&
      !pathWithin(eventRoot, targetPath) &&
      pathAtOrWithin(physicalRecordRoot, physicalTargetPath) &&
      physicalTargetPath !== physicalPath(recordPath) &&
      physicalTargetPath !== physicalPath(localArtifactIndex) &&
      !pathAtOrWithin(physicalPath(eventRoot), physicalTargetPath)
    ) {
      return targetPath;
    }
  } else if (authorityContext) {
    const bindingHash = authorityArtifactBindingMap(authorityContext).get(targetPath);
    if (bindingHash && bindingHash === text(contentHash)) return targetPath;
  }
  throw new Error('control_store_artifact_write_target_invalid');
}

function controlArtifactWriteTargets(
  recordPath: string,
  writes: ControlArtifactWrite[],
  authorityContext?: ControlArtifactAuthorityContext
): string[] {
  const targets = declaredControlArtifactWriteTargets(recordPath, writes).map(
    (targetPath, index) =>
      controlArtifactTargetPath(
        recordPath,
        targetPath,
        writes[index].contentHash,
        authorityContext
      )
  );
  if (new Set(targets).size !== targets.length) {
    throw new Error('control_store_artifact_write_target_duplicate');
  }
  return targets;
}

function declaredControlArtifactWriteTargets(
  recordPath: string,
  writes: ControlArtifactWrite[]
): string[] {
  const targets = writes.map((write) => {
    if (
      typeof write.content !== 'string' ||
      !isSha256(text(write.contentHash)) ||
      text(write.contentHash) !== sha256Text(write.content)
    ) {
      throw new Error('control_store_artifact_write_hash_mismatch');
    }
    return path.resolve(
      path.isAbsolute(write.path) ? write.path : path.join(path.dirname(recordPath), write.path)
    );
  });
  if (new Set(targets).size !== targets.length) {
    throw new Error('control_store_artifact_write_target_duplicate');
  }
  return targets;
}

function artifactIndexLockPath(targetPath: string): string {
  return `${targetPath}.control-store.lock`;
}

function artifactIndexLocksForTargets(targetPaths: string[]): ArtifactIndexLock[] {
  return targetPaths.map((targetPath) => ({
    targetPath,
    lockPath: artifactIndexLockPath(targetPath),
  }));
}

function artifactIndexLockOwnedBy(lock: ArtifactIndexLock, transactionId: string): boolean {
  if (!fs.existsSync(lock.lockPath)) return false;
  try {
    const current = readJson(lock.lockPath);
    return (
      text(current.transactionId) === transactionId &&
      path.resolve(text(current.targetPath)) === path.resolve(lock.targetPath)
    );
  } catch {
    return false;
  }
}

function assertArtifactIndexLockOwnership(
  locks: ArtifactIndexLock[],
  transactionId: string
): void {
  for (const lock of locks) {
    if (!artifactIndexLockOwnedBy(lock, transactionId)) {
      throw new Error(
        `control_store_artifact_index_lock_ownership_lost:${normalizePathForRecord(
          lock.targetPath
        )}`
      );
    }
  }
}

function releaseArtifactIndexLocks(locks: ArtifactIndexLock[], transactionId: string): void {
  for (const lock of [...locks].reverse()) {
    if (artifactIndexLockOwnedBy(lock, transactionId)) {
      fs.rmSync(lock.lockPath, { force: true });
    }
  }
}

function acquireArtifactIndexLocks(input: {
  recordPath: string;
  transactionId: string;
  writerId: string;
  eventType: string;
  targetPaths: string[];
}): ArtifactIndexLock[] {
  const acquired: ArtifactIndexLock[] = [];
  try {
    for (const lock of artifactIndexLocksForTargets(input.targetPaths)) {
      fs.mkdirSync(path.dirname(lock.lockPath), { recursive: true });
      let handle: number;
      try {
        handle = fs.openSync(lock.lockPath, 'wx');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        let existing: JsonObject;
        try {
          existing = readJson(lock.lockPath);
        } catch {
          throw new Error(
            `control_store_artifact_index_lock_invalid:${normalizePathForRecord(
              lock.targetPath
            )}`
          );
        }
        const ownerRecordPath = text(existing.recordPath);
        if (!processIsAlive(Number(existing.processId))) {
          throw new Error(
            `control_store_artifact_index_lock_recovery_required:${normalizePathForRecord(
              ownerRecordPath || lock.targetPath
            )}`
          );
        }
        throw new Error(
          `control_store_artifact_index_lock_held:${normalizePathForRecord(lock.targetPath)}`
        );
      }
      try {
        fs.writeFileSync(
          handle,
          `${JSON.stringify(
            {
              schemaVersion: 'requirement-record-artifact-index-lock/v1',
              transactionId: input.transactionId,
              writerId: input.writerId,
              eventType: input.eventType,
              recordPath: normalizePathForRecord(input.recordPath),
              targetPath: normalizePathForRecord(lock.targetPath),
              processId: process.pid,
              acquiredAt: new Date().toISOString(),
            },
            null,
            2
          )}\n`,
          'utf8'
        );
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      acquired.push(lock);
    }
    return acquired;
  } catch (error) {
    releaseArtifactIndexLocks(acquired, input.transactionId);
    throw error;
  }
}

function appendJsonlText(previousText: string | null, entries: JsonObject[]): string {
  const prefix = previousText
    ? previousText.endsWith('\n')
      ? previousText
      : `${previousText}\n`
    : '';
  const appended = entries.map((entry) => JSON.stringify(entry)).join('\n');
  return appended ? `${prefix}${appended}\n` : prefix;
}

function prepareArtifactIndexUpdates(
  recordPath: string,
  updates: ControlArtifactIndexUpdate[]
): PreparedArtifactIndexUpdate[] {
  const merged = new Map<string, JsonObject[]>();
  for (const update of updates) {
    const targetPath = artifactIndexTargetPath(recordPath, update.path);
    merged.set(targetPath, [...(merged.get(targetPath) ?? []), ...update.entries]);
  }
  return [...merged.entries()].map(([targetPath, entries], index) => {
    const previousText = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : null;
    return {
      targetPath,
      stagedRelativePath: `artifact-indexes/${index}.jsonl`,
      previousRelativePath: `previous/artifact-indexes/${index}.jsonl`,
      previousText,
      nextText: appendJsonlText(previousText, entries),
    };
  });
}

function prepareArtifactWrites(
  recordPath: string,
  writes: ControlArtifactWrite[],
  authorityContext?: ControlArtifactAuthorityContext
): PreparedArtifactWrite[] {
  const targets = controlArtifactWriteTargets(recordPath, writes, authorityContext);
  return writes.map((write, index) => {
    const targetPath = targets[index];
    if (fs.existsSync(targetPath) && !fs.statSync(targetPath).isFile()) {
      throw new Error('control_store_artifact_write_target_not_file');
    }
    const previousText = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : null;
    if (
      text(write.expectedBeforeHash) &&
      text(write.expectedBeforeHash) !==
        (previousText === null ? ZERO_HASH : sha256Text(previousText))
    ) {
      throw new Error('control_store_compare_and_swap_failed:artifact_changed_before_lock');
    }
    return {
      targetPath,
      stagedRelativePath: `artifacts/${index}.txt`,
      previousRelativePath: `previous/artifacts/${index}.txt`,
      previousText,
      nextText: write.content,
      contentHash: text(write.contentHash),
    };
  });
}

function processIsAlive(processId: number): boolean {
  if (!Number.isInteger(processId) || processId <= 0) return true;
  if (processId === process.pid) return true;
  if (processId > 1_000_000_000) return false;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function transactionTargetPaths(
  manifest: JsonObject,
  recordPath: string
): { eventLogPath: string; receiptPath: string } {
  const targets = nested(manifest.targets);
  const eventLogPath = path.resolve(text(targets.eventLogPath));
  const targetRecordPath = path.resolve(text(targets.recordPath));
  const receiptPath = path.resolve(text(targets.receiptPath));
  if (
    targetRecordPath !== path.resolve(recordPath) ||
    !pathWithin(path.dirname(recordPath), eventLogPath) ||
    !pathWithin(path.dirname(recordPath), receiptPath)
  ) {
    throw new Error('control_store_transaction_target_invalid');
  }
  return { eventLogPath, receiptPath };
}

function transactionArtifactIndexes(
  transactionDir: string,
  manifest: JsonObject,
  recordPath: string
): Array<{
  targetPath: string;
  stagedPath: string;
  previousPath: string;
  previousExists: boolean;
}> {
  return objects(manifest.artifactIndexes).map((entry) => {
    const targetPath = artifactIndexTargetPath(recordPath, text(entry.targetPath));
    const stagedPath = path.resolve(transactionDir, text(entry.stagedRelativePath));
    const previousPath = path.resolve(transactionDir, text(entry.previousRelativePath));
    if (
      !pathWithin(transactionDir, stagedPath) ||
      !pathWithin(transactionDir, previousPath) ||
      !fs.existsSync(stagedPath) ||
      text(entry.stagedHash) !== sha256Text(fs.readFileSync(stagedPath, 'utf8'))
    ) {
      throw new Error('control_store_artifact_index_snapshot_invalid');
    }
    if (
      entry.previousExists === true &&
      (!fs.existsSync(previousPath) ||
        text(entry.previousHash) !== sha256Text(fs.readFileSync(previousPath, 'utf8')))
    ) {
      throw new Error('control_store_artifact_index_previous_snapshot_invalid');
    }
    return {
      targetPath,
      stagedPath,
      previousPath,
      previousExists: entry.previousExists === true,
    };
  });
}

function transactionArtifactWrites(
  transactionDir: string,
  manifest: JsonObject,
  recordPath: string
): Array<{
  targetPath: string;
  stagedPath: string;
  previousPath: string;
  previousExists: boolean;
}> {
  const event = readEventLog(path.join(transactionDir, 'control-events.jsonl')).at(-1);
  if (!event) throw new Error('control_store_authority_artifact_event_missing');
  const authorityContext: ControlArtifactAuthorityContext = {
    record: readJson(path.join(transactionDir, 'requirement-record.json')),
    payload: event.payload,
  };
  return objects(manifest.artifactWrites).map((entry) => {
    const targetPath = controlArtifactTargetPath(
      recordPath,
      text(entry.targetPath),
      text(entry.contentHash),
      authorityContext
    );
    const stagedPath = path.resolve(transactionDir, text(entry.stagedRelativePath));
    const previousPath = path.resolve(transactionDir, text(entry.previousRelativePath));
    if (
      !pathWithin(transactionDir, stagedPath) ||
      !pathWithin(transactionDir, previousPath) ||
      !fs.existsSync(stagedPath) ||
      text(entry.contentHash) !== sha256Text(fs.readFileSync(stagedPath, 'utf8'))
    ) {
      throw new Error('control_store_artifact_write_snapshot_invalid');
    }
    if (
      entry.previousExists === true &&
      (!fs.existsSync(previousPath) ||
        text(entry.previousHash) !== sha256Text(fs.readFileSync(previousPath, 'utf8')))
    ) {
      throw new Error('control_store_artifact_write_previous_snapshot_invalid');
    }
    return {
      targetPath,
      stagedPath,
      previousPath,
      previousExists: entry.previousExists === true,
    };
  });
}

function transactionDirectory(
  controlRoot: string,
  transactionPath: string
): string {
  const candidate = path.resolve(transactionPath);
  if (!pathWithin(path.join(controlRoot, 'transactions'), candidate)) {
    throw new Error('control_store_commit_marker_path_invalid');
  }
  return candidate;
}

function readTransactionManifest(transactionDir: string): JsonObject {
  const manifestPath = path.join(transactionDir, 'transaction-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('control_store_transaction_manifest_missing');
  }
  return readJson(manifestPath);
}

function assertTransactionSnapshot(
  transactionDir: string,
  manifest: JsonObject,
  recordPath: string
): { eventLogPath: string; receiptPath: string } {
  const stagedHashes = nested(manifest.stagedHashes);
  const files = {
    eventLog: path.join(transactionDir, 'control-events.jsonl'),
    record: path.join(transactionDir, 'requirement-record.json'),
    receipt: path.join(transactionDir, 'commit-receipt.json'),
  };
  for (const [key, file] of Object.entries(files)) {
    if (
      !fs.existsSync(file) ||
      text(stagedHashes[`${key}Hash`]) !== sha256Text(fs.readFileSync(file, 'utf8'))
    ) {
      throw new Error(`control_store_transaction_snapshot_invalid:${key}`);
    }
  }
  const events = readEventLog(files.eventLog);
  const record = readJson(files.record);
  const receipt = readJson(files.receipt);
  const eventHash = text(manifest.eventHash);
  if (
    text(events.at(-1)?.eventHash) !== eventHash ||
    text(record.lastAppliedEventHash) !== eventHash ||
    text(record.eventChainHead) !== eventHash ||
    text(receipt.eventHash) !== eventHash ||
    text(events.at(-1)?.afterRecordHash) !== text(manifest.afterRecordHash)
  ) {
    throw new Error('control_store_transaction_snapshot_semantic_mismatch');
  }
  transactionArtifactIndexes(transactionDir, manifest, recordPath);
  transactionArtifactWrites(transactionDir, manifest, recordPath);
  return transactionTargetPaths(manifest, recordPath);
}

function materializeTransactionSnapshot(
  transactionDir: string,
  manifest: JsonObject,
  recordPath: string
): void {
  const targets = assertTransactionSnapshot(transactionDir, manifest, recordPath);
  writeTextAtomic(
    targets.eventLogPath,
    fs.readFileSync(path.join(transactionDir, 'control-events.jsonl'), 'utf8')
  );
  writeTextAtomic(
    recordPath,
    fs.readFileSync(path.join(transactionDir, 'requirement-record.json'), 'utf8')
  );
  writeTextAtomic(
    targets.receiptPath,
    fs.readFileSync(path.join(transactionDir, 'commit-receipt.json'), 'utf8')
  );
  for (const artifactIndex of transactionArtifactIndexes(
    transactionDir,
    manifest,
    recordPath
  )) {
    writeTextAtomic(
      artifactIndex.targetPath,
      fs.readFileSync(artifactIndex.stagedPath, 'utf8')
    );
  }
  for (const artifactWrite of transactionArtifactWrites(
    transactionDir,
    manifest,
    recordPath
  )) {
    writeTextAtomic(
      artifactWrite.targetPath,
      fs.readFileSync(artifactWrite.stagedPath, 'utf8')
    );
  }
}

function restorePreviousTransactionSnapshot(
  transactionDir: string,
  manifest: JsonObject,
  recordPath: string
): void {
  const previous = nested(manifest.previous);
  const previousDir = path.join(transactionDir, 'previous');
  const previousRecordPath = path.join(previousDir, 'requirement-record.json');
  const targets = transactionTargetPaths(manifest, recordPath);
  if (previous.recordExists === true) {
    if (
      !fs.existsSync(previousRecordPath) ||
      text(previous.recordHash) !==
        sha256Text(fs.readFileSync(previousRecordPath, 'utf8'))
    ) {
      throw new Error('control_store_previous_snapshot_invalid:record');
    }
  } else if (fs.existsSync(previousRecordPath)) {
    throw new Error('control_store_previous_snapshot_invalid:unexpected_record');
  }
  const previousEventLogPath = path.join(previousDir, 'control-events.jsonl');
  if (
    previous.eventLogExists === true &&
    (!fs.existsSync(previousEventLogPath) ||
      text(previous.eventLogHash) !==
        sha256Text(fs.readFileSync(previousEventLogPath, 'utf8')))
  ) {
    throw new Error('control_store_previous_snapshot_invalid:event_log');
  }
  const previousReceiptPath = path.join(previousDir, 'commit-receipt.json');
  if (
    previous.receiptExists === true &&
    (!fs.existsSync(previousReceiptPath) ||
      text(previous.receiptHash) !==
        sha256Text(fs.readFileSync(previousReceiptPath, 'utf8')))
  ) {
    throw new Error('control_store_previous_snapshot_invalid:receipt');
  }
  transactionArtifactIndexes(transactionDir, manifest, recordPath);
  transactionArtifactWrites(transactionDir, manifest, recordPath);
  if (previous.recordExists === true) {
    writeTextAtomic(recordPath, fs.readFileSync(previousRecordPath, 'utf8'));
  } else if (fs.existsSync(recordPath)) {
    fs.rmSync(recordPath, { force: true });
  }
  if (previous.eventLogExists === true && fs.existsSync(previousEventLogPath)) {
    writeTextAtomic(targets.eventLogPath, fs.readFileSync(previousEventLogPath, 'utf8'));
  } else if (fs.existsSync(targets.eventLogPath)) {
    fs.rmSync(targets.eventLogPath, { force: true });
  }
  if (previous.receiptExists === true && fs.existsSync(previousReceiptPath)) {
    writeTextAtomic(targets.receiptPath, fs.readFileSync(previousReceiptPath, 'utf8'));
  } else if (fs.existsSync(targets.receiptPath)) {
    fs.rmSync(targets.receiptPath, { force: true });
  }
  for (const artifactIndex of transactionArtifactIndexes(
    transactionDir,
    manifest,
    recordPath
  )) {
    if (artifactIndex.previousExists) {
      writeTextAtomic(
        artifactIndex.targetPath,
        fs.readFileSync(artifactIndex.previousPath, 'utf8')
      );
    } else if (fs.existsSync(artifactIndex.targetPath)) {
      fs.rmSync(artifactIndex.targetPath, { force: true });
    }
  }
  for (const artifactWrite of transactionArtifactWrites(
    transactionDir,
    manifest,
    recordPath
  )) {
    if (artifactWrite.previousExists) {
      writeTextAtomic(
        artifactWrite.targetPath,
        fs.readFileSync(artifactWrite.previousPath, 'utf8')
      );
    } else if (fs.existsSync(artifactWrite.targetPath)) {
      fs.rmSync(artifactWrite.targetPath, { force: true });
    }
  }
}

function recoverControlStore(recordPath: string): void {
  const controlRoot = controlStoreRoot(recordPath);
  const transactionsRoot = path.join(controlRoot, 'transactions');
  const lockPath = path.join(controlRoot, '.lock');
  let lock: JsonObject | undefined;
  if (fs.existsSync(lockPath)) {
    try {
      lock = readJson(lockPath);
    } catch {
      return;
    }
    if (processIsAlive(Number(lock.processId))) return;
  }
  const staleTransactionId = text(lock?.transactionId);
  if (!lock || !staleTransactionId) return;
  const declaredTargetPaths = strings(lock.artifactIndexTargets).map((targetPath) =>
    artifactIndexTargetPath(recordPath, targetPath)
  );
  const declaredArtifactWritePaths = strings(lock.artifactWriteTargets).map((targetPath) =>
    path.resolve(targetPath)
  );
  const declaredArtifactIndexLocks = artifactIndexLocksForTargets(declaredTargetPaths);
  const staleTransactionDir = path.join(transactionsRoot, staleTransactionId);
  const staleStagingDir = path.join(transactionsRoot, `.staging-${staleTransactionId}`);
  const markerPath = path.join(controlRoot, 'current-commit.json');
  const marker = fs.existsSync(markerPath) ? readJson(markerPath) : undefined;
  const markerMatchesStaleTransaction =
    marker && text(marker.transactionId) === staleTransactionId;
  const recoveryDir = markerMatchesStaleTransaction
    ? transactionDirectory(controlRoot, text(marker.committedTransactionPath))
    : fs.existsSync(staleTransactionDir)
      ? staleTransactionDir
      : fs.existsSync(staleStagingDir)
        ? staleStagingDir
        : '';

  if (recoveryDir) {
    const manifest = readTransactionManifest(recoveryDir);
    const manifestTargetPaths = objects(manifest.artifactIndexes).map((entry) =>
      artifactIndexTargetPath(recordPath, text(entry.targetPath))
    );
    const manifestArtifactWritePaths = transactionArtifactWrites(
      recoveryDir,
      manifest,
      recordPath
    ).map((entry) => entry.targetPath);
    if (
      JSON.stringify([...declaredTargetPaths].sort()) !==
        JSON.stringify([...manifestTargetPaths].sort()) ||
      JSON.stringify([...declaredArtifactWritePaths].sort()) !==
        JSON.stringify([...manifestArtifactWritePaths].sort())
    ) {
      throw new Error('control_store_artifact_target_manifest_mismatch');
    }
    assertArtifactIndexLockOwnership(declaredArtifactIndexLocks, staleTransactionId);
    if (markerMatchesStaleTransaction) {
      if (
        text(marker.eventHash) !== text(manifest.eventHash) ||
        text(marker.afterRecordHash) !== text(manifest.afterRecordHash)
      ) {
        throw new Error('control_store_commit_marker_invalid');
      }
      materializeTransactionSnapshot(recoveryDir, manifest, recordPath);
    } else {
      restorePreviousTransactionSnapshot(recoveryDir, manifest, recordPath);
      fs.rmSync(recoveryDir, { recursive: true, force: true });
    }
    assertArtifactIndexLockOwnership(declaredArtifactIndexLocks, staleTransactionId);
  }
  releaseArtifactIndexLocks(declaredArtifactIndexLocks, staleTransactionId);
  releaseControlStoreLock(lockPath, staleTransactionId);
}

function assertControlStoreLockAvailable(recordPath: string): void {
  const lockPath = path.join(controlStoreRoot(recordPath), '.lock');
  if (fs.existsSync(lockPath)) throw new Error('control_store_lock_held');
}

function assertCommitInputRecord(record: JsonObject, allowBootstrap = false): void {
  if (!text(record.status)) {
    throw new Error('control_store_migration_required:confirmation_lineage_missing');
  }
  if (
    objects(record.confirmationHistory).length === 0 &&
    !(allowBootstrap && text(record.status) === 'draft')
  ) {
    throw new Error('control_store_migration_required:confirmation_lineage_missing');
  }
}

function commitInputRecord(
  recordPath: string,
  input: AppendInput
): { record: JsonObject; exists: boolean } {
  if (fs.existsSync(recordPath)) {
    return { record: readJson(recordPath), exists: true };
  }
  if (input.bootstrapConfirmation === true && input.bootstrapRecord) {
    return { record: input.bootstrapRecord, exists: false };
  }
  throw new Error('control_store_bootstrap_record_missing');
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function assertControlWriterAuthorization(
  record: JsonObject,
  eventType: string,
  writerId: string
): ControlWriterAuthorization | undefined {
  const writers = objects(record.controlledIngestWriterRegistry);
  const registryHash = text(record.controlledIngestWriterRegistryHash);
  const registryRequired = record.controlledIngestWriterRegistryRequired === true;
  if (!registryRequired && writers.length === 0 && !registryHash) return undefined;
  if (!registryRequired || writers.length === 0 || !isSha256(registryHash)) {
    throw new Error('control_store_writer_registry_missing');
  }
  const expectedRegistryHash = sha256Json({
    schemaVersion: 'controlled-ingest-writer-registry/v1',
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    writers,
  });
  if (registryHash !== expectedRegistryHash) {
    throw new Error('control_store_writer_registry_hash_mismatch');
  }
  const matchingWriters = writers.filter((writer) => text(writer.writerId) === writerId);
  if (matchingWriters.length !== 1) {
    throw new Error(`control_store_writer_not_authorized:${writerId}`);
  }
  const writer = matchingWriters[0];
  const writerHash = text(writer.writerHash);
  if (!isSha256(writerHash)) {
    throw new Error(`control_store_writer_hash_invalid:${writerId}`);
  }
  if (!strings(writer.eventTypes).includes(eventType)) {
    throw new Error(`control_store_writer_event_not_authorized:${writerId}:${eventType}`);
  }
  return {
    writerRegistryHash: registryHash,
    writerHash,
  };
}

function assertControlWriterRegistryImmutable(
  beforeRecord: JsonObject,
  afterRecord: JsonObject
): void {
  for (const field of [
    'controlledIngestWriterRegistryRequired',
    'controlledIngestWriterRegistry',
    'controlledIngestWriterRegistryHash',
  ]) {
    if (sha256Json(beforeRecord[field] ?? null) !== sha256Json(afterRecord[field] ?? null)) {
      throw new Error(`control_store_writer_registry_mutation_forbidden:${field}`);
    }
  }
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function normalizeSourceOfTruthRole(value: unknown): string {
  const role = text(value);
  if (
    [
      'acceptance_oracle',
      'audit_convergence_authority',
      'audit_dispatch_contract',
      'audit_profile_contract',
      'audit_triad_convergence_authority',
      'closeout_oracle',
      'control',
      'evidence',
      'execution_runtime_mode_selection',
      'historical_requirement_context',
      'host_surface_projection',
      'implementation',
      'read_model',
      'runtime_next_action_authority',
      'semantic_coverage_gate_receipt',
      'projection',
    ].includes(role)
  )
    return role;
  if (role === 'derived') return 'evidence';
  return 'evidence';
}

function normalizeSourceRefs(value: unknown): JsonObject[] {
  return objects(value)
    .map((ref) => ({
      sourceType: text(ref.sourceType) || 'controlled_ingest',
      id: text(ref.id) || text(ref.sourceId) || 'unknown',
    }))
    .filter((ref) => text(ref.id));
}

function normalizeCommandRunRef(
  command: JsonObject,
  fallback: { runId: string; startedAt: string; completedAt: string }
): JsonObject {
  const commandId = text(command.commandId) || text(command.id) || 'UNKNOWN-COMMAND';
  const executorIdentity = nested(command.executorIdentity);
  const runtimeVersions = nested(command.runtimeVersions);
  const environment = nested(command.environment);
  const dependencyLockHashes = objects(command.dependencyLockHashes);
  const coveredRequirementIds = strings(command.coveredRequirementIds);
  return {
    commandId,
    command: text(command.command) || commandId,
    ...(text(command.normalizedCommand)
      ? { normalizedCommand: text(command.normalizedCommand).replace(/\s+/gu, ' ') }
      : {}),
    ...(text(command.cwd) ? { cwd: normalizePathForRecord(text(command.cwd)) } : {}),
    ...(Object.keys(executorIdentity).length > 0 ? { executorIdentity } : {}),
    ...(Object.keys(runtimeVersions).length > 0 ? { runtimeVersions } : {}),
    ...(dependencyLockHashes.length > 0 ? { dependencyLockHashes } : {}),
    ...(Object.keys(environment).length > 0 ? { environment } : {}),
    ...(text(command.environmentFingerprint)
      ? { environmentFingerprint: text(command.environmentFingerprint) }
      : {}),
    ...(text(command.environmentCompatibilityDecision)
      ? { environmentCompatibilityDecision: text(command.environmentCompatibilityDecision) }
      : {}),
    ...(text(command.transactionId) ? { transactionId: text(command.transactionId) } : {}),
    ...(text(command.implementationAttemptId)
      ? { implementationAttemptId: text(command.implementationAttemptId) }
      : {}),
    ...(text(command.sourceDocumentHash)
      ? { sourceDocumentHash: text(command.sourceDocumentHash) }
      : {}),
    ...(text(command.semanticModelHash)
      ? { semanticModelHash: text(command.semanticModelHash) }
      : {}),
    ...(text(command.packetHash) ? { packetHash: text(command.packetHash) } : {}),
    runId: text(command.runId) || fallback.runId,
    ...(text(command.closeoutAttemptId)
      ? { closeoutAttemptId: text(command.closeoutAttemptId) }
      : {}),
    exitCode: Number.isInteger(command.exitCode) ? command.exitCode : 0,
    startedAt: text(command.startedAt) || fallback.startedAt,
    completedAt: text(command.completedAt) || fallback.completedAt,
    ...(text(command.outputPath)
      ? { outputPath: normalizePathForRecord(text(command.outputPath)) }
      : {}),
    ...(text(command.outputHash) ? { outputHash: text(command.outputHash) } : {}),
    ...(coveredRequirementIds.length > 0 ? { coveredRequirementIds } : {}),
    ...(text(command.outputSummary) ? { outputSummary: text(command.outputSummary) } : {}),
  };
}

function normalizeArtifactRef(
  artifact: JsonObject,
  recordId: string,
  requirementSetId: string,
  fallbackRelatedIds: string[] = []
): JsonObject {
  const related = strings(artifact.relatedRequirementIds);
  const fallbackRelated = [
    ...strings(artifact.evidenceRefs),
    ...strings(artifact.traceRows),
    ...fallbackRelatedIds,
    'historical-evidence',
  ].filter(Boolean);
  const hash = text(artifact.contentHash ?? artifact.hash);
  return {
    eventType: text(artifact.eventType) || 'artifact_indexed',
    artifactType: text(artifact.artifactType) || 'historical_artifact',
    sourceOfTruthRole: normalizeSourceOfTruthRole(artifact.sourceOfTruthRole),
    recordId: text(artifact.recordId) || recordId,
    requirementSetId: text(artifact.requirementSetId) || requirementSetId,
    path: normalizePathForRecord(text(artifact.path) || '<missing-path>'),
    ...(hash ? { contentHash: hash } : {}),
    producer: text(artifact.producer) || 'canonical-reducer',
    purpose: text(artifact.purpose) || 'canonicalized historical artifact reference',
    relatedRequirementIds: related.length > 0 ? related : [...new Set(fallbackRelated)],
    status: ['active', 'superseded', 'archived', 'deleted', 'blocked'].includes(
      text(artifact.status)
    )
      ? text(artifact.status)
      : 'archived',
    inputVersion: text(artifact.inputVersion) || 'pre-artifact-metadata-enforcement',
    outputVersion: text(artifact.outputVersion) || 'archived-historical-artifact',
    traceRows: strings(artifact.traceRows),
    evidenceRefs: strings(artifact.evidenceRefs),
  };
}

function normalizeExecutionIteration(
  iteration: JsonObject,
  record: JsonObject,
  index: number
): JsonObject {
  const recordId = text(iteration.recordId) || text(record.recordId);
  const requirementSetId =
    text(iteration.requirementSetId) || text(record.requirementSetId) || recordId;
  const recordedAt =
    text(iteration.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  const runId = text(iteration.runId) || `historical-run-${index + 1}`;
  const fallback = { runId, startedAt: recordedAt, completedAt: recordedAt };
  const traceRows = strings(iteration.traceRows);
  const evidenceRefs = strings(iteration.evidenceRefs);
  const fallbackRelatedIds = [...traceRows, ...evidenceRefs];
  if (text(iteration.eventType) === 'subagent_evidence_envelope_recorded') {
    return {
      eventType: 'subagent_evidence_envelope_recorded',
      recordId,
      requirementSetId,
      executionIterationId:
        text(iteration.executionIterationId) || `subagent-envelope-${index + 1}`,
      runId,
      status: ['accepted', 'rejected', 'partial', 'blocked'].includes(text(iteration.status))
        ? text(iteration.status)
        : 'accepted',
      subagentEvidenceEnvelope: nested(iteration.subagentEvidenceEnvelope),
      ...(text(iteration.subagentEvidenceEnvelopeHash)
        ? { subagentEvidenceEnvelopeHash: text(iteration.subagentEvidenceEnvelopeHash) }
        : {}),
      traceRows,
      taskRefs: strings(iteration.taskRefs),
      evidenceRefs,
      coveredRequirementIds: strings(iteration.coveredRequirementIds),
      commandRunRefs: objects(iteration.commandRunRefs).map((command) =>
        normalizeCommandRunRef(command, fallback)
      ),
      evidenceArtifactRefs: objects(iteration.evidenceArtifactRefs).map((artifact) =>
        normalizeArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedIds)
      ),
      sourceRefs: normalizeSourceRefs(iteration.sourceRefs).length
        ? normalizeSourceRefs(iteration.sourceRefs)
        : [
            {
              sourceType: 'execution_iteration',
              id: text(iteration.executionIterationId) || `subagent-envelope-${index + 1}`,
            },
          ],
      sourceDocumentHash: text(iteration.sourceDocumentHash) || text(record.sourceDocumentHash),
      implementationConfirmationHash:
        text(iteration.implementationConfirmationHash) ||
        text(record.implementationConfirmationHash),
      architectureConfirmationHash:
        text(iteration.architectureConfirmationHash) ||
        text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash),
      recordedAt,
      recordedBy: text(iteration.recordedBy) || 'canonical-reducer',
    };
  }
  return {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId,
    executionIterationId: text(iteration.executionIterationId) || `execution-${index + 1}`,
    runId,
    status: text(iteration.status) || 'done',
    traceRows,
    taskRefs: strings(iteration.taskRefs),
    evidenceRefs,
    filesChanged: strings(iteration.filesChanged),
    diffSummary: text(iteration.diffSummary),
    commandRunRefs: objects(iteration.commandRunRefs).map((command) =>
      normalizeCommandRunRef(command, fallback)
    ),
    evidenceArtifactRefs: objects(iteration.evidenceArtifactRefs).map((artifact) =>
      normalizeArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedIds)
    ),
    sourceRefs: normalizeSourceRefs(iteration.sourceRefs),
    sourceDocumentHash: text(iteration.sourceDocumentHash) || text(record.sourceDocumentHash),
    implementationConfirmationHash:
      text(iteration.implementationConfirmationHash) || text(record.implementationConfirmationHash),
    architectureConfirmationHash:
      text(iteration.architectureConfirmationHash) ||
      text(nested(record.architectureConfirmationState).currentArchitectureConfirmationHash),
    recordedAt,
    recordedBy: text(iteration.recordedBy) || 'canonical-reducer',
    ...(text(iteration.authorityClass) === 'untrusted_claim'
      ? {
          authorityClass: 'untrusted_claim',
          commandSuccessEligible: false,
          requirementClosureEligible: false,
          evidenceAcceptanceEligible: false,
          gatePassEligible: false,
          sixModelAdvancementEligible: false,
          completionEligible: false,
        }
      : {}),
  };
}

function normalizeClosure(closure: JsonObject, record: JsonObject): JsonObject {
  const recordedAt =
    text(closure.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'requirement_closure_recorded',
    recordId: text(closure.recordId) || text(record.recordId),
    requirementSetId:
      text(closure.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
    requirementId: text(closure.requirementId),
    status: ['open', 'pass', 'fail', 'blocked'].includes(text(closure.status))
      ? text(closure.status)
      : 'open',
    ...(text(closure.oracleId) ? { oracleId: text(closure.oracleId) } : {}),
    ...(text(closure.oracleResultHash)
      ? { oracleResultHash: text(closure.oracleResultHash) }
      : {}),
    ...(text(closure.oracleObservedAt)
      ? { oracleObservedAt: text(closure.oracleObservedAt) }
      : {}),
    traceRows: strings(closure.traceRows),
    evidenceRefs: strings(closure.evidenceRefs),
    commandRunRefs: objects(closure.commandRunRefs).map((command) =>
      normalizeCommandRunRef(command, {
        runId: 'closure-historical-run',
        startedAt: recordedAt,
        completedAt: recordedAt,
      })
    ),
    evidenceArtifactRefs: objects(closure.evidenceArtifactRefs).map((artifact) =>
      normalizeArtifactRef(
        artifact,
        text(record.recordId),
        text(record.requirementSetId) || text(record.recordId)
      )
    ),
    sourceRefs: normalizeSourceRefs(closure.sourceRefs),
    recordedAt,
    recordedBy: text(closure.recordedBy) || 'canonical-reducer',
  };
}

function normalizeGateCheck(check: JsonObject, record: JsonObject): JsonObject {
  const recordedAt = text(check.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'gate_check_recorded',
    ...(text(check.checkId) ? { checkId: text(check.checkId) } : {}),
    gate: text(check.gate) || 'unknown_gate',
    decision: ['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy'].includes(
      text(check.decision)
    )
      ? text(check.decision)
      : 'blocked',
    blockingReasons: strings(check.blockingReasons),
    checks: objects(check.checks),
    ...(text(check.reportPath)
      ? { reportPath: normalizePathForRecord(text(check.reportPath)) }
      : {}),
    sourceRefs: normalizeSourceRefs(check.sourceRefs),
    commandRunRefs: objects(check.commandRunRefs).map((command) =>
      normalizeCommandRunRef(command, {
        runId: 'gate-historical-run',
        startedAt: recordedAt,
        completedAt: recordedAt,
      })
    ),
    recordedAt,
    recordedBy: text(check.recordedBy) || 'canonical-reducer',
  };
}

function normalizeContractCheck(check: JsonObject, record: JsonObject): JsonObject {
  const recordedAt = text(check.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'contract_check_recorded',
    ...(text(check.checkId) ? { checkId: text(check.checkId) } : {}),
    contract: text(check.contract) || 'unknown_contract',
    decision: ['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy'].includes(
      text(check.decision)
    )
      ? text(check.decision)
      : 'blocked',
    sourceRefs: normalizeSourceRefs(check.sourceRefs),
    recordedAt,
    recordedBy: text(check.recordedBy) || 'canonical-reducer',
  };
}

function normalizeExecutionStrategySelection(
  selection: JsonObject,
  record: JsonObject
): JsonObject {
  const recordedAt =
    text(selection.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'execution_strategy_selected',
    recordId: text(selection.recordId) || text(record.recordId),
    requirementSetId:
      text(selection.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
    strategyId: text(selection.strategyId) || 'compiled_trace_direct',
    availability:
      text(selection.availability) === 'available' ? 'available' : text(selection.availability),
    selectedBy: text(selection.selectedBy) === 'user' ? 'user' : 'policy',
    strategyOptionsHash: text(selection.strategyOptionsHash),
    selectedOptionHash: text(selection.selectedOptionHash),
    modelPacketHash: text(selection.modelPacketHash),
    sourceDocumentHash: text(selection.sourceDocumentHash) || text(record.sourceDocumentHash),
    implementationConfirmationHash:
      text(selection.implementationConfirmationHash) || text(record.implementationConfirmationHash),
    sourceRefs: normalizeSourceRefs(selection.sourceRefs).length
      ? normalizeSourceRefs(selection.sourceRefs)
      : [
          {
            sourceType: 'execution_strategy_option',
            id: text(selection.strategyId) || 'compiled_trace_direct',
          },
        ],
    recordedAt,
    recordedBy: text(selection.recordedBy) || 'canonical-reducer',
  };
}

function normalizeArchitectureStatus(value: unknown, fallback: string): string {
  const status = text(value);
  return ['active', 'stale', 'blocked', 'missing', 'superseded'].includes(status)
    ? status
    : fallback;
}

function normalizeArchitectureConfirmationState(value: unknown): JsonObject | null {
  const source = nested(value);
  if (Object.keys(source).length === 0) return null;
  const currentHash = text(source.currentArchitectureConfirmationHash);
  const requestedStatus = text(source.status);
  const status =
    currentHash && ['active', 'stale', 'blocked'].includes(requestedStatus)
      ? requestedStatus
      : 'missing';
  const out: JsonObject = { status };
  for (const field of [
    'currentArchitectureConfirmationRunId',
    'currentArchitectureConfirmationHash',
    'currentArchitectureConfirmationPath',
    'resolvedRecipeHash',
    'lastEventType',
  ]) {
    const normalized = text(source[field]);
    if (normalized) out[field] = normalized;
  }
  const staleInputs = normalizeHashMap(source.staleInputs);
  if (Object.keys(staleInputs).length > 0) out.staleInputs = staleInputs;
  const updatedAt = text(source.updatedAt);
  if (updatedAt && !Number.isNaN(Date.parse(updatedAt))) out.updatedAt = updatedAt;
  return out;
}

function normalizeHashMap(value: unknown, fallback: JsonObject = {}): JsonObject {
  const source = nested(value);
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(source)) {
    const normalized = text(item);
    if (normalized) out[key] = normalized;
  }
  if (Object.keys(out).length > 0) return out;
  return fallback;
}

function normalizeArchitectureStateCheck(
  check: JsonObject,
  record: JsonObject,
  index: number
): JsonObject {
  const recordedAt =
    text(check.checkedAt) ||
    text(check.recordedAt) ||
    text(record.updatedAt) ||
    '2026-01-01T00:00:00.000Z';
  const state = nested(record.architectureConfirmationState);
  const transition = nested(check.stateTransition);
  const resolvedRecipeHash =
    text(check.resolvedRecipeHash) ||
    text(state.resolvedRecipeHash) ||
    'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const currentHashes = normalizeHashMap(transition.currentHashes, {
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    architectureConfirmationHash: text(state.currentArchitectureConfirmationHash),
    resolvedRecipeHash,
  });
  return {
    eventType: 'architecture_confirmation_state_checked',
    recordId: text(check.recordId) || text(record.recordId),
    requirementSetId:
      text(check.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
    checkId: text(check.checkId) || `architecture-state:canonicalized-${index + 1}`,
    decision: ['pass', 'fail', 'blocked'].includes(text(check.decision))
      ? text(check.decision)
      : 'blocked',
    resolvedRecipeHash,
    stateTransition: {
      fromStatus: normalizeArchitectureStatus(
        transition.fromStatus,
        normalizeArchitectureStatus(transition.toStatus, 'missing')
      ),
      toStatus: normalizeArchitectureStatus(
        transition.toStatus,
        normalizeArchitectureStatus(state.status, 'missing')
      ),
      reasonCode: text(transition.reasonCode) || 'canonicalized_historical_state_check',
      previousHashes: normalizeHashMap(transition.previousHashes),
      currentHashes,
      mismatchFields: strings(transition.mismatchFields),
      recipeVersion: 'architecture-confirmation-hash/v1',
    },
    checkedAt: recordedAt,
    checkedBy: text(check.checkedBy) || text(check.recordedBy) || 'canonical-reducer',
  };
}

function normalizeFailureRecord(
  failure: JsonObject,
  record: JsonObject,
  index: number
): JsonObject {
  const recordedAt =
    text(failure.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'failure_recorded',
    failureId: text(failure.failureId) || `failure-${index + 1}`,
    type: text(failure.type) || 'historical_failure',
    status: ['open', 'in_progress', 'resolved', 'blocked', 'superseded'].includes(
      text(failure.status)
    )
      ? text(failure.status)
      : 'open',
    ...(text(failure.closeoutAttemptId)
      ? { closeoutAttemptId: text(failure.closeoutAttemptId) }
      : {}),
    blockingReasons: strings(failure.blockingReasons),
    sourceRefs: normalizeSourceRefs(failure.sourceRefs).length
      ? normalizeSourceRefs(failure.sourceRefs)
      : [{ sourceType: 'failure_record', id: text(failure.failureId) || `failure-${index + 1}` }],
    recordedAt,
    recordedBy: text(failure.recordedBy) || 'canonical-reducer',
  };
}

function normalizeRcaRecord(rca: JsonObject, record: JsonObject, index: number): JsonObject {
  const recordedAt = text(rca.recordedAt) || text(record.updatedAt) || '2026-01-01T00:00:00.000Z';
  return {
    eventType: 'rca_created',
    rcaId: text(rca.rcaId) || `rca-${index + 1}`,
    type: text(rca.type) || 'historical_rca',
    status: ['open', 'in_progress', 'resolved', 'blocked'].includes(text(rca.status))
      ? text(rca.status)
      : 'open',
    sourceRefs: normalizeSourceRefs(rca.sourceRefs).length
      ? normalizeSourceRefs(rca.sourceRefs)
      : [{ sourceType: 'rca_record', id: text(rca.rcaId) || `rca-${index + 1}` }],
    recordedAt,
    recordedBy: text(rca.recordedBy) || 'canonical-reducer',
  };
}

function normalizeRerunLoop(loop: JsonObject, index: number): JsonObject {
  const sourceRefs = objects(loop.sourceRefs)
    .map((ref) => ({
      sourceType: [
        'gate_check',
        'contract_check',
        'audit_iteration',
        'execution_iteration',
        'requirement_closure',
        'failure_record',
      ].includes(text(ref.sourceType))
        ? text(ref.sourceType)
        : 'gate_check',
      id: text(ref.id) || text(ref.sourceId) || `rerun-loop-${index + 1}`,
    }))
    .filter((ref) => text(ref.id));
  return {
    rerunLoopId: text(loop.rerunLoopId) || `rerun-loop-${index + 1}`,
    status: [
      'open',
      'in_progress',
      'no_progress',
      'resolved',
      'blocked',
      'abandoned_by_user_confirmation',
    ].includes(text(loop.status))
      ? text(loop.status)
      : 'open',
    sourceRefs: sourceRefs.length
      ? sourceRefs
      : [{ sourceType: 'gate_check', id: `rerun-loop-${index + 1}` }],
    blockerRefs: normalizeSourceRefs(loop.blockerRefs),
    recheckRefs: normalizeSourceRefs(loop.recheckRefs),
  };
}

function normalizeDeliveryEvidence(
  deliveryEvidence: unknown,
  record: JsonObject
): JsonObject | undefined {
  const delivery = nested(deliveryEvidence);
  if (Object.keys(delivery).length === 0) return undefined;
  const recordId = text(record.recordId);
  const requirementSetId = text(record.requirementSetId) || recordId;
  const requiredCommands = objects(delivery.requiredCommands)
    .map((command): JsonObject | null => {
      const commandId = text(command.commandId);
      if (!commandId) return null;
      const artifactRefs = objects(command.artifactRefs).map((artifact) =>
        normalizeArtifactRef(artifact, recordId, requirementSetId)
      );
      if (artifactRefs.length === 0) return null;
      return {
        commandId,
        command: text(command.command) || commandId,
        ...(text(command.commandType) ? { commandType: text(command.commandType) } : {}),
        blockingIfMissing: true,
        ...(typeof command.negativeOrRegression === 'boolean'
          ? { negativeOrRegression: command.negativeOrRegression }
          : {}),
        ...(text(command.closeoutAttemptId)
          ? { closeoutAttemptId: text(command.closeoutAttemptId) }
          : {}),
        ...(nested(command.lastRunRef).commandId
          ? {
              lastRunRef: {
                commandId: text(nested(command.lastRunRef).commandId),
                runId: text(nested(command.lastRunRef).runId) || 'historical-run',
                closeoutAttemptId:
                  text(nested(command.lastRunRef).closeoutAttemptId) || 'historical-attempt',
              },
            }
          : {}),
        traceRows: strings(command.traceRows),
        evidenceRefs: strings(command.evidenceRefs),
        artifactRefs,
      };
    })
    .filter((command): command is JsonObject => command !== null);
  const historicalRunRefs = objects(delivery.historicalRunRefs)
    .map((run) => ({
      commandId: text(run.commandId),
      runId: text(run.runId) || 'historical-run',
      ...(text(run.closeoutAttemptId) ? { closeoutAttemptId: text(run.closeoutAttemptId) } : {}),
    }))
    .filter((run) => text(run.commandId));
  const normalized = {
    ...(requiredCommands.length ? { requiredCommands } : {}),
    ...(historicalRunRefs.length ? { historicalRunRefs } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeCloseout(closeoutValue: unknown): JsonObject | undefined {
  const closeout = nested(closeoutValue);
  if (Object.keys(closeout).length === 0) return undefined;
  const attempts = objects(closeout.attempts).map((attempt) => ({
    eventType: 'closeout_check_recorded',
    closeoutAttemptId: text(attempt.closeoutAttemptId) || 'historical-closeout-attempt',
    decision: ['pass', 'fail', 'blocked'].includes(text(attempt.decision))
      ? text(attempt.decision)
      : 'blocked',
    blockingReasons: strings(attempt.blockingReasons),
    checks: objects(attempt.checks),
    ...(text(attempt.reportPath)
      ? { reportPath: normalizePathForRecord(text(attempt.reportPath)) }
      : {}),
    ...(text(attempt.evaluatedAt) ? { evaluatedAt: text(attempt.evaluatedAt) } : {}),
    ...(text(attempt.evaluatedBy) ? { evaluatedBy: text(attempt.evaluatedBy) } : {}),
  }));
  const acceptanceRequest = nested(closeout.acceptanceRequest);
  return {
    currentAttemptId:
      text(closeout.currentAttemptId) ||
      text(attempts.at(-1)?.closeoutAttemptId) ||
      'historical-closeout-attempt',
    ...(text(closeout.decision) ? { decision: text(closeout.decision) } : {}),
    ...(Object.keys(acceptanceRequest).length
      ? {
          acceptanceRequest: {
            ...acceptanceRequest,
            status: ['awaiting_user_acceptance', 'user_accepted_closeout'].includes(
              text(acceptanceRequest.status)
            )
              ? text(acceptanceRequest.status)
              : 'awaiting_user_acceptance',
            closeoutAttemptId:
              text(acceptanceRequest.closeoutAttemptId) ||
              text(closeout.currentAttemptId) ||
              text(attempts.at(-1)?.closeoutAttemptId),
            ...(text(acceptanceRequest.htmlPath)
              ? { htmlPath: normalizePathForRecord(text(acceptanceRequest.htmlPath)) }
              : {}),
            ...(text(acceptanceRequest.renderReportPath)
              ? {
                  renderReportPath: normalizePathForRecord(
                    text(acceptanceRequest.renderReportPath)
                  ),
                }
              : {}),
            ...(text(acceptanceRequest.summaryPath)
              ? { summaryPath: normalizePathForRecord(text(acceptanceRequest.summaryPath)) }
              : {}),
          },
        }
      : {}),
    ...(text(closeout.updatedAt) ? { updatedAt: text(closeout.updatedAt) } : {}),
    attempts,
  };
}

function normalizeHookReconciliation(value: unknown): JsonObject | undefined {
  const hook = nested(value);
  if (Object.keys(hook).length === 0) return undefined;
  return {
    schemaVersion: 'hook-reconciliation/v1',
    hostKind: ['codex', 'cursor', 'claude', 'unknown'].includes(text(hook.hostKind))
      ? text(hook.hostKind)
      : 'unknown',
    hostMode: ['hooks_enabled', 'no_hooks', 'unknown'].includes(text(hook.hostMode))
      ? text(hook.hostMode)
      : 'unknown',
    hookTrust: ['trusted', 'degraded', 'untrusted', 'unknown'].includes(text(hook.hookTrust))
      ? text(hook.hookTrust)
      : 'unknown',
    fallbackMode: ['none', 'no_hooks', 'bounded_replay', 'blocked'].includes(
      text(hook.fallbackMode)
    )
      ? text(hook.fallbackMode)
      : 'none',
    closeoutReconciled: hook.closeoutReconciled === true,
    sequenceLedger: {
      status: ['clean', 'reconciled', 'gap', 'missing', 'stale', 'unknown'].includes(
        text(nested(hook.sequenceLedger).status)
      )
        ? text(nested(hook.sequenceLedger).status)
        : 'unknown',
      ...(Number.isInteger(nested(hook.sequenceLedger).expectedNextSequence)
        ? { expectedNextSequence: nested(hook.sequenceLedger).expectedNextSequence }
        : {}),
      observedSequences: Array.isArray(nested(hook.sequenceLedger).observedSequences)
        ? (nested(hook.sequenceLedger).observedSequences as unknown[]).filter(
            (value): value is number => Number.isInteger(value)
          )
        : [],
    },
    missingReceipts: objects(hook.missingReceipts).map((receipt) => ({
      receiptType: text(receipt.receiptType) || 'unknown_receipt',
      expectedEventId: text(receipt.expectedEventId) || 'unknown_event',
      ...(text(receipt.severity) ? { severity: text(receipt.severity) } : {}),
    })),
    hashMismatches: objects(hook.hashMismatches).map((mismatch) => ({
      field: text(mismatch.field) || 'unknown_field',
      expected: text(mismatch.expected) || 'unknown_expected',
      actual: text(mismatch.actual) || 'unknown_actual',
    })),
    noHookFallbackRefs: normalizeSourceRefs(hook.noHookFallbackRefs),
  };
}

function normalizeImplementationEntryGate(value: unknown): JsonObject | undefined {
  const gate = nested(value);
  if (Object.keys(gate).length === 0) return undefined;
  const rawDecision = text(gate.decision);
  const decision =
    rawDecision === 'pass' || rawDecision === 'reroute'
      ? rawDecision
      : rawDecision === 'block' || rawDecision === 'blocked' || rawDecision === 'fail'
        ? 'block'
        : 'block';
  return {
    ...gate,
    gateName: 'implementation-readiness',
    decision,
  };
}

function normalizeMentalModel(value: unknown): string | undefined {
  const model = text(value);
  if (
    [
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_confirmation',
    ].includes(model)
  ) {
    return model;
  }
  if (model === 'delivery_closeout') return 'delivery_confirmation';
  return undefined;
}

function latestConfirmationTimestamp(record: JsonObject): string {
  return text(objects(record.confirmationHistory).at(-1)?.confirmedAt);
}

function normalizeModelResult(result: JsonObject, record: JsonObject, model: string): JsonObject {
  const recordedAt =
    text(result.resultRecordedAt) ||
    text(result.recordedAt) ||
    text(record.updatedAt) ||
    latestConfirmationTimestamp(record);
  const status = text(result.status);
  return {
    payloadKind: 'model_result',
    model,
    recordId: text(result.recordId) || text(record.recordId),
    requirementSetId:
      text(result.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: text(result.sourceDocumentHash) || text(record.sourceDocumentHash),
    implementationConfirmationHash:
      text(result.implementationConfirmationHash) || text(record.implementationConfirmationHash),
    ...(text(result.semanticModelHash) || text(record.semanticModelHash)
      ? { semanticModelHash: text(result.semanticModelHash) || text(record.semanticModelHash) }
      : {}),
    ...(text(result.currentAttemptId) || text(record.currentAttemptId)
      ? { currentAttemptId: text(result.currentAttemptId) || text(record.currentAttemptId) }
      : {}),
    ...(text(result.decisionReceiptRef)
      ? { decisionReceiptRef: text(result.decisionReceiptRef) }
      : {}),
    ...(text(result.decisionReceiptHash)
      ? { decisionReceiptHash: text(result.decisionReceiptHash) }
      : {}),
    status: [
      'pass',
      'blocked',
      'fail',
      'stale',
      'not_established',
      'awaiting_user_acceptance',
    ].includes(status)
      ? status
      : 'blocked',
    resultRecordedAt: recordedAt,
    resultRecordedBy:
      text(result.resultRecordedBy) || text(result.recordedBy) || 'canonical-reducer',
    blockingReasons: strings(result.blockingReasons),
    sourceRefs: normalizeSourceRefs(result.sourceRefs),
    currentHashes: nested(result.currentHashes),
    ...(nested(result.readinessReportRef).path
      ? { readinessReportRef: nested(result.readinessReportRef) }
      : {}),
    ...(nested(result.deliveryCloseoutReportRef).path
      ? { deliveryCloseoutReportRef: nested(result.deliveryCloseoutReportRef) }
      : {}),
    ...(nested(result.readinessBaselineMetadata).status
      ? {
          readinessBaselineMetadata: normalizeReadinessBaselineMetadata(
            result.readinessBaselineMetadata,
            record
          ),
        }
      : {}),
  };
}

function normalizeSixModelResults(value: unknown, record: JsonObject): JsonObject | undefined {
  const results = nested(value);
  if (Object.keys(results).length === 0) return undefined;
  const out: JsonObject = {};
  for (const model of [
    'requirement_confirmation',
    'architecture_confirmation',
    'implementation_readiness',
    'execution_closure',
    'audit_review',
    'delivery_confirmation',
  ]) {
    const result = nested(results[model]);
    if (Object.keys(result).length > 0) out[model] = normalizeModelResult(result, record, model);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeReadinessBaselineMetadata(
  value: unknown,
  record: JsonObject
): JsonObject | undefined {
  const metadata = nested(value);
  if (Object.keys(metadata).length === 0) return undefined;
  const status = text(metadata.status);
  return {
    ...metadata,
    baselineId:
      text(metadata.baselineId) ||
      `readiness-baseline:${text(record.requirementSetId) || text(record.recordId)}`,
    activationId:
      text(metadata.activationId) ||
      `readiness-baseline:${text(record.requirementSetId) || text(record.recordId)}:not-established`,
    status: ['current', 'stale', 'blocked', 'not_established'].includes(status)
      ? status
      : 'not_established',
    scoringRunId: text(metadata.scoringRunId) || 'readiness-scoring:not-established',
    scoringRecordPath:
      text(metadata.scoringRecordPath) ||
      '_bmad-output/runtime/readiness-scoring/not-established.json',
    sourceRequirementRecordHash:
      text(metadata.sourceRequirementRecordHash) ||
      'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    auditTraceHash:
      text(metadata.auditTraceHash) ||
      'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    readinessGateRecipeVersion:
      text(metadata.readinessGateRecipeVersion) || 'implementation-readiness-gate/v1',
  };
}

export function canonicalizeRequirementRecord(record: JsonObject): JsonObject {
  const recordId = text(record.recordId);
  const requirementSetId = text(record.requirementSetId) || recordId;
  const allowedTopLevel = new Set([
    'schemaVersion',
    'recordId',
    'requirementSetId',
    'sourcePath',
    'status',
    'flow',
    'stage',
    'currentStage',
    'entryFlow',
    'entryFlowClass',
    'workflowAdapter',
    'sourceMode',
    'templateId',
    'epicId',
    'storyId',
    'storySlug',
    'runId',
    'artifactRoot',
    'artifactPath',
    'currentMentalModel',
    'mentalModelTransitions',
    'sixModelResults',
    'pendingBlockerIntake',
    'blockerIntakeRuns',
    'reconfirmationRequests',
    'bmadAssociation',
    'sprintStatusUpdateAuthorizations',
    'externalBoardSyncReceipts',
    'implementationEntryGate',
    'contractAuthoringRequired',
    'globalContractTraceabilityPolicy',
    'traceStatusPolicy',
    'runtimePolicySnapshotRef',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'semanticModelHash',
    'transactionId',
    'packetHash',
    'currentAttemptId',
    'confirmationPageHash',
    'latestConfirmationProjectionHash',
    'confirmationProjectionHistory',
    'confirmationHistory',
    'controlledIngestWriterRegistryRequired',
    'controlledIngestWriterRegistry',
    'controlledIngestWriterRegistryHash',
    'architectureConfirmationState',
    'architectureConfirmations',
    'architectureConfirmationStateChecks',
    'executionIterations',
    'executionStrategySelections',
    'requirementClosures',
    'gateChecks',
    'contractChecks',
    'failureRecords',
    'rcaRecords',
    'rerunLoops',
    'closeout',
    'closeoutAcceptance',
    'closeoutAcceptanceHistory',
    'readinessBaselineActivation',
    'readinessBaselineActivationEventType',
    'readinessAuditRequests',
    'readinessAuditResults',
    'readinessScoringRecords',
    'readinessBaselineMetadata',
    'artifactIndex',
    'extensionRefs',
    'deliveryEvidence',
    'nativeGoalHandoff',
    'implementationReadiness',
    'executionClosures',
    'auditReviews',
    'deliveryConfirmations',
    'externalBoardEvidence',
    'bmadAssociations',
    'postCloseDefectLinks',
    'semanticCoverage',
    'auditReviewDispatchPackets',
    'auditScoringConvergence',
    'sixModelRuntimeDecisions',
    'runtimeStatusDecisionReceipts',
    'runtimeModeSelections',
    'taskProgress',
    'auditTriadConvergence',
    'hookReconciliation',
    'latestReviewerCloseout',
    'aiTddContractGate',
    'lastEventType',
    'updatedAt',
    'recordHash',
    'lastAppliedEventId',
    'lastAppliedEventHash',
    'eventChainHead',
    'eventCount',
    'recordRevision',
    'activeBundleRevision',
    'controlStore',
  ]);
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(record)) {
    if (allowedTopLevel.has(key)) out[key] = value;
  }
  out.recordId = recordId;
  out.requirementSetId = requirementSetId;
  out.status = text(out.status) || 'blocked';
  out.sourcePath = text(out.sourcePath) || 'docs/design/unknown.md';
  out.sourceDocumentHash = text(out.sourceDocumentHash);
  out.implementationConfirmationHash = text(out.implementationConfirmationHash);
  const semanticModelHash = text(out.semanticModelHash);
  if (semanticModelHash) out.semanticModelHash = semanticModelHash;
  else delete out.semanticModelHash;
  const transactionId = text(out.transactionId);
  if (transactionId) out.transactionId = transactionId;
  else delete out.transactionId;
  const packetHash = text(out.packetHash);
  if (packetHash) out.packetHash = packetHash;
  else delete out.packetHash;
  const currentAttemptId = text(out.currentAttemptId) || text(out.runId);
  if (currentAttemptId) out.currentAttemptId = currentAttemptId;
  else delete out.currentAttemptId;
  const recordRevision = Number(out.recordRevision);
  out.recordRevision =
    Number.isInteger(recordRevision) && recordRevision >= 0
      ? recordRevision
      : Number(out.eventCount ?? 0);
  const activeBundleRevision = text(out.activeBundleRevision);
  out.activeBundleRevision = activeBundleRevision || null;
  const currentMentalModel = normalizeMentalModel(out.currentMentalModel);
  if (currentMentalModel) out.currentMentalModel = currentMentalModel;
  else delete out.currentMentalModel;
  const sixModelResults = normalizeSixModelResults(out.sixModelResults, out);
  if (sixModelResults) out.sixModelResults = sixModelResults;
  else delete out.sixModelResults;
  out.runtimeStatusDecisionReceipts = objects(out.runtimeStatusDecisionReceipts);
  out.mentalModelTransitions = objects(out.mentalModelTransitions);
  out.pendingBlockerIntake = objects(out.pendingBlockerIntake);
  out.blockerIntakeRuns = objects(out.blockerIntakeRuns);
  out.reconfirmationRequests = objects(out.reconfirmationRequests);
  if (Object.keys(nested(out.bmadAssociation)).length > 0)
    out.bmadAssociation = nested(out.bmadAssociation);
  else delete out.bmadAssociation;
  out.sprintStatusUpdateAuthorizations = objects(out.sprintStatusUpdateAuthorizations);
  out.externalBoardSyncReceipts = objects(out.externalBoardSyncReceipts);
  const implementationEntryGate = normalizeImplementationEntryGate(out.implementationEntryGate);
  if (implementationEntryGate) out.implementationEntryGate = implementationEntryGate;
  else delete out.implementationEntryGate;
  if (out.runtimePolicySnapshotRef) {
    const runtimePolicySnapshotRef = normalizeArtifactRef(
      nested(out.runtimePolicySnapshotRef),
      recordId,
      requirementSetId
    );
    const contentHash =
      text(runtimePolicySnapshotRef.contentHash) ||
      sha256FileIfPresent(runtimePolicySnapshotRef.path);
    if (contentHash) {
      runtimePolicySnapshotRef.contentHash = contentHash;
      out.runtimePolicySnapshotRef = runtimePolicySnapshotRef;
    } else {
      delete out.runtimePolicySnapshotRef;
    }
  }
  const architectureConfirmationState = normalizeArchitectureConfirmationState(
    out.architectureConfirmationState
  );
  if (architectureConfirmationState) {
    out.architectureConfirmationState = architectureConfirmationState;
  } else {
    delete out.architectureConfirmationState;
  }
  const confirmationHistory = objects(out.confirmationHistory);
  out.confirmationHistory = confirmationHistory;
  if (confirmationHistory.length === 0) out.status = 'blocked';
  out.architectureConfirmations = objects(out.architectureConfirmations).map((event) => ({
    ...event,
    eventType: 'architecture_confirmation_recorded',
    artifactRef: event.artifactRef
      ? normalizeArtifactRef(nested(event.artifactRef), recordId, requirementSetId)
      : undefined,
  }));
  out.architectureConfirmationStateChecks = objects(out.architectureConfirmationStateChecks).map(
    (check, index) => normalizeArchitectureStateCheck(check, out, index)
  );
  out.executionIterations = objects(out.executionIterations).map((iteration, index) =>
    normalizeExecutionIteration(iteration, out, index)
  );
  out.executionStrategySelections = objects(out.executionStrategySelections).map((selection) =>
    normalizeExecutionStrategySelection(selection, out)
  );
  out.requirementClosures = objects(out.requirementClosures)
    .map((closure) => normalizeClosure(closure, out))
    .filter((closure) => text(closure.requirementId));
  out.gateChecks = objects(out.gateChecks).map((check) => normalizeGateCheck(check, out));
  out.contractChecks = objects(out.contractChecks).map((check) =>
    normalizeContractCheck(check, out)
  );
  out.failureRecords = objects(out.failureRecords).map((failure, index) =>
    normalizeFailureRecord(failure, out, index)
  );
  out.rcaRecords = objects(out.rcaRecords).map((rca, index) => normalizeRcaRecord(rca, out, index));
  out.rerunLoops = objects(out.rerunLoops).map((loop, index) => normalizeRerunLoop(loop, index));
  const closeout = normalizeCloseout(out.closeout);
  if (closeout) out.closeout = closeout;
  else delete out.closeout;
  out.artifactIndex = objects(out.artifactIndex).map((artifact) =>
    normalizeArtifactRef(artifact, recordId, requirementSetId)
  );
  out.extensionRefs = objects(out.extensionRefs).map((artifact) =>
    normalizeArtifactRef(artifact, recordId, requirementSetId)
  );
  const deliveryEvidence = normalizeDeliveryEvidence(out.deliveryEvidence, out);
  if (deliveryEvidence) out.deliveryEvidence = deliveryEvidence;
  else delete out.deliveryEvidence;
  for (const field of [
    'implementationReadiness',
    'executionClosures',
    'auditReviews',
    'deliveryConfirmations',
    'externalBoardEvidence',
    'bmadAssociations',
    'postCloseDefectLinks',
    'semanticCoverage',
    'auditReviewDispatchPackets',
    'auditScoringConvergence',
    'sixModelRuntimeDecisions',
    'runtimeModeSelections',
    'taskProgress',
    'auditTriadConvergence',
  ]) {
    out[field] = objects(out[field]);
  }
  const hookReconciliation = normalizeHookReconciliation(out.hookReconciliation);
  if (hookReconciliation) out.hookReconciliation = hookReconciliation;
  else delete out.hookReconciliation;
  const readinessBaselineMetadata = normalizeReadinessBaselineMetadata(
    out.readinessBaselineMetadata,
    out
  );
  if (readinessBaselineMetadata) out.readinessBaselineMetadata = readinessBaselineMetadata;
  else delete out.readinessBaselineMetadata;
  const updatedAt = text(out.updatedAt) || latestConfirmationTimestamp(out);
  if (updatedAt) out.updatedAt = updatedAt;
  else delete out.updatedAt;
  if (!text(out.lastEventType)) out.lastEventType = 'canonical_record_reduced';
  return withoutUndefined(out) as JsonObject;
}

function latestEventHash(events: ControlEventEnvelope[]): string {
  return text(events.at(-1)?.eventHash) || ZERO_HASH;
}

function assertEventWriterOwnership(
  events: ControlEventEnvelope[],
  eventType: string,
  writerId: string
): void {
  if (!text(eventType) || !text(writerId)) {
    throw new Error('control_store_event_writer_ownership_missing');
  }
  const owners = new Set(
    events
      .filter((event) => event.eventType === eventType)
      .map((event) => text(event.writerId))
      .filter(Boolean)
  );
  if (owners.size > 1) {
    throw new Error(`control_store_event_writer_history_conflict:${eventType}`);
  }
  const currentOwner = [...owners][0];
  if (currentOwner && currentOwner !== writerId) {
    throw new Error(
      `control_store_event_writer_ownership_mismatch:${eventType}:${currentOwner}:${writerId}`
    );
  }
}

function createEvent(input: {
  eventId?: string;
  eventType: string;
  writerId: string;
  record: JsonObject;
  payload: JsonObject;
  recordedAt: string;
  previousEventHash: string;
  beforeRecordHash: string;
  afterRecordHash: string;
  payloadSchemaVersion: string;
  writerAuthorization?: ControlWriterAuthorization;
}): ControlEventEnvelope {
  const payloadHash = sha256Json(input.payload);
  const eventId =
    text(input.eventId) ||
    `${input.eventType}:${input.recordedAt}:${payloadHash.slice('sha256:'.length, 'sha256:'.length + 12)}`;
  const unsigned = {
    eventId,
    eventType: input.eventType,
    eventSchemaVersion: 'control-event-envelope/v1',
    payloadSchemaVersion: input.payloadSchemaVersion,
    writerId: input.writerId,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    recordedAt: input.recordedAt,
    previousEventHash: input.previousEventHash,
    beforeRecordHash: input.beforeRecordHash,
    afterRecordHash: input.afterRecordHash,
    payloadHash,
    ...(input.writerAuthorization
      ? {
          writerRegistryHash: input.writerAuthorization.writerRegistryHash,
          writerHash: input.writerAuthorization.writerHash,
        }
      : {}),
    payload: input.payload,
  } satisfies Omit<ControlEventEnvelope, 'eventHash'>;
  return {
    ...unsigned,
    eventHash: sha256Json(unsigned),
  };
}

export function appendControlEventAndReplay(
  input: AppendInput,
  deps: ControlStoreCommitDeps = {}
): ControlCommitResult {
  const recordPath = path.resolve(input.recordPath);
  recoverControlStore(recordPath);
  assertControlStoreLockAvailable(recordPath);
  const preLock = commitInputRecord(recordPath, input);
  const preLockRecord = preLock.record;
  assertCommitInputRecord(preLockRecord, input.bootstrapConfirmation === true);
  const preLockStateHash = sha256Json(preLockRecord);
  const artifactIndexTargets = artifactIndexTargetPaths(
    recordPath,
    input.artifactIndexUpdates ?? []
  );
  const artifactWriteTargets = declaredControlArtifactWriteTargets(
    recordPath,
    input.artifactWrites ?? []
  );
  const transactionId = `CTRL-${sha256Json({
    recordPath: normalizePathForRecord(recordPath),
    writerId: input.writerId,
    eventType: input.eventType,
    eventId: input.eventId ?? null,
    payload: input.payload,
    artifactIndexUpdates: (input.artifactIndexUpdates ?? []).map((update) => ({
      path: normalizePathForRecord(path.resolve(update.path)),
      entries: update.entries,
    })),
    artifactWrites: (input.artifactWrites ?? []).map((write, index) => ({
      path: normalizePathForRecord(artifactWriteTargets[index]),
      contentHash: text(write.contentHash),
    })),
    preLockStateHash,
  }).slice(7, 31)}`;
  const lockPath = acquireControlStoreLock(
    recordPath,
    transactionId,
    input.writerId,
    input.eventType,
    artifactIndexTargets,
    artifactWriteTargets
  );
  let artifactIndexLocks: ArtifactIndexLock[] = [];
  let stagingDir = '';
  let boundaryCommitted = false;
  const reachBoundary = (boundary: ControlCommitBoundary): void => {
    assertControlStoreLockOwnership(lockPath, transactionId);
    assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
    deps.beforeBoundary?.(boundary);
    assertControlStoreLockOwnership(lockPath, transactionId);
    assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
  };
  try {
    artifactIndexLocks = acquireArtifactIndexLocks({
      recordPath,
      transactionId,
      writerId: input.writerId,
      eventType: input.eventType,
      targetPaths: artifactIndexTargets,
    });
    const current = commitInputRecord(recordPath, input);
    const currentRecord = current.record;
    assertCommitInputRecord(currentRecord, input.bootstrapConfirmation === true);
    if (current.exists !== preLock.exists || sha256Json(currentRecord) !== preLockStateHash) {
      throw new Error('control_store_compare_and_swap_failed:record_changed_before_lock');
    }
    const beforeRecord = canonicalizeRequirementRecord(currentRecord);
    const beforeRecordHash = sha256Json(beforeRecord);
    if (
      input.expectedBeforeRecordHash &&
      input.expectedBeforeRecordHash !== beforeRecordHash
    ) {
      throw new Error('control_store_compare_and_swap_failed:before_record_hash_mismatch');
    }
    const recordedAt = input.recordedAt ?? new Date().toISOString();
    const eventLogPath = eventLogPathForRecord(recordPath);
    const existingEvents = readEventLog(eventLogPath);
    const writerAuthorization = assertControlWriterAuthorization(
      beforeRecord,
      input.eventType,
      input.writerId
    );
    assertEventWriterOwnership(existingEvents, input.eventType, input.writerId);
    const reducedRecord = canonicalizeRequirementRecord(
      input.reduce(beforeRecord, input.payload)
    );
    const authorityContext: ControlArtifactAuthorityContext = {
      record: reducedRecord,
      payload: input.payload,
    };
    const validatedArtifactWriteTargets = controlArtifactWriteTargets(
      recordPath,
      input.artifactWrites ?? [],
      authorityContext
    );
    if (
      JSON.stringify(validatedArtifactWriteTargets) !== JSON.stringify(artifactWriteTargets)
    ) {
      throw new Error('control_store_artifact_write_target_changed_after_validation');
    }
    assertControlWriterRegistryImmutable(beforeRecord, reducedRecord);
    const event = createEvent({
      eventId: input.eventId,
      eventType: input.eventType,
      writerId: input.writerId,
      record: beforeRecord,
      payload: input.payload,
      recordedAt,
      previousEventHash: latestEventHash(existingEvents),
      beforeRecordHash,
      afterRecordHash: sha256Json(reducedRecord),
      payloadSchemaVersion: input.payloadSchemaVersion ?? `${input.eventType}/v1`,
      writerAuthorization,
    });
    if (
      existingEvents.some((entry) => entry.eventId === event.eventId) ||
      fs.existsSync(
        receiptPathForEvent(
          recordPath,
          event.eventId.replace(/[^a-z0-9_.-]/giu, '_')
        )
      )
    ) {
      throw new Error(`control_store_duplicate_event:${event.eventId}`);
    }
    const nextRecord = {
      ...reducedRecord,
      schemaVersion: text(reducedRecord.schemaVersion) || 'requirement-record/v1',
      recordHash: event.afterRecordHash,
      lastAppliedEventId: event.eventId,
      lastAppliedEventHash: event.eventHash,
      eventChainHead: event.eventHash,
      eventCount: existingEvents.length + 1,
      controlStore: {
        schemaVersion: 'control-store/v1',
        eventLogPath: normalizePathForRecord(eventLogPath),
        lastEventId: event.eventId,
        lastEventHash: event.eventHash,
        reducer: 'canonical-requirement-record-reducer/v1',
        atomicCommitter: 'requirement-record-control-store/v1',
      },
    };
    const validation = validateRequirementRecordSchemaObject(nextRecord);
    if (!input.skipSchemaGate && !validation.ok) {
      throw new Error(
        `live requirement-record schema gate failed: ${validation.errorCount} errors: ${JSON.stringify(
          validation.errors.slice(0, 5)
        )}`
      );
    }
    const receiptPath = receiptPathForEvent(
      recordPath,
      event.eventId.replace(/[^a-z0-9_.-]/giu, '_')
    );
    const artifactIndexUpdates = prepareArtifactIndexUpdates(
      recordPath,
      input.artifactIndexUpdates ?? []
    );
    const artifactWrites = prepareArtifactWrites(
      recordPath,
      input.artifactWrites ?? [],
      authorityContext
    );
    const receipt = {
      receiptType: 'control_event_committed',
      transactionId,
      eventId: event.eventId,
      eventHash: event.eventHash,
      eventType: event.eventType,
      writerId: input.writerId,
      ...(writerAuthorization
        ? {
            writerRegistryHash: writerAuthorization.writerRegistryHash,
            writerHash: writerAuthorization.writerHash,
          }
        : {}),
      recordId: event.recordId,
      requirementSetId: event.requirementSetId,
      eventLogPath: normalizePathForRecord(eventLogPath),
      beforeRecordHash,
      afterRecordHash: event.afterRecordHash,
      artifactIndexPaths: artifactIndexUpdates.map((update) =>
        normalizePathForRecord(update.targetPath)
      ),
      artifactPaths: artifactWrites.map((write) =>
        normalizePathForRecord(write.targetPath)
      ),
      schemaGate: { ok: validation.ok, errorCount: validation.errorCount },
      committedAt: recordedAt,
    };
    const controlRoot = controlStoreRoot(recordPath);
    const transactionsRoot = path.join(controlRoot, 'transactions');
    stagingDir = path.join(transactionsRoot, `.staging-${transactionId}`);
    const committedDir = path.join(transactionsRoot, transactionId);
    if (fs.existsSync(stagingDir) || fs.existsSync(committedDir)) {
      throw new Error(`control_store_transaction_collision:${transactionId}`);
    }
    fs.mkdirSync(stagingDir, { recursive: true });
    const eventLogText = `${[
      ...existingEvents.map((entry) => JSON.stringify(entry)),
      JSON.stringify(event),
    ].join('\n')}\n`;
    const recordText = `${JSON.stringify(nextRecord, null, 2)}\n`;
    const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
    const previousRecord = preLock.exists ? fs.readFileSync(recordPath) : null;
    const previousEventLog = fs.existsSync(eventLogPath)
      ? fs.readFileSync(eventLogPath)
      : null;
    const previousReceipt = fs.existsSync(receiptPath)
      ? fs.readFileSync(receiptPath)
      : null;
    writeTextAtomic(path.join(stagingDir, 'control-events.jsonl'), eventLogText);
    writeTextAtomic(path.join(stagingDir, 'requirement-record.json'), recordText);
    writeTextAtomic(path.join(stagingDir, 'commit-receipt.json'), receiptText);
    const previousDir = path.join(stagingDir, 'previous');
    if (previousRecord) {
      writeTextAtomic(
        path.join(previousDir, 'requirement-record.json'),
        previousRecord.toString('utf8')
      );
    }
    if (previousEventLog) {
      writeTextAtomic(
        path.join(previousDir, 'control-events.jsonl'),
        previousEventLog.toString('utf8')
      );
    }
    if (previousReceipt) {
      writeTextAtomic(
        path.join(previousDir, 'commit-receipt.json'),
        previousReceipt.toString('utf8')
      );
    }
    for (const artifactIndex of artifactIndexUpdates) {
      writeTextAtomic(
        path.join(stagingDir, artifactIndex.stagedRelativePath),
        artifactIndex.nextText
      );
      if (artifactIndex.previousText !== null) {
        writeTextAtomic(
          path.join(stagingDir, artifactIndex.previousRelativePath),
          artifactIndex.previousText
        );
      }
    }
    for (const artifactWrite of artifactWrites) {
      writeTextAtomic(
        path.join(stagingDir, artifactWrite.stagedRelativePath),
        artifactWrite.nextText
      );
      if (artifactWrite.previousText !== null) {
        writeTextAtomic(
          path.join(stagingDir, artifactWrite.previousRelativePath),
          artifactWrite.previousText
        );
      }
    }
    writeJsonAtomic(path.join(stagingDir, 'transaction-manifest.json'), {
      schemaVersion: 'requirement-record-control-transaction/v1',
      transactionId,
      eventId: event.eventId,
      eventHash: event.eventHash,
      writerId: input.writerId,
      eventType: input.eventType,
      beforeRecordHash,
      afterRecordHash: event.afterRecordHash,
      targets: {
        eventLogPath: normalizePathForRecord(eventLogPath),
        recordPath: normalizePathForRecord(recordPath),
        receiptPath: normalizePathForRecord(receiptPath),
      },
      stagedHashes: {
        eventLogHash: sha256Text(eventLogText),
        recordHash: sha256Text(recordText),
        receiptHash: sha256Text(receiptText),
      },
      previous: {
        recordExists: previousRecord !== null,
        eventLogExists: previousEventLog !== null,
        receiptExists: previousReceipt !== null,
        recordHash: previousRecord ? sha256Text(previousRecord.toString('utf8')) : null,
        eventLogHash: previousEventLog
          ? sha256Text(previousEventLog.toString('utf8'))
          : null,
        receiptHash: previousReceipt
          ? sha256Text(previousReceipt.toString('utf8'))
          : null,
      },
      artifactIndexes: artifactIndexUpdates.map((update) => ({
        targetPath: normalizePathForRecord(update.targetPath),
        stagedRelativePath: update.stagedRelativePath,
        stagedHash: sha256Text(update.nextText),
        previousRelativePath: update.previousRelativePath,
        previousExists: update.previousText !== null,
        previousHash:
          update.previousText !== null ? sha256Text(update.previousText) : null,
      })),
      artifactWrites: artifactWrites.map((write) => ({
        targetPath: normalizePathForRecord(write.targetPath),
        stagedRelativePath: write.stagedRelativePath,
        contentHash: write.contentHash,
        previousRelativePath: write.previousRelativePath,
        previousExists: write.previousText !== null,
        previousHash:
          write.previousText !== null ? sha256Text(write.previousText) : null,
      })),
      preparedAt: recordedAt,
    });
    if (
      readEventLog(path.join(stagingDir, 'control-events.jsonl')).at(-1)?.eventHash !==
        event.eventHash ||
      sha256Json(readJson(path.join(stagingDir, 'requirement-record.json'))) !==
        sha256Json(nextRecord) ||
      text(readJson(path.join(stagingDir, 'commit-receipt.json')).eventHash) !==
        event.eventHash ||
      artifactWrites.some(
        (write) =>
          sha256Text(
            fs.readFileSync(path.join(stagingDir, write.stagedRelativePath), 'utf8')
          ) !== write.contentHash
      )
    ) {
      throw new Error('control_store_staging_readback_failed');
    }
    reachBoundary('after_stage');

    const restore = (): void => {
      if (previousRecord) {
        writeTextAtomic(recordPath, previousRecord.toString('utf8'));
      } else if (fs.existsSync(recordPath)) {
        fs.rmSync(recordPath, { force: true });
      }
      if (previousEventLog) {
        writeTextAtomic(eventLogPath, previousEventLog.toString('utf8'));
      } else if (fs.existsSync(eventLogPath)) {
        fs.rmSync(eventLogPath, { force: true });
      }
      if (previousReceipt) {
        writeTextAtomic(receiptPath, previousReceipt.toString('utf8'));
      } else if (fs.existsSync(receiptPath)) {
        fs.rmSync(receiptPath, { force: true });
      }
      for (const artifactIndex of artifactIndexUpdates) {
        if (artifactIndex.previousText !== null) {
          writeTextAtomic(artifactIndex.targetPath, artifactIndex.previousText);
        } else if (fs.existsSync(artifactIndex.targetPath)) {
          fs.rmSync(artifactIndex.targetPath, { force: true });
        }
      }
      for (const artifactWrite of artifactWrites) {
        if (artifactWrite.previousText !== null) {
          writeTextAtomic(artifactWrite.targetPath, artifactWrite.previousText);
        } else if (fs.existsSync(artifactWrite.targetPath)) {
          fs.rmSync(artifactWrite.targetPath, { force: true });
        }
      }
    };
    try {
      reachBoundary('before_event_log');
      writeTextAtomic(eventLogPath, eventLogText);
      reachBoundary('before_record');
      writeTextAtomic(recordPath, recordText);
      reachBoundary('before_receipt');
      writeTextAtomic(receiptPath, receiptText);
      for (const [index, artifactIndex] of artifactIndexUpdates.entries()) {
        assertControlStoreLockOwnership(lockPath, transactionId);
        assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
        deps.beforeArtifactIndex?.(artifactIndex.targetPath, index);
        assertControlStoreLockOwnership(lockPath, transactionId);
        assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
        writeTextAtomic(artifactIndex.targetPath, artifactIndex.nextText);
      }
      for (const [index, artifactWrite] of artifactWrites.entries()) {
        assertControlStoreLockOwnership(lockPath, transactionId);
        assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
        deps.beforeArtifactWrite?.(artifactWrite.targetPath, index);
        assertControlStoreLockOwnership(lockPath, transactionId);
        assertArtifactIndexLockOwnership(artifactIndexLocks, transactionId);
        writeTextAtomic(artifactWrite.targetPath, artifactWrite.nextText);
      }
      if (
        readEventLog(eventLogPath).at(-1)?.eventHash !== event.eventHash ||
        text(readJson(recordPath).lastAppliedEventHash) !== event.eventHash ||
        text(readJson(receiptPath).eventHash) !== event.eventHash ||
        artifactIndexUpdates.some(
          (update) =>
            !fs.existsSync(update.targetPath) ||
            sha256Text(fs.readFileSync(update.targetPath, 'utf8')) !==
              sha256Text(update.nextText)
        ) ||
        artifactWrites.some(
          (write) =>
            !fs.existsSync(write.targetPath) ||
            sha256Text(fs.readFileSync(write.targetPath, 'utf8')) !== write.contentHash
        )
      ) {
        throw new Error('control_store_promotion_readback_failed');
      }
      reachBoundary('before_commit_boundary');
      fs.renameSync(stagingDir, committedDir);
      stagingDir = '';
      reachBoundary('after_transaction_promotion');
      writeJsonAtomic(path.join(controlRoot, 'current-commit.json'), {
        schemaVersion: 'requirement-record-control-commit-marker/v1',
        transactionId,
        eventId: event.eventId,
        eventHash: event.eventHash,
        afterRecordHash: event.afterRecordHash,
        committedTransactionPath: normalizePathForRecord(committedDir),
        committedAt: recordedAt,
      });
      boundaryCommitted = true;
      reachBoundary('after_commit_boundary');
    } catch (error) {
      if (!boundaryCommitted) {
        restore();
        if (fs.existsSync(committedDir)) {
          removeDirectory(committedDir);
        }
      }
      throw error;
    }
    return {
      event,
      receiptPath,
      eventLogPath,
      beforeRecordHash,
      afterRecordHash: event.afterRecordHash,
      artifactIndexPaths: artifactIndexUpdates.map((update) =>
        normalizePathForRecord(update.targetPath)
      ),
      artifactPaths: artifactWrites.map((write) =>
        normalizePathForRecord(write.targetPath)
      ),
    };
  } finally {
    if (stagingDir && fs.existsSync(stagingDir)) {
      removeDirectory(stagingDir);
    }
    releaseArtifactIndexLocks(artifactIndexLocks, transactionId);
    releaseControlStoreLock(lockPath, transactionId);
  }
}
