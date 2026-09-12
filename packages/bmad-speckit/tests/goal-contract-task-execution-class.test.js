const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSourceSnapshot } = require('../src/utils/goal-contract/dual-view-derivation.ts');
const { extractSourceObligations } = require('../src/utils/goal-contract/source-obligation-extractor.ts');
const { buildSlotData } = require('../src/utils/goal-contract/slot-data-builder.ts');
const profile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../_bmad/shared/goal-contract/goal-contract-profile.json'), 'utf8'));

function sourceText() {
  return ['# Source Execution Roles', '', '## Implementation Tasks', '',
    '### Task ROLE-T01: Deliver runtime capability', '',
    '**Execution Class:** `executable_child`', '**Owned Production Paths:** the task\'s explicit Files section', '',
    '**Files**', '', '- Modify `src/runtime.ts`.', '',
    '- AC-ROLE-T01-01: Runtime capability is deterministic.', '- EVD-ROLE-T01-01: Runtime capability receipt.',
    '- CMD-ROLE-T01-01: Run `node --version`.', '',
    '### Task ROLE-T02: Verify aggregate evidence', '',
    '**Execution Class:** `aggregate_only`', '**Owned Production Paths:** `none`',
    '**Aggregate Gate Phase:** `final_aggregate`', '**Aggregate Validation Commands:** `CMD-ROLE-T02-01`', '',
    '**Files**', '', '- No production files.', '',
    '- AC-ROLE-T02-01: Aggregate evidence is deterministic.', '- EVD-ROLE-T02-01: Aggregate evidence receipt.',
    '- CMD-ROLE-T02-01: Run `node --help`.', ''].join('\n');
}

function extract(text = sourceText()) {
  return extractSourceObligations({ snapshot: buildSourceSnapshot({ sourceType: 'source_plan',
    sourcePath: 'test-only/task-execution-class.md', rawBytes: Buffer.from(text, 'utf8') }) });
}

