import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTypedSourceAuthority, resolveTypedSourceAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { projectRequirementsToGoalObligations } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { compileGoalExecutionIR, goalExecutionIRHash, validateGoalExecutionIR, type GoalExecutionCompilerInput } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { compileGoalExecutionClosure } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-closure';
import { assertRequirementsTypedAuthorityMatchesGoal, requirementsTypedSemanticSource } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-typed-bridge';
import { typedConsumerProbe } from '../helpers/standalone-goal-typed-consumers';
import { validateGoalContractSchema } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/schema-registry';

const hash = (value: string) => `sha256:${value.repeat(64)}`;
const fixture = (aggregate = false) => {
  const works = ['alpha', 'beta'].map((name) => ({ id: `WORK-${name}`, text: `Implement ${name}.`,
    pass: [{ text: `${name} matches its declared result.` }] }));
  const nodes = [
    ...works.map((work) => ({ sourceRootId: work.id, executionRole: 'action' as const, text: work.text,
      polarity: 'required', normativeStrength: 'must', conditions: [], scope: { kind: 'work', ownerId: work.id }, declaredIds: [work.id] })),
    { sourceRootId: 'BOUND-alpha', executionRole: 'boundary' as const, text: 'Do not touch the alpha cache.',
      polarity: 'forbidden', normativeStrength: 'must', conditions: [{ kind: 'when', text: 'When alpha is enabled.' }],
      scope: { kind: 'work', ownerId: 'WORK-alpha' }, declaredIds: [], priority: { rank: 1, basis: 'source_order' } },
    { sourceRootId: 'GUIDE-section', executionRole: 'guidance' as const, text: 'May retain an auxiliary note.',
      polarity: 'permitted', normativeStrength: 'may', conditions: [], scope: { kind: 'section', sectionRoot: 'alpha-section' }, declaredIds: [] },
  ];
  const constraints = works.flatMap((work, index) => (aggregate && index === 1 ? ['CMD', 'EVDREQ'] : ['PATH', 'CMD', 'ART', 'EVDREQ']).map((kind) => ({
    constraintId: `${kind}-${work.id}`, kind,
    canonicalValue: kind === 'PATH' ? `src/${index}.ts` : kind === 'CMD' ? `node tests/${index}.test.js`
      : kind === 'ART' ? `dist/${index}.js` : `${work.id} declared test output`,
    applicableMustRefs: [work.id], applicableAtomRefs: [`${work.id}-A1`], premiseRefs: [work.id], sourceRefs: [work.id],
    disposition: 'source_declared', declarationStatus: 'source_declared_not_executed', scope: 'declared',
    ...(aggregate && index === 1 && kind === 'CMD' ? { sourceDeclarationRefs: ['SOURCE-CMD-beta'] } : {}),
  })));
  const authority = createTypedSourceAuthority({ schemaVersion: 'requirements-contract-typed-source-graph/v2', sourceNodes: nodes,
    sourceRelations: [{ relationId: 'REL-1', kind: 'applies_to', from: 'BOUND-alpha', to: 'WORK-alpha', blockId: 'alpha-section' }],
    sourceBlocks: [{ id: 'alpha-section' }, ...(aggregate ? [
      { id: 'B-beta', text: 'Execution Class: aggregate_only\nOwned Production Paths: none\nAggregate Gate Phase: final_aggregate\nAggregate Validation Commands: `VERIFY-BETA`',
        disposition: 'requirement', scope: { kind: 'work', owner: 'WORK-beta' } },
      { id: 'B-beta-command', text: 'node tests/1.test.js', disposition: 'command_declaration', definedId: 'VERIFY-BETA', scope: { kind: 'work', owner: 'WORK-beta' } },
    ] : [])], commandDeclarations: constraints.filter((row) => row.kind === 'CMD').map((row) => ({ ...row, id: row.constraintId,
      ...(aggregate && row.constraintId === 'CMD-WORK-beta' ? { id: 'SOURCE-CMD-beta', blockId: 'B-beta-command', owner: 'WORK-beta', expression: row.canonicalValue } : {}) })),
    workDeclarations: works.map((work) => ({ ...work, ...(aggregate && work.id === 'WORK-beta' ? { commandIds: ['SOURCE-CMD-beta'] } : {}) })),
    scenarioDeclarations: [], fixDeclarations: [], sections: [{ id: 'alpha-section', scope: { kind: 'section' } }] });
  const atoms = works.map((work) => ({ id: `${work.id}-A1`, requirementRef: work.id, authorityRefs: [work.id],
    action: work.text, oracle: work.pass.map((row) => row.text).join('\n'), dependencies: [] }));
  const spans = nodes.map((node) => ({ specSpanId: `SPAN-${node.sourceRootId}`, boundObligationIds: [node.sourceRootId], evidenceClaimRefs: [] }));
  const semanticIr = { schemaVersion: 'requirements-contract-semantic-ir/v2', semanticRevisionId: 'REV-1', scopeSemanticHash: hash('1'),
    semanticPayload: { semantics: { requirements: [], atoms, typedSourceAuthority: authority }, specSpanRegistry: spans, executionConstraints: constraints } };
  const input = (): GoalExecutionCompilerInput => ({ profile: 'requirements_backed',
    semanticSource: requirementsTypedSemanticSource(semanticIr),
    requirementsLineage: { semanticRevisionId: 'REV-1', scopeSemanticHash: hash('1') }, technicalAuthority: {},
    obligations: projectRequirementsToGoalObligations(semanticIr), atoms, logicalSpecSpans: spans, executionConstraints: constraints,
    architecture: { isolation: { mode: 'consumer_worktree' }, ownership: works.filter((work) => !aggregate || work.id !== 'WORK-beta').map((work, index) => ({ targetPath: `src/${index}.ts`,
      owner: work.id, basisRefs: [`PATH-${work.id}`], obligationRefs: [work.id], atomRefs: [`${work.id}-A1`], sourceRefs: [work.id] })) } });
  return { semanticIr, authority, nodes, input };
};

