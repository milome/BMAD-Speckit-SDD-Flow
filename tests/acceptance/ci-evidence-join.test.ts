import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const input = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');
const { writeCanonicalArtifact } = require('../../tools/ci/canonical-artifact.cjs');
const {
  finalizeCiEvidenceWithDiagnostics,
  joinCiEvidence,
  main: joinMain,
  parseCliArgs,
} = require('../../tools/ci/join-ci-evidence.cjs');

function semanticIndex(manifest: any) {
  const tests = manifest.plan.shardPlan.selection.selected.map((item: any) => {
    const shard = manifest.plan.shardPlan.shards.find((candidate: any) =>
      candidate.identityKeys.includes(item.identityKey)
    );
    return {
      identityKey: item.identityKey,
      lane: shard.lane,
      shardId: shard.shardId,
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      targetRefs: [],
      changedPaths: [],
    };
  });
  const body = {
    schemaVersion: 'ci-shard-semantic-index/v1',
    selectionHash: manifest.plan.shardPlan.selectionHash,
    shardPlanHash: manifest.plan.shardPlan.shardPlanHash,
    coverageReportHash:
      manifest.plan.shardPlan.selection.coverageReportHash || `sha256:${'5'.repeat(64)}`,
    catalogHash: manifest.plan.catalogHash,
    changedPathsHash: `sha256:${'7'.repeat(64)}`,
    uncoveredObligationRefs: [],
    obligationBindings: [],
    tests,
    shards: manifest.plan.shardPlan.shards.map((shard: any) => ({
      lane: shard.lane,
      shardId: shard.shardId,
      testCount: shard.identityKeys.length,
      identityKeys: [...shard.identityKeys],
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      modelCoverage: {},
    })),
  };
  return { ...body, semanticIndexHash: sha256Bytes(canonicalJsonBytes(body)) };
}

function fixture() {
  const provisionalManifest = createRunManifestPlan(input);
  const index = semanticIndex(provisionalManifest);
  const manifest = createRunManifestPlan({
    ...input,
    semanticIndexHash: index.semanticIndexHash,
  });
  const laneResults = manifest.plan.shardPlan.shards.map((shard: any) => ({
    lane: shard.lane,
    shardId: shard.shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: manifest.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome: 'passed',
    executedIdentityKeys: [...shard.identityKeys],
  }));
  return { manifest, laneResults };
}

function writeJoinCliArtifacts(repoRoot: string, input: ReturnType<typeof fixture>) {
  writeCanonicalArtifact({
    repoRoot,
    outputDir: '.artifacts/test-portfolio',
    fileName: 'ci-run-manifest.json',
    artifact: input.manifest,
  });
  writeCanonicalArtifact({
    repoRoot,
    outputDir: '.artifacts/test-portfolio',
    fileName: 'ci-shard-semantic-index.json',
    artifact: semanticIndex(input.manifest),
  });
  input.laneResults.forEach((laneResult: any, index: number) => {
    writeCanonicalArtifact({
      repoRoot,
      outputDir: '.artifacts/test-portfolio/lane-results',
      fileName: `${index}.result.json`,
      artifact: laneResult,
    });
  });
}

