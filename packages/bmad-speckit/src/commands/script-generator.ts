/**
 * Story 10.3: Cross-platform script generation (AC-1, AC-2, AC-3).
 * Paths built with path module only; UTF-8 + EOL via file-encoding.
 */
const path = require('path');
const fs = require('fs');
const { writeFileWithEncoding, getPlatformEOL } = require('../utils/file-encoding');

const SCRIPT_DIR_REL = path.join('_bmad', 'speckit', 'scripts');
const SH_FILENAME = 'bmad-speckit.sh';
const PS_FILENAME = 'bmad-speckit.ps1';

/**
 * Path from script subdir to project root (for embedding in scripts).
 * Script lives at finalPath/_bmad/speckit/scripts/ so root is ../../..
 * @returns {string} Relative path with forward slashes (e.g. '../../../').
 */
function getRelToRootForSh() {
  const rel = path.join('..', '..', '..');
  return rel.replace(/\\/g, '/');
}

/**
 * Generate POSIX shell script content. All path logic uses path module; we embed the result.
 * @param {string} [_finalPath] - Project root; unused, path is from getRelToRootForSh.
 * @returns {string} Shell script content with platform EOL.
 */
function buildShContent(_finalPath) {
  const relToRoot = getRelToRootForSh();
  const eol = getPlatformEOL();
  const lines = [
    '#!/usr/bin/env sh',
    'set -e',
    `SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"`,
    `ROOT="$(cd "$SCRIPT_DIR/${relToRoot}" && pwd)"`,
    'exec node "$ROOT/node_modules/.bin/bmad-speckit" "$@"',
    '',
  ];
  return lines.join(eol);
}

/**
 * Generate PowerShell script content. Paths via path module; PowerShell accepts backslashes.
 * @param {string} [_finalPath] - Project root; used for path.join for relToRoot.
 * @returns {string} PowerShell script content with platform EOL.
 */
function buildPsContent(_finalPath) {
  const relToRoot = path.join('..', '..', '..');
  const binRel = path.join('node_modules', '.bin', 'bmad-speckit');
  const eol = getPlatformEOL();
  const lines = [
    '# PowerShell wrapper for bmad-speckit (Story 10.3)',
    '$ErrorActionPreference = "Stop"',
    '$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path',
    `$Root = Resolve-Path (Join-Path $ScriptDir "${relToRoot}")`,
    `& node (Join-Path $Root "${binRel}") @args`,
    '',
  ];
  return lines.join(eol);
}

/**
 * Ensure directory exists and write script file.
 * Creates _bmad/speckit/scripts/ and bmad-speckit.sh or bmad-speckit.ps1.
 * @param {string} finalPath - Project root.
 * @param {'sh'|'ps'} scriptType - Script type to generate.
 * @returns {void}
 */
function generateScript(finalPath, scriptType) {
  const scriptDir = path.join(finalPath, SCRIPT_DIR_REL);
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  if (scriptType === 'sh') {
    const filePath = path.join(scriptDir, SH_FILENAME);
    writeFileWithEncoding(filePath, buildShContent(finalPath), { encoding: 'utf8', eol: getPlatformEOL() });
  } else if (scriptType === 'ps') {
    const filePath = path.join(scriptDir, PS_FILENAME);
    writeFileWithEncoding(filePath, buildPsContent(finalPath), { encoding: 'utf8', eol: getPlatformEOL() });
  }
}

module.exports = {
  generateScript,
  SCRIPT_DIR_REL,
  SH_FILENAME,
  PS_FILENAME,
};
