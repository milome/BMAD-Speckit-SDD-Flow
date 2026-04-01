import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildCanonicalCandidates } from '../candidate-builder';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Record<string, unknown> = {}): RunScoreRecord {
  return {
    run_id: 'run-e15-s1-tool-trace',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 95,
    phase_weight: 1,
    check_items: [],
    timestamp: '2026-03-28T00:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    source_path: '',
    base_commit_hash: 'ad245b7',
    content_hash: 'sha256:content-tool-trace',
    source_hash: 'sha256:source-tool-trace',
    ...(overrides as Partial<RunScoreRecord>),
  };
}

describe('canonical candidate builder tool trace injection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-candidate-tool-trace-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('injects persisted tool trace into canonical samples and enables hf tool-calling export', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    const patchPath = path.join(tempDir, 'patches', 'run-e15-s1-tool-trace.patch');
    const toolTracePath = path.join(tempDir, 'traces', 'run-e15-s1-tool-trace.json');

    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.mkdirSync(path.dirname(toolTracePath), { recursive: true });

    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n需要让 runtime dashboard 的工具调用也能进入 SFT 导出。\n\n## §4 修复方案\n把 runtime tool trace 注入 canonical sample，在最终 assistant 输出前保留 tool call 与 tool result。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      patchPath,
      '--- a/foo.ts\n+++ b/foo.ts\n-old trace code\n+new trace code',
      'utf-8'
    );
    fs.writeFileSync(
      toolTracePath,
      JSON.stringify(
        {
          trace_version: 1,
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
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-runtime-001',
                  type: 'function',
                  function: {
                    name: 'get_runtime_snapshot',
                    arguments: '{"run_id":"run-e15-s1-tool-trace"}',
                  },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call-runtime-001',
              content: '{"stage":"implement","status":"running"}',
            },
          ],
        },
        null,
        2
      ),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        {
          ...makeRecord({
            source_path: bugfixPath,
            patch_ref: 'sha256:patch-snapshot-tool-trace',
            patch_snapshot_path: patchPath,
          }),
          tool_trace_path: toolTracePath,
          tool_trace_ref: 'sha256:tool-trace-001',
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
      maxTokens: 512,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].tools).toHaveLength(1);
    expect(result.samples[0].messages.map((message) => message.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    expect(result.samples[0].messages[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          id: 'call-runtime-001',
          function: {
            name: 'get_runtime_snapshot',
          },
        },
      ],
    });
    expect(result.samples[0].messages[3]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-runtime-001',
    });
    expect(String(result.samples[0].messages[4].content)).toContain('new trace code');
    expect(result.samples[0].metadata.schema_targets).toContain('hf_tool_calling');
    expect(result.samples[0].metadata.notes).toContain('tool_trace_injected');
    expect(result.samples[0].quality.trace_completeness).toBe('complete');
    expect(result.samples[0].quality.training_blockers).toEqual([]);
    expect(result.samples[0].export_compatibility.hf_tool_calling.compatible).toBe(true);
    expect(result.samples[0].export_compatibility.hf_conversational.compatible).toBe(false);
    expect(result.samples[0].export_compatibility.hf_conversational.reasons).toContain(
      'target_incompatible_hf_conversational'
    );
    expect(result.samples[0].source.artifact_refs.some((ref) => ref.kind === 'tool_trace')).toBe(true);
    expect(result.samples[0].provenance.lineage.some((entry) => entry.includes('tool-trace'))).toBe(true);
  });

  it('rejects tool-trace-backed samples when tool call arguments contain private keys', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    const patchPath = path.join(tempDir, 'patches', 'run-e15-s1-tool-trace.patch');
    const toolTracePath = path.join(tempDir, 'traces', 'run-e15-s1-tool-trace-blocked.json');

    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.mkdirSync(path.dirname(toolTracePath), { recursive: true });

    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n需要让 runtime dashboard 的工具调用也能进入 SFT 导出。\n\n## §4 修复方案\n把 runtime tool trace 注入 canonical sample，在最终 assistant 输出前保留 tool call 与 tool result。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      patchPath,
      '--- a/foo.ts\n+++ b/foo.ts\n-old trace code\n+new trace code',
      'utf-8'
    );
    fs.writeFileSync(
      toolTracePath,
      JSON.stringify(
        {
          trace_version: 1,
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_runtime_snapshot',
                description: 'Read runtime snapshot',
                parameters: {
                  type: 'object',
                  properties: {
                    privateKey: { type: 'string' },
                  },
                },
              },
            },
          ],
          messages: [
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
          ],
        },
        null,
        2
      ),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        {
          ...makeRecord({
            source_path: bugfixPath,
            patch_ref: 'sha256:patch-snapshot-tool-trace',
            patch_snapshot_path: patchPath,
          }),
          tool_trace_path: toolTracePath,
          tool_trace_ref: 'sha256:tool-trace-blocked-001',
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
      maxTokens: 512,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].redaction.status).toBe('blocked');
    expect(result.samples[0].quality.trace_completeness).toBe('blocked');
    expect(result.samples[0].quality.acceptance_decision).toBe('rejected');
    expect(result.samples[0].quality.training_ready).toBe(false);
    expect(result.samples[0].quality.training_blockers).toEqual(
      expect.arrayContaining(['redaction_blocked', 'tool_trace_blocked'])
    );
    expect(result.samples[0].quality.rejection_reasons).toEqual(
      expect.arrayContaining(['redaction_blocked', 'secret_detected_unresolved'])
    );
    expect(result.samples[0].export_compatibility.hf_tool_calling.compatible).toBe(false);
  });

  it('marks tool traces as partial when assistant calls do not have matching tool results', async () => {
    const bugfixPath = path.join(tempDir, 'BUGFIX_runtime-dashboard-sft.md');
    const patchPath = path.join(tempDir, 'patches', 'run-e15-s1-tool-trace.patch');
    const toolTracePath = path.join(tempDir, 'traces', 'run-e15-s1-tool-trace-partial.json');

    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.mkdirSync(path.dirname(toolTracePath), { recursive: true });

    fs.writeFileSync(
      bugfixPath,
      `## §1 问题\n需要让 runtime dashboard 的工具调用也能进入 SFT 导出。\n\n## §4 修复方案\n把 runtime tool trace 注入 canonical sample。\n`,
      'utf-8'
    );
    fs.writeFileSync(
      patchPath,
      '--- a/foo.ts\n+++ b/foo.ts\n-old trace code\n+new trace code',
      'utf-8'
    );
    fs.writeFileSync(
      toolTracePath,
      JSON.stringify(
        {
          trace_version: 1,
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_runtime_snapshot',
                parameters: { type: 'object' },
              },
            },
          ],
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-runtime-002',
                  type: 'function',
                  function: {
                    name: 'get_runtime_snapshot',
                    arguments: '{"run_id":"run-e15-s1-tool-trace"}',
                  },
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tempDir, 'record.json'),
      JSON.stringify(
        {
          ...makeRecord({
            source_path: bugfixPath,
            patch_ref: 'sha256:patch-snapshot-tool-trace',
            patch_snapshot_path: patchPath,
          }),
          tool_trace_path: toolTracePath,
          tool_trace_ref: 'sha256:tool-trace-partial-001',
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildCanonicalCandidates({
      dataPath: tempDir,
      cwd: tempDir,
      minScore: 90,
      maxTokens: 512,
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].quality.trace_completeness).toBe('partial');
    expect(result.samples[0].quality.acceptance_decision).toBe('downgraded');
    expect(result.samples[0].quality.training_ready).toBe(false);
    expect(result.samples[0].quality.training_blockers).toEqual(
      expect.arrayContaining(['tool_trace_partial'])
    );
  });
});
