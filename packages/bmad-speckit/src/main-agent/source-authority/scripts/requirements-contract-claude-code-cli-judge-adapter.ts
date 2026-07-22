import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonRecord = Record<string, unknown>;

export interface ClaudeCodeCliCommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
}

export interface ClaudeCodeCliCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  processId?: number;
}

export interface ClaudeCodeCliJudgeAdapterDependencies {
  executeCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
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

interface SnapshotEntry {
  path: string;
  hash: string;
  bytes: number;
}

const HASH_PREFIX = 'sha256:';
const MAX_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_TOOLS = ['Read'] as const;
const ASSESSMENT_VERDICTS = [
  'no_new_valid_gap',
  'no_new_confirmation_blocking_gap',
  'new_valid_gap',
  'insufficient_audit',
  'blocked',
] as const;
const STRUCTURED_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'findings', 'challengeRequests', 'evidenceRefs'],
  properties: {
    decision: { enum: ['pass', 'block', 'inconclusive'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['schemaVersion', 'verdict'],
        properties: {
          schemaVersion: { const: 'critical-auditor-judge-assessment/v1' },
          verdict: { enum: ASSESSMENT_VERDICTS },
        },
      },
    },
    challengeRequests: { type: 'array', items: { type: 'object' } },
    evidenceRefs: {
      type: 'array',
      uniqueItems: true,
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
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

function assertWritablePathWithinRoot(root: string, target: string, code: string): void {
  const rootRealPath = fs.realpathSync(root);
  let existingPath = path.resolve(target);
  while (!fs.existsSync(existingPath)) {
    const parentPath = path.dirname(existingPath);
    if (parentPath === existingPath) throw new Error(code);
    existingPath = parentPath;
  }
  if (fs.lstatSync(existingPath).isSymbolicLink()) throw new Error(code);
  if (!isWithin(rootRealPath, fs.realpathSync(existingPath))) throw new Error(code);
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
      throw new Error('claude_code_cli_judge_evidence_path_escape');
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

function copySnapshotFile(input: {
  projectRoot: string;
  snapshotRoot: string;
  sourcePath: string;
}): SnapshotEntry {
  const projectRealRoot = fs.realpathSync(input.projectRoot);
  const sourceRealPath = fs.realpathSync(input.sourcePath);
  if (!isWithin(projectRealRoot, sourceRealPath)) {
    throw new Error('claude_code_cli_judge_evidence_realpath_escape');
  }
  const relativePath = slash(path.relative(input.projectRoot, input.sourcePath));
  const target = path.resolve(input.snapshotRoot, relativePath);
  if (!isWithin(input.snapshotRoot, target)) {
    throw new Error('claude_code_cli_judge_snapshot_path_escape');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(input.sourcePath, target);
  const content = fs.readFileSync(target);
  return {
    path: relativePath,
    hash: sha256(content),
    bytes: content.byteLength,
  };
}

function materializeEvidenceSnapshot(input: {
  context: ExecutionContext;
  request: JsonRecord;
}): {
  snapshotRoot: string;
  manifestPath: string;
  snapshotHash: string;
  entries: SnapshotEntry[];
} {
  const projectRoot = path.resolve(input.context.projectRoot);
  const outputDir = resolveWithin(
    projectRoot,
    input.context.outputDir,
    'claude_code_cli_judge_output_path_escape'
  );
  assertWritablePathWithinRoot(
    projectRoot,
    outputDir,
    'claude_code_cli_judge_output_path_realpath_escape'
  );
  const requestPath = resolveWithin(
    projectRoot,
    input.context.requestPath,
    'claude_code_cli_judge_request_path_escape'
  );
  if (!fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error('claude_code_cli_judge_request_path_missing');
  }
  const snapshotRoot = path.join(outputDir, 'evidence-snapshot');
  if (fs.existsSync(snapshotRoot)) {
    throw new Error('claude_code_cli_judge_snapshot_already_exists');
  }
  fs.mkdirSync(snapshotRoot, { recursive: true });
  assertWritablePathWithinRoot(
    projectRoot,
    snapshotRoot,
    'claude_code_cli_judge_output_path_realpath_escape'
  );
  const files = collectReferencedFiles(input.request, projectRoot, outputDir);
  files.add(requestPath);
  const entries = [...files]
    .sort((left, right) => slash(left).localeCompare(slash(right)))
    .map((sourcePath) => copySnapshotFile({ projectRoot, snapshotRoot, sourcePath }));
  const snapshotHash = sha256(JSON.stringify(entries));
  const manifestPath = path.join(snapshotRoot, 'snapshot-manifest.json');
  writeJsonAtomic(manifestPath, {
    schemaVersion: 'requirements-contract-judge-evidence-snapshot/v1',
    entries,
    snapshotHash,
  });
  return { snapshotRoot, manifestPath, snapshotHash, entries };
}

function executionContext(payload: JsonRecord): ExecutionContext {
  const context = record(
    payload.executionContext,
    'claude_code_cli_judge_execution_context_missing'
  );
  return {
    projectRoot: requiredText(
      context.projectRoot,
      'claude_code_cli_judge_project_root_missing'
    ),
    requestPath: requiredText(
      context.requestPath,
      'claude_code_cli_judge_request_path_missing'
    ),
    outputDir: requiredText(context.outputDir, 'claude_code_cli_judge_output_dir_missing'),
  };
}

function assertProvider(provider: JsonRecord): void {
  if (provider.transport !== 'claude-code-cli' || provider.apiStyle !== 'cli') {
    throw new Error('claude_code_cli_judge_provider_binding_invalid');
  }
  requiredText(provider.model, 'claude_code_cli_judge_model_missing');
  const endpoint = record(provider.endpoint, 'claude_code_cli_judge_endpoint_invalid');
  if (
    endpoint.command !== 'claude' ||
    endpoint.resolutionMode !== 'path_search' ||
    endpoint.routingOwnership !== 'transport_adapter' ||
    endpoint.upstreamVersioning !== 'cli_managed' ||
    endpoint.explicitOperationPath !== null
  ) {
    throw new Error('claude_code_cli_judge_endpoint_invalid');
  }
  const authentication = record(
    provider.authentication,
    'claude_code_cli_judge_authentication_invalid'
  );
  if (
    authentication.type !== 'claude_code_session' ||
    authentication.sensitivity !== 'host_managed' ||
    authentication.arbitraryNonEmptyValueAllowed !== false
  ) {
    throw new Error('claude_code_cli_judge_authentication_invalid');
  }
  const auditPolicy = record(
    provider.auditPolicy,
    'claude_code_cli_judge_audit_policy_invalid'
  );
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
    throw new Error('claude_code_cli_judge_audit_policy_invalid');
  }
}

function buildPrompt(
  systemPrompt: string,
  request: JsonRecord,
  readAllowlist: string[]
): string {
  return [
    systemPrompt.trim(),
    'The current working directory is an isolated frozen evidence snapshot.',
    'Use only Read inside that directory.',
    'Do not access parent directories, external directories, networks, shells, or write-capable tools.',
    'Read only the exact snapshot-relative paths listed below.',
    'Do not call Read with any value that is absent from this allowlist.',
    'Pass each allowlisted path to Read exactly as written; do not prepend a working directory or convert it to an absolute path.',
    'Treat requirement refs, projection refs, group IDs, rule codes, hashes, and receipt IDs as opaque data, not file paths.',
    `Assessment verdict must be exactly one of: ${ASSESSMENT_VERDICTS.join(', ')}.`,
    '<judge-read-allowlist-json>',
    JSON.stringify(readAllowlist),
    '</judge-read-allowlist-json>',
    '<judge-request-json>',
    JSON.stringify(request),
    '</judge-request-json>',
  ].join('\n');
}

export function buildClaudeCodeCliJudgeArgs(input: {
  provider: JsonRecord;
  systemPrompt: string;
}): string[] {
  const requestPolicy = record(
    input.provider.requestPolicy,
    'claude_code_cli_judge_request_policy_invalid'
  );
  const args = [
    '--print',
    '--effort',
    'xhigh',
    '--bare',
    '--model',
    requiredText(input.provider.model, 'claude_code_cli_judge_model_missing'),
    '--tools',
    ALLOWED_TOOLS.join(','),
    '--permission-mode',
    'dontAsk',
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    JSON.stringify(STRUCTURED_OUTPUT_SCHEMA),
    '--no-session-persistence',
    '--strict-mcp-config',
    '--mcp-config',
    JSON.stringify({ mcpServers: {} }),
    '--system-prompt',
    input.systemPrompt,
  ];
  const maxBudgetUsd = Number(requestPolicy.maxBudgetUsd);
  if (Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  return args;
}

function executeCommand(
  invocation: ClaudeCodeCliCommandInvocation
): Promise<ClaudeCodeCliCommandResult> {
  if (process.platform === 'win32' && invocation.cwd.length >= 260) {
    return Promise.reject(new Error('claude_code_cli_judge_cwd_path_too_long'));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const fail = (code: string, error: NodeJS.ErrnoException): void => {
      child.kill();
      finish(() => reject(new Error(`${code}:${error.code ?? 'unknown'}`)));
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error('claude_code_cli_judge_timeout')));
    }, invocation.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > MAX_STDOUT_BYTES) {
        child.kill();
        finish(() => reject(new Error('claude_code_cli_judge_stdout_limit_exceeded')));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, 'utf8') > MAX_STDERR_BYTES) {
        child.kill();
        finish(() => reject(new Error('claude_code_cli_judge_stderr_limit_exceeded')));
      }
    });
    child.stdout.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stdout_stream_failed', error)
    );
    child.stderr.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stderr_stream_failed', error)
    );
    child.stdin.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_stdin_stream_failed', error)
    );
    child.once('error', (error: NodeJS.ErrnoException) =>
      fail('claude_code_cli_judge_spawn_failed', error)
    );
    child.once('close', (exitCode) => {
      finish(() =>
        resolve({ exitCode: exitCode ?? -1, stdout, stderr, processId: child.pid })
      );
    });
    child.stdin.end(invocation.stdin);
  });
}

