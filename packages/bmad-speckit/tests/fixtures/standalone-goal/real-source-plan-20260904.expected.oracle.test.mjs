import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import './real-source-plan-20260904.expected.review-v2.test.mjs';
import './real-source-plan-20260904.expected.review-v3.test.mjs';
import { SCENARIOS, SECTIONS, SOURCE_BYTES, SOURCE_SHA256, STEM, WORKS } from './real-source-plan-20260904.expected.profile.mjs';

const directory=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(directory,`${STEM}.md`));
const manifest=JSON.parse(readFileSync(join(directory,`${STEM}.expected.json`),'utf8'));
const blocks=manifest.sections.flatMap(section=>section.blocks);
const commands=manifest.sections.flatMap(section=>section.commands);
const relations=manifest.sections.flatMap(section=>section.relations);
const scenarios=manifest.sections.flatMap(section=>section.scenarios);
const works=manifest.sections.flatMap(section=>section.works);
const at=line=>blocks.find(block=>block.source.lineStart<=line && block.source.lineEnd>=line);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('expected oracle binds the exact independently reviewed source and covers every byte once',()=>{
  assert.equal(source.length,SOURCE_BYTES);
  assert.equal(hash(source),SOURCE_SHA256);
  let offset=0;
  for (const block of blocks) {
    assert.equal(block.source.byteStart,offset,block.id);
    const raw=source.subarray(offset,block.source.byteEnd);
    assert.equal(hash(raw),block.source.textSha256,block.id);
    assert.deepEqual(Buffer.from(block.text),raw,block.id);
    assert.ok(block.disposition && block.reason,block.id);
    offset=block.source.byteEnd;
  }
  assert.equal(offset,SOURCE_BYTES);
  assert.deepEqual(manifest.verification.uncoveredByteRanges,[]);
  assert.deepEqual(manifest.verification.unexplainedBlocks,[]);
});

test('all metadata and sixteen source sections have independent hash-bound coverage',()=>{
  assert.deepEqual(manifest.sections.map(section=>[section.id,section.start,section.end]),SECTIONS.map(section=>[section.id,section.start,section.end]));
  for (const section of manifest.sections) {
    assert.equal(section.status,'independently_reviewed');
    assert.equal(section.blocks[0].source.lineStart,section.start);
    assert.equal(section.blocks.at(-1).source.lineEnd,section.end);
    assert.equal(hash(source.subarray(section.source.byteStart,section.source.byteEnd)),section.source.textSha256);
    assert.equal(section.counts.blocks,section.blocks.length);
    assert.deepEqual(section.unexplainedBlocks,[]);
  }
});

test('headings and unchecked review items are not execution tasks or successful results',()=>{
  assert.equal(at(2240).disposition,'structure');
  assert.equal(at(271).disposition,'structure');
  assert.equal(at(2614).disposition,'review_pending');
  assert.equal(at(2642).disposition,'review_pending');
  assert.equal(works.length,16);
  assert.equal(scenarios.length,39);
  assert.equal(at(1).disposition,'metadata');
  assert.ok(manifest.reviewNotes.some(note=>note.id==='source-review-pending'));
});

test('all 24 AUDIT rows remain normative and retain their complete source binding expression',()=>{
  const audit=blocks.filter(block=>block.definedId?.startsWith('AUDIT-'));
  assert.equal(audit.length,24);
  for (const block of audit) {
    assert.equal(block.disposition,'normative');
    const edge=relations.find(item=>item.kind==='audit_declared_binding' && item.from===block.definedId);
    assert.ok(edge?.bindingExpression,block.definedId);
  }
});

test('all five FIX facets are preserved without promoting current defects to desired behavior',()=>{
  for (let index=1;index<=17;index++) {
    const id=`FIX-${String(index).padStart(2,'0')}`;
    const owned=blocks.filter(block=>block.context.fix===id && block.kind!=='blank');
    assert.equal(new Set(owned.map(block=>block.context.facet).filter(Boolean)).size,5,id);
    assert.ok(owned.some(block=>block.disposition==='baseline_fact'),id);
    assert.ok(owned.some(block=>block.disposition==='observed_deviation'),id);
  }
  assert.equal(at(294).disposition,'observed_deviation');
  assert.equal(at(304).disposition,'normative');
});

test('ownership table inherits required and forbidden column semantics from its header',()=>{
  for (let line=186;line<=196;line++) {
    const row=at(line);
    assert.deepEqual(row.semantics.map(item=>item.polarity),['required','forbidden']);
    assert.ok(row.semantics.every(item=>item.actor && item.conditionAuthorityLine===184));
  }
});

