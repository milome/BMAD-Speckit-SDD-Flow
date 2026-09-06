const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');
const { makeRegistries } = require('../src/utils/goal-contract/slot-data-builder.ts');

function extract(source) {
  return extractSourceObligations({ snapshot: buildSourceSnapshot({ sourceType: 'source_plan',
    sourcePath: 'test-only/explicit-bindings.md', rawBytes: Buffer.from(source, 'utf8') }) });
}

test('an exact ID references chain is a source-backed association, not an implementation action', () => {
  const result = extract('# Source\n- J04 references BCR-C01 references BCR-T01\n');
  const block = result.sourceBlocks.find((row) => row.kind === 'list_item');
  assert.equal(block.disposition, 'association');
  assert.equal(result.sourceObligations[0].executionRole, 'binding');
  assert.equal(result.sourceObligations[0].normativeStrength, 'must');
  assert.ok(result.sourceObligations[0].sourceBlockRefs.includes(block.id));
});

test('incidental mentions are not upgraded into explicit reference bindings', () => {
  const result = extract('# Notes\n## Background\n- The old reviewer mentions BCR-C01 and BCR-T01.\n');
  assert.equal(result.sourceBlocks.find((row) => row.kind === 'list_item').disposition, 'background');
  assert.equal(result.sourceObligations.length, 0);
});

test('a current remains excluded declaration is a forbidden boundary', () => {
  const result = extract('# Source\n## Deterministic NOT DONE\n- Sequence producer remains excluded.\n');
  assert.equal(result.sourceObligations[0].polarity, 'forbidden');
  assert.equal(result.sourceObligations[0].executionRole, 'boundary');
  assert.equal(result.sourceObligations[0].normativeStrength, 'must');
});

test('historical and background exclusions do not become current execution prohibitions', () => {
  for (const heading of ['Background', 'Historical evidence']) {
    const result = extract(`# Source\n## ${heading}\n- Sequence producer is excluded.\n`);
    const block = result.sourceBlocks.find((row) => row.kind === 'list_item');
    assert.equal(block.clauses[0].polarity, 'descriptive');
    assert.equal(result.sourceObligations.length, 0);
  }
});

test('an explicit applicability field retains its unevaluated when condition', () => {
  const result = extract('# Source\n## Applicability\n- Applicability: core-only when sequence mode is disabled.\n');
  const row = result.sourceObligations[0];
  assert.equal(row.executionRole, 'binding');
  assert.equal(row.applicabilityState, 'conditional');
  assert.equal(row.conditions[0].state, 'unevaluated');
  assert.match(row.conditions[0].text, /when sequence mode is disabled/);
  assert.ok(row.conditions[0].sourceRefs.every((ref) => row.provenanceRefs.includes(ref)));
});

test('empty blockquote markers remain exactly located source blocks without becoming obligations', () => {
  const text = '# Source\n>\n>\n';
  const result = extract(text);
  const quotes = result.sourceBlocks.filter((row) => row.kind === 'blockquote');
  assert.equal(quotes.length, 2);
  for (const quote of quotes) {
    assert.equal(quote.disposition, 'structure');
    assert.equal(Buffer.from(text).subarray(quote.sourceRef.startByte, quote.sourceRef.endByteExclusive).toString('utf8'), '>\n');
    assert.ok(!result.sourceObligations.some((row) => row.sourceBlockRefs.includes(quote.id)));
  }
});

test('an explicit acceptance field can use a real FIX criterion without relabeling all FIX references', () => {
  const result = extract('# Source\n### FIX-05: Preserve fixture behavior\n- MUST preserve the frozen assertions.\n'
    + '### WORK-02: Verify fixtures\n- Acceptance: FIX-05.\n- Fix reference: FIX-05.\n');
  const acceptance = result.sourceBlocks.find((row) => row.fieldRole === 'acceptance_reference');
  const reference = result.sourceBlocks.find((row) => row.fieldRole === 'fix_reference');
  const relation = acceptance.typedRefs.find((row) => row.kind === 'acceptance');
  assert.equal(relation.targetId, 'FIX-05');
  assert.equal(relation.targetKind, 'fix');
  assert.equal(relation.relationRole, 'acceptance_criterion');
  assert.ok(relation.sourceBlockRefs.includes(acceptance.id));
  assert.ok(acceptance.typedRefs.some((row) => row.kind === 'fix' && row.targetId === 'FIX-05'));
  assert.ok(!reference.typedRefs.some((row) => row.kind === 'acceptance'));
  assert.ok(result.sourceObligations.find((row) => row.id === 'WORK-02').acceptanceRefs.includes('FIX-05'));
  assert.ok(makeRegistries(result.sourceObligations).acceptance.includes('FIX-05'));
});
