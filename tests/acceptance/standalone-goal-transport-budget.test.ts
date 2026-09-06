import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter';
import { AnthropicCompatibleJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-anthropic-compatible-judge-adapter';

// Test-only credential and fetch injections never contact a provider or create authority evidence.
vi.mock(
  '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-credential-resolver',
  () => ({
    readRequirementsContractJudgeCredentialSecret: () => 'test-only-budget-secret',
  })
);

const adapters = [
  ['openai-compatible', OpenAICompatibleJudgeAdapter],
  ['anthropic-compatible', AnthropicCompatibleJudgeAdapter],
] as const;

function fixture(transport: string) {
  const decision = { decision: 'pass', findings: [], challengeRequests: [], evidenceRefs: [] };
  const model = 'test-only-budget-model';
  const fetch = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: `test-only-${randomUUID()}`,
          model,
          ...(transport === 'openai-compatible'
            ? {
                choices: [
                  { finish_reason: 'stop', message: { content: JSON.stringify(decision) } },
                ],
              }
            : { content: [{ type: 'text', text: JSON.stringify(decision) }] }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
  );
  return {
    providerRef: 'test-only-budget-provider',
    credential: {},
    fetch,
    provider: {
      transport,
      apiStyle: transport === 'openai-compatible' ? 'chat_completions' : 'messages',
      model,
      endpoint: {
        baseUrl: 'https://test-only.invalid',
        resolutionMode: 'transport_managed',
        explicitOperationPath: null,
      },
      authentication: { type: 'bearer' },
      requestPolicy: {
        timeoutMs: 1000,
        maximumAttempts: 1,
        structuredResponseRequired: true,
        transportByteLimit: Number.MAX_SAFE_INTEGER,
      },
    },
    payload: {
      systemPrompt: 'Test-only full frozen candidate review.',
      request: { candidate: { text: '\u4e2d\u6587\ud83d\ude00"\\\n'.repeat(32) } },
    },
  };
}

describe.each(adapters)('%s actual serialized transport budget', (transport, adapter) => {
  it.each([-1, 0, 1])(
    'enforces the UTF-8 boundary with %i bytes of remaining capacity',
    async (remaining) => {
      const input = fixture(transport);
      const body = adapter.buildRequest(input).body;
      const bytes = Buffer.byteLength(body, 'utf8');
      input.provider.requestPolicy.transportByteLimit = bytes + remaining;
      const result = adapter.judge(input);
      if (remaining < 0) {
        await expect(result).rejects.toMatchObject({
          failureClass: 'judge_provider_capacity_exceeded',
          dispatchState: 'not_dispatched',
        });
        expect(input.fetch).not.toHaveBeenCalled();
      } else {
        await expect(result).resolves.toMatchObject({ decision: 'pass' });
        expect(input.fetch).toHaveBeenCalledOnce();
        expect(input.fetch.mock.calls[0]?.[1]).toMatchObject({ body });
      }
    }
  );

  it('includes provider and message wrappers when the bare request fits', async () => {
    const input = fixture(transport);
    const requestBytes = Buffer.byteLength(JSON.stringify(input.payload.request), 'utf8');
    const bodyBytes = Buffer.byteLength(adapter.buildRequest(input).body, 'utf8');
    input.provider.requestPolicy.transportByteLimit = requestBytes;
    expect(bodyBytes).toBeGreaterThan(requestBytes);
    await expect(adapter.judge(input)).rejects.toMatchObject({
      failureClass: 'judge_provider_capacity_exceeded',
      dispatchState: 'not_dispatched',
    });
    expect(input.fetch).not.toHaveBeenCalled();
  });

  it('does not count UTF-16 string length as UTF-8 transport bytes', async () => {
    const input = fixture(transport);
    const body = adapter.buildRequest(input).body;
    expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(body.length);
    input.provider.requestPolicy.transportByteLimit = body.length;
    await expect(adapter.judge(input)).rejects.toMatchObject({
      failureClass: 'judge_provider_capacity_exceeded',
      dispatchState: 'not_dispatched',
    });
    expect(input.fetch).not.toHaveBeenCalled();
  });
});
