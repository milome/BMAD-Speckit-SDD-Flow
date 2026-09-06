import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_SHA256, STEM } from './real-source-plan-20260904.expected.profile.mjs';
import { verifyCurrentReview } from './real-source-plan-20260904.expected.review-v2.integrity.mjs';
import { verifyCurrentFourReview } from './real-source-plan-20260904.expected.review-v3.integrity.mjs';

const directory=dirname(fileURLToPath(import.meta.url));
const artifact=suffix=>join(directory,`${STEM}.expected.${suffix}`);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const target=artifact('json');
const files=readdirSync(directory,{withFileTypes:true})
  .filter(entry=>entry.isFile() && entry.name.startsWith(`${STEM}.expected`)
    && ['.mjs','.json','.md'].includes(extname(entry.name)))
  .map(entry=>join(directory,entry.name));
const bytes=files.reduce((sum,file)=>sum+statSync(file).size,0);
assert.ok(bytes<256*1024*1024,'Strict decoding exceeds the bounded fixture read budget');
for (const file of files) new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file));
const verification=JSON.parse(readFileSync(artifact('verification.json'),'utf8'));
assert.equal(hash(readFileSync(target)),verification.oracleSha256);
assert.equal(hash(readFileSync(join(directory,`${STEM}.md`))),SOURCE_SHA256);
for (const helper of verification.helperHashes) assert.equal(hash(readFileSync(join(directory,helper.file))),helper.sha256);
if (['source-semantic-review-20260906', 'source-four-polarity-review-20260906'].includes(verification.reviewRevision?.revisionId)) {
  const result=verification.reviewRevision.revisionId === 'source-four-polarity-review-20260906'
    ? verifyCurrentFourReview() : verifyCurrentReview();
  const receipt=JSON.parse(readFileSync(artifact('final-integrity.receipt.json'),'utf8'));
  assert.deepEqual(receipt,result);
  console.log(JSON.stringify({status:'verified',oracleSha256:result.oracleSha256,
    sourceBytesUnchanged:true,changedClauseCount:result.changedClauseCount,
    strictUtf8Files:files.length,strictUtf8Bytes:bytes,receiptSha256:hash(readFileSync(artifact('final-integrity.receipt.json')))}));
} else {
const backupFiles=readdirSync(directory).filter(name=>name.startsWith(`${STEM}.expected.json.backup-`)).map(name=>join(directory,name));
assert.ok(backupFiles.reduce((sum,file)=>sum+statSync(file).size,bytes)<256*1024*1024);
const backups=backupFiles.map(path=>({path,sha256:hash(readFileSync(path))}));
const priorHash='e1999e78abbd5ba160e532421add3c6486ae8372cc7ffac42c1ba3020db5496d';
const reviewedHash='bedc8cb7541c96fa2da06e980cf2931464c8f9935379d254cb2fb5b65f79afc4';
const previousOracles=['321ac26d53d0e94275ade715fea38daf7db55e8b5d775adc34d4f1d0a7963ca2',priorHash,reviewedHash]
  .map(sha256=>{
    const backup=backups.find(item=>item.sha256===sha256);
    assert.ok(backup,`Missing verified prior oracle ${sha256}`);
    return backup;
  });
const prior=JSON.parse(readFileSync(previousOracles.find(item=>item.sha256===priorHash).path,'utf8'));
const current=JSON.parse(readFileSync(target,'utf8'));
const reviewed=JSON.parse(readFileSync(previousOracles.find(item=>item.sha256===reviewedHash).path,'utf8'));
const approvedLines=[88,89,90,91,92,93,178,368,438,864,1012,1051,2242,2506,2530,2546,2550,2552];
const changedLines=[];
for (const section of current.sections) {
  const previous=prior.sections.find(item=>item.id===section.id);
  for (const field of ['commands','scenarios','works']) assert.deepEqual(section[field],previous[field]);
  for (const block of section.blocks) {
    const before=previous.blocks.find(item=>item.id===block.id);
    assert.ok(before,`Unexpected block ${block.id}`);
    if (JSON.stringify(before)===JSON.stringify(block)) continue;
    assert.ok(approvedLines.includes(block.source.lineStart),`Out-of-scope semantic delta at ${block.id}`);
    assert.deepEqual(block.source,before.source);
    assert.equal(block.text,before.text);
    changedLines.push(block.source.lineStart);
  }
  const reviewedSection=reviewed.sections.find(item=>item.id===section.id);
  for (const block of section.blocks.filter(item=>item.source.lineStart!==864)) {
    assert.deepEqual(block,reviewedSection.blocks.find(item=>item.id===block.id));
  }
}
assert.deepEqual(changedLines,approvedLines);
const priorRelations=prior.sections.flatMap(section=>section.relations);
const currentRelations=current.sections.flatMap(section=>section.relations);
const priorRelationSet=new Set(priorRelations.map(edge=>JSON.stringify(edge)));
const currentRelationSet=new Set(currentRelations.map(edge=>JSON.stringify(edge)));
const removedRelations=priorRelations.filter(edge=>!currentRelationSet.has(JSON.stringify(edge)));
const addedRelations=currentRelations.filter(edge=>!priorRelationSet.has(JSON.stringify(edge)));
assert.equal(removedRelations.length,10);
assert.ok(removedRelations.every(edge=>['authority_precedence','global_boundary'].includes(edge.kind)));
assert.equal(addedRelations.length,14);
assert.ok(addedRelations.every(edge=>['authority_precedence','global_boundary','effective_fix_boundary','same_source_boundary'].includes(edge.kind)));
const testPhases=['modal-red','modal-green','modal-green-default-runner','clause-red','clause-green','clause-green-default-runner'].map(phase=>{
  const path=artifact(`tests-${phase}.receipt.json`);
  const report=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(hash(readFileSync(report.stdoutPath)),report.stdoutSha256);
  assert.equal(report.exitCode,phase.endsWith('-red') ? 1 : 0);
  if (phase.startsWith('clause-green')) assert.equal(report.oracleSha256,verification.oracleSha256);
  if (phase==='clause-red' || phase.startsWith('modal-green')) assert.equal(report.oracleSha256,reviewedHash);
  return {phase,path,sha256:hash(readFileSync(path)),passed:report.passed,failed:report.failed};
});
const receiptPath=artifact('final-integrity.receipt.json');
let previousReceipt=null;
if (existsSync(receiptPath)) {
  const backup=`${receiptPath}.backup-${Date.now()}`;
  const sha256=hash(readFileSync(receiptPath));
  copyFileSync(receiptPath,backup);
  assert.equal(hash(readFileSync(backup)),sha256);
  previousReceipt={path:backup,sha256};
}
const entry=join(directory,'../../goal-contract-real-source-plan-oracle.test.js');
const receipt={strictUtf8Files:files.length,strictUtf8Bytes:bytes,helperHashesMatch:true,
  sourceSha256:SOURCE_SHA256,oracleSha256:verification.oracleSha256,previousOracles,previousReceipt,
  approvedSemanticDeltaLines:changedLines,commandScenarioWorkDeclarationsUnchanged:true,
  relationDelta:{removed:removedRelations.length,added:addedRelations.length},
  defaultEntrySha256:hash(readFileSync(entry)),integrityHelperSha256:hash(readFileSync(fileURLToPath(import.meta.url))),testPhases};
const content=`${JSON.stringify(receipt,null,2)}\n`;
writeFileSync(receiptPath,content,'utf8');
assert.equal(hash(readFileSync(receiptPath)),hash(Buffer.from(content)));
console.log(JSON.stringify({status:'verified',strictUtf8Files:files.length,strictUtf8Bytes:bytes,
  oracleSha256:verification.oracleSha256,verifiedPreviousOracles:previousOracles.length,
  receiptPath,receiptSha256:hash(readFileSync(receiptPath))}));
}
