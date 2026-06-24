/**
 * Cross-platform path utilities (ARCH §5.1).
 * Use path module, never hardcode / or \.
 */
const path = require('path');

/**
 * Resolve target path: . or --here → cwd; [project-name] → resolve(cwd, name)
 * @param {string} input - project-name, '.', or empty for --here
 * @param {string} cwd - current working directory
 * @returns {string} absolute path
 */
function resolveTargetPath(input, cwd = process.cwd()) {
  if (!input || input === '.' || input === '--here') {
    return path.resolve(cwd);
  }
  return path.resolve(cwd, input);
}

/**
 * Join path segments (cross-platform). Delegates to path.join.
 * @param {...string} segments - Path segments.
 * @returns {string} Joined path.
 */
function join(...segments) {
  return path.join(...segments);
}

module.exports = {
  resolve: path.resolve,
  join,
  resolveTargetPath,
};
