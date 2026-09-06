const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
process.on('uncaughtException', (error) => {
  process.stderr.write(JSON.stringify({ message: error.message, phase: error.phase,
    validationErrors: error.validationErrors?.slice(0, 5), lineStart: error.lineStart,
    sourceExcerpt: error.sourceExcerpt?.slice(0, 300), matchedPhrase: error.matchedPhrase,
    keys: Object.keys(error) }));
  process.exitCode = 1;
});
const base = path.join(process.cwd(), 'packages/bmad-speckit/src/utils/goal-contract/control-plane');
const { compileOrderedSourceSnapshotSet } = require(path.join(base, 'source-snapshot.ts'));
const { compileSourceCompositionPolicy } = require(path.join(base, 'source-composition-policy.ts'));
const { compileCompositeSourceAuthorityBundle } = require(path.join(base, 'composite-source-authority-bundle.ts'));
const { compileCanonicalIntent, verifyCanonicalIntentBundle, canonicalIntentSemanticsProjection } = require(path.join(base, 'canonical-intent-compiler.ts'));
const { hashControlPlaneValue } = require(path.join(base, 'canonical-hash.ts'));
const { authorityRecord } = require('../../../packages/bmad-speckit/tests/goal-contract-canonical-intent-fixture.js');
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
if (request.operation === 'legacy-source-coverage-receipt') {
  const { createGoalContractSourceCoverageReceipt, normalizeGoalContractSourceCoverageMappings } = require(path.join(base, 'goal-contract-compiler.ts'));
  const rows = normalizeGoalContractSourceCoverageMappings([{ id: 'GH-R01', goalTaskRefs: ['GH-T01'],
    acceptanceRefs: ['ACC-01'], commandRefs: ['CMD-01'], evidenceRefs: request.mutation ? [] : ['EVD-01'] }]);
  try {
    const value = createGoalContractSourceCoverageReceipt({ sourcePlanHash: `sha256:${'1'.repeat(64)}`,
      sourceObligations: rows, coverageAudit: { decision: 'pass', unmappedSourceObligations: [] } });
    process.stdout.write(JSON.stringify({ accepted: true, rows: value.sourceObligations }));
  } catch (error) { process.stdout.write(JSON.stringify({ error: error.message, field: error.field })); }
  return;
}
let frozenFixtureHash;
if (['real-fixture', 'real-source-coverage-receipt', 'real-renderer'].includes(request.operation)) {
  const bytes = fs.readFileSync('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md');
  frozenFixtureHash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== 214296 || frozenFixtureHash !== '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a') {
    throw new Error('real_source_fixture_hash_mismatch');
  }
  request.sourceText = bytes.toString('utf8');
}
if (request.operation === 'real-renderer') {
  const { buildSourceSnapshot } = require(path.join(base, '../dual-view-derivation.ts'));
  const { extractSourceObligations } = require(path.join(base, '../source-obligation-extractor.ts'));
  const { buildSlotData } = require(path.join(base, '../slot-data-builder.ts'));
  const { renderGoalContract } = require('../../../_bmad/shared/goal-contract/scripts/render-goal-contract.js');
  const source = extractSourceObligations({ snapshot: buildSourceSnapshot({ sourceType: 'source_plan',
    sourcePath: 'packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md', rawBytes: Buffer.from(request.sourceText) }) });
  const conditionsHash = hashControlPlaneValue(source.sourceObligations.map(row => row.conditions));
  const profile = JSON.parse(fs.readFileSync('_bmad/shared/goal-contract/goal-contract-profile.json', 'utf8'));
  const templateText = fs.readFileSync('_bmad/shared/goal-contract/goal-execution-contract-template.md', 'utf8');
  const built = buildSlotData({ source, profile, outPath: 'test-only/plan.md',
    coverageReceiptPath: 'test-only/coverage.json', generationReceiptPath: 'test-only/generation.json' });
  try {
    const result = renderGoalContract({ templateText, profile, slotData: built.slotData, generationMode: 'source_plan_strict',
      coverageReceipt: { sourcePlanHash: source.sourcePlanHash, sourceObligations: built.registries.sourceObligations, unmappedSourceObligations: [] } });
    const sourceIds = source.sourceObligations.map(row => row.id).sort();
    const registryIds = built.registries.sourceObligations.map(row => row.id).sort();
    const quotedConditions = source.sourceObligations.flatMap(row => row.conditions || []).map(condition =>
      ['- Condition (unevaluated):', '', ...String(condition.text).split(/\r?\n/u).map(line => `  > ${line}`), ''].join('\n'));
    process.stdout.write(JSON.stringify({ accepted: true, sourceSha256: frozenFixtureHash, coverageDecision: result.audit.coverageDecision,
      sourceObligationCount: result.audit.sourceObligationCount, renderedBytes: Buffer.byteLength(result.document),
      domainAddendaBytes: Buffer.byteLength(built.slotData.domainAddenda),
      authorityIdsConserved: new Set(sourceIds).size === sourceIds.length && new Set(registryIds).size === registryIds.length &&
        hashControlPlaneValue(sourceIds) === hashControlPlaneValue(registryIds) && result.audit.sourceObligationCount === sourceIds.length,
      sourceAuthorityIdsHash: hashControlPlaneValue(sourceIds), registryIdsHash: hashControlPlaneValue(registryIds),
      conditionTextPreserved: conditionsHash === hashControlPlaneValue(source.sourceObligations.map(row => row.conditions)),
      allConditionQuotesRendered: quotedConditions.every(quote => result.document.includes(quote)),
      evidenceClass: 'test-only-renderer-authority-conservation-not-extraction-oracle', judgeDispatchCount: 0 }));
  } catch (error) { process.stdout.write(JSON.stringify({ error: error.message, sourceSha256: frozenFixtureHash })); }
  return;
}

