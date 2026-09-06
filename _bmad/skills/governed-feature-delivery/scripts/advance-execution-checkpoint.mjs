#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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

const HELP = `Advance one checkpoint revision without overwriting prior evidence.

Required: --checkpoint FILE --out FILE --to-state STATE
Optional: --repo DIR --evidence FILE --scope-attestation FILE --reviewer FILE --pull-request FILE
          --merge FILE --successor-signal FILE --release FILE

The payload matching --to-state is required. RELEASED requires both --successor-signal and --release.`;
const NEXT = {
  PHASE_PLANNED: 'RED_CONFIRMED',
  RED_CONFIRMED: 'GREEN_CONFIRMED',
  GREEN_CONFIRMED: 'STOP_GATE_GREEN',
  STOP_GATE_GREEN: 'REVIEWED',
  REVIEWED: 'PR_GREEN',
  PR_GREEN: 'MERGED',
};
const REQUIRED_EVIDENCE = {
  RED_CONFIRMED: ['acceptance-red', 'confirmed'],
  GREEN_CONFIRMED: ['implementation-green', 'confirmed'],
  STOP_GATE_GREEN: ['stop-gate', 'pass'],
};

try {
  const options = parseArgs(process.argv.slice(2), new Set(), new Set(['checkpoint', 'out', 'to-state', 'repo', 'evidence', 'scope-attestation', 'reviewer', 'pull-request', 'merge', 'successor-signal', 'release']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const parentPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const output = resolveRepoPath(repo, required(options, 'out'), '--out', { output: true });
  const target = required(options, 'to-state');
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  const parentValidationArgs = [validator, '--checkpoint', artifactPath(repo, parentPath), '--repo', repo];
  if (REQUIRED_EVIDENCE[target]) parentValidationArgs.push('--historical', 'true');
  execFileSync(process.execPath, parentValidationArgs, { stdio: 'pipe' });
  const parent = readJson(parentPath);
  const expected = NEXT[parent.state];
  if (parent.state === 'MERGED') {
    if (!['NEXT_PHASE', 'RELEASED'].includes(target)) throw new Error('MERGED may advance only to NEXT_PHASE or RELEASED');
  } else if (expected !== target) throw new Error(`invalid transition: ${parent.state} -> ${target}`);
  if (target === 'STOP_GATE_GREEN' && parent.state === 'GREEN_CONFIRMED' && git(repo, ['rev-parse', 'HEAD']).toLowerCase() !== parent.headSha) {
    throw new Error('GREEN_CONFIRMED with a changed HEAD requires reset-execution-gates.mjs before STOP_GATE_GREEN');
  }

  const next = structuredClone(parent);
  next.state = target;
  next.checkpointRevision += 1;
  next.previousCheckpointPath = path.relative(path.dirname(output), parentPath).replaceAll(path.sep, '/');
  next.previousCheckpointHash = sha256File(parentPath);
  next.updatedAt = new Date().toISOString();
  next.stateHistory.push({ state: target, at: next.updatedAt, reason: 'checkpoint advanced with bound evidence' });

  if (REQUIRED_EVIDENCE[target]) {
    const evidence = readJson(resolveRepoPath(repo, required(options, 'evidence'), '--evidence'));
    const [kind, status] = REQUIRED_EVIDENCE[target];
    if (evidence.kind !== kind || evidence.status !== status || evidence.headSha !== git(repo, ['rev-parse', 'HEAD']).toLowerCase()) {
      throw new Error(`${target} requires current ${kind}/${status} evidence`);
    }
    next.stopGateEvidence.push(evidence);
    next.headSha = evidence.headSha;
    next.branch = git(repo, ['branch', '--show-current']) || 'DETACHED';
  }
  if (target === 'REVIEWED') {
    next.scopeAttestation = readJson(resolveRepoPath(repo, required(options, 'scope-attestation'), '--scope-attestation'));
    next.reviewer = readJson(resolveRepoPath(repo, required(options, 'reviewer'), '--reviewer'));
  }
  if (target === 'PR_GREEN') {
    next.pullRequest = readJson(resolveRepoPath(repo, required(options, 'pull-request'), '--pull-request'));
  }
  if (target === 'MERGED') next.merge = readJson(resolveRepoPath(repo, required(options, 'merge'), '--merge'));
  if (target === 'NEXT_PHASE' || target === 'RELEASED') {
    next.lastSuccessorSignal = readJson(resolveRepoPath(repo, required(options, 'successor-signal'), '--successor-signal'));
    next.completedPhase = next.currentPhase;
    if (target === 'RELEASED') next.release = options.release ? readJson(resolveRepoPath(repo, options.release, '--release')) : null;
  }
  next.nextActionCode = NEXT_ACTIONS[target];
  next.nextExactAction = NEXT_ACTION_TEXT[next.nextActionCode];
  next.currentStep = next.nextExactAction;

  try {
    writeValidatedExclusiveJson(output, next, (candidate) => {
      execFileSync(process.execPath, [validator, '--checkpoint', artifactPath(repo, candidate), '--repo', repo], { stdio: 'pipe' });
    });
  } catch (error) {
    throw new Error(`advanced checkpoint failed validation: ${error.stderr?.toString().trim() || error.message}`);
  }
  emit({ ok: true, checkpoint: artifactPath(repo, output), state: target, revision: next.checkpointRevision });
} catch (error) {
  fail(error, 'governed_feature_checkpoint_advance_failed');
}
