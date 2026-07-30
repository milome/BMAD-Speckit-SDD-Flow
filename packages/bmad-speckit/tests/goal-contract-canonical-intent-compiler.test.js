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
} = require('../src/utils/goal-contract/control-plane/composite-source-authority-bundle.ts');
const {
  compileIntentAuthorityEnvelope,
} = require('../src/utils/goal-contract/control-plane/intent-authority.ts');
const {
  compileCanonicalIntent,
  verifyCanonicalIntentBundle,
} = require('../src/utils/goal-contract/control-plane/canonical-intent-compiler.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  authorityRecord,
  readFixtureMetadata,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

function binding(overrides = {}) {
  return subordinateBinding(overrides);
}

function rehashCanonicalBundle(bundle) {
  const rehashed = structuredClone(bundle);
  rehashed.sourceObligationGraphHash = hashControlPlaneValue(rehashed.sourceObligationGraph);
  rehashed.canonicalIntentSemanticHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-canonical-intent-semantics/v1',
    sourceCompositionPolicyHash: rehashed.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: rehashed.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: rehashed.sourceAuthorityBundleHash,
    canonicalIntentIR: rehashed.canonicalIntentIR,
    specSpanRegistryHash: rehashed.specSpanRegistry.specSpanRegistryHash,
    sourceObligationGraphHash: rehashed.sourceObligationGraphHash,
    subordinateCoverage: rehashed.subordinateCoverage,
  });
  const bundlePayload = { ...rehashed };
  delete bundlePayload.canonicalIntentBundleHash;
  rehashed.canonicalIntentBundleHash = hashControlPlaneValue(bundlePayload);
  return rehashed;
}

function buildInputs({
  bindingOverrides = {},
  primaryAdditionalLines = [],
  reverseSources = false,
  subordinateAdditionalLines = [],
  subordinateOwnedSemanticDomains = ['Reviewer prompt', 'native carriers'],
  subordinatePathOrSegmentId,
  windowsPaths = false,
} = {}) {
  const fixture = readFixtureMetadata();
  const requiredSubordinateBinding = binding(bindingOverrides);
  const requiredSubordinateBindings = [requiredSubordinateBinding];
  const policy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord(
      'composite_required',
      requiredSubordinateBindings,
      hashControlPlaneValue
    ),
  });
  const subordinateLines = [
    ...requiredSubordinateBinding.requiredRequirementIds,
    ...requiredSubordinateBinding.requiredTaskIds,
  ].map((id) => `- ${id}: MUST preserve ${id}.`);
  const primaryReferences = [
    requiredSubordinateBinding.parentTaskRefs[0],
    requiredSubordinateBinding.requiredRequirementIds[0],
    requiredSubordinateBinding.requiredTaskIds[0],
  ];
  const primaryLines = [
    `# ${fixture.primaryNamespace}`,
    `## ${primaryReferences[0]}`,
    `- ${primaryReferences.join(' references ')}`,
    ...primaryAdditionalLines,
    '- MUST preserve canonical source authority.',
    `- MUST NOT expand ${fixture.namespace} ownership.`,
    '## Deterministic NOT DONE',
    '- Sequence producer remains excluded.',
    '## Completion Evidence',
    '- Evidence receipt MUST exist.',
    '## Dependencies',
    `- Dependencies: ${primaryReferences[0]}.`,
    '## Applicability',
    '- Applicability: core-only when sequence mode is disabled.',
  ];
  const sources = [
    {
      sourceKind: 'source_plan',
      sourceArtifactId: fixture.primarySourceArtifactId,
      sourceRole: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceOrder: 0,
      pathOrSegmentId: windowsPaths
        ? 'docs\\plans\\judge-role-separation.md'
        : 'docs/plans/judge-role-separation.md',
      rawBytes: Buffer.from(`${primaryLines.join('\n')}\n`, 'utf8'),
    },
    {
      sourceKind: 'source_plan',
      sourceArtifactId: requiredSubordinateBinding.sourceArtifactId,
      sourceRole: requiredSubordinateBinding.role,
      namespace: requiredSubordinateBinding.namespace,
      sourceOrder: 1,
      pathOrSegmentId:
        subordinatePathOrSegmentId ??
        (windowsPaths
          ? 'docs\\plans\\bounded-code-reviewer.md'
          : 'docs/plans/bounded-code-reviewer.md'),
      rawBytes: Buffer.from(
        `# ${fixture.namespace}\n${[...subordinateLines, ...subordinateAdditionalLines].join(
          '\n'
        )}\n`,
        'utf8'
      ),
    },
  ];
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources: reverseSources ? [...sources].reverse() : sources,
  });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({
    sourceCompositionPolicy: policy,
    orderedSourceSnapshotSet,
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceArtifactId: fixture.primarySourceArtifactId,
      ownedSemanticDomains: ['Final Judge', 'Campaign scope'],
      parentTaskRefs: [],
    },
    subordinateSources: [
      {
        ...requiredSubordinateBinding,
        ownedSemanticDomains: subordinateOwnedSemanticDomains,
      },
    ],
  });
  const subject = {
    sourceSnapshotHash: orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
    canonicalIntentSemanticHash: 'sha256:' + '0'.repeat(64),
    specSpanRegistryHash: 'sha256:' + '0'.repeat(64),
  };
  return {
    policy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    subject,
  };
}

