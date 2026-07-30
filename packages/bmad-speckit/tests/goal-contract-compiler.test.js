const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
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
  createGoalContractCompilationReceipt,
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
  authorityRecord,
  readFixtureMetadata,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

const PROFILE_PATH = path.resolve(
  __dirname,
  '../../../_bmad/shared/goal-contract/goal-contract-profile.json'
);
const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../_bmad/shared/goal-contract/goal-execution-contract-template.md'
);

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function sourceLines(fixture, binding) {
  const parentTaskRef = binding?.parentTaskRefs[0] || 'PRIMARY-TASK';
  const crossSourceRefs = binding
    ? [binding.requiredRequirementIds[0], binding.requiredTaskIds[0]]
    : [];
  return [
    `# ${fixture.primaryNamespace}`,
    `## ${parentTaskRef}`,
    `- PRIMARY-REQ: MUST preserve canonical source authority for ${fixture.primarySourceArtifactId}.`,
    ...(crossSourceRefs.length > 0
      ? [`- ${crossSourceRefs.join(' and ')} MUST remain governed by ${parentTaskRef}.`]
      : []),
    `- PRIMARY-BOUNDARY: MUST NOT expand ${binding?.namespace || 'standalone'} ownership.`,
    '## Deterministic NOT DONE',
    '- Sequence producer remains excluded.',
    '## Completion Evidence',
    '- PRIMARY-EVIDENCE: MUST record deterministic compilation evidence.',
    ...(binding ? ['## Dependencies', `- Dependencies: ${parentTaskRef}.`] : []),
    '## Applicability',
    '- Applicability: core-only when sequence mode is disabled.',
  ];
}

function subordinateLines(binding) {
  return [
    `# ${binding.namespace}`,
    ...binding.requiredRequirementIds.map((id) => `- ${id}: MUST preserve requirement ${id}.`),
    ...binding.requiredTaskIds.map((id) => `- ${id}: MUST preserve task ${id}.`),
  ];
}

function buildCompilerInput({ composite = true } = {}) {
  const fixture = readFixtureMetadata();
  const binding = composite ? subordinateBinding() : null;
  const requiredBindings = binding ? [binding] : [];
  const policy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord(
      composite ? 'composite_required' : 'single_source',
      requiredBindings,
      hashControlPlaneValue
    ),
  });
  const sources = [
    {
      sourceKind: 'source_plan',
      sourceArtifactId: fixture.primarySourceArtifactId,
      sourceRole: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceOrder: 0,
      pathOrSegmentId: 'docs/plans/primary-authority.md',
      rawBytes: Buffer.from(`${sourceLines(fixture, binding).join('\n')}\n`),
    },
    ...(binding
      ? [
          {
            sourceKind: 'source_plan',
            sourceArtifactId: binding.sourceArtifactId,
            sourceRole: binding.role,
            namespace: binding.namespace,
            sourceOrder: 1,
            pathOrSegmentId: 'docs/plans/subordinate-component.md',
            rawBytes: Buffer.from(`${subordinateLines(binding).join('\n')}\n`),
          },
        ]
      : []),
  ];
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources,
  });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({
    sourceCompositionPolicy: policy,
    orderedSourceSnapshotSet,
    primarySource: {
      role: 'primary_implementation_authority',
      namespace: fixture.primaryNamespace,
      sourceArtifactId: fixture.primarySourceArtifactId,
      ownedSemanticDomains: ['Goal compilation'],
      parentTaskRefs: [],
    },
    subordinateSources: binding
      ? [
          {
            ...binding,
            ownedSemanticDomains: ['Reviewer prompt', 'native carriers'],
          },
        ]
      : [],
  });
  const candidate = compileCanonicalIntent({
    sourceCompositionPolicy: policy,
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
      declaringUserAuthorityIdentity: 'user:goal-contract-compiler-test',
      entryScenario: 'standalone_goal_contract',
    },
  });
  const canonicalIntentBundle = compileCanonicalIntent({
    sourceCompositionPolicy: policy,
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
    sourcePlanPath: sources[0].pathOrSegmentId,
    outPath: 'docs/plans/compiler-test-goal.md',
    coverageReceiptPath: 'docs/plans/.compiler-test-goal.coverage.json',
    generationReceiptPath: 'docs/plans/.compiler-test-goal.generation.json',
    profileBytesHash: sha256(contractProfileBytes),
    templateBytesHash: sha256(templateBytes),
  });
  const subordinateCoverageReceipts =
    compositeSourceAuthorityBundle.subordinateCoverage.receipts ||
    (composite ? [compositeSourceAuthorityBundle.subordinateCoverage] : []);
  const result = {
    sourceCompositionPolicy: policy,
    compositeSourceAuthorityBundle,
    canonicalIntentBundle,
    subordinateCoverageReceipts,
    compilePolicy,
    compilerIdentity: goalContractCompilerIdentity(),
    contractProfileBytes,
    templateBytes,
  };
  Object.defineProperty(result, 'binding', {
    value: binding,
    enumerable: false,
  });
  return result;
}

