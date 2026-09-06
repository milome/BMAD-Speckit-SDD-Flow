import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { inlineValues } from './real-source-plan-20260904.expected.blocks.mjs';
import { REVIEWED_CLAUSE_RULES, SCENARIOS, WORKS } from './real-source-plan-20260904.expected.profile.mjs';

const COMMAND = /^(?:python -m |npm exec |git (?:status|diff|add) |\$env:QT_QPA_PLATFORM=)/u;
const PATH = /^(?:\.?\.?\/)?(?:[A-Za-z0-9_.-]+\/)+[^\s]+$/u;
const IDS = /\b(?:WORK-\d{2}|AC-\d{2}(?:-S\d{2})?|FIX-\d{2}|AUDIT-[BM]\d{2}|REQ-[A-Z]+-\d{3}|PERF-\d{3}|FIXTURE-\d{3}|CONTRACT-\d{3}|DIRTY-\d{3}|NOT-DONE-\d{3})\b/gu;
const idsOf = text => [...new Set([...text.matchAll(IDS)].map(match=>match[0]))];
const isPath = value => PATH.test(value) && !value.includes('::') && !COMMAND.test(value);
const ownerOf = block => block.context.scenario || block.context.work || block.definedId || block.context.namedOwner || `SECTION-${block.context.section}`;
const textField = (blocks,role) => blocks.filter(block=>block.fieldRole===role).map(block=>({blockId:block.id,text:block.text}));

function pathItems(block) {
  return inlineValues(block.text).filter(isPath).map(raw=>({raw,resolved:raw}));
}

function evidenceItems(block) {
  let directory = null;
  return inlineValues(block.text).filter(value=>isPath(value) || /^[\w.-]+\.(?:json|npz|log|md)$/u.test(value)).map(raw=>{
    if (isPath(raw)) directory=posix.dirname(raw);
    return { raw, resolved:isPath(raw) ? raw : directory ? `${directory}/${raw}` : null,
      resolution:isPath(raw) ? 'explicit' : directory ? 'same_evidence_list_directory' : 'unqualified_source_name' };
  });
}

export function buildCommands(blocks) {
  const commands=[];
  const lastRed=new Map();
  for (const block of blocks) {
    let expressions=inlineValues(block.text).filter(value=>COMMAND.test(value));
    if (block.kind==='fence' && block.text.startsWith('```powershell')) {
      expressions=[block.text.split(/\r?\n/u).slice(1,-2).join('\n')];
    }
    const role=block.fieldRole;
    const alias=role==='green_command' && !expressions.length && /\u540c\u4e00\u547d\u4ee4/u.test(block.text)
      ? lastRed.get(block.context.work) : null;
    if (alias) expressions=[alias.expression];
    for (const [index,expression] of expressions.entries()) {
      const prohibited=expression==='git add -A';
      const template=/<[^>]+>|\.\.\./u.test(expression);
      const environmentOnly=expression.startsWith('$env:') && !expression.includes('python -m');
      const command={
        id:`CMD-L${block.source.lineStart}-${index+1}`, blockId:block.id, owner:ownerOf(block), expression,
        role:prohibited ? 'prohibited_command' : template ? 'command_template' : environmentOnly ? 'environment_setting'
          : block.context.section===14 ? 'authoring_command' : role || 'global_verification_command',
        occurrence:'source_declared', executionStatus:'not_executed',
        worktree:block.context.work==='WORK-01' ? role==='green_command' ? '822c715e6_readonly_worktree' : 'candidate_pre_fix'
          : block.context.work==='WORK-15' && role==='red_command' ? 'candidate_pre_fix' : 'source_context',
        expectedExit:role==='red_command' ? 'source_requires_a_real_red_result' : role==='green_command' ? 'source_requires_success' : 'source_context',
        derivedFrom:alias ? alias.id : null, declaredContext:block.text,
        pytestSelectors:[...expression.matchAll(/(?:^|\s)(tests\/[^\s`]+\.py(?:::[^\s`]+)?)/gu)].map(match=>match[1]),
        portability:expression.includes('*') ? 'glob_unverified' : 'not_executed',
        authorization:prohibited ? 'forbidden' : block.context.section===14 ? 'requires_source_user_confirmation' : 'not_granted_by_oracle',
      };
      commands.push(command);
      if (role==='red_command') lastRed.set(block.context.work,command);
    }
  }
  for (const block of blocks.filter(item=>item.fieldRole?.endsWith('_command'))) {
    if (commands.some(command=>command.blockId===block.id)) continue;
    commands.push({
      id:`CMD-L${block.source.lineStart}-REF`,blockId:block.id,owner:ownerOf(block),expression:null,
      role:'source_command_set',sourceRole:block.fieldRole,declaredContext:block.text,
      occurrence:'source_declared',executionStatus:'not_executed',pytestSelectors:[],
      derivedFrom:null,portability:'requires_source_reference_expansion',authorization:'not_granted_by_oracle',
    });
  }
  return commands;
}

