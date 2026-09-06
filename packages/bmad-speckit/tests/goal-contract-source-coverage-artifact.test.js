const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  createGoalContractSourceCoverageArtifact,
  validateGoalContractSourceCoverageArtifact,
} = require('../src/utils/goal-contract/control-plane/goal-contract-compiler.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const sha = (character) => `sha256:${character.repeat(64)}`;

function semanticReceipt() {
  return {
    sourcePlanHash: sha('a'),
    sourceObligations: [{
      id: 'REQ-001',
      declaredSourceId: 'REQ-001',
      kind: 'heading_requirement',
      executionRole: 'requirement',
      normativeStrength: 'must',
      polarity: 'required',
      required: true,
      sourceArtifactId: 'source-plan',
      lineStart: 3,
      lineEnd: 4,
      textHash: sha('b'),
      normativeClauses: [{ id: 'clause-1', text: 'MUST preserve output.' }],
      conditions: [{ text: 'when enabled', state: 'unevaluated' }],
      applicability: { scope: 'obligations', obligationRefs: ['REQ-001'] },
      goalTaskRefs: ['WORK-01'],
      acceptanceRefs: ['AC-01'],
      commandRefs: ['CMD-01'],
      evidenceRefs: ['EVD-01'],
      stopConditionRefs: [],
      text: 'REQ-001: MUST preserve output.',
      summary: 'preserve output',
      resolvedCitations: [{ exactText: 'MUST preserve output.' }],
      provenanceRefs: ['block-1'],
      typedRefs: [],
      headingPath: ['Requirements'],
      sourcePlanHash: sha('a'),
      sourcePlanPath: 'docs/plans/source.md',
    }],
    unmappedSourceObligations: [],
    evidenceClassification: 'coverage_only',
    runtimeEvidenceAuthority: false,
    canonicalIntentBundleHash: sha('e'),
    sourceAuthorityBundleHash: sha('f'),
    coverageAudit: { decision: 'pass' },
    implementationProofAudit: { decision: 'pass' },
    sourceClauseCoverageSummaries: [{
      schemaVersion: 'goal-contract-source-clause-coverage/v1',
      sourceArtifactId: 'source-plan',
      sourceSnapshotHash: sha('a'),
      clauseCount: 1,
      clauseSetHash: sha('9'),
      clauseSpans: [{ id: 'clause-1' }],
    }],
  };
}

function artifactInput() {
  return {
    entryScenario: 'standalone_goal_contract',
    sourcePlanPath: 'docs/plans/source.md',
    sourceBytes: 123,
    sourceLines: 7,
    goalContractPath: 'docs/plans/goal.md',
    goalContractHash: sha('c'),
    goalContractDocumentHash: sha('d'),
    coverageReceipt: semanticReceipt(),
  };
}

describe('goal contract source coverage artifact', () => {
  it('publishes a hash-bound minimal source coverage projection', () => {
    const input = artifactInput();
    const artifact = createGoalContractSourceCoverageArtifact(input);
    const semanticRows = input.coverageReceipt.sourceObligations;

    assert.equal(artifact.schemaVersion, 'goal-contract-source-coverage-receipt/v2');
    assert.equal(artifact.projectionMode, 'minimal_hash_bound');
    assert.equal(artifact.sourceObligationCount, semanticRows.length);
    assert.equal(artifact.sourceObligationSetHash, hashControlPlaneValue(semanticRows));
    assert.equal(artifact.coverageRowsHash, hashControlPlaneValue(artifact.sourceObligations));
    assert.deepEqual(artifact.sourceClauseCoverage, [{
      sourceArtifactId: 'source-plan',
      sourceSnapshotHash: sha('a'),
      clauseCount: 1,
      clauseSetHash: sha('9'),
      sourceClauseCoverageSummaryHash: hashControlPlaneValue(
        input.coverageReceipt.sourceClauseCoverageSummaries[0]
      ),
    }]);
    assert.deepEqual(
      validateGoalContractSourceCoverageArtifact(artifact, {
        semanticRows,
        sourceClauseCoverageSummaries: input.coverageReceipt.sourceClauseCoverageSummaries,
      }),
      artifact
    );

    const row = artifact.sourceObligations[0];
    assert.deepEqual(row.goalTaskRefs, ['WORK-01']);
    assert.deepEqual(row.acceptanceRefs, ['AC-01']);
    assert.deepEqual(row.commandRefs, ['CMD-01']);
    assert.deepEqual(row.evidenceRefs, ['EVD-01']);
    for (const field of [
      'semanticRowHash',
      'sourceTextHash',
      'clauseSetHash',
      'conditionSetHash',
      'applicabilityHash',
    ]) assert.match(row[field], /^sha256:[0-9a-f]{64}$/u);
    for (const forbidden of [
      'applicability', 'conditions', 'headingPath', 'normativeClauses',
      'provenanceRefs', 'resolvedCitations', 'sourcePlanHash', 'sourcePlanPath',
      'summary', 'text', 'typedRefs',
    ]) assert.equal(Object.hasOwn(row, forbidden), false, forbidden);
  });

  it('rejects row tampering and semantic round-trip mismatches', () => {
    const input = artifactInput();
    const artifact = structuredClone(createGoalContractSourceCoverageArtifact(input));
    artifact.sourceObligations[0].semanticRowHash = sha('0');
    assert.throws(
      () => validateGoalContractSourceCoverageArtifact(artifact),
      (error) => error.failureClass === 'source_coverage_receipt_invalid'
    );

    const valid = createGoalContractSourceCoverageArtifact(input);
    const changedRows = structuredClone(input.coverageReceipt.sourceObligations);
    changedRows[0].text = 'changed';
    assert.throws(
      () => validateGoalContractSourceCoverageArtifact(valid, { semanticRows: changedRows }),
      (error) => error.failureClass === 'source_coverage_receipt_invalid'
    );
    const changedSummaries = structuredClone(input.coverageReceipt.sourceClauseCoverageSummaries);
    changedSummaries[0].clauseSpans[0].id = 'changed-clause';
    assert.throws(
      () => validateGoalContractSourceCoverageArtifact(valid, {
        sourceClauseCoverageSummaries: changedSummaries,
      }),
      (error) => error.failureClass === 'source_coverage_receipt_invalid'
    );
  });
});
