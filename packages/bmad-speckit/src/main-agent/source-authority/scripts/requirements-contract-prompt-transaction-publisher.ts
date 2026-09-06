import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  runMainAgentCompiledPrompt,
  type CompiledPromptRunResult,
} from './main-agent-compiled-prompt-runner';
import {
  resolvePromptPublicationAuthority,
  type PromptTransactionPublishOptions,
  type PromptPublicationAuthority,
} from './requirements-contract-prompt-transaction-authority';
import { resolvePromptPublicationRuntimeBindings } from './requirements-contract-package-runtime-action-binding-manifest';
import { validateSourcePrdLintTransitionFromFiles } from './requirements-contract-validation-facade';
import {
  acquirePromptTransactionLock,
  releasePromptTransactionLock,
  type PromptTransactionLockDeps,
  type PromptTransactionLockHandle,
} from './requirements-contract-prompt-transaction-lock';
import {
  assertCurrentDispatchPointerReplaySafe,
  publishCurrentDispatchPointer,
  rollbackCurrentDispatchPointer,
  type CurrentDispatchPointerPublication,
} from './requirements-contract-current-dispatch-pointer';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
  writeGovernedText,
  type GovernedReadbackRef,
} from './requirements-contract-governed-write';
import { auditModelPacketParity } from './requirements-contract-model-packet-parity';
import { measureJudgePayload } from './requirements-contract-judge-payload-budget';
import { resolveExecutionDisciplineProfile } from './execution-discipline-profiles';

// Runtime schemas validate these records before publication uses dynamic fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;
type WriteResult = ReturnType<typeof writeGovernedJson>;
type RuntimeBindings = ReturnType<typeof resolvePromptPublicationRuntimeBindings>;

const ACTION = 'requirements-contract-prompt-transaction-publish';
const MANIFEST_SCHEMA_VERSION = 'requirements-contract-prompt-transaction-manifest/v1';
const ALWAYS_OUTPUTS = [
  'model_packet.json',
  'transaction-manifest.json',
  'audit_receipt.json',
  'human_prompt.txt',
] as const;
const GOAL_OUTPUT = 'goal_execution.md';
const ALL_OUTPUTS = [...ALWAYS_OUTPUTS, GOAL_OUTPUT];
const REQUIREMENT_RECORD_SNAPSHOT = path.join(
  'authority-inputs',
  'requirement-record.snapshot.json'
);
const EXECUTION_DISCIPLINE_PROFILE = path.join('authority-inputs', 'execution-discipline-profile.json');
const safeWriter = require('../../../utils/large-document-writer') as {
  safeWriteText(targetPath: string, value: string, options: { mode: 'create' | 'replace' | 'upsert' }): unknown;
};
const PUBLISHER_JOURNAL_PREFIX = '.publisher-publication-';
type PublicationJournal = {
  root: string;
  document: {
    schemaVersion: 'prompt-transaction-publication/v1';
    transactionId: string;
    sourceDocumentHash: string;
    ownerLockId: string;
    controlLockPath: string;
    state: 'prepared' | 'committed' | 'rolled_back' | 'blocked';
    phase: 'inputs' | 'compiling' | 'compiled' | 'publishing';
    previousPass: boolean;
    preexistingRootNames: string[];
    rootArtifacts: Array<{ name: string; hash: string }>;
    entries: Array<{ targetPath: string; sharedTarget: string | null; backupPath: string | null;
      beforeHash: string | null; expectedHashes: string[] }>;
  };
};

function serializedJson(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

function plannedFileRef(targetPath: string, content: string) {
  return { path: slash(path.resolve(targetPath)), hash: sha256(content) };
}

function publicationControlRoot(authority: PromptPublicationAuthority): string {
  const root = path.join(path.dirname(authority.paths.currentDispatchPointer), '.publisher-control');
  const nested = (left: string, right: string) => {
    const relative = path.relative(left, right);
    return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };
  if (nested(root, authority.paths.outDir) || nested(authority.paths.outDir, root)) {
    throw new Error('prompt_transaction_control_lock_scope_conflict');
  }
  return root;
}

function publicationPreimage(authority: PromptPublicationAuthority) {
  const outputs = ALL_OUTPUTS.map((name) => path.join(authority.paths.outDir, name));
  outputs.push(requirementRecordSnapshotPath(authority.paths.outDir),
    path.join(authority.paths.outDir, EXECUTION_DISCIPLINE_PROFILE),
    path.join(authority.paths.outDir, 'observations', 'consumer-cli-capability.json'));
  const sharedOutputs = [authority.paths.currentDispatchPointer, authority.paths.evidenceOut];
  const entries = [...outputs, ...sharedOutputs].flatMap((output) =>
    [output, `${output}.safe-write-receipt.json`].map((targetPath) => ({
      targetPath, sharedTarget: sharedOutputs.includes(output) ? output : null,
      bytes: fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null,
    })));
  const receipt = entries.find((entry) => entry.targetPath === path.join(authority.paths.outDir, 'audit_receipt.json'));
  let previousPass = false;
  if (receipt?.bytes) {
    try { previousPass = ['pass', 'PASS'].includes(JSON.parse(receipt.bytes.toString('utf8')).decision); }
    catch { /* An invalid preimage is preserved only for a capacity rejection. */ }
  }
  const pointer = entries.find((entry) => entry.targetPath === authority.paths.currentDispatchPointer);
  if (!previousPass && pointer?.bytes) {
    try { previousPass = JSON.parse(pointer.bytes.toString('utf8')).decision === 'PASS'; }
    catch { /* Replay validation remains responsible for pointer schema errors. */ }
  }
  return { entries, previousPass };
}

function persistPublicationJournal(journal: PublicationJournal): void {
  const target = path.join(journal.root, 'journal.json');
  const content = serializedJson(journal.document);
  safeWriter.safeWriteText(target, content, { mode: fs.existsSync(target) ? 'replace' : 'create' });
  if (fileHash(target) !== sha256(content)) throw new Error('prompt_transaction_recovery_required:journal_write_mismatch');
}

function createPublicationJournal(
  authority: PromptPublicationAuthority,
  lock: PromptTransactionLockHandle,
  preimage: ReturnType<typeof publicationPreimage>
): PublicationJournal {
  const preexistingRootNames = fs.readdirSync(authority.paths.outDir);
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const root = path.join(authority.paths.outDir, `${PUBLISHER_JOURNAL_PREFIX}${stamp}-${randomBytes(3).toString('hex')}`);
  fs.mkdirSync(root);
  const entries = preimage.entries.map((entry, index) => {
    const backupPath = entry.bytes === null ? null : path.join(root, `preimage-${index}.txt`);
    const beforeHash = entry.bytes === null ? null : sha256(entry.bytes);
    if (backupPath && entry.bytes) {
      safeWriter.safeWriteText(backupPath,
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(entry.bytes), { mode: 'create' });
      if (fileHash(backupPath) !== beforeHash) throw new Error('prompt_transaction_recovery_required:backup_write_mismatch');
    }
    return { targetPath: entry.targetPath, sharedTarget: entry.sharedTarget, backupPath, beforeHash,
      expectedHashes: [] as string[] };
  });
  const journal: PublicationJournal = { root, document: {
    schemaVersion: 'prompt-transaction-publication/v1', transactionId: authority.identity.transactionId,
    sourceDocumentHash: authority.identity.sourceDocumentHash, ownerLockId: lock.record.lockId,
    controlLockPath: path.join(publicationControlRoot(authority), '.prompt-transaction.lock'),
    state: 'prepared', phase: 'inputs', previousPass: preimage.previousPass,
    preexistingRootNames, rootArtifacts: [], entries,
  } };
  persistPublicationJournal(journal);
  return journal;
}

function publicationIntent(journal: PublicationJournal, targetPath: string, contentHash: string): void {
  const entry = journal.document.entries.find((candidate) => candidate.targetPath === targetPath);
  if (!entry) throw new Error('prompt_transaction_recovery_required:unregistered_target');
  if (!entry.expectedHashes.includes(contentHash)) entry.expectedHashes.push(contentHash);
  persistPublicationJournal(journal);
}

function validatePublicationJournal(authority: PromptPublicationAuthority, name: string): PublicationJournal {
  const fail = (): never => { throw new Error('prompt_transaction_recovery_required:journal_invalid'); };
  if (!/^\.publisher-publication-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-zA-Z0-9]{6}$/u.test(name)) fail();
  const root = path.join(authority.paths.outDir, name);
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) fail();
  const journalPath = path.join(root, 'journal.json');
  if (!fs.existsSync(journalPath) || !fs.lstatSync(journalPath).isFile() || fs.lstatSync(journalPath).isSymbolicLink()) fail();
  const document = readJson(journalPath) as PublicationJournal['document'];
  if (document.schemaVersion !== 'prompt-transaction-publication/v1' ||
    document.transactionId !== authority.identity.transactionId ||
    document.sourceDocumentHash !== authority.identity.sourceDocumentHash || !document.ownerLockId ||
    document.controlLockPath !== path.join(publicationControlRoot(authority), '.prompt-transaction.lock') ||
    !['prepared', 'committed', 'rolled_back', 'blocked'].includes(document.state) ||
    !Array.isArray(document.entries) || !Array.isArray(document.rootArtifacts) ||
    !Array.isArray(document.preexistingRootNames)) fail();
  const expected = publicationPreimage(authority).entries;
  if (expected.length !== document.entries.length) fail();
  const files = new Set(['journal.json']);
  document.entries.forEach((entry, index) => {
    if (entry.targetPath !== expected[index].targetPath || entry.sharedTarget !== expected[index].sharedTarget ||
      !Array.isArray(entry.expectedHashes) || entry.expectedHashes.some((hash) => !/^sha256:[a-f0-9]{64}$/u.test(hash))) fail();
    if (entry.beforeHash === null) { if (entry.backupPath !== null) fail(); return; }
    const backup = path.join(root, `preimage-${index}.txt`);
    if (!/^sha256:[a-f0-9]{64}$/u.test(entry.beforeHash) || entry.backupPath !== backup ||
      !fs.existsSync(backup) || !fs.lstatSync(backup).isFile() || fs.lstatSync(backup).isSymbolicLink() ||
      fileHash(backup) !== entry.beforeHash) fail();
    files.add(path.basename(backup));
  });
  const immutable = (value: PublicationJournal['document']) => canonicalJson({ transactionId: value.transactionId,
    sourceDocumentHash: value.sourceDocumentHash, ownerLockId: value.ownerLockId, controlLockPath: value.controlLockPath,
    entries: value.entries.map(({ targetPath, sharedTarget, backupPath, beforeHash }) =>
      ({ targetPath, sharedTarget, backupPath, beforeHash })) });
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) fail();
    if (files.has(entry.name)) continue;
    if (!/^journal\.json\.backup-\d+-\d+$/u.test(entry.name)) fail();
    const history = readJson(path.join(root, entry.name)) as PublicationJournal['document'];
    if (history.schemaVersion !== document.schemaVersion || !Array.isArray(history.entries) ||
      immutable(history) !== immutable(document) || history.entries.some((old, index) =>
        !Array.isArray(old.expectedHashes) || old.expectedHashes.some((hash) =>
          !document.entries[index].expectedHashes.includes(hash)))) fail();
  }
  for (const artifact of document.rootArtifacts) {
    if (!managedRootArtifactName(artifact.name) || !/^sha256:[a-f0-9]{64}$/u.test(artifact.hash)) fail();
    const target = path.join(authority.paths.outDir, artifact.name);
    if (!fs.existsSync(target) || !fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink() ||
      fileHash(target) !== artifact.hash) fail();
  }
  return { root, document };
}

