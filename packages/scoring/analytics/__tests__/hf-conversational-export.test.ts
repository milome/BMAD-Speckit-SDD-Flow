import { describe, expect, it } from 'vitest';
import { exportHfConversationalRows } from '../exporters/hf-conversational';
import type { CanonicalSftSample } from '../types';

function makeSample(overrides: Partial<CanonicalSftSample> = {}): CanonicalSftSample {
  return {
    sample_id: 'sample-hf-conv-001',
    sample_version: 'v1',
    source: {
      run_id: 'run-hf-conv-001',
      stage: 'implement',
      flow: 'story',
      event_ids: ['evt-hf-conv-001'],
      artifact_refs: [
        {
          path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
          content_hash: 'sha256:artifact-hf-conv-001',
        },
      ],
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: '总结当前 run 的问题。' },
      { role: 'assistant', content: '当前 run 已通过 runtime query 补全。' },
    ],
    metadata: {
      schema_targets: ['hf_conversational'],
      language: 'zh-CN',
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 95,
      raw_phase_score: 95,
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: false,
      token_estimate: 64,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: 'ad245b7',
      content_hash: 'sha256:content-hf-conv-001',
      source_hash: 'sha256:source-hf-conv-001',
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      patch_ref: null,
      lineage: ['run-hf-conv-001', 'evt-hf-conv-001'],
      generated_at: '2026-03-28T00:00:00.000Z',
    },
    split: {
      assignment: 'validation',
      seed: 42,
      strategy: 'story_hash_v1',
      group_key: 'epic-15/story-2',
    },
    redaction: {
      status: 'clean',
      applied_rules: [],
      findings: [],
      redacted_fields: [],
    },
    export_compatibility: {
      openai_chat: { compatible: true, reasons: [], warnings: [] },
      hf_conversational: { compatible: true, reasons: [], warnings: [] },
      hf_tool_calling: { compatible: false, reasons: ['target_incompatible_hf_tool_calling'], warnings: [] },
    },
    ...overrides,
  };
}

describe('hf conversational exporter', () => {
  it('preserves role-aware messages and metadata without tools', () => {
    const sample = makeSample();

    const result = exportHfConversationalRows([sample]);

    expect(result.rowsBySplit.validation).toHaveLength(1);
    expect(result.rowsBySplit.validation[0]).toEqual({
      messages: [
        { role: 'system', content: 'You are a coding agent.' },
        { role: 'user', content: '总结当前 run 的问题。' },
        { role: 'assistant', content: '当前 run 已通过 runtime query 补全。' },
      ],
      metadata: {
        sample_id: 'sample-hf-conv-001',
        run_id: 'run-hf-conv-001',
        split: 'validation',
        acceptance_decision: 'accepted',
      },
    });
    expect(result.validationReport.counts.accepted).toBe(1);
    expect(result.validationReport.counts.rejected).toBe(0);
  });
});
