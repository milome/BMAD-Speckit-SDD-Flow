/**
 * UpgradeCommand - upgrade subcommand (Story 13.3, ARCH §3.2)
 * Upgrade template version in initialized project.
 * - Un-init dir => exit 1 with "未 init" message
 * - --dry-run: fetch and output version info, no file writes
 * - --template <tag>: target version (latest, v1.0.0)
 * - --offline: use only local cache
 */
const fs = require('fs');
const path = require('path');
const exitCodes = require('../constants/exit-codes');
const { getProjectConfigPath, set } = require('../services/config-manager');
const { resolveNetworkTimeoutMs } = require('../utils/network-timeout');
const templateFetcher = require('../services/template-fetcher');
const { generateSkeleton } = require('./init-skeleton');

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

/**
 * Extract version from template dir package.json or _bmad/package.json.
 * @param {string} templateDir - Path to template directory.
 * @returns {string | null} Version string or null if not found.
 */
function getVersionFromTemplateDir(templateDir) {
  const pkgPath = path.join(templateDir, 'package.json');
  const pkg = readJsonSafe(pkgPath);
  if (pkg?.version) return pkg.version;
  const bmadPkg = readJsonSafe(path.join(templateDir, '_bmad', 'package.json'));
  if (bmadPkg?.version) return bmadPkg.version;
  return null;
}

/**
 * Upgrade template version. Fetches template, updates config or regenerates skeleton.
 * Un-init dir => exit 1. --dry-run: no writes. --offline: local cache only.
 * @param {string} [cwd] - Working directory.
 * @param {{ dryRun?: boolean, template?: string, offline?: boolean }} [options] - dryRun, template tag, offline mode.
 * @returns {Promise<void>} Does not resolve; process.exit on completion.
 */
async function upgradeCommandAsync(cwd, options = {}) {
  const resolvedCwd = cwd != null ? cwd : process.cwd();
  const dryRun = Boolean(options.dryRun);
  const template = options.template || 'latest';
  const offline = Boolean(options.offline);

  const configPath = getProjectConfigPath(resolvedCwd);
  if (!fs.existsSync(configPath)) {
    console.error('Error: 项目未 init，请先执行 bmad-speckit init (Project not initialized, run bmad-speckit init first)');
    process.exit(exitCodes.GENERAL_ERROR);
  }

  const config = readJsonSafe(configPath) || {};
  const currentVersion = config.templateVersion || 'unknown';
  const networkTimeoutMs = resolveNetworkTimeoutMs({ cwd: resolvedCwd });
  const templateSource = process.env.SDD_TEMPLATE_REPO || 'bmad-method/bmad-method';

  const fetchOpts = {
    networkTimeoutMs,
    templateSource,
    offline,
    cwd: resolvedCwd,
  };

  const runFetch = async () => {
    const templateDir = await templateFetcher.fetchTemplate(template, fetchOpts);
    const resolvedVersion = getVersionFromTemplateDir(templateDir) || template;
    return { templateDir, resolvedVersion };
  };

  if (dryRun) {
    try {
      const { resolvedVersion } = await runFetch();
      console.log(`Current template version: ${currentVersion}`);
      console.log(`Target version: ${resolvedVersion} (dry-run - no changes)`);
      process.exit(exitCodes.SUCCESS);
    } catch (err) {
      if (err.code === 'OFFLINE_CACHE_MISSING') {
        console.error('Error:', err.message);
        process.exit(exitCodes.OFFLINE_CACHE_MISSING);
      }
      if (err.code === 'NETWORK_TEMPLATE') {
        console.error('Error:', err.message, '- 建议 --offline 或检查网络');
        process.exit(exitCodes.NETWORK_TEMPLATE_FAILED);
      }
      console.error('Error:', err.message);
      process.exit(exitCodes.GENERAL_ERROR);
    }
  }

  try {
    const { templateDir, resolvedVersion } = await runFetch();
    const bmadPath = config.bmadPath;

    if (bmadPath != null && typeof bmadPath === 'string') {
      // T3.4: worktree mode - only update templateVersion
      set('templateVersion', resolvedVersion, { scope: 'project', cwd: resolvedCwd });
    } else {
      // T3.3: no bmadPath - generateSkeleton + update templateVersion
      const modules = Array.isArray(config.modules) ? config.modules : null;
      await generateSkeleton(resolvedCwd, templateDir, modules, true);
      set('templateVersion', resolvedVersion, { scope: 'project', cwd: resolvedCwd });
    }
    console.log('Upgrade complete. Template version:', resolvedVersion);
    process.exit(exitCodes.SUCCESS);
  } catch (err) {
    if (err.code === 'OFFLINE_CACHE_MISSING') {
      console.error('Error:', err.message);
      process.exit(exitCodes.OFFLINE_CACHE_MISSING);
    }
    if (err.code === 'NETWORK_TEMPLATE') {
      console.error('Error:', err.message, '- 建议 --offline 或检查网络');
      process.exit(exitCodes.NETWORK_TEMPLATE_FAILED);
    }
    console.error('Error:', err.message);
    process.exit(exitCodes.GENERAL_ERROR);
  }
}

/**
 * Upgrade command entry. Wraps upgradeCommandAsync and exits on error.
 * @param {string} [cwd] - Working directory.
 * @param {{ dryRun?: boolean, template?: string, offline?: boolean }} [options] - Command options.
 * @returns {void} Does not return; process.exit on completion.
 */
function upgradeCommand(cwd, options = {}) {
  upgradeCommandAsync(cwd, options).catch((err) => {
    console.error('Error:', err?.message || err);
    process.exit(exitCodes.GENERAL_ERROR);
  });
}

module.exports = { upgradeCommand };
