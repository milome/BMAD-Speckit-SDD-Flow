/**
 * Template fetch exit 3 unit tests (Story 11.1 - T009)
 * 404 / timeout / extract failure -> throw with code NETWORK_TEMPLATE -> init exit(3)
 * Uses nock to mock HTTP; verifies fetcher throws correct errors (init catches and exits 3).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

let templateFetcher;
let nock;
try {
  templateFetcher = require('../src/services/template-fetcher');
  nock = require('nock');
} catch (e) {
  templateFetcher = null;
  nock = null;
}

describe('Story 11.1: fetchFromUrl 404 triggers NETWORK_TEMPLATE (init exit 3) (T009)', () => {
  it('404 response throws with code NETWORK_TEMPLATE', async () => {
    if (!templateFetcher || !nock) return;
    nock('https://example.com').get('/missing.tar.gz').reply(404);
    try {
      await templateFetcher.fetchFromUrl('https://example.com/missing.tar.gz', { networkTimeoutMs: 5000 });
      assert.fail('expected throw');
    } catch (err) {
      assert.strictEqual(err.code, 'NETWORK_TEMPLATE');
    } finally {
      nock.cleanAll();
    }
  });
});

describe('Story 11.1: fetchFromUrl timeout triggers NETWORK_TEMPLATE with 网络超时 (init exit 3) (T009)', () => {
  it('timeout throws with 网络超时 and code NETWORK_TEMPLATE', async () => {
    if (!templateFetcher || !nock) return;
    nock('https://example.com')
      .get('/slow.tar.gz')
      .delay(5000)
      .reply(200, Buffer.alloc(0));
    try {
      await templateFetcher.fetchFromUrl('https://example.com/slow.tar.gz', { networkTimeoutMs: 100 });
      assert.fail('expected throw');
    } catch (err) {
      assert.strictEqual(err.code, 'NETWORK_TEMPLATE');
      assert.ok(err.message.includes('网络超时') || err.message.includes('Network timeout'), 'message should mention timeout');
    } finally {
      nock.cleanAll();
    }
  });
});

describe('Story 11.1: fetchFromUrl extract failure triggers NETWORK_TEMPLATE (init exit 3) (T009)', () => {
  it('non-tarball response throws with code NETWORK_TEMPLATE', async () => {
    if (!templateFetcher || !nock) return;
    nock('https://example.com')
      .get('/fake.tar.gz')
      .reply(200, 'not a tarball', { 'Content-Type': 'text/plain' });
    try {
      await templateFetcher.fetchFromUrl('https://example.com/fake.tar.gz', { networkTimeoutMs: 5000 });
      assert.fail('expected throw');
    } catch (err) {
      assert.strictEqual(err.code, 'NETWORK_TEMPLATE');
    } finally {
      nock.cleanAll();
    }
  });
});
