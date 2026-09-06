const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { requireLargeDocumentWriter } = require('./resolve-bmad-runtime');
const { safeWriteText, safeWriteJson } = requireLargeDocumentWriter();

const ARTIFACT_NAMES = ['goal_execution.md', 'human_prompt.txt', 'model_packet.json', 'audit_receipt.json'];
const hash = (content) => crypto.createHash('sha256').update(content).digest('hex');
const artifactSetHash = (entries) => hash(JSON.stringify(entries.map((entry) => ({
  backupPath: entry.backupPath, name: entry.name, nextHash: entry.nextHash, previousHash: entry.previousHash,
}))));

function publicationError(code, cause, journalPath) {
  return Object.assign(new Error(code), { code, cause, journalPath });
}

function requireRecovery(cause, journalPath) {
  throw publicationError('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED', cause, journalPath);
}

function regularBytes(file) {
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) requireRecovery('unsafe_file');
  return fs.readFileSync(file);
}

function readRecord(file) {
  const bytes = regularBytes(file);
  if (!bytes || bytes.length > 128 * 1024) requireRecovery('invalid_record');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function processAlive(record) {
  if (record.host !== os.hostname() || !Number.isInteger(record.pid) || record.pid <= 0) return true;
  try { process.kill(record.pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

function persistLock(fd, record) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
  fs.writeSync(fd, bytes, 0, bytes.length, 0);
  fs.ftruncateSync(fd, bytes.length);
  fs.fsyncSync(fd);
}

function validateJournal(root, record) {
  const journalRoot = path.dirname(record.journalPath);
  if (path.dirname(journalRoot) !== root || path.basename(record.journalPath) !== 'journal.json' ||
    !/^\.compiler-publication-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{6}$/u.test(path.basename(journalRoot)) ||
    !fs.lstatSync(journalRoot).isDirectory() || fs.lstatSync(journalRoot).isSymbolicLink())
    requireRecovery('invalid_journal_path');
  const journal = readRecord(record.journalPath);
  if (journal.schemaVersion !== 'req-trace-publication/v1' || journal.ownerId !== record.ownerId ||
    !['prepared', 'completed', 'rolled_back'].includes(journal.state) || !Array.isArray(journal.artifacts) ||
    journal.artifacts.length < 3 || journal.artifacts.length > 4 ||
    record.artifactSetHash !== artifactSetHash(journal.artifacts)) requireRecovery('invalid_journal');
  const names = new Set();
  const files = new Set(['journal.json']);
  const entries = journal.artifacts.map((entry) => {
    if (!ARTIFACT_NAMES.includes(entry.name) || names.has(entry.name) ||
      !/^[a-f0-9]{64}$/u.test(entry.nextHash)) requireRecovery('invalid_artifact');
    names.add(entry.name);
    let previous = null;
    if (entry.previousHash === null) {
      if (entry.backupPath !== null) requireRecovery('invalid_backup');
    } else {
      if (!/^[a-f0-9]{64}$/u.test(entry.previousHash) ||
        entry.backupPath !== path.join(journalRoot, `${entry.name}.previous`)) requireRecovery('invalid_backup');
      previous = regularBytes(entry.backupPath);
      if (previous === null || hash(previous) !== entry.previousHash) requireRecovery('backup_hash_mismatch');
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(previous);
      files.add(`${entry.name}.previous`);
    }
    const file = path.join(root, entry.name);
    const current = regularBytes(file);
    const currentHash = current === null ? null : hash(current);
    if (currentHash !== entry.previousHash && currentHash !== entry.nextHash)
      requireRecovery('unknown_artifact_write');
    return { ...entry, file, previous, currentHash };
  });
  if (!['model_packet.json', 'human_prompt.txt', 'audit_receipt.json'].every((name) => names.has(name)))
    requireRecovery('missing_artifact_intent');
  for (const name of fs.readdirSync(journalRoot)) {
    if (files.has(name)) continue;
    if (/^\.recovery-[a-f0-9]{64}\.json$/u.test(name)) {
      const claim = readRecord(path.join(journalRoot, name));
      if (claim.schemaVersion !== 'req-trace-recovery/v1' || claim.ownerId !== record.ownerId ||
        !Number.isInteger(claim.pid) || claim.pid <= 0 || claim.host !== record.host ||
        name !== `.recovery-${claim.previousHash}.json`) requireRecovery('invalid_recovery_claim');
      continue;
    }
    if (!/^journal\.json\.backup-\d+-\d+$/u.test(name)) requireRecovery('unknown_journal_file');
    const history = readRecord(path.join(journalRoot, name));
    if (history.schemaVersion !== journal.schemaVersion || history.ownerId !== journal.ownerId ||
      !['prepared', 'completed', 'rolled_back'].includes(history.state) ||
      JSON.stringify(history.artifacts) !== JSON.stringify(journal.artifacts)) requireRecovery('invalid_journal_history');
  }
  return { journal, entries, journalRoot };
}

function settleJournal(root, record) {
  const { journal, entries } = validateJournal(root, record);
  const allNext = entries.every((entry) => entry.currentHash === entry.nextHash);
  const allPrevious = entries.every((entry) => entry.currentHash === entry.previousHash);
  if ((journal.state === 'completed' && !allNext) || (journal.state === 'rolled_back' && !allPrevious))
    requireRecovery('terminal_journal_mismatch');
  // A complete hash-bound audit commits the set even if the final journal write was interrupted.
  if (journal.state === 'prepared' && !allNext) {
    for (const entry of entries.slice().sort((a, b) => ARTIFACT_NAMES.indexOf(b.name) - ARTIFACT_NAMES.indexOf(a.name))) {
      const current = regularBytes(entry.file);
      const currentHash = current === null ? null : hash(current);
      if (currentHash === entry.previousHash) continue;
      if (currentHash !== entry.nextHash) requireRecovery('concurrent_artifact_write');
      if (entry.previous === null) fs.unlinkSync(entry.file);
      else safeWriteText(entry.file, new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(entry.previous),
        { mode: 'upsert' });
      const restored = regularBytes(entry.file);
      if ((restored === null ? null : hash(restored)) !== entry.previousHash) requireRecovery('restore_hash_mismatch');
    }
  }
  const state = allNext ? 'completed' : 'rolled_back';
  if (journal.state !== state) safeWriteJson(record.journalPath, { ...journal, state }, { mode: 'replace' });
  return state;
}

function recoverLock(root, lockPath) {
  const original = regularBytes(lockPath);
  const record = readRecord(lockPath);
  if (record.schemaVersion !== 'req-trace-publication-lock/v1' ||
    typeof record.ownerId !== 'string' || !/^[a-f0-9]{32}$/u.test(record.ownerId) ||
    typeof record.journalPath !== 'string' || processAlive(record)) requireRecovery('lock_owner_not_recoverable');
  const { journalRoot } = validateJournal(root, record);
  const pending = record.cleanupClaims ?? [];
  if (!Array.isArray(pending) || pending.some((name) => !/^\.recovery-[a-f0-9]{64}\.json$/u.test(name)))
    requireRecovery('invalid_cleanup_claims');
  const claims = new Set(pending);
  let predecessor = original;
  // Immutable claims serialize stale-lock recovery, including a crash of a recovery process.
  for (let depth = 0; ; depth += 1) {
    if (depth >= 1000) requireRecovery('recovery_chain_limit');
    const name = `.recovery-${hash(predecessor)}.json`;
    const file = path.join(journalRoot, name);
    claims.add(name);
    let fd;
    try { fd = fs.openSync(file, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const current = readRecord(file);
      if (current.previousHash !== hash(predecessor) || current.ownerId !== record.ownerId ||
        current.schemaVersion !== 'req-trace-recovery/v1' || processAlive(current)) requireRecovery('recovery_owner_active');
      predecessor = regularBytes(file);
      continue;
    }
    try { persistLock(fd, { schemaVersion: 'req-trace-recovery/v1', ownerId: record.ownerId,
      pid: process.pid, host: os.hostname(), previousHash: hash(predecessor) }); }
    finally { fs.closeSync(fd); }
    break;
  }
  const current = regularBytes(lockPath);
  if (!current || !current.equals(original)) requireRecovery('lock_changed_during_recovery');
  for (const name of fs.readdirSync(journalRoot)) {
    if (name.startsWith('.recovery-') && !claims.has(name)) requireRecovery('unknown_recovery_claim');
  }
  settleJournal(root, record);
  const fd = fs.openSync(lockPath, 'r+');
  try {
    if (!regularBytes(lockPath).equals(original)) requireRecovery('lock_changed_during_recovery');
    // Transfer ownership before deleting claims so another recovery cannot reclaim the old lock.
    persistLock(fd, { ...record, pid: process.pid, host: os.hostname(), cleanupClaims: [...claims] });
    for (const name of claims) {
      const file = path.join(journalRoot, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    return fd;
  } catch (error) { fs.closeSync(fd); throw error; }
}

function publishArtifactSet(outDir, artifacts) {
  const root = path.resolve(outDir);
  const entries = Object.entries(artifacts).map(([file, content]) => {
    const name = path.basename(file);
    if (!ARTIFACT_NAMES.includes(name) || path.resolve(file) !== path.join(root, name))
      throw publicationError('REQ_TRACE_PUBLICATION_PATH_INVALID');
    if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()))
      throw publicationError('REQ_TRACE_PUBLICATION_PATH_INVALID');
    if (typeof content !== 'string') throw publicationError('REQ_TRACE_PUBLICATION_PATH_INVALID');
    return { file: path.resolve(file), name, content, nextHash: hash(content) };
  }).sort((a, b) => ARTIFACT_NAMES.indexOf(a.name) - ARTIFACT_NAMES.indexOf(b.name));
  if (!['model_packet.json', 'human_prompt.txt', 'audit_receipt.json'].every((name) => entries.some((entry) => entry.name === name)))
    throw publicationError('REQ_TRACE_PUBLICATION_PATH_INVALID');
  fs.mkdirSync(root, { recursive: true });
  if (fs.lstatSync(root).isSymbolicLink()) throw publicationError('REQ_TRACE_PUBLICATION_PATH_INVALID');
  const lockPath = path.join(root, '.compiler-publication.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx'); }
  catch (cause) {
    if (cause.code !== 'EEXIST') requireRecovery(cause);
    try { lock = recoverLock(root, lockPath); }
    catch (recoveryCause) { requireRecovery(recoveryCause, recoveryCause.journalPath); }
  }
  let retainLock = false;
  let journalPath;
  let record;
  try {
    try {
      for (const name of fs.readdirSync(root).filter((name) => name.startsWith('.compiler-publication-'))) {
        const previousJournal = path.join(root, name, 'journal.json');
        if (!['completed', 'rolled_back'].includes(readRecord(previousJournal).state))
          requireRecovery('pending_publication_without_owner', previousJournal);
      }
    } catch (error) { retainLock = true; throw error; }
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const journalRoot = path.join(root, `.compiler-publication-${stamp}-${crypto.randomBytes(3).toString('hex')}`);
    fs.mkdirSync(journalRoot);
    journalPath = path.join(journalRoot, 'journal.json');
    record = { schemaVersion: 'req-trace-publication-lock/v1', ownerId: crypto.randomBytes(16).toString('hex'),
      pid: process.pid, host: os.hostname(), journalPath };
    persistLock(lock, record);
    for (const entry of entries) {
      entry.previous = fs.existsSync(entry.file) ? fs.readFileSync(entry.file) : null;
      entry.previousHash = entry.previous === null ? null : hash(entry.previous);
      if (entry.previous !== null) {
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(entry.previous);
        entry.backupPath = path.join(journalRoot, `${entry.name}.previous`);
        safeWriteText(entry.backupPath, text, { mode: 'create' });
        if (hash(fs.readFileSync(entry.backupPath)) !== entry.previousHash)
          throw publicationError('REQ_TRACE_PUBLICATION_BACKUP_HASH_MISMATCH');
      }
    }
    const journal = { schemaVersion: 'req-trace-publication/v1', ownerId: record.ownerId, state: 'prepared',
      artifacts: entries.map(({ name, previousHash, nextHash, backupPath }) =>
        ({ name, previousHash, nextHash, backupPath: backupPath ?? null })) };
    record.artifactSetHash = artifactSetHash(journal.artifacts);
    persistLock(lock, record);
    safeWriteJson(journalPath, journal, { mode: 'create' });
    // The hash-bound audit is the commit marker and is published last.
    for (const entry of entries) {
      const current = regularBytes(entry.file);
      if ((current === null ? null : hash(current)) !== entry.previousHash)
        requireRecovery('concurrent_artifact_write', journalPath);
      if (entry.name === 'audit_receipt.json' && entries.some((sibling) => {
        if (sibling.name === entry.name) return false;
        const bytes = regularBytes(sibling.file);
        return bytes === null || hash(bytes) !== sibling.nextHash;
      }))
        requireRecovery('commit_artifact_hash_mismatch', journalPath);
      // Verified transaction backups already preserve the complete previous set.
      safeWriteText(entry.file, entry.content, { mode: entry.previous === null ? 'create' : 'upsert' });
    }
    safeWriteJson(journalPath, { ...journal, state: 'completed' }, { mode: 'replace' });
  } catch (cause) {
    try {
      if (journalPath && fs.existsSync(journalPath) && settleJournal(root, record) === 'completed') return;
    } catch (rollbackCause) {
      retainLock = true;
      throw publicationError('REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED', rollbackCause, journalPath);
    }
    throw publicationError(retainLock ? 'REQ_TRACE_PUBLICATION_RECOVERY_REQUIRED' : 'REQ_TRACE_PUBLICATION_FAILED', cause, journalPath);
  } finally {
    fs.closeSync(lock);
    if (!retainLock) {
      if (record && readRecord(lockPath).ownerId !== record.ownerId) requireRecovery('lock_owner_changed', journalPath);
      fs.unlinkSync(lockPath);
    }
  }
}

module.exports = { publishArtifactSet };
