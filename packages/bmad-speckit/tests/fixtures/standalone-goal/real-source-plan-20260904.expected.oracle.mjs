import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlocks, hash, readSource } from './real-source-plan-20260904.expected.blocks.mjs';
import { buildCommands, buildRelations, buildScenarios, buildWorks } from './real-source-plan-20260904.expected.relations.mjs';
import { applyReviewedAmendments } from './real-source-plan-20260904.expected.review-v2.mjs';
import { FIXES, NAMED_COUNTS, REVIEW_NOTES, SCENARIOS, SECTIONS, SOURCE_BYTES,
  SOURCE_LINES, SOURCE_SHA256, STEM, WORKS } from './real-source-plan-20260904.expected.profile.mjs';

const directory=dirname(fileURLToPath(import.meta.url));
const root=resolve(directory,'../../../../..');
const target=join(directory,`${STEM}.expected.json`);
const session=join(directory,`.${STEM}.expected.json.draft`);
const npmCli=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const artifact=suffix=>join(directory,`${STEM}.expected.${suffix}`);

export function constructOracle() {
  const source=readSource(join(directory,`${STEM}.md`));
  const blocks=buildBlocks(source);
  const commands=buildCommands(blocks);
  const scenarios=buildScenarios(blocks,commands);
  const works=buildWorks(blocks,commands,scenarios);
  const relations=buildRelations(blocks,commands,scenarios,works);
  return applyReviewedAmendments({source,blocks,commands,scenarios,works,relations});
}

function countBy(values,key) {
  return Object.fromEntries([...new Set(values.map(key))].sort().map(value=>[value,values.filter(item=>key(item)===value).length]));
}

export function validateOracle(oracle) {
  let offset=0;
  for (const block of oracle.blocks) {
    assert.equal(block.source.byteStart,offset,`Byte partition gap/overlap at ${block.id}`);
    assert.equal(hash(oracle.source.bytes.subarray(offset,block.source.byteEnd)),block.source.textSha256);
    assert.equal(Buffer.from(block.text).equals(oracle.source.bytes.subarray(offset,block.source.byteEnd)),true);
    assert.ok(block.disposition && block.reason && block.scope);
    if (!['layout','structure','metadata'].includes(block.disposition)) assert.ok(block.semantics.length,block.id);
    offset=block.source.byteEnd;
  }
  assert.equal(offset,SOURCE_BYTES);
  const named=oracle.blocks.filter(block=>block.definedId && !block.definedId.startsWith('AUDIT-'));
  assert.deepEqual(countBy(named,block=>block.definedId.replace(/-\d+$/u,'')),NAMED_COUNTS);
  assert.equal(oracle.scenarios.length,39);
  assert.equal(oracle.works.length,16);
  assert.equal(oracle.blocks.filter(block=>block.definedId?.startsWith('AUDIT-')).length,24);
  assert.equal(oracle.blocks.filter(block=>block.kind==='fence').length,14);
  assert.equal(oracle.commands.filter(command=>command.role==='authoring_command').length,1);
  return {
    sourceBytes:offset,sourceSha256:SOURCE_SHA256,textLines:SOURCE_LINES,
    blocks:oracle.blocks.length,clauses:oracle.blocks.flatMap(block=>block.semantics).length,
    namedObligations:named.length,auditObligations:24,fixes:17,scenarios:39,works:16,
    commands:oracle.commands.length,relations:oracle.relations.length,
    unexplainedBlocks:[],uncoveredByteRanges:[],businessCommandsExecuted:0,
  };
}

