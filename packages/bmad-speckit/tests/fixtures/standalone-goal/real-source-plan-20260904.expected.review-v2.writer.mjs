import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constructOracle, sectionDocument, validateOracle } from './real-source-plan-20260904.expected.oracle.mjs';
import { hash } from './real-source-plan-20260904.expected.blocks.mjs';
import { REVIEW_NOTES, SECTIONS, SOURCE_SHA256, STEM } from './real-source-plan-20260904.expected.profile.mjs';
import { reviewRevision, verifyReviewedAmendments } from './real-source-plan-20260904.expected.review-v2.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../../..');
const target = join(directory, `${STEM}.expected.json`);
const session = join(directory, `.${STEM}.expected.json.draft`);
const run = join(root, '.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z/oracle-expected-revision-20260906');
const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const priorHash = reviewRevision().priorOracleSha256;
const sourceBefore = hash(readFileSync(join(directory, `${STEM}.md`)));
assert.equal(sourceBefore, SOURCE_SHA256);

function official(args, name) {
  const result = spawnSync(process.execPath, [npmCli, 'exec', '--offline', '--', 'bmad-speckit', 'large-doc', ...args, '--json'],
    { cwd: root, windowsHide: true, encoding: 'utf8', maxBuffer: 131072, timeout: 60000 });
  writeFileSync(join(run, `${name}.stdout.log`), result.stdout || '', { encoding: 'utf8', flag: 'wx' });
  writeFileSync(join(run, `${name}.stderr.log`), result.stderr || '', { encoding: 'utf8', flag: 'wx' });
  assert.equal(result.status, 0, `${name}: inspect persisted stdout/stderr`);
  const receipt = JSON.parse(result.stdout);
  writeFileSync(join(run, `${name}.receipt.json`), `${JSON.stringify(receipt)}\n`, { encoding: 'utf8', flag: 'wx' });
  return receipt;
}

function persist(chunkId, sectionId, content) {
  assert.ok(Buffer.byteLength(content) * 2 < 32 * 1024 * 1024);
  const draft = join(directory, `${STEM}.expected.review-v2.chunk-${chunkId}.draft.json`);
  writeFileSync(draft, content, { encoding: 'utf8', flag: 'wx' });
  const receipt = official(['write-chunk', '--session', session, '--chunk-id', chunkId,
    '--section-id', sectionId, '--content-file', draft], `chunk-${chunkId}`);
  assert.equal(receipt.chunkHash, `sha256:${hash(readFileSync(receipt.chunkPath))}`);
  assert.equal(hash(readFileSync(target)), priorHash);
  console.log(JSON.stringify({ stage: 'persisted', chunkId, sectionId, bytes: receipt.bytes, sha256: receipt.chunkHash }));
}

const [command, value] = process.argv.slice(2);
assert.equal(hash(readFileSync(target)), priorHash, 'Do not rerun a revision against an already promoted target');
const oracle = constructOracle();
const verification = validateOracle(oracle);
verifyReviewedAmendments(oracle);
if (command === 'section') {
  const id = Number(value), section = SECTIONS.find(section => section.id === id);
  assert.ok(section, 'Invalid source section');
  const document = sectionDocument(oracle, section);
  const text = `${id === 0 ? '"sections": [\n' : ''}${JSON.stringify(document, null, 2)}${id === 16 ? '\n],\n' : ',\n'}`;
  persist(String(id + 1).padStart(3, '0'), `section-${id}`, text);
} else if (command === 'footer') {
  const previous = JSON.parse(readFileSync(target, 'utf8'));
  const summary = SECTIONS.map(section => { const doc = sectionDocument(oracle, section); return { section: section.id, source: doc.source, counts: doc.counts }; });
  const footer = { independence: previous.independence, semanticsPolicy: previous.semanticsPolicy,
    reviewNotes: [...REVIEW_NOTES, { id: 'full-source-semantic-review-20260906',
      lines: [20, 186, 267, 672, 743, 923, 946, 1561, 1903, 2248, 2481, 2484, 2499, 2572],
      status: 'source_grounded_review_amendment', decision: 'Apply the hash-bound independent review ledger; assertions remain required, references remain non-actions, prerequisites remain unevaluated, and no business authorization is inferred.' }],
    verification, sectionSummary: summary, reviewRevision: reviewRevision() };
  persist('018', 'review-provenance', `${JSON.stringify(footer, null, 2).slice(1).trimStart()}\n`);
} else if (command === 'promote') {
  const estimatedWrites = statSync(target).size * 3 + 131072;
  assert.ok(estimatedWrites < 32 * 1024 * 1024, 'Assembly plus backup/promotion write budget exceeded');
  const assembled = official(['assemble', '--session', session], 'v2-assembly');
  const bytes = readFileSync(assembled.outputPath), parsed = JSON.parse(bytes);
  assert.equal(parsed.source.sha256, SOURCE_SHA256);
  for (const section of SECTIONS) assert.deepEqual(parsed.sections[section.id], sectionDocument(oracle, section));
  assert.deepEqual(parsed.verification, verification);
  assert.deepEqual(parsed.reviewRevision, reviewRevision());
  official(['validate', '--session', session], 'v2-validation');
  const promoted = official(['promote', '--session', session], 'v2-promotion');
  assert.equal(hash(readFileSync(target)), hash(bytes));
  assert.equal(hash(readFileSync(promoted.backupPath)), priorHash);
  assert.equal(hash(readFileSync(join(directory, `${STEM}.md`))), SOURCE_SHA256);
  official(['cleanup', '--session', session, '--policy', 'keep'], 'v2-cleanup');
  const receipt = { sourceSha256: SOURCE_SHA256, oracleSha256: hash(bytes), priorOracleSha256: priorHash,
    backupPath: promoted.backupPath, estimatedWrites, reviewRevision: reviewRevision(), counts: verification,
    productionOutputsRead: false, businessCommandsExecuted: 0 };
  writeFileSync(join(run, 'v2-promoted-summary.json'), `${JSON.stringify(receipt)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify(receipt));
} else throw new Error('Use section <0..16>, footer, or promote');
