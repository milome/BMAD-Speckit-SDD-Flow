import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  executeGoalRunMutation,
  prepareGoalRunMutationCheckpoint,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-run-mutation-executor';

const roots: string[] = [];

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function materializeMutationFixture(source: string, timeoutMs = 30_000) {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-run-mutation-negative-'));
  roots.push(projectRoot);
  mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  writeFileSync(
    path.join(projectRoot, 'src', 'child.cjs'),
    "module.exports = { status: 'red' };\n",
    'utf8'
  );
  git(projectRoot, ['init']);
  git(projectRoot, ['config', 'user.name', 'Goal Fixture']);
  git(projectRoot, ['config', 'user.email', 'goal-fixture@example.invalid']);
  git(projectRoot, ['add', 'src/child.cjs']);
  git(projectRoot, ['commit', '-m', 'test: establish red baseline']);
  const adapterRoot = path.join(projectRoot, 'adapter');
  mkdirSync(adapterRoot, { recursive: true });
  const executablePath = path.join(adapterRoot, 'executor.cjs');
  const executableBytes = Buffer.from(source, 'utf8');
  writeFileSync(executablePath, executableBytes);
  const executableHash = `sha256:${createHash('sha256').update(executableBytes).digest('hex')}`;
  return {
    projectRoot,
    adapter: {
      authority: {
        schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
        adapterId: 'partition-negative-fixture',
        protocol: 'GoalRunMutationProtocol/v1',
        executableRef: { path: 'executor.cjs', hash: executableHash },
        args: [],
        timeoutMs,
        adapterAuthorityHash: `sha256:${'c'.repeat(64)}`,
      },
      authorityPath: path.join(adapterRoot, 'authority.json'),
      executablePath,
      authorityBytes: Buffer.alloc(0),
      executableBytes,
    },
  };
}

