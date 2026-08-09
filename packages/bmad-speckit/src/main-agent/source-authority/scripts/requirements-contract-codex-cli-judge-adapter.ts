import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { readRequirementsContractJudgeCredentialSecret } from './requirements-contract-judge-credential-resolver';

type JsonRecord = Record<string, unknown>;
type CodexCliExecutorKind = 'native_spawn' | 'injected_test_transport';
type CodexCliCommandResolution =
  | 'path_search_executable'
  | 'windows_npm_shim'
  | 'injected_test_transport';

export interface CodexCliCommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  outputPath: string;
  stdoutPath?: string;
  stderrPath?: string;
  transcriptPath?: string;
}

export interface CodexCliCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  processId?: number;
  commandResolution?: CodexCliCommandResolution;
  launchCommand?: string;
  launchArgs?: string[];
  launchEntryPath?: string | null;
}

export interface CodexCliJudgeAdapterDependencies {
  executeCommand?: (invocation: CodexCliCommandInvocation) => Promise<CodexCliCommandResult>;
  readCredentialSecret?: (credential: unknown) => string;
}

export interface CodexCliJudgeArgsInput {
  cwd: string;
  outputSchemaPath: string;
  outputLastMessagePath: string;
  configuredModel: string | null;
}

interface AdapterInput {
  providerRef?: string;
  provider: JsonRecord;
  credential?: unknown;
  payload?: unknown;
}

interface ExecutionContext {
  projectRoot: string;
  requestPath: string;
  outputDir: string;
}

interface CredentialBinding {
  env: NodeJS.ProcessEnv;
  credentialRevision: number;
  credentialEnvironmentVariable: string;
  runtimeHomePath: string;
  runtimeConfigHash: string;
}

interface CodexCliLaunch {
  command: string;
  args: string[];
  commandResolution: Exclude<CodexCliCommandResolution, 'injected_test_transport'>;
  launchEntryPath: string | null;
}

const HASH_PREFIX = 'sha256:';
const MAX_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;
const ALLOWED_TOOLS = ['Read'] as const;
const ASSESSMENT_VERDICTS = [
  'no_new_valid_gap',
  'no_new_confirmation_blocking_gap',
  'new_valid_gap',
  'insufficient_audit',
  'blocked',
] as const;
const DEFAULT_STRUCTURED_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'findings', 'challengeRequests', 'evidenceRefs'],
  properties: {
    decision: {
      type: 'string',
      enum: ['pass', 'block', 'inconclusive'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'verdict'],
        properties: {
          schemaVersion: {
            type: 'string',
            const: 'critical-auditor-judge-assessment/v1',
          },
          verdict: {
            type: 'string',
            enum: ASSESSMENT_VERDICTS,
          },
        },
      },
    },
    challengeRequests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'request'],
        properties: {
          code: { type: 'string', minLength: 1 },
          request: { type: 'string', minLength: 1 },
        },
      },
    },
    evidenceRefs: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecord;
}

function requiredText(value: unknown, code: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(code);
  return normalized;
}

function sha256(value: string | Buffer): string {
  return `${HASH_PREFIX}${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
    .join(',')}}`;
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveWithin(root: string, value: string, code: string): string {
  const resolved = path.resolve(root, value);
  if (!isWithin(root, resolved)) throw new Error(code);
  return resolved;
}

function writeTextAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, target);
}

