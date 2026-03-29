import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createGovernanceProviderAdapterFromConfig } from '../../scripts/governance-remediation-config';
import {
  createAnthropicCompatibleGovernanceProviderAdapter,
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

      const body = JSON.parse(
        await new Promise<string>((resolve) => {
          let data = '';
          req.setEncoding('utf8');
          req.on('data', (chunk) => {
            data += chunk;
          });
          req.on('end', () => resolve(data));
        })
      ) as Record<string, unknown>;

      const promptRoutingPreview =
        body.promptRoutingPreview && typeof body.promptRoutingPreview === 'object'
          ? (body.promptRoutingPreview as Record<string, unknown>)
          : {};
      expect(promptRoutingPreview.semanticSkillFeatures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillId: 'speckit-workflow',
          }),
        ])
      );
      expect((promptRoutingPreview as { semanticFeatureTopN?: unknown }).semanticFeatureTopN).toMatchObject({
        stageHints: expect.any(Array),
        actionHints: expect.any(Array),
      });
      expect(promptRoutingPreview.executionIntentCandidate).toMatchObject({
        source: 'prompt-hints',
        stage: 'architecture',
        action: 'patch',
        skillAvailabilityMode: 'advisory-only',
        matchedAvailableSkills: ['speckit-workflow', 'code-reviewer'],
        missingSkills: ['party-mode'],
        semanticSkillFeatures: expect.any(Array),
        researchPolicy: 'allowed',
        delegationPreference: 'ask-me-first',
        advisoryOnly: true,
      });
      expect(promptRoutingPreview.executionPlanDecision).toMatchObject({
        source: 'prompt-hints',
        stage: 'architecture',
        action: 'patch',
        skillAvailabilityMode: 'execution-filtered',
        matchedAvailableSkills: ['speckit-workflow', 'code-reviewer'],
        missingSkills: ['party-mode'],
        semanticSkillFeatures: expect.any(Array),
        advisoryOnly: false,
      });
      expect(
        (promptRoutingPreview as { semanticSkillFeatures?: Array<{ skillId?: string }> })
          .semanticSkillFeatures
      ).toEqual(expect.arrayContaining([expect.objectContaining({ skillId: 'speckit-workflow' })]));
      expect(
        (promptRoutingPreview.executionPlanDecision as { blockedByGovernance?: string[] })
          ?.blockedByGovernance
      ).toEqual(expect.arrayContaining(['entry-routing', 'blocker-ownership', 'artifact-target']));
      expect(
        (promptRoutingPreview.executionPlanDecision as { skillChain?: string[] })?.skillChain
      ).toEqual(['speckit-workflow', 'code-reviewer']);
      expect((body.routingContext as { availableSkills?: string[] })?.availableSkills).toEqual([
        'speckit-workflow',
        'code-reviewer',
      ]);
      expect((body.routingContext as { skillPaths?: string[] })?.skillPaths).toEqual([
        'D:/skills/speckit-workflow/SKILL.md',
        'D:/skills/code-reviewer/SKILL.md',
      ]);
      expect(
        (
          body.routingContext as {
            skillInventory?: Array<{ skillId?: string; path?: string }>;
          }
        )?.skillInventory
      ).toEqual([
        {
          skillId: 'speckit-workflow',
          path: 'D:/skills/speckit-workflow/SKILL.md',
        },
        {
          skillId: 'code-reviewer',
          path: 'D:/skills/code-reviewer/SKILL.md',
        },
      ]);

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
      promptText: '请给我 architecture patch remediation hints，使用 party-mode 和 critical auditor',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 2,
      capabilitySlot: 'architecture.challenge',
      canonicalAgent: 'Architect + Critical Auditor',
      actualExecutor: 'party-mode facilitator',
      targetArtifacts: ['architecture.md'],
      availableSkills: ['speckit-workflow', 'code-reviewer'],
      skillPaths: [
        'D:/skills/speckit-workflow/SKILL.md',
        'D:/skills/code-reviewer/SKILL.md',
      ],
      skillInventory: [
        {
          skillId: 'speckit-workflow',
          path: 'D:/skills/speckit-workflow/SKILL.md',
        },
        {
          skillId: 'code-reviewer',
          path: 'D:/skills/code-reviewer/SKILL.md',
        },
      ],
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
      const body = JSON.parse(
        await new Promise<string>((resolve) => {
          let data = '';
          req.setEncoding('utf8');
          req.on('data', (chunk) => {
            data += chunk;
          });
          req.on('end', () => resolve(data));
        })
      ) as Record<string, unknown>;
      expect((body.messages as Array<{ role: string; content: string }>)[0]?.content).toContain(
        'semanticSkillFeatures field'
      );
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
                  recommendedSkillChain: ['provider-recommended-skill', 'code-reviewer'],
                  recommendedSubagentRoles: ['provider-reviewer'],
                  recommendedSkillItems: [
                    {
                      value: 'provider-recommended-skill',
                      reason: 'Provider wants a focused remediation lane.',
                      confidence: 'high',
                    },
                    {
                      value: 'provider-unavailable-skill',
                      reason: 'Provider suggested an unavailable skill.',
                      confidence: 'medium',
                    },
                  ],
                  recommendedSubagentRoleItems: [
                    {
                      value: 'provider-reviewer',
                      reason: 'Provider wants a reviewer role preserved.',
                      confidence: 'medium',
                    },
                  ],
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
    expect(candidate?.recommendedSkillChain).toEqual([
      'provider-recommended-skill',
      'code-reviewer',
    ]);
    expect(candidate?.recommendedSubagentRoles).toEqual(['provider-reviewer']);
    expect(candidate?.recommendedSkillItems).toEqual([
      {
        value: 'provider-recommended-skill',
        reason: 'Provider wants a focused remediation lane.',
        confidence: 'high',
      },
      {
        value: 'provider-unavailable-skill',
        reason: 'Provider suggested an unavailable skill.',
        confidence: 'medium',
      },
    ]);
    expect(candidate?.recommendedSubagentRoleItems).toEqual([
      {
        value: 'provider-reviewer',
        reason: 'Provider wants a reviewer role preserved.',
        confidence: 'medium',
      },
    ]);
  });

  it('resolves model hints from an anthropic-compatible provider', async () => {
    const { server, baseUrl } = await listen(async (req, res) => {
      expect(req.url).toBe('/v1/messages');
      expect(req.method).toBe('POST');
      expect(req.headers['x-api-key']).toBe('anthropic-test-key');
      expect(req.headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(
        await new Promise<string>((resolve) => {
          let data = '';
          req.setEncoding('utf8');
          req.on('data', (chunk) => {
            data += chunk;
          });
          req.on('end', () => resolve(data));
        })
      ) as Record<string, unknown>;

      expect(body.model).toBe('claude-opus-test');
      expect(body.max_tokens).toBe(512);
      expect(Array.isArray(body.messages)).toBe(true);
      expect(body.system).toContain('semanticSkillFeatures field');

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                confidence: 'high',
                suggestedStage: 'post_audit',
                suggestedAction: 'review',
                explicitRolePreference: ['critical-auditor', 'code-reviewer'],
                researchPolicy: 'forbidden',
                delegationPreference: 'ask-me-first',
                constraints: ['no-external-browse'],
                rationale: 'Human review is still required before merge.',
              }),
            },
          ],
        })
      );
    });
    servers.push(server);

    const adapter = createAnthropicCompatibleGovernanceProviderAdapter({
      id: 'anthropic-compatible-test',
      baseUrl: `${baseUrl}/v1`,
      model: 'claude-opus-test',
      apiKey: 'anthropic-test-key',
    });

    const candidate = await adapter.resolveModelHints({
      promptText: '请给我 post_audit governance hints',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 1,
      capabilitySlot: 'post_audit.review',
      canonicalAgent: 'Reviewer',
      actualExecutor: 'post audit workflow',
      targetArtifacts: ['review.md'],
    });

    expect(candidate?.providerId).toBe('anthropic-compatible-test');
    expect(candidate?.providerMode).toBe('anthropic-http');
    expect(candidate?.suggestedStage).toBe('post_audit');
    expect(candidate?.suggestedAction).toBe('review');
    expect(candidate?.constraints).toContain('no-external-browse');
  });

  it('creates an anthropic-compatible adapter from governance remediation config', async () => {
    const { server, baseUrl } = await listen(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                confidence: 'medium',
                suggestedStage: 'plan',
                suggestedAction: 'patch',
                explicitRolePreference: ['architect'],
                researchPolicy: 'allowed',
                delegationPreference: 'ask-me-first',
                constraints: ['keep-loop-bounded'],
                rationale: 'Use anthropic-compatible config path.',
              }),
            },
          ],
        })
      );
    });
    servers.push(server);

    const adapter = createGovernanceProviderAdapterFromConfig({
      version: 1,
      primaryHost: 'claude',
      packetHosts: ['claude'],
      provider: {
        mode: 'anthropic-compatible',
        id: 'anthropic-config-test',
        baseUrl: `${baseUrl}/v1`,
        model: 'claude-sonnet-test',
        apiKey: 'config-key',
      },
    });

    const candidate = await adapter?.resolveModelHints({
      promptText: 'anthropic config test',
      stageContextKnown: true,
      gateFailureExists: true,
      blockerOwnershipLocked: true,
      rootTargetLocked: true,
      equivalentAdapterCount: 1,
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA',
      actualExecutor: 'readiness workflow',
      targetArtifacts: ['architecture.md'],
    });

    expect(adapter?.protocol).toBe('anthropic-http');
    expect(candidate?.providerId).toBe('anthropic-config-test');
    expect(candidate?.providerMode).toBe('anthropic-http');
  });
});
