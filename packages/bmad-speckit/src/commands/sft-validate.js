const { createRuntimeClient } = require('../runtime-client');

function parseInteger(value, fallback, fieldName) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} 必须是数字`);
  }
  return parsed;
}

function buildPayload(opts) {
  const payload = {
    minScore: parseInteger(opts.minScore, 90, 'minScore'),
    target: opts.target || 'openai_chat',
    format: opts.format || 'json',
  };

  if (opts.dataPath) {
    payload.dataPath = opts.dataPath;
  }
  if (opts.splitSeed != null && opts.splitSeed !== '') {
    payload.splitSeed = parseInteger(opts.splitSeed, undefined, 'splitSeed');
  }
  if (opts.maxTokens != null && opts.maxTokens !== '') {
    payload.maxTokens = parseInteger(opts.maxTokens, undefined, 'maxTokens');
  }
  if (opts.dropNoCodePair) {
    payload.dropNoCodePair = true;
  }

  return payload;
}

async function sftValidateCommand(opts, deps = {}) {
  const clientFactory = deps.createRuntimeClient || createRuntimeClient;
  const result = await clientFactory({
    cwd: process.cwd(),
    dataPath: opts.dataPath,
  }).request('validateSftDataset', buildPayload(opts));

  // eslint-disable-next-line no-console -- CLI contract
  console.log(JSON.stringify({
    schema_valid: result.schema_valid,
    privacy_gate_passed: result.privacy_gate_passed,
    trace_quality_passed: result.trace_quality_passed,
    provider_compatibility_passed: result.provider_compatibility_passed,
    training_ready_passed: result.training_ready_passed,
    quality_thresholds: result.quality_thresholds,
    quality_metrics: result.quality_metrics,
    threshold_failures: result.threshold_failures,
    accepted: result.accepted,
    rejected: result.rejected,
    rejection_report_path: result.rejection_report_path,
  }));
}

module.exports = { sftValidateCommand };
