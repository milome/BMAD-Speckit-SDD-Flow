import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { amendments, applyFourReviewedPolarities, reviewRevision, hash } from './real-source-plan-20260904.expected.review-v3.mjs';
import { constructOracle, sectionDocument } from './real-source-plan-20260904.expected.oracle.mjs';
import { SECTIONS, SOURCE_SHA256 } from './real-source-plan-20260904.expected.profile.mjs';

const source = readFileSync(new URL('./real-source-plan-20260904.md', import.meta.url));
const expected = JSON.parse(readFileSync(new URL('./real-source-plan-20260904.expected.json', import.meta.url), 'utf8'));
const blocks = expected.sections.flatMap(section => section.blocks);
const clauses = new Map(blocks.flatMap(block => block.semantics).map(clause => [clause.id, clause]));

for (const amendment of amendments) test(`source-reviewed polarity and modalities: ${amendment.id} at L${amendment.line}`, () => {
  const clause = clauses.get(amendment.id);
  assert.equal(hash(source.subarray(...amendment.span)), amendment.textSha256);
  assert.deepEqual([clause.polarity, clause.modalities], amendment.after);
});

test('all explicit real-acceptance assertions retain required assertion polarity', () => {
  const assertions = blocks.filter(block => block.scope.facet === 'real_acceptance')
    .flatMap(block => block.semantics).filter(clause => clause.text.includes('\u65ad\u8a00'));
  assert.equal(assertions.length, 48);
  for (const clause of assertions) assert.equal(clause.polarity, 'required', clause.id);
});

test('replay destination and non-equivalence conventions agree with the same-source counterparts', () => {
  assert.equal(clauses.get('B0126:C2').polarity, clauses.get('B0997:C2').polarity);
  assert.equal(clauses.get('B1202:C1').polarity, clauses.get('B0132:C2').polarity);
  assert.equal(clauses.get('B0867:C2').polarity, 'required');
});

test('independent v2 reconstruction plus exactly four approved changes reproduces every source section', () => {
  assert.equal(hash(source), SOURCE_SHA256);
  const oracle = constructOracle();
  applyFourReviewedPolarities(oracle.blocks, source);
  for (const section of SECTIONS) assert.equal(hash(JSON.stringify(expected.sections[section.id])),
    hash(JSON.stringify(sectionDocument(oracle, section))), `section ${section.id} complete semantics`);
  assert.deepEqual(expected.reviewRevision, reviewRevision());
  assert.equal(expected.verification.businessCommandsExecuted, 0);
});

test('polarity amendments reject altered source, prior polarity and source spans', () => {
  const oracle = constructOracle();
  const changedSource = Buffer.from(source);
  changedSource[amendments[0].span[0]] ^= 1;
  assert.throws(() => applyFourReviewedPolarities(structuredClone(oracle.blocks), changedSource));
  for (const field of ['polarity', 'byteStart']) {
    const copy = structuredClone(oracle.blocks);
    const clause = copy.flatMap(block => block.semantics).find(clause => clause.id === amendments[0].id);
    clause[field] = field === 'polarity' ? 'required' : clause.byteStart + 1;
    assert.throws(() => applyFourReviewedPolarities(copy, source));
  }
});
