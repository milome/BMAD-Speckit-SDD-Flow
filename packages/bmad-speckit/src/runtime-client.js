const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { getScoringDataPath } = require('@bmad-speckit/scoring/constants/path');
const { loadAndDedupeRecords } = require('@bmad-speckit/scoring/query/loader');
const {
  buildCanonicalCandidatesFromRecords,
  exportCanonicalSamples,
  writeDatasetBundle,
} = require('@bmad-speckit/scoring/analytics');
const canonicalSftSampleSchema = require('@bmad-speckit/scoring/analytics/schema/canonical-sft-sample');

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
  const primary = getScoringDataPath();
  if (fs.existsSync(primary)) {
    return primary;
  }

  const repoRelativeFallback = path.resolve(process.cwd(), '..', 'scoring', 'data');
  if (fs.existsSync(repoRelativeFallback)) {
    return repoRelativeFallback;
  }

  return primary;
}

function summarizeSamples(samples) {
  const summary = {
    total_candidates: samples.length,
    accepted: 0,
    rejected: 0,
    downgraded: 0,
    by_split: {
      train: 0,
      validation: 0,
      test: 0,
      holdout: 0,
    },
  };

  for (const sample of samples) {
    if (sample.quality.acceptance_decision === 'accepted') {
      summary.accepted += 1;
    } else if (sample.quality.acceptance_decision === 'rejected') {
      summary.rejected += 1;
    } else if (sample.quality.acceptance_decision === 'downgraded') {
      summary.downgraded += 1;
    }

    if (summary.by_split[sample.split.assignment] != null) {
      summary.by_split[sample.split.assignment] += 1;
    }
  }

  return summary;
}

function createCanonicalSchemaValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(canonicalSftSampleSchema);
}

const validateCanonicalSample = createCanonicalSchemaValidator();

function validateCanonicalSamples(samples) {
  const invalidSamples = [];

  for (const sample of samples) {
    const valid = validateCanonicalSample(sample);
    if (!valid) {
      invalidSamples.push({
        sample_id: sample.sample_id,
        errors: (validateCanonicalSample.errors ?? []).map((error) =>
          `${error.instancePath || '/'} ${error.message || 'invalid'}`
        ),
      });
    }
  }

  return invalidSamples;
}

async function buildCanonicalSamples(options) {
  const records = loadAndDedupeRecords(options.dataPath);
  const { samples } = await buildCanonicalCandidatesFromRecords(records, {
    cwd: options.cwd,
    minScore: options.minScore,
    maxTokens: options.maxTokens,
    requireCodePair: options.dropNoCodePair,
    splitSeed: options.splitSeed,
  });
  return samples;
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
  const samples = await buildCanonicalSamples(options);
  const summary = summarizeSamples(samples);

  if (!options.target) {
    return {
      ...summary,
      targets: [...EXPORT_TARGETS],
    };
  }

  const exportResult = exportCanonicalSamples(samples, options.target);
  return {
    total_candidates: samples.length,
    accepted: exportResult.validationReport.counts.accepted,
    rejected: exportResult.validationReport.counts.rejected,
    downgraded: exportResult.validationReport.counts.downgraded,
    by_split: {
      train: exportResult.validationReport.counts.train,
      validation: exportResult.validationReport.counts.validation,
      test: exportResult.validationReport.counts.test,
      holdout: summary.by_split.holdout,
    },
    targets: [options.target],
  };
}

async function validateSftDatasetLocal(options) {
  const samples = await buildCanonicalSamples(options);
  const exportResult = exportCanonicalSamples(samples, options.target);
  const invalidSamples = validateCanonicalSamples(samples);

  return {
    schema_valid: invalidSamples.length === 0,
    accepted: exportResult.validationReport.counts.accepted,
    rejected: exportResult.validationReport.counts.rejected,
    downgraded: exportResult.validationReport.counts.downgraded,
    export_target: options.target,
    invalid_samples: invalidSamples,
    rejected_samples: exportResult.validationReport.rejected_samples,
    rejection_report_path: null,
  };
}

async function writeSftBundleLocal(options) {
  const samples = await buildCanonicalSamples(options);
  const result = await writeDatasetBundle(samples, {
    exportTarget: options.target,
    outputRoot: options.bundleDir,
    filterSettings: {
      min_score: options.minScore,
      max_tokens: options.maxTokens,
      drop_no_code_pair: options.dropNoCodePair || undefined,
    },
  });

  const manifestPath = path.join(
    result.bundleDir,
    result.manifest.artifacts.manifest_path
  );
  const validationReportPath = path.join(
    result.bundleDir,
    result.manifest.artifacts.validation_report_path
  );
  const rejectionReportPath = path.join(
    result.bundleDir,
    result.manifest.artifacts.rejection_report_path
  );

  return {
    bundle_dir: toUserPath(result.bundleDir, options.cwd),
    manifest_path: toUserPath(manifestPath, options.cwd),
    validation_report_path: toUserPath(validationReportPath, options.cwd),
    rejection_report_path: toUserPath(rejectionReportPath, options.cwd),
    counts: result.manifest.counts,
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
};
