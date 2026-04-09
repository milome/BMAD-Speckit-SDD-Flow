const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function resolveConfigPath(cwd, explicitPath) {
  if (explicitPath && explicitPath.trim() !== '') {
    return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(cwd, explicitPath);
  }
  return path.join(cwd, '_bmad', '_config', 'governance-remediation.yaml');
}

function readConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`配置文件不存在: ${filePath}`);
  }
  const parsed = yaml.load(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`配置文件不是有效对象: ${filePath}`);
  }
  return parsed;
}

function resolveApiKey(provider) {
  if (typeof provider.apiKey === 'string' && provider.apiKey.trim() !== '') {
    return provider.apiKey;
  }
  if (typeof provider.apiKeyEnv === 'string' && provider.apiKeyEnv.trim() !== '') {
    return process.env[provider.apiKeyEnv] || '';
  }
  return '';
}

async function postJson(url, body, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildBaseResult(configPath, provider, timeoutMs) {
  return {
    config_path: configPath.replace(/\\/g, '/'),
    provider: {
      id: provider.id || 'unknown-provider',
      mode: provider.mode || 'unknown-mode',
      model: provider.model || null,
      endpoint: provider.endpoint || provider.baseUrl || null,
    },
    timeout_ms: timeoutMs,
  };
}

async function providerSmokeCommand(opts = {}, deps = {}) {
  const cwd = deps.cwd || process.cwd();
  const log = deps.log || console.log;
  const configPath = resolveConfigPath(cwd, opts.config);
  const config = readConfig(configPath);
  const provider = config.provider || {};
  const timeoutMs = Number(opts.timeoutMs || provider.timeoutMs || 30000);
  const prompt = opts.prompt || 'Return a tiny JSON object confirming provider smoke readiness.';
  const base = buildBaseResult(configPath, provider, timeoutMs);

  if (provider.mode === 'stub') {
    log(JSON.stringify({
      ok: true,
      ...base,
      transport: 'stub',
      response_preview: '{"ok":true}',
    }));
    return;
  }

  if (provider.mode === 'openai-compatible') {
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      throw new Error('openai-compatible provider 缺少 apiKey 或 apiKeyEnv');
    }
    const url = `${String(provider.baseUrl || '').replace(/\/$/, '')}/chat/completions`;
    const response = await postJson(
      url,
      {
        model: provider.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: prompt },
        ],
      },
      {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      timeoutMs
    );
    log(JSON.stringify({
      ok: response.ok,
      ...base,
      transport: 'openai-compatible',
      status: response.status,
      status_text: response.statusText,
      response_preview: response.text.slice(0, 500),
    }));
    return;
  }

  if (provider.mode === 'anthropic-compatible') {
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      throw new Error('anthropic-compatible provider 缺少 apiKey 或 apiKeyEnv');
    }
    const url = `${String(provider.baseUrl || '').replace(/\/$/, '')}/messages`;
    const response = await postJson(
      url,
      {
        model: provider.model,
        max_tokens: provider.maxTokens || 256,
        system: provider.systemPrompt || 'Return JSON only.',
        messages: [
          { role: 'user', content: prompt },
        ],
      },
      {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': provider.anthropicVersion || '2023-06-01',
      },
      timeoutMs
    );
    log(JSON.stringify({
      ok: response.ok,
      ...base,
      transport: 'anthropic-compatible',
      status: response.status,
      status_text: response.statusText,
      response_preview: response.text.slice(0, 500),
    }));
    return;
  }

  if (provider.mode === 'http-json') {
    const response = await postJson(
      provider.endpoint,
      {
        smoke: true,
        prompt,
      },
      {
        'content-type': 'application/json',
        ...(provider.headers || {}),
      },
      timeoutMs
    );
    log(JSON.stringify({
      ok: response.ok,
      ...base,
      transport: 'http-json',
      status: response.status,
      status_text: response.statusText,
      response_preview: response.text.slice(0, 500),
    }));
    return;
  }

  throw new Error(`不支持的 provider mode: ${provider.mode || '(missing)'}`);
}

module.exports = { providerSmokeCommand };
