import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { policyHash, scopeHash, sha256File } from '../checkpoint-core.mjs';
import { validateJsonSchema } from '../json-schema-lite.mjs';

const scripts = path.dirname(fileURLToPath(new URL('../checkpoint-core.mjs', import.meta.url)));
const workspace = os.tmpdir();
const schema = JSON.parse(readFileSync(path.join(scripts, '../assets/execution-checkpoint.schema.json'), 'utf8'));
const legacyMergeEvidence = JSON.parse(readFileSync(new URL('./fixtures/legacy-v1-merge-evidence.json', import.meta.url), 'utf8'));

function json(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(script, args, expected = 0) {
  const result = spawnSync(process.execPath, [path.join(scripts, script), ...args], { cwd: workspace, encoding: 'utf8' });
  assert.equal(result.status, expected, `${script} exit=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result.stdout.trim() ? JSON.parse(result.stdout.trim()) : null;
}

test('immutable checkpoint workflow closes a phase and starts the signaled next phase', (t) => {
  mkdirSync(path.join(workspace, '.tmp'), { recursive: true });
  const work = mkdtempSync(path.join(workspace, '.tmp', 'gfd-test-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const repo = work;
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Governed Test']);
  writeFileSync(path.join(repo, '.gitignore'), '.artifacts/\n', 'utf8');
  mkdirSync(path.join(repo, '.artifacts'), { recursive: true });
  const spec = path.join(work, 'design.md');
  const plan = path.join(work, 'phase-plan.md');
  const scopeFile = path.join(work, 'scope.json');
  const policyFile = path.join(work, 'policy.json');
  const freezeFile = path.join(work, 'freeze.json');
  const authorityFile = path.join(work, 'authority.json');
  const riskFile = path.join(work, 'risk.json');
  writeFileSync(spec, '# Stable design\n', 'utf8');
  writeFileSync(plan, '# Phase 1\n', 'utf8');
  const policy = { allowedCodes: { 'advance-phase-2': 'phase-2', release: 'RELEASED' } };
  const authority = {
    designFreeze: ['design-owner'], recovery: ['recovery-owner'], scopeDelta: ['scope-owner'],
    review: ['reviewer'], successor: ['product-owner'], release: ['release-owner'],
  };
  const riskPolicy = { strictPaths: [], requirePullRequest: false, integrationRefs: ['refs/heads/integration'] };
  json(policyFile, policy);
  json(authorityFile, authority);
  json(riskFile, riskPolicy);
  const inputs = ['design.md', 'phase-plan.md'];
  const scope = {
    allowedPaths: ['src/phase-1/**'],
    protectedPaths: ['src/phase-2/**'],
    forbiddenWork: ['src/phase-1/forbidden/**'],
    evidenceInputs: {
      'acceptance-red': inputs,
      'implementation-green': [...inputs, 'src/phase-1/example.ts'],
      'stop-gate': [...inputs, 'src/phase-1/example.ts'],
    },
  };
  json(scopeFile, scope);
  json(freezeFile, {
    authority: 'design-owner',
    frozenAt: new Date().toISOString(),
    specHash: sha256File(spec),
    successorPolicyHash: policyHash(policy),
  });
  mkdirSync(path.join(repo, 'outside'), { recursive: true });
  writeFileSync(path.join(repo, 'outside', 'tracked.txt'), 'outside baseline\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'fixture']);
  let headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  const initialBaseSha = headSha;
  const phaseBranch = execFileSync('git', ['-C', repo, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  const relative = (file) => path.relative(repo, file).replaceAll(path.sep, '/');

  const checkpoints = Array.from({ length: 8 }, (_, index) => path.join(work, '.artifacts', `checkpoint-r${index + 1}.json`));
  checkpoints[0] = path.join(work, '.artifacts', 'governed-feature-delivery', 'checkpoint-r1.json');
  const strictRequired = path.join(work, '.artifacts', 'governed-feature-delivery', 'strict-required.json');
  run('run-phase.mjs', [
    '--action', 'start', '--out', relative(strictRequired), '--feature-id', 'feature-1', '--phase-id', 'phase-1',
    '--mode', 'strict', '--continuation', 'merge', '--plan', relative(plan), '--scope', relative(scopeFile),
    '--risk-policy', relative(riskFile), '--repo', repo,
  ]);
  run('run-phase.mjs', [
    '--action', 'strict-init', '--receipt', relative(strictRequired), '--out', relative(checkpoints[0]),
    '--spec', relative(spec), '--freeze-receipt', relative(freezeFile), '--plan', relative(plan), '--scope', relative(scopeFile),
    '--successor-policy', relative(policyFile), '--authority-policy', relative(authorityFile), '--repo', repo,
  ]);
  const initialCheckpoint = JSON.parse(readFileSync(checkpoints[0], 'utf8'));
  assert.deepEqual(validateJsonSchema(initialCheckpoint, schema), []);
  assert.equal(initialCheckpoint.sourcePhaseReceipt.receiptHash, sha256File(strictRequired));
  assert.equal(initialCheckpoint.sourcePhaseReceipt.phaseId, 'phase-1');
  assert.match(validateJsonSchema({ ...initialCheckpoint, unexpected: true }, schema).join('\n'), /unexpected/u);
  const invalidCompletedPhase = structuredClone(initialCheckpoint);
  invalidCompletedPhase.completedPhase = {};
  const invalidCompletedPhaseFile = path.join(work, '.artifacts', 'invalid-completed-phase.json');
  json(invalidCompletedPhaseFile, invalidCompletedPhase);
  const invalidCompletedPhaseResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(invalidCompletedPhaseFile), '--repo', repo], 2);
  assert.match(invalidCompletedPhaseResult.issues.join('\n'), /completedPhase must have type string\|null/u);

  const oversizedIssueCheckpoint = structuredClone(initialCheckpoint);
  oversizedIssueCheckpoint[`unknown-${'x'.repeat(512 * 1024)}`] = true;
  const oversizedIssueFile = path.join(work, '.artifacts', 'oversized-validator-issue.json');
  json(oversizedIssueFile, oversizedIssueCheckpoint);
  const oversizedIssueResult = spawnSync(process.execPath, [path.join(scripts, 'validate-execution-checkpoint.mjs'), '--checkpoint', relative(oversizedIssueFile), '--repo', repo], {
    cwd: workspace,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(oversizedIssueResult.status, 2);
  assert.ok(Buffer.byteLength(oversizedIssueResult.stdout, 'utf8') < 4096);
  const oversizedIssueOutput = JSON.parse(oversizedIssueResult.stdout);
  assert.ok(oversizedIssueOutput.issueCount > 0);
  assert.equal(oversizedIssueOutput.issuesTruncated, true);
  assert.ok(oversizedIssueOutput.issueBytes > oversizedIssueOutput.reportedIssueBytes);

  const probeCheckpointPath = path.join(work, '.artifacts', 'probe-checkpoint.json');
  run('init-execution-checkpoint.mjs', [
    '--out', relative(probeCheckpointPath), '--feature-id', 'probe-feature', '--phase-id', 'phase-1',
    '--spec', relative(spec), '--freeze-receipt', relative(freezeFile), '--plan', relative(plan), '--scope', relative(scopeFile),
    '--successor-policy', relative(policyFile), '--authority-policy', relative(authorityFile), '--repo', repo,
  ]);
  const probeCheckpoint = JSON.parse(readFileSync(probeCheckpointPath, 'utf8'));

  execFileSync('git', ['-C', repo, 'switch', '-qc', 'rename-scope-test']);
  mkdirSync(path.join(repo, 'src', 'phase-1'), { recursive: true });
  execFileSync('git', ['-C', repo, 'mv', 'outside/tracked.txt', 'src/phase-1/moved.txt']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'rename into allowed scope']);
  const renameCheckpoint = structuredClone(probeCheckpoint);
  renameCheckpoint.branch = 'rename-scope-test';
  renameCheckpoint.headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  renameCheckpoint.updatedAt = new Date().toISOString();
  const renameCheckpointPath = path.join(work, '.artifacts', 'rename-checkpoint.json');
  json(renameCheckpointPath, renameCheckpoint);
  run('attest-scope.mjs', ['--checkpoint', relative(renameCheckpointPath), '--out', '.artifacts/rename-attestation.json', '--repo', repo], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', phaseBranch]);

  execFileSync('git', ['-C', repo, 'switch', '-qc', 'forbidden-scope-test']);
  mkdirSync(path.join(repo, 'src', 'phase-1', 'forbidden'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'phase-1', 'forbidden', 'blocked.ts'), 'export const blocked = true;\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'src/phase-1/forbidden/blocked.ts']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'forbidden overlap probe']);
  const forbiddenCheckpoint = structuredClone(probeCheckpoint);
  forbiddenCheckpoint.branch = 'forbidden-scope-test';
  forbiddenCheckpoint.headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  forbiddenCheckpoint.updatedAt = new Date().toISOString();
  const forbiddenCheckpointPath = path.join(work, '.artifacts', 'forbidden-checkpoint.json');
  json(forbiddenCheckpointPath, forbiddenCheckpoint);
  run('attest-scope.mjs', ['--checkpoint', relative(forbiddenCheckpointPath), '--out', '.artifacts/forbidden-attestation.json', '--repo', repo], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', phaseBranch]);

  const unsafeScopeFile = path.join(work, '.artifacts', 'unsafe-scope.json');
  json(unsafeScopeFile, {
    ...scope,
    evidenceInputs: {
      'acceptance-red': ['../outside.json'],
      'implementation-green': inputs,
      'stop-gate': inputs,
    },
  });
  run('init-execution-checkpoint.mjs', [
    '--out', '.artifacts/unsafe-scope-checkpoint.json', '--feature-id', 'unsafe-feature', '--phase-id', 'phase-1',
    '--spec', relative(spec), '--freeze-receipt', relative(freezeFile), '--plan', relative(plan), '--scope', relative(unsafeScopeFile),
    '--successor-policy', relative(policyFile), '--authority-policy', relative(authorityFile), '--repo', repo,
  ], 2);

  const transition = (from, to, state, option, payload) => {
    const payloadFile = path.join(work, '.artifacts', `${state.toLowerCase()}.json`);
    json(payloadFile, payload);
    const result = run('advance-execution-checkpoint.mjs', [
      '--checkpoint', relative(checkpoints[from]), '--out', relative(checkpoints[to]), '--to-state', state,
      option, relative(payloadFile), '--repo', repo,
    ]);
    const expectedStage = { RED_CONFIRMED: 'Implement', GREEN_CONFIRMED: 'Verify', STOP_GATE_GREEN: 'Verify', REVIEWED: 'Commit', PR_GREEN: 'Commit', MERGED: 'Next', NEXT_PHASE: 'Next' }[state];
    assert.equal(result.progress.stage, expectedStage, state);
    return result;
  };
  const evidence = (checkpoint, name, kind, status, command = `npm test -- ${name}`) => {
    const receipt = path.join(work, '.artifacts', `${name}.log`);
    const output = path.join(work, '.artifacts', `${name}.json`);
    writeFileSync(receipt, `${name} receipt\n`, 'utf8');
    run('record-gate-evidence.mjs', [
      '--checkpoint', relative(checkpoint), '--out', relative(output), '--id', name, '--kind', kind,
      '--status', status, '--command', command, '--receipt', relative(receipt), '--repo', repo,
    ]);
    return output;
  };

  const red = evidence(checkpoints[0], 'red-1', 'acceptance-red', 'confirmed');
  run('record-gate-evidence.mjs', [
    '--checkpoint', relative(checkpoints[0]), '--out', '.artifacts/blank-command.json', '--id', 'blank-command', '--kind', 'acceptance-red',
    '--status', 'confirmed', '--command', '   ', '--receipt', relative(path.join(work, '.artifacts', 'red-1.log')), '--repo', repo,
  ], 2);
  const spacedCommandEvidence = evidence(checkpoints[0], 'red-spaced-command', 'acceptance-red', 'confirmed', 'node -e "console.log(\'a  b\')"');
  assert.equal(JSON.parse(readFileSync(spacedCommandEvidence, 'utf8')).command, 'node -e "console.log(\'a  b\')"');
  writeFileSync(spec, '# Dirty design\n', 'utf8');
  run('record-gate-evidence.mjs', [
    '--checkpoint', relative(checkpoints[0]), '--out', '.artifacts/dirty-red.json', '--id', 'dirty-red', '--kind', 'acceptance-red',
    '--status', 'confirmed', '--command', 'npm test -- dirty', '--receipt', relative(path.join(work, '.artifacts', 'red-1.log')), '--repo', repo,
  ], 2);
  writeFileSync(spec, '# Stable design\n', 'utf8');
  const redTransition = run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[0]), '--out', relative(checkpoints[1]), '--to-state', 'RED_CONFIRMED', '--evidence', relative(red), '--repo', repo]);
  assert.equal(redTransition.progress.stage, 'Implement');
  const missingBridge = JSON.parse(readFileSync(checkpoints[1], 'utf8'));
  delete missingBridge.sourcePhaseReceipt;
  const missingBridgeFile = path.join(work, '.artifacts', 'missing-source-bridge.json');
  json(missingBridgeFile, missingBridge);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(missingBridgeFile), '--repo', repo], 2);
  mkdirSync(path.join(repo, 'src', 'phase-1'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'phase-1', 'example.ts'), 'export const implemented = true;\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'src/phase-1/example.ts']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'implement phase 1']);
  headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[1]), '--repo', repo], 2);
  const staleRedPlan = path.join(work, '.artifacts', 'stale-red-plan.md');
  const staleRedScopeFile = path.join(work, '.artifacts', 'stale-red-scope.json');
  writeFileSync(staleRedPlan, '# Stale RED scope delta\n', 'utf8');
  const staleRedScope = { ...scope, allowedPaths: [...scope.allowedPaths, 'src/shared/**'] };
  json(staleRedScopeFile, staleRedScope);
  const staleRedDeltaFile = path.join(work, '.artifacts', 'stale-red-delta.json');
  json(staleRedDeltaFile, {
    id: 'stale-red-delta', decision: 'approved', beforeScopeHash: JSON.parse(readFileSync(checkpoints[1], 'utf8')).scopeHash,
    afterScopeHash: scopeHash(staleRedScope), phasePlanHash: sha256File(staleRedPlan), authority: 'scope-owner', decidedAt: new Date().toISOString(),
  });
  run('apply-scope-delta.mjs', [
    '--checkpoint', relative(checkpoints[1]), '--out', '.artifacts/stale-red-delta-checkpoint.json', '--scope', relative(staleRedScopeFile),
    '--plan', relative(staleRedPlan), '--delta', relative(staleRedDeltaFile), '--repo', repo,
  ]);
  const green = evidence(checkpoints[1], 'green-1', 'implementation-green', 'confirmed');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[1]), '--out', relative(checkpoints[2]), '--to-state', 'GREEN_CONFIRMED', '--evidence', relative(green), '--repo', repo]);
  const stop = evidence(checkpoints[2], 'stop-1', 'stop-gate', 'pass');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[2]), '--out', relative(checkpoints[3]), '--to-state', 'STOP_GATE_GREEN', '--evidence', relative(stop), '--repo', repo]);
  const scopeAttestation = path.join(work, '.artifacts', 'scope-attestation.json');
  run('attest-scope.mjs', ['--checkpoint', relative(checkpoints[3]), '--out', relative(scopeAttestation), '--repo', repo]);
  const reviewerFile = path.join(work, '.artifacts', 'reviewed.json');
  json(reviewerFile, { headSha, status: 'approved', authority: 'reviewer' });
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[3]), '--out', relative(checkpoints[4]), '--to-state', 'REVIEWED', '--scope-attestation', relative(scopeAttestation), '--reviewer', relative(reviewerFile), '--repo', repo]);

  const implementationFile = path.join(repo, 'src', 'phase-1', 'example.ts');
  writeFileSync(implementationFile, 'export const implemented = false;\n', 'utf8');
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[4]), '--repo', repo], 2);
  writeFileSync(implementationFile, 'export const implemented = true;\nexport const reviewed = true;\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'src/phase-1/example.ts']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'apply review change']);
  headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();

  const replayPlanned = path.join(work, '.artifacts', 'replay-planned.json');
  run('reset-execution-gates.mjs', ['--checkpoint', relative(checkpoints[4]), '--out', relative(replayPlanned), '--repo', repo]);
  assert.equal(JSON.parse(readFileSync(replayPlanned, 'utf8')).state, 'PHASE_PLANNED');
  assert.deepEqual(validateJsonSchema(JSON.parse(readFileSync(replayPlanned, 'utf8')), schema), []);
  const replayRedEvidence = evidence(replayPlanned, 'red-replay', 'acceptance-red', 'confirmed');
  const replayRed = path.join(work, '.artifacts', 'replay-red.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(replayPlanned), '--out', relative(replayRed), '--to-state', 'RED_CONFIRMED', '--evidence', relative(replayRedEvidence), '--repo', repo]);
  const replayGreenEvidence = evidence(replayRed, 'green-replay', 'implementation-green', 'confirmed');
  const replayGreen = path.join(work, '.artifacts', 'replay-green.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(replayRed), '--out', relative(replayGreen), '--to-state', 'GREEN_CONFIRMED', '--evidence', relative(replayGreenEvidence), '--repo', repo]);
  const replayStopEvidence = evidence(replayGreen, 'stop-replay', 'stop-gate', 'pass');
  const replayStop = path.join(work, '.artifacts', 'replay-stop.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(replayGreen), '--out', relative(replayStop), '--to-state', 'STOP_GATE_GREEN', '--evidence', relative(replayStopEvidence), '--repo', repo]);
  const replayAttestation = path.join(work, '.artifacts', 'replay-attestation.json');
  run('attest-scope.mjs', ['--checkpoint', relative(replayStop), '--out', relative(replayAttestation), '--repo', repo]);
  const replayReviewer = path.join(work, '.artifacts', 'replay-reviewer.json');
  json(replayReviewer, { headSha, status: 'no-findings', authority: 'reviewer' });
  const replayReviewed = path.join(work, '.artifacts', 'replay-reviewed.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(replayStop), '--out', relative(replayReviewed), '--to-state', 'REVIEWED', '--scope-attestation', relative(replayAttestation), '--reviewer', relative(replayReviewer), '--repo', repo]);
  checkpoints[4] = replayReviewed;
  transition(4, 5, 'PR_GREEN', '--pull-request', { url: 'https://example.invalid/pr/1', headSha, status: 'green' });
  execFileSync('git', ['-C', repo, 'branch', 'integration', initialBaseSha]);
  execFileSync('git', ['-C', repo, 'switch', '-q', 'integration']);
  execFileSync('git', ['-C', repo, 'merge', '--no-ff', '-qm', 'merge phase one', phaseBranch]);
  const mergeSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  execFileSync('git', ['-C', repo, 'branch', '-f', phaseBranch, mergeSha]);
  const phaseRefMerge = path.join(work, '.artifacts', 'phase-ref-merge.json');
  json(phaseRefMerge, { sha: mergeSha, ref: `refs/heads/${phaseBranch}`, containsReviewedSha: headSha, mergedAt: new Date().toISOString() });
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[5]), '--out', '.artifacts/phase-ref-merged.json', '--to-state', 'MERGED', '--merge', relative(phaseRefMerge), '--repo', repo], 2);
  execFileSync('git', ['-C', repo, 'branch', '-f', phaseBranch, headSha]);
  transition(5, 6, 'MERGED', '--merge', { sha: mergeSha, ref: 'refs/heads/integration', containsReviewedSha: headSha, mergedAt: new Date().toISOString() });
  const mergedStatus = run('run-phase.mjs', ['--action', 'status', '--receipt', relative(checkpoints[6]), '--repo', repo]);
  assert.equal(mergedStatus.current.receiptCurrent, true, JSON.stringify(mergedStatus.warnings));

  writeFileSync(spec, '# Integration checkout drift\n', 'utf8');
  writeFileSync(plan, '# Integration checkout plan drift\n', 'utf8');
  json(scopeFile, { ...scope, allowedPaths: ['outside/**'] });
  json(policyFile, { allowedCodes: { stop: 'STOP' } });
  json(authorityFile, { ...authority, review: ['other-reviewer'] });
  json(riskFile, { ...riskPolicy, integrationRefs: ['refs/heads/unrelated'] });
  const sealedStatus = run('run-phase.mjs', ['--action', 'status', '--receipt', relative(checkpoints[6]), '--repo', repo]);
  assert.equal(sealedStatus.current.receiptCurrent, true, JSON.stringify(sealedStatus.warnings));
  writeFileSync(spec, '# Stable design\n', 'utf8');
  writeFileSync(plan, '# Phase 1\n', 'utf8');
  json(scopeFile, scope);
  json(policyFile, policy);
  json(authorityFile, authority);
  json(riskFile, riskPolicy);

  const legacyMergeCheckpoint = JSON.parse(readFileSync(checkpoints[6], 'utf8'));
  legacyMergeCheckpoint.merge = legacyMergeEvidence;
  const legacyMergeFile = path.join(work, '.artifacts', 'legacy-v1-merge.json');
  json(legacyMergeFile, legacyMergeCheckpoint);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(legacyMergeFile), '--repo', repo, '--historical', 'true']);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(legacyMergeFile), '--repo', repo, '--historical', 'true', '--enforce-merge-ref', 'true'], 2);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(legacyMergeFile), '--repo', repo], 2);
  const legacySignal = path.join(work, '.artifacts', 'legacy-successor.json');
  json(legacySignal, { code: 'advance-phase-2', target: 'phase-2', authority: 'product-owner', signedAt: new Date().toISOString() });
  run('advance-execution-checkpoint.mjs', [
    '--checkpoint', relative(legacyMergeFile), '--out', '.artifacts/legacy-next.json', '--to-state', 'NEXT_PHASE',
    '--successor-signal', relative(legacySignal), '--repo', repo,
  ], 2);

  const standaloneLegacy = structuredClone(legacyMergeCheckpoint);
  delete standaloneLegacy.sourcePhaseReceipt;
  standaloneLegacy.checkpointRevision = 1;
  standaloneLegacy.previousCheckpointPath = null;
  standaloneLegacy.previousCheckpointHash = null;
  const standaloneLegacyFile = path.join(work, '.artifacts', 'standalone-legacy-v1-merged.json');
  json(standaloneLegacyFile, standaloneLegacy);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(standaloneLegacyFile), '--repo', repo, '--historical', 'true']);
  run('run-phase.mjs', ['--action', 'status', '--receipt', relative(standaloneLegacyFile), '--repo', repo]);

  const invalidMerge = JSON.parse(readFileSync(checkpoints[6], 'utf8'));
  invalidMerge.merge.sha = 'f'.repeat(40);
  const invalidMergeFile = path.join(work, '.artifacts', 'invalid-merge.json');
  json(invalidMergeFile, invalidMerge);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(invalidMergeFile), '--repo', repo, '--historical', 'true'], 2);
  const unrelatedMerge = JSON.parse(readFileSync(checkpoints[6], 'utf8'));
  unrelatedMerge.merge.sha = initialBaseSha;
  const unrelatedMergeFile = path.join(work, '.artifacts', 'unrelated-merge.json');
  json(unrelatedMergeFile, unrelatedMerge);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(unrelatedMergeFile), '--repo', repo, '--historical', 'true'], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', phaseBranch]);
  execFileSync('git', ['-C', repo, 'branch', '-f', 'integration', initialBaseSha]);
  const movedRefSignal = path.join(work, '.artifacts', 'moved-ref-successor.json');
  json(movedRefSignal, { code: 'advance-phase-2', target: 'phase-2', authority: 'product-owner', signedAt: new Date().toISOString() });
  run('advance-execution-checkpoint.mjs', [
    '--checkpoint', relative(checkpoints[6]), '--out', '.artifacts/moved-ref-next.json', '--to-state', 'NEXT_PHASE',
    '--successor-signal', relative(movedRefSignal), '--repo', repo,
  ], 2);
  execFileSync('git', ['-C', repo, 'branch', '-f', 'integration', mergeSha]);
  execFileSync('git', ['-C', repo, 'switch', '-q', 'integration']);
  transition(6, 7, 'NEXT_PHASE', '--successor-signal', { code: 'advance-phase-2', target: 'phase-2', authority: 'product-owner', signedAt: new Date().toISOString() });
  const nextPhaseStatus = run('run-phase.mjs', ['--action', 'status', '--receipt', relative(checkpoints[7]), '--repo', repo]);
  assert.equal(nextPhaseStatus.current.receiptCurrent, true, JSON.stringify(nextPhaseStatus.warnings));
  const nextPhaseValidation = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[7]), '--repo', repo]);
  assert.equal(nextPhaseValidation.ok, true, JSON.stringify(nextPhaseValidation.issues));
  execFileSync('git', ['-C', repo, 'switch', '-qc', 'wrong-next-checkout', initialBaseSha]);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[7]), '--repo', repo], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', 'integration']);

  run('init-execution-checkpoint.mjs', ['--out', '.artifacts/override-next-phase.json', '--feature-id', 'feature-1', '--phase-id', 'phase-2', '--previous', relative(checkpoints[7]), '--plan', relative(plan), '--scope', relative(scopeFile), '--successor-policy', relative(policyFile), '--repo', repo], 2);

  execFileSync('git', ['-C', repo, 'switch', '-qc', 'phase-2-descendant', mergeSha]);
  writeFileSync(path.join(repo, 'extra-baseline.txt'), 'extra\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'extra-baseline.txt']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'extra successor commit']);
  run('init-execution-checkpoint.mjs', [
    '--out', '.artifacts/descendant-next-phase.json', '--feature-id', 'feature-1', '--phase-id', 'phase-2', '--previous', relative(checkpoints[7]),
    '--plan', relative(plan), '--scope', relative(scopeFile), '--repo', repo,
  ], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', 'integration']);
  execFileSync('git', ['-C', repo, 'branch', '-f', phaseBranch, mergeSha]);
  execFileSync('git', ['-C', repo, 'switch', '-q', phaseBranch]);
  run('init-execution-checkpoint.mjs', [
    '--out', '.artifacts/reused-branch-next-phase.json', '--feature-id', 'feature-1', '--phase-id', 'phase-2', '--previous', relative(checkpoints[7]),
    '--plan', relative(plan), '--scope', relative(scopeFile), '--repo', repo,
  ], 2);
  execFileSync('git', ['-C', repo, 'switch', '-q', 'integration']);
  execFileSync('git', ['-C', repo, 'branch', '-f', phaseBranch, headSha]);
  execFileSync('git', ['-C', repo, 'switch', '-qc', 'phase-2', mergeSha]);

  const phase2 = path.join(work, '.artifacts', 'phase-2-r1.json');
  run('init-execution-checkpoint.mjs', [
    '--out', relative(phase2), '--feature-id', 'feature-1', '--phase-id', 'phase-2', '--previous', relative(checkpoints[7]),
    '--plan', relative(plan), '--scope', relative(scopeFile), '--repo', repo,
  ]);
  const phase2Checkpoint = JSON.parse(readFileSync(phase2, 'utf8'));
  assert.deepEqual(validateJsonSchema(phase2Checkpoint, schema), []);
  assert.equal(phase2Checkpoint.checkpointGeneration, 2);
  assert.equal(phase2Checkpoint.checkpointRevision, 1);
  assert.equal(phase2Checkpoint.state, 'PHASE_PLANNED');
  assert.deepEqual(phase2Checkpoint.sourcePhaseReceipt, initialCheckpoint.sourcePhaseReceipt);

  const changedPlan = path.join(work, '.artifacts', 'phase-2-plan-v2.md');
  const changedScopeFile = path.join(work, '.artifacts', 'scope-v2.json');
  writeFileSync(changedPlan, '# Phase 2 revised\n', 'utf8');
  const rejectedScopes = [
    ['removed-forbidden', { ...scope, forbiddenWork: [] }],
    ['removed-protected', { ...scope, protectedPaths: [] }],
    ['reduced-evidence', { ...scope, evidenceInputs: { 'acceptance-red': ['design.md'], 'implementation-green': ['design.md'], 'stop-gate': ['design.md'] } }],
  ];
  for (const [name, candidateScope] of rejectedScopes) {
    const candidateScopeFile = path.join(work, '.artifacts', 'governed-feature-delivery', `${name}-scope.json`);
    const candidateDeltaFile = path.join(work, '.artifacts', 'governed-feature-delivery', `${name}-delta.json`);
    json(candidateScopeFile, candidateScope);
    json(candidateDeltaFile, { id: name, decision: 'approved', beforeScopeHash: phase2Checkpoint.scopeHash, afterScopeHash: scopeHash(candidateScope), phasePlanHash: sha256File(changedPlan), authority: 'scope-owner', decidedAt: new Date().toISOString() });
    run('apply-scope-delta.mjs', ['--checkpoint', relative(phase2), '--out', `.artifacts/${name}-checkpoint.json`, '--scope', relative(candidateScopeFile), '--plan', relative(changedPlan), '--delta', relative(candidateDeltaFile), '--repo', repo], 2);
  }
  const changedInputs = [...new Set([...scope.evidenceInputs['stop-gate'], relative(changedPlan)])];
  const changedScope = {
    ...scope,
    allowedPaths: ['src/phase-1/**', 'src/shared/**'],
    evidenceInputs: {
      'acceptance-red': changedInputs,
      'implementation-green': changedInputs,
      'stop-gate': changedInputs,
    },
  };
  json(changedScopeFile, changedScope);
  const deltaFile = path.join(work, '.artifacts', 'delta.json');
  json(deltaFile, {
    id: 'delta-1', decision: 'approved', beforeScopeHash: phase2Checkpoint.scopeHash,
    afterScopeHash: scopeHash(changedScope), phasePlanHash: sha256File(changedPlan),
    authority: 'scope-owner', decidedAt: new Date().toISOString(),
  });
  const phase2Delta = path.join(work, '.artifacts', 'phase-2-r2.json');
  run('apply-scope-delta.mjs', ['--checkpoint', relative(phase2), '--out', relative(phase2Delta), '--scope', relative(changedScopeFile), '--plan', relative(changedPlan), '--delta', relative(deltaFile), '--repo', repo]);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(phase2Delta), '--repo', repo]);
  assert.deepEqual(validateJsonSchema(JSON.parse(readFileSync(phase2Delta, 'utf8')), schema), []);

  mkdirSync(path.join(repo, 'src', 'phase-2'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'phase-2', 'blocked.ts'), 'export const blocked = true;\n', 'utf8');
  execFileSync('git', ['-C', repo, 'add', 'src/phase-2/blocked.ts']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'touch protected phase']);
  run('apply-scope-delta.mjs', [
    '--checkpoint', relative(phase2), '--out', '.artifacts/retroactive-delta.json', '--scope', relative(changedScopeFile),
    '--plan', relative(changedPlan), '--delta', relative(deltaFile), '--repo', repo,
  ], 2);
  execFileSync('git', ['-C', repo, 'switch', '-qc', 'unrelated-base', initialBaseSha]);
  const wrongBaseResult = run('init-execution-checkpoint.mjs', [
    '--out', '.artifacts/wrong-base.json', '--feature-id', 'feature-1', '--phase-id', 'phase-2', '--previous', relative(checkpoints[7]),
    '--plan', relative(plan), '--scope', relative(scopeFile), '--repo', repo,
  ], 2);
  assert.match(wrongBaseResult.message, /equal the previous phase merge commit/u);
  execFileSync('git', ['-C', repo, 'switch', '-q', phase2Checkpoint.branch]);
  const illegalRed = evidence(phase2Delta, 'illegal-red', 'acceptance-red', 'confirmed');
  const illegalRedCheckpoint = path.join(work, '.artifacts', 'illegal-red-checkpoint.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(phase2Delta), '--out', relative(illegalRedCheckpoint), '--to-state', 'RED_CONFIRMED', '--evidence', relative(illegalRed), '--repo', repo]);
  const illegalGreen = evidence(illegalRedCheckpoint, 'illegal-green', 'implementation-green', 'confirmed');
  const illegalGreenCheckpoint = path.join(work, '.artifacts', 'illegal-green-checkpoint.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(illegalRedCheckpoint), '--out', relative(illegalGreenCheckpoint), '--to-state', 'GREEN_CONFIRMED', '--evidence', relative(illegalGreen), '--repo', repo]);
  const illegalStop = evidence(illegalGreenCheckpoint, 'illegal-stop', 'stop-gate', 'pass');
  const illegalStopCheckpoint = path.join(work, '.artifacts', 'illegal-stop-checkpoint.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(illegalGreenCheckpoint), '--out', relative(illegalStopCheckpoint), '--to-state', 'STOP_GATE_GREEN', '--evidence', relative(illegalStop), '--repo', repo]);
  run('attest-scope.mjs', ['--checkpoint', relative(illegalStopCheckpoint), '--out', '.artifacts/illegal-attestation.json', '--repo', repo], 2);

  const invalid = JSON.parse(readFileSync(phase2, 'utf8'));
  invalid.successorPolicy = { allowedCodes: null };
  const invalidFile = path.join(work, '.artifacts', 'invalid-policy.json');
  json(invalidFile, invalid);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(invalidFile), '--repo', repo], 2);

  const invalidAction = JSON.parse(readFileSync(phase2, 'utf8'));
  invalidAction.currentStep = 'merge everything';
  invalidAction.nextExactAction = 'merge everything';
  const invalidActionFile = path.join(work, '.artifacts', 'invalid-action.json');
  json(invalidActionFile, invalidAction);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(invalidActionFile), '--repo', repo], 2);

  const invalidDate = JSON.parse(readFileSync(phase2, 'utf8'));
  invalidDate.updatedAt = 'tomorrow';
  const invalidDateFile = path.join(work, '.artifacts', 'invalid-date.json');
  json(invalidDateFile, invalidDate);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(invalidDateFile), '--repo', repo, '--historical', 'true'], 2);

  const changedHeadStop = JSON.parse(readFileSync(checkpoints[2], 'utf8'));
  changedHeadStop.checkpointRevision += 1;
  changedHeadStop.previousCheckpointPath = path.basename(checkpoints[2]);
  changedHeadStop.previousCheckpointHash = sha256File(checkpoints[2]);
  changedHeadStop.state = 'STOP_GATE_GREEN';
  changedHeadStop.headSha = 'f'.repeat(40);
  changedHeadStop.stopGateEvidence.push({ ...changedHeadStop.stopGateEvidence.at(-1), id: 'synthetic-stop', kind: 'stop-gate', status: 'pass', headSha: changedHeadStop.headSha });
  changedHeadStop.stateHistory.push({ state: 'STOP_GATE_GREEN', at: new Date().toISOString(), reason: 'checkpoint advanced with bound evidence' });
  const changedHeadStopFile = path.join(work, '.artifacts', 'changed-head-stop.json');
  json(changedHeadStopFile, changedHeadStop);
  const changedHeadResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(changedHeadStopFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(changedHeadResult.issues.some((issue) => issue.includes('changed HEAD requires gate replay')), JSON.stringify(changedHeadResult.issues));

  const reviewedScopeDelta = JSON.parse(readFileSync(checkpoints[4], 'utf8'));
  reviewedScopeDelta.checkpointRevision += 1;
  reviewedScopeDelta.previousCheckpointPath = path.basename(checkpoints[4]);
  reviewedScopeDelta.previousCheckpointHash = sha256File(checkpoints[4]);
  reviewedScopeDelta.state = 'PHASE_PLANNED';
  reviewedScopeDelta.scopeDeltas.push({
    id: 'synthetic-reviewed-delta', decision: 'approved', beforeScopeHash: reviewedScopeDelta.scopeHash,
    afterScopeHash: reviewedScopeDelta.scopeHash, phasePlanHash: reviewedScopeDelta.phasePlanHash,
    authority: 'scope-owner', decidedAt: new Date().toISOString(),
  });
  reviewedScopeDelta.stopGateEvidence = [];
  reviewedScopeDelta.scopeAttestation = null;
  reviewedScopeDelta.reviewer = null;
  reviewedScopeDelta.pullRequest = null;
  reviewedScopeDelta.merge = null;
  reviewedScopeDelta.release = null;
  reviewedScopeDelta.stateHistory.push({ state: 'PHASE_PLANNED', at: new Date().toISOString(), reason: 'approved scope delta requires gate replay' });
  reviewedScopeDelta.nextActionCode = 'WRITE_RED_ACCEPTANCE';
  reviewedScopeDelta.nextExactAction = 'write and observe RED acceptance';
  reviewedScopeDelta.currentStep = reviewedScopeDelta.nextExactAction;
  const reviewedScopeDeltaFile = path.join(work, '.artifacts', 'reviewed-scope-delta.json');
  json(reviewedScopeDeltaFile, reviewedScopeDelta);
  const reviewedScopeResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(reviewedScopeDeltaFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(reviewedScopeResult.issues.some((issue) => issue.includes('state does not follow parent state')));

  const multiHistory = JSON.parse(readFileSync(checkpoints[2], 'utf8'));
  multiHistory.stateHistory.push({ state: 'GREEN_CONFIRMED', at: new Date().toISOString(), reason: 'duplicate revision event' });
  const multiHistoryFile = path.join(work, '.artifacts', 'multi-history.json');
  json(multiHistoryFile, multiHistory);
  const multiHistoryResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(multiHistoryFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(multiHistoryResult.issues.some((issue) => issue.includes('append exactly one stateHistory')));

  const mutatedChild = JSON.parse(readFileSync(checkpoints[2], 'utf8'));
  mutatedChild.completedPhase = 'silently-mutated';
  const mutatedChildFile = path.join(work, '.artifacts', 'mutated-child.json');
  json(mutatedChildFile, mutatedChild);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(mutatedChildFile), '--repo', repo, '--historical', 'true'], 2);

  const invalidAncestor = JSON.parse(readFileSync(checkpoints[1], 'utf8'));
  invalidAncestor.currentStep = 'skip the governed action';
  invalidAncestor.nextExactAction = 'skip the governed action';
  const invalidAncestorFile = path.join(work, '.artifacts', 'invalid-ancestor.json');
  json(invalidAncestorFile, invalidAncestor);
  const childOfInvalidAncestor = JSON.parse(readFileSync(checkpoints[2], 'utf8'));
  childOfInvalidAncestor.previousCheckpointPath = path.basename(invalidAncestorFile);
  childOfInvalidAncestor.previousCheckpointHash = sha256File(invalidAncestorFile);
  const childOfInvalidAncestorFile = path.join(work, '.artifacts', 'child-of-invalid-ancestor.json');
  json(childOfInvalidAncestorFile, childOfInvalidAncestor);
  const invalidAncestorResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(childOfInvalidAncestorFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(invalidAncestorResult.issues.some((issue) => issue.includes('ancestor') && issue.includes('canonical state action')));

  const cyclic = JSON.parse(readFileSync(phase2, 'utf8'));
  const cyclicFile = path.join(work, '.artifacts', 'cyclic.json');
  cyclic.previousCheckpointPath = path.basename(cyclicFile);
  json(cyclicFile, cyclic);
  const cyclicResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(cyclicFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(cyclicResult.issues.some((issue) => issue.includes('real-path cycle')));

  const incompleteEvidence = JSON.parse(readFileSync(red, 'utf8'));
  delete incompleteEvidence.inputHashes[inputs[0]];
  const incompleteFile = path.join(work, '.artifacts', 'incomplete-red.json');
  json(incompleteFile, incompleteEvidence);
  const rejectedOutput = path.join(work, '.artifacts', 'rejected.json');
  run('advance-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[0]), '--out', relative(rejectedOutput), '--to-state', 'RED_CONFIRMED', '--evidence', relative(incompleteFile), '--repo', repo], 2);
  assert.equal(spawnSync(process.execPath, ['-e', `process.exit(require('fs').existsSync(${JSON.stringify(rejectedOutput)}) ? 1 : 0)`]).status, 0);

  const discovered = path.join(work, '.artifacts', 'discovered.json');
  run('init-execution-checkpoint.mjs', ['--out', relative(discovered), '--feature-id', 'feature-2', '--phase-id', 'phase-a', '--repo', repo]);
  const discoveredWithParent = JSON.parse(readFileSync(discovered, 'utf8'));
  discoveredWithParent.previousCheckpointPath = 'fake-parent.json';
  discoveredWithParent.previousCheckpointHash = 'a'.repeat(64);
  const discoveredWithParentFile = path.join(work, '.artifacts', 'discovered-with-parent.json');
  json(discoveredWithParentFile, discoveredWithParent);
  const discoveredWithParentResult = run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(discoveredWithParentFile), '--repo', repo, '--historical', 'true'], 2);
  assert.ok(discoveredWithParentResult.issues.some((issue) => issue.includes('initial checkpoint must not carry parent metadata')));
  const missingArtifacts = JSON.parse(readFileSync(discovered, 'utf8'));
  delete missingArtifacts.artifacts;
  const missingArtifactsFile = path.join(work, '.artifacts', 'missing-artifacts.json');
  json(missingArtifactsFile, missingArtifacts);
  assert.notDeepEqual(validateJsonSchema(missingArtifacts, schema), []);
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(missingArtifactsFile), '--repo', repo, '--historical', 'true'], 2);
  const frozen = path.join(work, '.artifacts', 'frozen.json');
  run('prepare-execution-checkpoint.mjs', ['--checkpoint', relative(discovered), '--out', relative(frozen), '--to-state', 'SPEC_FROZEN', '--spec', relative(spec), '--successor-policy', relative(policyFile), '--freeze-receipt', relative(freezeFile), '--authority-policy', relative(authorityFile), '--repo', repo]);
  const planned = path.join(work, '.artifacts', 'planned.json');
  run('prepare-execution-checkpoint.mjs', ['--checkpoint', relative(frozen), '--out', relative(planned), '--to-state', 'PHASE_PLANNED', '--plan', relative(plan), '--scope', relative(scopeFile), '--repo', repo]);
  assert.equal(JSON.parse(readFileSync(planned, 'utf8')).state, 'PHASE_PLANNED');
  run('hash-checkpoint-input.mjs', ['--kind', 'file', '--input', '../outside.txt', '--repo', repo], 2);
  run('hash-checkpoint-input.mjs', ['--kind', 'file', '--input', relative(spec), '--typo', 'ignored', '--repo', repo], 2);
  const invalidAuthorityFile = path.join(work, '.artifacts', 'invalid-authority.json');
  json(invalidAuthorityFile, { review: ['reviewer'] });
  run('hash-checkpoint-input.mjs', ['--kind', 'authority', '--input', relative(invalidAuthorityFile), '--repo', repo], 2);

  const recoverySource = path.join(work, '.artifacts', 'recovery-source.json');
  const recoveryBranch = execFileSync('git', ['-C', repo, 'branch', '--show-current'], { encoding: 'utf8' }).trim() || 'DETACHED';
  const recoveryHead = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().toLowerCase();
  json(recoverySource, { featureId: 'recovered-feature', currentPhase: 'phase-r', headSha: recoveryHead, branch: recoveryBranch });
  const recoveryReceipt = path.join(work, '.artifacts', 'recovery-receipt.json');
  const recoverySourcePath = relative(recoverySource);
  json(recoveryReceipt, {
    authority: 'recovery-owner', decidedAt: new Date().toISOString(),
    sourceHashes: { [recoverySourcePath]: sha256File(recoverySource) },
    fieldSources: { featureId: recoverySourcePath, currentPhase: recoverySourcePath, headSha: recoverySourcePath, branch: recoverySourcePath },
    decision: 'reconstructed',
  });
  const recovered = path.join(work, '.artifacts', 'recovered.json');
  run('init-execution-checkpoint.mjs', ['--out', relative(recovered), '--feature-id', 'recovered-feature', '--phase-id', 'phase-r', '--authority-policy', relative(authorityFile), '--recovery-receipt', relative(recoveryReceipt), '--repo', repo]);
  assert.equal(JSON.parse(readFileSync(recovered, 'utf8')).state, 'DISCOVERED');

  writeFileSync(plan, '# Phase 1 changed after gate\n', 'utf8');
  run('validate-execution-checkpoint.mjs', ['--checkpoint', relative(checkpoints[3]), '--repo', repo], 2);
  writeFileSync(plan, '# Phase 1\n', 'utf8');
});