function inputs(sourceText) {
  const sourceCompositionPolicy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord('single_source', [], hashControlPlaneValue),
  });
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({ sources: [{
    sourceKind: 'source_plan', sourceArtifactId: 'test-only-source', sourceRole: 'primary_implementation_authority',
    namespace: 'PRIMARY', sourceOrder: 0, pathOrSegmentId: 'test-only/source.md', rawBytes: Buffer.from(sourceText, 'utf8'),
  }] });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({ sourceCompositionPolicy,
    orderedSourceSnapshotSet, primarySource: { role: 'primary_implementation_authority', namespace: 'PRIMARY',
      sourceArtifactId: 'test-only-source', ownedSemanticDomains: ['test-only'], parentTaskRefs: [] }, subordinateSources: [] });
  return { sourceCompositionPolicy, orderedSourceSnapshotSet, compositeSourceAuthorityBundle, authorityState: 'candidate_only' };
}

function compositeInputs() {
  const binding = { role: 'subordinate_component_specification', namespace: 'COMPONENT', sourceArtifactId: 'test-only-component',
    parentTaskRefs: ['PARENT-T01'], requiredRequirementIds: ['COMPONENT-REQ-001'], requiredTaskIds: ['COMPONENT-T01'] };
  const sourceCompositionPolicy = compileSourceCompositionPolicy({ authorityRecord: authorityRecord('composite_required', [binding], hashControlPlaneValue) });
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({ sources: [
    { sourceKind: 'source_plan', sourceArtifactId: 'test-only-main', sourceRole: 'primary_implementation_authority', namespace: 'PRIMARY',
      sourceOrder: 0, pathOrSegmentId: 'test-only/main.md', rawBytes: Buffer.from('# Main\n- REQ-MAIN: MUST retain main outputs.\n'
        + '- PARENT-T01 references COMPONENT-REQ-001 references COMPONENT-T01\n- REQ-SHARED: MUST retain main stage.\n') },
    { sourceKind: 'source_plan', sourceArtifactId: binding.sourceArtifactId, sourceRole: binding.role, namespace: binding.namespace,
      sourceOrder: 1, pathOrSegmentId: 'test-only/component.md', rawBytes: Buffer.from('# Component\n- COMPONENT-REQ-001: MUST retain component outputs.\n'
        + '- COMPONENT-T01: MUST verify component outputs.\n- COMPONENT-REQ-OTHER: MUST preserve the second handler.\n- COMPONENT-SHARED: MUST retain component stage.\n') },
  ] });
  const compositeSourceAuthorityBundle = compileCompositeSourceAuthorityBundle({ sourceCompositionPolicy, orderedSourceSnapshotSet,
    primarySource: { role: 'primary_implementation_authority', namespace: 'PRIMARY', sourceArtifactId: 'test-only-main', ownedSemanticDomains: ['main'], parentTaskRefs: [] },
    subordinateSources: [{ ...binding, ownedSemanticDomains: ['component'] }] });
  return { sourceCompositionPolicy, orderedSourceSnapshotSet, compositeSourceAuthorityBundle, authorityState: 'candidate_only' };
}

