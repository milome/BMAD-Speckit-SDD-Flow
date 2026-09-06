import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FIXES, INHERITED_LIST_RULES, LABEL_ANCHORS, REVIEWED_CLAUSE_RULES, REVIEWED_STANDALONE_PARAGRAPHS,
  REVIEWED_UNNAMED_FLOWS, SCENARIOS, SECTIONS, SOURCE_BYTES, SOURCE_LINES,
  SOURCE_SHA256, WORKS } from './real-source-plan-20260904.expected.profile.mjs';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const NAMED = /^(?:REQ-[A-Z]+|FIXTURE|PERF|PRECONTRACT|QUALITY|NOT-DONE|CONTRACT|DIRTY)-\d{3}(?=[:\uFF1A])/u;
const labelOf = text => text.match(/^- ([^:\uFF1A]+)[:\uFF1A]/u)?.[1];
const FACETS = ['legacy_baseline','current_deviation','preserved_semantics','minimal_changes','real_acceptance'];
const NEGATIVE = /\u4e0d\u5f97|\u7981\u6b62|\u4e0d(?:\u4f7f\u7528|\u4fee\u6539|\u65b0\u589e|\u521b\u5efa|\u5efa\u7acb|\u8ba9|\u6267\u884c|\u751f\u6210|\u8fd0\u884c|\u8ba2\u9605|\u6062\u590d|\u63d0\u4ea4|\u5b9e\u73b0|\u4fdd\u5b58|\u4fdd\u7559|\u4f9d\u8d56|\u89e6\u53d1|\u7b49\u5f85|\u91cd\u542f|\u5f15\u5165|\u6309|\u628a)|\u4e0d\u80fd/u;
const REQUIRED = /\u5fc5\u987b|\u5e94\u5f53|\u56fa\u5b9a|\u53ea\u80fd|\u4e00\u5f8b|\u4fdd\u6301|\u4fdd\u7559|\u7ee7\u7eed|\u7b49\u4e8e|\u7edf\u4e00/u;
const CONDITIONAL = /\u5982\u679c|\u82e5|\u5f53|\u53ea\u6709|\u4e4b\u524d|\u4e4b\u540e|\u65f6|\u524d|\u540e|\u5931\u8d25|\u7f3a\u5c11|\u4e0d\u5b58\u5728|\u672a/u;
const EXTRA_NEGATIVE = /\u4e0d(?:\u5199|\u6539\u53d8|\u963b\u585e|\u5220\u9664|\u91cd\u7b97|\u6e05\u7a7a|\u505c\u6b62|\u590d\u5236|\u4f2a\u9020|\u6269\u5927|\u88c1\u526a|\u8ba4\u4e3a|\u63a5\u53d7|\u66ff\u6362|\u7701\u7565|\u8d8a\u8fc7|\u91cd\u65b0|\u4f5c\u4e3a|\u80fd)/u;
const PERMISSION = /\u53ef(?:\u5728|\u4ee5|\u7528\u4e8e|\u7531|\u7ee7\u7eed|\u9650\u5236|\u4f5c\u4e3a)/u;

export function readSource(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, SOURCE_BYTES, 'Unexpected source size');
  assert.equal(hash(bytes), SOURCE_SHA256, 'Oracle requires the exact independently reviewed source');
  const text = new TextDecoder('utf-8', { fatal:true }).decode(bytes);
  let offset = 0;
  const lines = [...text.matchAll(/[^\n]*\n|[^\n]+$/gu)].map((match,index) => {
    const raw = match[0];
    const start = offset;
    offset += Buffer.byteLength(raw);
    return { number:index+1, start, end:offset, raw, text:raw.replace(/\r?\n$/u,'') };
  });
  assert.equal(lines.length, SOURCE_LINES);
  const labels = new Map();
  for (const [role,anchors] of Object.entries(LABEL_ANCHORS)) {
    for (const line of anchors) {
      const label = labelOf(lines[line-1].text);
      assert.ok(label, `Missing reviewed label at ${line}`);
      assert.ok(!labels.has(label) || labels.get(label) === role, `Conflicting label ${label}`);
      labels.set(label, role);
    }
  }
  return { bytes, text, lines, labels };
}

