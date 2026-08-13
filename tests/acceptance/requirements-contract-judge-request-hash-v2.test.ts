import { describe, expect, it } from 'vitest';
import {
  buildRequirementsContractJudgeRequest,
  verifyRequirementsContractJudgeRequest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function requestInput() {
  return {
    authority: {
      activeSemanticRevisionId: 'sem-1',
      activeScopeSemanticHash: HASH('1'),
      activeBindingRevisionId: 'binding-1',
      activeSourceBindingHash: HASH('2'),
      activeAuthoringAttemptId: 'attempt-1',
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
      systemPrompt: 'Audit the complete requirements contract.',
      rubric: { blockingSeverities: ['Blocker', 'Major'] },
      structuredOutputSchema: { type: 'object', required: ['verdict'] },
      outputTokenReserve: 8192,
    },
    auditPacket: {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      semanticRevisionId: 'sem-1',
      scopeSemanticHash: HASH('1'),
      body: {
        requirementIds: ['MUST-001'],
        artifacts: [{ artifactId: 'final-markdown', payload: '# Contract' }],
      },
    },
    auditPacketArtifactManifest: [
      {
        artifactId: 'judge-audit-packet',
        path: 'authoring/staging/attempt-1/artifacts/cp08/judge-audit-packet.json',
        hash: HASH('7'),
      },
    ],
    remediation: null,
  };
}

describe('requirements contract judgeRequestHash/v2', () => {
  it('hashes every field that changes the actual Judge request body', () => {
    const base = buildRequirementsContractJudgeRequest(requestInput());
    const changedPacket = buildRequirementsContractJudgeRequest({
      ...requestInput(),
      auditPacket: {
        ...requestInput().auditPacket,
        body: {
          requirementIds: ['MUST-001'],
          artifacts: [{ artifactId: 'final-markdown', payload: '# Changed contract' }],
        },
      },
    });
    const changedReserve = buildRequirementsContractJudgeRequest({
      ...requestInput(),
      prompt: { ...requestInput().prompt, outputTokenReserve: 16384 },
    });

    expect(changedPacket.judgeRequestHash).not.toBe(base.judgeRequestHash);
    expect(changedReserve.judgeRequestHash).not.toBe(base.judgeRequestHash);
    expect(verifyRequirementsContractJudgeRequest(base)).toEqual(base);
  });

  it('fails closed for unknown fields and a mutated self hash', () => {
    expect(() =>
      buildRequirementsContractJudgeRequest({ ...requestInput(), hiddenSummaryHash: HASH('8') })
    ).toThrow('requirements_contract_judge_request_field_set_invalid');

    const request = buildRequirementsContractJudgeRequest(requestInput());
    expect(() =>
      verifyRequirementsContractJudgeRequest({ ...request, judgeRequestHash: HASH('9') })
    ).toThrow('requirements_contract_judge_request_hash_mismatch');
  });

  it('binds successor requests only to the accepted fail, aggregate, and actual delta', () => {
    const remediation = {
      remediatesRequestHash: HASH('8'),
      remediationAggregateHash: HASH('9'),
      remediationDeltaHash: HASH('a'),
    };
    const successor = buildRequirementsContractJudgeRequest({ ...requestInput(), remediation });
    const changedDelta = buildRequirementsContractJudgeRequest({
      ...requestInput(),
      remediation: { ...remediation, remediationDeltaHash: HASH('b') },
    });
    expect(changedDelta.judgeRequestHash).not.toBe(successor.judgeRequestHash);
    expect(() => buildRequirementsContractJudgeRequest({
      ...requestInput(),
      remediation: { ...remediation, receiptHash: HASH('c') },
    })).toThrow('requirements_contract_judge_request_remediation_field_set_invalid');
  });
});
