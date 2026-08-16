import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
const PARTITION_MODULE_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-partition.ts'
);
const RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));',
  'process.stdout.write(JSON.stringify(runtime.compileFrozenCandidateRunIdentity(input)));',
].join('\n');

function identity(input: unknown): string {
  const completed = spawnSync(
    process.execPath,
    [TSX, '-e', RUNNER, MODULE_PATH, Buffer.from(JSON.stringify(input), 'utf8').toString('base64')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

function policyIdentity() {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      'const runtime = require(process.argv[1]); process.stdout.write(JSON.stringify(runtime.partitionPolicyIdentity()));',
      PARTITION_MODULE_PATH,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

describe('frozen Goal partition policy identity', () => {
  it('binds every hard conservation and isolation gate into the hard policy identity', () => {
    expect(policyIdentity().hardPolicy).toMatchObject({
      requireDependencyClosure: true,
      requireDirectModeAdmissibility: true,
      requireLogicalScopeClosure: true,
      requireNonOverlappingOwnedPaths: true,
      requireIsolationCompatibility: true,
      requireObligationConservation: true,
      requireSpecSpanConservation: true,
      requireCommandClosure: true,
      requireEvidenceClosure: true,
      requireArtifactConservation: true,
    });
  });

  it('excludes solver outcome, eligibility and package bytes from candidate identity', () => {
    const authority = {
      goalExecutionIRHash: `sha256:${'1'.repeat(64)}`,
      executionMode: 'partitioned_goal',
      partitionSelectionIdentityHash: `sha256:${'2'.repeat(64)}`,
    };

    expect(
      identity({
        ...authority,
        partitionOutcome: 'bounded_valid',
        eligibilityHash: `sha256:${'3'.repeat(64)}`,
        executionPackageHashes: [`sha256:${'4'.repeat(64)}`],
      })
    ).toBe(
      identity({
        ...authority,
        partitionOutcome: 'complete_valid',
        eligibilityHash: `sha256:${'5'.repeat(64)}`,
        executionPackageHashes: [`sha256:${'6'.repeat(64)}`],
      })
    );
  });

  it('changes candidate identity for a semantic successor or different selected membership', () => {
    const baseline = identity({
      goalExecutionIRHash: `sha256:${'1'.repeat(64)}`,
      executionMode: 'partitioned_goal',
      partitionSelectionIdentityHash: `sha256:${'2'.repeat(64)}`,
    });

    expect(
      identity({
        goalExecutionIRHash: `sha256:${'7'.repeat(64)}`,
        executionMode: 'partitioned_goal',
        partitionSelectionIdentityHash: `sha256:${'2'.repeat(64)}`,
      })
    ).not.toBe(baseline);
    expect(
      identity({
        goalExecutionIRHash: `sha256:${'1'.repeat(64)}`,
        executionMode: 'partitioned_goal',
        partitionSelectionIdentityHash: `sha256:${'8'.repeat(64)}`,
      })
    ).not.toBe(baseline);
  });
});
