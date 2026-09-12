import { describe, expect, it } from 'vitest';
import { standaloneTechnicalSnapshot } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-technical-snapshot';

function fixture() {
  const sourceObligations = [
    { id: 'WORK-01', kind: 'declared_execution_task', exactText: 'Implement export without modifying `legacy/input.csv`.',
      sourceBlockRefs: ['BLOCK-task'], specSpanRefs: ['SPAN-task'] },
    { id: 'SRC-path', kind: 'positive', exactText: 'Owned paths: `src/export.ts`',
      sourceBlockRefs: ['BLOCK-path'], specSpanRefs: ['SPAN-path'] },
    { id: 'SRC-command', kind: 'verification_command', exactText: 'Required command: `npm test -- export`',
      sourceBlockRefs: ['BLOCK-command'], specSpanRefs: ['SPAN-command'] },
    { id: 'SRC-evidence', kind: 'evidence', exactText: 'Evidence: export output matches the frozen CSV oracle.',
      sourceBlockRefs: ['BLOCK-evidence'], specSpanRefs: ['SPAN-evidence'] },
  ];
  const sourceRef = { sourceSnapshotHash: `sha256:${'1'.repeat(64)}`, startByte: 12, endByteExclusive: 34,
    exactTextHash: `sha256:${'2'.repeat(64)}` };
  const sourceBlocks = sourceObligations.map((row) => ({ id: row.sourceBlockRefs[0], text: row.exactText,
    sourceRef, fieldRole: row.kind === 'evidence' ? 'evidence' : null,
    scope: { kind: 'task', ownerId: 'WORK-01' },
    commandDeclarations: row.kind === 'verification_command' ? [{ id: 'CMD-export',
      invocation: 'npm test -- export', sourceRef, executionStatus: 'source_declared_not_executed' }] : [] }));
  const sourceRelations = [
    { kind: 'path', fromType: 'obligation', fromId: 'WORK-01', toType: 'path', toId: 'src/export.ts',
      pathRole: 'owned', sourceBlockRefs: ['BLOCK-path'], declarationStatus: 'source_declared' },
    { kind: 'path', fromType: 'obligation', fromId: 'WORK-01', toType: 'path', toId: 'legacy/input.csv',
      pathRole: 'forbidden', sourceBlockRefs: ['BLOCK-task'], declarationStatus: 'source_declared' },
    { kind: 'command', fromType: 'obligation', fromId: 'WORK-01', toType: 'command_declaration', toId: 'CMD-export',
      sourceBlockRefs: ['BLOCK-command'], declarationStatus: 'source_declared' },
  ];
  return { source: { sourceObligations, sourceBlocks, sourceRelations }, semanticRows: sourceObligations };
}

describe('standalone source-to-technical provenance', () => {
  it('uses explicit path roles, not arbitrary inline filenames or a fixed forbidden path', () => {
    const { source, semanticRows } = fixture();
    const technical = standaloneTechnicalSnapshot(source, semanticRows);
    expect(technical.targetPaths).toEqual(['src/export.ts']);
    expect(technical.forbiddenPaths).toEqual(['legacy/input.csv']);
    expect(technical.artifactRecords).toEqual([]);
  });

  it('preserves the exact declared command rather than executing its prose label', () => {
    const { source, semanticRows } = fixture();
    expect(standaloneTechnicalSnapshot(source, semanticRows).commandRecords).toMatchObject([
      { commandId: 'CMD-export', invocation: 'npm test -- export' },
    ]);
  });

  it('preserves the actual evidence oracle without manufacturing observed execution', () => {
    const { source, semanticRows } = fixture();
    expect(standaloneTechnicalSnapshot(source, semanticRows).evidenceRecords).toMatchObject([
      { requirement: 'Evidence: export output matches the frozen CSV oracle.' },
    ]);
  });

  it('binds technical declarations only to their source owner and declaring obligation', () => {
    const { source, semanticRows } = fixture();
    const technical = standaloneTechnicalSnapshot(source, semanticRows) as Record<string, unknown>;
    expect(technical.constraintBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ constraintId: 'CMD-export', applicableMustRefs: ['SRC-command', 'WORK-01'],
        sourceRefs: ['SPAN-command'], premiseRefs: ['SPAN-command'] }),
    ]));
  });

  it('rejects missing source registries instead of guessing a technically complete authority', () => {
    const { source, semanticRows } = fixture();
    expect(() => standaloneTechnicalSnapshot({ sourceObligations: source.sourceObligations }, semanticRows))
      .toThrow('standalone_goal_source_provenance_missing');
  });

  it('does not erase source-declared artifacts', () => {
    const { source, semanticRows } = fixture();
    source.sourceRelations.push({ kind: 'path', fromType: 'obligation', fromId: 'WORK-01', toType: 'path',
      toId: 'proof/export.json', pathRole: 'artifact', sourceBlockRefs: ['BLOCK-evidence'], declarationStatus: 'source_declared' });
    expect(standaloneTechnicalSnapshot(source, semanticRows).artifactRecords).toMatchObject([
      { logicalPath: 'proof/export.json' },
    ]);
  });
});
