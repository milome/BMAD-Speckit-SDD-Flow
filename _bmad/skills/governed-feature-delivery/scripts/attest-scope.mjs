#!/usr/bin/env node
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  artifactPath,
  emit,
  fail,
  git,
  parseArgs,
  readJson,
  required,
  resolveRepoPath,
  writeExclusiveJson,
} from './checkpoint-core.mjs';

const HELP = `Attest that every committed path changed in a phase is allowed by its scope manifest.

Required: --checkpoint FILE --out FILE
Optional: --repo DIR`;

function changedPaths(repo, baseSha, headSha, pathspecs = []) {
  const args = ['diff', '--name-only', '--diff-filter=ACDMRTUXB', baseSha, headSha, '--'];
  args.push(...pathspecs);
  const output = git(repo, args);
  return output ? output.split(/\r?\n/u).filter(Boolean).map((entry) => entry.replaceAll('\\', '/')) : [];
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const checkpointPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, checkpointPath), '--repo', repo], { stdio: 'pipe' });
  const checkpoint = readJson(checkpointPath);
  const currentHead = git(repo, ['rev-parse', 'HEAD']).toLowerCase();
  if (git(repo, ['status', '--porcelain'])) throw new Error('scope attestation requires a clean worktree');
  if (checkpoint.headSha !== currentHead) throw new Error('checkpoint head is not the current Git HEAD');
  try { git(repo, ['merge-base', '--is-ancestor', checkpoint.baseSha, checkpoint.headSha]); }
  catch { throw new Error('scope attestation requires headSha to descend from baseSha'); }
  const changed = changedPaths(repo, checkpoint.baseSha, checkpoint.headSha);
  const allowed = new Set(changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.allowedPaths));
  const protectedChanged = new Set(changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.protectedPaths));
  const forbiddenChanged = new Set(changedPaths(repo, checkpoint.baseSha, checkpoint.headSha, checkpoint.authorizedScope.forbiddenWork));
  const outside = changed.filter((entry) => !allowed.has(entry));
  if (outside.length || protectedChanged.size || forbiddenChanged.size) {
    throw new Error(`scope violation: outside=${outside.join(',') || 'none'} protected=${[...protectedChanged].join(',') || 'none'} forbidden=${[...forbiddenChanged].join(',') || 'none'}`);
  }
  const attestation = {
    baseSha: checkpoint.baseSha,
    headSha: checkpoint.headSha,
    scopeHash: checkpoint.scopeHash,
    changedPaths: changed.sort(),
    createdAt: new Date().toISOString(),
  };
  writeExclusiveJson(output, attestation);
  emit({ ok: true, attestation: artifactPath(repo, output), changedPathCount: changed.length });
} catch (error) {
  fail(error, 'governed_feature_scope_attestation_failed');
}