function rehashV2(bundle) {
  bundle.sourceObligationGraph.obligations = bundle.canonicalIntentIR;
  bundle.sourceObligationGraph.crossSourceReferenceEdges = bundle.canonicalIntentIR.filter((row) => row.ownership === 'cross_source_reference')
    .map((row) => ({ fromId: row.intentRecordId,
      toId: bundle.canonicalIntentIR.find((owner) => owner.ownership === 'owned_obligation' && owner.declaredSourceId === row.referenceTargetId).intentRecordId,
      targetId: row.referenceTargetId })).sort((left, right) => `${left.fromId}|${left.toId}|${left.targetId}`.localeCompare(`${right.fromId}|${right.toId}|${right.targetId}`, 'en'));
  bundle.sourceObligationGraphHash = hashControlPlaneValue(bundle.sourceObligationGraph);
  bundle.canonicalIntentSemanticHash = hashControlPlaneValue({ schemaVersion: 'goal-contract-canonical-intent-semantics/v2',
    sourceCompositionPolicyHash: bundle.sourceCompositionPolicyHash, orderedSourceSnapshotSetHash: bundle.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: bundle.sourceAuthorityBundleHash, canonicalIntentIR: bundle.canonicalIntentIR,
    specSpanRegistryHash: bundle.specSpanRegistry.specSpanRegistryHash, sourceObligationGraphHash: bundle.sourceObligationGraphHash,
    subordinateCoverage: bundle.subordinateCoverage });
  const { canonicalIntentBundleHash: _bundleHash, ...payload } = bundle;
  bundle.canonicalIntentBundleHash = hashControlPlaneValue(payload);
}