export function buildScenarios(blocks,commands) {
  return SCENARIOS.map(profile=>{
    const owned=blocks.filter(block=>block.context.scenario===profile.id);
    const refs=owned.filter(block=>block.fieldRole==='work_reference').flatMap(block=>idsOf(block.text).filter(id=>id.startsWith('WORK-')));
    assert.deepEqual(refs,profile.works,`Independent work mapping differs at ${profile.id}`);
    const test=owned.find(block=>block.fieldRole==='test_nodeid');
    const nodeids=inlineValues(test.text).filter(value=>value.startsWith('tests/') && value.includes('::'));
    assert.equal(nodeids.length,1,profile.id);
    const scenarioCommands=commands.filter(command=>command.owner===profile.id);
    assert.equal(scenarioCommands.length,1,`One exact command required for ${profile.id}`);
    return {
      ...profile, blockIds:owned.map(block=>block.id),
      productPaths:owned.filter(block=>block.fieldRole==='product_paths').flatMap(pathItems),
      nodeid:nodeids[0], testFile:nodeids[0].split('::')[0], commandIds:scenarioCommands.map(command=>command.id),
      evidence:owned.filter(block=>block.fieldRole==='evidence').flatMap(evidenceItems),
      fixIds:owned.filter(block=>block.fieldRole==='fix_reference').flatMap(block=>idsOf(block.text)),
      initialState:textField(owned,'initial_state'), productionEntry:textField(owned,'production_entry'),
      operations:textField(owned,'operations'), directAssertions:textField(owned,'direct_assertions'),
      pass:textField(owned,'pass_criterion'), fail:textField(owned,'fail_criterion'),
      blocked:textField(owned,'blocked_criterion'), teardown:textField(owned,'teardown'),
      inheritedSourceGates:['SECTION-1','SECTION-3','SECTION-9','SECTION-10','SECTION-13','SECTION-15'],
      resultStatus:'acceptance_declared_not_executed',
    };
  });
}

