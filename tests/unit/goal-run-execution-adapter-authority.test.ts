import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  stableControlPlaneStringify,
  hashControlPlaneValue,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';
import {
  resolveGoalRunExecutionAdapterAuthority,
  resolvePackagedGoalRunExecutionAdapterAuthority,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-run-execution-adapter-authority';

const roots: string[] = [];

function executableHash(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function materializeAuthority(input: { executablePath?: string; executableHash?: string } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'goal-run-adapter-authority-'));
  roots.push(root);
  const executableBytes = Buffer.from('process.stdin.resume();\n', 'utf8');
  const executablePath = input.executablePath ?? 'executor.cjs';
  const executableTarget = path.resolve(root, ...executablePath.split('/'));
  if (!executablePath.startsWith('../')) {
    mkdirSync(path.dirname(executableTarget), { recursive: true });
    writeFileSync(executableTarget, executableBytes);
  }
  const payload = {
    schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
    adapterId: 'authority-negative-fixture',
    protocol: 'GoalRunMutationProtocol/v1',
    executableRef: {
      path: executablePath,
      hash: input.executableHash ?? executableHash(executableBytes),
    },
    args: [],
    timeoutMs: 1000,
  };
  writeFileSync(
    path.join(root, 'authority.json'),
    `${stableControlPlaneStringify({
      ...payload,
      adapterAuthorityHash: hashControlPlaneValue(payload),
    })}\n`,
    'utf8'
  );
  return {
    root,
    authorityPath: path.join(root, 'authority.json'),
    executableBytes,
    adapterAuthorityHash: hashControlPlaneValue(payload),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('Goal run execution adapter authority resolver', () => {
  it('rejects an executable hash mismatch', () => {
    const fixture = materializeAuthority({ executableHash: `sha256:${'f'.repeat(64)}` });
    expect(() => resolveGoalRunExecutionAdapterAuthority(fixture)).toThrow(
      'goal_run_execution_adapter_authority_invalid'
    );
  });

  it('rejects an executable path outside the authority root', () => {
    const fixture = materializeAuthority({ executablePath: '../outside.cjs' });
    expect(() => resolveGoalRunExecutionAdapterAuthority(fixture)).toThrow(
      'goal_run_execution_adapter_authority_invalid'
    );
  });

  it('rejects an executable symlink', () => {
    const fixture = materializeAuthority();
    const target = path.join(fixture.root, 'executor.cjs');
    const realTarget = path.join(fixture.root, 'real-executor.cjs');
    rmSync(target);
    writeFileSync(realTarget, fixture.executableBytes);
    symlinkSync(realTarget, target, 'file');
    expect(() => resolveGoalRunExecutionAdapterAuthority(fixture)).toThrow(
      'goal_run_execution_adapter_authority_invalid'
    );
  });

  it('rejects a packaged adapter directory that escapes the run through a junction', () => {
    const fixture = materializeAuthority();
    const runRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-run-packaged-adapter-'));
    roots.push(runRoot);
    symlinkSync(fixture.root, path.join(runRoot, 'adapter'), 'junction');

    expect(() =>
      resolvePackagedGoalRunExecutionAdapterAuthority({
        runRoot,
        executionAdapterRef: {
          path: 'adapter/authority.json',
          hash: fixture.adapterAuthorityHash,
        },
      })
    ).toThrow('goal_run_execution_adapter_authority_invalid');
  });
});
