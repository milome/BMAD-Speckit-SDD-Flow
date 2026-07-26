const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildSourceSnapshot,
} = require('../src/utils/goal-contract/dual-view-derivation.ts');
const {
  canonicalSourceObligationGraph,
  extractSourceObligations,
  hashSourceObligationGraph,
} = require('../src/utils/goal-contract/source-obligation-extractor.ts');

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

  it('preserves declared identity and exact snapshot bindings', () => {
    const rawBytes = Buffer.from(
      '# Plan\r\n## Implementation Tasks\r\n- [ ] PLAN-T01: Preserve exact bytes.\r\n',
      'utf8'
    );
    const snapshot = buildSourceSnapshot({
      sourceType: 'source_plan',
      sourcePath: 'docs/plans/source.md',
      rawBytes,
      sourcePlanSemanticHash: `sha256:${'a'.repeat(64)}`,
    });
    const result = extractSourceObligations({ snapshot });
    const obligation = result.sourceObligations.find((item) => item.id === 'PLAN-T01');

    assert.equal(result.sourceSnapshotHash, snapshot.aggregateHash);
    assert.equal(obligation.declaredId, true);
    assert.equal(obligation.normativeStrength, 'must');
    assert.equal(obligation.sourceSnapshotHash, snapshot.aggregateHash);
    assert.equal(obligation.sourcePlanHash, snapshot.aggregateHash);
    assert.equal(obligation.exactText, '- [ ] PLAN-T01: Preserve exact bytes.');
    assert.deepEqual(obligation.headingPath, ['Plan', 'Implementation Tasks']);
  });

  it('recognizes task headings and limits dependencies to explicit relation fragments', () => {
    const sourceText = [
      '# Plan',
      '',
      '## Tasks',
      '',
      '### Task P04-T04: Bind Shared-Artifact Changes to Dependency Compatibility Receipts',
      '',
      '```json',
      '{"rules":[{"ruleId":"PM-001","normativeRule":"Validate dependency direction."}]}',
      '```',
      '',
      '- [ ] P05-T01: Dependencies: P04-T04; mention PM-002 as evidence.',
      '',
    ].join('\n');
    const result = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: 'docs/plans/source.md',
        rawBytes: Buffer.from(sourceText, 'utf8'),
      }),
    });
    const heading = result.sourceObligations.find((item) => item.id === 'P04-T04');
    const codeBlock = result.sourceObligations.find(
      (item) => item.kind === 'command_block'
    );
    const dependentTask = result.sourceObligations.find((item) => item.id === 'P05-T01');

    assert.equal(heading.declaredId, true);
    assert.deepEqual(heading.dependencyRefs, []);
    assert.deepEqual(codeBlock.dependencyRefs, []);
    assert.deepEqual(dependentTask.dependencyRefs, ['P04-T04']);
  });

  it('accepts deterministic permissions and explicit optional argument fallbacks', () => {
    const sourceText = [
      '# Dynamic Compiler Implementation Plan',
      '',
      '> Workers may inspect evidence, but they must not modify repository files.',
      '',
      '## Global Implementation Rules',
      '',
      '- Sequence Closure may supply typed constraints only. It must not create tasks.',
      '',
      '## Task P01-T01: Load the profile',
      '',
      'The schema must constrain classification to the three allowed values.',
      '',
      'Add optional `--release-receipt`; otherwise use the default receipt path.',
      '',
      '## P01 Slice Gate',
      '',
      '- Different source shapes can produce different counts.',
      '',
    ].join('\n');

    const result = extractSourceObligations({
      snapshot: buildSourceSnapshot({
        sourceType: 'source_plan',
        sourcePath: 'docs/plans/source.md',
        rawBytes: Buffer.from(sourceText, 'utf8'),
      }),
    });
    const preamble = result.sourceObligations.find((item) =>
      item.exactText.startsWith('> Workers may inspect evidence')
    );

    assert.equal(preamble.kind, 'heading_requirement');
    assert.ok(result.sourceObligations.some((item) => item.id === 'P01-T01'));
  });

  it('fails closed on duplicate IDs, unknown dependencies, and ambiguous execution prose', () => {
    const extract = (text) =>
      extractSourceObligations({
        snapshot: buildSourceSnapshot({
          sourceType: 'source_plan',
          sourcePath: 'docs/plans/source.md',
          rawBytes: Buffer.from(text, 'utf8'),
        }),
      });

    assert.throws(
      () => extract('# Plan\n## Tasks\n- [ ] PLAN-T01: First.\n- [ ] PLAN-T01: Second.\n'),
      (error) => error.failureClass === 'source_obligation_id_duplicate'
    );
    assert.throws(
      () => extract('# Plan\n## Tasks\n- [ ] PLAN-T01: MUST depend on PLAN-T99.\n'),
      (error) => error.failureClass === 'source_obligation_dependency_unknown'
    );
    assert.throws(
      () => extract('# Plan\n## Tasks\n- [ ] PLAN-T01: Might change execution scope.\n'),
      (error) => error.failureClass === 'source_obligation_classification_ambiguous'
    );
  });

  it('derives stable fallback IDs that change with exact text', () => {
    const extract = (text) =>
      extractSourceObligations({
        snapshot: buildSourceSnapshot({
          sourceType: 'source_plan',
          sourcePath: 'docs/plans/source.md',
          rawBytes: Buffer.from(`# Plan\n## Tasks\n- MUST ${text}.\n`, 'utf8'),
        }),
      }).sourceObligations.find((item) => item.exactText.startsWith('- MUST'));
    const first = extract('preserve exact bytes');
    const repeated = extract('preserve exact bytes');
    const changed = extract('preserve changed bytes');

    assert.equal(first.id, repeated.id);
    assert.notEqual(first.id, changed.id);
    assert.equal(first.declaredId, false);
  });

  it('binds a canonical typed source-obligation graph to semantic source changes', () => {
    const sourceText = [
      '# Plan',
      '## Tasks',
      '### Task PLAN-T01: Create the acceptance compiler',
      '- [ ] PLAN-T02: Dependencies: PLAN-T01; Atomic group: PLAN-T01.',
      '## Acceptance Criteria',
      '- [ ] PLAN-AC01: Acceptance requires PLAN-T02.',
      '## Required Test Commands',
      '- [ ] PLAN-CMD01: Run `node --test compiler.test.js`.',
      '## Completion Evidence Packet',
      '- [ ] PLAN-EVD01: Evidence receipt produced by PLAN-CMD01.',
      '## Example',
      '```json',
      '{"taskId":"EXAMPLE-T01"}',
      '```',
      '',
    ].join('\n');
    const extract = (text) =>
      extractSourceObligations({
        snapshot: buildSourceSnapshot({
          sourceType: 'source_plan',
          sourcePath: 'docs/plans/structured-source.md',
          rawBytes: Buffer.from(text, 'utf8'),
        }),
      });
    const extracted = extract(sourceText);

    assert.match(extracted.sourceObligationGraphHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(
      extracted.sourceObligationGraph.schemaVersion,
      'goal-contract-source-obligation-graph/v1'
    );
    assert.deepEqual(
      new Set(
        extracted.sourceObligations
          .filter((item) => item.declaredId)
          .map((item) => item.kind)
      ),
      new Set([
        'declared_execution_task',
        'acceptance_condition',
        'verification_command',
        'evidence_contract',
      ])
    );

    const reordered = extracted.sourceObligations.map((item) => ({
      ...item,
      taskRefs: [...item.taskRefs].reverse(),
      acceptanceRefs: [...item.acceptanceRefs].reverse(),
      commandRefs: [...item.commandRefs].reverse(),
      evidenceRefs: [...item.evidenceRefs].reverse(),
      dependencyRefs: [...item.dependencyRefs].reverse(),
      atomicGroupRefs: [...item.atomicGroupRefs].reverse(),
    }));
    assert.equal(
      hashSourceObligationGraph(
        canonicalSourceObligationGraph({
          sourceSnapshotHash: extracted.sourceSnapshotHash,
          sourceObligations: reordered,
        })
      ),
      extracted.sourceObligationGraphHash
    );
    assert.notEqual(
      extract(
        sourceText.replace(
          'Create the acceptance compiler',
          'Create the projection compiler'
        )
      )
        .sourceObligationGraphHash,
      extracted.sourceObligationGraphHash
    );
    assert.notEqual(
      extract(sourceText.replace('Dependencies: PLAN-T01', 'Dependencies: PLAN-AC01'))
        .sourceObligationGraphHash,
      extracted.sourceObligationGraphHash
    );
    assert.notEqual(
      extract(sourceText.replace('Atomic group: PLAN-T01', 'Atomic group: PLAN-AC01'))
        .sourceObligationGraphHash,
      extracted.sourceObligationGraphHash
    );
    assert.ok(
      extracted.sourceObligations
        .filter((item) => item.headingPath.includes('Example'))
        .every(
          (item) =>
            ![
              'declared_execution_task',
              'acceptance_condition',
              'verification_command',
              'evidence_contract',
            ].includes(item.kind)
        )
    );
  });
});