test('observed user issues are repair targets, never required defective outcomes',()=>{
  for (let line=46;line<=56;line++) {
    const block=at(line);
    assert.equal(block.disposition,'observed_user_issue');
    assert.ok(block.semantics.every(item=>item.polarity==='descriptive'));
    assert.ok(relations.some(edge=>edge.kind==='repair_target' && edge.from==='REQ-GOAL-003' && edge.to===block.id));
    assert.ok(block.semantics.every(item=>item.expectedOutcome.kind==='repair_the_observed_issue_not_reproduce_it'));
  }
});

test('optimization allowlist and unchanged behavior inherit distinct permissions and prohibitions',()=>{
  for (let line=62;line<=69;line++) {
    assert.equal(at(line).disposition,'permitted_optimization_location');
    assert.ok(at(line).semantics.every(item=>item.polarity==='permitted'));
  }
  for (let line=73;line<=82;line++) {
    assert.equal(at(line).disposition,'preserved_behavior');
    assert.ok(at(line).semantics.every(item=>item.polarity==='preserve'));
    assert.ok(at(line).semantics.every(item=>item.conditions.some(condition=>condition.sourceLine===71 && condition.effect==='forbid_change_during_performance_optimization')));
  }
});

test('pending confirmation and current-round scope are explicit conditions, not permanent work prohibitions',()=>{
  for (let line=22;line<=27;line++) {
    assert.ok(at(line).semantics.every(item=>item.conditions.some(condition=>condition.sourceLine===20 && condition.operator==='until_confirmation')));
    assert.ok(at(line).semantics.every(item=>item.scope.kind==='current_source_authoring_round'));
  }
  assert.ok(at(28).semantics[0].conditions.some(condition=>condition.operator==='current_round_only'));
  assert.ok(at(30).semantics[0].conditions.some(condition=>condition.operator==='current_round_only'));
  assert.ok(works.every(work=>work.inheritedSourceGates.some(gate=>gate.sourceLine===20)));
  assert.ok(works.every(work=>work.executionAuthorization==='not_granted_by_source_fixture'));
});

test('historical CSV observations do not hide active evidence permissions and proof prohibitions',()=>{
  const csv=at(1463);
  assert.equal(csv.disposition,'mixed_evidence_and_normative');
  assert.ok(csv.semantics.some(item=>item.disposition==='historical_evidence'));
  assert.ok(csv.semantics.some(item=>item.polarity==='permitted'));
  assert.ok(csv.semantics.some(item=>item.expectedOutcome.kind==='forbid_claiming_unsupported_proof' && item.text.includes('Trigger/Recorder IPC')));
  assert.ok(at(1452).semantics.some(item=>item.expectedOutcome.kind==='fixture_008_gate_remains_active'));
  for (let line=1454;line<=1466;line++) {
    if (line===1463) continue;
    assert.ok(at(line).semantics.every(item=>item.expectedOutcome.kind==='not_a_current_run_result'));
  }
});

test('source permissions and common negative verbs retain effective modality',()=>{
  assert.ok(at(230).semantics.some(item=>item.modalities.includes('permitted') && item.modalities.includes('required') && item.modalities.includes('forbidden')));
  assert.ok(at(374).semantics.some(item=>item.polarity==='forbidden'));
  assert.ok(at(209).semantics.some(item=>item.polarity==='forbidden'));
});

test('FIX-03 deviation heading does not erase the DataService authority prohibition',()=>{
  const block=at(368);
  assert.equal(block.disposition,'normative');
  assert.equal(block.semantics[0].polarity,'forbidden');
  assert.deepEqual(block.semantics[0].modalities,['forbidden']);
  assert.equal(block.semantics[0].expectedOutcome.kind,'forbid_dataservice_authoritative_data_construction_or_write');
  assert.ok(relations.some(edge=>edge.kind==='effective_fix_boundary' && edge.from===block.semantics[0].id && edge.to==='FIX-03'));
  assert.equal(at(366).disposition,'observed_deviation');
});

test('FIX-05 fake and idle timer statement retains its active production proof boundary',()=>{
  const block=at(438);
  assert.equal(block.disposition,'evidence_use_boundary');
  assert.equal(block.semantics[0].polarity,'forbidden');
  assert.equal(block.semantics[0].expectedOutcome.kind,'forbid_claiming_unsupported_proof');
  for (const id of ['REQ-TEST-003','NOT-DONE-025']) {
    assert.ok(relations.some(edge=>edge.kind==='same_source_boundary' && edge.from===block.semantics[0].id && edge.to===id));
  }
  assert.equal(at(437).disposition,'observed_deviation');
});

