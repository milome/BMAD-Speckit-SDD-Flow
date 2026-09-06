import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAX_JSON_BYTES, policyHash, scopeHash, sha256File } from '../checkpoint-core.mjs';
import { validateJsonSchema } from '../json-schema-lite.mjs';

const script = fileURLToPath(new URL('../run-phase.mjs', import.meta.url));
const initStrict = fileURLToPath(new URL('../init-execution-checkpoint.mjs', import.meta.url));
const recordGate = fileURLToPath(new URL('../record-gate-evidence.mjs', import.meta.url));
const advanceStrict = fileURLToPath(new URL('../advance-execution-checkpoint.mjs', import.meta.url));
const applyScopeDelta = fileURLToPath(new URL('../apply-scope-delta.mjs', import.meta.url));
const validateStrict = fileURLToPath(new URL('../validate-execution-checkpoint.mjs', import.meta.url));
const receiptRoot = '.artifacts/governed-feature-delivery';
const phaseSchema = JSON.parse(readFileSync(new URL('../../assets/phase-receipt.schema.json', import.meta.url), 'utf8'));

function createRepo(t) {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'gfd-phase-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  mkdirSync(path.join(repo, receiptRoot), { recursive: true });
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Governed Test']);
  writeFileSync(path.join(repo, 'README.md'), 'base\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'README.md']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'base']);
  return repo;
}

function runTool(tool, repo, args, expected = 0) {
  const result = spawnSync(process.execPath, [tool, '--repo', repo, ...args], { encoding: 'utf8' });
  const diagnostic = (value) => value.length <= 2048 ? value : `${value.slice(0, 1024)}\n...[truncated ${value.length - 2048} characters]...\n${value.slice(-1024)}`;
  assert.equal(result.status, expected, `exit=${result.status}\nstdout=${diagnostic(result.stdout)}\nstderr=${diagnostic(result.stderr)}`);
  return result.stdout.trim() ? JSON.parse(result.stdout.trim()) : null;
}

function run(repo, args, expected = 0) {
  return runTool(script, repo, args, expected);
}

function read(repo, relative) {
  return JSON.parse(readFileSync(path.join(repo, relative), 'utf8'));
}

function json(repo, relative, value) {
  writeFileSync(path.join(repo, relative), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertProgress(receipt, stage, completed, next) {
  assert.equal(receipt.progress.stage, stage);
  assert.deepEqual(receipt.progress.completed, completed);
  assert.equal(receipt.progress.next, next);
  assert.deepEqual(receipt.progress.warnings, receipt.warnings);
}

function prepareCommitted(t, continuation, { riskPolicy = null } = {}) {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  const inputs = ['plan.md', 'scope.json'];
  if (riskPolicy) {
    json(repo, 'risk.json', riskPolicy);
    inputs.push('risk.json');
  }
  execFileSync('git', ['-C', repo, 'add', ...inputs]);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/baseline.json`;
  const verified = `${receiptRoot}/verified.json`;
  const committed = `${receiptRoot}/committed.json`;
  const startArgs = ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--continuation', continuation, '--plan', 'plan.md', '--scope', 'scope.json'];
  if (riskPolicy) startArgs.push('--risk-policy', 'risk.json');
  run(repo, startArgs);
  assertProgress(read(repo, baseline), 'Baseline', ['Plan'], 'complete Implement');
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  assertProgress(read(repo, verified), 'Verify', ['Plan', 'Baseline', 'Implement'], 'complete Commit');
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: phase one']);
  const value = read(repo, committed);
  const expectedNext = continuation === 'merge' ? 'record PR_GREEN' : continuation === 'pause' ? 'seal PAUSED' : 'record NEXT_PHASE';
  assertProgress(value, 'Commit', ['Plan', 'Baseline', 'Implement', 'Verify'], expectedNext);
  return { repo, baseline, verified, committed, value };
}

test('fast mode records a dirty baseline and ledger failures are warnings', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\n', 'utf8');
  const baseline = `${receiptRoot}/baseline.json`;
  const result = run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const receipt = read(repo, baseline);
  assert.equal(result.mode, 'fast');
  assert.equal(receipt.baseline.worktree, 'dirty');
  assert.deepEqual(receipt.baseline.changedPaths, ['notes.txt']);
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\nphase edit\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/dirty-verify.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);

  const occupied = `${receiptRoot}/occupied.json`;
  writeFileSync(path.join(repo, occupied), '{}\n', 'utf8');
  const warning = run(repo, ['--action', 'start', '--out', occupied, '--feature-id', 'feature', '--phase-id', 'phase-warning']);
  assert.equal(warning.ok, true);
  assert.match(warning.warnings.at(-1), /ledger write warning/u);
  assert.notEqual(warning.receipt, occupied);
  assert.equal(read(repo, warning.receipt).state, 'BASELINE');
});

test('ledger fallback uses an independent repository path', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, receiptRoot, 'blocked'), 'not a directory\n', 'utf8');
  const result = run(repo, ['--action', 'start', '--out', `${receiptRoot}/blocked/baseline.json`, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  assert.equal(result.ok, true);
  assert.match(result.receipt, /^\.artifacts\/governed-feature-delivery-fallback\//u);
  assert.equal(read(repo, result.receipt).state, 'BASELINE');
});

test('phase lineage inspection validates receipts without live status work', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/lineage-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const result = run(repo, ['--action', 'phase-lineage', '--receipt', baseline]);
  assert.deepEqual(result.lineage, { records: 1, bytes: readFileSync(path.join(repo, baseline)).byteLength });
});

test('genesis receipts cannot retain verification evidence under a relabeled initial state', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/genesis-baseline.json`;
  const verified = `${receiptRoot}/genesis-verified.json`;
  const forgedBaseline = `${receiptRoot}/genesis-forged-baseline.json`;
  const forgedStrict = `${receiptRoot}/genesis-forged-strict.json`;
  const attempted = `${receiptRoot}/genesis-attempted-verify.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);

  const verifiedReceipt = read(repo, verified);
  const baselineReceipt = read(repo, baseline);
  const relabeled = {
    ...verifiedReceipt,
    state: 'BASELINE',
    progress: baselineReceipt.progress,
    previousReceiptPath: null,
    previousReceiptHash: null,
  };
  json(repo, forgedBaseline, relabeled);
  const strictRelabeled = {
    ...relabeled,
    mode: 'strict',
    state: 'STRICT_REQUIRED',
    risk: { reasons: ['explicit strict mode'], strict: true, integrationRefs: [], classifiedAt: new Date().toISOString() },
    strictBoundary: {
      branch: relabeled.baseline.branch,
      headSha: relabeled.headSha,
      treeHash: relabeled.baseline.statusHash,
      capturedAt: new Date().toISOString(),
    },
  };
  json(repo, forgedStrict, strictRelabeled);

  const status = spawnSync(process.execPath, [script, '--repo', repo, '--action', 'status', '--receipt', forgedBaseline], { encoding: 'utf8' });
  const strictStatus = spawnSync(process.execPath, [script, '--repo', repo, '--action', 'status', '--receipt', forgedStrict], { encoding: 'utf8' });
  const verify = spawnSync(process.execPath, [script, '--repo', repo, '--action', 'verify', '--receipt', forgedBaseline, '--out', attempted, '--verify-command', 'node -e "require(\'node:fs\').writeFileSync(\'genesis-marker.txt\', \'ran\')"'], { encoding: 'utf8' });
  assert.equal(status.status, 2);
  assert.equal(strictStatus.status, 2);
  assert.equal(verify.status, 2);
  assert.equal(existsSync(path.join(repo, 'genesis-marker.txt')), false);
  assert.equal(existsSync(path.join(repo, attempted)), false);
});

test('empty verification output paths are rejected instead of bypassing currentness', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/empty-output-baseline.json`;
  const verified = `${receiptRoot}/empty-output-verified.json`;
  const forged = `${receiptRoot}/empty-output-forged.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const value = read(repo, verified);
  value.verification.at(-1).outputPath = 'verification.log';
  delete value.verification.at(-1).outputHash;
  const schemaIssues = validateJsonSchema(value, phaseSchema);
  assert.match(schemaIssues.join('\n'), /outputHash/u);
  json(repo, forged, value);
  run(repo, ['--action', 'status', '--receipt', forged], 2);
});

test('commit continuation binds verification and starts the next phase without merge', (t) => {
  const phase = prepareCommitted(t, 'commit');
  assert.equal(phase.value.state, 'COMMITTED');
  assert.equal(phase.value.commit.sha, phase.value.headSha);
  assert.equal(phase.value.commit.verificationTreeHash, phase.value.verification.at(-1).treeHash);
  const committedMode = execFileSync('git', ['-C', phase.repo, 'ls-tree', phase.value.commit.sha, '--', 'feature.txt'], { encoding: 'utf8' }).split(/\s+/u)[0];
  assert.equal(phase.value.verification.at(-1).treeModes['feature.txt'], committedMode);
  const next = `${receiptRoot}/next.json`;
  run(phase.repo, ['--action', 'next', '--receipt', phase.committed, '--out', next, '--next-phase', 'phase-2']);
  const receipt = read(phase.repo, next);
  assert.equal(receipt.state, 'NEXT_PHASE');
  assert.equal(receipt.phaseId, 'phase-1');
  assert.equal(receipt.successor.baseSha, phase.value.commit.sha);
  assert.equal(receipt.previousReceiptHash.length, 64);
  assertProgress(receipt, 'Next', ['Plan', 'Baseline', 'Implement', 'Verify', 'Commit'], 'initialize the next phase from the recorded base commit');
  execFileSync('git', ['-C', phase.repo, 'switch', '--detach', '-q', receipt.successor.baseSha]);
  const detached = run(phase.repo, ['--action', 'status', '--receipt', next]);
  assert.equal(detached.current.receiptCurrent, false);
  assert.match(detached.warnings.join('\n'), /named branch|detached/u);
  run(phase.repo, ['--action', 'start', '--previous', next, '--out', `${receiptRoot}/detached.json`, '--feature-id', 'feature', '--phase-id', 'phase-2'], 2);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', phase.value.baseline.branch]);
  run(phase.repo, ['--action', 'start', '--previous', next, '--out', `${receiptRoot}/same-branch.json`, '--feature-id', 'feature', '--phase-id', 'phase-2'], 2);
  execFileSync('git', ['-C', phase.repo, 'switch', '-qc', 'phase-2-wrong', receipt.successor.baseSha]);
  writeFileSync(path.join(phase.repo, 'wrong-base.txt'), 'wrong\n', 'utf8');
  execFileSync('git', ['-C', phase.repo, 'add', 'wrong-base.txt']);
  execFileSync('git', ['-C', phase.repo, 'commit', '-qm', 'wrong successor base']);
  run(phase.repo, ['--action', 'start', '--previous', next, '--out', `${receiptRoot}/wrong-sha.json`, '--feature-id', 'feature', '--phase-id', 'phase-2'], 2);
  execFileSync('git', ['-C', phase.repo, 'switch', '-qc', 'phase-2', receipt.successor.baseSha]);
  writeFileSync(path.join(phase.repo, 'phase-2-plan.md'), '# Phase 2\n', 'utf8');
  json(phase.repo, 'phase-2-scope.json', { allowedPaths: ['phase-2.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  run(phase.repo, ['--action', 'start', '--previous', next, '--out', `${receiptRoot}/phase-2.json`, '--feature-id', 'feature', '--phase-id', 'phase-2', '--plan', 'phase-2-plan.md', '--scope', 'phase-2-scope.json']);
  assert.equal(read(phase.repo, `${receiptRoot}/phase-2.json`).mode, 'phase');
});

test('current verification is reused without adding another event', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/cache-baseline.json`;
  const verified = `${receiptRoot}/cache-verified.json`;
  const reused = `${receiptRoot}/cache-reused.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const result = run(repo, ['--action', 'verify', '--receipt', verified, '--out', reused, '--verify-command', 'node -e "process.exit(0)"']);
  assert.equal(result.reused, true);
  assert.equal(read(repo, reused).verification.length, 1);
});

test('quoted verification commands preserve a failing exit status', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/quoted-failure-baseline.json`;
  const failed = `${receiptRoot}/quoted-failure.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  const result = run(repo, ['--action', 'verify', '--receipt', baseline, '--out', failed, '--verify-command', 'node -e "process.exit(7)"'], 1);
  assert.equal(result.ok, false);
  assert.equal(result.verification?.exitCode, 7);
  assert.equal(read(repo, failed).state, 'IMPLEMENTING');
  assert.equal(read(repo, failed).verification.at(-1).status, 'fail');
});

test('reusing an earlier pass after a failure restores a committable binding', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/reuse-after-fail-baseline.json`;
  const passed = `${receiptRoot}/reuse-after-fail-passed.json`;
  const failed = `${receiptRoot}/reuse-after-fail-failed.json`;
  const reused = `${receiptRoot}/reuse-after-fail-reused.json`;
  const committed = `${receiptRoot}/reuse-after-fail-committed.json`;
  const passCommand = 'node -e "process.exit(0)"';
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', passed, '--verify-command', passCommand]);
  run(repo, ['--action', 'verify', '--receipt', passed, '--out', failed, '--verify-command', 'node -e "process.exit(1)"'], 1);
  const result = run(repo, ['--action', 'verify', '--receipt', failed, '--out', reused, '--verify-command', passCommand]);
  const receipt = read(repo, reused);
  assert.equal(result.reused, true);
  assert.equal(receipt.state, 'VERIFIED');
  assert.equal(receipt.verification.at(-1).status, 'pass');
  assert.equal(receipt.warnings.includes('verification failed; commit is blocked'), false);
  run(repo, ['--action', 'commit', '--receipt', reused, '--out', committed, '--commit-message', 'feat: bind reused pass']);
  assert.equal(read(repo, committed).state, 'COMMITTED');
});

test('verification output request participates in cache reuse', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/cache-output-baseline.json`;
  const verified = `${receiptRoot}/cache-output-verified.json`;
  const withOutput = `${receiptRoot}/cache-output-result.json`;
  const output = `${receiptRoot}/logs/cache-output.log`;
  const command = 'node -e "console.log(\'verified\')"';
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', command]);
  const result = run(repo, ['--action', 'verify', '--receipt', verified, '--out', withOutput, '--verify-command', command, '--verify-output', output]);
  assert.notEqual(result.reused, true);
  assert.equal(existsSync(path.join(repo, output)), true);
  assert.equal(read(repo, withOutput).verification.at(-1).outputPath, output);
});

test('phase verification rejects an unexplained same-branch HEAD change', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/head-drift-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'early.txt'), 'early\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'early.txt']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'unexplained commit']);
  writeFileSync(path.join(repo, 'late.txt'), 'late\n', 'utf8');
  const result = run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/head-drift-verified.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.match(result.message, /HEAD changed after the receipt/u);
});

test('mode-only changes invalidate verification status and cache reuse', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/mode-baseline.json`;
  const verified = `${receiptRoot}/mode-verified.json`;
  const reverified = `${receiptRoot}/mode-reverified.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  execFileSync('git', ['-C', repo, 'update-index', '--add', '--chmod=+x', 'feature.txt']);
  const status = run(repo, ['--action', 'status', '--receipt', verified]);
  assert.equal(status.current.receiptCurrent, false);
  assert.match(status.warnings.join('\n'), /working tree changed after verification/u);
  const result = run(repo, ['--action', 'verify', '--receipt', verified, '--out', reverified, '--verify-command', 'node -e "process.exit(0)"']);
  assert.notEqual(result.reused, true);
  assert.equal(read(repo, reverified).verification.at(-1).treeModes['feature.txt'], '100755');
});

test('mode-only changes invalidate a baseline-dirty path', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\n', 'utf8');
  const baseline = `${receiptRoot}/dirty-mode-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  execFileSync('git', ['-C', repo, 'update-index', '--add', '--chmod=+x', 'notes.txt']);
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/dirty-mode-verify.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
});

test('verification output is either persisted or omitted from the receipt', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/output-baseline.json`;
  const verified = `${receiptRoot}/output-verified.json`;
  const output = `${receiptRoot}/logs/verification.log`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "console.log(\'verified\')"', '--verify-output', output]);
  assert.equal(existsSync(path.join(repo, output)), true);
  assert.equal(read(repo, verified).verification.at(-1).outputPath, output);
  assert.equal(read(repo, verified).verification.at(-1).outputHash, sha256File(path.join(repo, output)));
  writeFileSync(path.join(repo, output), 'tampered\n', 'utf8');
  const stale = run(repo, ['--action', 'status', '--receipt', verified]);
  assert.equal(stale.current.receiptCurrent, false);
  assert.match(stale.warnings.join('\n'), /verification output changed/u);
  const headBefore = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', `${receiptRoot}/output-commit.json`, '--commit-message', 'feat: reject stale bound output'], 2);
  assert.equal(execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), headBefore);
});

test('verification output bindings are symmetric and failed post-checks leave the path reusable', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/output-pair-baseline.json`;
  const verified = `${receiptRoot}/output-pair-verified.json`;
  const output = `${receiptRoot}/logs/retry.log`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  for (const [name, outputPath, outputHash] of [
    ['path-only', output, null],
    ['hash-only', null, 'a'.repeat(64)],
  ]) {
    const forged = read(repo, verified);
    forged.verification.at(-1).outputPath = outputPath;
    forged.verification.at(-1).outputHash = outputHash;
    const forgedPath = `${receiptRoot}/${name}.json`;
    json(repo, forgedPath, forged);
    run(repo, ['--action', 'status', '--receipt', forgedPath], 2);
  }

  const failed = `${receiptRoot}/output-post-check-failed.json`;
  const failure = run(repo, [
    '--action', 'verify', '--receipt', baseline, '--out', failed,
    '--verify-command', 'node -e "require(\'node:fs\').writeFileSync(\'security-generated.txt\',\'risk\');console.log(\'ran\')"',
    '--verify-output', output,
  ], 2);
  assert.match(failure.message, /strict risk/u);
  assert.equal(existsSync(path.join(repo, output)), false);
  rmSync(path.join(repo, 'security-generated.txt'), { force: true });
  const retried = `${receiptRoot}/output-post-check-retried.json`;
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', retried, '--verify-command', 'node -e "console.log(\'retried\')"', '--verify-output', output]);
  assert.equal(existsSync(path.join(repo, output)), true);
});

