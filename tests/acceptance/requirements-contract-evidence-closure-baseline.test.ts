import { describe, expect, it } from 'vitest';
import {
  loadBaselineFileIndex,
  loadExploitCorpus,
  sha256CanonicalJson,
} from './helpers/requirements-contract-evidence-closure-fixture';

const REQUIRED_EXPLOIT_CLASSES = [
  'all_to_all_mappings',
  'command_id_substring_coverage',
  'duplicate_confirmation_blocks',
  'empty_must_input',
  'fabricated_receipt_counts',
  'fenced_yaml',
  'generated_evidence_text',
  'missing_command',
  'missing_neg',
  'missing_out',
  'missing_provenance',
  'missing_target',
  'mixed_attempt_delivery_evidence',
  'semantic_mutation',
  'stale_packet_replay',
  'status_done',
  'synthetic_closeout_source',
] as const;

const REQUIRED_SOURCE_OBLIGATIONS = Array.from(
  { length: 23 },
  (_item, index) => `S${String(index + 1).padStart(3, '0')}`
);

describe('G00 requirements-contract evidence-closure baseline', () => {
  it('freezes every confirmed false-accept exploit with stable expected outcomes', () => {
    const corpus = loadExploitCorpus();

    expect(corpus.schemaVersion).toBe('requirements-contract-evidence-closure-exploit-corpus/v1');
    expect(corpus.cases.map((item) => item.exploitClass).sort()).toEqual(
      [...REQUIRED_EXPLOIT_CLASSES].sort()
    );

    const caseIds = new Set<string>();
    const sourceHashes = new Set<string>();
    for (const item of corpus.cases) {
      expect(item.caseId).toMatch(/^G00-EXP-\d{3}$/);
      expect(caseIds.has(item.caseId), `duplicate caseId ${item.caseId}`).toBe(false);
      caseIds.add(item.caseId);

      expect(item.expectedTerminalState).toMatch(/^(blocked|unresolved|expected_red)$/);
      expect(item.expectedIssueCode).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(item.sourceObligationIds.length).toBeGreaterThan(0);
      expect(item.sourceHash).toBe(sha256CanonicalJson(item.source));
      expect(sourceHashes.has(item.sourceHash), `duplicate sourceHash ${item.sourceHash}`).toBe(
        false
      );
      sourceHashes.add(item.sourceHash);
    }
  });

  it('covers every frozen source obligation from S001 through S023', () => {
    const corpus = loadExploitCorpus();
    const covered = new Set(corpus.cases.flatMap((item) => item.sourceObligationIds));

    expect([...covered].sort()).toEqual(REQUIRED_SOURCE_OBLIGATIONS);
  });

  it('recomputes the complete pre-edit repository baseline and dirty-path projection', () => {
    const baseline = loadBaselineFileIndex();
    const entryPaths = baseline.entries.map((entry) => entry.path);
    const dirtyProjection = baseline.entries
      .filter((entry) => entry.dirtyClass !== 'tracked_clean')
      .map((entry) => ({
        path: entry.path,
        dirtyClass: entry.dirtyClass,
        pathRole: entry.pathRole,
        exists: entry.exists,
        bytes: entry.bytes,
        sha256: entry.sha256,
      }));
    const pathSetHash = baseline.hashText(entryPaths.join('\n'));
    const fileIndexHash = baseline.hashJson(baseline.entries);
    const preExistingDirtyPathHashesHash = baseline.hashJson(baseline.preExistingDirtyPaths);
    const baselineSnapshotHash = baseline.hashJson({
      repositoryIdentity: baseline.repositoryIdentity,
      pathSetHash,
      fileIndexHash,
      preExistingDirtyPathHashesHash,
    });

    expect(baseline.schemaVersion).toBe('requirements-contract-g00-baseline-file-index/v1');
    expect(new Set(entryPaths).size).toBe(entryPaths.length);
    expect(baseline.summary).toMatchObject({
      entryCount: baseline.entries.length,
      trackedCount: baseline.entries.filter((entry) => entry.tracked).length,
      untrackedCount: baseline.entries.filter((entry) => !entry.tracked).length,
      trackedCleanCount: baseline.entries.filter((entry) => entry.dirtyClass === 'tracked_clean')
        .length,
      trackedDirtyCount: baseline.entries.filter(
        (entry) => entry.tracked && entry.dirtyClass !== 'tracked_clean'
      ).length,
      preExistingDirtyCount: baseline.preExistingDirtyPaths.length,
      missingTrackedCount: baseline.entries.filter((entry) => entry.tracked && !entry.exists)
        .length,
      pathSetHash,
      fileIndexHash,
      preExistingDirtyPathHashesHash,
      baselineSnapshotHash,
    });
    expect(baseline.preExistingDirtyPaths).toEqual(dirtyProjection);
    expect(baseline.repositoryIdentity.gitHeadSha).toMatch(/^[a-f0-9]{40}$/);
    expect(baseline.repositoryIdentity.contractHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(baseline.repositoryIdentity.dependencyLockHashes).toContainEqual({
      path: 'package-lock.json',
      sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });
});
