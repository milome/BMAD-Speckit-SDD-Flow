const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  compileTaskFileScopeAuthority,
  validateTaskFileScopeCells,
} = require('../src/utils/goal-contract/control-plane/partition-compiler.ts');

function snapshotSet(source) {
  return compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: 'primary-source',
        sourceRole: 'primary_implementation_authority',
        namespace: 'PRIMARY',
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/source.md',
        rawBytes: Buffer.from(source, 'utf8'),
      },
    ],
  });
}

describe('goal-contract task file-scope authority', () => {
  it('accepts repository paths, declared classes, and the no-files sentinel', () => {
    const result = validateTaskFileScopeCells({
      taskId: 'GH-T05',
      declaredPathFamilies: ['goal-contract-runtime'],
      declaredGeneratedSurfaceClasses: ['host-projections'],
      cells: [
        {
          fieldName: 'Files',
          tokens: [
            'packages/bmad-speckit/src/commands/goal-contract.ts',
            'package.json',
            'goal-contract-runtime',
            'host-projections',
          ],
        },
        {
          fieldName: 'Modify',
          tokens: ['_bmad/shared/goal-contract'],
        },
      ],
    });

    assert.equal(result.decision, 'pass');
    assert.deepEqual(result.normalizedCells[0].tokens, [
      'goal-contract-runtime',
      'host-projections',
      'package.json',
      'packages/bmad-speckit/src/commands/goal-contract.ts',
    ]);
    assert.equal(
      validateTaskFileScopeCells({
        taskId: 'GH-T11',
        cells: [{ fieldName: 'Files', tokens: ['No production files'] }],
      }).decision,
      'pass'
    );
  });

  it('rejects task IDs, prose, escapes, absolute paths, and wildcards', () => {
    const cases = [
      ['Files', 'GH-T05'],
      ['Files', 'update all generated surfaces'],
      ['Create', '../escape.ts'],
      ['Modify', 'C:\\temp\\escape.ts'],
      ['Delete', '/etc/passwd'],
      ['Files', '**/*'],
    ];

    for (const [fieldName, offendingToken] of cases) {
      assert.throws(
        () =>
          validateTaskFileScopeCells({
            taskId: 'GH-T05',
            cells: [{ fieldName, tokens: [offendingToken] }],
          }),
        (error) =>
          error.failureClass === 'task_file_scope_invalid' &&
          error.errorCode === 'ER-GH-001' &&
          error.taskId === 'GH-T05' &&
          error.fieldName === fieldName &&
          error.offendingToken === offendingToken &&
          error.substitutePath === undefined
      );
    }
  });

  it('rejects writable paths mixed with the no-files sentinel', () => {
    assert.throws(
      () =>
        validateTaskFileScopeCells({
          taskId: 'GH-T11',
          cells: [
            {
              fieldName: 'Files',
              tokens: [
                'No production files',
                'packages/bmad-speckit/src/index.ts',
              ],
            },
          ],
        }),
      (error) =>
        error.failureClass === 'task_file_scope_invalid' &&
        error.reasonCode === 'no_production_files_mixed' &&
        error.offendingToken === 'No production files'
    );
  });

  it('rejects an invalid path token from verified frozen source bytes', () => {
    const source = [
      '# Source Plan',
      '',
      '### GH-T05: Compile manifest',
      '',
      '**Files**',
      '',
      '- Modify: GH-T05',
      '',
      'Steps: compile the manifest.',
      '',
    ].join('\n');

    assert.throws(
      () =>
        compileTaskFileScopeAuthority({
          orderedSourceSnapshotSet: snapshotSet(source),
          reconciledGraph: {
            tasks: [{ id: 'GH-T05' }],
            traceSlices: [
              {
                goalIds: ['GH-T05'],
                allowedPaths: ['GH-T05'],
              },
            ],
          },
        }),
      (error) =>
        error.failureClass === 'task_file_scope_invalid' &&
        error.taskId === 'GH-T05' &&
        error.fieldName === 'Modify' &&
        error.offendingToken === 'GH-T05' &&
        error.sourceArtifactId === 'primary-source' &&
        error.lineStart === 7
    );
  });
});