test('missing output from an old failed verification does not block a fresh verification', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/old-output-baseline.json`;
  const failed = `${receiptRoot}/old-output-failed.json`;
  const verified = `${receiptRoot}/old-output-verified.json`;
  const oldOutput = `${receiptRoot}/logs/old-failure.log`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', failed, '--verify-command', 'node -e "process.exit(1)"', '--verify-output', oldOutput], 1);
  rmSync(path.join(repo, oldOutput));
  run(repo, ['--action', 'verify', '--receipt', failed, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  assert.equal(read(repo, verified).state, 'VERIFIED');
});

test('fast mode is terminal after its verified commit', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/fast-terminal-baseline.json`;
  const verified = `${receiptRoot}/fast-terminal-verified.json`;
  const committed = `${receiptRoot}/fast-terminal-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'fast']);
  assertProgress(read(repo, baseline), 'Baseline', ['Plan'], 'complete Implement');
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  assertProgress(read(repo, verified), 'Verify', ['Plan', 'Baseline', 'Implement'], 'complete Commit');
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: fast change']);
  assertProgress(read(repo, committed), 'Commit', ['Plan', 'Baseline', 'Implement', 'Verify'], 'none');
  run(repo, ['--action', 'next', '--receipt', committed, '--out', `${receiptRoot}/fast-next.json`, '--next-phase', 'phase-2'], 2);
  const parent = read(repo, committed);
  json(repo, `${receiptRoot}/forged-fast-next.json`, {
    ...parent,
    state: 'NEXT_PHASE',
    successor: { target: 'phase-2', baseSha: parent.commit.sha, createdAt: new Date().toISOString() },
    previousReceiptPath: committed,
    previousReceiptHash: sha256File(path.join(repo, committed)),
    updatedAt: new Date().toISOString(),
  });
  run(repo, ['--action', 'status', '--receipt', `${receiptRoot}/forged-fast-next.json`], 2);
});

test('merge continuation requires PR_GREEN and a containing merge commit', (t) => {
  const phase = prepareCommitted(t, 'merge');
  const pr = `${receiptRoot}/pr.json`;
  const merged = `${receiptRoot}/merged.json`;
  const next = `${receiptRoot}/next.json`;
  run(phase.repo, ['--action', 'next', '--receipt', phase.committed, '--out', next, '--next-phase', 'phase-2'], 2);
  run(phase.repo, ['--action', 'pr-green', '--receipt', phase.committed, '--out', pr, '--pr-url', 'https://example.invalid/pr/1']);
  assertProgress(read(phase.repo, pr), 'Commit', ['Plan', 'Baseline', 'Implement', 'Verify'], 'record MERGED from the integration ref');
  const missingObject = 'f'.repeat(40);
  const forgedCommittedPath = `${receiptRoot}/missing-object-committed.json`;
  const forgedPrPath = `${receiptRoot}/missing-object-pr.json`;
  const forgedCommitted = read(phase.repo, phase.committed);
  forgedCommitted.headSha = missingObject;
  forgedCommitted.commit = { ...forgedCommitted.commit, sha: missingObject, headSha: missingObject };
  json(phase.repo, forgedCommittedPath, forgedCommitted);
  const forgedPr = read(phase.repo, pr);
  forgedPr.headSha = missingObject;
  forgedPr.commit = { ...forgedPr.commit, sha: missingObject, headSha: missingObject };
  forgedPr.pullRequest = { ...forgedPr.pullRequest, headSha: missingObject };
  forgedPr.previousReceiptPath = forgedCommittedPath;
  forgedPr.previousReceiptHash = sha256File(path.join(phase.repo, forgedCommittedPath));
  json(phase.repo, forgedPrPath, forgedPr);
  const missingObjectStatus = run(phase.repo, ['--action', 'status', '--receipt', forgedPrPath]);
  assert.equal(missingObjectStatus.current.receiptCurrent, false);
  assert.match(missingObjectStatus.warnings.join('\n'), /phase commit object/u);
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration-alias', phase.value.commit.sha]);
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', `${receiptRoot}/alias-merge.json`, '--merge-sha', phase.value.commit.sha, '--merge-ref', 'refs/heads/integration-alias'], 2);
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', `${receiptRoot}/head-merge.json`, '--merge-sha', phase.value.commit.sha, '--merge-ref', 'HEAD'], 2);
  execFileSync('git', ['-C', phase.repo, 'branch', 'side', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'side']);
  writeFileSync(path.join(phase.repo, 'side.txt'), 'side\n', 'utf8');
  execFileSync('git', ['-C', phase.repo, 'add', 'side.txt']);
  execFileSync('git', ['-C', phase.repo, 'commit', '-qm', 'side commit']);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', phase.value.baseline.branch]);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'reviewed first parent', 'side']);
  const firstParentMerge = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', phase.repo, 'branch', 'review-first-parent', firstParentMerge]);
  execFileSync('git', ['-C', phase.repo, 'update-ref', `refs/remotes/origin/${phase.value.baseline.branch}`, firstParentMerge]);
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', `${receiptRoot}/remote-phase-merge.json`, '--merge-sha', firstParentMerge, '--merge-ref', `refs/remotes/origin/${phase.value.baseline.branch}`], 2);
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', `${receiptRoot}/review-first-parent.json`, '--merge-sha', firstParentMerge, '--merge-ref', 'refs/heads/review-first-parent'], 2);
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'integration']);
  execFileSync('git', ['-C', phase.repo, 'branch', '-f', phase.value.baseline.branch, phase.value.commit.sha]);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'merge phase', phase.value.baseline.branch]);
  const mergeSha = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', merged, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/integration']);
  assertProgress(read(phase.repo, merged), 'Commit', ['Plan', 'Baseline', 'Implement', 'Verify'], 'record NEXT_PHASE');
  run(phase.repo, ['--action', 'next', '--receipt', merged, '--out', next, '--next-phase', 'phase-2']);
  assert.equal(read(phase.repo, next).successor.baseSha, mergeSha);
});

test('next rejects a MERGED receipt whose ref does not contain the reviewed commit', (t) => {
  const phase = prepareCommitted(t, 'merge');
  const pr = `${receiptRoot}/forged-next-pr.json`;
  const merged = `${receiptRoot}/forged-next-merged.json`;
  const next = `${receiptRoot}/forged-next.json`;
  run(phase.repo, ['--action', 'pr-green', '--receipt', phase.committed, '--out', pr, '--pr-url', 'https://example.invalid/pr/forged-next']);
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration-forged-next', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'integration-forged-next']);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'merge phase', phase.value.baseline.branch]);
  const mergeSha = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', merged, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/integration-forged-next']);
  const value = read(phase.repo, merged);
  value.headSha = phase.value.baseSha;
  value.merge.sha = phase.value.baseSha;
  value.merge.ref = 'refs/heads/integration-forged-next';
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', '-c', 'forged-holder']);
  execFileSync('git', ['-C', phase.repo, 'branch', '-f', 'integration-forged-next', phase.value.baseSha]);
  json(phase.repo, merged, value);
  const rejected = run(phase.repo, ['--action', 'next', '--receipt', merged, '--out', next, '--next-phase', 'phase-2'], 2);
  assert.match(rejected.message, /merge|integration|contain|phase commit|HEAD/u);
  assert.equal(existsSync(path.join(phase.repo, next)), false);
});

test('merge continuation ignores integration-only risk changes when closing the phase', (t) => {
  const phase = prepareCommitted(t, 'merge');
  const pr = `${receiptRoot}/integration-risk-pr.json`;
  const merged = `${receiptRoot}/integration-risk-merged.json`;
  const next = `${receiptRoot}/integration-risk-next.json`;
  run(phase.repo, ['--action', 'pr-green', '--receipt', phase.committed, '--out', pr, '--pr-url', 'https://example.invalid/pr/integration-risk']);
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration-risk', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'integration-risk']);
  mkdirSync(path.join(phase.repo, 'shared'), { recursive: true });
  writeFileSync(path.join(phase.repo, 'shared', 'contract.txt'), 'integration-only\n', 'utf8');
  writeFileSync(path.join(phase.repo, 'plan.md'), '# Integration plan update\n', 'utf8');
  execFileSync('git', ['-C', phase.repo, 'add', 'plan.md', 'shared/contract.txt']);
  execFileSync('git', ['-C', phase.repo, 'commit', '-qm', 'integration-only inputs and contract']);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'merge phase', phase.value.baseline.branch]);
  const mergeSha = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', merged, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/integration-risk']);
  const mergedStatus = run(phase.repo, ['--action', 'status', '--receipt', merged]);
  assert.equal(mergedStatus.current.receiptCurrent, true);
  assert.doesNotMatch(mergedStatus.warnings.join('\n'), /strict upgrade|plan changed/u);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', phase.value.baseline.branch]);
  assert.equal(run(phase.repo, ['--action', 'status', '--receipt', merged]).current.receiptCurrent, true);
  execFileSync('git', ['-C', phase.repo, 'branch', '-f', 'integration-risk', phase.value.baseSha]);
  assert.equal(run(phase.repo, ['--action', 'status', '--receipt', merged]).current.receiptCurrent, false);
  execFileSync('git', ['-C', phase.repo, 'branch', '-f', 'integration-risk', mergeSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'integration-risk']);
  run(phase.repo, ['--action', 'next', '--receipt', merged, '--out', next, '--next-phase', 'phase-2']);
  assert.equal(read(phase.repo, next).successor.baseSha, mergeSha);
  assert.equal(run(phase.repo, ['--action', 'status', '--receipt', next]).current.receiptCurrent, true);
});

test('merge uses the baseline integration ref allowlist after policy drift on the integration branch', (t) => {
  const phase = prepareCommitted(t, 'merge', { riskPolicy: { strictPaths: [], requirePullRequest: false, integrationRefs: ['refs/heads/integration-allowed'] } });
  const pr = `${receiptRoot}/policy-snapshot-pr.json`;
  const merged = `${receiptRoot}/policy-snapshot-merged.json`;
  run(phase.repo, ['--action', 'pr-green', '--receipt', phase.committed, '--out', pr, '--pr-url', 'https://example.invalid/pr/policy-snapshot']);
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration-allowed', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'integration-allowed']);
  json(phase.repo, 'risk.json', { strictPaths: [], requirePullRequest: false, integrationRefs: ['refs/heads/integration-denied'] });
  execFileSync('git', ['-C', phase.repo, 'add', 'risk.json']);
  execFileSync('git', ['-C', phase.repo, 'commit', '-qm', 'integration policy drift']);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'merge phase', phase.value.baseline.branch]);
  const mergeSha = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', phase.repo, 'branch', 'integration-denied', mergeSha]);
  const denied = run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', `${receiptRoot}/policy-snapshot-denied.json`, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/integration-denied'], 2);
  assert.match(denied.message, /not allowed by source risk policy/u);
  run(phase.repo, ['--action', 'merge', '--receipt', pr, '--out', merged, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/integration-allowed']);
  assert.equal(read(phase.repo, merged).state, 'MERGED');
});

test('merge continuation reaches PR_GREEN with preserved baseline dirt', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\n', 'utf8');
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/dirty-merge-baseline.json`;
  const verified = `${receiptRoot}/dirty-merge-verified.json`;
  const committed = `${receiptRoot}/dirty-merge-committed.json`;
  const pr = `${receiptRoot}/dirty-merge-pr.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--continuation', 'merge', '--plan', 'plan.md', '--scope', 'scope.json']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: preserve baseline dirt']);
  run(repo, ['--action', 'pr-green', '--receipt', committed, '--out', pr, '--pr-url', 'https://example.invalid/pr/dirty']);
  assert.equal(read(repo, pr).state, 'PR_GREEN');
  assert.equal(readFileSync(path.join(repo, 'notes.txt'), 'utf8'), 'pre-existing\n');
});

test('pause continuation seals a recoverable PAUSED receipt', (t) => {
  const phase = prepareCommitted(t, 'pause');
  const paused = `${receiptRoot}/paused.json`;
  const resumed = `${receiptRoot}/pause-resumed.json`;
  run(phase.repo, ['--action', 'next', '--receipt', phase.committed, '--out', paused]);
  assert.equal(read(phase.repo, paused).state, 'PAUSED');
  assertProgress(read(phase.repo, paused), 'Next', ['Plan', 'Baseline', 'Implement', 'Verify', 'Commit'], 'record NEXT_PHASE with resume after an explicit decision');
  writeFileSync(path.join(phase.repo, 'feature.txt'), 'paused residual\n', 'utf8');
  assert.equal(run(phase.repo, ['--action', 'status', '--receipt', paused]).current.receiptCurrent, false);
  run(phase.repo, ['--action', 'resume', '--receipt', paused, '--out', `${receiptRoot}/pause-residual.json`, '--next-phase', 'phase-2'], 2);
  execFileSync('git', ['-C', phase.repo, 'restore', '--', 'feature.txt']);
  run(phase.repo, ['--action', 'resume', '--receipt', paused, '--out', resumed, '--next-phase', 'phase-2']);
  assert.equal(read(phase.repo, resumed).state, 'NEXT_PHASE');
  assert.equal(read(phase.repo, resumed).successor.baseSha, phase.value.commit.sha);
});

test('protected scope and explicit strict mode latch STRICT_REQUIRED', (t) => {
  const repo = createRepo(t);
  const scope = 'scope.json';
  writeFileSync(path.join(repo, scope), `${JSON.stringify({ allowedPaths: ['src/protected/**'], protectedPaths: ['src/protected/**'], forbiddenWork: [], evidenceInputs: {} })}\n`, 'utf8');
  execFileSync('git', ['-C', repo, 'add', scope]);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'protected scope']);
  const protectedReceipt = `${receiptRoot}/protected.json`;
  const protectedResult = run(repo, ['--action', 'start', '--out', protectedReceipt, '--feature-id', 'feature', '--phase-id', 'phase-1', '--scope', scope]);
  assert.equal(protectedResult.state, 'STRICT_REQUIRED');
  assert.equal(protectedResult.strictHandoff.confirmation, '--confirm-continuation merge');
  assert.equal(read(repo, protectedReceipt).mode, 'strict');
  assertProgress(read(repo, protectedReceipt), 'Baseline', ['Plan'], 'use the strict checkpoint backend before editing');

  const strictReceipt = `${receiptRoot}/strict.json`;
  run(repo, ['--action', 'start', '--out', strictReceipt, '--feature-id', 'feature', '--phase-id', 'phase-2', '--mode', 'strict']);
  assert.equal(read(repo, strictReceipt).state, 'STRICT_REQUIRED');
  writeFileSync(path.join(repo, 'strict-boundary-drift.txt'), 'dirty\n', 'utf8');
  assert.equal(run(repo, ['--action', 'status', '--receipt', strictReceipt]).current.receiptCurrent, false);
});

test('repository-root pathspec preserves Git semantics for allowed, protected, and forbidden scope', (t) => {
  const setup = (scope, phaseId) => {
    const repo = createRepo(t);
    writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
    json(repo, 'scope.json', scope);
    execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'root scope']);
    const baseline = `${receiptRoot}/${phaseId}-baseline.json`;
    run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', phaseId, '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
    return { repo, baseline };
  };
  const allowed = setup({ allowedPaths: ['.'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} }, 'root-allowed');
  const allowedOut = `${receiptRoot}/root-allowed-preflight.json`;
  run(allowed.repo, ['--action', 'preflight', '--receipt', allowed.baseline, '--out', allowedOut, '--target-path', 'src/file.ts']);
  assert.deepEqual(read(allowed.repo, allowedOut).scopeExtensions, []);

  const protectedScope = setup({ allowedPaths: ['src/**'], protectedPaths: ['.'], forbiddenWork: [], evidenceInputs: {} }, 'root-protected');
  assert.equal(read(protectedScope.repo, protectedScope.baseline).state, 'STRICT_REQUIRED');

  const forbidden = setup({ allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: ['.'], evidenceInputs: {} }, 'root-forbidden');
  run(forbidden.repo, ['--action', 'preflight', '--receipt', forbidden.baseline, '--out', `${receiptRoot}/root-forbidden-preflight.json`, '--target-path', 'src/file.ts'], 2);
});

test('preflight upgrades an intended protected path before editing', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/preflight-baseline.json`;
  const strict = `${receiptRoot}/preflight-strict.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const result = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', strict, '--target-path', 'src/access.permissions.ts'], 2);
  assert.equal(result.code, 'strict_upgrade_required');
  assert.equal(existsSync(path.join(repo, 'src', 'access.permissions.ts')), false);
  assert.equal(read(repo, strict).state, 'STRICT_REQUIRED');
});

test('preflight records justified low-risk scope extensions while hard boundaries still block', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: ['src/security/**'], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  for (const [name, target] of [['parent', '../security/key.ts'], ['magic', ':(top)src/file.ts'], ['glob', 'src/*.ts']]) {
    const blocked = run(repo, ['--action', 'start', '--out', `${receiptRoot}/start-${name}.json`, '--feature-id', 'feature', '--phase-id', `start-${name}`, '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json', '--target-path', target], 2);
    assert.equal(blocked.code, 'governed_feature_phase_failed');
    assert.equal(existsSync(path.join(repo, `${receiptRoot}/start-${name}.json`)), false);
  }
  const started = `${receiptRoot}/start-extended.json`;
  run(repo, ['--action', 'start', '--out', started, '--feature-id', 'feature', '--phase-id', 'start-extended', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json', '--target-path', 'other/file.ts', '--scope-rationale', 'required by this phase acceptance; minimal local implementation']);
  assert.equal(read(repo, started).scopeExtensions[0].path, 'other/file.ts');
  const startForbidden = run(repo, ['--action', 'start', '--out', `${receiptRoot}/start-forbidden.json`, '--feature-id', 'feature', '--phase-id', 'start-forbidden', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json', '--target-path', 'src/security/key.ts', '--scope-rationale', 'required by this phase acceptance; minimal local implementation'], 2);
  assert.match(startForbidden.message, /forbidden phase work/u);
  const baseline = `${receiptRoot}/preflight-scope-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  const automatic = `${receiptRoot}/preflight-automatic.json`;
  const missingRationale = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', automatic, '--target-path', 'other/automatic.ts'], 2);
  assert.match(missingRationale.message, /scope-rationale.*required/u);
  assert.equal(existsSync(path.join(repo, automatic)), false);
  const placeholderRationale = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', `${receiptRoot}/preflight-placeholder.json`, '--target-path', 'other/automatic.ts', '--scope-rationale', 'todo'], 2);
  assert.match(placeholderRationale.message, /scope-rationale.*placeholder/u);
  const extended = `${receiptRoot}/preflight-scope-extended.json`;
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', extended, '--target-path', 'other/file.ts', '--scope-rationale', 'needed by the active phase; avoids a broader abstraction']);
  const extensionReceipt = read(repo, extended);
  assert.equal(extensionReceipt.state, 'IMPLEMENTING');
  assert.deepEqual(extensionReceipt.scopeExtensions.map((entry) => entry.path), ['other/file.ts']);
  const repeated = `${receiptRoot}/preflight-scope-repeated.json`;
  run(repo, ['--action', 'preflight', '--receipt', extended, '--out', repeated, '--target-path', 'other/file.ts']);
  assert.equal(read(repo, repeated).scopeExtensions.length, 1);
  const forbiddenOut = `${receiptRoot}/preflight-forbidden-blocked.json`;
  const forbidden = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', forbiddenOut, '--target-path', 'src/security/key.ts'], 2);
  assert.match(forbidden.message, /forbidden phase work/u);
  assert.equal(existsSync(path.join(repo, forbiddenOut)), false);
});

