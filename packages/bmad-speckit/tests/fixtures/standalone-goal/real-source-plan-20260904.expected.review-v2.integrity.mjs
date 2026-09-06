import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constructOracle, sectionDocument, validateOracle } from './real-source-plan-20260904.expected.oracle.mjs';
import { hash } from './real-source-plan-20260904.expected.blocks.mjs';
import { SECTIONS, SOURCE_SHA256, STEM } from './real-source-plan-20260904.expected.profile.mjs';
import { applyReviewedAmendments, reviewRevision, verifyReviewedAmendments } from './real-source-plan-20260904.expected.review-v2.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const artifact = suffix => join(directory, `${STEM}.expected.${suffix}`);
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function verifyCurrentReview() {
  const verification = json(artifact('verification.json'));
  const currentBytes = readFileSync(artifact('json'));
  const current = JSON.parse(currentBytes);
  assert.equal(hash(currentBytes), verification.oracleSha256);
  assert.equal(hash(readFileSync(join(directory, `${STEM}.md`))), SOURCE_SHA256);
  assert.deepEqual(current.reviewRevision, reviewRevision());
  assert.deepEqual(verification.reviewRevision, reviewRevision());
  for (const helper of verification.helperHashes) assert.equal(hash(readFileSync(join(directory, helper.file))), helper.sha256);
  const oracle = constructOracle();
  assert.deepEqual(current.verification, validateOracle(oracle));
  verifyReviewedAmendments(oracle);
  for (const section of SECTIONS) assert.deepEqual(current.sections[section.id], sectionDocument(oracle, section));
  const priorPath = verification.previousOracle.path;
  assert.ok(statSync(priorPath).size < 32 * 1024 * 1024);
  const priorBytes = readFileSync(priorPath);
  assert.equal(hash(priorBytes), reviewRevision().priorOracleSha256);
  const prior = JSON.parse(priorBytes);
  const flat = { source: oracle.source };
  for (const field of ['blocks', 'commands', 'relations', 'scenarios', 'works']) {
    flat[field] = structuredClone(prior.sections.flatMap(section => section[field]));
  }
  applyReviewedAmendments(flat);
  for (const section of SECTIONS) assert.deepEqual(current.sections[section.id], sectionDocument(flat, section));
  assert.deepEqual(current.source, prior.source);
  assert.deepEqual(current.sections.flatMap(section => section.scenarios), prior.sections.flatMap(section => section.scenarios));
  const testEvidence = verification.independentTestEvidence.map(evidence => {
    const bytes = readFileSync(evidence.path);
    assert.equal(hash(bytes), evidence.sha256);
    const report = JSON.parse(bytes);
    assert.equal(report.exitCode, 0);
    assert.equal(report.failed, 0);
    assert.equal(report.oracleSha256, hash(currentBytes));
    for (const stream of ['stdout', 'stderr']) {
      const log = readFileSync(report[`${stream}Path`]);
      assert.equal(hash(log), report[`${stream}Sha256`]);
    }
    return { path: evidence.path, sha256: evidence.sha256, passed: report.passed, failed: report.failed };
  });
  const before = prior.sections.flatMap(section => section.blocks).flatMap(block => block.semantics);
  const after = current.sections.flatMap(section => section.blocks).flatMap(block => block.semantics);
  const changed = before.filter((clause, index) => JSON.stringify(clause) !== JSON.stringify(after[index]));
  assert.equal(changed.length, reviewRevision().reviewedClauseAmendments);
  return { schemaVersion: 'independent-oracle-final-integrity/v2', sourceSha256: SOURCE_SHA256,
    oracleSha256: hash(currentBytes), previousOracle: verification.previousOracle,
    reviewRevision: reviewRevision(), changedClauseCount: changed.length,
    sourceBytesUnchanged: true, sourceTextAndSpansPreserved: true, helperHashesMatch: true,
    exactApprovedAmendmentsOnly: true, independentReconstructionMatches: true, testEvidence,
    counts: current.verification, businessCommandsExecuted: 0, businessAuthorizationGranted: false };
}
