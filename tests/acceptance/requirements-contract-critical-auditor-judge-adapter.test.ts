import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import * as orchestration from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import type {
  ClaudeCodeCliCommandInvocation,
  ClaudeCodeCliCommandResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';
import type {
  CodexCliCommandInvocation,
  CodexCliCommandResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter';
import { buildCriticalAuditorJudgeRuntimeBinding } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import { readCommittedRequirementsContractCriticalAuditorJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

type JudgeAdapterCommand = (options: {
  cwd?: string;
  projectRoot: string;
  config: string;
  request: string;
  round: number;
  outputDir?: string;
  json?: boolean;
  fetch?: typeof fetch;
}) => Promise<JsonRecord>;

type RawJudgeAdapterCommand = (options: {
  cwd?: string;
  projectRoot: string;
  config: string;
  request: string;
  round: number;
  outputDir?: string;
  json?: boolean;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
}) => Promise<JsonRecord>;

const ACTION_SOURCE = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter.ts'
);
const ACTION_DIST = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter.js'
);
const JUDGE_INVOCATION_SOURCE = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation.ts'
);

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function withInvocationStateHash(value: JsonRecord): JsonRecord {
  const withoutHash = { ...value };
  delete withoutHash.stateHash;
  return {
    ...withoutHash,
    stateHash: `sha256:${createHash('sha256').update(JSON.stringify(withoutHash)).digest('hex')}`,
  };
}

function withInvocationReceiptHash(value: JsonRecord): JsonRecord {
  const withoutHash = { ...value };
  delete withoutHash.receiptHash;
  return {
    ...withoutHash,
    receiptHash: sha256Stable(withoutHash),
  };
}

function withInvocationCommitHash(value: JsonRecord): JsonRecord {
  const withoutHash = { ...value };
  delete withoutHash.commitHash;
  return {
    ...withoutHash,
    commitHash: sha256Stable(withoutHash),
  };
}

function withInvocationLockOwnerHash(value: JsonRecord): JsonRecord {
  const withoutHash = { ...value };
  delete withoutHash.ownerHash;
  return {
    ...withoutHash,
    ownerHash: sha256JsonContent(withoutHash),
  };
}

function sha256FileContent(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function sha256JsonContent(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function claudeReadResult(filePath: string): string {
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line, index) => `${index + 1}\t${line}`)
    .join('\n');
}

function rewriteCommittedBundle(input: {
  outputDir: string;
  persisted: JsonRecord;
  receipt: JsonRecord;
  state: JsonRecord;
}): void {
  const resultPath = path.join(input.outputDir, 'judge-provider-result.json');
  const receiptPath = path.join(input.outputDir, 'judge-provider-invocation-receipt.json');
  const statePath = path.join(input.outputDir, 'judge-provider-invocation-state.json');
  const commitPath = path.join(input.outputDir, 'judge-provider-invocation-commit.json');
  const commit = record(JSON.parse(readFileSync(commitPath, 'utf8')), 'test_commit_missing');
  writeFileSync(resultPath, `${JSON.stringify(input.persisted, null, 2)}\n`, 'utf8');
  const rewrittenReceipt = withInvocationReceiptHash({
    ...input.receipt,
    resultContentHash: sha256FileContent(resultPath),
  });
  writeFileSync(receiptPath, `${JSON.stringify(rewrittenReceipt, null, 2)}\n`, 'utf8');
  const rewrittenState = withInvocationStateHash({
    ...input.state,
    resultContentHash: sha256FileContent(resultPath),
    receiptHash: rewrittenReceipt.receiptHash,
    receiptContentHash: sha256FileContent(receiptPath),
  });
  writeFileSync(statePath, `${JSON.stringify(rewrittenState, null, 2)}\n`, 'utf8');
  const rewrittenCommit = withInvocationCommitHash({
    ...commit,
    stateContentHash: sha256FileContent(statePath),
    resultContentHash: sha256FileContent(resultPath),
    receiptContentHash: sha256FileContent(receiptPath),
    receiptHash: rewrittenReceipt.receiptHash,
  });
  writeFileSync(commitPath, `${JSON.stringify(rewrittenCommit, null, 2)}\n`, 'utf8');
}

function writeInvocationLockOwner(input: {
  lockPath: string;
  state: JsonRecord;
  ownerProcessId?: number;
}): void {
  const invocationId = String(input.state.invocationId);
  const owner = withInvocationLockOwnerHash({
    schemaVersion: 'critical-auditor-judge-invocation-lock-owner/v1',
    invocationId,
    generationId: invocationId,
    invocationBindingHash: input.state.invocationBindingHash,
    ownerProcessId: input.ownerProcessId ?? Number.MAX_SAFE_INTEGER,
    startedAt: input.state.startedAt,
  });
  writeFileSync(
    path.join(input.lockPath, 'owner.json'),
    `${JSON.stringify(owner, null, 2)}\n`,
    'utf8'
  );
}

function replaceCliArgument(argv: string[], flag: string, replacement?: string): string[] {
  const index = argv.indexOf(flag);
  if (index < 0) throw new Error(`test_cli_argument_missing:${flag}`);
  if (replacement === undefined) {
    return argv.filter((_value, itemIndex) => itemIndex !== index && itemIndex !== index + 1);
  }
  return argv.map((value, itemIndex) => (itemIndex === index + 1 ? replacement : value));
}

function readCommittedBundle(outputDir: string): {
  persisted: JsonRecord;
  normalized: JsonRecord;
  transportEvidence: JsonRecord;
  receipt: JsonRecord;
  state: JsonRecord;
} {
  const persisted = record(
    JSON.parse(readFileSync(path.join(outputDir, 'judge-provider-result.json'), 'utf8')),
    'test_result_missing'
  );
  const normalized = record(
    persisted.normalizedProviderResponse,
    'test_normalized_response_missing'
  );
  return {
    persisted,
    normalized,
    transportEvidence: record(normalized.transportEvidence, 'test_transport_evidence_missing'),
    receipt: record(
      JSON.parse(
        readFileSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'), 'utf8')
      ),
      'test_receipt_missing'
    ),
    state: record(
      JSON.parse(
        readFileSync(path.join(outputDir, 'judge-provider-invocation-state.json'), 'utf8')
      ),
      'test_state_missing'
    ),
  };
}

function requiredReturnedModel(normalized: JsonRecord): string {
  const model = String(normalized.returnedModel ?? '');
  if (!model) throw new Error('test_returned_model_missing');
  return model;
}

function nativeReadEventsFromCommittedSnapshot(input: {
  root: string;
  outputDir: string;
}): JsonRecord[] {
  const bundle = readCommittedBundle(input.outputDir);
  const returnedModel = requiredReturnedModel(bundle.normalized);
  const snapshotManifestPath = path.resolve(
    input.root,
    String(bundle.transportEvidence.snapshotManifestPath)
  );
  const snapshotRoot = path.dirname(snapshotManifestPath);
  const manifest = record(
    JSON.parse(readFileSync(snapshotManifestPath, 'utf8')),
    'test_snapshot_manifest_missing'
  );
  const entries = Array.isArray(manifest.entries) ? (manifest.entries as JsonRecord[]) : [];
  return entries.flatMap((entry) => {
    const relativePath = String(entry.path);
    const filePath = path.join(snapshotRoot, relativePath);
    const toolUseId = `tool/${randomUUID()}`;
    const content =
      Number(entry.bytes) === 0
        ? `<system-reminder>empty-read/${randomUUID()}</system-reminder>`
        : claudeReadResult(filePath);
    return [
      {
        type: 'assistant',
        message: {
          model: returnedModel,
          content: [
            {
              type: 'tool_use',
              id: toolUseId,
              name: 'Read',
              input: { file_path: relativePath },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content,
            },
          ],
        },
      },
    ];
  });
}

function rewriteCommittedTranscript(input: {
  root: string;
  outputDir: string;
  events: JsonRecord[];
  transportPatch?: JsonRecord;
}): void {
  const bundle = readCommittedBundle(input.outputDir);
  const stdoutPath = path.resolve(input.root, String(bundle.transportEvidence.stdoutPath));
  const transcriptPath = path.resolve(input.root, String(bundle.transportEvidence.transcriptPath));
  const transcript = `${input.events.map((event) => JSON.stringify(event)).join('\n')}\n`;
  writeFileSync(stdoutPath, transcript, 'utf8');
  writeFileSync(transcriptPath, transcript, 'utf8');
  const nativeTransportEvidence =
    input.transportPatch?.executorKind === 'native_spawn'
      ? (() => {
          const initEvents = input.events.filter(
            (event) => event.type === 'system' && event.subtype === 'init'
          );
          const resultEvent = [...input.events].reverse().find((event) => event.type === 'result');
          const modelUsage =
            resultEvent &&
            resultEvent.modelUsage &&
            typeof resultEvent.modelUsage === 'object' &&
            !Array.isArray(resultEvent.modelUsage)
              ? (resultEvent.modelUsage as JsonRecord)
              : {};
          const command = String(bundle.transportEvidence.command);
          const argv = Array.isArray(bundle.transportEvidence.argv)
            ? bundle.transportEvidence.argv.map(String)
            : [];
          return {
            commandResolution: 'process_spawn_path_search',
            launchCommand: command,
            launchCommandHash: sha256Stable(command),
            launchArgv: argv,
            launchEntryPath: null,
            launchEntryHash: null,
            initModel:
              initEvents.length === 1 ? String(initEvents[0].model ?? '').trim() || null : null,
            modelUsageModels: Object.keys(modelUsage).sort(),
          };
        })()
      : {};
  const transportEvidence = {
    ...bundle.transportEvidence,
    ...nativeTransportEvidence,
    ...input.transportPatch,
    stdoutHash: sha256FileContent(stdoutPath),
    transcriptHash: sha256FileContent(transcriptPath),
  };
  rewriteCommittedBundle({
    outputDir: input.outputDir,
    persisted: {
      ...bundle.persisted,
      normalizedProviderResponse: {
        ...bundle.normalized,
        responseHash: sha256FileContent(stdoutPath),
        transportEvidence,
      },
    },
    receipt: {
      ...bundle.receipt,
      providerResponseHash: sha256FileContent(stdoutPath),
      transportEvidence,
      transportEvidenceHash: sha256JsonContent(transportEvidence),
    },
    state: bundle.state,
  });
}

function rewriteNativeStructuredOutputTranscript(input: {
  root: string;
  outputDir: string;
  structuredOutputs: JsonRecord[];
}): void {
  const bundle = readCommittedBundle(input.outputDir);
  const returnedModel = requiredReturnedModel(bundle.normalized);
  const transcriptPath = path.resolve(input.root, String(bundle.transportEvidence.transcriptPath));
  const existingEvents = readFileSync(transcriptPath, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
  const resultEvents = existingEvents.filter((event) => event.type === 'result');
  const snapshotRoot = path.dirname(
    path.resolve(input.root, String(bundle.transportEvidence.snapshotManifestPath))
  );
  const readEvents = nativeReadEventsFromCommittedSnapshot(input);
  const structuredOutputEvents = input.structuredOutputs.flatMap((structuredOutput) => {
    const toolUseId = `tool/${randomUUID()}`;
    return [
      {
        type: 'assistant',
        message: {
          model: returnedModel,
          content: [
            {
              type: 'tool_use',
              id: toolUseId,
              name: 'StructuredOutput',
              input: structuredOutput,
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: `accepted/${randomUUID()}`,
            },
          ],
        },
      },
    ];
  });
  rewriteCommittedTranscript({
    root: input.root,
    outputDir: input.outputDir,
    events: [
      {
        type: 'system',
        subtype: 'init',
        cwd: snapshotRoot,
        session_id: String(bundle.normalized.providerRequestId),
        tools: ['Read', 'StructuredOutput'],
        mcp_servers: [],
        model: returnedModel,
        permissionMode: 'dontAsk',
      },
      ...readEvents,
      ...structuredOutputEvents,
      ...resultEvents,
    ],
    transportPatch: {
      executorKind: 'native_spawn',
      processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
    },
  });
}

function createFixture(
  options: {
    credentialRef?: unknown;
    onRootCreated?: (root: string) => void;
  } = {}
) {
  const root = mkdtempSync(path.join(tmpdir(), 'critical-auditor-judge-adapter-'));
  options.onRootCreated?.(root);
  const configRelativePath = path.join('_bmad', '_config', 'governance-remediation.yaml');
  const configPath = path.join(root, configRelativePath);
  mkdirSync(path.dirname(configPath), { recursive: true });
  const configText = readFileSync(
    path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'),
    'utf8'
  );
  writeFileSync(configPath, configText, 'utf8');

  const config = record(yaml.load(configText), 'test_governance_config_invalid');
  const judgeRuntime = record(config.judgeRuntime, 'test_judge_runtime_missing');
  const credentialConfig = record(
    judgeRuntime.credentialConfig,
    'test_judge_credential_config_missing'
  );
  const providerRef = 'test-claude-judge';
  const provider: JsonRecord = {
    enabled: true,
    transport: 'cli',
    adapterRef: 'ClaudeCodeCliJudgeAdapter',
    apiStyle: 'cli',
    credentialRef: Object.prototype.hasOwnProperty.call(options, 'credentialRef')
      ? options.credentialRef
      : 'test-claude-credential',
    model: null,
    endpoint: {
      command: 'claude',
      baseUrl: 'http://127.0.0.1:9',
      resolutionMode: 'path_search',
      routingOwnership: 'transport_adapter',
      upstreamVersioning: 'gateway_managed',
      explicitOperationPath: null,
    },
    authentication: {
      type: 'bearer',
      sensitivity: 'secret',
      arbitraryNonEmptyValueAllowed: false,
    },
    auditPolicy: {
      independenceClass: 'different_provider_different_model',
      blindReview: true,
      allowPassAuthority: false,
      toolsAllowed: true,
      allowedTools: ['Read'],
      implementationWritesAllowed: false,
    },
    requestPolicy: {
      timeoutMs: 1_000,
      maximumAttempts: 1,
      structuredResponseRequired: true,
      maxBudgetUsd: 5,
    },
  };
  judgeRuntime.activeProviderRef = providerRef;
  judgeRuntime.providers = { [providerRef]: provider };
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), 'utf8');
  const credentialRefValue = provider.credentialRef;
  if (
    typeof credentialRefValue !== 'string' ||
    credentialRefValue.trim().length === 0
  ) {
    throw new Error('test_judge_runtime_credential_ref_missing');
  }
  const credentialRef = credentialRefValue;
  const authentication = record(
    provider.authentication,
    'test_judge_runtime_authentication_missing'
  );
  const authenticationType = String(authentication.type);
  const credentialEnvironmentVariable =
    authenticationType === 'bearer'
      ? 'ANTHROPIC_AUTH_TOKEN'
      : authenticationType === 'api_key'
        ? 'ANTHROPIC_API_KEY'
        : '';
  if (!credentialEnvironmentVariable) {
    throw new Error('test_judge_runtime_authentication_unsupported');
  }
  const credentialsPath = path.join(root, String(credentialConfig.path));
  mkdirSync(path.dirname(credentialsPath), { recursive: true });
  writeFileSync(
    credentialsPath,
    [
      `schemaVersion: ${String(credentialConfig.schemaVersion)}`,
      'credentialRevision: 1',
      'providers:',
      `  ${credentialRef}:`,
      `    authenticationType: ${authenticationType}`,
      `    apiKey: test-placeholder-${randomUUID()}`,
      '',
    ].join('\n'),
    'utf8'
  );

  const runtimeBinding = buildCriticalAuditorJudgeRuntimeBinding(judgeRuntime);
  if (!runtimeBinding.binding || runtimeBinding.issueCodes.length > 0) {
    throw new Error(`test_judge_runtime_binding_invalid:${runtimeBinding.issueCodes.join(',')}`);
  }
  const requestSeed = randomUUID();
  const sourceDocument = path.join('evidence', `${randomUUID()}.md`);
  const sourcePath = path.join(root, sourceDocument);
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, `# ${randomUUID()}\n\n${randomUUID()}\n`, 'utf8');
  const projectionGroups = [`projection-group/${randomUUID()}`];
  const projectionRefs = [`projection-ref/${randomUUID()}`];
  const qualityRuleCodes = [`quality-rule/${randomUUID()}`];
  const mustRefs = [`must/${randomUUID()}`];
  const request: JsonRecord = {
    schemaVersion: 'critical-auditor-round-request/v1',
    roundIndex: 1,
    transactionId: `transaction/${randomUUID()}`,
    namespaceVersion: `namespace/${randomUUID()}`,
    auditAttemptId: `audit-attempt/${randomUUID()}`,
    requestHash: null,
    scopeManifestHash: sha256Stable({ requestSeed, role: 'scope-manifest' }),
    attemptKey: sha256Stable({ requestSeed, role: 'attempt-key' }),
    promptTemplateHash: sha256Stable({ requestSeed, role: 'prompt-template' }),
    assessmentSchemaHash: sha256Stable({ requestSeed, role: 'assessment-schema' }),
    providerInvocationHash: sha256Stable({ requestSeed, role: 'provider-invocation' }),
    sourceLedgerHash: sha256Stable({ requestSeed, role: 'source-ledger' }),
    ledgerRef: `ledger/${randomUUID()}`,
    sourceHash: sha256Stable({ requestSeed, role: 'source' }),
    sourceDocument,
    sourceDocumentHash: sha256Stable({ requestSeed, role: 'source-document-semantic' }),
    sourceBytesHash: sha256FileContent(sourcePath),
    semanticModelHash: sha256Stable({ requestSeed, role: 'semantic-model' }),
    implementationConfirmationHash: sha256Stable({
      requestSeed,
      role: 'implementation-confirmation',
    }),
    packetHash: sha256Stable({ requestSeed, role: 'packet' }),
    projectionSetHash: sha256Stable({ requestSeed, projectionRefs }),
    independentProviderBinding: runtimeBinding.binding,
    independentProviderBindingIssueCodes: [],
    mustRefs,
    packetProjectionSummary: {
      projectionGroups,
      projectionRefs,
    },
    projectionQualityGate: {
      requiredRuleCodes: qualityRuleCodes,
    },
    gateDryRun: {
      reportPath: `gate-report/${randomUUID()}.json`,
      gateDryRunHash: sha256Stable({ requestSeed, role: 'gate-dry-run' }),
      reconciliation: {
        issueCount: 0,
      },
      actionableBlockingIssues: [],
    },
    previousReceipts: [],
  };
  request.requestHash = sha256Stable({ ...request, requestHash: null });
  const requestRelativePath = path.join('runtime', 'critical-auditor-request.json');
  const requestPath = path.join(root, requestRelativePath);
  mkdirSync(path.dirname(requestPath), { recursive: true });
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');

  return {
    root,
    configRelativePath,
    requestRelativePath,
    request,
    runtimeBinding: runtimeBinding.binding,
    recoveryRuntimeBinding: {
      ...runtimeBinding.binding,
      credentialRevision: 1,
      credentialEnvironmentVariable,
    },
  };
}