test('preflight uses directional path membership and records a necessary low-risk extension without pausing', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['docs/*.json'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/directional-baseline.json`;
  const extended = `${receiptRoot}/directional-extended.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  const result = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', extended, '--target-path', 'docs/readme.md', '--scope-rationale', 'required by the active acceptance criterion and limited to one phase-local document']);
  assert.equal(result.ok, true);
  assert.deepEqual(read(repo, extended).scopeExtensions.map((entry) => entry.path), ['docs/readme.md']);
});

test('equivalent target spellings resolve to one canonical exact extension', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/canonical-baseline.json`;
  const extended = `${receiptRoot}/canonical-extended.json`;
  const verified = `${receiptRoot}/canonical-verified.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', extended, '--target-path', './tools//helper.ts', '--scope-rationale', 'smallest phase-local helper required by the active acceptance criterion']);
  assert.deepEqual(read(repo, extended).scopeExtensions.map((entry) => entry.path), ['tools/helper.ts']);
  mkdirSync(path.join(repo, 'tools'), { recursive: true });
  writeFileSync(path.join(repo, 'tools', 'helper.ts'), 'export const helper = true;\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', extended, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  assert.deepEqual(read(repo, verified).scopeExtensions.map((entry) => entry.path), ['tools/helper.ts']);
});

