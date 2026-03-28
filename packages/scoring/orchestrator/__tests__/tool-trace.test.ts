import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseAndWriteScore } from '../parse-and-write';
import { appendRuntimeEvent } from '../../runtime';

const FIXTURES = path.join(__dirname, '../../parsers/__tests__/fixtures');

describe('parseAndWriteScore tool trace persistence', () => {
  it('records tool_trace_ref and tool_trace_path when an explicit tool trace artifact is provided', async () => {
    const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-tool-trace-'));
    const toolTracePath = path.join(dataPath, 'tool-trace.json');

    try {
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
                      arguments: '{"run_id":"tool-trace-run"}',
                    },
                  },
                ],
              },
              {
                role: 'tool',
                tool_call_id: 'call-runtime-001',
                content: '{"status":"running"}',
              },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );

      const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
      const runId = `tool-trace-${Date.now()}`;

      await parseAndWriteScore({
        content,
        stage: 'prd',
        runId,
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath,
        toolTracePath,
      });

      const written = JSON.parse(
        fs.readFileSync(path.join(dataPath, `${runId}.json`), 'utf-8')
      ) as {
        tool_trace_ref?: string;
        tool_trace_path?: string;
      };

      expect(written.tool_trace_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(written.tool_trace_path).toBe(toolTracePath);
    } finally {
      fs.rmSync(dataPath, { recursive: true, force: true });
    }
  });

  it('auto-discovers the latest tool trace artifact from runtime events when toolTracePath is omitted', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-tool-trace-auto-'));
    const dataPath = path.join(root, '_bmad-output', 'scoring');
    const toolTracePath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'artifacts',
      'tool-traces',
      'run-auto',
      'implement.json'
    );

    try {
      fs.mkdirSync(path.dirname(toolTracePath), { recursive: true });
      fs.writeFileSync(
        toolTracePath,
        JSON.stringify(
          {
            trace_version: 1,
            tools: [
              {
                type: 'function',
                function: {
                  name: 'read_runtime_snapshot',
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
                    id: 'call-runtime-auto-001',
                    type: 'function',
                    function: {
                      name: 'read_runtime_snapshot',
                      arguments: '{"run_id":"run-auto"}',
                    },
                  },
                ],
              },
              {
                role: 'tool',
                tool_call_id: 'call-runtime-auto-001',
                content: '{"status":"running"}',
              },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );

      appendRuntimeEvent(
        {
          event_id: 'evt-tool-trace-auto-001',
          event_type: 'artifact.attached',
          event_version: 1,
          timestamp: '2026-03-28T09:00:00.000Z',
          run_id: 'run-auto',
          flow: 'story',
          stage: 'implement',
          payload: {
            kind: 'tool_trace',
            path: toolTracePath,
            content_hash: 'sha256:auto-trace-001',
          },
          source: {
            source_path: toolTracePath,
            content_hash: 'sha256:auto-trace-001',
          },
        },
        { root }
      );

      const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');

      await parseAndWriteScore({
        content,
        stage: 'implement',
        runId: 'run-auto',
        scenario: 'real_dev',
        writeMode: 'single_file',
        dataPath,
      });

      const written = JSON.parse(
        fs.readFileSync(path.join(dataPath, 'run-auto.json'), 'utf-8')
      ) as {
        tool_trace_ref?: string;
        tool_trace_path?: string;
      };

      expect(written.tool_trace_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(written.tool_trace_path).toBe(toolTracePath);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
