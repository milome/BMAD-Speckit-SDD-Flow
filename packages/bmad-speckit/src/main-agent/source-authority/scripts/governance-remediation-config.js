"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.governanceRemediationConfigPath = governanceRemediationConfigPath;
exports.defaultGovernanceRemediationConfig = defaultGovernanceRemediationConfig;
exports.readGovernanceRemediationConfig = readGovernanceRemediationConfig;
exports.createGovernanceProviderAdapterFromConfig = createGovernanceProviderAdapterFromConfig;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const governance_provider_adapter_1 = require("./governance-provider-adapter");
function uniqueHosts(hosts) {
    return [...new Set(hosts)];
}
function isHostKind(value) {
    return value === 'cursor' || value === 'claude' || value === 'codex' || value === 'generic';
}
function governanceRemediationConfigPath(projectRoot) {
    return path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml');
}
function defaultGovernanceRemediationConfig() {
    return {
        version: 1,
        primaryHost: 'cursor',
        packetHosts: ['cursor', 'claude', 'codex'],
        execution: {
            enabled: false,
            interactiveMode: 'main-agent',
            fallbackAutonomousMode: false,
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
function readGovernanceRemediationConfig(projectRoot, explicitPath) {
    const file = explicitPath
        ? path.isAbsolute(explicitPath)
            ? explicitPath
            : path.resolve(projectRoot, explicitPath)
        : governanceRemediationConfigPath(projectRoot);
    if (!fs.existsSync(file)) {
        return defaultGovernanceRemediationConfig();
    }
    const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
    const base = defaultGovernanceRemediationConfig();
    const primaryHost = parsed?.primaryHost && isHostKind(parsed.primaryHost) ? parsed.primaryHost : base.primaryHost;
    const packetHosts = uniqueHosts(Array.isArray(parsed?.packetHosts)
        ? parsed.packetHosts.filter((host) => typeof host === 'string' && isHostKind(host))
        : base.packetHosts);
    const execution = parsed?.execution ?? base.execution;
    if (parsed?.execution &&
        typeof parsed.execution === 'object' &&
        'authoritativeHost' in parsed.execution &&
        typeof parsed.execution.authoritativeHost === 'string' &&
        !isHostKind(parsed.execution.authoritativeHost)) {
        throw new Error(`Invalid governance-remediation execution.authoritativeHost: ${parsed.execution.authoritativeHost}`);
    }
    const authoritativeHost = execution &&
        typeof execution === 'object' &&
        typeof execution.authoritativeHost === 'string' &&
        isHostKind(execution.authoritativeHost)
        ? execution.authoritativeHost
        : primaryHost;
    const fallbackHosts = uniqueHosts(Array.isArray(execution?.fallbackHosts)
        ? execution.fallbackHosts.filter((host) => typeof host === 'string' && isHostKind(host))
        : (base.execution?.fallbackHosts ?? [])).filter((host) => host !== authoritativeHost);
    const provider = {
        ...base.provider,
        ...(parsed?.provider ?? {}),
    };
    return {
        version: parsed?.version === 2 ? 2 : 1,
        primaryHost,
        packetHosts: packetHosts.length > 0 ? packetHosts : [primaryHost],
        execution: {
            enabled: typeof execution?.enabled === 'boolean'
                ? execution.enabled
                : (base.execution?.enabled ?? false),
            interactiveMode: execution &&
                typeof execution === 'object' &&
                typeof execution.interactiveMode === 'string' &&
                execution.interactiveMode === 'main-agent'
                ? 'main-agent'
                : (base.execution?.interactiveMode ?? 'main-agent'),
            fallbackAutonomousMode: false,
            authoritativeHost,
            fallbackHosts,
            dispatch: {
                leaseTimeoutSeconds: Number(execution?.dispatch?.leaseTimeoutSeconds) > 0
                    ? Number(execution?.dispatch?.leaseTimeoutSeconds)
                    : (base.execution?.dispatch.leaseTimeoutSeconds ?? 900),
                heartbeatIntervalSeconds: Number(execution?.dispatch?.heartbeatIntervalSeconds) > 0
                    ? Number(execution?.dispatch?.heartbeatIntervalSeconds)
                    : (base.execution?.dispatch.heartbeatIntervalSeconds ?? 60),
                maxDispatchAttempts: Number(execution?.dispatch?.maxDispatchAttempts) > 0
                    ? Number(execution?.dispatch?.maxDispatchAttempts)
                    : (base.execution?.dispatch.maxDispatchAttempts ?? 3),
            },
            execution: {
                timeoutMinutes: Number(execution?.execution?.timeoutMinutes) > 0
                    ? Number(execution?.execution?.timeoutMinutes)
                    : (base.execution?.execution.timeoutMinutes ?? 30),
                maxExecutionAttempts: Number(execution?.execution?.maxExecutionAttempts) > 0
                    ? Number(execution?.execution?.maxExecutionAttempts)
                    : (base.execution?.execution.maxExecutionAttempts ?? 2),
            },
            rerunGate: {
                required: typeof execution?.rerunGate?.required === 'boolean'
                    ? execution.rerunGate.required
                    : (base.execution?.rerunGate.required ?? true),
                autoSchedule: typeof execution?.rerunGate?.autoSchedule === 'boolean'
                    ? execution.rerunGate.autoSchedule
                    : (base.execution?.rerunGate.autoSchedule ?? true),
                maxGateRetries: Number(execution?.rerunGate?.maxGateRetries) > 0
                    ? Number(execution?.rerunGate?.maxGateRetries)
                    : (base.execution?.rerunGate.maxGateRetries ?? 2),
            },
            escalation: {
                afterDispatchFailures: Number(execution?.escalation?.afterDispatchFailures) > 0
                    ? Number(execution?.escalation?.afterDispatchFailures)
                    : (base.execution?.escalation.afterDispatchFailures ?? 3),
                afterExecutionFailures: Number(execution?.escalation?.afterExecutionFailures) > 0
                    ? Number(execution?.escalation?.afterExecutionFailures)
                    : (base.execution?.escalation.afterExecutionFailures ?? 2),
                afterGateFailures: Number(execution?.escalation?.afterGateFailures) > 0
                    ? Number(execution?.escalation?.afterGateFailures)
                    : (base.execution?.escalation.afterGateFailures ?? 2),
            },
            projections: {
                emitNonAuthoritativePackets: typeof execution?.projections?.emitNonAuthoritativePackets === 'boolean'
                    ? execution.projections.emitNonAuthoritativePackets
                    : (base.execution?.projections.emitNonAuthoritativePackets ?? true),
                archivePath: typeof execution?.projections?.archivePath === 'string' &&
                    execution.projections.archivePath.trim() !== ''
                    ? execution.projections.archivePath
                    : (base.execution?.projections.archivePath ??
                        '_bmad-output/runtime/governance/archive'),
            },
        },
        provider: {
            ...provider,
            id: provider.id || base.provider.id,
            mode: provider.mode || base.provider.mode,
        },
    };
}
function createGovernanceProviderAdapterFromConfig(config) {
    switch (config.provider.mode) {
        case 'stub':
            return (0, governance_provider_adapter_1.createStubGovernanceProviderAdapter)(config.provider.stubCandidate ?? null, config.provider.id);
        case 'http-json': {
            if (!config.provider.endpoint) {
                throw new Error('governance-remediation provider.endpoint is required for http-json mode');
            }
            const providerConfig = {
                id: config.provider.id,
                endpoint: config.provider.endpoint,
                displayName: config.provider.displayName,
                timeoutMs: config.provider.timeoutMs,
                headers: config.provider.headers,
                method: config.provider.method,
            };
            return (0, governance_provider_adapter_1.createHttpJsonGovernanceProviderAdapter)(providerConfig);
        }
        case 'openai-compatible': {
            if (!config.provider.baseUrl || !config.provider.model) {
                throw new Error('governance-remediation provider.baseUrl and provider.model are required for openai-compatible mode');
            }
            const apiKey = config.provider.apiKey ??
                (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : undefined);
            const providerConfig = {
                id: config.provider.id,
                baseUrl: config.provider.baseUrl,
                model: config.provider.model,
                apiKey,
                timeoutMs: config.provider.timeoutMs,
                headers: config.provider.headers,
                displayName: config.provider.displayName,
                systemPrompt: config.provider.systemPrompt,
            };
            return (0, governance_provider_adapter_1.createOpenAICompatibleGovernanceProviderAdapter)(providerConfig);
        }
        case 'anthropic-compatible': {
            if (!config.provider.baseUrl || !config.provider.model) {
                throw new Error('governance-remediation provider.baseUrl and provider.model are required for anthropic-compatible mode');
            }
            const apiKey = config.provider.apiKey ??
                (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : undefined);
            const providerConfig = {
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
            return (0, governance_provider_adapter_1.createAnthropicCompatibleGovernanceProviderAdapter)(providerConfig);
        }
        default:
            return undefined;
    }
}