test('target paths reject repository internals while product artifacts remain governed', (t) => {
  const repo = createRepo(t);
  for (const [name, target] of [['git', '.git/config'], ['nested-git', 'nested/.git/config'], ['ledger', `${receiptRoot}/forged.json`]]) {
    const result = run(repo, ['--action', 'start', '--out', `${receiptRoot}/reserved-${name}.json`, '--feature-id', 'feature', '--phase-id', name, '--target-path', target, '--scope-rationale', 'required by the active phase and restricted to one file'], 2);
    assert.match(result.message, /reserved repository-internal path/u);
  }

  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['.artifacts/product/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'product artifact inputs']);
  const baseline = `${receiptRoot}/product-artifact-baseline.json`;
  const verified = `${receiptRoot}/product-artifact-verified.json`;
  const committed = `${receiptRoot}/product-artifact-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'product-artifact', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  mkdirSync(path.join(repo, '.artifacts', 'product'), { recursive: true });
  writeFileSync(path.join(repo, '.artifacts', 'product', 'generated.txt'), 'product output\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: record product artifact']);
  assert.match(execFileSync('git', ['-C', repo, 'show', '--format=', '--name-only', 'HEAD'], { encoding: 'utf8' }), /\.artifacts\/product\/generated\.txt/u);
});

test('preflight rejects a target through a symlink or junction before editing', (t) => {
  const repo = createRepo(t);
  const outside = mkdtempSync(path.join(os.tmpdir(), 'gfd-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(repo, '.gitignore'), 'alias/\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.gitignore']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignore linked target']);
  try {
    symlinkSync(outside, path.join(repo, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    t.skip(`link creation is unavailable: ${error.code ?? error.message}`);
    return;
  }
  const baseline = `${receiptRoot}/link-baseline.json`;
  const blocked = `${receiptRoot}/link-blocked.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const result = run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', blocked, '--target-path', 'alias/output.txt'], 2);
  assert.match(result.message, /symbolic link or junction/u);
  assert.equal(existsSync(path.join(repo, blocked)), false);
});

test('lightweight baselines reject symlink and gitlink changes before hashing them as files', (t) => {
  const gitlinkRepo = createRepo(t);
  mkdirSync(path.join(gitlinkRepo, 'nested-repo'));
  const head = execFileSync('git', ['-C', gitlinkRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', gitlinkRepo, 'update-index', '--add', '--cacheinfo', `160000,${head},nested-repo`]);
  const gitlink = run(gitlinkRepo, ['--action', 'start', '--out', `${receiptRoot}/gitlink-baseline.json`, '--feature-id', 'feature', '--phase-id', 'gitlink'], 2);
  assert.match(gitlink.message, /lightweight delivery does not support symlink or gitlink changes; use strict mode/u);

  const symlinkRepo = createRepo(t);
  writeFileSync(path.join(symlinkRepo, 'target.txt'), 'target\n', 'utf8');
  try {
    symlinkSync('target.txt', path.join(symlinkRepo, 'link.txt'), 'file');
  } catch (error) {
    if (error.code === 'EPERM') return;
    throw error;
  }
  execFileSync('git', ['-C', symlinkRepo, 'add', 'link.txt']);
  const symlink = run(symlinkRepo, ['--action', 'start', '--out', `${receiptRoot}/symlink-baseline.json`, '--feature-id', 'feature', '--phase-id', 'symlink'], 2);
  assert.match(symlink.message, /lightweight delivery does not support symlink or gitlink changes; use strict mode/u);
});

test('later actions revalidate physical containment of persisted scope extensions', (t) => {
  const repo = createRepo(t);
  const outside = mkdtempSync(path.join(os.tmpdir(), 'gfd-late-link-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/late-link-baseline.json`;
  const extended = `${receiptRoot}/late-link-extended.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', extended, '--target-path', 'tools/helper.ts', '--scope-rationale', 'smallest phase-local helper needed by the active acceptance criterion']);
  try {
    symlinkSync(outside, path.join(repo, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    t.skip(`link creation is unavailable: ${error.code ?? error.message}`);
    return;
  }
  const result = run(repo, ['--action', 'status', '--receipt', extended], 2);
  assert.match(result.message, /symbolic link or junction/u);
});

test('verify incorporates a justified low-risk changed path and commit binds it', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/late-scope-baseline.json`;
  const verified = `${receiptRoot}/late-scope-verified.json`;
  const committed = `${receiptRoot}/late-scope-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  mkdirSync(path.join(repo, 'tools'), { recursive: true });
  writeFileSync(path.join(repo, 'tools', 'local-helper.ts'), 'export const helper = true;\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"', '--scope-rationale', 'smallest helper required by the phase verification']);
  const verifiedReceipt = read(repo, verified);
  assert.deepEqual(verifiedReceipt.scopeExtensions.map((entry) => entry.path), ['tools/local-helper.ts']);
  assert.equal(verifiedReceipt.verification.at(-1).inputHashes.scopeExtensionsHash.length, 64);
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: bind local helper']);
  assert.equal(read(repo, committed).commit.scopeExtensionsHash, verifiedReceipt.verification.at(-1).inputHashes.scopeExtensionsHash);
});

test('verification command output is classified and bound from the post-command tree', (t) => {
  const setup = (repo, protectedPaths = [], forbiddenWork = []) => {
    writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
    json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths, forbiddenWork, evidenceInputs: {} });
    execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
    const baseline = `${receiptRoot}/generated-baseline.json`;
    run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
    writeFileSync(path.join(repo, receiptRoot, 'generate.cjs'), "const fs=require('node:fs');fs.mkdirSync('generated',{recursive:true});fs.writeFileSync('generated/output.txt','ok');\n", 'utf8');
    return baseline;
  };
  const generate = `node ${receiptRoot}/generate.cjs`;

  const lowRiskRepo = createRepo(t);
  const lowRiskBaseline = setup(lowRiskRepo);
  const lowRiskVerified = `${receiptRoot}/generated-verified.json`;
  run(lowRiskRepo, ['--action', 'verify', '--receipt', lowRiskBaseline, '--out', lowRiskVerified, '--verify-command', generate, '--scope-rationale', 'verification output required by the active phase']);
  const generated = read(lowRiskRepo, lowRiskVerified);
  assert.deepEqual(generated.scopeExtensions.map((entry) => entry.path), ['generated/output.txt'], JSON.stringify({ exists: existsSync(path.join(lowRiskRepo, 'generated', 'output.txt')), changedPaths: generated.verification.at(-1).changedPaths, scopeExtensions: generated.scopeExtensions }));
  assert.equal(generated.verification.at(-1).blobHashes['generated/output.txt'].length, 40);
  const liveStatus = run(lowRiskRepo, ['--action', 'status', '--receipt', lowRiskVerified]);
  assert.equal(liveStatus.current.treeHash, generated.verification.at(-1).treeHash);

  const protectedRepo = createRepo(t);
  const protectedBaseline = setup(protectedRepo, ['generated/**']);
  const protectedResult = run(protectedRepo, ['--action', 'verify', '--receipt', protectedBaseline, '--out', `${receiptRoot}/generated-protected.json`, '--verify-command', generate], 2);
  assert.match(protectedResult.message, /protected path/u);

  const forbiddenRepo = createRepo(t);
  const forbiddenBaseline = setup(forbiddenRepo, [], ['generated/**']);
  const forbiddenResult = run(forbiddenRepo, ['--action', 'verify', '--receipt', forbiddenBaseline, '--out', `${receiptRoot}/generated-forbidden.json`, '--verify-command', generate], 2);
  assert.match(forbiddenResult.message, /forbidden phase work/u);
});

test('verification rejects newly generated ignored files under governed roots', (t) => {
  const setup = (repo) => {
    writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
    writeFileSync(path.join(repo, '.gitignore'), 'ignored-protected/\nignored-forbidden/\nignored-policy/\n', 'utf8');
    json(repo, 'scope.json', {
      allowedPaths: ['src/**'],
      protectedPaths: ['ignored-protected/**'],
      forbiddenWork: ['ignored-forbidden/**'],
      evidenceInputs: {},
    });
    json(repo, 'risk.json', { strictPaths: ['ignored-policy/**'], requirePullRequest: false, integrationRefs: [] });
    execFileSync('git', ['-C', repo, 'add', 'plan.md', '.gitignore', 'scope.json', 'risk.json']);
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'governed ignored inputs']);
    const baseline = `${receiptRoot}/ignored-baseline.json`;
    run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json', '--risk-policy', 'risk.json']);
    writeFileSync(path.join(repo, receiptRoot, 'generate-ignored.cjs'), "const fs=require('node:fs');const dir=process.argv[2];fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(`${dir}/output.txt`,'unsafe');\n", 'utf8');
    return baseline;
  };
  const generate = (directory) => `node ${receiptRoot}/generate-ignored.cjs ${directory}`;

  for (const [name, directory, expected] of [
    ['protected', 'ignored-protected', /ignored governed risk/u],
    ['forbidden', 'ignored-forbidden', /ignored governed forbidden/u],
    ['policy', 'ignored-policy', /ignored governed risk/u],
  ]) {
    const repo = createRepo(t);
    const baseline = setup(repo);
    const output = `${receiptRoot}/ignored-${name}.json`;
    const result = run(repo, ['--action', 'verify', '--receipt', baseline, '--out', output, '--verify-command', generate(directory)], 2);
    assert.match(result.message, expected);
    assert.equal(existsSync(path.join(repo, output)), false);
  }
});

test('ignored governed fingerprints cover builtin risk paths from baseline through commit', (t) => {
  const setup = (repo, suffix) => {
    writeFileSync(path.join(repo, '.gitignore'), '.github/\nsecurity/\n', 'utf8');
    writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
    json(repo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
    execFileSync('git', ['-C', repo, 'add', '.gitignore', 'plan.md', 'scope.json']);
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignored fingerprint inputs']);
    const baseline = `${receiptRoot}/${suffix}-baseline.json`;
    run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', suffix, '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
    assert.equal(read(repo, baseline).baseline.ignoredGoverned.hash.length, 64);
    return baseline;
  };

  const beforeVerifyRepo = createRepo(t);
  const beforeVerify = setup(beforeVerifyRepo, 'ignored-before-verify');
  mkdirSync(path.join(beforeVerifyRepo, '.github', 'workflows'), { recursive: true });
  writeFileSync(path.join(beforeVerifyRepo, '.github', 'workflows', 'ci.yml'), 'name: unsafe\n', 'utf8');
  const beforeResult = run(beforeVerifyRepo, ['--action', 'verify', '--receipt', beforeVerify, '--out', `${receiptRoot}/ignored-before-verify-result.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.match(beforeResult.message, /ignored governed risk/u);

  const manifestRepo = createRepo(t);
  writeFileSync(path.join(manifestRepo, '.gitignore'), 'requirements-dev.txt\n', 'utf8');
  writeFileSync(path.join(manifestRepo, 'plan.md'), '# Plan\n', 'utf8');
  json(manifestRepo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', manifestRepo, 'add', '.gitignore', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', manifestRepo, 'commit', '-qm', 'ignored manifest inputs']);
  const manifestBaseline = `${receiptRoot}/ignored-manifest-baseline.json`;
  run(manifestRepo, ['--action', 'start', '--out', manifestBaseline, '--feature-id', 'feature', '--phase-id', 'ignored-manifest', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  writeFileSync(path.join(manifestRepo, 'requirements-dev.txt'), 'unsafe dependency\n', 'utf8');
  const manifestResult = run(manifestRepo, ['--action', 'verify', '--receipt', manifestBaseline, '--out', `${receiptRoot}/ignored-manifest-result.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.match(manifestResult.message, /ignored governed risk/u);

  const afterVerifyRepo = createRepo(t);
  const afterVerify = setup(afterVerifyRepo, 'ignored-after-verify');
  writeFileSync(path.join(afterVerifyRepo, 'feature.txt'), 'implemented\n', 'utf8');
  const verified = `${receiptRoot}/ignored-after-verify-verified.json`;
  run(afterVerifyRepo, ['--action', 'verify', '--receipt', afterVerify, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  mkdirSync(path.join(afterVerifyRepo, 'security'), { recursive: true });
  writeFileSync(path.join(afterVerifyRepo, 'security', 'secret.txt'), 'unsafe\n', 'utf8');
  const commitResult = run(afterVerifyRepo, ['--action', 'commit', '--receipt', verified, '--out', `${receiptRoot}/ignored-after-verify-commit.json`, '--commit-message', 'feat: blocked commit'], 2);
  assert.match(commitResult.message, /ignored governed risk/u);
});

test('ignored governed baseline excludes installed dependency manifests', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n', 'utf8');
  mkdirSync(path.join(repo, 'node_modules', 'dependency'), { recursive: true });
  writeFileSync(path.join(repo, 'node_modules', 'dependency', 'package.json'), '{"name":"dependency"}\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.gitignore']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignore dependencies']);
  const baseline = `${receiptRoot}/dependency-exclusion-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'dependency-exclusion']);
  assert.equal(read(repo, baseline).baseline.ignoredGoverned.entries.some((entry) => entry.path.includes('node_modules/')), false);
});

test('ignored governed baseline excludes only canonical managed ledger paths', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, '.gitignore'), '.artifacts/\n', 'utf8');
  mkdirSync(path.join(repo, receiptRoot), { recursive: true });
  writeFileSync(path.join(repo, receiptRoot, 'security-receipt.json'), '{}\n', 'utf8');
  writeFileSync(path.join(repo, '.artifacts', 'security-input.json'), '{}\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.gitignore']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignore artifact outputs']);
  const baseline = `${receiptRoot}/managed-ledger-exclusion-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'managed-ledger-exclusion']);
  const paths = read(repo, baseline).baseline.ignoredGoverned.entries.map((entry) => entry.path);
  assert.equal(paths.includes(`${receiptRoot}/security-receipt.json`), false);
  assert.equal(paths.includes('.artifacts/security-input.json'), true);
});

test('ignored governed fingerprints detect modification, deletion, and stale cache reuse', (t) => {
  const setup = (repo, suffix) => {
    writeFileSync(path.join(repo, '.gitignore'), 'security/\n', 'utf8');
    mkdirSync(path.join(repo, 'security'), { recursive: true });
    writeFileSync(path.join(repo, 'security', 'existing.txt'), 'baseline\n', 'utf8');
    writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
    json(repo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
    execFileSync('git', ['-C', repo, 'add', '.gitignore', 'plan.md', 'scope.json']);
    execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignored fingerprint inputs']);
    const baseline = `${receiptRoot}/${suffix}-baseline.json`;
    run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', suffix, '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
    return baseline;
  };

  for (const [name, mutate] of [
    ['modified', (repo) => writeFileSync(path.join(repo, 'security', 'existing.txt'), 'changed\n', 'utf8')],
    ['deleted', (repo) => rmSync(path.join(repo, 'security', 'existing.txt'))],
  ]) {
    const repo = createRepo(t);
    const baseline = setup(repo, `ignored-${name}`);
    mutate(repo);
    const result = run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/ignored-${name}-result.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
    assert.match(result.message, /ignored governed risk/u);
  }

  const cacheRepo = createRepo(t);
  const cacheBaseline = setup(cacheRepo, 'ignored-cache');
  writeFileSync(path.join(cacheRepo, 'feature.txt'), 'implemented\n', 'utf8');
  const verified = `${receiptRoot}/ignored-cache-verified.json`;
  run(cacheRepo, ['--action', 'verify', '--receipt', cacheBaseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  writeFileSync(path.join(cacheRepo, 'security', 'existing.txt'), 'cache changed\n', 'utf8');
  const cached = run(cacheRepo, ['--action', 'verify', '--receipt', verified, '--out', `${receiptRoot}/ignored-cache-reused.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.match(cached.message, /ignored governed risk/u);
});

test('risk classifier catches protected filename suffixes and uncertain pathspec overlap', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'suffix-scope.json', { allowedPaths: ['src/user.permissions.ts'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  json(repo, 'glob-scope.json', { allowedPaths: ['src/file[0-9].txt'], protectedPaths: ['src/file?.txt'], forbiddenWork: [], evidenceInputs: {} });
  json(repo, 'sibling-scope.json', { allowedPaths: ['src/foobar'], protectedPaths: ['src/foo'], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'suffix-scope.json', 'glob-scope.json', 'sibling-scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'risk inputs']);
  const suffix = `${receiptRoot}/suffix-risk.json`;
  run(repo, ['--action', 'start', '--out', suffix, '--feature-id', 'feature', '--phase-id', 'phase-1', '--plan', 'plan.md', '--scope', 'suffix-scope.json']);
  assert.equal(read(repo, suffix).state, 'STRICT_REQUIRED');

  const glob = `${receiptRoot}/glob-risk.json`;
  run(repo, ['--action', 'start', '--out', glob, '--feature-id', 'feature', '--phase-id', 'phase-2', '--plan', 'plan.md', '--scope', 'glob-scope.json']);
  assert.equal(read(repo, glob).state, 'STRICT_REQUIRED');

  const sibling = `${receiptRoot}/sibling-risk.json`;
  run(repo, ['--action', 'start', '--out', sibling, '--feature-id', 'feature', '--phase-id', 'phase-3', '--plan', 'plan.md', '--scope', 'sibling-scope.json']);
  assert.equal(read(repo, sibling).state, 'BASELINE');

  for (const [name, target] of [
    ['authentication', 'src/authentication.ts'], ['auth-service', 'src/authService.ts'], ['security-policy', 'src/securityPolicy.ts'],
    ['permission-guard', 'src/permissionGuard.ts'], ['authorization-rules', 'src/authorizationRules.ts'], ['release-config', 'src/releaseConfig.ts'],
    ['shared-types', 'src/sharedTypes.ts'], ['python-package', 'pyproject.toml'], ['python-setup', 'setup.py'], ['python-requirements', 'requirements.txt'],
    ['rust-package', 'Cargo.toml'], ['maven-package', 'pom.xml'], ['gradle-package', 'build.gradle'],
    ['pnpm-lock', 'pnpm-lock.yaml'], ['changeset', '.changeset/config.json'],
  ]) {
    const output = `${receiptRoot}/${name}-risk.json`;
    run(repo, ['--action', 'start', '--out', output, '--feature-id', 'feature', '--phase-id', name, '--target-path', target]);
    assert.equal(read(repo, output).state, 'STRICT_REQUIRED', target);
  }
});

test('status rejects schema and lineage corruption and reports live drift', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/status-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const invalid = { ...read(repo, baseline), unexpected: true };
  json(repo, `${receiptRoot}/invalid-schema.json`, invalid);
  run(repo, ['--action', 'status', '--receipt', `${receiptRoot}/invalid-schema.json`], 2);

  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  const live = run(repo, ['--action', 'status', '--receipt', baseline]);
  assert.equal(live.current.receiptCurrent, false);
  assert.match(live.warnings.join('\n'), /working tree changed/u);

  const verified = `${receiptRoot}/status-verified.json`;
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const corruptLineage = { ...read(repo, verified), planHash: '0'.repeat(64) };
  json(repo, `${receiptRoot}/invalid-lineage.json`, corruptLineage);
  run(repo, ['--action', 'status', '--receipt', `${receiptRoot}/invalid-lineage.json`], 2);
});

test('receipt validation rejects future evidence and invalid state HEAD anchors', (t) => {
  const phase = prepareCommitted(t, 'merge');
  const prPath = `${receiptRoot}/invariant-pr.json`;
  const mergedPath = `${receiptRoot}/invariant-merged.json`;
  const nextPath = `${receiptRoot}/invariant-next.json`;
  run(phase.repo, ['--action', 'pr-green', '--receipt', phase.committed, '--out', prPath, '--pr-url', 'https://example.invalid/pr/invariants']);
  execFileSync('git', ['-C', phase.repo, 'branch', 'invariant-integration', phase.value.baseSha]);
  execFileSync('git', ['-C', phase.repo, 'switch', '-q', 'invariant-integration']);
  execFileSync('git', ['-C', phase.repo, 'merge', '--no-ff', '-qm', 'merge phase', phase.value.baseline.branch]);
  const mergeSha = execFileSync('git', ['-C', phase.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  run(phase.repo, ['--action', 'merge', '--receipt', prPath, '--out', mergedPath, '--merge-sha', mergeSha, '--merge-ref', 'refs/heads/invariant-integration']);
  run(phase.repo, ['--action', 'next', '--receipt', mergedPath, '--out', nextPath, '--next-phase', 'phase-2']);
  const committed = read(phase.repo, phase.committed);
  const pr = read(phase.repo, prPath);
  const merged = read(phase.repo, mergedPath);
  const next = read(phase.repo, nextPath);

  const pausedPhase = prepareCommitted(t, 'pause');
  const pausedPath = `${receiptRoot}/invariant-paused.json`;
  run(pausedPhase.repo, ['--action', 'next', '--receipt', pausedPhase.committed, '--out', pausedPath]);
  const paused = read(pausedPhase.repo, pausedPath);

  const phaseCases = [
    ['committed-pr', { ...committed, pullRequest: pr.pullRequest }],
    ['pr-merge', { ...pr, merge: merged.merge }],
    ['pr-successor', { ...pr, successor: next.successor }],
    ['merged-successor', { ...merged, successor: next.successor }],
    ['committed-head', { ...committed, headSha: committed.baseSha }],
    ['pr-head', { ...pr, headSha: pr.baseSha }],
    ['merged-head', { ...merged, headSha: merged.commit.sha }],
    ['next-head', { ...next, headSha: next.commit.sha }],
  ];
  for (const [name, value] of phaseCases) {
    const forged = `${receiptRoot}/invariant-${name}.json`;
    json(phase.repo, forged, value);
    run(phase.repo, ['--action', 'status', '--receipt', forged], 2);
  }
  for (const [name, value] of [
    ['paused-successor', { ...paused, successor: { target: 'phase-2', baseSha: paused.commit.sha, createdAt: new Date().toISOString() } }],
    ['paused-head', { ...paused, headSha: paused.baseSha }],
  ]) {
    const forged = `${receiptRoot}/invariant-${name}.json`;
    json(pausedPhase.repo, forged, value);
    run(pausedPhase.repo, ['--action', 'status', '--receipt', forged], 2);
  }
});

test('non-genesis phase receipts cannot truncate their lineage into an orphan root', (t) => {
  const phase = prepareCommitted(t, 'commit');
  const orphan = `${receiptRoot}/orphan-committed.json`;
  const next = `${receiptRoot}/orphan-next.json`;
  const value = read(phase.repo, phase.committed);
  value.previousReceiptPath = null;
  value.previousReceiptHash = null;
  json(phase.repo, orphan, value);
  run(phase.repo, ['--action', 'status', '--receipt', orphan], 2);
  run(phase.repo, ['--action', 'next', '--receipt', orphan, '--out', next, '--next-phase', 'phase-2'], 2);
  assert.equal(existsSync(path.join(phase.repo, next)), false);
});

test('receipt lineage has a bounded record budget', (t) => {
  const repo = createRepo(t);
  let previous = `${receiptRoot}/lineage-0.json`;
  run(repo, ['--action', 'start', '--out', previous, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  for (let index = 1; index <= 62; index += 1) {
    const parent = read(repo, previous);
    const next = `${receiptRoot}/lineage-${index}.json`;
    json(repo, next, {
      ...parent,
      state: 'IMPLEMENTING',
      previousReceiptPath: previous,
      previousReceiptHash: sha256File(path.join(repo, previous)),
      updatedAt: new Date().toISOString(),
    });
    previous = next;
  }
  const lastReadable = `${receiptRoot}/lineage-63.json`;
  run(repo, ['--action', 'preflight', '--receipt', previous, '--out', lastReadable, '--target-path', 'feature.txt']);
  const blocked = `${receiptRoot}/lineage-64.json`;
  run(repo, ['--action', 'preflight', '--receipt', lastReadable, '--out', blocked, '--target-path', 'feature.txt'], 2);
  assert.equal(existsSync(path.join(repo, blocked)), false);
});

test('commit rejects a forged VERIFIED receipt whose latest verification failed before changing HEAD', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/latest-fail-baseline.json`;
  const passed = `${receiptRoot}/latest-fail-passed.json`;
  const failed = `${receiptRoot}/latest-fail-failed.json`;
  const forged = `${receiptRoot}/latest-fail-forged.json`;
  const committed = `${receiptRoot}/latest-fail-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', passed, '--verify-command', 'node -e "process.exit(0)"']);
  run(repo, ['--action', 'verify', '--receipt', passed, '--out', failed, '--verify-command', 'node -e "process.exit(1)"'], 1);
  const forgedReceipt = read(repo, failed);
  forgedReceipt.state = 'VERIFIED';
  forgedReceipt.progress = read(repo, passed).progress;
  forgedReceipt.warnings = [];
  json(repo, forged, forgedReceipt);
  const headBefore = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  run(repo, ['--action', 'commit', '--receipt', forged, '--out', committed, '--commit-message', 'feat: must not commit failed evidence'], 2);
  assert.equal(execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), headBefore);
  assert.equal(existsSync(path.join(repo, committed)), false);
});

test('verification capacity is rejected before running the command', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/verification-capacity-baseline.json`;
  const passed = `${receiptRoot}/verification-capacity-passed.json`;
  const full = `${receiptRoot}/verification-capacity-full.json`;
  const output = `${receiptRoot}/verification-capacity-output.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', passed, '--verify-command', 'node -e "process.exit(0)"']);
  const fullReceipt = read(repo, passed);
  fullReceipt.state = 'IMPLEMENTING';
  fullReceipt.verification = Array.from({ length: 32 }, () => structuredClone(fullReceipt.verification[0]));
  json(repo, full, fullReceipt);
  run(repo, ['--action', 'verify', '--receipt', full, '--out', output, '--verify-command', 'node -e "require(\'node:fs\').writeFileSync(\'capacity-marker.txt\', \'ran\')"'], 2);
  assert.equal(existsSync(path.join(repo, 'capacity-marker.txt')), false);
  assert.equal(existsSync(path.join(repo, output)), false);
});

test('verification reserves receipt byte capacity before running the command', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/verification-bytes-baseline.json`;
  const nearCap = `${receiptRoot}/verification-bytes-near-cap.json`;
  const output = `${receiptRoot}/verification-bytes-output.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  const value = read(repo, baseline);
  const targetBytes = MAX_JSON_BYTES - (128 * 1024);
  let low = 0;
  let high = Math.floor(MAX_JSON_BYTES / 2);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    value.warnings = ['x'.repeat(middle)];
    value.progress.warnings = value.warnings;
    const bytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (bytes <= targetBytes) low = middle;
    else high = middle - 1;
  }
  value.warnings = ['x'.repeat(low)];
  value.progress.warnings = value.warnings;
  json(repo, nearCap, value);
  run(repo, ['--action', 'verify', '--receipt', nearCap, '--out', output, '--verify-command', 'node -e "require(\'node:fs\').writeFileSync(\'byte-capacity-marker.txt\',\'ran\')"'], 2);
  assert.equal(existsSync(path.join(repo, 'byte-capacity-marker.txt')), false);
  assert.equal(existsSync(path.join(repo, output)), false);
});

test('verification capacity includes the known evidence record before running the command', { timeout: 45_000 }, (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/known-record-baseline.json`;
  const nearCap = `${receiptRoot}/known-record-near-cap.json`;
  const output = `${receiptRoot}/known-record-output.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (let index = 0; index < 100; index += 1) {
    const name = `part-${String(index).padStart(3, '0')}-${'x'.repeat(80)}.txt`;
    writeFileSync(path.join(repo, 'src', name), `implemented ${index}\n`, 'utf8');
  }
  const value = read(repo, baseline);
  const targetBytes = MAX_JSON_BYTES - (128 * 1024) - 4096;
  let low = 0;
  let high = Math.floor(MAX_JSON_BYTES / 2);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    value.warnings = ['x'.repeat(middle)];
    value.progress.warnings = value.warnings;
    const bytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (bytes <= targetBytes) low = middle;
    else high = middle - 1;
  }
  value.warnings = ['x'.repeat(low)];
  value.progress.warnings = value.warnings;
  json(repo, nearCap, value);
  const result = spawnSync(process.execPath, [script, '--repo', repo, '--action', 'verify', '--receipt', nearCap, '--out', output, '--verify-command', 'node -e "require(\'node:fs\').writeFileSync(\'known-record-marker.txt\', \'ran\')"'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.status, 2);
  assert.equal(existsSync(path.join(repo, 'known-record-marker.txt')), false);
  assert.equal(existsSync(path.join(repo, output)), false);
});

test('verification snapshots one hundred changed files within the orchestration budget', { timeout: 40_000 }, (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/snapshot-baseline.json`;
  const verified = `${receiptRoot}/snapshot-verified.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (let index = 0; index < 100; index += 1) {
    writeFileSync(path.join(repo, 'src', `file-${String(index).padStart(3, '0')}.txt`), `implemented ${index}\n`, 'utf8');
  }
  const result = spawnSync(process.execPath, [script, '--repo', repo, '--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(repo, verified).verification.at(-1).changedPaths.length, 100);
});

test('lineage capacity is rejected before commit changes HEAD', (t) => {
  const repo = createRepo(t);
  let previous = `${receiptRoot}/commit-lineage-0.json`;
  run(repo, ['--action', 'start', '--out', previous, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  for (let index = 1; index <= 62; index += 1) {
    const parent = read(repo, previous);
    const next = `${receiptRoot}/commit-lineage-${index}.json`;
    json(repo, next, {
      ...parent,
      state: 'IMPLEMENTING',
      previousReceiptPath: previous,
      previousReceiptHash: sha256File(path.join(repo, previous)),
      updatedAt: new Date().toISOString(),
    });
    previous = next;
  }
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  const verified = `${receiptRoot}/commit-lineage-verified.json`;
  run(repo, ['--action', 'verify', '--receipt', previous, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const headBefore = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const committed = `${receiptRoot}/commit-lineage-committed.json`;
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: must respect lineage capacity'], 2);
  assert.equal(execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), headBefore);
  assert.equal(existsSync(path.join(repo, committed)), false);
});

test('strict upgrade requires a clean handoff boundary', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'notes.txt'), 'dirty\n', 'utf8');
  const direct = `${receiptRoot}/dirty-strict.json`;
  run(repo, ['--action', 'start', '--out', direct, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'strict'], 2);
  assert.equal(existsSync(path.join(repo, direct)), false);

  const baseline = `${receiptRoot}/dirty-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-2']);
  const upgraded = `${receiptRoot}/dirty-upgrade.json`;
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', upgraded, '--target-path', 'src/access.permissions.ts'], 2);
  assert.equal(existsSync(path.join(repo, upgraded)), false);
});

test('phase inputs and branch stay bound to the baseline', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/bound-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  writeFileSync(path.join(repo, 'plan.md'), '# Changed plan\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/plan-drift.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['other/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/scope-drift.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'switch', '-qc', 'other-branch']);
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/branch-drift.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
});

test('risk policy drift requires a new baseline', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  json(repo, 'risk.json', { strictPaths: [], requirePullRequest: false, integrationRefs: [] });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json', 'risk.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase policy']);
  const baseline = `${receiptRoot}/policy-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json', '--risk-policy', 'risk.json']);
  json(repo, 'risk.json', { strictPaths: [], requirePullRequest: true, integrationRefs: [] });
  const status = run(repo, ['--action', 'status', '--receipt', baseline]);
  assert.equal(status.current.receiptCurrent, false);
  assert.match(status.warnings.join('\n'), /live risk requires strict upgrade: repository requires PR and merge/u);
  assert.doesNotMatch(status.warnings.join('\n'), /live risk could not be classified: live risk requires strict upgrade/u);
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/policy-drift.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.equal(existsSync(path.join(repo, `${receiptRoot}/policy-drift.json`)), false);
});

test('protected work discovered after editing requires a new clean strict boundary', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/mid-risk-baseline.json`;
  const strict = `${receiptRoot}/mid-risk-strict.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  mkdirSync(path.join(repo, 'src'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'access.permissions.ts'), 'export const allowed = true;\n', 'utf8');
  const result = run(repo, ['--action', 'verify', '--receipt', baseline, '--out', strict, '--verify-command', 'node -e "process.exit(0)"'], 2);
  assert.equal(result.code, 'governed_feature_phase_failed');
  assert.match(result.message, /strict upgrade requires the clean phase baseline/u);
  assert.equal(existsSync(path.join(repo, strict)), false);
});

test('commit recovery completes a receipt after a post-commit ledger failure', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/recovery-baseline.json`;
  const verified = `${receiptRoot}/recovery-verified.json`;
  const blocked = `${receiptRoot}/blocked-commit.json`;
  const recovered = `${receiptRoot}/recovered-commit.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const hook = path.join(repo, '.git', 'hooks', 'post-commit');
  writeFileSync(hook, `#!/bin/sh\nmkdir -p ${blocked}\n`, 'utf8');
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', blocked, '--commit-message', 'feat: recover boundary'], 2);
  const pending = path.join(repo, `${verified}.commit-pending.json`);
  assert.equal(existsSync(pending), true);
  rmSync(path.join(repo, blocked), { recursive: true, force: true });
  const result = run(repo, ['--action', 'commit', '--receipt', verified, '--out', recovered, '--commit-message', 'feat: recover boundary']);
  assert.equal(result.recovered, true);
  assert.equal(existsSync(pending), false);
});

test('commit recovery rejects an intent missing current verification tree modes', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/recovery-mode-baseline.json`;
  const verified = `${receiptRoot}/recovery-mode-verified.json`;
  const blocked = `${receiptRoot}/recovery-mode-blocked.json`;
  const recovered = `${receiptRoot}/recovery-mode-recovered.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  writeFileSync(path.join(repo, '.git', 'hooks', 'post-commit'), `#!/bin/sh\nmkdir -p ${blocked}\n`, 'utf8');
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', blocked, '--commit-message', 'feat: bind recovered modes'], 2);
  const pendingPath = `${verified}.commit-pending.json`;
  const pending = read(repo, pendingPath);
  delete pending.treeModes;
  json(repo, pendingPath, pending);
  rmSync(path.join(repo, blocked), { recursive: true, force: true });
  const result = run(repo, ['--action', 'commit', '--receipt', verified, '--out', recovered, '--commit-message', 'feat: bind recovered modes'], 2);
  assert.match(result.message, /pending commit recovery does not match current verification/u);
  assert.equal(existsSync(path.join(repo, recovered)), false);
});

test('commit resumes a matching intent written before git commit', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/precommit-baseline.json`;
  const verified = `${receiptRoot}/precommit-verified.json`;
  const committed = `${receiptRoot}/precommit-committed.json`;
  const message = 'feat: resume precommit intent';
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  const receipt = read(repo, verified);
  const head = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  const branch = execFileSync('git', ['-C', repo, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  json(repo, `${verified}.commit-pending.json`, {
    schemaVersion: 'GovernedFeatureDeliveryCommitIntent/v1',
    parentReceiptHash: sha256File(path.join(repo, verified)),
    previousHead: head,
    branch,
    messageHash: createHash('sha256').update(message).digest('hex'),
    phaseChanges: ['feature.txt'],
    blobHashes: receipt.verification.at(-1).blobHashes,
    treeModes: receipt.verification.at(-1).treeModes,
    createdAt: new Date().toISOString(),
  });
  const result = run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', message]);
  assert.equal(result.state, 'COMMITTED');
  assert.equal(existsSync(path.join(repo, `${verified}.commit-pending.json`)), false);
});

test('commit refuses hook-mutated content that was not verified', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/hook-baseline.json`;
  const verified = `${receiptRoot}/hook-verified.json`;
  const committed = `${receiptRoot}/hook-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'verified-content\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  writeFileSync(path.join(repo, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nprintf "hook-mutated\\n" > feature.txt\ngit add feature.txt\n', 'utf8');
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: reject hook mutation'], 2);
  assert.equal(existsSync(path.join(repo, committed)), false);
  assert.equal(execFileSync('git', ['-C', repo, 'show', 'HEAD:feature.txt'], { encoding: 'utf8' }), 'hook-mutated\n');
});

test('commit and recovery reject ignored governed side effects left by hooks', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, '.gitignore'), 'security/\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.gitignore']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'ignore security outputs']);
  const baseline = `${receiptRoot}/hook-ignored-baseline.json`;
  const verified = `${receiptRoot}/hook-ignored-verified.json`;
  const committed = `${receiptRoot}/hook-ignored-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'verified-content\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  writeFileSync(path.join(repo, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nmkdir -p security\nprintf "unsafe\\n" > security/runtime.txt\n', 'utf8');
  const blocked = run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: reject ignored hook output'], 2);
  assert.match(blocked.message, /ignored governed risk/u);
  assert.equal(existsSync(path.join(repo, committed)), false);
  assert.equal(existsSync(path.join(repo, `${verified}.commit-pending.json`)), true);
  const stillBlocked = run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: reject ignored hook output'], 2);
  assert.match(stillBlocked.message, /ignored governed risk/u);
  rmSync(path.join(repo, 'security'), { recursive: true, force: true });
  const recovered = run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: reject ignored hook output']);
  assert.equal(recovered.recovered, true);
});

test('removing a baseline-dirty path invalidates the phase baseline', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/removed-dirt-baseline.json`;
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\n', 'utf8');
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  rmSync(path.join(repo, 'notes.txt'));
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/removed-dirt-verified.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
});

test('phase commit excludes unchanged baseline-dirty files', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'notes.txt'), 'pre-existing\n', 'utf8');
  const baseline = `${receiptRoot}/dirty-commit-baseline.json`;
  const verified = `${receiptRoot}/dirty-commit-verified.json`;
  const committed = `${receiptRoot}/dirty-commit.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: exclude baseline dirt']);
  const committedPaths = execFileSync('git', ['-C', repo, 'show', '--format=', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/u).filter(Boolean);
  assert.deepEqual(committedPaths, ['feature.txt']);
  assert.match(execFileSync('git', ['-C', repo, 'status', '--porcelain=v1'], { encoding: 'utf8' }), /notes\.txt/u);
  writeFileSync(path.join(repo, 'residual.txt'), 'residual\n', 'utf8');
  run(repo, ['--action', 'next', '--receipt', committed, '--out', `${receiptRoot}/dirty-residual-next.json`, '--next-phase', 'phase-2'], 2);
});

test('commit treats discovered changed paths as literal filenames', (t) => {
  const repo = createRepo(t);
  const baseline = `${receiptRoot}/literal-baseline.json`;
  const verified = `${receiptRoot}/literal-verified.json`;
  const committed = `${receiptRoot}/literal-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1']);
  writeFileSync(path.join(repo, '[ab].txt'), 'literal path\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  run(repo, ['--action', 'commit', '--receipt', verified, '--out', committed, '--commit-message', 'feat: literal path']);
  assert.deepEqual(execFileSync('git', ['-C', repo, 'show', '--format=', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/u).filter(Boolean), ['[ab].txt']);
});

test('phase scope extensions treat bracketed filenames as concrete paths', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/bracket-baseline.json`;
  const preflight = `${receiptRoot}/bracket-preflight.json`;
  const verified = `${receiptRoot}/bracket-verified.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', preflight, '--target-path', '[ab].txt', '--scope-rationale', 'the bracketed phase-local fixture is the smallest acceptance input']);
  writeFileSync(path.join(repo, '[ab].txt'), 'literal path\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', preflight, '--out', verified, '--verify-command', 'node -e "process.exit(0)"']);
  assert.deepEqual(read(repo, verified).scopeExtensions.map((entry) => entry.path), ['[ab].txt']);
});

test('strict upgrade can be consumed by the unified entrypoint', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'design.md'), '# Design\n', 'utf8');
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  writeFileSync(path.join(repo, '.gitignore'), 'security/\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: { 'acceptance-red': ['design.md'], 'implementation-green': ['design.md'], 'stop-gate': ['design.md'] } });
  const successor = { allowedCodes: { next: 'phase-2' } };
  json(repo, 'successor.json', successor);
  json(repo, 'authority.json', { designFreeze: ['owner'], recovery: ['owner'], scopeDelta: ['owner'], review: ['owner'], successor: ['owner'], release: ['owner'] });
  json(repo, 'freeze.json', { authority: 'owner', frozenAt: new Date().toISOString(), specHash: sha256File(path.join(repo, 'design.md')), successorPolicyHash: policyHash(successor) });
  execFileSync('git', ['-C', repo, 'add', '.gitignore', 'design.md', 'plan.md', 'scope.json', 'successor.json', 'authority.json', 'freeze.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'strict inputs']);
  const baseline = `${receiptRoot}/strict-baseline.json`;
  const strictRequired = `${receiptRoot}/strict-required.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--continuation', 'merge', '--plan', 'plan.md', '--scope', 'scope.json']);
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', strictRequired, '--target-path', 'src/access.permissions.ts'], 2);
  writeFileSync(path.join(repo, 'plan.md'), '# Drifted plan\n', 'utf8');
  run(repo, ['--action', 'strict-init', '--receipt', strictRequired, '--out', `${receiptRoot}/drifted-strict-v1.json`, '--spec', 'design.md', '--freeze-receipt', 'freeze.json', '--plan', 'plan.md', '--scope', 'scope.json', '--successor-policy', 'successor.json', '--authority-policy', 'authority.json'], 2);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  const strict = `${receiptRoot}/strict-v1.json`;
  const result = run(repo, ['--action', 'strict-init', '--receipt', strictRequired, '--out', strict, '--spec', 'design.md', '--freeze-receipt', 'freeze.json', '--plan', 'plan.md', '--scope', 'scope.json', '--successor-policy', 'successor.json', '--authority-policy', 'authority.json']);
  assert.equal(result.mode, 'strict');
  const checkpoint = read(repo, strict);
  assert.equal(checkpoint.schemaVersion, 'GovernedFeatureDeliveryCheckpoint/v1');
  assert.equal(checkpoint.state, 'PHASE_PLANNED');
  assert.equal(checkpoint.sourcePhaseReceipt.receiptHash, sha256File(path.join(repo, strictRequired)));
  assert.equal(result.progress.stage, 'Baseline');
  const strictStatus = run(repo, ['--action', 'status', '--receipt', strict]);
  assert.ok(strictStatus.lineage.records > 1);
  assert.ok(strictStatus.lineage.bytes > Buffer.byteLength(readFileSync(path.join(repo, strict))));
  writeFileSync(path.join(repo, `${receiptRoot}/strict-red.log`), 'red receipt\n', 'utf8');
  runTool(recordGate, repo, ['--checkpoint', strict, '--out', `${receiptRoot}/strict-red.json`, '--id', 'strict-red', '--kind', 'acceptance-red', '--status', 'confirmed', '--command', 'node -e "process.exit(1)"', '--receipt', `${receiptRoot}/strict-red.log`]);

  const changedBaseline = read(repo, baseline);
  changedBaseline.updatedAt = new Date(Date.now() + 1000).toISOString();
  json(repo, baseline, changedBaseline);
  run(repo, ['--action', 'status', '--receipt', strict], 2);
});

test('strict bridge requires an authorized delta for prior lightweight extensions before RED', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'design.md'), '# Design\n', 'utf8');
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  writeFileSync(path.join(repo, '.gitignore'), 'security/\n', 'utf8');
  const originalScope = {
    allowedPaths: ['src/**'],
    protectedPaths: [],
    forbiddenWork: [],
    evidenceInputs: { 'acceptance-red': ['design.md'], 'implementation-green': ['design.md'], 'stop-gate': ['design.md'] },
  };
  json(repo, 'scope.json', originalScope);
  const successor = { allowedCodes: { next: 'phase-2' } };
  json(repo, 'successor.json', successor);
  json(repo, 'authority.json', { designFreeze: ['owner'], recovery: ['owner'], scopeDelta: ['owner'], review: ['owner'], successor: ['owner'], release: ['owner'] });
  json(repo, 'freeze.json', { authority: 'owner', frozenAt: new Date().toISOString(), specHash: sha256File(path.join(repo, 'design.md')), successorPolicyHash: policyHash(successor) });
  execFileSync('git', ['-C', repo, 'add', '.gitignore', 'design.md', 'plan.md', 'scope.json', 'successor.json', 'authority.json', 'freeze.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'strict bridge inputs']);
  const baseline = `${receiptRoot}/bridge-baseline.json`;
  const extended = `${receiptRoot}/bridge-extended.json`;
  const strictRequired = `${receiptRoot}/bridge-strict-required.json`;
  const strict = `${receiptRoot}/bridge-strict-v1.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--continuation', 'merge', '--plan', 'plan.md', '--scope', 'scope.json']);
  run(repo, ['--action', 'preflight', '--receipt', baseline, '--out', extended, '--target-path', 'tools/helper.ts', '--scope-rationale', 'smallest phase-local helper needed by the active acceptance criteria']);
  run(repo, ['--action', 'preflight', '--receipt', extended, '--out', strictRequired, '--target-path', 'src/access.permissions.ts'], 2);
  run(repo, ['--action', 'strict-init', '--receipt', strictRequired, '--out', strict, '--spec', 'design.md', '--freeze-receipt', 'freeze.json', '--plan', 'plan.md', '--scope', 'scope.json', '--successor-policy', 'successor.json', '--authority-policy', 'authority.json']);

  writeFileSync(path.join(repo, `${receiptRoot}/bridge-red.log`), 'red receipt\n', 'utf8');
  const redEvidence = `${receiptRoot}/bridge-red.json`;
  runTool(recordGate, repo, ['--checkpoint', strict, '--out', redEvidence, '--id', 'bridge-red', '--kind', 'acceptance-red', '--status', 'confirmed', '--command', 'node -e "process.exit(1)"', '--receipt', `${receiptRoot}/bridge-red.log`]);
  const blockedRed = `${receiptRoot}/bridge-red-blocked.json`;
  const blocked = runTool(advanceStrict, repo, ['--checkpoint', strict, '--out', blockedRed, '--to-state', 'RED_CONFIRMED', '--evidence', redEvidence], 2);
  assert.match(blocked.message, /source phase scope extensions require an approved strict scope delta/u);
  assert.equal(existsSync(path.join(repo, blockedRed)), false);

  const descendantScope = { ...originalScope, allowedPaths: [...originalScope.allowedPaths, 'tools/helper.ts/child.ts'] };
  const descendantScopePath = `${receiptRoot}/bridge-scope-descendant.json`;
  json(repo, descendantScopePath, descendantScope);
  const descendantDelta = `${receiptRoot}/bridge-scope-descendant-delta.json`;
  json(repo, descendantDelta, {
    id: 'bridge-descendant-delta',
    decision: 'approved',
    authority: 'owner',
    decidedAt: new Date().toISOString(),
    beforeScopeHash: scopeHash(originalScope),
    afterScopeHash: scopeHash(descendantScope),
    phasePlanHash: sha256File(path.join(repo, 'plan.md')),
  });
  const descendant = `${receiptRoot}/bridge-descendant.json`;
  runTool(applyScopeDelta, repo, ['--checkpoint', strict, '--out', descendant, '--scope', descendantScopePath, '--plan', 'plan.md', '--delta', descendantDelta]);
  const descendantEvidence = `${receiptRoot}/bridge-descendant-red.json`;
  runTool(recordGate, repo, ['--checkpoint', descendant, '--out', descendantEvidence, '--id', 'bridge-descendant-red', '--kind', 'acceptance-red', '--status', 'confirmed', '--command', 'node -e "process.exit(1)"', '--receipt', `${receiptRoot}/bridge-red.log`]);
  const descendantBlocked = runTool(advanceStrict, repo, ['--checkpoint', descendant, '--out', `${receiptRoot}/bridge-descendant-blocked.json`, '--to-state', 'RED_CONFIRMED', '--evidence', descendantEvidence], 2);
  assert.match(descendantBlocked.message, /source phase scope extensions require an approved strict scope delta/u);

  const expandedScope = { ...originalScope, allowedPaths: [...originalScope.allowedPaths, 'tools/helper.ts'] };
  const expandedScopePath = `${receiptRoot}/bridge-scope-expanded.json`;
  json(repo, expandedScopePath, expandedScope);
  const delta = `${receiptRoot}/bridge-scope-delta.json`;
  json(repo, delta, {
    id: 'bridge-extension-delta',
    decision: 'approved',
    authority: 'owner',
    decidedAt: new Date().toISOString(),
    beforeScopeHash: scopeHash(originalScope),
    afterScopeHash: scopeHash(expandedScope),
    phasePlanHash: sha256File(path.join(repo, 'plan.md')),
  });
  const expanded = `${receiptRoot}/bridge-expanded.json`;
  runTool(applyScopeDelta, repo, ['--checkpoint', strict, '--out', expanded, '--scope', expandedScopePath, '--plan', 'plan.md', '--delta', delta]);
  const expandedEvidence = `${receiptRoot}/bridge-expanded-red.json`;
  runTool(recordGate, repo, ['--checkpoint', expanded, '--out', expandedEvidence, '--id', 'bridge-expanded-red', '--kind', 'acceptance-red', '--status', 'confirmed', '--command', 'node -e "process.exit(1)"', '--receipt', `${receiptRoot}/bridge-red.log`]);
  const red = `${receiptRoot}/bridge-red-confirmed.json`;
  runTool(advanceStrict, repo, ['--checkpoint', expanded, '--out', red, '--to-state', 'RED_CONFIRMED', '--evidence', expandedEvidence]);
  assert.equal(read(repo, red).state, 'RED_CONFIRMED');

  mkdirSync(path.join(repo, 'security'), { recursive: true });
  writeFileSync(path.join(repo, 'security', 'override.txt'), 'unsafe\n', 'utf8');
  const staleStatus = run(repo, ['--action', 'status', '--receipt', red]);
  assert.equal(staleStatus.current.receiptCurrent, false);
  assert.match(staleStatus.warnings.join('\n'), /ignored governed risk/u);
  const ignoredStrict = runTool(validateStrict, repo, ['--checkpoint', red], 2);
  assert.match(ignoredStrict.issues.join('\n'), /ignored governed risk/u);
  rmSync(path.join(repo, 'security'), { recursive: true, force: true });

  const outside = mkdtempSync(path.join(os.tmpdir(), 'gfd-strict-late-link-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  try {
    symlinkSync(outside, path.join(repo, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return;
    throw error;
  }
  const staleStrict = runTool(validateStrict, repo, ['--checkpoint', red], 2);
  assert.match(staleStrict.issues.join('\n'), /sourcePhaseReceipt artifact binding is invalid/u);
});

test('phase scope rejects forbidden work and extends the deletion side of a rename', (t) => {
  const repo = createRepo(t);
  mkdirSync(path.join(repo, 'outside'), { recursive: true });
  writeFileSync(path.join(repo, 'outside', 'tracked.txt'), 'tracked\n', 'utf8');
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  writeFileSync(path.join(repo, 'scope.json'), `${JSON.stringify({ allowedPaths: ['allowed/**', 'src/**'], protectedPaths: [], forbiddenWork: ['src/later/**'], evidenceInputs: {} })}\n`, 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'phase inputs']);
  const baseline = `${receiptRoot}/scope-baseline.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--plan', 'plan.md', '--scope', 'scope.json']);
  mkdirSync(path.join(repo, 'src', 'later'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'later', 'blocked.txt'), 'blocked\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', `${receiptRoot}/forbidden.json`, '--verify-command', 'node -e "process.exit(0)"'], 2);
  rmSync(path.join(repo, 'src'), { recursive: true, force: true });
  mkdirSync(path.join(repo, 'allowed'), { recursive: true });
  execFileSync('git', ['-C', repo, 'mv', 'outside/tracked.txt', 'allowed/moved.txt']);
  const renamed = `${receiptRoot}/rename.json`;
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', renamed, '--verify-command', 'node -e "process.exit(0)"', '--scope-rationale', 'moving the phase-owned file requires removing its former exact path']);
  const receipt = read(repo, renamed);
  assert.deepEqual(receipt.scopeExtensions.map((entry) => entry.path), ['outside/tracked.txt']);
  assert.deepEqual(receipt.verification.at(-1).changedPaths, ['allowed/moved.txt', 'outside/tracked.txt']);
  assert.equal(receipt.verification.at(-1).blobHashes['outside/tracked.txt'], null);
  assert.equal(receipt.verification.at(-1).treeModes['outside/tracked.txt'], null);
});

