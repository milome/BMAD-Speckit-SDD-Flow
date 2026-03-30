const fs = require('node:fs');
const path = require('node:path');

function getScoringDataPath() {
  const primary = path.resolve(process.cwd(), 'packages', 'scoring', 'data');
  if (fs.existsSync(primary)) {
    return primary;
  }
  return path.resolve(__dirname, '..', '..', 'scoring', 'data');
}

const DEFAULT_TARGET = 'openai_chat';
const DEFAULT_MIN_SCORE = 90;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_SPLIT_SEED = 42;
const DEFAULT_BUNDLE_DIR = path.resolve(process.cwd(), '_bmad-output', 'datasets');
const EXPORT_TARGETS = ['openai_chat', 'hf_conversational', 'hf_tool_calling'];
const EXPORT_TARGET_SET = new Set(EXPORT_TARGETS);

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

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return Boolean(value);
}

function normalizeTarget(target, fallback = DEFAULT_TARGET) {
  const resolved = target == null || target === '' ? fallback : String(target);
  if (!EXPORT_TARGET_SET.has(resolved)) {
    throw new Error(
      `不支持的 SFT target：${resolved}。可选值：${EXPORT_TARGETS.join('|')}`
    );
  }
  return resolved;
}

function toAbsolutePath(filePath, fallback) {
  const resolved = filePath == null || filePath === '' ? fallback : filePath;
  return path.isAbsolute(resolved) ? resolved : path.resolve(process.cwd(), resolved);
}

function toUserPath(filePath, cwd) {
  const relative = path.relative(cwd, filePath);
  if (
    relative &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  ) {
    return relative.replace(/\\/g, '/');
  }
  return filePath.replace(/\\/g, '/');
}

function resolveDefaultScoringDataPath() {
  return getScoringDataPath();
}

function normalizeRuntimeOptions(defaults, payload) {
  const merged = {
    ...defaults,
    ...(payload || {}),
  };

  return {
    cwd: defaults.cwd ?? process.cwd(),
    dataPath: toAbsolutePath(merged.dataPath, resolveDefaultScoringDataPath()),
    minScore: parseInteger(merged.minScore, DEFAULT_MIN_SCORE, 'minScore'),
    maxTokens: parseInteger(merged.maxTokens, DEFAULT_MAX_TOKENS, 'maxTokens'),
    splitSeed: parseInteger(merged.splitSeed, DEFAULT_SPLIT_SEED, 'splitSeed'),
    dropNoCodePair: parseBoolean(merged.dropNoCodePair, false),
    target: normalizeTarget(merged.target, DEFAULT_TARGET),
    bundleDir: toAbsolutePath(merged.bundleDir, DEFAULT_BUNDLE_DIR),
    format: typeof merged.format === 'string' && merged.format !== '' ? merged.format : 'json',
  };
}

async function getSftPreviewLocal(options) {
  throw new Error('local SFT preview is unavailable until scoring analytics build is present');
}

async function validateSftDatasetLocal(options) {
  throw new Error('local SFT validation is unavailable until scoring analytics build is present');
}

async function writeSftBundleLocal(options) {
  throw new Error('local SFT bundle export is unavailable until scoring analytics build is present');
}

function createLocalRuntimeCore(defaults = {}) {
  return {
    async request(method, payload) {
      const options = normalizeRuntimeOptions(defaults, payload);

      if (method === 'getSftPreview') {
        return getSftPreviewLocal(options);
      }
      if (method === 'validateSftDataset') {
        return validateSftDatasetLocal(options);
      }
      if (method === 'writeSftBundle') {
        return writeSftBundleLocal(options);
      }

      throw new Error(`unsupported local runtime method: ${method}`);
    },
  };
}

function createHttpRuntimeClient(options = {}) {
  const baseUrl =
    options.dashboardUrl ||
    process.env.BMAD_RUNTIME_DASHBOARD_URL ||
    process.env.RUNTIME_DASHBOARD_URL;

  if (!baseUrl) {
    return null;
  }

  return {
    async request(method) {
      if (method !== 'getSftPreview') {
        throw new Error(`http runtime method not supported: ${method}`);
      }

      const response = await fetch(new URL('/api/sft-summary', baseUrl));
      if (!response.ok) {
        throw new Error(`http runtime request failed: ${response.status}`);
      }
      return response.json();
    },
  };
}

function createRuntimeClient(options = {}) {
  const transports = [
    { name: 'mcp', client: options.mcpClient ?? null },
    { name: 'http', client: options.httpClient ?? createHttpRuntimeClient(options) },
    { name: 'local', client: options.localCore ?? createLocalRuntimeCore(options) },
  ];

  return {
    async request(method, payload = {}) {
      const transportErrors = [];

      for (const transport of transports) {
        if (!transport.client || typeof transport.client.request !== 'function') {
          continue;
        }

        try {
          return await transport.client.request(method, payload);
        } catch (error) {
          transportErrors.push({
            transport: transport.name,
            error,
          });
        }
      }

      const detail = transportErrors
        .map(({ transport, error }) => `${transport}: ${error && error.message ? error.message : String(error)}`)
        .join('; ');
      const failure = new Error(
        `runtime request failed for ${method}${detail ? ` (${detail})` : ''}`
      );
      failure.errors = transportErrors;
      throw failure;
    },
  };
}

module.exports = {
  createRuntimeClient,
};
