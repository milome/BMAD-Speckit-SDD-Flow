import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constructOracle, sectionDocument, validateOracle } from './real-source-plan-20260904.expected.oracle.mjs';
import { SECTIONS, SOURCE_SHA256, STEM } from './real-source-plan-20260904.expected.profile.mjs';
import { amendments, applyFourDocumentRevision, applyFourReviewedPolarities, hash, PRIOR_ORACLE_SHA256, reviewRevision } from './real-source-plan-20260904.expected.review-v3.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const artifact = suffix => join(directory, `${STEM}.expected.${suffix}`);
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const same = (actual, expected, message) => assert.equal(hash(JSON.stringify(actual)), hash(JSON.stringify(expected)), message);

export function verifyCurrentFourReview() {
  const verification = json(artifact('verification.json'));
  const currentBytes = readFileSync(artifact('json'));
  const current = JSON.parse(currentBytes);
  const source = readFileSync(join(directory, `${STEM}.md`));
  assert.equal(hash(source), SOURCE_SHA256);
  assert.equal(hash(currentBytes), verification.oracleSha256);
  assert.deepEqual(current.reviewRevision, reviewRevision());
  assert.deepEqual(verification.reviewRevision, reviewRevision());
  for (const helper of verification.helperHashes) assert.equal(hash(readFileSync(join(directory, helper.file))), helper.sha256, helper.file);
  const priorBytes = readFileSync(verification.previousOracle.path);
  assert.equal(hash(priorBytes), PRIOR_ORACLE_SHA256);
  assert.equal(verification.previousOracle.sha256, PRIOR_ORACLE_SHA256);
  const previous = JSON.parse(priorBytes);
  same(current, applyFourDocumentRevision(previous, source), 'No document change except four polarity/modalities and revision provenance');
  const before = previous.sections.flatMap(section => section.blocks).flatMap(block => block.semantics);
  const after = current.sections.flatMap(section => section.blocks).flatMap(block => block.semantics);
  assert.equal(before.length, after.length);
  const changedIds = before.filter((clause, index) => JSON.stringify(clause) !== JSON.stringify(after[index])).map(clause => clause.id);
  assert.deepEqual(changedIds, amendments.map(amendment => amendment.id));
  for (const block of current.sections.flatMap(section => section.blocks)) {
    assert.equal(source.subarray(block.source.byteStart, block.source.byteEnd).toString('utf8'), block.text, block.id);
    for (const clause of block.semantics) assert.equal(source.subarray(clause.byteStart, clause.byteEnd).toString('utf8'), clause.text, clause.id);
  }
  const oracle = constructOracle();
  applyFourReviewedPolarities(oracle.blocks, source);
  for (const section of SECTIONS) same(current.sections[section.id], sectionDocument(oracle, section), `independent section ${section.id}`);
  same(current.verification, validateOracle(oracle), 'counts and coverage');
  const testEvidence = verification.independentTestEvidence.map(evidence => {
    const bytes = readFileSync(evidence.path);
    assert.equal(hash(bytes), evidence.sha256);
    const result = JSON.parse(bytes);
    assert.equal(result.exitCode, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.oracleSha256, hash(currentBytes));
    assert.equal(result.oracleUnchangedDuringRun, true);
    for (const stream of ['stdout', 'stderr']) assert.equal(hash(readFileSync(result[`${stream}Path`])), result[`${stream}Sha256`]);
    return { path: evidence.path, sha256: evidence.sha256, passed: result.passed, failed: result.failed, skipped: result.skipped };
  });
  return { schemaVersion: 'independent-oracle-final-integrity/v3', sourceSha256: SOURCE_SHA256,
    oracleSha256: hash(currentBytes), previousOracle: verification.previousOracle, reviewRevision: reviewRevision(),
    changedClauseCount: changedIds.length, changedClauseIds: changedIds, sourceBytesUnchanged: true,
    sourceTextAndSpansPreserved: true, helperHashesMatch: true, exactApprovedAmendmentsOnly: true,
    independentReconstructionMatches: true, testEvidence, counts: current.verification,
    businessCommandsExecuted: 0, businessAuthorizationGranted: false };
}