for (const line of [92,93]) {
  test(`authority ordering at source line ${line} preserves its own prohibition`,()=>{
    const block=at(line);
    assert.equal(block.semantics[0].polarity,'forbidden');
    assert.deepEqual(block.semantics[0].modalities,['forbidden']);
    assert.ok(block.semantics[0].conditions.some(condition=>condition.sourceLine===86));
    const edge=relations.find(item=>item.kind==='authority_precedence' && item.to===block.id);
    assert.deepEqual(edge.effectivePolarities,['forbidden']);
    assert.equal(edge.grantsAuthority,false);
  });
}

for (const [line,clause,polarity] of [
  [178,2,'forbidden'],[864,1,'required'],[864,2,'forbidden'],[1012,1,'forbidden'],[1051,2,'forbidden'],
  [2242,1,'required'],[2506,2,'forbidden'],[2530,1,'forbidden'],[2546,1,'forbidden'],
  [2550,1,'forbidden'],[2552,1,'forbidden'],
]) {
  test(`reviewed clause L${line}:C${clause} excludes quoted, object, and negated lexical modalities`,()=>{
    const semantic=at(line).semantics[clause-1];
    assert.equal(semantic.polarity,polarity);
    assert.deepEqual(semantic.modalities,[polarity]);
    assert.equal(semantic.modalityAuthority,'independent_source_clause_review');
  });
}

test('hot storage representation and deletion prohibition bind to their complete source clause literals',()=>{
  const [representation,deletion]=at(864).semantics;
  assert.equal(representation.text,'- hot completed\u4f7f\u7528identity map\u52a0\u6709\u5e8f\u89c6\u56fe\uFF1B');
  assert.equal(deletion.text,'Recorder ACK\u3001TTL\u3001\u56fa\u5b9a\u6570\u91cf\u548cwall-clock\u5747\u4e0d\u80fd\u5220\u9664\u5b83\u3002');
  assert.equal(representation.polarity,'required');
  assert.deepEqual(representation.modalities,['required']);
  assert.equal(deletion.polarity,'forbidden');
  assert.deepEqual(deletion.modalities,['forbidden']);
});

test('the single transaction requirement retains the prohibition on per-interval transactions',()=>{
  const clause=at(779).semantics[0];
  assert.equal(clause.text,'- `save_bar_data(list)`\u5fc5\u987b\u4f7f\u7528\u73b0\u6709`vnpy_sqlite/vnpy_sqlite/sqlite_database.py`\u5355\u4e2a`db.atomic()`\u4e8b\u52a1\uff0c\u4e0d\u4e3a\u6bcf\u4e2ainterval\u5f00\u542f\u72ec\u7acb\u4e8b\u52a1\u3002');
  assert.equal(clause.polarity,'mixed');
  assert.deepEqual(clause.modalities,['required','forbidden']);
});

test('the current live blocker is historical source status, not a requirement to remain blocked',()=>{
  const clause=at(1467).semantics[0];
  assert.equal(clause.text,'- \u5f53\u524d\u5b9e\u65f6\u963b\u585e\u4e3a `blocked_until_market_open:live_callback_cross_minute_sequence` \u548c `blocked_until_market_open:live_actual_contract_switch_sequence`\u3002');
  assert.equal(clause.polarity,'descriptive');
  assert.equal(clause.disposition,'historical_evidence');
  assert.equal(clause.expectedOutcome.kind,'not_a_current_run_result');
});

test('offline evidence usage remains permitted while the distinct live proof prohibition stays active',()=>{
  const [status,usage,prohibition]=at(1467).semantics;
  assert.equal(usage.text,'\u5386\u53f2 CSV/Parquet \u548c\u5408\u5e76\u5386\u53f2 Tick \u7528\u4e8e\u79bb\u7ebf\u5f00\u53d1\u3001\u79bb\u7ebf\u529f\u80fd\u9a8c\u8bc1\u4e0e\u6027\u80fd\u5bf9\u7167\uff1b');
  assert.equal(at(1467).disposition,'mixed_evidence_and_normative');
  assert.equal(usage.polarity,'permitted');
  assert.equal(usage.disposition,'evidence_use_boundary');
  assert.equal(usage.expectedOutcome.kind,'declared_permitted_offline_uses');
  assert.equal(prohibition.polarity,'forbidden');
  assert.ok(prohibition.conditions.length);
  assert.notEqual(status.scope.kind,'current_run_result');
});

