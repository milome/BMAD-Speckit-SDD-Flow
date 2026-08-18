import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  buildClaudeCodeCliJudgeArgs,
  executeClaudeCodeCliCommand,
  type ClaudeCodeCliCommandInvocation,
  type ClaudeCodeCliCommandResult,
  type SnapshotReadPlanEntry,
} from './requirements-contract-claude-code-cli-judge-adapter';
import {
  buildCodexCliJudgeArgs,
  buildCodexCliJudgePrompt,
  executeCodexCliCommand,
  type CodexCliCommandInvocation,
  type CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import { readRequirementsContractJudgeCredentialSecret } from './requirements-contract-judge-credential-resolver';
import type {
  MainAgentExecutionActorIsolationReceipt,
  MainAgentExecutionFinalJudgeActorIntent,
} from './main-agent-execution-final-judge-campaign';
import { computeMainAgentExecutionActorIsolationPolicyHash } from './main-agent-execution-final-judge-campaign';
import { stableHash } from './requirements-contract-verification-evidence-normalizer';

type JsonRecord = Record<string, unknown>;
type ActorHost = 'codex' | 'claude';

export interface BoundedStructuredActorProviderSelection {
  providerRef: string;
  registryHash: string;
  adapterRef: string;
  host: ActorHost;
  provider: JsonRecord;
}

export interface BoundedStructuredActorTransportDependencies {
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  readCredentialSecret?: (credentialHandle: unknown) => string;
  env?: NodeJS.ProcessEnv;
}

export interface BoundedStructuredActorTransportInput {
  projectRoot: string;
  selection: BoundedStructuredActorProviderSelection;
  credential?: unknown;
}

export interface BoundedStructuredActorInvocation {
  intent: MainAgentExecutionFinalJudgeActorIntent;
  expectedActorClass: MainAgentExecutionFinalJudgeActorIntent['actorClass'];
  systemPrompt: string;
  structuredOutputSchema: JsonRecord;
}

export interface BoundedStructuredActorResult {
  sourceLedgerHash: string;
  structuredOutput: JsonRecord;
  actorIsolationReceipt: MainAgentExecutionActorIsolationReceipt;
}

type EvidenceSnapshot = {
  root: string;
  hash: string;
  allowlist: string[];
  readPlan: SnapshotReadPlanEntry[];
  dispose: () => void;
};

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
    .join(',')}}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function candidateEvidenceSources(intent: MainAgentExecutionFinalJudgeActorIntent) {
  const candidate = record(
    record(intent.blindInput, 'goal_finalization_actor_blind_input_invalid')
      .executionFinalCandidate,
    'goal_finalization_actor_candidate_missing'
  );
  const sources: Array<{ kind: 'artifact' | 'evidence'; id: string; path: string; hash: string }> =
    [];
  for (const [kind, field, idField] of [
    ['artifact', 'artifacts', 'artifactId'],
    ['evidence', 'evidence', 'evidenceId'],
  ] as const) {
    const values = candidate[field];
    if (!Array.isArray(values)) throw new Error('goal_finalization_actor_candidate_invalid');
    for (const value of values) {
      const entry = record(value, 'goal_finalization_actor_candidate_invalid');
      sources.push({
        kind,
        id: requiredText(entry[idField], 'goal_finalization_actor_candidate_invalid'),
        path: requiredText(entry.path, 'goal_finalization_actor_candidate_invalid'),
        hash: requiredText(entry.hash, 'goal_finalization_actor_candidate_invalid'),
      });
    }
  }
  return sources;
}