function parseTranscript(stdout: string): {
  events: JsonRecord[];
  result: JsonRecord;
} {
  const lines = stdout.split(/\r?\n/gu).filter((line) => line.trim().length > 0);
  const events = lines.map((line) => {
    try {
      return record(JSON.parse(line), 'claude_code_cli_judge_transcript_invalid');
    } catch {
      throw new Error('claude_code_cli_judge_transcript_invalid');
    }
  });
  const result = [...events].reverse().find((event) => event.type === 'result');
  if (!result) throw new Error('claude_code_cli_judge_result_missing');
  return { events, result };
}

function structuredDecision(value: unknown): {
  decision: 'pass' | 'block' | 'inconclusive';
  findings: JsonRecord[];
  challengeRequests: JsonRecord[];
  evidenceRefs: string[];
} {
  const parsed = record(value, 'claude_code_cli_judge_structured_output_invalid');
  const allowedKeys = new Set(['decision', 'findings', 'challengeRequests', 'evidenceRefs']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  if (!['pass', 'block', 'inconclusive'].includes(String(parsed.decision))) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  if (
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.challengeRequests) ||
    !Array.isArray(parsed.evidenceRefs)
  ) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  const findings = parsed.findings.map((finding) =>
    record(finding, 'claude_code_cli_judge_structured_output_invalid')
  );
  const challengeRequests = parsed.challengeRequests.map((request) =>
    record(request, 'claude_code_cli_judge_structured_output_invalid')
  );
  const evidenceRefs = parsed.evidenceRefs.map((reference) =>
    requiredText(reference, 'claude_code_cli_judge_structured_output_invalid')
  );
  if (new Set(evidenceRefs).size !== evidenceRefs.length) {
    throw new Error('claude_code_cli_judge_structured_output_invalid');
  }
  return {
    decision: parsed.decision as 'pass' | 'block' | 'inconclusive',
    findings,
    challengeRequests,
    evidenceRefs,
  };
}

