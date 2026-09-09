const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const FIXTURE_ROOT = path.join(PACKAGE_ROOT, 'tests', 'fixtures', 'standalone-goal');
const {
  readRequirementsContractDeclaredAuthoritySources,
  scanRequirementsContractConsumerAuthority,
} = require(path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'source-authority', 'scripts',
  'requirements-contract-consumer-authority-scanner.js'));
const {
  resolveTypedSourceAuthority,
} = require(path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'source-authority', 'scripts',
  'requirements-contract-typed-source-semantics.js'));
const {
  compileTypedSourceAtoms,
} = require(path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'source-authority', 'scripts',
  'requirements-contract-typed-source-compiler.js'));
const {
  projectRequirementsTypedGoalObligations,
} = require(path.join(PACKAGE_ROOT, 'dist', 'utils', 'goal-contract', 'control-plane',
  'goal-requirements-typed-bridge.js'));
const {
  verifyBoundIndependentFixtureReview,
} = require(path.join(REPO_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts',
  'verify-independent-fixture-review.js'));
const paths = {
  legacy: path.join(FIXTURE_ROOT, 'real-source-plan-20260904.md'),
  manifest: path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.derivation-manifest.json'),
  expected: path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.expected-graph.json'),
  review: path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.fixture-review.json'),
  integrity: path.join(FIXTURE_ROOT, 'canonical-source-plan-v1-full.integrity.json'),
  requirementsIntake: path.join(FIXTURE_ROOT,
    '.canonical-source-plan-v1-full.confirmed-requirements.authoring-input', 'intake.json'),
};

function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalHash(value) {
  return hash(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function selfHash(value, field) {
  const payload = structuredClone(value);
  delete payload[field];
  return canonicalHash(payload);
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, 'utf8'));
}

function fail(condition, code) {
  if (!condition) throw new Error(code);
}

function identity(value) {
  const bytes = fs.readFileSync(value);
  return { byteCount: bytes.length, sha256: hash(bytes) };
}

function verifyArtifactBinding(binding, code) {
  const actual = identity(path.join(REPO_ROOT, binding.path));
  fail(binding.byteCount === actual.byteCount && binding.sha256 === actual.sha256, code);
}

function verifyProofAssets(input, options = {}) {
  const { manifest, expected, review, integrity } = input;
  fail(manifest.manifestHash === selfHash(manifest, 'manifestHash'), 'manifest_self_hash_invalid');
  fail(expected.expectedDocumentHash === selfHash(expected, 'expectedDocumentHash'), 'expected_self_hash_invalid');
  fail(review.reviewHash === selfHash(review, 'reviewHash'), 'review_self_hash_invalid');
  fail(integrity.integrityHash === selfHash(integrity, 'integrityHash'), 'integrity_self_hash_invalid');

  fail(manifest.summary.unmappedSourceSpans === 0, 'manifest_source_span_unmapped');
  fail(manifest.summary.unmappedNormativeSpans === 0, 'manifest_normative_span_unmapped');
  fail(manifest.summary.orphanSemanticNodes === 0, 'manifest_semantic_node_orphan');
  fail(manifest.summary.supersededCanonicalObligationCount === 0, 'manifest_superseded_projection_invalid');
  const source = fs.readFileSync(paths.legacy);
  let cursor = 0;
  for (const span of manifest.spans) {
    fail(span.byteStart === cursor, 'manifest_source_span_gap');
    const exact = source.subarray(span.byteStart, span.byteEndExclusive);
    fail(hash(exact) === `sha256:${span.exactTextHash}`, 'manifest_source_span_hash_invalid');
    cursor = span.byteEndExclusive;
  }
  fail(cursor === source.length, 'manifest_source_coverage_incomplete');

  fail(expected.derivationAuthority.manifestHash === manifest.manifestHash,
    'expected_manifest_binding_stale');
  fail(expected.nodeCount === expected.expectedGraph.nodes.length &&
    expected.relationCount === expected.expectedGraph.relations.length &&
    expected.aliasCount === expected.expectedGraph.aliases.length, 'expected_count_invalid');
  const graph = structuredClone(expected.expectedGraph);
  graph.nodes = graph.nodes.map(({ sourceSpanRefs: _refs, ...node }) => node);
  graph.relations = graph.relations.map(({ sourceSpanRefs: _refs, ...relation }) => relation);
  graph.aliases = graph.aliases.map(({ sourceSpanRefs: _refs, ...alias }) => alias);
  delete graph.graphHash;
  fail(expected.expectedGraph.graphHash === canonicalHash(graph), 'expected_graph_hash_invalid');

  fail(review.schemaVersion === 'StandaloneSourcePlanFixtureReview/v1' && review.reviewStatus === 'confirmed',
    'fixture_review_not_confirmed');
  if (options.requireIndependentReview !== false) {
    verifyBoundIndependentFixtureReview({ projectRoot: REPO_ROOT, review });
  }
  fail(review.perspectives.length === 3 && review.perspectives.every((row) =>
    row.verdict === 'PASS' && row.blockerCount === 0 && row.importantFindingCount === 0),
  'fixture_review_perspective_failed');
  fail(review.bindings.manifestHash === manifest.manifestHash, 'review_manifest_binding_stale');
  fail(review.bindings.expectedDocumentHash === expected.expectedDocumentHash,
    'review_expected_binding_stale');
  fail(review.bindings.canonicalRequirementGraphHash === expected.expectedGraph.graphHash,
    'review_graph_binding_stale');
  for (const binding of Object.values(review.bindings).filter((value) => value && value.path)) {
    verifyArtifactBinding(binding, 'review_artifact_binding_stale');
  }

  fail(integrity.reviewStatus === 'confirmed', 'integrity_review_not_confirmed');
  fail(integrity.semanticBindings.manifestHash === manifest.manifestHash,
    'integrity_manifest_binding_stale');
  fail(integrity.semanticBindings.expectedDocumentHash === expected.expectedDocumentHash,
    'integrity_expected_binding_stale');
  fail(integrity.semanticBindings.canonicalRequirementGraphHash === expected.expectedGraph.graphHash,
    'integrity_graph_binding_stale');
  fail(integrity.semanticBindings.fixtureReviewHash === review.reviewHash,
    'integrity_review_binding_stale');
  fail(integrity.completeness.unmappedNormativeSpans === 0,
    'integrity_normative_span_unmapped');
  fail(integrity.completeness.orphanSemanticNodes === 0,
    'integrity_semantic_node_orphan');
  for (const binding of Object.values(integrity.artifacts)) {
    verifyArtifactBinding(binding, 'integrity_artifact_binding_stale');
  }
}

