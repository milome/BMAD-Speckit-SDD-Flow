const { describe, it } = require('node:test');
const assert = require('node:assert');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor');

const SOURCE_PATH = 'docs/plans/source-plan.md';
const SOURCE_TEXT = [
  '# Repair Plan',
  '',
  '## File Map',
  '',
  '- Create `packages/bmad-speckit/src/commands/goal-contract.ts`.',
  '',
  '## Implementation Task Breakdown',
  '',
  '### Task 1: Add CLI',
  '',
  '- [ ] Parse `--source` and `--out` flags.',
  '',
  'Run:',
  '',
  '```powershell',
  'npx --no-install bmad-speckit goal-contract generate --source docs/plans/source.md --out docs/plans/goal.md --json',
  '```',
  '',
  '## Completion Evidence Packet',
  '',
  '- Coverage receipt must exist.',
  '',
  '## Release Sequencing',
  '',
  '- Run release gate before publication.',
  '',
  '## Risk Controls',
  '',
  '- Stop when source coverage is unmapped.',
  '',
].join('\r\n');

describe('goal-contract source obligation extractor', () => {
  it('emits stable source obligations with source metadata and text hashes', () => {
    const result = extractSourceObligations({
      sourcePath: SOURCE_PATH,
      sourceText: SOURCE_TEXT,
    });

    assert.equal(result.sourcePlanPath, SOURCE_PATH);
    assert.match(result.sourcePlanHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(result.sourceBytes, Buffer.byteLength(SOURCE_TEXT, 'utf8'));
    assert.equal(result.sourceLines, SOURCE_TEXT.replace(/\r\n/g, '\n').split('\n').length);
    assert.equal(result.sourceObligations[0].id, 'SRC001');
    assert.deepEqual(
      result.sourceObligations.map((obligation) => obligation.id),
      result.sourceObligations.map((_obligation, index) => `SRC${String(index + 1).padStart(3, '0')}`)
    );
    assert.ok(result.sourceObligations.some((obligation) => obligation.kind === 'file_map'));
    assert.ok(result.sourceObligations.some((obligation) => obligation.kind === 'command_block'));
    assert.ok(result.sourceObligations.some((obligation) => obligation.kind === 'completion_criteria'));
    assert.ok(result.sourceObligations.some((obligation) => obligation.kind === 'release_gate'));
    assert.ok(result.sourceObligations.some((obligation) => obligation.kind === 'failure_handling'));
    for (const obligation of result.sourceObligations) {
      assert.match(obligation.textHash, /^sha256:[0-9a-f]{64}$/u);
      assert.equal(obligation.sourcePlanHash, result.sourcePlanHash);
      assert.match(obligation.summary, /^sourceRef=docs\/plans\/source-plan\.md:\d+-\d+; sourceKind=[a-z_]+; sourceTextHash=sha256:[0-9a-f]{64}$/u);
      assert.doesNotMatch(obligation.summary, /\boptional\b|可选|或/u);
      assert.ok(obligation.lineStart >= 1);
      assert.ok(obligation.lineEnd >= obligation.lineStart);
      assert.equal(obligation.required, true);
    }
  });
});
