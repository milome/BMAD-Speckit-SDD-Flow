const fs = require('node:fs');
const path = require('node:path');

function requireScoringAnalyticsModule(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return null;
  }
}

function loadScoringAnalyticsRuntime() {
  const candidates = [
    path.resolve(process.cwd(), 'packages', 'scoring', 'dist', 'analytics'),
    path.resolve(__dirname, '..', '..', '..', 'scoring', 'dist', 'analytics'),
  ];

  for (const candidate of candidates) {
    const indexPath = path.join(candidate, 'index.js');
    if (!fs.existsSync(indexPath)) {
      continue;
    }

    const loaded = requireScoringAnalyticsModule(indexPath);
    if (loaded) {
      return loaded;
    }
  }

  return null;
}

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

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function deriveSourceScopeFromPath(sourcePath) {
  const normalized = normalizePath(sourcePath);
  if (!normalized) return null;

  const storyScopedMatch = normalized.match(/epic-([^/]+)\/story-([^/]+)/i);
  if (storyScopedMatch) {
    const epicId = `epic-${storyScopedMatch[1]}`.replace(/^epic-epic-/i, 'epic-');
    const storyKey = storyScopedMatch[2];
    return {
      scope_type: 'story',
      epic_id: epicId,
      story_key: storyKey,
      work_item_id: `story:${storyKey}`,
      board_group_id: `epic:${epicId}`,
    };
  }

  const specsMatch = normalized.match(/specs\/epic-(\d+)\/story-(\d+)-([^/]+)/i);
  if (specsMatch) {
    const epicId = `epic-${specsMatch[1]}`;
    const storyKey = `${specsMatch[1]}-${specsMatch[2]}-${specsMatch[3]}`;
    return {
      scope_type: 'story',
      epic_id: epicId,
      story_key: storyKey,
      work_item_id: `story:${storyKey}`,
      board_group_id: `epic:${epicId}`,
    };
  }

  if (normalized.includes('/_orphan/standalone_tasks/')) {
    const basename = normalized.split('/').pop() || 'standalone';
    const slug = basename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'standalone';
    return {
      scope_type: 'work_item',
      work_item_id: `standalone_task:orphan:${slug}`,
      board_group_id: 'queue:standalone-ops',
    };
  }

  if (normalized.includes('/_orphan/bugfix/')) {
    const basename = normalized.split('/').pop() || 'bugfix';
    const slug = basename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'bugfix';
    return {
      scope_type: 'work_item',
      work_item_id: `bugfix:orphan:${slug}`,
      board_group_id: 'queue:bugfix',
    };
  }

  return null;
}

function deriveSourceScope(samples, options) {
  if (options.sourceScope && typeof options.sourceScope === 'object') {
    return options.sourceScope;
  }

  const paths = [...new Set(
    (samples || [])
      .map((sample) => sample?.provenance?.source_path || sample?.source?.artifact_refs?.[0]?.path)
      .filter(Boolean)
  )];

  if (paths.length === 1) {
    const inferred = deriveSourceScopeFromPath(paths[0]);
    if (inferred) return inferred;
  }

  return { scope_type: 'global' };
}

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
    sourceScope:
      merged.sourceScope && typeof merged.sourceScope === 'object'
        ? merged.sourceScope
        : undefined,
    format: typeof merged.format === 'string' && merged.format !== '' ? merged.format : 'json',
  };
}

async function getSftPreviewLocal(options) {
  const analytics = loadScoringAnalyticsRuntime();
  if (!analytics || typeof analytics.buildCanonicalCandidates !== 'function') {
    throw new Error('local SFT preview is unavailable until scoring analytics build is present');
  }

  const { samples } = await analytics.buildCanonicalCandidates({
    dataPath: options.dataPath,
    cwd: options.cwd,
    minScore: options.minScore,
    maxTokens: options.maxTokens,
    splitSeed: options.splitSeed,
    requireCodePair: options.dropNoCodePair,
  });

  return {
    target: options.target,
    total_candidates: samples.length,
    accepted: samples.filter((sample) => sample.quality.acceptance_decision === 'accepted').length,
    rejected: samples.filter((sample) => sample.quality.acceptance_decision === 'rejected').length,
    downgraded: samples.filter((sample) => sample.quality.acceptance_decision === 'downgraded').length,
    split_counts: samples.reduce(
      (acc, sample) => {
        acc[sample.split.assignment] += 1;
        return acc;
      },
      { train: 0, validation: 0, test: 0, holdout: 0 }
    ),
    samples,
  };
}

async function validateSftDatasetLocal(options) {
  const analytics = loadScoringAnalyticsRuntime();
  if (!analytics || typeof analytics.buildCanonicalCandidates !== 'function') {
    throw new Error('local SFT validation is unavailable until scoring analytics build is present');
  }

  const { samples } = await analytics.buildCanonicalCandidates({
    dataPath: options.dataPath,
    cwd: options.cwd,
    minScore: options.minScore,
    maxTokens: options.maxTokens,
    splitSeed: options.splitSeed,
    requireCodePair: options.dropNoCodePair,
  });

  const invalidSamples = samples.filter((sample) => !sample.sample_id || sample.messages.length === 0);
  const rejectedSamples = samples
    .filter((sample) => sample.quality.acceptance_decision === 'rejected')
    .map((sample) => ({
      sample_id: sample.sample_id,
      run_id: sample.source.run_id,
      split: sample.split.assignment,
      reasons: sample.quality.rejection_reasons,
      warnings: sample.quality.warnings,
      acceptance_decision: sample.quality.acceptance_decision,
    }));

  return {
    target: options.target,
    schema_valid: invalidSamples.length === 0,
    total_samples: samples.length,
    invalid_samples: invalidSamples.map((sample) => sample.sample_id),
    rejected_samples: rejectedSamples,
  };
}

async function writeSftBundleLocal(options) {
  const analytics = loadScoringAnalyticsRuntime();
  if (
    !analytics ||
    typeof analytics.buildCanonicalCandidates !== 'function' ||
    typeof analytics.writeDatasetBundle !== 'function'
  ) {
    throw new Error('local SFT bundle export is unavailable until scoring analytics build is present');
  }

  const { samples } = await analytics.buildCanonicalCandidates({
    dataPath: options.dataPath,
    cwd: options.cwd,
    minScore: options.minScore,
    maxTokens: options.maxTokens,
    splitSeed: options.splitSeed,
    requireCodePair: options.dropNoCodePair,
  });

  const result = await analytics.writeDatasetBundle(samples, {
    exportTarget: options.target,
    outputRoot: options.bundleDir,
    exporterVersion: 'local-runtime-v1',
    filterSettings: {
      min_score: options.minScore,
    },
    sourceScope: deriveSourceScope(samples, options),
  });

  return {
    bundle_dir: toUserPath(result.bundleDir, options.cwd),
    manifest_path: toUserPath(path.join(result.bundleDir, 'manifest.json'), options.cwd),
    bundle_id: result.manifest.bundle_id,
    export_target: result.manifest.export_target,
    counts: result.manifest.counts,
    source_scope: result.manifest.source_scope,
  };
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
  deriveSourceScopeFromPath,
  deriveSourceScope,
};
