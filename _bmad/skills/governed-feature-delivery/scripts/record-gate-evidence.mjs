#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactPath,
  emit,
  fail,
  git,
  listWorktreePaths,
  parseArgs,
  readJson,
  required,
  resolveRepoPath,
  sha256File,
  sha256Text,
  writeExclusiveJson,
} from './checkpoint-core.mjs';

const HELP = `Create one hash-bound gate evidence record from the authorized input manifest.

Required: --checkpoint FILE --out FILE --id ID --kind KIND --status STATUS
          --command TEXT --receipt FILE
Optional: --repo DIR`;

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'id', 'kind', 'status', 'command', 'receipt', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const checkpointPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, checkpointPath), '--repo', repo, '--historical', 'true', '--enforce-source-baseline', 'true'], { stdio: 'pipe' });
  const checkpoint = readJson(checkpointPath);
if (listWorktreePaths(repo).length) throw new Error('gate evidence requires a clean worktree outside managed artifacts');
  const kind = required(options, 'kind');
  const inputs = checkpoint.authorizedScope.evidenceInputs[kind];
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error(`checkpoint has no authorized inputs for ${kind}`);
  const inputHashes = Object.fromEntries(inputs.map((input) => [input, sha256File(resolveRepoPath(repo, input, `evidence input ${input}`))]));
  const command = required(options, 'command').trim();
  if (!command) throw new Error('--command must not be blank');
  const receiptPath = resolveRepoPath(repo, required(options, 'receipt'), '--receipt');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const evidence = {
    id: required(options, 'id'),
    kind,
    status: required(options, 'status'),
    headSha: git(repo, ['rev-parse', 'HEAD']).toLowerCase(),
    command,
    commandHash: sha256Text(command),
    inputHashes,
    receiptPath: artifactPath(repo, receiptPath),
    receiptHash: sha256File(receiptPath),
    completedAt: new Date().toISOString(),
  };
  writeExclusiveJson(output, evidence, repo);
  emit({ ok: true, evidence: artifactPath(repo, output), id: evidence.id, kind });
} catch (error) {
  fail(error, 'governed_feature_evidence_record_failed');
}
