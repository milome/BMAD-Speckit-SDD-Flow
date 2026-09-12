const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { materializeFullFixture } = require('./canonical-full-fixture.cjs');

const fixtureRoot = __dirname;
const repoRoot = path.resolve(fixtureRoot, '..', '..', '..', '..', '..');
const materializedFixture = materializeFullFixture({ copyOracleHelpers: true });
process.on('exit', () => {
  try { fs.rmSync(materializedFixture.root, { recursive: true, force: true }); } catch { /* best effort */ }
});
const legacyPath = materializedFixture.legacySourcePath;
const oraclePath = materializedFixture.expectedOraclePath;
const canonicalPath = materializedFixture.canonicalSourcePath;
const profilePath = path.join(repoRoot, '_bmad', 'shared', 'goal-contract', 'standalone-source-plan-profile.json');
const manifestSession = path.join(fixtureRoot, '.canonical-source-plan-v1-full.derivation-manifest.json.draft');
const graphSession = path.join(fixtureRoot, '.canonical-source-plan-v1-full.expected-graph.json.draft');
const expectedGraphPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.expected-graph.json');
const fixtureReviewPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.fixture-review.json');
const fixtureReviewSession = path.join(fixtureRoot, '.canonical-source-plan-v1-full.fixture-review.json.draft');
const integritySession = path.join(fixtureRoot, '.canonical-source-plan-v1-full.integrity.json.draft');
const requirementsInputRoot = path.join(fixtureRoot, '.canonical-source-plan-v1-full.confirmed-requirements.authoring-input');
const requirementsBundleSession = path.join(requirementsInputRoot, '.authority-bundle.json.draft');
const requirementsBundlePath = path.join(requirementsInputRoot, 'authority-bundle.json');
const requirementsIntakePath = path.join(requirementsInputRoot, 'intake.json');
const bugfixAuthorityPath = path.join(
  repoRoot,
  'docs',
  'plans',
  'BUGFIX-2026-09-07-goal-source-contract-normalization.md'
);
const {
  bindIndependentFixtureReview,
  verifyBoundIndependentFixtureReview,
} = require(path.join(
  repoRoot,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'verify-independent-fixture-review.js'
));

const RELATION_TYPES = {
  ownerRef: 'owned_by', requirementRefs: 'applies_to_requirement', taskRefs: 'implemented_by',
  acceptanceRefs: 'accepted_by', pathRefs: 'uses_path', commandRefs: 'validated_by',
  evidenceRefs: 'evidenced_by', artifactRefs: 'produces_artifact', dependencyRefs: 'depends_on',
  stopRefs: 'guarded_by', producerRef: 'produced_by', consumerRefs: 'consumed_by',
  commandSetRefs: 'includes_command', globalAuthorityRef: 'globally_authorized_by',
};

function invariant(condition, code) {
  if (!condition) throw new Error(code);
}

function sha256(value) {
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
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function selfHash(document, field) {
  const payload = structuredClone(document);
  delete payload[field];
  return canonicalHash(payload);
}

function projectPath(value) {
  const materializedRelative = path.relative(materializedFixture.root, value);
  if (materializedRelative && !materializedRelative.startsWith('..') && !path.isAbsolute(materializedRelative)) {
    return materializedRelative.replaceAll('\\', '/');
  }
  return path.relative(repoRoot, value).replaceAll('\\', '/');
}

function fileIdentity(value) {
  const bytes = fs.readFileSync(value);
  return { path: projectPath(value), byteCount: bytes.length, sha256: sha256(bytes) };
}

function auditFileIdentity(value) {
  const identity = fileIdentity(value);
  return { path: identity.path, bytes: identity.byteCount, sha256: identity.sha256 };
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, 'utf8'));
}

function strings(value) {
  const values = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
  return [...new Set(values.filter((item) => typeof item === 'string' && item.length > 0))].sort();
}

function sourceLines(text) {
  const lines = [];
  let charOffset = 0;
  let byteOffset = 0;
  while (charOffset < text.length) {
    const newline = text.indexOf('\n', charOffset);
    const end = newline === -1 ? text.length : newline + 1;
    const raw = text.slice(charOffset, end);
    const content = raw.replace(/\r?\n$/u, '');
    const byteLength = Buffer.byteLength(raw, 'utf8');
    lines.push({ raw, content, lineNumber: lines.length + 1, startByte: byteOffset, endByteExclusive: byteOffset + byteLength });
    charOffset = end;
    byteOffset += byteLength;
  }
  return lines;
}

function parseCanonicalSource(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const sourceHash = sha256(bytes);
  const lines = sourceLines(text);
  const fences = [];
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^```(standalone-source-plan|standalone-source-plan-node)\s*$/u.exec(lines[index].content);
    if (!opening) continue;
    let closing = index + 1;
    while (closing < lines.length && !/^```\s*$/u.test(lines[closing].content)) closing += 1;
    invariant(closing < lines.length, `canonical_fence_unclosed:${lines[index].lineNumber}`);
    const exactText = lines.slice(index, closing + 1).map((line) => line.raw).join('');
    const body = lines.slice(index + 1, closing).map((line) => line.content).join('\n');
    const startByte = lines[index].startByte;
    const endByteExclusive = lines[closing].endByteExclusive;
    fences.push({
      fenceType: opening[1] === 'standalone-source-plan' ? 'metadata' : 'node',
      data: yaml.load(body),
      lineStart: lines[index].lineNumber,
      lineEnd: lines[closing].lineNumber,
      startByte,
      endByteExclusive,
      exactTextHash: sha256(Buffer.from(exactText, 'utf8')),
      spanId: `SPAN-${sha256(`${sourceHash}:${startByte}:${endByteExclusive}:${exactText}`).slice(7, 23).toUpperCase()}`,
    });
    index = closing;
  }
  return { sourceHash, sourceBytes: bytes.length, fences };
}

