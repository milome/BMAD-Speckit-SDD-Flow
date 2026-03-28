import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync, spawn, spawnSync } from 'node:child_process';
import { ensureScoringBuild } from '../helpers/ensure-scoring-build';
import {
  getRealToolTraceVariantConfig,
  getReportFixturePathForStage,
  type RealToolTraceFixtureVariant,
} from '../helpers/runtime-dashboard-fixture-manifest';

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

const repoRoot = process.cwd();
const binPath = path.join(repoRoot, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

function runCli(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runCliJson<T>(args: string[], cwd: string): T {
  const result = runCli(args, cwd);
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout) as T;
}

function writeBugfixDoc(root: string): string {
  const docPath = path.join(root, 'docs', 'plans', 'BUGFIX_runtime-dashboard-sft.md');
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(
    docPath,
    [
      '## §1 问题',
      'runtime dashboard 需要串起实时执行状态、评分与 SFT 数据面。',
      '',
      '## §4 修复方案',
      '接通 post-tool-use、score、dashboard、runtime-mcp、sft-preview/sft-bundle。',
      '',
    ].join('\n'),
    'utf8'
  );
  return docPath;
}

function getRunContextPath(root: string, runId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'context',
    'runs',
    'epic-15',
    '15-1-runtime-dashboard-sft',
    `${runId}.json`
  );
}

function setRunContextStage(root: string, runId: string, stage: 'implement' | 'tasks' | 'plan'): void {
  const runContextPath = getRunContextPath(root, runId);
  const current = JSON.parse(fs.readFileSync(runContextPath, 'utf8')) as Record<string, unknown>;
  fs.writeFileSync(
    runContextPath,
    JSON.stringify(
      {
        ...current,
        stage,
        updatedAt: '2026-03-28T12:00:00.000Z',
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
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
    'utf8'
  );
  execSync('git add .', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "base runtime dashboard"', { cwd: root, stdio: 'ignore' });
  const baseCommitHash = execSync('git rev-parse HEAD', {
    cwd: root,
    encoding: 'utf8',
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
    'utf8'
  );
  execSync('git add src/runtime-dashboard.ts', { cwd: root, stdio: 'ignore' });
  execSync('git commit -m "wire runtime dashboard sft"', { cwd: root, stdio: 'ignore' });

  return baseCommitHash;
}

function replayCursorFixture(
  root: string,
  runId: string,
  variant: RealToolTraceFixtureVariant
): { stage: 'implement' | 'tasks' | 'plan'; artifactPath: string } {
  const resolved = getRealToolTraceVariantConfig(variant);

  setRunContextStage(root, runId, resolved.stage);

  const hookScript = path.join(root, '_bmad', 'cursor', 'hooks', 'post-tool-use.js');
  const hookRun = spawnSync(process.execPath, [hookScript], {
    cwd: root,
    input: fs.readFileSync(resolved.fixturePath, 'utf8'),
    encoding: 'utf8',
    env: {
      ...process.env,
      CURSOR_PROJECT_ROOT: root,
    },
  });

  expect(hookRun.status, hookRun.stderr || hookRun.stdout).toBe(0);
  expect(hookRun.stdout).toBe('{}\n');

  const artifactPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'artifacts',
    'tool-traces',
    runId,
    `${resolved.stage}.json`
  );
  expect(fs.existsSync(artifactPath)).toBe(true);

  return {
    stage: resolved.stage,
    artifactPath,
  };
}

function encodeMessage(message: JsonRpcMessage): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

async function readMessage(proc: ReturnType<typeof spawn>): Promise<JsonRpcMessage> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const splitIndex = buffer.indexOf('\r\n\r\n');
      if (splitIndex === -1) {
        return;
      }
      const header = buffer.slice(0, splitIndex);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        reject(new Error(`missing content-length header: ${header}`));
        return;
      }
      const length = Number(match[1]);
      const bodyStart = splitIndex + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }
      const body = buffer.slice(bodyStart, bodyStart + length);
      proc.stdout.off('data', onData);
      resolve(JSON.parse(body) as JsonRpcMessage);
    };

    proc.stdout.on('data', onData);
    proc.once('error', reject);
  });
}

