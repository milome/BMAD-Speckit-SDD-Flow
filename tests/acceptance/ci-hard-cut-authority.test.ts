import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runProfileWithSelectionStatus } from './ci-hard-cut-governed-profile.fixture';
import { registerWorkflowAuthorityTests } from './ci-hard-cut-workflow-authority';

const require = createRequire(import.meta.url);
const { writeCanonicalArtifact } = require('../../tools/ci/canonical-artifact.cjs');

describe('CI authority hard cut', () => {
  it('clears a stale semantic index before a governed run', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-semantic-index-reset-'));
    try {
      const { resetGeneratedEvidence } = require('../../tools/ci/run-governed-profile.cjs');
      const receipt = writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'ci-shard-semantic-index.json',
        artifact: { stale: true },
      });
      expect(existsSync(receipt.path)).toBe(true);

      resetGeneratedEvidence(repoRoot);

      expect(existsSync(receipt.path)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('keeps the local test:ci compatibility path on the governed authorities', () => {
    const {
      buildGovernedProfileCommands,
      runScript,
      selectionAllowsExecution,
    } = require('../../tools/ci/run-governed-profile.cjs');
    const { commandTargetPath } = require('../../tools/ci/test-command-bindings.cjs');
    const commands = buildGovernedProfileCommands({
      profile: 'pr-full',
      baseSha: 'b'.repeat(40),
      commitSha: 'a'.repeat(40),
      environmentClass: 'windows-x64-node22',
      changedPathsPath: '.artifacts/test-portfolio/changed-paths.json',
      manifest: {
        matrix: [
          { lane: 'core', shardId: 'core-01' },
          { lane: 'feature', shardId: 'feature-01' },
        ],
      },
    });

    expect(commands.map((command: any) => command.scriptName)).toEqual([
      'ci:catalog',
      'ci:freeze-core',
      'ci:coverage-gap',
      'ci:select',
      'ci:shard-plan',
      'ci:semantic-index',
      'ci:prepare-package',
      'ci:manifest',
      'ci:prepare-shard-runtime',
      'ci:run-shard',
      'ci:run-shard',
      'ci:join',
    ]);
    expect(commands[1]).toMatchObject({
      scriptName: 'ci:freeze-core',
      directNodeScript: 'tools/ci/freeze-core-portfolio.cjs',
      acceptedStatuses: [0, 1],
      args: [
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--facts',
        '.artifacts/test-portfolio/test-catalog-facts.json',
        '--policy',
        'repo-governance/ci/test-policy.json',
        '--timing-summary',
        '.artifacts/test-portfolio/ci-test-timing-summary.json',
        '--commit-sha',
        'a'.repeat(40),
        '--environment-class',
        'windows-x64-node22',
        '--output',
        '.artifacts/test-portfolio/core-freeze.json',
      ],
    });
    expect(commands[2]).toMatchObject({
      scriptName: 'ci:coverage-gap',
      directNodeScript: 'tools/ci/generate-six-model-coverage-gap-report.cjs',
      args: expect.arrayContaining([
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--core-freeze',
        '.artifacts/test-portfolio/core-freeze.json',
      ]),
    });
    expect(commands[4]).toEqual({
      scriptName: 'ci:shard-plan',
      args: [
        '--selection',
        '.artifacts/test-portfolio/test-selection.json',
        '--commit-sha',
        'a'.repeat(40),
        '--environment-class',
        'windows-x64-node22',
      ],
    });
    expect(commands[5]).toEqual({
      scriptName: 'ci:semantic-index',
      directNodeScript: 'tools/ci/build-shard-semantic-index.cjs',
      args: [
        '--selection',
        '.artifacts/test-portfolio/test-selection.json',
        '--shard-plan',
        '.artifacts/test-portfolio/ci-shard-plan.json',
        '--coverage-report',
        '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--changed-paths',
        '.artifacts/test-portfolio/changed-paths.json',
      ],
    });
    expect(commands[1].directNodeScript).toBe(commandTargetPath('governed-profile-freeze-core'));
    expect(commands[2].directNodeScript).toBe(commandTargetPath('governed-profile-coverage-gap'));
    expect(commandTargetPath('governed-profile-product-failure-records')).toBe(
      'tools/ci/build-product-failure-records.cjs'
    );
    expect(commandTargetPath('governed-profile-semantic-index')).toBe(
      'tools/ci/build-shard-semantic-index.cjs'
    );
    expect(commandTargetPath('portfolio-maintenance-generate-deletion-candidates')).toBe(
      'tools/ci/generate-test-deletion-candidates.cjs'
    );
    expect(commands[3]).toMatchObject({
      scriptName: 'ci:select',
      args: expect.arrayContaining([
        '--core-freeze',
        '.artifacts/test-portfolio/core-freeze.json',
        '--coverage-report',
        '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
        '--facts',
        '.artifacts/test-portfolio/test-catalog-facts.json',
        '--base-sha',
        'b'.repeat(40),
        '--commit-sha',
        'a'.repeat(40),
      ]),
    });
    const calls: any[] = [];
    runScript(commands[1], {
      repoRoot: process.cwd(),
      spawn: (file: string, args: string[], options: Record<string, unknown>) => {
        calls.push({ file, args, options });
        return { status: 1 };
      },
    });
    expect(calls).toEqual([
      expect.objectContaining({
        file: process.execPath,
        args: ['tools/ci/freeze-core-portfolio.cjs', ...commands[1].args],
      }),
    ]);
    expect(commands.some((command: any) => command.scriptName === 'test:ci')).toBe(false);
    expect(commands.some((command: any) => command.scriptName === 'ci:profile-policy')).toBe(false);
    expect(commands.filter((command: any) => command.scriptName === 'ci:run-shard')).toEqual([
      expect.objectContaining({ lane: 'core', shardId: 'core-01' }),
      expect.objectContaining({ lane: 'feature', shardId: 'feature-01' }),
    ]);
    expect(selectionAllowsExecution({ selectionStatus: 'ready' })).toBe(true);
    expect(selectionAllowsExecution({ selectionStatus: 'blocked' })).toBe(false);
  });

  it('runs repo-mutating expected failures before the final mutating shard locally', () => {
    const { buildGovernedProfileCommands } = require('../../tools/ci/run-governed-profile.cjs');
    const commands = buildGovernedProfileCommands({
      profile: 'pr-fast',
      baseSha: 'b'.repeat(40),
      commitSha: 'a'.repeat(40),
      environmentClass: 'windows-x64-node22',
      changedPathsPath: '.artifacts/test-portfolio/changed-paths.json',
      manifest: {
        matrix: [
          { lane: 'repo_mutating', shardId: 'repo_mutating-01' },
          { lane: 'repo_mutating', shardId: 'repo_mutating-xfail-01' },
        ],
      },
    });

    expect(
      commands
        .filter((command: any) => command.scriptName === 'ci:run-shard')
        .map((command: any) => command.shardId)
    ).toEqual(['repo_mutating-xfail-01', 'repo_mutating-01']);
  });

  it('restores package manifests after a shard-runtime bootstrap failure', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    let trackedCallCount = 0;

    expect(() =>
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          trackedCallCount += 1;
          return trackedCallCount === 1 ? [] : ['generated-output.json'];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
          if (scriptName === 'prepack') throw new Error('prepack failed');
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toThrow('CI_SHARD_RUNTIME_PREPACK_FAILED');
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'restore:generated-output.json',
    ]);
  });

  it('restores tracked build outputs before resyncing the package runtime', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    const trackedStates = [[], ['generated-output.json'], [], [], [], [], []];

    expect(
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return trackedStates.shift() || [];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toEqual({ restoredTrackedFileCount: 1, status: 'prepared' });
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'restore:generated-output.json',
      'tracked',
      'sync',
      'tracked',
      'tracked',
      'init:claude',
      'init:cursor',
      'init:codex',
      'tracked',
      'tracked',
    ]);
  });

  it('initializes CI agent surfaces without persistent install-state snapshots', () => {
    const {
      initializeAgentSurfaces,
    } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: Array<{
      scriptName: string;
      env: Record<string, string>;
    }> = [];

    initializeAgentSurfaces({
      repoRoot: process.cwd(),
      runNpmScript: (
        scriptName: string,
        options: { env: Record<string, string> }
      ) => {
        calls.push({
          scriptName,
          env: options.env,
        });
      },
    });

    expect(calls).toEqual(
      ['init:claude', 'init:cursor', 'init:codex'].map((scriptName) => ({
        scriptName,
        env: {
          BMAD_SPECKIT_SKIP_INSTALL_STATE: '1',
        },
      }))
    );
    for (const scriptPath of [
      'scripts/init-to-root.js',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/init-to-root.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), scriptPath), 'utf8');
      expect(source).toContain(
        "process.env.BMAD_SPECKIT_SKIP_INSTALL_STATE === '1'"
      );
      expect(source).toMatch(/const installTracker =\s+!skipInstallState &&/u);
    }
  });

  it('restores and uniquely counts tracked outputs generated by package runtime sync', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    const trackedStates = [
      [],
      ['generated-output.json', 'shared-output.json'],
      [],
      ['shared-output.json', 'synced-output.json'],
      [],
      [],
      [],
    ];

    expect(
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return trackedStates.shift() || [];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toEqual({ restoredTrackedFileCount: 3, status: 'prepared' });
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'restore:generated-output.json,shared-output.json',
      'tracked',
      'sync',
      'tracked',
      'restore:shared-output.json,synced-output.json',
      'tracked',
      'init:claude',
      'init:cursor',
      'init:codex',
      'tracked',
      'tracked',
    ]);
  });

  it('cleans tracked outputs when agent-surface initialization fails', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    const trackedStates = [[], [], [], [], [], ['init-output.json'], []];

    expect(() =>
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return trackedStates.shift() || [];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
          if (scriptName === 'init:cursor') throw new Error('cursor init failed');
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toThrow('CI_SHARD_RUNTIME_INIT_FAILED');
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'tracked',
      'sync',
      'tracked',
      'tracked',
      'init:claude',
      'init:cursor',
      'tracked',
      'restore:init-output.json',
      'tracked',
    ]);
  });

  it('cleans tracked sync outputs before reporting a package runtime sync failure', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    const trackedStates = [[], [], [], ['synced-output.json'], []];

    expect(() =>
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return trackedStates.shift() || [];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
        },
        syncPackageRuntime: () => {
          calls.push('sync');
          throw new Error('sync failed');
        },
      })
    ).toThrow('CI_SHARD_RUNTIME_SYNC_FAILED');
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'tracked',
      'sync',
      'tracked',
      'restore:synced-output.json',
      'tracked',
    ]);
  });

  it('fails closed before bootstrap when the checkout already has tracked changes', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];

    expect(() =>
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return ['user-change.ts'];
        },
        restoreTrackedChanges: () => {
          calls.push('restore');
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toThrow('CI_SHARD_RUNTIME_CHECKOUT_DIRTY');
    expect(calls).toEqual(['tracked']);
  });

  it('fails closed without resyncing when tracked build outputs remain after restore', () => {
    const { prepareShardRuntime } = require('../../tools/ci/prepare-shard-runtime.cjs');
    const calls: string[] = [];
    const trackedStates = [[], ['generated-output.json'], ['generated-output.json']];

    expect(() =>
      prepareShardRuntime({
        repoRoot: process.cwd(),
        listTrackedChanges: () => {
          calls.push('tracked');
          return trackedStates.shift() || [];
        },
        restoreTrackedChanges: (paths: string[]) => {
          calls.push(`restore:${paths.join(',')}`);
        },
        runNpmScript: (scriptName: string) => {
          calls.push(scriptName);
        },
        syncPackageRuntime: () => {
          calls.push('sync');
        },
      })
    ).toThrow('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE');
    expect(calls).toEqual([
      'tracked',
      'prepack',
      'postpack',
      'tracked',
      'restore:generated-output.json',
      'tracked',
    ]);
  });

  it('generates blocked planning evidence without invoking a shard or join', () => {
    const execution = runProfileWithSelectionStatus('blocked');

    expect(execution.result).toMatchObject({
      executionStatus: 'blocked',
      blockingGapCount: 1,
      shardCount: 1,
    });
    expect(execution.shardPlanExists).toBe(true);
    expect(execution.manifestExists).toBe(true);
    expect(execution.calls).toContain('ci:shard-plan');
    expect(execution.calls).toContain('tools/ci/build-shard-semantic-index.cjs');
    expect(execution.calls).toContain('ci:manifest');
    expect(execution.calls).not.toContain('ci:run-shard');
    expect(execution.calls).not.toContain('ci:join');
    expect(execution.planningDiagnosticsWritten).toBe(true);
  });

  it('preserves blocked planning evidence when diagnostics generation fails', () => {
    const execution = runProfileWithSelectionStatus('blocked', {
      planningDiagnosticsError: new Error('diagnostics unavailable'),
    });

    expect(execution.result).toMatchObject({
      executionStatus: 'blocked',
      blockingGapCount: 1,
      shardCount: 1,
      selectionPath: '.artifacts/test-portfolio/test-selection.json',
      manifestPath: '.artifacts/test-portfolio/ci-run-manifest.json',
      diagnosticsPath: null,
      diagnosticsMarkdownPath: null,
    });
  });

  it('invokes shards and join only when the selection is ready', () => {
    const execution = runProfileWithSelectionStatus('ready');

    expect(execution.result).toMatchObject({
      executionStatus: 'executed',
      shardCount: 1,
    });
    expect(execution.calls.filter((scriptName) => scriptName === 'ci:run-shard')).toHaveLength(1);
    expect(execution.calls.filter((scriptName) => scriptName === 'ci:join')).toHaveLength(1);
    expect(execution.planningDiagnosticsWritten).toBe(false);
  });

  it('restores tracked outputs after a successful shard', () => {
    const { runShardWithTrackedCleanup } = require('../../tools/ci/run-governed-profile.cjs');
    const trackedStates = [[], ['generated-output.json'], []];
    const restored: string[][] = [];

    expect(
      runShardWithTrackedCleanup(
        {
          scriptName: 'ci:run-shard',
          args: [],
          lane: 'feature',
          shardId: 'feature-01',
        },
        {
          repoRoot: process.cwd(),
          spawn: () => ({ status: 0 }),
          listTrackedChanges: () => trackedStates.shift() || [],
          restoreTrackedChanges: (paths: string[]) => {
            restored.push(paths);
          },
        }
      )
    ).toMatchObject({ scriptName: 'ci:run-shard' });
    expect(restored).toEqual([['generated-output.json']]);
  });

  it('restores tracked outputs before propagating a shard failure', () => {
    const { runShardWithTrackedCleanup } = require('../../tools/ci/run-governed-profile.cjs');
    const trackedStates = [[], ['generated-output.json'], []];
    const restored: string[][] = [];

    expect(() =>
      runShardWithTrackedCleanup(
        {
          scriptName: 'ci:run-shard',
          args: [],
          lane: 'feature',
          shardId: 'feature-01',
        },
        {
          repoRoot: process.cwd(),
          spawn: () => ({ status: 1, signal: null }),
          listTrackedChanges: () => trackedStates.shift() || [],
          restoreTrackedChanges: (paths: string[]) => {
            restored.push(paths);
          },
        }
      )
    ).toThrow('CI_GOVERNED_PROFILE_COMMAND_FAILED');
    expect(restored).toEqual([['generated-output.json']]);
  });

  it('fails closed when shard cleanup cannot restore tracked outputs', () => {
    const { runShardWithTrackedCleanup } = require('../../tools/ci/run-governed-profile.cjs');
    const trackedStates = [[], ['generated-output.json']];

    expect(() =>
      runShardWithTrackedCleanup(
        {
          scriptName: 'ci:run-shard',
          args: [],
          lane: 'feature',
          shardId: 'feature-01',
        },
        {
          repoRoot: process.cwd(),
          spawn: () => ({ status: 0 }),
          listTrackedChanges: () => trackedStates.shift() || [],
          restoreTrackedChanges: () => {
            throw new Error('restore failed');
          },
        }
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CI_GOVERNED_PROFILE_SHARD_CLEANUP_FAILED',
        details: expect.objectContaining({
          lane: 'feature',
          shardId: 'feature-01',
        }),
      })
    );
  });

  it('does not restore tracked changes that existed before a shard started', () => {
    const { runShardWithTrackedCleanup } = require('../../tools/ci/run-governed-profile.cjs');
    const trackedStates = [
      ['user-change.ts'],
      ['generated-output.json', 'user-change.ts'],
      ['user-change.ts'],
    ];
    const restored: string[][] = [];

    runShardWithTrackedCleanup(
      {
        scriptName: 'ci:run-shard',
        args: [],
        lane: 'feature',
        shardId: 'feature-01',
      },
      {
        repoRoot: process.cwd(),
        spawn: () => ({ status: 0 }),
        listTrackedChanges: () => trackedStates.shift() || [],
        restoreTrackedChanges: (paths: string[]) => {
          restored.push(paths);
        },
      }
    );

    expect(restored).toEqual([['generated-output.json']]);
  });

  it('records dynamic planning stage durations without regenerating the committed profile policy', () => {
    const execution = runProfileWithSelectionStatus('ready', {
      stageDurationsMs: {
        'ci:catalog': 41_000,
        'tools/ci/freeze-core-portfolio.cjs': 3_600,
        'tools/ci/generate-six-model-coverage-gap-report.cjs': 1_100,
        'ci:select': 2_300,
        'ci:shard-plan': 2_500,
        'tools/ci/build-shard-semantic-index.cjs': 700,
      },
    });

    expect(execution.result).toMatchObject({
      planningDurationMs: 51_200,
      planningStageDurationsMs: {
        'ci:catalog': 41_000,
        'ci:freeze-core': 3_600,
        'ci:coverage-gap': 1_100,
        'ci:select': 2_300,
        'ci:shard-plan': 2_500,
        'ci:semantic-index': 700,
      },
    });
    expect(execution.calls).not.toContain('ci:profile-policy');
  });

  it('fails pr-fast before package preparation when dynamic planning exceeds 90 seconds', () => {
    expect(() =>
      runProfileWithSelectionStatus('ready', {
        planningBudgetMs: 90_000,
        stageDurationsMs: {
          'ci:catalog': 90_001,
        },
      })
    ).toThrow('CI_PR_FAST_PLANNING_BUDGET_EXCEEDED');
  });

  it('does not apply the pr-fast planning budget to full compensation profiles', () => {
    const execution = runProfileWithSelectionStatus('blocked', {
      profile: 'nightly-full',
      planningBudgetMs: 90_000,
      stageDurationsMs: {
        'ci:catalog': 90_001,
      },
    });

    expect(execution.result.planningDurationMs).toBe(90_001);
    expect(execution.result.executionStatus).toBe('blocked');
  });

  it.each([
    ['clock rollback', [100, 99]],
    ['NaN duration', [100, Number.NaN]],
    ['infinite duration', [100, Number.POSITIVE_INFINITY]],
  ])('fails closed on invalid command timing: %s', (_label, timestamps) => {
    const { runScript } = require('../../tools/ci/run-governed-profile.cjs');
    let index = 0;

    expect(() =>
      runScript(
        { scriptName: 'ci:catalog', args: [] },
        {
          repoRoot: process.cwd(),
          spawn: () => ({ status: 0 }),
          now: () => timestamps[index++],
        }
      )
    ).toThrow('CI_GOVERNED_PROFILE_TIMING_INVALID');
  });

  it('records valid elapsed time when a governed command fails', () => {
    const { runScript } = require('../../tools/ci/run-governed-profile.cjs');
    const timestamps = [100, 125];
    let index = 0;

    expect(() =>
      runScript(
        { scriptName: 'ci:catalog', args: [] },
        {
          repoRoot: process.cwd(),
          spawn: () => ({ status: 1, signal: null }),
          now: () => timestamps[index++],
        }
      )
    ).toThrow(
      expect.objectContaining({
        code: 'CI_GOVERNED_PROFILE_COMMAND_FAILED',
        details: expect.objectContaining({ durationMs: 25 }),
      })
    );
  });

  it('preserves the fresh timing store while resetting run-scoped evidence', () => {
    const execution = runProfileWithSelectionStatus('blocked');

    expect(execution.timingSummary).toMatchObject({
      schemaVersion: 'ci-test-timing-summary/v1',
      commitSha: 'a'.repeat(40),
      environmentClass: 'windows-x64-node22',
      testTimings: [],
    });
  });

  it('creates a canonical bootstrap timing summary before the first core freeze', () => {
    const execution = runProfileWithSelectionStatus('blocked', { seedTimingSummary: false });

    expect(execution.timingSummaryExistsAtFreeze).toBe(true);
    expect(execution.timingSummary).toEqual({
      schemaVersion: 'ci-test-timing-summary/v1',
      commitShas: [],
      runs: [],
      timings: {},
      timingSnapshotHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
  });

  it('preserves and forwards the default product failure wrapper to coverage', () => {
    const execution = runProfileWithSelectionStatus('blocked', {
      seedDefaultFailureRecords: true,
    });

    expect(execution.failureRecordsExistsAtCoverage).toBe(true);
    expect(execution.coverageArgs).toEqual(
      expect.arrayContaining([
        '--failure-records',
        '.artifacts/test-portfolio/product-failure-records.json',
      ])
    );
  });

  registerWorkflowAuthorityTests();
});