function oracleModel() {
  const legacyBytes = fs.readFileSync(legacyPath);
  const oracleBytes = fs.readFileSync(oraclePath);
  const oracle = JSON.parse(oracleBytes.toString('utf8'));
  const blocks = (oracle.sections ?? []).flatMap((section) => section.blocks ?? []);
  invariant(legacyBytes.length === oracle.source.byteCount, 'legacy_source_byte_count_mismatch');
  invariant(sha256(legacyBytes).slice(7) === oracle.source.sha256, 'legacy_source_hash_mismatch');
  let cursor = 0;
  for (const block of blocks) {
    invariant(block.source.byteStart === cursor, `oracle_block_gap:${block.id}:${cursor}`);
    const exact = legacyBytes.subarray(block.source.byteStart, block.source.byteEnd);
    invariant(sha256(exact).slice(7) === block.source.textSha256, `oracle_block_hash_mismatch:${block.id}`);
    invariant(exact.toString('utf8') === block.text, `oracle_block_text_mismatch:${block.id}`);
    cursor = block.source.byteEnd;
  }
  invariant(cursor === legacyBytes.length, `oracle_coverage_incomplete:${cursor}`);
  return { legacyBytes, oracleBytes, oracle, blocks };
}

function canonicalModel() {
  const canonicalBytes = fs.readFileSync(canonicalPath);
  const parsed = parseCanonicalSource(canonicalBytes);
  const metadataFences = parsed.fences.filter((fence) => fence.fenceType === 'metadata');
  const nodeFences = parsed.fences.filter((fence) => fence.fenceType === 'node');
  invariant(metadataFences.length === 1, 'canonical_metadata_count_invalid');
  invariant(nodeFences.length === 825, `canonical_node_count_invalid:${nodeFences.length}`);
  const ids = nodeFences.map((fence) => fence.data.id);
  invariant(new Set(ids).size === ids.length, 'canonical_node_id_duplicate');
  return { canonicalBytes, parsed, metadata: metadataFences[0].data, nodeFences };
}

