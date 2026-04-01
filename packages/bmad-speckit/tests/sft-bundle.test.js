const { describe, it } = require('node:test');
const assert = require('node:assert');

let bundleModule;
try {
  bundleModule = require('../src/commands/sft-bundle.js');
} catch {
  bundleModule = null;
}

describe('sft-bundle command', () => {
  it('writes dataset bundle via runtime client and prints bundle directory', async () => {
    assert.ok(bundleModule, 'sft-bundle.js 模块应存在');
    assert.strictEqual(typeof bundleModule.sftBundleCommand, 'function', '应导出 sftBundleCommand');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await bundleModule.sftBundleCommand(
        {
          minScore: '90',
          target: 'openai_chat',
          bundleDir: '_bmad-output/datasets',
          maxTokens: '4096',
          dropNoCodePair: true,
        },
        {
          createRuntimeClient() {
            return {
              async request(method, payload) {
                assert.strictEqual(method, 'writeSftBundle');
                assert.deepStrictEqual(payload, {
                  minScore: 90,
                  target: 'openai_chat',
                  bundleDir: '_bmad-output/datasets',
                  maxTokens: 4096,
                  dropNoCodePair: true,
                });
                return {
                  bundle_dir: '_bmad-output/datasets/openai_chat-demo',
                  manifest_path: '_bmad-output/datasets/openai_chat-demo/manifest.json',
                  validation_summary: {
                    schema_valid: true,
                    training_ready_passed: true,
                  },
                };
              },
            };
          },
        }
      );
    } finally {
      console.log = originalLog;
    }

    assert.ok(logs.length > 0, '应输出 bundle 结果');
    const payload = JSON.parse(logs[0]);
    assert.deepStrictEqual(payload, {
      bundle_dir: '_bmad-output/datasets/openai_chat-demo',
      manifest_path: '_bmad-output/datasets/openai_chat-demo/manifest.json',
      validation_summary: {
        schema_valid: true,
        training_ready_passed: true,
      },
    });
  });
});