function managedRootArtifactName(name: string): boolean {
  return ALL_OUTPUTS.some((output) => name.startsWith(`${output}.backup-`) &&
    /^\d+-\d+$/u.test(name.slice(`${output}.backup-`.length))) ||
    ALL_OUTPUTS.some((output) => name.startsWith(`${output}.safe-write-receipt.json.backup-`) &&
      /^\d+-\d+$/u.test(name.slice(`${output}.safe-write-receipt.json.backup-`.length)));
}

function retainPublicationRootArtifacts(journal: PublicationJournal): void {
  for (const name of fs.readdirSync(path.dirname(journal.root))) {
    if (journal.document.preexistingRootNames.includes(name) || !managedRootArtifactName(name)) continue;
    const target = path.join(path.dirname(journal.root), name);
    if (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()) {
      throw new Error('prompt_transaction_recovery_required:artifact_type_invalid');
    }
    const hash = fileHash(target);
    const existing = journal.document.rootArtifacts.find((entry) => entry.name === name);
    if (existing && existing.hash !== hash) throw new Error('prompt_transaction_recovery_required:artifact_changed');
    if (!existing) journal.document.rootArtifacts.push({ name, hash });
  }
  persistPublicationJournal(journal);
}

function restoreDurablePublication(authority: PromptPublicationAuthority, journal: PublicationJournal): void {
  if (fs.existsSync(path.join(authority.paths.outDir, '.compiler-publication.lock'))) {
    throw new Error('prompt_transaction_recovery_required:compiler_recovery_pending');
  }
  if (journal.document.phase === 'compiling') {
    for (const name of fs.readdirSync(authority.paths.outDir)) {
      if (journal.document.preexistingRootNames.includes(name) || !name.startsWith('.compiler-publication-')) continue;
      if (!validCompilerJournal(authority.paths.outDir, name)) {
        throw new Error('prompt_transaction_recovery_required:compiler_journal_invalid');
      }
      const compiler = readJson(path.join(authority.paths.outDir, name, 'journal.json'));
      for (const artifact of compiler.artifacts) {
        const entry = journal.document.entries.find((item) => item.targetPath === path.join(authority.paths.outDir, artifact.name));
        if (entry) entry.expectedHashes.push(`sha256:${artifact.nextHash}`);
      }
    }
  }
  const sharedWrites = new Map<string, string>();
  for (const entry of journal.document.entries) {
    if (entry.sharedTarget) {
      if (entry.targetPath === entry.sharedTarget && fs.existsSync(entry.targetPath)) {
        const currentHash = fileHash(entry.targetPath);
        if (entry.expectedHashes.includes(currentHash)) sharedWrites.set(entry.targetPath, currentHash);
        else if (currentHash !== entry.beforeHash) {
          const current = readJson(entry.targetPath);
          const packetPath = current.modelPacketRef?.path ?? current.modelPacketPath;
          if (typeof packetPath === 'string' && samePath(packetPath, path.join(authority.paths.outDir, 'model_packet.json'))) {
            throw new Error('prompt_transaction_recovery_required:missing_shared_intent');
          }
        }
      }
      continue;
    }
    const currentHash = fs.existsSync(entry.targetPath) ? fileHash(entry.targetPath) : null;
    if (currentHash === entry.beforeHash || (currentHash && entry.expectedHashes.includes(currentHash))) continue;
    const owner = journal.document.entries.find((item) => `${item.targetPath}.safe-write-receipt.json` === entry.targetPath);
    if (owner && currentHash) {
      const receipt = readJson(entry.targetPath);
      if (receipt.schemaVersion === 'large-document-writer-safe-write/v1' &&
        samePath(receipt.targetPath, owner.targetPath) && owner.expectedHashes.includes(receipt.finalHash)) continue;
    }
    throw new Error('prompt_transaction_recovery_required:unowned_local_mutation');
  }
  const entries = journal.document.entries.map((entry) => ({
    targetPath: entry.targetPath, sharedTarget: entry.sharedTarget,
    bytes: entry.backupPath ? fs.readFileSync(entry.backupPath) : null,
  }));
  retainPublicationRootArtifacts(journal);
  restorePublicationPreimage({ entries, previousPass: journal.document.previousPass }, sharedWrites);
  retainPublicationRootArtifacts(journal);
  journal.document.state = 'rolled_back';
  persistPublicationJournal(journal);
}

function recoverPublisherJournals(authority: PromptPublicationAuthority, lockHandle: PromptTransactionLockHandle) {
  try {
    const journals = fs.readdirSync(authority.paths.outDir)
      .filter((name) => name.startsWith(PUBLISHER_JOURNAL_PREFIX))
      .map((name) => validatePublicationJournal(authority, name));
    const pending = journals.filter((journal) => journal.document.state === 'prepared');
    if (pending.length > 1) throw new Error('multiple_pending_journals');
    for (const journal of pending) restoreDurablePublication(authority, journal);
    let acknowledgedCommit = false;
    for (const journal of journals) {
      if (journal.document.state !== 'committed' ||
        journal.document.ownerLockId !== lockHandle.staleRecovery?.staleLockId) continue;
      const pointer = journal.document.entries.find((entry) => entry.targetPath === authority.paths.currentDispatchPointer)!;
      if (!fs.existsSync(pointer.targetPath) || fileHash(pointer.targetPath) !== pointer.expectedHashes.at(-1)) continue;
      if (journal.document.entries.some((entry) => {
        const currentHash = fs.existsSync(entry.targetPath) ? fileHash(entry.targetPath) : null;
        return currentHash !== (entry.expectedHashes.at(-1) ?? entry.beforeHash);
      })) throw new Error('committed_readback_mismatch');
      acknowledgedCommit = true;
    }
    const managed = new Set(journals.map((journal) => path.basename(journal.root)));
    for (const journal of journals) {
      for (const artifact of journal.document.rootArtifacts) managed.add(artifact.name);
      const archive = `.prompt-transaction.lock.stale.${journal.document.ownerLockId}`;
      const archivePath = path.join(authority.paths.outDir, archive);
      if (fs.existsSync(archivePath)) {
        const lock = readJson(archivePath);
        if (lock.lockId !== journal.document.ownerLockId || lock.transactionId !== journal.document.transactionId) {
          throw new Error('stale_lock_binding_invalid');
        }
        managed.add(archive);
      }
    }
    return { managed, acknowledgedCommit };
  } catch (error) {
    throw new Error(`prompt_transaction_recovery_required:${error instanceof Error ? error.message : String(error)}`);
  }
}

