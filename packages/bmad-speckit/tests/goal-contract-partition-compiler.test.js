const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  compileCanonicalIntent,
} = require('../src/utils/goal-contract/control-plane/canonical-intent-compiler.ts');
const {
  compileCompositeSourceAuthorityBundle,
} = require('../src/utils/goal-contract/control-plane/composite-source-authority-bundle.ts');
const {
  compileGoalContract,
  compileGoalContractPolicy,
  goalContractCompilerIdentity,
} = require('../src/utils/goal-contract/control-plane/goal-contract-compiler.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  compileIntentAuthorityEnvelope,
} = require('../src/utils/goal-contract/control-plane/intent-authority.ts');
const {
  compileSourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  canonicalIdentifierList,
  compilePartitions,
  projectOwnerConsumerRecords,
  projectOwnedArtifactPaths,
  verifyPartitionPlan,
} = require('../src/utils/goal-contract/control-plane/partition-compiler.ts');
const {
  loadPartitionMethodologyProfile,
} = require('../src/utils/goal-contract/partition-methodology-profile.ts');
const { loadPartitionPolicy } = require('../src/utils/goal-contract/partition-policy.ts');
const {
  authorityRecord,
  readFixtureMetadata,
  reconciledGraphFixture,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSET_DIR = path.join('_bmad', 'shared', 'goal-contract');
const PROFILE_PATH = path.join(REPO_ROOT, ASSET_DIR, 'goal-contract-profile.json');
const TEMPLATE_PATH = path.join(REPO_ROOT, ASSET_DIR, 'goal-execution-contract-template.md');
const PARTITION_POLICY_PATH = path.join(
  REPO_ROOT,
  ASSET_DIR,
  'goal-contract-partition-policy.json'
);
const PARTITION_POLICY_SCHEMA_PATH = path.join(
  REPO_ROOT,
  ASSET_DIR,
  'goal-contract-partition-policy.schema.json'
);
const CANONICAL_ASSETS_OWNER_PATH = path.join(
  REPO_ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'rules',
  'requirements-contract-canonical-assets-manifest.ts'
);

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function sourceLines(fixture, binding) {
  const parentTaskRef = binding.parentTaskRefs[0];
  return [
    `# ${fixture.primaryNamespace}`,
    `## ${parentTaskRef}`,
    `- PRIMARY-REQ: MUST preserve ${fixture.primarySourceArtifactId}.`,
    `- ${[binding.requiredRequirementIds[0], binding.requiredTaskIds[0]].join(
      ' and '
    )} MUST remain governed by ${parentTaskRef}.`,
    '- PRIMARY-BOUNDARY: MUST NOT expand subordinate ownership.',
    '## Completion Evidence',
    '- PRIMARY-EVIDENCE: MUST record deterministic compilation evidence.',
  ];
}

function subordinateLines(binding) {
  return [
    `# ${binding.namespace}`,
    ...binding.requiredRequirementIds.map((id) => `- ${id}: MUST preserve requirement ${id}.`),
    ...binding.requiredTaskIds.map((id) => `- ${id}: MUST preserve task ${id}.`),
  ];
}

function compileParentGoal() {
  const fixture = readFixtureMetadata();
  const binding = subordinateBinding();
  const sourceCompositionPolicy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord('composite_required', [binding], hashControlPlaneValue),
  });
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: fixture.primarySourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: fixture.primaryNamespace,
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/primary-authority.md',
        rawBytes: Buffer.from(`${sourceLines(fixture, binding).join('\n')}\n`),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: binding.sourceArtifactId,
        sourceRole: binding.role,
        namespace: binding.namespace,
        sourceOrder: 1,
        pathOrSegmentId: 'docs/plans/subordinate-component.md',
        rawBytes: Buffer.from(`${subordinateLines(binding).join('\n')}\n`),
      },
    ],
  });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceArtifactId: fixture.primarySourceArtifactId,
      ownedSemanticDomains: ['Goal compilation'],
      parentTaskRefs: [],
    },
    subordinateSources: [
      {
        ...binding,
        ownedSemanticDomains: ['Bounded reviewer component'],
      },
    ],
  });
  const candidate = compileCanonicalIntent({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    authorityState: 'candidate_only',
  });
  const intentAuthorityEnvelope = compileIntentAuthorityEnvelope({
    subject: {
      sourceSnapshotHash: orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
      canonicalIntentSemanticHash: candidate.canonicalIntentSemanticHash,
      specSpanRegistryHash: candidate.specSpanRegistry.specSpanRegistryHash,
    },
    compositeSourceAuthorityBundle,
    authorityBasis: {
      kind: 'direct_source_declaration',
      sourceDeclarationHash: orderedSourceSnapshotSet.sourceSnapshots[0].sourceSnapshotHash,
      declaringUserAuthorityIdentity: 'user:partition-compiler-test',
      entryScenario: 'standalone_goal_contract',
    },
  });
  const canonicalIntentBundle = compileCanonicalIntent({
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    intentAuthorityEnvelope,
    authorityState: 'authoritative',
  });
  const contractProfileBytes = fs.readFileSync(PROFILE_PATH);
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const compilePolicy = compileGoalContractPolicy({
    entryScenario: 'standalone_goal_contract',
    generationMode: 'source_plan_strict',
    sourcePlanPath: 'docs/plans/primary-authority.md',
    outPath: 'docs/plans/partition-compiler-parent.md',
    coverageReceiptPath: 'docs/plans/.partition-compiler-parent.coverage.json',
    generationReceiptPath: 'docs/plans/.partition-compiler-parent.generation.json',
    profileBytesHash: sha256(contractProfileBytes),
    templateBytesHash: sha256(templateBytes),
  });
  const subordinateCoverageReceipts = compositeSourceAuthorityBundle.subordinateCoverage
    .receipts || [compositeSourceAuthorityBundle.subordinateCoverage];
  const goalContractBundle = compileGoalContract({
    sourceCompositionPolicy,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    subordinateCoverageReceipts,
    compilePolicy,
    compilerIdentity: goalContractCompilerIdentity(),
    contractProfileBytes,
    templateBytes,
  });
  const result = {
    canonicalIntentBundle,
    compositeSourceAuthorityBundle,
    goalContractBundle,
    orderedSourceSnapshotSet,
    sourceCompositionPolicy,
    subordinateCoverageReceipts: goalContractBundle.subordinateSourceCoverageReceipts,
  };
  Object.defineProperty(result, 'binding', {
    value: binding,
    enumerable: false,
  });
  return result;
}

