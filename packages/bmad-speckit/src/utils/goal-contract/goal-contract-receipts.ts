const fs = require('node:fs');
const path = require('node:path');
const { safeWriteJson, sha256File } = require('../large-document-writer');

function defaultReceiptPaths(outPath) {
  const resolved = path.resolve(outPath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, path.extname(resolved));
  return {
    coverageReceiptPath: path.join(dir, `.${base}.coverage.json`),
    generationReceiptPath: path.join(dir, `.${base}.generation.json`),
  };
}

function writeCoverageReceipt(filePath, receipt) {
  safeWriteJson(filePath, receipt, { mode: 'upsert' });
  return filePath;
}

function writeGenerationReceipt(filePath, receipt) {
  safeWriteJson(filePath, receipt, { mode: 'upsert' });
  return filePath;
}

function fileHashIfExists(filePath) {
  return fs.existsSync(filePath) ? sha256File(filePath) : null;
}

module.exports = {
  defaultReceiptPaths,
  fileHashIfExists,
  writeCoverageReceipt,
  writeGenerationReceipt,
};
