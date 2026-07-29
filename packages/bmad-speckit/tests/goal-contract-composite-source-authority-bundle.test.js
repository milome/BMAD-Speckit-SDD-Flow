const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  compileSourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  compileCompositeSourceAuthorityBundle,
  verifyCompositeSourceAuthorityBundle,
} = require('../src/utils/goal-contract/control-plane/composite-source-authority-bundle.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  authorityRecord,
  readFixtureMetadata,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

function bcrBinding() {
  return subordinateBinding();
}

function policy() {
  const requiredSubordinateBindings = [bcrBinding()];
  return compileSourceCompositionPolicy({
    authorityRecord: authorityRecord(
      'composite_required',
      requiredSubordinateBindings,
      hashControlPlaneValue
    ),
  });
}

function singlePolicy() {
  return compileSourceCompositionPolicy({
    authorityRecord: authorityRecord(
      'single_source',
      [],
      hashControlPlaneValue
    ),
  });
}

function singleSnapshotSet() {
  const fixture = readFixtureMetadata();
  return compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: fixture.primarySourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: fixture.primaryNamespace,
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/primary-authority.md',
        rawBytes: Buffer.from('# Primary authority\n', 'utf8'),
      },
    ],
  });
}

function snapshotSet() {
  const fixture = readFixtureMetadata();
  const subordinateLines = [
    ...fixture.requirementIds,
    ...fixture.taskIds,
  ].map((id) => `- ${id}`);
  const primaryReferences = [
    fixture.parentTaskRefs[0],
    fixture.requirementIds[0],
    fixture.taskIds[0],
  ];
  return compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: fixture.sourceArtifactId,
        sourceRole: 'subordinate_component_specification',
        namespace: fixture.namespace,
        sourceOrder: 1,
        pathOrSegmentId: 'docs/plans/bounded-code-reviewer.md',
        rawBytes: Buffer.from(`# BCR\n${subordinateLines.join('\n')}\n`, 'utf8'),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: fixture.primarySourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: fixture.primaryNamespace,
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/judge-role-separation.md',
        rawBytes: Buffer.from(
          `# Judge\n- ${primaryReferences.join(' references ')}\n`,
          'utf8'
        ),
      },
    ],
  });
}

function descriptors() {
  const fixture = readFixtureMetadata();
  return {
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceArtifactId: fixture.primarySourceArtifactId,
      ownedSemanticDomains: ['Campaign scope', 'Final Judge', 'EffectivePass'],
      parentTaskRefs: [],
    },
    subordinateSources: [
      {
        ...bcrBinding(),
        ownedSemanticDomains: [
          'Reviewer prompt',
          'Reviewer output schema',
          'native carriers',
        ],
      },
    ],
  };
}

function expectFailure(action, failureClass) {
  assert.throws(action, (error) => error.failureClass === failureClass);
}

