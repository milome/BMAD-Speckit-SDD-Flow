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
                  privacy_gate_passed: true,
                  trace_quality_passed: true,
                  provider_compatibility_passed: true,
                  training_ready_passed: true,
                  quality_thresholds: {
                    accepted_ratio_min: 0.5,
                    training_ready_ratio_min: 0.5,
                    blocked_redaction_ratio_max: 0,
                    host_kind_coverage_min: 1,
                  },
                  quality_metrics: {
                    total_seen: 12,
                    accepted_ratio: 0.8333,
                    training_ready_ratio: 0.8333,
                    blocked_redaction_ratio: 0,
                    host_kind_coverage: 1,
                    provider_fact_coverage: 0.5,
                  },
                  threshold_failures: [],
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
      privacy_gate_passed: true,
      trace_quality_passed: true,
      provider_compatibility_passed: true,
      training_ready_passed: true,
      quality_thresholds: {
        accepted_ratio_min: 0.5,
        training_ready_ratio_min: 0.5,
        blocked_redaction_ratio_max: 0,
        host_kind_coverage_min: 1,
      },
      quality_metrics: {
        total_seen: 12,
        accepted_ratio: 0.8333,
        training_ready_ratio: 0.8333,
        blocked_redaction_ratio: 0,
        host_kind_coverage: 1,
        provider_fact_coverage: 0.5,
      },
      threshold_failures: [],
      accepted: 10,
      rejected: 2,
      rejection_report_path: '_bmad-output/datasets/demo/rejection-report.json',
    });
  });
});
