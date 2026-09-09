import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readGoalFinalizerExecutionAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-run-finalizer';
import { normalizeGoalExecutionAuthority, resolveGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';
import { compileGoalExecutionIR, type GoalExecutionCompilerInput } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { createTypedSourceAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { requirementsTypedSemanticSource, projectRequirementsTypedGoalObligations } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-typed-bridge';
import { sha256Stable, stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { decodeGoalSemanticDictionary, encodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
import { typedTwoActionIR } from '../helpers/standalone-goal-typed-consumers';

const hash = `sha256:${'1'.repeat(64)}`;
function input(): GoalExecutionCompilerInput {
  const obligations = ['WORK-01', 'WORK-02'].map((id) => ({ obligationId: id, kind: 'MUST' as const,
    text: `Implement ${id}.`, oracle: `${id} equals its expected output.`, sourceRefs: [id], atomRefs: [`${id}-A1`], evidenceClaimRefs: [] }));
  return { profile: 'standalone', standaloneLineage: { sourcePlanHash: hash, internalSemanticGateHash: hash }, semanticSource: { kind: 'legacy_source' },
    technicalAuthority: { internalSemanticGateHash: hash }, obligations,
    atoms: obligations.map((row) => ({ id: row.atomRefs[0], requirementRef: row.obligationId, action: row.text, oracle: row.oracle })), logicalSpecSpans: [],
    executionConstraints: obligations.flatMap((row, index) => ['PATH', 'CMD', 'ART', 'EVDREQ'].map((kind) => ({ constraintId: `${kind}-${index}`, kind,
      canonicalValue: kind === 'PATH' ? `src/${index}.ts` : kind === 'CMD' ? `npm test -- ${index}` : kind === 'ART' ? `reports/${index}.json` : `Expected ${index} output`,
      applicableMustRefs: [row.obligationId], applicableAtomRefs: row.atomRefs, sourceRefs: row.sourceRefs, premiseRefs: row.sourceRefs }))),
    architecture: { isolation: { mode: 'consumer_worktree' }, ownership: obligations.map((row, index) => ({ targetPath: `src/${index}.ts`, owner: row.obligationId, basisRefs: [row.obligationId] })) } };
}

function requirementsIr() {
  const raw = input();
  const authority = createTypedSourceAuthority({ schemaVersion: 'requirements-contract-typed-source-graph/v2',
    sourceNodes: raw.obligations.map((row) => ({ sourceRootId: row.obligationId, text: row.text, executionRole: 'action',
      normativeStrength: 'must', polarity: 'required', conditions: [], scope: { kind: 'work', ownerId: row.obligationId }, declaredIds: [row.obligationId] })),
    sourceBlocks: [], sourceRelations: [], commandDeclarations: [], scenarioDeclarations: [], fixDeclarations: [], sections: [],
    workDeclarations: raw.obligations.map((row) => ({ id: row.obligationId, text: row.text, pass: [{ text: row.oracle }] })) });
  const semanticIr = { schemaVersion: 'requirements-contract-semantic-ir/v2', semanticRevisionId: hash, scopeSemanticHash: hash,
    semanticPayload: { semantics: { typedSourceAuthority: authority, atoms: raw.atoms }, specSpanRegistry: [],
      executionConstraints: raw.executionConstraints, semanticProvenance: { typedSourceGraph: authority.graphHash } } };
  const semanticSource = requirementsTypedSemanticSource(semanticIr);
  const obligationIds = raw.obligations.map((row) => row.obligationId);
  const logicalSpecSpans = [{
    specSpanId: 'SPEC-SPAN-TYPED-GRAPH',
    authorityClass: 'source_grounded',
    normalizedClaimHash: authority.graphHash,
    boundTypedSourceGraphHash: authority.graphHash,
    boundSemanticNodeIds: [...obligationIds, ...obligationIds.map((id) => `${id}-A1`)],
    boundObligationIds: obligationIds,
    evidenceClaimRefs: [],
  }];
  const { standaloneLineage: _standaloneLineage, ...base } = raw;
  return compileGoalExecutionIR({ ...base, profile: 'requirements_backed', requirementsLineage: { semanticRevisionId: hash, scopeSemanticHash: hash },
    semanticSource, logicalSpecSpans,
    executionConstraints: semanticSource.typedExecutionConstraints as GoalExecutionCompilerInput['executionConstraints'],
    obligations: projectRequirementsTypedGoalObligations(semanticSource, logicalSpecSpans) });
}

function rewrite(authority: any, mutate: (projection: any) => void) {
  const copy = structuredClone(authority);
  const projection = decodeGoalSemanticDictionary(copy.goal);
  mutate(projection);
  copy.goal = encodeGoalSemanticDictionary(projection);
  const { goalExecutionAuthorityHash: _goalExecutionAuthorityHash, ...payload } = copy;
  copy.goalExecutionAuthorityHash = sha256Stable(payload);
  return copy;
}

describe('versioned Goal execution authority persistence', () => {
  it('preserves v1 bytes and semantic hash without adding a wrapper', () => {
    const ir = compileGoalExecutionIR(input());
    expect(stableStringify(normalizeGoalExecutionAuthority(ir))).toBe(stableStringify(ir));
    expect(resolveGoalExecutionAuthority(ir)).toEqual(ir);
  });

  it('restores Requirements obligations and aliases exactly from the complete internal authority', () => {
    const ir = requirementsIr();
    const authority: any = normalizeGoalExecutionAuthority(ir);
    expect(authority.schemaVersion).toBe('GoalExecutionAuthority/v2');
    expect(authority.projectionRecipe).toBe('requirements_typed_obligations/v1');
    expect(resolveGoalExecutionAuthority(authority)).toEqual(ir);
    expect(Buffer.byteLength(`${stableStringify(authority)}\n`)).toBeLessThanOrEqual(1048576);
    expect(() => resolveGoalExecutionAuthority(ir)).toThrow('goal_execution_authority_version_invalid');
  });

  it.each(['subset', 'reordered', 'unknown', 'conflicting-field'])('rejects %s source references after the wrapper is rehashed', (mutation) => {
    const authority = normalizeGoalExecutionAuthority(requirementsIr());
    const changed = rewrite(authority, (projection) => {
      if (mutation === 'subset') projection.obligations.pop();
      if (mutation === 'reordered') projection.obligations.reverse();
      if (mutation === 'unknown') projection.obligations[0].typedSourceNodeRef = 'WORK-MISSING';
      if (mutation === 'conflicting-field') projection.obligations[0].text = 'Forged action';
    });
    expect(() => resolveGoalExecutionAuthority(changed)).toThrow('goal_execution_authority_source_node_refs_invalid');
  });

  it('preserves standalone v2 without applying Requirements-only reference derivation', async () => {
    const ir = await typedTwoActionIR();
    const authority: any = normalizeGoalExecutionAuthority(ir);
    expect(authority.projectionRecipe).toBe('standalone_obligation_aliases/v1');
    expect(resolveGoalExecutionAuthority(authority)).toEqual(ir);
  });

  it('resolves finalizer authority without running a campaign and rejects missing or tampered inputs', () => {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'test-only-goal-authority-reader-'));
    try {
      const ir = requirementsIr();
      const authority = normalizeGoalExecutionAuthority(ir);
      const target = path.join(projectRoot, 'authority.json');
      const ref = { path: 'authority.json', hash: ir.goalExecutionIRHash };
      writeFileSync(target, `${stableStringify(authority)}\n`, 'utf8');
      expect(readGoalFinalizerExecutionAuthority({ projectRoot, ref })).toEqual(ir);
      expect(() => readGoalFinalizerExecutionAuthority({ projectRoot, ref: { ...ref, path: 'missing.json' } })).toThrow();
      expect(() => readGoalFinalizerExecutionAuthority({ projectRoot, ref: { ...ref, hash: `sha256:${'2'.repeat(64)}` } })).toThrow();
      writeFileSync(target, `${stableStringify(rewrite(authority, (projection) => projection.obligations.pop()))}\n`, 'utf8');
      expect(() => readGoalFinalizerExecutionAuthority({ projectRoot, ref })).toThrow();
      writeFileSync(target, JSON.stringify(authority, null, 2), 'utf8');
      expect(() => readGoalFinalizerExecutionAuthority({ projectRoot, ref })).toThrow();
    } finally { rmSync(projectRoot, { recursive: true, force: true }); }
  });
});
