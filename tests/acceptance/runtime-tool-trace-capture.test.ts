import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../packages/runtime-context/src/registry';
import { readRuntimeEvents } from '../../packages/scoring/runtime/event-store';

const repoRoot = process.cwd();
const cursorRealFixturePath = path.join(repoRoot, 'tests', 'fixtures', 'cursor-post-tool-use-real.stdin.json');

function writeActiveRunContext(root: string, runId: string, stage: string): string {
  const runContextRelativePath = path.join(
    '_bmad-output',
    'runtime',
    'context',
    'runs',
    'epic-1',
    '1-1-runtime-tool-trace',
    `${runId}.json`
  );
  const runContextPath = path.join(root, runContextRelativePath);

  fs.mkdirSync(path.dirname(runContextPath), { recursive: true });
  fs.writeFileSync(
    runContextPath,
    JSON.stringify(
      {
        version: 1,
        flow: 'story',
        stage,
        sourceMode: 'full_bmad',
        epicId: 'epic-1',
        storyId: '1-1-runtime-tool-trace',
        storySlug: 'runtime-tool-trace',
        runId,
        contextScope: 'story',
        updatedAt: '2026-03-28T09:00:00.000Z',
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const registry = defaultRuntimeContextRegistry(root);
  registry.runContexts[runId] = {
    path: runContextRelativePath.replace(/\\/g, '/'),
    epicId: 'epic-1',
    storyId: '1-1-runtime-tool-trace',
    runId,
    lifecycleStage: 'dev_story',
  };
  registry.activeScope = {
    scopeType: 'run',
    epicId: 'epic-1',
    storyId: '1-1-runtime-tool-trace',
    runId,
    resolvedContextPath: runContextRelativePath.replace(/\\/g, '/'),
    reason: 'runtime-tool-trace-capture-test',
  };
  writeRuntimeContextRegistry(root, registry);

  return runContextPath;
}

describe('runtime tool trace automatic capture', () => {
  it('post-tool-use hook appends canonical tool trace sidecar and runtime artifact events', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-tool-trace-capture-'));
    const runId = 'run-runtime-tool-trace-001';

    try {
      fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
      writeActiveRunContext(tempRoot, runId, 'implement');

      const hookModule = require(path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'post-tool-use-core.cjs')) as {
        captureToolTrace: (input: unknown) => unknown;
      };
      const firstPayload = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Read',
        tool_input: {
          file_path: 'specs/epic-1/story-1-runtime-tool-trace/plan.md',
        },
        tool_result: 'runtime dashboard status: running',
      });

      const previousClaudeProjectDir = process.env.CLAUDE_PROJECT_DIR;
      process.env.CLAUDE_PROJECT_DIR = tempRoot;
      hookModule.captureToolTrace(JSON.parse(firstPayload));

      const secondPayload = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Grep',
        tool_input: {
          pattern: 'tool_trace',
          path: 'packages/scoring',
        },
        tool_result: {
          matches: ['packages/scoring/analytics/tool-trace.ts'],
        },
      });

      hookModule.captureToolTrace(JSON.parse(secondPayload));

      const artifactDir = path.join(
        tempRoot,
        '_bmad-output',
        'runtime',
        'artifacts',
        'tool-traces',
        runId
      );
      const files = fs.existsSync(artifactDir) ? fs.readdirSync(artifactDir) : [];
      expect(files.length).toBeGreaterThan(0);
      const artifactPath = path.join(artifactDir, files[0]);
      expect(fs.existsSync(artifactPath)).toBe(true);

      const trace = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
        tools: Array<{ function: { name: string } }>;
        messages: Array<
          | { role: 'assistant'; tool_calls?: Array<{ function: { name: string } }> }
          | { role: 'tool'; content: string }
        >;
      };

      expect(trace.tools.map((tool) => tool.function.name)).toEqual(['Read', 'Grep']);
      expect(trace.messages).toHaveLength(4);
      expect(trace.messages[0]).toMatchObject({
        role: 'assistant',
        tool_calls: [{ function: { name: 'Read' } }],
      });
      expect(trace.messages[1]).toMatchObject({
        role: 'tool',
        content: 'runtime dashboard status: running',
      });
      expect(trace.messages[2]).toMatchObject({
        role: 'assistant',
        tool_calls: [{ function: { name: 'Grep' } }],
      });
      expect(trace.messages[3]).toMatchObject({ role: 'tool' });

      const events = readRuntimeEvents({ root: tempRoot }).filter(
        (event) =>
          event.run_id === runId &&
          event.event_type === 'artifact.attached' &&
          event.payload.kind === 'tool_trace'
      );

      expect(events).toHaveLength(2);
      expect(events.at(-1)?.stage).toBe('implement');
      expect(events.at(-1)?.payload.path).toBe(artifactPath);
      expect(events.at(-1)?.payload.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      if (previousClaudeProjectDir === undefined) {
        delete process.env.CLAUDE_PROJECT_DIR;
      } else {
        process.env.CLAUDE_PROJECT_DIR = previousClaudeProjectDir;
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('replays a real cursor postToolUse stdin fixture into the canonical tool trace sidecar', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-tool-trace-cursor-real-'));
    const runId = 'run-runtime-tool-trace-cursor-real-001';

    try {
      fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
      writeActiveRunContext(tempRoot, runId, 'implement');

      const hookModule = require(path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'post-tool-use-core.cjs')) as {
        captureToolTrace: (input: unknown) => unknown;
      };
      const payload = JSON.parse(fs.readFileSync(cursorRealFixturePath, 'utf8')) as Record<string, unknown>;
      const previousCursorProjectRoot = process.env.CURSOR_PROJECT_ROOT;
      const previousToolTraceStage = process.env.BMAD_TOOL_TRACE_STAGE;
      process.env.CURSOR_PROJECT_ROOT = tempRoot;
      process.env.BMAD_TOOL_TRACE_STAGE = 'implement';
      hookModule.captureToolTrace({
        ...payload,
        cwd: tempRoot,
        stage: 'implement',
      });

      const artifactDir = path.join(
        tempRoot,
        '_bmad-output',
        'runtime',
        'artifacts',
        'tool-traces',
        runId
      );
      const files = fs.existsSync(artifactDir) ? fs.readdirSync(artifactDir) : [];
      expect(files.length).toBeGreaterThan(0);
      const artifactPath = path.join(artifactDir, files[0]);
      expect(fs.existsSync(artifactPath)).toBe(true);

      const trace = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
        tools: Array<{ function: { name: string } }>;
        messages: Array<
          | {
              role: 'assistant';
              tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
            }
          | { role: 'tool'; tool_call_id: string; content: string }
        >;
      };

      expect(trace.tools.map((tool) => tool.function.name)).toEqual(['Shell']);
      expect(trace.messages).toHaveLength(2);
      expect(trace.messages[0]).toMatchObject({
        role: 'assistant',
        tool_calls: [
          {
            id: '00000000-1111-2222-3333-444444444444',
            function: {
              name: 'Shell',
            },
          },
        ],
      });
      expect((trace.messages[0] as { tool_calls?: Array<{ function: { name: string; arguments: string } }> }).tool_calls?.[0]?.function.arguments).toContain(
        'runtime-v6-sync-protected-paths.test.ts'
      );
      expect(trace.messages[1]).toMatchObject({
        role: 'tool',
        tool_call_id: '00000000-1111-2222-3333-444444444444',
      });
      expect((trace.messages[1] as { content?: string }).content).toContain('"exitCode":0');

      const events = readRuntimeEvents({ root: tempRoot }).filter(
        (event) =>
          event.run_id === runId &&
          event.event_type === 'artifact.attached' &&
          event.payload.kind === 'tool_trace'
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.payload.tool_name).toBe('Shell');
      expect(events[0]?.payload.tool_call_id).toBe('00000000-1111-2222-3333-444444444444');
      if (previousCursorProjectRoot === undefined) {
        delete process.env.CURSOR_PROJECT_ROOT;
      } else {
        process.env.CURSOR_PROJECT_ROOT = previousCursorProjectRoot;
      }
      if (previousToolTraceStage === undefined) {
        delete process.env.BMAD_TOOL_TRACE_STAGE;
      } else {
        process.env.BMAD_TOOL_TRACE_STAGE = previousToolTraceStage;
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
