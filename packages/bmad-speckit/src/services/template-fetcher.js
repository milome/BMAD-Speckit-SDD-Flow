/**
 * TemplateFetcher - minimal implementation (GAP-4.1, plan §3.1)
 * Fetches template from GitHub Release or uses local _bmad when in monorepo.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createGunzip } = require('zlib');
const { mkdirSync, readdirSync } = require('fs');
const exitCodes = require('../constants/exit-codes');

const TEMPLATE_REPO = process.env.SDD_TEMPLATE_REPO || 'bmad-method/bmad-method';
const NETWORK_TIMEOUT_MS = parseInt(process.env.SDD_NETWORK_TIMEOUT_MS || '30000', 10);

/**
 * Check for local _bmad in monorepo (packages/bmad-speckit/src/services -> repo root)
 * Returns repo root path (parent of _bmad) so generateSkeleton finds _bmad and _bmad-output
 */
function getLocalTemplatePath() {
  const repoRoot = path.join(__dirname, '../../../..');
  const bmadPath = path.join(repoRoot, '_bmad');
  if (fs.existsSync(bmadPath) && fs.statSync(bmadPath).isDirectory()) {
    const entries = readdirSync(bmadPath);
    if (entries.length > 0) return repoRoot;
  }
  return null;
}

/**
 * Fetch tarball from GitHub, extract to temp dir, return path.
 * On failure: throw with message (caller exits 3).
 */
async function fetchFromGitHub(tag, opts = {}) {
  const { githubToken, skipTls, debug } = opts;
  if (skipTls) {
    console.warn('Warning: --skip-tls skips SSL/TLS verification. Use only in trusted networks.');
  }

  const [owner, repo] = TEMPLATE_REPO.split('/');
  let tagToUse = tag;
  if (tag === 'latest') {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const headers = { 'User-Agent': 'bmad-speckit' };
    if (githubToken) headers.Authorization = `token ${githubToken}`;

    const latest = await fetchJson(apiUrl, { headers, skipTls, timeout: NETWORK_TIMEOUT_MS });
    if (!latest || !latest.tag_name) {
      throw new Error('Failed to get latest release from GitHub. Check network or use --github-token.');
    }
    tagToUse = latest.tag_name;
    if (debug) console.error('[bmad-speckit:debug] latest tag:', tagToUse);
  }

  const tarballUrl = `https://github.com/${owner}/${repo}/archive/refs/tags/${tagToUse}.tar.gz`;
  const tmpDir = path.join(require('os').tmpdir(), `bmad-speckit-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    await downloadAndExtract(tarballUrl, tmpDir, { githubToken, skipTls, timeout: NETWORK_TIMEOUT_MS });
    const entries = fs.readdirSync(tmpDir);
    const extracted = entries.find((e) => fs.statSync(path.join(tmpDir, e)).isDirectory());
    const templateDir = extracted ? path.join(tmpDir, extracted) : tmpDir;
    return templateDir;
  } catch (err) {
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    }
    throw new Error(`Template fetch failed: ${err.message}. Use --offline with cached template (Story 11.1).`);
  }
}

function fetchJson(url, opts) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: !opts.skipTls }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(opts.timeout || NETWORK_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Network timeout'));
    });
  });
}

function downloadAndExtract(url, destDir, opts) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'bmad-speckit' };
    if (opts.githubToken) headers.Authorization = `token ${opts.githubToken}`;

    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: !opts.skipTls, headers }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      const tar = require('tar');
      const gunzip = createGunzip();
      res.pipe(gunzip).pipe(tar.extract({ cwd: destDir, strip: 1 }))
        .on('finish', resolve)
        .on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(opts.timeout || NETWORK_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Network timeout'));
    });
  });
}

/**
 * Main export: fetch template, return path to template dir
 */
async function fetchTemplate(tag, opts = {}) {
  const local = getLocalTemplatePath();
  if (local) {
    if (opts.debug) console.error('[bmad-speckit:debug] Using local _bmad:', local);
    return local;
  }
  return fetchFromGitHub(tag, opts);
}

module.exports = {
  fetchTemplate,
  getLocalTemplatePath,
};