export function buildWorks(blocks,commands,scenarios) {
  const result=WORKS.map(profile=>{
    const owned=blocks.filter(block=>block.context.work===profile.id);
    const directTests=owned.filter(block=>block.fieldRole==='test_paths').flatMap(pathItems).map(item=>item.resolved);
    const referencedTests=scenarios.filter(scenario=>profile.testFamilies.includes(scenario.id.slice(0,5))).map(scenario=>scenario.testFile);
    return {
      ...profile, blockIds:owned.map(block=>block.id),
      dependencyAssertions:textField(owned,'dependencies'),
      dependencyState:profile.id==='WORK-15' ? 'all_green' : profile.id==='WORK-16' ? 'all_complete_and_listed_scenarios_pass' : 'source_prerequisite',
      productPaths:owned.filter(block=>block.fieldRole==='product_paths').flatMap(pathItems),
      testPaths:[...new Set([...directTests,...referencedTests])],
      scopeInheritance:profile.id==='WORK-16' ? WORKS.slice(2,14).map(work=>work.id) : [],
      scenarioIds:scenarios.filter(scenario=>scenario.works.includes(profile.id)).map(scenario=>scenario.id),
      commandIds:commands.filter(command=>command.owner===profile.id).map(command=>command.id),
      purpose:textField(owned,'purpose'), steps:textField(owned,'implementation_steps'),
      red:textField(owned,'red_command'), green:textField(owned,'green_command'), regression:textField(owned,'regression_command'),
      evidence:owned.filter(block=>block.fieldRole==='evidence').flatMap(evidenceItems),
      pass:textField(owned,'pass_criterion'), failOrBlocked:textField(owned,'fail_or_blocked_criterion'),
      teardown:textField(owned,'teardown'), stop:textField(owned,'stop_condition'),
      boundaries:owned.filter(block=>block.fieldRole==='delete_targets').map(block=>({blockId:block.id,text:block.text})),
      commandCoverage:'source_declared_not_demonstrated',
      inheritedSourceGates:[
        {sourceLine:20,kind:'pending_source_confirmation',applicability:'current_source_authoring_round'},
        {sourceSection:3,kind:'authority_precedence',applicability:'all_work'},
        {sourceSection:9,kind:'real_verification_requirements',applicability:'all_verification'},
        {sourceLine:2244,kind:'precontract_fixture_gate',applicability:'contract_generation'},
        {sourceLine:2246,kind:'quality_gate',applicability:'after_modifying_python'},
        {sourceSection:13,kind:'non_goals',applicability:'all_implementation'},
        {sourceSection:15,kind:'dirty_worktree_protection',applicability:'all_file_changes_and_staging'},
      ],
      executionAuthorization:'not_granted_by_source_fixture',
    };
  });
  const final=result.at(-1);
  final.productPaths=[...new Map(result.slice(2,14).flatMap(work=>work.productPaths).map(item=>[item.resolved,item])).values()];
  final.testPaths=[...new Set([...result.slice(2,14).flatMap(work=>work.testPaths),...final.testPaths])];
  return result;
}

