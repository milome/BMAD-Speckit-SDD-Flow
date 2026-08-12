import * as fs from 'node:fs';
import * as path from 'node:path';
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
  invokePreparedRequirementsContractJudgeRequest,
  type PreparedRequirementsContractJudgeInvocation,
  type RequirementsContractJudgeJsonRecord,
} from './requirements-contract-judge-invocation';
import type { RequirementsContractJudgeRole } from './requirements-contract-judge-role';
import { verifyRequirementsContractJudgeRequest } from './requirements-contract-judge-request-identity';
import { canonicalJson, sha256, writeGovernedJson } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;
type JudgeVerdict = 'pass' | 'fail';

export async function requirementsContractJudgeRunFrozenRequest(input: {
  prepared: PreparedRequirementsContractJudgeInvocation;
  request: RequirementsContractJudgeJsonRecord;
  providerSelection: RequirementsContractJudgeJsonRecord;
  executionContext?: RequirementsContractJudgeJsonRecord;
}) {
  return invokePreparedRequirementsContractJudgeRequest(input);
}

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
  if (role !== 'requirements_critical_auditor') {
    throw new Error('requirements_contract_judge_command_role_pin_mismatch');
  }
  return 'requirements_critical_auditor';
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

function processExitCode(verdict: JudgeVerdict): number {
  return verdict === 'pass' ? 0 : 1;
}

function normalizedVerdict(value: unknown): JudgeVerdict {
  const response = record(value, 'requirements_contract_judge_command_response_invalid');
  if (!['pass', 'fail'].includes(String(response.verdict))) {
    throw new Error('requirements_contract_judge_command_response_invalid');
  }
  return response.verdict as JudgeVerdict;
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
  const request = verifyRequirementsContractJudgeRequest(readJson(requestPath));
  const requestRole = judgeRole(
    options.role,
    'requirements_contract_judge_command_role_missing'
  );
  const prepared = await prepareRequirementsContractJudgeInvocation({
    projectRoot: root,
    config: options.config,
    executeClaudeCodeCliCommand: options.executeClaudeCodeCliCommand,
    executeCodexCliCommand: options.executeCodexCliCommand,
  });
  const provider = prepared.provider as JsonRecord;
  const response = await requirementsContractJudgeRunFrozenRequest({
    prepared,
    request,
    providerSelection: request.providerSelection,
    executionContext: {
      projectRoot: root,
      requestPath,
      outputDir: resolveWithin(root, options.outputDir),
      command: 'bmad-speckit judge run',
      role: requestRole,
      attemptId: options.attemptId,
    },
  });
  const verdict = normalizedVerdict(response);
  const exitCode = processExitCode(verdict);
  const result = {
    schemaVersion: 'requirements-contract-judge-command-result/v2',
    command: 'bmad-speckit judge run',
    role: requestRole,
    attemptId: options.attemptId,
    providerRef: prepared.providerRef,
    transport: provider.transport,
    adapterRef: adapterRefForTransport(provider.transport, provider.adapterRef),
    providerRegistryHash: prepared.providerRegistryHash,
    credentialProviderRef: prepared.credentialProviderRef,
    credentialRevision: prepared.credentialRevision,
    judgeRequestHash: request.judgeRequestHash,
    responseHash: sha256(canonicalJson(response)),
    verdict,
    processExitCode: exitCode,
    processStatusParity:
      (verdict === 'pass' && exitCode === 0) || (verdict === 'fail' && exitCode === 1),
  };
  const outputPath = path.resolve(root, options.outputDir, 'judge-run-result.json');
  writeGovernedJson(outputPath, result);
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
