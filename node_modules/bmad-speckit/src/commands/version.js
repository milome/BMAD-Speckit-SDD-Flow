/**
 * VersionCommand - version subcommand (Story 13.1, AC3)
 * Outputs cliVersion, templateVersion, nodeVersion; supports --json.
 */
const path = require('path');
const fs = require('fs');

const pkg = require('../../package.json');

/**
 * Resolve path to project bmad-speckit config file.
 * @param {string} [cwd] - Working directory; defaults to process.cwd().
 * @returns {string} Absolute path to _bmad-output/config/bmad-speckit.json.
 */
function getProjectConfigPath(cwd) {
  return path.join(cwd || process.cwd(), '_bmad-output', 'config', 'bmad-speckit.json');
}

/**
 * Get templateVersion from bmad-speckit.json or bmadPath package.json.
 * Falls back to bmadPath/_bmad package.json if bmadPath is set.
 * @param {string} [cwd] - Working directory for config lookup.
 * @returns {string | null} Template version string, or null if not found.
 */
function getTemplateVersion(cwd) {
  const configPath = getProjectConfigPath(cwd);
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj.templateVersion === 'string') return obj.templateVersion;
    if (obj && obj.bmadPath) {
      const bmadRoot = path.resolve(cwd || process.cwd(), obj.bmadPath);
      const pkgPath = path.join(bmadRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return p?.version || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * VersionCommand handler. Outputs cliVersion, templateVersion, nodeVersion.
 * @param {{ cwd?: string, json?: boolean }} [options] - cwd for config; json for JSON output.
 * @returns {{ cliVersion: string, templateVersion: string|null, nodeVersion: string }} Version info (also printed to stdout).
 */
function versionCommand(options = {}) {
  const cwd = options.cwd != null ? options.cwd : process.cwd();
  const cliVersion = pkg.version || '0.0.0';
  const templateVersion = getTemplateVersion(cwd);
  const nodeVersion = process.version;

  const result = {
    cliVersion,
    templateVersion: templateVersion || null,
    nodeVersion,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 0));
  } else {
    console.log('CLI version:', cliVersion);
    console.log('Template version:', result.templateVersion || 'unknown');
    console.log('Node version:', nodeVersion);
  }

  return result;
}

module.exports = { versionCommand, getTemplateVersion };