function loadBoundedPartitionPolicy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-compiler-policy-'));
  const directory = path.join(root, ASSET_DIR);
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(
    PARTITION_POLICY_SCHEMA_PATH,
    path.join(directory, path.basename(PARTITION_POLICY_SCHEMA_PATH))
  );
  const policy = JSON.parse(fs.readFileSync(PARTITION_POLICY_PATH, 'utf8'));
  policy.limits.maxPrimaryWriteScopeOwnersPerPartition = 1;
  fs.writeFileSync(
    path.join(directory, path.basename(PARTITION_POLICY_PATH)),
    `${JSON.stringify(policy, null, 2)}\n`,
    'utf8'
  );
  return loadPartitionPolicy({ packageRoot: root });
}

function makeInput({ reverse = false } = {}) {
  const parent = compileParentGoal();
  const binding = parent.binding;
  const reconciledGraph = reconciledGraphFixture(binding.parentTaskRefs[0], { reverse });
  const input = {
    ...parent,
    methodologyProfile: loadPartitionMethodologyProfile({
      packageRoot: REPO_ROOT,
    }),
    partitionPolicyBinding: loadBoundedPartitionPolicy(),
    reconciledGraph,
    reconciliationReceiptHash: hashControlPlaneValue({
      reconciliation: 'current',
    }),
    sequenceApplicabilityReceipt: {
      decision: 'not_applicable_with_proof',
      receiptHash: hashControlPlaneValue({
        decision: 'not_applicable_with_proof',
      }),
    },
    sequenceConstraintInput: null,
    sequenceExecutionState: {
      sequenceMode: 'disabled',
      sequenceApplicability: 'not_applicable_with_proof',
      sequenceCoverage: 'excluded',
      sequenceClosureStatus: 'not_requested',
      childContractAuthority: 'core_only',
      shouldResolveProducer: false,
    },
  };
  Object.defineProperty(input, 'binding', {
    value: binding,
    enumerable: false,
  });
  return input;
}

function expectedSubordinateIds(input) {
  return [...input.binding.requiredRequirementIds, ...input.binding.requiredTaskIds].sort();
}

function parentSelection(plan, parentTaskRef) {
  return plan.selections.find(({ primaryTaskIds }) => primaryTaskIds.includes(parentTaskRef));
}

