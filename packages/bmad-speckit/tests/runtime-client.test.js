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

  it('derives story source_scope from story-scoped artifact paths', async () => {
    assert.ok(runtimeClientModule, 'runtime-client.js 模块应存在');

    const scope = runtimeClientModule.deriveSourceScopeFromPath(
      '_bmad-output/implementation-artifacts/epic-15/story-15-1-runtime-dashboard-sft/plan.md'
    );

    assert.deepStrictEqual(scope, {
      scope_type: 'story',
      epic_id: 'epic-15',
      story_key: '15-1-runtime-dashboard-sft',
      work_item_id: 'story:15-1-runtime-dashboard-sft',
      board_group_id: 'epic:epic-15',
    });
  });

  it('falls back to global source_scope when bundle mixes multiple source paths', async () => {
    assert.ok(runtimeClientModule, 'runtime-client.js 模块应存在');

    const scope = runtimeClientModule.deriveSourceScope(
      [
        { provenance: { source_path: 'specs/epic-15/story-15-1-runtime-dashboard-sft/spec.md' }, source: { artifact_refs: [] } },
        { provenance: { source_path: '_bmad-output/implementation-artifacts/_orphan/bugfix/fix-runtime-dashboard-findings-duplication.md' }, source: { artifact_refs: [] } },
      ],
      {}
    );

    assert.deepStrictEqual(scope, { scope_type: 'global' });
  });
});