function expectedFailureFixture() {
  const expectedInput = structuredClone(input);
  const identityKey = 'vitest::tests/feature.test.ts';
  const selection = structuredClone(expectedInput.shardPlan.selection);
  const selectedItem = selection.selected.find((item: any) => item.identityKey === identityKey);
  selectedItem.expectedFailureReasonCode = 'KNOWN_FAILING_TEST_FIXTURE_DRIFT';
  selectedItem.reasonCodes = [...selectedItem.reasonCodes, 'PR_KNOWN_FAILURE_EXECUTION'].sort();
  const timingSummary = summarizeTimingEvents({
    commitSha: expectedInput.repository.commitSha,
    events: expectedInput.timingSummary.runs.flatMap((run: any) => run.events),
  });
  const shardPlan = buildShardPlan({
    selection,
    timingSummary,
    policy: expectedInput.policy,
    expectedCommitSha: expectedInput.repository.commitSha,
    expectedEnvironmentClass: expectedInput.shardPlan.timingBinding.expectedEnvironmentClass,
  });
  Object.assign(expectedInput, {
    selectionHash: shardPlan.selectionHash,
    timingSummary,
    policyHash: sha256Bytes(canonicalJsonBytes(expectedInput.policy)),
    shardPlan,
  });
  const provisionalManifest = createRunManifestPlan(expectedInput);
  const index = semanticIndex(provisionalManifest);
  const manifest = createRunManifestPlan({
    ...expectedInput,
    semanticIndexHash: index.semanticIndexHash,
  });
  const laneResults = manifest.plan.shardPlan.shards.map((shard: any) => ({
    lane: shard.lane,
    shardId: shard.shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: manifest.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome: shard.expectedFailureIdentityKeys ? 'expected_failed' : 'passed',
    executedIdentityKeys: [...shard.identityKeys],
    ...(shard.expectedFailureIdentityKeys
      ? {
          failedIdentityKeys: [...shard.expectedFailureIdentityKeys],
          evidenceStatus: { junit: 'complete', timing: 'complete' },
        }
      : {}),
  }));
  return { identityKey, manifest, laneResults };
}

