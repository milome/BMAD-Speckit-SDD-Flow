import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SOURCE_SHA256 } from './real-source-plan-20260904.expected.profile.mjs';

const indexUrl = new URL('./real-source-plan-20260904.expected.review-v2.index.json', import.meta.url);
const indexBytes = readFileSync(indexUrl);
const index = JSON.parse(indexBytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(index.sourceSha256, SOURCE_SHA256);
const entries = index.files.flatMap(file => {
  const bytes = readFileSync(new URL(file.file, import.meta.url));
  assert.ok(bytes.length < 8192, file.file);
  assert.equal(hash(bytes), file.sha256, file.file);
  const data = JSON.parse(bytes);
  assert.equal(data.sourceSha256, SOURCE_SHA256);
  assert.equal(data.priorOracleSha256, index.priorOracleSha256);
  assert.equal(data.amendments.length, file.records);
  return data.amendments.map(amendment => ({ kind: file.kind, amendment }));
});
const clauseAmendments = entries.filter(entry => entry.kind === 'clauses').map(entry => entry.amendment);
const structuralAmendments = entries.filter(entry => entry.kind === 'structure').map(entry => entry.amendment);
assert.equal(clauseAmendments.length, index.clauses);
assert.equal(structuralAmendments.length, index.structuralOperations);
assert.equal(new Set(clauseAmendments.map(item => item.clauseId)).size, index.clauses);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function reviewRevision() {
  return { revisionId: index.revisionId, sourceSha256: SOURCE_SHA256,
    priorOracleSha256: index.priorOracleSha256, amendmentIndexSha256: hash(indexBytes),
    reviewedClauseAmendments: index.clauses, reviewedStructuralOperations: index.structuralOperations,
    productionOutputUsed: false, businessAuthorizationGranted: false };
}

export function applyReviewedAmendments(oracle) {
  assert.equal(hash(oracle.source.bytes), SOURCE_SHA256);
  const clauses = new Map(oracle.blocks.flatMap(block => block.semantics).map(clause => [clause.id, clause]));
  for (const amendment of clauseAmendments) {
    const clause = clauses.get(amendment.clauseId);
    assert.ok(clause, amendment.clauseId);
    const bytes = oracle.source.bytes.subarray(amendment.source.byteStart, amendment.source.byteEnd);
    assert.equal(hash(bytes), amendment.source.textSha256, amendment.clauseId);
    assert.equal(bytes.toString('utf8'), clause.text, amendment.clauseId);
    for (const [field, value] of Object.entries(amendment.expected)) {
      assert.deepEqual(clause[field], value, `${clause.id}.${field} prior reviewed value`);
    }
    for (const field of Object.keys(amendment.set)) {
      assert.ok(['polarity', 'modalities', 'conditions', 'disposition', 'expectedOutcome', 'actor', 'ownershipContext'].includes(field));
      if (!(field in amendment.expected)) assert.equal(field in clause, false, `${clause.id}.${field} must be absent`);
    }
    Object.assign(clause, structuredClone(amendment.set));
  }
  for (const amendment of structuralAmendments) {
    const value = structuredClone(amendment.value);
    if (amendment.op === 'append_relation') {
      assert.ok(!oracle.relations.some(edge => equal(edge, value)), amendment.issueCode);
      oracle.relations.push(value);
    } else if (amendment.op === 'replace_relation') {
      const position = oracle.relations.findIndex(edge => equal(edge, amendment.expected));
      assert.ok(position >= 0, amendment.issueCode);
      oracle.relations[position] = value;
    } else if (amendment.op === 'append_command') {
      assert.ok(!oracle.commands.some(command => command.id === value.id));
      oracle.commands.push(value);
    } else {
      const work = oracle.works.find(work => work.id === amendment.workId);
      assert.ok(work, amendment.workId);
      const field = amendment.op === 'append_work_test_path' ? 'testPaths' : 'commandIds';
      assert.ok(['append_work_test_path', 'append_work_command_id'].includes(amendment.op));
      assert.ok(!work[field].includes(value));
      work[field].push(value);
    }
  }
  return oracle;
}

export function verifyReviewedAmendments(oracle) {
  const clauses = new Map(oracle.blocks.flatMap(block => block.semantics).map(clause => [clause.id, clause]));
  for (const amendment of clauseAmendments) for (const [field, value] of Object.entries(amendment.set)) {
    assert.deepEqual(clauses.get(amendment.clauseId)?.[field], value, `${amendment.clauseId}.${field}`);
  }
  for (const amendment of structuralAmendments) {
    if (amendment.op.endsWith('_relation')) assert.ok(oracle.relations.some(edge => equal(edge, amendment.value)), amendment.issueCode);
    else if (amendment.op === 'append_command') assert.ok(oracle.commands.some(command => equal(command, amendment.value)));
    else {
      const work = oracle.works.find(work => work.id === amendment.workId);
      const field = amendment.op === 'append_work_test_path' ? 'testPaths' : 'commandIds';
      assert.ok(work?.[field].includes(amendment.value), amendment.issueCode);
    }
  }
  return reviewRevision();
}
