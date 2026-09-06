import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory=dirname(fileURLToPath(import.meta.url));
const stem='real-source-plan-20260904';
const target=join(directory,`${stem}.expected.json`);
const receiptPath=join(directory,`${stem}.expected.review-amendment.receipt.json`);
const priorHash='08a5ae25e61f681b7aa0b4c3cef36c6b013e66d8ab7d36797370b78eac493474';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const currentBytes=readFileSync(target);
let priorPath=target;
if (hash(currentBytes)!==priorHash) {
  priorPath=readdirSync(directory).filter(name=>name.startsWith(`${stem}.expected.json.backup-`))
    .map(name=>join(directory,name)).find(file=>hash(readFileSync(file))===priorHash);
  assert.ok(priorPath,'The independently reviewed 08a5 oracle backup is required');
}
const prior=JSON.parse(readFileSync(priorPath,'utf8'));
const blocks=prior.sections.flatMap(section=>section.blocks);
const source=readFileSync(join(directory,`${stem}.md`));
assert.equal(hash(source),prior.source.sha256);
const decisions=[
  {line:779,clause:1,expectedPolarity:'mixed',reviewerDecision:'Require one atomic transaction and prohibit separate per-interval transactions.'},
  {line:1467,clause:1,expectedPolarity:'descriptive',reviewerDecision:'The source-time live blocker is descriptive status, not a perpetual required blocker.'},
  {line:1467,clause:2,expectedPolarity:'permitted',reviewerDecision:'Preserve declared offline uses as permission, without inventing an unqualified only-use prohibition.'},
].map(decision=>{
  const block=blocks.find(item=>item.source.lineStart===decision.line);
  const clause=block.semantics[decision.clause-1];
  const bytes=source.subarray(clause.byteStart,clause.byteEnd);
  assert.equal(bytes.toString('utf8'),clause.text);
  return {...decision,blockId:block.id,clauseId:clause.id,source:{byteStart:clause.byteStart,byteEnd:clause.byteEnd,
    text:clause.text,sha256:hash(bytes)},priorPolarity:clause.polarity};
});
const receipt={schemaVersion:'independent-oracle-review-amendment/v1',sourceSha256:prior.source.sha256,
  priorOracleSha256:priorHash,priorOraclePath:priorPath,reviewer:'/root/semantic_rca',
  authorization:'Root explicitly authorized only these three source-reviewed semantic amendments.',
  reviewEvidenceType:'independent_reviewer_messages_received_in_this_agent_conversation',decisions,
  currentRunBusinessCommandsExecuted:0,status:'source_review_recorded'};
if (process.argv[2]==='finish') {
  if (existsSync(receiptPath)) {
    const backup=`${receiptPath}.backup-${Date.now()}`;
    const receiptHash=hash(readFileSync(receiptPath));
    copyFileSync(receiptPath,backup);
    assert.equal(hash(readFileSync(backup)),receiptHash);
    Object.assign(receipt,{priorReviewReceipt:{path:backup,sha256:receiptHash}});
  }
  const current=JSON.parse(currentBytes.toString('utf8'));
  const next=current.sections.flatMap(section=>section.blocks);
  for (const section of current.sections) for (const field of ['commands','relations','fixes','scenarios','works']) {
    assert.deepEqual(section[field],prior.sections.find(item=>item.id===section.id)[field]);
  }
  const changed=[];
  for (const block of next) {
    const before=blocks.find(item=>item.id===block.id);
    if (![779,1467].includes(block.source.lineStart)) assert.deepEqual(block,before);
    else {
      changed.push(block.source.lineStart);
      assert.deepEqual(block.source,before.source);
      assert.equal(block.text,before.text);
      if (block.source.lineStart===1467) assert.deepEqual(block.semantics[2],before.semantics[2]);
    }
  }
  assert.deepEqual(changed,[779,1467]);
  for (const decision of decisions) assert.equal(next.find(item=>item.id===decision.blockId).semantics[decision.clause-1].polarity,decision.expectedPolarity);
  const verification=JSON.parse(readFileSync(join(directory,`${stem}.expected.verification.json`),'utf8'));
  for (const helper of verification.helperHashes) assert.equal(hash(readFileSync(join(directory,helper.file))),helper.sha256);
  const textFiles=readdirSync(directory,{withFileTypes:true}).filter(entry=>entry.isFile()
    && entry.name.startsWith(`${stem}.expected`) && /\.(?:mjs|json|md)$/u.test(entry.name)).map(entry=>join(directory,entry.name));
  const strictUtf8Bytes=textFiles.reduce((sum,file)=>sum+statSync(file).size,0);
  assert.ok(strictUtf8Bytes<256*1024*1024);
  for (const file of textFiles) new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file));
  Object.assign(receipt,{status:'amended_artifact_verified',oracleSha256:hash(currentBytes),changedBlockLines:changed,
    unchangedOtherBlocks:next.length-changed.length,commandsRelationsFixesScenariosWorksUnchanged:true,helperHashesMatch:true,
    strictUtf8Files:textFiles.length,strictUtf8Bytes,amendmentHelperSha256:hash(readFileSync(fileURLToPath(import.meta.url)))});
} else assert.equal(process.argv[2],'init');
writeFileSync(receiptPath,`${JSON.stringify(receipt,null,2)}\n`,'utf8');
assert.equal(JSON.parse(readFileSync(receiptPath,'utf8')).priorOracleSha256,priorHash);
console.log(JSON.stringify({status:receipt.status,priorOracleSha256:priorHash,oracleSha256:receipt.oracleSha256 || null,
  decisions:decisions.length,receiptPath,receiptSha256:hash(readFileSync(receiptPath))}));
