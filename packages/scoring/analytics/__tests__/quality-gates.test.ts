import { describe, expect, it } from 'vitest';
import { applyQualityGates } from '../quality-gates';
import type { CanonicalSftSample } from '../types';

function makeSample(): CanonicalSftSample {
  return {
    sample_id: 'sample-001',
    sample_version: 'v1',
    source: {
      run_id: 'run-001',
      stage: 'implement',
      flow: 'story',
      event_ids: ['score:run-001:implement'],
      artifact_refs: [
        {
          path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
          content_hash: 'sha256:artifact-001',
        },
      ],
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: 'Fix the runtime dashboard.' },
      { role: 'assistant', content: 'Apply the runtime dashboard patch.' },
    ],
    metadata: {
      schema_targets: ['openai_chat', 'hf_conversational'],
      sample_kind: 'implementation',
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 95,
      raw_phase_score: 95,
      veto_triggered: false,
      iteration_count: 5,
      has_code_pair: true,
      token_estimate: 200,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: 'ad245b7',
      content_hash: 'sha256:content-001',
      source_hash: 'sha256:source-001',
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      patch_ref: 'sha256:patch-001',
      lineage: ['run-001', 'score:run-001:implement'],
      generated_at: '2026-03-28T00:00:00.000Z',
    },
    split: {
      assignment: 'train',
      seed: 42,
      strategy: 'story_hash_v1',
      group_key: 'epic-15/story-1',
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
      hf_tool_calling: { compatible: false, reasons: [], warnings: [] },
    },
  };
}

describe('quality gates', () => {
  it('downgrades samples with missing code pair and too many iterations', () => {
    const base = makeSample();
    const sample = applyQualityGates({
      ...base,
      quality: {
        ...base.quality,
        has_code_pair: false,
        token_estimate: 200,
      },
    }, {
      minScore: 90,
      maxIterations: 3,
      maxTokens: 8192,
    });

    expect(sample.quality.rejection_reasons).toEqual(['missing_code_pair', 'too_many_iterations']);

    expect(sample.quality.acceptance_decision).toBe('rejected');
    expect(sample.quality.rejection_reasons).toEqual(
      expect.arrayContaining(['missing_code_pair', 'too_many_iterations'])
    );
    expect(sample.quality.training_ready).toBe(false);
    expect(sample.quality.training_blockers).toEqual(
      expect.arrayContaining(['missing_code_pair'])
    );
  });

  it('allows documentation samples to omit code pairs without missing_code_pair rejection', () => {
    const base = makeSample();
    const sample = applyQualityGates({
      ...base,
      metadata: {
        ...base.metadata,
        sample_kind: 'documentation',
      },
      quality: {
        ...base.quality,
        has_code_pair: false,
        iteration_count: 0,
        token_estimate: 200,
        warnings: [],
        rejection_reasons: [],
      },
    }, {
      minScore: 90,
      maxIterations: 3,
      maxTokens: 8192,
    });

    expect(sample.quality.rejection_reasons).toEqual([]);

    expect(sample.quality.acceptance_decision).toBe('accepted');
    expect(sample.quality.rejection_reasons).not.toContain('missing_code_pair');
    expect(sample.quality.training_ready).toBe(true);
    expect(sample.quality.training_blockers).toEqual([]);
  });

  it('rejects blocked redaction findings', () => {
    const sample = applyQualityGates({
      ...makeSample(),
      redaction: {
        status: 'blocked',
        applied_rules: ['secret-token'],
        findings: [
          {
            kind: 'secret_token',
            severity: 'critical',
            field_path: 'messages[1].content',
          },
        ],
        redacted_fields: ['messages[1].content'],
      },
    });

    expect(sample.quality.acceptance_decision).toBe('rejected');
    expect(sample.quality.rejection_reasons).toEqual(
      expect.arrayContaining(['redaction_blocked', 'secret_detected_unresolved'])
    );
    expect(sample.quality.training_ready).toBe(false);
    expect(sample.quality.training_blockers).toEqual(
      expect.arrayContaining(['redaction_blocked'])
    );
  });

  it('does not mark already-redacted pii as unresolved when another finding blocks the sample', () => {
    const sample = applyQualityGates({
      ...makeSample(),
      redaction: {
        status: 'blocked',
        applied_rules: ['email', 'private-key'],
        findings: [
          {
            kind: 'pii_email',
            severity: 'medium',
            field_path: 'messages[1].content',
            action: 'redact',
          },
          {
            kind: 'private_key',
            severity: 'critical',
            field_path: 'messages[2].tool_calls[0].function.arguments',
            action: 'block',
          },
        ],
        redacted_fields: [
          'messages[1].content',
          'messages[2].tool_calls[0].function.arguments',
        ],
      },
    });

    expect(sample.quality.acceptance_decision).toBe('rejected');
    expect(sample.quality.rejection_reasons).toEqual(
      expect.arrayContaining(['redaction_blocked', 'secret_detected_unresolved'])
    );
    expect(sample.quality.rejection_reasons).not.toContain('pii_detected_unresolved');
  });

  it('downgrades tooling samples with partial trace completeness and marks training blockers', () => {
    const sample = applyQualityGates({
      ...makeSample(),
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_runtime_snapshot',
            parameters: { type: 'object' },
          },
        },
      ],
      quality: {
        ...makeSample().quality,
        trace_completeness: 'partial',
      },
    });

    expect(sample.quality.acceptance_decision).toBe('downgraded');
    expect(sample.quality.rejection_reasons).toContain('tool_trace_partial');
    expect(sample.quality.training_ready).toBe(false);
    expect(sample.quality.training_blockers).toEqual(
      expect.arrayContaining(['tool_trace_partial'])
    );
  });
});
