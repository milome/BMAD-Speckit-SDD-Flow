import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  executeClaudeCodeCliCommand as executeClaudeCodeCliCommandDefault,
  type ClaudeCodeCliCommandInvocation,
  type ClaudeCodeCliCommandResult,
} from './requirements-contract-claude-code-cli-judge-adapter';
import {
  executeCodexCliCommand as executeCodexCliCommandDefault,
  type CodexCliCommandInvocation,
  type CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import {
  getReviewerRegistration,
  type ReviewerHostId,
  type ReviewerRoute,
} from './reviewer-registry';

export type NativeReviewerActorIntent = {
  actorClass: 'bounded_code_reviewer';
  dispatchMode: 'parallel';
  invocationMode: 'native';
  dispatchGroupId: string;
  preparedBeforeDispatch: true;
  blindInput: Record<string, unknown>;
  blindInputHash: string;
  invocationIntentHash: string;
};

export type NativeReviewerExecutionResult = {
  sourceLedgerHash: string;
  terminalOutcome: 'clean' | 'findings' | 'blocked';
  findingIds?: string[];
};

export interface NativeReviewerDispatchRequest {
  schemaVersion: 'main-agent-native-reviewer-dispatch/v1';
  role: 'bounded_code_reviewer';
  host: ReviewerHostId;
  route: ReviewerRoute;
  projectRoot: string;
  requestPath: string;
  outputRoot: string;
  evidencePaths: string[];
  intent: NativeReviewerActorIntent;
  timeoutMs?: number;
}

export type NativeReviewerDispatch = (request: NativeReviewerDispatchRequest) => Promise<unknown>;

export interface NativeReviewerHostBridgeOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
}

export interface NativeReviewerTransport {
  invoke(input: { intent: NativeReviewerActorIntent }): Promise<NativeReviewerExecutionResult>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('native_reviewer_transport_response_invalid');
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, code: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(code);
  return normalized;
}

function resolveHost(value: string | undefined): ReviewerHostId {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'codex' || normalized === 'codex-no-hooks') return 'codex';
  if (normalized === 'claude' || normalized === 'claude-code' || normalized === 'claude-code-cli') {
    return 'claude';
  }
  if (normalized === 'cursor' || normalized === 'cursor-ide' || normalized === 'cursor-cli') {
    return 'cursor';
  }
  throw new Error('native_reviewer_host_missing');
}

function normalizeResult(value: unknown): NativeReviewerExecutionResult {
  const response = record(value);
  const sourceLedgerHash = requiredText(
    response.sourceLedgerHash,
    'native_reviewer_transport_response_invalid'
  );
  if (!/^sha256:[a-f0-9]{64}$/u.test(sourceLedgerHash)) {
    throw new Error('native_reviewer_transport_response_invalid');
  }
  const terminalOutcome = response.terminalOutcome;
  if (
    terminalOutcome !== 'clean' &&
    terminalOutcome !== 'findings' &&
    terminalOutcome !== 'blocked'
  ) {
    throw new Error('native_reviewer_transport_response_invalid');
  }
  const findingIds = Array.isArray(response.findingIds)
    ? response.findingIds
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    : [];
  return { sourceLedgerHash, terminalOutcome, findingIds };
}

function bridgeCommandKey(host: ReviewerHostId): string {
  return `BMAD_NATIVE_REVIEWER_${host.toUpperCase()}_BRIDGE_COMMAND`;
}

function bridgeArgsKey(host: ReviewerHostId): string {
  return `BMAD_NATIVE_REVIEWER_${host.toUpperCase()}_BRIDGE_ARGS_JSON`;
}

function bridgeTimeoutKey(host: ReviewerHostId): string {
  return `BMAD_NATIVE_REVIEWER_${host.toUpperCase()}_BRIDGE_TIMEOUT_MS`;
}

function parseBridgeArgs(value: string | undefined, host: ReviewerHostId): string[] {
  if (!value || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw new Error(`native_reviewer_host_bridge_args_invalid:${host}`);
  }
}

function bridgeTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const NATIVE_REVIEWER_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    terminalOutcome: { type: 'string', enum: ['clean', 'findings', 'blocked'] },
    findingIds: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
  required: ['terminalOutcome', 'findingIds'],
});

