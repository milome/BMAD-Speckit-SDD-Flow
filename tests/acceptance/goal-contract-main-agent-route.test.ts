import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const BIN = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const SOURCE_RUNTIME = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'runtime.ts'
);
const BUILT_RUNTIME = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'dist',
  'main-agent',
  'runtime.js'
);
const RUNNER = [
  'const { mainAgentRuntimeCommand } = require(process.argv[1]);',
  'Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function run(cwd: string, runtime: string, args: string[]) {
  const runtimeArgs = runtime === SOURCE_RUNTIME ? [TSX, '-e'] : ['-e'];
  return spawnSync(process.execPath, [...runtimeArgs, RUNNER, runtime, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

describe('Main Agent Goal compile delegate', () => {
  it('delegates requirements-backed compilation to the canonical Task 6 backend', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      for (const [runtimeName, runtime] of [
        ['source', SOURCE_RUNTIME],
        ['built', BUILT_RUNTIME],
      ] as const) {
        const result = run(fixture.root, runtime, [
          'compile-goal-execution-ir',
          '--entry',
          'requirements_backed_goal',
          '--requirements-record',
          fixture.runtimeRecordPath,
          '--out',
          path.join(fixture.root, `goal-run-${runtimeName}`),
          '--json',
        ]);

        expect(result.status, result.stderr || result.stdout).toBe(0);
        const envelope = JSON.parse(result.stdout);
        expect(envelope.action).toBe('compile-goal-execution-ir');
        expect(envelope.data).toMatchObject({
          status: 'requirements_backed_goal_ready',
          goalJudgeDispatchCount: 0,
        });
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('resolves relative record and output paths from explicit --cwd', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const relativeRecordPath = path.relative(fixture.root, fixture.runtimeRecordPath);

      for (const [runtimeName, runtime] of [
        ['source', SOURCE_RUNTIME],
        ['built', BUILT_RUNTIME],
      ] as const) {
        const relativeOutRoot = `goal-run-relative-${runtimeName}`;
        const result = run(ROOT, runtime, [
          'compile-goal-execution-ir',
          '--cwd',
          fixture.root,
          '--entry',
          'requirements_backed_goal',
          '--requirements-record',
          relativeRecordPath,
          '--out',
          relativeOutRoot,
          '--json',
        ]);

        expect(result.status, result.stderr || result.stdout).toBe(0);
        const envelope = JSON.parse(result.stdout);
        expect(envelope.cwd).toBe(path.resolve(fixture.root));
        expect(envelope.data).toMatchObject({
          status: 'requirements_backed_goal_ready',
          goalJudgeDispatchCount: 0,
        });
        expect(
          existsSync(path.join(fixture.root, relativeOutRoot, 'goal', 'active-authority.json'))
        ).toBe(true);
      }

      const relativeOutRoot = 'goal-run-relative-public-cli';
      const publicResult = spawnSync(
        process.execPath,
        [
          BIN,
          'main-agent',
          'compile-goal-execution-ir',
          '--cwd',
          fixture.root,
          '--entry',
          'requirements_backed_goal',
          '--requirements-record',
          relativeRecordPath,
          '--out',
          relativeOutRoot,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
      );
      expect(publicResult.status, publicResult.stderr || publicResult.stdout).toBe(0);
      expect(JSON.parse(publicResult.stdout).data).toMatchObject({
        status: 'requirements_backed_goal_ready',
        goalJudgeDispatchCount: 0,
      });
      expect(
        existsSync(path.join(fixture.root, relativeOutRoot, 'goal', 'active-authority.json'))
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
