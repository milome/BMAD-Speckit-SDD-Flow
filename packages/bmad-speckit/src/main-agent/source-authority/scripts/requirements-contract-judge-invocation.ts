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

export type RequirementsContractJudgeJsonRecord = Record<string, unknown>;

type JudgeFunction = (input: {
  providerRef: string;
  provider: RequirementsContractJudgeJsonRecord;
  credential?: unknown;
  payload: {
    systemPrompt: string;
    request: RequirementsContractJudgeJsonRecord;
    executionContext?: RequirementsContractJudgeJsonRecord;
    structuredOutputSchema?: RequirementsContractJudgeJsonRecord;
  };
}) => Promise<unknown>;

export interface PreparedRequirementsContractJudgeInvocation {
  configPath: string;
  judgeRuntime: RequirementsContractJudgeJsonRecord;
  providerRef: string;
  provider: RequirementsContractJudgeJsonRecord;
  providerRegistryHash: string;
  credentialProviderRef: string;
  credentialRevision: unknown;
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
  const normalized = record(
    value,
    'requirements_contract_judge_normalized_response_invalid'
  );
  const schemaFile = normalized.schemaVersion === 'requirements-contract-judge-response/v2'
    ? 'requirements-contract-judge-response.schema.json'
    : 'requirements-contract-normalized-judge-response.schema.json';
  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'schemas',
        schemaFile
      ),
      'utf8'
    )
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
  const judgeRuntime = record(
    config.judgeRuntime,
    'requirements_contract_judge_runtime_missing'
  );
  const registry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime,
    runtime: judgeRuntime,
  }, {
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
  });
  const selection = await resolveRequirementsContractJudgeProvider({
    registry,
    judgeRuntime,
    runtime: judgeRuntime,
    activeProviderRef: judgeRuntime.activeProviderRef,
  });
  const provider = record(
    selection.provider,
    'requirements_contract_judge_provider_missing'
  );
  const adapter = record(
    selection.adapter,
    'requirements_contract_judge_adapter_missing'
  );
  if (typeof adapter.judge !== 'function') {
    throw new Error('requirements_contract_judge_adapter_missing');
  }
  const providerRef = requiredText(
    selection.providerRef,
    'requirements_contract_judge_provider_ref_missing'
  );
  const cliTransport = provider.transport === 'claude-code-cli';
  const authentication = cliTransport
    ? record(
        provider.authentication,
        'requirements_contract_judge_authentication_missing'
      )
    : null;
  const hostManagedCliSession =
    cliTransport && authentication?.type === 'claude_code_session';
  const credential = hostManagedCliSession
    ? null
    : await resolveRequirementsContractJudgeCredential({
        cwd: root,
        config: relativeSlash(root, configPath),
      });
  const credentialProviderRef = hostManagedCliSession
    ? providerRef
    : requiredText(
        credential?.providerRef,
        'requirements_contract_judge_credential_provider_ref_missing'
      );
  const credentialRevision = hostManagedCliSession
    ? Number(authentication?.sessionRevision)
    : credential?.credentialRevision;
  if (!Number.isInteger(credentialRevision) || Number(credentialRevision) < 1) {
    throw new Error('requirements_contract_judge_credential_revision_invalid');
  }
  const providerRegistryHash = requiredText(
    registry.registryHash,
    'requirements_contract_judge_provider_registry_hash_missing'
  );
  const judge = adapter.judge as JudgeFunction;
  return {
    configPath,
    judgeRuntime,
    providerRef,
    provider,
    providerRegistryHash,
    credentialProviderRef,
    credentialRevision,
    invoke: async ({ systemPrompt, request, executionContext, structuredOutputSchema }) => {
      if (!systemPrompt.trim()) {
        throw new Error('requirements_contract_judge_system_prompt_missing');
      }
      return validateNormalizedResponse(
        await judge({
          providerRef,
          provider,
          ...(credential ? { credential: credential.credentialHandle } : {}),
          payload: {
            systemPrompt,
            request,
            ...(executionContext ? { executionContext } : {}),
            ...(structuredOutputSchema ? { structuredOutputSchema } : {}),
          },
        })
      );
    },
  };
}

export async function invokePreparedRequirementsContractJudgeRequest(input: {
  prepared: PreparedRequirementsContractJudgeInvocation;
  request: RequirementsContractJudgeJsonRecord;
  providerSelection: RequirementsContractJudgeJsonRecord;
  executionContext?: RequirementsContractJudgeJsonRecord;
}): Promise<RequirementsContractJudgeJsonRecord> {
  const request = verifyRequirementsContractJudgeRequest(input.request);
  const provider = record(
    input.prepared.provider,
    'requirements_contract_judge_provider_missing'
  );
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
  return input.prepared.invoke({
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
  });
}
