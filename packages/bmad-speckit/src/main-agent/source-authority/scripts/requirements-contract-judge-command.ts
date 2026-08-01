import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type {
  ClaudeCodeCliCommandInvocation,
  ClaudeCodeCliCommandResult,
} from './requirements-contract-claude-code-cli-judge-adapter';
import type {
  CodexCliCommandInvocation,
  CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import {
  prepareRequirementsContractJudgeInvocation,
  type RequirementsContractJudgeJsonRecord,
} from './requirements-contract-judge-invocation';
import { assertRequirementsContractJudgeInvocationReadiness } from './requirements-contract-judge-invocation-readiness-gate';
import {
  REQUIREMENTS_CONTRACT_JUDGE_ROLES,
  type RequirementsContractJudgeRole,
} from './requirements-contract-judge-role';
import { canonicalJson, sha256, writeGovernedJson } from './requirements-contract-governed-write';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;
type JudgeDecision = 'pass' | 'block' | 'inconclusive';

export interface RequirementsContractJudgeRunCommandOptions {
  projectRoot: string;
  config: string;
  request: string;
  role: RequirementsContractJudgeRole;
  attemptId: string;
  outputDir: string;
  json?: boolean;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
}

const PUBLIC_ARG_KEYS = new Set([
  'project-root',
  'config',
  'request',
  'role',
  'attempt-id',
  'output-dir',
  'json',
]);
const OPTION_KEYS = new Set([
  'projectRoot',
  'config',
  'request',
  'role',
  'attemptId',
  'outputDir',
  'json',
  'executeClaudeCodeCliCommand',
  'executeCodexCliCommand',
]);
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

function judgeRole(value: unknown, missingCode: string): RequirementsContractJudgeRole {
  const role = text(value, missingCode);
  if (!REQUIREMENTS_CONTRACT_JUDGE_ROLES.includes(role as RequirementsContractJudgeRole)) {
    throw new Error('requirements_contract_judge_command_role_pin_mismatch');
  }
  return role as RequirementsContractJudgeRole;
}

function rejectObjectOverrides(input: JsonRecord): void {
  for (const key of Object.keys(input)) {
    if (!OPTION_KEYS.has(key)) {
      if (AUTHORITY_OVERRIDE_KEYS.includes(key as (typeof AUTHORITY_OVERRIDE_KEYS)[number])) {
        throw new Error(`requirements_contract_judge_command_authority_override:${key}`);
      }
      throw new Error(`requirements_contract_judge_command_arg_forbidden:${key}`);
    }
  }
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

function assertRealPathWithin(root: string, targetPath: string, code: string): void {
  const rootReal = fs.realpathSync.native(root);
  const targetReal = fs.realpathSync.native(targetPath);
  const relative = path.relative(rootReal, targetReal);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(code);
  }
}

function assertWritablePathRealParentWithin(root: string, targetPath: string, code: string): void {
  let cursor = path.resolve(targetPath);
  while (!fs.existsSync(cursor)) {
    const next = path.dirname(cursor);
    if (next === cursor) throw new Error(code);
    cursor = next;
  }
  assertRealPathWithin(root, cursor, code);
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

let cachedAttemptKeyValidator: ReturnType<Ajv2020['compile']> | null = null;

function attemptKeyValidator() {
  if (cachedAttemptKeyValidator) return cachedAttemptKeyValidator;
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-attempt-key.schema.json'
  );
  cachedAttemptKeyValidator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object
  );
  return cachedAttemptKeyValidator;
}

function validateAttemptKey(value: unknown): JsonRecord {
  const attemptKey = record(value, 'requirements_contract_judge_command_attempt_key_missing');
  const validate = attemptKeyValidator();
  if (!validate(attemptKey)) {
    throw new Error(
      `requirements_contract_judge_command_attempt_key_schema_invalid:${JSON.stringify(
        validate.errors ?? []
      )}`
    );
  }
  return attemptKey;
}

function requestAuthorityEnvelope(requestEnvelope: JsonRecord): JsonRecord {
  const { readinessReceipt: _readinessReceipt, requestHash: _requestHash, ...authority } =
    requestEnvelope;
  return authority;
}

function requireEqual(
  actual: unknown,
  expected: unknown,
  code: string
): void {
  if (actual !== expected) throw new Error(code);
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
    if (!PUBLIC_ARG_KEYS.has(key)) {
      throw new Error(`requirements_contract_judge_command_arg_forbidden:${key}`);
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
    role: judgeRole(parsed.role, 'requirements_contract_judge_command_role_missing'),
    attemptId: text(parsed['attempt-id'], 'requirements_contract_judge_command_attempt_missing'),
    outputDir: text(parsed['output-dir'], 'requirements_contract_judge_command_output_missing'),
    json: parsed.json === true,
  };
}

