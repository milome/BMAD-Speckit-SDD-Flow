import path from 'node:path';
import { loadConfiguredRequirementsContractJudgePrompt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-prompt-loader';
import { prepareRequirementsContractProductionJudgeRequest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline';
import { createCodexCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter';
import { createClaudeCodeCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';
import { OpenAICompatibleJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter';
import { AnthropicCompatibleJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-anthropic-compatible-judge-adapter';
import { canonicalJson, sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

type JsonObject = Record<string, unknown>;
type JudgeFailure = Partial<Record<'message' | 'failureClass' | 'totalBytes' | 'serializedPayloadBytes' | 'limitBytes' | 'dispatchState', unknown>>;

export function measureFullSourceRequirementsJudgePreflight(input: { root: string; compiled: JsonObject; native: JsonObject }) {
  const configuredPrompt = loadConfiguredRequirementsContractJudgePrompt({ projectRoot: path.resolve('.'), promptConfig: {
    systemPromptPath: '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md', outputTokenReserve: 4096,
  } });
  let dispatchCount = 0;
  const executeCommand = async () => { dispatchCount++; throw new Error('test_only_no_judge_invocation'); };
  const adapters = [
    { id: 'CodexCliJudgeAdapter', adapter: createCodexCliJudgeAdapter({ executeCommand }), transport: 'cli', apiStyle: 'cli', command: 'codex' },
    { id: 'ClaudeCodeCliJudgeAdapter', adapter: createClaudeCodeCliJudgeAdapter({ executeCommand }), transport: 'cli', apiStyle: 'cli', command: 'claude' },
    { id: 'OpenAICompatibleJudgeAdapter', adapter: OpenAICompatibleJudgeAdapter, transport: 'openai-compatible', apiStyle: 'chat_completions', command: null },
    { id: 'AnthropicCompatibleJudgeAdapter', adapter: AnthropicCompatibleJudgeAdapter, transport: 'anthropic-compatible', apiStyle: 'messages', command: null },
  ];
  const rows = adapters.map(({ id, adapter, transport, apiStyle, command }) => {
    const provider = { transport, apiStyle, adapterRef: id, model: command ? null : 'test-only-configured-model',
      endpoint: { command, baseUrl: 'https://test-only.invalid', resolutionMode: command ? 'path_search' : 'transport_managed',
        routingOwnership: 'transport_adapter', upstreamVersioning: 'gateway_managed', explicitOperationPath: null },
      authentication: { type: 'bearer', sensitivity: 'secret', arbitraryNonEmptyValueAllowed: false },
      auditPolicy: { blindReview: true, allowPassAuthority: false, toolsAllowed: true, allowedTools: ['Read'], implementationWritesAllowed: false },
      requestPolicy: { timeoutMs: 1000, maximumAttempts: 1, transportByteLimit: 1048576 } };
    const prepared = prepareRequirementsContractProductionJudgeRequest({
      activeAuthority: { activeSemanticRevisionId: input.compiled.semanticIr.semanticRevisionId,
        activeScopeSemanticHash: input.compiled.semanticIr.scopeSemanticHash,
        activeSemanticIrPath: 'TEST-ONLY/semantic-ir.json', activeSourceBindingPath: 'TEST-ONLY/source-binding.json',
        activeSourceBindingHash: input.compiled.sourceBinding.sourceBindingHash, activeAuthoringAttemptId: 'TEST-ONLY-NOT-CONFIRMED' },
      buildManifest: { artifactEntries: (input.native.auditPacketBody.artifactPayloadGroups as JsonObject[]).flatMap((group) =>
        (group.artifactIds as string[]).map((artifactId) => ({ artifactId, role: artifactId, artifactHash: sha256(canonicalJson(group.payload)) }))) },
      auditPacket: input.native.auditPacket,
      judgePrompt: { ...configuredPrompt, rubric: { mandatoryDimensionIds: input.native.coverageManifest.mandatoryDimensionIds } },
      providerSelection: { providerRef: 'test-only-preflight', provider, adapterRef: id, providerRegistryHash: sha256('test-only-registry') },
    });
    const requestFileContent = canonicalJson(prepared.request);
    const payload = { systemPrompt: prepared.request.prompt.systemPrompt, request: prepared.request,
      structuredOutputSchema: configuredPrompt.structuredOutputSchema,
      executionContext: { projectRoot: input.root, requestPath: 'TEST-ONLY/request.json', outputDir: 'TEST-ONLY/transport', requestFileContent } };
    try {
      const assessment = adapter.preflight({ providerRef: 'test-only-preflight', provider, credential: undefined, payload });
      return { adapterId: id, requestBytes: Buffer.byteLength(requestFileContent), ...assessment, error: null };
    } catch (error) {
      const failure = error as JudgeFailure;
      return { adapterId: id, requestBytes: Buffer.byteLength(requestFileContent), error: failure.message,
        failureClass: failure.failureClass, totalBytes: failure.totalBytes, serializedPayloadBytes: failure.serializedPayloadBytes,
        limitBytes: failure.limitBytes, dispatchState: failure.dispatchState };
    }
  });
  return { evidenceClass: 'test-only-complete-source-native-preflight-not-confirmation-not-judge', dispatchCount,
    sourcePromptHash: sha256(configuredPrompt.systemPrompt), sourceResponseSchemaHash: sha256(canonicalJson(configuredPrompt.structuredOutputSchema)), rows };
}