if (request.operation === 'baseline-schema-hash') {
  const result = spawnSync('git', ['show', 'a4df0e09746fd2dbe605b6cb68ffd74eccb5de02:_bmad/shared/goal-contract/goal-contract-canonical-intent-bundle.schema.json'],
    { encoding: null, windowsHide: true, maxBuffer: 64 * 1024 });
  if (result.status !== 0) throw new Error('baseline_schema_read_failed');
  process.stdout.write(JSON.stringify({ bytes: result.stdout.length,
    sha256: `sha256:${crypto.createHash('sha256').update(result.stdout).digest('hex')}`,
    crlfSha256: `sha256:${crypto.createHash('sha256').update(result.stdout.toString('utf8').replace(/\r?\n/g, '\r\n')).digest('hex')}` }));
} else {
  const sourceInputs = request.operation === 'composite-source-mutation' ? compositeInputs() : inputs(request.sourceText);
  const bundle = compileCanonicalIntent(sourceInputs);
  if (['source-coverage-receipt', 'real-source-coverage-receipt'].includes(request.operation)) {
    const { resolveSpecSpan } = require(path.join(base, 'spec-span-registry.ts'));
    const { makeRegistries } = require(path.join(base, '../slot-data-builder.ts'));
    const { createGoalContractSourceCoverageArtifact, createGoalContractSourceCoverageReceipt,
      normalizeGoalContractSourceCoverageMappings } = require(path.join(base, 'goal-contract-compiler.ts'));
    const source = bundle.canonicalIntentIR.map((record) => {
      const citations = record.specSpanRefs.map(specSpanId => resolveSpecSpan({ registry: bundle.specSpanRegistry, specSpanId }));
      const first = citations[0];
      const snapshot = bundle.specSpanRegistry.sourceSnapshots.find(row => row.sourceArtifactId === record.sourceArtifactId);
      const span = bundle.specSpanRegistry.specSpans.find(row => row.specSpanId === record.specSpanRefs[0]);
      return { id: record.sourceRootId, kind: record.sourceKind, text: first.exactText, summary: record.requiredOutcome,
        headingPath: span.headingPath, sourcePlanPath: snapshot.pathOrSegmentId, sourcePlanHash: record.sourceSnapshotHash,
        lineStart: span.startLine, lineEnd: span.endLine, textHash: first.exactTextHash,
        canonicalIntentRecordId: record.intentRecordId, declaredSourceId: record.declaredSourceId,
        classification: record.classification, ownership: record.ownership, sourceArtifactId: record.sourceArtifactId,
        sourceSnapshotHash: record.sourceSnapshotHash, sourceRole: record.sourceRole, namespace: record.namespace,
        specSpanRefs: [...record.specSpanRefs], parentTaskRefs: [], dependencyRefs: [...record.dependencyRefs],
        ...canonicalIntentSemanticsProjection(record), resolvedCitations: citations };
    }).sort((left, right) => left.resolvedCitations[0].startByte - right.resolvedCitations[0].startByte ||
      left.canonicalIntentRecordId.localeCompare(right.canonicalIntentRecordId, 'en'));
    const rows = normalizeGoalContractSourceCoverageMappings(makeRegistries(normalizeGoalContractSourceCoverageMappings(source)).sourceObligations);
    const sourceExtractor = require(path.join(base, '../source-obligation-extractor.ts'));
    const clauseCoverage = sourceExtractor.extractSourceObligations({
      snapshot: bundle.specSpanRegistry.sourceSnapshots[0],
    });
    const beforeHash = hashControlPlaneValue(rows);
    if (request.mutation === 'remove-action') rows.splice(rows.findIndex(row => row.executionRole === 'action'), 1);
    if (request.mutation === 'downgrade-action') Object.assign(rows.find(row => row.executionRole === 'action'), { executionRole: 'definition', commandRefs: [], goalTaskRefs: [] });
    if (request.mutation === 'add-command') rows[0].commandRefs.push('CMD-FORGED');
    if (request.mutation === 'drop-condition') rows.find(row => row.conditions.length).conditions = [];
    if (request.mutation === 'forge-text') rows[0].text = 'Forged source text';
    if (request.mutation === 'strip-role') delete rows[0].executionRole;
    try {
      const receipt = createGoalContractSourceCoverageReceipt({ sourcePlanHash: source[0].sourcePlanHash,
        sourceObligations: rows, coverageAudit: { decision: 'pass', unmappedSourceObligations: [], orphanGeneratedRefs: [], blockingReasons: [] },
        sourceClauseCoverageSummaries: clauseCoverage.sourceClauseCoverageSummary,
        ...(request.mutation === 'omit-source-authority' ? {} : { canonicalIntentBundle: bundle,
          compositeSourceAuthorityBundle: sourceInputs.compositeSourceAuthorityBundle }) });
      const snapshot = bundle.specSpanRegistry.sourceSnapshots[0];
      const coverageArtifact = createGoalContractSourceCoverageArtifact({
        entryScenario: 'standalone_goal_contract', sourcePlanPath: snapshot.pathOrSegmentId,
        sourceBytes: snapshot.sourceBytes, sourceLines: snapshot.sourceLines,
        goalContractPath: 'test-only/goal.md', goalContractHash: hashControlPlaneValue({ goal: 'semantic' }),
        goalContractDocumentHash: hashControlPlaneValue({ goal: 'document' }), coverageReceipt: receipt,
      });
      process.stdout.write(JSON.stringify({ accepted: true, evidenceClassification: receipt.evidenceClassification,
        runtimeEvidenceAuthority: receipt.runtimeEvidenceAuthority, count: rows.length,
        preserved: beforeHash === hashControlPlaneValue(receipt.sourceObligations),
        inventedStopRefs: rows.filter(row => row.stopConditionRefs.includes('STOP002')).length,
        actionIds: rows.filter(row => row.executionRole === 'action').map(row => row.id),
        sourceSha256: frozenFixtureHash, proofDecision: receipt.implementationProofAudit?.decision,
        clauseCount: clauseCoverage.sourceClauseCoverageSummary.clauseCount,
        semanticClauseCount: rows.reduce((sum, row) => sum + row.normativeClauses.length, 0),
        sourceClauseCoverageHash: clauseCoverage.sourceClauseCoverageSummary.clauseSetHash,
        coverageArtifactSchemaVersion: coverageArtifact.schemaVersion,
        coverageArtifactBytes: Buffer.byteLength(JSON.stringify(coverageArtifact), 'utf8'),
        semanticReceiptBytes: Buffer.byteLength(JSON.stringify(receipt), 'utf8'),
        coverageArtifactRowKeyCount: Object.keys(coverageArtifact.sourceObligations[0]).length,
        coverageArtifactHeavyFieldCount: coverageArtifact.sourceObligations.reduce((count, row) => count +
          ['normativeClauses', 'resolvedCitations', 'provenanceRefs', 'applicability', 'text'].filter(field =>
            Object.hasOwn(row, field)).length, 0),
        coverageArtifactClauseCount: coverageArtifact.sourceClauseCoverage.reduce((count, summary) =>
          count + summary.clauseCount, 0),
      }));
    } catch (error) { process.stdout.write(JSON.stringify({ error: error.message, field: error.field, sourceObligationId: error.sourceObligationId })); }
    return;
  }
  if (request.operation === 'composite-source-mutation') {
    const mutated = structuredClone(bundle);
    if (request.mutation === 'same-id-other-snapshot') {
      mutated.canonicalIntentIR = mutated.canonicalIntentIR.filter((row) => !(row.declaredSourceId === 'REQ-SHARED' && row.sourceArtifactId === 'test-only-main'));
      mutated.canonicalIntentIR.find((row) => row.declaredSourceId === 'COMPONENT-SHARED').sourceRootId = 'REQ-SHARED';
    } else if (request.mutation === 'undeclared-cross-reference') {
      const row = mutated.canonicalIntentIR.find((record) => record.ownership === 'cross_source_reference');
      row.referenceTargetId = 'COMPONENT-REQ-OTHER';
      row.sourceRootId = `${row.sourceRootId.split(':reference:')[0]}:reference:COMPONENT-REQ-OTHER`;
    } else if (request.mutation === 'missing-cross-reference') {
      mutated.canonicalIntentIR.splice(mutated.canonicalIntentIR.findIndex((row) => row.ownership === 'cross_source_reference'), 1);
    }
    rehashV2(mutated);
    try { verifyCanonicalIntentBundle(mutated); process.stdout.write(JSON.stringify({ accepted: true })); }
    catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); }
    return;
  }
  if (request.operation === 'real-fixture') {
    verifyCanonicalIntentBundle(bundle);
    const { makeRegistries } = require(path.join(base, '../slot-data-builder.ts'));
    const registries = makeRegistries(bundle.canonicalIntentIR.map((record) => ({
      ...canonicalIntentSemanticsProjection(record), id: record.sourceRootId, kind: record.sourceKind,
      declaredSourceId: record.declaredSourceId, text: record.requiredOutcome,
    })));
    process.stdout.write(JSON.stringify({ evidenceClass: 'test-only-real-source-canonical-regression',
      sourceSha256: frozenFixtureHash, schemaVersion: bundle.schemaVersion, recordCount: bundle.canonicalIntentIR.length,
      executionTaskIds: registries.tasks, semanticOnlyCount: bundle.canonicalIntentIR.filter((row) => row.executionRole !== 'action').length,
      missingSemantics: bundle.canonicalIntentIR.filter((row) => !row.executionRole || !row.applicability || !Array.isArray(row.normativeClauses)).length,
      commandIds: registries.commands, commandDeclarationCount: new Set(bundle.canonicalIntentIR.flatMap((row) =>
        row.commandDeclarations.map((declaration) => declaration.id))).size,
      fixtureOracleAccepted: false, judgeDispatchCount: 0 }));
    return;
  }
  if (request.operation === 'source-semantic-mutation') {
    const mutated = structuredClone(bundle);
    const row = mutated.canonicalIntentIR[0];
    if (request.mutation === 'permission-promoted') {
      Object.assign(row, { normativeStrength: 'must', polarity: 'required', executionRole: 'action', required: true });
    } else if (request.mutation === 'conditions-removed') row.conditions = [];
    else if (request.mutation === 'missing-source-record') mutated.canonicalIntentIR.shift();
    else if (request.mutation === 'duplicate-source-record') mutated.canonicalIntentIR.push(structuredClone(row));
    rehashV2(mutated);
    try { verifyCanonicalIntentBundle(mutated); process.stdout.write(JSON.stringify({ accepted: true })); }
    catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); }
    return;
  }
  if (request.operation === 'v1-protocol-fixture') {
    // This is a generated protocol fixture, not a historical freeze or user confirmation.
    const v1 = structuredClone(bundle);
    v1.schemaVersion = 'goal-contract-canonical-intent-bundle/v1';
    v1.compilerIdentity.compilerVersion = 'goal-contract-canonical-intent-compiler/v1';
    v1.compilerIdentity.schemaArtifactHashes.find((row) => row.schemaName === 'goal-contract-canonical-intent-bundle.schema.json')
      .schemaArtifactHash = request.mutateSchemaHash ? `sha256:${'0'.repeat(64)}` : 'sha256:afbcdfebbf511ffe2c0962904e50a6e72f9cff8ccc5ad5dc97b6624afb8c9665';
    const { compilerIdentityHash: _identityHash, ...identity } = v1.compilerIdentity;
    v1.compilerIdentity.compilerIdentityHash = hashControlPlaneValue(identity);
    v1.canonicalIntentIR = v1.canonicalIntentIR.map((row) => {
      for (const field of Object.keys(canonicalIntentSemanticsProjection(row))) delete row[field];
      row.polarity = 'positive';
      if (request.addV2Field) row.executionRole = 'guidance';
      return row;
    });
    v1.sourceObligationGraph.obligations = v1.canonicalIntentIR;
    v1.sourceObligationGraphHash = hashControlPlaneValue(v1.sourceObligationGraph);
    v1.canonicalIntentSemanticHash = hashControlPlaneValue({ schemaVersion: 'goal-contract-canonical-intent-semantics/v1',
      sourceCompositionPolicyHash: v1.sourceCompositionPolicyHash, orderedSourceSnapshotSetHash: v1.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: v1.sourceAuthorityBundleHash, canonicalIntentIR: v1.canonicalIntentIR,
      specSpanRegistryHash: v1.specSpanRegistry.specSpanRegistryHash, sourceObligationGraphHash: v1.sourceObligationGraphHash,
      subordinateCoverage: v1.subordinateCoverage });
    const { canonicalIntentBundleHash: _bundleHash, ...payload } = v1;
    v1.canonicalIntentBundleHash = hashControlPlaneValue(payload);
    try {
      const verified = verifyCanonicalIntentBundle(v1);
      process.stdout.write(JSON.stringify({ evidenceClass: 'test-only-v1-protocol-fixture',
        verified: true, unchanged: verified.canonicalIntentSemanticHash === v1.canonicalIntentSemanticHash }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ error: error.message }));
    }
    return;
  }
  verifyCanonicalIntentBundle(bundle);
  process.stdout.write(JSON.stringify({ schemaVersion: bundle.schemaVersion, compilerVersion: bundle.compilerIdentity.compilerVersion,
    semanticHash: bundle.canonicalIntentSemanticHash, records: bundle.canonicalIntentIR,
    graphObligations: bundle.sourceObligationGraph.obligations }));
}
