import { describe, expect, it } from 'vitest';
import { compileStandaloneGoalSemanticIR, type StandaloneGoalSemanticInput } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';

function input(): StandaloneGoalSemanticInput {
  const sourceObligations = ['alpha', 'beta'].map((name) => ({
    id: `MUST-${name}`, exactText: `Implement ${name}.`, requiredOutcome: `${name} succeeds`,
    specSpanRefs: [`SPAN-${name}`],
  }));
  const declarations = [
    ['PATH-standalone-1', 'alpha'], ['PATH-standalone-2', 'beta'],
    ['CMD-alpha', 'alpha'], ['CMD-beta', 'beta'], ['ART-alpha', 'alpha'],
    ['EVDREQ-alpha', 'alpha'], ['STOP-standalone-1', 'beta'],
  ];
  return {
    sourcePlanHash: `sha256:${'1'.repeat(64)}`, sourceSnapshotHash: `sha256:${'2'.repeat(64)}`,
    sourceObligations,
    logicalSpecSpans: sourceObligations.map((row) => ({
      specSpanId: row.specSpanRefs[0], boundObligationIds: [row.id], evidenceClaimRefs: [],
    })),
    technicalSnapshot: {
      targetPaths: ['src/alpha.ts', 'src/beta.ts'],
      commandRecords: ['alpha', 'beta'].map((name) => ({ commandId: `CMD-${name}`, invocation: `npm test -- ${name}` })),
      artifactRecords: [{ artifactId: 'ART-alpha', logicalPath: 'out/alpha.json' }],
      evidenceRecords: [{ evidenceContractId: 'EVDREQ-alpha', requirement: 'alpha output matches oracle' }],
      forbiddenPaths: ['legacy/**'], isolationMode: 'consumer_worktree',
      constraintBindings: declarations.map(([constraintId, name]) => ({
        constraintId, sourceRefs: [`SPAN-${name}`], applicableMustRefs: [`MUST-${name}`],
        premiseRefs: [`SPAN-${name}`], scope: 'declared',
      })),
    },
  };
}