function configureFixtureForCodex(fixture: ReturnType<typeof createFixture>): JsonRecord {
  const configPath = path.join(fixture.root, fixture.configRelativePath);
  const config = record(
    yaml.load(readFileSync(configPath, 'utf8')),
    'test_governance_config_invalid'
  );
  const judgeRuntime = record(config.judgeRuntime, 'test_judge_runtime_missing');
  const providerRef = String(judgeRuntime.activeProviderRef);
  const providers = record(judgeRuntime.providers, 'test_judge_runtime_providers_missing');
  const provider = record(providers[providerRef], 'test_judge_runtime_provider_missing');
  provider.transport = 'cli';
  provider.adapterRef = 'CodexCliJudgeAdapter';
  provider.apiStyle = 'cli';
  provider.model = null;
  provider.endpoint = {
    command: 'codex',
    baseUrl: 'http://127.0.0.1:9',
    resolutionMode: 'path_search',
    routingOwnership: 'transport_adapter',
    upstreamVersioning: 'gateway_managed',
    explicitOperationPath: null,
  };
  provider.requestPolicy = {
    timeoutMs: 1_000,
    maximumAttempts: 1,
    structuredResponseRequired: true,
  };
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), 'utf8');

  const runtimeBinding = buildCriticalAuditorJudgeRuntimeBinding(judgeRuntime);
  if (!runtimeBinding.binding || runtimeBinding.issueCodes.length > 0) {
    throw new Error(
      `test_codex_judge_runtime_binding_invalid:${runtimeBinding.issueCodes.join(',')}`
    );
  }
  fixture.request.independentProviderBinding = runtimeBinding.binding;
  fixture.request.requestHash = sha256Stable({
    ...fixture.request,
    requestHash: null,
  });
  writeFileSync(
    path.join(fixture.root, fixture.requestRelativePath),
    `${JSON.stringify(fixture.request, null, 2)}\n`,
    'utf8'
  );
  return runtimeBinding.binding;
}

function readCommittedFixture(
  fixture: {
    root: string;
    configRelativePath: string;
    requestRelativePath: string;
    request: JsonRecord;
    runtimeBinding: JsonRecord;
    recoveryRuntimeBinding: JsonRecord;
  },
  outputRelativePath: string
) {
  return readCommittedRequirementsContractCriticalAuditorJudgeInvocation({
    projectRoot: fixture.root,
    config: fixture.configRelativePath,
    requestPath: fixture.requestRelativePath,
    outputDir: outputRelativePath,
    round: Number(fixture.request.roundIndex),
    runtimeBinding: fixture.recoveryRuntimeBinding,
  });
}

function requiredArgument(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error(`test_cli_argument_missing:${name}`);
  return value;
}

function optionalArgument(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1]?.trim() : '';
  return value || null;
}

const UNSUPPORTED_CODEX_SCHEMA_KEYWORDS = new Set([
  'allOf',
  'contains',
  'dependentRequired',
  'dependentSchemas',
  'if',
  'maxContains',
  'maxItems',
  'minContains',
  'minItems',
  'not',
  'oneOf',
  'patternProperties',
  'then',
  'unevaluatedItems',
  'uniqueItems',
]);

function codexSchemaViolations(value: unknown, nodePath = '$'): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const node = value as JsonRecord;
  const violations = Object.keys(node)
    .filter((key) => UNSUPPORTED_CODEX_SCHEMA_KEYWORDS.has(key))
    .map((key) => `${nodePath}.${key}`);
  if (node.type === 'object') {
    const properties = record(node.properties ?? {}, 'test_codex_schema_properties_missing');
    const required = Array.isArray(node.required) ? node.required.map(String).sort() : [];
    if (node.additionalProperties !== false) {
      violations.push(`${nodePath}.additionalProperties`);
    }
    if (JSON.stringify(required) !== JSON.stringify(Object.keys(properties).sort())) {
      violations.push(`${nodePath}.required`);
    }
  }
  for (const [name, child] of Object.entries((node.properties ?? {}) as JsonRecord)) {
    violations.push(...codexSchemaViolations(child, `${nodePath}.properties.${name}`));
  }
  if (node.items !== undefined) {
    violations.push(...codexSchemaViolations(node.items, `${nodePath}.items`));
  }
  for (const [name, child] of Object.entries((node.$defs ?? {}) as JsonRecord)) {
    violations.push(...codexSchemaViolations(child, `${nodePath}.$defs.${name}`));
  }
  for (const [index, child] of (Array.isArray(node.anyOf) ? node.anyOf : []).entries()) {
    violations.push(...codexSchemaViolations(child, `${nodePath}.anyOf[${index}]`));
  }
  return violations;
}

