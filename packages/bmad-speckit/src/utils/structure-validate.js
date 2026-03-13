/**
 * Structure validation for _bmad root (PRD §5.5, Story 10.5)
 * Validates rootPath has at least two of: core/, cursor/, speckit/, skills/;
 * if cursor/ exists, it must contain commands/ and rules/.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_TOP_LEVEL = ['core', 'cursor', 'speckit', 'skills'];
const CURSOR_REQUIRED = ['commands', 'rules'];

/**
 * Validate _bmad root structure: at least two of core/cursor/speckit/skills; cursor must have commands/ and rules/.
 * @param {string} rootPath - Path to _bmad root (or shared bmad directory).
 * @returns {{ valid: boolean, missing: string[] }} Validation result; missing lists absent paths.
 */
function validateBmadStructure(rootPath) {
  const missing = [];

  if (!rootPath || typeof rootPath !== 'string') {
    return { valid: false, missing: ['path is required'] };
  }

  const resolved = path.resolve(rootPath);
  if (!fs.existsSync(resolved)) {
    return { valid: false, missing: ['path does not exist'] };
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return { valid: false, missing: ['path is not a directory'] };
  }

  const present = REQUIRED_TOP_LEVEL.filter((name) => {
    const p = path.join(resolved, name);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });
  if (present.length < 2) {
    const absent = REQUIRED_TOP_LEVEL.filter((n) => !present.includes(n));
    missing.push(`need at least two of [${REQUIRED_TOP_LEVEL.join(', ')}]; missing: ${absent.join(', ')}`);
  }

  const hasCursor = present.includes('cursor');
  if (hasCursor) {
    const cursorPath = path.join(resolved, 'cursor');
    for (const sub of CURSOR_REQUIRED) {
      const subPath = path.join(cursorPath, sub);
      if (!fs.existsSync(subPath) || !fs.statSync(subPath).isDirectory()) {
        missing.push(`cursor/${sub} missing`);
      }
    }
  }

  const valid = missing.length === 0;
  return { valid, missing };
}

module.exports = { validateBmadStructure };