function writeJsonAtomic(target: string, value: unknown): void {
  writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

function validateInvocationReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-invocation-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(receipt)) {
    throw new Error(
      `codex_cli_judge_invocation_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const unsigned = { ...receipt };
  delete unsigned.receiptHash;
  if (receipt.receiptHash !== sha256(stableStringify(unsigned))) {
    throw new Error('codex_cli_judge_invocation_receipt_hash_mismatch');
  }
}

function writeInvocationReceipt(input: {
  outputDir: string;
  startedAt: string;
  completedAt: string;
  providerRef: string;
  transport: string;
  providerRequestId: string;
  outcome: 'decided' | 'unknown';
  decision: 'pass' | 'block' | 'inconclusive';
  unknownOutcomeReason: string | null;
  normalizedResponseHash: string;
  transportEvidenceHash: string;
}): JsonRecord {
  const payload: JsonRecord = {
    schemaVersion: 'requirements-contract-judge-invocation-receipt/v1',
    invocationId: randomUUID(),
    providerRef: input.providerRef,
    transport: input.transport,
    adapterRef: 'CodexCliJudgeAdapter',
    providerRequestId: input.providerRequestId,
    outcome: input.outcome,
    decision: input.decision,
    unknownOutcomeReason: input.unknownOutcomeReason,
    automaticSemanticRetry: false,
    maximumAttempts: 1,
    attemptOrdinal: 1,
    normalizedResponseHash: input.normalizedResponseHash,
    transportEvidenceHash: input.transportEvidenceHash,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
  const receipt = {
    ...payload,
    receiptHash: sha256(stableStringify(payload)),
  };
  validateInvocationReceipt(receipt);
  writeJsonAtomic(path.join(input.outputDir, 'judge-invocation-receipt.json'), receipt);
  return receipt;
}

function inferJsonSchemaType(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return undefined;
}

function normalizeCodexOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCodexOutputSchema);
  if (!value || typeof value !== 'object') return value;
  const normalized = Object.fromEntries(
    Object.entries(value as JsonRecord).map(([key, child]) => [
      key,
      normalizeCodexOutputSchema(child),
    ])
  ) as JsonRecord;
  if (Object.hasOwn(normalized, 'const') && !Object.hasOwn(normalized, 'type')) {
    const inferred = inferJsonSchemaType(normalized.const);
    if (inferred) normalized.type = inferred;
  }
  return normalized;
}

const UNSUPPORTED_CODEX_SCHEMA_KEYWORDS = new Set([
  'allOf',
  'contains',
  'dependentRequired',
  'dependentSchemas',
  'if',
  'maxItems',
  'minItems',
  'not',
  'patternProperties',
  'then',
  'unevaluatedItems',
  'uniqueItems',
]);

function incompatibleCodexOutputSchema(issue: string, nodePath: string): never {
  throw new Error(`codex_cli_judge_output_schema_incompatible:${issue}:${nodePath}`);
}

function assertCodexOutputSchemaCompatible(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    incompatibleCodexOutputSchema('root', '$');
  }
  const visit = (nodeValue: unknown, nodePath: string): void => {
    if (!nodeValue || typeof nodeValue !== 'object' || Array.isArray(nodeValue)) return;
    const node = nodeValue as JsonRecord;
    for (const keyword of Object.keys(node)) {
      if (UNSUPPORTED_CODEX_SCHEMA_KEYWORDS.has(keyword)) {
        incompatibleCodexOutputSchema(keyword, nodePath);
      }
    }
    if (node.type === 'object') {
      if (node.additionalProperties !== false) {
        incompatibleCodexOutputSchema('additionalProperties', nodePath);
      }
      const properties = record(
        node.properties ?? {},
        'codex_cli_judge_output_schema_incompatible:properties'
      );
      const required = Array.isArray(node.required) ? node.required.map(String) : [];
      if (
        new Set(required).size !== required.length ||
        JSON.stringify([...required].sort()) !== JSON.stringify(Object.keys(properties).sort())
      ) {
        incompatibleCodexOutputSchema('required', nodePath);
      }
      for (const [name, child] of Object.entries(properties)) {
        visit(child, `${nodePath}.properties.${name}`);
      }
    }
    if (node.items !== undefined) visit(node.items, `${nodePath}.items`);
    for (const [name, child] of Object.entries((node.$defs ?? {}) as JsonRecord)) {
      visit(child, `${nodePath}.$defs.${name}`);
    }
    for (const [index, child] of (Array.isArray(node.anyOf) ? node.anyOf : []).entries()) {
      visit(child, `${nodePath}.anyOf[${index}]`);
    }
  };
  const root = value as JsonRecord;
  if (root.type !== 'object') incompatibleCodexOutputSchema('root_type', '$');
  visit(root, '$');
}

function pathLikeKey(key: string): boolean {
  return /(?:path|ref|document|report|receipt|artifact|log)$/iu.test(key);
}

function collectReferencedFiles(
  value: unknown,
  projectRoot: string,
  outputDir: string,
  key = '',
  files = new Set<string>()
): Set<string> {
  if (typeof value === 'string') {
    if (!pathLikeKey(key)) return files;
    const candidate = path.resolve(projectRoot, value);
    if (!isWithin(projectRoot, candidate)) {
      throw new Error('codex_cli_judge_evidence_path_escape');
    }
    if (
      !isWithin(outputDir, candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      files.add(candidate);
    }
    return files;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferencedFiles(item, projectRoot, outputDir, key, files);
    }
    return files;
  }
  if (!value || typeof value !== 'object') return files;
  for (const [childKey, childValue] of Object.entries(value as JsonRecord)) {
    collectReferencedFiles(childValue, projectRoot, outputDir, childKey, files);
  }
  return files;
}

function materializeEvidenceSnapshot(input: { context: ExecutionContext; request: JsonRecord }): {
  snapshotRoot: string;
  manifestPath: string;
  snapshotHash: string;
  readAllowlist: string[];
} {
  const projectRoot = path.resolve(input.context.projectRoot);
  const outputDir = resolveWithin(
    projectRoot,
    input.context.outputDir,
    'codex_cli_judge_output_path_escape'
  );
  const requestPath = resolveWithin(
    projectRoot,
    input.context.requestPath,
    'codex_cli_judge_request_path_escape'
  );
  if (!fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error('codex_cli_judge_request_path_missing');
  }
  const snapshotRoot = path.join(outputDir, 'evidence-snapshot');
  if (fs.existsSync(snapshotRoot)) {
    throw new Error('codex_cli_judge_snapshot_already_exists');
  }
  fs.mkdirSync(snapshotRoot, { recursive: true });
  const referencedFiles = collectReferencedFiles(input.request, projectRoot, outputDir);
  referencedFiles.add(requestPath);
  const entries = [...referencedFiles].sort().map((sourcePath) => {
    if (fs.lstatSync(sourcePath).isSymbolicLink()) {
      throw new Error('codex_cli_judge_evidence_symlink_forbidden');
    }
    const relativePath = slash(path.relative(projectRoot, sourcePath));
    const targetPath = resolveWithin(
      snapshotRoot,
      relativePath,
      'codex_cli_judge_snapshot_path_escape'
    );
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const content = fs.readFileSync(targetPath);
    return {
      path: relativePath,
      hash: sha256(content),
      bytes: content.length,
    };
  });
  const manifest = {
    schemaVersion: 'requirements-contract-cli-judge-evidence-snapshot/v1',
    entries,
  };
  const snapshotHash = sha256(JSON.stringify(manifest));
  const manifestPath = path.join(snapshotRoot, 'snapshot-manifest.json');
  writeJsonAtomic(manifestPath, { ...manifest, snapshotHash });
  return {
    snapshotRoot,
    manifestPath,
    snapshotHash,
    readAllowlist: entries.map((entry) => entry.path),
  };
}

function executionContext(payload: JsonRecord): ExecutionContext {
  const context = record(payload.executionContext, 'codex_cli_judge_execution_context_missing');
  return {
    projectRoot: requiredText(context.projectRoot, 'codex_cli_judge_project_root_missing'),
    requestPath: requiredText(context.requestPath, 'codex_cli_judge_request_path_missing'),
    outputDir: requiredText(context.outputDir, 'codex_cli_judge_output_dir_missing'),
  };
}

function configuredRequestedModel(provider: JsonRecord): string | null {
  const endpoint = record(provider.endpoint, 'codex_cli_judge_endpoint_invalid');
  if (endpoint.upstreamVersioning === 'gateway_managed') {
    if (provider.model !== null && provider.model !== undefined) {
      throw new Error('codex_cli_judge_gateway_model_forbidden');
    }
    return null;
  }
  if (endpoint.upstreamVersioning === 'cli_managed') {
    return requiredText(provider.model, 'codex_cli_judge_model_missing');
  }
  throw new Error('codex_cli_judge_endpoint_invalid');
}

function assertProvider(provider: JsonRecord): void {
  if (
    provider.transport !== 'cli' ||
    provider.adapterRef !== 'CodexCliJudgeAdapter' ||
    provider.apiStyle !== 'cli'
  ) {
    throw new Error('codex_cli_judge_provider_binding_invalid');
  }
  const endpoint = record(provider.endpoint, 'codex_cli_judge_endpoint_invalid');
  if (
    requiredText(endpoint.command, 'codex_cli_judge_command_missing') !== 'codex' ||
    endpoint.resolutionMode !== 'path_search' ||
    endpoint.routingOwnership !== 'transport_adapter' ||
    endpoint.explicitOperationPath !== null
  ) {
    throw new Error('codex_cli_judge_endpoint_invalid');
  }
  configuredRequestedModel(provider);
  const baseUrl = requiredText(endpoint.baseUrl, 'codex_cli_judge_gateway_base_url_missing');
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error('codex_cli_judge_gateway_base_url_invalid');
  }
  const authentication = record(provider.authentication, 'codex_cli_judge_authentication_invalid');
  if (
    !['http:', 'https:'].includes(parsedBaseUrl.protocol) ||
    endpoint.upstreamVersioning !== 'gateway_managed' ||
    !['bearer', 'api_key'].includes(String(authentication.type)) ||
    authentication.sensitivity !== 'secret' ||
    authentication.arbitraryNonEmptyValueAllowed !== false
  ) {
    throw new Error('codex_cli_judge_authentication_invalid');
  }
  const auditPolicy = record(provider.auditPolicy, 'codex_cli_judge_audit_policy_invalid');
  const allowedTools = Array.isArray(auditPolicy.allowedTools)
    ? auditPolicy.allowedTools.map(String)
    : [];
  if (
    auditPolicy.blindReview !== true ||
    auditPolicy.allowPassAuthority !== false ||
    auditPolicy.toolsAllowed !== true ||
    auditPolicy.implementationWritesAllowed !== false ||
    JSON.stringify(allowedTools) !== JSON.stringify(ALLOWED_TOOLS)
  ) {
    throw new Error('codex_cli_judge_audit_policy_invalid');
  }
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function credentialBinding(input: {
  providerRef: string;
  provider: JsonRecord;
  credential: unknown;
  outputDir: string;
  readCredentialSecret: (credential: unknown) => string;
}): CredentialBinding {
  const authentication = record(
    input.provider.authentication,
    'codex_cli_judge_authentication_invalid'
  );
  const endpoint = record(input.provider.endpoint, 'codex_cli_judge_endpoint_invalid');
  const credential = record(input.credential, 'codex_cli_judge_credential_required');
  const credentialRevision = Number(credential.credentialRevision);
  if (
    credential.providerRef !== input.providerRef ||
    credential.credentialRef !== input.provider.credentialRef ||
    credential.authenticationType !== authentication.type ||
    !Number.isInteger(credentialRevision) ||
    credentialRevision < 1
  ) {
    throw new Error('codex_cli_judge_credential_binding_invalid');
  }
  const runtimeHomePath = path.join(input.outputDir, 'codex-home');
  if (fs.existsSync(runtimeHomePath)) {
    throw new Error('codex_cli_judge_runtime_home_already_exists');
  }
  fs.mkdirSync(runtimeHomePath, { recursive: true });
  const credentialEnvironmentVariable = 'BMAD_CODEX_JUDGE_API_KEY';
  const profileId = 'bmad_judge_gateway';
  const configText = [
    `model_provider = ${tomlString(profileId)}`,
    '',
    `[model_providers.${profileId}]`,
    `name = ${tomlString('BMAD Judge Gateway')}`,
    `base_url = ${tomlString(
      requiredText(endpoint.baseUrl, 'codex_cli_judge_gateway_base_url_missing')
    )}`,
    `env_key = ${tomlString(credentialEnvironmentVariable)}`,
    `wire_api = ${tomlString('responses')}`,
    'requires_openai_auth = false',
    'request_max_retries = 0',
    'stream_max_retries = 0',
    '',
  ].join('\n');
  const configPath = path.join(runtimeHomePath, 'config.toml');
  writeTextAtomic(configPath, configText);
  const env = { ...process.env };
  for (const key of [
    'CODEX_HOME',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_ORGANIZATION',
    credentialEnvironmentVariable,
  ]) {
    delete env[key];
  }
  env.CODEX_HOME = runtimeHomePath;
  env[credentialEnvironmentVariable] = input.readCredentialSecret(input.credential);
  return {
    env,
    credentialRevision,
    credentialEnvironmentVariable,
    runtimeHomePath,
    runtimeConfigHash: sha256(configText),
  };
}

export function buildCodexCliJudgePrompt(input: {
  systemPrompt: string;
  request: JsonRecord;
  readAllowlist: string[];
}): string {
  return [
    requiredText(input.systemPrompt, 'codex_cli_judge_system_prompt_missing'),
    'The current working directory is an isolated frozen evidence snapshot.',
    'Operate read-only. Do not modify files, use network tools, or access parent directories.',
    'Inspect every path in the exact allowlist before deciding.',
    'Use only snapshot-relative paths from the allowlist.',
    '<judge-read-allowlist-json>',
    JSON.stringify([...input.readAllowlist].sort()),
    '</judge-read-allowlist-json>',
    '<judge-request-json>',
    JSON.stringify(input.request),
    '</judge-request-json>',
  ].join('\n');
}

export function buildCodexCliJudgeArgs(input: CodexCliJudgeArgsInput): string[] {
  const cwd = requiredText(input.cwd, 'codex_cli_judge_cwd_missing');
  const outputSchemaPath = requiredText(
    input.outputSchemaPath,
    'codex_cli_judge_output_schema_path_missing'
  );
  const outputLastMessagePath = requiredText(
    input.outputLastMessagePath,
    'codex_cli_judge_output_path_missing'
  );
  const args = ['--ask-for-approval', 'never'];
  if (input.configuredModel !== null) {
    args.push('--model', requiredText(input.configuredModel, 'codex_cli_judge_model_missing'));
  }
  args.push(
    'exec',
    '--strict-config',
    '--sandbox',
    'read-only',
    '--ephemeral',
    '--ignore-rules',
    '--skip-git-repo-check',
    '--color',
    'never',
    '--output-schema',
    outputSchemaPath,
    '--output-last-message',
    outputLastMessagePath,
    '--json',
    '--cd',
    cwd,
    '-'
  );
  return args;
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams): void {
  const processId = child.pid;
  if (!processId) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(processId), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(-processId, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function existingFile(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

function executableFile(candidate: string): boolean {
  if (!existingFile(candidate)) return false;
  if (process.platform === 'win32') return true;
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveCodexCliLaunch(invocation: CodexCliCommandInvocation): CodexCliLaunch {
  if (invocation.command !== 'codex') {
    throw new Error('codex_cli_judge_command_not_resolvable');
  }

  const pathValue = invocation.env.PATH ?? invocation.env.Path ?? '';
  const visited = new Set<string>();
  for (const entry of pathValue.split(path.delimiter)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const resolvedEntry = path.resolve(trimmed);
    const identity = process.platform === 'win32' ? resolvedEntry.toLowerCase() : resolvedEntry;
    if (visited.has(identity)) continue;
    visited.add(identity);

    if (process.platform !== 'win32') {
      const executable = path.join(resolvedEntry, 'codex');
      if (!executableFile(executable)) continue;
      return {
        command: executable,
        args: invocation.args,
        commandResolution: 'path_search_executable',
        launchEntryPath: null,
      };
    }

    const nativeExecutable = path.join(resolvedEntry, 'codex.exe');
    if (executableFile(nativeExecutable)) {
      return {
        command: nativeExecutable,
        args: invocation.args,
        commandResolution: 'path_search_executable',
        launchEntryPath: null,
      };
    }

    const npmShim = path.join(resolvedEntry, 'codex.cmd');
    const npmJavaScriptEntry = path.join(
      resolvedEntry,
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js'
    );
    if (existingFile(npmShim) && existingFile(npmJavaScriptEntry)) {
      const resolvedJavaScriptEntry = path.resolve(npmJavaScriptEntry);
      return {
        command: path.resolve(process.execPath),
        args: [resolvedJavaScriptEntry, ...invocation.args],
        commandResolution: 'windows_npm_shim',
        launchEntryPath: resolvedJavaScriptEntry,
      };
    }
  }
  throw new Error('codex_cli_judge_command_not_resolvable');
}

function commandLaunchEvidence(
  execution: CodexCliCommandResult,
  executorKind: CodexCliExecutorKind
): {
  commandResolution: CodexCliCommandResolution;
  launchCommand: string | null;
  launchCommandHash: string | null;
  launchArgv: string[] | null;
  launchEntryPath: string | null;
  launchEntryHash: string | null;
} {
  if (executorKind === 'injected_test_transport') {
    return {
      commandResolution: 'injected_test_transport',
      launchCommand: null,
      launchCommandHash: null,
      launchArgv: null,
      launchEntryPath: null,
      launchEntryHash: null,
    };
  }
  if (
    !['path_search_executable', 'windows_npm_shim'].includes(String(execution.commandResolution))
  ) {
    throw new Error('codex_cli_judge_launch_resolution_missing');
  }
  const launchCommand = path.resolve(
    requiredText(execution.launchCommand, 'codex_cli_judge_launch_command_missing')
  );
  if (!existingFile(launchCommand) || !Array.isArray(execution.launchArgs)) {
    throw new Error('codex_cli_judge_launch_provenance_invalid');
  }
  const commandResolution = execution.commandResolution as Exclude<
    CodexCliCommandResolution,
    'injected_test_transport'
  >;
  const launchEntryPath =
    commandResolution === 'windows_npm_shim'
      ? path.resolve(
          requiredText(execution.launchEntryPath, 'codex_cli_judge_launch_entry_missing')
        )
      : null;
  if (
    (launchEntryPath !== null && !existingFile(launchEntryPath)) ||
    (commandResolution !== 'windows_npm_shim' &&
      execution.launchEntryPath !== null &&
      execution.launchEntryPath !== undefined)
  ) {
    throw new Error('codex_cli_judge_launch_provenance_invalid');
  }
  return {
    commandResolution,
    launchCommand,
    launchCommandHash: sha256(fs.readFileSync(launchCommand)),
    launchArgv: execution.launchArgs.map(String),
    launchEntryPath,
    launchEntryHash: launchEntryPath === null ? null : sha256(fs.readFileSync(launchEntryPath)),
  };
}

export function executeCodexCliCommand(
  invocation: CodexCliCommandInvocation
): Promise<CodexCliCommandResult> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    let launch: CodexCliLaunch;
    try {
      launch = resolveCodexCliLaunch(invocation);
      child = spawn(launch.command, launch.args, {
        cwd: invocation.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
        env: invocation.env,
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      reject(
        new Error(
          `codex_cli_judge_spawn_failed:${error instanceof Error ? error.message : String(error)}`
        )
      );
      return;
    }
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminalError: Error | null = null;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const terminate = (error: Error): void => {
      if (terminalError) return;
      terminalError = error;
      terminateProcessTree(child);
    };
    const timeout = setTimeout(() => {
      terminate(new Error('codex_cli_judge_timeout'));
    }, invocation.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      stdoutBytes += Buffer.byteLength(chunk, 'utf8');
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        terminate(new Error('codex_cli_judge_stdout_limit_exceeded'));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      stderrBytes += Buffer.byteLength(chunk, 'utf8');
      if (stderrBytes > MAX_STDERR_BYTES) {
        terminate(new Error('codex_cli_judge_stderr_limit_exceeded'));
      }
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      finish(() => reject(new Error(`codex_cli_judge_spawn_failed:${error.code ?? 'unknown'}`)));
    });
    child.once('close', (exitCode) => {
      finish(() => {
        if (terminalError) {
          reject(terminalError);
          return;
        }
        resolve({
          exitCode: exitCode ?? -1,
          stdout,
          stderr,
          processId: child.pid,
          commandResolution: launch.commandResolution,
          launchCommand: launch.command,
          launchArgs: launch.args,
          launchEntryPath: launch.launchEntryPath,
        });
      });
    });
    child.stdin.once('error', (error: NodeJS.ErrnoException) => {
      terminate(new Error(`codex_cli_judge_stdin_stream_failed:${error.code ?? 'unknown'}`));
    });
    child.stdin.end(invocation.stdin);
  });
}

function parseTranscript(stdout: string): JsonRecord[] {
  const lines = stdout.split(/\r?\n/gu).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error('codex_cli_judge_transcript_missing');
  return lines.map((line) => {
    try {
      return record(JSON.parse(line), 'codex_cli_judge_transcript_invalid');
    } catch {
      throw new Error('codex_cli_judge_transcript_invalid');
    }
  });
}

function providerRequestId(events: JsonRecord[]): string {
  const ids = events
    .filter((event) => event.type === 'thread.started')
    .map((event) => requiredText(event.thread_id, 'codex_cli_judge_thread_id_missing'));
  if (ids.length !== 1) throw new Error('codex_cli_judge_thread_id_invalid');
  return ids[0];
}

function observedModel(events: JsonRecord[]): string | null {
  const models = new Set<string>();
  for (const event of events) {
    if (
      ['thread.started', 'turn.started', 'turn.completed'].includes(String(event.type)) &&
      typeof event.model === 'string' &&
      event.model.trim()
    ) {
      models.add(event.model.trim());
    }
    if (event.type === 'item.completed') {
      const item =
        event.item && typeof event.item === 'object' && !Array.isArray(event.item)
          ? (event.item as JsonRecord)
          : null;
      if (item && typeof item.model === 'string' && item.model.trim()) {
        models.add(item.model.trim());
      }
    }
  }
  return models.size === 1 ? [...models][0] : null;
}

function structuredDecision(value: unknown): {
  decision: 'pass' | 'block' | 'inconclusive';
  findings: JsonRecord[];
  challengeRequests: JsonRecord[];
  evidenceRefs: string[];
} {
  const parsed = record(value, 'codex_cli_judge_structured_output_invalid');
  const allowedKeys = new Set(['decision', 'findings', 'challengeRequests', 'evidenceRefs']);
  if (
    Object.keys(parsed).some((key) => !allowedKeys.has(key)) ||
    !['pass', 'block', 'inconclusive'].includes(String(parsed.decision)) ||
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.challengeRequests) ||
    !Array.isArray(parsed.evidenceRefs)
  ) {
    throw new Error('codex_cli_judge_structured_output_invalid');
  }
  const findings = parsed.findings.map((finding) =>
    record(finding, 'codex_cli_judge_structured_output_invalid')
  );
  const challengeRequests = parsed.challengeRequests.map((request) =>
    record(request, 'codex_cli_judge_structured_output_invalid')
  );
  const evidenceRefs = parsed.evidenceRefs.map((reference) =>
    requiredText(reference, 'codex_cli_judge_structured_output_invalid')
  );
  if (new Set(evidenceRefs).size !== evidenceRefs.length) {
    throw new Error('codex_cli_judge_structured_output_invalid');
  }
  return {
    decision: parsed.decision as 'pass' | 'block' | 'inconclusive',
    findings,
    challengeRequests,
    evidenceRefs,
  };
}

function validateExecutionReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-cli-judge-execution-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(receipt)) {
    throw new Error(
      `codex_cli_judge_execution_receipt_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
}

export function createCodexCliJudgeAdapter(dependencies: CodexCliJudgeAdapterDependencies = {}) {
  const run = dependencies.executeCommand ?? executeCodexCliCommand;
  const readCredentialSecret =
    dependencies.readCredentialSecret ?? readRequirementsContractJudgeCredentialSecret;
  const executorKind: CodexCliExecutorKind = dependencies.executeCommand
    ? 'injected_test_transport'
    : 'native_spawn';
  return {
    judge: async (input: AdapterInput): Promise<JsonRecord> => {
      const provider = record(input.provider, 'codex_cli_judge_provider_invalid');
      assertProvider(provider);
      const providerRef = requiredText(input.providerRef, 'codex_cli_judge_provider_ref_missing');
      const payload = record(input.payload, 'codex_cli_judge_payload_invalid');
      const systemPrompt = requiredText(
        payload.systemPrompt,
        'codex_cli_judge_system_prompt_missing'
      );
      const request = record(payload.request, 'codex_cli_judge_request_invalid');
      const structuredOutputSchema = normalizeCodexOutputSchema(
        payload.structuredOutputSchema ?? DEFAULT_STRUCTURED_OUTPUT_SCHEMA
      );
      assertCodexOutputSchemaCompatible(structuredOutputSchema);
      const context = executionContext(payload);
      const root = path.resolve(context.projectRoot);
      const outputDir = resolveWithin(
        root,
        context.outputDir,
        'codex_cli_judge_output_path_escape'
      );
      if (fs.existsSync(outputDir)) {
        throw new Error('codex_cli_judge_output_dir_already_exists');
      }
      fs.mkdirSync(outputDir, { recursive: true });
      const snapshot = materializeEvidenceSnapshot({ context, request });
      const credential = credentialBinding({
        providerRef,
        provider,
        credential: input.credential,
        outputDir,
        readCredentialSecret,
      });
      const outputSchemaPath = path.join(outputDir, 'structured-output.schema.json');
      const outputPath = path.join(outputDir, 'structured-output.json');
      const stdoutPath = path.join(outputDir, 'codex-cli-stdout.jsonl');
      const stderrPath = path.join(outputDir, 'codex-cli-stderr.log');
      const transcriptPath = path.join(outputDir, 'codex-cli-transcript.jsonl');
      writeJsonAtomic(outputSchemaPath, structuredOutputSchema);
      const configuredModel = configuredRequestedModel(provider);
      const args = buildCodexCliJudgeArgs({
        cwd: '.',
        outputSchemaPath: '../structured-output.schema.json',
        outputLastMessagePath: '../structured-output.json',
        configuredModel,
      });
      const endpoint = record(provider.endpoint, 'codex_cli_judge_endpoint_invalid');
      const command = requiredText(endpoint.command, 'codex_cli_judge_command_missing');
      const requestPolicy = record(
        provider.requestPolicy,
        'codex_cli_judge_request_policy_invalid'
      );
      const timeoutMs = Number(requestPolicy.timeoutMs);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('codex_cli_judge_timeout_invalid');
      }
      const startedAt = new Date().toISOString();
      const prompt = buildCodexCliJudgePrompt({
        systemPrompt,
        request,
        readAllowlist: snapshot.readAllowlist,
      });
      const execution = await run({
        command,
        args,
        cwd: snapshot.snapshotRoot,
        stdin: prompt,
        timeoutMs,
        env: credential.env,
        outputPath,
        stdoutPath,
        stderrPath,
        transcriptPath,
      });
      writeTextAtomic(stdoutPath, execution.stdout);
      writeTextAtomic(stderrPath, execution.stderr);
      if (execution.exitCode !== 0) {
        throw new Error(`codex_cli_judge_process_failed:${execution.exitCode}`);
      }
      if (!fs.existsSync(outputPath)) {
        throw new Error('codex_cli_judge_structured_output_missing');
      }
      const events = parseTranscript(execution.stdout);
      writeTextAtomic(
        transcriptPath,
        `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
      );
      const requestId = providerRequestId(events);
      const returnedModel = observedModel(events);
      const normalizedDecision = structuredDecision(
        JSON.parse(fs.readFileSync(outputPath, 'utf8'))
      );
      const launchEvidence = commandLaunchEvidence(execution, executorKind);
      const receipt = {
        schemaVersion: 'requirements-contract-cli-judge-execution-receipt/v1',
        adapterRef: 'CodexCliJudgeAdapter',
        protocol: 'codex_exec_jsonl',
        command,
        argv: args,
        ...launchEvidence,
        cwd: snapshot.snapshotRoot,
        executorKind,
        processId:
          executorKind === 'native_spawn' &&
          Number.isInteger(execution.processId) &&
          Number(execution.processId) > 0
            ? execution.processId
            : null,
        providerRequestId: requestId,
        requestedModel: configuredModel,
        observedModel: returnedModel,
        modelObservationSource: returnedModel ? 'cli_event' : 'unavailable',
        decisionBearingModelEvidence: returnedModel !== null,
        credentialRevision: credential.credentialRevision,
        credentialEnvironmentVariable: credential.credentialEnvironmentVariable,
        runtimeHomePath: slash(path.relative(root, credential.runtimeHomePath)),
        runtimeConfigHash: credential.runtimeConfigHash,
        exitCode: execution.exitCode,
        stdoutPath: slash(path.relative(root, stdoutPath)),
        stdoutHash: sha256(execution.stdout),
        stderrPath: slash(path.relative(root, stderrPath)),
        stderrHash: sha256(execution.stderr),
        transcriptPath: slash(path.relative(root, transcriptPath)),
        transcriptHash: sha256(fs.readFileSync(transcriptPath)),
        outputPath: slash(path.relative(root, outputPath)),
        outputHash: sha256(fs.readFileSync(outputPath)),
        structuredOutputSchemaPath: slash(path.relative(root, outputSchemaPath)),
        structuredOutputSchemaHash: sha256(fs.readFileSync(outputSchemaPath)),
        snapshotManifestPath: slash(path.relative(root, snapshot.manifestPath)),
        snapshotHash: snapshot.snapshotHash,
        sessionId: null,
        initModel: null,
        modelUsageModels: [],
      };
      validateExecutionReceipt(receipt);
      writeJsonAtomic(path.join(outputDir, 'cli-judge-execution-receipt.json'), receipt);
      const completedAt = new Date().toISOString();
      const transportEvidenceHash = sha256(stableStringify(receipt));
      const normalizedReturnedModel = returnedModel ?? 'gateway-managed:unobserved';
      const normalized = {
        schemaVersion: 'requirements-contract-normalized-judge-response/v1',
        providerRef,
        transport: provider.transport,
        configuredModel,
        returnedModel: normalizedReturnedModel,
        ...normalizedDecision,
        providerRequestId: requestId,
        requestHash: sha256(prompt),
        responseHash: sha256(fs.readFileSync(outputPath)),
        transportEvidence: receipt,
      };
      writeInvocationReceipt({
        outputDir,
        startedAt,
        completedAt,
        providerRef,
        transport: String(provider.transport),
        providerRequestId: requestId,
        outcome: 'decided',
        decision: normalizedDecision.decision,
        unknownOutcomeReason: null,
        normalizedResponseHash: sha256(stableStringify(normalized)),
        transportEvidenceHash,
      });
      return normalized;
    },
  } as const;
}

export const CodexCliJudgeAdapter = createCodexCliJudgeAdapter();
