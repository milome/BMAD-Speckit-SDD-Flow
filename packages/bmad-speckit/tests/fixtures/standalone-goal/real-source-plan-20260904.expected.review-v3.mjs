import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SOURCE_SHA256 } from './real-source-plan-20260904.expected.profile.mjs';
import { reviewRevision as previousRevision } from './real-source-plan-20260904.expected.review-v2.mjs';

export const PRIOR_ORACLE_SHA256 = 'ba347af541505663c597a910cda33d1dc699d2aeb58b647d376352e3ed97f99a';
export const REVIEW_RECEIPT_SHA256 = '724a374b10d69970a1310c1188280560bd8fc26345459cc3cb971f1234271378';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const amendments = [
  { id: 'B0126:C2', line: 170, span: [9696, 9873], textSha256: '97e2aa36e67026bc1b3646fc53612eeb675553c8b58fa3d2baa09dc1d9444014',
    before: ['forbidden', ['forbidden']], after: ['mixed', ['required', 'forbidden']] },
  { id: 'B0238:C2', line: 317, span: [19234, 19339], textSha256: 'dcd55e4da1df47cd6b11fc8eeb4e6e0adae334820d6e41c0978be9227f913e7a',
    before: ['mixed', ['required', 'forbidden']], after: ['required', ['required']] },
  { id: 'B0791:C1', line: 870, span: [57913, 57969], textSha256: 'cadf28d5ae0340b95afb0b1e4ca2bf9994d43cc171a828ea93c301a934a2c41f',
    before: ['forbidden', ['forbidden']], after: ['required', ['required']] },
  { id: 'B1202:C1', line: 1342, span: [90404, 90521], textSha256: 'a9de485f8fdda6e98482bb0597512addeaa09f832f7859af3145f9cec6221102',
    before: ['forbidden', ['forbidden']], after: ['mixed', ['required', 'forbidden']] },
];

export function reviewRevision() {
  return { revisionId: 'source-four-polarity-review-20260906', sourceSha256: SOURCE_SHA256,
    priorOracleSha256: PRIOR_ORACLE_SHA256, reviewReceiptSha256: REVIEW_RECEIPT_SHA256,
    reviewers: ['/root/canonical_proof', '/root'], reviewedClauseAmendments: 4,
    reviewedStructuralOperations: 0, priorReviewRevision: previousRevision(),
    productionOutputUsed: false, businessAuthorizationGranted: false };
}

export function applyFourReviewedPolarities(blocks, source) {
  assert.equal(hash(source), SOURCE_SHA256);
  const clauses = new Map(blocks.flatMap(block => block.semantics).map(clause => [clause.id, clause]));
  for (const amendment of amendments) {
    const clause = clauses.get(amendment.id);
    assert.ok(clause, amendment.id);
    assert.deepEqual([clause.byteStart, clause.byteEnd], amendment.span);
    const text = source.subarray(...amendment.span);
    assert.equal(hash(text), amendment.textSha256);
    assert.equal(text.toString('utf8'), clause.text);
    assert.deepEqual([clause.polarity, clause.modalities], amendment.before, amendment.id);
    [clause.polarity, clause.modalities] = structuredClone(amendment.after);
  }
  return blocks;
}

export function applyFourDocumentRevision(previous, source) {
  const current = structuredClone(previous);
  assert.deepEqual(current.reviewRevision, previousRevision());
  applyFourReviewedPolarities(current.sections.flatMap(section => section.blocks), source);
  current.reviewRevision = reviewRevision();
  return current;
}