describe('pure GoalContractCompiler', () => {
  it('keeps compiler-internal module loading portable across source and dist', () => {
    const compilerSource = fs.readFileSync(
      path.resolve(__dirname, '../src/utils/goal-contract/control-plane/goal-contract-compiler.ts'),
      'utf8'
    );
    const sourceOnlyRequires = [
      ...compilerSource.matchAll(/require\((['"])(\.[^'"]+\.ts)\1\)/gu),
    ].map((match) => match[2]);

    assert.deepEqual(sourceOnlyRequires, []);
  });

  it('compiles byte-identical frozen Markdown and semantic hashes', () => {
    const input = buildCompilerInput();
    const previousTimezone = process.env.TZ;
    const first = compileGoalContract(input);
    process.env.TZ = 'Pacific/Auckland';
    const second = compileGoalContract(structuredClone(input));
    process.env.TZ = previousTimezone;

    assert.equal(first.markdown, second.markdown);
    assert.equal(first.goalContractSemanticHash, second.goalContractSemanticHash);
    assert.equal(first.goalContractHash, second.goalContractHash);
    assert.equal(first.markdownHash, second.markdownHash);
    assert.equal(first.runtimeRecordId, `GOAL-CONTRACT-${first.goalContractHash.slice(7)}`);
    assert.match(first.markdown, /generatedAt: 1970-01-01T00:00:00\.000Z/u);
    assert.doesNotMatch(first.markdown, /Date\.now|new Date/u);

    const earlyReceipt = createGoalContractCompilationReceipt(first, {
      compiledAt: '2026-07-29T00:00:00.000Z',
    });
    const laterReceipt = createGoalContractCompilationReceipt(second, {
      compiledAt: '2026-07-29T00:01:00.000Z',
    });
    assert.equal(earlyReceipt.goalContractHash, laterReceipt.goalContractHash);
    assert.notEqual(earlyReceipt.receiptHash, laterReceipt.receiptHash);
  });

  it('derives complete subordinate coverage and source-specific provenance', () => {
    const input = buildCompilerInput();
    const result = compileGoalContract(input);
    const receipt = result.subordinateSourceCoverageReceipts[0];

    assert.deepEqual(
      receipt.requiredRequirementIds,
      [...input.binding.requiredRequirementIds].sort()
    );
    assert.deepEqual(receipt.requiredTaskIds, [...input.binding.requiredTaskIds].sort());
    assert.deepEqual(receipt.missingIds, []);
    assert.deepEqual(receipt.duplicateIds, []);
    assert.deepEqual(receipt.unmappedIds, []);
    assert.deepEqual(receipt.scopeEscapeIds, []);
    assert.equal(receipt.sourceAuthorityBundleHash, result.sourceAuthorityBundleHash);
    assert.ok(receipt.sourceSnapshotHash.startsWith('sha256:'));

    const subordinateRecords = result.goalContractSemanticModel.records.filter(
      ({ sourceArtifactId }) => sourceArtifactId === input.binding.sourceArtifactId
    );
    assert.ok(subordinateRecords.length > 0);
    assert.ok(
      subordinateRecords.every(
        (record) =>
          record.namespace === input.binding.namespace &&
          record.specSpanRefs.length > 0 &&
          record.parentTaskRefs.length === 1 &&
          input.binding.parentTaskRefs.includes(record.parentTaskRefs[0])
      )
    );
    for (const identifier of [
      ...input.binding.requiredRequirementIds,
      ...input.binding.requiredTaskIds,
      ...input.binding.parentTaskRefs,
      ...subordinateRecords.flatMap(({ specSpanRefs }) => specSpanRefs),
    ]) {
      assert.match(result.markdown, new RegExp(identifier, 'u'));
    }
  });

  it('rejects authority injection and stale renderer authority before rendering', () => {
    const input = buildCompilerInput();
    for (const field of [
      'goalContractSemanticHash',
      'goalContractHash',
      'coverageDecision',
      'compilationDecision',
    ]) {
      assert.throws(
        () =>
          compileGoalContract({
            ...input,
            [field]: field.endsWith('Hash') ? `sha256:${'f'.repeat(64)}` : 'pass',
          }),
        (error) => error.failureClass === 'goal_contract_authority_injection'
      );
    }
    assert.throws(
      () =>
        compileGoalContract({
          ...input,
          templateBytes: Buffer.concat([input.templateBytes, Buffer.from('\n')]),
        }),
      (error) => error.failureClass === 'template_bytes_stale'
    );
    assert.throws(
      () =>
        compileGoalContract({
          ...input,
          contractProfileBytes: Buffer.concat([input.contractProfileBytes, Buffer.from('\n')]),
        }),
      (error) => error.failureClass === 'profile_bytes_stale'
    );
    assert.throws(
      () =>
        compileGoalContract({
          ...input,
          subordinateCoverageReceipts: [],
        }),
      (error) => error.failureClass === 'subordinate_coverage_incomplete'
    );
  });

  it('keeps single-source compilation valid only with an empty subordinate set', () => {
    const input = buildCompilerInput({ composite: false });
    let result;
    try {
      result = compileGoalContract(input);
    } catch (error) {
      assert.fail(
        JSON.stringify(
          {
            failureClass: error.failureClass || error.code,
            coverageAudit: error.coverageAudit,
          },
          null,
          2
        )
      );
    }

    assert.equal(input.sourceCompositionPolicy.mode, 'single_source');
    assert.deepEqual(result.subordinateSourceCoverageReceipts, []);
    assert.equal(result.primarySourceCoverage.missingIds.length, 0);
    assert.equal(result.primarySourceCoverage.unmappedIds.length, 0);
    assert.match(result.markdown, /sourceCompositionPolicyHash:/u);
    assert.match(result.markdown, /goalContractHash:/u);
  });
});
