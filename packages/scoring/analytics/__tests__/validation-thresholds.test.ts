import { describe, expect, it } from 'vitest';
import { finalizeValidationReport, type ValidationAccumulator } from '../validation-report';
import type { CanonicalSftSample } from '../types';

function makeSample(overrides: Partial<CanonicalSftSample> = {}): CanonicalSftSample {
  return {
    sample_id: 'sample-1',
    sample_version: 'v1',
    source: {
      run_id: 'run-1',
      stage: 'implement',
      flow: 'story',
      event_ids: ['evt-1'],
      artifact_refs: [{ path: 'docs/plans/sample.md', content_hash: 'sha256:1' }],
      ...(overrides.source || {}),
    },
    messages: [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'user' },
      { role: 'assistant', content: 'assistant' },
    ],
    metadata: {
      schema_targets: ['openai_chat'],
      host_kind: 'cursor',
      ...(overrides.metadata || {}),
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 95,
      raw_phase_score: 95,
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: true,
      token_estimate: 100,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
      training_ready: true,
      trace_completeness: 'complete',
      training_blockers: [],
      ...(overrides.quality || {}),
    },
    provenance: {
      base_commit_hash: 'abc',
      content_hash: 'sha256:content',
      source_hash: 'sha256:source',
      source_path: 'docs/plans/sample.md',
      patch_ref: null,
      lineage: ['run-1'],
      generated_at: '2026-04-09T00:00:00.000Z',
      ...(overrides.provenance || {}),
    },
    split: {
      assignment: 'train',
      seed: 42,
      strategy: 'story_hash_v1',
      group_key: 'story-1',
      ...(overrides.split || {}),
    },
    redaction: {
      status: 'clean',
      applied_rules: [],
      findings: [],
      redacted_fields: [],
      ...(overrides.redaction || {}),
    },
    export_compatibility: {
      openai_chat: { compatible: true, reasons: [], warnings: [] },
      hf_conversational: { compatible: true, reasons: [], warnings: [] },
      hf_tool_calling: { compatible: false, reasons: ['target_incompatible_hf_tool_calling'], warnings: [] },
      ...(overrides.export_compatibility || {}),
    },
  };
}

describe('validation thresholds', () => {
  it('fails training_ready_passed when accepted ratio and host coverage are below threshold', () => {
    const accepted = makeSample();
    const rejected = makeSample({
      sample_id: 'sample-2',
      metadata: {
        host_kind: '',
      },
      quality: {
        acceptance_decision: 'rejected',
        training_ready: false,
        rejection_reasons: ['score_below_floor'],
      },
      redaction: {
        status: 'blocked',
      },
      split: {
        assignment: 'validation',
      },
    });

    const accumulator: ValidationAccumulator<unknown> = {
      rowsBySplit: {
        train: [{ id: 'row-1' }],
        validation: [],
        test: [],
      },
      exportedSamples: [accepted],
      rejectedSamples: [
        {
          sample_id: rejected.sample_id,
          run_id: rejected.source.run_id,
          split: rejected.split.assignment,
          reasons: rejected.quality.rejection_reasons,
          warnings: rejected.quality.warnings,
          acceptance_decision: rejected.quality.acceptance_decision,
        },
      ],
      seenSamples: [accepted, rejected],
    };

    const report = finalizeValidationReport('openai_chat', accumulator);

    expect(report.training_ready_passed).toBe(false);
    expect(report.quality_metrics).toEqual(
      expect.objectContaining({
        accepted_ratio: 0.5,
        training_ready_ratio: 0.5,
        blocked_redaction_ratio: 0.5,
        host_kind_coverage: 0.5,
      })
    );
    expect(report.threshold_failures).toEqual(
      expect.arrayContaining([
        'blocked_redaction_ratio_above_threshold',
        'host_kind_coverage_below_threshold',
      ])
    );
  });
});