function materializeSnapshot(
  projectRoot: string,
  intent: MainAgentExecutionFinalJudgeActorIntent
): EvidenceSnapshot {
  if (stableHash(intent.blindInput) !== intent.blindInputHash) {
    throw new Error('goal_finalization_actor_blind_input_hash_mismatch');
  }
  const root = fs.mkdtempSync(path.join(tmpdir(), 'bmad-goal-finalization-actor-'));
  const projectRealPath = fs.realpathSync(projectRoot);
  const entries: Array<{
    kind: 'artifact' | 'evidence';
    id: string;
    sourcePath: string;
    snapshotPath: string;
    hash: string;
    bytes: number;
  }> = [];
  try {
    writeJson(path.join(root, 'blind-input.json'), intent.blindInput);
    for (const [index, source] of candidateEvidenceSources(intent).entries()) {
      if (path.isAbsolute(source.path)) {
        throw new Error('goal_finalization_actor_evidence_path_escape');
      }
      const sourcePath = path.resolve(projectRoot, source.path);
      if (!isWithin(projectRoot, sourcePath) || !fs.existsSync(sourcePath)) {
        throw new Error('goal_finalization_actor_evidence_path_escape');
      }
      const sourceRealPath = fs.realpathSync(sourcePath);
      if (!isWithin(projectRealPath, sourceRealPath) || !fs.statSync(sourceRealPath).isFile()) {
        throw new Error('goal_finalization_actor_evidence_path_escape');
      }
      const bytes = fs.readFileSync(sourceRealPath);
      if (sha256(bytes) !== source.hash) {
        throw new Error('goal_finalization_actor_evidence_hash_mismatch');
      }
      const snapshotPath = path.posix.join(
        'evidence',
        source.kind,
        `${String(index).padStart(4, '0')}-${path.basename(source.path)}`
      );
      const target = path.join(root, ...snapshotPath.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      entries.push({
        ...source,
        sourcePath: source.path.replace(/\\/gu, '/'),
        snapshotPath,
        bytes: bytes.length,
      });
    }
    const manifest = {
      schemaVersion: 'GoalFinalizationActorEvidenceSnapshot/v1',
      actorClass: intent.actorClass,
      blindInputHash: intent.blindInputHash,
      entries,
    };
    writeJson(path.join(root, 'evidence-manifest.json'), manifest);
    const allowlist = [
      'blind-input.json',
      'evidence-manifest.json',
      ...entries.map((entry) => entry.snapshotPath),
    ].sort();
    const readPlan = allowlist.map((relativePath) => {
      const bytes = fs.readFileSync(path.join(root, ...relativePath.split('/')));
      const hash = sha256(bytes);
      return {
        sourcePath: relativePath,
        sourceHash: hash,
        sourceBytes: bytes.length,
        segments: [
          {
            path: relativePath,
            hash,
            bytes: bytes.length,
            startByte: 0,
            endByteExclusive: bytes.length,
          },
        ],
      } satisfies SnapshotReadPlanEntry;
    });
    return {
      root,
      hash: sha256(stableStringify({ manifest, readPlan })),
      allowlist,
      readPlan,
      dispose: () => fs.rmSync(root, { recursive: true, force: true }),
    };
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function configuredModel(provider: JsonRecord): string | null {
  if (provider.model === null || provider.model === undefined) return null;
  return requiredText(provider.model, 'goal_finalization_actor_model_invalid');
}

function timeoutMs(provider: JsonRecord): number {
  const value = Number(
    record(provider.requestPolicy, 'goal_finalization_actor_request_policy_invalid').timeoutMs
  );
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('goal_finalization_actor_timeout_invalid');
  }
  return value;
}

function actorCodexArgs(args: string[]): string[] {
  const sandboxIndex = args.indexOf('--sandbox');
  if (sandboxIndex < 0 || args[sandboxIndex + 1] !== 'read-only') {
    throw new Error('goal_finalization_actor_codex_sandbox_contract_invalid');
  }
  return [...args.slice(0, sandboxIndex), ...args.slice(sandboxIndex + 2)];
}

function actorClaudeArgs(args: string[]): string[] {
  const toolsIndex = args.indexOf('--tools');
  if (toolsIndex < 0 || toolsIndex + 1 >= args.length) {
    throw new Error('goal_finalization_actor_claude_tools_contract_invalid');
  }
  const isolated = [...args];
  isolated[toolsIndex + 1] = '';
  return isolated;
}

function inlineSnapshotEvidence(snapshot: EvidenceSnapshot) {
  return snapshot.allowlist.map((relativePath) => {
    const bytes = fs.readFileSync(path.join(snapshot.root, ...relativePath.split('/')));
    const decoded = bytes.toString('utf8');
    const utf8 = !decoded.includes('\u0000') && Buffer.from(decoded, 'utf8').equals(bytes);
    return {
      path: relativePath,
      hash: sha256(bytes),
      bytes: bytes.length,
      contentEncoding: utf8 ? ('utf8' as const) : ('base64' as const),
      content: utf8 ? decoded : bytes.toString('base64'),
    };
  });
}

function buildToolFreeClaudePrompt(input: {
  systemPrompt: string;
  request: JsonRecord;
  snapshot: EvidenceSnapshot;
}): string {
  return [
    input.systemPrompt,
    'All frozen evidence is embedded below. No filesystem or network tools are available.',
    'Inspect every embedded entry before deciding. UTF-8 content is literal; base64 content is exact bytes.',
    '<actor-inline-evidence-json>',
    JSON.stringify(inlineSnapshotEvidence(input.snapshot)),
    '</actor-inline-evidence-json>',
    '<actor-request-json>',
    JSON.stringify(input.request),
    '</actor-request-json>',
  ].join('\n');
}

function parseCodexStructuredOutput(stdout: string): JsonRecord {
  let events: JsonRecord[];
  try {
    events = stdout
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== '')
      .map((line) =>
        record(JSON.parse(line) as unknown, 'goal_finalization_actor_transcript_invalid')
      );
  } catch {
    throw new Error('goal_finalization_actor_transcript_invalid');
  }
  const messages = events.flatMap((event) => {
    if (event.type !== 'item.completed') return [];
    const item = record(event.item, 'goal_finalization_actor_transcript_invalid');
    return item.type === 'agent_message'
      ? [requiredText(item.text, 'goal_finalization_actor_structured_output_invalid')]
      : [];
  });
  if (messages.length !== 1) {
    throw new Error('goal_finalization_actor_structured_output_invalid');
  }
  try {
    return record(
      JSON.parse(messages[0]) as unknown,
      'goal_finalization_actor_structured_output_invalid'
    );
  } catch {
    throw new Error('goal_finalization_actor_structured_output_invalid');
  }
}

function compileActorIsolationReceipt(
  intent: MainAgentExecutionFinalJudgeActorIntent,
  host: ActorHost,
  snapshotHash: string
): MainAgentExecutionActorIsolationReceipt {
  const enforcement =
    host === 'codex' ? 'codex_permission_profile' : 'claude_tool_free_inline_evidence';
  const policyHash = computeMainAgentExecutionActorIsolationPolicyHash(enforcement);
  const payload = {
    schemaVersion: 'GoalFinalizationActorIsolationReceipt/v1' as const,
    actorClass: intent.actorClass,
    dispatchGroupId: intent.dispatchGroupId,
    enforcement,
    snapshotHash,
    peerOutputMaterialization: 'none' as const,
    controlPlaneMaterialization: 'memory_only' as const,
    transportPathsExposed: false as const,
    policyHash,
  };
  return { ...payload, isolationReceiptHash: stableHash(payload) };
}

function credentialHandle(credential: unknown): JsonRecord {
  const selection = record(credential, 'goal_finalization_actor_credential_required');
  return record(
    selection.credentialHandle ?? selection,
    'goal_finalization_actor_credential_required'
  );
}

function assertCredentialBinding(
  selection: BoundedStructuredActorProviderSelection,
  credential: unknown
): { handle: JsonRecord; revision: number } {
  const handle = credentialHandle(credential);
  const provider = selection.provider;
  const authentication = record(
    provider.authentication,
    'goal_finalization_actor_authentication_invalid'
  );
  const revision = Number(handle.credentialRevision);
  if (
    handle.providerRef !== selection.providerRef ||
    handle.credentialRef !== provider.credentialRef ||
    handle.authenticationType !== authentication.type ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    throw new Error('goal_finalization_actor_credential_binding_invalid');
  }
  return { handle, revision };
}

function codexBinding(input: {
  selection: BoundedStructuredActorProviderSelection;
  credential: unknown;
  snapshotRoot: string;
  env: NodeJS.ProcessEnv;
  readCredentialSecret: (handle: unknown) => string;
}) {
  const binding = assertCredentialBinding(input.selection, input.credential);
  const endpoint = record(
    input.selection.provider.endpoint,
    'goal_finalization_actor_endpoint_invalid'
  );
  const baseUrl = requiredText(endpoint.baseUrl, 'goal_finalization_actor_endpoint_invalid');
  const runtimeHomePath = path.join(input.snapshotRoot, 'codex-home');
  fs.mkdirSync(runtimeHomePath, { recursive: false });
  const configText = [
    'default_permissions = "goal-finalization-actor"',
    'model_provider = "bmad_goal_finalization"',
    '',
    '[permissions.goal-finalization-actor.filesystem]',
    '":minimal" = "read"',
    '',
    '[permissions.goal-finalization-actor.filesystem.":workspace_roots"]',
    '"." = "read"',
    '',
    '[permissions.goal-finalization-actor.network]',
    'enabled = false',
    '',
    '[model_providers.bmad_goal_finalization]',
    'name = "BMAD Goal Finalization"',
    `base_url = ${JSON.stringify(baseUrl)}`,
    'env_key = "BMAD_CODEX_JUDGE_API_KEY"',
    'wire_api = "responses"',
    'requires_openai_auth = false',
    'request_max_retries = 0',
    'stream_max_retries = 0',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(runtimeHomePath, 'config.toml'), configText, 'utf8');
  const env = { ...input.env };
  for (const key of [
    'CODEX_HOME',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_ORGANIZATION',
    'BMAD_CODEX_JUDGE_API_KEY',
  ]) {
    delete env[key];
  }
  env.CODEX_HOME = runtimeHomePath;
  env.BMAD_CODEX_JUDGE_API_KEY = input.readCredentialSecret(binding.handle);
  return {
    env,
    credentialRevision: binding.revision,
    credentialEnvironmentVariable: 'BMAD_CODEX_JUDGE_API_KEY',
    runtimeConfigHash: sha256(configText),
  };
}

function claudeBinding(input: {
  selection: BoundedStructuredActorProviderSelection;
  credential: unknown;
  env: NodeJS.ProcessEnv;
  readCredentialSecret: (handle: unknown) => string;
}) {
  const authentication = record(
    input.selection.provider.authentication,
    'goal_finalization_actor_authentication_invalid'
  );
  const env = { ...input.env };
  for (const key of [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_FOUNDRY',
    'CLAUDE_CODE_USE_VERTEX',
  ]) {
    delete env[key];
  }
  if (authentication.type === 'claude_code_session') {
    if (input.credential !== undefined && input.credential !== null) {
      throw new Error('goal_finalization_actor_session_credential_forbidden');
    }
    const revision = Number(authentication.sessionRevision);
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error('goal_finalization_actor_session_invalid');
    }
    return { env, credentialRevision: revision, credentialEnvironmentVariable: null };
  }
  const binding = assertCredentialBinding(input.selection, input.credential);
  const endpoint = record(
    input.selection.provider.endpoint,
    'goal_finalization_actor_endpoint_invalid'
  );
  env.ANTHROPIC_BASE_URL = requiredText(
    endpoint.baseUrl,
    'goal_finalization_actor_endpoint_invalid'
  );
  const environmentVariable =
    authentication.type === 'bearer' ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY';
  env[environmentVariable] = input.readCredentialSecret(binding.handle);
  return {
    env,
    credentialRevision: binding.revision,
    credentialEnvironmentVariable: environmentVariable,
  };
}

