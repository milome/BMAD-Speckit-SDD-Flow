import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
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

function activate(cwd: string, goalAuthorityPath: string) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      SOURCE_RUNNER,
      SOURCE_COMMAND,
      'activate',
      '--cwd',
      cwd,
      '--goal-authority',
      goalAuthorityPath,
      '--json',
    ],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

describe('goal-contract active-run history', () => {
  it('preserves the old immutable activation record when a semantic successor becomes current', () => {
    const firstFixture = materializeImplementationReadinessFixture({
      requestId: 'REQ-GOAL-ACTIVE-HISTORY-001',
    });
    try {
      produceImplementationReadiness({
        projectRoot: firstFixture.root,
        requestId: firstFixture.requestId,
      });
      const outRoot = path.join(firstFixture.root, 'goal-run');
      const firstGoal = compileRequirementsBackedGoal({
        projectRoot: firstFixture.root,
        requirementRecordPath: firstFixture.runtimeRecordPath,
        outRoot,
      });
      const firstActivation = activate(firstFixture.root, firstGoal.activeAuthorityRef.path);
      const firstActivationArtifact = firstActivation.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'activation_record'
      );
      const firstPointerArtifact = firstActivation.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'active_run_pointer'
      );
      const firstActivationBytes = readFileSync(firstActivationArtifact.artifactRef);
      const firstPointer = JSON.parse(readFileSync(firstPointerArtifact.artifactRef, 'utf8'));
      expect(firstPointer.pointerVersion).toBe(1);

      const successorFixture = materializeImplementationReadinessFixture({
        root: firstFixture.root,
        requestId: 'REQ-GOAL-ACTIVE-HISTORY-002',
      });
      produceImplementationReadiness({
        projectRoot: successorFixture.root,
        requestId: successorFixture.requestId,
      });
      const successorGoal = compileRequirementsBackedGoal({
        projectRoot: successorFixture.root,
        requirementRecordPath: successorFixture.runtimeRecordPath,
        outRoot,
      });
      const successorActivation = activate(
        successorFixture.root,
        successorGoal.activeAuthorityRef.path
      );

      const successorActivationArtifact = successorActivation.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'activation_record'
      );
      const successorPointerArtifact = successorActivation.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'active_run_pointer'
      );
      const successorPointer = JSON.parse(
        readFileSync(successorPointerArtifact.artifactRef, 'utf8')
      );
      expect(successorActivation.status).toBe('activated');
      expect(successorActivation.executionMode).toBe('direct_goal');
      expect(successorPointer.pointerVersion).toBe(2);
      expect(successorPointer.activationRecordHash).toBe(successorActivationArtifact.artifactHash);
      expect(successorPointer.activationRecordHash).not.toBe(firstActivationArtifact.artifactHash);
      expect(existsSync(firstActivationArtifact.artifactRef)).toBe(true);
      expect(readFileSync(firstActivationArtifact.artifactRef)).toEqual(firstActivationBytes);
    } finally {
      firstFixture.cleanup();
    }
  });
});
