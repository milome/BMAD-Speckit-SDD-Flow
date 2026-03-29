import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type {
  GovernanceHostKind,
} from './governance-remediation-runner';
import type { ModelGovernanceHintCandidate } from './model-governance-hints-schema';
import type {
  GovernanceProviderAdapter,
  AnthropicCompatibleGovernanceProviderAdapterConfig,
  HttpJsonGovernanceProviderAdapterConfig,
  OpenAICompatibleGovernanceProviderAdapterConfig,
} from './governance-provider-adapter';
import {
  createAnthropicCompatibleGovernanceProviderAdapter,
  createHttpJsonGovernanceProviderAdapter,
  createOpenAICompatibleGovernanceProviderAdapter,
  createStubGovernanceProviderAdapter,
} from './governance-provider-adapter';

export interface GovernanceRemediationConfig {
  version: 1;
  primaryHost: GovernanceHostKind;
  packetHosts: GovernanceHostKind[];
  provider: {
    mode: 'stub' | 'http-json' | 'openai-compatible' | 'anthropic-compatible';
    id: string;
    displayName?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    endpoint?: string;
    method?: 'POST' | 'PUT';
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    apiKeyEnv?: string;
    systemPrompt?: string;
    maxTokens?: number;
    anthropicVersion?: string;
    stubCandidate?: ModelGovernanceHintCandidate | null;
  };
}

function uniqueHosts(hosts: GovernanceHostKind[]): GovernanceHostKind[] {
  return [...new Set(hosts)];
}

function isHostKind(value: string): value is GovernanceHostKind {
  return value === 'cursor' || value === 'claude' || value === 'codex' || value === 'generic';
}

export function governanceRemediationConfigPath(projectRoot: string): string {
  return path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml');
}

export function defaultGovernanceRemediationConfig(): GovernanceRemediationConfig {
  return {
    version: 1,
    primaryHost: 'cursor',
    packetHosts: ['cursor', 'claude', 'codex'],
    provider: {
      mode: 'stub',
      id: 'default-governance-provider',
    },
  };
}

export function readGovernanceRemediationConfig(
  projectRoot: string,
  explicitPath?: string
): GovernanceRemediationConfig {
  const file = explicitPath
    ? path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(projectRoot, explicitPath)
    : governanceRemediationConfigPath(projectRoot);

  if (!fs.existsSync(file)) {
    return defaultGovernanceRemediationConfig();
  }

  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) as Partial<GovernanceRemediationConfig> | null;
  const base = defaultGovernanceRemediationConfig();
  const primaryHost =
    parsed?.primaryHost && isHostKind(parsed.primaryHost) ? parsed.primaryHost : base.primaryHost;
  const packetHosts = uniqueHosts(
    Array.isArray(parsed?.packetHosts)
      ? parsed.packetHosts.filter((host): host is GovernanceHostKind => typeof host === 'string' && isHostKind(host))
      : base.packetHosts
  );
  const provider = {
    ...base.provider,
    ...(parsed?.provider ?? {}),
  };

  return {
    version: 1,
    primaryHost,
    packetHosts: packetHosts.length > 0 ? packetHosts : [primaryHost],
    provider: {
      ...provider,
      id: provider.id || base.provider.id,
      mode: provider.mode || base.provider.mode,
    },
  };
}

export function createGovernanceProviderAdapterFromConfig(
  config: GovernanceRemediationConfig
): GovernanceProviderAdapter | undefined {
  switch (config.provider.mode) {
    case 'stub':
      return createStubGovernanceProviderAdapter(
        config.provider.stubCandidate ?? null,
        config.provider.id
      );
    case 'http-json': {
      if (!config.provider.endpoint) {
        throw new Error('governance-remediation provider.endpoint is required for http-json mode');
      }
      const providerConfig: HttpJsonGovernanceProviderAdapterConfig = {
        id: config.provider.id,
        endpoint: config.provider.endpoint,
        displayName: config.provider.displayName,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        method: config.provider.method,
      };
      return createHttpJsonGovernanceProviderAdapter(providerConfig);
    }
    case 'openai-compatible': {
      if (!config.provider.baseUrl || !config.provider.model) {
        throw new Error(
          'governance-remediation provider.baseUrl and provider.model are required for openai-compatible mode'
        );
      }
      const apiKey =
        config.provider.apiKey ??
        (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : undefined);
      const providerConfig: OpenAICompatibleGovernanceProviderAdapterConfig = {
        id: config.provider.id,
        baseUrl: config.provider.baseUrl,
        model: config.provider.model,
        apiKey,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        displayName: config.provider.displayName,
        systemPrompt: config.provider.systemPrompt,
      };
      return createOpenAICompatibleGovernanceProviderAdapter(providerConfig);
    }
    case 'anthropic-compatible': {
      if (!config.provider.baseUrl || !config.provider.model) {
        throw new Error(
          'governance-remediation provider.baseUrl and provider.model are required for anthropic-compatible mode'
        );
      }
      const apiKey =
        config.provider.apiKey ??
        (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : undefined);
      const providerConfig: AnthropicCompatibleGovernanceProviderAdapterConfig = {
        id: config.provider.id,
        baseUrl: config.provider.baseUrl,
        model: config.provider.model,
        apiKey,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        displayName: config.provider.displayName,
        systemPrompt: config.provider.systemPrompt,
        maxTokens: config.provider.maxTokens,
        anthropicVersion: config.provider.anthropicVersion,
      };
      return createAnthropicCompatibleGovernanceProviderAdapter(providerConfig);
    }
    default:
      return undefined;
  }
}
