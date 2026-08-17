import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function runSourceCommand(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [TSX, '-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe('goal-contract activation CLI contract', () => {
  it.each([
    ['caller-supplied hash', ['--goal-authority-hash', `sha256:${'1'.repeat(64)}`]],
    ['source bootstrap', ['--source', 'requirements.md']],
    ['duplicate cwd', ['--cwd', 'duplicate-root']],
  ])('rejects %s outside the exact activation argument surface', (_label, extraArgs) => {
    const completed = runSourceCommand(ROOT, [
      'activate',
      '--cwd',
      ROOT,
      '--goal-authority',
      path.join(ROOT, 'goal', 'active-authority.json'),
      ...extraArgs,
      '--json',
    ]);

    expect(completed.status).toBe(1);
    expect(completed.stderr).toBe('');
    expect(JSON.parse(completed.stdout)).toEqual({
      schemaVersion: 'goal-contract-activation-result/v1',
      profile: null,
      status: 'blocked',
      issueCode: 'activation_request_invalid',
      executionMode: null,
      partitionOutcome: null,
      artifacts: [],
    });
  });

  it('preserves the exact readiness re-entry issue code from activation admission', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = runSourceCommand(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--out',
        outRoot,
        '--json',
      ]);
      expect(generated.status, generated.stderr || generated.stdout).toBe(0);
      writeFileSync(fixture.targetPath, "module.exports = { refundStatus: () => 'accepted' };\n");

      const activated = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        path.join(outRoot, 'goal', 'active-authority.json'),
        '--json',
      ]);

      expect(activated.status).toBe(1);
      expect(activated.stderr).toBe('');
      expect(JSON.parse(activated.stdout)).toMatchObject({
        status: 'blocked',
        issueCode: 'readiness_recheck_required:scoped_input_digest',
        artifacts: [],
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('activates one frozen direct Goal authority without producing execution or closeout state', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = runSourceCommand(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--out',
        outRoot,
        '--json',
      ]);
      expect(generated.status, generated.stderr || generated.stdout).toBe(0);
      materializeGoalRunExecutionAdapter(outRoot);

      const goalAuthorityPath = path.join(outRoot, 'goal', 'active-authority.json');
      const activated = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        goalAuthorityPath,
        '--json',
      ]);

      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      expect(activated.stderr).toBe('');
      const result = JSON.parse(activated.stdout);
      expect(result).toMatchObject({
        schemaVersion: 'goal-contract-activation-result/v1',
        status: 'activated',
        issueCode: null,
        executionMode: 'direct_goal',
        partitionOutcome: 'not_applicable',
      });
      expect(result.artifacts.map((artifact: { role: string }) => artifact.role)).toEqual([
        'goal_execution_authority',
        'execution_eligibility',
        'candidate_run',
        'activation_record',
        'direct_execution_package',
        'active_run_pointer',
      ]);
      for (const artifact of result.artifacts) {
        expect(artifact).toMatchObject({
          artifactRef: expect.any(String),
          artifactHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        });
        expect(existsSync(artifact.artifactRef)).toBe(true);
      }

      const activePointer = JSON.parse(
        readFileSync(
          result.artifacts.find(
            (artifact: { role: string }) => artifact.role === 'active_run_pointer'
          ).artifactRef,
          'utf8'
        )
      );
      expect(activePointer).toMatchObject({
        schemaVersion: 'GoalContractActiveRunPointer/v1',
        activationRecordRef: expect.any(String),
        activationRecordHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });

      const forbidden = filesBelow(path.join(outRoot, 'goal')).filter((file) =>
        /campaign-closure|taskreport|execution-final|effective-pass|record-closed/iu.test(file)
      );
      expect(forbidden).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });
});
