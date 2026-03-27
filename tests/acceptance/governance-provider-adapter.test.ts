import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createHttpJsonGovernanceProviderAdapter,
  createOpenAICompatibleGovernanceProviderAdapter,
} from '../../scripts/governance-provider-adapter';

function listen(
  handler: Parameters<typeof http.createServer>[0]
): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to bind test server');
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        })
    )
  );
});

describe('governance provider adapter', () => {
  it('resolves model hints from an http-json provider', async () => {
    const { server, baseUrl } = await listen(async (req, res) => {
      expect(req.url).toBe('/hint');
      expect(req.method).toBe('POST');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          hint: {
            confidence: 'high',
            suggestedStage: 'architecture',
            suggestedAction: 'patch',
            explicitRolePreference: ['critical-auditor'],
            researchPolicy: 'preferred',
            delegationPreference: 'ask-me-first',
            constraints: ['docs-only'],
            rationale: 'Need a narrow architecture remediation.',
          },
        })
      );
    });
    servers.push(server);

    const adapter = createHttpJsonGovernanceProviderAdapter({
      id: 'http-json-test',
      endpoint: `${baseUrl}/hint`,
    });

    const candidate = await adapter.resolveModelHints({
      promptText: '请给我 architecture remediation hints',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      capabilitySlot: 'architecture.challenge',
      canonicalAgent: 'Architect + Critical Auditor',
      actualExecutor: 'party-mode facilitator',
      targetArtifacts: ['architecture.md'],
    });

    expect(candidate?.providerId).toBe('http-json-test');
    expect(candidate?.providerMode).toBe('http-json');
    expect(candidate?.suggestedStage).toBe('architecture');
    expect(candidate?.constraints).toContain('docs-only');
  });

  it('resolves model hints from an openai-compatible provider', async () => {
    const { server, baseUrl } = await listen(async (req, res) => {
      expect(req.url).toBe('/v1/chat/completions');
      expect(req.method).toBe('POST');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  confidence: 'medium',
                  suggestedStage: 'plan',
                  suggestedAction: 'patch',
                  explicitRolePreference: ['critical-auditor'],
                  researchPolicy: 'forbidden',
                  delegationPreference: 'ask-me-first',
                  constraints: ['minimal-patch'],
                  rationale: 'Keep the retry loop bounded.',
                }),
              },
            },
          ],
        })
      );
    });
    servers.push(server);

    const adapter = createOpenAICompatibleGovernanceProviderAdapter({
      id: 'openai-compatible-test',
      baseUrl: `${baseUrl}/v1`,
      model: 'gpt-test',
      apiKey: 'test-key',
    });

    const candidate = await adapter.resolveModelHints({
      promptText: '请给我 remediation governance hints',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'readiness workflow',
      targetArtifacts: ['prd.md', 'architecture.md'],
    });

    expect(candidate?.providerId).toBe('openai-compatible-test');
    expect(candidate?.providerMode).toBe('openai-compatible');
    expect(candidate?.suggestedAction).toBe('patch');
    expect(candidate?.researchPolicy).toBe('forbidden');
  });
});
