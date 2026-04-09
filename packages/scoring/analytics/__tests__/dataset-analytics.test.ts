import { describe, expect, it } from 'vitest';
import {
  assignDedupeClusters,
  buildDatasetBalanceSummary,
  buildDatasetDuplicateSummary,
  buildDatasetTrainingViewSummary,
} from '../dataset-analytics';
import type { CanonicalSftSample } from '../types';

function makeSample(id: string, overrides: Partial<CanonicalSftSample> = {}): CanonicalSftSample {
  return {
    sample_id: id,
    sample_version: 'v1',
    source: {
      run_id: `run-${id}`,
      stage: 'implement',
      flow: 'story',
      event_ids: [`evt-${id}`],
      artifact_refs: [{ path: 'docs/plans/sample.md', content_hash: `sha256:${id}` }],
      ...(overrides.source || {}),
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Fix the runtime dashboard.' },
      { role: 'assistant', content: 'Applied the runtime dashboard patch.' },
    ],
    metadata: {
      schema_targets: ['openai_chat'],
      sample_kind: 'implementation',
      host_kind: 'cursor',
      ...(overrides.metadata || {}),
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 95,
      raw_phase_score: 95,
      trace_completeness: 'complete',
      training_ready: true,
      training_blockers: [],
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: true,
      token_estimate: 64,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
      ...(overrides.quality || {}),
    },
    provenance: {
      base_commit_hash: 'abc',
      content_hash: `sha256:content-${id}`,
      source_hash: `sha256:source-${id}`,
      source_path: 'docs/plans/sample.md',
      patch_ref: null,
      lineage: [`run-${id}`],
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

describe('dataset analytics', () => {
  it('assigns the same dedupe cluster id to near-identical samples', () => {
    const samples = assignDedupeClusters([
      makeSample('a'),
      makeSample('b', {
        source: { run_id: 'run-b' },
      }),
      makeSample('c', {
        source: { stage: 'tasks' },
        metadata: { sample_kind: 'documentation' },
        messages: [
          { role: 'system', content: 'You are a coding agent.' },
          { role: 'user', content: 'Fix a different file.' },
          { role: 'assistant', content: 'Applied a different patch.' },
        ],
      }),
    ]);

    expect(samples[0]?.quality.dedupe_cluster_id).toBeTruthy();
    expect(samples[1]?.quality.dedupe_cluster_id).toBe(samples[0]?.quality.dedupe_cluster_id);
    expect(samples[2]?.quality.dedupe_cluster_id).toBeNull();
    expect(samples[0]?.quality.warnings).toContain('near_duplicate_clustered');
    expect(samples[1]?.quality.warnings).toContain('near_duplicate_clustered');
  });

  it('builds duplicate, balance, and training-view summaries', () => {
    const samples = assignDedupeClusters([
      makeSample('a', {
        source: { provider_id: 'provider-a', provider_mode: 'openai-compatible' },
        metadata: { host_kind: 'claude', schema_targets: ['openai_chat', 'hf_tool_calling'] },
      }),
      makeSample('b', {
        source: { provider_id: 'provider-a', provider_mode: 'openai-compatible' },
        metadata: { host_kind: 'claude', schema_targets: ['openai_chat', 'hf_tool_calling'] },
      }),
      makeSample('c', {
        source: {
          stage: 'tasks',
          flow: 'bugfix',
          provider_id: 'provider-b',
          provider_mode: 'http-json',
        },
        metadata: { host_kind: 'cursor', sample_kind: 'documentation', schema_targets: ['hf_conversational'] },
        quality: { has_code_pair: false },
        messages: [
          { role: 'system', content: 'You are a coding agent.' },
          { role: 'user', content: 'Summarize the dashboard work.' },
          { role: 'assistant', content: 'Dashboard work summarized.' },
        ],
      }),
    ]);

    const duplicateSummary = buildDatasetDuplicateSummary(samples);
    const balanceSummary = buildDatasetBalanceSummary(samples);
    const trainingViews = buildDatasetTrainingViewSummary(samples);

    expect(duplicateSummary).toEqual(
      expect.objectContaining({
        cluster_count: 1,
        duplicate_cluster_count: 1,
        duplicated_sample_count: 2,
        largest_cluster_size: 2,
      })
    );
    expect(balanceSummary.by_host_kind).toEqual(
      expect.objectContaining({
        claude: 2,
        cursor: 1,
      })
    );
    expect(balanceSummary.by_provider_id).toEqual(
      expect.objectContaining({
        'provider-a': 2,
        'provider-b': 1,
      })
    );
    expect(balanceSummary.by_source_scope).toEqual(
      expect.objectContaining({
        story_scoped: 2,
        orphan_scoped: 1,
      })
    );
    expect(balanceSummary.dominant_source_scope_share).toBeCloseTo(0.6667, 4);
    expect(trainingViews).toEqual(
      expect.objectContaining({
        assistant_only_ready: 3,
        completion_only_ready: 3,
        tool_calling_ready: 0,
      })
    );
    expect(trainingViews.schema_target_counts).toEqual(
      expect.objectContaining({
        openai_chat: 2,
        hf_tool_calling: 2,
        hf_conversational: 1,
      })
    );
  });
});
