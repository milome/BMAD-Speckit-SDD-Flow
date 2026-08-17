import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  publishGoalExecutionObservedEvidence,
  readGoalExecutionConfinedJson,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/subcontract-evidence';

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

  it('rejects authority reads through a junction outside the governed root', () => {
    const governedRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-read-project-'));
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-read-outside-'));
    roots.push(governedRoot, outsideRoot);
    writeFileSync(path.join(outsideRoot, 'evidence.json'), '{"decision":"pass"}\n', 'utf8');
    symlinkSync(outsideRoot, path.join(governedRoot, 'evidence'), 'junction');

    expect(() =>
      readGoalExecutionConfinedJson({
        root: governedRoot,
        targetPath: path.join(governedRoot, 'evidence', 'evidence.json'),
      })
    ).toThrow('goal_execution_artifact_path_invalid');
  });

  it('keeps closure and projection producers outside the evidence store module', () => {
    const sourceRoot = path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts'
    );
    const evidenceSource = readFileSync(path.join(sourceRoot, 'subcontract-evidence.ts'), 'utf8');
    const closureSource = readFileSync(path.join(sourceRoot, 'subcontract-closure.ts'), 'utf8');
    const campaignSource = readFileSync(path.join(sourceRoot, 'campaign-closure.ts'), 'utf8');
    const integrationSource = readFileSync(
      path.join(sourceRoot, 'main-agent-governed-goal-integration.ts'),
      'utf8'
    );

    expect(evidenceSource).not.toContain('publishGoalExecutionAuthorityClosure');
    expect(evidenceSource).not.toContain('publishGoalExecutionCampaignClosure');
    expect(evidenceSource).not.toContain('publishGoalExecutionProjections');
    expect(closureSource).toContain('export function publishGoalExecutionAuthorityClosure');
    expect(campaignSource).toContain('export function publishGoalExecutionCampaignClosure');
    expect(integrationSource).toContain('export function publishGoalExecutionProjections');
  });
});
