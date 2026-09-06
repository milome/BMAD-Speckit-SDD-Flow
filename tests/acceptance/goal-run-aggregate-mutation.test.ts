import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeGoalRunMutation, recoverGoalRunMutationFromEvidence } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-run-mutation-executor';

const roots: string[] = [];
const hash = `sha256:${'a'.repeat(64)}`;
function fixture(script = 'process.stdout.write("verified");') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'test-only-aggregate-mutation-'));
  roots.push(root);
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  writeFileSync(path.join(root, 'production.txt'), 'baseline\n', 'utf8');
  writeFileSync(path.join(root, 'verify.cjs'), script, 'utf8');
  git(['init', '--quiet']);
  git(['add', 'production.txt', 'verify.cjs']);
  git(['-c', 'user.name=Test Only', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'test-only baseline']);
  const authority = { executionAuthorityId: 'aggregate-test', executionAuthorityHash: hash, executionPackageHash: hash,
    partitionId: 'PART-aggregate', executionClass: 'aggregate_only', aggregateGatePhase: 'post_child_execution',
    ownedPaths: [], forbiddenPaths: [], commands: [{ commandId: 'CMD-verify', invocation: 'node verify.cjs' }],
    taskExecutions: [{ taskId: 'TASK-002', executionClass: 'aggregate_only', ownedProductionPaths: '`none`',
      aggregateGatePhase: 'post_child_execution', aggregateValidationCommands: ['CMD-verify'], sourceRefs: ['SPAN-aggregate'] }] };
  const execute = (value: Record<string, unknown> = authority) => executeGoalRunMutation({ projectRoot: root,
    candidateRunId: 'test-only-run', executionAuthority: value, adapter: { authority: { timeoutMs: 10000 } } as never });
  return { root, git, authority, execute };
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })));

describe('aggregate-only read-only mutation executor', () => {
  it('runs frozen verification commands with no adapter, checkpoint, ownership or commit', () => {
    const value = fixture();
    const head = value.git(['rev-parse', 'HEAD']);
    writeFileSync(path.join(value.root, 'production.txt'), 'user dirty change\n', 'utf8');
    const result = value.execute();
    expect(result.changedPaths).toEqual([]);
    expect(result.observedFiles).toEqual([]);
    expect(result.ownedPathStates).toEqual([]);
    expect(result.commitProof).toEqual({ kind: 'not_applicable' });
    expect(result.commandObservations[0].commandId).toBe('CMD-verify');
    expect(readFileSync(path.join(value.root, 'production.txt'), 'utf8')).toBe('user dirty change\n');
    expect(value.git(['rev-parse', 'HEAD'])).toBe(head);
    const evidence = { ...result, executionAuthorityHash: hash, executionPackageHash: hash };
    expect(recoverGoalRunMutationFromEvidence({ projectRoot: value.root, executionAuthority: value.authority, evidence })).toEqual(result);
  });
  it.each([undefined, 'executable_child', 'unknown'])('does not reinterpret empty ownership as aggregate for %s', (executionClass) => {
    const value = fixture();
    expect(() => value.execute({ ...value.authority, executionClass })).toThrow(executionClass === 'unknown'
      ? 'goal_execution_class_invalid' : 'goal_execution_owned_paths_missing');
  });
  it('resolves native source-command references through frozen command provenance', () => {
    const value = fixture();
    const authority = { ...value.authority, commands: [{ ...value.authority.commands[0], sourceDeclarationRefs: ['SOURCE-CMD-verify'] }],
      taskExecutions: [{ ...value.authority.taskExecutions[0], aggregateValidationCommands: ['SOURCE-CMD-verify'] }] };
    expect(value.execute(authority).commandObservations[0].commandId).toBe('CMD-verify');
  });
  it.each(['missing-metadata', 'borrowed-path', 'unknown-command'])('rejects invalid aggregate metadata: %s', (mutation) => {
    const value = fixture();
    const authority: any = structuredClone(value.authority);
    if (mutation === 'missing-metadata') delete authority.taskExecutions;
    if (mutation === 'borrowed-path') authority.ownedPaths = ['production.txt'];
    if (mutation === 'unknown-command') authority.taskExecutions[0].aggregateValidationCommands = ['undeclared'];
    expect(() => value.execute(authority)).toThrow('goal_execution_aggregate_authority_invalid');
  });
  it('rejects validation that changes production files', () => {
    const value = fixture('require("node:fs").writeFileSync("production.txt","forbidden mutation");');
    expect(value.execute).toThrow('goal_execution_validation_mutated_workspace');
  });
  it('rejects validation that moves HEAD', () => {
    const value = fixture('require("node:child_process").execFileSync("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","--allow-empty","-m","forbidden commit"]);');
    expect(value.execute).toThrow('goal_execution_workspace_head_changed');
  });
  it.each(['authority-hash', 'command-id', 'invocation', 'missing-command', 'file-state', 'commit'])('rejects evidence drift: %s', (mutation) => {
    const value = fixture();
    const evidence: any = { ...value.execute(), executionAuthorityHash: hash, executionPackageHash: hash };
    if (mutation === 'authority-hash') evidence.executionAuthorityHash = `sha256:${'b'.repeat(64)}`;
    if (mutation === 'command-id') evidence.commandObservations = [{ ...evidence.commandObservations[0], commandId: 'other' }];
    if (mutation === 'invocation') evidence.commandObservations = [{ ...evidence.commandObservations[0], normalizedInvocation: 'node other.cjs' }];
    if (mutation === 'missing-command') evidence.commandObservations = [];
    if (mutation === 'file-state') evidence.ownedPathStates = [{ path: 'production.txt', hash, exists: true }];
    if (mutation === 'commit') evidence.commitProof = { kind: 'owned_path_commit' };
    expect(() => recoverGoalRunMutationFromEvidence({ projectRoot: value.root, executionAuthority: value.authority, evidence }))
      .toThrow('goal_execution_evidence_invalid');
  });
});
