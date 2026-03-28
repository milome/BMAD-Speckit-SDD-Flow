import { mkdtempSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { runEnsureRunCli } from '../../packages/runtime-context/src/cli';
import { parseAndWriteScore } from '../../packages/scoring/orchestrator/parse-and-write';
import { loadAndDedupeRecords } from '../../packages/scoring/query/loader';
import { buildCanonicalCandidatesFromRecordsSync } from '../../packages/scoring/analytics/candidate-builder';
import { writeDatasetBundle } from '../../packages/scoring/analytics/bundle-writer';

const FIXTURES = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'parsers',
  '__tests__',
  'fixtures'
);

export interface RuntimeDashboardFixture {
  root: string;
  runId: string;
  dataPath: string;
  lastBundleId?: string | null;
}

export interface CreateRuntimeDashboardFixtureOptions {
  withSftDataset?: boolean;
  withBundle?: boolean;
}

function writeBugfixDoc(root: string): string {
  const docPath = path.join(root, 'docs', 'plans', 'BUGFIX_runtime-dashboard-sft.md');
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(
    docPath,
    [
      '## §1 问题',
      '当前 runtime dashboard 无法看到 canonical SFT builder 的真实状态。',
      '',
      '## §4 修复方案',
      '把 live dashboard、MCP 和 canonical candidate pipeline 串起来，展示 accepted/rejected、bundle 和 target availability。',
      '',
    ].join('\n'),
    'utf-8'
  );
  return docPath;
}

function initGitRepoWithCommittedDiff(root: string): string {
  const workFile = path.join(root, 'src', 'runtime-dashboard.ts');
  fs.mkdirSync(path.dirname(workFile), { recursive: true });

  execSync('git init', { cwd: root, stdio: 'ignore' });
  execSync('git config user.email "vitest@example.com"', { cwd: root, stdio: 'ignore' });
  execSync('git config user.name "Vitest"', { cwd: root, stdio: 'ignore' });

  fs.writeFileSync(
    workFile,
    "export const renderDashboard = () => 'legacy-runtime-dashboard';\n",
    'utf-8'
  );
  execSync('git add .', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "base runtime dashboard"', { cwd: root, stdio: 'ignore' });
  const baseCommitHash = execSync('git rev-parse HEAD', {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  fs.writeFileSync(
    workFile,
    [
      "export const renderDashboard = () => ({",
      "  status: 'live',",
      "  panels: ['overview', 'runtime', 'timeline', 'score', 'sft'],",
      '});',
      '',
    ].join('\n'),
    'utf-8'
  );
  execSync('git add src/runtime-dashboard.ts', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "wire sft dashboard"', { cwd: root, stdio: 'ignore' });

  return baseCommitHash;
}

export async function createRuntimeDashboardFixture(
  options: CreateRuntimeDashboardFixtureOptions = {}
): Promise<RuntimeDashboardFixture> {
  const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-dashboard-fixture-'));

  runEnsureRunCli({
    cwd: root,
    storyKey: '15-1-runtime-dashboard-sft',
    lifecycle: 'dev_story',
  });

  const lastRun = JSON.parse(
    readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf-8')
  ) as { runId: string };

  const dataPath = path.join(root, 'packages', 'scoring', 'data');
  let lastBundleId: string | null = null;

  if (options.withSftDataset) {
    const bugfixDocPath = writeBugfixDoc(root);
    const artifactDocPath = path.relative(root, bugfixDocPath).replace(/\\/g, '/');
    const baseCommitHash = initGitRepoWithCommittedDiff(root);

    await parseAndWriteScore({
      content: fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8'),
      stage: 'story',
      runId: lastRun.runId,
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath,
      artifactDocPath,
      baseCommitHash,
    });

    await parseAndWriteScore({
      content: fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-veto.md'), 'utf-8'),
      stage: 'prd',
      runId: lastRun.runId,
      scenario: 'real_dev',
      writeMode: 'jsonl',
      dataPath,
      artifactDocPath,
      baseCommitHash,
    });

    if (options.withBundle) {
      const samples = buildCanonicalCandidatesFromRecordsSync(loadAndDedupeRecords(dataPath), {
        cwd: root,
        minScore: 90,
      }).samples;
      const bundle = await writeDatasetBundle(samples, {
        exportTarget: 'openai_chat',
        outputRoot: path.join(root, '_bmad-output', 'datasets'),
        exporterVersion: 'v1-test',
        filterSettings: {
          min_score: 90,
        },
      });
      lastBundleId = bundle.manifest.bundle_id;
    }
  } else {
    await parseAndWriteScore({
      content: fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8'),
      stage: 'implement',
      runId: lastRun.runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath,
      artifactDocPath: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
      baseCommitHash: 'ad245b7',
    });
  }

  return {
    root,
    runId: lastRun.runId,
    dataPath,
    lastBundleId,
  };
}
