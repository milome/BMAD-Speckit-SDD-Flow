const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');
const { materializeFullFixture } = require('./fixtures/standalone-goal/canonical-full-fixture.cjs');

const materializedFixture = materializeFullFixture();
process.on('exit', () => {
  try {
    fs.rmSync(materializedFixture.root, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for the process-scoped fixture workspace.
  }
});
const fixturePath = materializedFixture.legacySourcePath;
const sourceHash = '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a';

// Source-reviewed facts, not a complete semantic oracle or a compiler-generated golden.
describe('frozen real Source Plan: extraction regressions', () => {
  let bytes;
  let lines;
  let obligations;
  before(() => {
    bytes = fs.readFileSync(fixturePath);
    assert.equal(bytes.length, 214296);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceHash);
    const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    lines = sourceText.split(/\r?\n/u);
    obligations = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: 'docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md',
        rawBytes: bytes,
      }),
    }).sourceObligations;
  });

  it('requires the full, readable, byte-identical UTF-8 fixture', () => {
    assert.equal(lines.length, 2643);
    assert.ok(obligations.length > 0);
  });

  it('does not promote the section-14 structural title into a required obligation', () => {
    assert.match(lines[2565], /^## 14\./u);
    const promoted = obligations.filter((row) =>
      row.lineStart === 2566 && row.lineEnd === 2566 && row.required
    );
    assert.equal(promoted.length, 0, 'A section title alone does not impose a requirement');
  });

  it('preserves all 24 normative AUDIT table rows with their own source spans', () => {
    const ids = ['B', 'M'].flatMap((family) => Array.from(
      { length: family === 'B' ? 6 : 18 },
      (_, index) => `AUDIT-${family}${String(index + 1).padStart(2, '0')}`
    ));
    const missing = ids.filter((id) => {
      const index = lines.findIndex((line) => line.startsWith('|') && line.includes(id));
      assert.ok(index >= 916 && index < 947, `Source-reviewed AUDIT row missing: ${id}`);
      return !obligations.some((row) => row.lineStart <= index + 1 &&
        row.lineEnd >= index + 1 && row.exactText.includes(id));
    });
    assert.deepEqual(missing, [], 'Normative table content cannot be silently discarded');
  });

  it('does not turn the 13 normative formula/flow fences into executable commands', () => {
    const starts = lines.flatMap((line, index) => /^```text\s*$/u.test(line) ? [index + 1] : []);
    assert.equal(starts.length, 13);
    const misclassified = starts.filter((start) => obligations.some((row) =>
      row.lineStart === start && ['command_block', 'verification_command'].includes(row.kind)
    ));
    assert.deepEqual(misclassified, [], 'Formula/flow authority must retain its non-command role');
  });

  it('recognizes the source-exact Chinese-labeled AC-08 pytest command', () => {
    assert.ok(lines[1615].includes('test_missing_period_start_is_repaired_without_later_minute_fallback'));
    const row = obligations.find((item) => item.lineStart === 1616);
    assert.ok(row, 'The inline scenario command must not be omitted');
    assert.ok(['command_block', 'verification_command'].includes(row.kind),
      `The real pytest command was classified as ${row.kind}`);
  });

  it('preserves the explicit WORK-05 predecessor relation without inferring ID order', () => {
    const row = obligations.find((item) => item.id === 'WORK-05');
    assert.ok(row, 'The source declares WORK-05 at line 2317');
    assert.deepEqual([...row.dependencyRefs].sort(), ['WORK-02', 'WORK-03']);
  });

  it('keeps relationship declarations out of the sparse semantic obligation view', () => {
    assert.equal(obligations.length, 1525, 'lossless compatibility view must remain source-bound');
    assert.equal(extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: 'docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md',
        rawBytes: bytes,
      }),
    }).semanticObligations.length, 1140);
    const result = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: 'docs/plans/2026-09-04-dataservice-cold-hot-legacy-chain-source-plan.md',
        rawBytes: bytes,
      }),
    });
    assert.deepEqual(
      [...new Set(result.semanticObligations.map((row) => row.executionRole))].sort(),
      ['acceptance', 'action', 'boundary', 'guidance', 'requirement']
    );
    assert.equal(result.semanticObligations.some((row) => ['binding', 'definition'].includes(row.executionRole)), false);
    for (const line of [964, 989, 1202, 1428]) {
      const block = result.sourceBlocks.find((row) => row.sourceRef.lineStart === line);
      assert.ok(block);
      assert.notEqual(block.disposition, 'normative', `special source list at line ${line} lost its role`);
      assert.ok(result.semanticObligations.some((row) => row.sourceBlockRefs.includes(block.id)));
    }
  });
});
