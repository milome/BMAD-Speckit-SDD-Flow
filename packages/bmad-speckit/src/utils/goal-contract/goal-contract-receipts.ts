const fs = require('node:fs');
const path = require('node:path');
const { safeWriteJson, sha256File } = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/index.ts'
    : '../large-document-writer'
);

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...details });
  return error;
}

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
  if (
    receipt?.evidenceTerminalState === 'FINAL_PASS' &&
    receipt?.evidenceClosure?.decision !== 'pass'
  ) {
    throw failure('generation_receipt_final_pass_unproven');
  }
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