function restorePublicationPreimage(
  preimage: ReturnType<typeof publicationPreimage>,
  sharedWriteHashes: Map<string, string>
): void {
  // Output-directory locks do not own shared pointers from other transactions.
  const ownedSharedTargets = new Set([...sharedWriteHashes].filter(([target, hash]) =>
    fs.existsSync(target) && fileHash(target) === hash).map(([target]) => target));
  const restoreOrder = [...preimage.entries.filter((entry) => entry.sharedTarget),
    ...preimage.entries.filter((entry) => !entry.sharedTarget)];
  for (const { targetPath, bytes, sharedTarget } of restoreOrder) {
    if (sharedTarget && !ownedSharedTargets.has(sharedTarget)) continue;
    if (bytes === null) {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      continue;
    }
    if (fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(bytes)) continue;
    safeWriter.safeWriteText(targetPath,
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
      { mode: fs.existsSync(targetPath) ? 'replace' : 'create' });
    if (!fs.readFileSync(targetPath).equals(bytes)) throw new Error('prompt_transaction_preimage_restore_failed');
  }
}

function validCompilerJournal(outDir: string, name: string): boolean {
  if (!/^\.compiler-publication-(?:\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-)?[a-zA-Z0-9]{6}$/u.test(name)) return false;
  const root = path.join(outDir, name);
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) return false;
  const journalPath = path.join(root, 'journal.json');
  if (!fs.existsSync(journalPath) || fs.lstatSync(journalPath).isSymbolicLink()) return false;
  const journal = readJson(journalPath);
  const names = new Set<string>();
  const expectedFiles = new Set(['journal.json']);
  if (journal.schemaVersion !== 'req-trace-publication/v1' ||
    !['completed', 'rolled_back'].includes(journal.state) || !Array.isArray(journal.artifacts)) return false;
  for (const entry of journal.artifacts) {
    if (!['model_packet.json', 'human_prompt.txt', 'goal_execution.md', 'audit_receipt.json'].includes(entry.name) ||
      names.has(entry.name) || !/^[a-f0-9]{64}$/u.test(entry.nextHash)) return false;
    names.add(entry.name);
    if (entry.previousHash === null) {
      if (entry.backupPath !== null) return false;
    } else {
      const backup = path.join(root, `${entry.name}.previous`);
      expectedFiles.add(`${entry.name}.previous`);
      if (!/^[a-f0-9]{64}$/u.test(entry.previousHash) || entry.backupPath !== backup ||
        !fs.existsSync(backup) || !fs.lstatSync(backup).isFile() || fs.lstatSync(backup).isSymbolicLink() ||
        fileHash(backup) !== `sha256:${entry.previousHash}`) return false;
    }
  }
  if (!['model_packet.json', 'human_prompt.txt', 'audit_receipt.json'].every((name) => names.has(name))) return false;
  return fs.readdirSync(root, { withFileTypes: true }).every((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) return false;
    if (expectedFiles.has(entry.name)) return true;
    if (!/^journal\.json\.backup-\d+-\d+$/u.test(entry.name)) return false;
    const previous = readJson(path.join(root, entry.name));
    return previous.schemaVersion === journal.schemaVersion &&
      ['prepared', 'completed', 'rolled_back'].includes(previous.state) &&
      canonicalJson(previous.artifacts) === canonicalJson(journal.artifacts);
  });
}

function validAuthorityInputs(outDir: string): boolean {
  const root = path.join(outDir, 'authority-inputs');
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) return false;
  return fs.readdirSync(root, { withFileTypes: true }).every((entry) => {
    const match = /^(requirement-record\.snapshot\.json|execution-discipline-profile\.json)(\.safe-write-receipt\.json)?(\.backup-\d+-\d+)?$/u.exec(entry.name);
    if (!match || !entry.isFile() || entry.isSymbolicLink()) return false;
    const targetPath = path.join(root, match[1]);
    const value = readJson(path.join(root, entry.name));
    if (!match[2]) return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (value.schemaVersion !== 'large-document-writer-safe-write/v1' ||
      !samePath(value.targetPath, targetPath) || !/^sha256:[a-f0-9]{64}$/u.test(value.finalHash)) return false;
    if (!match[3] && (!fs.existsSync(targetPath) || fileHash(targetPath) !== value.finalHash)) return false;
    if (value.backupPath === null) return value.originalHash === null && value.backupHash === null;
    const prefix = `${path.basename(targetPath)}.backup-`;
    if (typeof value.backupPath !== 'string' || path.dirname(value.backupPath) !== root ||
      !path.basename(value.backupPath).startsWith(prefix) ||
      !/^\d+-\d+$/u.test(path.basename(value.backupPath).slice(prefix.length))) return false;
    return fs.existsSync(value.backupPath) && fs.lstatSync(value.backupPath).isFile() &&
      !fs.lstatSync(value.backupPath).isSymbolicLink() && value.originalHash === value.backupHash &&
      fileHash(value.backupPath) === value.backupHash;
  });
}

