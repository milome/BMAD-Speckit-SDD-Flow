const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  authorityRecord,
  readFixtureMetadata,
  reconciledGraphFixture,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  loadPartitionMethodologyProfile,
} = require('../src/utils/goal-contract/partition-methodology-profile.ts');
const {
  loadPartitionPolicy,
} = require('../src/utils/goal-contract/partition-policy.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROFILE_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-profile.json'
);
const TEMPLATE_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-execution-contract-template.md'
);
const PARTITION_POLICY_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-partition-policy.json'
);
const PARTITION_POLICY_SCHEMA_PATH = path.join(
  REPO_ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-contract-partition-policy.schema.json'
);
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function sourceLines(fixture, binding) {
  const parentTaskRef = binding.parentTaskRefs[0];
  return [
    `# ${fixture.primaryNamespace}`,
    `## ${parentTaskRef}`,
    `- PRIMARY-REQ: MUST preserve ${fixture.primarySourceArtifactId}.`,
    `- ${[
      binding.requiredRequirementIds[0],
      binding.requiredTaskIds[0],
    ].join(' and ')} MUST remain governed by ${parentTaskRef}.`,
    '- PRIMARY-BOUNDARY: MUST NOT expand subordinate ownership.',
    '## Completion Evidence',
    '- PRIMARY-EVIDENCE: MUST record deterministic compilation evidence.',
  ];
}

function subordinateLines(binding) {
  return [
    `# ${binding.namespace}`,
    ...binding.requiredRequirementIds.map((id) => `- ${id}`),
    ...binding.requiredTaskIds.map((id) => `- ${id}`),
  ];
}

function boundedPartitionPolicy() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'canonical-control-plane-policy-')
  );
  const targetRoot = path.join(root, '_bmad', 'shared', 'goal-contract');
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.copyFileSync(
    PARTITION_POLICY_SCHEMA_PATH,
    path.join(
      targetRoot,
      path.basename(PARTITION_POLICY_SCHEMA_PATH)
    )
  );
  const policy = JSON.parse(
    fs.readFileSync(PARTITION_POLICY_PATH, 'utf8')
  );
  policy.limits.maxPrimaryWriteScopeOwnersPerPartition = 1;
  fs.writeFileSync(
    path.join(targetRoot, path.basename(PARTITION_POLICY_PATH)),
    `${JSON.stringify(policy, null, 2)}\n`,
    'utf8'
  );
  return loadPartitionPolicy({ packageRoot: root });
}

function compileRequest() {
  const fixture = readFixtureMetadata();
  const binding = subordinateBinding();
  const contractProfileBytes = fs.readFileSync(PROFILE_PATH);
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  return {
    sourceCompositionAuthorityRecord: authorityRecord(
      'composite_required',
      [binding],
      hashControlPlaneValue
    ),
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: fixture.primarySourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: fixture.primaryNamespace,
        sourceOrder: 0,
        pathOrSegmentId: 'docs/plans/primary-authority.md',
        rawBytes: Buffer.from(
          `${sourceLines(fixture, binding).join('\n')}\n`
        ),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: binding.sourceArtifactId,
        sourceRole: binding.role,
        namespace: binding.namespace,
        sourceOrder: 1,
        pathOrSegmentId: 'docs/plans/subordinate-component.md',
        rawBytes: Buffer.from(
          `${subordinateLines(binding).join('\n')}\n`
        ),
      },
    ],
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
    authorityBasis: {
      kind: 'direct_source_declaration',
      declaringUserAuthorityIdentity:
        'user:canonical-control-plane-test',
      entryScenario: 'standalone_goal_contract',
    },
    goalContractPolicyRequest: {
      entryScenario: 'standalone_goal_contract',
      generationMode: 'source_plan_strict',
      sourcePlanPath: 'docs/plans/primary-authority.md',
      outPath: 'docs/plans/canonical-control-plane-parent.md',
      coverageReceiptPath:
        'docs/plans/.canonical-control-plane.coverage.json',
      generationReceiptPath:
        'docs/plans/.canonical-control-plane.generation.json',
      profileBytesHash: sha256(contractProfileBytes),
      templateBytesHash: sha256(templateBytes),
    },
    contractProfileBytes,
    templateBytes,
    partitionRequest: {
      methodologyProfile: loadPartitionMethodologyProfile({
        packageRoot: REPO_ROOT,
      }),
      partitionPolicyBinding: boundedPartitionPolicy(),
      reconciledGraph: reconciledGraphFixture(
        binding.parentTaskRefs[0]
      ),
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
    },
    renderChildContract({
      partitionPlan,
      childProjectionInput,
      displayOrdinal,
    }) {
      const obligationRefs = [
        ...childProjectionInput.primarySourceObligationIds,
        ...childProjectionInput.namespacedObligations.map(
          ({ declaredSourceId }) => declaredSourceId
        ),
      ].sort();
      return {
        childContractPath:
          `children/${String(displayOrdinal).padStart(2, '0')}-` +
          `${childProjectionInput.partitionId}.md`,
        childContractBytes: Buffer.from(
          [
            '---',
            `sourceCompositionPolicyHash: ${partitionPlan.sourceCompositionPolicyHash}`,
            `partitionPlanHash: ${partitionPlan.partitionPlanHash}`,
            `goalContractHash: ${partitionPlan.goalContractHash}`,
            `partitionSetHash: ${partitionPlan.partitionSetHash}`,
            `selectionSetHash: ${childProjectionInput.selectionHash}`,
            `orderedSourceSnapshotSetHash: ${partitionPlan.orderedSourceSnapshotSetHash}`,
            `sourceAuthorityBundleHash: ${partitionPlan.sourceAuthorityBundleHash}`,
            `subordinateCoverageReceiptHashes: ${JSON.stringify(
              childProjectionInput.subordinateCoverageReceiptHashes
            )}`,
            `partitionId: ${childProjectionInput.partitionId}`,
            `displayOrdinal: ${displayOrdinal}`,
            `obligationRefs: ${JSON.stringify(obligationRefs)}`,
            `namespaceRefs: ${JSON.stringify(
              childProjectionInput.namespaceRefs
            )}`,
            `sourceArtifactRefs: ${JSON.stringify(
              childProjectionInput.sourceArtifactRefs
            )}`,
            `specSpanRefs: ${JSON.stringify(
              childProjectionInput.specSpanRefs
            )}`,
            `governedPaths: ${JSON.stringify(
              childProjectionInput.ownedArtifactPaths
            )}`,
            '---',
            '',
            `# ${childProjectionInput.partitionId}`,
            '',
          ].join('\n'),
          'utf8'
        ),
      };
    },
  };
}