describe('pure PartitionCompiler', () => {
  it('canonicalizes opaque authority identifiers with code-unit ordering', () => {
    assert.deepEqual(
      canonicalIdentifierList([
        'partition-5ea5',
        'partition-48aa',
        'partition-3633',
        'partition-8b50',
        'partition-48aa',
      ]),
      ['partition-3633', 'partition-48aa', 'partition-5ea5', 'partition-8b50']
    );
  });

  it('registers the PartitionPlan schema as a canonical asset', () => {
    const ownerSource = fs.readFileSync(CANONICAL_ASSETS_OWNER_PATH, 'utf8');
    assert.match(
      ownerSource,
      /assetId: 'goal_contract_partition_plan_schema'[\s\S]*?path: '_bmad\/shared\/goal-contract\/goal-contract-partition-plan\.schema\.json'/u
    );
  });

  it('keeps compiler-internal module loading portable across source and dist', () => {
    const compilerSource = fs.readFileSync(
      path.resolve(__dirname, '../src/utils/goal-contract/control-plane/partition-compiler.ts'),
      'utf8'
    );
    const sourceOnlyRequires = [
      ...compilerSource.matchAll(/require\((['"])(\.[^'"]+\.ts)\1\)/gu),
    ].map((match) => match[2]);

    assert.deepEqual(sourceOnlyRequires, []);
  });

  it('compiles deterministic core-only PartitionPlan authority', () => {
    const firstInput = makeInput();
    const secondInput = makeInput({ reverse: true });
    const first = compilePartitions(firstInput);
    const second = compilePartitions(secondInput);

    assert.equal(first.partitionPlanBytes, second.partitionPlanBytes);
    assert.equal(first.partitionPlanHash, second.partitionPlanHash);
    assert.equal(
      first.partitionPlan.sourceCompositionPolicyHash,
      firstInput.sourceCompositionPolicy.sourceCompositionPolicyHash
    );
    assert.equal(
      first.partitionPlan.goalContractHash,
      firstInput.goalContractBundle.goalContractHash
    );
    assert.equal(first.partitionPlan.sequenceMode, 'disabled');
    assert.equal(first.partitionPlan.sequenceCoverage, 'excluded');
    assert.equal(first.partitionPlan.sequenceClosureStatus, 'not_requested');
    assert.equal(first.partitionPlan.childContractAuthority, 'core_only');
    assert.doesNotMatch(first.partitionPlanBytes, /childContractHash|partitionManifestHash/u);
    assert.ok(first.partitionPlan.topologicalOrder.length >= 2);
    assert.deepEqual(
      first.partitionPlan.coverageObligations.commandIds,
      firstInput.reconciledGraph.traceSlices
        .flatMap((slice) => [
          ...slice.directCommands,
          ...slice.impactedCommands,
          ...slice.integrationCommands,
          ...slice.regressionCommands,
        ])
        .sort()
    );
    assert.ok(
      first.partitionPlan.selections.every(
        (selection) =>
          selection.sourceCompositionPolicyHash ===
            first.partitionPlan.sourceCompositionPolicyHash && selection.selectionHash
      )
    );
    assert.ok(
      first.partitionPlan.childProjectionInputs.every(
        (projection) =>
          projection.sourceCompositionPolicyHash ===
            first.partitionPlan.sourceCompositionPolicyHash && projection.selectionHash
      )
    );
  });

  it('projects primary SpecSpan refs into child selection authority without creating tasks', () => {
    const input = makeInput();
    const sourceRecord = input.reconciledGraph.sourceObligations[0];
    const primarySpan = input.canonicalIntentBundle.specSpanRegistry.specSpans.find(
      ({ sourceArtifactId }) =>
        sourceArtifactId === input.compositeSourceAuthorityBundle.primarySource.sourceArtifactId
    );
    sourceRecord.specSpanRefs = [primarySpan.specSpanId];

    const { partitionPlan } = compilePartitions(input);
    const selection = partitionPlan.selections.find(({ primarySourceObligationIds }) =>
      primarySourceObligationIds.includes(sourceRecord.id)
    );

    assert.ok(selection);
    assert.ok(selection.specSpanRefs.includes(primarySpan.specSpanId));
    assert.equal(
      partitionPlan.coverageObligations.atomicTaskIds.length,
      input.reconciledGraph.tasks.length
    );
  });

  it('rejects caller-authored command references without typed source authority', () => {
    const input = makeInput();
    const forgedCommandId = `command-${sha256(
      Buffer.from('caller-authored-unbound-command', 'utf8')
    ).slice(7, 23)}`;
    for (const slice of input.reconciledGraph.traceSlices) {
      slice.directCommands = [];
      slice.impactedCommands = [];
      slice.integrationCommands = [];
      slice.regressionCommands = [];
    }
    input.reconciledGraph.traceSlices[0].directCommands = [forgedCommandId];

    assert.throws(
      () => compilePartitions(input),
      (error) =>
        error.failureClass === 'command_projection_type_leak' && error.commandId === forgedCommandId
    );
  });

  it('rejects typed command records whose executable bytes do not match their hash', () => {
    const input = makeInput();
    const literal = 'node --version';
    const commandId = `command-${sha256(Buffer.from(literal, 'utf8')).slice(7, 23)}`;
    for (const slice of input.reconciledGraph.traceSlices) {
      slice.directCommands = [];
      slice.impactedCommands = [];
      slice.integrationCommands = [];
      slice.regressionCommands = [];
    }
    input.reconciledGraph.traceSlices[0].directCommands = [commandId];
    input.reconciledGraph.commands = {
      direct: [
        {
          id: commandId,
          literal,
          commandTextHash: sha256(Buffer.from('different executable bytes', 'utf8')),
          workingDirectory: '.',
          shell: 'host_shell',
          runtime: 'node',
          sourceBinding: {
            sourcePlanPath: 'docs/plans/primary-authority.md',
            lineStart: 1,
            lineEnd: 1,
            textHash: sha256(Buffer.from(literal, 'utf8')),
            specSpanRefs: [],
          },
        },
      ],
      impacted: [],
      integration: [],
      regression: [],
    };

    assert.throws(
      () => compilePartitions(input),
      (error) =>
        error.failureClass === 'command_projection_command_hash_mismatch' &&
        error.commandId === commandId
    );
  });

  it('projects each shared artifact only to its component-graph owner', () => {
    const fileScopeById = new Map([
      ['scope-owner', 'src/owner.ts'],
      ['scope-consumer', 'src/consumer.ts'],
      ['scope-shared', 'src/shared.ts'],
    ]);
    const sharedArtifactOwnership = [
      {
        path: 'src/shared.ts',
        ownerComponentId: 'component-owner',
        participatingComponentIds: ['component-owner', 'component-consumer'],
      },
    ];
    assert.deepEqual(
      projectOwnedArtifactPaths({
        components: [
          {
            componentId: 'component-owner',
            fileScopeIds: ['scope-owner', 'scope-shared'],
          },
        ],
        fileScopeById,
        sharedArtifactOwnership,
      }),
      ['src/owner.ts', 'src/shared.ts']
    );
    assert.deepEqual(
      projectOwnedArtifactPaths({
        components: [
          {
            componentId: 'component-consumer',
            fileScopeIds: ['scope-consumer', 'scope-shared'],
          },
        ],
        fileScopeById,
        sharedArtifactOwnership,
      }),
      ['src/consumer.ts']
    );
  });

  it('projects owner-consumer records only for cross-partition consumers', () => {
    const componentGraph = {
      sharedArtifactOwnership: [
        {
          path: 'src/shared.ts',
          ownerComponentId: 'component-owner',
          participatingComponentIds: [
            'component-owner',
            'component-local-consumer',
            'component-remote-consumer',
          ],
        },
      ],
    };
    assert.deepEqual(
      projectOwnerConsumerRecords(componentGraph, [
        {
          partitionId: 'partition-owner',
          primaryComponentIds: ['component-owner', 'component-local-consumer'],
        },
        {
          partitionId: 'partition-remote',
          primaryComponentIds: ['component-remote-consumer'],
        },
      ]),
      [
        {
          artifactPath: 'src/shared.ts',
          ownerPartitionId: 'partition-owner',
          consumerPartitionIds: ['partition-remote'],
        },
      ]
    );
    assert.deepEqual(
      projectOwnerConsumerRecords(componentGraph, [
        {
          partitionId: 'partition-owner',
          primaryComponentIds: [
            'component-owner',
            'component-local-consumer',
            'component-remote-consumer',
          ],
        },
      ]),
      []
    );
  });

  it('keeps every dynamically declared subordinate obligation in its parent task closure', () => {
    const input = makeInput();
    const { partitionPlan } = compilePartitions(input);
    const selection = parentSelection(partitionPlan, input.binding.parentTaskRefs[0]);

    assert.ok(selection);
    assert.deepEqual(
      selection.namespacedObligations.map(({ declaredSourceId }) => declaredSourceId),
      expectedSubordinateIds(input)
    );
    assert.ok(
      selection.namespacedObligations.every(
        (obligation) =>
          obligation.namespace === input.binding.namespace &&
          obligation.sourceArtifactId === input.binding.sourceArtifactId &&
          obligation.parentTaskRefs.some((taskRef) =>
            input.binding.parentTaskRefs.includes(taskRef)
          ) &&
          obligation.specSpanRefs.length > 0
      )
    );
  });

  it('rejects subordinate loss, scope escape, SpecSpan substitution, stale receipts, and policy downgrade', () => {
    const input = makeInput();
    const compiled = compilePartitions(input);
    const parentTaskRef = input.binding.parentTaskRefs[0];
    const selected = parentSelection(compiled.partitionPlan, parentTaskRef);
    const other = compiled.partitionPlan.selections.find(
      ({ partitionId }) => partitionId !== selected.partitionId
    );

    const dropped = structuredClone(compiled.partitionPlan);
    parentSelection(dropped, parentTaskRef).namespacedObligations.pop();
    assert.throws(
      () => verifyPartitionPlan(dropped, input),
      (error) => error.failureClass === 'subordinate_coverage_incomplete'
    );

    const missingCommandAuthority = structuredClone(compiled.partitionPlan);
    delete missingCommandAuthority.coverageObligations.commandIds;
    const { partitionPlanHash: _ignoredPartitionPlanHash, ...missingCommandAuthoritySemantic } =
      missingCommandAuthority;
    missingCommandAuthority.partitionPlanHash = hashControlPlaneValue(
      missingCommandAuthoritySemantic
    );
    assert.throws(
      () => verifyPartitionPlan(missingCommandAuthority, input),
      (error) => error.failureClass === 'partition_plan_schema_invalid'
    );

    const escaped = structuredClone(compiled.partitionPlan);
    const escapedParent = parentSelection(escaped, parentTaskRef);
    const escapedOther = escaped.selections.find(
      ({ partitionId }) => partitionId === other.partitionId
    );
    escapedOther.namespacedObligations = escapedParent.namespacedObligations;
    escapedParent.namespacedObligations = [];
    assert.throws(
      () => verifyPartitionPlan(escaped, input),
      (error) => error.failureClass === 'subordinate_scope_escape'
    );

    const substituted = structuredClone(compiled.partitionPlan);
    const substitutedRecord = parentSelection(substituted, parentTaskRef).namespacedObligations[0];
    substitutedRecord.specSpanRefs = [
      input.canonicalIntentBundle.specSpanRegistry.specSpans.find(
        ({ sourceArtifactId }) => sourceArtifactId !== input.binding.sourceArtifactId
      ).specSpanId,
    ];
    assert.throws(
      () => verifyPartitionPlan(substituted, input),
      (error) => error.failureClass === 'cross_source_spec_span_substitution'
    );

    const staleReceiptInput = structuredClone(input);
    staleReceiptInput.subordinateCoverageReceipts[0].receiptHash = hashControlPlaneValue({
      stale: true,
    });
    assert.throws(
      () => compilePartitions(staleReceiptInput),
      (error) => error.failureClass === 'subordinate_source_stale'
    );

    const downgradedInput = structuredClone(input);
    downgradedInput.sourceCompositionPolicy.mode = 'single_source';
    assert.throws(
      () => compilePartitions(downgradedInput),
      (error) => error.failureClass === 'source_composition_downgrade_rejected'
    );
  });

  it('rejects caller-authored partition, semantic, policy, and sequence authority', () => {
    const input = makeInput();
    for (const [field, value] of [
      ['partitionCount', 1],
      ['partitions', []],
      ['optimizerDecision', 'selected'],
      ['partitionPlanHash', hashControlPlaneValue({ injected: true })],
      ['semanticModelHash', hashControlPlaneValue({ injected: true })],
      ['policyBytes', '{}'],
      ['sequenceAuthority', { decision: 'required' }],
    ]) {
      assert.throws(
        () => compilePartitions({ ...input, [field]: value }),
        (error) =>
          error.failureClass === 'partition_authority_injection' &&
          error.forbiddenFields.includes(field)
      );
    }
  });
});
