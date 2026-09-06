import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import yaml from 'js-yaml';
import { resolveRequirementsContractJudgeCredential } from './requirements-contract-judge-credential-resolver';
import {
  createRequirementsContractJudgeProviderRegistry,
  resolveRequirementsContractJudgeProvider,
} from './requirements-contract-judge-provider-registry';
import type {
  ClaudeCodeCliCommandInvocation,
  ClaudeCodeCliCommandResult,
} from './requirements-contract-claude-code-cli-judge-adapter';
import type {
  CodexCliCommandInvocation,
  CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import {
  createRequirementsContractJudgeSelectionReceipt,
  resolveRequirementsContractJudgeAdapterRef,
} from './requirements-contract-judge-selection';
import { verifyRequirementsContractJudgeRequest } from './requirements-contract-judge-request-identity';
import { canonicalJson } from './requirements-contract-governed-write';
import {
  assertJudgePayloadUnchanged,
  type JudgePayloadPreflight,
} from './requirements-contract-judge-payload-budget';

export type RequirementsContractJudgeJsonRecord = Record<string, unknown>;

type JudgeFunction = (input: {
  providerRef: string;
  provider: RequirementsContractJudgeJsonRecord;
  credential?: unknown;
  expectedPreflight?: JudgePayloadPreflight;
  payload: {
    systemPrompt: string;
    request: RequirementsContractJudgeJsonRecord;
    executionContext?: RequirementsContractJudgeJsonRecord;
    structuredOutputSchema?: RequirementsContractJudgeJsonRecord;
  };
}) => Promise<unknown>;

export interface RequirementsContractJudgeInvocationPayload {
  systemPrompt: string;
  request: RequirementsContractJudgeJsonRecord;
  executionContext?: RequirementsContractJudgeJsonRecord;
  structuredOutputSchema?: RequirementsContractJudgeJsonRecord;
}

export interface PreparedRequirementsContractJudgeInvocation {
  configPath: string;
  judgeRuntime: RequirementsContractJudgeJsonRecord;
  providerRef: string;
  provider: RequirementsContractJudgeJsonRecord;
  providerRegistryHash: string;
  credentialProviderRef: string;
  credentialRevision: unknown;
  preflight(input: RequirementsContractJudgeInvocationPayload): JudgePayloadPreflight;
  invoke(input: {
    systemPrompt: string;
    request: RequirementsContractJudgeJsonRecord;
    executionContext?: RequirementsContractJudgeJsonRecord;
    structuredOutputSchema?: RequirementsContractJudgeJsonRecord;
  }): Promise<RequirementsContractJudgeJsonRecord>;
}

function record(value: unknown, code: string): RequirementsContractJudgeJsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as RequirementsContractJudgeJsonRecord;
}

function requiredText(value: unknown, code: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(code);
  return normalized;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_contract_judge_config_path_escape');
  }
  return resolved;
}

function relativeSlash(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/gu, '/');
}

function validateNormalizedResponse(value: unknown): RequirementsContractJudgeJsonRecord {
  const normalized = record(value, 'requirements_contract_judge_normalized_response_invalid');
  const schemaFile =
    normalized.schemaVersion === 'requirements-contract-judge-response/v2'
      ? 'requirements-contract-judge-response.schema.json'
      : 'requirements-contract-normalized-judge-response.schema.json';
  const schema = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'schemas', schemaFile), 'utf8')
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(normalized)) {
    const error = new Error(
      `requirements_contract_judge_normalized_response_invalid:${JSON.stringify(
        validate.errors ?? []
      )}`
    ) as Error & { rawResponse?: RequirementsContractJudgeJsonRecord };
    error.rawResponse = normalized;
    throw error;
  }
  return normalized;
}

