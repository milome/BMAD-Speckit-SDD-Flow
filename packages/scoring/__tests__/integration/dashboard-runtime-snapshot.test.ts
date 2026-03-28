import { afterEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runEnsureRunCli } from '../../../runtime-context/src/cli';
import { parseAndWriteScore } from '../../orchestrator/parse-and-write';
import { createRuntimeDashboardFixture } from '../../../../tests/helpers/runtime-dashboard-fixture';

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

  it('surfaces a real host tool trace fixture inside runtime snapshot sft summary output', () => {
    const fixturePromise = createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
    });

    return fixturePromise.then((fixture) => {
      roots.push(fixture.root);

      const markdownPath = path.join(fixture.root, '_bmad-output', 'dashboard-real-tool-trace.md');
      const jsonPath = path.join(
        fixture.root,
        '_bmad-output',
        'dashboard',
        'runtime-dashboard-real-tool-trace.json'
      );

      const stdout = execSync(
        `npx ts-node scripts/dashboard-generate.ts --dataPath "${fixture.dataPath}" --json --include-runtime --output "${markdownPath}" --output-json "${jsonPath}"`,
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        }
      );

      const markdown = fs.readFileSync(markdownPath, 'utf-8');
      const snapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
        selection: { run_id: string };
        sft_summary: {
          total_candidates: number;
          accepted: number;
          redaction_status_counts: { clean: number; redacted: number; blocked: number };
          target_availability: Record<string, { compatible: number; incompatible: number }>;
          redaction_preview: Array<{ sample_id: string; status: string; run_id: string }>;
        };
      };
      const stdoutSnapshot = JSON.parse(stdout) as {
        sft_summary: {
          total_candidates: number;
        };
      };

      expect(snapshot.selection.run_id).toBe(fixture.runId);
      expect(snapshot.sft_summary).toEqual(
        expect.objectContaining({
          total_candidates: 1,
          accepted: 1,
          redaction_status_counts: {
            clean: 1,
            redacted: 0,
            blocked: 0,
          },
          target_availability: expect.objectContaining({
            hf_tool_calling: expect.objectContaining({
              compatible: 1,
            }),
          }),
        })
      );
      expect(snapshot.sft_summary.redaction_preview).toEqual([]);
      expect(markdown).toContain('Redaction Clean: 1');
      expect(stdoutSnapshot.sft_summary.total_candidates).toBe(1);
    });
  });

  it('surfaces real host redacted and blocked tool trace fixtures inside runtime snapshot sft summary output', () => {
    const fixturePromise = createRuntimeDashboardFixture({
      withSftDataset: true,
      withBundle: true,
      withRealToolTraceFixture: true,
      realToolTraceVariants: ['clean', 'redacted', 'blocked'],
    });

    return fixturePromise.then((fixture) => {
      roots.push(fixture.root);

      const markdownPath = path.join(fixture.root, '_bmad-output', 'dashboard-real-tool-trace-matrix.md');
      const jsonPath = path.join(
        fixture.root,
        '_bmad-output',
        'dashboard',
        'runtime-dashboard-real-tool-trace-matrix.json'
      );

      execSync(
        `npx ts-node scripts/dashboard-generate.ts --dataPath "${fixture.dataPath}" --json --include-runtime --output "${markdownPath}" --output-json "${jsonPath}"`,
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        }
      );

      const markdown = fs.readFileSync(markdownPath, 'utf-8');
      const snapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
        sft_summary: {
          total_candidates: number;
          accepted: number;
          rejected: number;
          redaction_status_counts: { clean: number; redacted: number; blocked: number };
          target_availability: Record<string, { compatible: number; incompatible: number }>;
          rejection_reasons: Array<{ reason: string; count: number }>;
          redaction_preview: Array<{
            run_id: string;
            status: string;
            applied_rules: string[];
            finding_kinds: string[];
            rejection_reasons: string[];
          }>;
        };
      };

      expect(snapshot.sft_summary).toEqual(
        expect.objectContaining({
          total_candidates: 3,
          accepted: 2,
          rejected: 1,
          redaction_status_counts: {
            clean: 1,
            redacted: 1,
            blocked: 1,
          },
          target_availability: expect.objectContaining({
            openai_chat: expect.objectContaining({
              compatible: 2,
              incompatible: 1,
            }),
            hf_tool_calling: expect.objectContaining({
              compatible: 2,
              incompatible: 1,
            }),
          }),
          rejection_reasons: expect.arrayContaining([
            { reason: 'redaction_blocked', count: 1 },
            { reason: 'secret_detected_unresolved', count: 1 },
          ]),
        })
      );
      expect(snapshot.sft_summary.redaction_preview).toEqual([
        expect.objectContaining({
          run_id: fixture.runId,
          status: 'blocked',
          applied_rules: ['private-key'],
          finding_kinds: ['private_key'],
          rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
        }),
        expect.objectContaining({
          run_id: fixture.runId,
          status: 'redacted',
          applied_rules: ['secret-token'],
          finding_kinds: ['secret_token'],
          rejection_reasons: [],
        }),
      ]);
      expect(markdown).toContain('Redaction Redacted: 1');
      expect(markdown).toContain('Redaction Blocked: 1');
    });
  });
});