describe('Requirements typed authority to Goal bridge', () => {
  it('preserves explicit aggregate metadata and source-command aliases without borrowing implementation ownership', () => {
    const value = fixture(true);
    const ir = compileGoalExecutionIR(value.input());
    const execution = resolveTypedSourceAuthority(value.authority).sourceNodes.find((node) => node.sourceRootId === 'WORK-beta')!.taskExecution;
    expect(ir.obligations.find((row) => row.obligationId === 'WORK-beta')!.taskExecution).toEqual(execution);
    expect(ir.atomicTasks.find((task) => (task.obligationRefs as string[]).includes('WORK-beta'))!.taskExecution).toEqual(execution);
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    expect(compileGoalExecutionClosure(ir).decision).toBe('pass');
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.children).toHaveLength(2);
    expect(result.children[1].logicalScopes.ownedPaths).toEqual([]);
    expect(result.children[1].commands[0].sourceDeclarationRefs).toEqual(['SOURCE-CMD-beta']);
    expect(result.children[1].atomicTasks[0].taskExecution.aggregateValidationCommands).toEqual(['SOURCE-CMD-beta']);
  }, 120000);

  it('resolves grouped v2 source spans for non-action obligations and child consumers', () => {
    const value = fixture();
    const spans = value.semanticIr.semanticPayload.specSpanRegistry as any[];
    const actionIds = value.nodes.filter((node) => node.executionRole === 'action').map((node) => node.sourceRootId);
    spans.splice(0, spans.length, { specSpanId: 'SPEC-SPAN-GROUP', authorityClass: 'source_grounded',
      normalizedClaimHash: value.authority.graphHash, boundTypedSourceGraphHash: value.authority.graphHash,
      boundObligationIds: actionIds, boundSemanticNodeIds: [...actionIds, ...actionIds.map((id) => `${id}-A1`)], evidenceClaimRefs: [] });
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.obligations.every((row) => row.sourceRefs.includes('SPEC-SPAN-GROUP'))).toBe(true);
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.children.every((child: any) => child.logicalSpecSpans.some((span: any) => span.specSpanId === 'SPEC-SPAN-GROUP'))).toBe(true);
    spans[0].boundTypedSourceGraphHash = hash('9');
    expect(() => projectRequirementsToGoalObligations(value.semanticIr)).toThrow('requirements_spec_span_typed_graph_binding_invalid');
  }, 120000);

  it('preserves native STOP conditions without turning their prose into forbidden paths', () => {
    const value = fixture();
    const stop = { constraintId: 'STOP-NATIVE', kind: 'STOP', canonicalValue: 'Stop when the expected source mapping is ambiguous.',
      applicableMustRefs: ['WORK-alpha'], applicableAtomRefs: ['WORK-alpha-A1'], premiseRefs: ['WORK-alpha'],
      applicableSourceRefs: ['WORK-alpha'], scope: { kind: 'work', owner: 'WORK-alpha' }, conditions: [], modality: 'required',
      authorityKind: 'source_declared', disposition: 'proven', sourceDeclarationRefs: ['WORK-alpha'] };
    (value.semanticIr.semanticPayload.executionConstraints as any[]).push(stop);
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.logicalScopes.forbiddenPaths).toEqual([]);
    expect(ir.logicalScopes.stopConditions).toEqual([stop]);
    expect(compileGoalExecutionClosure(ir).decision).toBe('pass');
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    expect(result.children.filter((child: any) => child.logicalScopes.stopConditions.length)).toHaveLength(1);
    expect(typedConsumerProbe(ir, 'dropped-stop').error).toBe('goal_partition_child_authority_mismatch');
  }, 120000);

  it('conserves every typed node without turning boundary or guidance into tasks', () => {
    const { semanticIr, nodes } = fixture();
    const rows = projectRequirementsToGoalObligations(semanticIr);
    expect(rows).toHaveLength(nodes.length);
    expect(rows.find((row) => row.obligationId === 'BOUND-alpha')).toMatchObject({ executionRole: 'boundary', polarity: 'forbidden',
      conditions: [{ text: 'When alpha is enabled.', state: 'unevaluated' }], atomRefs: [], typedSourceNode: nodes[2] });
    expect(rows.find((row) => row.obligationId === 'GUIDE-section')).toMatchObject({ kind: 'PERMISSION', executionRole: 'guidance',
      applicability: { scope: 'source_scope', sourceScope: nodes[3].scope }, atomRefs: [] });
  });

  it('compiles and closes requirements v2 with an explicit empty co-execution set', () => {
    const { input, authority } = fixture();
    const ir = compileGoalExecutionIR(input());
    expect(ir.schemaVersion).toBe('GoalExecutionIR/v2');
    expect(ir.atomicTasks).toHaveLength(2);
    expect(ir.coExecutionConstraints).toEqual([]);
    expect(ir.semanticSource.typedSourceAuthority).toEqual(authority);
    expect(compileGoalExecutionClosure(ir)).toMatchObject({ schemaVersion: 'GoalExecutionClosure/v2', decision: 'pass',
      coverage: { nonActionObligationIds: ['BOUND-alpha', 'GUIDE-section'] } });
  });

  it('rejects deleted or changed typed projections even after recomputing the Goal hash', () => {
    const ir = compileGoalExecutionIR(fixture().input());
    const changed = structuredClone(ir);
    changed.obligations = changed.obligations.filter((row) => row.obligationId !== 'BOUND-alpha');
    changed.goalExecutionIRHash = goalExecutionIRHash(changed);
    expect(validateGoalExecutionIR(changed).decision).toBe('block');
  });

  it('rejects a self-consistent forged authority against the independent Requirements source', () => {
    const original = fixture();
    const changed = fixture();
    changed.semanticIr.semanticPayload.semantics.atoms[0].action = 'A forged action.';
    const ir = compileGoalExecutionIR(changed.input());
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    expect(() => assertRequirementsTypedAuthorityMatchesGoal(original.semanticIr, ir)).toThrow(/external_authority_mismatch/);
  });

  it('rejects a forged graph even after regenerating all its internal authority hashes', () => {
    const original = fixture();
    const changed = fixture();
    const graph = resolveTypedSourceAuthority(changed.authority);
    graph.sourceNodes.find((node) => node.sourceRootId === 'BOUND-alpha')!.conditions = [];
    changed.semanticIr.semanticPayload.semantics.typedSourceAuthority = createTypedSourceAuthority(graph);
    const ir = compileGoalExecutionIR(changed.input());
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    expect(() => assertRequirementsTypedAuthorityMatchesGoal(original.semanticIr, ir)).toThrow(/external_authority_mismatch/);
  });

  it('preserves condition provenance and keeps non-action scope owners as source context', () => {
    const value = fixture();
    const graph = resolveTypedSourceAuthority(value.authority);
    const boundary = graph.sourceNodes.find((node) => node.sourceRootId === 'BOUND-alpha')!;
    boundary.conditions = [{ kind: 'when', text: 'When alpha is enabled.', sourceRefs: ['DECLARED-condition'] }];
    boundary.scope = { kind: 'section', owner: 'GUIDE-section' };
    value.semanticIr.semanticPayload.semantics.typedSourceAuthority = createTypedSourceAuthority(graph);
    const ir = compileGoalExecutionIR(value.input());
    const obligation = ir.obligations.find((row) => row.obligationId === 'BOUND-alpha')!;
    expect(obligation.conditions).toEqual([expect.objectContaining({ sourceRefs: expect.arrayContaining(['DECLARED-condition']) })]);
    expect(obligation.applicability).toMatchObject({ scope: 'source_scope', sourceScope: { kind: 'section', owner: 'GUIDE-section' } });
  });

  it('preserves artifact atom bindings when no direct obligation binding is declared', () => {
    const value = fixture();
    const artifact = value.semanticIr.semanticPayload.executionConstraints.find((row) => row.kind === 'ART')!;
    artifact.applicableMustRefs = [];
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.artifacts[0]).toMatchObject({ atomRefs: ['WORK-alpha-A1'], obligationRefs: [] });
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    const children = typedConsumerProbe(ir);
    expect(children.error).toBeUndefined();
    expect(children.children[0].artifacts[0].atomRefs).toEqual(['WORK-alpha-A1']);
  }, 120000);

  it.each(['scope', 'conditions', 'polarity', 'priority', 'node', 'profile', 'version'])(
    'rejects %s drift in the Goal projection after rehashing', (mutation) => {
      const ir = structuredClone(compileGoalExecutionIR(fixture().input()));
      const row = ir.obligations.find((obligation) => obligation.obligationId === 'BOUND-alpha')!;
      if (mutation === 'scope') row.applicability = { scope: 'global' };
      if (mutation === 'conditions') row.conditions = [];
      if (mutation === 'polarity') row.polarity = 'required';
      if (mutation === 'priority') row.priority = { rank: 2 };
      if (mutation === 'node') delete row.typedSourceNode;
      if (mutation === 'profile') ir.profile = 'standalone';
      if (mutation === 'version') ir.schemaVersion = 'GoalExecutionIR/v1';
      ir.goalExecutionIRHash = goalExecutionIRHash(ir);
      expect(validateGoalExecutionIR(ir).decision).toBe('block');
    });

  it('preserves scoped conditional command provenance and excludes non-required invocations', () => {
    const value = fixture();
    const constraints = value.semanticIr.semanticPayload.executionConstraints as Array<Record<string, unknown>>;
    Object.assign(constraints.find((row) => row.kind === 'CMD')!, { conditions: [{ kind: 'when', text: 'When alpha is enabled.' }],
      scope: { kind: 'work', owner: 'WORK-alpha' }, modality: 'required', applicableSourceRefs: ['WORK-alpha'],
      authorityKind: 'source_requirement', sourceDeclarationRefs: ['CMD-WORK-alpha'], derivationReceiptRefs: [] });
    constraints.push({ ...constraints.find((row) => row.kind === 'CMD'), constraintId: 'CMD-template', modality: 'template',
      canonicalValue: 'never execute this template' });
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.commands).toHaveLength(2);
    expect(ir.commands[0]).toMatchObject({ conditions: [{ text: 'When alpha is enabled.' }], scope: { kind: 'work', owner: 'WORK-alpha' },
      sourceDeclarationRefs: ['CMD-WORK-alpha'], modality: 'required' });
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    const changed = structuredClone(ir);
    changed.commands[0].conditions = [];
    changed.goalExecutionIRHash = goalExecutionIRHash(changed);
    expect(validateGoalExecutionIR(changed).decision).toBe('block');
  });

  it('preserves declared co-execution but rejects invented or changed grouping', () => {
    const value = fixture();
    const declared = { constraintId: 'CTM-declared', kind: 'CTM', canonicalValue: 'alpha and beta must execute together',
      applicableMustRefs: ['WORK-alpha', 'WORK-beta'], applicableAtomRefs: ['WORK-alpha-A1', 'WORK-beta-A1'],
      premiseRefs: ['WORK-alpha'], sourceRefs: ['WORK-alpha'], disposition: 'source_declared', scope: 'declared', declarationStatus: 'source_declared_not_executed' };
    const input = value.input();
    input.executionConstraints = [...input.executionConstraints, declared];
    expect(() => compileGoalExecutionIR(input)).toThrow(/constraint_projection_mismatch/);
    value.semanticIr.semanticPayload.executionConstraints.push(declared);
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.coExecutionConstraints[0].taskRefs).toEqual(['TASK-001', 'TASK-002']);
    expect(validateGoalExecutionIR(ir).decision).toBe('pass');
    const changed = structuredClone(ir);
    changed.coExecutionConstraints[0].taskRefs = ['TASK-001'];
    changed.goalExecutionIRHash = goalExecutionIRHash(changed);
    expect(validateGoalExecutionIR(changed).decision).toBe('block');
  });

  it('requires a source pass oracle instead of substituting the action text', () => {
    const value = fixture();
    const graph = { schemaVersion: 'requirements-contract-typed-source-graph/v2' as const, sourceNodes: value.nodes, sourceRelations: [],
      sourceBlocks: [], commandDeclarations: [], workDeclarations: [{ id: 'WORK-alpha', text: 'Implement alpha.', pass: [] },
        { id: 'WORK-beta', text: 'Implement beta.', pass: [{ text: 'Beta preserves the result.' }] }],
      scenarioDeclarations: [], fixDeclarations: [], sections: [] };
    value.semanticIr.semanticPayload.semantics.typedSourceAuthority = createTypedSourceAuthority(graph);
    expect(() => projectRequirementsToGoalObligations(value.semanticIr)).toThrow(/oracle|pass/);
  });

  it('preserves every source pass clause in order without trimming its exact text', () => {
    const value = fixture();
    const graph = resolveTypedSourceAuthority(value.authority);
    graph.workDeclarations[0].pass = [{ text: '  First source check.  ' }, { text: 'Second source check.' }];
    value.semanticIr.semanticPayload.semantics.typedSourceAuthority = createTypedSourceAuthority(graph);
    value.semanticIr.semanticPayload.semantics.atoms[0].oracle = '  First source check.  \nSecond source check.';
    const ir = compileGoalExecutionIR(value.input());
    expect(ir.atomicTasks[0].oracle).toBe('  First source check.  \nSecond source check.');
    expect(compileGoalExecutionClosure(ir).decision).toBe('pass');
  });

  it('preserves source-scoped context in child contracts without globalizing its applicability', () => {
    const result = typedConsumerProbe(compileGoalExecutionIR(fixture().input()));
    expect(result.error).toBeUndefined();
    expect(result.children.map((child: Record<string, unknown>) => child.obligationRefs)).toEqual([
      ['BOUND-alpha', 'GUIDE-section', 'WORK-alpha'], ['GUIDE-section', 'WORK-beta'],
    ]);
    expect(result.children.every((child: Record<string, unknown>) => child.profile === 'requirements_backed' && child.schemaVersion === 'GoalChildExecutionContract/v2')).toBe(true);
    expect(result.children[1].obligations.find((row: Record<string, unknown>) => row.obligationId === 'GUIDE-section').applicability.scope).toBe('source_scope');
    expect(typedConsumerProbe(compileGoalExecutionIR(fixture().input()), 'swapped-command').error).toBe('goal_partition_child_authority_mismatch');
  }, 120000);

  it('accepts typed adapter mappings only with a v2 graph binding', () => {
    const { input, authority } = fixture();
    const kinds = ['MUST', 'NEG', 'OUT', 'FR', 'NFR', 'ACCEPTANCE', 'FAILURE', 'EDGE', 'GUIDANCE', 'PERMISSION', 'COMPOSITE', 'DEFINITION'];
    const obligations = input().obligations;
    const projection = { schemaVersion: 'GoalRequirementsAdapterProjection/v2', profile: 'requirements_backed', requirementsLineage: {},
      typedSourceGraphHash: authority.graphHash, obligationMappings: obligations.map((row) => ({ sourceObligationId: row.obligationId,
        goalObligationId: row.obligationId, kind: row.kind, sourceRefs: row.sourceRefs })),
      conservationCounts: Object.fromEntries(kinds.map((kind) => [kind, obligations.filter((row) => row.kind === kind).length])), adapterProjectionHash: hash('a') };
    expect(() => validateGoalContractSchema('goal-requirements-adapter-projection.schema.json', projection)).not.toThrow();
    expect(() => validateGoalContractSchema('goal-requirements-adapter-projection.schema.json', { ...projection, schemaVersion: 'GoalRequirementsAdapterProjection/v1' })).toThrow();
    const missing = { ...projection } as Record<string, unknown>;
    delete missing.typedSourceGraphHash;
    expect(() => validateGoalContractSchema('goal-requirements-adapter-projection.schema.json', missing)).toThrow();
  });

  it('captures the pre-change v1 hash without relaxing its nonempty CTM rule', () => {
    const { input } = fixture();
    const legacy = input();
    legacy.semanticSource = { kind: 'requirements_semantic_ir', semanticRevisionId: 'REV-legacy', scopeSemanticHash: hash('2') };
    legacy.obligations = legacy.atoms.map((atom) => ({ obligationId: String(atom.requirementRef), kind: 'MUST', text: String(atom.action),
      oracle: String(atom.oracle), sourceRefs: [String(atom.requirementRef)], atomRefs: [String(atom.id)], evidenceClaimRefs: [] }));
    legacy.executionConstraints.push({ constraintId: 'CTM-legacy', kind: 'CTM', canonicalValue: 'declared legacy grouping',
      applicableMustRefs: ['WORK-alpha', 'WORK-beta'], applicableAtomRefs: ['WORK-alpha-A1', 'WORK-beta-A1'], premiseRefs: [] });
    const ir = compileGoalExecutionIR(legacy);
    expect(ir.schemaVersion).toBe('GoalExecutionIR/v1');
    expect(ir.goalExecutionIRHash).toBe('sha256:3ad021d05230d962162340a821e633ceeaba296c8ddcbe95ebc11b27609e7f0f');
    expect(compileGoalExecutionClosure(ir).goalExecutionClosureHash).toBe('sha256:636c7c93f4437eb4332ff20036b9d4180b0b38f97e13c5cd4ec031730b07d27b');
    const evidence = path.resolve('.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z');
    mkdirSync(evidence, { recursive: true });
    const run = process.env.REQ_TRACE_BUDGET_RUN_ID ?? `${Date.now()}-${process.pid}`;
    writeFileSync(path.join(evidence, `${run}-typed-bridge-v1-baseline.json`), JSON.stringify({ evidenceClass: 'test-only-v1-hash-baseline',
      goalExecutionIRHash: ir.goalExecutionIRHash, goalExecutionClosureHash: compileGoalExecutionClosure(ir).goalExecutionClosureHash }), { encoding: 'utf8', flag: 'wx' });
    legacy.executionConstraints = legacy.executionConstraints.filter((row) => row.kind !== 'CTM');
    expect(() => compileGoalExecutionIR(legacy)).toThrow(/goal_task_decomposition/);
  });
});
