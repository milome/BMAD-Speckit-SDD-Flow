import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import draft7MetaSchema from 'ajv/dist/refs/json-schema-draft-07.json';
import * as fs from 'fs';
import * as path from 'path';

function loadSchema(relativePath: string) {
  const schemaPath = path.resolve(__dirname, relativePath);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

function createValidator(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateSchema: false });
  ajv.addMetaSchema(draft7MetaSchema);
  addFormats(ajv);
  return ajv.compile(schema);
}

function expectTraceCompletenessError(errors: Array<{ instancePath?: string; schemaPath?: string }> | null | undefined) {
  return errors?.some(
    (error) =>
      error.instancePath === '/quality/trace_completeness' ||
      error.schemaPath?.includes('/properties/trace_completeness/enum')
  );
}

describe('canonical SFT schema contracts', () => {
  it('validates canonical SFT samples against canonical-sft-sample.schema.json', () => {
    const schema = loadSchema('../schema/canonical-sft-sample.schema.json');
    const validate = createValidator(schema);

    const sample = {
      sample_id: 'sample-001',
      sample_version: 'v1',
      source: {
        run_id: 'run-001',
        stage: 'implement',
        flow: 'dev_story',
        provider_id: 'openai-primary',
        provider_mode: 'openai-compatible',
        tool_trace_ref: 'sha256:trace-001',
        event_ids: ['evt-001', 'evt-002'],
        artifact_refs: [
          {
            path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
            content_hash: 'sha256:artifact-001',
            kind: 'plan_doc',
          },
        ],
      },
      messages: [
        { role: 'system', content: 'You are a coding agent.' },
        { role: 'user', content: '请修复 runtime dashboard 的问题。' },
        { role: 'assistant', content: '已完成修复。' },
      ],
      metadata: {
        schema_targets: ['openai_chat', 'hf_conversational'],
        host_kind: 'cursor',
        language: 'zh-CN',
        tags: ['runtime-dashboard', 'sft'],
      },
      quality: {
        acceptance_decision: 'accepted',
        phase_score: 96,
        raw_phase_score: 96,
        trace_completeness: 'complete',
        training_ready: true,
        training_blockers: [],
        veto_triggered: false,
        iteration_count: 0,
        has_code_pair: true,
        token_estimate: 800,
        dedupe_cluster_id: null,
        safety_flags: [],
        rejection_reasons: [],
        warnings: [],
      },
      provenance: {
        base_commit_hash: 'ad245b7',
        content_hash: 'sha256:abc123',
        source_hash: 'sha256:source-001',
        source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
        patch_ref: null,
        generator_version: 'candidate-builder.v2',
        schema_version: 'canonical-sft-sample.v1',
        lineage: ['run-001', 'evt-001'],
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
        hf_tool_calling: {
          compatible: false,
          reasons: ['missing_tools'],
          warnings: [],
        },
      },
    };

    const valid = validate(sample);

    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects invalid trace completeness enum values', () => {
    const schema = loadSchema('../schema/canonical-sft-sample.schema.json');
    const validate = createValidator(schema);

    const sample = {
      sample_id: 'sample-invalid-001',
      sample_version: 'v1',
      source: {
        run_id: 'run-001',
        stage: 'implement',
        flow: 'dev_story',
        event_ids: ['evt-001'],
        artifact_refs: [
          {
            path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
            content_hash: 'sha256:artifact-001',
          },
        ],
      },
      messages: [
        { role: 'system', content: 'You are a coding agent.' },
        { role: 'user', content: '请修复 runtime dashboard 的问题。' },
        { role: 'assistant', content: '已完成修复。' },
      ],
      metadata: {
        schema_targets: ['openai_chat'],
      },
      quality: {
        acceptance_decision: 'accepted',
        phase_score: 96,
        raw_phase_score: 96,
        trace_completeness: 'unknown',
        training_ready: true,
        training_blockers: [],
        veto_triggered: false,
        iteration_count: 0,
        has_code_pair: true,
        token_estimate: 800,
        dedupe_cluster_id: null,
        safety_flags: [],
        rejection_reasons: [],
        warnings: [],
      },
      provenance: {
        base_commit_hash: 'ad245b7',
        content_hash: 'sha256:abc123',
        source_hash: 'sha256:source-001',
        source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
        patch_ref: null,
        generator_version: 'candidate-builder.v2',
        schema_version: 'canonical-sft-sample.v1',
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
        hf_tool_calling: { compatible: false, reasons: ['missing_tools'], warnings: [] },
      },
    };

    const valid = validate(sample);

    expect(valid).toBe(false);
    expect(expectTraceCompletenessError(validate.errors)).toBe(true);
  });

  it('validates dataset bundle manifests against dataset-bundle-manifest.schema.json', () => {
    const schema = loadSchema('../schema/dataset-bundle-manifest.schema.json');
    const validate = createValidator(schema);

    const sample = {
      bundle_id: 'runtime-dashboard-sft-v1',
      export_target: 'openai_chat',
      created_at: '2026-03-28T00:00:00.000Z',
      canonical_schema_version: 'v1',
      exporter_version: 'v1',
      export_hash: 'sha256:bundle-001',
      source_scope: {
        scope_type: 'story',
        epic_id: 'epic-15',
        story_key: '15-1-runtime-dashboard-sft',
        board_group_id: 'epic:epic-15',
      },
      filter_settings: {
        min_score: 90,
        drop_no_code_pair: true,
      },
      split: {
        seed: 42,
        strategy: 'story_hash_v1',
      },
      counts: {
        accepted: 12,
        rejected: 4,
        train: 8,
        validation: 2,
        test: 2,
      },
      artifacts: {
        train_path: 'train.jsonl',
        validation_path: 'validation.jsonl',
        test_path: 'test.jsonl',
        manifest_path: 'manifest.json',
        validation_report_path: 'validation-report.md',
        rejection_report_path: 'rejection-report.json',
      },
    };

    expect(validate(sample)).toBe(true);
  });
});