function buildManifest() {
  const { legacyBytes, oracleBytes, oracle, blocks } = oracleModel();
  const { canonicalBytes, parsed, metadata, nodeFences } = canonicalModel();
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const refsByBlock = new Map(blocks.map((block) => [block.id, []]));
  const partitionsByBlock = new Map();
  const canonicalNodes = nodeFences.map((fence) => {
    const legacySourceBlockRefs = strings(fence.data.legacySourceBlockRefs);
    invariant(legacySourceBlockRefs.length > 0, `canonical_node_source_orphan:${fence.data.id}`);
    for (const blockId of legacySourceBlockRefs) {
      invariant(blockById.has(blockId), `canonical_node_source_missing:${fence.data.id}:${blockId}`);
      refsByBlock.get(blockId).push(fence.data.id);
    }
    for (const partition of fence.data.sourceSpanPartitions ?? []) {
      invariant(blockById.has(partition.blockId), `canonical_partition_block_missing:${partition.spanRef}`);
      if (!partitionsByBlock.has(partition.blockId)) partitionsByBlock.set(partition.blockId, []);
      partitionsByBlock.get(partition.blockId).push({ ...partition, canonicalNodeRef: fence.data.id });
    }
    return {
      canonicalRef: fence.data.id,
      kind: fence.data.kind,
      aliases: strings(fence.data.aliases),
      canonicalSourceSpan: {
        spanId: fence.spanId,
        lineStart: fence.lineStart,
        lineEnd: fence.lineEnd,
        byteStart: fence.startByte,
        byteEndExclusive: fence.endByteExclusive,
        exactTextHash: fence.exactTextHash,
      },
      legacySourceBlockRefs,
      legacySourceSpanSetHash: canonicalHash(legacySourceBlockRefs.map((blockId) => ({
        blockId,
        exactTextHash: blockById.get(blockId).source.textSha256,
      }))),
    };
  }).sort((left, right) => left.canonicalRef.localeCompare(right.canonicalRef));
  const expectedSupersededText = new Map([
    ['B2430', '`goalJudgeDispatchCount=1`'],
    ['B2434', '不得运行第二次authoring semantic Judge'],
  ]);
  const spans = blocks.flatMap((block) => {
    const partitions = [...(partitionsByBlock.get(block.id) ?? [])]
      .sort((left, right) => left.byteStart - right.byteStart);
    if (partitions.length === 0) {
      return [{
        spanId: block.id,
        lineStart: block.source.lineStart,
        lineEnd: block.source.lineEnd,
        byteStart: block.source.byteStart,
        byteEndExclusive: block.source.byteEnd,
        exactTextHash: block.source.textSha256,
        disposition: block.disposition,
        canonicalRefs: strings(refsByBlock.get(block.id)),
        provenanceRefs: [],
        reason: block.reason ?? null,
      }];
    }

    invariant(expectedSupersededText.has(block.id), `canonical_partition_block_unapproved:${block.id}`);
    const clauses = (block.semantics ?? []).filter((clause) =>
      Number.isInteger(clause.byteStart) && Number.isInteger(clause.byteEnd));
    invariant(clauses.length === 1, `canonical_partition_clause_invalid:${block.id}`);
    invariant(partitions[0].byteStart === clauses[0].byteStart,
      `canonical_partition_clause_start_invalid:${block.id}`);
    invariant(partitions.at(-1).byteEndExclusive === clauses[0].byteEnd,
      `canonical_partition_clause_end_invalid:${block.id}`);

    for (let index = 0; index < partitions.length; index += 1) {
      const partition = partitions[index];
      if (index > 0) {
        invariant(partitions[index - 1].byteEndExclusive === partition.byteStart,
          `canonical_partition_gap:${block.id}:${index}`);
      }
      const exact = legacyBytes.subarray(partition.byteStart, partition.byteEndExclusive);
      invariant(exact.toString('utf8') === partition.exactText,
        `canonical_partition_text_mismatch:${partition.spanRef}`);
      invariant(sha256(exact).slice(7) === partition.exactTextHash,
        `canonical_partition_hash_mismatch:${partition.spanRef}`);
      invariant(partition.frozenSourceHash === oracle.source.sha256,
        `canonical_partition_source_hash_mismatch:${partition.spanRef}`);
      const superseded = partition.disposition === 'superseded_by_user_authority';
      invariant(
        superseded
          ? partition.executionEffect === 'non_executable_provenance' &&
            strings(partition.canonicalRefs).length === 0 &&
            typeof partition.provenanceRef === 'string' &&
            partition.supersededByRef === 'docs/plans/BUGFIX-2026-09-07-goal-source-contract-normalization.md#1.4'
          : strings(partition.canonicalRefs).includes(partition.canonicalNodeRef),
        `canonical_partition_disposition_invalid:${partition.spanRef}`
      );
    }

    const superseded = partitions.filter((partition) =>
      partition.disposition === 'superseded_by_user_authority');
    invariant(superseded.length === 1, `canonical_partition_supersession_count_invalid:${block.id}`);
    invariant(superseded[0].exactText === expectedSupersededText.get(block.id),
      `canonical_partition_supersession_text_invalid:${block.id}`);
    const canonicalRefs = strings(refsByBlock.get(block.id));
    const contextSpan = (spanId, byteStart, byteEndExclusive) => ({
      spanId,
      lineStart: block.source.lineStart,
      lineEnd: block.source.lineEnd,
      byteStart,
      byteEndExclusive,
      exactTextHash: sha256(legacyBytes.subarray(byteStart, byteEndExclusive)).slice(7),
      disposition: 'retained_context',
      executionEffect: 'non_executable_provenance',
      canonicalRefs,
      provenanceRefs: [],
      reason: 'mixed_clause_context',
    });
    return [
      ...(block.source.byteStart < partitions[0].byteStart
        ? [contextSpan(`${block.id}:PRE`, block.source.byteStart, partitions[0].byteStart)]
        : []),
      ...partitions.map((partition) => ({
        spanId: partition.spanRef,
        lineStart: block.source.lineStart,
        lineEnd: block.source.lineEnd,
        byteStart: partition.byteStart,
        byteEndExclusive: partition.byteEndExclusive,
        exactTextHash: partition.exactTextHash,
        disposition: partition.disposition,
        executionEffect: partition.executionEffect,
        canonicalRefs: strings(partition.canonicalRefs),
        provenanceRefs: [partition.provenanceRef],
        supersededByRef: partition.supersededByRef ?? null,
        reason: partition.disposition,
      })),
      ...(partitions.at(-1).byteEndExclusive < block.source.byteEnd
        ? [contextSpan(`${block.id}:POST`, partitions.at(-1).byteEndExclusive, block.source.byteEnd)]
        : []),
    ];
  });
  let sourceCursor = 0;
  for (const span of spans) {
    invariant(span.byteStart === sourceCursor, `manifest_span_gap:${span.spanId}:${sourceCursor}`);
    sourceCursor = span.byteEndExclusive;
  }
  invariant(sourceCursor === legacyBytes.length, `manifest_span_coverage_incomplete:${sourceCursor}`);
  const isMapped = (span) => span.canonicalRefs.length > 0 || span.provenanceRefs.length > 0;
  const unmappedNormativeSpans = spans.filter((span) => span.disposition === 'normative' && span.canonicalRefs.length === 0).length;
  const unmappedSourceSpans = spans.filter((span) => !isMapped(span)).length;
  const orphanSemanticNodes = canonicalNodes.filter((node) => node.legacySourceBlockRefs.length === 0).length;
  const supersededSpans = spans.filter((span) => span.disposition === 'superseded_by_user_authority');
  invariant(unmappedNormativeSpans === 0, `manifest_normative_span_unmapped:${unmappedNormativeSpans}`);
  invariant(unmappedSourceSpans === 0, `manifest_source_span_unmapped:${unmappedSourceSpans}`);
  invariant(orphanSemanticNodes === 0, `manifest_semantic_node_orphan:${orphanSemanticNodes}`);
  invariant(supersededSpans.length === 2, `manifest_superseded_span_count_invalid:${supersededSpans.length}`);
  invariant(supersededSpans.every((span) => span.canonicalRefs.length === 0),
    'manifest_superseded_span_became_canonical');
  const manifest = {
    schemaVersion: 'canonical-source-plan-derivation-manifest/v1',
    derivationPolicy: {
      semanticAuthority: 'frozen_legacy_source_plus_independent_oracle_plus_explicit_user_supersession',
      userSupersessionAuthorityRef: 'docs/plans/BUGFIX-2026-09-07-goal-source-contract-normalization.md#1.4',
      productionExtractorOutputUsed: false,
      productionGoalExecutionIrUsed: false,
      productionGoalContractUsed: false,
      businessCommandsExecuted: 0,
    },
    source: { path: path.basename(legacyPath), byteCount: legacyBytes.length, sha256: sha256(legacyBytes), blockCount: blocks.length },
    independentOracle: { path: path.basename(oraclePath), byteCount: oracleBytes.length, sha256: sha256(oracleBytes), schemaVersion: oracle.schemaVersion },
    canonicalSource: { path: path.basename(canonicalPath), byteCount: canonicalBytes.length, sha256: parsed.sourceHash, sourcePlanId: metadata.sourcePlanId },
    summary: {
      sourceSpanCount: spans.length,
      sourceBlockCount: blocks.length,
      canonicalNodeCount: canonicalNodes.length,
      mappedSourceSpans: spans.length - unmappedSourceSpans,
      unmappedSourceSpans,
      unmappedNormativeSpans,
      orphanSemanticNodes,
      supersededSpanCount: supersededSpans.length,
      supersededCanonicalObligationCount: supersededSpans.filter((span) => span.canonicalRefs.length > 0).length,
    },
    spans,
    canonicalNodes,
    manifestHash: '',
  };
  manifest.manifestHash = selfHash(manifest, 'manifestHash');
  return manifest;
}