export async function prepareRequirementsContractJudgeInvocation(input: {
  projectRoot: string;
  config: string;
  deferCredentialResolution?: boolean;
  resolveCredential?: typeof resolveRequirementsContractJudgeCredential;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
}): Promise<PreparedRequirementsContractJudgeInvocation> {
  const root = path.resolve(input.projectRoot);
  const configPath = resolveWithin(root, input.config);
  const config = record(
    yaml.load(fs.readFileSync(configPath, 'utf8')),
    'requirements_contract_judge_configuration_invalid'
  );
  const judgeRuntime = record(config.judgeRuntime, 'requirements_contract_judge_runtime_missing');
  const registry = createRequirementsContractJudgeProviderRegistry(
    {
      judgeRuntime,
      runtime: judgeRuntime,
    },
    {
      ...(input.executeClaudeCodeCliCommand
        ? {
            claudeCodeCli: {
              executeCommand: input.executeClaudeCodeCliCommand,
            },
          }
        : {}),
      ...(input.executeCodexCliCommand
        ? {
            codexCli: {
              executeCommand: input.executeCodexCliCommand,
            },
          }
        : {}),
    }
  );
  const selection = await resolveRequirementsContractJudgeProvider({
    registry,
    judgeRuntime,
    runtime: judgeRuntime,
    activeProviderRef: judgeRuntime.activeProviderRef,
  });
  const provider = record(selection.provider, 'requirements_contract_judge_provider_missing');
  const adapter = record(selection.adapter, 'requirements_contract_judge_adapter_missing');
  if (typeof adapter.judge !== 'function' || typeof adapter.preflight !== 'function') {
    throw new Error('requirements_contract_judge_adapter_missing');
  }
  const providerRef = requiredText(
    selection.providerRef,
    'requirements_contract_judge_provider_ref_missing'
  );
  const cliTransport = provider.transport === 'claude-code-cli';
  const authentication = cliTransport
    ? record(provider.authentication, 'requirements_contract_judge_authentication_missing')
    : null;
  const hostManagedCliSession = cliTransport && authentication?.type === 'claude_code_session';
  const resolveCredential = input.resolveCredential ?? resolveRequirementsContractJudgeCredential;
  let credential = hostManagedCliSession || input.deferCredentialResolution
    ? null
    : await resolveCredential({ cwd: root, config: relativeSlash(root, configPath) });
  const credentialProviderRef = hostManagedCliSession
    ? providerRef
    : credential ? requiredText(
        credential?.providerRef,
        'requirements_contract_judge_credential_provider_ref_missing'
      ) : providerRef;
  const credentialRevision = hostManagedCliSession
    ? Number(authentication?.sessionRevision)
    : credential?.credentialRevision ?? null;
  if (!input.deferCredentialResolution && (!Number.isInteger(credentialRevision) || Number(credentialRevision) < 1)) {
    throw new Error('requirements_contract_judge_credential_revision_invalid');
  }
  const providerRegistryHash = requiredText(
    registry.registryHash,
    'requirements_contract_judge_provider_registry_hash_missing'
  );
  const judge = adapter.judge as JudgeFunction;
  const adapterPreflight = adapter.preflight as (input: {
    provider: RequirementsContractJudgeJsonRecord;
    payload: RequirementsContractJudgeInvocationPayload;
  }) => JudgePayloadPreflight;
  const plans = new WeakMap<RequirementsContractJudgeJsonRecord, JudgePayloadPreflight>();
  const preflight = (payload: RequirementsContractJudgeInvocationPayload) => {
    const assessment = adapterPreflight({ provider, payload });
    assertJudgePayloadUnchanged(plans.get(payload.request), assessment);
    plans.set(payload.request, assessment);
    return assessment;
  };
  return {
    configPath,
    judgeRuntime,
    providerRef,
    provider,
    providerRegistryHash,
    credentialProviderRef,
    credentialRevision,
    preflight,
    invoke: async ({ systemPrompt, request, executionContext, structuredOutputSchema }) => {
      if (!systemPrompt.trim()) {
        throw new Error('requirements_contract_judge_system_prompt_missing');
      }
      const payload = {
        systemPrompt,
        request,
        ...(executionContext ? { executionContext } : {}),
        ...(structuredOutputSchema ? { structuredOutputSchema } : {}),
      };
      const assessment = adapterPreflight({ provider, payload });
      assertJudgePayloadUnchanged(plans.get(request), assessment);
      if (!hostManagedCliSession && credential === null) {
        credential = await resolveCredential({ cwd: root, config: relativeSlash(root, configPath) });
        if (
          requiredText(
            credential?.providerRef,
            'requirements_contract_judge_credential_provider_ref_missing'
          ) !== providerRef ||
          !Number.isInteger(credential?.credentialRevision) ||
          Number(credential?.credentialRevision) < 1
        ) {
          throw new Error('requirements_contract_judge_credential_revision_invalid');
        }
      }
      return validateNormalizedResponse(
        await judge({
          providerRef,
          provider,
          ...(credential ? { credential: credential.credentialHandle } : {}),
          expectedPreflight: assessment,
          payload,
        })
      );
    },
  };
}

export function buildPreparedRequirementsContractJudgeInvocationPayload(input: {
  prepared: PreparedRequirementsContractJudgeInvocation;
  request: RequirementsContractJudgeJsonRecord;
  providerSelection: RequirementsContractJudgeJsonRecord;
  executionContext?: RequirementsContractJudgeJsonRecord;
}): RequirementsContractJudgeInvocationPayload {
  const request = verifyRequirementsContractJudgeRequest(input.request);
  const provider = record(input.prepared.provider, 'requirements_contract_judge_provider_missing');
  const adapterRef = resolveRequirementsContractJudgeAdapterRef(provider);
  const expectedSelection = createRequirementsContractJudgeSelectionReceipt({
    providerRef: input.prepared.providerRef,
    provider,
    adapterRef,
    providerRegistryHash: input.prepared.providerRegistryHash,
  });
  if (
    canonicalJson(expectedSelection) !== canonicalJson(input.providerSelection) ||
    canonicalJson(request.providerSelection) !== canonicalJson(input.providerSelection)
  ) {
    throw new Error('requirements_contract_judge_frozen_selection_mismatch');
  }
  const prompt = record(request.prompt, 'requirements_contract_judge_request_prompt_invalid');
  return {
    systemPrompt: requiredText(
      prompt.systemPrompt,
      'requirements_contract_judge_system_prompt_missing'
    ),
    request,
    ...(input.executionContext ? { executionContext: input.executionContext } : {}),
    structuredOutputSchema: record(
      prompt.structuredOutputSchema,
      'requirements_contract_judge_response_schema_invalid'
    ),
  };
}

export async function invokePreparedRequirementsContractJudgeRequest(
  input: Parameters<typeof buildPreparedRequirementsContractJudgeInvocationPayload>[0]
): Promise<RequirementsContractJudgeJsonRecord> {
  const payload = buildPreparedRequirementsContractJudgeInvocationPayload(input);
  input.prepared.preflight(payload);
  return input.prepared.invoke(payload);
}