export function sectionDocument(oracle,section) {
  const blocks=oracle.blocks.filter(block=>block.context.section===section.id);
  const blockIds=new Set(blocks.map(block=>block.id));
  const commands=oracle.commands.filter(command=>blockIds.has(command.blockId));
  const relations=oracle.relations.filter(edge=>blockIds.has(edge.blockId));
  const raw=Buffer.concat(blocks.map(block=>Buffer.from(block.text)));
  return {
    ...section,status:'independently_reviewed',
    source:{byteStart:blocks[0].source.byteStart,byteEnd:blocks.at(-1).source.byteEnd,textSha256:hash(raw)},
    counts:{blocks:blocks.length,bytes:raw.length,clauses:blocks.flatMap(block=>block.semantics).length,
      namedObligations:blocks.filter(block=>block.definedId).length,commands:commands.length,relations:relations.length,
      dispositions:countBy(blocks,block=>block.disposition)},
    blocks,commands,relations,
    fixes:FIXES.filter(item=>item.start>=section.start && item.end<=section.end),
    scenarios:oracle.scenarios.filter(item=>item.start>=section.start && item.end<=section.end),
    works:oracle.works.filter(item=>item.start>=section.start && item.end<=section.end),
    unexplainedBlocks:[],
  };
}

function largeDoc(args,receiptName) {
  assert.ok(existsSync(npmCli),`Official npm CLI unavailable: ${npmCli}`);
  const result=spawnSync(process.execPath,[npmCli,'exec','--offline','--','bmad-speckit','large-doc',...args,'--json'],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:512*1024,
  });
  writeFileSync(artifact(`${receiptName}.stdout.log`),result.stdout || '', 'utf8');
  writeFileSync(artifact(`${receiptName}.stderr.log`),result.stderr || '', 'utf8');
  assert.equal(result.status,0,`large-doc ${args[0]} failed; see ${receiptName} logs`);
  const receipt=JSON.parse(result.stdout);
  writeFileSync(artifact(`${receiptName}.receipt.json`),`${JSON.stringify(receipt,null,2)}\n`,'utf8');
  return receipt;
}

function ensureSession(mode='create') {
  if (existsSync(join(session,'manifest.json'))) return;
  const chunks=SECTIONS.flatMap(section=>['--chunk',`${String(section.id).padStart(3,'0')}:section-${section.id}`]);
  largeDoc(['init','--target',target,'--mode',mode,'--profile','json',...chunks,'--chunk','017:verification','--min-bytes','500000'],mode==='replace' ? 'revision-writer-init' : 'writer-init');
}

function writeProgress() {
  const states=SECTIONS.map(section=>{
    const receiptPath=join(session,'receipts',`${String(section.id).padStart(3,'0')}.receipt.json`);
    if (!existsSync(receiptPath)) return {section:section.id,status:'pending'};
    const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
    return {section:section.id,status:'persisted',hash:receipt.chunkHash,bytes:receipt.bytes};
  });
  writeFileSync(artifact('progress.json'),`${JSON.stringify({sourceSha256:SOURCE_SHA256,states},null,2)}\n`,'utf8');
  return states;
}

function persistSection(sectionId) {
  ensureSession();
  const section=SECTIONS.find(item=>item.id===sectionId);
  assert.ok(section,'Invalid section');
  const chunkId=String(sectionId).padStart(3,'0');
  assert.ok(!existsSync(join(session,'receipts',`${chunkId}.receipt.json`)),'Chunk already persisted; inspect before resuming');
  const oracle=constructOracle();
  validateOracle(oracle);
  const document=sectionDocument(oracle,section);
  const header=sectionId===0 ? `${JSON.stringify({
    schemaVersion:'standalone-goal-independent-semantic-oracle/v1',
    source:{file:`${STEM}.md`,byteCount:SOURCE_BYTES,textLineCount:SOURCE_LINES,sha256:SOURCE_SHA256},
    independence:{productionExtractorRead:false,productionExtractorOutputUsed:false,fullSourceReviewed:true},
    semanticsPolicy:{conditionText:'Source-preserved clauses, not executable Boolean predicates.',
      outcomeText:'Expected source assertion, not a result of this run.',
      relationMeaning:'Source declaration only; command execution and actual coverage are unproven.'},
  },null,2).slice(0,-1)},\n"sections": [\n` : '';
  const content=`${header}${JSON.stringify(document,null,2)}${sectionId===16 ? '' : ','}\n`;
  const draft=artifact(`section-${chunkId}.draft.json`);
  writeFileSync(draft,content,'utf8');
  const receipt=largeDoc(['write-chunk','--session',session,'--chunk-id',chunkId,'--section-id',`section-${sectionId}`,'--content-file',draft],`section-${chunkId}`);
  const chunk=readFileSync(join(session,'chunks',`${chunkId}.md`));
  assert.equal(receipt.chunkHash,`sha256:${hash(chunk)}`);
  const states=writeProgress();
  console.log(JSON.stringify({section:sectionId,status:'persisted',counts:document.counts,hash:receipt.chunkHash,pending:states.filter(item=>item.status==='pending').map(item=>item.section)}));
}

