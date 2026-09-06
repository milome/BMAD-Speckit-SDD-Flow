#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_VERSION,
  STATES,
  artifactPath,
  emit,
  fail,
  git,
  isIsoDateTime,
  normalizeScope,
  parseArgs,
  readJson,
  required,
  resolveRepoPath,
  sha256File,
  policyHash,
  scopeHash,
  NEXT_ACTIONS,
  NEXT_ACTION_TEXT,
  authorityAllowed,
  objectHash,
  validateAuthorityPolicy,
  writeValidatedExclusiveJson,
} from './checkpoint-core.mjs';

const HELP = `Initialize a phase-scoped governed feature checkpoint without overwriting an existing file.

Required: --out FILE --feature-id ID --phase-id ID
Optional: --repo DIR --spec FILE --freeze-receipt FILE --plan FILE --scope FILE
          --successor-policy FILE --authority-policy FILE --previous FILE
          --recovery-receipt FILE

For a next phase, --previous must name a NEXT_PHASE checkpoint and --plan/--scope are required.`;

function stateFor(specHash, planHash, scopePath) {
  if (specHash && planHash && scopePath) return 'PHASE_PLANNED';
  if (specHash) return 'SPEC_FROZEN';
  return 'DISCOVERED';
}

function historyFor(state, at, fromPrevious) {
  const states = fromPrevious ? ['PHASE_PLANNED'] : STATES.slice(0, STATES.indexOf(state) + 1);
  return states.map((entry) => ({ state: entry, at, reason: 'checkpoint initialized' }));
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['out', 'feature-id', 'phase-id', 'repo', 'spec', 'freeze-receipt', 'plan', 'scope', 'successor-policy', 'authority-policy', 'previous', 'recovery-receipt']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const currentHeadSha = git(repo, ['rev-parse', 'HEAD']).toLowerCase();
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const featureId = required(options, 'feature-id');
  const currentPhase = required(options, 'phase-id');
  const previousPath = options.previous ? resolveRepoPath(repo, options.previous, '--previous') : null;
  const previous = previousPath ? readJson(previousPath) : null;
  if (previous) {
    const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
    try {
      execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, previousPath), '--repo', repo, '--historical', 'true'], { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`--previous failed checkpoint validation: ${error.stdout?.toString().trim() || error.stderr?.toString().trim() || error.message}`);
    }
    if (previous.schemaVersion !== SCHEMA_VERSION || previous.state !== 'NEXT_PHASE') {
      throw new Error('--previous must be a valid NEXT_PHASE checkpoint');
    }
    if (previous.featureId !== featureId) throw new Error('--previous belongs to a different feature');
    if (previous.currentPhase === currentPhase) throw new Error('next checkpoint must use a new phase id');
    try { git(repo, ['merge-base', '--is-ancestor', previous.merge.commitSha, currentHeadSha]); }
    catch { throw new Error('next-phase initialization requires HEAD to contain the previous phase merge commit'); }
  }
  if (previous && (!options.plan || !options.scope)) {
    throw new Error('next-phase initialization requires --plan and --scope');
  }

  if (previous && (options.spec || options['successor-policy'] || options['authority-policy'] || options['freeze-receipt'])) {
    throw new Error('next-phase initialization inherits frozen design and policies; override flags are forbidden');
  }
  const specPath = options.spec ? resolveRepoPath(repo, options.spec, '--spec') : null;
  const planPath = options.plan ? resolveRepoPath(repo, options.plan, '--plan') : null;
  const scopePath = options.scope ? resolveRepoPath(repo, options.scope, '--scope') : null;
  if (Boolean(planPath) !== Boolean(scopePath)) throw new Error('--plan and --scope must be provided together');
  const specHash = specPath ? sha256File(specPath) : (previous?.specHash ?? null);
  if (previous?.specHash && specHash !== previous.specHash) {
    throw new Error('new phase spec hash differs from the sealed previous checkpoint');
  }
  const phasePlanHash = planPath ? sha256File(planPath) : null;
  if (planPath && !specHash) throw new Error('--plan requires a frozen --spec or --previous');
  const authorizedScope = normalizeScope(scopePath ? readJson(scopePath) : null);
  const successorPolicy = options['successor-policy']
    ? readJson(resolveRepoPath(repo, options['successor-policy'], '--successor-policy'))
    : (previous?.successorPolicy ?? { allowedCodes: {} });
  const successorPolicyDigest = policyHash(successorPolicy);
  const authorityPolicyPath = options['authority-policy'] ? resolveRepoPath(repo, options['authority-policy'], '--authority-policy') : null;
  const authorityPolicy = authorityPolicyPath ? validateAuthorityPolicy(readJson(authorityPolicyPath)) : (previous?.artifacts?.authorityPolicyPath ? validateAuthorityPolicy(readJson(resolveRepoPath(repo, previous.artifacts.authorityPolicyPath, 'previous authority policy'))) : null);
  const authorityPolicyDigest = authorityPolicy ? objectHash(authorityPolicy) : null;
  if (specPath && !previous && (!options['successor-policy'] || !options['freeze-receipt'] || !authorityPolicy)) {
    throw new Error('an initial frozen spec requires --successor-policy, --freeze-receipt, and --authority-policy');
  }
  const freezeReceiptPath = options['freeze-receipt'] ? resolveRepoPath(repo, options['freeze-receipt'], '--freeze-receipt') : null;
  const freezeReceipt = freezeReceiptPath ? readJson(freezeReceiptPath) : (previous?.designFreezeReceipt ?? null);
  if (specHash) {
    if (!freezeReceipt || freezeReceipt.specHash !== specHash || freezeReceipt.successorPolicyHash !== successorPolicyDigest || !authorityAllowed(authorityPolicy, 'designFreeze', freezeReceipt.authority) || !isIsoDateTime(freezeReceipt.frozenAt)) {
      throw new Error('design freeze receipt does not bind the spec and successor policy');
    }
  }
  const recoveryReceiptPath = options['recovery-receipt'] ? resolveRepoPath(repo, options['recovery-receipt'], '--recovery-receipt') : null;
  const recoverySource = recoveryReceiptPath ? readJson(recoveryReceiptPath) : null;
  const recoveryReceipt = recoverySource ? {
    authority: recoverySource.authority,
    decidedAt: recoverySource.decidedAt,
    sourceHashes: recoverySource.sourceHashes,
    fieldSources: recoverySource.fieldSources,
    decision: recoverySource.decision,
    receiptPath: artifactPath(repo, recoveryReceiptPath),
    receiptHash: sha256File(recoveryReceiptPath),
  } : null;
  if (recoveryReceipt && (!authorityPolicy || !authorityAllowed(authorityPolicy, 'recovery', recoveryReceipt.authority) || !isIsoDateTime(recoveryReceipt.decidedAt) || recoveryReceipt.decision !== 'reconstructed' || !recoveryReceipt.sourceHashes || !recoveryReceipt.fieldSources)) {
    throw new Error('invalid recovery receipt');
  }
  if (recoveryReceipt && (specPath || planPath || scopePath || previous)) throw new Error('recovery initialization starts at DISCOVERED and replays later states normally');

  const state = stateFor(specHash, phasePlanHash, scopePath);
  const at = new Date().toISOString();
  const branch = git(repo, ['branch', '--show-current']) || 'DETACHED';
  const headSha = currentHeadSha;
  const checkpoint = {
    schemaVersion: SCHEMA_VERSION,
    checkpointGeneration: (previous?.checkpointGeneration ?? 0) + 1,
    checkpointRevision: 1,
    featureId,
    currentPhase,
    state,
    specHash,
    phasePlanHash,
    scopeHash: scopeHash(authorizedScope),
    authorizedScope,
    branch,
    baseSha: headSha,
    headSha,
    completedPhase: previous?.currentPhase ?? null,
    designFreezeReceipt: freezeReceipt ? {
      authority: freezeReceipt.authority,
      frozenAt: freezeReceipt.frozenAt,
      specHash,
      successorPolicyHash: successorPolicyDigest,
      receiptPath: artifactPath(repo, freezeReceiptPath) ?? previous?.designFreezeReceipt?.receiptPath,
      receiptHash: freezeReceiptPath ? sha256File(freezeReceiptPath) : previous.designFreezeReceipt.receiptHash,
    } : null,
    currentStep: NEXT_ACTION_TEXT[NEXT_ACTIONS[state]],
    nextActionCode: NEXT_ACTIONS[state],
    stopGateEvidence: [],
    scopeAttestation: null,
    reviewer: null,
    scopeDeltas: [],
    nextExactAction: NEXT_ACTION_TEXT[NEXT_ACTIONS[state]],
    successorPolicy,
    successorPolicyHash: successorPolicyDigest,
    authorityPolicyHash: authorityPolicyDigest,
    lastSuccessorSignal: null,
    stateHistory: historyFor(state, at, Boolean(previous)),
    artifacts: {
      specPath: specPath ? artifactPath(repo, specPath) : (previous?.artifacts?.specPath ?? null),
      phasePlanPath: artifactPath(repo, planPath),
      scopePath: artifactPath(repo, scopePath),
      successorPolicyPath: options['successor-policy'] ? artifactPath(repo, resolveRepoPath(repo, options['successor-policy'], '--successor-policy')) : (previous?.artifacts?.successorPolicyPath ?? null),
      authorityPolicyPath: authorityPolicyPath ? artifactPath(repo, authorityPolicyPath) : (previous?.artifacts?.authorityPolicyPath ?? null),
    },
    recoveryReceipt,
    previousCheckpointPath: previousPath ? path.relative(path.dirname(output), previousPath).replaceAll(path.sep, '/') : null,
    previousCheckpointHash: previousPath ? sha256File(previousPath) : null,
    pullRequest: null,
    merge: null,
    release: null,
    updatedAt: at,
  };
  if (recoveryReceipt) {
    const requiredFields = ['featureId', 'currentPhase', 'headSha', 'branch'];
    if (JSON.stringify(Object.keys(recoveryReceipt.fieldSources).sort()) !== JSON.stringify(requiredFields.sort())) throw new Error('recovery fieldSources must cover featureId, currentPhase, headSha, and branch exactly');
    for (const [source, expectedHash] of Object.entries(recoveryReceipt.sourceHashes)) {
      if (sha256File(resolveRepoPath(repo, source, `recovery source ${source}`)) !== expectedHash) throw new Error(`recovery source hash mismatch: ${source}`);
    }
    for (const field of requiredFields) {
      const source = recoveryReceipt.fieldSources[field];
      if (!Object.hasOwn(recoveryReceipt.sourceHashes, source)) throw new Error(`recovery field source is not hash-bound: ${field}`);
      if (readJson(resolveRepoPath(repo, source, `recovery field source ${field}`))[field] !== checkpoint[field]) throw new Error(`recovery source does not prove field: ${field}`);
    }
  }
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  writeValidatedExclusiveJson(output, checkpoint, (candidate) => {
    execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, candidate), '--repo', repo], { stdio: 'pipe' });
  });
  emit({ ok: true, checkpoint: artifactPath(repo, output), state, headSha: checkpoint.headSha });
} catch (error) {
  fail(error, 'governed_feature_checkpoint_init_failed');
}
