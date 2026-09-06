#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATE_REPLAY_REASON,
  NEXT_ACTIONS,
  NEXT_ACTION_TEXT,
  artifactPath,
  emit,
  fail,
  git,
  parseArgs,
  readJson,
  required,
  resolveRepoPath,
  sha256File,
  writeValidatedExclusiveJson,
} from './checkpoint-core.mjs';

const HELP = `Reset stale gate and review evidence after a committed in-scope change.

Required: --checkpoint FILE --out FILE
Optional: --repo DIR

The parent must be GREEN_CONFIRMED, STOP_GATE_GREEN, REVIEWED, or PR_GREEN.
The worktree must be clean, remain on the same branch, and have a new committed HEAD.`;
const RESETTABLE = new Set(['GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN']);

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const parentPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, parentPath), '--repo', repo, '--historical', 'true'], { stdio: 'pipe' });
  const parent = readJson(parentPath);
  if (!RESETTABLE.has(parent.state)) throw new Error(`gate replay cannot reset state ${parent.state}`);

  const currentHead = git(repo, ['rev-parse', 'HEAD']).toLowerCase();
  const currentBranch = git(repo, ['branch', '--show-current']) || 'DETACHED';
  if (git(repo, ['status', '--porcelain'])) throw new Error('gate replay reset requires a clean worktree');
  if (currentBranch !== parent.branch) throw new Error('gate replay reset must remain on the checkpoint branch');
  if (currentHead === parent.headSha) throw new Error('gate replay reset requires a new committed HEAD');
  try { git(repo, ['merge-base', '--is-ancestor', parent.headSha, currentHead]); }
  catch { throw new Error('gate replay reset requires current HEAD to descend from checkpoint headSha'); }

  const next = structuredClone(parent);
  next.checkpointRevision += 1;
  next.previousCheckpointPath = path.relative(path.dirname(output), parentPath).replaceAll(path.sep, '/');
  next.previousCheckpointHash = sha256File(parentPath);
  next.state = 'PHASE_PLANNED';
  next.headSha = currentHead;
  next.branch = currentBranch;
  next.stopGateEvidence = [];
  next.scopeAttestation = null;
  next.reviewer = null;
  next.pullRequest = null;
  next.merge = null;
  next.release = null;
  next.updatedAt = new Date().toISOString();
  next.stateHistory.push({ state: next.state, at: next.updatedAt, reason: GATE_REPLAY_REASON });
  next.nextActionCode = NEXT_ACTIONS[next.state];
  next.nextExactAction = NEXT_ACTION_TEXT[next.nextActionCode];
  next.currentStep = next.nextExactAction;

  writeValidatedExclusiveJson(output, next, (candidate) => {
    execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, candidate), '--repo', repo], { stdio: 'pipe' });
  });
  emit({ ok: true, checkpoint: artifactPath(repo, output), state: next.state, headSha: next.headSha, revision: next.checkpointRevision });
} catch (error) {
  fail(error, 'governed_feature_gate_replay_reset_failed');
}
