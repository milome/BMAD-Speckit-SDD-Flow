const { describe, it } = require('node:test');
const assert = require('node:assert');

let runtimeClientModule;
try {
  runtimeClientModule = require('../src/runtime-client.js');
} catch {
  runtimeClientModule = null;
}

describe('runtime-client', () => {
  it('prefers MCP and falls back to HTTP then local core when unavailable', async () => {
    assert.ok(runtimeClientModule, 'runtime-client.js 模块应存在');
    assert.strictEqual(typeof runtimeClientModule.createRuntimeClient, 'function', '应导出 createRuntimeClient');

    const calls = [];
    const client = runtimeClientModule.createRuntimeClient({
      mcpClient: {
        async request(method, payload) {
          calls.push(['mcp', method, payload]);
          throw new Error('mcp unavailable');
        },
      },
      httpClient: {
        async request(method, payload) {
          calls.push(['http', method, payload]);
          throw new Error('http unavailable');
        },
      },
      localCore: {
        async request(method, payload) {
          calls.push(['local', method, payload]);
          return { ok: true, transport: 'local', method, payload };
        },
      },
    });

    const result = await client.request('getSftPreview', { minScore: 90 });
    assert.deepStrictEqual(result, {
      ok: true,
      transport: 'local',
      method: 'getSftPreview',
      payload: { minScore: 90 },
    });
    assert.deepStrictEqual(calls, [
      ['mcp', 'getSftPreview', { minScore: 90 }],
      ['http', 'getSftPreview', { minScore: 90 }],
      ['local', 'getSftPreview', { minScore: 90 }],
    ]);
  });
});
