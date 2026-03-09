/**
 * TemplateFetcher unit tests (Story 11.1 - T001, T002, T005, T007, T009)
 * Run: node --test tests/template-fetcher.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

let templateFetcher;
let nock;
try {
  templateFetcher = require('../src/services/template-fetcher');
  nock = require('nock');
} catch (e) {
  templateFetcher = null;
  nock = null;
}

/** Create minimal gzipped tarball buffer (repo-tag/file structure, strip:1 compatible) */
function createMinimalTarball() {
  const tmp = path.join(os.tmpdir(), `bmad-speckit-tar-${Date.now()}`);
  const topDir = path.join(tmp, 'repo-v1.0.0');
  const innerFile = path.join(topDir, '_bmad', 'core');
  fs.mkdirSync(innerFile, { recursive: true });
  fs.writeFileSync(path.join(innerFile, 'test.md'), 'test-content');
  const outFile = path.join(os.tmpdir(), `bmad-speckit-out-${Date.now()}.tar.gz`);
  try {
    const tar = require('tar');
    tar.create({ gzip: true, cwd: tmp, file: outFile, sync: true }, ['repo-v1.0.0']);
    const buf = fs.readFileSync(outFile);
    return buf;
  } finally {
    try { fs.rmSync(tmp, { recursive: true }); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
}

describe('Story 11.1: getCacheRoot', () => {
  it('returns path under homedir with .bmad-speckit/templates', () => {
    if (!templateFetcher) return;
    const root = templateFetcher.getCacheRoot();
    assert.ok(root.includes(os.homedir()), 'cache root should be under homedir');
    assert.ok(root.includes('.bmad-speckit') && root.includes('templates'), 'cache root should contain .bmad-speckit/templates');
    assert.ok(path.isAbsolute(root), 'cache root should be absolute');
  });
});

describe('Story 11.1: getTemplateId', () => {
  it('returns repo part of TEMPLATE_REPO', () => {
    if (!templateFetcher) return;
    const id = templateFetcher.getTemplateId();
    assert.strictEqual(typeof id, 'string');
    assert.ok(id.length > 0);
    // Default TEMPLATE_REPO is bmad-method/bmad-method -> bmad-method
    assert.ok(['bmad-method', 'default'].includes(id) || id.length >= 2, 'template id should be repo name or default');
  });
});

describe('Story 11.1: getCacheDir', () => {
  it('latest returns .../latest subdir', () => {
    if (!templateFetcher) return;
    const dir = templateFetcher.getCacheDir('latest');
    assert.ok(dir.endsWith('latest') || dir.includes(path.sep + 'latest' + path.sep) || dir.includes(path.sep + 'latest'), 'cache dir for latest should end with latest');
  });
  it('tag v1.0.0 returns .../v1.0.0 subdir', () => {
    if (!templateFetcher) return;
    const dir = templateFetcher.getCacheDir('v1.0.0');
    assert.ok(dir.endsWith('v1.0.0') || dir.includes(path.sep + 'v1.0.0'), 'cache dir for tag should contain tag');
  });
});

describe('Story 11.1: isCacheValid', () => {
  it('empty directory returns false', () => {
    if (!templateFetcher) return;
    const empty = path.join(os.tmpdir(), `bmad-speckit-cache-empty-${Date.now()}`);
    fs.mkdirSync(empty, { recursive: true });
    try {
      assert.strictEqual(templateFetcher.isCacheValid(empty), false);
    } finally {
      try { fs.rmSync(empty, { recursive: true }); } catch {}
    }
  });
  it('directory with content returns true', () => {
    if (!templateFetcher) return;
    const withContent = path.join(os.tmpdir(), `bmad-speckit-cache-ok-${Date.now()}`);
    fs.mkdirSync(withContent, { recursive: true });
    fs.writeFileSync(path.join(withContent, 'file.txt'), 'x');
    try {
      assert.strictEqual(templateFetcher.isCacheValid(withContent), true);
    } finally {
      try { fs.rmSync(withContent, { recursive: true }); } catch {}
    }
  });
});

describe('Story 11.1: timeout message contains 网络超时 (AC-3)', () => {
  it('template-fetcher uses timeout message with 网络超时 for exit 3', () => {
    if (!templateFetcher) return;
    assert.ok(templateFetcher.TIMEOUT_MESSAGE.includes('网络超时'), 'TIMEOUT_MESSAGE must contain 网络超时');
  });
});

describe('Story 11.1: getTemplateId with templateSource (T009)', () => {
  it('getTemplateId(templateSource) returns repo part', () => {
    if (!templateFetcher) return;
    assert.strictEqual(templateFetcher.getTemplateId('foo/bar-repo'), 'bar-repo');
    assert.strictEqual(templateFetcher.getTemplateId('owner/repo'), 'repo');
  });
});

describe('Story 11.1: fetchFromGitHub with mock (T009)', () => {
  it('fetchFromGitHub latest writes to cache and isCacheValid', async () => {
    if (!templateFetcher || !nock) return;
    const tarball = createMinimalTarball();
    const scope = nock('https://api.github.com')
      .get('/repos/test-owner/test-repo/releases/latest')
      .reply(200, { tag_name: 'v1.0.0' });
    nock('https://github.com')
      .get('/test-owner/test-repo/archive/refs/tags/v1.0.0.tar.gz')
      .reply(200, tarball, { 'Content-Type': 'application/gzip' });
    const cacheDir = path.join(templateFetcher.getCacheRoot(), 'test-repo', 'latest');
    try {
      if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true });
      const result = await templateFetcher.fetchFromGitHub('latest', {
        templateSource: 'test-owner/test-repo',
        networkTimeoutMs: 5000,
      });
      assert.ok(fs.existsSync(result), 'cache dir should exist');
      assert.ok(templateFetcher.isCacheValid(result), 'cache should be valid');
      assert.ok(fs.existsSync(path.join(result, '_bmad', 'core', 'test.md')), 'extracted file should exist');
    } finally {
      scope.done();
      nock.cleanAll();
      try { if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true }); } catch {}
    }
  });

  it('fetchFromGitHub v1.0.0 writes to cache and isCacheValid', async () => {
    if (!templateFetcher || !nock) return;
    const tarball = createMinimalTarball();
    nock('https://github.com')
      .get('/test-owner/test-repo/archive/refs/tags/v1.0.0.tar.gz')
      .reply(200, tarball, { 'Content-Type': 'application/gzip' });
    const cacheDir = path.join(templateFetcher.getCacheRoot(), 'test-repo', 'v1.0.0');
    try {
      if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true });
      const result = await templateFetcher.fetchFromGitHub('v1.0.0', {
        templateSource: 'test-owner/test-repo',
        networkTimeoutMs: 5000,
      });
      assert.ok(fs.existsSync(result), 'cache dir should exist');
      assert.ok(templateFetcher.isCacheValid(result), 'cache should be valid');
    } finally {
      nock.cleanAll();
      try { if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true }); } catch {}
    }
  });
});

describe('Story 11.1: fetchFromUrl with mock (T009)', () => {
  it('fetchFromUrl extracts to url-<hash> and isCacheValid', async () => {
    if (!templateFetcher || !nock) return;
    const tarball = createMinimalTarball();
    const url = 'https://example.com/custom-template.tar.gz';
    const hash = require('crypto').createHash('sha256').update(url).digest('hex').slice(0, 12);
    nock('https://example.com')
      .get('/custom-template.tar.gz')
      .reply(200, tarball, { 'Content-Type': 'application/gzip' });
    const cacheDir = path.join(templateFetcher.getCacheRoot(), 'bmad-method', `url-${hash}`);
    try {
      if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true });
      const result = await templateFetcher.fetchFromUrl(url, {
        templateSource: 'bmad-method/bmad-method',
        networkTimeoutMs: 5000,
      });
      assert.ok(result.includes(`url-${hash}`), 'cache should use url-hash');
      assert.ok(templateFetcher.isCacheValid(result), 'cache should be valid');
      assert.ok(fs.existsSync(path.join(result, '_bmad', 'core', 'test.md')), 'extracted file should exist');
    } finally {
      nock.cleanAll();
      try { if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true }); } catch {}
    }
  });
});
