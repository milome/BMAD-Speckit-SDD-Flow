import { describe, expect, it } from 'vitest';
import { exportHfToolCallingRows } from '../exporters/hf-tool-calling';
import type { CanonicalSftSample } from '../types';

function makeSample(overrides: Partial<CanonicalSftSample> = {}): CanonicalSftSample {
  return {
    sample_id: 'sample-hf-tool-001',
    sample_version: 'v1',
    source: {
      run_id: 'run-hf-tool-001',
      stage: 'implement',
      flow: 'story',
      event_ids: ['evt-hf-tool-001'],
      artifact_refs: [
        {
          path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
          content_hash: 'sha256:artifact-hf-tool-001',
        },
      ],
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: '读取 runtime snapshot 并解释问题。' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-runtime-001',
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              arguments: '{"run_id":"run-hf-tool-001"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call-runtime-001',
        content: '{"stage":"implement","status":"running"}',
      },
      { role: 'assistant', content: '当前 implement 阶段仍在运行。' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_runtime_snapshot',
          description: 'Read runtime snapshot',
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
      schema_targets: ['hf_tool_calling'],
      language: 'zh-CN',
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 97,
      raw_phase_score: 97,
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: false,
      token_estimate: 88,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: 'ad245b7',
      content_hash: 'sha256:content-hf-tool-001',
      source_hash: 'sha256:source-hf-tool-001',
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      patch_ref: null,
      lineage: ['run-hf-tool-001', 'evt-hf-tool-001'],
      generated_at: '2026-03-28T00:00:00.000Z',
    },
    split: {
      assignment: 'test',
      seed: 42,
      strategy: 'story_hash_v1',
      group_key: 'epic-15/story-3',
    },
    redaction: {
      status: 'clean',
      applied_rules: [],
      findings: [],
      redacted_fields: [],
    },
    export_compatibility: {
      openai_chat: { compatible: true, reasons: [], warnings: [] },
      hf_conversational: { compatible: false, reasons: ['target_incompatible_hf_conversational'], warnings: [] },
      hf_tool_calling: { compatible: true, reasons: [], warnings: [] },
    },
    ...overrides,
  };
}

describe('hf tool-calling exporter', () => {
  it('writes messages plus tools, preserves linkage, and includes redaction metadata', () => {
    const sample = makeSample({
      redaction: {
        status: 'redacted',
        applied_rules: ['secret-token'],
        findings: [
          {
            kind: 'secret_token',
            severity: 'high',
            field_path: 'messages[2].tool_calls[0].function.arguments',
            action: 'redact',
          },
        ],
        redacted_fields: ['messages[2].tool_calls[0].function.arguments'],
      },
    });

    const result = exportHfToolCallingRows([sample]);

    expect(result.rowsBySplit.test).toHaveLength(1);
    expect(result.rowsBySplit.test[0]).toMatchObject({
      tools: sample.tools,
      metadata: {
        sample_id: 'sample-hf-tool-001',
        run_id: 'run-hf-tool-001',
        split: 'test',
        acceptance_decision: 'accepted',
        redaction_status: 'redacted',
        redaction_applied_rules: ['secret-token'],
        redaction_findings_count: 1,
        redaction_finding_kinds: ['secret_token'],
      },
    });
    expect(result.rowsBySplit.test[0].messages[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          id: 'call-runtime-001',
        },
      ],
    });
    expect(result.rowsBySplit.test[0].messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'call-runtime-001',
      content: '{"stage":"implement","status":"running"}',
    });
    expect(result.validationReport.counts.accepted).toBe(1);
    expect(result.validationReport.counts.rejected).toBe(0);
  });
});
