/**
 * TemplateFetcher - minimal implementation (GAP-4.1, plan §3.1)
 * Story 11.1: cache to ~/.bmad-speckit/templates/<template-id>/<tag>/, --template tag|url, networkTimeoutMs.
 * templateSource: opts.templateSource || env SDD_TEMPLATE_REPO || 'bmad-method/bmad-method'
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { createGunzip } = require('zlib');

const DEFAULT_TEMPLATE_REPO = 'bmad-method/bmad-method';
const DEFAULT_NETWORK_TIMEOUT_MS = 30000;

function _resolveNetworkTimeoutMs(opts) {
  if (opts?.networkTimeoutMs != null && opts.networkTimeoutMs > 0) return opts.networkTimeoutMs;
  const { resolveNetworkTimeoutMs } = require('../utils/network-timeout');
  return resolveNetworkTimeoutMs({ cwd: opts?.cwd ?? process.cwd() });
}

/**
 * Get cache root for templates (~/.bmad-speckit/templates).
 * @returns {string} Absolute path to template cache root.
 */
function getCacheRoot() {
  return path.join(os.homedir(), '.bmad-speckit', 'templates');
}

function _getTemplateSource(opts) {
  return opts?.templateSource || process.env.SDD_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO;
}

/**
 * Extract template id (repo name) from templateSource (owner/repo).
 * @param {string} [templateSource] - e.g. 'bmad-method/bmad-method'; falls back to env or default.
 * @returns {string} Repo name or 'default'.
 */
function getTemplateId(templateSource) {
  const src = templateSource || process.env.SDD_TEMPLATE_REPO || DEFAULT_TEMPLATE_REPO;
  const parts = src.split('/');
  return parts.length > 1 ? parts[1] : 'default';
}

/**
 * Get cache subdirectory for a tag and template source.
 * @param {string} [tag] - Tag (e.g. 'latest', 'v1.0.0').
 * @param {string} [templateSource] - Template source (owner/repo).
 * @returns {string} Path to cache dir (getCacheRoot/templateId/subdir).
 */
function getCacheDir(tag, templateSource) {
  const subdir = tag === 'latest' ? 'latest' : tag;
  const tid = templateSource != null ? getTemplateId(templateSource) : getTemplateId();
  return path.join(getCacheRoot(), tid, subdir);
}

/**
 * Check if cache dir exists and contains at least one entry.
 * @param {string} cacheDir - Path to cache directory.
 * @returns {boolean} True if cache exists and is non-empty.
 */
function isCacheValid(cacheDir) {
  if (!fs.existsSync(cacheDir) || !fs.statSync(cacheDir).isDirectory()) return false;
  const entries = fs.readdirSync(cacheDir);
  return entries.length > 0;
}

/**
 * Check for local _bmad in monorepo (packages/bmad-speckit/src/services -> repo root).
 * Returns repo root path (parent of _bmad) so generateSkeleton finds _bmad and _bmad-output.
 * Returns null if BMAD_TEST_OFFLINE_ONLY=1 or _bmad not found.
 * @returns {string | null} Repo root path or null.
 */
function getLocalTemplatePath() {
  if (process.env.BMAD_TEST_OFFLINE_ONLY === '1') return null;
  const repoRoot = path.join(__dirname, '../../../..');
  const bmadPath = path.join(repoRoot, '_bmad');
  if (fs.existsSync(bmadPath) && fs.statSync(bmadPath).isDirectory()) {
    const entries = fs.readdirSync(bmadPath);
    if (entries.length > 0) return repoRoot;
  }
  return null;
}

/**
 * Fetch tarball from GitHub, extract to cache dir, return path.
 * Reuses cache if valid. On failure: throw with err.code 'NETWORK_TEMPLATE'.
 * @param {string} [tag] - Tag (e.g. 'latest', 'v1.0.0'); 'latest' fetches via GitHub API.
 * @param {{ templateSource?: string, networkTimeoutMs?: number, githubToken?: string, skipTls?: boolean, cwd?: string, debug?: boolean }} [opts] - Options.
 * @returns {Promise<string>} Path to extracted template dir.
 * @throws {Error} With code NETWORK_TEMPLATE on fetch failure.
 */