export interface PromptTransactionPublisherDeps {
  runCompiledPrompt?: typeof runMainAgentCompiledPrompt;
  now?: () => string;
  spawn?: typeof spawnSync;
  lockDeps?: PromptTransactionLockDeps;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function requirementRecordSnapshotPath(outDir: string): string {
  return path.join(outDir, REQUIREMENT_RECORD_SNAPSHOT);
}

function assertSchema(schemaName: string, value: unknown, label: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  if (!validate(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
}

function expectedProductionArgv(
  authority: PromptPublicationAuthority,
  generatorPath: string,
  goalCommandAvailable: boolean
): string[] {
  return [
    process.execPath,
    path.resolve(generatorPath),
    '--entry',
    'main_agent_compile',
    '--requirement-record',
    authority.paths.requirementRecord,
    '--source-document',
    authority.paths.source,
    '--out-dir',
    authority.paths.outDir,
    '--execution-host',
    authority.executionHost,
    '--prompt-language',
    'auto',
    '--human-prompt-profile',
    'full',
    '--json',
    '--goal-command-available',
    goalCommandAvailable ? 'true' : 'false',
    '--packet-id',
    authority.identity.implementationAttemptId,
    '--task-report-path',
    authority.paths.taskReport,
    '--requirement-set-id',
    authority.controlledExecutionContext.requirementSetId,
    '--transaction-id',
    authority.controlledExecutionContext.transactionId,
    '--implementation-attempt-id',
    authority.controlledExecutionContext.implementationAttemptId,
    '--architecture-audit-attempt-id',
    authority.controlledExecutionContext.architectureAuditAttemptId,
    '--active-phase-audit-attempt-id',
    authority.controlledExecutionContext.activePhaseAuditAttemptId,
    '--contract-hash',
    authority.controlledExecutionContext.contractHash,
    '--input-snapshot-hash',
    authority.controlledExecutionContext.inputSnapshotHash,
    '--command-cwd',
    authority.controlledExecutionContext.commandCwd,
    '--command-receipt-root',
    authority.controlledExecutionContext.commandReceiptRoot,
    '--execution-discipline-profile-ref',
    path.join(authority.paths.outDir, EXECUTION_DISCIPLINE_PROFILE),
  ];
}

function assertFileRef(
  actualPath: string | null | undefined,
  actualHash: string | null | undefined,
  expectedPath: string,
  label: string
): void {
  if (!actualPath || !samePath(actualPath, expectedPath)) throw new Error(`${label}_path_mismatch`);
  if (!fs.existsSync(expectedPath) || fileHash(expectedPath) !== actualHash) {
    throw new Error(`${label}_hash_mismatch`);
  }
}

function assertRunnerResult(
  result: CompiledPromptRunResult,
  authority: PromptPublicationAuthority,
  productionArgv: string[],
  generatorRef: { path: string; hash: string },
  runnerRef: { path: string; hash: string },
  goalRequired: boolean
): NonNullable<CompiledPromptRunResult['compiledPromptRef']> {
  if (result.status !== 'pass' || !result.compiledPromptRef) {
    throw new Error(`compiled_prompt_not_pass:${result.blockingReasons.join(',')}`);
  }
  if (!result.outDir || !samePath(result.outDir, authority.paths.outDir)) {
    throw new Error('compiled_prompt_out_dir_mismatch');
  }
  if (
    result.confirmedSource.status !== 'confirmed' ||
    !samePath(result.confirmedSource.recordPath, authority.paths.requirementRecord) ||
    !samePath(result.confirmedSource.sourcePath, authority.paths.source) ||
    result.confirmedSource.sourceDocumentHash !== authority.identity.sourceDocumentHash ||
    result.confirmedSource.implementationConfirmationHash !==
      authority.identity.implementationConfirmationHash
  ) {
    throw new Error('compiled_prompt_confirmed_source_mismatch');
  }
  if (
    canonicalJson(result.productionArgv) !== canonicalJson(productionArgv) ||
    result.productionArgvHash !== sha256(canonicalJson(productionArgv))
  ) {
    throw new Error('compiled_prompt_production_argv_mismatch');
  }
  if (
    !result.generatorRef ||
    !samePath(result.generatorRef.path, generatorRef.path) ||
    result.generatorRef.hash !== generatorRef.hash
  ) {
    throw new Error('compiled_prompt_generator_identity_mismatch');
  }
  if (
    !result.runnerRef ||
    !samePath(result.runnerRef.path, runnerRef.path) ||
    result.runnerRef.hash !== runnerRef.hash
  ) {
    throw new Error('compiled_prompt_runner_identity_mismatch');
  }
  if (
    !result.executionReceipt ||
    result.executionReceipt.exitCode !== 0 ||
    !result.stdoutPath ||
    !result.stderrPath ||
    result.executionReceipt.stdoutHash !== fileHash(result.stdoutPath) ||
    result.executionReceipt.stderrHash !== fileHash(result.stderrPath)
  ) {
    throw new Error('compiled_prompt_execution_receipt_invalid');
  }
  const ref = result.compiledPromptRef;
  const modelPacketPath = path.join(authority.paths.outDir, 'model_packet.json');
  const humanPromptPath = path.join(authority.paths.outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(authority.paths.outDir, GOAL_OUTPUT);
  assertFileRef(ref.modelPacketPath, ref.modelPacketHash, modelPacketPath, 'model_packet');
  assertFileRef(ref.humanPromptPath, ref.humanPromptHash, humanPromptPath, 'human_prompt');
  assertFileRef(ref.auditReceiptPath, ref.auditReceiptHash, auditReceiptPath, 'audit_receipt');
  if (goalRequired) {
    assertFileRef(
      ref.goalExecutionPath,
      ref.goalExecutionHash,
      goalExecutionPath,
      'goal_execution'
    );
  } else if (ref.goalExecutionPath || ref.goalExecutionHash || fs.existsSync(goalExecutionPath)) {
    throw new Error('goal_execution_applicability_drift');
  }
  if (
    !samePath(ref.taskReportPath ?? '', authority.paths.taskReport) ||
    ref.sourceDocumentHash !== authority.identity.sourceDocumentHash ||
    ref.implementationConfirmationHash !== authority.identity.implementationConfirmationHash
  ) {
    throw new Error('compiled_prompt_ref_identity_mismatch');
  }
  const rawPacket = readJson(modelPacketPath);
  if (rawPacket.artifactRole !== 'execution_authority') {
    throw new Error('generator_raw_packet_authority_contract_mismatch');
  }
  const rawReceipt = readJson(auditReceiptPath);
  const expectedGoalMode = goalRequired ? 'native_goal_document_ref' : 'direct_prompt';
  if (
    rawReceipt.decision !== 'pass' ||
    rawReceipt.goalCommand?.mode !== expectedGoalMode
  ) {
    throw new Error('generator_raw_receipt_applicability_mismatch');
  }
  return ref;
}

function finalPacket(rawPacket: JsonRecord, authority: PromptPublicationAuthority) {
  return {
    ...rawPacket,
    artifactRole: 'non_authoritative_projection',
    authorityPolicy: {
      primaryAuthority: 'confirmed_source_and_requirement_record',
      modelPacketRole: 'non_authoritative_projection',
      humanPromptRole: 'non_authoritative_projection',
      transactionManifestRole: 'publication_integrity_manifest',
      auditReceiptRole: 'transaction_integrity_receipt_not_closeout_authority',
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
      sourceTraceMutationPolicy: 'confirmed_source_traceRows_status_must_not_be_rewritten',
    },
    promptTransaction: {
      transactionId: authority.identity.transactionId,
      manifestPath: slash(path.join(authority.paths.outDir, 'transaction-manifest.json')),
      manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    },
  };
}

function collectAuthorityClaims(value: unknown, location = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectAuthorityClaims(item, `${location}[${index}]`));
  }
  if (!value || typeof value !== 'object') {
    if (
      typeof value === 'string' &&
      (/execution_authority/iu.test(value) ||
        (/model_packet\.json/iu.test(value) && /execution authority/iu.test(value)))
    ) {
      return [location];
    }
    return [];
  }
  const claims: string[] = [];
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const childLocation = `${location}.${key}`;
    if (
      (key === 'executionAuthorityClaim' && child === true) ||
      (key === 'artifactRole' && child === 'execution_authority')
    ) {
      claims.push(childLocation);
      continue;
    }
    claims.push(...collectAuthorityClaims(child, childLocation));
  }
  return claims;
}

function assertNoAuthorityClaims(value: unknown): void {
  const claims = collectAuthorityClaims(value);
  if (claims.length > 0) {
    throw new Error(`model_packet_authority_claim_detected:${claims.join(',')}`);
  }
}

function finalHumanPrompt(rawPrompt: string): string {
  const deauthorized = rawPrompt.replace(
    /model_packet\.json is the machine-readable execution authority\.?/giu,
    'model_packet.json is a non-authoritative execution projection.'
  );
  return [
    'Authority boundary: model_packet.json and human_prompt.txt are non-authoritative projections.',
    'Machine execution and closeout authority remain with the confirmed Source, Requirement Record/control store, current receipts, and deterministic gates.',
    '',
    deauthorized,
  ].join('\n');
}

function fileRef(ref: GovernedReadbackRef) {
  return { path: slash(ref.path), hash: ref.hash };
}

function outputWriteCase(name: string, write: WriteResult) {
  return {
    output: name,
    path: slash(write.targetRef.path),
    hash: write.targetRef.hash,
    safeWriteReceiptPath: slash(write.receiptRef.path),
    safeWriteReceiptHash: write.receiptRef.hash,
    readbackVerified: true,
  };
}

function staleLockRecoveryCases(
  outDir: string,
  lockHandle: PromptTransactionLockHandle
): JsonRecord[] {
  const recovery = lockHandle.staleRecovery;
  if (!recovery) return [];
  const expectedArchivePath = path.join(
    outDir,
    `.prompt-transaction.lock.stale.${recovery.staleLockId}`
  );
  if (!samePath(recovery.archivePath, expectedArchivePath)) {
    throw new Error('prompt_transaction_stale_lock_archive_authority_mismatch');
  }
  const archivedLock = readJson(expectedArchivePath);
  if (
    archivedLock.lockId !== recovery.staleLockId ||
    archivedLock.transactionId !== recovery.staleTransactionId
  ) {
    throw new Error('prompt_transaction_stale_lock_archive_binding_mismatch');
  }
  return [
    {
      staleLockId: recovery.staleLockId,
      staleTransactionId: recovery.staleTransactionId,
      archivePath: slash(expectedArchivePath),
      recoveredByLockId: lockHandle.record.lockId,
      recoveredByTransactionId: lockHandle.record.transactionId,
    },
  ];
}

function assertExactRunnerOutputSet(
  outDir: string,
  goalRequired: boolean,
  lockHandle: PromptTransactionLockHandle,
  managedJournalEntries: Set<string>
): void {
  const recoveryCases = staleLockRecoveryCases(outDir, lockHandle);
  const expected = new Set<string>([
    ...(goalRequired ? ALL_OUTPUTS : ALWAYS_OUTPUTS),
    'compiler.stdout.log',
    'compiler.stderr.log',
    '.prompt-transaction.lock',
    'observations',
    '.quarantine',
    ...managedJournalEntries,
    ...recoveryCases.map((recovery) => path.basename(String(recovery.archivePath))),
  ]);
  const unexpected = fs
    .readdirSync(outDir, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((name) => !expected.has(name) &&
      !(name === 'authority-inputs' && validAuthorityInputs(outDir)) && !validCompilerJournal(outDir, name));
  if (unexpected.length > 0) {
    throw new Error(`prompt_transaction_output_set_mismatch:${unexpected.sort().join(',')}`);
  }
}

function quarantineExecutableOutputs(
  outDir: string,
  staleTransactionId: string,
  additionalCandidates: string[] = []
): string {
  const quarantineRoot = path.join(outDir, '.quarantine', staleTransactionId);
  if (fs.existsSync(quarantineRoot)) {
    throw new Error('prompt_transaction_quarantine_identity_collision');
  }
  fs.mkdirSync(quarantineRoot, { recursive: true });
  const candidates = [
    ...ALL_OUTPUTS.flatMap((name) => [
      path.join(outDir, name),
      path.join(outDir, `${name}.safe-write-receipt.json`),
    ]),
    ...additionalCandidates,
  ];
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (
      entry.isDirectory() ||
      entry.name === '.prompt-transaction.lock' ||
      entry.name === 'compiler.stdout.log' ||
      entry.name === 'compiler.stderr.log'
    ) {
      continue;
    }
    candidates.push(path.join(outDir, entry.name));
  }
  for (const candidate of [...new Set(candidates)]) {
      if (!fs.existsSync(candidate)) continue;
      const target = path.join(quarantineRoot, path.basename(candidate));
      if (fs.existsSync(target)) {
        throw new Error('prompt_transaction_quarantine_target_collision');
      }
      fs.renameSync(candidate, target);
  }
  return quarantineRoot;
}

function publishBlockedFromExistingManifest(
  outDir: string,
  existingManifest: JsonRecord,
  blockingReason: string,
  createdAt: string
): void {
  const manifestPath = path.join(outDir, 'transaction-manifest.json');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    transactionId: existingManifest.transactionId,
    requirementSetId: existingManifest.requirementSetId,
    implementationAttemptId: existingManifest.implementationAttemptId,
    attemptSequence: existingManifest.attemptSequence,
    sourceHash: existingManifest.sourceHash,
    sourceAmendmentHashes: existingManifest.sourceAmendmentHashes,
    semanticModelHash: existingManifest.semanticModelHash,
    contractHash: existingManifest.contractHash,
    requirementRecordRef: existingManifest.requirementRecordRef,
    attemptContextRef: existingManifest.attemptContextRef,
    sourceRef: existingManifest.sourceRef,
    stageRegistryRef: existingManifest.stageRegistryRef,
    installedStageRegistryRef: existingManifest.installedStageRegistryRef,
    architectureAuthorityDecision: existingManifest.architectureAuthorityDecision,
    confirmationReceiptRefs: existingManifest.confirmationReceiptRefs,
    implementationReadinessReceiptRef: existingManifest.implementationReadinessReceiptRef,
    confirmationPageRefs: existingManifest.confirmationPageRefs,
    consumerRef: existingManifest.consumerRef,
    universeHashes: existingManifest.universeHashes,
    createdAt,
    transactionStatus: 'blocked',
    hostDirective: 'unresolved',
    executionDisposition: 'non_executable',
    blockingReasons: [blockingReason],
    failedPhase: 'authority_resolution',
    outputs: {
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
    },
  };
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    manifest,
    'prompt_transaction_manifest'
  );
  const manifestWrite = writeGovernedText(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeGovernedJson(auditReceiptPath, {
    schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
    decision: 'BLOCK',
    transactionId: existingManifest.transactionId,
    requirementSetId: existingManifest.requirementSetId,
    implementationAttemptId: existingManifest.implementationAttemptId,
    blockingReasons: [blockingReason],
    failedPhase: 'authority_resolution',
    promptTransaction: {
      manifestPath: slash(manifestPath),
      manifestHash: manifestWrite.targetRef.hash,
    },
    authorityPolicy: {
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
    },
    createdAt,
  });
}