function kindAt(text) {
  if (!text.trim()) return 'blank';
  if (/^```/u.test(text)) return 'fence';
  if (/^#{1,6} /u.test(text)) return 'heading';
  if (/^\*\*[^*]+\*\*$/u.test(text)) return 'facet_heading';
  if (/^\|/u.test(text)) return 'table_row';
  if (/^- \[ \]/u.test(text)) return 'review_item';
  if (/^(?:- |\d+\. )/u.test(text)) return 'list_item';
  return 'paragraph';
}

function disposition(block, context) {
  const { kind, source, text, fieldRole } = block;
  if (kind === 'frontmatter') return ['metadata','Source-declared metadata is not a grant of authority.'];
  if (kind === 'blank') return ['layout','Whitespace is retained for total byte partitioning.'];
  if (kind === 'heading' || kind === 'facet_heading') {
    return ['structure','Container identity and hierarchy, not a standalone implementation task.'];
  }
  if (kind === 'table_row' && [184,185,921,922,1929,1930].includes(source.lineStart)) {
    return ['structure','Reviewed table header or separator; cell semantics belong to data rows.'];
  }
  if (source.lineStart >= 1931 && source.lineStart <= 1954) {
    return ['association','Explicit S01/work/file/nodeid/evidence cross-reference, not a duplicate scenario.'];
  }
  if (context.section === 16) return ['review_pending','Unchecked human review item; completion is not asserted.'];
  const reviewed=REVIEWED_CLAUSE_RULES.find(rule=>rule.line===source.lineStart && rule.disposition);
  if (reviewed) return [reviewed.disposition,reviewed.reason];
  if (block.inheritedRule) return [block.inheritedRule.disposition,`Reviewed list semantics inherited from source line ${block.inheritedRule.parentLine}; effect=${block.inheritedRule.effect}.`];
  if ([1452,1463].includes(source.lineStart)) {
    return ['mixed_evidence_and_normative','Historical statements and active evidence-permission boundaries are classified per clause.'];
  }
  if (source.lineStart >= 1452 && source.lineStart <= 1466) {
    return ['historical_evidence','Existing source receipt or fixture observation; never current-run PASS.'];
  }
  if (context.facet === 'legacy_baseline') return ['baseline_fact','Preserved legacy evidence within its owning FIX.'];
  if (context.facet === 'current_deviation') return ['observed_deviation','Current defect description; not desired behavior.'];
  if (fieldRole === 'product_paths' || fieldRole === 'test_paths') {
    return ['scope_declaration','Explicit permitted product/test scope; command paths are not substituted.'];
  }
  if (fieldRole === 'readonly_fixture_paths') return ['input_declaration','Frozen read-only fixture scope.'];
  if (fieldRole === 'evidence') return ['evidence_requirement','Required evidence target and provenance, not observed success.'];
  if (fieldRole?.endsWith('_command') || (kind === 'fence' && text.startsWith('```powershell'))) {
    return ['command_declaration','Preserve exact source command and conditions; never execute in this oracle.'];
  }
  if (fieldRole?.endsWith('_reference') || fieldRole === 'dependencies' || fieldRole === 'test_nodeid') {
    return ['association','Source-declared relation with its exact owner and referenced identity.'];
  }
  const reviewedNormative=Boolean(block.definedId || context.namedOwner || fieldRole
    || (context.fix && ['preserved_semantics','minimal_changes','real_acceptance'].includes(context.facet))
    || (source.lineStart>=186 && source.lineStart<=196)
    || (source.lineStart>=22 && source.lineStart<=28)
    || REVIEWED_STANDALONE_PARAGRAPHS.includes(source.lineStart)
    || REVIEWED_UNNAMED_FLOWS.includes(source.lineStart));
  assert.ok(reviewedNormative,`Unclassified source block at ${source.lineStart}: ${text.slice(0,100)}`);
  return ['normative','Explicitly reviewed named obligation, inherited normative container, typed field, or anchored paragraph/flow.'];
}

function scopeFor(context) {
  if (context.scenario) return { kind:'scenario', owner:context.scenario };
  if (context.work) return { kind:'work', owner:context.work };
  if (context.fix) return { kind:'fix', owner:context.fix, facet:context.facet };
  const section = SECTIONS.find(item=>item.id===context.section);
  return { kind:section.scope, owner:`SECTION-${context.section}` };
}

function clauses(text, kind) {
  if (kind === 'fence') return [{ text, start:0, end:text.length }];
  const result = [];
  let start = 0;
  let inline = false;
  for (let index=0; index<text.length; index++) {
    if (text[index] === '`') inline = !inline;
    if (!inline && /[\u3002\uFF1B]/u.test(text[index])) {
      result.push({ text:text.slice(start,index+1), start, end:index+1 });
      start = index+1;
    }
  }
  if (start<text.length) result.push({ text:text.slice(start), start, end:text.length });
  return result.filter(clause=>clause.text.trim());
}