test('legacy v2 without ignored baseline remains readable but requires a new baseline for mutations', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['feature.txt'], protectedPaths: [], forbiddenWork: [], evidenceInputs: {} });
  execFileSync('git', ['-C', repo, 'add', 'plan.md', 'scope.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'legacy phase inputs']);
  const baseline = `${receiptRoot}/legacy-v2-baseline.json`;
  const legacy = `${receiptRoot}/legacy-v2-verified.json`;
  const preflight = `${receiptRoot}/legacy-v2-preflight.json`;
  const reverified = `${receiptRoot}/legacy-v2-reverified.json`;
  const committed = `${receiptRoot}/legacy-v2-committed.json`;
  run(repo, ['--action', 'start', '--out', baseline, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'phase', '--plan', 'plan.md', '--scope', 'scope.json']);
  writeFileSync(path.join(repo, 'feature.txt'), 'implemented\n', 'utf8');
  run(repo, ['--action', 'verify', '--receipt', baseline, '--out', legacy, '--verify-command', 'node -e "process.exit(0)"']);
  const legacyBaseline = read(repo, baseline);
  delete legacyBaseline.baseline.ignoredGoverned;
  json(repo, baseline, legacyBaseline);
  const legacyReceipt = read(repo, legacy);
  delete legacyReceipt.scopeExtensions;
  delete legacyReceipt.baseline.ignoredGoverned;
  delete legacyReceipt.verification.at(-1).inputHashes.scopeExtensionsHash;
  delete legacyReceipt.verification.at(-1).inputHashes.ignoredGovernedHash;
  legacyReceipt.previousReceiptHash = sha256File(path.join(repo, baseline));
  json(repo, legacy, legacyReceipt);

  assert.equal(run(repo, ['--action', 'status', '--receipt', legacy]).state, 'VERIFIED');
  for (const [action, args, output] of [
    ['preflight', ['--target-path', 'feature.txt'], preflight],
    ['verify', ['--verify-command', 'node -e "process.exit(0)"'], reverified],
    ['commit', ['--commit-message', 'feat: reject legacy v2'], committed],
  ]) {
    const result = run(repo, ['--action', action, '--receipt', legacy, '--out', output, ...args], 2);
    assert.match(result.message, /ignored governed baseline/u);
    assert.equal(existsSync(path.join(repo, output)), false);
  }
});