function parseClaudeTranscript(stdout: string, requestedModel: string | null) {
  let events: JsonRecord[];
  try {
    events = stdout
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== '')
      .map((line) =>
        record(JSON.parse(line) as unknown, 'goal_finalization_actor_transcript_invalid')
      );
  } catch {
    throw new Error('goal_finalization_actor_transcript_invalid');
  }
  const results = events.filter((event) => event.type === 'result');
  if (results.length !== 1) throw new Error('goal_finalization_actor_transcript_invalid');
  const result = results[0];
  if (
    result.subtype !== 'success' ||
    result.is_error === true ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      requiredText(result.session_id, 'goal_finalization_actor_session_invalid')
    ) ||
    !Array.isArray(result.permission_denials) ||
    result.permission_denials.length > 0
  ) {
    throw new Error('goal_finalization_actor_transcript_invalid');
  }
  const initModels = events
    .filter((event) => event.type === 'system' && event.subtype === 'init')
    .map((event) => requiredText(event.model, 'goal_finalization_actor_model_binding_invalid'));
  const assistantModels = events
    .filter((event) => event.type === 'assistant')
    .map((event) =>
      requiredText(
        record(event.message, 'goal_finalization_actor_model_binding_invalid').model,
        'goal_finalization_actor_model_binding_invalid'
      )
    );
  const outputModels = events.flatMap((event) => {
    if (event.type !== 'assistant') return [];
    const message = record(event.message, 'goal_finalization_actor_model_binding_invalid');
    const content = Array.isArray(message.content) ? message.content : [];
    return content.some(
      (item) =>
        record(item, 'goal_finalization_actor_model_binding_invalid').name === 'StructuredOutput'
    )
      ? [requiredText(message.model, 'goal_finalization_actor_model_binding_invalid')]
      : [];
  });
  const usageModels = Object.keys(
    record(result.modelUsage, 'goal_finalization_actor_model_binding_invalid')
  );
  const boundModel = outputModels[0];
  if (
    initModels.length !== 1 ||
    outputModels.length !== 1 ||
    initModels[0] !== boundModel ||
    assistantModels.some((model) => model !== boundModel) ||
    usageModels.length !== 1 ||
    usageModels[0] !== boundModel ||
    (requestedModel !== null && requestedModel !== boundModel)
  ) {
    throw new Error('goal_finalization_actor_model_binding_invalid');
  }
  return {
    events,
    result,
    structuredOutput: record(
      result.structured_output,
      'goal_finalization_actor_structured_output_invalid'
    ),
    providerRequestId: String(result.session_id),
    observedModel: boundModel,
  };
}

