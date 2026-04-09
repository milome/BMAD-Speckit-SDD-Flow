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
  version: 1 | 2;
  primaryHost: GovernanceHostKind;
  packetHosts: GovernanceHostKind[];
  execution?: GovernanceRemediationExecutionConfig;
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

export interface GovernanceRemediationExecutionConfig {
  enabled: boolean;
  authoritativeHost: GovernanceHostKind;
  fallbackHosts: GovernanceHostKind[];
  dispatch: {
    leaseTimeoutSeconds: number;
    heartbeatIntervalSeconds: number;
    maxDispatchAttempts: number;
  };
  execution: {
    timeoutMinutes: number;
    maxExecutionAttempts: number;
  };
  rerunGate: {
    required: boolean;
    autoSchedule: boolean;
    maxGateRetries: number;
  };
  escalation: {
    afterDispatchFailures: number;
    afterExecutionFailures: number;
    afterGateFailures: number;
  };
  projections: {
    emitNonAuthoritativePackets: boolean;
    archivePath: string;
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
    execution: {
      enabled: false,
      authoritativeHost: 'cursor',
      fallbackHosts: ['claude', 'codex'],
      dispatch: {
        leaseTimeoutSeconds: 900,
        heartbeatIntervalSeconds: 60,
        maxDispatchAttempts: 3,
      },
      execution: {
        timeoutMinutes: 30,
        maxExecutionAttempts: 2,
      },
      rerunGate: {
        required: true,
        autoSchedule: true,
        maxGateRetries: 2,
      },
      escalation: {
        afterDispatchFailures: 3,
        afterExecutionFailures: 2,
        afterGateFailures: 2,
      },
      projections: {
        emitNonAuthoritativePackets: true,
        archivePath: '_bmad-output/runtime/governance/archive',
      },
    },
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
  const execution = parsed?.execution ?? base.execution;
  if (
    parsed?.execution &&
    typeof parsed.execution === 'object' &&
    'authoritativeHost' in parsed.execution &&
    typeof parsed.execution.authoritativeHost === 'string' &&
    !isHostKind(parsed.execution.authoritativeHost)
  ) {
    throw new Error(
      `Invalid governance-remediation execution.authoritativeHost: ${parsed.execution.authoritativeHost}`
    );
  }
  const authoritativeHost =
    execution &&
    typeof execution === 'object' &&
    typeof execution.authoritativeHost === 'string' &&
    isHostKind(execution.authoritativeHost)
      ? execution.authoritativeHost
      : primaryHost;
  const fallbackHosts = uniqueHosts(
    Array.isArray(execution?.fallbackHosts)
      ? execution.fallbackHosts.filter(
          (host): host is GovernanceHostKind => typeof host === 'string' && isHostKind(host)
        )
      : base.execution?.fallbackHosts ?? []
  ).filter((host) => host !== authoritativeHost);
  const provider = {
    ...base.provider,
    ...(parsed?.provider ?? {}),
  };

  return {
    version: parsed?.version === 2 ? 2 : 1,
    primaryHost,
    packetHosts: packetHosts.length > 0 ? packetHosts : [primaryHost],
    execution: {
      enabled:
        typeof execution?.enabled === 'boolean'
          ? execution.enabled
          : base.execution?.enabled ?? false,
      authoritativeHost,
      fallbackHosts,
      dispatch: {
        leaseTimeoutSeconds:
          Number(execution?.dispatch?.leaseTimeoutSeconds) > 0
            ? Number(execution?.dispatch?.leaseTimeoutSeconds)
            : base.execution?.dispatch.leaseTimeoutSeconds ?? 900,
        heartbeatIntervalSeconds:
          Number(execution?.dispatch?.heartbeatIntervalSeconds) > 0
            ? Number(execution?.dispatch?.heartbeatIntervalSeconds)
            : base.execution?.dispatch.heartbeatIntervalSeconds ?? 60,
        maxDispatchAttempts:
          Number(execution?.dispatch?.maxDispatchAttempts) > 0
            ? Number(execution?.dispatch?.maxDispatchAttempts)
            : base.execution?.dispatch.maxDispatchAttempts ?? 3,
      },
      execution: {
        timeoutMinutes:
          Number(execution?.execution?.timeoutMinutes) > 0
            ? Number(execution?.execution?.timeoutMinutes)
            : base.execution?.execution.timeoutMinutes ?? 30,
        maxExecutionAttempts:
          Number(execution?.execution?.maxExecutionAttempts) > 0
            ? Number(execution?.execution?.maxExecutionAttempts)
            : base.execution?.execution.maxExecutionAttempts ?? 2,
      },
      rerunGate: {
        required:
          typeof execution?.rerunGate?.required === 'boolean'
            ? execution.rerunGate.required
            : base.execution?.rerunGate.required ?? true,
        autoSchedule:
          typeof execution?.rerunGate?.autoSchedule === 'boolean'
            ? execution.rerunGate.autoSchedule
            : base.execution?.rerunGate.autoSchedule ?? true,
        maxGateRetries:
          Number(execution?.rerunGate?.maxGateRetries) > 0
            ? Number(execution?.rerunGate?.maxGateRetries)
            : base.execution?.rerunGate.maxGateRetries ?? 2,
      },
      escalation: {
        afterDispatchFailures:
          Number(execution?.escalation?.afterDispatchFailures) > 0
            ? Number(execution?.escalation?.afterDispatchFailures)
            : base.execution?.escalation.afterDispatchFailures ?? 3,
        afterExecutionFailures:
          Number(execution?.escalation?.afterExecutionFailures) > 0
            ? Number(execution?.escalation?.afterExecutionFailures)
            : base.execution?.escalation.afterExecutionFailures ?? 2,
        afterGateFailures:
          Number(execution?.escalation?.afterGateFailures) > 0
            ? Number(execution?.escalation?.afterGateFailures)
            : base.execution?.escalation.afterGateFailures ?? 2,
      },
      projections: {
        emitNonAuthoritativePackets:
          typeof execution?.projections?.emitNonAuthoritativePackets === 'boolean'
            ? execution.projections.emitNonAuthoritativePackets
            : base.execution?.projections.emitNonAuthoritativePackets ?? true,
        archivePath:
          typeof execution?.projections?.archivePath === 'string' &&
          execution.projections.archivePath.trim() !== ''
            ? execution.projections.archivePath
            : base.execution?.projections.archivePath ??
              '_bmad-output/runtime/governance/archive',
      },
    },
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
