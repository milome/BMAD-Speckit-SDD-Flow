import { describe, expect, it } from 'vitest';
import { exportOpenAiChatRows } from '../exporters/openai-chat';
import type { CanonicalSftSample } from '../types';

function makeSample(overrides: Partial<CanonicalSftSample> = {}): CanonicalSftSample {
  return {
    sample_id: 'sample-openai-001',
    sample_version: 'v1',
    source: {
      run_id: 'run-openai-001',
      stage: 'implement',
      flow: 'story',
      event_ids: ['evt-openai-001'],
      artifact_refs: [
        {
          path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
          content_hash: 'sha256:artifact-openai-001',
        },
      ],
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: '修复 runtime dashboard。' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-runtime-001',
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              arguments: '{"run_id":"run-openai-001"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call-runtime-001',
        content: '{"status":"ok"}',
      },
      { role: 'assistant', content: '已完成修复。' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_runtime_snapshot',
          description: 'Read runtime dashboard snapshot',
          parameters: {
            type: 'object',
            properties: {
              run_id: { type: 'string' },
            },
            required: ['run_id'],
          },
        },
      },
    ],
    metadata: {
      schema_targets: ['openai_chat', 'hf_tool_calling'],
      language: 'zh-CN',
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 96,
      raw_phase_score: 96,
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
      content_hash: 'sha256:content-openai-001',
      source_hash: 'sha256:source-openai-001',
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      patch_ref: 'sha256:patch-openai-001',
      lineage: ['run-openai-001', 'evt-openai-001'],
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
      hf_tool_calling: { compatible: true, reasons: [], warnings: [] },
    },
    ...overrides,
  };
}

describe('openai chat exporter', () => {
  it('exports OpenAI JSONL rows with messages and preserves tool interactions', () => {
    const sample = makeSample();

    const result = exportOpenAiChatRows([sample]);

    expect(result.rowsBySplit.train).toHaveLength(1);
    expect(result.rowsBySplit.train[0]).toMatchObject({
      parallel_tool_calls: false,
      tools: sample.tools,
    });
    expect(result.rowsBySplit.train[0].messages).toEqual([
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: '修复 runtime dashboard。' },
      {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-runtime-001',
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              arguments: '{"run_id":"run-openai-001"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call-runtime-001',
        content: '{"status":"ok"}',
      },
      { role: 'assistant', content: '已完成修复。' },
    ]);
    expect(result.validationReport.counts.accepted).toBe(1);
    expect(result.validationReport.counts.rejected).toBe(0);
  });
});