describe('fail-closed CI Evidence Join', () => {
  it('publishes join exports before the CLI enters circular manifest validation', () => {
    const source = readFileSync('tools/ci/join-ci-evidence.cjs', 'utf8');

    expect(source.indexOf('module.exports = {')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('module.exports = {')).toBeLessThan(
      source.indexOf('if (require.main === module)')
    );
  });

  it('defaults the final manifest to the workflow upload directory', () => {
    expect(
      parseCliArgs([
        '--manifest',
        '.artifacts/test-portfolio/ci-run-manifest.json',
        '--lane-results-dir',
        '.artifacts/test-portfolio/lane-results',
        '--semantic-index',
        '.artifacts/test-portfolio/ci-shard-semantic-index.json',
      ])
    ).toMatchObject({
      'output-dir': '.artifacts/test-portfolio/final',
    });
    expect(() =>
      parseCliArgs([
        '--manifest',
        '.artifacts/test-portfolio/ci-run-manifest.json',
        '--lane-results-dir',
        '.artifacts/test-portfolio/lane-results',
        '--semantic-index',
        '.artifacts/test-portfolio/ci-shard-semantic-index.json',
        '--status-snapshot',
        '.artifacts/test-portfolio/status.json',
        '--expected-attempt-id',
        'attempt-1',
      ])
    ).toThrow('CI_EVIDENCE_JOIN_CLI_ARGS_INVALID');
  });

  it('writes infrastructure diagnostics when lane artifacts are missing or corrupt', () => {
    for (const mode of ['missing', 'corrupt']) {
      const repoRoot = mkdtempSync(join(tmpdir(), `ci-evidence-ingestion-${mode}-`));
      try {
        const input = fixture();
        writeCanonicalArtifact({
          repoRoot,
          outputDir: '.artifacts/test-portfolio',
          fileName: 'ci-run-manifest.json',
          artifact: input.manifest,
        });
        writeCanonicalArtifact({
          repoRoot,
          outputDir: '.artifacts/test-portfolio',
          fileName: 'ci-shard-semantic-index.json',
          artifact: semanticIndex(input.manifest),
        });
        if (mode === 'corrupt') {
          const laneDir = join(repoRoot, '.artifacts/test-portfolio/lane-results');
          mkdirSync(laneDir, { recursive: true });
          writeFileSync(join(laneDir, 'bad.result.json'), '{broken', 'utf8');
        }

        expect(
          joinMain([
            '--manifest',
            '.artifacts/test-portfolio/ci-run-manifest.json',
            '--lane-results-dir',
            '.artifacts/test-portfolio/lane-results',
            '--semantic-index',
            '.artifacts/test-portfolio/ci-shard-semantic-index.json',
          ], repoRoot)
        ).toBe(1);
        const report = JSON.parse(
          readFileSync(
            join(repoRoot, '.artifacts/test-portfolio/final/six-model-ci-diagnostics.json'),
            'utf8'
          )
        );
        expect(report.summary.unattributedFailureCount).toBeGreaterThan(0);
        if (mode === 'corrupt') {
          expect(report.failures).toContainEqual(
            expect.objectContaining({ outcome: 'invalid_lane_result_artifact' })
          );
        }
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  });

  it('writes infrastructure-only diagnostics when the manifest is corrupt', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-corrupt-manifest-'));
    try {
      const artifactDir = join(repoRoot, '.artifacts/test-portfolio');
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, 'ci-run-manifest.json'), '{broken', 'utf8');

      expect(
        joinMain([
          '--manifest',
          '.artifacts/test-portfolio/ci-run-manifest.json',
          '--lane-results-dir',
          '.artifacts/test-portfolio/lane-results',
          '--semantic-index',
          '.artifacts/test-portfolio/ci-shard-semantic-index.json',
        ], repoRoot)
      ).toBe(1);
      const report = JSON.parse(
        readFileSync(
          join(repoRoot, '.artifacts/test-portfolio/final/six-model-ci-diagnostics.json'),
          'utf8'
        )
      );
      expect(report.failures).toContainEqual(
        expect.objectContaining({ outcome: 'invalid_manifest_artifact' })
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('writes infrastructure-only diagnostics when the manifest is canonical but invalid', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-invalid-manifest-'));
    try {
      writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'ci-run-manifest.json',
        artifact: {},
      });

      expect(
        joinMain(
          [
            '--manifest',
            '.artifacts/test-portfolio/ci-run-manifest.json',
            '--lane-results-dir',
            '.artifacts/test-portfolio/lane-results',
            '--semantic-index',
            '.artifacts/test-portfolio/ci-shard-semantic-index.json',
          ],
          repoRoot
        )
      ).toBe(1);
      const report = JSON.parse(
        readFileSync(
          join(repoRoot, '.artifacts/test-portfolio/final/six-model-ci-diagnostics.json'),
          'utf8'
        )
      );
      expect(report.failures).toContainEqual(
        expect.objectContaining({ outcome: 'invalid_manifest_artifact' })
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('validates the manifest before the exported diagnostics helper dereferences it', () => {
    expect(() =>
      finalizeCiEvidenceWithDiagnostics({
        manifest: {},
        laneResults: [],
        semanticIndex: {},
      })
    ).toThrow('CI_MANIFEST_INVALID');
  });

  it.each(['corrupt', 'invalid'])(
    'fails closed when the CLI status snapshot is %s',
    (mode) => {
      const repoRoot = mkdtempSync(join(tmpdir(), `ci-evidence-status-${mode}-`));
      try {
        const input = fixture();
        writeJoinCliArtifacts(repoRoot, input);
        const statusPath = join(repoRoot, '.artifacts/test-portfolio/status.json');
        if (mode === 'corrupt') {
          writeFileSync(statusPath, '{broken', 'utf8');
        } else {
          writeCanonicalArtifact({
            repoRoot,
            outputDir: '.artifacts/test-portfolio',
            fileName: 'status.json',
            artifact: {},
          });
        }

        expect(
          joinMain(
            [
              '--manifest',
              '.artifacts/test-portfolio/ci-run-manifest.json',
              '--lane-results-dir',
              '.artifacts/test-portfolio/lane-results',
              '--semantic-index',
              '.artifacts/test-portfolio/ci-shard-semantic-index.json',
              '--status-snapshot',
              '.artifacts/test-portfolio/status.json',
              '--expected-attempt-id',
              'attempt-1',
              '--expected-source-document-hash',
              `sha256:${'a'.repeat(64)}`,
              '--expected-implementation-confirmation-hash',
              `sha256:${'b'.repeat(64)}`,
              '--expected-semantic-model-hash',
              `sha256:${'c'.repeat(64)}`,
            ],
            repoRoot
          )
        ).toBe(1);

        const report = JSON.parse(
          readFileSync(
            join(repoRoot, '.artifacts/test-portfolio/final/six-model-ci-diagnostics.json'),
            'utf8'
          )
        );
        expect(report.failures).toContainEqual(
          expect.objectContaining({ outcome: 'invalid_status_snapshot_artifact' })
        );
        const finalManifest = JSON.parse(
          readFileSync(
            join(repoRoot, '.artifacts/test-portfolio/final/ci-run-manifest.json'),
            'utf8'
          )
        );
        expect(finalManifest).toMatchObject({
          status: 'failed',
          failure: { issueCode: 'CI_STATUS_SNAPSHOT_ARTIFACT_INVALID' },
        });
      } finally {
        rmSync(repoRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      }
    }
  );

  it('fails closed with infrastructure diagnostics when the semantic index is corrupt', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-corrupt-semantic-index-'));
    try {
      const input = fixture();
      writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'ci-run-manifest.json',
        artifact: input.manifest,
      });
      const semanticPath = join(
        repoRoot,
        '.artifacts/test-portfolio/ci-shard-semantic-index.json'
      );
      writeFileSync(semanticPath, '{broken', 'utf8');

      expect(
        joinMain(
          [
            '--manifest',
            '.artifacts/test-portfolio/ci-run-manifest.json',
            '--lane-results-dir',
            '.artifacts/test-portfolio/lane-results',
            '--semantic-index',
            '.artifacts/test-portfolio/ci-shard-semantic-index.json',
          ],
          repoRoot
        )
      ).toBe(1);
      const report = JSON.parse(
        readFileSync(
          join(repoRoot, '.artifacts/test-portfolio/final/six-model-ci-diagnostics.json'),
          'utf8'
        )
      );
      expect(report.failures).toContainEqual(
        expect.objectContaining({ outcome: 'invalid_semantic_index' })
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('writes diagnostics before recording a failed final manifest', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-diagnostics-'));
    try {
      const input = fixture();
      input.laneResults[0].outcome = 'failed';
      const result = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: input.manifest,
        laneResults: input.laneResults,
        semanticIndex: semanticIndex(input.manifest),
        laneResultRefs: {},
      });

      expect(result.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_REQUIRED_LANE_NOT_PASSED' },
      });
      expect(result.diagnostics.summary.unattributedFailureCount).toBe(1);
      expect(existsSync(result.receipts.diagnostics.json.path)).toBe(true);
      expect(existsSync(result.receipts.diagnostics.markdown.path)).toBe(true);
      expect(existsSync(result.receipts.manifest.path)).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('keeps successful evidence gates unchanged when diagnostics are enabled', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-diagnostics-pass-'));
    try {
      const input = fixture();
      const result = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: input.manifest,
        laneResults: input.laneResults,
        semanticIndex: semanticIndex(input.manifest),
        laneResultRefs: {},
      });

      expect(result.finalized.status).toBe('complete');
      expect(result.finalized.gates).toEqual({
        missingShardCount: 0,
        omittedIdentityCount: 0,
        duplicateExecutionCount: 0,
        unplannedExecutionCount: 0,
        requiredCoreIdentityMissingCount: 0,
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed with unattributed diagnostics for stale semantic and lane evidence', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-stale-bindings-'));
    try {
      const staleIndexInput = fixture();
      const staleIndex = semanticIndex(staleIndexInput.manifest);
      staleIndex.shardPlanHash = `sha256:${'0'.repeat(64)}`;
      const { semanticIndexHash: _oldHash, ...staleBody } = staleIndex;
      staleIndex.semanticIndexHash = sha256Bytes(canonicalJsonBytes(staleBody));
      const staleIndexResult = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: staleIndexInput.manifest,
        laneResults: staleIndexInput.laneResults,
        semanticIndex: staleIndex,
      });
      expect(staleIndexResult.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_SEMANTIC_INDEX_MANIFEST_MISMATCH' },
      });
      expect(staleIndexResult.diagnostics.failures).toContainEqual(
        expect.objectContaining({ identityKey: null, outcome: 'invalid_semantic_index' })
      );

      const staleLaneInput = fixture();
      staleLaneInput.laneResults[0].planHash = `sha256:${'f'.repeat(64)}`;
      const staleLaneResult = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: staleLaneInput.manifest,
        laneResults: staleLaneInput.laneResults,
        semanticIndex: semanticIndex(staleLaneInput.manifest),
      });
      expect(staleLaneResult.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_LANE_PLAN_HASH_MISMATCH' },
      });
      expect(staleLaneResult.diagnostics.summary.unattributedFailureCount).toBeGreaterThan(0);
      expect(
        staleLaneResult.diagnostics.models.flatMap((model: any) =>
          model.obligations.flatMap((obligation: any) =>
            obligation.shards.flatMap((shard: any) => shard.tests)
          )
        )
      ).not.toContainEqual(expect.objectContaining({ outcome: 'passed' }));
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when semantic diagnostics are rewritten and self-rehashed', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-rehashed-semantic-body-'));
    try {
      const input = fixture();
      const { semanticIndexHash: _trustedHash, ...trustedBody } = semanticIndex(input.manifest);
      const forgedBody = {
        ...trustedBody,
        tests: trustedBody.tests.map((test: any, index: number) =>
          index === 0
            ? { ...test, changedPaths: ['src/forged-diagnostic-path.ts'] }
            : test
        ),
      };
      const forgedIndex = {
        ...forgedBody,
        semanticIndexHash: sha256Bytes(canonicalJsonBytes(forgedBody)),
      };

      const result = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: input.manifest,
        laneResults: input.laneResults,
        semanticIndex: forgedIndex,
      });

      expect(result.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_SEMANTIC_INDEX_MANIFEST_MISMATCH' },
      });
      expect(result.diagnostics.failures).toContainEqual(
        expect.objectContaining({ identityKey: null, outcome: 'invalid_semantic_index' })
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects a semantic index whose canonical body no longer matches its bound hash', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-semantic-body-hash-'));
    try {
      const input = fixture();
      const trustedIndex = semanticIndex(input.manifest);
      const forgedIndex = {
        ...trustedIndex,
        tests: trustedIndex.tests.map((test: any, index: number) =>
          index === 0 ? { ...test, changedPaths: ['src/forged-with-stale-hash.ts'] } : test
        ),
      };

      const result = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: input.manifest,
        laneResults: input.laneResults,
        semanticIndex: forgedIndex,
      });

      expect(result.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_SEMANTIC_INDEX_MANIFEST_MISMATCH' },
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('converts duplicate lane results into unattributed diagnostics before finalization', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-evidence-duplicate-lane-'));
    try {
      const input = fixture();
      input.laneResults.push(structuredClone(input.laneResults[0]));

      const result = finalizeCiEvidenceWithDiagnostics({
        repoRoot,
        manifest: input.manifest,
        laneResults: input.laneResults,
        semanticIndex: semanticIndex(input.manifest),
      });

      expect(result.finalized).toMatchObject({
        status: 'failed',
        failure: { issueCode: 'CI_DUPLICATE_SHARD_RESULT' },
      });
      expect(result.diagnostics.failures).toContainEqual(
        expect.objectContaining({ identityKey: null, outcome: 'invalid_lane_evidence' })
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.each(['failed', 'cancelled', 'skipped'])('rejects a required %s lane', (outcome) => {
    const { manifest, laneResults } = fixture();
    laneResults[0].outcome = outcome;

    expect(() => joinCiEvidence({ manifest, laneResults })).toThrow('CI_REQUIRED_LANE_NOT_PASSED');
  });

  it('rejects stale plan hashes and unplanned or duplicate shard results', () => {
    const stale = fixture();
    stale.laneResults[0].planHash = 'sha256:stale';
    expect(() => joinCiEvidence(stale)).toThrow('CI_LANE_PLAN_HASH_MISMATCH');

    const wrongCommit = fixture();
    wrongCommit.laneResults[0].commitSha = 'f'.repeat(40);
    expect(() => joinCiEvidence(wrongCommit)).toThrow('CI_LANE_COMMIT_SHA_MISMATCH');

    const wrongDescriptor = fixture();
    wrongDescriptor.laneResults[0].packageDescriptorHash = `sha256:${'f'.repeat(64)}`;
    expect(() => joinCiEvidence(wrongDescriptor)).toThrow(
      'CI_LANE_PACKAGE_DESCRIPTOR_HASH_MISMATCH'
    );

    const wrongTarball = fixture();
    wrongTarball.laneResults[0].tarballSha256 = `sha256:${'e'.repeat(64)}`;
    expect(() => joinCiEvidence(wrongTarball)).toThrow('CI_LANE_TARBALL_HASH_MISMATCH');

    const unplanned = fixture();
    unplanned.laneResults[0].shardId = 'missing';
    expect(() => joinCiEvidence(unplanned)).toThrow('CI_UNPLANNED_SHARD_RESULT');

    const duplicate = fixture();
    duplicate.laneResults.push(structuredClone(duplicate.laneResults[0]));
    expect(() => joinCiEvidence(duplicate)).toThrow('CI_DUPLICATE_SHARD_RESULT');
  });

  it('rejects missing shards and omitted selected identities', () => {
    const missingShard = fixture();
    missingShard.laneResults.pop();
    expect(() => joinCiEvidence(missingShard)).toThrow('CI_REQUIRED_SHARD_MISSING');

    const omitted = fixture();
    omitted.laneResults[0].executedIdentityKeys.pop();
    expect(() => joinCiEvidence(omitted)).toThrow('CI_SELECTED_TEST_NOT_EXECUTED');
  });

  it('rejects duplicate and globally unplanned execution identities', () => {
    const duplicate = fixture();
    duplicate.laneResults[0].executedIdentityKeys.push(
      duplicate.laneResults[0].executedIdentityKeys[0]
    );
    expect(() => joinCiEvidence(duplicate)).toThrow('CI_TEST_EXECUTED_MORE_THAN_ONCE');

    const unplanned = fixture();
    unplanned.laneResults[0].executedIdentityKeys.push('vitest::tests/unplanned.test.ts');
    expect(() => joinCiEvidence(unplanned)).toThrow('CI_UNPLANNED_TEST_EXECUTED');
  });

  it('rejects cross-shard identity swaps even when global counts still match', () => {
    const swapped = fixture();
    const first = swapped.laneResults[0].executedIdentityKeys[0];
    const second = swapped.laneResults[1].executedIdentityKeys[0];
    swapped.laneResults[0].executedIdentityKeys[0] = second;
    swapped.laneResults[1].executedIdentityKeys[0] = first;

    expect(() => joinCiEvidence(swapped)).toThrow('CI_SHARD_IDENTITY_MISMATCH');
  });

  it('accepts only shard-declared expected failures', () => {
    const expected = expectedFailureFixture();
    expect(joinCiEvidence(expected)).toMatchObject({
      laneResults: expect.arrayContaining([
        expect.objectContaining({
          outcome: 'expected_failed',
          failedIdentityKeys: [expected.identityKey],
        }),
      ]),
    });

    const undeclared = fixture();
    undeclared.laneResults[0].outcome = 'expected_failed';
    undeclared.laneResults[0].failedIdentityKeys = [
      undeclared.laneResults[0].executedIdentityKeys[0],
    ];
    expect(() => joinCiEvidence(undeclared)).toThrow('CI_EXPECTED_FAILURE_NOT_DECLARED');

    const wrongIdentity = expectedFailureFixture();
    const expectedResult = wrongIdentity.laneResults.find(
      (result: any) => result.outcome === 'expected_failed'
    );
    expectedResult.failedIdentityKeys = ['vitest::tests/unplanned.test.ts'];
    expect(() => joinCiEvidence(wrongIdentity)).toThrow('CI_EXPECTED_FAILURE_IDENTITY_MISMATCH');

    const incompleteEvidence = expectedFailureFixture();
    const incompleteResult = incompleteEvidence.laneResults.find(
      (result: any) => result.outcome === 'expected_failed'
    );
    incompleteResult.evidenceStatus.timing = 'partial';
    expect(() => joinCiEvidence(incompleteEvidence)).toThrow(
      'CI_EXPECTED_FAILURE_EVIDENCE_INCOMPLETE'
    );
  });

  it('returns deterministic lane results and all-zero gates', () => {
    const first = fixture();
    const second = fixture();
    second.laneResults.reverse();
    for (const result of second.laneResults) result.executedIdentityKeys.reverse();

    const firstJoin = joinCiEvidence(first);
    const secondJoin = joinCiEvidence(second);
    expect(canonicalJsonBytes(firstJoin)).toEqual(canonicalJsonBytes(secondJoin));
    expect(firstJoin.gates).toEqual({
      missingShardCount: 0,
      omittedIdentityCount: 0,
      duplicateExecutionCount: 0,
      unplannedExecutionCount: 0,
      requiredCoreIdentityMissingCount: 0,
    });
  });
});
