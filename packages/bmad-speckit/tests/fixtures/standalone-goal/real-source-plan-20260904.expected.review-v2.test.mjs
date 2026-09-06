import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./real-source-plan-20260904.md', import.meta.url));
const expected = JSON.parse(readFileSync(new URL('./real-source-plan-20260904.expected.json', import.meta.url), 'utf8'));
const blocks = expected.sections.flatMap(section => section.blocks);
const clauses = new Map(blocks.flatMap(block => block.semantics).map(clause => [clause.id, clause]));
const relations = expected.sections.flatMap(section => section.relations);
const commands = new Map(expected.sections.flatMap(section => section.commands).map(command => [command.id, command]));
const works = new Map(expected.sections.flatMap(section => section.works).map(work => [work.id, work]));
const sourceScenarioIds = [...source.toString('utf8').matchAll(/^#### (AC-\d{2}-S\d{2})[\uff1a:]/gm)].map(match => match[1]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('review amendments retain every original source byte and declare no business execution', () => {
  assert.equal(hash(source), '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
  for (const block of blocks) {
    assert.equal(source.subarray(block.source.byteStart, block.source.byteEnd).toString('utf8'), block.text);
    for (const clause of block.semantics) {
      assert.equal(source.subarray(clause.byteStart, clause.byteEnd).toString('utf8'), clause.text);
    }
  }
  assert.equal(expected.verification.businessCommandsExecuted, 0);
  assert.equal(works.size, 16);
});

test('a negative expected state never prohibits executing its required assertion', () => {
  const requiredAssertions = ['B1535:C3', 'B1592:C6', 'B1650:C1', 'B1668:C1', 'B1687:C2',
    'B1744:C7', 'B1763:C1', 'B1877:C1', 'B2020:C2', 'B2036:C1', 'B2206:C1', 'B2222:C1', 'B2254:C1'];
  for (const id of requiredAssertions) {
    assert.equal(clauses.get(id).polarity, 'required', id);
    assert.deepEqual(clauses.get(id).modalities, ['required'], id);
  }
});

test('unavailable replay and counters require the declared BLOCKED outcome', () => {
  for (const id of ['B1407:C1', 'B1749:C1']) {
    const clause = clauses.get(id);
    assert.equal(clause.polarity, 'required', id);
    assert.ok(clause.conditions.length, id);
    assert.ok(clause.expectedOutcome.declaredStatusCodes.some(code => code.startsWith('blocked_by_environment:')), id);
  }
});

test('lexical time words are not conditions and real fixture coverage inheritance survives', () => {
  for (const id of ['B1268:C1', 'B1270:C1', 'B1326:C4', 'B1707:C1', 'B2408:C1']) {
    assert.deepEqual(clauses.get(id).conditions, [], id);
  }
  const inherited = clauses.get('B1281:C1').conditions;
  assert.equal(inherited.length, 1);
  assert.equal(inherited[0].operator, 'fixture_required_coverage_point');
  assert.ok(clauses.get('B2094:C1').conditions.some(condition => condition.sourceLine === 2248));
  assert.ok(clauses.get('B2239:C2').conditions.length);
});

test('WORK15 retains all explicitly authorized test paths and its full pre-fix scenario command set', () => {
  const extraPaths = ['tests/characterization/test_legacy_indicator_chain_822c715e6.py',
    'tests/characterization/test_legacy_recorder_chain_822c715e6.py',
    'tests/characterization/test_legacy_callback_chain_822c715e6.py',
    'tests/characterization/test_legacy_main_contract_mapping_822c715e6.py',
    'tests/fixtures/dataservice_market_runtime_factory.py',
    'tests/characterization/test_dataservice_fixture_manifest.py',
    'tests/VALIDITY_DATASERVICE_TESTS.md', 'tests/integration/test_database_completed_idempotency.py'];
  for (const path of extraPaths) assert.ok(works.get('WORK-15').testPaths.includes(path), path);
  const red = commands.get('CMD-L2484-REF');
  assert.equal(red?.sourceRole, 'red_command');
  assert.equal(red?.worktree, 'candidate_pre_fix');
  const members = relations.filter(edge => edge.kind === 'command_set_includes' && edge.from === red.id);
  assert.equal(members.length, 40);
  const scenarios = members.map(edge => commands.get(edge.to)?.owner).filter(owner => owner?.startsWith('AC-'));
  assert.deepEqual(scenarios.sort(), [...sourceScenarioIds].sort());
  assert.equal(members.filter(edge => edge.to === 'CMD-L2484-1').length, 1);
  assert.deepEqual(works.get('WORK-15').scenarioIds, []);
});

test('WORK16 requires all 31 existing AC09-24 scenarios to pass before work, without claiming a pass', () => {
  const required = sourceScenarioIds.filter(id => Number(id.slice(3, 5)) >= 9).sort();
  assert.equal(required.length, 31);
  const gates = relations.filter(edge => edge.kind === 'requires_scenario_state' && edge.from === 'WORK-16');
  assert.deepEqual(gates.map(edge => edge.to).sort(), required);
  for (const gate of gates) {
    assert.equal(gate.requiredState, 'PASS');
    assert.equal(gate.applicability, 'before_WORK-16');
    assert.equal(gate.observedState, 'not_evaluated');
  }
  assert.deepEqual(works.get('WORK-16').scenarioIds, []);
  assert.equal(works.get('WORK-16').dependencies.length, 13);
  assert.ok(clauses.get('B2345:C2').conditions.some(condition => condition.applicability === 'before_WORK-16'));
});

test('source facts, condition introductions and AUDIT reference cells are not independent actions', () => {
  assert.equal(clauses.get('B0009:C1').polarity, 'descriptive');
  assert.equal(clauses.get('B0009:C2').disposition, 'condition_container');
  const references = blocks.filter(block => block.definedId?.startsWith('AUDIT-')).map(block => block.semantics.at(-1));
  assert.equal(references.length, 24);
  for (const clause of references) {
    assert.equal(clause.polarity, 'descriptive', clause.id);
    assert.equal(clause.disposition, 'association', clause.id);
    assert.equal(clause.expectedOutcome.kind, 'source_reference_only', clause.id);
  }
});

test('source acceptance actions and the explicit positive architecture exception keep required polarity', () => {
  for (const id of ['B0345:C2', 'B0591:C1', 'B0593:C2', 'B0629:C1', 'B0663:C2', 'B0664:C2', 'B0665:C2', 'B0794:C2', 'B0194:C2']) {
    assert.equal(clauses.get(id).polarity, 'required', id);
  }
  assert.ok(relations.some(edge => edge.kind === 'prohibited_architecture_alternative' && edge.to === 'B0194:C1'));
  assert.ok(relations.some(edge => edge.kind === 'required_architecture_choice' && edge.to === 'B0194:C2'));
  assert.equal(clauses.get('B0142:C2').actor, 'Supervisor\u3001Recorder\u3001\u9996\u6b21\u56fe\u8868 query');
  assert.equal(clauses.get('B0142:C2').ownershipContext, '\u67e5\u8be2\u5408\u7ea6\u7a97\u53e3');
});
