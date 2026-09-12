import { describe, expect, it } from 'vitest';
import { typedTwoActionIR, typedConsumerProbe } from '../helpers/standalone-goal-typed-consumers';
import { standaloneGoalSemanticIRHash } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-hash';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { goalExecutionIRHash, validateGoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';

describe('typed standalone downstream conservation', () => {
  it('keeps the legacy semantic hash formula and binds v2 to its protocol version', () => {
    const payload = { sourcePlanHash: `sha256:${'1'.repeat(64)}`, semanticPayload: { testOnly: 'legacy-hash-preimage' } };
    const v1 = { ...payload, schemaVersion: 'StandaloneGoalSemanticIR/v1' };
    const v2 = { ...payload, schemaVersion: 'StandaloneGoalSemanticIR/v2', sourceSnapshotHash: `sha256:${'2'.repeat(64)}` };
    expect(standaloneGoalSemanticIRHash(v1)).toBe(sha256Stable(payload));
    expect(standaloneGoalSemanticIRHash(v2)).toBe(sha256Stable(v2));
    expect(standaloneGoalSemanticIRHash(v2)).not.toBe(standaloneGoalSemanticIRHash(v1));
    expect(standaloneGoalSemanticIRHash({ ...v2, sourceSnapshotHash: `sha256:${'3'.repeat(64)}` })).not.toBe(standaloneGoalSemanticIRHash(v2));
    expect(() => standaloneGoalSemanticIRHash({ ...v2, schemaVersion: 'unknown' })).toThrow('standalone_goal_semantic_version_unsupported');
  });

  it('retains explicit path applicability without pretending owned files are artifacts', async () => {
    const ir = await typedTwoActionIR();
    expect(ir.artifacts).toEqual([]);
    expect(ir.executionDomains[0].ownership).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetPath: 'src/export.ts', obligationRefs: ['MUST-001'] }),
      expect.objectContaining({ targetPath: 'src/import.ts', obligationRefs: ['MUST-002'] }),
    ]));
  });

  it('partitions independent actions and inherits all and only applicable non-action requirements', async () => {
    const ir = await typedTwoActionIR();
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.evidenceClass).toBe('test-only-consumer-probe');
    expect(result.eligibility.componentCount).toBe(2);
    expect(result.manifest.schemaVersion).toBe('GoalContractPartitionManifest/v2');
    const membership = result.children.map((child: Record<string, unknown>) => child.obligationRefs);
    expect(membership).toEqual([
      ['GUIDE-001', 'MUST-001', 'NEG-001', 'PERMIT-001'],
      ['MUST-002', 'NEG-001', 'PERMIT-001'],
    ]);
    expect(result.children.every((child: Record<string, unknown>) => child.schemaVersion === 'GoalChildExecutionContract/v2')).toBe(true);
    expect(result.children.map((child: Record<string, unknown>) => child.coExecutionConstraints)).toEqual([[], []]);
    expect(result.children.map((child: { executionDomains: Array<{ logicalTargetPaths: string[] }> }) =>
      child.executionDomains[0].logicalTargetPaths)).toEqual([['src/export.ts'], ['src/import.ts']]);
    expect(result.prompts).toHaveLength(2);
    expect(result.prompts.every((prompt: string) => prompt.includes('Strength: may') && prompt.includes('execution role: guidance'))).toBe(true);
  }, 120000);

  it.each(['missing-inherited', 'broadened-inherited', 'flipped-polarity', 'swapped-command',
    'owned-path', 'forbidden-path', 'domain-path', 'dependency', 'coexecution'])(
    'rejects a child with %s even when its own references look consistent', async (mutation) => {
      const ir = await typedTwoActionIR();
      expect(typedConsumerProbe(ir, mutation).error).toBe('goal_partition_child_authority_mismatch');
    }, 120000);

  it('does not broaden a source-scoped STOP to unrelated tasks', async () => {
    const ir = await typedTwoActionIR({ localBoundary: true });
    expect(ir.logicalScopes.pathRestrictions).toEqual([expect.objectContaining({ kind: 'STOP',
      scope: 'declared', canonicalValue: 'legacy/**', applicableMustRefs: ['NEG-001'], sourceRefs: ['SPAN-NEG-001'] })]);
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.children.map((child: { logicalScopes: { forbiddenPaths: string[] } }) => child.logicalScopes.forbiddenPaths))
      .toEqual([['legacy/**'], []]);
    expect(typedConsumerProbe(ir, 'restriction-scope').error).toBe('goal_partition_child_authority_mismatch');
  }, 120000);

  it.each(['global', 'dangling', 'wrong-atom', 'wrong-source', 'missing-aggregate'])(
    'rejects %s restriction corruption even after recomputing the IR hash', async (mutation) => {
      const ir = structuredClone(await typedTwoActionIR({ localBoundary: true }));
      const row = (ir.logicalScopes.pathRestrictions as Array<Record<string, unknown>>)[0];
      if (mutation === 'global') row.scope = 'global';
      if (mutation === 'dangling') row.applicableMustRefs = ['MISSING'];
      if (mutation === 'wrong-atom') row.applicableAtomRefs = ['MUST-002-A1'];
      if (mutation === 'wrong-source') row.sourceRefs = ['SPAN-MISSING'];
      if (mutation === 'missing-aggregate') ir.logicalScopes.forbiddenPaths = [];
      ir.goalExecutionIRHash = goalExecutionIRHash(ir);
      expect(validateGoalExecutionIR(ir).issueCodes).toContain('goal_execution_path_restriction_binding_invalid');
    });
});
