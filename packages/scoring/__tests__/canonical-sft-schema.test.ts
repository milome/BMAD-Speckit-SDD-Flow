import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadSchema(relativePath: string) {
  const schemaPath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

describe('canonical sft schemas', () => {
  it('validates canonical SFT samples against canonical-sft-sample.schema.json', () => {
    const schema = loadSchema('packages/scoring/schema/canonical-sft-sample.schema.json');
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const sample = {
      sample_id: 'sample-001',
      sample_version: 'v1',
      source: {
        run_id: 'run-001',
        stage: 'implement',
        flow: 'story',
        provider_id: 'openai-primary',
        provider_mode: 'openai-compatible',
        tool_trace_ref: 'sha256:trace-001',
        event_ids: ['evt-001'],
        artifact_refs: [
          {
            path: 'docs/BUGFIX_sample.md',
            content_hash: 'sha256:content'
          }
        ]
      },
      messages: [
        { role: 'system', content: 'You are a senior coding agent.' },
        {
          role: 'user',
          content: 'Fix the failing implementation and preserve behavior.',
          metadata: {
            legacy_instruction: 'Fix the failing implementation and preserve behavior.',
            legacy_input: 'Current implementation:\nfoo()'
          }
        },
        {
          role: 'assistant',
          content: 'Updated implementation',
          metadata: {
            legacy_output: 'Updated implementation'
          }
        }
      ],
      metadata: {
        schema_targets: ['openai_chat', 'hf_conversational'],
        sample_kind: 'implementation',
        host: 'cursor',
        host_kind: 'cursor',
        language: 'ts'
      },
      quality: {
        acceptance_decision: 'accepted',
        phase_score: 95,
        raw_phase_score: 95,
        trace_completeness: 'complete',
        training_ready: true,
        training_blockers: [],
        veto_triggered: false,
        iteration_count: 1,
        has_code_pair: true,
        token_estimate: 256,
        dedupe_cluster_id: null,
        safety_flags: [],
        rejection_reasons: [],
        warnings: []
      },
      provenance: {
        base_commit_hash: 'abc123',
        content_hash: 'sha256:content',
        source_hash: 'sha256:source',
        source_path: 'docs/BUGFIX_sample.md',
        patch_ref: 'sha256:patch',
        generator_version: 'candidate-builder.v2',
        schema_version: 'canonical-sft-sample.v1',
        lineage: ['score.written'],
        generated_at: '2026-03-31T00:00:00.000Z'
      },
      split: {
        assignment: 'train',
        seed: 42,
        strategy: 'story_hash_v1',
        group_key: 'story-15-1'
      },
      redaction: {
        status: 'clean',
        applied_rules: [],
        findings: [],
        redacted_fields: []
      },
      export_compatibility: {
        openai_chat: {
          compatible: true,
          reasons: [],
          warnings: []
        },
        hf_conversational: {
          compatible: true,
          reasons: [],
          warnings: []
        },
        hf_tool_calling: {
          compatible: false,
          reasons: ['missing tool schema'],
          warnings: []
        }
      }
    };

    expect(validate(sample)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates dataset bundle manifests against dataset-bundle-manifest.schema.json', () => {
    const schema = loadSchema('packages/scoring/schema/dataset-bundle-manifest.schema.json');
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const manifest = {
      bundle_id: 'openai_chat-abc123',
      bundle_version: 'v2',
      bundle_kind: 'training',
      export_target: 'openai_chat',
      created_at: '2026-03-31T00:00:00.000Z',
      canonical_schema_version: 'v1',
      exporter_version: 'v1',
      generator_version: 'bundle-writer.v2',
      source_snapshot: {
        sample_count: 12,
      },
      export_hash: 'sha256:bundle',
      filter_settings: {
        min_score: 90,
        drop_no_code_pair: true,
        max_tokens: 4096
      },
      split: {
        seed: 42,
        strategy: 'story_hash_v1'
      },
      counts: {
        total_candidates: 12,
        accepted: 10,
        rejected: 2,
        downgraded: 1,
        blocked: 1,
        train: 7,
        validation: 2,
        test: 1
      },
      provider_summary: {},
      redaction_summary: {
        status_counts: {
          clean: 10,
          redacted: 1,
          blocked: 1,
        },
      },
      validation_summary: {
        schema_valid: true,
        training_ready_passed: false,
      },
      artifacts: {
        train_path: 'train.openai_chat.jsonl',
        validation_path: 'validation.openai_chat.jsonl',
        test_path: 'test.openai_chat.jsonl',
        manifest_path: 'manifest.json',
        validation_report_path: 'validation-report.json',
        rejection_report_path: 'rejection-report.json'
      }
    };

    expect(validate(manifest)).toBe(true);
  });
});
