import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stableControlPlaneStringify } from '../../../utils/goal-contract/control-plane/canonical-hash';
import type { ResolvedGoalRunExecutionAdapterAuthority } from '../../../utils/goal-contract/control-plane/goal-run-execution-adapter-authority';

type JsonRecord = Record<string, unknown>;

export interface GoalRunObservedFile {
  path: string;
  beforeHash: string;
  afterHash: string;
  existsAfter: boolean;
}

export interface GoalRunOwnedPathState {
  path: string;
  hash: string;
  exists: boolean;
}

export interface GoalRunCommandObservation {
  commandId: string;
  normalizedInvocation: string;
  exitCode: 0;
  stdoutHash: string;
  stderrHash: string;
  decision: 'green';
}

interface WorkspacePathState {
  status: string;
  exists: boolean;
  kind: 'missing' | 'file' | 'symbolic_link' | 'other';
  hash: string;
}

interface WorkspaceSnapshot {
  headHash: string;
  paths: Map<string, WorkspacePathState>;
}

export type GoalRunCommitProof =
  | { kind: 'not_applicable' }
  | {
      kind: 'owned_path_commit';
      commitCount: 1;
      commitHash: string;
      parentHash: string;
      treeHash: string;
      changedPaths: string[];
      trailer: string;
    };

function sha256(bytes: Buffer | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function normalizedRelativePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '..' ||
    value.startsWith('../')
  ) {
    throw new Error('goal_execution_changed_path_invalid');
  }
  return value;
}

function confinedPath(projectRoot: string, relativePath: string): string {
  const root = path.resolve(projectRoot);
  const target = path.resolve(root, ...relativePath.split('/'));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_changed_path_invalid');
  }
  return target;
}

function globPattern(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
    }
  }
  return new RegExp(`${source}$`, 'u');
}

function matchesScope(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globPattern(pattern).test(relativePath));
}

function fileState(
  projectRoot: string,
  relativePath: string
): {
  exists: boolean;
  hash: string;
} {
  const targetPath = confinedPath(projectRoot, relativePath);
  if (!fs.existsSync(targetPath)) return { exists: false, hash: sha256(Buffer.alloc(0)) };
  const stat = fs.lstatSync(targetPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('goal_execution_owned_path_invalid');
  }
  return { exists: true, hash: sha256(fs.readFileSync(targetPath)) };
}

function workspacePathState(
  projectRoot: string,
  relativePath: string,
  status: string
): WorkspacePathState {
  const targetPath = confinedPath(projectRoot, relativePath);
  if (!fs.existsSync(targetPath)) {
    return { status, exists: false, kind: 'missing', hash: sha256(Buffer.alloc(0)) };
  }
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    return {
      status,
      exists: true,
      kind: 'symbolic_link',
      hash: sha256(fs.readlinkSync(targetPath, 'buffer')),
    };
  }
  if (stat.isFile()) {
    return { status, exists: true, kind: 'file', hash: sha256(fs.readFileSync(targetPath)) };
  }
  return {
    status,
    exists: true,
    kind: 'other',
    hash: sha256(`${stat.mode}:${stat.size}:${stat.mtimeMs}`),
  };
}