function invalidateExistingTransactionAfterAuthorityFailure(
  options: PromptTransactionPublishOptions,
  blockingReason: string,
  createdAt: string,
  lockDeps?: PromptTransactionLockDeps
): boolean {
  const outDir = path.resolve(options.cwd, options.outDir);
  const manifestPath = path.join(outDir, 'transaction-manifest.json');
  if (!fs.existsSync(manifestPath)) return false;
  const existingManifest = readJson(manifestPath);
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    existingManifest,
    'existing_prompt_transaction_manifest'
  );
  if (
    existingManifest.transactionStatus !== 'pass' ||
    existingManifest.executionDisposition !== 'executable'
  ) {
    return false;
  }
  const frozenRequirementRecordPath = requirementRecordSnapshotPath(outDir);
  if (
    !samePath(
      existingManifest.requirementRecordRef?.path ?? '',
      frozenRequirementRecordPath
    ) ||
    existingManifest.implementationAttemptId !== options.packetId ||
    !samePath(existingManifest.outputs?.transactionManifestPath ?? '', manifestPath)
  ) {
    throw new Error('authority_failure_existing_transaction_scope_mismatch');
  }
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  if (!samePath(existingManifest.outputs?.auditReceipt?.path ?? '', auditReceiptPath)) {
    throw new Error('authority_failure_existing_transaction_output_mismatch');
  }
  const lockHandle = acquirePromptTransactionLock(
    {
      outDir,
      transactionId: String(existingManifest.transactionId),
    },
    lockDeps
  );
  try {
    quarantineExecutableOutputs(outDir, String(existingManifest.transactionId), [
      path.resolve(options.cwd, options.currentDispatchPointer),
      `${path.resolve(options.cwd, options.currentDispatchPointer)}.safe-write-receipt.json`,
      path.resolve(options.cwd, options.evidenceOut),
      `${path.resolve(options.cwd, options.evidenceOut)}.safe-write-receipt.json`,
    ]);
    publishBlockedFromExistingManifest(outDir, existingManifest, blockingReason, createdAt);
    return true;
  } finally {
    releasePromptTransactionLock(lockHandle);
  }
}

function removePublicationEvidence(authority: PromptPublicationAuthority): void {
  for (const candidate of [
    authority.paths.evidenceOut,
    `${authority.paths.evidenceOut}.safe-write-receipt.json`,
  ]) {
    if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
  }
}

function matchingReplayPointer(authority: PromptPublicationAuthority): JsonRecord | null {
  if (!fs.existsSync(authority.paths.currentDispatchPointer)) return null;
  const pointer = readJson(authority.paths.currentDispatchPointer);
  return pointer.transactionId === authority.identity.transactionId &&
    pointer.implementationAttemptId === authority.identity.implementationAttemptId &&
    Number(pointer.attemptSequence) === authority.identity.attemptSequence
    ? pointer
    : null;
}

function publishBlockedTransaction(
  authority: PromptPublicationAuthority,
  runtimeBindings: RuntimeBindings,
  blockingReason: string,
  failedPhase: string,
  createdAt: string
): void {
  const manifestPath = path.join(authority.paths.outDir, 'transaction-manifest.json');
  const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    transactionId: authority.identity.transactionId,
    requirementSetId: authority.identity.requirementSetId,
    implementationAttemptId: authority.identity.implementationAttemptId,
    attemptSequence: authority.identity.attemptSequence,
    sourceHash: authority.identity.sourceDocumentHash,
    sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
    semanticModelHash: authority.identity.semanticModelHash,
    contractHash: authority.identity.contractHash,
    requirementRecordRef: authority.refs.requirementRecord,
    attemptContextRef: authority.refs.attemptContext,
    sourceRef: {
      path: slash(authority.paths.source),
      sourceDocumentHash: authority.identity.sourceDocumentHash,
    },
    stageRegistryRef: authority.refs.stageRegistry,
    installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
    architectureAuthorityDecision: authority.architectureAuthorityDecision,
    confirmationReceiptRefs: {
      requirements: authority.refs.requirementsConfirmationReceipt,
      architecture: authority.refs.architectureConfirmationReceipt,
    },
    implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
    confirmationPageRefs: {
      requirements: authority.refs.requirementsConfirmationPage,
      architecture: authority.refs.architectureConfirmationPage,
    },
    consumerRef: {
      consumerId: authority.consumerProfile.consumerId,
      root: slash(authority.paths.consumerRoot),
      marker: authority.refs.consumerMarker,
      profile: authority.refs.consumerProfile,
      actionBindingManifest: runtimeBindings.manifestRef,
    },
    universeHashes: authority.universeHashes,
    createdAt,
    transactionStatus: 'blocked',
    hostDirective: 'unresolved',
    executionDisposition: 'non_executable',
    blockingReasons: [blockingReason],
    failedPhase,
    outputs: {
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
    },
  };
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    manifest,
    'prompt_transaction_manifest'
  );
  const manifestWrite = writeGovernedText(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeGovernedJson(auditReceiptPath, {
    schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
    decision: 'BLOCK',
    transactionId: authority.identity.transactionId,
    requirementSetId: authority.identity.requirementSetId,
    implementationAttemptId: authority.identity.implementationAttemptId,
    blockingReasons: [blockingReason],
    failedPhase,
    promptTransaction: {
      manifestPath: slash(manifestPath),
      manifestHash: manifestWrite.targetRef.hash,
    },
    authorityPolicy: {
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
    },
    createdAt,
  });
}

