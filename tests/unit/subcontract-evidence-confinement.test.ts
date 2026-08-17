import { mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publishGoalExecutionObservedEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/subcontract-evidence';

const roots: string[] = [];
const HASH = `sha256:${'a'.repeat(64)}`;

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

describe('goal execution evidence confinement', () => {
  it('rejects an execution ancestor that escapes outRoot through a junction', () => {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-evidence-project-'));
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-evidence-outside-'));
    roots.push(projectRoot, outsideRoot);
    const outRoot = path.join(projectRoot, 'goal-run');
    const runRoot = path.join(outRoot, 'goal', 'runtime', 'runs', 'RUN-AAAAAAAAAAAAAAAA');
    mkdirSync(runRoot, { recursive: true });
    symlinkSync(outsideRoot, path.join(runRoot, 'execution'), 'junction');
    const attemptRoot = path.join(runRoot, 'execution', 'ATTEMPT-AAAAAAAAAAAAAAAA');

    expect(() =>
      publishGoalExecutionObservedEvidence({
        projectRoot,
        outRoot,
        attemptRoot,
        authorityFileId: 'AUTH-001',
        payload: {
          schemaVersion: 'GoalExecutionObservedEvidence/v1',
          profile: 'requirements_backed',
          candidateRunId: 'RUN-AAAAAAAAAAAAAAAA',
          activeRunPointerHash: HASH,
          activationRecordHash: HASH,
          executionAuthorityId: 'AUTH-001',
          executionAuthorityHash: HASH,
          executionPackageHash: HASH,
          readinessScopedInputDigest: HASH,
          ownedPaths: ['src/owned.cjs'],
          forbiddenPaths: ['.git/**'],
          observedFiles: [],
          ownedPathStates: [{ path: 'src/owned.cjs', hash: HASH, exists: true }],
          commandObservations: [
            {
              commandId: 'CMD-001',
              normalizedInvocation: 'node --check src/owned.cjs',
              exitCode: 0,
              stdoutHash: HASH,
              stderrHash: HASH,
              decision: 'green',
            },
          ],
          reviewerInvocationCount: 0,
          auditorInvocationCount: 0,
          judgeSemanticAttemptCount: 0,
        },
      })
    ).toThrow('goal_execution_artifact_path_invalid');
    expect(readdirSync(outsideRoot)).toEqual([]);
  });
});