function commandExecutorFromFetch(
  fetchImpl: typeof fetch,
  onInvocation?: (invocation: ClaudeCodeCliCommandInvocation) => void
) {
  return async (
    invocation: ClaudeCodeCliCommandInvocation
  ): Promise<ClaudeCodeCliCommandResult> => {
    onInvocation?.(invocation);
    const match = /<judge-request-json>\r?\n([\s\S]*?)\r?\n<\/judge-request-json>/u.exec(
      invocation.stdin
    );
    if (!match) throw new Error('test_cli_request_envelope_missing');
    const configuredModel = optionalArgument(invocation.args, '--model');
    const systemPrompt = requiredArgument(invocation.args, '--system-prompt');
    const response = await fetchImpl('https://judge-transport.invalid/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(configuredModel ? { model: configuredModel } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: match[1] },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return {
        exitCode: response.status,
        stdout: '',
        stderr: responseText,
      };
    }
    const payload = record(JSON.parse(responseText), 'test_cli_transport_payload_invalid');
    const returnedModel = String(payload.model ?? '').trim();
    if (!returnedModel) throw new Error('test_cli_transport_returned_model_missing');
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = record(choices[0], 'test_cli_transport_choice_missing');
    const message = record(firstChoice.message, 'test_cli_transport_message_missing');
    const structuredOutput = record(
      JSON.parse(String(message.content)),
      'test_cli_transport_structured_output_invalid'
    );
    const sessionId = randomUUID();
    const result = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: sessionId,
      modelUsage: {
        [returnedModel]: {
          inputTokens: 1,
          outputTokens: 1,
        },
      },
      permission_denials: [],
      structured_output: structuredOutput,
    };
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(result)}\n`,
      stderr: '',
    };
  };
}

async function loadCommand(
  onInvocation?: (invocation: ClaudeCodeCliCommandInvocation) => void
): Promise<JudgeAdapterCommand> {
  const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
    requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
  };
  const rawCommand = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
  if (typeof rawCommand !== 'function') {
    throw new Error('critical_auditor_judge_adapter_command_missing');
  }
  return async ({ fetch: fetchImpl, ...options }) =>
    rawCommand({
      ...options,
      ...(fetchImpl
        ? {
            executeClaudeCodeCliCommand: commandExecutorFromFetch(fetchImpl, onInvocation),
          }
        : {}),
    });
}

function semanticAssessmentFromRequest(request: JsonRecord): JsonRecord {
  const projectionSummary = record(
    request.packetProjectionSummary,
    'test_packet_projection_summary_missing'
  );
  const qualityGate = record(request.projectionQualityGate, 'test_projection_quality_gate_missing');
  const gateDryRun = record(request.gateDryRun, 'test_gate_dry_run_missing');
  const priorFindingsRequired =
    (Array.isArray(request.previousReceipts) && request.previousReceipts.length > 0) ||
    (Array.isArray(gateDryRun.actionableBlockingIssues) &&
      gateDryRun.actionableBlockingIssues.length > 0);
  const providerBinding = record(
    request.independentProviderBinding,
    'test_independent_provider_binding_missing'
  );
  return {
    schemaVersion: 'critical-auditor-judge-assessment/v1',
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    scopeManifestHash: String(request.scopeManifestHash),
    attemptKey: String(request.attemptKey),
    promptTemplateHash: String(request.promptTemplateHash),
    assessmentSchemaHash: String(request.assessmentSchemaHash),
    providerAuthority: {
      providerRef: String(providerBinding.providerId),
      providerRegistryHash: String(providerBinding.providerRegistryHash),
      providerConfigurationHash: String(providerBinding.providerConfigurationHash),
      credentialRevision: 1,
    },
    ledgerAuthority: {
      ledgerRef: String(request.ledgerRef),
      ledgerHash: String(request.sourceLedgerHash),
    },
    requestHash: String(request.requestHash),
    providerInvocationHash: String(request.providerInvocationHash),
    sourceLedgerHash: String(request.sourceLedgerHash),
    verdict: 'insufficient_audit',
    gapCandidates: [],
    validatedGaps: [],
    rejectedGapCandidates: [],
    mutationPressureFindings: [],
    overBroadTaskFindings: [],
    missingProjectionFindings: [],
    invalidProofFindings: [],
    legacyBypassFindings: [],
    sourceMaterializationFindings: [],
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: projectionSummary.projectionRefs,
    checkedProjectionGroups: projectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: qualityGate.requiredRuleCodes,
    priorFindingsDisposition: priorFindingsRequired
      ? [
          {
            findingRef: `round/${String(request.roundIndex)}/baseline`,
            disposition: 'new',
            evidenceRefs: [String(gateDryRun.reportPath)],
          },
        ]
      : [],
    falsePositiveProofs: [],
    rationale: `Judge reviewed request ${String(request.requestHash)}.`,
  };
}

function semanticRoundResponseFieldsFromAssessment(assessment: JsonRecord): JsonRecord {
  const responseFields = [
    'verdict',
    'gapCandidates',
    'validatedGaps',
    'rejectedGapCandidates',
    'mutationPressureFindings',
    'overBroadTaskFindings',
    'missingProjectionFindings',
    'invalidProofFindings',
    'legacyBypassFindings',
    'sourceMaterializationFindings',
    'reviewedMustRefs',
    'reviewedProjectionRefs',
    'checkedProjectionGroups',
    'checkedProjectionQualityRuleCodes',
    'priorFindingsDisposition',
    'falsePositiveProofs',
    'auditReviewScoring',
    'rationale',
  ];
  return Object.fromEntries(
    responseFields
      .filter((field) => assessment[field] !== undefined)
      .map((field) => [field, assessment[field]])
  );
}

function fakeJudgeFetch(options: {
  includeAssessment: boolean;
  transformAssessment?: (assessment: JsonRecord, request: JsonRecord) => JsonRecord;
}): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userMessage = body.messages?.find((message) => message.role === 'user');
    const request = record(
      JSON.parse(String(userMessage?.content ?? '{}')),
      'test_judge_request_missing'
    );
    const findings = options.includeAssessment
      ? [
          options.transformAssessment?.(semanticAssessmentFromRequest(request), request) ??
            semanticAssessmentFromRequest(request),
        ]
      : [];
    const returnedModel = body.model ?? `gateway-selected-${randomUUID()}`;
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: returnedModel,
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'inconclusive',
                findings,
                challengeRequests: [],
                evidenceRefs: [String(record(request.gateDryRun, 'test_gate_missing').reportPath)],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;
}

function blockingJudgeFetch(onCall: () => void): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    onCall();
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userMessage = body.messages?.find((message) => message.role === 'user');
    const request = record(
      JSON.parse(String(userMessage?.content ?? '{}')),
      'test_judge_request_missing'
    );
    const findingRef = `finding/${randomUUID()}`;
    const returnedModel = body.model ?? `gateway-selected-${randomUUID()}`;
    const assessment = {
      ...semanticAssessmentFromRequest(request),
      verdict: 'blocked',
      gapCandidates: [{ findingRef }],
      rationale: 'The supplied evidence is insufficient for a convergent verdict.',
    };
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: returnedModel,
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'block',
                findings: [assessment],
                challengeRequests: [],
                evidenceRefs: [],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;
}

function newValidGapJudgeFetch(options: { includeRepairActions: boolean }): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string;
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userMessage = body.messages?.find((message) => message.role === 'user');
    const request = record(
      JSON.parse(String(userMessage?.content ?? '{}')),
      'test_judge_request_missing'
    );
    const projectionSummary = record(
      request.packetProjectionSummary,
      'test_packet_projection_summary_missing'
    );
    const qualityGate = record(
      request.projectionQualityGate,
      'test_projection_quality_gate_missing'
    );
    const gateDryRun = record(request.gateDryRun, 'test_gate_dry_run_missing');
    const mustRef = String((request.mustRefs as unknown[])[0]);
    const requirementId = `requirement/${randomUUID()}`;
    const gapId = `gap/${randomUUID()}`;
    const validatedGap: JsonRecord = {
      id: gapId,
      status: 'validated',
      mustRef,
      title: 'The requirement needs a narrower independently provable projection.',
      rationale: 'The current projection combines more than one observable behavior.',
      evidenceRefs: [String(gateDryRun.reportPath)],
      blocking: true,
    };
    if (options.includeRepairActions) {
      validatedGap.repairActions = [
        {
          actionId: `repair/${randomUUID()}`,
          type: 'split_must',
          sourceSpan: { startLine: 1, endLine: 1 },
          sourceText: 'Split the combined behavior into one independently provable requirement.',
          targetField: 'implementationConfirmation.must',
          newValue: {
            id: `must/${randomUUID()}`,
            text: 'The product exposes one independently observable behavior.',
          },
          reason: 'Each projected behavior requires an independent acceptance boundary.',
          mustRefs: [mustRef],
          requirementIds: [requirementId],
        },
      ];
    }
    const returnedModel = body.model ?? `gateway-selected-${randomUUID()}`;
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: returnedModel,
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'block',
                findings: [
                  {
                    ...semanticAssessmentFromRequest(request),
                    verdict: 'new_valid_gap',
                    gapCandidates: [{ ...validatedGap }],
                    validatedGaps: [validatedGap],
                    rejectedGapCandidates: [],
                    mutationPressureFindings: [],
                    overBroadTaskFindings: [],
                    missingProjectionFindings: [],
                    invalidProofFindings: [],
                    legacyBypassFindings: [],
                    sourceMaterializationFindings: [],
                    reviewedMustRefs: request.mustRefs,
                    reviewedProjectionRefs: projectionSummary.projectionRefs,
                    checkedProjectionGroups: projectionSummary.projectionGroups,
                    checkedProjectionQualityRuleCodes: qualityGate.requiredRuleCodes,
                    priorFindingsDisposition: [],
                    falsePositiveProofs: [],
                    rationale: 'A validated semantic gap requires a controlled repair action.',
                  },
                ],
                challengeRequests: [],
                evidenceRefs: [String(gateDryRun.reportPath)],
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;
}

describe('requirements contract Critical Auditor Judge adapter', () => {
  it.each([undefined, null, '', '   '])(
    'rejects a missing fixture credential reference before writing credentials: %s',
    (credentialRef) => {
      let fixtureRoot: string | undefined;
      try {
        expect(() =>
          createFixture({
            credentialRef,
            onRootCreated: (root) => {
              fixtureRoot = root;
            },
          })
        ).toThrow('test_judge_runtime_credential_ref_missing');
      } finally {
        if (fixtureRoot) {
          rmSync(fixtureRoot, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 50,
          });
        }
      }
    }
  );

  it('uses the current package-controlled adapter runtime when no argv is injected', () => {
    const resolveCommand = (
      orchestration as unknown as {
        resolveCriticalAuditorExternalAdapterCommand?: (value: unknown) => string[];
      }
    ).resolveCriticalAuditorExternalAdapterCommand;

    expect(typeof resolveCommand).toBe('function');
    const command = resolveCommand?.(undefined) ?? [];
    expect(command[0]).toBe(process.execPath);
    expect(command[1]?.replace(/\\/gu, '/')).toMatch(/node_modules\/tsx\/dist\/cli\.mjs$/u);
    expect(command[2]?.replace(/\\/gu, '/')).toMatch(
      /source-authority\/scripts\/requirements-contract-critical-auditor-judge-adapter\.ts$/u
    );
    expect(existsSync(ACTION_SOURCE)).toBe(true);
    expect(readFileSync(ACTION_SOURCE, 'utf8')).toContain(
      'export async function requirementsContractCriticalAuditorJudgeAdapterCommand'
    );
    expect(existsSync(ACTION_DIST)).toBe(true);
    expect(readFileSync(ACTION_DIST, 'utf8')).toContain(
      'exports.requirementsContractCriticalAuditorJudgeAdapterCommand'
    );
  });

  it('does not expose fetch as a Judge result injection surface', () => {
    const source = readFileSync(JUDGE_INVOCATION_SOURCE, 'utf8');
    expect(source).not.toContain('fetch?: typeof fetch');
    expect(source).not.toContain('input.fetch');
  });

  it('routes a configured Codex CLI provider through the Codex adapter and preserves model-observation fail-closed behavior', async () => {
    const fixture = createFixture();
    const outputDir = path.join('runtime', `codex-judge-${randomUUID()}`);
    let invocationCount = 0;
    try {
      configureFixtureForCodex(fixture);
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
      };
      const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
      expect(command).toBeTypeOf('function');
      if (!command) return;

      await expect(
        command({
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir,
          executeCodexCliCommand: async (invocation) => {
            invocationCount += 1;
            expect(invocation.command).toBe('codex');
            expect(invocation.args).toContain('exec');
            expect(invocation.args).not.toEqual(
              expect.arrayContaining(['--print', '--permission-mode'])
            );
            mkdirSync(path.dirname(invocation.outputPath), { recursive: true });
            writeFileSync(
              invocation.outputPath,
              `${JSON.stringify({
                decision: 'inconclusive',
                findings: [],
                challengeRequests: [],
                evidenceRefs: [],
              })}\n`,
              'utf8'
            );
            return {
              exitCode: 0,
              stdout: `${JSON.stringify({
                type: 'thread.started',
                thread_id: randomUUID(),
              })}\n${JSON.stringify({
                type: 'turn.completed',
                usage: { input_tokens: 1, output_tokens: 1 },
              })}\n`,
              stderr: '',
            };
          },
        })
      ).rejects.toThrow('codex_cli_judge_model_observation_missing');
      expect(invocationCount).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('validates a Codex common execution receipt through the production Critical Auditor transaction', async () => {
    const fixture = createFixture();
    const outputDir = path.join('runtime', `codex-judge-${randomUUID()}`);
    const returnedModel = `observed-model-${randomUUID()}`;
    try {
      configureFixtureForCodex(fixture);
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
      };
      const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
      expect(command).toBeTypeOf('function');
      if (!command) return;
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');
      const mutationPressureFinding = {
        code: 'mutation_pressure_detected',
        evidenceRef: String(gateDryRun.reportPath),
      };
      assessment.mutationPressureFindings = [
        { __authorityJson: JSON.stringify(mutationPressureFinding) },
      ];

      const result = await command({
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir,
        executeCodexCliCommand: async (invocation) => {
          const schemaPath = path.resolve(
            invocation.cwd,
            requiredArgument(invocation.args, '--output-schema')
          );
          const transportSchema = record(
            JSON.parse(readFileSync(schemaPath, 'utf8')),
            'test_codex_transport_schema_missing'
          );
          expect(codexSchemaViolations(transportSchema)).toEqual([]);
          const definitions = record(
            transportSchema.$defs,
            'test_codex_transport_schema_definitions_missing'
          );
          const objectArray = record(
            definitions.objectArray,
            'test_codex_transport_object_array_missing'
          );
          expect(record(objectArray.items, 'test_codex_transport_object_item_missing')).toMatchObject(
            {
              type: 'object',
              additionalProperties: false,
              required: ['__authorityJson'],
              properties: {
                __authorityJson: { type: 'string' },
              },
            }
          );
          mkdirSync(path.dirname(invocation.outputPath), { recursive: true });
          writeFileSync(
            invocation.outputPath,
            `${JSON.stringify({
              decision: 'inconclusive',
              findings: [assessment],
              challengeRequests: [],
              evidenceRefs: [String(gateDryRun.reportPath)],
            })}\n`,
            'utf8'
          );
          const requestId = randomUUID();
          return {
            exitCode: 0,
            stdout: `${JSON.stringify({
              type: 'thread.started',
              thread_id: requestId,
              model: returnedModel,
            })}\n${JSON.stringify({
              type: 'turn.completed',
              model: returnedModel,
              usage: { input_tokens: 1, output_tokens: 1 },
            })}\n`,
            stderr: '',
          };
        },
      });

      expect(record(result.providerRun, 'test_provider_run_missing')).toMatchObject({
        adapterRef: 'CodexCliJudgeAdapter',
        model: returnedModel,
      });
      const response = record(result.response, 'test_response_missing');
      expect(response).toMatchObject({
        verdict: 'insufficient_audit',
        requestHash: fixture.request.requestHash,
      });
      expect(response.mutationPressureFindings).toEqual([mutationPressureFinding]);
      const receipt = record(
        JSON.parse(
          readFileSync(
            path.join(fixture.root, outputDir, 'judge-provider-invocation-receipt.json'),
            'utf8'
          )
        ),
        'test_judge_invocation_receipt_missing'
      );
      expect(record(receipt.transportEvidence, 'test_transport_evidence_missing')).toMatchObject({
        schemaVersion: 'requirements-contract-cli-judge-execution-receipt/v1',
        adapterRef: 'CodexCliJudgeAdapter',
        observedModel: returnedModel,
        modelObservationSource: 'cli_event',
        decisionBearingModelEvidence: true,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('preserves a valid Codex new-gap repair action through the transport projection', async () => {
    const fixture = createFixture();
    const outputDir = path.join('runtime', `codex-judge-${randomUUID()}`);
    const returnedModel = `observed-model-${randomUUID()}`;
    try {
      configureFixtureForCodex(fixture);
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
      };
      const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
      expect(command).toBeTypeOf('function');
      if (!command) return;
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const mustRef = String((fixture.request.mustRefs as unknown[])[0]);
      const validatedGap = {
        id: `gap/${randomUUID()}`,
        status: 'validated',
        repairActions: [
          {
            actionId: `repair/${randomUUID()}`,
            type: 'split_must',
            sourceSpan: { startLine: 1, endLine: 1 },
            sourceText: 'Split the combined behavior into independently observable requirements.',
            targetField: 'implementationConfirmation.must',
            newValue: {
              sourceMustRef: mustRef,
              replacements: [
                { id: mustRef, text: 'The first behavior is independently observable.' },
                {
                  id: `must/${randomUUID()}`,
                  text: 'The second behavior is independently observable.',
                },
              ],
            },
            reason: 'Each behavior requires its own acceptance boundary.',
            mustRefs: [mustRef],
            requirementIds: [`requirement/${randomUUID()}`],
          },
        ],
      };
      assessment.verdict = 'new_valid_gap';
      assessment.validatedGaps = [{ __authorityJson: JSON.stringify(validatedGap) }];

      const result = await command({
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir,
        executeCodexCliCommand: async (invocation) => {
          mkdirSync(path.dirname(invocation.outputPath), { recursive: true });
          writeFileSync(
            invocation.outputPath,
            `${JSON.stringify({
              decision: 'block',
              findings: [assessment],
              challengeRequests: [],
              evidenceRefs: [],
            })}\n`,
            'utf8'
          );
          const requestId = randomUUID();
          return {
            exitCode: 0,
            stdout: `${JSON.stringify({
              type: 'thread.started',
              thread_id: requestId,
              model: returnedModel,
            })}\n${JSON.stringify({
              type: 'turn.completed',
              model: returnedModel,
              usage: { input_tokens: 1, output_tokens: 1 },
            })}\n`,
            stderr: '',
          };
        },
      });

      const response = record(result.response, 'test_response_missing');
      expect(response.verdict).toBe('new_valid_gap');
      expect(response.validatedGaps).toEqual([validatedGap]);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('revalidates projected Codex output against the full authority schema', async () => {
    const fixture = createFixture();
    const outputDir = path.join('runtime', `codex-judge-${randomUUID()}`);
    const returnedModel = `observed-model-${randomUUID()}`;
    try {
      configureFixtureForCodex(fixture);
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
      };
      const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
      expect(command).toBeTypeOf('function');
      if (!command) return;
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');

      await expect(
        command({
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir,
          executeCodexCliCommand: async (invocation) => {
            mkdirSync(path.dirname(invocation.outputPath), { recursive: true });
            writeFileSync(
              invocation.outputPath,
              `${JSON.stringify({
                decision: 'inconclusive',
                findings: [assessment, { schemaVersion: 'non-authority-finding/v1' }],
                challengeRequests: [],
                evidenceRefs: [String(gateDryRun.reportPath)],
              })}\n`,
              'utf8'
            );
            const requestId = randomUUID();
            return {
              exitCode: 0,
              stdout: `${JSON.stringify({
                type: 'thread.started',
                thread_id: requestId,
                model: returnedModel,
              })}\n${JSON.stringify({
                type: 'turn.completed',
                model: returnedModel,
                usage: { input_tokens: 1, output_tokens: 1 },
              })}\n`,
              stderr: '',
            };
          },
        })
      ).rejects.toThrow('critical_auditor_judge_transport_output_invalid');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('recovers a committed Codex provider invocation with the adapter-owned credential binding', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', `codex-judge-${randomUUID()}`);
    const binRoot = path.join(fixture.root, 'bin');
    const codexEntry =
      process.platform === 'win32'
        ? path.join(binRoot, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
        : path.join(binRoot, 'codex');
    const returnedModel = `observed-model-${randomUUID()}`;
    const providerRequestId = randomUUID();
    const pathEnvironmentKey =
      Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    const previousPath = process.env[pathEnvironmentKey];
    try {
      const runtimeBinding = configureFixtureForCodex(fixture);
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
      };
      const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
      expect(command).toBeTypeOf('function');
      if (!command) return;
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');
      const fakeCodexSource = [
        ...(process.platform === 'win32' ? [] : ['#!/usr/bin/env node']),
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        'const args = process.argv.slice(2);',
        "const outputIndex = args.indexOf('--output-last-message');",
        'if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(64);',
        'const outputPath = path.resolve(process.cwd(), args[outputIndex + 1]);',
        'fs.mkdirSync(path.dirname(outputPath), { recursive: true });',
        `fs.writeFileSync(outputPath, ${JSON.stringify(
          `${JSON.stringify({
            decision: 'inconclusive',
            findings: [assessment],
            challengeRequests: [],
            evidenceRefs: [String(gateDryRun.reportPath)],
          })}\n`
        )}, 'utf8');`,
        `process.stdout.write(${JSON.stringify(
          `${JSON.stringify({
            type: 'thread.started',
            thread_id: providerRequestId,
            model: returnedModel,
          })}\n${JSON.stringify({
            type: 'item.completed',
            item: {
              id: `command/${randomUUID()}`,
              type: 'command_execution',
              command: `read-evidence-${randomUUID()}`,
              aggregated_output: `observed/${randomUUID()}`,
              exit_code: 0,
              status: 'completed',
            },
          })}\n${JSON.stringify({
            type: 'turn.completed',
            model: returnedModel,
            usage: { input_tokens: 1, output_tokens: 1 },
          })}\n`
        )});`,
      ].join('\n');
      mkdirSync(path.dirname(codexEntry), { recursive: true });
      if (process.platform === 'win32') {
        writeFileSync(path.join(binRoot, 'codex.cmd'), '@exit /b 0\r\n', 'utf8');
      }
      writeFileSync(codexEntry, fakeCodexSource, 'utf8');
      if (process.platform !== 'win32') chmodSync(codexEntry, 0o755);
      process.env[pathEnvironmentKey] = [binRoot, previousPath ?? ''].join(path.delimiter);

      await command({
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
      });
      const committed = readCommittedRequirementsContractCriticalAuditorJudgeInvocation({
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        requestPath: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round: Number(fixture.request.roundIndex),
        runtimeBinding: {
          ...runtimeBinding,
          credentialRevision: 1,
          credentialEnvironmentVariable: 'BMAD_CODEX_JUDGE_API_KEY',
        },
      });
      const providerRun = record(committed.result.providerRun, 'test_provider_run_missing');
      expect(providerRun).toMatchObject({
        adapterRef: 'CodexCliJudgeAdapter',
        model: returnedModel,
      });
      expect(record(committed.result.response, 'test_response_missing')).toMatchObject({
        verdict: 'insufficient_audit',
        requestHash: fixture.request.requestHash,
      });
      expect(
        record(committed.receipt.transportEvidence, 'test_transport_evidence_missing')
      ).toMatchObject({
        credentialRevision: 1,
        credentialEnvironmentVariable: 'BMAD_CODEX_JUDGE_API_KEY',
      });
      const receiptRef = {
        path: path.relative(fixture.root, committed.receiptPath).replace(/\\/gu, '/'),
        contentHash: sha256FileContent(committed.receiptPath),
        receiptHash: String(committed.receipt.receiptHash),
      };
      const validateProviderReceipt = (
        orchestration as unknown as {
          validateCriticalAuditorProviderInvocationReceipt?: (input: {
            projectRoot: string;
            receiptRef: unknown;
            requestHash: string;
            sourceDocumentHash: string;
            sourceBytesHash: string;
            semanticModelHash: string;
            projectionSetHash: string;
            providerRunId: string;
            expectedProviderBinding: JsonRecord;
          }) => JsonRecord;
        }
      ).validateCriticalAuditorProviderInvocationReceipt;
      expect(validateProviderReceipt).toBeTypeOf('function');
      if (!validateProviderReceipt) return;
      expect(() =>
        validateProviderReceipt({
          projectRoot: fixture.root,
          receiptRef,
          requestHash: String(fixture.request.requestHash),
          sourceDocumentHash: String(fixture.request.sourceDocumentHash),
          sourceBytesHash: String(fixture.request.sourceBytesHash),
          semanticModelHash: String(fixture.request.semanticModelHash),
          projectionSetHash: String(fixture.request.projectionSetHash),
          providerRunId: String(providerRun.providerRunId),
          expectedProviderBinding: runtimeBinding,
        })
      ).not.toThrow();
      expect(() =>
        validateProviderReceipt({
          projectRoot: fixture.root,
          receiptRef,
          requestHash: String(fixture.request.requestHash),
          sourceDocumentHash: String(fixture.request.sourceDocumentHash),
          sourceBytesHash: String(fixture.request.sourceBytesHash),
          semanticModelHash: String(fixture.request.semanticModelHash),
          projectionSetHash: String(fixture.request.projectionSetHash),
          providerRunId: String(providerRun.providerRunId),
          expectedProviderBinding: {
            ...runtimeBinding,
            configuredBaseUrlHash: sha256Stable({
              commandBindingNonce: randomUUID(),
            }),
          },
        })
      ).toThrow('critical_auditor_judge_invocation_receipt_binding_mismatch');
    } finally {
      if (previousPath === undefined) delete process.env[pathEnvironmentKey];
      else process.env[pathEnvironmentKey] = previousPath;
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it.skipIf(process.platform !== 'win32')(
    'rejects a native Codex committed receipt when its launch executable hash is tampered',
    async () => {
      const fixture = createFixture();
      const outputRelativePath = path.join('runtime', `codex-judge-${randomUUID()}`);
      const binRoot = path.join(fixture.root, 'bin');
      const codexEntry = path.join(binRoot, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      const returnedModel = `observed-model-${randomUUID()}`;
      const providerRequestId = randomUUID();
      const pathEnvironmentKey =
        Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
      const previousPath = process.env[pathEnvironmentKey];
      try {
        const runtimeBinding = configureFixtureForCodex(fixture);
        const assessment = semanticAssessmentFromRequest(fixture.request);
        const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');
        mkdirSync(path.dirname(codexEntry), { recursive: true });
        writeFileSync(path.join(binRoot, 'codex.cmd'), '@exit /b 0\r\n', 'utf8');
        writeFileSync(
          codexEntry,
          [
            "const fs = require('node:fs');",
            "const path = require('node:path');",
            'const args = process.argv.slice(2);',
            "const outputIndex = args.indexOf('--output-last-message');",
            'if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(64);',
            'const outputPath = path.resolve(process.cwd(), args[outputIndex + 1]);',
            'fs.mkdirSync(path.dirname(outputPath), { recursive: true });',
            `fs.writeFileSync(outputPath, ${JSON.stringify(
              `${JSON.stringify({
                decision: 'inconclusive',
                findings: [assessment],
                challengeRequests: [],
                evidenceRefs: [String(gateDryRun.reportPath)],
              })}\n`
            )}, 'utf8');`,
            `process.stdout.write(${JSON.stringify(
              `${JSON.stringify({
                type: 'thread.started',
                thread_id: providerRequestId,
                model: returnedModel,
              })}\n${JSON.stringify({
                type: 'item.completed',
                item: {
                  id: `command/${randomUUID()}`,
                  type: 'command_execution',
                  command: `read-evidence-${randomUUID()}`,
                  aggregated_output: `observed/${randomUUID()}`,
                  exit_code: 0,
                  status: 'completed',
                },
              })}\n${JSON.stringify({
                type: 'turn.completed',
                model: returnedModel,
                usage: { input_tokens: 1, output_tokens: 1 },
              })}\n`
            )});`,
          ].join('\n'),
          'utf8'
        );
        process.env[pathEnvironmentKey] = [binRoot, previousPath ?? ''].join(path.delimiter);

        const actionModule = (await import(
          /* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href
        )) as {
          requirementsContractCriticalAuditorJudgeAdapterCommand?: RawJudgeAdapterCommand;
        };
        const command = actionModule.requirementsContractCriticalAuditorJudgeAdapterCommand;
        expect(command).toBeTypeOf('function');
        if (!command) return;
        await command({
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
        });

        const outputDir = path.join(fixture.root, outputRelativePath);
        const recoveryRuntimeBinding = {
          ...runtimeBinding,
          credentialRevision: 1,
          credentialEnvironmentVariable: 'BMAD_CODEX_JUDGE_API_KEY',
        };
        expect(
          readCommittedRequirementsContractCriticalAuditorJudgeInvocation({
            projectRoot: fixture.root,
            config: fixture.configRelativePath,
            requestPath: fixture.requestRelativePath,
            outputDir: outputRelativePath,
            round: Number(fixture.request.roundIndex),
            runtimeBinding: recoveryRuntimeBinding,
          }).result
        ).toBeTruthy();

        const bundle = readCommittedBundle(outputDir);
        const transportEvidence = {
          ...bundle.transportEvidence,
          launchCommandHash: sha256Stable({ tampered: randomUUID() }),
        };
        rewriteCommittedBundle({
          outputDir,
          persisted: {
            ...bundle.persisted,
            normalizedProviderResponse: {
              ...bundle.normalized,
              transportEvidence,
            },
          },
          receipt: {
            ...bundle.receipt,
            transportEvidence,
            transportEvidenceHash: sha256JsonContent(transportEvidence),
          },
          state: bundle.state,
        });

        expect(() =>
          readCommittedRequirementsContractCriticalAuditorJudgeInvocation({
            projectRoot: fixture.root,
            config: fixture.configRelativePath,
            requestPath: fixture.requestRelativePath,
            outputDir: outputRelativePath,
            round: Number(fixture.request.roundIndex),
            runtimeBinding: recoveryRuntimeBinding,
          })
        ).toThrow('critical_auditor_judge_cli_launch_provenance_mismatch');
      } finally {
        if (previousPath === undefined) delete process.env[pathEnvironmentKey];
        else process.env[pathEnvironmentKey] = previousPath;
        rmSync(fixture.root, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 50,
        });
      }
    }
  );

  it('derives identity from the request and semantic claims from the configured Judge response', async () => {
    const fixture = createFixture();
    try {
      const command = await loadCommand();
      const result = await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });
      const providerRun = record(result.providerRun, 'test_provider_run_missing');
      const response = record(result.response, 'test_response_missing');
      const assessment = semanticAssessmentFromRequest(fixture.request);
      const semanticAssessment = semanticRoundResponseFieldsFromAssessment(assessment);
      const { model: requestedModel, ...runtimeIdentity } = fixture.runtimeBinding;

      expect(result.schemaVersion).toBe('critical-auditor-external-adapter-result/v1');
      expect(providerRun).toMatchObject({
        ...runtimeIdentity,
        requestedModel,
      });
      expect(String(providerRun.model)).not.toBe('');
      expect(String(providerRun.providerRunId)).not.toBe('');
      expect(response).toMatchObject({
        schemaVersion: 'critical-auditor-round-response/v1',
        roundIndex: fixture.request.roundIndex,
        transactionId: fixture.request.transactionId,
        requestHash: fixture.request.requestHash,
        sourceDocumentHash: fixture.request.sourceDocumentHash,
        semanticModelHash: fixture.request.semanticModelHash,
        projectionSetHash: fixture.request.projectionSetHash,
        ...semanticAssessment,
      });
      expect(JSON.stringify(result)).not.toContain('test-placeholder-');
      expect(response).not.toHaveProperty('independentProviderEvidence');
      const receiptPath = path.join(
        path.dirname(path.join(fixture.root, fixture.requestRelativePath)),
        'judge-provider-invocation',
        'judge-provider-invocation-receipt.json'
      );
      const receipt = record(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        'test_judge_invocation_receipt_missing'
      );
      const receiptWithoutHash = { ...receipt };
      delete receiptWithoutHash.receiptHash;
      expect(receipt.receiptHash).toBe(sha256Stable(receiptWithoutHash));
      const actionSource = readFileSync(ACTION_SOURCE, 'utf8');
      expect(actionSource).not.toContain('E2E-001');
      expect(actionSource).not.toContain('tests/e2e/persist.e2e.test.ts');
      expect(actionSource).not.toContain('Persist value.');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('keeps large reviewed projection authority domains out of the Windows command line', async () => {
    const fixture = createFixture();
    let invocation: ClaudeCodeCliCommandInvocation | undefined;
    try {
      const windowsCreateProcessCommandLineLimit = 32_767;
      const projectionRefs: string[] = [];
      while (
        Buffer.byteLength(JSON.stringify(projectionRefs), 'utf8') <=
        windowsCreateProcessCommandLineLimit
      ) {
        projectionRefs.push(`projection-ref/${randomUUID()}`);
      }
      const projectionSummary = record(
        fixture.request.packetProjectionSummary,
        'test_packet_projection_summary_missing'
      );
      projectionSummary.projectionRefs = projectionRefs;
      fixture.request.projectionSetHash = sha256Stable({ projectionRefs });
      fixture.request.requestHash = sha256Stable({
        ...fixture.request,
        requestHash: null,
      });
      writeFileSync(
        path.join(fixture.root, fixture.requestRelativePath),
        `${JSON.stringify(fixture.request, null, 2)}\n`,
        'utf8'
      );

      const command = await loadCommand((value) => {
        invocation = value;
      });
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({
          includeAssessment: true,
          transformAssessment: (assessment) => ({
            ...assessment,
            reviewedProjectionRefs: [projectionRefs[0]],
          }),
        }),
      });

      const argv = invocation?.args ?? [];
      const serializedArgvLength = ['claude', ...argv].join(' ').length;
      const serializedSchema = requiredArgument(argv, '--json-schema');
      const schema = record(
        JSON.parse(serializedSchema),
        'test_cli_structured_output_schema_missing'
      );
      const schemaProperties = record(schema.properties, 'test_cli_schema_properties_missing');
      const findings = record(schemaProperties.findings, 'test_cli_findings_schema_missing');
      const findingItems = record(findings.items, 'test_cli_finding_items_schema_missing');
      const findingProperties = record(
        findingItems.properties,
        'test_cli_finding_properties_missing'
      );
      const reviewedProjectionRefs = record(
        findingProperties.reviewedProjectionRefs,
        'test_cli_reviewed_projection_refs_schema_missing'
      );
      const reviewedProjectionRefItems = record(
        reviewedProjectionRefs.items,
        'test_cli_reviewed_projection_ref_items_missing'
      );
      expect(serializedArgvLength).toBeLessThan(windowsCreateProcessCommandLineLimit);
      expect(reviewedProjectionRefItems).toEqual({
        type: 'string',
        minLength: 1,
      });
      expect(reviewedProjectionRefItems).not.toHaveProperty('enum');
      expect(serializedSchema).not.toContain(projectionRefs.at(-1));
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a reviewed projection ref outside the current request authority domain', async () => {
    const fixture = createFixture();
    try {
      const projectionSummary = record(
        fixture.request.packetProjectionSummary,
        'test_packet_projection_summary_missing'
      );
      const allowedProjectionRefs = new Set(
        [...(projectionSummary.projectionRefs as unknown[])].map(String)
      );
      let unknownProjectionRef = `projection-ref/${randomUUID()}`;
      while (allowedProjectionRefs.has(unknownProjectionRef)) {
        unknownProjectionRef = `projection-ref/${randomUUID()}`;
      }
      const command = await loadCommand();

      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: fakeJudgeFetch({
            includeAssessment: true,
            transformAssessment: (assessment) => ({
              ...assessment,
              reviewedProjectionRefs: [unknownProjectionRef],
            }),
          }),
        })
      ).rejects.toThrow('critical_auditor_judge_reviewed_projection_ref_unknown');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('forbids audit review scoring when the request does not declare a scoring contract', async () => {
    const fixture = createFixture();
    let invocation: ClaudeCodeCliCommandInvocation | undefined;
    try {
      const command = await loadCommand((value) => {
        invocation = value;
      });
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });

      const transportSchema = record(
        JSON.parse(requiredArgument(invocation?.args ?? [], '--json-schema')),
        'test_cli_structured_output_schema_missing'
      );
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(transportSchema);
      const assessment = {
        ...semanticAssessmentFromRequest(fixture.request),
        auditReviewScoring: null,
      };

      expect(
        validate({
          decision: 'inconclusive',
          findings: [assessment],
          challengeRequests: [],
          evidenceRefs: [],
        })
      ).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('requires audit review scoring when the request declares a scoring contract', async () => {
    const fixture = createFixture();
    try {
      const expectedDimensions = [`dimension/${randomUUID()}`, `dimension/${randomUUID()}`];
      fixture.request.auditReviewScoringContract = {
        schemaVersion: 'audit-review-scoring-contract/v1',
        auditStage: `stage/${randomUUID()}`,
        scoreStage: `score-stage/${randomUUID()}`,
        dimensionContractId: `dimension-contract/${randomUUID()}`,
        dimensionMode: `dimension-mode/${randomUUID()}`,
        expectedDimensions,
        minimumPhaseScore: 80,
        scoringPolicyPath: `_bmad/_config/${randomUUID()}.yaml`,
        scoringPolicyHash: sha256Stable({ expectedDimensions }),
        vetoForbidden: true,
        approvedEffectiveVerdictRequired: true,
        structuredDriftSignalIds: [
          'smoke_task_chain',
          'closure_task_id',
          'journey_unlock',
          'gap_split_contract',
          'shared_path_reference',
        ],
      };
      fixture.request.requestHash = sha256Stable({
        ...fixture.request,
        requestHash: null,
      });
      writeFileSync(
        path.join(fixture.root, fixture.requestRelativePath),
        `${JSON.stringify(fixture.request, null, 2)}\n`,
        'utf8'
      );

      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: fakeJudgeFetch({ includeAssessment: true }),
        })
      ).rejects.toThrow('critical_auditor_judge_assessment_schema_invalid');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects new_valid_gap Judge output without materializable repair actions', async () => {
    const fixture = createFixture();
    try {
      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: newValidGapJudgeFetch({ includeRepairActions: false }),
        })
      ).rejects.toThrow('critical_auditor_judge_assessment_invalid');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects request content tampering while retaining the prior requestHash', async () => {
    const fixture = createFixture();
    try {
      const requestPath = path.join(fixture.root, fixture.requestRelativePath);
      const tamperedRequest = {
        ...fixture.request,
        transactionId: `transaction/${randomUUID()}`,
      };
      writeFileSync(requestPath, `${JSON.stringify(tamperedRequest, null, 2)}\n`, 'utf8');

      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: fakeJudgeFetch({ includeAssessment: true }),
        })
      ).rejects.toThrow('critical_auditor_judge_request_hash_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects missing Source Requirement path before invoking the Judge transport', async () => {
    const fixture = createFixture();
    let transportCalls = 0;
    try {
      const requestPath = path.join(fixture.root, fixture.requestRelativePath);
      delete fixture.request.sourceDocument;
      fixture.request.requestHash = sha256Stable({
        ...fixture.request,
        requestHash: null,
      });
      writeFileSync(requestPath, `${JSON.stringify(fixture.request, null, 2)}\n`, 'utf8');

      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        })
      ).rejects.toThrow('claude_code_cli_judge_source_document_missing');
      expect(transportCalls).toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects tampered Source Requirement bytes before invoking the Judge transport', async () => {
    const fixture = createFixture();
    let transportCalls = 0;
    try {
      const sourcePath = path.join(fixture.root, String(fixture.request.sourceDocument));
      writeFileSync(sourcePath, `${randomUUID()}\n`, 'utf8');

      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        })
      ).rejects.toThrow('claude_code_cli_judge_source_bytes_hash_mismatch');
      expect(transportCalls).toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects injected transport evidence replayed through the native production entry', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });

      await expect(command(commonOptions)).rejects.toThrow(
        'critical_auditor_judge_cli_executor_kind_mismatch'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('allows an empty prior-finding disposition when the request has no prior findings', async () => {
    const fixture = createFixture();
    let invocation: ClaudeCodeCliCommandInvocation | undefined;
    try {
      expect(fixture.request.previousReceipts).toEqual([]);
      expect(
        record(fixture.request.gateDryRun, 'test_gate_dry_run_missing').actionableBlockingIssues
      ).toEqual([]);
      const assessment = {
        ...semanticAssessmentFromRequest(fixture.request),
        verdict: 'insufficient_audit',
        priorFindingsDisposition: [],
        rationale: 'No prior finding or actionable dry-run blocker exists to classify.',
      };
      const command = await loadCommand((value) => {
        invocation = value;
      });
      const result = await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: (async (_input: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
          const returnedModel = body.model ?? `gateway-selected-${randomUUID()}`;
          return new Response(
            JSON.stringify({
              id: `provider-run/${randomUUID()}`,
              model: returnedModel,
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      decision: 'inconclusive',
                      findings: [assessment],
                      challengeRequests: [],
                      evidenceRefs: [],
                    }),
                  },
                },
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          );
        }) as typeof fetch,
      });
      const response = record(result.response, 'test_response_missing');
      expect(response.verdict).toBe('insufficient_audit');
      expect(response.priorFindingsDisposition).toEqual([]);
      const transportSchema = record(
        JSON.parse(requiredArgument(invocation?.args ?? [], '--json-schema')),
        'test_cli_structured_output_schema_missing'
      );
      const transportProperties = record(
        transportSchema.properties,
        'test_cli_schema_properties_missing'
      );
      const findings = record(transportProperties.findings, 'test_cli_findings_schema_missing');
      const findingItems = record(findings.items, 'test_cli_finding_items_schema_missing');
      const findingProperties = record(
        findingItems.properties,
        'test_cli_finding_properties_missing'
      );
      const dispositionSchema = record(
        findingProperties.priorFindingsDisposition,
        'test_cli_prior_findings_disposition_schema_missing'
      );
      expect(dispositionSchema.maxItems).toBe(0);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('requires a prior-finding disposition in the transport schema when prior evidence exists', async () => {
    const fixture = createFixture();
    let invocation: ClaudeCodeCliCommandInvocation | undefined;
    try {
      fixture.request.previousReceipts = [
        {
          receiptHash: sha256Stable({ priorReceiptNonce: randomUUID() }),
        },
      ];
      fixture.request.requestHash = sha256Stable({
        ...fixture.request,
        requestHash: null,
      });
      writeFileSync(
        path.join(fixture.root, fixture.requestRelativePath),
        `${JSON.stringify(fixture.request, null, 2)}\n`,
        'utf8'
      );
      const command = await loadCommand((value) => {
        invocation = value;
      });
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });

      const transportSchema = record(
        JSON.parse(requiredArgument(invocation?.args ?? [], '--json-schema')),
        'test_cli_structured_output_schema_missing'
      );
      const transportProperties = record(
        transportSchema.properties,
        'test_cli_schema_properties_missing'
      );
      const findings = record(transportProperties.findings, 'test_cli_findings_schema_missing');
      const findingItems = record(findings.items, 'test_cli_finding_items_schema_missing');
      const findingProperties = record(
        findingItems.properties,
        'test_cli_finding_properties_missing'
      );
      const dispositionSchema = record(
        findingProperties.priorFindingsDisposition,
        'test_cli_prior_findings_disposition_schema_missing'
      );
      expect(dispositionSchema.minItems).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('requires split_must replacements to retain the source MUST identity exactly once', async () => {
    const fixture = createFixture();
    let invocation: ClaudeCodeCliCommandInvocation | undefined;
    try {
      const command = await loadCommand((value) => {
        invocation = value;
      });
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: fakeJudgeFetch({ includeAssessment: true }),
      });
      const transportSchema = record(
        JSON.parse(requiredArgument(invocation?.args ?? [], '--json-schema')),
        'test_cli_structured_output_schema_missing'
      );
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(transportSchema);
      const sourceMustRef = String((fixture.request.mustRefs as unknown[])[0]);
      const replacementId = `${sourceMustRef}-${randomUUID()}`;
      const assessment = {
        ...semanticAssessmentFromRequest(fixture.request),
        verdict: 'new_valid_gap',
        priorFindingsDisposition: [],
        validatedGaps: [
          {
            id: `gap/${randomUUID()}`,
            status: 'validated',
            mustRef: sourceMustRef,
            title: 'The source requirement needs independently provable projections.',
            rationale: 'The current requirement combines multiple observable behaviors.',
            evidenceRefs: [
              String(record(fixture.request.gateDryRun, 'test_gate_dry_run_missing').reportPath),
            ],
            blocking: true,
            repairActions: [
              {
                actionId: `repair/${randomUUID()}`,
                type: 'split_must',
                sourceSpan: { startLine: 1, endLine: 1 },
                sourceText: 'Source requirement text.',
                targetField: 'implementationConfirmation.must',
                newValue: {
                  sourceMustRef,
                  replacements: [
                    { id: `${replacementId}-a`, text: 'First replacement behavior.' },
                    { id: `${replacementId}-b`, text: 'Second replacement behavior.' },
                  ],
                },
                reason: 'Each behavior needs an independent acceptance boundary.',
                mustRefs: [sourceMustRef],
                requirementIds: [`requirement/${randomUUID()}`],
              },
            ],
          },
        ],
      };
      const transportResult = {
        decision: 'block',
        findings: [assessment],
        challengeRequests: [],
        evidenceRefs: [],
      };

      expect(validate(transportResult)).toBe(false);
      const splitAction = (
        (assessment.validatedGaps[0] as JsonRecord).repairActions as JsonRecord[]
      )[0];
      splitAction.newValue = {
        sourceMustRef,
        replacements: [
          { id: sourceMustRef, text: 'Retained source behavior.' },
          { id: replacementId, text: 'Second independently provable behavior.' },
        ],
      };
      expect(validate(transportResult), JSON.stringify(validate.errors, null, 2)).toBe(true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('fails closed instead of synthesizing semantic audit claims when Judge assessment is absent', async () => {
    const fixture = createFixture();
    try {
      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          json: false,
          fetch: fakeJudgeFetch({ includeAssessment: false }),
        })
      ).rejects.toThrow('critical_auditor_judge_assessment_missing');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('reuses a validated committed provider result without invoking the transport again', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });

      const first = await invoke();
      const outputDir = path.join(fixture.root, outputRelativePath);
      const committedPaths = [
        'judge-provider-result.json',
        'judge-provider-invocation-receipt.json',
        'judge-provider-invocation-state.json',
        'judge-provider-invocation-commit.json',
      ].map((fileName) => path.join(outputDir, fileName));
      const committedHashes = committedPaths.map(sha256FileContent);
      const recovered = await invoke();

      expect(transportCalls).toBe(1);
      expect(recovered).toEqual(first);
      expect(committedPaths.map(sha256FileContent)).toEqual(committedHashes);
      const receipt = record(
        JSON.parse(
          readFileSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'), 'utf8')
        ),
        'test_judge_invocation_receipt_missing'
      );
      const state = record(
        JSON.parse(
          readFileSync(path.join(outputDir, 'judge-provider-invocation-state.json'), 'utf8')
        ),
        'test_judge_invocation_state_missing'
      );
      expect(state.status).toBe('committed');
      expect(receipt).toMatchObject({
        requestHash: fixture.request.requestHash,
        sourceDocumentHash: fixture.request.sourceDocumentHash,
        semanticModelHash: fixture.request.semanticModelHash,
        projectionSetHash: fixture.request.projectionSetHash,
        providerRunId: record(first.providerRun, 'test_provider_run_missing').providerRunId,
      });
      const transportEvidence = record(
        receipt.transportEvidence,
        'test_judge_transport_evidence_missing'
      );
      expect(String(transportEvidence.cwd).replace(/\\/gu, '/')).toMatch(/\/r\/[a-f0-9]{16}\/s$/u);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('does not reuse a committed provider generation after host semantic rejection', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation?: (options: {
          projectRoot: string;
          request: string;
          outputDir: string;
          round: number;
          semanticIssueCodes: string[];
        }) => JsonRecord;
      };
      const rejectCommitted =
        actionModule.rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation;
      expect(typeof rejectCommitted).toBe('function');
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });

      const first = await invoke();
      const outputDir = path.join(fixture.root, outputRelativePath);
      const firstState = record(
        JSON.parse(
          readFileSync(path.join(outputDir, 'judge-provider-invocation-state.json'), 'utf8')
        ),
        'test_judge_invocation_state_missing'
      );
      const firstProviderRunId = String(
        record(first.providerRun, 'test_provider_run_missing').providerRunId
      );
      const rejection = rejectCommitted?.({
        projectRoot: fixture.root,
        request: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round: Number(fixture.request.roundIndex),
        semanticIssueCodes: ['critical_auditor_response_semantic_binding_invalid'],
      });
      expect(rejection?.decision).toBe('semantic_rejection_recorded');

      const second = await invoke();
      const secondProviderRunId = String(
        record(second.providerRun, 'test_provider_run_missing').providerRunId
      );
      expect(transportCalls).toBe(2);
      expect(secondProviderRunId).not.toBe(firstProviderRunId);
      const rejectedGenerationDir = path.join(
        outputDir,
        'rejected-generations',
        String(firstState.generationId)
      );
      expect(existsSync(path.join(rejectedGenerationDir, 'semantic-rejection.json'))).toBe(true);
      expect(
        existsSync(path.join(rejectedGenerationDir, 'judge-provider-invocation-commit.json'))
      ).toBe(true);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('commits a provider contract block on the second identical semantic rejection', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation?: (options: {
          projectRoot: string;
          request: string;
          outputDir: string;
          round: number;
          semanticIssueCodes: string[];
        }) => JsonRecord;
      };
      const rejectCommitted =
        actionModule.rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation;
      expect(typeof rejectCommitted).toBe('function');
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      const rejectionInput = {
        projectRoot: fixture.root,
        request: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round: Number(fixture.request.roundIndex),
        semanticIssueCodes: [`critical_auditor_response_${randomUUID().replaceAll('-', '_')}`],
      };

      await invoke();
      const firstRejection = rejectCommitted?.(rejectionInput);
      expect(firstRejection).toMatchObject({
        decision: 'semantic_rejection_recorded',
        retryDecision: 'retry_allowed',
      });
      await invoke();
      const secondRejection = rejectCommitted?.(rejectionInput);
      expect(secondRejection).toMatchObject({
        decision: 'provider_contract_blocked',
        retryDecision: 'provider_contract_blocked',
      });
      expect(
        existsSync(
          path.join(fixture.root, outputRelativePath, 'judge-provider-contract-blocked.json')
        )
      ).toBe(true);
      const terminalError =
        `critical_auditor_judge_provider_contract_blocked:${String(
          secondRejection?.semanticIssueFingerprint
        )}`;
      await expect(invoke()).rejects.toThrow(terminalError);
      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(terminalError);
      expect(transportCalls).toBe(2);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('does not let the production host reuse a semantically rejected committed generation', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation?: (options: {
          projectRoot: string;
          request: string;
          outputDir: string;
          round: number;
          semanticIssueCodes: string[];
        }) => JsonRecord;
      };
      const rejectCommitted =
        actionModule.rejectCommittedRequirementsContractCriticalAuditorJudgeInvocation;
      expect(typeof rejectCommitted).toBe('function');
      const command = await loadCommand();
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
        fetch: blockingJudgeFetch(() => undefined),
      });
      rejectCommitted?.({
        projectRoot: fixture.root,
        request: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round: Number(fixture.request.roundIndex),
        semanticIssueCodes: [`critical_auditor_response_${randomUUID().replaceAll('-', '_')}`],
      });
      expect(() =>
        readCommittedFixture(fixture, outputRelativePath)
      ).toThrow('critical_auditor_judge_committed_generation_semantically_rejected');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('validates committed provider authority before the production host can spawn another Judge', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
        fetch: blockingJudgeFetch(() => undefined),
      });

      expect(() =>
        readCommittedFixture(fixture, outputRelativePath)
      ).toThrow('critical_auditor_judge_cli_executor_kind_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects an output directory junction that resolves outside the project root', async () => {
    const fixture = createFixture();
    const outsideRoot = mkdtempSync(path.join(tmpdir(), 'critical-auditor-output-outside-'));
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    const outputPath = path.join(fixture.root, outputRelativePath);
    let transportCalls = 0;
    try {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      symlinkSync(outsideRoot, outputPath, 'junction');
      const command = await loadCommand();

      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        })
      ).rejects.toThrow('critical_auditor_judge_output_path_realpath_escape');

      expect(transportCalls).toBe(0);
      expect(existsSync(path.join(outsideRoot, 'judge-provider-result.json'))).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      rmSync(outsideRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects committed authority reads through an output directory junction', () => {
    const fixture = createFixture();
    const outsideRoot = mkdtempSync(path.join(tmpdir(), 'critical-auditor-read-outside-'));
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    const outputPath = path.join(fixture.root, outputRelativePath);
    try {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      symlinkSync(outsideRoot, outputPath, 'junction');

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_output_path_realpath_escape'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      rmSync(outsideRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects self-consistent committed CLI evidence that omits xhigh effort', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const resultPath = path.join(outputDir, 'judge-provider-result.json');
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const persisted = record(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        'test_judge_provider_result_missing'
      );
      const normalized = record(
        persisted.normalizedProviderResponse,
        'test_normalized_provider_response_missing'
      );
      const transportEvidence = record(
        normalized.transportEvidence,
        'test_transport_evidence_missing'
      );
      const argv = Array.isArray(transportEvidence.argv) ? transportEvidence.argv.map(String) : [];
      const effortIndex = argv.indexOf('--effort');
      expect(effortIndex).toBeGreaterThanOrEqual(0);
      const downgradedArgv = argv.filter(
        (_value, index) => index !== effortIndex && index !== effortIndex + 1
      );
      const downgradedTransportEvidence = {
        ...transportEvidence,
        argv: downgradedArgv,
      };
      writeFileSync(
        resultPath,
        `${JSON.stringify(
          {
            ...persisted,
            normalizedProviderResponse: {
              ...normalized,
              transportEvidence: downgradedTransportEvidence,
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const receipt = record(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        'test_judge_invocation_receipt_missing'
      );
      const downgradedReceipt = withInvocationReceiptHash({
        ...receipt,
        transportEvidence: downgradedTransportEvidence,
        transportEvidenceHash: sha256JsonContent(downgradedTransportEvidence),
        resultContentHash: sha256FileContent(resultPath),
      });
      writeFileSync(receiptPath, `${JSON.stringify(downgradedReceipt, null, 2)}\n`, 'utf8');

      const state = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_judge_invocation_state_missing'
      );
      const downgradedState = withInvocationStateHash({
        ...state,
        resultContentHash: sha256FileContent(resultPath),
        receiptHash: downgradedReceipt.receiptHash,
        receiptContentHash: sha256FileContent(receiptPath),
      });
      writeFileSync(statePath, `${JSON.stringify(downgradedState, null, 2)}\n`, 'utf8');

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_cli_transport_evidence_invalid'
      );
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects self-consistent committed CLI evidence with a duplicate tools override', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      const invoke = () =>
        command({
          ...commonOptions,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const resultPath = path.join(outputDir, 'judge-provider-result.json');
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const persisted = record(JSON.parse(readFileSync(resultPath, 'utf8')), 'test_result_missing');
      const normalized = record(
        persisted.normalizedProviderResponse,
        'test_normalized_response_missing'
      );
      const transportEvidence = record(
        normalized.transportEvidence,
        'test_transport_evidence_missing'
      );
      const tamperedTransportEvidence = {
        ...transportEvidence,
        argv: [...(transportEvidence.argv as unknown[]).map(String), '--tools', 'default'],
      };
      const receipt = record(JSON.parse(readFileSync(receiptPath, 'utf8')), 'test_receipt_missing');
      const state = record(JSON.parse(readFileSync(statePath, 'utf8')), 'test_state_missing');
      rewriteCommittedBundle({
        outputDir,
        persisted: {
          ...persisted,
          normalizedProviderResponse: {
            ...normalized,
            transportEvidence: tamperedTransportEvidence,
          },
        },
        receipt: {
          ...receipt,
          transportEvidence: tamperedTransportEvidence,
          transportEvidenceHash: sha256JsonContent(tamperedTransportEvidence),
        },
        state,
      });

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_cli_transport_evidence_invalid'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it.each([
    [
      'system prompt',
      (argv: string[]) => replaceCliArgument(argv, '--system-prompt', `tampered/${randomUUID()}`),
    ],
    [
      'structured output schema',
      (argv: string[]) =>
        replaceCliArgument(
          argv,
          '--json-schema',
          JSON.stringify({ type: 'object', additionalProperties: true })
        ),
    ],
    ['maximum budget', (argv: string[]) => replaceCliArgument(argv, '--max-budget-usd', '0.01')],
    ['missing maximum budget', (argv: string[]) => replaceCliArgument(argv, '--max-budget-usd')],
  ])('rejects committed CLI evidence with a tampered %s', async (_label, mutateArgv) => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const argv = Array.isArray(bundle.transportEvidence.argv)
        ? bundle.transportEvidence.argv.map(String)
        : [];
      const transportEvidence = {
        ...bundle.transportEvidence,
        argv: mutateArgv(argv),
      };
      rewriteCommittedBundle({
        outputDir,
        persisted: {
          ...bundle.persisted,
          normalizedProviderResponse: {
            ...bundle.normalized,
            transportEvidence,
          },
        },
        receipt: {
          ...bundle.receipt,
          transportEvidence,
          transportEvidenceHash: sha256JsonContent(transportEvidence),
        },
        state: bundle.state,
      });

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_cli_transport_evidence_invalid'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a self-consistent fake PASS that diverges from the real CLI transcript', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const resultPath = path.join(outputDir, 'judge-provider-result.json');
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const persisted = record(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        'test_judge_provider_result_missing'
      );
      const normalized = record(
        persisted.normalizedProviderResponse,
        'test_normalized_provider_response_missing'
      );
      const findings = Array.isArray(normalized.findings) ? normalized.findings : [];
      const assessment = record(findings[0], 'test_judge_assessment_missing');
      const adapterResult = record(persisted.adapterResult, 'test_judge_adapter_result_missing');
      const response = record(adapterResult.response, 'test_judge_response_missing');
      const forgedAssessment = {
        ...assessment,
        verdict: 'no_new_valid_gap',
        gapCandidates: [],
        validatedGaps: [],
      };
      const forgedResponse = {
        ...response,
        verdict: 'no_new_valid_gap',
        gapCandidates: [],
        validatedGaps: [],
      };
      const forgedPersisted = {
        ...persisted,
        normalizedProviderResponse: {
          ...normalized,
          decision: 'pass',
          findings: [forgedAssessment],
        },
        adapterResult: {
          ...adapterResult,
          response: forgedResponse,
        },
      };
      const receipt = record(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        'test_judge_invocation_receipt_missing'
      );
      const state = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_judge_invocation_state_missing'
      );
      rewriteCommittedBundle({
        outputDir,
        persisted: forgedPersisted,
        receipt: {
          ...receipt,
          responseHash: sha256JsonContent(forgedResponse),
        },
        state,
      });

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_transcript_result_mismatch');
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a committed transcript containing an assistant event from another model', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const structuredOutput = {
        decision: bundle.normalized.decision,
        findings: bundle.normalized.findings,
        challengeRequests: bundle.normalized.challengeRequests,
        evidenceRefs: bundle.normalized.evidenceRefs,
      };
      rewriteNativeStructuredOutputTranscript({
        root: fixture.root,
        outputDir,
        structuredOutputs: [structuredOutput],
      });
      const nativeBundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(nativeBundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      const structuredOutputEvent = events.find((event) => {
        if (event.type !== 'assistant') return false;
        const message = event.message as JsonRecord;
        return Array.isArray(message?.content)
          ? (message.content as JsonRecord[]).some(
              (block) => block.type === 'tool_use' && block.name === 'StructuredOutput'
            )
          : false;
      });
      if (!structuredOutputEvent) throw new Error('test_structured_output_event_missing');
      const structuredOutputMessage = record(
        structuredOutputEvent.message,
        'test_structured_output_message_missing'
      );
      structuredOutputMessage.model = `foreign-model/${randomUUID()}`;
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events,
      });

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_transcript_result_mismatch'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a committed transcript containing an assistant event without model identity', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: `unbound/${randomUUID()}` }],
            },
          },
          ...events,
        ],
      });

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_transcript_result_mismatch');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('accepts gateway-managed native routing when init and decision models differ but are both bound', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      expect(fixture.runtimeBinding.model).toBeNull();
      const command = await loadCommand();
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const resultEvent = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'))
        .find((event) => event.type === 'result');
      if (!resultEvent) throw new Error('test_transcript_result_missing');
      const snapshotManifestPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.snapshotManifestPath)
      );
      const snapshotRoot = path.dirname(snapshotManifestPath);
      const manifest = record(
        JSON.parse(readFileSync(snapshotManifestPath, 'utf8')),
        'test_snapshot_manifest_missing'
      );
      const returnedModel = requiredReturnedModel(bundle.normalized);
      const initModel = `gateway-init/${randomUUID()}`;
      expect(initModel).not.toBe(returnedModel);
      const readEvents = (manifest.entries as JsonRecord[]).flatMap((entry) => {
        const relativePath = String(entry.path);
        const toolUseId = `tool/${randomUUID()}`;
        return [
          {
            type: 'assistant',
            message: {
              model: returnedModel,
              content: [
                {
                  type: 'tool_use',
                  id: toolUseId,
                  name: 'Read',
                  input: { file_path: relativePath },
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseId,
                  content: claudeReadResult(path.join(snapshotRoot, relativePath)),
                },
              ],
            },
          },
        ];
      });
      const structuredOutputToolUseId = `tool/${randomUUID()}`;
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'system',
            subtype: 'init',
            cwd: snapshotRoot,
            session_id: String(bundle.normalized.providerRequestId),
            tools: ['Read', 'StructuredOutput'],
            mcp_servers: [],
            model: initModel,
            permissionMode: 'dontAsk',
          },
          ...readEvents,
          {
            type: 'assistant',
            message: {
              model: returnedModel,
              content: [
                {
                  type: 'tool_use',
                  id: structuredOutputToolUseId,
                  name: 'StructuredOutput',
                  input: resultEvent.structured_output,
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: structuredOutputToolUseId,
                  content: 'Structured output provided successfully',
                },
              ],
            },
          },
          {
            ...resultEvent,
            modelUsage: {
              [initModel]: {
                inputTokens: 1,
                outputTokens: 1,
              },
            },
          },
        ],
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(readCommittedFixture(fixture, outputRelativePath)).toMatchObject({
        result: {
          providerRun: {
            requestedModel: null,
            model: returnedModel,
          },
        },
        receipt: {
          requestedModel: null,
          model: returnedModel,
          transportEvidence: {
            initModel,
            modelUsageModels: [initModel],
          },
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it.each([
    [
      'cwd',
      (init: JsonRecord) => ({
        ...init,
        cwd: path.join(String(init.cwd), `tampered-${randomUUID()}`),
      }),
    ],
    ['session identity', (init: JsonRecord) => ({ ...init, session_id: randomUUID() })],
    ['model', (init: JsonRecord) => ({ ...init, model: `tampered-model/${randomUUID()}` })],
    ['permission mode', (init: JsonRecord) => ({ ...init, permissionMode: 'default' })],
    [
      'MCP server set',
      (init: JsonRecord) => ({
        ...init,
        mcp_servers: [{ name: `unexpected-${randomUUID()}` }],
      }),
    ],
  ])('rejects a native committed transcript with tampered init %s', async (_label, mutateInit) => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      const snapshotRoot = path.dirname(
        path.resolve(fixture.root, String(bundle.transportEvidence.snapshotManifestPath))
      );
      const initEvent = mutateInit({
        type: 'system',
        subtype: 'init',
        cwd: snapshotRoot,
        session_id: String(bundle.normalized.providerRequestId),
        tools: ['Read', 'StructuredOutput'],
        mcp_servers: [],
        model: requiredReturnedModel(bundle.normalized),
        permissionMode: 'dontAsk',
      });
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [initEvent, ...events],
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_cli_init_binding_mismatch'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it.skipIf(process.platform !== 'win32')(
    'accepts a bounded native cwd only when transcript Read results reproduce the canonical snapshot',
    async () => {
      const fixture = createFixture();
      const outputRelativePath = path.join('runtime', 'judge-invocation');
      try {
        const sourceDocument = path.join('evidence', `${randomUUID()}.md`);
        const sourcePath = path.join(fixture.root, sourceDocument);
        mkdirSync(path.dirname(sourcePath), { recursive: true });
        writeFileSync(
          sourcePath,
          `${Array.from(
            { length: 4_096 },
            (_value, index) => `line-${index}:${'evidence'.repeat(8)}`
          ).join('\n')}\n`,
          'utf8'
        );
        fixture.request.sourceDocument = sourceDocument;
        fixture.request.sourceBytesHash = sha256FileContent(sourcePath);
        fixture.request.requestHash = sha256Stable({
          ...fixture.request,
          requestHash: null,
        });
        writeFileSync(
          path.join(fixture.root, fixture.requestRelativePath),
          `${JSON.stringify(fixture.request, null, 2)}\n`,
          'utf8'
        );
        const command = await loadCommand();
        const commonOptions = {
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
        };
        await command({
          ...commonOptions,
          fetch: blockingJudgeFetch(() => undefined),
        });

        const outputDir = path.join(fixture.root, outputRelativePath);
        const bundle = readCommittedBundle(outputDir);
        const transcriptPath = path.resolve(
          fixture.root,
          String(bundle.transportEvidence.transcriptPath)
        );
        const resultEvent = readFileSync(transcriptPath, 'utf8')
          .trim()
          .split(/\r?\n/u)
          .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'))
          .find((event) => event.type === 'result');
        if (!resultEvent) throw new Error('test_transcript_result_missing');
        const snapshotManifestPath = path.resolve(
          fixture.root,
          String(bundle.transportEvidence.snapshotManifestPath)
        );
        const snapshotRoot = path.dirname(snapshotManifestPath);
        const manifest = record(
          JSON.parse(readFileSync(snapshotManifestPath, 'utf8')),
          'test_snapshot_manifest_missing'
        );
        const entries = manifest.entries as JsonRecord[];
        const readPlan = manifest.readPlan as JsonRecord[];
        const sourcePlan = readPlan.find(
          (candidate) => candidate.sourcePath === sourceDocument.replace(/\\/gu, '/')
        );
        expect(manifest.schemaVersion).toBe('requirements-contract-judge-evidence-snapshot/v2');
        expect((sourcePlan?.segments as JsonRecord[]).length).toBeGreaterThan(1);
        expect(entries.map((entry) => entry.path)).not.toContain(
          sourceDocument.replace(/\\/gu, '/')
        );
        const executionCwd = path.join(
          tmpdir(),
          `j-${randomUUID().replaceAll('-', '').slice(0, 6)}`
        );
        const readEvents = entries.flatMap((entry) => {
          const relativePath = String(entry.path);
          const toolUseId = `tool/${randomUUID()}`;
          return [
            {
              type: 'assistant',
              message: {
                model: requiredReturnedModel(bundle.normalized),
                content: [
                  {
                    type: 'tool_use',
                    id: toolUseId,
                    name: 'Read',
                    input: { file_path: relativePath },
                  },
                ],
              },
            },
            {
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content: claudeReadResult(path.join(snapshotRoot, relativePath)),
                  },
                ],
              },
            },
          ];
        });
        const structuredOutputToolUseId = `tool/${randomUUID()}`;
        const nativeEvents = [
          {
            type: 'system',
            subtype: 'init',
            cwd: executionCwd,
            session_id: String(bundle.normalized.providerRequestId),
            tools: ['Read', 'StructuredOutput'],
            mcp_servers: [],
            model: requiredReturnedModel(bundle.normalized),
            permissionMode: 'dontAsk',
          },
          ...readEvents,
          {
            type: 'assistant',
            message: {
              model: requiredReturnedModel(bundle.normalized),
              content: [
                {
                  type: 'tool_use',
                  id: structuredOutputToolUseId,
                  name: 'StructuredOutput',
                  input: resultEvent.structured_output,
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: structuredOutputToolUseId,
                  content: 'Structured output provided successfully',
                },
              ],
            },
          },
          resultEvent,
        ];
        const processId = Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16);
        rewriteCommittedTranscript({
          root: fixture.root,
          outputDir,
          events: nativeEvents,
          transportPatch: {
            cwd: executionCwd,
            executorKind: 'native_spawn',
            processId,
          },
        });

        expect(readCommittedFixture(fixture, outputRelativePath)).toMatchObject({
          result: {
            providerRun: {
              model: requiredReturnedModel(bundle.normalized),
            },
          },
        });

        const tamperedEvents = JSON.parse(JSON.stringify(nativeEvents)) as JsonRecord[];
        const tamperedResult = tamperedEvents
          .flatMap((event) => {
            const message = event.message as JsonRecord | undefined;
            return Array.isArray(message?.content) ? (message.content as JsonRecord[]) : [];
          })
          .find(
            (block) =>
              block.type === 'tool_result' &&
              typeof block.content === 'string' &&
              /^\d+\t/mu.test(block.content)
          );
        if (!tamperedResult) throw new Error('test_read_result_missing');
        tamperedResult.content = String(tamperedResult.content).replace(
          /^(\d+\t.*)$/mu,
          '$1-tampered'
        );
        rewriteCommittedTranscript({
          root: fixture.root,
          outputDir,
          events: tamperedEvents,
          transportPatch: {
            cwd: executionCwd,
            executorKind: 'native_spawn',
            processId,
          },
        });
        expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
          'critical_auditor_judge_cli_read_content_binding_mismatch'
        );
      } finally {
        rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    }
  );

  it('accepts a successful native Read observation for an empty manifested evidence file', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const sourceDocument = path.join('evidence', `${randomUUID()}.md`);
      const sourcePath = path.join(fixture.root, sourceDocument);
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(sourcePath, '', 'utf8');
      fixture.request.sourceDocument = sourceDocument;
      fixture.request.sourceBytesHash = sha256FileContent(sourcePath);
      fixture.request.requestHash = sha256Stable({
        ...fixture.request,
        requestHash: null,
      });
      writeFileSync(
        path.join(fixture.root, fixture.requestRelativePath),
        `${JSON.stringify(fixture.request, null, 2)}\n`,
        'utf8'
      );

      const command = await loadCommand();
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const resultEvent = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'))
        .find((event) => event.type === 'result');
      if (!resultEvent) throw new Error('test_transcript_result_missing');
      const snapshotManifestPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.snapshotManifestPath)
      );
      const snapshotRoot = path.dirname(snapshotManifestPath);
      const manifest = record(
        JSON.parse(readFileSync(snapshotManifestPath, 'utf8')),
        'test_snapshot_manifest_missing'
      );
      const entries = manifest.entries as JsonRecord[];
      expect(entries.some((entry) => Number(entry.bytes) === 0)).toBe(true);

      const returnedModel = requiredReturnedModel(bundle.normalized);
      const readEvents = entries.flatMap((entry) => {
        const relativePath = String(entry.path);
        const filePath = path.join(snapshotRoot, relativePath);
        const toolUseId = `tool/${randomUUID()}`;
        const content =
          Number(entry.bytes) === 0
            ? `<system-reminder>empty-read/${randomUUID()}</system-reminder>`
            : claudeReadResult(filePath);
        return [
          {
            type: 'assistant',
            message: {
              model: returnedModel,
              content: [
                {
                  type: 'tool_use',
                  id: toolUseId,
                  name: 'Read',
                  input: { file_path: relativePath },
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseId,
                  content,
                },
              ],
            },
          },
        ];
      });
      const structuredOutputToolUseId = `tool/${randomUUID()}`;
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'system',
            subtype: 'init',
            cwd: snapshotRoot,
            session_id: String(bundle.normalized.providerRequestId),
            tools: ['Read', 'StructuredOutput'],
            mcp_servers: [],
            model: returnedModel,
            permissionMode: 'dontAsk',
          },
          ...readEvents,
          {
            type: 'assistant',
            message: {
              model: returnedModel,
              content: [
                {
                  type: 'tool_use',
                  id: structuredOutputToolUseId,
                  name: 'StructuredOutput',
                  input: resultEvent.structured_output,
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: structuredOutputToolUseId,
                  content: 'Structured output provided successfully',
                },
              ],
            },
          },
          resultEvent,
        ],
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(readCommittedFixture(fixture, outputRelativePath)).toMatchObject({
        result: {
          providerRun: {
            model: returnedModel,
          },
        },
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a native committed transcript that does not inspect manifested evidence', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');
      const gateReportPath = path.join(fixture.root, String(gateDryRun.reportPath));
      mkdirSync(path.dirname(gateReportPath), { recursive: true });
      writeFileSync(gateReportPath, `${JSON.stringify({ observation: randomUUID() })}\n`, 'utf8');
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      const snapshotRoot = path.dirname(
        path.resolve(fixture.root, String(bundle.transportEvidence.snapshotManifestPath))
      );
      const structuredOutputToolUseId = `tool/${randomUUID()}`;
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'system',
            subtype: 'init',
            cwd: snapshotRoot,
            session_id: String(bundle.normalized.providerRequestId),
            tools: ['Read', 'StructuredOutput'],
            mcp_servers: [],
            model: requiredReturnedModel(bundle.normalized),
            permissionMode: 'dontAsk',
          },
          {
            type: 'assistant',
            message: {
              model: requiredReturnedModel(bundle.normalized),
              content: [
                {
                  type: 'tool_use',
                  id: structuredOutputToolUseId,
                  name: 'StructuredOutput',
                  input: {},
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: structuredOutputToolUseId,
                  content: `accepted/${randomUUID()}`,
                },
              ],
            },
          },
          ...events,
        ],
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_cli_evidence_coverage_incomplete'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a native committed transcript with an unmatched tool invocation', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      const snapshotRoot = path.dirname(
        path.resolve(fixture.root, String(bundle.transportEvidence.snapshotManifestPath))
      );
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'system',
            subtype: 'init',
            cwd: snapshotRoot,
            session_id: String(bundle.normalized.providerRequestId),
            tools: ['Read', 'StructuredOutput'],
            mcp_servers: [],
            model: requiredReturnedModel(bundle.normalized),
            permissionMode: 'dontAsk',
          },
          {
            type: 'assistant',
            message: {
              model: requiredReturnedModel(bundle.normalized),
              content: [
                {
                  type: 'tool_use',
                  id: `tool/${randomUUID()}`,
                  name: 'StructuredOutput',
                  input: {},
                },
              ],
            },
          },
          ...events,
        ],
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_cli_tool_result_missing'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('accepts repeated equivalent StructuredOutput calls from a native transcript', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      const initial = await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });
      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const structuredOutput = {
        decision: bundle.normalized.decision,
        findings: bundle.normalized.findings,
        challengeRequests: bundle.normalized.challengeRequests,
        evidenceRefs: bundle.normalized.evidenceRefs,
      };
      rewriteNativeStructuredOutputTranscript({
        root: fixture.root,
        outputDir,
        structuredOutputs: [
          structuredOutput,
          {
            evidenceRefs: structuredOutput.evidenceRefs,
            challengeRequests: structuredOutput.challengeRequests,
            findings: structuredOutput.findings,
            decision: structuredOutput.decision,
          },
        ],
      });

      expect(readCommittedFixture(fixture, outputRelativePath).result).toEqual(initial);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('accepts a schema-invalid StructuredOutput retry before the final valid output', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const existingEvents = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      const returnedModel = requiredReturnedModel(bundle.normalized);
      const snapshotRoot = path.dirname(
        path.resolve(fixture.root, String(bundle.transportEvidence.snapshotManifestPath))
      );
      const readEvents = nativeReadEventsFromCommittedSnapshot({
        root: fixture.root,
        outputDir,
      });
      const finalOutput = {
        decision: bundle.normalized.decision,
        findings: bundle.normalized.findings,
        challengeRequests: bundle.normalized.challengeRequests,
        evidenceRefs: bundle.normalized.evidenceRefs,
      };
      const failedToolUseId = `tool/${randomUUID()}`;
      const validToolUseId = `tool/${randomUUID()}`;
      const nativeEvents = [
        {
          type: 'system',
          subtype: 'init',
          cwd: snapshotRoot,
          session_id: String(bundle.normalized.providerRequestId),
          tools: ['Read', 'StructuredOutput'],
          mcp_servers: [],
          model: returnedModel,
          permissionMode: 'dontAsk',
        },
        ...readEvents,
        {
          type: 'assistant',
          message: {
            model: returnedModel,
            content: [
              {
                type: 'tool_use',
                id: failedToolUseId,
                name: 'StructuredOutput',
                input: { invalid: randomUUID() },
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: failedToolUseId,
                is_error: true,
                content: 'Output does not match required schema: invalid response',
              },
            ],
          },
        },
        {
          type: 'assistant',
          message: {
            model: returnedModel,
            content: [
              {
                type: 'tool_use',
                id: validToolUseId,
                name: 'StructuredOutput',
                input: finalOutput,
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: validToolUseId,
                content: `Structured output provided successfully/${randomUUID()}`,
              },
            ],
          },
        },
        ...existingEvents,
      ];
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: nativeEvents,
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });

      expect(readCommittedFixture(fixture, outputRelativePath).result).toMatchObject({
        providerRun: {
          model: returnedModel,
        },
      });

      const nonSchemaFailureEvents = JSON.parse(JSON.stringify(nativeEvents)) as JsonRecord[];
      const failedToolResult = nonSchemaFailureEvents
        .flatMap((event) => {
          const message = event.message as JsonRecord | undefined;
          return Array.isArray(message?.content) ? (message.content as JsonRecord[]) : [];
        })
        .find((block) => block.type === 'tool_result' && block.tool_use_id === failedToolUseId);
      if (!failedToolResult) throw new Error('test_failed_tool_result_missing');
      failedToolResult.content = `Provider tool failure/${randomUUID()}`;
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: nonSchemaFailureEvents,
        transportPatch: {
          executorKind: 'native_spawn',
          processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
        },
      });
      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_cli_tool_result_failed'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects conflicting repeated StructuredOutput calls from a native transcript', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const commonOptions = {
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        outputDir: outputRelativePath,
        json: false,
      };
      await command({
        ...commonOptions,
        fetch: blockingJudgeFetch(() => undefined),
      });
      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const structuredOutput = {
        decision: bundle.normalized.decision,
        findings: bundle.normalized.findings,
        challengeRequests: bundle.normalized.challengeRequests,
        evidenceRefs: bundle.normalized.evidenceRefs,
      };
      rewriteNativeStructuredOutputTranscript({
        root: fixture.root,
        outputDir,
        structuredOutputs: [
          structuredOutput,
          {
            ...structuredOutput,
            decision: structuredOutput.decision === 'pass' ? 'block' : 'pass',
          },
        ],
      });

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_cli_structured_output_tool_conflict'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects self-consistent transcript evidence that reads outside the frozen snapshot', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const resultPath = path.join(outputDir, 'judge-provider-result.json');
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const persisted = record(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        'test_judge_provider_result_missing'
      );
      const normalized = record(
        persisted.normalizedProviderResponse,
        'test_normalized_provider_response_missing'
      );
      const transportEvidence = record(
        normalized.transportEvidence,
        'test_transport_evidence_missing'
      );
      const stdoutPath = path.resolve(fixture.root, String(transportEvidence.stdoutPath));
      const transcriptPath = path.resolve(fixture.root, String(transportEvidence.transcriptPath));
      const existingTranscript = readFileSync(transcriptPath, 'utf8');
      const escapedReadEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: `tool/${randomUUID()}`,
              name: 'Read',
              input: {
                file_path: path.join('..', `${randomUUID()}.txt`),
              },
            },
          ],
        },
      };
      const tamperedTranscript = `${JSON.stringify(escapedReadEvent)}\n${existingTranscript}`;
      writeFileSync(stdoutPath, tamperedTranscript, 'utf8');
      writeFileSync(transcriptPath, tamperedTranscript, 'utf8');
      const tamperedTransportEvidence = {
        ...transportEvidence,
        stdoutHash: sha256FileContent(stdoutPath),
        transcriptHash: sha256FileContent(transcriptPath),
      };
      const tamperedNormalized = {
        ...normalized,
        responseHash: sha256FileContent(stdoutPath),
        transportEvidence: tamperedTransportEvidence,
      };
      const tamperedPersisted = {
        ...persisted,
        normalizedProviderResponse: tamperedNormalized,
      };
      const receipt = record(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        'test_judge_invocation_receipt_missing'
      );
      const state = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_judge_invocation_state_missing'
      );
      rewriteCommittedBundle({
        outputDir,
        persisted: tamperedPersisted,
        receipt: {
          ...receipt,
          providerResponseHash: tamperedNormalized.responseHash,
          transportEvidence: tamperedTransportEvidence,
          transportEvidenceHash: sha256JsonContent(tamperedTransportEvidence),
        },
        state,
      });

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_cli_tool_path_escape');
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a snapshot junction that resolves a Read outside the frozen snapshot', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const resultPath = path.join(outputDir, 'judge-provider-result.json');
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const persisted = record(JSON.parse(readFileSync(resultPath, 'utf8')), 'test_result_missing');
      const normalized = record(
        persisted.normalizedProviderResponse,
        'test_normalized_response_missing'
      );
      const transportEvidence = record(
        normalized.transportEvidence,
        'test_transport_evidence_missing'
      );
      const snapshotManifestPath = path.resolve(
        fixture.root,
        String(transportEvidence.snapshotManifestPath)
      );
      const snapshotRoot = path.dirname(snapshotManifestPath);
      const outsideDir = path.join(fixture.root, `outside-${randomUUID()}`);
      const outsideFileName = `${randomUUID()}.txt`;
      mkdirSync(outsideDir, { recursive: true });
      writeFileSync(path.join(outsideDir, outsideFileName), 'outside snapshot', 'utf8');
      const linkedDirName = `linked-${randomUUID()}`;
      symlinkSync(outsideDir, path.join(snapshotRoot, linkedDirName), 'junction');
      const linkedRelativePath = path.join(linkedDirName, outsideFileName);

      const manifest = record(
        JSON.parse(readFileSync(snapshotManifestPath, 'utf8')),
        'test_snapshot_manifest_missing'
      );
      const entries = [
        ...(manifest.entries as JsonRecord[]),
        {
          path: linkedRelativePath.replace(/\\/gu, '/'),
          hash: sha256FileContent(path.join(snapshotRoot, linkedRelativePath)),
          bytes: readFileSync(path.join(snapshotRoot, linkedRelativePath)).byteLength,
        },
      ];
      writeFileSync(
        snapshotManifestPath,
        `${JSON.stringify(
          {
            ...manifest,
            entries,
            snapshotHash: sha256JsonContent(entries),
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const stdoutPath = path.resolve(fixture.root, String(transportEvidence.stdoutPath));
      const transcriptPath = path.resolve(fixture.root, String(transportEvidence.transcriptPath));
      const existingTranscript = readFileSync(transcriptPath, 'utf8');
      const linkedReadEvent = {
        type: 'assistant',
        message: {
          model: requiredReturnedModel(normalized),
          content: [
            {
              type: 'tool_use',
              id: `tool/${randomUUID()}`,
              name: 'Read',
              input: { file_path: linkedRelativePath },
            },
          ],
        },
      };
      const tamperedTranscript = `${JSON.stringify(linkedReadEvent)}\n${existingTranscript}`;
      writeFileSync(stdoutPath, tamperedTranscript, 'utf8');
      writeFileSync(transcriptPath, tamperedTranscript, 'utf8');
      const tamperedTransportEvidence = {
        ...transportEvidence,
        stdoutHash: sha256FileContent(stdoutPath),
        transcriptHash: sha256FileContent(transcriptPath),
        snapshotHash: sha256JsonContent(entries),
      };
      const receipt = record(JSON.parse(readFileSync(receiptPath, 'utf8')), 'test_receipt_missing');
      const state = record(JSON.parse(readFileSync(statePath, 'utf8')), 'test_state_missing');
      rewriteCommittedBundle({
        outputDir,
        persisted: {
          ...persisted,
          normalizedProviderResponse: {
            ...normalized,
            responseHash: sha256FileContent(stdoutPath),
            transportEvidence: tamperedTransportEvidence,
          },
        },
        receipt: {
          ...receipt,
          providerResponseHash: sha256FileContent(stdoutPath),
          transportEvidence: tamperedTransportEvidence,
          transportEvidenceHash: sha256JsonContent(tamperedTransportEvidence),
        },
        state,
      });

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_cli_snapshot_manifest_invalid'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a Read through an unlisted snapshot junction', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => undefined),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const bundle = readCommittedBundle(outputDir);
      const snapshotRoot = path.dirname(
        path.resolve(fixture.root, String(bundle.transportEvidence.snapshotManifestPath))
      );
      const outsideDir = path.join(fixture.root, `outside-${randomUUID()}`);
      const outsideFileName = `${randomUUID()}.txt`;
      mkdirSync(outsideDir, { recursive: true });
      writeFileSync(path.join(outsideDir, outsideFileName), 'outside snapshot', 'utf8');
      const linkedDirName = `unlisted-${randomUUID()}`;
      symlinkSync(outsideDir, path.join(snapshotRoot, linkedDirName), 'junction');
      const linkedRelativePath = path.join(linkedDirName, outsideFileName);

      const transcriptPath = path.resolve(
        fixture.root,
        String(bundle.transportEvidence.transcriptPath)
      );
      const events = readFileSync(transcriptPath, 'utf8')
        .trim()
        .split(/\r?\n/u)
        .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
      rewriteCommittedTranscript({
        root: fixture.root,
        outputDir,
        events: [
          {
            type: 'assistant',
            message: {
              model: requiredReturnedModel(bundle.normalized),
              content: [
                {
                  type: 'tool_use',
                  id: `tool/${randomUUID()}`,
                  name: 'Read',
                  input: { file_path: linkedRelativePath },
                },
              ],
            },
          },
          ...events,
        ],
      });

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_cli_tool_path_not_manifested');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('fails closed on a tampered committed result without invoking the transport again', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();
      const resultPath = path.join(fixture.root, outputRelativePath, 'judge-provider-result.json');
      const persisted = record(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        'test_judge_provider_result_missing'
      );
      const adapterResult = record(persisted.adapterResult, 'test_judge_adapter_result_missing');
      const response = record(adapterResult.response, 'test_judge_response_missing');
      writeFileSync(
        resultPath,
        `${JSON.stringify(
          {
            ...persisted,
            adapterResult: {
              ...adapterResult,
              response: {
                ...response,
                rationale: `tampered/${randomUUID()}`,
              },
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_provider_result_binding_mismatch'
      );
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a recomputed self-hash on tampered committed state binding', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const state = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_committed_judge_invocation_state_missing'
      );
      const tamperedState = withInvocationStateHash({
        ...state,
        roundIndex: Number(fixture.request.roundIndex) + 1,
        requestHash: sha256Stable({ tampered: randomUUID() }),
        sourceDocumentHash: sha256Stable({ tampered: randomUUID() }),
        semanticModelHash: sha256Stable({ tampered: randomUUID() }),
        projectionSetHash: sha256Stable({ tampered: randomUUID() }),
        startedAt: `invalid/${randomUUID()}`,
        completedAt: `invalid/${randomUUID()}`,
        failureCode: `invalid/${randomUUID()}`,
      });
      writeFileSync(statePath, `${JSON.stringify(tamperedState, null, 2)}\n`, 'utf8');

      expect(() => readCommittedFixture(fixture, outputRelativePath)).toThrow(
        'critical_auditor_judge_invocation_committed_state_binding_mismatch'
      );
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a recomputed receipt hash on tampered committed provider provenance', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const receiptPath = path.join(outputDir, 'judge-provider-invocation-receipt.json');
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const receipt = record(
        JSON.parse(readFileSync(receiptPath, 'utf8')),
        'test_committed_judge_invocation_receipt_missing'
      );
      const state = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_committed_judge_invocation_state_missing'
      );
      const completedAt = new Date(Date.now() + 1_000).toISOString();
      const startedAt = new Date(Date.parse(completedAt) + 1_000).toISOString();
      const tamperedReceipt = withInvocationReceiptHash({
        ...receipt,
        providerId: `tampered/${randomUUID()}`,
        model: `tampered/${randomUUID()}`,
        transport: `tampered/${randomUUID()}`,
        apiStyle: `tampered/${randomUUID()}`,
        configuredBaseUrlHash: sha256Stable({ tampered: randomUUID() }),
        independenceClass: `tampered/${randomUUID()}`,
        providerRegistryHash: sha256Stable({ tampered: randomUUID() }),
        providerConfigurationHash: sha256Stable({ tampered: randomUUID() }),
        resultPath: `tampered/${randomUUID()}.json`,
        startedAt,
        completedAt,
      });
      writeFileSync(receiptPath, `${JSON.stringify(tamperedReceipt, null, 2)}\n`, 'utf8');
      const updatedState = withInvocationStateHash({
        ...state,
        receiptHash: tamperedReceipt.receiptHash,
        receiptContentHash: sha256FileContent(receiptPath),
      });
      writeFileSync(statePath, `${JSON.stringify(updatedState, null, 2)}\n`, 'utf8');

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_invocation_receipt_binding_mismatch'
      );
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('defers a noncommitted complete artifact set to the active invocation lock', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: blockingJudgeFetch(() => {
            transportCalls += 1;
          }),
        });
      await invoke();

      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const committedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_committed_judge_invocation_state_missing'
      );
      writeFileSync(
        statePath,
        `${JSON.stringify(
          withInvocationStateHash({
            ...committedState,
            status: 'prepared',
            completedAt: null,
            resultContentHash: null,
            receiptHash: null,
            receiptContentHash: null,
            failureCode: null,
          }),
          null,
          2
        )}\n`,
        'utf8'
      );
      mkdirSync(path.join(outputDir, 'judge-provider-invocation.lock'));

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_invocation_lock_held');
      expect(transportCalls).toBe(1);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('derives the adapter host timeout from the active provider request policy', () => {
    const fixture = createFixture();
    try {
      const configPath = path.join(fixture.root, fixture.configRelativePath);
      const config = record(yaml.load(readFileSync(configPath, 'utf8')), 'test_config_invalid');
      const judgeRuntime = record(config.judgeRuntime, 'test_judge_runtime_missing');
      const providers = record(judgeRuntime.providers, 'test_judge_providers_missing');
      const providerRef = String(judgeRuntime.activeProviderRef);
      const provider = record(providers[providerRef], 'test_active_judge_provider_missing');
      const requestPolicy = record(
        provider.requestPolicy,
        'test_active_judge_request_policy_missing'
      );
      const providerTimeoutMs = Number(requestPolicy.timeoutMs);
      expect(Number.isSafeInteger(providerTimeoutMs)).toBe(true);
      expect(providerTimeoutMs).toBeGreaterThan(0);

      const resolveHostTimeout = (
        orchestration as unknown as {
          resolveCriticalAuditorJudgeAdapterHostTimeoutMs?: (projectRoot: string) => number;
        }
      ).resolveCriticalAuditorJudgeAdapterHostTimeoutMs;
      const resolveReadonlyAuditorTimeout = (
        orchestration as unknown as {
          resolveAuditReadonlyAuditorHostTimeoutMs?: (projectRoot: string) => number;
        }
      ).resolveAuditReadonlyAuditorHostTimeoutMs;
      expect(typeof resolveHostTimeout).toBe('function');
      expect(typeof resolveReadonlyAuditorTimeout).toBe('function');
      expect(resolveHostTimeout?.(fixture.root)).toBeGreaterThan(providerTimeoutMs);
      expect(resolveReadonlyAuditorTimeout?.(fixture.root)).toBe(providerTimeoutMs);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('reconciles an expired prepared invocation into a retryable failed state', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const lockPath = path.join(outputDir, 'judge-provider-invocation.lock');
      const request = fixture.request;
      const round = Number(request.roundIndex);
      let transportCalls = 0;
      const failingFetch = (async () => {
        transportCalls += 1;
        return new Response(JSON.stringify({ error: 'provider-unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch;
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round,
          outputDir: outputRelativePath,
          json: false,
          fetch: failingFetch,
        });

      await expect(invoke()).rejects.toThrow('claude_code_cli_judge_process_failed:503');
      expect(transportCalls).toBe(1);
      const producerFailedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_producer_failed_judge_state_missing'
      );
      const invocationId = String(producerFailedState.invocationId);
      const preparedState = {
        ...producerFailedState,
        startedAt: new Date().toISOString(),
        status: 'prepared',
        completedAt: null,
        resultContentHash: null,
        receiptHash: null,
        receiptContentHash: null,
        failureCode: null,
      };
      const activePreparedState = withInvocationStateHash(preparedState);
      writeFileSync(statePath, `${JSON.stringify(activePreparedState, null, 2)}\n`, 'utf8');
      mkdirSync(lockPath);
      writeInvocationLockOwner({
        lockPath,
        state: activePreparedState,
      });

      const actionModule = (await import(/* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href)) as {
        reconcileAbandonedRequirementsContractCriticalAuditorJudgeInvocation?: (input: {
          projectRoot: string;
          requestPath: string;
          outputDir: string;
          round: number;
          runtimeBinding: Record<string, unknown>;
          staleAfterMs: number;
          failureCode: string;
        }) => { decision: string; invocationId?: string };
      };
      const reconcile =
        actionModule.reconcileAbandonedRequirementsContractCriticalAuditorJudgeInvocation;
      expect(typeof reconcile).toBe('function');
      const active = reconcile?.({
        projectRoot: fixture.root,
        requestPath: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round,
        runtimeBinding: fixture.recoveryRuntimeBinding,
        staleAfterMs: 60_000,
        failureCode: 'critical_auditor_judge_host_timeout',
      });
      expect(active).toEqual({
        decision: 'active',
        invocationId,
      });
      expect(existsSync(lockPath)).toBe(true);

      const expiredPreparedState = withInvocationStateHash({
        ...preparedState,
        startedAt: new Date(Date.now() - 60_000).toISOString(),
      });
      writeFileSync(statePath, `${JSON.stringify(expiredPreparedState, null, 2)}\n`, 'utf8');
      writeInvocationLockOwner({
        lockPath,
        state: expiredPreparedState,
      });
      const recovery = reconcile?.({
        projectRoot: fixture.root,
        requestPath: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round,
        runtimeBinding: fixture.recoveryRuntimeBinding,
        staleAfterMs: 1,
        failureCode: 'critical_auditor_judge_host_timeout',
      });

      expect(recovery).toEqual({
        decision: 'recovered',
        invocationId,
      });
      expect(existsSync(lockPath)).toBe(false);
      const recoveredState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_recovered_judge_state_missing'
      );
      expect(recoveredState.status).toBe('failed');
      expect(recoveredState.failureCode).toBe('critical_auditor_judge_host_timeout');
      expect(recoveredState.invocationId).toBe(invocationId);
      expect(recoveredState.stateHash).toBe(withInvocationStateHash(recoveredState).stateHash);

      await expect(invoke()).rejects.toThrow('claude_code_cli_judge_process_failed:503');
      expect(transportCalls).toBe(2);
      expect(
        existsSync(
          path.join(
            outputDir,
            'failed-generations',
            invocationId,
            'judge-provider-invocation-state.json'
          )
        )
      ).toBe(true);
      expect(existsSync(lockPath)).toBe(false);
      const retriedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_retried_judge_state_missing'
      );
      expect(retriedState.status).toBe('failed');
      expect(retriedState.invocationId).not.toBe(invocationId);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('marks the prepared invocation failed and releases its lock when the Judge CLI times out', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const lockPath = path.join(outputDir, 'judge-provider-invocation.lock');
      const request = fixture.request;
      const round = Number(request.roundIndex);
      let observedTimeoutMs = 0;
      const command = await loadCommand((invocation) => {
        observedTimeoutMs = invocation.timeoutMs;
      });
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round,
          outputDir: outputRelativePath,
          json: false,
          fetch: (async () => {
            throw new Error('claude_code_cli_judge_timeout');
          }) as typeof fetch,
        })
      ).rejects.toThrow('claude_code_cli_judge_timeout');

      const config = record(
        yaml.load(readFileSync(path.join(fixture.root, fixture.configRelativePath), 'utf8')),
        'test_config_invalid'
      );
      const judgeRuntime = record(config.judgeRuntime, 'test_judge_runtime_missing');
      const providers = record(judgeRuntime.providers, 'test_judge_providers_missing');
      const provider = record(
        providers[String(judgeRuntime.activeProviderRef)],
        'test_active_judge_provider_missing'
      );
      const requestPolicy = record(
        provider.requestPolicy,
        'test_active_judge_request_policy_missing'
      );
      expect(observedTimeoutMs).toBe(Number(requestPolicy.timeoutMs));
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(path.join(outputDir, 'judge-provider-result.json'))).toBe(false);
      expect(existsSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'))).toBe(
        false
      );
      const failedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_timeout_failed_judge_state_missing'
      );
      expect(failedState.status).toBe('failed');
      expect(failedState.failureCode).toBe('claude_code_cli_judge_timeout');
      expect(failedState.stateHash).toBe(withInvocationStateHash(failedState).stateHash);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('rejects a self-hashed failed state with divergent request binding fields', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    const transportStatuses = [400, 503];
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: (async () => {
            const status = transportStatuses[transportCalls];
            if (status === undefined) throw new Error('test_unexpected_transport_call');
            transportCalls += 1;
            return new Response(JSON.stringify({ error: `transport-${status}` }), {
              status,
              headers: { 'content-type': 'application/json' },
            });
          }) as typeof fetch,
        });
      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');

      await expect(invoke()).rejects.toThrow('claude_code_cli_judge_process_failed:400');
      const failedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_failed_judge_invocation_state_missing'
      );
      writeFileSync(
        statePath,
        `${JSON.stringify(
          withInvocationStateHash({
            ...failedState,
            roundIndex: Number(fixture.request.roundIndex) + 1,
            requestHash: sha256Stable({ tampered: randomUUID() }),
            startedAt: 'not-an-iso-timestamp',
          }),
          null,
          2
        )}\n`,
        'utf8'
      );

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_invocation_failed_state_binding_mismatch'
      );
      expect(transportCalls).toBe(1);
      expect(
        existsSync(
          path.join(
            outputDir,
            `judge-provider-invocation-state.failed.${String(failedState.invocationId)}.json`
          )
        )
      ).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('retries transport after preserving the prior failed invocation state', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    const transportStatuses = [400, 503];
    let transportCalls = 0;
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: (async () => {
            const status = transportStatuses[transportCalls];
            if (status === undefined) throw new Error('test_unexpected_transport_call');
            transportCalls += 1;
            return new Response(JSON.stringify({ error: `transport-${status}` }), {
              status,
              headers: { 'content-type': 'application/json' },
            });
          }) as typeof fetch,
        });
      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');

      await expect(invoke()).rejects.toThrow('claude_code_cli_judge_process_failed:400');
      const firstState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_first_failed_judge_invocation_state_missing'
      );
      expect(firstState).toMatchObject({
        status: 'failed',
        failureCode: 'claude_code_cli_judge_process_failed',
      });

      await expect(invoke()).rejects.toThrow('claude_code_cli_judge_process_failed:503');
      expect(transportCalls).toBe(2);

      const preservedStatePath = path.join(
        outputDir,
        'failed-generations',
        String(firstState.invocationId),
        'judge-provider-invocation-state.json'
      );
      expect(existsSync(preservedStatePath)).toBe(true);
      expect(
        record(
          JSON.parse(readFileSync(preservedStatePath, 'utf8')),
          'test_preserved_failed_judge_invocation_state_missing'
        )
      ).toEqual(firstState);
      const secondState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_second_failed_judge_invocation_state_missing'
      );
      expect(secondState).toMatchObject({
        status: 'failed',
        failureCode: 'claude_code_cli_judge_process_failed',
      });
      expect(secondState.invocationId).not.toBe(firstState.invocationId);
      expect(existsSync(path.join(outputDir, 'judge-provider-result.json'))).toBe(false);
      expect(existsSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'))).toBe(
        false
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('does not inspect or start another invocation while the active lock is held', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let releaseTransport!: () => void;
    let signalTransportStarted!: () => void;
    let transportCalls = 0;
    const transportStarted = new Promise<void>((resolve) => {
      signalTransportStarted = resolve;
    });
    const transportRelease = new Promise<void>((resolve) => {
      releaseTransport = resolve;
    });
    try {
      const command = await loadCommand();
      const invoke = () =>
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round: Number(fixture.request.roundIndex),
          outputDir: outputRelativePath,
          json: false,
          fetch: (async () => {
            transportCalls += 1;
            signalTransportStarted();
            await transportRelease;
            return new Response(JSON.stringify({ error: 'transport-unavailable' }), {
              status: 503,
              headers: { 'content-type': 'application/json' },
            });
          }) as typeof fetch,
        });

      const firstOutcome = invoke().then(
        (value) => ({ value, error: null }),
        (error: unknown) => ({ value: null, error })
      );
      await transportStarted;

      await expect(invoke()).rejects.toThrow('critical_auditor_judge_invocation_lock_held');
      expect(transportCalls).toBe(1);

      releaseTransport();
      const outcome = await firstOutcome;
      expect(outcome.value).toBeNull();
      expect(outcome.error).toBeInstanceOf(Error);
      expect((outcome.error as Error).message).toBe('claude_code_cli_judge_process_failed:503');
    } finally {
      releaseTransport();
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('sends a no-tool prompt with the exact assessment field contract', async () => {
    const fixture = createFixture();
    let systemPrompt = '';
    try {
      const command = await loadCommand();
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: (async (_input: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            model?: string;
            messages?: Array<{ role?: string; content?: string }>;
          };
          systemPrompt = body.messages?.find((message) => message.role === 'system')?.content ?? '';
          const returnedModel = body.model ?? `gateway-selected-${randomUUID()}`;
          return new Response(
            JSON.stringify({
              id: `provider-run/${randomUUID()}`,
              model: returnedModel,
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      decision: 'block',
                      findings: [],
                      challengeRequests: [],
                      evidenceRefs: [],
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }) as typeof fetch,
      }).catch(() => undefined);

      expect(systemPrompt).toContain(
        'You may use only Read inside the isolated frozen evidence snapshot.'
      );
      expect(systemPrompt).toContain('gapCandidates');
      expect(systemPrompt).toContain('validatedGaps');
      expect(systemPrompt).toContain('rejectedGapCandidates');
      expect(systemPrompt).toContain('mutationPressureFindings');
      expect(systemPrompt).toContain('overBroadTaskFindings');
      expect(systemPrompt).toContain('missingProjectionFindings');
      expect(systemPrompt).toContain('invalidProofFindings');
      expect(systemPrompt).toContain('legacyBypassFindings');
      expect(systemPrompt).toContain('sourceMaterializationFindings');
      expect(systemPrompt).toContain('decision=pass');
      expect(systemPrompt).toContain('decision=block');
      expect(systemPrompt).toContain('decision=inconclusive');
      expect(systemPrompt).toContain(
        'sourceSpan must identify one or more complete raw lines in request.sourceDocument'
      );
      expect(systemPrompt).toContain(
        'sourceText must equal those complete raw source lines exactly'
      );
      expect(systemPrompt).toContain(
        'If you cannot verify the exact source bytes, return verdict insufficient_audit'
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('requests JSON object output when the provider requires structured responses', async () => {
    const fixture = createFixture();
    let responseFormat: unknown;
    try {
      const command = await loadCommand();
      const delegate = fakeJudgeFetch({ includeAssessment: true });
      await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: (async (_input: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            response_format?: unknown;
          };
          responseFormat = body.response_format;
          return delegate(_input, init);
        }) as typeof fetch,
      });

      expect(responseFormat).toEqual({ type: 'json_object' });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});