function buildExpectedGraph(manifest) {
  invariant(manifest.manifestHash === selfHash(manifest, 'manifestHash'), 'manifest_self_hash_invalid');
  const { parsed, metadata, nodeFences } = canonicalModel();
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const manifestRefs = new Set(manifest.canonicalNodes.map((node) => node.canonicalRef));
  invariant(nodeFences.every((fence) => manifestRefs.has(fence.data.id)), 'expected_graph_manifest_node_mismatch');
  const referenceFields = Object.keys(profile.referenceFields);
  const nodes = nodeFences.map((fence) => {
    const data = fence.data;
    const references = Object.fromEntries(referenceFields
      .filter((field) => field !== 'ownerRef' && strings(data[field]).length > 0)
      .map((field) => [field, strings(data[field])]));
    const excluded = new Set(['kind', 'id', 'title', 'statement', 'normativeStrength', 'polarity', 'applicability', 'scope', 'aliases', 'ownerRef', ...referenceFields]);
    const attributes = Object.fromEntries(Object.entries(data).filter(([field]) => !excluded.has(field)));
    return {
      id: data.id, kind: data.kind, title: data.title, statement: data.statement,
      normativeStrength: data.normativeStrength, polarity: data.polarity,
      applicability: data.applicability, scope: data.scope, aliases: strings(data.aliases),
      ownerRef: typeof data.ownerRef === 'string' ? data.ownerRef : null,
      references, attributes, sourceSpanRefs: [fence.spanId],
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const relations = nodeFences.flatMap((fence) => referenceFields.flatMap((field) =>
    strings(fence.data[field]).map((toRef) => {
      const type = RELATION_TYPES[field];
      invariant(type, `expected_graph_relation_type_missing:${field}`);
      return {
        id: `REL-${sha256(`${type}:${fence.data.id}:${toRef}:${fence.data.scope}`).slice(7, 23).toUpperCase()}`,
        type, fromRef: fence.data.id, toRef, scope: fence.data.scope, sourceSpanRefs: [fence.spanId],
      };
    }))).sort((left, right) => left.id.localeCompare(right.id));
  const aliases = nodeFences.flatMap((fence) => strings(fence.data.aliases).map((alias) => ({
    alias, canonicalRef: fence.data.id, sourceSpanRefs: [fence.spanId],
  }))).sort((left, right) => left.alias.localeCompare(right.alias));
  const graph = {
    schemaVersion: 'CanonicalRequirementGraph/v1',
    sourcePlanId: metadata.sourcePlanId,
    sourcePlanVersion: metadata.sourcePlanVersion,
    goal: metadata.goal,
    scope: strings(metadata.scope),
    nonGoals: strings(metadata.nonGoals),
    nodes,
    relations,
    aliases,
    graphHash: '',
  };
  const semanticGraph = {
    ...graph,
    nodes: nodes.map(({ sourceSpanRefs: _sourceSpanRefs, ...node }) => node),
    relations: relations.map(({ sourceSpanRefs: _sourceSpanRefs, ...relation }) => relation),
    aliases: aliases.map(({ sourceSpanRefs: _sourceSpanRefs, ...alias }) => alias),
  };
  delete semanticGraph.graphHash;
  graph.graphHash = canonicalHash(semanticGraph);
  const expected = {
    schemaVersion: 'canonical-source-plan-expected-graph/v1',
    derivationAuthority: {
      manifestHash: manifest.manifestHash,
      canonicalSourceHash: parsed.sourceHash,
      profileHash: profile.profileHash,
      productionCompilerOutputUsed: false,
    },
    nodeCount: nodes.length,
    relationCount: relations.length,
    aliasCount: aliases.length,
    expectedGraph: graph,
    expectedDocumentHash: '',
  };
  expected.expectedDocumentHash = selfHash(expected, 'expectedDocumentHash');
  return expected;
}

function buildFixtureReview(reportPaths, dispositionPath, provenance, reviewEpoch = 'phase5-canonical-full-independent') {
  const manifestPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.derivation-manifest.json');
  const manifest = readJson(manifestPath);
  const expected = readJson(expectedGraphPath);
  const profile = readJson(profilePath);
  invariant(manifest.manifestHash === selfHash(manifest, 'manifestHash'), 'fixture_review_manifest_hash_invalid');
  invariant(expected.expectedDocumentHash === selfHash(expected, 'expectedDocumentHash'), 'fixture_review_expected_hash_invalid');
  invariant(expected.derivationAuthority.manifestHash === manifest.manifestHash,
    'fixture_review_manifest_binding_invalid');
  invariant(expected.derivationAuthority.profileHash === profile.profileHash,
    'fixture_review_profile_binding_invalid');
  const bindings = {
    legacySource: fileIdentity(legacyPath),
    independentOracle: fileIdentity(oraclePath),
    canonicalSource: fileIdentity(canonicalPath),
    derivationManifest: fileIdentity(manifestPath),
    expectedGraph: fileIdentity(expectedGraphPath),
    profile: fileIdentity(profilePath),
    manifestHash: manifest.manifestHash,
    expectedDocumentHash: expected.expectedDocumentHash,
    canonicalRequirementGraphHash: expected.expectedGraph.graphHash,
    profileHash: profile.profileHash,
  };
  const artifacts = [
    bugfixAuthorityPath,
    legacyPath,
    oraclePath,
    canonicalPath,
    manifestPath,
    expectedGraphPath,
    profilePath,
    __filename,
  ].map(auditFileIdentity);
  return bindIndependentFixtureReview({
    projectRoot: repoRoot,
    reviewEpoch,
    artifacts,
    reportPaths,
    dispositionPath,
    provenance,
    bindings,
  });
}

function buildIntegrity() {
  const manifestPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.derivation-manifest.json');
  const manifest = readJson(manifestPath);
  const expected = readJson(expectedGraphPath);
  const review = verifyBoundIndependentFixtureReview({
    projectRoot: repoRoot,
    review: readJson(fixtureReviewPath),
  });
  const profile = readJson(profilePath);
  invariant(manifest.manifestHash === selfHash(manifest, 'manifestHash'), 'integrity_manifest_hash_invalid');
  invariant(expected.expectedDocumentHash === selfHash(expected, 'expectedDocumentHash'), 'integrity_expected_hash_invalid');
  invariant(review.reviewHash === selfHash(review, 'reviewHash') && review.reviewStatus === 'confirmed',
    'integrity_review_invalid');
  const artifacts = {
    legacySource: fileIdentity(legacyPath),
    independentOracle: fileIdentity(oraclePath),
    canonicalSource: fileIdentity(canonicalPath),
    derivationManifest: fileIdentity(manifestPath),
    expectedGraph: fileIdentity(expectedGraphPath),
    fixtureReview: fileIdentity(fixtureReviewPath),
    profile: fileIdentity(profilePath),
  };
  for (const [name, identity] of Object.entries(artifacts)) {
    const reviewed = review.bindings[name];
    if (reviewed) invariant(reviewed.byteCount === identity.byteCount && reviewed.sha256 === identity.sha256,
      `integrity_review_binding_stale:${name}`);
  }
  const integrity = {
    schemaVersion: 'canonical-source-plan-integrity/v1',
    artifacts,
    semanticBindings: {
      manifestHash: manifest.manifestHash,
      expectedDocumentHash: expected.expectedDocumentHash,
      canonicalRequirementGraphHash: expected.expectedGraph.graphHash,
      fixtureReviewHash: review.reviewHash,
      profileHash: profile.profileHash,
    },
    completeness: {
      sourceSpanCount: manifest.summary.sourceSpanCount,
      sourceBlockCount: manifest.summary.sourceBlockCount,
      canonicalNodeCount: manifest.summary.canonicalNodeCount,
      mappedSourceSpans: manifest.summary.mappedSourceSpans,
      unmappedSourceSpans: manifest.summary.unmappedSourceSpans,
      unmappedNormativeSpans: manifest.summary.unmappedNormativeSpans,
      orphanSemanticNodes: manifest.summary.orphanSemanticNodes,
      supersededSpanCount: manifest.summary.supersededSpanCount,
      supersededCanonicalObligationCount: manifest.summary.supersededCanonicalObligationCount,
    },
    derivationAssurances: {
      canonicalFixtureSelfContained: true,
      productionExtractorOutputUsedToDefineExpected: false,
      productionGoalExecutionIrUsedToDefineExpected: false,
      productionGoalContractUsedToDefineExpected: false,
      sourceBytesRewritten: false,
      standaloneImplementationConfirmationInjected: false,
    },
    reviewStatus: review.reviewStatus,
    readyForConfirmedRequirementsDerivation: true,
    integrityHash: '',
  };
  invariant(integrity.completeness.unmappedNormativeSpans === 0 &&
    integrity.completeness.orphanSemanticNodes === 0, 'integrity_completeness_invalid');
  integrity.integrityHash = selfHash(integrity, 'integrityHash');
  return integrity;
}

function stripPhysicalProvenance(value) {
  const physicalKeys = new Set([
    'legacySource', 'sourceBinding', 'sourcePath', 'sourceArtifactRef', 'byteStart', 'byteEnd',
    'startByte', 'endByteExclusive', 'sourceLine', 'lineStart', 'lineEnd', 'physicalLocator',
  ]);
  if (Array.isArray(value)) return value.map(stripPhysicalProvenance);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !physicalKeys.has(key))
    .map(([key, child]) => [key, stripPhysicalProvenance(child)]));
}

function compactCanonicalAttributes(value) {
  const compacted = stripPhysicalProvenance(value ?? {});
  for (const key of ['clauses', 'legacySourceBlockRefs', 'sourceSpanPartitions', 'associationBasis']) {
    delete compacted[key];
  }
  return compacted;
}

function requirementExecutionRole(kind) {
  if (kind === 'TASK') return 'action';
  if (['REQ', 'NFR'].includes(kind)) return 'requirement';
  if (['NEG', 'OUT'].includes(kind)) return 'boundary';
  if (kind === 'AC') return 'acceptance';
  return 'binding';
}

function requirementPolarity(node) {
  return node.kind === 'OUT' && node.polarity === 'excluded' ? 'descriptive' : node.polarity;
}

function taskDependenciesByAction(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const taskIds = new Set(graph.nodes.filter((node) => node.kind === 'TASK').map((node) => node.id));
  const dependencies = new Map([...taskIds].map((taskId) => [taskId, []]));
  for (const taskId of taskIds) {
    for (const relation of graph.relations.filter((row) =>
      row.type === 'depends_on' && row.fromRef === taskId)) {
      const dependency = nodeById.get(relation.toRef);
      invariant(dependency, `requirements_bundle_dependency_node_missing:${relation.toRef}`);
      invariant(dependency.kind === 'DEP', `requirements_bundle_dependency_node_kind_invalid:${relation.toRef}`);
      invariant(dependency.ownerRef === taskId, `requirements_bundle_dependency_owner_mismatch:${relation.toRef}`);
      const ownedBy = strings(graph.relations.filter((row) =>
        row.type === 'owned_by' && row.fromRef === dependency.id).map((row) => row.toRef));
      invariant(ownedBy.length === 1 && ownedBy[0] === taskId,
        `requirements_bundle_dependency_owned_by_mismatch:${relation.toRef}`);
      const producerId = dependency.attributes?.dependency;
      invariant(typeof producerId === 'string' && producerId.length > 0,
        `requirements_bundle_dependency_producer_missing:${relation.toRef}`);
      invariant(nodeById.get(producerId)?.kind === 'TASK',
        `requirements_bundle_dependency_producer_kind_invalid:${relation.toRef}`);
      invariant(producerId !== taskId, `requirements_bundle_dependency_self_reference:${relation.toRef}`);
      const taskRefs = strings(dependency.references?.taskRefs);
      invariant(taskRefs.includes(taskId) && taskRefs.includes(producerId),
        `requirements_bundle_dependency_task_refs_mismatch:${relation.toRef}`);
      const implementedBy = strings(graph.relations.filter((row) =>
        row.type === 'implemented_by' && row.fromRef === dependency.id).map((row) => row.toRef));
      invariant(implementedBy.includes(taskId) && implementedBy.includes(producerId),
        `requirements_bundle_dependency_implemented_by_mismatch:${relation.toRef}`);
      dependencies.get(taskId).push(producerId);
    }
    dependencies.set(taskId, strings(dependencies.get(taskId)));
  }
  const visitState = new Map();
  const visit = (taskId) => {
    invariant(visitState.get(taskId) !== 'visiting', `requirements_bundle_dependency_cycle:${taskId}`);
    if (visitState.get(taskId) === 'visited') return;
    visitState.set(taskId, 'visiting');
    for (const dependencyId of dependencies.get(taskId)) visit(dependencyId);
    visitState.set(taskId, 'visited');
  };
  for (const taskId of taskIds) visit(taskId);
  return dependencies;
}

function list(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textRows(value, fallback) {
  const rows = list(value).map((entry) => typeof entry === 'string' ? entry : entry?.text)
    .filter((entry) => typeof entry === 'string' && entry.trim());
  return (rows.length ? rows : [fallback]).map((entry) => ({ text: entry }));
}

function immutableJsonWrite(target, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (fs.existsSync(target)) {
    invariant(fs.readFileSync(target).equals(bytes), `immutable_authoring_input_conflict:${path.basename(target)}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  return { path: projectPath(target), byteCount: bytes.length, sha256: sha256(bytes) };
}

function buildRequirementsBundle() {
  const manifestPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.derivation-manifest.json');
  const integrityPath = path.join(fixtureRoot, 'canonical-source-plan-v1-full.integrity.json');
  const manifest = readJson(manifestPath);
  const expected = readJson(expectedGraphPath);
  const integrity = readJson(integrityPath);
  verifyBoundIndependentFixtureReview({
    projectRoot: repoRoot,
    review: readJson(fixtureReviewPath),
  });
  invariant(manifest.manifestHash === selfHash(manifest, 'manifestHash'), 'requirements_bundle_manifest_invalid');
  invariant(expected.expectedDocumentHash === selfHash(expected, 'expectedDocumentHash'), 'requirements_bundle_expected_invalid');
  invariant(integrity.integrityHash === selfHash(integrity, 'integrityHash') && integrity.reviewStatus === 'confirmed',
    'requirements_bundle_integrity_invalid');
  invariant(integrity.semanticBindings.manifestHash === manifest.manifestHash &&
    integrity.semanticBindings.expectedDocumentHash === expected.expectedDocumentHash,
  'requirements_bundle_proof_binding_invalid');

  const legacyBytes = fs.readFileSync(legacyPath);
  const spansByCanonicalRef = new Map();
  for (const span of manifest.spans) {
    for (const ref of strings(span.canonicalRefs)) {
      const rows = spansByCanonicalRef.get(ref) ?? [];
      rows.push(span);
      spansByCanonicalRef.set(ref, rows);
    }
  }
  const graph = expected.expectedGraph;
  const blockIdByNode = new Map(graph.nodes.map((node, index) =>
    [node.id, `RBLOCK-${String(index + 1).padStart(4, '0')}`]));
  const canonicalNodeHashes = new Map(graph.nodes.map((node) => [node.id, canonicalHash(node)]));
  const sourceRoots = graph.nodes.map((node) => {
    const spans = spansByCanonicalRef.get(node.id) ?? [];
    invariant(spans.length > 0, `requirements_bundle_source_span_missing:${node.id}`);
    const span = spans.find((candidate) => candidate.disposition !== 'superseded_by_user_authority') ?? spans[0];
    const exact = legacyBytes.subarray(span.byteStart, span.byteEndExclusive);
    invariant(exact.length > 0 && sha256(exact) === `sha256:${span.exactTextHash}`,
      `requirements_bundle_source_span_invalid:${node.id}`);
    const conditions = node.applicability?.mode === 'conditional' && typeof node.applicability.condition === 'string'
      ? [{ kind: 'source_condition', text: node.applicability.condition }]
      : [];
    const canonicalProjection = stripPhysicalProvenance({
      id: node.id,
      kind: node.kind,
      title: node.title,
      statement: node.statement,
      normativeStrength: node.normativeStrength,
      polarity: node.polarity,
      applicability: node.applicability,
      scope: node.scope,
      aliases: node.aliases,
      ownerRef: node.ownerRef,
      attributes: compactCanonicalAttributes(node.attributes),
    });
    return {
      sourceRootId: node.id,
      rootClass: 'typed_source_node',
      proposedAuthorityClass: 'source_authority',
      bodySchemaVersion: 'requirements-contract-source-node/v2',
      semanticBody: {
        schemaVersion: 'requirements-contract-source-node/v2',
        executionRole: requirementExecutionRole(node.kind),
        text: exact.toString('utf8'),
        polarity: requirementPolarity(node),
        normativeStrength: String(node.normativeStrength).toLowerCase(),
        conditions,
        scope: {
          kind: node.scope === 'global' ? 'global' : 'canonical_owner',
          ...(node.ownerRef ? { ownerId: node.ownerRef } : {}),
        },
        declaredIds: strings([node.id, ...strings(node.aliases)]),
        sourceBlockId: blockIdByNode.get(node.id),
        sourceDisposition: `canonical_${String(node.kind).toLowerCase()}`,
        expectedOutcome: { kind: 'canonical_statement', assertionText: node.statement },
        typedReferences: {
          canonicalProjection,
          canonicalNodeHash: canonicalNodeHashes.get(node.id),
          canonicalRequirementGraphHash: graph.graphHash,
          derivationManifestHash: manifest.manifestHash,
        },
      },
      sourceBinding: {
        sourceArtifactRef: 'frozen-real-source-plan-20260904',
        byteStart: span.byteStart,
        byteEnd: span.byteEndExclusive,
        textSha256: span.exactTextHash,
      },
    };
  });
  const sourceBlocks = sourceRoots.map((root) => ({
    id: root.semanticBody.sourceBlockId,
    text: root.semanticBody.text,
    disposition: root.semanticBody.sourceDisposition,
    scope: root.semanticBody.scope,
    definedId: root.sourceRootId,
  }));
  const taskOwnersByConstraint = new Map();
  for (const task of graph.nodes.filter((node) => node.kind === 'TASK')) {
    for (const field of ['commandRefs', 'pathRefs', 'evidenceRefs', 'artifactRefs', 'dependencyRefs', 'stopRefs']) {
      for (const ref of strings(task.references?.[field])) {
        const owners = taskOwnersByConstraint.get(ref) ?? [];
        owners.push(task.id);
        taskOwnersByConstraint.set(ref, strings(owners));
      }
    }
  }
  const commandDeclarations = graph.nodes.filter((node) => node.kind === 'CMD')
    .flatMap((node) => {
      const expression = node.attributes?.command ?? node.attributes?.expression;
      if (typeof expression !== 'string' || !expression.trim()) return [];
      const owner = taskOwnersByConstraint.get(node.id)?.[0] ?? node.ownerRef ?? 'GLOBAL';
      return [{
        id: node.id,
        role: 'verification_command',
        expression,
        owner,
        blockId: blockIdByNode.get(node.id),
        worktree: node.attributes?.workingDirectory ?? '.',
        expectedExit: node.attributes?.passCriteria ?? 'exit code 0',
      }];
    });
  const executableCommandIds = new Set(commandDeclarations.map((command) => command.id));
  const pathNodes = new Map(graph.nodes.filter((node) => node.kind === 'PATH').map((node) => [node.id, node]));
  const dependenciesByTask = taskDependenciesByAction(graph);
  const workDeclarations = graph.nodes.filter((node) => node.kind === 'TASK').map((task) => {
    const referencedPaths = strings(task.references?.pathRefs).map((ref) => pathNodes.get(ref)).filter(Boolean);
    const pathValues = referencedPaths.map((node) =>
      node.attributes?.path ?? node.attributes?.logicalPath ?? node.statement).filter((value) => typeof value === 'string');
    const declaredProductPaths = list(task.attributes?.productPaths).filter((value) => typeof value === 'string');
    const declaredTestPaths = list(task.attributes?.testPaths).filter((value) => typeof value === 'string');
    const inferredTests = pathValues.filter((value) => /(?:^|\/)tests?\//u.test(value));
    const inferredProducts = pathValues.filter((value) => !/(?:^|\/)tests?\//u.test(value));
    return {
      id: task.id,
      blockIds: [blockIdByNode.get(task.id)],
      commandIds: strings(task.references?.commandRefs).filter((id) => executableCommandIds.has(id)),
      dependencies: dependenciesByTask.get(task.id),
      productPaths: strings([...declaredProductPaths, ...inferredProducts]),
      testPaths: strings([...declaredTestPaths, ...inferredTests]),
      pass: textRows(task.attributes?.pass, task.statement),
      steps: textRows(task.attributes?.steps, task.statement),
    };
  });
  const acceptedByTask = new Map(graph.nodes.filter((node) => node.kind === 'TASK').map((task) =>
    [task.id, new Set(strings(task.references?.acceptanceRefs))]));
  const scenarioDeclarations = graph.nodes.filter((node) => node.kind === 'AC').map((scenario) => ({
    id: scenario.id,
    works: [...acceptedByTask.entries()].filter(([, refs]) => refs.has(scenario.id)).map(([taskId]) => taskId).sort(),
    commandIds: strings(scenario.references?.commandRefs).filter((id) => executableCommandIds.has(id)),
    pass: textRows(scenario.attributes?.pass ?? scenario.attributes?.then, scenario.statement),
  }));
  const relationKind = (kind) => kind === 'includes_command' ? 'command_set_includes' : kind;
  const sourceRelations = graph.relations.map((relation) => ({
    relationId: relation.id,
    kind: relationKind(relation.type),
    from: relation.fromRef,
    to: relation.toRef,
    blockId: blockIdByNode.get(relation.fromRef),
  }));
  const payload = {
    sourceRoots,
    sourceRelations,
    sourceBlocks,
    commandDeclarations,
    workDeclarations,
    scenarioDeclarations,
    fixDeclarations: [],
    sections: [{ id: 0, scope: 'canonical-full', orderedPosition: 0 }],
  };
  const { encodeGoalSemanticDictionary } = require(path.join(repoRoot, 'packages', 'bmad-speckit', 'dist',
    'utils', 'goal-contract', 'control-plane', 'goal-semantic-dictionary.js'));
  const bundle = {
    schemaVersion: 'requirements-contract-authority-bundle/v2',
    evidenceClass: 'reviewed-independent-canonical-derivation',
    sourceArtifact: {
      artifactId: 'frozen-real-source-plan-20260904',
      path: projectPath(legacyPath),
      bytes: legacyBytes.length,
      sha256: sha256(legacyBytes).slice(7),
    },
    payloadDictionary: encodeGoalSemanticDictionary(payload),
  };
  const intake = {
    schemaVersion: 'requirements-contract-authoring-intake/v1',
    evidenceClass: 'reviewed-independent-canonical-derivation',
    derivationBindings: {
      canonicalSource: fileIdentity(canonicalPath),
      derivationManifest: fileIdentity(manifestPath),
      expectedGraph: fileIdentity(expectedGraphPath),
      integrity: fileIdentity(integrityPath),
      manifestHash: manifest.manifestHash,
      expectedDocumentHash: expected.expectedDocumentHash,
      canonicalRequirementGraphHash: graph.graphHash,
      integrityHash: integrity.integrityHash,
    },
    authoritySources: [{
      path: projectPath(requirementsBundlePath),
      rootClass: 'source_bundle',
      proposedAuthorityClass: 'source_authority',
      bodySchemaVersion: 'requirements-contract-authority-bundle/v2',
    }],
  };
  return { bundle, intake, summary: {
    sourceRootCount: sourceRoots.length,
    sourceRelationCount: sourceRelations.length,
    sourceBlockCount: sourceBlocks.length,
    commandDeclarationCount: commandDeclarations.length,
    workDeclarationCount: workDeclarations.length,
    scenarioDeclarationCount: scenarioDeclarations.length,
  } };
}

function writeChunk(sessionRoot, sectionId, value, compact = false) {
  const json = `${JSON.stringify(value, null, compact ? 0 : 2)}\n`;
  const content = `<!-- large-document-writer chunkId=001 sectionId=${sectionId} begin -->\n${json}<!-- large-document-writer chunkId=001 sectionId=${sectionId} end -->\n`;
  const output = path.join(sessionRoot, 'chunk-001-content.json');
  fs.writeFileSync(output, content, 'utf8');
  return { output, bytes: fs.statSync(output).size, sha256: sha256(fs.readFileSync(output)) };
}

const mode = process.argv[2];
const optionValues = (name) => process.argv.slice(3).flatMap((value, index, values) =>
  value === name && typeof values[index + 1] === 'string' ? [values[index + 1]] : []);
const optionValue = (name) => optionValues(name)[0];
if (mode === '--manifest') {
  const manifest = buildManifest();
  process.stdout.write(`${JSON.stringify({ ...writeChunk(manifestSession, 'document', manifest), summary: manifest.summary, manifestHash: manifest.manifestHash }, null, 2)}\n`);
} else if (mode === '--expected-graph') {
  const manifestPath = path.join(manifestSession, 'assembled.md');
  invariant(fs.existsSync(manifestPath), 'manifest_assembly_missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = buildExpectedGraph(manifest);
  process.stdout.write(`${JSON.stringify({ ...writeChunk(graphSession, 'document', expected), nodeCount: expected.nodeCount, relationCount: expected.relationCount, aliasCount: expected.aliasCount, graphHash: expected.expectedGraph.graphHash, expectedDocumentHash: expected.expectedDocumentHash }, null, 2)}\n`);
} else if (mode === '--fixture-review') {
  const reportPaths = optionValues('--audit-report');
  const dispositionPath = optionValue('--disposition');
  invariant(reportPaths.length === 3, 'independent_fixture_audit_report_set_missing');
  invariant(Boolean(dispositionPath), 'independent_fixture_disposition_missing');
  const provenance = {
    recordPath: optionValue('--provenance-record'),
    eventLogPath: optionValue('--provenance-event-log'),
    receiptDir: optionValue('--provenance-receipt-dir'),
    reportEventIds: optionValues('--report-event-id'),
    dispositionEventId: optionValue('--disposition-event-id'),
  };
  const reviewEpoch = optionValue('--review-epoch') || 'phase5-canonical-full-independent';
  invariant(Boolean(provenance.recordPath) && Boolean(provenance.eventLogPath) && Boolean(provenance.receiptDir) &&
    provenance.reportEventIds.length === 3 && Boolean(provenance.dispositionEventId),
    'independent_fixture_provenance_missing');
  const review = buildFixtureReview(reportPaths, dispositionPath, provenance, reviewEpoch);
  process.stdout.write(`${JSON.stringify({ ...writeChunk(fixtureReviewSession, 'document', review), reviewStatus: review.reviewStatus, reviewHash: review.reviewHash, perspectiveCount: review.perspectives.length }, null, 2)}\n`);
} else if (mode === '--integrity') {
  const integrity = buildIntegrity();
  process.stdout.write(`${JSON.stringify({ ...writeChunk(integritySession, 'document', integrity), reviewStatus: integrity.reviewStatus, integrityHash: integrity.integrityHash, completeness: integrity.completeness }, null, 2)}\n`);
} else if (mode === '--requirements-bundle') {
  const { bundle, intake, summary } = buildRequirementsBundle();
  const intakeIdentity = immutableJsonWrite(requirementsIntakePath, intake);
  process.stdout.write(`${JSON.stringify({ ...writeChunk(requirementsBundleSession, 'document', bundle, true), intake: intakeIdentity, summary }, null, 2)}\n`);
} else {
  throw new Error('Use --manifest, --expected-graph, --fixture-review, --integrity, or --requirements-bundle.');
}