describe('goal-contract composite source authority bundle', () => {
  it('compiles single_source only with an empty subordinate set', () => {
    const fixture = readFixtureMetadata();
    const single = compileCompositeSourceAuthorityBundle({
      sourceCompositionPolicy: singlePolicy(),
      orderedSourceSnapshotSet: singleSnapshotSet(),
      primarySource: {
        role: 'primary_implementation_authority',
        namespace: fixture.primaryNamespace,
        sourceArtifactId: fixture.primarySourceArtifactId,
        parentTaskRefs: [],
        ownedSemanticDomains: ['Campaign scope'],
      },
      subordinateSources: [],
    });

    assert.deepEqual(single.subordinateSources, []);
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          sourceCompositionPolicy: singlePolicy(),
          orderedSourceSnapshotSet: snapshotSet(),
          ...descriptors(),
        }),
      'source_composition_policy_mismatch'
    );
  });

  it('binds ordered primary and subordinate sources with subordinate coverage', () => {
    const bundle = compileCompositeSourceAuthorityBundle({
      sourceCompositionPolicy: policy(),
      orderedSourceSnapshotSet: snapshotSet(),
      ...descriptors(),
    });

    const fixture = readFixtureMetadata();
    assert.equal(bundle.primarySource.namespace, fixture.primaryNamespace);
    assert.equal(bundle.subordinateSources[0].namespace, fixture.namespace);
    assert.equal(bundle.conflictPolicy, 'fail_closed');
    assert.equal(bundle.subordinateCoverage.unmappedRequirementCount, 0);
    assert.equal(bundle.subordinateCoverage.unmappedTaskCount, 0);
    assert.match(bundle.sourceAuthorityBundleHash, /^sha256:[0-9a-f]{64}$/u);
    assert.deepEqual(verifyCompositeSourceAuthorityBundle(bundle), bundle);
  });

  it('rejects missing, stale, extra, and namespace-conflicting sources', () => {
    const base = {
      sourceCompositionPolicy: policy(),
      orderedSourceSnapshotSet: snapshotSet(),
      ...descriptors(),
    };
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          orderedSourceSnapshotSet: base.orderedSourceSnapshotSet,
          primarySource: base.primarySource,
          subordinateSources: base.subordinateSources,
        }),
      'source_composition_policy_missing'
    );
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          ...base,
          subordinateSources: [],
        }),
      'subordinate_source_missing'
    );
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          ...base,
          subordinateSources: [
            {
              ...base.subordinateSources[0],
              namespace: base.primarySource.namespace,
            },
          ],
        }),
      'subordinate_scope_escape'
    );
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          ...base,
          subordinateSources: [
            {
              ...base.subordinateSources[0],
              sourceSnapshotHash: 'sha256:' + '1'.repeat(64),
            },
          ],
        }),
      'subordinate_source_stale'
    );
    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          ...base,
          subordinateSources: [
            ...base.subordinateSources,
            {
              ...base.subordinateSources[0],
              sourceArtifactId: 'extra-component',
              namespace: 'EXTRA',
            },
          ],
        }),
      'source_composition_policy_mismatch'
    );
  });

  it('classifies frozen subordinate identity and scope mutations consistently', () => {
    const base = {
      sourceCompositionPolicy: policy(),
      orderedSourceSnapshotSet: snapshotSet(),
      ...descriptors(),
    };
    const descriptor = base.subordinateSources[0];
    const cases = [
      {
        field: 'role',
        value: 'primary_implementation_authority',
        failureClass: 'subordinate_source_stale',
      },
      {
        field: 'sourceArtifactId',
        value: `${descriptor.sourceArtifactId}-replacement`,
        failureClass: 'subordinate_source_stale',
      },
      {
        field: 'pathOrSegmentId',
        value: 'docs/plans/replaced-component.md',
        failureClass: 'subordinate_source_stale',
      },
      {
        field: 'sourceSnapshotHash',
        value: 'sha256:' + '1'.repeat(64),
        failureClass: 'subordinate_source_stale',
      },
      {
        field: 'namespace',
        value: `${descriptor.namespace}_REPLACEMENT`,
        failureClass: 'subordinate_scope_escape',
      },
      {
        field: 'parentTaskRefs',
        value: [...descriptor.parentTaskRefs, 'OTHER-PARENT'],
        failureClass: 'subordinate_scope_escape',
      },
    ];

    for (const mutation of cases) {
      expectFailure(
        () =>
          compileCompositeSourceAuthorityBundle({
            ...base,
            subordinateSources: [
              {
                ...descriptor,
                [mutation.field]: mutation.value,
              },
            ],
          }),
        mutation.failureClass
      );
    }

    expectFailure(
      () =>
        compileCompositeSourceAuthorityBundle({
          ...base,
          subordinateSources: [
            {
              ...descriptor,
              ownedSemanticDomains: [
                ...descriptor.ownedSemanticDomains,
                base.primarySource.ownedSemanticDomains[0],
              ],
            },
          ],
        }),
      'subordinate_scope_escape'
    );
  });

  it('keeps equivalent descriptor permutations byte-identical', () => {
    const base = {
      sourceCompositionPolicy: policy(),
      orderedSourceSnapshotSet: snapshotSet(),
      ...descriptors(),
    };
    const first = compileCompositeSourceAuthorityBundle(base);
    const second = compileCompositeSourceAuthorityBundle({
      ...base,
      primarySource: {
        ...base.primarySource,
        ownedSemanticDomains: ['Final Judge', 'Campaign scope', 'EffectivePass'],
      },
      subordinateSources: [
        {
          ...base.subordinateSources[0],
          requiredRequirementIds: [
            ...base.subordinateSources[0].requiredRequirementIds,
          ].reverse(),
          requiredTaskIds: [
            ...base.subordinateSources[0].requiredTaskIds,
          ].reverse(),
          parentTaskRefs: [
            ...base.subordinateSources[0].parentTaskRefs,
          ].reverse(),
          ownedSemanticDomains: [
            'native carriers',
            'Reviewer output schema',
            'Reviewer prompt',
          ],
        },
      ],
    });
    assert.equal(first.sourceAuthorityBundleHash, second.sourceAuthorityBundleHash);
    assert.deepEqual(first, second);
  });
});
