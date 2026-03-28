import { afterEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runEnsureRunCli } from '../../../runtime-context/src/cli';
import { parseAndWriteScore } from '../../orchestrator/parse-and-write';

const FIXTURES = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'parsers',
  '__tests__',
  'fixtures'
);

describe('dashboard runtime snapshot integration', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes runtime-aware json snapshot alongside markdown and supports --json output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-runtime-snapshot-'));
    roots.push(root);

    runEnsureRunCli({
      cwd: root,
      storyKey: '15-1-runtime-dashboard-sft',
      lifecycle: 'dev_story',
    });

    const lastRun = JSON.parse(
      fs.readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf-8')
    ) as { runId: string };

    await parseAndWriteScore({
      content: fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8'),
      stage: 'implement',
      runId: lastRun.runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: path.join(root, 'packages', 'scoring', 'data'),
      artifactDocPath: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      baseCommitHash: 'ad245b7',
    });

    const markdownPath = path.join(root, '_bmad-output', 'dashboard.md');
    const jsonPath = path.join(root, '_bmad-output', 'dashboard', 'runtime-dashboard.json');

    const stdout = execSync(
      `npx ts-node scripts/dashboard-generate.ts --dataPath "${path.join(root, 'packages', 'scoring', 'data')}" --json --include-runtime --output "${markdownPath}" --output-json "${jsonPath}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
      }
    );

    expect(fs.existsSync(markdownPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const markdown = fs.readFileSync(markdownPath, 'utf-8');
    const snapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
      selection: { run_id: string };
      runtime_context: { current_stage: string; scope: { story_key: string } };
      score_detail: { records: Array<{ stage: string; phase_score: number }> };
    };
    const stdoutSnapshot = JSON.parse(stdout) as { selection: { run_id: string } };

    expect(markdown).toContain('数据不足，暂无完整 run');
    expect(markdown).toContain('Runtime Context');
    expect(snapshot.selection.run_id).toBe(lastRun.runId);
    expect(snapshot.runtime_context.current_stage).toBe('implement');
    expect(snapshot.runtime_context.scope.story_key).toBe('15-1-runtime-dashboard-sft');
    expect(snapshot.score_detail.records).toEqual([
      expect.objectContaining({
        stage: 'implement',
      }),
    ]);
    expect(stdoutSnapshot.selection.run_id).toBe(lastRun.runId);
  });
});