describe('runtime CLI e2e smoke', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('chains post-tool-use, score, dashboard snapshot, runtime-mcp, sft-preview, and sft-bundle into one real user path', async () => {
    ensureScoringBuild(repoRoot);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-cli-e2e-smoke-'));
    roots.push(root);
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });

    const bugfixDocPath = writeBugfixDoc(root);
    const baseCommitHash = initGitRepoWithCommittedDiff(root);
    const dataPath = path.join(root, 'packages', 'scoring', 'data');
    const dashboardOutputPath = path.join(root, '_bmad-output', 'dashboard.md');
    const dashboardJsonPath = path.join(root, '_bmad-output', 'dashboard', 'runtime-dashboard.json');
    const bundleDir = path.join(root, '_bmad-output', 'datasets');

    const ensureRun = runCli(
      ['ensure-run-runtime-context', '--story-key', '15-1-runtime-dashboard-sft'],
      root
    );
    expect(ensureRun.status, ensureRun.stderr || ensureRun.stdout).toBe(0);

    const lastRun = JSON.parse(
      fs.readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf8')
    ) as { runId: string };
    const runId = lastRun.runId;

    const hookScript = path.join(root, '_bmad', 'cursor', 'hooks', 'post-tool-use.js');
    const hookRun = spawnSync(process.execPath, [hookScript], {
      cwd: root,
      input: fs.readFileSync(getRealToolTraceVariantConfig('clean').fixturePath, 'utf8'),
      encoding: 'utf8',
      env: {
        ...process.env,
        CURSOR_PROJECT_ROOT: root,
      },
    });

    expect(hookRun.status, hookRun.stderr || hookRun.stdout).toBe(0);
    expect(hookRun.stdout).toBe('{}\n');

    const toolTracePath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'artifacts',
      'tool-traces',
      runId,
      'implement.json'
    );
    expect(fs.existsSync(toolTracePath)).toBe(true);

    const scoreRun = runCli(
      [
        'score',
        '--reportPath',
        getReportFixturePathForStage('implement'),
        '--stage',
        'implement',
        '--runId',
        runId,
        '--scenario',
        'real_dev',
        '--writeMode',
        'jsonl',
        '--skipTriggerCheck',
        '--dataPath',
        dataPath,
        '--artifactDocPath',
        path.relative(root, bugfixDocPath).replace(/\\/g, '/'),
        '--baseCommitHash',
        baseCommitHash,
        '--toolTracePath',
        toolTracePath,
      ],
      root
    );
    expect(scoreRun.status, scoreRun.stderr || scoreRun.stdout).toBe(0);

    const dashboardSnapshot = runCliJson<{
      selection: { run_id: string | null };
      runtime_context: { current_stage: string | null };
      sft_summary: {
        total_candidates: number;
        accepted: number;
        rejected: number;
        redaction_status_counts: { clean: number; redacted: number; blocked: number };
        target_availability: Record<string, { compatible: number; incompatible: number }>;
      };
    }>(
      [
        'dashboard',
        '--dataPath',
        dataPath,
        '--json',
        '--include-runtime',
        '--output',
        dashboardOutputPath,
        '--output-json',
        dashboardJsonPath,
      ],
      root
    );

    expect(fs.existsSync(dashboardOutputPath)).toBe(true);
    expect(fs.existsSync(dashboardJsonPath)).toBe(true);
    expect(dashboardSnapshot.selection.run_id).toBe(runId);
    expect(dashboardSnapshot.runtime_context.current_stage).toBe('implement');
    expect(dashboardSnapshot.sft_summary).toEqual(
      expect.objectContaining({
        total_candidates: 1,
        accepted: 1,
        rejected: 0,
        redaction_status_counts: {
          clean: 1,
          redacted: 0,
          blocked: 0,
        },
        target_availability: expect.objectContaining({
          hf_tool_calling: expect.objectContaining({
            compatible: 1,
            incompatible: 0,
          }),
        }),
      })
    );

    const mcpProc = spawn(process.execPath, [binPath, 'runtime-mcp', '--dataPath', dataPath, '--dashboard-port', '0'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '1.0.0' },
          },
        })
      );
      await readMessage(mcpProc);

      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'preview_sft',
            arguments: {},
          },
        })
      );
      const previewResponse = await readMessage(mcpProc);

      expect(previewResponse.result?.structuredContent).toEqual(
        expect.objectContaining({
          total_candidates: 1,
          accepted: 1,
          rejected: 0,
          redaction_status_counts: {
            clean: 1,
            redacted: 0,
            blocked: 0,
          },
        })
      );

      const previewCli = runCliJson<{
        total_candidates: number;
        accepted: number;
        rejected: number;
        downgraded: number;
        by_split: Record<string, number>;
        targets: string[];
      }>(
        ['sft-preview', '--dataPath', dataPath, '--target', 'hf_tool_calling'],
        root
      );

      expect(previewCli).toEqual(
        expect.objectContaining({
          total_candidates: 1,
          accepted: 1,
          rejected: 0,
          downgraded: 0,
          by_split: expect.any(Object),
          targets: ['hf_tool_calling'],
        })
      );
      expect(previewCli.by_split.holdout).toBe(0);
      expect(
        previewCli.by_split.train + previewCli.by_split.validation + previewCli.by_split.test
      ).toBe(1);

      const bundleCli = runCliJson<{
        bundle_dir: string;
        manifest_path: string;
        validation_report_path: string;
        rejection_report_path: string;
        counts: {
          accepted: number;
          rejected: number;
          train: number;
          validation: number;
          test: number;
        };
      }>(
        ['sft-bundle', '--dataPath', dataPath, '--target', 'hf_tool_calling', '--bundle-dir', bundleDir],
        root
      );

      expect(bundleCli.counts).toMatchObject({
        accepted: 1,
        rejected: 0,
      });
      expect(bundleCli.counts.train + bundleCli.counts.validation + bundleCli.counts.test).toBe(1);
      expect(fs.existsSync(path.join(root, bundleCli.manifest_path))).toBe(true);
      expect(fs.existsSync(path.join(root, bundleCli.validation_report_path))).toBe(true);
      expect(fs.existsSync(path.join(root, bundleCli.rejection_report_path))).toBe(true);

      const manifest = JSON.parse(
        fs.readFileSync(path.join(root, bundleCli.manifest_path), 'utf8')
      ) as { bundle_id: string };

      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'export_sft',
            arguments: {
              target: 'hf_tool_calling',
            },
          },
        })
      );
      const exportResponse = await readMessage(mcpProc);

      expect(exportResponse.result?.structuredContent).toEqual(
        expect.objectContaining({
          target: 'hf_tool_calling',
          compatible_samples: 1,
          incompatible_samples: 0,
          last_bundle_id: manifest.bundle_id,
          redaction_status_counts: {
            clean: 1,
            redacted: 0,
            blocked: 0,
          },
        })
      );
    } finally {
      if (!mcpProc.killed) {
        mcpProc.kill();
      }
      await new Promise((resolve) => mcpProc.once('exit', resolve));
    }
  }, 40000);

  it('chains clean, redacted, and blocked tool traces through CLI smoke and preserves redaction/rejection/export signals end-to-end', async () => {
    ensureScoringBuild(repoRoot);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-cli-e2e-redaction-smoke-'));
    roots.push(root);
    fs.cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });

    const bugfixDocPath = writeBugfixDoc(root);
    const baseCommitHash = initGitRepoWithCommittedDiff(root);
    const dataPath = path.join(root, 'packages', 'scoring', 'data');
    const dashboardOutputPath = path.join(root, '_bmad-output', 'dashboard-redaction.md');
    const dashboardJsonPath = path.join(root, '_bmad-output', 'dashboard', 'runtime-dashboard-redaction.json');
    const bundleDir = path.join(root, '_bmad-output', 'datasets');

    const ensureRun = runCli(
      ['ensure-run-runtime-context', '--story-key', '15-1-runtime-dashboard-sft'],
      root
    );
    expect(ensureRun.status, ensureRun.stderr || ensureRun.stdout).toBe(0);

    const lastRun = JSON.parse(
      fs.readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf8')
    ) as { runId: string };
    const runId = lastRun.runId;

    for (const variant of ['clean', 'redacted', 'blocked'] as const) {
      const trace = replayCursorFixture(root, runId, variant);
      const scoreRun = runCli(
        [
          'score',
          '--reportPath',
          getReportFixturePathForStage(trace.stage),
          '--stage',
          trace.stage,
          '--runId',
          runId,
          '--scenario',
          'real_dev',
          '--writeMode',
          'jsonl',
          '--skipTriggerCheck',
          '--dataPath',
          dataPath,
          '--artifactDocPath',
          path.relative(root, bugfixDocPath).replace(/\\/g, '/'),
          '--baseCommitHash',
          baseCommitHash,
          '--toolTracePath',
          trace.artifactPath,
        ],
        root
      );
      expect(scoreRun.status, scoreRun.stderr || scoreRun.stdout).toBe(0);
    }

    const dashboardSnapshot = runCliJson<{
      selection: { run_id: string | null };
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
    }>(
      [
        'dashboard',
        '--dataPath',
        dataPath,
        '--json',
        '--include-runtime',
        '--output',
        dashboardOutputPath,
        '--output-json',
        dashboardJsonPath,
      ],
      root
    );

    expect(fs.existsSync(dashboardOutputPath)).toBe(true);
    expect(fs.existsSync(dashboardJsonPath)).toBe(true);
    expect(dashboardSnapshot.selection.run_id).toBe(runId);
    expect(dashboardSnapshot.sft_summary).toEqual(
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
    expect(dashboardSnapshot.sft_summary.redaction_preview).toEqual([
      expect.objectContaining({
        run_id: runId,
        status: 'blocked',
        applied_rules: ['private-key'],
        finding_kinds: ['private_key'],
        rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
      }),
      expect.objectContaining({
        run_id: runId,
        status: 'redacted',
        applied_rules: ['secret-token'],
        finding_kinds: ['secret_token'],
        rejection_reasons: [],
      }),
    ]);

    const mcpProc = spawn(process.execPath, [binPath, 'runtime-mcp', '--dataPath', dataPath, '--dashboard-port', '0'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '1.0.0' },
          },
        })
      );
      await readMessage(mcpProc);

      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'preview_sft',
            arguments: {},
          },
        })
      );
      const previewResponse = await readMessage(mcpProc);

      expect(previewResponse.result?.structuredContent).toEqual(
        expect.objectContaining({
          total_candidates: 3,
          accepted: 2,
          rejected: 1,
          redaction_status_counts: {
            clean: 1,
            redacted: 1,
            blocked: 1,
          },
          redaction_preview: [
            expect.objectContaining({
              run_id: runId,
              status: 'blocked',
            }),
            expect.objectContaining({
              run_id: runId,
              status: 'redacted',
            }),
          ],
        })
      );

      const previewCli = runCliJson<{
        total_candidates: number;
        accepted: number;
        rejected: number;
        downgraded: number;
        by_split: Record<string, number>;
        targets: string[];
      }>(
        ['sft-preview', '--dataPath', dataPath, '--target', 'hf_tool_calling'],
        root
      );

      expect(previewCli).toEqual(
        expect.objectContaining({
          total_candidates: 3,
          accepted: 2,
          rejected: 1,
          downgraded: 0,
          targets: ['hf_tool_calling'],
        })
      );
      expect(previewCli.by_split.holdout).toBe(0);
      expect(
        previewCli.by_split.train + previewCli.by_split.validation + previewCli.by_split.test
      ).toBe(2);

      const bundleCli = runCliJson<{
        bundle_dir: string;
        manifest_path: string;
        validation_report_path: string;
        rejection_report_path: string;
        counts: {
          accepted: number;
          rejected: number;
          train: number;
          validation: number;
          test: number;
        };
      }>(
        ['sft-bundle', '--dataPath', dataPath, '--target', 'hf_tool_calling', '--bundle-dir', bundleDir],
        root
      );

      expect(bundleCli.counts).toMatchObject({
        accepted: 2,
        rejected: 1,
      });
      expect(bundleCli.counts.train + bundleCli.counts.validation + bundleCli.counts.test).toBe(2);
      expect(fs.existsSync(path.join(root, bundleCli.manifest_path))).toBe(true);
      expect(fs.existsSync(path.join(root, bundleCli.validation_report_path))).toBe(true);
      expect(fs.existsSync(path.join(root, bundleCli.rejection_report_path))).toBe(true);

      const rejectionReport = JSON.parse(
        fs.readFileSync(path.join(root, bundleCli.rejection_report_path), 'utf8')
      ) as {
        rejected_samples: Array<{ sample_id: string; reasons: string[] }>;
      };
      expect(rejectionReport.rejected_samples).toEqual([
        expect.objectContaining({
          reasons: expect.arrayContaining(['redaction_blocked', 'secret_detected_unresolved']),
        }),
      ]);

      const manifest = JSON.parse(
        fs.readFileSync(path.join(root, bundleCli.manifest_path), 'utf8')
      ) as { bundle_id: string };

      mcpProc.stdin.write(
        encodeMessage({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'export_sft',
            arguments: {
              target: 'hf_tool_calling',
            },
          },
        })
      );
      const exportResponse = await readMessage(mcpProc);

      expect(exportResponse.result?.structuredContent).toEqual(
        expect.objectContaining({
          target: 'hf_tool_calling',
          compatible_samples: 2,
          incompatible_samples: 1,
          last_bundle_id: manifest.bundle_id,
          rejection_reasons: expect.arrayContaining([
            { reason: 'redaction_blocked', count: 1 },
            { reason: 'secret_detected_unresolved', count: 1 },
          ]),
          redaction_status_counts: {
            clean: 1,
            redacted: 1,
            blocked: 1,
          },
          redaction_preview: [
            expect.objectContaining({
              run_id: runId,
              status: 'blocked',
            }),
            expect.objectContaining({
              run_id: runId,
              status: 'redacted',
            }),
          ],
        })
      );
    } finally {
      if (!mcpProc.killed) {
        mcpProc.kill();
      }
      await new Promise((resolve) => mcpProc.once('exit', resolve));
    }
  }, 40000);
});