function semantics(block) {
  if (['metadata','layout','structure'].includes(block.disposition)) return [];
  if (block.source.lineStart>=186 && block.source.lineStart<=196) {
    const cells=[...block.text.matchAll(/\|([^|]+)/gu)].slice(0,3);
    const actor=cells[0][1].trim();
    return cells.slice(1).map((cell,index)=>({
      id:`${block.id}:C${index+1}`,text:cell[1],actor,conditionAuthorityLine:184,
      byteStart:block.source.byteStart+Buffer.byteLength(block.text.slice(0,cell.index+1)),
      byteEnd:block.source.byteStart+Buffer.byteLength(block.text.slice(0,cell.index+1+cell[1].length)),
      polarity:index===0 ? 'required' : 'forbidden',scope:block.scope,conditions:[],inheritedConditionOwner:null,
      expectedOutcome:{kind:index===0 ? 'exclusive_responsibility' : 'explicitly_prohibited_responsibility',
        assertionText:cell[1],declaredStatusCodes:[],declaredVerdicts:[]},
    }));
  }
  return clauses(block.text,block.kind).map((clause,index) => {
    const reviewed=REVIEWED_CLAUSE_RULES.find(rule=>rule.line===block.source.lineStart && rule.clause===index+1);
    const negative = NEGATIVE.test(clause.text) || EXTRA_NEGATIVE.test(clause.text);
    const positive = REQUIRED.test(clause.text);
    const permitted=PERMISSION.test(clause.text);
    const blockReview=REVIEWED_CLAUSE_RULES.find(rule=>rule.line===block.source.lineStart && rule.disposition);
    let clauseDisposition=reviewed?.clauseDisposition || blockReview?.defaultClauseDisposition || block.disposition;
    if (clauseDisposition==='mixed_evidence_and_normative') {
      clauseDisposition=block.source.lineStart===1452 && clause.text.includes('FIXTURE-008')
        ? 'preserved_gate' : block.source.lineStart===1463 && (permitted || negative)
          ? 'evidence_use_boundary' : 'historical_evidence';
    }
    const observational = ['historical_evidence','baseline_fact','observed_deviation','observed_user_issue','review_pending'].includes(clauseDisposition);
    const modalities=reviewed ? reviewed.modalities || [reviewed.polarity] : observational ? ['descriptive'] : [positive ? 'required' : null,negative ? 'forbidden' : null,permitted ? 'permitted' : null].filter(Boolean);
    let polarity=observational ? 'descriptive' : modalities.length>1 ? 'mixed' : modalities[0] || 'required';
    if (block.inheritedRule && block.inheritedRule.polarity!=='source_modalities') polarity=block.inheritedRule.polarity;
    if (clauseDisposition==='preserved_gate') polarity='preserve';
    let outcome = 'source_required_state';
    if (observational) outcome = 'not_a_current_run_result';
    else if (block.fieldRole?.includes('criterion')) outcome = block.fieldRole;
    else if (block.fieldRole === 'stop_condition') outcome = 'stop_when_source_condition_holds';
    else if (block.disposition === 'command_declaration') outcome = 'command_declared_not_executed';
    if (block.inheritedRule) outcome=block.inheritedRule.effect;
    if (clauseDisposition==='preserved_gate') outcome='fixture_008_gate_remains_active';
    if (clauseDisposition==='evidence_use_boundary') outcome=negative ? 'forbid_claiming_unsupported_proof' : 'permitted_offline_csv_uses_only';
    if (reviewed?.outcome) outcome=reviewed.outcome;
    const conditions=CONDITIONAL.test(clause.text) ? [{kind:'source_condition',text:clause.text}] : [];
    let scope=block.scope;
    if (block.source.lineStart>=22 && block.source.lineStart<=27) {
      conditions.push({sourceLine:20,operator:'until_confirmation',subject:'this_source_version',text:block.authoringGateText});
      scope={kind:'current_source_authoring_round',owner:'SOURCE_USER_CONFIRMATION_GATE'};
    }
    if (block.source.lineStart===28 || (block.source.lineStart===30 && index===0)) {
      conditions.push({operator:'current_round_only',sourceLine:block.source.lineStart,text:clause.text});
      scope={kind:'current_source_authoring_round',owner:'SOURCE_CURRENT_ROUND_SCOPE'};
    }
    if (block.source.lineStart===30 && index>0) {
      scope={kind:'global_goal',owner:'GENERIC_INDICATOR_SCOPE'};
      polarity='preserve';
      outcome='boll_is_a_validation_sample_not_a_special_implementation_or_sole_indicator';
    }
    if (block.inheritedRule) conditions.push({sourceLine:block.inheritedRule.parentLine,operator:block.inheritedRule.relation,text:block.inheritedParentText,effect:block.inheritedRule.effect});
    if (block.source.lineStart===2574) conditions.push({sourceLine:2572,operator:'only_after_explicit_user_confirmation',text:block.contractConfirmationText});
    const starts = [...clause.text.matchAll(/(?:blocked_by_[a-z_]+|blocked_until_market_open):[^`\s\uFF1B\u3002]+/gu)].map(m=>m[0]);
    return {
      id:`${block.id}:C${index+1}`, text:clause.text,
      byteStart:block.source.byteStart+Buffer.byteLength(block.text.slice(0,clause.start)),
      byteEnd:block.source.byteStart+Buffer.byteLength(block.text.slice(0,clause.end)),
      polarity,modalities,disposition:clauseDisposition,scope,conditions,
      ...(reviewed ? {modalityAuthority:'independent_source_clause_review',modalityReviewReason:reviewed.reason} : {}),
      inheritedConditionOwner:block.context.namedOwner,
      expectedOutcome:{ kind:outcome, assertionText:clause.text, declaredStatusCodes:starts,
        declaredVerdicts:[...new Set(clause.text.match(/\b(?:PASS|FAIL|BLOCKED|FAILED|COMPLETE|ABORTED)\b/gu) || [])] },
    };
  });
}

export function buildBlocks(source) {
  const result = [];
  const context = { section:0, work:null, scenario:null, fix:null, facet:null, namedOwner:null, headings:[] };
  let facetIndex = -1;
  for (let index=0; index<source.lines.length;) {
    const line = source.lines[index];
    const section = SECTIONS.find(item=>line.number>=item.start && line.number<=item.end);
    if (context.section !== section.id) {
      Object.assign(context,{section:section.id,work:null,scenario:null,fix:null,facet:null,namedOwner:null});
    }
    const fix = FIXES.find(item=>line.number>=item.start && line.number<=item.end)?.id ?? null;
    if (fix !== context.fix) { context.fix=fix; context.facet=null; context.namedOwner=null; facetIndex=-1; }
    context.work = WORKS.find(item=>line.number>=item.start && line.number<=item.end)?.id ?? null;
    context.scenario = SCENARIOS.find(item=>line.number>=item.start && line.number<=item.end)?.id ?? null;
    let kind = index===0 ? 'frontmatter' : kindAt(line.text);
    let end = index+1;
    if (kind === 'frontmatter') end=12;
    else if (kind === 'fence') {
      while (end<source.lines.length && !/^```\s*$/u.test(source.lines[end].text)) end++;
      assert.ok(end<source.lines.length,'Unclosed source fence');
      end++;
    } else if (kind === 'blank') {
      while (end<section.end && kindAt(source.lines[end].text)==='blank') end++;
    } else if (kind === 'paragraph') {
      while (end<section.end && kindAt(source.lines[end].text)==='paragraph') end++;
    }
    if (kind === 'heading') {
      const depth=line.text.match(/^#+/u)[0].length;
      context.headings=context.headings.filter(item=>item.depth<depth);
      context.headings.push({depth,line:line.number,text:line.text});
      context.namedOwner=null;
    }
    if (kind === 'facet_heading' && context.fix) context.facet=FACETS[++facetIndex];
    const named=line.text.match(NAMED)?.[0];
    if (named) context.namedOwner=named;
    const last=source.lines[end-1];
    const bytes=source.bytes.subarray(line.start,last.end);
    const block={
      id:`B${String(result.length+1).padStart(4,'0')}`, kind,
      source:{lineStart:line.number,lineEnd:last.number,byteStart:line.start,byteEnd:last.end,textSha256:hash(bytes)},
      text:bytes.toString('utf8'), fieldRole:source.labels.get(labelOf(line.text)) ?? null,
      context:structuredClone(context), definedId:named ?? null,
    };
    block.inheritedRule=INHERITED_LIST_RULES.find(rule=>line.number>=rule.start && line.number<=rule.end) ?? null;
    if (block.inheritedRule) block.inheritedParentText=source.lines[block.inheritedRule.parentLine-1].text;
    if (line.number>=22 && line.number<=27) block.authoringGateText=source.lines[19].text;
    if (line.number===2574) block.contractConfirmationText=source.lines[2571].text;
    if (/^\| AUDIT-/u.test(line.text)) block.definedId=line.text.split('|')[1].trim();
    [block.disposition,block.reason]=disposition(block,context);
    block.scope=scopeFor(context);
    block.semantics=semantics(block);
    result.push(block);
    index=end;
  }
  return result;
}

export function inlineValues(text) { return [...text.matchAll(/`([^`\n]+)`/gu)].map(match=>match[1]); }
