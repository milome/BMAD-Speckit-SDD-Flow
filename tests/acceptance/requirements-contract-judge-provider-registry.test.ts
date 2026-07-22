import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

type JsonRecord = Record<string, unknown>;
type RegistryFactory = (input: JsonRecord) => unknown | Promise<unknown>;
type ProviderResolver = (input: JsonRecord) => unknown | Promise<unknown>;
type RegistryProjectionFactory = (root?: string) => unknown | Promise<unknown>;

const REGISTRY_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry.ts'
);
const RUNTIME_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-runtime.schema.json'
);
const REGISTRY_PROJECTION_PATH = path.resolve(
  '_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json'
);
const REGISTRY_PROJECTION_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-provider-registry.schema.json'
);
const PROJECTION_REGISTRY_PATH = path.resolve(
  '_bmad/shared/requirements-contract/requirements-contract-projection-registry.json'
);
const CONSUMER_REGISTRY_PATH = path.resolve(
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
);

function provider(
  transport: 'openai-compatible' | 'anthropic-compatible',
  apiStyle: 'chat_completions' | 'messages',
  model: string,
  baseUrl: string
) {
  return {
    enabled: true,
    transport,
    apiStyle,
    model,
    credentialRef: model,
    endpoint: {
      baseUrl,
      resolutionMode: 'transport_managed',
      routingOwnership: 'transport_adapter',
      upstreamVersioning: 'gateway_managed',
      explicitOperationPath: null,
    },
    authentication: {
      type: transport === 'openai-compatible' ? 'bearer' : 'api_key',
      sensitivity: 'secret',
      arbitraryNonEmptyValueAllowed: false,
    },
    auditPolicy: {
      independenceClass: 'different_provider_different_model',
      blindReview: true,
      allowPassAuthority: false,
      toolsAllowed: false,
      implementationWritesAllowed: false,
    },
    requestPolicy: {
      timeoutMs: 10_000,
      maximumAttempts: 1,
      structuredResponseRequired: true,
    },
  };
}

function runtime(activeProviderRef: 'provider-a' | 'provider-b') {
  return {
    schemaVersion: 'requirements-contract-judge-runtime/v1',
    enabled: true,
    activeProviderRef,
    selectionPolicy: {
      mode: 'contract_locked',
      runtimeFallbackAllowed: false,
      runtimeAutoDiscoveryAllowed: false,
      environmentOverrideAllowed: false,
      cliTransportAllowed: false,
      selectionReceiptRequired: true,
    },
    credentialConfig: {
      source: 'config_file',
      path: '_bmad-output/config/private/judge-provider.credentials.yaml',
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      allowedRoot: '_bmad-output/config/private',
      environmentFallbackAllowed: false,
    },
    providers: {
      'provider-a': provider(
        'openai-compatible',
        'chat_completions',
        'judge-model-a',
        'https://judge-a.example.test'
      ),
      'provider-b': provider(
        'anthropic-compatible',
        'messages',
        'judge-model-b',
        'https://judge-b.example.test'
      ),
    },
  };
}

async function loadRegistryModule(): Promise<JsonRecord | null> {
  expect(existsSync(REGISTRY_PATH), `Judge provider registry is missing: ${REGISTRY_PATH}`).toBe(
    true
  );
  if (!existsSync(REGISTRY_PATH)) return null;
  return (await import(pathToFileURL(REGISTRY_PATH).href)) as JsonRecord;
}

function exportedFunction<T>(loaded: JsonRecord, name: string): T | null {
  const selected = loaded[name];
  expect(selected, `missing function export: ${name}`).toBeTypeOf('function');
  return (selected ?? null) as T | null;
}

function selectedProvider(value: unknown): JsonRecord {
  const record = value as JsonRecord;
  const provider = record.provider ?? record.definition ?? record;
  expect(provider).toBeTypeOf('object');
  expect(provider).not.toBeNull();
  return provider as JsonRecord;
}

