import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractAuditBinding,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-binding';
import {
  publishRequirementsContractJudgeDecision,
  readVerifiedRequirementsContractJudgeDecision,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-decision-store';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements Judge semantic decision reuse', () => {
  it('keeps path, language, renderer and build metadata outside the audit binding', () => {
    const semantic = {
      scopeSemanticHash: hash('1'),
      semanticAuditSlices: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: hash('2') }],
      mandatoryDimensionIds: ['completeness'], coverageSemanticHash: hash('3'),
      judgeProtocolVersion: 'requirements-judge-protocol/v1',
      systemPromptHash: hash('4'), rubricHash: hash('5'), responseSchemaHash: hash('6'),
    };
    const first = createRequirementsContractAuditBinding({
      ...semantic, sourcePath: 'docs/a.md', language: 'en', renderer: 'html', buildHash: hash('7'),
    } as never);
    const second = createRequirementsContractAuditBinding({
      ...semantic, sourcePath: 'docs/b.md', language: 'zh', renderer: 'markdown', buildHash: hash('8'),
    } as never);
    expect(second).toEqual(first);
    expect(createRequirementsContractAuditBinding({
      ...semantic,
      semanticAuditSlices: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: hash('9') }],
    }).auditBindingHash).not.toBe(first.auditBindingHash);
  });

  it('publishes one immutable decision and reuses it by audit binding', () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-decision-store-'));
    try {
      const binding = createRequirementsContractAuditBinding({
        scopeSemanticHash: hash('1'),
        semanticAuditSlices: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: hash('2') }],
        mandatoryDimensionIds: ['completeness'], coverageSemanticHash: hash('3'),
        judgeProtocolVersion: 'requirements-judge-protocol/v1',
        systemPromptHash: hash('4'), rubricHash: hash('5'), responseSchemaHash: hash('6'),
      });
      const decision = publishRequirementsContractJudgeDecision({
        recordRoot,
        binding,
        verdict: 'audited_pass',
        judgeRequestRef: { path: 'quality/request.json', hash: hash('7') },
        judgeResponseRef: { path: 'quality/response.json', hash: hash('8') },
        aggregateRef: { path: 'quality/aggregate.json', hash: hash('9') },
      });
      expect(readVerifiedRequirementsContractJudgeDecision({ recordRoot, binding })).toEqual(decision);
      expect(() => publishRequirementsContractJudgeDecision({
        recordRoot,
        binding,
        verdict: 'audited_fail',
        judgeRequestRef: decision.judgeRequestRef,
        judgeResponseRef: decision.judgeResponseRef,
        aggregateRef: decision.aggregateRef,
      })).toThrow();
    } finally {
      rmSync(recordRoot, { recursive: true, force: true });
    }
  });
});
