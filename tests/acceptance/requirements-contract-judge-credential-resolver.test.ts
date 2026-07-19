import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

type JsonRecord = Record<string, unknown>;
type CredentialResolver = (input: JsonRecord) => unknown | Promise<unknown>;

const ROOTS: string[] = [];
const RESOLVER_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-credential-resolver.ts'
);

function asRecord(value: unknown): JsonRecord {
  expect(value).toBeTypeOf('object');
  expect(value).not.toBeNull();
  return value as JsonRecord;
}

async function loadResolver(): Promise<CredentialResolver | null> {
  const exists = await import('node:fs').then(({ existsSync }) => existsSync(RESOLVER_PATH));
  expect(exists, `Judge credential resolver is missing: ${RESOLVER_PATH}`).toBe(true);
  if (!exists) return null;

  const loaded = (await import(pathToFileURL(RESOLVER_PATH).href)) as JsonRecord;
  const resolver = loaded.resolveRequirementsContractJudgeCredential;
  expect(resolver).toBeTypeOf('function');
  return resolver as CredentialResolver;
}

function provider(credentialRef: string, authenticationType: 'bearer' | 'api_key' = 'bearer') {
  return {
    enabled: true,
    transport: 'openai-compatible',
    apiStyle: 'chat_completions',
    model: 'judge-model-a',
    credentialRef,
    endpoint: {
      baseUrl: 'https://judge.example.test',
      resolutionMode: 'transport_managed',
      routingOwnership: 'transport_adapter',
      upstreamVersioning: 'gateway_managed',
      explicitOperationPath: null,
    },
    authentication: {
      type: authenticationType,
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

function runtimeConfig(options?: {
  activeProviderRef?: string;
  allowedRoot?: string;
  credentialPath?: string;
  credentialRef?: string;
  authenticationType?: 'bearer' | 'api_key';
}) {
  const providerRef = options?.activeProviderRef ?? 'provider-a';
  const credentialRef = options?.credentialRef ?? providerRef;
  return {
    judgeRuntime: {
      schemaVersion: 'requirements-contract-judge-runtime/v1',
      enabled: true,
      activeProviderRef: providerRef,
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
        path:
          options?.credentialPath ?? '_bmad-output/config/private/judge-provider.credentials.yaml',
        schemaVersion: 'requirements-contract-judge-credentials/v1',
        allowedRoot: options?.allowedRoot ?? '_bmad-output/config/private',
        environmentFallbackAllowed: false,
      },
      providers: {
        [providerRef]: provider(credentialRef, options?.authenticationType ?? 'bearer'),
      },
    },
  };
}

function createFixture(
  config: JsonRecord,
  credentials?: JsonRecord
): { root: string; configPath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'judge-credential-resolver-'));
  ROOTS.push(root);
  const configPath = path.join(root, 'judge-runtime.yaml');
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), 'utf8');
  if (credentials) {
    const credentialPath = path.join(
      root,
      '_bmad-output',
      'config',
      'private',
      'judge-provider.credentials.yaml'
    );
    mkdirSync(path.dirname(credentialPath), { recursive: true });
    writeFileSync(credentialPath, yaml.dump(credentials, { lineWidth: -1 }), 'utf8');
  }
  return { root, configPath };
}

function credentialValue(resolution: JsonRecord): unknown {
  return (
    resolution.apiKey ?? resolution.credential ?? resolution.credentialValue ?? resolution.value
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of ROOTS.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('requirements contract Judge credential resolver', () => {
  it('resolves the active provider credential from the configured private root', async () => {
    const resolver = await loadResolver();
    if (!resolver) return;
    const fakeCredential = 'fixture-private-credential';
    const fixture = createFixture(runtimeConfig(), {
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 7,
      providers: {
        'provider-a': {
          authenticationType: 'bearer',
          apiKey: fakeCredential,
        },
      },
    });

    const resolved = asRecord(
      await resolver({
        cwd: fixture.root,
        config: path.relative(fixture.root, fixture.configPath),
      })
    );

    expect(resolved.providerRef).toBe('provider-a');
    expect(resolved.authenticationType).toBe('bearer');
    expect(resolved.credentialRevision).toBe(7);
    expect(credentialValue(resolved)).toBeUndefined();
    expect(resolved.credentialHandle).toBeTypeOf('object');
    expect(JSON.stringify(resolved)).not.toContain(fakeCredential);
    expect(JSON.stringify(resolved)).not.toContain('apiKey');
  });

  it.each([
    {
      label: 'credential path outside allowed private root',
      config: runtimeConfig({
        credentialPath: '_bmad-output/config/judge-provider.credentials.yaml',
      }),
      expected: /judge_credential_(?:private_path_outside_allowed_root|path_escape)/u,
    },
    {
      label: 'allowed root outside the project root',
      config: runtimeConfig({ allowedRoot: '../private' }),
      expected: /judge_credential_path_escape/u,
    },
    {
      label: 'credential path outside the project root',
      config: runtimeConfig({
        credentialPath: '../judge-provider.credentials.yaml',
      }),
      expected: /judge_credential_path_escape/u,
    },
  ])('rejects $label', async ({ config, expected }) => {
    const resolver = await loadResolver();
    if (!resolver) return;
    const fixture = createFixture(config);

    await expect(
      resolver({
        cwd: fixture.root,
        config: path.relative(fixture.root, fixture.configPath),
      })
    ).rejects.toThrow(expected);
  });

  it('rejects a missing provider credential and an authentication mismatch', async () => {
    const resolver = await loadResolver();
    if (!resolver) return;
    const missing = createFixture(runtimeConfig(), {
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 1,
      providers: {
        'provider-b': {
          authenticationType: 'bearer',
          apiKey: 'unselected-fixture-value',
        },
      },
    });
    await expect(
      resolver({
        cwd: missing.root,
        config: path.relative(missing.root, missing.configPath),
      })
    ).rejects.toThrow(/judge_credential_(?:missing|provider_missing)/u);

    const mismatch = createFixture(runtimeConfig(), {
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 1,
      providers: {
        'provider-a': {
          authenticationType: 'api_key',
          apiKey: 'authentication-mismatch-fixture-value',
        },
      },
    });
    await expect(
      resolver({
        cwd: mismatch.root,
        config: path.relative(mismatch.root, mismatch.configPath),
      })
    ).rejects.toThrow(/judge_credential_authentication_(?:mismatch|invalid)/u);
  });

  it('rejects environment and CLI credential/provider overrides', async () => {
    const resolver = await loadResolver();
    if (!resolver) return;
    const fixture = createFixture(runtimeConfig(), {
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      credentialRevision: 1,
      providers: {
        'provider-a': {
          authenticationType: 'bearer',
          apiKey: 'configured-fixture-value',
        },
      },
    });
    vi.stubEnv('BMAD_JUDGE_PROVIDER', 'provider-from-environment');
    vi.stubEnv('BMAD_JUDGE_API_KEY', 'environment-fixture-value');
    vi.stubEnv('BMAD_JUDGE_BASE_URL', 'https://environment.example.test');

    await expect(
      resolver({
        cwd: fixture.root,
        config: path.relative(fixture.root, fixture.configPath),
      })
    ).rejects.toThrow(/judge_(?:credential|provider)_environment_override/u);

    vi.unstubAllEnvs();
    await expect(
      resolver({
        cwd: fixture.root,
        config: path.relative(fixture.root, fixture.configPath),
        providerRef: 'provider-from-cli',
        apiKey: 'cli-fixture-value',
        baseUrl: 'https://cli.example.test',
      })
    ).rejects.toThrow(/judge_(?:credential|provider)_cli_override/u);
  });
});