export function createBoundedStructuredActorTransport(
  input: BoundedStructuredActorTransportInput,
  dependencies: BoundedStructuredActorTransportDependencies = {}
) {
  const projectRoot = path.resolve(input.projectRoot);
  const baseEnv = dependencies.env ?? process.env;
  const readCredentialSecret =
    dependencies.readCredentialSecret ?? readRequirementsContractJudgeCredentialSecret;
  return {
    async invoke(
      invocation: BoundedStructuredActorInvocation
    ): Promise<BoundedStructuredActorResult> {
      if (invocation.intent.actorClass !== invocation.expectedActorClass) {
        throw new Error('goal_finalization_actor_class_invalid');
      }
      const snapshot = materializeSnapshot(projectRoot, invocation.intent);
      const outputSchemaPath = path.join(snapshot.root, 'structured-output.schema.json');
      const outputPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
      writeJson(outputSchemaPath, invocation.structuredOutputSchema);
      const request = {
        schemaVersion: 'BoundedStructuredActorRequest/v1',
        actorClass: invocation.expectedActorClass,
        dispatchGroupId: invocation.intent.dispatchGroupId,
        blindInputHash: invocation.intent.blindInputHash,
        invocationIntentHash: invocation.intent.invocationIntentHash,
        snapshotHash: snapshot.hash,
      };
      let stdout = '';
      let stderr = '';
      let structuredOutput: JsonRecord;
      let protocol: 'codex_exec_jsonl' | 'claude_stream_json';
      let argv: string[];
      let providerRequestId: string | null = null;
      let observedModel: string | null = null;
      let credentialRevision: number;
      let credentialEnvironmentVariable: string | null;
      let runtimeConfigHash: string | null = null;
      try {
        const endpoint = record(
          input.selection.provider.endpoint,
          'goal_finalization_actor_endpoint_invalid'
        );
        const command = requiredText(endpoint.command, 'goal_finalization_actor_endpoint_invalid');
        if (input.selection.host === 'codex') {
          const binding = codexBinding({
            selection: input.selection,
            credential: input.credential,
            snapshotRoot: snapshot.root,
            env: baseEnv,
            readCredentialSecret,
          });
          credentialRevision = binding.credentialRevision;
          credentialEnvironmentVariable = binding.credentialEnvironmentVariable;
          runtimeConfigHash = binding.runtimeConfigHash;
          argv = actorCodexArgs(
            buildCodexCliJudgeArgs({
              cwd: snapshot.root,
              outputSchemaPath,
              outputLastMessagePath: outputPath,
              configuredModel: configuredModel(input.selection.provider),
            })
          );
          const prompt = buildCodexCliJudgePrompt({
            systemPrompt: invocation.systemPrompt,
            request,
            readAllowlist: snapshot.allowlist,
          });
          const execution = await (dependencies.executeCodexCliCommand ?? executeCodexCliCommand)({
            command,
            args: argv,
            cwd: snapshot.root,
            stdin: prompt,
            timeoutMs: timeoutMs(input.selection.provider),
            env: binding.env,
            outputPath,
          });
          stdout = execution.stdout;
          stderr = execution.stderr;
          if (execution.exitCode !== 0) {
            throw new Error(`goal_finalization_actor_cli_failed:${execution.exitCode}`);
          }
          structuredOutput = parseCodexStructuredOutput(stdout);
          protocol = 'codex_exec_jsonl';
        } else {
          const binding = claudeBinding({
            selection: input.selection,
            credential: input.credential,
            env: baseEnv,
            readCredentialSecret,
          });
          credentialRevision = binding.credentialRevision;
          credentialEnvironmentVariable = binding.credentialEnvironmentVariable;
          argv = actorClaudeArgs(
            buildClaudeCodeCliJudgeArgs({
              provider: input.selection.provider,
              systemPrompt: invocation.systemPrompt,
              structuredOutputSchema: invocation.structuredOutputSchema,
            })
          );
          const prompt = buildToolFreeClaudePrompt({
            systemPrompt: invocation.systemPrompt,
            request,
            snapshot,
          });
          const execution = await (
            dependencies.executeClaudeCodeCliCommand ?? executeClaudeCodeCliCommand
          )({
            command,
            args: argv,
            cwd: snapshot.root,
            stdin: prompt,
            timeoutMs: timeoutMs(input.selection.provider),
            env: binding.env,
          });
          stdout = execution.stdout;
          stderr = execution.stderr;
          if (execution.exitCode !== 0) {
            throw new Error(`goal_finalization_actor_cli_failed:${execution.exitCode}`);
          }
          const transcript = parseClaudeTranscript(
            stdout,
            configuredModel(input.selection.provider)
          );
          structuredOutput = transcript.structuredOutput;
          providerRequestId = transcript.providerRequestId;
          observedModel = transcript.observedModel;
          protocol = 'claude_stream_json';
        }
        const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
          invocation.structuredOutputSchema
        );
        if (!validate(structuredOutput)) {
          throw new Error('goal_finalization_actor_structured_output_invalid');
        }
        const actorIsolationReceipt = compileActorIsolationReceipt(
          invocation.intent,
          input.selection.host,
          snapshot.hash
        );
        const receiptBase = {
          schemaVersion: 'BoundedStructuredActorTransportReceipt/v1',
          actorClass: invocation.expectedActorClass,
          providerRef: input.selection.providerRef,
          providerRegistryHash: input.selection.registryHash,
          adapterRef: input.selection.adapterRef,
          command: requiredText(
            record(input.selection.provider.endpoint, 'goal_finalization_actor_endpoint_invalid')
              .command,
            'goal_finalization_actor_endpoint_invalid'
          ),
          protocol,
          argv,
          configuredModel: configuredModel(input.selection.provider),
          observedModel,
          providerRequestId,
          credentialRevision,
          credentialEnvironmentVariable,
          runtimeConfigHash,
          snapshotHash: snapshot.hash,
          actorIsolationReceiptHash: actorIsolationReceipt.isolationReceiptHash,
          readAllowlist: snapshot.allowlist,
          stdoutHash: sha256(stdout),
          stderrHash: sha256(stderr),
          structuredOutputHash: sha256(stableStringify(structuredOutput)),
        };
        const sourceLedgerHash = sha256(stableStringify(receiptBase));
        return { sourceLedgerHash, structuredOutput, actorIsolationReceipt };
      } finally {
        snapshot.dispose();
      }
    },
  };
}
