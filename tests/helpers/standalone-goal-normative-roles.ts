import type { StandaloneGoalSemanticInput } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';

export function normativeRoleInput(): StandaloneGoalSemanticInput {
  const sourceObligations = [
    { id: 'MUST-001', exactText: 'Implement export.', requiredOutcome: 'Export matches the frozen CSV.',
      normativeStrength: 'must', polarity: 'required', executionRole: 'action' },
    { id: 'NEG-001', exactText: 'Do not modify legacy data.', normativeStrength: 'must',
      polarity: 'forbidden', executionRole: 'boundary' },
    { id: 'GUIDE-001', exactText: 'A local cache should be considered.', normativeStrength: 'should',
      polarity: 'required', executionRole: 'guidance' },
    { id: 'PERMIT-001', exactText: 'A cache may be used after explicit selection.', normativeStrength: 'may',
      polarity: 'permitted', executionRole: 'guidance' },
  ].map((row) => ({ ...row, specSpanRefs: [`SPAN-${row.id}`], conditions: [],
    applicability: { scope: 'global', sourceRefs: [`SPAN-${row.id}`] } }));
  return { sourcePlanHash: `sha256:${'1'.repeat(64)}`, sourceSnapshotHash: `sha256:${'2'.repeat(64)}`,
    sourceObligations, logicalSpecSpans: sourceObligations.map((row) => ({ specSpanId: row.specSpanRefs[0],
      boundObligationIds: [row.id], evidenceClaimRefs: [] })),
    technicalSnapshot: { targetPaths: ['src/export.ts'],
      commandRecords: [{ commandId: 'CMD-export', invocation: 'npm test -- export' }],
      artifactRecords: [{ artifactId: 'ART-export', logicalPath: 'out/export.json' }],
      evidenceRecords: [{ evidenceContractId: 'EVDREQ-export', requirement: 'CSV oracle comparison output' }],
      forbiddenPaths: ['legacy/**'], isolationMode: 'consumer_worktree',
      constraintBindings: ['PATH-standalone-1', 'CMD-export', 'ART-export', 'EVDREQ-export', 'STOP-standalone-1']
        .map((constraintId) => { const id = constraintId.startsWith('STOP') ? 'NEG-001' : 'MUST-001';
          return { constraintId, sourceRefs: [`SPAN-${id}`], applicableMustRefs: [id],
            applicableAtomRefs: id === 'NEG-001' ? [] : [`${id}-A1`], premiseRefs: [`SPAN-${id}`],
            scope: id === 'NEG-001' ? 'global' : 'declared' }; }),
    } };
}
