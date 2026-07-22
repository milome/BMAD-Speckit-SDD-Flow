import { createHash, randomUUID } from 'node:crypto';
import {
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
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import * as orchestration from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import type {
  ClaudeCodeCliCommandInvocation,
  ClaudeCodeCliCommandResult,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';
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
}) => Promise<JsonRecord>;

const ACTION_SOURCE = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter.ts'
);
const PACKAGE_CLI_SOURCE = path.resolve(process.cwd(), 'packages/bmad-speckit/bin/bmad-speckit.js');
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
    stateHash: `sha256:${createHash('sha256')
      .update(JSON.stringify(withoutHash))
      .digest('hex')}`,
  };
}

function withInvocationReceiptHash(value: JsonRecord): JsonRecord {
  const withoutHash = { ...value };
  delete withoutHash.receiptHash;
  return {
    ...withoutHash,
    receiptHash: `sha256:${createHash('sha256')
      .update(JSON.stringify(withoutHash))
      .digest('hex')}`,
  };
}

function sha256FileContent(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function sha256JsonContent(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
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
}

function replaceCliArgument(
  argv: string[],
  flag: string,
  replacement?: string
): string[] {
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
    transportEvidence: record(
      normalized.transportEvidence,
      'test_transport_evidence_missing'
    ),
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

function rewriteCommittedTranscript(input: {
  root: string;
  outputDir: string;
  events: JsonRecord[];
  transportPatch?: JsonRecord;
}): void {
  const bundle = readCommittedBundle(input.outputDir);
  const stdoutPath = path.resolve(input.root, String(bundle.transportEvidence.stdoutPath));
  const transcriptPath = path.resolve(
    input.root,
    String(bundle.transportEvidence.transcriptPath)
  );
  const transcript = `${input.events.map((event) => JSON.stringify(event)).join('\n')}\n`;
  writeFileSync(stdoutPath, transcript, 'utf8');
  writeFileSync(transcriptPath, transcript, 'utf8');
  const transportEvidence = {
    ...bundle.transportEvidence,
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
  const transcriptPath = path.resolve(
    input.root,
    String(bundle.transportEvidence.transcriptPath)
  );
  const existingEvents = readFileSync(transcriptPath, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map((line) => record(JSON.parse(line), 'test_transcript_event_invalid'));
  const snapshotRoot = path.dirname(
    path.resolve(input.root, String(bundle.transportEvidence.snapshotManifestPath))
  );
  const structuredOutputEvents = input.structuredOutputs.flatMap((structuredOutput) => {
    const toolUseId = `tool/${randomUUID()}`;
    return [
      {
        type: 'assistant',
        message: {
          model: 'claude-sonnet-5',
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
        model: 'claude-sonnet-5',
        permissionMode: 'dontAsk',
      },
      ...structuredOutputEvents,
      ...existingEvents,
    ],
    transportPatch: {
      executorKind: 'native_spawn',
      processId: Number.parseInt(randomUUID().replace(/-/gu, '').slice(0, 8), 16),
    },
  });
}

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'critical-auditor-judge-adapter-'));
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
  const providerRef = String(judgeRuntime.activeProviderRef);
  const credentialsPath = path.join(root, String(credentialConfig.path));
  mkdirSync(path.dirname(credentialsPath), { recursive: true });
  writeFileSync(
    credentialsPath,
    [
      `schemaVersion: ${String(credentialConfig.schemaVersion)}`,
      'credentialRevision: 1',
      'providers:',
      `  ${providerRef}:`,
      '    authenticationType: bearer',
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
    sourceHash: sha256Stable({ requestSeed, role: 'source' }),
    sourceDocumentHash: sha256Stable({ requestSeed, role: 'source-document' }),
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
  };
}

function readCommittedFixture(
  fixture: {
    root: string;
    configRelativePath: string;
    requestRelativePath: string;
    request: JsonRecord;
    runtimeBinding: JsonRecord;
  },
  outputRelativePath: string
) {
  return readCommittedRequirementsContractCriticalAuditorJudgeInvocation({
    projectRoot: fixture.root,
    config: fixture.configRelativePath,
    requestPath: fixture.requestRelativePath,
    outputDir: outputRelativePath,
    round: Number(fixture.request.roundIndex),
    runtimeBinding: fixture.runtimeBinding,
  });
}

function requiredArgument(args: string[], name: string): string {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error(`test_cli_argument_missing:${name}`);
  return value;
}

function commandExecutorFromFetch(fetchImpl: typeof fetch) {
  return async (
    invocation: ClaudeCodeCliCommandInvocation
  ): Promise<ClaudeCodeCliCommandResult> => {
    const match = /<judge-request-json>\r?\n([\s\S]*?)\r?\n<\/judge-request-json>/u.exec(
      invocation.stdin
    );
    if (!match) throw new Error('test_cli_request_envelope_missing');
    const model = requiredArgument(invocation.args, '--model');
    const systemPrompt = requiredArgument(invocation.args, '--system-prompt');
    const response = await fetchImpl('https://judge-transport.invalid/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: match[1] },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const responseText = await response.text();
    let structuredOutput: JsonRecord = {
      decision: 'inconclusive',
      findings: [],
      challengeRequests: [],
      evidenceRefs: [],
    };
    if (response.ok) {
      const payload = record(JSON.parse(responseText), 'test_cli_transport_payload_invalid');
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const firstChoice = record(choices[0], 'test_cli_transport_choice_missing');
      const message = record(firstChoice.message, 'test_cli_transport_message_missing');
      structuredOutput = record(
        JSON.parse(String(message.content)),
        'test_cli_transport_structured_output_invalid'
      );
    }
    const result = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: randomUUID(),
      modelUsage: {
        [model]: {
          inputTokens: 1,
          outputTokens: 1,
        },
      },
      permission_denials: [],
      structured_output: structuredOutput,
    };
    return {
      exitCode: response.ok ? 0 : response.status,
      stdout: `${JSON.stringify(result)}\n`,
      stderr: response.ok ? '' : responseText,
    };
  };
}

async function loadCommand(): Promise<JudgeAdapterCommand> {
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
        ? { executeClaudeCodeCliCommand: commandExecutorFromFetch(fetchImpl) }
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
  return {
    schemaVersion: 'critical-auditor-judge-assessment/v1',
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
    priorFindingsDisposition: [
      {
        findingRef: `round/${String(request.roundIndex)}/baseline`,
        disposition: 'new',
        evidenceRefs: [String(gateDryRun.reportPath)],
      },
    ],
    falsePositiveProofs: [],
    rationale: `Judge reviewed request ${String(request.requestHash)}.`,
  };
}

function fakeJudgeFetch(options: { includeAssessment: boolean }): typeof fetch {
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
    const findings = options.includeAssessment ? [semanticAssessmentFromRequest(request)] : [];
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: body.model,
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
    const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
    const findingRef = `finding/${randomUUID()}`;
    return new Response(
      JSON.stringify({
        id: `provider-run/${randomUUID()}`,
        model: body.model,
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'block',
                findings: [
                  {
                    schemaVersion: 'critical-auditor-judge-assessment/v1',
                    verdict: 'blocked',
                    gapCandidates: [{ findingRef }],
                    validatedGaps: [],
                    rejectedGapCandidates: [],
                    mutationPressureFindings: [],
                    overBroadTaskFindings: [],
                    missingProjectionFindings: [],
                    invalidProofFindings: [],
                    legacyBypassFindings: [],
                    sourceMaterializationFindings: [],
                    reviewedMustRefs: [`reviewed-must/${randomUUID()}`],
                    reviewedProjectionRefs: [`reviewed-projection/${randomUUID()}`],
                    checkedProjectionGroups: [`checked-group/${randomUUID()}`],
                    checkedProjectionQualityRuleCodes: [`checked-rule/${randomUUID()}`],
                    priorFindingsDisposition: [
                      {
                        findingRef,
                        disposition: 'new',
                        evidenceRefs: [`evidence/${randomUUID()}`],
                      },
                    ],
                    falsePositiveProofs: [],
                    rationale: 'The supplied evidence is insufficient for a convergent verdict.',
                  },
                ],
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

describe('requirements contract Critical Auditor Judge adapter', () => {
  it('uses the package-controlled CLI action when no explicit adapter argv is injected', () => {
    const resolveCommand = (
      orchestration as unknown as {
        resolveCriticalAuditorExternalAdapterCommand?: (value: unknown) => string[];
      }
    ).resolveCriticalAuditorExternalAdapterCommand;

    expect(typeof resolveCommand).toBe('function');
    const command = resolveCommand?.(undefined) ?? [];
    expect(command[0]).toBe(process.execPath);
    expect(command[1]?.replace(/\\/gu, '/')).toMatch(
      /packages\/bmad-speckit\/bin\/bmad-speckit\.js$/u
    );
    expect(command[2]).toBe('requirements-contract-critical-auditor-judge-adapter');
    const packageCliSource = readFileSync(PACKAGE_CLI_SOURCE, 'utf8');
    expect(packageCliSource).toContain(
      ".command('requirements-contract-critical-auditor-judge-adapter')"
    );
    expect(packageCliSource).toContain(".requiredOption('--output-dir <path>'");
    expect(packageCliSource).toContain('outputDir: opts.outputDir');
  });

  it('does not expose fetch as a Judge result injection surface', () => {
    const source = readFileSync(JUDGE_INVOCATION_SOURCE, 'utf8');
    expect(source).not.toContain('fetch?: typeof fetch');
    expect(source).not.toContain('input.fetch');
  });

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
      const { schemaVersion: _assessmentSchemaVersion, ...semanticAssessment } = assessment;

      expect(result.schemaVersion).toBe('critical-auditor-external-adapter-result/v1');
      expect(providerRun).toMatchObject(fixture.runtimeBinding);
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
      const actionSource = readFileSync(ACTION_SOURCE, 'utf8');
      expect(actionSource).not.toContain('E2E-001');
      expect(actionSource).not.toContain('tests/e2e/persist.e2e.test.ts');
      expect(actionSource).not.toContain('Persist value.');
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
    try {
      expect(fixture.request.previousReceipts).toEqual([]);
      expect(
        record(fixture.request.gateDryRun, 'test_gate_dry_run_missing')
          .actionableBlockingIssues
      ).toEqual([]);
      const assessment = {
        ...semanticAssessmentFromRequest(fixture.request),
        verdict: 'insufficient_audit',
        priorFindingsDisposition: [],
        rationale: 'No prior finding or actionable dry-run blocker exists to classify.',
      };
      const command = await loadCommand();
      const result = await command({
        cwd: fixture.root,
        projectRoot: fixture.root,
        config: fixture.configRelativePath,
        request: fixture.requestRelativePath,
        round: Number(fixture.request.roundIndex),
        json: false,
        fetch: (async (_input: string | URL | Request, init?: RequestInit) => {
          const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
          return new Response(
            JSON.stringify({
              id: `provider-run/${randomUUID()}`,
              model: body.model,
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

  it('rejects a committed provider result replay without invoking the transport again', async () => {
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
      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_invocation_committed_replay_forbidden'
      );

      expect(transportCalls).toBe(1);
      const outputDir = path.join(fixture.root, outputRelativePath);
      const receipt = record(
        JSON.parse(
          readFileSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'), 'utf8')
        ),
        'test_judge_invocation_receipt_missing'
      );
      const state = record(
        JSON.parse(readFileSync(path.join(outputDir, 'judge-provider-invocation-state.json'), 'utf8')),
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
      expect(String(transportEvidence.cwd).replace(/\\/gu, '/')).toMatch(
        /\/r\/[a-f0-9]{16}\/evidence-snapshot$/u
      );
    } finally {
      rmSync(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it('validates committed provider authority before the production host can spawn another Judge', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    let processCalls = 0;
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
      const executeAdapter = (
        orchestration as unknown as {
          executeCriticalAuditorJudgeAdapter?: (input: {
            projectRoot: string;
            requestPath: string;
            outputDir: string;
            roundIndex: number;
            expected: Record<string, unknown>;
            processExecutor: typeof import('node:child_process').spawnSync;
          }) => unknown;
        }
      ).executeCriticalAuditorJudgeAdapter;
      expect(typeof executeAdapter).toBe('function');
      const request = fixture.request;
      const processExecutor = (() => {
        processCalls += 1;
        throw new Error('test_unexpected_judge_spawn');
      }) as unknown as typeof import('node:child_process').spawnSync;

      expect(() =>
        executeAdapter?.({
          projectRoot: fixture.root,
          requestPath: fixture.requestRelativePath,
          outputDir: path.join(fixture.root, outputRelativePath),
          roundIndex: Number(request.roundIndex),
          expected: {
            ...fixture.runtimeBinding,
            transactionId: request.transactionId,
            auditAttemptId: request.auditAttemptId,
            requestHash: request.requestHash,
            sourceDocumentHash: request.sourceDocumentHash,
            semanticModelHash: request.semanticModelHash,
            projectionSetHash: request.projectionSetHash,
          },
          processExecutor,
        })
      ).toThrow('critical_auditor_judge_cli_executor_kind_mismatch');
      expect(processCalls).toBe(0);
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
      const argv = Array.isArray(transportEvidence.argv)
        ? transportEvidence.argv.map(String)
        : [];
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
      (argv: string[]) =>
        replaceCliArgument(argv, '--system-prompt', `tampered/${randomUUID()}`),
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
    [
      'maximum budget',
      (argv: string[]) => replaceCliArgument(argv, '--max-budget-usd', '0.01'),
    ],
    [
      'missing maximum budget',
      (argv: string[]) => replaceCliArgument(argv, '--max-budget-usd'),
    ],
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
      const adapterResult = record(
        persisted.adapterResult,
        'test_judge_adapter_result_missing'
      );
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

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_transcript_result_mismatch'
      );
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
      const stdoutPath = path.resolve(fixture.root, String(transportEvidence.stdoutPath));
      const transcriptPath = path.resolve(fixture.root, String(transportEvidence.transcriptPath));
      const existingTranscript = readFileSync(transcriptPath, 'utf8');
      const foreignModelEvent = {
        type: 'assistant',
        message: {
          model: 'claude-3-5-haiku-20241022',
          content: [{ type: 'text', text: 'foreign model contribution' }],
        },
      };
      const tamperedTranscript = `${JSON.stringify(foreignModelEvent)}\n${existingTranscript}`;
      writeFileSync(stdoutPath, tamperedTranscript, 'utf8');
      writeFileSync(transcriptPath, tamperedTranscript, 'utf8');
      const tamperedTransportEvidence = {
        ...transportEvidence,
        stdoutHash: sha256FileContent(stdoutPath),
        transcriptHash: sha256FileContent(transcriptPath),
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

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_transcript_result_mismatch'
      );
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
    [
      'session identity',
      (init: JsonRecord) => ({ ...init, session_id: randomUUID() }),
    ],
    [
      'model',
      (init: JsonRecord) => ({ ...init, model: `claude-tampered-${randomUUID()}` }),
    ],
    [
      'permission mode',
      (init: JsonRecord) => ({ ...init, permissionMode: 'default' }),
    ],
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
        model: 'claude-sonnet-5',
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

  it('rejects a native committed transcript that does not inspect manifested evidence', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const gateDryRun = record(fixture.request.gateDryRun, 'test_gate_dry_run_missing');
      const gateReportPath = path.join(fixture.root, String(gateDryRun.reportPath));
      mkdirSync(path.dirname(gateReportPath), { recursive: true });
      writeFileSync(
        gateReportPath,
        `${JSON.stringify({ observation: randomUUID() })}\n`,
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
            model: 'claude-sonnet-5',
            permissionMode: 'dontAsk',
          },
          {
            type: 'assistant',
            message: {
              model: 'claude-sonnet-5',
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
            model: 'claude-sonnet-5',
            permissionMode: 'dontAsk',
          },
          {
            type: 'assistant',
            message: {
              model: 'claude-sonnet-5',
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
      const transcriptPath = path.resolve(
        fixture.root,
        String(transportEvidence.transcriptPath)
      );
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
          model: 'claude-sonnet-5',
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
              model: 'claude-sonnet-5',
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

      await expect(invoke()).rejects.toThrow(
        'critical_auditor_judge_cli_tool_path_not_manifested'
      );
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
      const resultPath = path.join(
        fixture.root,
        outputRelativePath,
        'judge-provider-result.json'
      );
      const persisted = record(
        JSON.parse(readFileSync(resultPath, 'utf8')),
        'test_judge_provider_result_missing'
      );
      const adapterResult = record(
        persisted.adapterResult,
        'test_judge_adapter_result_missing'
      );
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
      expect(typeof resolveHostTimeout).toBe('function');
      expect(resolveHostTimeout?.(fixture.root)).toBeGreaterThan(providerTimeoutMs);
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
      writeFileSync(
        statePath,
        `${JSON.stringify(withInvocationStateHash(preparedState), null, 2)}\n`,
        'utf8'
      );
      mkdirSync(lockPath);

      const actionModule = (await import(
        /* @vite-ignore */ pathToFileURL(ACTION_SOURCE).href
      )) as {
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
        runtimeBinding: fixture.runtimeBinding,
        staleAfterMs: 60_000,
        failureCode: 'critical_auditor_judge_host_timeout',
      });
      expect(active).toEqual({
        decision: 'active',
        invocationId,
      });
      expect(existsSync(lockPath)).toBe(true);

      writeFileSync(
        statePath,
        `${JSON.stringify(
          withInvocationStateHash({
            ...preparedState,
            startedAt: new Date(Date.now() - 60_000).toISOString(),
          }),
          null,
          2
        )}\n`,
        'utf8'
      );
      const recovery = reconcile?.({
        projectRoot: fixture.root,
        requestPath: fixture.requestRelativePath,
        outputDir: outputRelativePath,
        round,
        runtimeBinding: fixture.runtimeBinding,
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
            `judge-provider-invocation-state.failed.${invocationId}.json`
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

  it('reconciles the prepared state left by a timed-out adapter subprocess', async () => {
    const fixture = createFixture();
    const outputRelativePath = path.join('runtime', 'judge-invocation');
    try {
      const outputDir = path.join(fixture.root, outputRelativePath);
      const statePath = path.join(outputDir, 'judge-provider-invocation-state.json');
      const lockPath = path.join(outputDir, 'judge-provider-invocation.lock');
      const request = fixture.request;
      const round = Number(request.roundIndex);
      const command = await loadCommand();
      await expect(
        command({
          cwd: fixture.root,
          projectRoot: fixture.root,
          config: fixture.configRelativePath,
          request: fixture.requestRelativePath,
          round,
          outputDir: outputRelativePath,
          json: false,
          fetch: (async () =>
            new Response(JSON.stringify({ error: 'provider-unavailable' }), {
              status: 503,
              headers: { 'content-type': 'application/json' },
            })) as typeof fetch,
        })
      ).rejects.toThrow('claude_code_cli_judge_process_failed:503');
      const producerFailedState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_producer_failed_judge_state_missing'
      );
      const timedOutInvocationId = randomUUID();
      let observedHostTimeoutMs = 0;
      const timeoutError = Object.assign(new Error('spawnSync adapter ETIMEDOUT'), {
        code: 'ETIMEDOUT',
      });
      const processExecutor = ((
        _command: string,
        _args: readonly string[],
        options: { timeout?: number }
      ) => {
        observedHostTimeoutMs = Number(options.timeout);
        writeFileSync(
          statePath,
          `${JSON.stringify(
            withInvocationStateHash({
              ...producerFailedState,
              invocationId: timedOutInvocationId,
              startedAt: new Date().toISOString(),
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
        mkdirSync(lockPath);
        return {
          pid: 0,
          output: [null, '', ''],
          stdout: '',
          stderr: '',
          status: null,
          signal: 'SIGTERM',
          error: timeoutError,
        };
      }) as unknown as typeof import('node:child_process').spawnSync;
      const executeAdapter = (
        orchestration as unknown as {
          executeCriticalAuditorJudgeAdapter?: (input: {
            projectRoot: string;
            requestPath: string;
            outputDir: string;
            roundIndex: number;
            expected: Record<string, unknown>;
            processExecutor: typeof import('node:child_process').spawnSync;
          }) => unknown;
        }
      ).executeCriticalAuditorJudgeAdapter;
      expect(typeof executeAdapter).toBe('function');
      expect(() =>
        executeAdapter?.({
          projectRoot: fixture.root,
          requestPath: path.join(fixture.root, fixture.requestRelativePath),
          outputDir,
          roundIndex: round,
          expected: {
            ...fixture.runtimeBinding,
            transactionId: request.transactionId,
            auditAttemptId: request.auditAttemptId,
            requestHash: request.requestHash,
            sourceDocumentHash: request.sourceDocumentHash,
            semanticModelHash: request.semanticModelHash,
            projectionSetHash: request.projectionSetHash,
          },
          processExecutor,
        })
      ).toThrow('critical_auditor_external_adapter_failed:spawnSync adapter ETIMEDOUT');

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
      expect(observedHostTimeoutMs).toBeGreaterThan(Number(requestPolicy.timeoutMs));
      expect(existsSync(lockPath)).toBe(false);
      expect(existsSync(path.join(outputDir, 'judge-provider-result.json'))).toBe(false);
      expect(
        existsSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'))
      ).toBe(false);
      const recoveredState = record(
        JSON.parse(readFileSync(statePath, 'utf8')),
        'test_timeout_recovered_judge_state_missing'
      );
      expect(recoveredState.status).toBe('failed');
      expect(recoveredState.failureCode).toBe('critical_auditor_judge_host_timeout');
      expect(recoveredState.invocationId).toBe(timedOutInvocationId);
      expect(recoveredState.stateHash).toBe(withInvocationStateHash(recoveredState).stateHash);
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
        `judge-provider-invocation-state.failed.${String(firstState.invocationId)}.json`
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
      expect(existsSync(path.join(outputDir, 'judge-provider-invocation-receipt.json'))).toBe(false);
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
          systemPrompt =
            body.messages?.find((message) => message.role === 'system')?.content ?? '';
          return new Response(
            JSON.stringify({
              id: `provider-run/${randomUUID()}`,
              model: body.model,
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