describe('requirements contract Judge provider registry', () => {
  it('publishes the deterministic production Provider/Adapter registry projection', async () => {
    expect(existsSync(REGISTRY_PROJECTION_SCHEMA_PATH)).toBe(true);
    expect(existsSync(REGISTRY_PROJECTION_PATH)).toBe(true);
    const loaded = await loadRegistryModule();
    if (
      !loaded ||
      !existsSync(REGISTRY_PROJECTION_SCHEMA_PATH) ||
      !existsSync(REGISTRY_PROJECTION_PATH)
    ) {
      return;
    }
    const createProjection = exportedFunction<RegistryProjectionFactory>(
      loaded,
      'createRequirementsContractJudgeProviderRegistryProjection'
    );
    if (!createProjection) return;

    const projection = JSON.parse(readFileSync(REGISTRY_PROJECTION_PATH, 'utf8')) as JsonRecord;
    const schema = JSON.parse(readFileSync(REGISTRY_PROJECTION_SCHEMA_PATH, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(projection), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(projection).toEqual(await createProjection(process.cwd()));
    expect(projection).toMatchObject({
      schemaVersion: 'requirements-contract-judge-provider-registry/v1',
      activeProviderRef: 'local-sonnet-judge',
      providers: [
        {
          providerRef: 'local-sonnet-judge',
          adapterRef: 'ClaudeCodeCliJudgeAdapter',
          provider: {
            transport: 'claude-code-cli',
            apiStyle: 'cli',
            model: 'claude-sonnet-5',
            endpoint: {
              command: 'claude',
              resolutionMode: 'path_search',
              routingOwnership: 'transport_adapter',
              upstreamVersioning: 'cli_managed',
              explicitOperationPath: null,
            },
          },
        },
      ],
    });
    expect(JSON.stringify(projection)).not.toMatch(
      /apiKey|authorization|\/chat\/completions|\/messages/u
    );
  });

  it('validates configuration-only switching between registered providers', () => {
    expect(existsSync(RUNTIME_SCHEMA_PATH)).toBe(true);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(RUNTIME_SCHEMA_PATH, 'utf8')));

    expect(validate(runtime('provider-a')), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(runtime('provider-b')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('registers the Judge projection, resolver, Provider registry, Adapters, and Probe consumer', () => {
    expect(existsSync(PROJECTION_REGISTRY_PATH)).toBe(true);
    expect(existsSync(CONSUMER_REGISTRY_PATH)).toBe(true);
    if (!existsSync(PROJECTION_REGISTRY_PATH) || !existsSync(CONSUMER_REGISTRY_PATH)) {
      return;
    }

    const projectionRegistry = JSON.parse(readFileSync(PROJECTION_REGISTRY_PATH, 'utf8')) as {
      projections: Array<{ projectionId: string; canonicalPath: string }>;
    };
    const consumerRegistry = JSON.parse(readFileSync(CONSUMER_REGISTRY_PATH, 'utf8')) as {
      consumers: Array<{ consumerId: string; path: string }>;
    };

    expect(projectionRegistry.projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectionId: 'judge_provider_registry',
          canonicalPath:
            '_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json',
        }),
      ])
    );
    expect(consumerRegistry.consumers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          consumerId: 'judge-credential-resolver',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-credential-resolver.ts',
        }),
        expect.objectContaining({
          consumerId: 'judge-provider-registry',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry.ts',
        }),
        expect.objectContaining({
          consumerId: 'openai-compatible-judge-adapter',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter.ts',
        }),
        expect.objectContaining({
          consumerId: 'anthropic-compatible-judge-adapter',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-anthropic-compatible-judge-adapter.ts',
        }),
        expect.objectContaining({
          consumerId: 'claude-code-cli-judge-adapter',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter.ts',
        }),
        expect.objectContaining({
          consumerId: 'judge-provider-smoke',
          path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-smoke.ts',
        }),
      ])
    );
  });

  it('registers Provider and Adapter bindings and selects only activeProviderRef', async () => {
    const loaded = await loadRegistryModule();
    if (!loaded) return;
    const createRegistry = exportedFunction<RegistryFactory>(
      loaded,
      'createRequirementsContractJudgeProviderRegistry'
    );
    const resolveProvider = exportedFunction<ProviderResolver>(
      loaded,
      'resolveRequirementsContractJudgeProvider'
    );
    if (!createRegistry || !resolveProvider) return;

    const runtimeA = runtime('provider-a');
    const registryA = await createRegistry({
      judgeRuntime: runtimeA,
      runtime: runtimeA,
    });
    const selectionA = (await resolveProvider({
      registry: registryA,
      judgeRuntime: runtimeA,
      runtime: runtimeA,
      activeProviderRef: runtimeA.activeProviderRef,
    })) as JsonRecord;
    const providerA = selectedProvider(selectionA);

    expect(selectionA.providerRef ?? providerA.providerRef ?? providerA.id).toBe('provider-a');
    expect(providerA.transport).toBe('openai-compatible');
    expect(providerA.apiStyle).toBe('chat_completions');
    expect(providerA.model).toBe('judge-model-a');
    expect(selectionA.adapterRef ?? selectionA.adapterId ?? providerA.adapterRef).toBeDefined();

    const runtimeB = runtime('provider-b');
    const registryB = await createRegistry({
      judgeRuntime: runtimeB,
      runtime: runtimeB,
    });
    const selectionB = (await resolveProvider({
      registry: registryB,
      judgeRuntime: runtimeB,
      runtime: runtimeB,
      activeProviderRef: runtimeB.activeProviderRef,
    })) as JsonRecord;
    const providerB = selectedProvider(selectionB);

    expect(selectionB.providerRef ?? providerB.providerRef ?? providerB.id).toBe('provider-b');
    expect(providerB.transport).toBe('anthropic-compatible');
    expect(providerB.apiStyle).toBe('messages');
    expect(providerB.model).toBe('judge-model-b');
    expect(selectionB.adapterRef ?? selectionB.adapterId ?? providerB.adapterRef).toBeDefined();
  });

  it('rejects CLI selection overrides instead of manufacturing a Provider choice', async () => {
    const loaded = await loadRegistryModule();
    if (!loaded) return;
    const createRegistry = exportedFunction<RegistryFactory>(
      loaded,
      'createRequirementsContractJudgeProviderRegistry'
    );
    const resolveProvider = exportedFunction<ProviderResolver>(
      loaded,
      'resolveRequirementsContractJudgeProvider'
    );
    if (!createRegistry || !resolveProvider) return;

    const configured = runtime('provider-b');
    const registry = await createRegistry({
      judgeRuntime: configured,
      runtime: configured,
    });

    await expect(
      resolveProvider({
        registry,
        judgeRuntime: configured,
        runtime: configured,
        activeProviderRef: configured.activeProviderRef,
        providerRef: 'provider-a',
        provider: 'provider-a',
        baseUrl: 'https://cli-override.example.test',
      })
    ).rejects.toThrow(/judge_provider_cli_override/u);
  });
});
