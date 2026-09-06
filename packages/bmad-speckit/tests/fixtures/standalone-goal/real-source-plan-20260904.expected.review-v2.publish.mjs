import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './real-source-plan-20260904.expected.blocks.mjs';
import { SOURCE_SHA256, STEM } from './real-source-plan-20260904.expected.profile.mjs';
import { verifyCurrentReview } from './real-source-plan-20260904.expected.review-v2.integrity.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../../..');
const run = join(root, '.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z/oracle-expected-revision-20260906');
const artifact = suffix => join(directory, `${STEM}.expected.${suffix}`);
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const mode = process.argv[2];
assert.ok(['verification', 'integrity'].includes(mode));
const attempt = process.argv[3] || 'initial';
assert.match(attempt, /^[a-z0-9-]+$/);
const target = artifact(mode === 'verification' ? 'verification.json' : 'final-integrity.receipt.json');
const session = join(directory, `.${STEM}.expected.${mode === 'verification' ? 'verification.json' : 'final-integrity.receipt.json'}.draft`);

function official(args, phase) {
  const result = spawnSync(process.execPath, [npmCli, 'exec', '--offline', '--', 'bmad-speckit', 'large-doc', ...args, '--json'],
    { cwd: root, encoding: 'utf8', maxBuffer: 131072, timeout: 60000, windowsHide: true });
  const prefix = join(run, `sidecar-${mode}-${attempt}-${phase}`);
  writeFileSync(`${prefix}.stdout.log`, result.stdout || '', { encoding: 'utf8', flag: 'wx' });
  writeFileSync(`${prefix}.stderr.log`, result.stderr || '', { encoding: 'utf8', flag: 'wx' });
  assert.equal(result.status, 0, prefix);
  const receipt = JSON.parse(result.stdout);
  writeFileSync(`${prefix}.receipt.json`, `${JSON.stringify(receipt)}\n`, { encoding: 'utf8', flag: 'wx' });
  return receipt;
}

if (existsSync(session)) {
  const status = official(['status', '--session', session], 'status');
  assert.deepEqual(status.corruptChunks, []);
  if (status.promoted) official(['cleanup', '--session', session, '--policy', 'archive'], 'archive');
  else assert.equal(status.nextChunkId, '001', 'Inspect partially published sidecars before resuming');
}
if (!existsSync(session)) {
  official(['init', '--target', target, '--mode', 'replace', '--profile', 'json',
    ...(mode === 'verification' ? ['--chunk', '000:source-identity'] : []), '--chunk', `001:${mode}-evidence`,
    '--require-fragment', SOURCE_SHA256, '--min-bytes', '1000'], 'init');
  if (mode === 'verification') {
    const sourceDraft = artifact(`review-v2.${mode}.${attempt}.source.draft.json`);
    writeFileSync(sourceDraft, `{\n"sourceSha256": "${SOURCE_SHA256}",\n`, { encoding: 'utf8', flag: 'wx' });
    const first = official(['write-chunk', '--session', session, '--chunk-id', '000',
      '--section-id', 'source-identity', '--content-file', sourceDraft], 'source');
    assert.equal(first.chunkHash, `sha256:${hash(readFileSync(first.chunkPath))}`);
  }
}
let data;
if (mode === 'verification') {
  const first = json(join(session, 'receipts', '000.receipt.json'));
  assert.equal(first.chunkHash, `sha256:${hash(readFileSync(first.chunkPath))}`);
  const manifest = json(artifact('json'));
  const promoted = json(join(run, 'v2-promoted-summary.json'));
  assert.equal(hash(readFileSync(artifact('json'))), promoted.oracleSha256);
  assert.equal(hash(readFileSync(join(directory, `${STEM}.md`))), SOURCE_SHA256);
  const helperHashes = readdirSync(directory).filter(name => name.startsWith(`${STEM}.expected.`) && name.endsWith('.mjs'))
    .sort().map(file => ({ file, sha256: hash(readFileSync(join(directory, file))) }));
  const independentTestEvidence = ['independent-v2-final-green', 'independent-v2-default-green'].map(name => {
    const path = join(run, `${name}.receipt.json`), bytes = readFileSync(path), result = JSON.parse(bytes);
    assert.equal(result.exitCode, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.oracleSha256, promoted.oracleSha256);
    return { path, sha256: hash(bytes) };
  });
  const { sourceSha256, ...metrics } = manifest.verification;
  assert.equal(sourceSha256, SOURCE_SHA256);
  data = { ...metrics, oracleSha256: promoted.oracleSha256, helperHashes, sectionSummary: manifest.sectionSummary,
    reviewRevision: manifest.reviewRevision, previousOracle: { path: promoted.backupPath, sha256: promoted.priorOracleSha256 },
    independentTestEvidence };
} else {
  data = verifyCurrentReview();
}
const text = mode === 'verification' ? `${JSON.stringify(data, null, 2).slice(1).trimStart()}\n` : `${JSON.stringify(data, null, 2)}\n`;
assert.ok(Buffer.byteLength(text) * 5 < 32 * 1024 * 1024);
const draft = artifact(`review-v2.${mode}.${attempt}.draft.json`);
writeFileSync(draft, text, { encoding: 'utf8', flag: 'wx' });
const chunk = official(['write-chunk', '--session', session, '--chunk-id', '001', '--section-id', `${mode}-evidence`, '--content-file', draft], 'chunk');
assert.equal(chunk.chunkHash, `sha256:${hash(readFileSync(chunk.chunkPath))}`);
const assembled = official(['assemble', '--session', session], 'assembly');
const bytes = readFileSync(assembled.outputPath), document = JSON.parse(bytes);
assert.deepEqual(document, mode === 'verification' ? { sourceSha256: SOURCE_SHA256, ...data } : data);
official(['validate', '--session', session], 'validation');
official(['promote', '--session', session], 'promotion');
assert.equal(hash(readFileSync(target)), hash(bytes));
official(['cleanup', '--session', session, '--policy', 'keep'], 'cleanup');
console.log(JSON.stringify({ stage: 'sidecar_promoted', mode, path: target, bytes: bytes.length, sha256: hash(bytes),
  sourceSha256: SOURCE_SHA256, businessCommandsExecuted: 0 }));
