const fs = require('node:fs');
const { block } = require('./errors');
const { readManifest, sessionPaths } = require('./draft-session');
const { sha256Text, writeJsonReceipt } = require('./receipts');

function findUnbalancedFence(text) {
  const matches = text.match(/^```/gm);
  return Boolean(matches && matches.length % 2 !== 0);
}

function validateText(text, manifest) {
  const issues = [];
  for (const heading of manifest.requiredHeadings || []) {
    if (!text.includes(heading)) issues.push({ code: 'MISSING_REQUIRED_HEADING', value: heading });
  }
  for (const fragment of manifest.requiredFragments || []) {
    if (!text.includes(fragment)) issues.push({ code: 'MISSING_REQUIRED_FRAGMENT', value: fragment });
  }
  for (const fragment of manifest.forbiddenFragments || []) {
    if (text.includes(fragment)) issues.push({ code: 'FORBIDDEN_FRAGMENT', value: fragment });
  }
  if (manifest.allowPlaceholders === false && /{{[^}]+}}/.test(text)) {
    issues.push({ code: 'DISALLOWED_PLACEHOLDER' });
  }
  if (Buffer.byteLength(text, 'utf8') < (manifest.minBytes || 0)) issues.push({ code: 'MIN_BYTES' });
  if (text.split(/\r?\n/u).length < (manifest.minLines || 0)) issues.push({ code: 'MIN_LINES' });
  if (manifest.profile === 'markdown' && findUnbalancedFence(text)) {
    issues.push({ code: 'UNBALANCED_MARKDOWN_FENCE' });
  }
  return issues;
}

function validateAssembly({ sessionDir, assemblyPath } = {}) {
  const manifest = readManifest(sessionDir);
  const paths = sessionPaths(sessionDir);
  const target = assemblyPath || paths.assembledPath;
  if (!fs.existsSync(target)) block('ASSEMBLY_VALIDATION_FAILED', { missingAssembly: target });
  const text = fs.readFileSync(target, 'utf8');
  const issues = validateText(text, manifest);
  const receipt = {
    schemaVersion: 'large-document-writer-validation-receipt/v1',
    ok: issues.length === 0,
    assemblyPath: target,
    assemblyHash: sha256Text(text),
    issues,
    validatedAt: new Date().toISOString(),
  };
  writeJsonReceipt(paths.validationReceiptPath, receipt);
  if (issues.length) block('ASSEMBLY_VALIDATION_FAILED', { issues });
  return receipt;
}

module.exports = {
  validateAssembly,
  validateText,
};
