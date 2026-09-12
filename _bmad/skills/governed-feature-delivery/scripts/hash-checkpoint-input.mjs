#!/usr/bin/env node
import path from 'node:path';
import {
  emit,
  fail,
  parseArgs,
  policyHash,
  objectHash,
  readJson,
  required,
  resolveRepoPath,
  scopeHash,
  sha256File,
  validateAuthorityPolicy,
} from './checkpoint-core.mjs';

const HELP = `Hash one governed checkpoint input using the validator's exact rules.

Required: --kind file|policy|scope|authority --input FILE
Optional: --repo DIR`;

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['kind', 'input', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const input = resolveRepoPath(repo, required(options, 'input'), '--input');
  const kind = required(options, 'kind');
  const hash = kind === 'file' ? sha256File(input)
    : kind === 'policy' ? policyHash(readJson(input))
      : kind === 'scope' ? scopeHash(readJson(input))
        : kind === 'authority' ? objectHash(validateAuthorityPolicy(readJson(input)))
        : null;
  if (!hash) throw new Error('--kind must be file, policy, scope, or authority');
  emit({ ok: true, kind, input, sha256: hash });
} catch (error) {
  fail(error, 'governed_feature_input_hash_failed');
}
