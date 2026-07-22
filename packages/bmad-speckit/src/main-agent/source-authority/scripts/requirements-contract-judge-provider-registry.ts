import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import { AnthropicCompatibleJudgeAdapter } from './requirements-contract-anthropic-compatible-judge-adapter';
import {
  createClaudeCodeCliJudgeAdapter,
  type ClaudeCodeCliJudgeAdapterDependencies,
} from './requirements-contract-claude-code-cli-judge-adapter';
import { OpenAICompatibleJudgeAdapter } from './requirements-contract-openai-compatible-judge-adapter';

type JsonRecord = Record<string, unknown>;
type JudgeAdapter =
  | typeof OpenAICompatibleJudgeAdapter
  | typeof AnthropicCompatibleJudgeAdapter
  | ReturnType<typeof createClaudeCodeCliJudgeAdapter>;

export interface RequirementsContractJudgeProviderRegistryDependencies {
  claudeCodeCli?: ClaudeCodeCliJudgeAdapterDependencies;
}

const OVERRIDE_KEYS = [
  'provider',
  'providerRef',
  'model',
  'baseUrl',
  'apiKey',
  'credentialPath',
  'endpoint',
] as const;
const OVERRIDE_ENV =
  /^(?:BMAD_)?JUDGE_(?:PROVIDER|PROVIDER_REF|MODEL|BASE_URL|API_KEY|CREDENTIAL_PATH|ENDPOINT)$/u;
export const REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry.ts';
export const REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_CONFIG_PATH =
  '_bmad/_config/governance-remediation.yaml';
export const REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_CANONICAL_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json';

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function rejectOverrides(input: JsonRecord): void {
  const environmentOverride = Object.keys(process.env).find((key) => OVERRIDE_ENV.test(key));
  if (environmentOverride) {
    throw new Error(`judge_provider_environment_override:${environmentOverride}`);
  }
  if (OVERRIDE_KEYS.some((key) => Object.hasOwn(input, key) && input[key] !== undefined)) {
    throw new Error('judge_provider_cli_override');
  }
}

function runtimeFrom(input: JsonRecord): JsonRecord {
  if (
    input.judgeRuntime !== undefined &&
    input.runtime !== undefined &&
    sha256Stable(input.judgeRuntime) !== sha256Stable(input.runtime)
  ) {
    throw new Error('judge_provider_runtime_conflict');
  }
  const runtime = record(input.judgeRuntime ?? input.runtime, 'judge_provider_runtime_invalid');
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-runtime.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(runtime)) {
    throw new Error(
      `judge_provider_runtime_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  return runtime;
}

function adapterFor(
  provider: JsonRecord,
  dependencies: RequirementsContractJudgeProviderRegistryDependencies
): {
  adapterRef: string;
  adapter: JudgeAdapter;
} {
  if (provider.transport === 'openai-compatible' && provider.apiStyle === 'chat_completions') {
    return {
      adapterRef: 'OpenAICompatibleJudgeAdapter',
      adapter: OpenAICompatibleJudgeAdapter,
    };
  }
  if (provider.transport === 'anthropic-compatible' && provider.apiStyle === 'messages') {
    return {
      adapterRef: 'AnthropicCompatibleJudgeAdapter',
      adapter: AnthropicCompatibleJudgeAdapter,
    };
  }
  if (provider.transport === 'claude-code-cli' && provider.apiStyle === 'cli') {
    return {
      adapterRef: 'ClaudeCodeCliJudgeAdapter',
      adapter: createClaudeCodeCliJudgeAdapter(dependencies.claudeCodeCli),
    };
  }
  throw new Error('judge_provider_adapter_binding_missing');
}

function sha256File(root: string, relativePath: string): string {
  return `sha256:${createHash('sha256')
    .update(fs.readFileSync(path.resolve(root, relativePath)))
    .digest('hex')}`;
}

export function createRequirementsContractJudgeProviderRegistry(
  input: JsonRecord,
  dependencies: RequirementsContractJudgeProviderRegistryDependencies = {}
) {
  rejectOverrides(input);
  const runtime = runtimeFrom(input);
  const activeProviderRef = runtime.activeProviderRef;
  const providers = record(runtime.providers, 'judge_provider_registry_invalid');
  if (typeof activeProviderRef !== 'string' || !Object.hasOwn(providers, activeProviderRef)) {
    throw new Error('judge_provider_active_ref_missing');
  }
  const bindings = Object.fromEntries(
    Object.entries(providers).map(([providerRef, value]) => {
      const provider = record(value, 'judge_provider_definition_invalid');
      const binding = adapterFor(provider, dependencies);
      return [providerRef, { providerRef, provider, ...binding }];
    })
  );
  const descriptors = Object.values(bindings).map((value) => {
    const binding = value as JsonRecord;
    return {
      providerRef: binding.providerRef,
      provider: binding.provider,
      adapterRef: binding.adapterRef,
    };
  });
  return {
    schemaVersion: 'requirements-contract-judge-provider-registry-runtime/v1',
    activeProviderRef,
    providers: bindings,
    registryHash: sha256Stable({ activeProviderRef, descriptors }),
  };
}

export function createRequirementsContractJudgeProviderRegistryProjection(root = process.cwd()) {
  const configPath = path.resolve(root, REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_CONFIG_PATH);
  const publicConfig = record(
    yaml.load(fs.readFileSync(configPath, 'utf8')),
    'judge_provider_public_configuration_invalid'
  );
  const runtime = runtimeFrom({ judgeRuntime: publicConfig.judgeRuntime });
  const registry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: runtime,
  });
  const providers = Object.values(registry.providers).map((value) => {
    const binding = value as JsonRecord;
    return {
      providerRef: binding.providerRef,
      provider: binding.provider,
      adapterRef: binding.adapterRef,
    };
  });
  return {
    schemaVersion: 'requirements-contract-judge-provider-registry/v1',
    owner: {
      path: REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_OWNER_PATH,
      hash: sha256File(root, REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_OWNER_PATH),
    },
    sourceConfig: {
      path: REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_CONFIG_PATH,
      hash: sha256File(root, REQUIREMENTS_CONTRACT_JUDGE_PROVIDER_REGISTRY_CONFIG_PATH),
    },
    activeProviderRef: registry.activeProviderRef,
    providers,
    registryHash: registry.registryHash,
  } as const;
}

export async function resolveRequirementsContractJudgeProvider(input: JsonRecord) {
  rejectOverrides(input);
  const runtime = runtimeFrom(input);
  const configuredRef = runtime.activeProviderRef;
  if (input.activeProviderRef !== undefined && input.activeProviderRef !== configuredRef) {
    throw new Error('judge_provider_cli_override');
  }
  const registry = record(input.registry, 'judge_provider_registry_invalid');
  if (registry.activeProviderRef !== configuredRef) {
    throw new Error('judge_provider_registry_selection_mismatch');
  }
  const providers = record(registry.providers, 'judge_provider_registry_invalid');
  if (typeof configuredRef !== 'string' || !Object.hasOwn(providers, configuredRef)) {
    throw new Error('judge_provider_active_ref_missing');
  }
  const selection = record(providers[configuredRef], 'judge_provider_active_ref_missing');
  const provider = record(selection.provider, 'judge_provider_definition_invalid');
  if (provider.enabled !== true) throw new Error('judge_provider_active_provider_disabled');
  return {
    providerRef: configuredRef,
    provider,
    adapterRef: selection.adapterRef,
    adapter: selection.adapter,
  };
}
