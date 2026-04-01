import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

function loadSchema(relativePath: string) {
  const schemaPath = path.resolve(__dirname, relativePath);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
}

describe('canonical SFT schema contracts', () => {
  it('validates canonical SFT samples against canonical-sft-sample.schema.json', () => {
    const schema = loadSchema('../schema/canonical-sft-sample.schema.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const sample = {
      sample_id: 'sample-001',
      sample_version: 'v1',
      source: {
        run_id: 'run-001',
        stage: 'implement',
        flow: 'dev_story',
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
        language: 'zh-CN',
        tags: ['runtime-dashboard', 'sft'],
      },
      quality: {
        acceptance_decision: 'accepted',
        phase_score: 96,
        raw_phase_score: 96,
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

    expect(validate(sample)).toBe(true);
  });

  it('validates dataset bundle manifests against dataset-bundle-manifest.schema.json', () => {
    const schema = loadSchema('../schema/dataset-bundle-manifest.schema.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const sample = {
      bundle_id: 'runtime-dashboard-sft-v1',
      export_target: 'openai_chat',
      created_at: '2026-03-28T00:00:00.000Z',
      canonical_schema_version: 'v1',
      exporter_version: 'v1',
      export_hash: 'sha256:bundle-001',
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
