import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const MODULE_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-activation.ts'
);
const RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));',
  'try {',
  '  const result = runtime.validateGoalExecutionAdmission(input);',
  '  process.stdout.write(JSON.stringify({ ok: true, goalExecutionIRHash: result.goalExecutionIr.goalExecutionIRHash }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

function validateAdmission(input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [TSX, '-e', RUNNER, MODULE_PATH, Buffer.from(JSON.stringify(input), 'utf8').toString('base64')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return { ...completed, result: JSON.parse(completed.stdout) };
}

describe('goal-contract activation admission currentness', () => {
  it('rejects a prepared candidate when the frozen Goal authority changes before commit', () => {
    const first = materializeImplementationReadinessFixture({
      requestId: 'REQ-GOAL-ACTIVATION-CURRENTNESS-001',
    });
    try {
      produceImplementationReadiness({ projectRoot: first.root, requestId: first.requestId });
      const outRoot = path.join(first.root, 'goal-run');
      const original = compileRequirementsBackedGoal({
        projectRoot: first.root,
        requirementRecordPath: first.runtimeRecordPath,
        outRoot,
      });
      const prepared = validateAdmission({
        phase: 'activation_prepare',
        projectRoot: first.root,
        goalAuthorityPath: original.activeAuthorityRef.path,
      });
      expect(prepared.status, prepared.stderr || prepared.stdout).toBe(0);

      const successor = materializeImplementationReadinessFixture({
        root: first.root,
        requestId: 'REQ-GOAL-ACTIVATION-CURRENTNESS-002',
        additionalGoalAtoms: 1,
      });
      produceImplementationReadiness({
        projectRoot: successor.root,
        requestId: successor.requestId,
      });
      compileRequirementsBackedGoal({
        projectRoot: successor.root,
        requirementRecordPath: successor.runtimeRecordPath,
        outRoot,
      });

      const committed = validateAdmission({
        phase: 'activation_commit',
        projectRoot: first.root,
        goalAuthorityPath: original.activeAuthorityRef.path,
        expectedGoalExecutionIRHash: original.goalExecutionIRHash,
      });
      expect(committed.status).toBe(1);
      expect(committed.result).toEqual({
        ok: false,
        issueCode: 'goal_execution_authority_invalid',
      });
    } finally {
      first.cleanup();
    }
  });
});