function buildAmbiguousCrossSourceInputs() {
  const sharedReferenceId = 'SHARED-REFERENCE';
  const bindings = [
    {
      role: 'subordinate_component_specification',
      namespace: 'COMPONENT_ONE',
      sourceArtifactId: 'component-one',
      parentTaskRefs: ['PARENT-ONE'],
      requiredRequirementIds: ['COMPONENT-ONE-REQ'],
      requiredTaskIds: ['COMPONENT-ONE-TASK'],
    },
    {
      role: 'subordinate_component_specification',
      namespace: 'COMPONENT_TWO',
      sourceArtifactId: 'component-two',
      parentTaskRefs: ['PARENT-TWO'],
      requiredRequirementIds: ['COMPONENT-TWO-REQ'],
      requiredTaskIds: ['COMPONENT-TWO-TASK'],
    },
  ];
  const policy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord('composite_required', bindings, hashControlPlaneValue),
  });
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: 'primary-authority',
        sourceRole: 'primary_implementation_authority',
        namespace: 'PRIMARY',
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/primary-authority.md',
        rawBytes: Buffer.from(
          `# Primary\n## PARENT-ONE PARENT-TWO\n- ${sharedReferenceId} is consumed here.\n`,
          'utf8'
        ),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: bindings[0].sourceArtifactId,
        sourceRole: bindings[0].role,
        namespace: bindings[0].namespace,
        sourceOrder: 1,
        pathOrSegmentId: 'docs/plans/component-one.md',
        rawBytes: Buffer.from(
          [
            '# Component One',
            '- COMPONENT-ONE-REQ: MUST create the first requirement.',
            '- COMPONENT-ONE-TASK: MUST verify the first task.',
            `- ${sharedReferenceId}: MUST create the shared record.`,
            '',
          ].join('\n'),
          'utf8'
        ),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: bindings[1].sourceArtifactId,
        sourceRole: bindings[1].role,
        namespace: bindings[1].namespace,
        sourceOrder: 2,
        pathOrSegmentId: 'docs/plans/component-two.md',
        rawBytes: Buffer.from(
          [
            '# Component Two',
            '- COMPONENT-TWO-REQ: MUST create the second requirement.',
            '- COMPONENT-TWO-TASK: MUST verify the second task.',
            `- ${sharedReferenceId}: MUST verify the shared record.`,
            '',
          ].join('\n'),
          'utf8'
        ),
      },
    ],
  });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({
    sourceCompositionPolicy: policy,
    orderedSourceSnapshotSet,
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: 'PRIMARY',
      sourceArtifactId: 'primary-authority',
      parentTaskRefs: [],
      ownedSemanticDomains: ['Campaign scope'],
    },
    subordinateSources: bindings.map((binding, index) => ({
      ...binding,
      ownedSemanticDomains: [`Component domain ${index + 1}`],
    })),
  });
  return {
    compositeSourceAuthorityBundle,
    orderedSourceSnapshotSet,
    policy,
  };
}

