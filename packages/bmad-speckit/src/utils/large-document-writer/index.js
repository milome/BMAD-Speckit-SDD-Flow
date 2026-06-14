const fs = require('node:fs');
const path = require('node:path');
const { LargeDocumentWriterError, block } = require('./errors');
const { assembleSession, readValidationReceipt } = require('./assembler');
const { addChunk, listChunkState } = require('./chunk-store');
const { initSession, readManifest, sessionPaths, updateManifest } = require('./draft-session');
const {
  normalizePath,
  sha256File,
  sha256Text,
  stableStringify,
  writeJsonReceipt,
} = require('./receipts');
const { safeWriteJson, safeWriteText } = require('./safe-writer');
const { validateAssembly } = require('./validators');

function getSessionStatus({ sessionDir }) {
  const manifest = readManifest(sessionDir);
  const state = listChunkState(sessionDir);
  const completedInPlan = manifest.chunkPlan
    .map((entry) => entry.chunkId)
    .filter((chunkId) => state.completedChunks.includes(chunkId));
  const lastCompleteChunkId = completedInPlan.at(-1) || null;
  const nextChunkId =
    manifest.chunkPlan.find((entry) => !state.completedChunks.includes(entry.chunkId))?.chunkId ||
    null;

  return {
    schemaVersion: 'large-document-writer-status/v1',
    sessionDir: path.resolve(sessionDir),
    targetPath: manifest.targetPath,
    targetTouched: fs.existsSync(manifest.targetPath),
    lastCompleteChunkId,
    nextChunkId,
    missingChunks: state.missingChunks,
    corruptChunks: state.corruptChunks,
    promoted: Boolean(manifest.promoted),
    finalHash: manifest.finalHash || null,
  };
}

function promoteAssembly({ sessionDir }) {
  const manifest = readManifest(sessionDir);
  const paths = sessionPaths(sessionDir);
  if (!fs.existsSync(paths.assembledPath)) block('ASSEMBLY_VALIDATION_FAILED', { missingAssembly: paths.assembledPath });
  const text = fs.readFileSync(paths.assembledPath, 'utf8');
  const validationReceipt = readValidationReceipt(sessionDir);
  const currentAssemblyHash = sha256Text(text);
  if (validationReceipt.assemblyHash !== currentAssemblyHash) {
    block('ASSEMBLY_VALIDATION_FAILED', {
      reason: 'stale_validation_receipt',
      validatedHash: validationReceipt.assemblyHash,
      currentHash: currentAssemblyHash,
    });
  }
  const writeReceipt = safeWriteText(manifest.targetPath, text, { mode: manifest.mode });
  const receipt = {
    sessionDir: path.resolve(sessionDir),
    targetPath: manifest.targetPath,
    ...writeReceipt,
    schemaVersion: 'large-document-writer-promote-receipt/v1',
    promotedAt: new Date().toISOString(),
  };
  writeJsonReceipt(paths.promoteReceiptPath, receipt);
  updateManifest(sessionDir, {
    promoted: true,
    finalHash: receipt.finalHash,
    backupPath: receipt.backupPath,
  });
  return receipt;
}

function cleanupSession({ sessionDir, policy = 'keep' }) {
  const manifest = readManifest(sessionDir);
  const paths = sessionPaths(sessionDir);
  if (!manifest.promoted || !manifest.finalHash) block('CLEANUP_BEFORE_PROMOTE', { sessionDir });
  if (!fs.existsSync(manifest.targetPath)) {
    block('PROMOTED_TARGET_MISSING', { targetPath: manifest.targetPath });
  }
  if (sha256File(manifest.targetPath) !== manifest.finalHash) {
    block('PROMOTE_HASH_MISMATCH', { targetPath: manifest.targetPath });
  }
  if (!['keep', 'prune', 'archive', 'delete'].includes(policy)) block('INVALID_CLEANUP_POLICY', { policy });

  if (policy === 'prune') {
    fs.rmSync(paths.chunksDir, { recursive: true, force: true });
    fs.rmSync(paths.assemblyReceiptPath, { force: true });
    fs.rmSync(paths.validationReceiptPath, { force: true });
  } else if (policy === 'delete') {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } else if (policy === 'archive') {
    const archivePath = `${sessionDir}.archive-${Date.now()}`;
    fs.renameSync(sessionDir, archivePath);
    return {
      schemaVersion: 'large-document-writer-cleanup-receipt/v1',
      policy,
      sessionDir,
      archivePath,
      cleanedAt: new Date().toISOString(),
    };
  }

  return {
    schemaVersion: 'large-document-writer-cleanup-receipt/v1',
    policy,
    sessionDir,
    backupPath: manifest.backupPath || null,
    cleanedAt: new Date().toISOString(),
  };
}

module.exports = {
  LargeDocumentWriterError,
  addChunk,
  assembleSession,
  block,
  cleanupSession,
  getSessionStatus,
  initSession,
  normalizePath,
  promoteAssembly,
  safeWriteJson,
  safeWriteText,
  sha256File,
  sha256Text,
  stableStringify,
  validateAssembly,
  writeJsonReceipt,
};