function loadProofAssets() {
  return {
    manifest: readJson(paths.manifest),
    expected: readJson(paths.expected),
    review: readJson(paths.review),
    integrity: readJson(paths.integrity),
  };
}

describe('canonical Source Plan v1 full independent proof assets', () => {
  it('accepts the current v3 review with controlled provenance and disposition', () => {
    const proof = loadProofAssets();
    verifyProofAssets(proof);
    assert.equal(proof.review.reviewEpoch, 'phase6-canonical-full-independent-v3-final');
    assert.equal(
      proof.review.artifactSet.artifactSetHash,
      'sha256:2ceda58e520d384a7c54517a65ee1e418a422614afbe0a01577eae76c4031a56'
    );
    assert.equal(proof.review.reviewHash, 'sha256:fd921812ee0e41270ff0c983e1f4ed6d2ca1a249a00e3a1490abcae8d80e90b7');
    assert.equal(proof.integrity.integrityHash, 'sha256:4720992cfc6b0d92c180606dd68746454b07a30915cb2a7ea329a586b498e86d');
    assert.equal(proof.review.provenance.reportEvents.length, 3);
    assert.equal(proof.review.provenance.dispositionEvent.producerExecutionIdentity.executionId,
      'main-session-disposition-producer-v3-final');
    const generator = fs.readFileSync(path.join(
      FIXTURE_ROOT,
      'canonical-source-plan-v1-full.proof-generator.cjs'
    ), 'utf8');
    assert.doesNotMatch(generator, /perspectives:\s*\[/u);
    assert.doesNotMatch(generator, /verdict:\s*'PASS'/u);
    assert.doesNotMatch(generator, /mainSessionDisposition:\s*\{/u);
  });

  it('fails closed when a manifest is changed even with a recomputed self hash', () => {
    const candidate = loadProofAssets();
    candidate.manifest.summary.unmappedNormativeSpans = 1;
    candidate.manifest.manifestHash = selfHash(candidate.manifest, 'manifestHash');
    assert.throws(() => verifyProofAssets(candidate, { requireIndependentReview: false }),
      /manifest_normative_span_unmapped|expected_manifest_binding_stale/u);
  });

  it('fails closed when an expected graph is changed even with a recomputed document hash', () => {
    const candidate = loadProofAssets();
    candidate.expected.expectedGraph.nodes[0].statement += ' tampered';
    candidate.expected.expectedDocumentHash = selfHash(candidate.expected, 'expectedDocumentHash');
    assert.throws(() => verifyProofAssets(candidate, { requireIndependentReview: false }),
      /expected_graph_hash_invalid|review_expected_binding_stale/u);
  });

  it('fails closed when a confirmed review is changed even with a recomputed review hash', () => {
    const candidate = loadProofAssets();
    candidate.review.perspectives[0].verdict = 'FAIL';
    candidate.review.reviewHash = selfHash(candidate.review, 'reviewHash');
    assert.throws(() => verifyProofAssets(candidate, { requireIndependentReview: false }),
      /fixture_review_perspective_failed|integrity_review_binding_stale/u);
  });

  it('fails closed when integrity claims are changed even with a recomputed integrity hash', () => {
    const candidate = loadProofAssets();
    candidate.integrity.completeness.orphanSemanticNodes = 1;
    candidate.integrity.integrityHash = selfHash(candidate.integrity, 'integrityHash');
    assert.throws(() => verifyProofAssets(candidate, { requireIndependentReview: false }),
      /integrity_semantic_node_orphan/u);
  });

  it('adapts canonical nodes for native typed-source admission without changing their authority', (t) => {
    const intake = readJson(paths.requirementsIntake);
    const proof = loadProofAssets();
    const scan = scanRequirementsContractConsumerAuthority({
      cwd: REPO_ROOT,
      intakeSource: paths.requirementsIntake,
      authoritySources: readRequirementsContractDeclaredAuthoritySources(paths.requirementsIntake),
    });
    const authority = scan.typedSourceAuthority;
    assert.ok(authority);
    const graph = resolveTypedSourceAuthority(authority);
    assert.strictEqual(graph.sourceNodes.length, 825);
    assert.strictEqual(graph.sourceRelations.length, 9165);
    assert.strictEqual(proof.expected.expectedGraph.aliases.length, 446);
    const canonicalGraph = proof.expected.expectedGraph;
    const canonicalNodeById = new Map(canonicalGraph.nodes.map((node) => [node.id, node]));
    const taskIds = new Set(canonicalGraph.nodes
      .filter((node) => node.kind === 'TASK').map((node) => node.id));
    assert.strictEqual(taskIds.size, 16);
    const expectedDependencies = new Map([...taskIds].map((id) => [id, new Set()]));
    let dependencyEdgeCount = 0;
    for (const taskId of taskIds) {
      const declarations = canonicalGraph.relations.filter((row) =>
        row.type === 'depends_on' && row.fromRef === taskId);
      for (const relation of declarations) {
        const dependency = canonicalNodeById.get(relation.toRef);
        assert.strictEqual(dependency?.kind, 'DEP');
        assert.strictEqual(dependency.ownerRef, taskId);
        const producerId = dependency.attributes?.dependency;
        assert.strictEqual(canonicalNodeById.get(producerId)?.kind, 'TASK');
        assert.notStrictEqual(producerId, taskId);
        const ownedBy = canonicalGraph.relations.filter((row) =>
          row.type === 'owned_by' && row.fromRef === dependency.id).map((row) => row.toRef);
        assert.ok(ownedBy.includes(taskId));
        assert.ok(dependency.references?.taskRefs?.includes(taskId));
        assert.ok(dependency.references?.taskRefs?.includes(producerId));
        const implementedBy = canonicalGraph.relations.filter((row) =>
          row.type === 'implemented_by' && row.fromRef === dependency.id).map((row) => row.toRef);
        assert.ok(implementedBy.includes(taskId));
        assert.ok(implementedBy.includes(producerId));
        expectedDependencies.get(taskId).add(producerId);
        dependencyEdgeCount += 1;
      }
    }
    const nonEmptyDependencyTasks = [...expectedDependencies.values()].filter((refs) => refs.size > 0).length;
    assert.strictEqual(dependencyEdgeCount, 46);
    assert.strictEqual([...expectedDependencies.values()].reduce((total, refs) => total + refs.size, 0), 46);
    assert.strictEqual(nonEmptyDependencyTasks, 15);
    assert.strictEqual(taskIds.size - nonEmptyDependencyTasks, 1);
    const dependencyVisitState = new Map();
    const visitDependency = (taskId) => {
      assert.notStrictEqual(dependencyVisitState.get(taskId), 'visiting', `dependency cycle at ${taskId}`);
      if (dependencyVisitState.get(taskId) === 'visited') return;
      dependencyVisitState.set(taskId, 'visiting');
      for (const producerId of expectedDependencies.get(taskId)) visitDependency(producerId);
      dependencyVisitState.set(taskId, 'visited');
    };
    for (const taskId of taskIds) visitDependency(taskId);
    t.diagnostic(`TASK dependency edges=${dependencyEdgeCount}, non-empty=${nonEmptyDependencyTasks}, empty=${taskIds.size - nonEmptyDependencyTasks}`);
    const atoms = compileTypedSourceAtoms(scan);
    const workById = new Map(graph.workDeclarations.map((work) => [work.id, work]));
    const atomByRequirement = new Map(atoms.map((atom) => [atom.authorityRefs[0], atom]));
    for (const [taskId, refs] of expectedDependencies) {
      const expected = [...refs].sort((left, right) => left.localeCompare(right));
      const actual = workById.get(taskId)?.dependencies;
      assert.ok(Array.isArray(actual));
      assert.deepStrictEqual(actual, expected);
      assert.deepStrictEqual(actual, [...new Set(actual)].sort((left, right) => left.localeCompare(right)));
      assert.ok(actual.every((id) => taskIds.has(id) && !id.startsWith('DEP-')));
      assert.deepStrictEqual(atomByRequirement.get(taskId)?.dependencies,
        expected.map((id) => `${id}-A1`));
    }
    for (const node of graph.sourceNodes) {
      assert.strictEqual(node.typedReferences.canonicalNodeHash,
        canonicalHash(canonicalNodeById.get(node.sourceRootId)));
      assert.strictEqual(node.typedReferences.canonicalRequirementGraphHash,
        proof.expected.expectedGraph.graphHash);
      assert.strictEqual(node.typedReferences.derivationManifestHash, proof.manifest.manifestHash);
    }

    const outNodes = graph.sourceNodes.filter((node) =>
      node.typedReferences?.canonicalProjection?.kind === 'OUT');
    assert.strictEqual(outNodes.length, 27);
    for (const node of outNodes) {
      const canonical = node.typedReferences.canonicalProjection;
      assert.strictEqual(canonical.polarity, 'excluded');
      assert.strictEqual(String(canonical.normativeStrength).toLowerCase(), 'must');
      assert.strictEqual(node.executionRole, 'boundary');
      assert.strictEqual(node.polarity, 'descriptive');
      assert.strictEqual(node.normativeStrength, 'must');
      assert.notStrictEqual(node.scope.kind, 'global');
    }

    const otherNodes = graph.sourceNodes.filter((node) =>
      node.typedReferences?.canonicalProjection?.kind !== 'OUT');
    for (const node of otherNodes) {
      const canonical = node.typedReferences.canonicalProjection;
      assert.strictEqual(node.polarity, canonical.polarity);
      assert.strictEqual(node.normativeStrength, String(canonical.normativeStrength).toLowerCase());
    }

    const semanticSource = {
      kind: 'requirements_semantic_ir',
      schemaVersion: 'requirements-contract-semantic-ir/v2',
      typedSourceAuthority: authority,
      typedSourceGraphHash: authority.graphHash,
      typedAtoms: [],
      typedExecutionConstraints: [],
    };
    const obligations = projectRequirementsTypedGoalObligations(semanticSource, []);
    const projectedOut = obligations.filter((row) => outNodes.some((node) =>
      node.sourceRootId === row.obligationId));
    assert.strictEqual(projectedOut.length, 27);
    assert.ok(projectedOut.every((row) => row.kind === 'OUT'));
    assert.ok(projectedOut.every((row) => row.kind !== 'NEG'));
    assert.ok(projectedOut.every((row) => row.applicability.scope !== 'global'));

    const negNodes = graph.sourceNodes.filter((node) =>
      node.typedReferences?.canonicalProjection?.kind === 'NEG');
    assert.ok(negNodes.length > 0);
    assert.ok(negNodes.every((node) => node.executionRole === 'boundary' && node.polarity === 'forbidden'));
    const projectedNegIds = new Set(negNodes.map((node) => node.sourceRootId));
    assert.ok(obligations.filter((row) => projectedNegIds.has(row.obligationId))
      .every((row) => row.kind === 'NEG'));
    assert.strictEqual(intake.derivationBindings.canonicalRequirementGraphHash,
      'sha256:e3e3d3e5944ec94cbf6a8ca7c9b7ce6daf235ee593e4277a9b632e8f8a51ce08');
  });
});