export async function requirementsContractJudgeRunCommand(
  options: RequirementsContractJudgeRunCommandOptions
) {
  rejectObjectOverrides(options as unknown as JsonRecord);
  const root = path.resolve(options.projectRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('requirements_contract_judge_command_project_root_missing');
  }
  assertRealPathWithin(root, root, 'requirements_contract_judge_command_project_root_escape');
  const requestPath = resolveWithin(root, options.request);
  assertRealPathWithin(root, requestPath, 'requirements_contract_judge_command_request_path_escape');
  assertWritablePathRealParentWithin(
    root,
    path.resolve(root, options.outputDir, 'judge-run-result.json'),
    'requirements_contract_judge_command_output_path_escape'
  );
  const requestEnvelope = readJson(requestPath);
  const requestRole = judgeRole(
    requestEnvelope.role,
    'requirements_contract_judge_command_request_role_missing'
  );
  const expectedRole = judgeRole(
    options.role,
    'requirements_contract_judge_command_role_missing'
  );
  if (requestRole !== expectedRole) {
    throw new Error('requirements_contract_judge_command_role_pin_mismatch');
  }
  const attemptKey = validateAttemptKey(requestEnvelope.attemptKey);
  const readinessReceipt = record(
    requestEnvelope.readinessReceipt,
    'requirements_contract_judge_command_readiness_missing'
  );
  if (attemptKey.attemptId !== options.attemptId || attemptKey.judgeRole !== requestRole) {
    throw new Error('requirements_contract_judge_command_attempt_key_mismatch');
  }
  requireEqual(
    requestEnvelope.sourceAuthorityHash,
    attemptKey.sourceAuthorityHash,
    'requirements_contract_judge_command_source_authority_mismatch'
  );
  requireEqual(
    requestEnvelope.sourceDocumentHash,
    readinessReceipt.sourceDocumentHash,
    'requirements_contract_judge_command_source_document_mismatch'
  );
  requireEqual(
    requestEnvelope.semanticModelHash,
    readinessReceipt.semanticModelHash,
    'requirements_contract_judge_command_semantic_model_mismatch'
  );
  requireEqual(
    requestEnvelope.projectionSetHash,
    readinessReceipt.projectionSetHash,
    'requirements_contract_judge_command_projection_set_mismatch'
  );
  requireEqual(
    requestEnvelope.scopeManifestHash,
    attemptKey.scopeManifestHash,
    'requirements_contract_judge_command_scope_mismatch'
  );
  requireEqual(
    requestEnvelope.scopeManifestHash,
    readinessReceipt.scopeHash,
    'requirements_contract_judge_command_scope_mismatch'
  );
  const systemPrompt = text(
    requestEnvelope.systemPrompt,
    'requirements_contract_judge_command_system_prompt_missing'
  );
  requireEqual(
    sha256(systemPrompt),
    attemptKey.promptTemplateHash,
    'requirements_contract_judge_command_prompt_hash_mismatch'
  );
  const structuredOutputSchema = requestEnvelope.structuredOutputSchema
    ? record(
        requestEnvelope.structuredOutputSchema,
        'requirements_contract_judge_command_schema_invalid'
      )
    : null;
  if (structuredOutputSchema) {
    requireEqual(
      sha256(canonicalJson(structuredOutputSchema)),
      attemptKey.assessmentSchemaHash,
      'requirements_contract_judge_command_schema_hash_mismatch'
    );
  }
  assertRequirementsContractJudgeInvocationReadiness({
    readinessReceipt,
    scope: {
      requestHash: requestEnvelope.requestHash,
      sourceDocumentHash: requestEnvelope.sourceDocumentHash,
      semanticModelHash: requestEnvelope.semanticModelHash,
      projectionSetHash: requestEnvelope.projectionSetHash,
      scopeHash: requestEnvelope.scopeManifestHash ?? requestEnvelope.scopeHash,
    },
    providerInvocationCount: 0,
  });
  const prepared = await prepareRequirementsContractJudgeInvocation({
    projectRoot: root,
    config: options.config,
    executeClaudeCodeCliCommand: options.executeClaudeCodeCliCommand,
    executeCodexCliCommand: options.executeCodexCliCommand,
  });
  const provider = prepared.provider as JsonRecord;
  requireEqual(
    attemptKey.providerRegistryHash,
    prepared.providerRegistryHash,
    'requirements_contract_judge_command_provider_registry_hash_mismatch'
  );
  requireEqual(
    readinessReceipt.providerRegistryHash,
    prepared.providerRegistryHash,
    'requirements_contract_judge_command_provider_registry_hash_mismatch'
  );
  requireEqual(
    attemptKey.providerConfigurationHash,
    sha256Stable(provider),
    'requirements_contract_judge_command_provider_configuration_hash_mismatch'
  );
  requireEqual(
    requestEnvelope.requestHash,
    sha256(canonicalJson(requestAuthorityEnvelope(requestEnvelope))),
    'requirements_contract_judge_command_request_hash_mismatch'
  );
  const payload = {
    systemPrompt,
    request: requestEnvelope,
    executionContext: {
      projectRoot: root,
      requestPath,
      outputDir: resolveWithin(root, options.outputDir),
      command: 'bmad-speckit judge run',
      role: requestRole,
      attemptId: options.attemptId,
    },
    ...(structuredOutputSchema
      ? {
          structuredOutputSchema,
        }
      : {}),
  };
  const response = (await prepared.invoke(payload)) as RequirementsContractJudgeJsonRecord;
  const decision = normalizedDecision(response);
  const exitCode = processExitCode(decision);
  const result = {
    schemaVersion: 'requirements-contract-judge-command-result/v1',
    command: 'bmad-speckit judge run',
    role: requestRole,
    attemptId: options.attemptId,
    providerRef: prepared.providerRef,
    transport: provider.transport,
    adapterRef: adapterRefForTransport(provider.transport, provider.adapterRef),
    providerRegistryHash: prepared.providerRegistryHash,
    credentialProviderRef: prepared.credentialProviderRef,
    credentialRevision: prepared.credentialRevision,
    requestHash: requestEnvelope.requestHash,
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
