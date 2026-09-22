import { describe, expect, it } from 'vitest';
import * as runtime from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-split-must-projection-resync';

function confirmation() {
  return {
    must: [
      { id: 'MUST-FR-001', text: 'Persist each trade fact.' },
      {
        id: 'MUST-FR-002',
        text: 'Use scope and trade ID as the unique key.',
        derivedFromMustRef: 'MUST-FR-001',
      },
    ],
    atomicImplementationTaskList: [
      {
        id: 'TASK-001',
        derivedFromMustRef: 'MUST-FR-001',
        primaryAcceptanceOracles: ['Persist each trade fact.'],
        atomicUnitIndex: 1,
        atomicUnitCount: 2,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        targetFiles: ['src/trades.ts'],
      },
      {
        id: 'TASK-002',
        derivedFromMustRef: 'MUST-FR-001',
        primaryAcceptanceOracles: ['Use scope and trade ID as the unique key.'],
        atomicUnitIndex: 2,
        atomicUnitCount: 2,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        targetFiles: ['src/trades.ts'],
      },
    ],
    implementationTasks: [
      {
        id: 'TASK-001',
        title: 'Persist trades',
        requirementRefs: ['MUST-FR-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        targetPaths: ['src/trades.ts'],
      },
      {
        id: 'TASK-002',
        title: 'Key trades',
        requirementRefs: ['MUST-FR-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        targetPaths: ['src/trades.ts'],
      },
    ],
    mustExecutionDecompositionMatrix: [
      { id: 'MDM-001', mustRef: 'MUST-FR-001', atomicTaskRefs: ['TASK-001', 'TASK-002'] },
    ],
    mustToAtomicTaskMap: { 'MUST-FR-001': ['TASK-001', 'TASK-002'] },
    atomicTaskToTraceMap: { 'TASK-001': ['TRACE-001'], 'TASK-002': ['TRACE-001'] },
    atomicTaskToEvidenceMap: { 'TASK-001': ['EVD-001'], 'TASK-002': ['EVD-001'] },
    atomicTaskToAcceptanceMap: {
      'TASK-001': ['ACC-001', 'E2E-001'],
      'TASK-002': ['ACC-001', 'E2E-001'],
    },
    atomicTaskToTargetPathMap: { 'TASK-001': ['TARGET-001'], 'TASK-002': ['TARGET-001'] },
    atomicTaskToCommandMap: { 'TASK-001': ['CMD-001'], 'TASK-002': ['CMD-001'] },
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-FR-001'],
        taskRefs: ['TASK-001', 'TASK-002'],
        perMustAssertions: { 'MUST-FR-001': 'Prove each trade.' },
      },
    ],
    evidence: [
      {
        id: 'EVD-001',
        covers: ['MUST-FR-001'],
        perMustAssertions: { 'MUST-FR-001': 'Trade proof.' },
        perMustOracles: { 'MUST-FR-001': 'MUST-FR-001 closes through TRACE-001.' },
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-001',
        covers: ['MUST-FR-001'],
        perMustAssertions: { 'MUST-FR-001': 'Trade test.' },
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        covers: ['MUST-FR-001'],
        perMustAssertions: { 'MUST-FR-001': 'Trade journey.' },
      },
    ],
    targetModificationPaths: [
      {
        id: 'TARGET-001',
        path: 'src/trades.ts',
        requirementRefs: ['MUST-FR-001'],
        perMustRows: [{ mustRef: 'MUST-FR-001', responsibility: 'Own trade persistence.' }],
        perMustResponsibilities: { 'MUST-FR-001': 'MUST-FR-001 owns trade persistence.' },
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'npm test',
        perMustRows: [{ mustRef: 'MUST-FR-001', assertion: 'Test trade persistence.' }],
      },
    ],
    aiTddContractExecutionManifestProjection: {
      atomicImplementationTaskLineage: {
        mustToAtomicTaskMap: { 'MUST-FR-001': ['TASK-001', 'TASK-002'] },
      },
    },
  };
}

const split = {
  sourceMustRef: 'MUST-FR-001',
  sourceMustText: 'Persist each trade fact. Use scope and trade ID as the unique key.',
  replacements: [
    { mustId: 'MUST-FR-001', text: 'Persist each trade fact.' },
    { mustId: 'MUST-FR-002', text: 'Use scope and trade ID as the unique key.' },
  ],
};