export function createClaudeCodeCliJudgeAdapter(
  dependencies: ClaudeCodeCliJudgeAdapterDependencies = {}
) {
  const run = dependencies.executeCommand ?? executeCommand;
  const executorKind = dependencies.executeCommand
    ? 'injected_test_transport'
    : 'native_spawn';
  return {
    judge: async (input: AdapterInput): Promise<JsonRecord> => {
      const provider = record(input.provider, 'claude_code_cli_judge_provider_invalid');
      assertProvider(provider);
      if (input.credential !== undefined && input.credential !== null) {
        throw new Error('claude_code_cli_judge_credential_injection_forbidden');
      }
      const providerRef = requiredText(
        input.providerRef,
        'claude_code_cli_judge_provider_ref_missing'
      );
      const payload = record(input.payload, 'claude_code_cli_judge_payload_invalid');
      const systemPrompt = requiredText(
        payload.systemPrompt,
        'claude_code_cli_judge_system_prompt_missing'
      );
      const request = record(payload.request, 'claude_code_cli_judge_request_invalid');
      const context = executionContext(payload);
      const snapshot = materializeEvidenceSnapshot({ context, request });
      const prompt = buildPrompt(
        systemPrompt,
        request,
        snapshot.entries.map((entry) => entry.path)
      );
      const args = buildClaudeCodeCliJudgeArgs({ provider, systemPrompt });
      const requestPolicy = record(
        provider.requestPolicy,
        'claude_code_cli_judge_request_policy_invalid'
      );
      const timeoutMs = Number(requestPolicy.timeoutMs);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('claude_code_cli_judge_timeout_invalid');
      }
      const command = 'claude';
      const execution = await run({
        command,
        args,
        cwd: snapshot.snapshotRoot,
        stdin: prompt,
        timeoutMs,
      });
      const outputDir = path.resolve(context.outputDir);
      const stdoutPath = path.join(outputDir, 'claude-code-cli-stdout.jsonl');
      const stderrPath = path.join(outputDir, 'claude-code-cli-stderr.log');
      writeTextAtomic(stdoutPath, execution.stdout);
      writeTextAtomic(stderrPath, execution.stderr);
      const transcript = parseTranscript(execution.stdout);
      const transcriptPath = path.join(outputDir, 'claude-code-cli-transcript.jsonl');
      writeTextAtomic(
        transcriptPath,
        `${transcript.events.map((event) => JSON.stringify(event)).join('\n')}\n`
      );
      if (execution.exitCode !== 0) {
        throw new Error(`claude_code_cli_judge_process_failed:${execution.exitCode}`);
      }
      const result = transcript.result;
      if (
        result.subtype !== 'success' ||
        result.is_error === true ||
        !UUID_V4_PATTERN.test(requiredText(result.session_id, 'claude_code_cli_judge_session_invalid'))
      ) {
        throw new Error('claude_code_cli_judge_result_invalid');
      }
      const permissionDenials = result.permission_denials;
      if (!Array.isArray(permissionDenials) || permissionDenials.length > 0) {
        throw new Error('claude_code_cli_judge_permission_denied');
      }
      const modelUsage = record(
        result.modelUsage,
        'claude_code_cli_judge_model_usage_missing'
      );
      const model = requiredText(provider.model, 'claude_code_cli_judge_model_missing');
      if (!Object.hasOwn(modelUsage, model)) {
        throw new Error('claude_code_cli_judge_returned_model_mismatch');
      }
      const normalized = structuredDecision(result.structured_output);
      return {
        schemaVersion: 'requirements-contract-normalized-judge-response/v1',
        providerRef,
        transport: provider.transport,
        configuredModel: model,
        returnedModel: model,
        ...normalized,
        providerRequestId: result.session_id,
        requestHash: sha256(prompt),
        responseHash: sha256(execution.stdout),
        transportEvidence: {
          schemaVersion: 'requirements-contract-claude-code-cli-execution/v1',
          command,
          argv: args,
          cwd: snapshot.snapshotRoot,
          executorKind,
          processId:
            executorKind === 'native_spawn' &&
            Number.isInteger(execution.processId) &&
            Number(execution.processId) > 0
              ? execution.processId
              : null,
          requestedModel: model,
          sessionId: result.session_id,
          exitCode: execution.exitCode,
          stdoutPath: slash(path.relative(context.projectRoot, stdoutPath)),
          stdoutHash: sha256(execution.stdout),
          stderrPath: slash(path.relative(context.projectRoot, stderrPath)),
          stderrHash: sha256(execution.stderr),
          transcriptPath: slash(path.relative(context.projectRoot, transcriptPath)),
          transcriptHash: sha256(fs.readFileSync(transcriptPath)),
          snapshotManifestPath: slash(
            path.relative(context.projectRoot, snapshot.manifestPath)
          ),
          snapshotHash: snapshot.snapshotHash,
        },
      };
    },
  } as const;
}

export const ClaudeCodeCliJudgeAdapter = createClaudeCodeCliJudgeAdapter();
