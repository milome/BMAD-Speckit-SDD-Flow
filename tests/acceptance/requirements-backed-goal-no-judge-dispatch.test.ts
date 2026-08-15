import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
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

describe('requirements-backed goal-contract CLI', () => {
  it('compiles the current confirmed chain with zero Goal Judge artifacts', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run');
      const result = runSourceCommand(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--out',
        outRoot,
        '--json',
      ]);

      expect(result.status, result.stderr || result.stdout).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.status).toBe('requirements_backed_goal_ready');
      expect(payload.goalJudgeDispatchCount).toBe(0);
      expect(existsSync(path.join(outRoot, 'goal', 'active-authority.json'))).toBe(true);
      expect(filesBelow(outRoot).filter((file) => /judge|effective-pass/iu.test(file))).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  it('uses exit 1 for a recoverable readiness block and exit 2 for caller-derived input', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const blocked = runSourceCommand(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--out',
        path.join(fixture.root, 'blocked-goal-run'),
        '--json',
      ]);
      expect(blocked.status, blocked.stderr || blocked.stdout).toBe(1);
      expect(JSON.parse(blocked.stdout).failureClass).toBe(
        'readiness_recheck_required:implementation_readiness'
      );

      const malformed = runSourceCommand(fixture.root, [
        'generate',
        '--entry',
        'requirements_backed_goal',
        '--requirements-record',
        fixture.runtimeRecordPath,
        '--source',
        'requirements.md',
        '--out',
        path.join(fixture.root, 'invalid-goal-run'),
        '--json',
      ]);
      expect(malformed.status, malformed.stderr || malformed.stdout).toBe(2);
      expect(JSON.parse(malformed.stdout).failureClass).toBe(
        'requirements_backed_caller_derived_input_forbidden:source'
      );
    } finally {
      fixture.cleanup();
    }
  });
});
