const fs = require('node:fs');
const sourceSuffix = __filename.endsWith('.ts') ? '.ts' : '';
const { block } = require(`./errors${sourceSuffix}`);
const { readManifest, sessionPaths } = require(`./draft-session${sourceSuffix}`);
const { readChunkWithReceipt } = require(`./chunk-store${sourceSuffix}`);
const { sha256Text, writeJsonReceipt } = require(`./receipts${sourceSuffix}`);

function assembleSession({ sessionDir }) {
  const manifest = readManifest(sessionDir);
  const paths = sessionPaths(sessionDir);
  const parts = [];
  const chunkReceipts = [];
  for (const entry of manifest.chunkPlan) {
    const { text, receipt } = readChunkWithReceipt(sessionDir, entry);
    parts.push(text.trimEnd());
    chunkReceipts.push(receipt);
  }
  const assembledText = `${parts.join('\n\n')}\n`;
  fs.writeFileSync(paths.assembledPath, assembledText, 'utf8');
  const receipt = {
    schemaVersion: 'large-document-writer-assembly-receipt/v1',
    outputPath: paths.assembledPath,
    assemblyHash: sha256Text(assembledText),
    chunkReceipts: chunkReceipts.map((item) => ({
      chunkId: item.chunkId,
      chunkHash: item.chunkHash,
    })),
    assembledAt: new Date().toISOString(),
  };
  writeJsonReceipt(paths.assemblyReceiptPath, receipt);
  return receipt;
}

function readValidationReceipt(sessionDir) {
  const paths = sessionPaths(sessionDir);
  if (!fs.existsSync(paths.validationReceiptPath)) {
    block('ASSEMBLY_VALIDATION_FAILED', { missingValidation: paths.validationReceiptPath });
  }
  const receipt = JSON.parse(fs.readFileSync(paths.validationReceiptPath, 'utf8'));
  if (!receipt.ok) block('ASSEMBLY_VALIDATION_FAILED', { issues: receipt.issues });
  return receipt;
}

module.exports = {
  assembleSession,
  readValidationReceipt,
};
