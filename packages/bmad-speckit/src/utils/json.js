const fs = require('fs');

/**
 * Read and parse a JSON file. Returns null on missing file or parse error.
 * @param {string} filePath - Path to JSON file.
 * @returns {Record<string, unknown> | null} Parsed object or null.
 */
function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { readJsonSafe };
