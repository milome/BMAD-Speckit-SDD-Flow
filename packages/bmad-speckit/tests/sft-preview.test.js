const { describe, it } = require('node:test');
const assert = require('node:assert');

let previewModule;
try {
  previewModule = require('../src/commands/sft-preview.js');
} catch {
  previewModule = null;
}

describe('sft-preview command', () => {
  it('prints accepted/rejected preview summary via runtime client', async () => {
    assert.ok(previewModule, 'sft-preview.js 模块应存在');
    assert.strictEqual(typeof previewModule.sftPreviewCommand, 'function', '应导出 sftPreviewCommand');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await previewModule.sftPreviewCommand(
        { minScore: '90', target: 'openai_chat', format: 'json' },
        {
          createRuntimeClient() {
            return {
              async request(method, payload) {
                assert.strictEqual(method, 'getSftPreview');
                assert.deepStrictEqual(payload, {
                  minScore: 90,
                  target: 'openai_chat',
                  format: 'json',
                });
                return {
                  accepted: 12,
                  rejected: 3,
                  downgraded: 2,
                  training_ready_candidates: 10,
                  validation_summary: {
                    schema_valid: true,
                    training_ready_passed: false,
                  },
                  targets: ['openai_chat', 'hf_conversational'],
                };
              },
            };
          },
        }
      );
    } finally {
      console.log = originalLog;
    }

    assert.ok(logs.length > 0, '应输出 preview 结果');
    const payload = JSON.parse(logs[0]);
    assert.deepStrictEqual(payload, {
      accepted: 12,
      rejected: 3,
      downgraded: 2,
      training_ready_candidates: 10,
      validation_summary: {
        schema_valid: true,
        training_ready_passed: false,
      },
      targets: ['openai_chat', 'hf_conversational'],
    });
  });
});
