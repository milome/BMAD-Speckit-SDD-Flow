import { describe, expect, it } from 'vitest';
import {
  buildRequirementsContractJudgeAuditPacket,
  validateRequirementsContractJudgeAuditPacketCoverage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements contract Judge audit packet', () => {
  it('includes every canonical payload and records exact UTF-8 bytes without token estimates', () => {
    const duplicatePayload = { title: '批量退款审批', rules: ['重复提交返回原结果'] };
    const result = buildRequirementsContractJudgeAuditPacket({
      semanticRevisionId: 'sem-1',
      scopeSemanticHash: HASH('1'),
      requirementIds: ['MUST-001'],
      mandatoryDimensionIds: ['authority', 'completeness'],
      lineageNodes: [],
      authorityResolutions: [],
      artifacts: [
        { artifactId: 'confirmation-projection', payload: duplicatePayload },
        { artifactId: 'final-markdown', payload: '# 批量退款审批' },
        { artifactId: 'confirmation-view', payload: duplicatePayload },
      ],
    });

    expect(result.packet.body.artifactIds).toEqual([
      'confirmation-projection',
      'confirmation-view',
      'final-markdown',
    ]);
    expect(result.packet.body.artifactPayloadGroups).toHaveLength(2);
    expect(result.packet.body.artifactPayloadGroups).toContainEqual({
      artifactIds: ['confirmation-projection', 'confirmation-view'],
      payload: duplicatePayload,
    });
    expect(result.serializedBytes).toBe(Buffer.byteLength(result.serializedPacket, 'utf8'));
    expect(result).not.toHaveProperty('estimatedTokens');
    expect(result.packet).not.toHaveProperty('estimatedTokens');
  });

  it('fails coverage when an artifact is declared without a lossless payload', () => {
    const result = buildRequirementsContractJudgeAuditPacket({
      semanticRevisionId: 'sem-1',
      scopeSemanticHash: HASH('1'),
      requirementIds: ['MUST-001'],
      mandatoryDimensionIds: ['completeness'],
      lineageNodes: [],
      authorityResolutions: [],
      artifacts: [{ artifactId: 'final-markdown', payload: '# Contract' }],
    });
    const mutated = structuredClone(result.packet);
    mutated.body.artifactPayloadGroups = [];

    expect(
      validateRequirementsContractJudgeAuditPacketCoverage({
        packet: mutated,
        expectedArtifactIds: ['final-markdown'],
      })
    ).toEqual({ decision: 'block', issueCodes: ['judge_audit_packet_coverage_gap'] });
  });
});