function executeNegativeMutation(
  fixture: ReturnType<typeof materializeMutationFixture>,
  commands = [{ commandId: 'CMD-child', invocation: 'node --check src/child.cjs' }],
  partitionId: string | null = 'PART-NEGATIVE'
) {
  return executeGoalRunMutation({
    projectRoot: fixture.projectRoot,
    candidateRunId: 'RUN-BBBBBBBBBBBBBBBB',
    executionAuthority: {
      executionAuthorityId: 'CHILD-BBBBBBBBBBBBBBBB',
      executionAuthorityHash: `sha256:${'a'.repeat(64)}`,
      executionPackagePath: path.join(fixture.projectRoot, 'child-package.json'),
      executionPackageHash: `sha256:${'b'.repeat(64)}`,
      partitionId,
      ownedPaths: ['src/child.cjs'],
      forbiddenPaths: ['.git/**'],
      commands,
    },
    adapter: fixture.adapter,
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

describe('Goal run mutation executor', () => {
  it('closes a partition mutation with exactly one owned-path commit proof', () => {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-run-mutation-'));
    roots.push(projectRoot);
    mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    writeFileSync(
      path.join(projectRoot, 'src', 'child.cjs'),
      "module.exports = { status: 'red' };\n",
      'utf8'
    );
    git(projectRoot, ['init']);
    git(projectRoot, ['config', 'user.name', 'Goal Fixture']);
    git(projectRoot, ['config', 'user.email', 'goal-fixture@example.invalid']);
    git(projectRoot, ['add', 'src/child.cjs']);
    git(projectRoot, ['commit', '-m', 'test: establish red baseline']);
    const parentHash = git(projectRoot, ['rev-parse', 'HEAD']);
    const adapterRoot = path.join(projectRoot, 'adapter');
    mkdirSync(adapterRoot, { recursive: true });
    const executablePath = path.join(adapterRoot, 'executor.cjs');
    const executableBytes = Buffer.from(
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(path.join(request.projectRoot, 'src', 'child.cjs'), \"module.exports = { status: 'green' };\\n\", 'utf8');",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n'),
      'utf8'
    );
    writeFileSync(executablePath, executableBytes);
    const executableHash = `sha256:${createHash('sha256').update(executableBytes).digest('hex')}`;
    const result = executeGoalRunMutation({
      projectRoot,
      candidateRunId: 'RUN-AAAAAAAAAAAAAAAA',
      executionAuthority: {
        executionAuthorityId: 'CHILD-AAAAAAAAAAAAAAAA',
        executionAuthorityHash: `sha256:${'a'.repeat(64)}`,
        executionPackagePath: path.join(projectRoot, 'child-package.json'),
        executionPackageHash: `sha256:${'b'.repeat(64)}`,
        partitionId: 'PART-001',
        ownedPaths: ['src/child.cjs'],
        forbiddenPaths: ['.git/**'],
        commands: [{ commandId: 'CMD-child', invocation: 'node --check src/child.cjs' }],
      },
      adapter: {
        authority: {
          schemaVersion: 'GoalRunExecutionAdapterAuthority/v1',
          adapterId: 'partition-fixture',
          protocol: 'GoalRunMutationProtocol/v1',
          executableRef: { path: 'executor.cjs', hash: executableHash },
          args: [],
          timeoutMs: 30_000,
          adapterAuthorityHash: `sha256:${'c'.repeat(64)}`,
        },
        authorityPath: path.join(adapterRoot, 'authority.json'),
        executablePath,
        authorityBytes: Buffer.alloc(0),
        executableBytes,
      },
    });

    expect(result.commitProof).toMatchObject({
      kind: 'owned_path_commit',
      commitCount: 1,
      parentHash,
      changedPaths: ['src/child.cjs'],
      trailer: 'Goal-Execution-Authority: CHILD-AAAAAAAAAAAAAAAA',
    });
    expect(git(projectRoot, ['rev-list', '--count', `${parentHash}..HEAD`])).toBe('1');
  });

  it('rejects adapter changed paths that do not match observed owned deltas', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(request.projectRoot + '/src/child.cjs', \"module.exports = { status: 'green' };\\n\");",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['outside.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );
    expect(() => executeNegativeMutation(fixture)).toThrow(
      'goal_execution_changed_paths_out_of_scope'
    );
  });

  it('rejects hidden unowned workspace writes omitted from the adapter result', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(request.projectRoot + '/src/child.cjs', \"module.exports = { status: 'green' };\\n\");",
        "  fs.writeFileSync(request.projectRoot + '/outside.cjs', 'hidden');",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );

    expect(() => executeNegativeMutation(fixture)).toThrow(
      'goal_execution_changed_paths_out_of_scope'
    );
  });

  it('rejects a direct owned path through a parent junction before adapter mutation', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(request.projectRoot + '/src/child.cjs', \"module.exports = { status: 'green' };\\n\");",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-run-mutation-outside-'));
    roots.push(outsideRoot);
    const outsidePath = path.join(outsideRoot, 'child.cjs');
    const originalBytes = "module.exports = { status: 'red' };\n";
    writeFileSync(outsidePath, originalBytes, 'utf8');
    rmSync(path.join(fixture.projectRoot, 'src'), { recursive: true, force: true });
    symlinkSync(
      outsideRoot,
      path.join(fixture.projectRoot, 'src'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    expect(() => executeNegativeMutation(fixture, undefined, null)).toThrow(
      'goal_execution_owned_path_invalid'
    );
    expect(readFileSync(outsidePath, 'utf8')).toBe(originalBytes);
  });

  it('preserves an unrelated dirty symlink while committing an owned mutation', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(request.projectRoot + '/src/child.cjs', \"module.exports = { status: 'green' };\\n\");",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-run-symlink-outside-'));
    roots.push(outsideRoot);
    const outsidePath = path.join(outsideRoot, 'unrelated.txt');
    const originalBytes = 'unrelated consumer state\n';
    writeFileSync(outsidePath, originalBytes, 'utf8');
    symlinkSync(outsidePath, path.join(fixture.projectRoot, 'unrelated-link'), 'file');

    expect(executeNegativeMutation(fixture).commitProof).toMatchObject({
      kind: 'owned_path_commit',
      commitCount: 1,
      changedPaths: ['src/child.cjs'],
    });
    expect(readFileSync(outsidePath, 'utf8')).toBe(originalBytes);
  });

  it('rejects workspace writes performed by a validation command', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  fs.writeFileSync(request.projectRoot + '/src/child.cjs', \"module.exports = { status: 'green' };\\n\");",
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );

    expect(() =>
      executeNegativeMutation(fixture, [
        {
          commandId: 'CMD-mutating-validation',
          invocation:
            "node -e \"require('node:fs').writeFileSync('validation-write.cjs', 'hidden')\"",
        },
      ])
    ).toThrow('goal_execution_validation_mutated_workspace');
  });

  it('turns adapter timeout into a typed adapter failure', () => {
    const fixture = materializeMutationFixture(
      ['process.stdin.resume();', 'setTimeout(() => {}, 5000);', ''].join('\n'),
      50
    );
    expect(() => executeNegativeMutation(fixture)).toThrow('goal_execution_adapter_failed');
  });

  it('reuses an orphan owned-path commit when replay finds no new file delta', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  const target = request.projectRoot + '/src/child.cjs';",
        "  const alreadyGreen = fs.readFileSync(target, 'utf8').includes(\"status: 'green'\");",
        '  if (!alreadyGreen) fs.writeFileSync(target, "module.exports = { status: \'green\' };\\n");',
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: alreadyGreen ? [] : ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );
    const first = executeNegativeMutation(fixture);
    writeFileSync(
      path.join(fixture.projectRoot, 'src', 'dependency.cjs'),
      'module.exports = {};\n'
    );
    git(fixture.projectRoot, ['add', 'src/dependency.cjs']);
    git(fixture.projectRoot, [
      'commit',
      '-m',
      'test: close a dependency',
      '-m',
      'Goal-Execution-Authority: CHILD-DEPENDENCY',
    ]);
    const second = executeNegativeMutation(fixture);
    expect(second.commitProof).toEqual(first.commitProof);
    expect(second.observedFiles).toEqual(first.observedFiles);
    expect(second.ownedPathStates).toEqual([
      {
        path: 'src/child.cjs',
        hash: first.observedFiles[0].afterHash,
        exists: true,
      },
    ]);
    expect(git(fixture.projectRoot, ['rev-list', '--count', 'HEAD~2..HEAD'])).toBe('2');
  });

  it('recovers an idempotent adapter after mutation persisted before the partition commit', () => {
    const fixture = materializeMutationFixture(
      [
        "const fs = require('node:fs');",
        "let input = '';",
        "process.stdin.on('data', (chunk) => (input += chunk));",
        "process.stdin.on('end', () => {",
        '  const request = JSON.parse(input);',
        "  const target = request.projectRoot + '/src/child.cjs';",
        "  const alreadyGreen = fs.readFileSync(target, 'utf8').includes(\"status: 'green'\");",
        '  if (!alreadyGreen) fs.writeFileSync(target, "module.exports = { status: \'green\' };\\n");',
        "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: alreadyGreen ? [] : ['src/child.cjs'] }));",
        '});',
        '',
      ].join('\n')
    );
    const attemptRoot = path.join(fixture.projectRoot, 'run', 'execution', 'ATTEMPT-RECOVERY');
    mkdirSync(path.join(fixture.projectRoot, 'run'), { recursive: true });
    const executionAuthority = {
      executionAuthorityId: 'CHILD-BBBBBBBBBBBBBBBB',
      executionAuthorityHash: `sha256:${'a'.repeat(64)}`,
      executionPackagePath: path.join(fixture.projectRoot, 'child-package.json'),
      executionPackageHash: `sha256:${'b'.repeat(64)}`,
      partitionId: 'PART-NEGATIVE',
      ownedPaths: ['src/child.cjs'],
      forbiddenPaths: ['.git/**'],
      commands: [{ commandId: 'CMD-child', invocation: 'node --check src/child.cjs' }],
    };
    const parentHash = git(fixture.projectRoot, ['rev-parse', 'HEAD']);
    prepareGoalRunMutationCheckpoint({
      projectRoot: fixture.projectRoot,
      outRoot: path.join(fixture.projectRoot, 'run'),
      candidateRunId: 'RUN-BBBBBBBBBBBBBBBB',
      executionAuthority,
      attemptRoot,
      authorityFileId: 'CHILD-BBBBBBBBBBBBBBBB',
    });
    writeFileSync(
      path.join(fixture.projectRoot, 'src', 'child.cjs'),
      "module.exports = { status: 'green' };\n",
      'utf8'
    );

    const recovered = executeGoalRunMutation({
      projectRoot: fixture.projectRoot,
      candidateRunId: 'RUN-BBBBBBBBBBBBBBBB',
      executionAuthority,
      adapter: fixture.adapter,
      outRoot: path.join(fixture.projectRoot, 'run'),
      attemptRoot,
      authorityFileId: 'CHILD-BBBBBBBBBBBBBBBB',
    });

    expect(recovered.changedPaths).toEqual(['src/child.cjs']);
    expect(recovered.commitProof).toMatchObject({
      kind: 'owned_path_commit',
      parentHash,
      changedPaths: ['src/child.cjs'],
    });
  });
});