function gitPorcelain(projectRoot: string): string {
  const completed = spawnSync(
    'git',
    [
      '-c',
      'core.quotepath=false',
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--no-renames',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    }
  );
  if (completed.error || completed.status !== 0 || completed.signal) {
    throw new Error('goal_execution_workspace_snapshot_invalid');
  }
  return completed.stdout;
}

function workspaceSnapshot(projectRoot: string): WorkspaceSnapshot {
  const paths = new Map<string, WorkspacePathState>();
  for (const entry of gitPorcelain(projectRoot).split('\0').filter(Boolean)) {
    if (entry.length < 4 || entry[2] !== ' ') {
      throw new Error('goal_execution_workspace_snapshot_invalid');
    }
    const status = entry.slice(0, 2);
    const relativePath = normalizedRelativePath(entry.slice(3).replace(/\\/gu, '/'));
    paths.set(relativePath, workspacePathState(projectRoot, relativePath, status));
  }
  return {
    headHash: runGit(projectRoot, ['rev-parse', '--verify', 'HEAD']),
    paths,
  };
}

function workspaceDeltaPaths(before: WorkspaceSnapshot, after: WorkspaceSnapshot): string[] {
  if (before.headHash !== after.headHash) {
    throw new Error('goal_execution_workspace_head_changed');
  }
  const paths = new Set([...before.paths.keys(), ...after.paths.keys()]);
  return [...paths]
    .filter(
      (relativePath) =>
        stableControlPlaneStringify(before.paths.get(relativePath) ?? null) !==
        stableControlPlaneStringify(after.paths.get(relativePath) ?? null)
    )
    .sort();
}

function adapterCommand(resolved: ResolvedGoalRunExecutionAdapterAuthority): {
  command: string;
  args: string[];
} {
  if (/\.(?:cjs|mjs|js)$/iu.test(resolved.executablePath)) {
    return {
      command: process.execPath,
      args: [resolved.executablePath, ...resolved.authority.args],
    };
  }
  return { command: resolved.executablePath, args: [...resolved.authority.args] };
}

function invokeAdapter(input: {
  projectRoot: string;
  candidateRunId: string;
  executionAuthority: JsonRecord;
  adapter: ResolvedGoalRunExecutionAdapterAuthority;
}): string[] {
  const authority = input.executionAuthority;
  const request = {
    schemaVersion: 'GoalRunMutationRequest/v1',
    protocol: input.adapter.authority.protocol,
    projectRoot: input.projectRoot,
    candidateRunId: input.candidateRunId,
    executionAuthorityId: authority.executionAuthorityId,
    executionAuthorityHash: authority.executionAuthorityHash,
    executionPackagePath: authority.executionPackagePath,
    executionPackageHash: authority.executionPackageHash,
    ownedPaths: authority.ownedPaths,
    forbiddenPaths: authority.forbiddenPaths,
  };
  const invocation = adapterCommand(input.adapter);
  const completed = spawnSync(invocation.command, invocation.args, {
    cwd: input.projectRoot,
    input: `${stableControlPlaneStringify(request)}\n`,
    encoding: 'utf8',
    timeout: input.adapter.authority.timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (completed.error || completed.status !== 0 || completed.signal || completed.stderr !== '') {
    throw new Error('goal_execution_adapter_failed');
  }
  let result: JsonRecord;
  try {
    result = JSON.parse(completed.stdout) as JsonRecord;
  } catch {
    throw new Error('goal_execution_adapter_result_invalid');
  }
  const keys = Object.keys(result).sort();
  if (
    stableControlPlaneStringify(keys) !==
      stableControlPlaneStringify(['changedPaths', 'exitCode', 'schemaVersion']) ||
    result.schemaVersion !== 'GoalRunMutationResult/v1' ||
    result.exitCode !== 0 ||
    !Array.isArray(result.changedPaths)
  ) {
    throw new Error('goal_execution_adapter_result_invalid');
  }
  const changedPaths = result.changedPaths.map(normalizedRelativePath);
  if (new Set(changedPaths).size !== changedPaths.length) {
    throw new Error('goal_execution_adapter_result_invalid');
  }
  return [...changedPaths].sort();
}

function runCommands(input: {
  projectRoot: string;
  commands: JsonRecord[];
  timeoutMs: number;
}): GoalRunCommandObservation[] {
  if (input.commands.length === 0) throw new Error('goal_execution_commands_missing');
  return input.commands.map((command) => {
    const commandId = String(command.commandId ?? '');
    const normalizedInvocation = String(command.invocation ?? '').trim();
    if (!commandId || !normalizedInvocation) throw new Error('goal_execution_command_invalid');
    const completed = spawnSync(normalizedInvocation, {
      cwd: input.projectRoot,
      shell: true,
      encoding: 'utf8',
      timeout: input.timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    if (completed.error || completed.status !== 0 || completed.signal) {
      throw new Error(`goal_execution_command_failed:${commandId}`);
    }
    return Object.freeze({
      commandId,
      normalizedInvocation,
      exitCode: 0 as const,
      stdoutHash: sha256(completed.stdout),
      stderrHash: sha256(completed.stderr),
      decision: 'green' as const,
    });
  });
}

function runGit(projectRoot: string, args: string[]): string {
  const completed = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (completed.error || completed.status !== 0 || completed.signal) {
    throw new Error('goal_execution_commit_proof_invalid');
  }
  return completed.stdout.trim();
}

function runGitBytes(projectRoot: string, args: string[]): Buffer {
  const completed = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'buffer',
    timeout: 30_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (completed.error || completed.status !== 0 || completed.signal) {
    throw new Error('goal_execution_commit_proof_invalid');
  }
  return completed.stdout;
}

function gitFileStateAt(
  projectRoot: string,
  revision: string,
  relativePath: string
): { exists: boolean; hash: string } {
  const listing = runGitBytes(projectRoot, ['ls-tree', '-z', revision, '--', relativePath]);
  if (listing.length === 0) return { exists: false, hash: sha256(Buffer.alloc(0)) };
  const match = /^100(?:644|755) blob ([a-f0-9]{40,64})\t[^\0]+\0$/u.exec(listing.toString('utf8'));
  if (!match) throw new Error('goal_execution_commit_proof_invalid');
  return { exists: true, hash: sha256(runGitBytes(projectRoot, ['cat-file', 'blob', match[1]])) };
}

function changedPathsForCommit(projectRoot: string, commitHash: string): string[] {
  return runGit(projectRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', commitHash])
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map((entry) => normalizedRelativePath(entry.replace(/\\/gu, '/')))
    .sort();
}

function currentOwnedPathsMatchCommit(input: {
  projectRoot: string;
  commitHash: string;
  ownedPaths: string[];
}): boolean {
  return input.ownedPaths.every((ownedPath) => {
    const current = fileState(input.projectRoot, ownedPath);
    const committed = gitFileStateAt(input.projectRoot, input.commitHash, ownedPath);
    return current.exists === committed.exists && current.hash === committed.hash;
  });
}

function resolveReachableAuthorityCommit(input: {
  projectRoot: string;
  executionAuthorityId: string;
  ownedPaths: string[];
}): GoalRunCommitProof {
  const trailer = `Goal-Execution-Authority: ${input.executionAuthorityId}`;
  const candidates = runGit(input.projectRoot, [
    'log',
    '--format=%H',
    '--fixed-strings',
    `--grep=${trailer}`,
    'HEAD',
  ])
    .split(/\r?\n/gu)
    .filter(Boolean);
  for (const commitHash of candidates) {
    const message = runGit(input.projectRoot, ['log', '-1', '--format=%B', commitHash]);
    const parentTokens = runGit(input.projectRoot, ['rev-list', '--parents', '-n', '1', commitHash])
      .split(/\s+/u)
      .filter(Boolean);
    const changedPaths = changedPathsForCommit(input.projectRoot, commitHash);
    if (
      parentTokens.length !== 2 ||
      changedPaths.length === 0 ||
      changedPaths.some((changedPath) => !matchesScope(changedPath, input.ownedPaths)) ||
      !message.split(/\r?\n/gu).includes(trailer) ||
      !currentOwnedPathsMatchCommit({ ...input, commitHash })
    ) {
      continue;
    }
    return Object.freeze({
      kind: 'owned_path_commit' as const,
      commitCount: 1 as const,
      commitHash,
      parentHash: parentTokens[1],
      treeHash: runGit(input.projectRoot, ['rev-parse', `${commitHash}^{tree}`]),
      changedPaths,
      trailer,
    });
  }
  throw new Error('goal_execution_commit_proof_invalid');
}

function replayObservedFiles(
  projectRoot: string,
  proof: GoalRunCommitProof
): GoalRunObservedFile[] {
  if (proof.kind !== 'owned_path_commit') return [];
  return proof.changedPaths.map((relativePath) => {
    const before = gitFileStateAt(projectRoot, proof.parentHash, relativePath);
    const after = gitFileStateAt(projectRoot, proof.commitHash, relativePath);
    return Object.freeze({
      path: relativePath,
      beforeHash: before.hash,
      afterHash: after.hash,
      existsAfter: after.exists,
    });
  });
}

function publishOwnedPathCommit(input: {
  projectRoot: string;
  parentHash: string;
  executionAuthorityId: string;
  changedPaths: string[];
  ownedPaths: string[];
}): GoalRunCommitProof {
  const trailer = `Goal-Execution-Authority: ${input.executionAuthorityId}`;
  const hasTrackedDelta =
    input.changedPaths.length > 0 &&
    Boolean(
      runGit(input.projectRoot, [
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        ...input.changedPaths,
      ])
    );
  if (!hasTrackedDelta) {
    return resolveReachableAuthorityCommit({
      projectRoot: input.projectRoot,
      executionAuthorityId: input.executionAuthorityId,
      ownedPaths: input.ownedPaths,
    });
  }
  runGit(input.projectRoot, ['add', '--', ...input.changedPaths]);
  runGit(input.projectRoot, [
    '-c',
    'user.name=BMAD Goal Executor',
    '-c',
    'user.email=bmad-goal-executor@example.invalid',
    'commit',
    '-m',
    `goal: close ${input.executionAuthorityId}`,
    '-m',
    trailer,
    '--',
    ...input.changedPaths,
  ]);
  const commitHash = runGit(input.projectRoot, ['rev-parse', 'HEAD']);
  const parentHash = runGit(input.projectRoot, ['rev-parse', 'HEAD^']);
  const treeHash = runGit(input.projectRoot, ['rev-parse', 'HEAD^{tree}']);
  const commitCount = Number(
    runGit(input.projectRoot, ['rev-list', '--count', `${input.parentHash}..${commitHash}`])
  );
  const changedPaths = changedPathsForCommit(input.projectRoot, commitHash);
  const message = runGit(input.projectRoot, ['log', '-1', '--format=%B', commitHash]);
  if (
    commitCount !== 1 ||
    parentHash !== input.parentHash ||
    stableControlPlaneStringify(changedPaths) !== stableControlPlaneStringify(input.changedPaths) ||
    !message.split(/\r?\n/gu).includes(trailer)
  ) {
    throw new Error('goal_execution_commit_proof_invalid');
  }
  return Object.freeze({
    kind: 'owned_path_commit' as const,
    commitCount: 1 as const,
    commitHash,
    parentHash,
    treeHash,
    changedPaths,
    trailer,
  });
}

export function executeGoalRunMutation(input: {
  projectRoot: string;
  candidateRunId: string;
  executionAuthority: JsonRecord;
  adapter: ResolvedGoalRunExecutionAdapterAuthority;
}): {
  changedPaths: string[];
  observedFiles: GoalRunObservedFile[];
  ownedPathStates: GoalRunOwnedPathState[];
  commandObservations: GoalRunCommandObservation[];
  commitProof: GoalRunCommitProof;
} {
  const ownedPaths = Array.isArray(input.executionAuthority.ownedPaths)
    ? input.executionAuthority.ownedPaths.map(normalizedRelativePath)
    : [];
  const forbiddenPaths = Array.isArray(input.executionAuthority.forbiddenPaths)
    ? input.executionAuthority.forbiddenPaths.map(normalizedRelativePath)
    : [];
  if (ownedPaths.length === 0) throw new Error('goal_execution_owned_paths_missing');
  const partitionId = input.executionAuthority.partitionId;
  const parentHash =
    typeof partitionId === 'string'
      ? runGit(input.projectRoot, ['rev-parse', '--verify', 'HEAD'])
      : null;
  const workspaceBefore = workspaceSnapshot(input.projectRoot);
  const before = new Map(
    ownedPaths.map((ownedPath) => [ownedPath, fileState(input.projectRoot, ownedPath)])
  );
  const declaredChangedPaths = invokeAdapter(input);
  const workspaceAfterAdapter = workspaceSnapshot(input.projectRoot);
  const adapterWorkspaceDelta = workspaceDeltaPaths(workspaceBefore, workspaceAfterAdapter);
  if (
    adapterWorkspaceDelta.some(
      (changedPath) =>
        !matchesScope(changedPath, ownedPaths) || matchesScope(changedPath, forbiddenPaths)
    )
  ) {
    throw new Error('goal_execution_changed_paths_out_of_scope');
  }
  const adapterObservedFiles = ownedPaths.flatMap((ownedPath) => {
    const prior = before.get(ownedPath)!;
    const after = fileState(input.projectRoot, ownedPath);
    if (prior.exists === after.exists && prior.hash === after.hash) return [];
    return [
      Object.freeze({
        path: ownedPath,
        beforeHash: prior.hash,
        afterHash: after.hash,
        existsAfter: after.exists,
      }),
    ];
  });
  const adapterChangedPaths = adapterObservedFiles.map((entry) => entry.path).sort();
  if (
    stableControlPlaneStringify(adapterChangedPaths) !==
      stableControlPlaneStringify(declaredChangedPaths) ||
    adapterChangedPaths.some(
      (changedPath) =>
        !matchesScope(changedPath, ownedPaths) || matchesScope(changedPath, forbiddenPaths)
    )
  ) {
    throw new Error('goal_execution_changed_paths_out_of_scope');
  }
  const commandObservations = runCommands({
    projectRoot: input.projectRoot,
    commands: Array.isArray(input.executionAuthority.commands)
      ? (input.executionAuthority.commands as JsonRecord[])
      : [],
    timeoutMs: input.adapter.authority.timeoutMs,
  });
  const workspaceAfterValidation = workspaceSnapshot(input.projectRoot);
  if (workspaceDeltaPaths(workspaceAfterAdapter, workspaceAfterValidation).length > 0) {
    throw new Error('goal_execution_validation_mutated_workspace');
  }
  const observedFiles = ownedPaths.flatMap((ownedPath) => {
    const prior = before.get(ownedPath)!;
    const after = fileState(input.projectRoot, ownedPath);
    if (prior.exists === after.exists && prior.hash === after.hash) return [];
    return [
      Object.freeze({
        path: ownedPath,
        beforeHash: prior.hash,
        afterHash: after.hash,
        existsAfter: after.exists,
      }),
    ];
  });
  const changedPaths = observedFiles.map((entry) => entry.path).sort();
  const ownedPathStates = ownedPaths.map((ownedPath) => {
    const state = fileState(input.projectRoot, ownedPath);
    return Object.freeze({ path: ownedPath, hash: state.hash, exists: state.exists });
  });
  const commitProof = parentHash
    ? publishOwnedPathCommit({
        projectRoot: input.projectRoot,
        parentHash,
        executionAuthorityId: String(input.executionAuthority.executionAuthorityId),
        changedPaths,
        ownedPaths,
      })
    : ({ kind: 'not_applicable' } as const);
  if (
    commitProof.kind === 'owned_path_commit' &&
    !currentOwnedPathsMatchCommit({
      projectRoot: input.projectRoot,
      commitHash: commitProof.commitHash,
      ownedPaths,
    })
  ) {
    throw new Error('goal_execution_commit_proof_invalid');
  }
  const effectiveObservedFiles =
    observedFiles.length > 0 ? observedFiles : replayObservedFiles(input.projectRoot, commitProof);
  const effectiveChangedPaths = effectiveObservedFiles.map((entry) => entry.path).sort();
  return Object.freeze({
    changedPaths: effectiveChangedPaths,
    observedFiles: effectiveObservedFiles,
    ownedPathStates,
    commandObservations,
    commitProof,
  });
}
