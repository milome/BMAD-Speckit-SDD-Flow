import { describe, expect, it } from 'vitest';
import { standaloneTechnicalSnapshot } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-technical-snapshot';
import { compileStandaloneGoalSemanticIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { resolveStandaloneGoalSemanticPayload } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-representation';
import { compileGoalExecutionIR, goalExecutionIRHash } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { compileGoalExecutionClosure } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-closure';
import { runStandaloneGoalInternalSemanticGate } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate';
import { typedConsumerProbe } from '../helpers/standalone-goal-typed-consumers';

const hash = `sha256:${'1'.repeat(64)}`;
function fixture() {
  const row = (id: string, executionRole: string) => ({ id, executionRole, text: id, exactText: id,
    requiredOutcome: 'The recorded output equals the independently specified expected output.',
    normativeStrength: 'must', polarity: 'required', conditions: [], specSpanRefs: [`SPAN-${id}`],
    sourceBlockRefs: [`BLOCK-${id}`], provenanceRefs: [`BLOCK-${id}`],
    applicability: { scope: 'obligations', obligationRefs: [id], sourceRefs: [`BLOCK-${id}`] } });
  const rows: any[] = [row('WORK-01', 'action'), row('WORK-02', 'action'), row('AC-01', 'acceptance'), row('REQ-01', 'requirement')];
  const blocks: any[] = rows.map((value) => ({ id: `BLOCK-${value.id}`, text: value.text, disposition: 'normative',
    scope: { kind: value.executionRole === 'action' ? 'task' : 'source_section', ownerId: value.id } }));
  blocks[2].fieldRole = 'evidence';
  blocks[2].text = 'Evidence: reports/expected-output.json';
  blocks[0].commandDeclarations = [{ id: 'CMD-1', invocation: 'npm test -- one' }];
  blocks[1].commandDeclarations = [{ id: 'CMD-2', invocation: 'npm test -- two' }];
  const edge = (fromId: string, kind: string, toId: string, extra = {}) => ({ fromType: 'obligation', fromId,
    toType: 'obligation', toId, kind, sourceBlockRefs: [`BLOCK-${fromId}`], ...extra });
  const relations: any[] = [edge('WORK-01', 'acceptance', 'AC-01'), edge('WORK-02', 'dependency', 'WORK-01'),
    edge('WORK-01', 'path', 'src/one.ts', { toType: 'path', pathRole: 'owned' }),
    edge('WORK-02', 'path', 'src/two.ts', { toType: 'path', pathRole: 'owned' }),
    edge('WORK-01', 'command', 'CMD-1', { toType: 'command' }), edge('WORK-02', 'command', 'CMD-2', { toType: 'command' })];
  return { source: { sourceBlocks: blocks, sourceRelations: relations }, rows, blocks, relations };
}

function compile(source: ReturnType<typeof fixture>) {
  const semantic = compileStandaloneGoalSemanticIR({ sourcePlanHash: hash, sourceSnapshotHash: hash,
    sourceObligations: source.rows, logicalSpecSpans: [], technicalSnapshot: standaloneTechnicalSnapshot(source.source, source.rows) });
  const technicalSnapshot = standaloneTechnicalSnapshot(source.source, source.rows);
  const gate = runStandaloneGoalInternalSemanticGate({ sourcePlanHash: hash, sourceSnapshotHash: hash,
    sourceObligations: source.rows, logicalSpecSpans: [], technicalSnapshot }, semantic);
  const payload: any = resolveStandaloneGoalSemanticPayload(semantic);
  return compileGoalExecutionIR({ profile: 'standalone', semanticSource: { schemaVersion: semantic.schemaVersion },
    standaloneLineage: { sourcePlanHash: hash, sourceSnapshotHash: hash, standaloneGoalSemanticIRHash: semantic.standaloneGoalSemanticIRHash,
      internalSemanticGateHash: gate.gateHash },
    technicalAuthority: { internalSemanticGateHash: gate.gateHash }, ...payload });
}

describe('standalone source declaration coverage', () => {
  it('inherits AC evidence through the explicit action relation without crossing dependencies', () => {
    const ir = compile(fixture());
    expect(ir.evidenceContracts[0].obligationRefs).toEqual(['AC-01', 'WORK-01']);
    expect(ir.traceSlices[1].evidenceContractRefs).toEqual([]);
    expect(compileGoalExecutionClosure(ir).decision).toBe('pass');
  });

  it.each([
    ['template', 'python -m compileall <files>', 'normative', 'must', 'command_template'],
    ['environment', '$env:DISPLAY=offscreen', 'normative', 'must', 'environment_setting'],
    ['optional', 'npm test -- optional', 'normative', 'may', 'unselected_option'],
    ['prohibited', 'git add -A', 'normative', 'must', 'prohibited_command'],
    ['example', 'npm test -- example', 'example', 'must', 'example_command'],
  ])('preserves the %s declaration without adding an executable command', (_label, invocation, disposition, strength, role) => {
    const value = fixture();
    value.rows[3].normativeStrength = strength;
    if (strength === 'may') { value.rows[3].polarity = 'permitted'; value.rows[3].executionRole = 'guidance'; }
    value.blocks[3].disposition = disposition;
    value.blocks[3].text = role === 'prohibited_command' ? `Must stage exact paths, never \`${invocation}\`.` : invocation;
    value.blocks[3].commandDeclarations = [{ id: 'CMD-DECLARATION', invocation }];
    const ir = compile(value);
    expect(ir.commands.map((command) => command.commandId)).toEqual(['CMD-1', 'CMD-2']);
    expect((ir.semanticSource.typedExecutionConstraints as any[]).find((constraint) => constraint.constraintId === 'CMD-DECLARATION'))
      .toMatchObject({ coverageRole: 'non_action_declaration', declarationRole: role });
    expect(compileGoalExecutionClosure(ir).coverage.nonActionConstraintIds).toContain('CMD-DECLARATION');
  });

  it('preserves an example outside the obligation set through exact source provenance', () => {
    const value = fixture();
    value.blocks.push({ id: 'BLOCK-EXAMPLE', disposition: 'example', text: 'npm test -- example', commandDeclarations: [
      { id: 'CMD-EXAMPLE', invocation: 'npm test -- example', sourceRef: { sourceSnapshotHash: hash, startByte: 10, endByteExclusive: 28, exactTextHash: hash } },
    ] });
    const ir = compile(value);
    expect(compileGoalExecutionClosure(ir).coverage.nonActionConstraintIds).toContain('CMD-EXAMPLE');
    expect(ir.atomicTasks).toHaveLength(2);
  });

  it('inherits an explicitly global verification requirement to both actions', () => {
    const value = fixture();
    value.rows[3].applicability = { scope: 'global', sourceRefs: ['BLOCK-REQ-01'] };
    value.blocks[3].commandDeclarations = [{ id: 'CMD-GLOBAL', invocation: 'git status --short' }];
    const ir = compile(value);
    expect(ir.commands.find((command) => command.commandId === 'CMD-GLOBAL')?.obligationRefs).toEqual(['REQ-01', 'WORK-01', 'WORK-02']);
  });

  it('rejects constraint loss and executable projection drift even after rehashing the Goal', () => {
    const value = fixture();
    value.blocks[3].commandDeclarations = [{ id: 'CMD-TEMPLATE', invocation: 'npm test -- <case>' }];
    const ir = compile(value);
    const lost = structuredClone(ir);
    (lost.semanticSource.typedExecutionConstraints as any[]).pop();
    lost.goalExecutionIRHash = goalExecutionIRHash(lost);
    expect(() => compileGoalExecutionClosure(lost)).toThrow('goal_execution_normative_source_binding_invalid');
    const drift = structuredClone(ir);
    drift.commands[0].invocation = 'npm test -- invented';
    drift.goalExecutionIRHash = goalExecutionIRHash(drift);
    expect(() => compileGoalExecutionClosure(drift)).toThrow('goal_execution_normative_source_binding_invalid');
  });

  it('conserves action-scoped declarations in child packages while retaining an authoring declaration in the parent', () => {
    const value = fixture();
    value.rows[3].conditions = [{ kind: 'source_confirmation_gate', text: 'After source confirmation the contract author may generate.', sourceRefs: ['BLOCK-REQ-01'], state: 'unevaluated' }];
    value.blocks[3].commandDeclarations = [{ id: 'CMD-AUTHOR', invocation: 'npm exec -- goal-contract generate' }];
    const ir = compile(value);
    const result = typedConsumerProbe(ir);
    expect(result.error).toBeUndefined();
    const expected = (ir.semanticSource.typedExecutionConstraints as any[]).filter((row) => row.constraintId !== 'CMD-AUTHOR').map((row) => row.constraintId).sort();
    expect([...new Set(result.children.flatMap((child: any) => child.executionConstraintRefs))].sort()).toEqual(expected);
    expect(result.children.every((child: any) => child.executionConstraints.every((row: any) => row.constraintId !== 'CMD-AUTHOR'))).toBe(true);
    expect(typedConsumerProbe(ir, 'missing-constraint').error).toBe('goal_partition_child_authority_mismatch');
    expect(typedConsumerProbe(ir, 'forged-constraint').error).toBe('goal_partition_child_authority_mismatch');
  }, 120000);

  it('does not convert an unresolved required verification into a parent-only declaration', () => {
    const value = fixture();
    value.blocks[3].commandDeclarations = [{ id: 'CMD-UNRESOLVED', invocation: 'npm test -- required' }];
    expect(typedConsumerProbe(compile(value)).error).toBeDefined();
  }, 120000);
});
