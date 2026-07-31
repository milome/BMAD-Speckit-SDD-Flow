import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  prepareRequirementsContractJudgeInvocation,
  type RequirementsContractJudgeJsonRecord,
} from './requirements-contract-judge-invocation';
import { assertRequirementsContractJudgeInvocationReadiness } from './requirements-contract-judge-invocation-readiness-gate';
import { canonicalJson, sha256, writeGovernedJson } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;
type JudgeDecision = 'pass' | 'block' | 'inconclusive';

export interface RequirementsContractJudgeRunCommandOptions {
  projectRoot: string;
  config: string;
  request: string;
  role: 'requirements';
  attemptId: string;
  outputDir: string;
  json?: boolean;
  invokeJudge?: (input: {
    providerRef: string;
    provider: JsonRecord;
    payload: {
      systemPrompt: string;
      request: JsonRecord;
      executionContext?: JsonRecord;
      structuredOutputSchema?: JsonRecord;
    };
  }) => Promise<JsonRecord>;
}

const AUTHORITY_OVERRIDE_KEYS = [
  'provider',
  'providerRef',
  'model',
  'endpoint',
  'baseUrl',
  'apiKey',
  'key',
  'prompt',
  'systemPrompt',
  'schema',
  'structuredOutputSchema',
  'expectedVerdict',
  'expected-verdict',
  'scope',
  'evidence',
  'counter',
  'success',
] as const;

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function rejectObjectOverrides(input: JsonRecord): void {
  for (const key of AUTHORITY_OVERRIDE_KEYS) {
    if (Object.hasOwn(input, key) && input[key] !== undefined) {
      throw new Error(`requirements_contract_judge_command_authority_override:${key}`);
    }
  }
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`requirements_contract_judge_command_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function processExitCode(decision: JudgeDecision): number {
  return decision === 'pass' ? 0 : 1;
}

function normalizedDecision(value: unknown): JudgeDecision {
  const response = record(value, 'requirements_contract_judge_command_response_invalid');
  if (!['pass', 'block', 'inconclusive'].includes(String(response.decision))) {
    throw new Error('requirements_contract_judge_command_response_invalid');
  }
  return response.decision as JudgeDecision;
}

function adapterRefForTransport(transport: unknown, adapterRef: unknown): string {
  if (typeof adapterRef === 'string' && adapterRef.length > 0) return adapterRef;
  if (transport === 'openai-compatible') return 'OpenAICompatibleJudgeAdapter';
  if (transport === 'anthropic-compatible') return 'AnthropicCompatibleJudgeAdapter';
  if (transport === 'claude-code-cli') return 'ClaudeCodeCliJudgeAdapter';
  if (transport === 'cli') return 'CodexCliJudgeAdapter';
  throw new Error('requirements_contract_judge_command_adapter_missing');
}

export function parseRequirementsContractJudgeRunArgv(
  argv: string[]
): RequirementsContractJudgeRunCommandOptions {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`requirements_contract_judge_command_arg_invalid:${arg}`);
    }
    const key = arg.slice(2);
    if (AUTHORITY_OVERRIDE_KEYS.includes(key as (typeof AUTHORITY_OVERRIDE_KEYS)[number])) {
      throw new Error(`requirements_contract_judge_command_authority_override:${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`requirements_contract_judge_command_arg_missing:${key}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return {
    projectRoot: text(
      parsed['project-root'],
      'requirements_contract_judge_command_project_root_missing'
    ),
    config: text(parsed.config, 'requirements_contract_judge_command_config_missing'),
    request: text(parsed.request, 'requirements_contract_judge_command_request_missing'),
    role: text(parsed.role, 'requirements_contract_judge_command_role_missing') as 'requirements',
    attemptId: text(parsed['attempt-id'], 'requirements_contract_judge_command_attempt_missing'),
    outputDir: text(parsed['output-dir'], 'requirements_contract_judge_command_output_missing'),
    json: parsed.json === true,
  };
}

export async function requirementsContractJudgeRunCommand(
  options: RequirementsContractJudgeRunCommandOptions
) {
  rejectObjectOverrides(options as unknown as JsonRecord);
  if (options.role !== 'requirements') {
    throw new Error('requirements_contract_judge_command_role_pin_mismatch');
  }
  const root = path.resolve(options.projectRoot);
  const requestPath = resolveWithin(root, options.request);
  const requestEnvelope = readJson(requestPath);
  const requestRole = text(
    requestEnvelope.role,
    'requirements_contract_judge_command_request_role_missing'
  );
  if (requestRole !== options.role) {
    throw new Error('requirements_contract_judge_command_role_pin_mismatch');
  }
  const attemptKey = record(
    requestEnvelope.attemptKey,
    'requirements_contract_judge_command_attempt_key_missing'
  );
  if (attemptKey.attemptId !== options.attemptId || attemptKey.role !== requestRole) {
    throw new Error('requirements_contract_judge_command_attempt_key_mismatch');
  }
  assertRequirementsContractJudgeInvocationReadiness({
    readinessReceipt: record(
      requestEnvelope.readinessReceipt,
      'requirements_contract_judge_command_readiness_missing'
    ),
    scope: {
      requestHash: attemptKey.requestHash,
      sourceDocumentHash: attemptKey.sourceDocumentHash,
      semanticModelHash: attemptKey.semanticModelHash,
      projectionSetHash: attemptKey.projectionSetHash,
      scopeHash: requestEnvelope.scopeHash ?? requestEnvelope.readinessReceipt?.scopeHash,
    },
    providerInvocationCount: 0,
  });
  const prepared = await prepareRequirementsContractJudgeInvocation({
    projectRoot: root,
    config: options.config,
  });
  const provider = prepared.provider as JsonRecord;
  const payload = {
    systemPrompt: text(
      requestEnvelope.systemPrompt,
      'requirements_contract_judge_command_system_prompt_missing'
    ),
    request: requestEnvelope,
    executionContext: {
      projectRoot: root,
      requestPath,
      outputDir: resolveWithin(root, options.outputDir),
      command: 'bmad-speckit judge run',
      role: options.role,
      attemptId: options.attemptId,
    },
    ...(requestEnvelope.structuredOutputSchema
      ? {
          structuredOutputSchema: record(
            requestEnvelope.structuredOutputSchema,
            'requirements_contract_judge_command_schema_invalid'
          ),
        }
      : {}),
  };
  const response = options.invokeJudge
    ? await options.invokeJudge({
        providerRef: prepared.providerRef,
        provider,
        payload,
      })
    : ((await prepared.invoke(payload)) as RequirementsContractJudgeJsonRecord);
  const decision = normalizedDecision(response);
  const exitCode = processExitCode(decision);
  const result = {
    schemaVersion: 'requirements-contract-judge-command-result/v1',
    command: 'bmad-speckit judge run',
    role: options.role,
    attemptId: options.attemptId,
    providerRef: prepared.providerRef,
    transport: provider.transport,
    adapterRef: adapterRefForTransport(provider.transport, provider.adapterRef),
    providerRegistryHash: prepared.providerRegistryHash,
    credentialProviderRef: prepared.credentialProviderRef,
    credentialRevision: prepared.credentialRevision,
    requestHash: sha256(canonicalJson(payload.request)),
    responseHash: sha256(canonicalJson(response)),
    jsonDecision: decision,
    processExitCode: exitCode,
    processStatusParity:
      (decision === 'pass' && exitCode === 0) || (decision !== 'pass' && exitCode === 1),
    decision,
  };
  const outputPath = path.resolve(root, options.outputDir, 'judge-run-result.json');
  writeGovernedJson(outputPath, result);
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