describe('standalone sparse declared bindings', () => {
  it('retains exact applicability and provenance without pretending declarations are execution proof', () => {
    const ir = compileStandaloneGoalSemanticIR(input());
    const constraints = ir.semanticPayload.executionConstraints as Record<string, unknown>[];
    const alpha = constraints.find((row) => row.constraintId === 'CMD-alpha');
    expect(alpha).toMatchObject({ applicableMustRefs: ['MUST-alpha'],
      applicableAtomRefs: ['MUST-alpha-A1'], premiseRefs: ['SPAN-alpha'],
      sourceRefs: ['SPAN-alpha'], disposition: 'source_declared', declarationStatus: 'source_declared_not_executed' });
    expect(constraints.every((row) => row.disposition !== 'proven')).toBe(true);
  });

  it('rejects absent bindings instead of manufacturing full coverage', () => {
    const value = input();
    delete value.technicalSnapshot.constraintBindings;
    expect(() => compileStandaloneGoalSemanticIR(value)).toThrow('standalone_goal_constraint_binding_missing');
  });

  it.each(['sourceRefs', 'premiseRefs', 'applicableMustRefs', 'applicableAtomRefs'] as const)(
    'rejects dangling %s', (field) => {
      const value = input();
      value.technicalSnapshot.constraintBindings![0][field] = ['UNKNOWN'];
      expect(() => compileStandaloneGoalSemanticIR(value)).toThrow('standalone_goal_constraint_binding_invalid');
    });

  it('rejects duplicate and unused bindings', () => {
    const value = input();
    value.technicalSnapshot.constraintBindings!.push({ ...value.technicalSnapshot.constraintBindings![0] });
    expect(() => compileStandaloneGoalSemanticIR(value)).toThrow('standalone_goal_constraint_binding_invalid');
    value.technicalSnapshot.constraintBindings!.at(-1)!.constraintId = 'CMD-absent';
    expect(() => compileStandaloneGoalSemanticIR(value)).toThrow('standalone_goal_constraint_binding_invalid');
  });

  it('does not invent artifact or evidence declarations just to satisfy a nonempty collection', () => {
    const value = input();
    value.technicalSnapshot.artifactRecords = [];
    value.technicalSnapshot.evidenceRecords = [];
    value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.filter(
      (row) => !row.constraintId.startsWith('ART-') && !row.constraintId.startsWith('EVDREQ-'));
    const ir = compileStandaloneGoalSemanticIR(value);
    expect((ir.semanticPayload.executionConstraints as Record<string, unknown>[]).some(
      (row) => row.kind === 'ART' || row.kind === 'EVDREQ')).toBe(false);
  });

  it('preserves an explicitly sourced global constraint and its real scope', () => {
    const value = input();
    const global = value.technicalSnapshot.constraintBindings!.at(-1)!;
    global.scope = 'global';
    global.applicableMustRefs = ['MUST-alpha', 'MUST-beta'];
    const ir = compileStandaloneGoalSemanticIR(value);
    expect((ir.semanticPayload.executionConstraints as Record<string, unknown>[]).at(-1)).toMatchObject({
      scope: 'global', applicableMustRefs: ['MUST-alpha', 'MUST-beta'], sourceRefs: ['SPAN-beta'],
    });
  });

  it('allows a semantically valid candidate above the legacy Judge transport size', () => {
    const value = input();
    value.sourceObligations[0].exactText = `Implement alpha with ${'detail '.repeat(180000)}.`;
    const ir = compileStandaloneGoalSemanticIR(value);
    expect(Buffer.byteLength(JSON.stringify(ir), 'utf8')).toBeGreaterThan(1_048_576);
    expect((ir.semanticPayload.executionConstraints as Record<string, unknown>[])
      .every((row) => (row.applicableMustRefs as string[]).length === 1)).toBe(true);
  });

  it('keeps fixed-density independent families linear at N, 2N and 4N', () => {
    const measurements = [20, 40, 80].map((count) => {
      const value = input();
      const ids = Array.from({ length: count }, (_, index) => String(index).padStart(3, '0'));
      value.sourceObligations = ids.map((id) => ({ id: `MUST-${id}`, exactText: `Implement ${id}.`,
        requiredOutcome: `Output ${id} matches its oracle.`, specSpanRefs: [`SPAN-${id}`] }));
      value.logicalSpecSpans = ids.map((id) => ({ specSpanId: `SPAN-${id}`,
        boundObligationIds: [`MUST-${id}`], evidenceClaimRefs: [] }));
      value.technicalSnapshot.targetPaths = ids.map((id) => `src/${id}.ts`);
      value.technicalSnapshot.commandRecords = ids.map((id) => ({ commandId: `CMD-${id}`, invocation: `npm test -- ${id}` }));
      value.technicalSnapshot.artifactRecords = [];
      value.technicalSnapshot.evidenceRecords = [];
      value.technicalSnapshot.forbiddenPaths = [];
      value.technicalSnapshot.constraintBindings = ids.flatMap((id, index) =>
        [`PATH-standalone-${index + 1}`, `CMD-${id}`].map((constraintId) => ({ constraintId,
          sourceRefs: [`SPAN-${id}`], applicableMustRefs: [`MUST-${id}`], premiseRefs: [`SPAN-${id}`] })));
      const ir = compileStandaloneGoalSemanticIR(value);
      const constraints = ir.semanticPayload.executionConstraints as Record<string, string[]>[];
      for (const [index, id] of ids.entries()) {
        expect(constraints[index].applicableMustRefs).toEqual([`MUST-${id}`]);
        expect(constraints[count + index].applicableMustRefs).toEqual([`MUST-${id}`]);
      }
      return { bytes: Buffer.byteLength(JSON.stringify(ir), 'utf8'), edges: constraints.reduce(
        (total, row) => total + row.applicableMustRefs.length + row.applicableAtomRefs.length + row.premiseRefs.length, 0) };
    });
    expect(measurements.map((row) => row.edges)).toEqual([120, 240, 480]);
    for (let index = 1; index < measurements.length; index++) {
      expect(measurements[index].bytes / measurements[index - 1].bytes).toBeLessThan(2.1);
    }
  });

  it('rejects a pathological full relation graph by structural edge budget', () => {
    const value = input();
    const ids = Array.from({ length: 600 }, (_, index) => String(index).padStart(3, '0'));
    value.sourceObligations = ids.map((id) => ({ id: `MUST-${id}`, exactText: `Implement ${id}.`,
      requiredOutcome: `Output ${id} matches its oracle.`, specSpanRefs: [`SPAN-${id}`] }));
    value.logicalSpecSpans = ids.map((id) => ({ specSpanId: `SPAN-${id}`,
      boundObligationIds: [`MUST-${id}`], evidenceClaimRefs: [] }));
    value.technicalSnapshot.targetPaths = ids.map((id) => `src/${id}.ts`);
    value.technicalSnapshot.commandRecords = [];
    value.technicalSnapshot.artifactRecords = [];
    value.technicalSnapshot.evidenceRecords = [];
    value.technicalSnapshot.forbiddenPaths = [];
    const all = ids.map((id) => `MUST-${id}`);
    value.technicalSnapshot.constraintBindings = ids.map((id, index) => ({
      constraintId: `PATH-standalone-${index + 1}`,
      sourceRefs: [`SPAN-${id}`], applicableMustRefs: all, premiseRefs: [`SPAN-${id}`],
    }));
    expect(() => compileStandaloneGoalSemanticIR(value)).toThrow('standalone_relation_graph_edge_budget_exceeded');
  });
});
