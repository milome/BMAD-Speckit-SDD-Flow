import { readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';
import {
  buildReadinessDriftProjection,
  evaluateReadinessDrift,
} from '../../packages/scoring/governance/readiness-drift';
import { deriveReviewCloseoutEnvelopeV1 } from '../../scripts/reviewer-schema';
import type { JourneyContractSignals, RunScoreRecord } from '../../packages/scoring/writer/types';

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'run-default',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 90,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-04-13T00:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

function makeBaseline(runId = 'run-readiness-1', timestamp = '2026-04-13T00:00:00.000Z'): RunScoreRecord {
  return makeRecord({
    run_id: runId,
    stage: 'implementation_readiness',
    timestamp,
    phase_score: 88,
    dimension_scores: [
      { dimension: 'P0 Journey Coverage', weight: 25, score: 86 },
      { dimension: 'Smoke E2E Readiness', weight: 25, score: 90 },
      { dimension: 'Evidence Proof Chain', weight: 25, score: 88 },
      { dimension: 'Cross-Document Traceability', weight: 25, score: 88 },
    ],
  });
}

describe('readiness drift close-out proof', () => {
  it.each([
    {
      signal: 'smoke_task_chain',
      expectedSeverity: 'critical',
      expectedVerdict: 'blocked',
      expectedResultCode: 'blocked',
    },
    {
      signal: 'closure_task_id',
      expectedSeverity: 'critical',
      expectedVerdict: 'blocked',
      expectedResultCode: 'blocked',
    },
    {
      signal: 'journey_unlock',
      expectedSeverity: 'major',
      expectedVerdict: 'required_fixes',
      expectedResultCode: 'required_fixes',
    },
    {
      signal: 'gap_split_contract',
      expectedSeverity: 'major',
      expectedVerdict: 'required_fixes',
      expectedResultCode: 'required_fixes',
    },
    {
      signal: 'shared_path_reference',
      expectedSeverity: 'major',
      expectedVerdict: 'required_fixes',
      expectedResultCode: 'required_fixes',
    },
  ] satisfies Array<{
    signal: keyof JourneyContractSignals;
    expectedSeverity: 'major' | 'critical';
    expectedVerdict: 'blocked' | 'required_fixes';
    expectedResultCode: 'blocked' | 'required_fixes';
  }>)(
    'maps $signal to deterministic drift severity and closeout verdict',
    ({ signal, expectedSeverity, expectedVerdict, expectedResultCode }) => {
      const result = evaluateReadinessDrift({
        stage: 'implement',
        signals: { [signal]: true },
        allRecords: [makeBaseline()],
      });

      const closeout = deriveReviewCloseoutEnvelopeV1({
        auditStatus: 'PASS',
        scoringFailureMode: 'succeeded',
        scoreRecord: {
          effective_verdict: result.effective_verdict,
          blocking_reason: result.blocking_reason ?? undefined,
          re_readiness_required: result.re_readiness_required,
          drift_severity: result.drift_severity,
        },
      });

      expect(result.drift_signals).toEqual([signal]);
      expect(result.drift_severity).toBe(expectedSeverity);
      expect(result.effective_verdict).toBe(expectedVerdict);
      expect(closeout.resultCode).toBe(expectedResultCode);
      expect(closeout.rerunDecision).toBe('rerun_required');
      expect(closeout.packetExecutionClosureStatus).not.toBe('gate_passed');
    }
  );

  it('does not let free-form severity text override deterministic critical drift mapping', async () => {
    const tempDir = path.join(os.tmpdir(), `readiness-drift-proof-${Date.now()}`);
    const readinessReport = [
      '总体评级: B',
      '问题清单:',
      '(无)',
      '## 可解析评分块（供 parseAndWriteScore）',
      '- P0 Journey Coverage: 84/100',
      '- Smoke E2E Readiness: 86/100',
      '- Evidence Proof Chain: 85/100',
      '- Cross-Document Traceability: 87/100',
    ].join('\n');
    const implementReport = [
      '总体评级: A',
      '问题清单:',
      '1. [严重程度:低] smoke task chain 仍未闭合，真实 smoke path task chain 证据缺失',
      '通过标准:',
      '待修复',
      '## Structured Drift Signal Block',
      '| signal | status | evidence |',
      '| --- | --- | --- |',
      '| smoke_task_chain | critical | Smoke chain proof missing even though issue text claims low severity |',
      '| closure_task_id | pass | Closure note still present |',
      '| journey_unlock | pass | Unlock semantics intact |',
      '| gap_split_contract | pass | Gap split intact |',
      '| shared_path_reference | pass | Shared paths intact |',
      '## 可解析评分块（供 parseAndWriteScore）',
      '- 功能性: 95/100',
      '- 代码质量: 94/100',
      '- 测试覆盖: 93/100',
      '- 安全性: 96/100',
    ].join('\n');

    try {
      await parseAndWriteScore({
        content: readinessReport,
        stage: 'implementation_readiness',
        runId: 'readiness-baseline-proof',
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      await parseAndWriteScore({
        content: implementReport,
        stage: 'implement',
        runId: 'implement-drift-proof',
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      const record = JSON.parse(
        readFileSync(path.join(tempDir, 'implement-drift-proof.json'), 'utf8')
      ) as RunScoreRecord;

      expect(record.raw_phase_score).toBeGreaterThan(90);
      expect(record.drift_signals).toEqual(['smoke_task_chain']);
      expect(record.drift_severity).toBe('critical');
      expect(record.effective_verdict).toBe('blocked');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('requires re-readiness until a newer clean baseline exists', () => {
    const oldBaseline = makeBaseline('run-readiness-old', '2026-04-13T00:00:00.000Z');
    const driftingImplement = makeRecord({
      run_id: 'run-impl-drift',
      timestamp: '2026-04-13T01:00:00.000Z',
      journey_contract_signals: { journey_unlock: true },
    });
    const newBaseline = makeBaseline('run-readiness-new', '2026-04-13T02:00:00.000Z');
    const cleanImplement = makeRecord({
      run_id: 'run-impl-clean',
      timestamp: '2026-04-13T03:00:00.000Z',
      journey_contract_signals: {},
    });

    const before = buildReadinessDriftProjection({
      currentRecord: driftingImplement,
      allRecords: [oldBaseline, driftingImplement],
    });
    const after = buildReadinessDriftProjection({
      currentRecord: cleanImplement,
      allRecords: [oldBaseline, driftingImplement, newBaseline, cleanImplement],
    });

    expect(before.re_readiness_required).toBe(true);
    expect(before.effective_verdict).toBe('required_fixes');
    expect(after.readiness_baseline_run_id).toBe('run-readiness-new');
    expect(after.re_readiness_required).toBe(false);
    expect(after.effective_verdict).toBe('approved');
  });

  it('preserves implement four-dimension scoring after readiness baseline is introduced', async () => {
    const tempDir = path.join(os.tmpdir(), `implement-4d-proof-${Date.now()}`);
    const readinessFixture = path.join(
      process.cwd(),
      'packages',
      'scoring',
      'parsers',
      '__tests__',
      'fixtures',
      'sample-readiness-report-with-four-dimensions.md'
    );
    const implementFixture = path.join(
      process.cwd(),
      'packages',
      'scoring',
      'parsers',
      '__tests__',
      'fixtures',
      'sample-implement-report-with-four-dimensions.md'
    );

    try {
      await parseAndWriteScore({
        reportPath: readinessFixture,
        stage: 'implementation_readiness',
        runId: 'readiness-4d-proof',
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      await parseAndWriteScore({
        reportPath: implementFixture,
        stage: 'implement',
        runId: 'implement-4d-proof',
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath: tempDir,
        skipAutoHash: true,
      });

      const record = JSON.parse(
        readFileSync(path.join(tempDir, 'implement-4d-proof.json'), 'utf8')
      ) as RunScoreRecord;
      const dimensions = record.dimension_scores?.map((item) => item.dimension) ?? [];

      expect(dimensions).toEqual(['功能性', '代码质量', '测试覆盖', '安全性']);
      expect(record.raw_phase_score).toBeGreaterThan(0);
      expect(record.readiness_baseline_run_id).toBe('readiness-4d-proof');
      expect(record.effective_verdict).toBe('approved');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