async function fetchFromGitHub(tag, opts = {}) {
  const { githubToken, skipTls, debug } = opts;
  const templateSource = _getTemplateSource(opts);
  const timeoutMs = _resolveNetworkTimeoutMs(opts);
  if (skipTls) {
    console.warn('Warning: --skip-tls skips SSL/TLS verification. Use only in trusted networks.');
  }

  const cacheDir = getCacheDir(tag, templateSource);
  if (isCacheValid(cacheDir)) {
    if (debug) console.error('[bmad-speckit:debug] Using cache:', cacheDir);
    return cacheDir;
  }

  const [owner, repo] = templateSource.split('/');
  let tagToUse = tag;
  if (tag === 'latest') {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const headers = { 'User-Agent': 'bmad-speckit' };
    if (githubToken) headers.Authorization = `token ${githubToken}`;

    const latest = await fetchJson(apiUrl, { headers, skipTls, timeout: timeoutMs });
    if (!latest || !latest.tag_name) {
      const e = new Error('Failed to get latest release from GitHub. Check network or use --github-token.');
      e.code = 'NETWORK_TEMPLATE';
      throw e;
    }
    tagToUse = latest.tag_name;
    if (debug) console.error('[bmad-speckit:debug] latest tag:', tagToUse);
  }

  const tarballUrl = `https://github.com/${owner}/${repo}/archive/refs/tags/${tagToUse}.tar.gz`;
  fs.mkdirSync(cacheDir, { recursive: true });

  try {
    await downloadAndExtract(tarballUrl, cacheDir, { githubToken, skipTls, timeout: timeoutMs });
    return cacheDir;
  } catch (err) {
    if (fs.existsSync(cacheDir)) {
      try {
        fs.rmSync(cacheDir, { recursive: true });
      } catch {}
    }
    const e = new Error(`Template fetch failed: ${err.message}. Use --offline with cached template (Story 11.2).`);
    e.code = 'NETWORK_TEMPLATE';
    throw e;
  }
}

const TIMEOUT_MESSAGE = '网络超时 (Network timeout)';

function fetchJson(url, opts) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout ?? DEFAULT_NETWORK_TIMEOUT_MS;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: !opts.skipTls }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          const e = new Error('Invalid JSON response');
          e.code = 'NETWORK_TEMPLATE';
          reject(e);
        }
      });
    });
    req.on('error', (err) => {
      const e = new Error(err.message);
      e.code = 'NETWORK_TEMPLATE';
      reject(e);
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      const e = new Error(TIMEOUT_MESSAGE);
      e.code = 'NETWORK_TEMPLATE';
      reject(e);
    });
  });
}

function downloadAndExtract(url, destDir, opts) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout ?? DEFAULT_NETWORK_TIMEOUT_MS;
    const headers = { 'User-Agent': 'bmad-speckit' };
    if (opts.githubToken) headers.Authorization = `token ${opts.githubToken}`;

    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: !opts.skipTls, headers }, (res) => {
      if (res.statusCode !== 200) {
        const e = new Error(`模板拉取失败: HTTP ${res.statusCode}`);
        e.code = 'NETWORK_TEMPLATE';
        reject(e);
        return;
      }
      const tar = require('tar');
      const gunzip = createGunzip();
      const extractStream = tar.extract({ cwd: destDir, strip: 1 });
      gunzip.on('error', (err) => {
        const e = new Error(`模板解压失败: ${err.message}`);
        e.code = 'NETWORK_TEMPLATE';
        reject(e);
      });
      extractStream.on('error', (err) => {
        const e = new Error(`模板解压失败: ${err.message}`);
        e.code = 'NETWORK_TEMPLATE';
        reject(e);
      });
      res.pipe(gunzip).pipe(extractStream)
        .on('finish', resolve);
    });
    req.on('error', (err) => {
      const e = new Error(err.message);
      e.code = 'NETWORK_TEMPLATE';
      reject(e);
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      const e = new Error(TIMEOUT_MESSAGE);
      e.code = 'NETWORK_TEMPLATE';
      reject(e);
    });
  });
}

