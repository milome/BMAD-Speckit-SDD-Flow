import { describe, expect, it } from 'vitest';
import { buildMainAgentCanonicalJudgeRunDispatch } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  buildRequirementsContractJudgeRequest,
  verifyRequirementsContractJudgeRequest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function buildRequest() {
  return buildRequirementsContractJudgeRequest({
    authority: {
      activeSemanticRevisionId: 'SEM-001',
      activeScopeSemanticHash: HASH('1'),
      activeBindingRevisionId: 'BIND-001',
      activeSourceBindingHash: HASH('2'),
      activeAuthoringAttemptId: 'ATTEMPT-001',
      activeBuildManifestHash: HASH('3'),
    },
    providerSelection: {
      providerSelectionHash: HASH('4'),
      providerRef: 'judge-a',
      transport: 'openai-compatible',
      apiStyle: 'chat_completions',
      model: 'judge-model',
      adapterRef: 'OpenAICompatibleJudgeAdapter',
      providerRegistryHash: HASH('5'),
      providerConfigurationHash: HASH('6'),
    },
    prompt: {
      systemPrompt: 'Audit the full Requirements contract.',
      rubric: { blockingSeverities: ['Blocker', 'Major'] },
      structuredOutputSchema: { type: 'object', required: ['verdict'] },
      outputTokenReserve: 8192,
    },
    auditPacket: {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      semanticRevisionId: 'SEM-001',
      scopeSemanticHash: HASH('1'),
      body: { requirementIds: ['MUST-001'], artifactIds: ['final-markdown'] },
    },
    auditPacketArtifactManifest: [
      { artifactId: 'judge-audit-packet', path: 'audit-packet.json', hash: HASH('7') },
    ],
    remediation: null,
  });
}

describe('main agent Requirements Judge invocation readiness', () => {
  it('dispatches only a verified canonical request through the explicit Requirements role', () => {
    const request = verifyRequirementsContractJudgeRequest(buildRequest());
    const dispatch = buildMainAgentCanonicalJudgeRunDispatch({
      projectRoot: 'repo',
      config: '_bmad/_config/governance-remediation.yaml',
      request: `quality/requests/${request.judgeRequestHash.replace(':', '-')}/judge-request.json`,
      role: 'requirements_critical_auditor',
      attemptId: 'attempt-001',
      outputDir: 'quality/provider-output/attempt-001',
      controlledDispatchRef: { packetId: 'packet-001', packetKind: 'execution' },
    });

    expect(dispatch).toMatchObject({
      role: 'requirements_critical_auditor',
      roleInference: false,
      directAdapterDispatch: false,
      callerAuthorityInjection: false,
      decision: 'pass',
    });
  });

  it('rejects caller authority and the removed final acceptance role before dispatch', () => {
    expect(() =>
      buildMainAgentCanonicalJudgeRunDispatch({
        projectRoot: 'repo',
        config: '_bmad/_config/governance-remediation.yaml',
        request: 'quality/requests/request.json',
        role: 'requirements_critical_auditor',
        attemptId: 'attempt-001',
        outputDir: 'quality/provider-output/attempt-001',
        controlledDispatchRef: { packetId: 'packet-001', packetKind: 'execution' },
        callerEffectivePass: true,
      })
    ).toThrow('main_agent_judge_bridge_caller_authority_injection');
    expect(() =>
      buildMainAgentCanonicalJudgeRunDispatch({
        projectRoot: 'repo',
        config: '_bmad/_config/governance-remediation.yaml',
        request: 'quality/requests/request.json',
        role: 'final_acceptance_judge' as never,
        attemptId: 'attempt-002',
        outputDir: 'quality/provider-output/attempt-002',
        controlledDispatchRef: { packetId: 'packet-002', packetKind: 'execution' },
      })
    ).toThrow('main_agent_judge_run_role_explicit_required');
  });
});
