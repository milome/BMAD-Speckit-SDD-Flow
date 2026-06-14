const fs = require('node:fs');
const path = require('node:path');
const { block } = require('./errors');
const { sha256File, sha256Text, stableStringify } = require('./receipts');

function timestamp() {
  return new Date().toISOString();
}

function tempPathFor(targetPath) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  return path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
}

function backupPathFor(targetPath) {
  return `${targetPath}.backup-${process.pid}-${Date.now()}`;
}

function assertMode(targetPath, mode) {
  const exists = fs.existsSync(targetPath);
  if (mode === 'create' && exists) block('TARGET_EXISTS', { targetPath });
  if (mode === 'replace' && !exists) block('TARGET_MISSING', { targetPath });
  if (!['create', 'replace', 'upsert'].includes(mode)) block('INVALID_MODE', { mode });
}

function safeWriteText(targetPath, text, options = {}) {
  const resolved = path.resolve(targetPath);
  const mode = options.mode || 'upsert';
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  assertMode(resolved, mode);

  const originalExists = fs.existsSync(resolved);
  const originalHash = originalExists ? sha256File(resolved) : null;
  const backupPath = originalExists && mode === 'replace' ? backupPathFor(resolved) : null;

  if (backupPath) fs.copyFileSync(resolved, backupPath);

  const tempPath = tempPathFor(resolved);
  fs.writeFileSync(tempPath, String(text), 'utf8');
  const expectedTempHash = sha256Text(String(text));
  const tempHash = sha256File(tempPath);
  if (tempHash !== expectedTempHash) block('PROMOTE_HASH_MISMATCH', { tempPath, tempHash });

  fs.renameSync(tempPath, resolved);
  const finalHash = sha256File(resolved);
  if (finalHash !== expectedTempHash) block('PROMOTE_HASH_MISMATCH', { targetPath: resolved, finalHash });

  return {
    schemaVersion: 'large-document-writer-safe-write/v1',
    targetPath: resolved,
    mode,
    tempPath,
    tempHash,
    backupPath,
    originalHash,
    backupHash: backupPath ? sha256File(backupPath) : null,
    finalHash,
    writtenAt: timestamp(),
  };
}

function safeWriteJson(targetPath, value, options = {}) {
  return safeWriteText(targetPath, stableStringify(value), options);
}

module.exports = {
  safeWriteJson,
  safeWriteText,
};