function finishReview(verification,summary) {
  const reviewSession=join(directory,`.${STEM}.expected.review.md.draft`);
  const reviewTarget=artifact('review.md');
  if (existsSync(reviewTarget)) {
    largeDoc(['cleanup','--session',reviewSession,'--policy','archive'],'prior-review-archive');
    largeDoc(['init','--target',reviewTarget,'--mode','replace','--profile','markdown','--chunk','001:source-review','--chunk','002:coverage','--require-heading','# Independent Source Oracle'],'review-revision-init');
    largeDoc(['add-chunk','--session',reviewSession,'--chunk-id','001','--section-id','source-review','--content-file',artifact('review.source.chunk.md')],'review-source-restored');
  }
  const lines=[
    '## Coverage','',
    `- Source partition: ${verification.sourceBytes} bytes; ${verification.blocks} blocks; ${verification.clauses} clauses.`,
    '- Unexplained blocks: 0. Uncovered or overlapping source bytes: 0.',
    '- Named obligations: 253. AUDIT obligations: 24. FIX groups: 17. Scenarios: 39. Work packages: 16.',
    '- Conditions and expected outcomes preserve source clause text, not executable Boolean predicates.',
    '- Classified coverage does not assert business proof coverage or successful command execution.',
    '- Source-declared associations and independently reviewed WORK/AC anchors are retained separately.',
    '- Review corrections cover parent-list inheritance, authoring-round conditions, ownership-column polarity, and mixed evidence clauses.',
    '- Reviewed clause overrides preserve active prohibitions within deviation headings and distinguish negated or object-level modality words.',
    '- Authority ordering retains child prohibitions; review scope is not a claim of exhaustive human approval of every semantic clause.',
    '- Unknown source blocks fail classification; no unrecognized paragraph defaults to a required normative statement.',
    '- All 14 fenced blocks are retained: 13 normative text flows/formulas and one conditional authoring command.',
    '- All source sections were persisted separately and their chunk receipts were verified before continuing.',
    '', '| Section | Blocks | Clauses | Bytes | Source SHA-256 |', '|---|---:|---:|---:|---|',
    ...summary.map(item=>`| ${item.section} | ${item.counts.blocks} | ${item.counts.clauses} | ${item.counts.bytes} | ${item.source.textSha256} |`),
    '', '## Reproduction','',
    `- Validate the frozen artifact: \`node --test packages/bmad-speckit/tests/fixtures/standalone-goal/${STEM}.expected.oracle.test.mjs\`.`,
    '- Generator and profile are fixture-only, with no production extractor imports.',
    '- Keep writer sessions and receipts for review; do not treat them as business acceptance receipts.',
    `- Oracle SHA-256: \`${hash(readFileSync(target))}\`.`,
  ];
  const draft=artifact('review.coverage.chunk.md');
  writeFileSync(draft,`${lines.join('\n')}\n`,'utf8');
  largeDoc(['write-chunk','--session',reviewSession,'--chunk-id','002','--section-id','coverage','--content-file',draft],'review-coverage');
  const assembly=largeDoc(['assemble','--session',reviewSession],'review-assembly');
  largeDoc(['validate','--session',reviewSession],'review-validation');
  largeDoc(['promote','--session',reviewSession],'review-promotion');
  assert.equal(hash(readFileSync(reviewTarget)),hash(readFileSync(assembly.outputPath)));
  largeDoc(['cleanup','--session',reviewSession,'--policy','keep'],'review-cleanup');
}