test('strict initialization rejects a legacy v2 source without an ignored baseline', (t) => {
  const repo = createRepo(t);
  writeFileSync(path.join(repo, 'design.md'), '# Design\n', 'utf8');
  writeFileSync(path.join(repo, 'plan.md'), '# Plan\n', 'utf8');
  json(repo, 'scope.json', { allowedPaths: ['src/**'], protectedPaths: [], forbiddenWork: [], evidenceInputs: { 'acceptance-red': ['design.md'], 'implementation-green': ['design.md'], 'stop-gate': ['design.md'] } });
  const successor = { allowedCodes: { next: 'phase-2' } };
  json(repo, 'successor.json', successor);
  json(repo, 'authority.json', { designFreeze: ['owner'], recovery: ['owner'], scopeDelta: ['owner'], review: ['owner'], successor: ['owner'], release: ['owner'] });
  json(repo, 'freeze.json', { authority: 'owner', frozenAt: new Date().toISOString(), specHash: sha256File(path.join(repo, 'design.md')), successorPolicyHash: policyHash(successor) });
  execFileSync('git', ['-C', repo, 'add', 'design.md', 'plan.md', 'scope.json', 'successor.json', 'authority.json', 'freeze.json']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'strict inputs']);
  const strictRequired = `${receiptRoot}/legacy-strict-required.json`;
  run(repo, ['--action', 'start', '--out', strictRequired, '--feature-id', 'feature', '--phase-id', 'phase-1', '--mode', 'strict', '--continuation', 'merge', '--plan', 'plan.md', '--scope', 'scope.json']);
  const legacy = read(repo, strictRequired);
  delete legacy.baseline.ignoredGoverned;
  json(repo, strictRequired, legacy);
  const result = run(repo, ['--action', 'strict-init', '--receipt', strictRequired, '--out', `${receiptRoot}/legacy-strict-v1.json`, '--spec', 'design.md', '--freeze-receipt', 'freeze.json', '--plan', 'plan.md', '--scope', 'scope.json', '--successor-policy', 'successor.json', '--authority-policy', 'authority.json'], 2);
  assert.match(result.message, /ignored governed baseline/u);
});

test('status reads v1 checkpoints as strict merge compatibility without rewriting', (t) => {
  const repo = createRepo(t);
  const legacy = `${receiptRoot}/legacy.json`;
  execFileSync(process.execPath, [initStrict, '--repo', repo, '--out', legacy, '--feature-id', 'legacy-feature', '--phase-id', 'legacy-phase']);
  const before = readFileSync(path.join(repo, legacy), 'utf8');
  const result = run(repo, ['--action', 'status', '--receipt', legacy]);
  assert.equal(result.mode, 'strict');
  assert.equal(result.phaseId, 'legacy-phase');
  assert.equal(readFileSync(path.join(repo, legacy), 'utf8'), before);
  writeFileSync(path.join(repo, 'after-checkpoint.txt'), 'drift\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'after-checkpoint.txt']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'after checkpoint']);
  const stale = run(repo, ['--action', 'status', '--receipt', legacy]);
  assert.equal(stale.current.receiptCurrent, false);
  assert.match(stale.warnings.join('\n'), /HEAD changed/u);
});