export async function requirementsContractPromptTransactionPublishCommand(
  options: PromptTransactionPublishOptions,
  deps: PromptTransactionPublisherDeps = {}
): Promise<number> {
  let authority: PromptPublicationAuthority | null = null;
  let pointerPublication: CurrentDispatchPointerPublication | null = null;
  let lockHandle: PromptTransactionLockHandle | null = null;
  let controlLockHandle: PromptTransactionLockHandle | null = null;
  let runtimeBindings: RuntimeBindings | null = null;
  let publicationTouchedOutputs = false;
  let currentDispatchPointerPreimageHash: string | null = null;
  let preimage: ReturnType<typeof publicationPreimage> | null = null;
  let journal: PublicationJournal | null = null;
  let managedJournalEntries = new Set<string>();
  const sharedWriteHashes = new Map<string, string>();
  const acquireControlLock = () => {
    if (controlLockHandle) return;
    try {
      controlLockHandle = acquirePromptTransactionLock({ outDir: publicationControlRoot(authority!),
        transactionId: authority!.identity.transactionId }, deps.lockDeps);
    } catch (error) {
      throw new Error(`prompt_transaction_control_lock_unavailable:${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const releaseLocks = () => {
    if (controlLockHandle) { releasePromptTransactionLock(controlLockHandle); controlLockHandle = null; }
    if (lockHandle) { releasePromptTransactionLock(lockHandle); lockHandle = null; }
  };
  const journaledJson = (targetPath: string, value: unknown) => {
    publicationIntent(journal!, targetPath, sha256(serializedJson(value)));
    return writeGovernedJson(targetPath, value);
  };
  const journaledText = (targetPath: string, value: string) => {
    publicationIntent(journal!, targetPath, sha256(value));
    return writeGovernedText(targetPath, value);
  };
  try {
    authority = resolvePromptPublicationAuthority(options);
    const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
      transition: 'packet-dispatch',
      requirementRecordPath: authority.paths.requirementRecord,
      currentSourcePath: authority.paths.source,
    });
    if (sourcePrdLintTransition.decision === 'block') {
      throw new Error(
        `source_prd_lint_transition_blocked:${sourcePrdLintTransition.issueCodes.join(',')}`
      );
    }
    const executionDisciplineProfile = resolveExecutionDisciplineProfile(authority.flow);
    measureJudgePayload({ serializedPayload: serializedJson(executionDisciplineProfile),
      stage: 'prompt_transaction_input:execution-discipline-profile.json',
      sourceHash: authority.identity.sourceDocumentHash });
    publicationControlRoot(authority);
    lockHandle = acquirePromptTransactionLock(
      {
        outDir: authority.paths.outDir,
        transactionId: authority.identity.transactionId,
      },
      deps.lockDeps
    );
    if (fs.readdirSync(authority.paths.outDir).some((name) => name.startsWith(PUBLISHER_JOURNAL_PREFIX))) {
      acquireControlLock();
    }
    const recovery = recoverPublisherJournals(authority, lockHandle);
    managedJournalEntries = recovery.managed;
    runtimeBindings = resolvePromptPublicationRuntimeBindings(authority);
    if (recovery.acknowledgedCommit) {
      releaseLocks();
      if (options.json) process.stdout.write(`${JSON.stringify(readJson(authority.paths.evidenceOut))}\n`);
      return 0;
    }
    if (controlLockHandle) {
      try {
        releasePromptTransactionLock(controlLockHandle);
        controlLockHandle = null;
      } catch (error) {
        throw new Error(`prompt_transaction_recovery_required:control_unlock_failed:${error instanceof Error ? error.message : String(error)}`);
      }
    }
    assertCurrentDispatchPointerReplaySafe(
      authority.paths.currentDispatchPointer,
      authority.identity.attemptSequence
    );
    currentDispatchPointerPreimageHash = fs.existsSync(authority.paths.currentDispatchPointer)
      ? fileHash(authority.paths.currentDispatchPointer)
      : null;
    preimage = publicationPreimage(authority);
    try {
      journal = createPublicationJournal(authority, lockHandle, preimage);
    } catch (error) {
      throw new Error(`prompt_transaction_recovery_required:initialization_failed:${error instanceof Error ? error.message : String(error)}`);
    }
    managedJournalEntries.add(path.basename(journal.root));
    const capabilityResult = (deps.spawn ?? spawnSync)(
      runtimeBindings.capabilityProbeArgv[0],
      runtimeBindings.capabilityProbeArgv.slice(1),
      {
        cwd: authority.paths.consumerRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      }
    );
    if ((capabilityResult.status ?? 1) !== 0) throw new Error('capability_probe_exit_nonzero');
    const capability = JSON.parse(capabilityResult.stdout ?? '') as JsonRecord;
    assertSchema(
      'requirements-contract-consumer-cli-capability.schema.json',
      capability,
      'capability_observation'
    );
    if (capability.executionHost !== authority.executionHost) {
      throw new Error('capability_execution_host_mismatch');
    }
    const capabilityObservation = {
      schemaVersion: 'requirements-contract-consumer-cli-capability-observation/v1',
      transactionId: authority.identity.transactionId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      executionHost: capability.executionHost,
      goalCommandAvailable: capability.goalCommandAvailable,
      installedCliRef: runtimeBindings.installedCliRef,
      capabilityProbeArgv: runtimeBindings.capabilityProbeArgv,
      capabilityProbeArgvHash: sha256(canonicalJson(runtimeBindings.capabilityProbeArgv)),
      exitCode: capabilityResult.status,
      stdoutHash: sha256(capabilityResult.stdout ?? ''),
      stderrHash: sha256(capabilityResult.stderr ?? ''),
      observedAt: (deps.now ?? (() => new Date().toISOString()))(),
      readbackVerified: true,
    };
    assertSchema(
      'requirements-contract-consumer-cli-capability-observation.schema.json',
      capabilityObservation,
      'capability_observation'
    );
    const capabilityPath = path.join(
      authority.paths.outDir,
      'observations',
      'consumer-cli-capability.json'
    );
    const capabilityWrite = journaledJson(capabilityPath, capabilityObservation);
    const profileRefPath = path.join(authority.paths.outDir, EXECUTION_DISCIPLINE_PROFILE);
    journaledJson(profileRefPath, executionDisciplineProfile);
    const goalRequired = capability.goalCommandAvailable === true;
    const productionArgv = expectedProductionArgv(
      authority,
      runtimeBindings.installedGeneratorRef.path,
      goalRequired
    );
    const runnerRef = runtimeBindings.installedRunnerRef;
    publicationTouchedOutputs = true;
    journal.document.phase = 'compiling';
    persistPublicationJournal(journal);
    const runResult = (deps.runCompiledPrompt ?? runMainAgentCompiledPrompt)({
      projectRoot: authority.cwd,
      recordPath: authority.paths.requirementRecord,
      sourcePath: authority.paths.source,
      packetId: authority.identity.implementationAttemptId,
      flow: authority.flow,
      executionHost: authority.executionHost,
      goalCommandAvailable: goalRequired ? 'true' : 'false',
      reqTraceSkillDir: runtimeBindings.reqTraceSkillDir,
      outDir: authority.paths.outDir,
      taskReportPath: authority.paths.taskReport,
      promptLanguage: 'auto',
      humanPromptProfile: 'full',
      profileRefPath,
      ...authority.controlledExecutionContext,
    });
    journal.document.phase = 'compiled';
    for (const entry of journal.document.entries) {
      if (!entry.sharedTarget && fs.existsSync(entry.targetPath)) {
        const hash = fileHash(entry.targetPath);
        if (!entry.expectedHashes.includes(hash)) entry.expectedHashes.push(hash);
      }
    }
    persistPublicationJournal(journal);
    assertRunnerResult(
      runResult,
      authority,
      productionArgv,
      runtimeBindings.installedGeneratorRef,
      runnerRef,
      goalRequired
    );
    assertExactRunnerOutputSet(authority.paths.outDir, goalRequired, lockHandle, managedJournalEntries);
    const rawPacket = readJson(path.join(authority.paths.outDir, 'model_packet.json'));
    const rawPrompt = fs.readFileSync(path.join(authority.paths.outDir, 'human_prompt.txt'), 'utf8');
    const rawReceipt = readJson(path.join(authority.paths.outDir, 'audit_receipt.json'));
    const rawGoal = goalRequired
      ? fs.readFileSync(path.join(authority.paths.outDir, GOAL_OUTPUT), 'utf8')
      : null;
    if (fileHash(authority.paths.requirementRecord) !== authority.refs.requirementRecord.hash) {
      throw new Error('prompt_transaction_requirement_record_changed_during_compile');
    }
    const requirementRecordSnapshot = readJson(authority.paths.requirementRecord);
    const frozenRequirementRecordRef = plannedFileRef(
      requirementRecordSnapshotPath(authority.paths.outDir), serializedJson(requirementRecordSnapshot));
    const dispatchInputSetHash = sha256(
      canonicalJson({
        identity: authority.identity,
        requirementRecordRef: frozenRequirementRecordRef,
        attemptContextRef: authority.refs.attemptContext,
        sourceRef: {
          path: slash(authority.paths.source),
          sourceDocumentHash: authority.identity.sourceDocumentHash,
        },
        stageRegistryRef: authority.refs.stageRegistry,
        installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
        architectureAuthorityDecision: authority.architectureAuthorityDecision,
        confirmationReceiptRefs: {
          requirements: authority.refs.requirementsConfirmationReceipt,
          architecture: authority.refs.architectureConfirmationReceipt,
        },
        implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
        confirmationPageRefs: {
          requirements: authority.refs.requirementsConfirmationPage,
          architecture: authority.refs.architectureConfirmationPage,
        },
        consumerRef: {
          root: slash(authority.paths.consumerRoot),
          marker: authority.refs.consumerMarker,
          profile: authority.refs.consumerProfile,
          actionBindingManifest: runtimeBindings.manifestRef,
        },
        universeHashes: authority.universeHashes,
        capabilityObservationRef: capabilityWrite.targetRef,
      })
    );
    const projectedPacket = finalPacket(rawPacket, authority);
    assertNoAuthorityClaims(projectedPacket);
    const packetParity = auditModelPacketParity({
      sourcePath: authority.paths.source,
      packet: projectedPacket,
    });
    if (packetParity.reverseHashEdges.length > 0) {
      throw new Error(
        `prompt_transaction_reverse_hash_edge_detected:${packetParity.reverseHashEdges.join(',')}`
      );
    }
    if (packetParity.projectionDriftCount > 0) {
      throw new Error(
        `model_packet_parity_failed:${[
          ...packetParity.taskMismatches.map((item) => `task:${item}`),
          ...packetParity.acceptanceMismatches.map((item) => `acceptance:${item}`),
          ...packetParity.sourceObligationMismatches.map(
            (item) => `source_obligation:${item}`
          ),
          ...packetParity.commandMismatches.map((item) => `command:${item}`),
          ...packetParity.stopConditionMismatches.map(
            (item) => `stop_condition:${item}`
          ),
          ...packetParity.amendmentMismatches.map((item) => `amendment:${item}`),
        ].join(',')}`
      );
    }
    const packetContent = serializedJson(projectedPacket);
    const humanContent = finalHumanPrompt(rawPrompt);
    const packetRef = plannedFileRef(path.join(authority.paths.outDir, 'model_packet.json'), packetContent);
    const humanRef = plannedFileRef(path.join(authority.paths.outDir, 'human_prompt.txt'), humanContent);
    const goalRef = goalRequired ? plannedFileRef(path.join(authority.paths.outDir, GOAL_OUTPUT), rawGoal as string) : null;
    const createdAt = (deps.now ?? (() => new Date().toISOString()))();
    const manifestPath = path.join(authority.paths.outDir, 'transaction-manifest.json');
    const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
    const outputs: JsonRecord = {
      modelPacket: packetRef,
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
      humanPrompt: humanRef,
    };
    if (goalRef) outputs.goalExecution = goalRef;
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      attemptSequence: authority.identity.attemptSequence,
      sourceHash: authority.identity.sourceDocumentHash,
      sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
      semanticModelHash: authority.identity.semanticModelHash,
      contractHash: authority.identity.contractHash,
      dispatchInputSetHash,
      requirementRecordRef: frozenRequirementRecordRef,
      attemptContextRef: authority.refs.attemptContext,
      sourceRef: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
      },
      stageRegistryRef: authority.refs.stageRegistry,
      installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
      architectureAuthorityDecision: authority.architectureAuthorityDecision,
      confirmationReceiptRefs: {
        requirements: authority.refs.requirementsConfirmationReceipt,
        architecture: authority.refs.architectureConfirmationReceipt,
      },
      implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
      confirmationPageRefs: {
        requirements: authority.refs.requirementsConfirmationPage,
        architecture: authority.refs.architectureConfirmationPage,
      },
      consumerRef: {
        consumerId: authority.consumerProfile.consumerId,
        root: slash(authority.paths.consumerRoot),
        marker: authority.refs.consumerMarker,
        profile: authority.refs.consumerProfile,
        actionBindingManifest: runtimeBindings.manifestRef,
      },
      universeHashes: authority.universeHashes,
      capabilityObservationRef: capabilityWrite.targetRef,
      generatorRef: runtimeBindings.installedGeneratorRef,
      runnerRef,
      executionReceipt: runResult.executionReceipt,
      productionArgv,
      productionArgvHash: sha256(canonicalJson(productionArgv)),
      createdAt,
      transactionStatus: 'pass',
      hostDirective: goalRequired ? 'native_goal_document_ref' : 'direct_prompt',
      executionDisposition: 'executable',
      outputs,
    };
    assertSchema(
      'requirements-contract-prompt-transaction-manifest.schema.json',
      manifest,
      'prompt_transaction_manifest'
    );
    const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
    const finalArtifacts: Array<[string, string]> = [
      ['model_packet.json', packetContent], ['human_prompt.txt', humanContent],
      ['transaction-manifest.json', manifestContent],
      ...(goalRequired ? [[GOAL_OUTPUT, rawGoal as string] as [string, string]] : []),
    ];
    const finalArtifactBudgets = finalArtifacts.map(([name, content]) => ({
      name, scope: 'publisher-final', unit: 'utf8_bytes',
      ...measureJudgePayload({ serializedPayload: content, stage: `prompt_transaction_final:${name}`,
        sourceHash: authority.identity.sourceDocumentHash }),
    }));
    const auditReceipt = {
      schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
      decision: 'PASS',
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      promptTransaction: {
        manifestPath: slash(manifestPath),
        manifestHash: sha256(manifestContent),
        modelPacketHash: packetRef.hash,
        humanPromptHash: humanRef.hash,
        goalExecutionHash: goalRef?.hash ?? null,
      },
      authorityPolicy: {
        executionAuthorityClaim: false,
        closeoutAuthorityClaim: false,
      },
      generatorAudit: rawReceipt,
      finalArtifactBudgets,
      createdAt,
    };
    measureJudgePayload({ serializedPayload: serializedJson(auditReceipt),
      stage: 'prompt_transaction_final:audit_receipt.json', sourceHash: authority.identity.sourceDocumentHash });
    acquireControlLock();
    for (const entry of journal.document.entries.filter((item) => item.sharedTarget)) {
      const currentHash = fs.existsSync(entry.targetPath) ? fileHash(entry.targetPath) : null;
      if (currentHash !== entry.beforeHash) throw new Error('current_dispatch_pointer_cas_mismatch');
    }
    journal.document.phase = 'publishing';
    journaledJson(requirementRecordSnapshotPath(authority.paths.outDir), requirementRecordSnapshot);
    const packetWrite = journaledJson(path.join(authority.paths.outDir, 'model_packet.json'), projectedPacket);
    const humanWrite = journaledText(path.join(authority.paths.outDir, 'human_prompt.txt'), humanContent);
    const goalWrite = goalRequired ? journaledText(path.join(authority.paths.outDir, GOAL_OUTPUT), rawGoal as string) : null;
    const manifestWrite = journaledText(manifestPath, manifestContent);
    const auditWrite = journaledJson(auditReceiptPath, auditReceipt);
    const outputWrites = [
      ['model_packet.json', packetWrite],
      ['transaction-manifest.json', manifestWrite],
      ['audit_receipt.json', auditWrite],
      ['human_prompt.txt', humanWrite],
      ...(goalWrite ? ([[GOAL_OUTPUT, goalWrite]] as Array<[string, WriteResult]>) : []),
    ] as Array<[string, WriteResult]>;
    const outputSetExpected = goalRequired ? [...ALL_OUTPUTS] : [...ALWAYS_OUTPUTS];
    const outputSetObserved = ALL_OUTPUTS.filter((name) =>
      fs.existsSync(path.join(authority!.paths.outDir, name))
    );
    if (canonicalJson(outputSetObserved) !== canonicalJson(outputSetExpected)) {
      throw new Error('prompt_transaction_output_set_mismatch');
    }
    const pointer = {
      schemaVersion: 'requirements-contract-current-dispatch-pointer/v1',
      producer: 'requirements-contract-current-dispatch-pointer',
      action: ACTION,
      contractHash: authority.identity.contractHash,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      attemptSequence: authority.identity.attemptSequence,
      packetId: authority.identity.implementationAttemptId,
      dispatchInputSetHash,
      requirementRecordRef: frozenRequirementRecordRef,
      attemptContextRef: authority.refs.attemptContext,
      sourceRef: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
      },
      sourceDocumentHash: authority.identity.sourceDocumentHash,
      sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
      semanticModelHash: authority.identity.semanticModelHash,
      stageRegistryRef: authority.refs.stageRegistry,
      installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
      architectureAuthorityDecision: authority.architectureAuthorityDecision,
      confirmationReceiptRefs: {
        requirements: authority.refs.requirementsConfirmationReceipt,
        architecture: authority.refs.architectureConfirmationReceipt,
      },
      implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
      confirmationPageRefs: {
        requirements: authority.refs.requirementsConfirmationPage,
        architecture: authority.refs.architectureConfirmationPage,
      },
      consumerRef: {
        consumerId: authority.consumerProfile.consumerId,
        root: slash(authority.paths.consumerRoot),
        marker: authority.refs.consumerMarker,
        profile: authority.refs.consumerProfile,
      },
      universeHashes: authority.universeHashes,
      packageRuntimeActionBindingManifestRef: runtimeBindings.manifestRef,
      transactionManifestRef: manifestWrite.targetRef,
      modelPacketRef: packetWrite.targetRef,
      auditReceiptRef: auditWrite.targetRef,
      humanPromptRef: humanWrite.targetRef,
      goalExecutionRef: goalWrite?.targetRef ?? null,
      capabilityObservationRef: capabilityWrite.targetRef,
      activationState: 'active',
      decision: 'PASS',
      selectionMetrics: {
        directoryScanCount: 0,
        newestFileSelectionCount: 0,
        historicalFallbackCount: 0,
        missingBindingCount: 0,
        replayRejectedCount: 0,
        casMismatchCount: 0,
        currentDispatchPointerCoverage: 1,
      },
      supersededPointerRef: null,
      createdAt,
    };
    sharedWriteHashes.set(authority.paths.currentDispatchPointer, sha256(serializedJson(pointer)));
    publicationIntent(journal, authority.paths.currentDispatchPointer, sha256(serializedJson(pointer)));
    pointerPublication = publishCurrentDispatchPointer({
      authorityRoot: authority.cwd,
      targetPath: authority.paths.currentDispatchPointer,
      expectedPreimageHash: currentDispatchPointerPreimageHash,
      pointer,
    });
    const safeWriteReceiptRefs = outputWrites.map(([, write]) => write.receiptRef);
    const outputReadbacks = outputWrites.map(([, write]) => write.targetRef);
    const evidence = {
      schemaVersion: 'requirements-contract-g09-prompt-transaction-evidence/v1',
      evidenceId: 'EVD-09',
      producer: 'requirements-contract-prompt-transaction-publisher',
      action: ACTION,
      decision: 'PASS',
      contractHash: authority.identity.contractHash,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      dispatchInputSetHash,
      modelPacketPath: packetWrite.targetRef.path,
      modelPacketHash: packetWrite.targetRef.hash,
      transactionManifestPath: manifestWrite.targetRef.path,
      generationReceiptPath: auditWrite.targetRef.path,
      generationReceiptHash: auditWrite.targetRef.hash,
      humanPromptPath: humanWrite.targetRef.path,
      humanPromptHash: humanWrite.targetRef.hash,
      goalExecutionApplicability: goalRequired ? 'required' : 'not_applicable',
      goalExecutionPath: goalWrite?.targetRef.path ?? null,
      goalExecutionHash: goalWrite?.targetRef.hash ?? null,
      productionArgv,
      productionArgvHash: manifest.productionArgvHash,
      resolvedGeneratorPath: runtimeBindings.installedGeneratorRef.path,
      resolvedGeneratorHash: runtimeBindings.installedGeneratorRef.hash,
      resolvedRunnerPath: runnerRef.path,
      resolvedRunnerHash: runnerRef.hash,
      outputSetExpected,
      outputSetObserved,
      promptTransactionOutputSetMismatchCount: 0,
      promptTransactionArgvMismatchCount: 0,
      promptTransactionReverseHashEdgeCount: packetParity.reverseHashEdges.length,
      safeWriteReceiptRefs,
      modelPacketProjectionDriftCount: packetParity.projectionDriftCount,
      modelPacketAuthorityClaimCount: 0,
      modelPacketTaskParityCount: packetParity.taskMismatches.length,
      modelPacketAcceptanceParityCount: packetParity.acceptanceMismatches.length,
      modelPacketSourceObligationParityCount:
        packetParity.sourceObligationMismatches.length,
      modelPacketCommandParityCount: packetParity.commandMismatches.length,
      modelPacketStopConditionParityCount: packetParity.stopConditionMismatches.length,
      modelPacketAmendmentParityCount: packetParity.amendmentMismatches.length,
      promptTransactionLockPath: slash(
        path.join(authority.paths.outDir, '.prompt-transaction.lock')
      ),
      promptTransactionLockViolationCount: 0,
      promptTransactionStaleLockRecoveryCases: staleLockRecoveryCases(
        authority.paths.outDir,
        lockHandle
      ),
      promptTransactionStaleLockRecoveryMismatchCount: 0,
      promptTransactionQuarantineRoot: slash(path.join(authority.paths.outDir, '.quarantine')),
      promptTransactionQuarantineCases: [],
      promptTransactionOrphanTransientCount: 0,
      promptTransactionTransientActiveReadCount: 0,
      transactionManifestHash: manifestWrite.targetRef.hash,
      sourceHashBinding: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
        requirementRecordRef: frozenRequirementRecordRef,
      },
      sourceAmendmentHashBindings: authority.identity.sourceAmendmentHashes,
      atomicPromotionCases: outputWrites.map(([name, write]) => outputWriteCase(name, write)),
      blockedReplayCases: [],
      concurrencyCases: [],
      autoCommitDefault: false,
      commandRunRef: {
        path: null,
        hash: null,
        hashApplicability: 'downstream_external',
      },
      transactionManifestRef: manifestWrite.targetRef,
      currentDispatchPointerRef: pointerPublication.pointerRef,
      capabilityObservationRef: capabilityWrite.targetRef,
      outputReadbacks,
      createdAt,
    };
    assertSchema(
      'requirements-contract-g09-prompt-transaction-evidence.schema.json',
      evidence,
      'g09_prompt_transaction_evidence'
    );
    sharedWriteHashes.set(authority.paths.evidenceOut, sha256(serializedJson(evidence)));
    journaledJson(authority.paths.evidenceOut, evidence);
    retainPublicationRootArtifacts(journal);
    for (const entry of journal.document.entries) {
      if (fs.existsSync(entry.targetPath)) {
        const hash = fileHash(entry.targetPath);
        if (entry.expectedHashes.at(-1) !== hash) entry.expectedHashes.push(hash);
      }
    }
    journal.document.state = 'committed';
    persistPublicationJournal(journal);
    releaseLocks();
    if (options.json) process.stdout.write(`${JSON.stringify(evidence)}\n`);
    return 0;
  } catch (error) {
    let blockingReason = error instanceof Error ? error.message : String(error);
    if (blockingReason.startsWith('prompt_transaction_recovery_required:')) {
      if (options.json) process.stdout.write(`${JSON.stringify({ decision: 'BLOCK', blockingReason,
        recoveryRequired: true })}\n`);
      return 1;
    }
    if (!journal && blockingReason.startsWith('prompt_transaction_control_lock_unavailable:')) {
      releaseLocks();
      if (options.json) process.stdout.write(`${JSON.stringify({ decision: 'BLOCK', blockingReason })}\n`);
      return 1;
    }
    if (preimage && authority && lockHandle &&
      (blockingReason === 'judge_provider_capacity_exceeded' || preimage.previousPass ||
        blockingReason.startsWith('current_dispatch_pointer_') ||
        blockingReason.startsWith('prompt_transaction_control_lock_unavailable:'))) {
      try {
        if (journal) restoreDurablePublication(authority, journal);
        else restorePublicationPreimage(preimage, sharedWriteHashes);
      } catch (restoreError) {
        if (options.json) process.stdout.write(`${JSON.stringify({ decision: 'BLOCK', blockingReason,
          recoveryRequired: true, recoveryError: restoreError instanceof Error ? restoreError.message : String(restoreError) })}\n`);
        return 1;
      }
      pointerPublication = null;
      releaseLocks();
      if (options.json) process.stdout.write(`${JSON.stringify({ decision: 'BLOCK', blockingReason,
        previousAuthorityPreserved: preimage.previousPass })}\n`);
      return 1;
    }
    const requiresPreLockInvalidation =
      !authority ||
      (authority !== null &&
        lockHandle === null &&
        blockingReason.startsWith('source_prd_lint_transition_blocked:'));
    if (requiresPreLockInvalidation) {
      try {
        invalidateExistingTransactionAfterAuthorityFailure(
          options,
          blockingReason,
          (deps.now ?? (() => new Date().toISOString()))(),
          deps.lockDeps
        );
      } catch (sanitizationError) {
        blockingReason = `${blockingReason};authority_resolution_sanitization_failed:${
          sanitizationError instanceof Error
            ? sanitizationError.message
            : String(sanitizationError)
        }`;
      }
    }
    if (authority) {
      const isMatchingPointerReplay =
        blockingReason === 'current_dispatch_pointer_replay_rejected' &&
        runtimeBindings !== null &&
        matchingReplayPointer(authority) !== null;
      const canPublishBlockedTransaction =
        blockingReason !== 'current_dispatch_pointer_replay_rejected' ||
        isMatchingPointerReplay;
      if (pointerPublication) {
        rollbackCurrentDispatchPointer(authority.paths.currentDispatchPointer, pointerPublication);
        pointerPublication = null;
      }
      if (runtimeBindings && lockHandle && canPublishBlockedTransaction) {
        const pointerCandidates = isMatchingPointerReplay
          ? [
              authority.paths.currentDispatchPointer,
              `${authority.paths.currentDispatchPointer}.safe-write-receipt.json`,
            ]
          : [];
        removePublicationEvidence(authority);
        quarantineExecutableOutputs(
          authority.paths.outDir,
          authority.identity.transactionId,
          pointerCandidates
        );
        publishBlockedTransaction(
          authority,
          runtimeBindings,
          blockingReason,
          isMatchingPointerReplay ? 'pointer_replay_preflight' : 'production_publication',
          (deps.now ?? (() => new Date().toISOString()))()
        );
        publicationTouchedOutputs = false;
      }
      if (lockHandle) {
        if (journal) {
          retainPublicationRootArtifacts(journal);
          journal.document.state = 'blocked';
          persistPublicationJournal(journal);
        }
        releaseLocks();
      }
      if (publicationTouchedOutputs) {
        removePublicationEvidence(authority);
        quarantineExecutableOutputs(
          authority.paths.outDir,
          authority.identity.transactionId
        );
      }
    }
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({
          action: ACTION,
          decision: 'BLOCK',
          error: blockingReason,
        })}\n`
      );
    }
    return 1;
  }
}