function reviewerPromptPath(
  request: NativeReviewerDispatchRequest,
  env: NodeJS.ProcessEnv
): string {
  const hostKey = request.host.toUpperCase();
  const configured = String(
    env[`BMAD_NATIVE_REVIEWER_${hostKey}_PROMPT_PATH`] ?? env.BMAD_NATIVE_REVIEWER_PROMPT_PATH ?? ''
  ).trim();
  return path.resolve(
    request.projectRoot,
    configured || getReviewerRegistration('implement_audit').sharedCore.basePromptPath
  );
}

function reviewerTaskPrompt(request: NativeReviewerDispatchRequest, sharedPrompt: string): string {
  return [
    sharedPrompt.trim(),
    '',
    'Execute one bounded, read-only implementation audit for this controlled closeout.',
    'Do not modify files. Inspect the current worktree only within the governed evidence and allowed paths referenced by the closeout context.',
    'Do not perform an unbounded review of the worktree or scan paths outside that evidence boundary.',
    'Return terminalOutcome=clean only when no blocking implementation or evidence finding remains. Return only the requested structured JSON.',
    '',
    '<native-reviewer-request-json>',
    JSON.stringify(request, null, 2),
    '</native-reviewer-request-json>',
  ].join('\n');
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function parseStructuredReviewerResult(value: unknown): {
  terminalOutcome: 'clean' | 'findings' | 'blocked';
  findingIds: string[];
} {
  const parsed = record(value);
  const candidate = record(parsed.structured_output ?? parsed.structuredOutput ?? parsed);
  const normalized = normalizeResult({
    sourceLedgerHash: `sha256:${'0'.repeat(64)}`,
    terminalOutcome: candidate.terminalOutcome,
    findingIds: candidate.findingIds,
  });
  return {
    terminalOutcome: normalized.terminalOutcome,
    findingIds: normalized.findingIds ?? [],
  };
}

async function dispatchNativeReviewerCli(
  request: NativeReviewerDispatchRequest,
  options: NativeReviewerHostBridgeOptions,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<NativeReviewerExecutionResult> {
  if (request.host === 'cursor') {
    throw new Error('native_reviewer_transport_not_configured');
  }
  const promptPath = reviewerPromptPath(request, env);
  if (!fs.existsSync(promptPath) || !fs.statSync(promptPath).isFile()) {
    throw new Error('native_reviewer_prompt_missing');
  }
  const prompt = reviewerTaskPrompt(request, fs.readFileSync(promptPath, 'utf8'));
  const cliRoot = path.join(request.outputRoot, 'native-reviewer-cli');
  const schemaPath = path.join(cliRoot, 'structured-output.schema.json');
  const resultPath = path.join(cliRoot, 'structured-output.json');
  const stdoutPath = path.join(cliRoot, `${request.host}-stdout.log`);
  const stderrPath = path.join(cliRoot, `${request.host}-stderr.log`);
  fs.mkdirSync(cliRoot, { recursive: true });
  fs.writeFileSync(
    schemaPath,
    `${JSON.stringify(NATIVE_REVIEWER_OUTPUT_SCHEMA, null, 2)}\n`,
    'utf8'
  );

  let stdout: string;
  let stderr: string;
  let structured: unknown;
  if (request.host === 'codex') {
    const run = options.executeCodexCliCommand ?? executeCodexCliCommandDefault;
    let execution: CodexCliCommandResult;
    try {
      execution = await run({
        command: 'codex',
        args: [
          '--ask-for-approval',
          'never',
          'exec',
          '--sandbox',
          'read-only',
          '--ephemeral',
          '--ignore-rules',
          '--skip-git-repo-check',
          '--color',
          'never',
          '--output-schema',
          schemaPath,
          '--output-last-message',
          resultPath,
          '--json',
          '-',
        ],
        cwd: request.projectRoot,
        stdin: `${prompt}\n`,
        timeoutMs,
        env,
        outputPath: resultPath,
        stdoutPath,
        stderrPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/command_not_resolvable|ENOENT/iu.test(message)) {
        throw new Error('native_reviewer_transport_not_configured');
      }
      throw error;
    }
    stdout = execution.stdout;
    stderr = execution.stderr;
    fs.writeFileSync(stdoutPath, stdout, 'utf8');
    fs.writeFileSync(stderrPath, stderr, 'utf8');
    if (execution.exitCode !== 0) {
      throw new Error(`native_reviewer_host_cli_failed:${execution.exitCode}`);
    }
    if (!fs.existsSync(resultPath)) {
      throw new Error('native_reviewer_transport_response_invalid');
    }
    structured = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as unknown;
  } else {
    const run = options.executeClaudeCodeCliCommand ?? executeClaudeCodeCliCommandDefault;
    const execution = await run({
      command: 'claude',
      args: [
        '--print',
        '--agent',
        request.route.subtypeOrExecutor,
        '--tools',
        'Read,Grep,Glob,Bash',
        '--permission-mode',
        'plan',
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(NATIVE_REVIEWER_OUTPUT_SCHEMA),
        '--no-session-persistence',
        '--append-system-prompt-file',
        promptPath,
      ],
      cwd: request.projectRoot,
      stdin: `${prompt}\n`,
      timeoutMs,
      env,
      stdoutPath,
      stderrPath,
    });
    stdout = execution.stdout;
    stderr = execution.stderr;
    fs.writeFileSync(stdoutPath, stdout, 'utf8');
    fs.writeFileSync(stderrPath, stderr, 'utf8');
    if (execution.exitCode !== 0) {
      throw new Error(`native_reviewer_host_cli_failed:${execution.exitCode}`);
    }
    structured = JSON.parse(stdout) as unknown;
    fs.writeFileSync(resultPath, `${JSON.stringify(structured, null, 2)}\n`, 'utf8');
  }
  const normalized = parseStructuredReviewerResult(structured);
  return {
    sourceLedgerHash: sha256Text(`${stdout}\n${JSON.stringify(structured)}`),
    ...normalized,
  };
}

/**
 * Uses an explicitly configured host bridge when present, otherwise dispatches through the
 * installed Codex or Claude native CLI route.
 */
export function createNativeReviewerHostBridge(
  options: NativeReviewerHostBridgeOptions = {}
): NativeReviewerDispatch {
  const env = options.env ?? process.env;
  const defaultTimeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  return async (request) => {
    const timeoutMs =
      Number.isFinite(request.timeoutMs) && Number(request.timeoutMs) > 0
        ? Number(request.timeoutMs)
        : bridgeTimeout(env[bridgeTimeoutKey(request.host)], defaultTimeoutMs);
    const command = String(env[bridgeCommandKey(request.host)] ?? '').trim();
    if (!command) {
      return dispatchNativeReviewerCli(request, options, env, timeoutMs);
    }
    const args = parseBridgeArgs(env[bridgeArgsKey(request.host)], request.host);
    const result = spawnSync(command, args, {
      cwd: request.projectRoot,
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error) {
      const code = (result.error as NodeJS.ErrnoException).code;
      throw new Error(
        code === 'ETIMEDOUT'
          ? 'native_reviewer_host_bridge_timeout'
          : `native_reviewer_host_bridge_failed:${code ?? 'unknown'}`
      );
    }
    if (result.status !== 0) {
      throw new Error(`native_reviewer_host_bridge_failed:${result.status ?? 'unknown'}`);
    }
    const stdout = String(result.stdout ?? '').trim();
    if (!stdout) throw new Error('native_reviewer_transport_response_invalid');
    try {
      return JSON.parse(stdout) as unknown;
    } catch {
      throw new Error('native_reviewer_transport_response_invalid');
    }
  };
}

export function createNativeReviewerTransport(input: {
  projectRoot: string;
  outputRoot: string;
  host?: string;
  evidencePaths?: string[];
  timeoutMs?: number;
  dispatch?: NativeReviewerDispatch;
}): NativeReviewerTransport {
  const projectRoot = path.resolve(input.projectRoot);
  const outputRoot = path.resolve(input.outputRoot);
  const host = resolveHost(input.host);
  const route = getReviewerRegistration('implement_audit').hosts[host].preferredRoute;
  const requestPath = path.join(outputRoot, 'native-reviewer-request.json');

  return {
    async invoke({ intent }) {
      if (!input.dispatch) throw new Error('native_reviewer_transport_not_configured');
      const request: NativeReviewerDispatchRequest = {
        schemaVersion: 'main-agent-native-reviewer-dispatch/v1',
        role: 'bounded_code_reviewer',
        host,
        route,
        projectRoot,
        requestPath,
        outputRoot,
        evidencePaths: input.evidencePaths ?? [],
        intent,
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
      };
      fs.mkdirSync(outputRoot, { recursive: true });
      fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
      return normalizeResult(await input.dispatch(request));
    },
  };
}
