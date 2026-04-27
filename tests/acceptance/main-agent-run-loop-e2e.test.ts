import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent automatic run-loop', () => {
  it('executes inspect dispatch claim dispatch report complete and final inspect from one call', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop',
          runId: 'run-loop-test',
        })
      );

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        executor: ({ projectRoot, instruction, args }) => {
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.status).toBe('completed');
      expect(result.steps.map((step) => step.step)).toEqual([
        'inspect.initial',
        'dispatch-plan',
        'claim',
        'dispatch',
        'task-report.ingest',
        'inspect.final',
      ]);
      expect(result.finalSurface.pendingPacketStatus).toBe('completed');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.status).toBe('done');
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_review');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks instead of synthesizing completion when no real task report is provided', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-run-loop-no-report-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-run-loop-blocked',
          runId: 'run-loop-blocked-test',
        })
      );

      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(result.status).toBe('blocked');
      expect(result.steps.at(-1)).toMatchObject({
        step: 'task-report.load',
        status: 'fail',
      });
      expect(result.finalSurface.pendingPacketStatus).toBe('dispatched');
      expect(result.finalSurface.orchestrationState?.lastTaskReport ?? null).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