export function buildRelations(blocks,commands,scenarios,works) {
  const edges=[];
  const add=(kind,from,to,blockId,detail={})=>edges.push({kind,from,to,blockId,...detail});
  for (const block of blocks) {
    const owner=ownerOf(block);
    if (block.definedId) add('defines',block.id,block.definedId,block.id);
    else if (block.context.namedOwner && block.disposition!=='layout') add('elaborates',block.id,block.context.namedOwner,block.id);
    if (block.context.fix && block.context.facet) add('fix_facet',block.id,block.context.fix,block.id,{facet:block.context.facet});
    for (const rule of REVIEWED_CLAUSE_RULES.filter(item=>item.line===block.source.lineStart)) {
      const clause=block.semantics[rule.clause-1];
      if (rule.disposition && block.context.fix) add('effective_fix_boundary',clause.id,block.context.fix,block.id,{
        sourceLine:rule.line,polarity:clause.polarity,headingDoesNotRemoveNormativeForce:true,
      });
      for (const related of rule.relatedBoundaries || []) add('same_source_boundary',clause.id,related.id,block.id,{
        sourceLine:rule.line,relatedSourceLine:related.line,relationshipBasis:'independent_source_semantic_review',
      });
    }
    if (block.inheritedRule) add(block.inheritedRule.relation,block.inheritedRule.parentId,block.id,block.id,{
      sourceLine:block.inheritedRule.parentLine,effect:block.inheritedRule.effect,
      inheritance:'explicit_reviewed_parent_list_semantics',
      ...(block.inheritedRule.relation==='authority_precedence'
        ? {effectivePolarities:block.semantics.map(item=>item.polarity),grantsAuthority:false} : {}),
    });
    if (block.source.lineStart>=22 && block.source.lineStart<=27) add('conditional_authoring_prohibition',block.id,'SOURCE_USER_CONFIRMATION_GATE',block.id,{
      sourceLine:20,operator:'until_confirmation',applicability:'current_source_authoring_round',
    });
    for (const reference of idsOf(block.text)) {
      if (reference!==owner && reference!==block.definedId) add('source_mentions',owner,reference,block.id);
    }
    if (block.disposition==='normative' && ['global_prohibitions','worktree_gate','global_verification','authority_order','global_goal'].includes(block.scope.kind)) {
      add('global_boundary',block.definedId || block.id,'ALL_WORKS',block.id,{polarity:block.semantics.map(item=>item.polarity)});
    }
    if (block.source.lineStart>=1931 && block.source.lineStart<=1954) {
      const cells=block.text.split('|').slice(1,-1).map(value=>value.trim());
      add('scenario_cross_reference',block.id,cells[0],block.id,{workIds:idsOf(cells[1]),nodeids:inlineValues(cells[3]),evidence:inlineValues(cells[4])});
    }
    if (block.definedId?.startsWith('AUDIT-')) {
      const cells=block.text.split('|').slice(1,-1).map(value=>value.trim());
      add('audit_declared_binding',block.definedId,'SOURCE_REFERENCE_EXPRESSION',block.id,{
        bindingExpression:cells[2],explicitIds:idsOf(cells[2]),
        meaning:'Preserve the complete source binding; no invented task or executed proof is implied.',
      });
    }
    if (block.disposition==='scope_declaration' && block.context.work) {
      add('work_scope_declaration',block.context.work,block.id,block.id,{scopeExpression:block.text});
    }
    if (block.kind==='review_item') add('pending_human_review',block.id,'SOURCE_HUMAN_REVIEW',block.id,{state:'unchecked'});
  }
  for (const scenario of scenarios) {
    for (const work of scenario.works) add('scenario_implemented_by',scenario.id,work,scenario.blockIds[0]);
    add('scenario_test_nodeid',scenario.id,scenario.nodeid,scenario.blockIds[0]);
    for (const item of scenario.productPaths) add('scenario_product_file',scenario.id,item.resolved,scenario.blockIds[0]);
    for (const item of scenario.evidence) add('scenario_evidence',scenario.id,item.resolved || item.raw,scenario.blockIds[0]);
  }
  for (const work of works) {
    for (const dependency of work.dependencies) add('depends_on',work.id,dependency,work.blockIds[0],{requiredState:work.dependencyState});
    for (const item of work.productPaths) add('allows_product_file',work.id,item.resolved,work.blockIds[0]);
    for (const file of work.testPaths) add('allows_test_file',work.id,file,work.blockIds[0]);
    for (const item of work.evidence) add('work_evidence',work.id,item.resolved || item.raw,work.blockIds[0]);
    for (const gate of work.inheritedSourceGates) add('inherits_source_gate',work.id,gate.sourceLine ? `SOURCE-L${gate.sourceLine}` : `SECTION-${gate.sourceSection}`,work.blockIds[0],gate);
  }
  for (const command of commands) {
    add('declares_command',command.owner,command.id,command.blockId,{role:command.role});
    if (command.derivedFrom) add('same_command_as',command.id,command.derivedFrom,command.blockId);
    for (const selector of command.pytestSelectors) add('command_selects_test',command.id,selector,command.blockId,{actualCoverage:'not_executed'});
  }
  const commandAt=line=>commands.find(command=>blocks.find(block=>block.id===command.blockId)?.source.lineStart===line)?.id;
  for (const command of commands.filter(item=>item.role==='source_command_set')) {
    const block=blocks.find(item=>item.id===command.blockId);
    const targets=block.source.lineStart===2485
      ? [...scenarios.flatMap(item=>item.commandIds),commandAt(2234)]
      : block.source.lineStart===2503
        ? [...commands.filter(item=>item.role==='regression_command' && WORKS.slice(2,14).some(work=>work.id===item.owner)).map(item=>item.id),commandAt(2234)]
        : [];
    for (const target of targets.filter(Boolean)) add('command_set_includes',command.id,target,block.id);
    if (!targets.length) add('conditional_command_selection',command.id,'CORRESPONDING_AC_BEFORE_EACH_BYPASS_REMOVAL',block.id,{sourceCondition:block.text});
  }
  return edges;
}