test('thirteen text formula or flow fences are normative content, never shell commands',()=>{
  const fences=blocks.filter(block=>block.kind==='fence');
  assert.equal(fences.length,14);
  for (const block of fences.filter(item=>item.text.startsWith('```text'))) {
    assert.equal(block.disposition,'normative');
    assert.equal(commands.some(command=>command.blockId===block.id),false);
  }
  assert.equal(at(38).context.namedOwner,'REQ-GOAL-002');
  assert.equal(commands.filter(command=>command.role==='authoring_command').length,1);
});

test('39 source-declared scenario commands keep nodeids, product paths, evidence, and task relations separate',()=>{
  for (const expected of SCENARIOS) {
    const scenario=scenarios.find(item=>item.id===expected.id);
    assert.deepEqual(scenario.works,expected.works);
    assert.equal(scenario.commandIds.length,1);
    const command=commands.find(item=>item.id===scenario.commandIds[0]);
    assert.ok(command.expression.includes(scenario.nodeid),scenario.id);
    assert.equal(command.executionStatus,'not_executed');
    assert.ok(scenario.productPaths.every(item=>!item.raw.includes('python -m') && !item.raw.includes('::')));
    assert.ok(scenario.evidence.length,scenario.id);
    assert.ok(scenario.directAssertions.length && scenario.teardown.length,scenario.id);
  }
});

test('16 work dependencies are exact and range references are expanded only to existing work IDs',()=>{
  for (const expected of WORKS) {
    assert.deepEqual(works.find(item=>item.id===expected.id).dependencies,expected.dependencies,expected.id);
  }
  assert.deepEqual(works.find(item=>item.id==='WORK-15').dependencies,['WORK-08','WORK-09','WORK-10','WORK-11','WORK-12','WORK-13','WORK-14']);
});

test('same-command green references preserve stage and original expression, but do not imply AC coverage',()=>{
  const red=commands.find(item=>item.owner==='WORK-05' && item.role==='red_command');
  const green=commands.find(item=>item.owner==='WORK-05' && item.role==='green_command');
  assert.equal(green.derivedFrom,red.id);
  assert.equal(green.expression,red.expression);
  assert.equal(green.expression.includes('test_missing_period_start_is_repaired_without_later_minute_fallback'),false);
  assert.equal(works.find(item=>item.id==='WORK-05').commandCoverage,'source_declared_not_demonstrated');
  assert.ok(scenarios.find(item=>item.id==='AC-08-S01').works.includes('WORK-05'));
  assert.ok(manifest.reviewNotes.some(note=>note.id==='work-11-command-scope' && note.status==='coverage_not_proven'));
});

test('negation, conditions, source outcomes, and verdicts survive without trusting a BLOCKED label',()=>{
  assert.equal(at(2512).semantics[0].polarity,'forbidden');
  assert.ok(at(2244).semantics.some(item=>item.conditions.length));
  const barrier=at(1770);
  assert.equal(barrier.fieldRole,'blocked_criterion');
  assert.ok(barrier.semantics.some(item=>item.expectedOutcome.declaredVerdicts.includes('FAIL')));
  assert.ok(relations.some(item=>item.kind==='global_boundary' && item.from==='NOT-DONE-001'));
});

test('historical PASS, live blockers, authoring permission, and command portability remain unproven',()=>{
  assert.equal(at(1460).disposition,'historical_evidence');
  assert.ok(at(1460).semantics.every(item=>item.expectedOutcome.kind==='not_a_current_run_result'));
  assert.ok(manifest.reviewNotes.some(note=>note.id==='offline-live-exception'));
  assert.equal(commands.find(item=>item.role==='authoring_command').authorization,'requires_source_user_confirmation');
  assert.ok(commands.filter(item=>item.expression?.includes('*')).every(item=>item.portability==='glob_unverified'));
  assert.equal(manifest.verification.businessCommandsExecuted,0);
  assert.equal(manifest.independence.productionExtractorOutputUsed,false);
});

test('scenario mapping table is a cross-reference and final command sets retain their explicit references',()=>{
  assert.equal(relations.filter(item=>item.kind==='scenario_cross_reference').length,24);
  const finalGreen=commands.find(item=>item.blockId===at(2485).id);
  assert.equal(finalGreen.role,'source_command_set');
  assert.equal(relations.filter(item=>item.kind==='command_set_includes' && item.from===finalGreen.id).length,40);
  const finalWork=works.find(item=>item.id==='WORK-16');
  assert.equal(finalWork.scopeInheritance.length,12);
  assert.ok(finalWork.productPaths.length>0);
});
