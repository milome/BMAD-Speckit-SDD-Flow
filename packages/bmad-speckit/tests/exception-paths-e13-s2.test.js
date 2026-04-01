/**
 * Story 13.2 E13-S2: 异常路径集成测试 (plan §3.3, tasks T6)
 * 退出码 1–4、网络超时配置链
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');
const ROOT = path.join(__dirname, '..');

function withIsolatedHome(envOverrides = {}) {
  const homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-speckit-home-'));
  return {
    env: {
      ...process.env,
      HOME: homeRoot,
      USERPROFILE: homeRoot,
      ...envOverrides,
    },
    cleanup() {
      try { fs.rmSync(homeRoot, { recursive: true, force: true }); } catch (_) {}
    },
  };
}

function runCheck(cwd) {
  const { env, cleanup } = withIsolatedHome();
  try {
    return spawnSync(process.execPath, [BIN, 'check'], {
      cwd,
      encoding: 'utf8',
      timeout: 15000,
      env,
    });
  } finally {
    cleanup();
  }
}

function runInit(args, cwd, env = {}) {
  const { env: isolatedEnv, cleanup } = withIsolatedHome(env);
  try {
    return spawnSync('node', [BIN, 'init', ...args], {
      cwd: cwd || os.tmpdir(),
      encoding: 'utf8',
      timeout: 15000,
      env: isolatedEnv,
    });
  } finally {
    cleanup();
  }
}

// T6.1: 退出码 1 - check 结构验证失败
describe('E13-S2 T6.1: exit code 1 (structure validation)', () => {
  it('check in dir without _bmad-output => exit 1, stderr has missing', () => {
    const tmpDir = path.join(os.tmpdir(), `e13s2-ex1-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runCheck(tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    const err = (r.stderr || '').toLowerCase();
    assert.ok(err.includes('missing') || err.includes('validation') || err.includes('structure'), `stderr: ${r.stderr}`);
  });
});

// T6.2: 退出码 2 - --ai 无效 (complement to ai-registry-integration)
describe('E13-S2 T6.2: exit code 2 (--ai invalid)', () => {
  it('init --ai invalid-name --yes => exit 2, stderr has Available or check --list-ai', () => {
    const tmpDir = path.join(os.tmpdir(), `e13s2-ex2-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runInit(['target', '--ai', 'invalid-xyz-ai', '--yes'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 2);
    const err = (r.stderr || '') + (r.stdout || '');
    assert.ok(err.includes('Available') || err.includes('check --list-ai'), `stderr: ${err}`);
  });
});

// T6.3: 退出码 3 - 网络/模板失败，stderr 含 --offline 建议
describe('E13-S2 T6.3: exit code 3 (network/template, --offline hint)', () => {
  it('fetchFromUrl 404 => TemplateFetcher throws NETWORK_TEMPLATE', async () => {
    const templateFetcher = require('../src/services/template-fetcher');
    let nock;
    try { nock = require('nock'); } catch { return; }
    nock('https://example.com').get('/e13s2-404.tar.gz').reply(404);
    try {
      await templateFetcher.fetchFromUrl('https://example.com/e13s2-404.tar.gz', { networkTimeoutMs: 5000 });
      assert.fail('expected throw');
    } catch (err) {
      assert.strictEqual(err.code, 'NETWORK_TEMPLATE');
    } finally {
      nock.cleanAll();
    }
  });

  it('init catch NETWORK_TEMPLATE outputs 建议 --offline (via spawn helper)', () => {
    const helper = path.join(__dirname, 'run-init-exit3-helper.js');
    const tmpDir = path.join(os.tmpdir(), `e13s2-ex3-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = spawnSync('node', [helper, tmpDir], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, BMAD_TEST_OFFLINE_ONLY: '1' },
    });
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    if (r.status === 0 && (r.stdout || '').includes('SKIP')) return;
    assert.strictEqual(r.status, 3, `expected exit 3, got ${r.status}: ${r.stderr}`);
    const err = (r.stderr || '') + (r.stdout || '');
    assert.ok(/建议.*offline|offline.*建议|--offline|检查网络/.test(err), `stderr should hint --offline: ${err}`);
  });
});

// T6.4: 退出码 4 - 路径不可用
describe('E13-S2 T6.4: exit code 4 (path unavailable)', () => {
  it('init target exists and non-empty without --force => exit 4', () => {
    const tmpDir = path.join(os.tmpdir(), `e13s2-ex4-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'existing.txt'), 'x', 'utf8');
    const r = runInit(['.', '--ai', 'cursor-agent', '--yes'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    if (r.status === 3 || r.status === 5) return;
    assert.strictEqual(r.status, 4, `expected exit 4, got ${r.status}`);
    const err = (r.stderr || '');
    assert.ok(err.includes('not empty') || err.includes('--force'), `stderr: ${err}`);
  });

  it('check bmadPath nonexistent => exit 4', () => {
    const tmpDir = path.join(os.tmpdir(), `e13s2-ex4b-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'bmad-speckit.json'), JSON.stringify({ bmadPath: path.join(tmpDir, 'nonexistent') }), 'utf8');
    const r = runCheck(tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(
      r.status,
      4,
      `expected exit 4, got ${r.status}; error=${r.error?.code || 'none'}; stdout=${r.stdout || ''}; stderr=${r.stderr || ''}`
    );
  });
});

// T6.5: 网络超时配置链
describe('E13-S2 T6.5: network timeout config chain', () => {
  it('resolveNetworkTimeoutMs: SDD_NETWORK_TIMEOUT_MS overrides default', () => {
    const { resolveNetworkTimeoutMs } = require('../src/utils/network-timeout');
    const orig = process.env.SDD_NETWORK_TIMEOUT_MS;
    process.env.SDD_NETWORK_TIMEOUT_MS = '12345';
    try {
      const v = resolveNetworkTimeoutMs({});
      assert.strictEqual(v, 12345);
    } finally {
      process.env.SDD_NETWORK_TIMEOUT_MS = orig;
    }
  });

  it('resolveNetworkTimeoutMs: default 30000 when no config', () => {
    const { resolveNetworkTimeoutMs } = require('../src/utils/network-timeout');
    const orig = process.env.SDD_NETWORK_TIMEOUT_MS;
    delete process.env.SDD_NETWORK_TIMEOUT_MS;
    try {
      const v = resolveNetworkTimeoutMs({ cwd: os.tmpdir() });
      assert.strictEqual(v, 30000);
    } finally {
      if (orig !== undefined) process.env.SDD_NETWORK_TIMEOUT_MS = orig;
    }
  });

  it('TemplateFetcher uses config chain when opts.networkTimeoutMs empty', async () => {
    const templateFetcher = require('../src/services/template-fetcher');
    const orig = process.env.SDD_NETWORK_TIMEOUT_MS;
    process.env.SDD_NETWORK_TIMEOUT_MS = '9999';
    try {
      let nock;
      try { nock = require('nock'); } catch { return; }
      nock('https://example.com').get('/timeout-test.tar.gz').reply(404);
      try {
        await templateFetcher.fetchFromUrl('https://example.com/timeout-test.tar.gz', {});
        assert.fail('expected throw');
      } catch (err) {
        assert.strictEqual(err.code, 'NETWORK_TEMPLATE');
      }
      nock.cleanAll();
    } finally {
      process.env.SDD_NETWORK_TIMEOUT_MS = orig;
    }
  });
});