/**
 * Story 11.2: Resolve cache dir for offline mode (tag or url).
 * For URL: compute url-<hash> like fetchFromUrl.
 * @param {string} [templateSpec] - Tag or URL.
 * @param {{ templateSource?: string }} [opts] - Template source for tid.
 * @returns {string} Path to cache dir.
 */
function getOfflineCacheDir(templateSpec, opts) {
  const trimmed = String(templateSpec || 'latest').trim();
  const templateSource = _getTemplateSource(opts);
  const tid = getTemplateId(templateSource);
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 12);
    return path.join(getCacheRoot(), tid, `url-${hash}`);
  }
  const tag = trimmed || 'latest';
  return getCacheDir(tag, templateSource);
}

/**
 * Main export: fetch template, return path to template dir.
 * templateSpec: 'latest' | tag (e.g. 'v1.0.0') | url (https://...).
 * Story 11.2: opts.offline - when true, use only cache, no network; cache missing → throw OFFLINE_CACHE_MISSING.
 * @param {string} [templateSpec] - 'latest', tag, or tarball URL.
 * @param {{ offline?: boolean, templateSource?: string, networkTimeoutMs?: number, cwd?: string, debug?: boolean, _noLocalForTest?: boolean }} [opts] - Options.
 * @returns {Promise<string>} Path to template directory.
 * @throws {Error} With code OFFLINE_CACHE_MISSING or NETWORK_TEMPLATE.
 */
async function fetchTemplate(templateSpec, opts = {}) {
  if (!opts._noLocalForTest) {
    const local = getLocalTemplatePath();
    if (local) {
      if (opts.debug) console.error('[bmad-speckit:debug] Using local _bmad:', local);
      return local;
    }
  }
  const trimmed = String(templateSpec || 'latest').trim();

  if (opts.offline) {
    const cacheDir = getOfflineCacheDir(trimmed, opts);
    if (isCacheValid(cacheDir)) {
      if (opts.debug) console.error('[bmad-speckit:debug] Offline: using cache:', cacheDir);
      return cacheDir;
    }
    const err = new Error('离线模式下模板 cache 缺失 (Offline mode: template cache missing)');
    err.code = 'OFFLINE_CACHE_MISSING';
    throw err;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return fetchFromUrl(trimmed, opts);
  }
  return fetchFromGitHub(trimmed, opts);
}

/**
 * Fetch tarball from custom URL, extract to cache url-<hash>, return path.
 * @param {string} url - Tarball URL (http or https).
 * @param {{ templateSource?: string, networkTimeoutMs?: number, cwd?: string, skipTls?: boolean }} [opts] - Options.
 * @returns {Promise<string>} Path to extracted template dir.
 * @throws {Error} On fetch or extract failure.
 */
async function fetchFromUrl(url, opts = {}) {
  const templateSource = _getTemplateSource(opts);
  const timeoutMs = _resolveNetworkTimeoutMs(opts);
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
  const tid = getTemplateId(templateSource);
  const cacheDir = path.join(getCacheRoot(), tid, `url-${hash}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  try {
    await downloadAndExtract(url, cacheDir, { timeout: timeoutMs, skipTls: opts.skipTls });
    return cacheDir;
  } catch (err) {
    if (fs.existsSync(cacheDir)) {
      try { fs.rmSync(cacheDir, { recursive: true }); } catch {}
    }
    if (!err.code) {
      err.code = 'NETWORK_TEMPLATE';
    }
    throw err;
  }
}

module.exports = {
  fetchTemplate,
  fetchFromGitHub,
  fetchFromUrl,
  getLocalTemplatePath,
  getCacheRoot,
  getTemplateId,
  getCacheDir,
  getOfflineCacheDir,
  isCacheValid,
  TIMEOUT_MESSAGE,
  DEFAULT_NETWORK_TIMEOUT_MS,
};
