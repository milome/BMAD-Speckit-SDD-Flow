#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NEXT_ACTIONS,
  NEXT_ACTION_TEXT,
  authorityAllowed,
  artifactPath,
  emit,
  fail,
  isIsoDateTime,
  legacyProgress,
  normalizeScope,
  objectHash,
  parseArgs,
  policyHash,
  readJson,
  required,
  resolveRepoPath,
  scopeHash,
  sha256File,
  writeValidatedExclusiveJson,
  validateAuthorityPolicy,
} from './checkpoint-core.mjs';

const HELP = `Prepare an existing immutable checkpoint through design freeze and phase planning.

Required: --checkpoint FILE --out FILE --to-state SPEC_FROZEN|PHASE_PLANNED
For SPEC_FROZEN: --spec FILE --successor-policy FILE --freeze-receipt FILE --authority-policy FILE
For PHASE_PLANNED: --plan FILE --scope FILE
Optional: --repo DIR`;

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'to-state', 'spec', 'successor-policy', 'freeze-receipt', 'authority-policy', 'plan', 'scope', 'repo']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const parentPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const target = required(options, 'to-state');
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, parentPath), '--repo', repo, '--enforce-source-baseline', 'true'], { stdio: 'pipe' });
  const parent = readJson(parentPath);
  if (!((parent.state === 'DISCOVERED' && target === 'SPEC_FROZEN') || (parent.state === 'SPEC_FROZEN' && target === 'PHASE_PLANNED'))) {
    throw new Error(`invalid preparation transition: ${parent.state} -> ${target}`);
  }
  const next = structuredClone(parent);
  if (target === 'SPEC_FROZEN') {
    const specPath = resolveRepoPath(repo, required(options, 'spec'), '--spec');
    const policyPath = resolveRepoPath(repo, required(options, 'successor-policy'), '--successor-policy');
    const receiptPath = resolveRepoPath(repo, required(options, 'freeze-receipt'), '--freeze-receipt');
    const authorityPolicyPath = resolveRepoPath(repo, required(options, 'authority-policy'), '--authority-policy');
    const authorityPolicy = validateAuthorityPolicy(readJson(authorityPolicyPath));
    const policy = readJson(policyPath);
    const receipt = readJson(receiptPath);
    const specHash = sha256File(specPath);
    const successorPolicyHash = policyHash(policy);
    if (receipt.specHash !== specHash || receipt.successorPolicyHash !== successorPolicyHash || !authorityAllowed(authorityPolicy, 'designFreeze', receipt.authority) || !isIsoDateTime(receipt.frozenAt)) throw new Error('freeze receipt does not bind the design, successor policy, and authority policy');
    next.specHash = specHash;
    next.successorPolicy = policy;
    next.successorPolicyHash = successorPolicyHash;
    next.authorityPolicyHash = objectHash(authorityPolicy);
    next.designFreezeReceipt = {
      authority: receipt.authority,
      frozenAt: receipt.frozenAt,
      specHash,
      successorPolicyHash,
      receiptPath: artifactPath(repo, receiptPath),
      receiptHash: sha256File(receiptPath),
    };
    next.artifacts.specPath = artifactPath(repo, specPath);
    next.artifacts.successorPolicyPath = artifactPath(repo, policyPath);
    next.artifacts.authorityPolicyPath = artifactPath(repo, authorityPolicyPath);
  } else {
    const planPath = resolveRepoPath(repo, required(options, 'plan'), '--plan');
    const scopePath = resolveRepoPath(repo, required(options, 'scope'), '--scope');
    const scope = normalizeScope(readJson(scopePath));
    if (scope.allowedPaths.length === 0 || Object.values(scope.evidenceInputs).some((items) => items.length === 0)) throw new Error('planned phase requires allowed paths and complete evidence input manifests');
    next.phasePlanHash = sha256File(planPath);
    next.authorizedScope = scope;
    next.scopeHash = scopeHash(scope);
    next.artifacts.phasePlanPath = artifactPath(repo, planPath);
    next.artifacts.scopePath = artifactPath(repo, scopePath);
  }
  next.state = target;
  next.checkpointRevision += 1;
  next.previousCheckpointPath = path.relative(path.dirname(output), parentPath).replaceAll(path.sep, '/');
  next.previousCheckpointHash = sha256File(parentPath);
  next.updatedAt = new Date().toISOString();
  next.stateHistory.push({ state: target, at: next.updatedAt, reason: 'checkpoint preparation completed' });
  next.nextActionCode = NEXT_ACTIONS[target];
  next.nextExactAction = NEXT_ACTION_TEXT[next.nextActionCode];
  next.currentStep = next.nextExactAction;
  writeValidatedExclusiveJson(output, next, (candidate) => {
    execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, candidate), '--repo', repo, '--enforce-source-baseline', 'true'], { stdio: 'pipe' });
  }, repo);
emit({ ok: true, checkpoint: artifactPath(repo, output), state: target, revision: next.checkpointRevision, progress: legacyProgress(next) });
} catch (error) {
  fail(error, 'governed_feature_checkpoint_prepare_failed');
}
