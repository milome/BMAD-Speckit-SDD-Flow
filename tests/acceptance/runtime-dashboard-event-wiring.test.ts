import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runEnsureRunCli } from '../../packages/runtime-context/src/cli';
import { readRuntimeEvents } from '../../packages/scoring/runtime/event-store';

describe('runtime dashboard event wiring', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ensure-run-runtime-context emits run-scoped lifecycle events', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-dashboard-events-'));
    roots.push(root);

    runEnsureRunCli({
      cwd: root,
      storyKey: '15-1-runtime-dashboard-sft',
      lifecycle: 'dev_story',
    });

    const lastRun = JSON.parse(
      readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf-8')
    ) as { runId: string };
    const events = readRuntimeEvents({ root });

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining(['run.created', 'run.scope.changed', 'stage.started'])
    );
    expect(events.every((event) => event.run_id === lastRun.runId)).toBe(true);

    const scopeChanged = events.find((event) => event.event_type === 'run.scope.changed');
    expect(scopeChanged?.scope).toMatchObject({
      story_key: '15-1-runtime-dashboard-sft',
      epic_id: 'epic-15',
      story_id: '15-1-runtime-dashboard-sft',
      flow: 'story',
    });

    const stageStarted = events.find((event) => event.event_type === 'stage.started');
    expect(stageStarted?.stage).toBe('implement');
  });
});
