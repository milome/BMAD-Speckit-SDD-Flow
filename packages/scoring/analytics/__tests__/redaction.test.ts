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

  it('redacts secret tokens from assistant tool call arguments', () => {
    const sample = makeSample('Use the runtime tool to inspect the active run.');
    sample.messages = [
      sample.messages[0]!,
      sample.messages[1]!,
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-runtime-001',
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              arguments: '{"apiKey":"sk-1234567890abcdefghijklmnop"}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call-runtime-001',
        content: '{"status":"running"}',
      },
      sample.messages[2]!,
    ];
    sample.tools = [
      {
        type: 'function',
        function: {
          name: 'get_runtime_snapshot',
          parameters: {
            type: 'object',
            properties: {
              apiKey: { type: 'string' },
            },
          },
        },
      },
    ];

    const redacted = applyCanonicalRedaction(sample);

    expect(redacted.redaction.status).toBe('redacted');
    expect(redacted.redaction.redacted_fields).toContain(
      'messages[2].tool_calls[0].function.arguments'
    );
    expect(redacted.redaction.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'secret_token',
          severity: 'high',
          field_path: 'messages[2].tool_calls[0].function.arguments',
        }),
      ])
    );
    expect(
      redacted.messages[2]!.tool_calls?.[0]?.function.arguments
    ).toContain('[REDACTED_SECRET]');
    expect(
      redacted.messages[2]!.tool_calls?.[0]?.function.arguments
    ).not.toContain('sk-1234567890abcdefghijklmnop');
  });

  it('blocks private keys from assistant tool call arguments', () => {
    const sample = makeSample('Use the runtime tool to inspect the active run.');
    sample.messages = [
      sample.messages[0]!,
      sample.messages[1]!,
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-runtime-001',
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              arguments: '{"privateKey":"BEGIN RSA PRIVATE KEY"}',
            },
          },
        ],
      },
      sample.messages[2]!,
    ];

    const redacted = applyCanonicalRedaction(sample);

    expect(redacted.redaction.status).toBe('blocked');
    expect(redacted.redaction.redacted_fields).toContain(
      'messages[2].tool_calls[0].function.arguments'
    );
    expect(redacted.redaction.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'private_key',
          severity: 'critical',
          field_path: 'messages[2].tool_calls[0].function.arguments',
          action: 'block',
        }),
      ])
    );
  });

  it('redacts content parts and tool schema strings', () => {
    const sample = makeSample('Use the runtime tool to inspect the active run.');
    sample.messages = [
      sample.messages[0]!,
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Contact engineer@example.com for the bundle.' },
          { type: 'text', text: 'Then inspect the runtime tool output.' },
        ],
      },
      sample.messages[2]!,
    ];
    sample.tools = [
      {
        type: 'function',
        function: {
          name: 'get_runtime_snapshot',
          description: 'Escalate issues to owner@example.com before export.',
          parameters: {
            type: 'object',
            properties: {
              note: {
                type: 'string',
                description: 'Fallback token sk-1234567890abcdefghijklmnop',
              },
            },
          },
        },
      },
    ];

    const redacted = applyCanonicalRedaction(sample);

    expect(redacted.redaction.status).toBe('redacted');
    expect(redacted.redaction.redacted_fields).toEqual(
      expect.arrayContaining([
        'messages[1].content[0].text',
        'tools[0].function.description',
        'tools[0].function.parameters.properties.note.description',
      ])
    );
    expect(redacted.messages[1]!.content).toEqual([
      { type: 'text', text: 'Contact [REDACTED_EMAIL] for the bundle.' },
      { type: 'text', text: 'Then inspect the runtime tool output.' },
    ]);
    expect(redacted.tools?.[0]?.function.description).toContain('[REDACTED_EMAIL]');
    expect(
      String(redacted.tools?.[0]?.function.parameters.properties.note.description)
    ).toContain('[REDACTED_SECRET]');
  });
});
