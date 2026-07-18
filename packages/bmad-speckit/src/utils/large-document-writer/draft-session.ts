const fs = require('node:fs');
const path = require('node:path');
const sourceSuffix = __filename.endsWith('.ts') ? '.ts' : '';
const { block } = require(`./errors${sourceSuffix}`);
const { normalizePath, writeJsonReceipt } = require(`./receipts${sourceSuffix}`);

function now() {
  return new Date().toISOString();
}

function defaultSessionDir(targetPath) {
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.draft`);
}

function manifestPath(sessionDir) {
  return path.join(sessionDir, 'manifest.json');
}

function readManifest(sessionDir) {
  const file = manifestPath(sessionDir);
  if (!fs.existsSync(file)) block('MANIFEST_MISSING', { sessionDir });
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeManifest(sessionDir, manifest) {
  writeJsonReceipt(manifestPath(sessionDir), manifest);
  return manifest;
}

function validateInitOptions(options) {
  if (!options || typeof options !== 'object') {
    block('INVALID_INIT_OPTIONS', { reason: 'options must be an object' });
  }
  if (typeof options.targetPath !== 'string' || options.targetPath.trim() === '') {
    block('INVALID_TARGET_PATH', { targetPath: options.targetPath ?? null });
  }
  if (
    options.sessionDir !== undefined &&
    (typeof options.sessionDir !== 'string' || options.sessionDir.trim() === '')
  ) {
    block('INVALID_SESSION_DIR', { sessionDir: options.sessionDir ?? null });
  }
}

function initSession(options) {
  validateInitOptions(options);
  const targetPath = path.resolve(options.targetPath);
  const sessionDir = path.resolve(options.sessionDir || defaultSessionDir(targetPath));
  const createdAt = now();
  fs.mkdirSync(path.join(sessionDir, 'chunks'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'receipts'), { recursive: true });

  const manifest = {
    schemaVersion: 'large-document-writer-session/v1',
    targetPath,
    mode: options.mode || 'create',
    profile: options.profile || 'markdown',
    sessionDir,
    chunkPlan: options.chunkPlan || [],
    requiredHeadings: options.requiredHeadings || [],
    requiredFragments: options.requiredFragments || [],
    forbiddenFragments: options.forbiddenFragments || [],
    allowPlaceholders: options.allowPlaceholders ?? true,
    minBytes: options.minBytes || 0,
    minLines: options.minLines || 0,
    createdAt,
    updatedAt: createdAt,
    promoted: false,
    finalHash: null,
    backupPath: null,
  };
  writeManifest(sessionDir, manifest);
  return {
    schemaVersion: 'large-document-writer-session-init/v1',
    targetPath,
    targetTouched: fs.existsSync(targetPath),
    sessionDir,
    manifestPath: manifestPath(sessionDir),
    mode: manifest.mode,
    profile: manifest.profile,
  };
}

function updateManifest(sessionDir, patch) {
  const manifest = readManifest(sessionDir);
  const updated = { ...manifest, ...patch, updatedAt: now() };
  writeManifest(sessionDir, updated);
  return updated;
}

function sessionPaths(sessionDir) {
  return {
    chunksDir: path.join(sessionDir, 'chunks'),
    receiptsDir: path.join(sessionDir, 'receipts'),
    assembledPath: path.join(sessionDir, 'assembled.md'),
    assemblyReceiptPath: path.join(sessionDir, 'assembly-receipt.json'),
    validationReceiptPath: path.join(sessionDir, 'validation-receipt.json'),
    promoteReceiptPath: path.join(sessionDir, 'promote-receipt.json'),
  };
}

module.exports = {
  defaultSessionDir,
  initSession,
  manifestPath,
  normalizePath,
  readManifest,
  sessionPaths,
  updateManifest,
  writeManifest,
};