describe('goal-contract canonical intent compiler', () => {
  it('compiles one namespaced intent, graph, registry, and coverage bundle', () => {
    const input = buildInputs();
    const candidate = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const intentAuthorityEnvelope = compileIntentAuthorityEnvelope({
      subject: {
        ...input.subject,
        canonicalIntentSemanticHash: candidate.canonicalIntentSemanticHash,
        specSpanRegistryHash: candidate.specSpanRegistry.specSpanRegistryHash,
      },
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityBasis: {
        kind: 'direct_source_declaration',
        sourceDeclarationHash: 'sha256:' + '1'.repeat(64),
        declaringUserAuthorityIdentity: 'user:planner',
        entryScenario: 'standalone_goal_contract',
      },
    });
    const authoritative = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      intentAuthorityEnvelope,
      authorityState: 'authoritative',
    });

    assert.equal(authoritative.canonicalIntentIR.length > 0, true);
    assert.equal(authoritative.sourceObligationGraph.obligations.length > 0, true);
    assert.equal(authoritative.canonicalIntentSemanticHash, candidate.canonicalIntentSemanticHash);
    assert.equal(
      authoritative.specSpanRegistry.specSpanRegistryHash,
      authoritative.sourceObligationGraph.specSpanRegistryHash
    );
    assert.equal(Object.hasOwn(candidate, 'intentAuthorityEnvelope'), false);
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: input.policy,
          orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
          intentAuthorityEnvelope,
          authorityState: 'candidate_only',
        }),
      (error) => error.failureClass === 'authority_state_mismatch'
    );
    assert.equal(
      authoritative.intentAuthorityEnvelope.authorityAttestationHash,
      authoritative.authorityAttestationHash
    );
    assert.ok(
      authoritative.compilerIdentity.schemaArtifactHashes.some(
        ({ schemaName }) => schemaName === 'goal-contract-canonical-intent-bundle.schema.json'
      )
    );
    assert.ok(
      authoritative.canonicalIntentIR.every(
        (record) =>
          record.namespace &&
          record.sourceArtifactId &&
          record.specSpanRefs.length > 0 &&
          record.semanticOwnershipKey
      )
    );
    assert.ok(
      authoritative.sourceObligationGraph.obligations.every(
        (record) => record.specSpanRefs.length > 0
      )
    );
    assert.deepEqual(verifyCanonicalIntentBundle(authoritative), authoritative);
  });

  it('classifies deterministic records and keeps parent references non-owning', () => {
    const input = buildInputs();
    const result = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const classifications = new Set(
      result.canonicalIntentIR.map(({ classification }) => classification)
    );
    for (const expected of [
      'positive',
      'negative',
      'boundary',
      'evidence',
      'dependency',
      'applicability',
    ]) {
      assert.equal(classifications.has(expected), true, expected);
    }

    const fixture = readFixtureMetadata();
    for (const targetId of [fixture.requirementIds[0], fixture.taskIds[0]]) {
      const references = result.canonicalIntentIR.filter(
        (record) =>
          record.ownership === 'cross_source_reference' && record.referenceTargetId === targetId
      );
      const owners = result.canonicalIntentIR.filter(
        (record) => record.ownership === 'owned_obligation' && record.declaredSourceId === targetId
      );
      assert.equal(references.length, 1);
      assert.equal(owners.length, 1);
      assert.equal(references[0].sourceRole, 'primary_implementation_authority');
      assert.equal(owners[0].sourceRole, 'subordinate_component_specification');
    }
  });

  it('retains repeated structural quote spans as non-owning context', () => {
    const input = buildInputs({
      primaryAdditionalLines: ['>', '>'],
    });
    const result = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const contextRecords = result.canonicalIntentIR.filter(
      (record) => record.classification === 'context'
    );

    assert.equal(contextRecords.length, 2);
    assert.equal(
      contextRecords.every((record) => record.specSpanRefs.length === 1),
      true
    );
    assert.equal(new Set(contextRecords.flatMap((record) => record.specSpanRefs)).size, 2);
  });

  it('rejects duplicate and conflicting typed semantic ownership', () => {
    const fixture = readFixtureMetadata();
    const duplicate = buildInputs({
      subordinateAdditionalLines: [
        `- TEST-${fixture.namespace}-SAME-A: MUST preserve readonly carrier semantics.`,
        `- TEST-${fixture.namespace}-SAME-B: MUST preserve readonly carrier semantics.`,
      ],
    });
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: duplicate.policy,
          orderedSourceSnapshotSet: duplicate.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: duplicate.compositeSourceAuthorityBundle,
          authorityState: 'candidate_only',
        }),
      (error) => error.failureClass === 'source_semantic_duplication'
    );

    const conflict = buildInputs({
      subordinateAdditionalLines: [
        `- TEST-${fixture.namespace}-CONFLICT-A: MUST preserve readonly carrier semantics.`,
        `- TEST-${fixture.namespace}-CONFLICT-B: MUST NOT preserve readonly carrier semantics.`,
      ],
    });
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: conflict.policy,
          orderedSourceSnapshotSet: conflict.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: conflict.compositeSourceAuthorityBundle,
          authorityState: 'candidate_only',
        }),
      (error) => error.failureClass === 'source_authority_conflict'
    );
  });

  it('rejects ambiguous cross-source references without guessing an owner', () => {
    const input = buildAmbiguousCrossSourceInputs();

    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: input.policy,
          orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
          authorityState: 'candidate_only',
        }),
      (error) => error.failureClass === 'cross_source_reference_ambiguous'
    );
  });

  it('keeps equivalent source permutations deterministic and forbids projection expansion', () => {
    const input = buildInputs();
    const reorderedInput = buildInputs({ reverseSources: true });
    const windowsPathInput = buildInputs({ windowsPaths: true });
    const first = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const second = compileCanonicalIntent({
      sourceCompositionPolicy: reorderedInput.policy,
      orderedSourceSnapshotSet: reorderedInput.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: reorderedInput.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const windowsPath = compileCanonicalIntent({
      sourceCompositionPolicy: windowsPathInput.policy,
      orderedSourceSnapshotSet: windowsPathInput.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: windowsPathInput.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    assert.equal(first.canonicalIntentSemanticHash, second.canonicalIntentSemanticHash);
    assert.equal(first.canonicalIntentSemanticHash, windowsPath.canonicalIntentSemanticHash);
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: input.policy,
          orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
          authorityState: 'authoritative',
          projectionObligations: [{ id: 'PROJECTION-ONLY' }],
        }),
      (error) => error.failureClass === 'projection_semantic_expansion'
    );
  });

  it('requires authority for activation-capable compilation and rejects stale bindings', () => {
    const input = buildInputs();
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: input.policy,
          orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
          authorityState: 'authoritative',
        }),
      (error) => error.failureClass === 'authority_missing'
    );
    const stale = {
      ...input.compositeSourceAuthorityBundle,
      sourceCompositionPolicyHash: 'sha256:' + 'f'.repeat(64),
    };
    assert.throws(
      () =>
        compileCanonicalIntent({
          sourceCompositionPolicy: input.policy,
          orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
          compositeSourceAuthorityBundle: stale,
          authorityState: 'candidate_only',
        }),
      (error) =>
        error.failureClass === 'source_authority_bundle_hash_mismatch' ||
        error.failureClass === 'source_composition_policy_mismatch'
    );
  });

  it('stales old authority when any subordinate authority input changes', () => {
    const fixture = readFixtureMetadata();
    const baseline = buildInputs();
    const baselineCandidate = compileCanonicalIntent({
      sourceCompositionPolicy: baseline.policy,
      orderedSourceSnapshotSet: baseline.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: baseline.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const baselineEnvelope = compileIntentAuthorityEnvelope({
      subject: {
        ...baseline.subject,
        canonicalIntentSemanticHash: baselineCandidate.canonicalIntentSemanticHash,
        specSpanRegistryHash: baselineCandidate.specSpanRegistry.specSpanRegistryHash,
      },
      compositeSourceAuthorityBundle: baseline.compositeSourceAuthorityBundle,
      authorityBasis: {
        kind: 'direct_source_declaration',
        sourceDeclarationHash: 'sha256:' + '1'.repeat(64),
        declaringUserAuthorityIdentity: 'user:planner',
        entryScenario: 'standalone_goal_contract',
      },
    });
    const mutations = [
      {
        name: 'path',
        options: {
          subordinatePathOrSegmentId: 'docs/plans/rebound-component-specification.md',
        },
      },
      {
        name: 'bytes',
        options: {
          subordinateAdditionalLines: ['- MUST preserve the rebound source bytes.'],
        },
      },
      {
        name: 'source artifact identity',
        options: {
          bindingOverrides: {
            sourceArtifactId: `${fixture.sourceArtifactId}-rebound`,
          },
        },
      },
      {
        name: 'namespace',
        options: {
          bindingOverrides: {
            namespace: `${fixture.namespace}_REBOUND`,
          },
        },
      },
      {
        name: 'ownership',
        options: {
          subordinateOwnedSemanticDomains: ['Reviewer prompt', 'Rebound semantic domain'],
        },
      },
      {
        name: 'parent task binding',
        options: {
          bindingOverrides: {
            parentTaskRefs: [...fixture.parentTaskRefs, 'REBOUND-PARENT-TASK'],
          },
        },
      },
      {
        name: 'required requirement IDs',
        options: {
          bindingOverrides: {
            requiredRequirementIds: [...fixture.requirementIds, 'REBOUND-REQUIREMENT'],
          },
        },
      },
      {
        name: 'required task IDs',
        options: {
          bindingOverrides: {
            requiredTaskIds: [...fixture.taskIds, 'REBOUND-TASK'],
          },
        },
      },
    ];

    for (const mutation of mutations) {
      const changed = buildInputs(mutation.options);
      const changedCandidate = compileCanonicalIntent({
        sourceCompositionPolicy: changed.policy,
        orderedSourceSnapshotSet: changed.orderedSourceSnapshotSet,
        compositeSourceAuthorityBundle: changed.compositeSourceAuthorityBundle,
        authorityState: 'candidate_only',
      });
      assert.notEqual(
        changedCandidate.canonicalIntentSemanticHash,
        baselineCandidate.canonicalIntentSemanticHash,
        `${mutation.name}: ${JSON.stringify({
          policy: [
            baseline.policy.sourceCompositionPolicyHash,
            changed.policy.sourceCompositionPolicyHash,
          ],
          snapshotSet: [
            baseline.orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
            changed.orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
          ],
          authorityBundle: [
            baseline.compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
            changed.compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
          ],
        })}`
      );
      assert.throws(
        () =>
          compileCanonicalIntent({
            sourceCompositionPolicy: changed.policy,
            orderedSourceSnapshotSet: changed.orderedSourceSnapshotSet,
            compositeSourceAuthorityBundle: changed.compositeSourceAuthorityBundle,
            intentAuthorityEnvelope: baselineEnvelope,
            authorityState: 'authoritative',
          }),
        (error) => error.failureClass === 'authority_subject_mismatch',
        mutation.name
      );
    }
  });

  it('rejects a re-signed graph that no longer projects the canonical intent IR', () => {
    const input = buildInputs();
    const candidate = compileCanonicalIntent({
      sourceCompositionPolicy: input.policy,
      orderedSourceSnapshotSet: input.orderedSourceSnapshotSet,
      compositeSourceAuthorityBundle: input.compositeSourceAuthorityBundle,
      authorityState: 'candidate_only',
    });
    const tampered = structuredClone(candidate);
    tampered.sourceObligationGraph.obligations =
      tampered.sourceObligationGraph.obligations.slice(1);

    assert.throws(
      () => verifyCanonicalIntentBundle(rehashCanonicalBundle(tampered)),
      (error) => error.failureClass === 'source_obligation_graph_projection_mismatch'
    );
  });
});
