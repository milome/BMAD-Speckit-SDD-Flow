import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDataGovernanceGate } from '../../scripts/main-agent-data-governance-gate';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

function writeJsonl(file: string, rows: Record<string, unknown>[]): void {
  writeFileSync(
    file,
    rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '',
    'utf8'
  );
}

function sample(id: string, groupKey: string, assignment = 'train'): Record<string, unknown> {
  return {
    sample_id: id,
    sample_version: 'v1',
    source: {
      run_id: `run-${id}`,
      stage: 'implementation',
      flow: 'requirement_record_governed',
      event_ids: [`event-${id}`],
      artifact_refs: [{ path: 'evidence.json', content_hash: `sha256:${id}` }],
    },
    messages: [
      { role: 'system', content: 'Use controlled evidence only.' },
      { role: 'user', content: `Close ${id}.` },
      { role: 'assistant', content: `Evidence ${id}.` },
    ],
    metadata: { schema_targets: ['openai_chat'], sample_kind: 'implementation' },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 100,
      raw_phase_score: 100,
      trace_completeness: 'complete',
      training_ready: true,
      training_blockers: [],
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: true,
      token_estimate: 100,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: null,
      content_hash: `sha256:content-${id}`,
      source_hash: SOURCE_HASH,
      source_path: 'docs/design/example.md',
      patch_ref: null,
      lineage: [id],
      generated_at: '2026-05-19T12:00:00.000Z',
    },
    split: {
      assignment,
      seed: 42,
      strategy: 'requirement_record_hash_v1',
      group_key: groupKey,
    },
    redaction: { status: 'clean', applied_rules: [], findings: [], redacted_fields: [] },
    export_compatibility: {
      openai_chat: { compatible: true, reasons: [], warnings: [] },
      hf_conversational: { compatible: true, reasons: [], warnings: [] },
      hf_tool_calling: { compatible: false, reasons: ['no_tools'], warnings: [] },
    },
  };
}

function writeFixture(
  root: string,
  options: { splitLeak?: boolean; contaminationLeak?: boolean } = {}
) {
  const recordId = 'REQ-DATA-GOVERNANCE';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const dataDir = path.join(base, 'data');
  const outDir = path.join(dataDir, 'governance');
  mkdirSync(dataDir, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId,
        requirementSetId: recordId,
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  writeJsonl(path.join(dataDir, 'canonical-samples.jsonl'), [
    sample('sample-a', 'story-1', 'train'),
    sample('sample-b', 'story-2', 'train'),
    sample(
      'sample-c',
      options.splitLeak ? 'story-1' : 'story-3',
      options.splitLeak ? 'test' : 'train'
    ),
    options.contaminationLeak
      ? {
          ...sample('sample-contaminated', 'story-4', 'train'),
          messages: [
            { role: 'system', content: 'Use controlled evidence only.' },
            { role: 'user', content: 'contaminated_holdout_marker' },
            { role: 'assistant', content: 'unsafe' },
          ],
        }
      : sample('sample-d', 'story-4', 'train'),
  ]);
  writeJsonl(path.join(dataDir, 'sample-routes.jsonl'), [
    {
      sampleRouteId: 'route-a',
      mentorEventId: 'event-a',
      destination: 'sft_positive',
      sftEligible: true,
      reasons: [],
    },
    {
      sampleRouteId: 'route-holdout',
      mentorEventId: 'event-holdout',
      destination: 'eval',
      sftEligible: false,
      reasons: ['requirement_not_closed:TRACE-X'],
    },
    {
      sampleRouteId: 'route-contamination',
      mentorEventId: 'event-contamination',
      destination: 'quarantine',
      sftEligible: false,
      reasons: ['contamination_detected'],
    },
  ]);
  return { recordPath, dataDir, outDir };
}

describe('main-agent data governance gate', () => {
  it('passes and writes split, dedup, contamination, holdout, and regression artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'data-governance-pass-'));
    try {
      const fixture = writeFixture(root);
      const code = mainDataGovernanceGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--out-dir',
        fixture.outDir,
        '--generated-at',
        '2026-05-19T12:00:00.000Z',
        '--generated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      for (const file of [
        'split-policy.yaml',
        'dedup-policy.yaml',
        'contamination-policy.yaml',
        'regression-eval-spec.yaml',
        'holdout-registry.json',
        'split-report.json',
        'dedup-report.json',
        'contamination-report.json',
        'post-training-eval-report.json',
        'data-governance-gate-report.json',
      ]) {
        expect(existsSync(path.join(fixture.outDir, file))).toBe(true);
      }
      const report = JSON.parse(
        readFileSync(path.join(fixture.outDir, 'data-governance-gate-report.json'), 'utf8')
      );
      expect(report.decision).toBe('pass');
      expect(report.checks.split.policy).toMatchObject({
        evalFirst: true,
        holdoutFrozenBeforeSftExport: true,
      });
      expect(report.checks.postTrainingRegression).toMatchObject({
        trainingLossOnlyRejected: true,
        releaseDecision: 'blocked_until_training_run_bound',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the same group key leaks across train and test splits', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'data-governance-split-leak-'));
    try {
      const fixture = writeFixture(root, { splitLeak: true });
      const code = mainDataGovernanceGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--out-dir',
        fixture.outDir,
      ]);

      expect(code).toBe(1);
      const splitReport = JSON.parse(
        readFileSync(path.join(fixture.outDir, 'split-report.json'), 'utf8')
      );
      expect(splitReport.decision).toBe('blocked');
      expect(splitReport.leakingGroups).toEqual([
        { groupKey: 'story-1', splits: ['test', 'train'] },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when a contaminated holdout marker reaches canonical samples instead of quarantine', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'data-governance-contamination-'));
    try {
      const fixture = writeFixture(root, { contaminationLeak: true });
      const code = mainDataGovernanceGate([
        '--requirement-record',
        fixture.recordPath,
        '--data-dir',
        fixture.dataDir,
        '--out-dir',
        fixture.outDir,
      ]);

      expect(code).toBe(1);
      const contaminationReport = JSON.parse(
        readFileSync(path.join(fixture.outDir, 'contamination-report.json'), 'utf8')
      );
      expect(contaminationReport.decision).toBe('blocked');
      expect(contaminationReport.hits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'canonical_sample',
            action: 'quarantine_required',
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