describe('explicit task execution class source authority', () => {
  it('preserves task-local role fields and provenance without removing aggregate validation actions', () => {
    const source = extract();
    const action = (id) => source.sourceObligations.find((row) => row.id === id);
    const executable = action('ROLE-T01');
    const aggregate = action('ROLE-T02');
    assert.equal(executable.taskExecution?.executionClass, 'executable_child');
    assert.equal(aggregate.taskExecution?.executionClass, 'aggregate_only');
    assert.equal(aggregate.executionRole, 'action');
    assert.equal(aggregate.normativeStrength, 'must');
    assert.equal(aggregate.taskExecution.ownedProductionPaths, '`none`');
    assert.equal(aggregate.taskExecution.aggregateGatePhase, 'final_aggregate');
    assert.equal(aggregate.taskExecution.aggregateValidationCommandsValue, '`CMD-ROLE-T02-01`');
    assert.deepEqual(aggregate.taskExecution.aggregateValidationCommands, aggregate.commandRefs);
    assert.equal(aggregate.taskExecution.aggregateValidationCommands.length, 1);
    assert.ok(aggregate.taskExecution.sourceRefs.length > 0);
    for (const ref of aggregate.taskExecution.sourceRefs) {
      const block = source.sourceBlocks.find((item) => item.id === ref);
      assert.ok(block.scope.ownerId === 'ROLE-T02' || block.parentBlockRefs.some((id) => aggregate.sourceBlockRefs.includes(id)));
      assert.ok(aggregate.provenanceRefs.includes(ref));
    }
    assert.deepEqual(aggregate.acceptanceRefs, ['AC-ROLE-T02-01']);
    assert.deepEqual(aggregate.evidenceRefs, ['EVD-ROLE-T02-01']);
  });

  it('retains executable and aggregate role restrictions in their own Markdown task projections', () => {
    const slots = buildSlotData({ source: extract(), profile, outPath: 'test-only/goal.md',
      coverageReceiptPath: 'test-only/coverage.json', generationReceiptPath: 'test-only/generation.json' });
    const text = slots.slotData.implementationTasks;
    const executable = text.split('### ROLE-T01')[1].split('### ROLE-T02')[0];
    const aggregate = text.split('### ROLE-T02')[1];
    assert.match(executable, /\*\*Execution Class:\*\* `executable_child`/u);
    assert.match(aggregate, /\*\*Execution Class:\*\* `aggregate_only`/u);
    assert.match(aggregate, /\*\*Owned Production Paths:\*\* `none`/u);
    assert.match(aggregate, /\*\*Aggregate Gate Phase:\*\* `final_aggregate`/u);
    assert.match(aggregate, /\*\*Aggregate Validation Commands:\*\* `CMD-ROLE-T02-01`/u);
    assert.match(aggregate, /MUST NOT enter the executable child manifest/u);
    assert.match(aggregate, /MUST NOT create an atomic child commit/u);
    assert.match(aggregate, /source-command-[a-f0-9]{64}/u);
  });

  it('does not invent execution metadata for undeclared roles or inherit a sibling role', () => {
    const source = extract(sourceText().replace('**Execution Class:** `executable_child`\n**Owned Production Paths:** the task\'s explicit Files section\n', ''));
    assert.equal(source.sourceObligations.find((row) => row.id === 'ROLE-T01').taskExecution, undefined);
    assert.equal(source.sourceObligations.find((row) => row.id === 'ROLE-T02').taskExecution?.executionClass, 'aggregate_only');
  });

  it('retains a standalone owned-path declaration without requiring an undeclared execution class', () => {
    const source = extract(sourceText().replace('**Execution Class:** `executable_child`\n', ''));
    assert.equal(source.sourceObligations.find((row) => row.id === 'ROLE-T01').taskExecution, undefined);
    assert.ok(source.sourceRelations.some((edge) => edge.kind === 'path' && edge.pathRole === 'owned' && edge.toId === 'src/runtime.ts'));
  });

  it('rejects conflicting declarations for the same task', () => {
    assert.throws(() => extract(sourceText().replace('**Execution Class:** `aggregate_only`',
      '**Execution Class:** `aggregate_only`\n**Execution Class:** `executable_child`')),
    /source_task_execution_role_ambiguous/u);
  });

  it('rejects aggregate-only fields without an explicit execution class', () => {
    assert.throws(() => extract(sourceText().replace('**Execution Class:** `aggregate_only`\n', '')),
      /source_task_execution_role_invalid/u);
  });

  it('rejects an aggregate gate with an unknown phase or unresolved command', () => {
    assert.throws(() => extract(sourceText().replace('`final_aggregate`', '`before_children`')),
      /source_aggregate_task_contract_invalid/u);
    assert.throws(() => extract(sourceText().replace('**Aggregate Validation Commands:** `CMD-ROLE-T02-01`',
      '**Aggregate Validation Commands:** `CMD-UNKNOWN-01`')), /source_aggregate_task_contract_invalid/u);
  });

  it('retains an explicit reference to a separately declared command with both declaration premises', () => {
    const source = extract(sourceText().replace('**Aggregate Validation Commands:** `CMD-ROLE-T02-01`',
      '**Aggregate Validation Commands:** `CMD-ROLE-T01-01`'));
    const aggregate = source.sourceObligations.find((row) => row.id === 'ROLE-T02');
    const command = source.sourceObligations.find((row) => row.id === 'CMD-ROLE-T01-01');
    assert.deepEqual(aggregate.taskExecution.aggregateValidationCommands, command.commandDeclarations.map((row) => row.id));
    assert.ok(command.sourceBlockRefs.every((ref) => aggregate.taskExecution.sourceRefs.includes(ref)));
  });

  it('rejects production ownership for aggregate-only execution', () => {
    assert.throws(() => extract(sourceText().replace('**Owned Production Paths:** `none`',
      '**Owned Production Paths:** `src/runtime.ts`')), /source_aggregate_task_contract_invalid/u);
  });
});
