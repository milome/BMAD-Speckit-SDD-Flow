import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeDatasetBundle } from '../bundle-writer';
import type { CanonicalSftSample } from '../types';

function makeSample(
  sampleId: string,
  split: 'train' | 'validation' | 'test',
  overrides: Partial<CanonicalSftSample> = {}
): CanonicalSftSample {
  return {
    sample_id: sampleId,
    sample_version: 'v1',
    source: {
      run_id: `run-${sampleId}`,
      stage: 'implement',
      flow: 'story',
      event_ids: [`evt-${sampleId}`],
      artifact_refs: [
        {
          path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
          content_hash: `sha256:artifact-${sampleId}`,
        },
      ],
    },
    messages: [
      { role: 'system', content: 'You are a coding agent.' },
      { role: 'user', content: `处理 ${sampleId}` },
      { role: 'assistant', content: `已完成 ${sampleId}` },
    ],
    metadata: {
      schema_targets: ['openai_chat', 'hf_conversational'],
      language: 'zh-CN',
    },
    quality: {
      acceptance_decision: 'accepted',
      phase_score: 94,
      raw_phase_score: 94,
      veto_triggered: false,
      iteration_count: 0,
      has_code_pair: true,
      token_estimate: 64,
      dedupe_cluster_id: null,
      safety_flags: [],
      rejection_reasons: [],
      warnings: [],
    },
    provenance: {
      base_commit_hash: 'ad245b7',
      content_hash: `sha256:content-${sampleId}`,
      source_hash: `sha256:source-${sampleId}`,
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      patch_ref: `sha256:patch-${sampleId}`,
      lineage: [`run-${sampleId}`, `evt-${sampleId}`],
      generated_at: '2026-03-28T00:00:00.000Z',
    },
    split: {
      assignment: split,
      seed: 42,
      strategy: 'story_hash_v1',
      group_key: `epic-15/story-${sampleId}`,
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

describe('bundle writer', () => {
  it('writes split files, manifest, validation report, and excludes rejected samples from bundle outputs', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dataset-bundle-'));
    const trainSample = makeSample('train-001', 'train');
    const validationSample = makeSample('validation-001', 'validation');
    const rejectedSample = makeSample('rejected-001', 'test', {
      quality: {
        ...makeSample('template', 'test').quality,
        acceptance_decision: 'rejected',
        rejection_reasons: ['veto_triggered'],
      },
      export_compatibility: {
        openai_chat: { compatible: false, reasons: ['veto_triggered'], warnings: [] },
        hf_conversational: { compatible: false, reasons: ['veto_triggered'], warnings: [] },
        hf_tool_calling: { compatible: false, reasons: ['veto_triggered'], warnings: [] },
      },
    });

    const result = await writeDatasetBundle([trainSample, validationSample, rejectedSample], {
      exportTarget: 'openai_chat',
      outputRoot: tempRoot,
      exporterVersion: 'v1-test',
      filterSettings: {
        min_score: 90,
      },
      sourceScope: {
        scope_type: 'story',
        epic_id: 'epic-15',
        story_key: '15-1-runtime-dashboard-sft',
        board_group_id: 'epic:epic-15',
      },
    });

    expect(fs.existsSync(result.bundleDir)).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'train.openai_chat.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'validation.openai_chat.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'stats.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'validation-report.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'validation-report.md'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'rejection-report.json'))).toBe(true);

    const trainRows = fs.readFileSync(path.join(result.bundleDir, 'train.openai_chat.jsonl'), 'utf-8').trim().split('\n');
    const validationRows = fs.readFileSync(path.join(result.bundleDir, 'validation.openai_chat.jsonl'), 'utf-8').trim().split('\n');
    const rejectionReport = JSON.parse(fs.readFileSync(path.join(result.bundleDir, 'rejection-report.json'), 'utf-8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(result.bundleDir, 'manifest.json'), 'utf-8'));
    const validationReport = JSON.parse(
      fs.readFileSync(path.join(result.bundleDir, 'validation-report.json'), 'utf-8')
    );

    expect(trainRows).toHaveLength(1);
    expect(validationRows).toHaveLength(1);
    expect(rejectionReport.rejected_samples).toEqual([
      expect.objectContaining({
        sample_id: 'rejected-001',
        reasons: ['veto_triggered'],
      }),
    ]);
    expect(manifest.counts).toMatchObject({
      total_candidates: 3,
      accepted: 2,
      rejected: 1,
      downgraded: 0,
      blocked: 0,
      train: 1,
      validation: 1,
      test: 0,
    });
    expect(manifest.bundle_version).toBe('v2');
    expect(manifest.bundle_kind).toBe('training');
    expect(manifest.generator_version).toBe('bundle-writer.v2');
    expect(manifest.source_scope).toEqual({
      scope_type: 'story',
      epic_id: 'epic-15',
      story_key: '15-1-runtime-dashboard-sft',
      board_group_id: 'epic:epic-15',
    });
    expect(manifest.redaction_summary).toEqual(validationReport.redaction_summary);
    expect(manifest.validation_summary).toEqual(
      expect.objectContaining({
        schema_valid: true,
      })
    );
    expect(validationReport.redaction_summary).toEqual({
      status_counts: {
        clean: 3,
        redacted: 0,
        blocked: 0,
      },
      applied_rules: [],
      finding_kinds: [],
    });
    expect(validationReport.schema_valid).toBe(true);
    expect(validationReport.invalid_samples).toEqual([]);
  });

  it('includes source scope in bundle uniqueness so scoped exports do not overwrite global bundles', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dataset-bundle-scope-'));
    const sample = makeSample('train-001', 'train');

    const globalResult = await writeDatasetBundle([sample], {
      exportTarget: 'openai_chat',
      outputRoot: tempRoot,
      exporterVersion: 'v1-test',
      sourceScope: { scope_type: 'global' },
    });

    const scopedResult = await writeDatasetBundle([sample], {
      exportTarget: 'openai_chat',
      outputRoot: tempRoot,
      exporterVersion: 'v1-test',
      sourceScope: {
        scope_type: 'story',
        epic_id: 'epic-15',
        story_key: '15-1-runtime-dashboard-sft',
        work_item_id: 'story:15-1-runtime-dashboard-sft',
        board_group_id: 'epic:epic-15',
      },
    });

    expect(globalResult.manifest.bundle_id).not.toBe(scopedResult.manifest.bundle_id);
    expect(globalResult.bundleDir).not.toBe(scopedResult.bundleDir);
  });
});
