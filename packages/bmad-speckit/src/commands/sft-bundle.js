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
    bundleDir: opts.bundleDir,
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

async function sftBundleCommand(opts, deps = {}) {
  const clientFactory = deps.createRuntimeClient || createRuntimeClient;
  const result = await clientFactory({
    cwd: process.cwd(),
    dataPath: opts.dataPath,
  }).request('writeSftBundle', buildPayload(opts));

  // eslint-disable-next-line no-console -- CLI contract
  console.log(JSON.stringify(result));
}

module.exports = { sftBundleCommand };
