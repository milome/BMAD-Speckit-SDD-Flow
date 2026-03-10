/**
 * UTF-8 file write with configurable EOL (Story 10.3, AC-3, plan Phase 4).
 * No hardcoded path separators; path handling is caller's responsibility.
 */
const fs = require('fs');
const _os = require('os');

/**
 * Get default EOL for current platform (LF or CRLF).
 * @returns {string} '\n' or '\r\n'
 */
function getPlatformEOL() {
  return process.platform === 'win32' ? '\r\n' : '\n';
}

/**
 * Normalize string to use a single line ending.
 * @param {string} content - file content
 * @param {string} eol - line ending to use ('\n' or '\r\n')
 * @returns {string}
 */
function normalizeEOL(content, eol) {
  if (!content || typeof content !== 'string') return content;
  const lines = content.split(/\r\n|\r|\n/);
  return lines.join(eol);
}

/**
 * Write file with UTF-8 encoding and configurable line endings.
 * @param {string} filePath - path to file (caller must use path.join etc.)
 * @param {string} content - file content
 * @param {{ encoding?: string, eol?: string }} [options] - encoding default 'utf8', eol default platform EOL
 */
function writeFileWithEncoding(filePath, content, options = {}) {
  const encoding = options.encoding || 'utf8';
  const eol = options.eol !== undefined ? options.eol : getPlatformEOL();
  const normalized = normalizeEOL(content, eol);
  fs.writeFileSync(filePath, normalized, encoding);
}

module.exports = {
  getPlatformEOL,
  normalizeEOL,
  writeFileWithEncoding,
};
