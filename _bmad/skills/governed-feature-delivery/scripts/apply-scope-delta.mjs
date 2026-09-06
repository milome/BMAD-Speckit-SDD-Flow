#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactPath,
  authorityAllowed,
  emit,
  fail,
  git,
  isIsoDateTime,
  normalizeScope,
  parseArgs,
  readJson,
  required,
  resolveRepoPath,
  scopeHash,
  sha256File,
  writeValidatedExclusiveJson,
  validateAuthorityPolicy,
} from './checkpoint-core.mjs';

const HELP = `Apply one approved scope delta as a new immutable checkpoint revision.

Required: --checkpoint FILE --out FILE --scope FILE --plan FILE --delta FILE
Optional: --repo DIR`;

function changedPaths(repo, baseSha, headSha, pathspecs = []) {
  const args = ['diff', '--name-only', '--diff-filter=ACDMRTUXB', baseSha, headSha, '--', ...pathspecs];
  const output = git(repo, args);
  return output ? output.split(/\r?\n/u).filter(Boolean).map((entry) => entry.replaceAll('\\', '/')) : [];
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'scope', 'plan', 'delta', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const parentPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const scopePath = resolveRepoPath(repo, required(options, 'scope'), '--scope');
  const planPath = resolveRepoPath(repo, required(options, 'plan'), '--plan');
  const delta = readJson(resolveRepoPath(repo, required(options, 'delta'), '--delta'));
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, parentPath), '--repo', repo, '--historical', 'true'], { stdio: 'pipe' });
  const parent = readJson(parentPath);
  if (!['PHASE_PLANNED', 'RED_CONFIRMED', 'GREEN_CONFIRMED', 'STOP_GATE_GREEN'].includes(parent.state)) throw new Error('scope delta is allowed only during active implementation before review');
  const currentHead = git(repo, ['rev-parse', 'HEAD']).toLowerCase();
  const currentBranch = git(repo, ['branch', '--show-current']) || 'DETACHED';
  if (git(repo, ['status', '--porcelain'])) throw new Error('scope delta requires a clean worktree');
  if (currentBranch !== parent.branch) throw new Error('scope delta must remain on the checkpoint branch');
  try { git(repo, ['merge-base', '--is-ancestor', parent.baseSha, currentHead]); }
  catch { throw new Error('scope delta requires current HEAD to descend from checkpoint baseSha'); }
  try { git(repo, ['merge-base', '--is-ancestor', parent.headSha, currentHead]); }
  catch { throw new Error('scope delta requires current HEAD to descend from checkpoint headSha'); }
  const committedPaths = changedPaths(repo, parent.baseSha, currentHead).sort();
  const allowedCommittedPaths = new Set(changedPaths(repo, parent.baseSha, currentHead, parent.authorizedScope.allowedPaths));
  const protectedCommittedPaths = changedPaths(repo, parent.baseSha, currentHead, parent.authorizedScope.protectedPaths);
  const forbiddenCommittedPaths = changedPaths(repo, parent.baseSha, currentHead, parent.authorizedScope.forbiddenWork);
  if (committedPaths.some((entry) => !allowedCommittedPaths.has(entry)) || protectedCommittedPaths.length || forbiddenCommittedPaths.length) {
    throw new Error('scope delta cannot authorize already-committed changes outside the parent scope');
  }
  const authorizedScope = normalizeScope(readJson(scopePath));
  const afterScopeHash = scopeHash(authorizedScope);
  const nextPlanHash = sha256File(planPath);
  const authorityPolicy = validateAuthorityPolicy(readJson(resolveRepoPath(repo, parent.artifacts.authorityPolicyPath, 'authority policy')));
  if (delta.decision !== 'approved' || !authorityAllowed(authorityPolicy, 'scopeDelta', delta.authority) || !isIsoDateTime(delta.decidedAt)) throw new Error('scope delta requires an allowed explicit approval');
  if (delta.beforeScopeHash !== parent.scopeHash || delta.afterScopeHash !== afterScopeHash || delta.phasePlanHash !== nextPlanHash) throw new Error('scope delta hashes do not bind the before/after scope and phase plan');

  const next = structuredClone(parent);
  next.checkpointRevision += 1;
  next.previousCheckpointPath = path.relative(path.dirname(output), parentPath).replaceAll(path.sep, '/');
  next.previousCheckpointHash = sha256File(parentPath);
  next.authorizedScope = authorizedScope;
  next.scopeHash = afterScopeHash;
  next.phasePlanHash = nextPlanHash;
  next.headSha = currentHead;
  next.branch = currentBranch;
  next.scopeDeltas.push(delta);
  next.state = 'PHASE_PLANNED';
  next.stopGateEvidence = [];
  next.scopeAttestation = null;
  next.reviewer = null;
  next.pullRequest = null;
  next.merge = null;
  next.release = null;
  next.artifacts.scopePath = artifactPath(repo, scopePath);
  next.artifacts.phasePlanPath = artifactPath(repo, planPath);
  next.updatedAt = new Date().toISOString();
  next.stateHistory.push({ state: 'PHASE_PLANNED', at: next.updatedAt, reason: 'approved scope delta requires gate replay' });
  next.nextActionCode = 'WRITE_RED_ACCEPTANCE';
  next.nextExactAction = 'write and observe RED acceptance';
  next.currentStep = next.nextExactAction;
  try {
    writeValidatedExclusiveJson(output, next, (candidate) => {
      execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, candidate), '--repo', repo], { stdio: 'pipe' });
    });
  } catch (error) {
    throw new Error(`scope-delta checkpoint failed validation: ${error.stderr?.toString().trim() || error.message}`);
  }
  emit({ ok: true, checkpoint: artifactPath(repo, output), scopeHash: afterScopeHash, revision: next.checkpointRevision });
} catch (error) {
  fail(error, 'governed_feature_scope_delta_failed');
}
