const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');

function extract(content) {
  return extractSourceObligations({ snapshot: buildSourceSnapshot({
    sourceType: 'source_plan', sourcePath: 'test-only/source-plan.md',
    rawBytes: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
  }) });
}

describe('source execution semantics without manufactured implementation tasks', () => {
  it('does not assign every nearby ID to acceptance, command, or evidence merely from a prose keyword', () => {
    const source = extract('# Requirements\n- REQ-ONE: MUST preserve evidence SHA-256 for command validation.\n' +
      '- AC-ONE: MUST check REQ-ONE acceptance without treating it as another acceptance ID.\n');
    const requirement = source.sourceObligations.find((row) => row.id === 'REQ-ONE');
    const acceptance = source.sourceObligations.find((row) => row.id === 'AC-ONE');
    assert.deepEqual(requirement.commandRefs, []);
    assert.deepEqual(requirement.evidenceRefs, []);
    assert.deepEqual(acceptance.acceptanceRefs, []);
    assert.ok(acceptance.typedRefs.some((ref) => ref.kind === 'requirement' && ref.targetId === 'REQ-ONE'));
  });

  it('retains optional technical guidance without manufacturing an action', () => {
    const source = extract('# Requirements\n- A cache may be used in `src/cache.ts`.\n');
    assert.equal(source.sourceObligations.length, 1);
    assert.equal(source.sourceObligations[0].executionRole, 'guidance');
    assert.equal(source.sourceObligations[0].normativeStrength, 'may');
    assert.equal(source.sourceObligations[0].required, false);
  });

  it('does not turn a pure prohibition into an implementation action', () => {
    const source = extract('# Requirements\n- Must not modify `legacy/data.csv`.\n');
    assert.equal(source.sourceObligations[0].executionRole, 'boundary');
    assert.equal(source.sourceObligations[0].polarity, 'forbidden');
  });

  it('preserves conditional gates as unevaluated and retains their original source scope', () => {
    const source = extract('# Requirements\n- If confirmation is missing, must not publish the package.\n');
    const row = source.sourceObligations[0];
    assert.equal(row.executionRole, 'boundary');
    assert.equal(row.required, false);
    assert.equal(row.conditions[0].state, 'unevaluated');
    assert.match(row.conditions[0].text, /If confirmation is missing/);
    assert.equal(row.applicability.scope, 'source_scope');
    assert.equal(row.applicability.sourceScope.kind, 'source_section');
    assert.ok(row.conditions[0].sourceRefs.every((ref) => row.provenanceRefs.includes(ref)));
  });

  it('preserves mixed clauses instead of turning a permission into a mandatory task', () => {
    const source = extract('# Requirements\n- Must retain the API, but may cache results.\n');
    const row = source.sourceObligations[0];
    assert.equal(row.executionRole, 'requirement');
    assert.equal(row.polarity, 'mixed');
    assert.deepEqual(row.normativeClauses[0].modalities, ['required', 'permitted']);
    assert.equal(row.normativeClauses[0].polarity, 'mixed');
  });

  it('assigns only source-declared WORK units to actions across the complete frozen fixture', () => {
    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/standalone-goal/real-source-plan-20260904.md'));
    assert.equal(fixture.length, 214296);
    assert.equal(createHash('sha256').update(fixture).digest('hex'),
      '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
    new TextDecoder('utf-8', { fatal: true }).decode(fixture);
    const source = extract(fixture);
    assert.deepEqual(source.sourceObligations.filter((row) => row.executionRole === 'action').map((row) => row.id),
      Array.from({ length: 16 }, (_, index) => `WORK-${String(index + 1).padStart(2, '0')}`));
    const byBlock = new Map(source.sourceBlocks.map((block) => [block.id, block]));
    for (const row of source.sourceObligations) {
      assert.ok(row.executionRole, `No semantic role for ${row.id}`);
      assert.deepEqual(row.normativeClauses,
        row.sourceBlockRefs.flatMap((ref) => byBlock.get(ref).clauses), `Lost clause semantics: ${row.id}`);
      assert.ok(row.provenanceRefs.every((ref) => byBlock.has(ref)), `Unknown source: ${row.id}`);
    }
    const scopeRow = source.sourceObligations.find((row) =>
      row.id !== 'WORK-05' && row.applicability.obligationRefs?.includes('WORK-05'));
    assert.ok(scopeRow, 'WORK-05 source scope must survive extraction');
  });
});
