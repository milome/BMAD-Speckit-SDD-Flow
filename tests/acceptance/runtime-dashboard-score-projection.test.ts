import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runEnsureRunCli } from '../../packages/runtime-context/src/cli';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';
import { readRuntimeEvents } from '../../packages/scoring/runtime/event-store';
import { buildRunProjection } from '../../packages/scoring/runtime/projection';

const FIXTURES = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'parsers',
  '__tests__',
  'fixtures'
);

describe('runtime dashboard score projection wiring', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('correlates runtime context events with score.written events in one run projection', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-dashboard-score-'));
    roots.push(root);

    runEnsureRunCli({
      cwd: root,
      storyKey: '15-1-runtime-dashboard-sft',
      lifecycle: 'dev_story',
    });

    const lastRun = JSON.parse(
      readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf-8')
    ) as { runId: string };

    await parseAndWriteScore({
      content: fs.readFileSync(
        path.join(FIXTURES, 'sample-implement-report-with-four-dimensions.md'),
        'utf-8'
      ),
      stage: 'implement',
      runId: lastRun.runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: path.join(root, 'packages', 'scoring', 'data'),
      artifactDocPath: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      baseCommitHash: 'ad245b7',
    });

    const events = readRuntimeEvents({ root });
    const scoreWritten = events.find((event) => event.event_type === 'score.written');

    expect(scoreWritten).toBeDefined();
    expect(scoreWritten?.run_id).toBe(lastRun.runId);
    expect(scoreWritten?.stage).toBe('implement');
    expect(scoreWritten?.source).toMatchObject({
      source_path: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      base_commit_hash: 'ad245b7',
    });
    expect(scoreWritten?.source?.content_hash).toMatch(/^([a-f0-9]{64})$/);

    const projection = buildRunProjection(events, lastRun.runId);
    expect(projection).not.toBeNull();
    expect(projection?.current_scope?.story_key).toBe('15-1-runtime-dashboard-sft');
    expect(projection?.current_stage).toBe('implement');
    expect(projection?.score_refs).toHaveLength(1);
    expect(projection?.score_refs[0]).toMatchObject({
      stage: 'implement',
    });
  });
});
