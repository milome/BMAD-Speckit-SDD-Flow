const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(String(text), 'utf8').digest('hex')}`;
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function writeJsonReceipt(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stableStringify(value), 'utf8');
  return value;
}

module.exports = {
  normalizePath,
  sha256Buffer,
  sha256File,
  sha256Text,
  stableStringify,
  writeJsonReceipt,
};