describe('canonical control-plane facade', () => {
  it('exports the complete Kernel contract from one entry', () => {
    const kernel = require('../src/utils/goal-contract/control-plane/index.ts');
    const expected = [
      'activateGoalCampaign',
      'closeGoalCampaign',
      'closeSubcontract',
      'compileCanonicalIntent',
      'compileCompositeSourceAuthorityBundle',
      'compileExecutionBundle',
      'compileGoalContract',
      'compileIntentAuthorityEnvelope',
      'compilePartitions',
      'compileSourceCompositionPolicy',
      'compileSourceSnapshot',
      'compileSpecSpanRegistry',
      'compileSubcontractEvidence',
      'issueSubcontractExecutionLease',
      'projectExecutionArtifacts',
      'resolveSpecSpan',
      'verifyControlPlaneReceipt',
    ];
    assert.deepEqual(
      Object.keys(kernel)
        .filter((name) => expected.includes(name))
        .sort(),
      [...expected].sort()
    );
  });

  it('compiles the full composite execution authority without activation', () => {
    const {
      compileExecutionBundle,
    } = require('../src/utils/goal-contract/control-plane/index.ts');
    const request = compileRequest();
    const bundle = compileExecutionBundle(request);

    assert.equal(
      bundle.schemaVersion,
      'goal-contract-execution-authority-bundle/v1'
    );
    assert.equal(
      bundle.sourceCompositionPolicy.mode,
      'composite_required'
    );
    assert.equal(
      bundle.canonicalIntentBundle.authorityState,
      'authoritative'
    );
    assert.equal(
      bundle.partitionBundle.partitionPlan.sequenceMode,
      'disabled'
    );
    assert.equal(
      bundle.executionProjectionBundle.partitionManifest
        .manifestAuthorityMode,
      'final_child_membership'
    );
    assert.equal(
      bundle.executionProjectionBundle.orderedChildContractHashes.length,
      bundle.partitionBundle.partitionPlan.topologicalOrder.length
    );
    assert.ok(
      Object.keys(bundle.schemaArtifactHashes).every((name) =>
        name.endsWith('.schema.json')
      )
    );
    assert.equal(Object.hasOwn(bundle, 'campaignActivationReceipt'), false);
    assert.equal(Object.hasOwn(bundle, 'subcontractExecutionLease'), false);
    assert.equal(Object.hasOwn(bundle, 'goalCampaignClosureReceipt'), false);
  });

  it('does not duplicate compiler or lifecycle formulas in the facade', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../src/utils/goal-contract/control-plane/index.ts'
      ),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /function\s+(?:compileSourceSnapshot|compileSpecSpanRegistry|compileSourceCompositionPolicy|compileCompositeSourceAuthorityBundle|compileCanonicalIntent|compileGoalContract|compilePartitions|projectExecutionArtifacts|activateGoalCampaign|closeSubcontract|closeGoalCampaign)\s*\(/u
    );
    assert.doesNotMatch(
      source,
      /campaignActivationHash\s*=|childClosureHash\s*=|partitionManifestHash\s*=/u
    );
  });
});