function recordTests(phase,packageRunner=false) {
  const args=packageRunner ? ['scripts/run-node-tests.cjs','goal-contract-real-source-plan-oracle.test.js']
    : ['--test','--test-reporter=tap',artifact('oracle.test.mjs')];
  const cwd=packageRunner ? join(root,'packages/bmad-speckit') : root;
  const result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024});
  const prefix=`tests-${phase}${packageRunner ? '-default-runner' : ''}`;
  writeFileSync(artifact(`${prefix}.stdout.log`),result.stdout || '','utf8');
  writeFileSync(artifact(`${prefix}.stderr.log`),result.stderr || '','utf8');
  const report={phase,runner:packageRunner ? 'default_package_discovery' : 'independent_oracle_suite',exitCode:result.status,
    sourceSha256:SOURCE_SHA256,oracleSha256:hash(readFileSync(target)),testSha256:hash(readFileSync(artifact('oracle.test.mjs'))),
    stdoutBytes:Buffer.byteLength(result.stdout || ''),stdoutSha256:hash(Buffer.from(result.stdout || '')),
    passed:Number(result.stdout?.match(/# pass (\d+)/u)?.[1] || 0),failed:Number(result.stdout?.match(/# fail (\d+)/u)?.[1] || 0),
    stdoutPath:artifact(`${prefix}.stdout.log`),stderrPath:artifact(`${prefix}.stderr.log`)};
  writeFileSync(artifact(`${prefix}.receipt.json`),`${JSON.stringify(report,null,2)}\n`,'utf8');
  console.log(JSON.stringify(report));
  process.exitCode=result.status ?? 1;
}

function finish() {
  assert.equal(writeProgress().filter(item=>item.status==='pending').length,0,'Pending source sections');
  const oracle=constructOracle();
  const verification=validateOracle(oracle);
  const summary=SECTIONS.map(section=>{
    const document=sectionDocument(oracle,section);
    return {section:section.id,source:document.source,counts:document.counts};
  });
  const suffix=`],\n"reviewNotes": ${JSON.stringify(REVIEW_NOTES,null,2)},\n"verification": ${JSON.stringify(verification,null,2)},\n"sectionSummary": ${JSON.stringify(summary,null,2)}\n}\n`;
  const draft=artifact('verification.draft.json');
  writeFileSync(draft,suffix,'utf8');
  largeDoc(['write-chunk','--session',session,'--chunk-id','017','--section-id','verification','--content-file',draft],'verification-chunk');
  const assembled=largeDoc(['assemble','--session',session],'assembly');
  const text=readFileSync(assembled.outputPath,'utf8');
  const parsed=JSON.parse(text);
  assert.equal(parsed.sections.length,17);
  assert.equal(parsed.sections.flatMap(section=>section.blocks).length,verification.blocks);
  largeDoc(['validate','--session',session],'validation');
  largeDoc(['promote','--session',session],'promotion');
  assert.equal(hash(readFileSync(target)),hash(Buffer.from(text)));
  largeDoc(['cleanup','--session',session,'--policy','keep'],'cleanup');
  finishReview(verification,summary);
  const helperHashes=['profile.mjs','blocks.mjs','relations.mjs','oracle.mjs','oracle.test.mjs'].map(name=>({file:`${STEM}.expected.${name}`,sha256:hash(readFileSync(artifact(name)))}));
  writeFileSync(artifact('verification.json'),`${JSON.stringify({...verification,oracleSha256:hash(readFileSync(target)),helperHashes,sectionSummary:summary},null,2)}\n`,'utf8');
  console.log(JSON.stringify({status:'complete',target,oracleSha256:hash(readFileSync(target)),...verification}));
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,value,end]=process.argv.slice(2);
  if (command==='section') persistSection(Number(value));
  else if (command==='begin-revision') {
    largeDoc(['cleanup','--session',session,'--policy','archive'],'prior-oracle-archive');
    ensureSession('replace');
    persistSection(0);
  }
  else if (command==='sections') {
    for (let section=Number(value);section<=Number(end);section++) persistSection(section);
  }
  else if (command==='finish') finish();
  else if (command==='record-tests') recordTests(value,end==='package');
  else if (command==='inspect') console.log(JSON.stringify(validateOracle(constructOracle())));
  else throw new Error('Use section <0..16>, sections <start> <end>, finish, or inspect; no business command is executed.');
}
