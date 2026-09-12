#!/usr/bin/env node
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_VERSION,
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
} from './checkpoint-core.mjs';

const HELP = `Verify whether one checkpoint evidence entry is reusable for the current worktree.

Required: --checkpoint FILE --evidence ID
Optional: --repo DIR --command TEXT --input FILE (repeatable)

Exit 0 means reuse. Exit 3 means rerun only the affected gate.`;

function normalizedCommand(value) {
  return value.trim();
}

function evidenceKey(repo, value) {
  const absolute = resolveRepoPath(repo, value, `evidence input ${value}`);
  const relative = path.relative(repo, absolute);
  const outside = path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`);
  return (outside ? absolute : relative).replaceAll(path.sep, '/');
}

try {
  const options = parseArgs(process.argv.slice(2), new Set(['input']), new Set(['checkpoint', 'evidence', 'repo', 'command', 'input']));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  const repo = path.resolve(options.repo ?? process.cwd());
  const checkpointPath = resolveRepoPath(repo, required(options, 'checkpoint'), '--checkpoint');
  const validator = fileURLToPath(new URL('./validate-execution-checkpoint.mjs', import.meta.url));
  execFileSync(process.execPath, [validator, '--checkpoint', path.relative(repo, checkpointPath), '--repo', repo, '--enforce-source-baseline', 'true'], { stdio: 'pipe' });
  const checkpoint = readJson(checkpointPath);
  const evidenceId = required(options, 'evidence');
  if (checkpoint.schemaVersion !== SCHEMA_VERSION || !Array.isArray(checkpoint.stopGateEvidence)) {
    throw new Error('checkpoint shape is not supported');
  }
  const evidence = checkpoint.stopGateEvidence.find((item) => item.id === evidenceId);
  if (!evidence) throw new Error(`evidence not found: ${evidenceId}`);
  const reasons = [];
  const minimumState = { 'acceptance-red': 3, 'implementation-green': 4, 'stop-gate': 5 }[evidence.kind];
  const stateOrder = ['DISCOVERED', 'SPEC_FROZEN', 'PHASE_PLANNED', 'RED_CONFIRMED', 'GREEN_CONFIRMED', 'STOP_GATE_GREEN', 'REVIEWED', 'PR_GREEN', 'MERGED', 'NEXT_PHASE', 'RELEASED'];
  if (minimumState === undefined || stateOrder.indexOf(checkpoint.state) < minimumState) reasons.push('evidence_not_applicable_to_state');
  const currentHead = git(repo, ['rev-parse', 'HEAD']).toLowerCase();
  const currentBranch = git(repo, ['branch', '--show-current']) || 'DETACHED';
  if (checkpoint.headSha !== currentHead) reasons.push('checkpoint_head_changed');
  if (evidence.headSha !== currentHead) reasons.push('evidence_head_changed');
  if (checkpoint.branch !== currentBranch) reasons.push('branch_changed');
if (listWorktreePaths(repo).length) reasons.push('worktree_dirty');
  if (!['pass', 'confirmed'].includes(evidence.status)) reasons.push('evidence_not_passing');

  if (!evidence.command || !evidence.commandHash) reasons.push('command_binding_missing');
  else {
    const storedCommandHash = sha256Text(normalizedCommand(evidence.command));
    if (storedCommandHash !== evidence.commandHash) reasons.push('stored_command_hash_invalid');
    if (options.command && sha256Text(normalizedCommand(options.command)) !== evidence.commandHash) reasons.push('command_changed');
  }

  const inputHashes = evidence.inputHashes;
  if (!inputHashes || typeof inputHashes !== 'object' || Array.isArray(inputHashes)) reasons.push('input_bindings_missing');
  else {
    for (const [input, expectedHash] of Object.entries(inputHashes)) {
      try {
        if (sha256File(resolveRepoPath(repo, input, `evidence input ${input}`)) !== expectedHash) reasons.push(`input_changed:${input}`);
      } catch {
        reasons.push(`input_missing:${input}`);
      }
    }
    for (const input of options.input ?? []) {
      if (!Object.hasOwn(inputHashes, evidenceKey(repo, input))) reasons.push(`requested_input_unbound:${evidenceKey(repo, input)}`);
    }
  }

  if (!evidence.receiptPath || !evidence.receiptHash) reasons.push('receipt_binding_missing');
  else {
    try {
      if (sha256File(resolveRepoPath(repo, evidence.receiptPath, 'evidence receipt')) !== evidence.receiptHash) reasons.push('receipt_hash_invalid');
    } catch {
      reasons.push('receipt_missing');
    }
  }
  const uniqueReasons = [...new Set(reasons)];
  const current = uniqueReasons.length === 0;
  emit({ ok: true, current, decision: current ? 'reuse' : 'rerun_affected_gate', evidenceId, headSha: currentHead, reasons: uniqueReasons }, current ? 0 : 3);
} catch (error) {
  fail(error, 'governed_feature_evidence_currentness_failed');
}