describe('controlled split MUST projection rebinding', () => {
  it('reassigns existing atoms and their authorized projection refs without creating tasks', () => {
    expect(runtime.rebindSplitMustProjectionMetadata).toBeTypeOf('function');
    const source = confirmation();
    const result = runtime.rebindSplitMustProjectionMetadata(source, split);
    expect(result.ok, result.reason).toBe(true);
    const next = result.confirmation;
    expect(source.atomicImplementationTaskList[1].derivedFromMustRef).toBe('MUST-FR-001');
    expect(
      next.atomicImplementationTaskList.map((row: any) => [
        row.id,
        row.derivedFromMustRef,
        row.atomicUnitIndex,
        row.atomicUnitCount,
      ])
    ).toEqual([
      ['TASK-001', 'MUST-FR-001', 1, 1],
      ['TASK-002', 'MUST-FR-002', 1, 1],
    ]);
    expect(next.implementationTasks.map((row: any) => [row.id, row.requirementRefs])).toEqual([
      ['TASK-001', ['MUST-FR-001']],
      ['TASK-002', ['MUST-FR-002']],
    ]);
    expect(
      next.mustExecutionDecompositionMatrix.map((row: any) => [row.mustRef, row.atomicTaskRefs])
    ).toEqual([
      ['MUST-FR-001', ['TASK-001']],
      ['MUST-FR-002', ['TASK-002']],
    ]);
    expect(next.mustToAtomicTaskMap).toEqual({
      'MUST-FR-001': ['TASK-001'],
      'MUST-FR-002': ['TASK-002'],
    });
    expect(
      next.aiTddContractExecutionManifestProjection.atomicImplementationTaskLineage
        .mustToAtomicTaskMap
    ).toEqual(next.mustToAtomicTaskMap);
    for (const field of ['traceRows', 'evidence', 'acceptanceTests', 'e2eSuites']) {
      expect(next[field][0].covers).toEqual(['MUST-FR-001', 'MUST-FR-002']);
    }
    expect(next.targetModificationPaths[0].perMustRows.map((row: any) => row.mustRef)).toEqual([
      'MUST-FR-001',
      'MUST-FR-002',
    ]);
    expect(next.evidence[0].perMustOracles['MUST-FR-002']).toEqual(
      expect.stringContaining('MUST-FR-002')
    );
    expect(next.targetModificationPaths[0].perMustResponsibilities['MUST-FR-002']).toEqual(
      expect.stringContaining('MUST-FR-002')
    );
    expect(next.requiredCommands[0].perMustRows.map((row: any) => row.mustRef)).toEqual([
      'MUST-FR-001',
      'MUST-FR-002',
    ]);
  });

  it('blocks ambiguous or incomplete old task authority without modifying source metadata', () => {
    const source = confirmation();
    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = ['Persist each trade fact.'];
    const before = structuredClone(source);
    expect(runtime.rebindSplitMustProjectionMetadata(source, split)).toMatchObject({ ok: false });
    expect(source).toEqual(before);
    source.atomicImplementationTaskList.pop();
    expect(runtime.rebindSplitMustProjectionMetadata(source, split)).toMatchObject({ ok: false });
    const missingCommand = confirmation();
    missingCommand.atomicTaskToCommandMap['TASK-002'] = ['CMD-MISSING'];
    const beforeMissingCommand = structuredClone(missingCommand);
    expect(runtime.rebindSplitMustProjectionMetadata(missingCommand, split)).toMatchObject({
      ok: false,
    });
    expect(missingCommand).toEqual(beforeMissingCommand);
  });

  it('rejects a similar oracle when the split changes a numeric contract', () => {
    const source = confirmation();
    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Use scope and trade ID as the unique key within 100 ms.',
    ];
    source.must[1].text = 'Use scope and trade ID as the unique key within 500 ms.';
    const numericSplit = {
      ...split,
      replacements: [split.replacements[0], { mustId: 'MUST-FR-002', text: source.must[1].text }],
    };
    expect(runtime.rebindSplitMustProjectionMetadata(source, numericSplit)).toMatchObject({
      ok: false,
    });
    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Move the balance by -100 cents after settlement.',
    ];
    source.must[1].text = 'Move the balance by 100 cents after settlement.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, {
        ...split,
        replacements: [split.replacements[0], { mustId: 'MUST-FR-002', text: source.must[1].text }],
      })
    ).toMatchObject({ ok: false });
  });

  it('rejects changed lowercase code states and an omitted no-negation', () => {
    const source = confirmation();
    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Trade mode must remain `active` for the current context.',
    ];
    source.must[1].text = 'Trade mode must remain `paused` for the current context.';
    const replacement = (text: string) => ({
      ...split,
      replacements: [split.replacements[0], { mustId: 'MUST-FR-002', text }],
    });
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });

    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Keep the draft value for the current trade.',
    ];
    source.must[1].text = 'Keep the final value for the current trade.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });

    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Trade mode must remain active for the current context.',
    ];
    source.must[1].text = 'Trade mode must remain paused for the current context.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });

    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Trade mode has no cached pending state in the current context.',
    ];
    source.must[1].text = 'Trade mode has cached pending state in the current context.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });

    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'The service must not allow data exchange when external consent is missing.',
    ];
    source.must[1].text =
      'The service must allow data exchange when external consent is not missing.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });

    source.atomicImplementationTaskList[1].primaryAcceptanceOracles = [
      'Do not (allow A or B) after approval.',
    ];
    source.must[1].text = 'Do (not allow A) or B after approval.';
    expect(
      runtime.rebindSplitMustProjectionMetadata(source, replacement(source.must[1].text))
    ).toMatchObject({ ok: false });
  });

  it('does not promote an unrelated trace referenced by a corrupted task map', () => {
    const source = confirmation();
    source.must.push({ id: 'MUST-FR-003', text: 'Keep unrelated accounts isolated.' });
    source.traceRows.push({
      id: 'TRACE-FOREIGN',
      covers: ['MUST-FR-003'],
      taskRefs: ['TASK-FOREIGN'],
      perMustAssertions: { 'MUST-FR-003': 'Account isolation.' },
    });
    source.atomicTaskToTraceMap['TASK-002'] = ['TRACE-FOREIGN'];
    const before = structuredClone(source);
    expect(runtime.rebindSplitMustProjectionMetadata(source, split)).toMatchObject({ ok: false });
    expect(source).toEqual(before);
  });
});
