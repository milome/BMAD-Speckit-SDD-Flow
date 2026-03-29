const { describe, it } = require('node:test');
const assert = require('node:assert');

let validateModule;
try {
  validateModule = require('../src/commands/sft-validate.js');
} catch {
  validateModule = null;
}

describe('sft-validate command', () => {
  it('emits schema validation and rejection summary via runtime client', async () => {
    assert.ok(validateModule, 'sft-validate.js 模块应存在');
    assert.strictEqual(typeof validateModule.sftValidateCommand, 'function', '应导出 sftValidateCommand');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await validateModule.sftValidateCommand(
        { minScore: '90', target: 'hf_conversational', format: 'json' },
        {
          createRuntimeClient() {
            return {
              async request(method, payload) {
                assert.strictEqual(method, 'validateSftDataset');
                assert.deepStrictEqual(payload, {
                  minScore: 90,
                  target: 'hf_conversational',
                  format: 'json',
                });
                return {
                  schema_valid: true,
                  accepted: 10,
                  rejected: 2,
                  rejection_report_path: '_bmad-output/datasets/demo/rejection-report.json',
                };
              },
            };
          },
        }
      );
    } finally {
      console.log = originalLog;
    }

    assert.ok(logs.length > 0, '应输出 validate 结果');
    const payload = JSON.parse(logs[0]);
    assert.deepStrictEqual(payload, {
      schema_valid: true,
      accepted: 10,
      rejected: 2,
      rejection_report_path: '_bmad-output/datasets/demo/rejection-report.json',
    });
  });
});
