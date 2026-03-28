import { describe, expect, it } from 'vitest';
import { applyCanonicalRedaction } from '../redaction';
import type { CanonicalSftSample } from '../types';

function makeSample(content: string): CanonicalSftSample {
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
      { role: 'user', content },
      { role: 'assistant', content: 'done' },
    ],
    metadata: {
      schema_targets: ['openai_chat'],
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 95,
      raw_phase_score: 95,
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: true,
      token_estimate: 120,
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
      lineage: ['run-001'],
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

describe('canonical redaction', () => {
  it('redacts non-critical email-like pii from messages', () => {
    const sample = applyCanonicalRedaction(
      makeSample('Contact me at engineer@example.com for the patch.')
    );

    expect(sample.redaction.status).toBe('redacted');
    expect(sample.redaction.redacted_fields).toContain('messages[1].content');
    expect(sample.redaction.findings[0]).toMatchObject({
      kind: 'pii_email',
      severity: 'medium',
    });
    expect(String(sample.messages[1].content)).not.toContain('engineer@example.com');
  });
});
