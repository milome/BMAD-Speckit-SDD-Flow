import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureTools = createRequire(import.meta.url)(
  '../../packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-full-fixture.cjs'
);
const materializedFixture = fixtureTools.materializeFullFixture();
process.on('exit', () => {
  try {
    rmSync(materializedFixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Best-effort cleanup for the process-scoped fixture workspace.
  }
});
const sourcePath = materializedFixture.legacySourcePath;
const expectedPath = materializedFixture.expectedOraclePath;
const probe = `
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve('packages/bmad-speckit/src/utils/goal-contract');
const sourcePath=process.argv[1],expected=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const source=require(path.join(base,'source-obligation-extractor.ts')).extractSourceObligations({snapshot:require(path.join(base,'dual-view-derivation.ts')).buildSourceSnapshot({sourceType:'source_plan',sourcePath,rawBytes:fs.readFileSync(sourcePath)})});
const works=expected.sections.flatMap(section=>section.works), byWork=new Map(works.map(work=>[work.id,work]));
const rows=source.sourceObligations.map(row=>({...row,exactText:row.text,requiredOutcome:byWork.has(row.id)?byWork.get(row.id).pass.map(check=>check.text).join('\\n'):row.text}));
const technical=require(path.join(base,'control-plane/standalone-goal-technical-snapshot.ts')).standaloneTechnicalSnapshot(source,rows);
const sourceRefsById=new Map(rows.map(row=>[row.id,row.specSpanRefs]));
for(const binding of technical.constraintBindings||[])binding.premiseRefs=[...new Set([...binding.premiseRefs,...binding.applicableMustRefs.flatMap(ref=>sourceRefsById.get(ref)||[])])].sort();
const provenanceRefsBySpan=new Map();
for(const row of rows)for(const specSpanId of row.specSpanRefs){const refs=provenanceRefsBySpan.get(specSpanId)||new Set();for(const ref of row.provenanceRefs||[])refs.add(ref);provenanceRefsBySpan.set(specSpanId,refs);}
const logicalSpecSpans=source.specSpanRegistry.specSpans.map(span=>({...span,canonicalNodeRefs:[...new Set([...(span.canonicalNodeRefs||[]),...(provenanceRefsBySpan.get(span.specSpanId)||[])])].sort()}));
const semanticInput={sourcePlanHash:source.sourcePlanHash,sourceSnapshotHash:source.sourceSnapshotHash,sourceObligations:rows,logicalSpecSpans,technicalSnapshot:technical};
const semantic=require(path.join(base,'control-plane/standalone-goal-semantic-ir.ts')).compileStandaloneGoalSemanticIR(semanticInput);
const payload=require(path.join(base,'control-plane/standalone-goal-semantic-representation.ts')).resolveStandaloneGoalSemanticPayload(semantic);
  const gate=require(path.join(base,'control-plane/standalone-goal-internal-semantic-gate.ts')).runStandaloneGoalInternalSemanticGate(semanticInput,semantic);
  const compiled=require(path.join(base,'control-plane/goal-execution-ir.ts')).compileGoalExecutionIR({profile:'standalone',semanticSource:{kind:'standalone_goal_semantic_ir',schemaVersion:semantic.schemaVersion,standaloneGoalSemanticIRHash:semantic.standaloneGoalSemanticIRHash},standaloneLineage:{sourcePlanHash:source.sourcePlanHash,sourceSnapshotHash:source.sourceSnapshotHash,standaloneGoalSemanticIRHash:semantic.standaloneGoalSemanticIRHash,internalSemanticGateHash:gate.gateHash},technicalAuthority:{testOnly:'pure-unadmitted-compiler',internalSemanticGateHash:gate.gateHash},...payload});
let closure;try{closure=require(path.join(base,'control-plane/goal-execution-closure.ts')).compileGoalExecutionClosure(compiled);}catch(error){closure={error:error.message};}
const authorityModule=require(path.join(base,'control-plane/goal-execution-authority.ts'));
const authority=authorityModule.normalizeGoalExecutionAuthority(compiled);
console.log(JSON.stringify({evidenceClass:'test-only-pure-compile-no-Judge-no-admission',sourceHash:source.sourcePlanHash,actions:compiled.atomicTasks.length,semanticBytes:Buffer.byteLength(JSON.stringify(semantic)),goalBytes:Buffer.byteLength(JSON.stringify(compiled)),authorityBytes:Buffer.byteLength(JSON.stringify(authority)),authorityRoundTrip:authorityModule.resolveGoalExecutionAuthority(authority).goalExecutionIRHash===compiled.goalExecutionIRHash,sourceCommandIds:source.sourceBlocks.flatMap(block=>(block.commandDeclarations||[]).map(command=>command.id)),constraints:payload.executionConstraints.filter(row=>['CMD','EVDREQ'].includes(row.kind)),executionCommands:compiled.commands.map(row=>({commandId:row.commandId,invocation:row.invocation,obligationRefs:row.obligationRefs})),closure}));
`;

const publishProbe = `
(async()=>{
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve('packages/bmad-speckit/src/utils/goal-contract');
const sourceLines=fs.readFileSync(process.argv[1],'utf8').split(/\\r?\\n/u);
const sourceText=sourceLines.slice(2239,2283).join('\\n');
const samplePath=path.join(process.argv[2],'minimal-publish-source.md');
fs.writeFileSync(samplePath,sourceText,'utf8');
const snapshot=require(path.join(base,'dual-view-derivation.ts')).buildSourceSnapshot({sourceType:'source_plan',sourcePath:samplePath,rawBytes:Buffer.from(sourceText,'utf8')});
const source=require(path.join(base,'source-obligation-extractor.ts')).extractSourceObligations({snapshot});
for(const row of source.sourceObligations)if(!['action','binding','definition'].includes(row.executionRole))row.applicability={scope:'global',sourceRefs:row.sourceBlockRefs};
const candidate=source.sourceBlocks.flatMap(block=>(block.commandDeclarations||[]).map(command=>({block,command})))
  .find(({block,command})=>block.sourceRef&&command.sourceRef&&block.sourceRef.startByte<command.sourceRef.startByte&&block.sourceRef.endByteExclusive>command.sourceRef.endByteExclusive);
if(!candidate)throw new Error('minimal_publish_nested_command_source_missing');
source.sourceBlocks.push({id:'BLOCK-EXAMPLE',disposition:'example',text:candidate.block.text,sourceRef:candidate.block.sourceRef,
  commandDeclarations:[{id:'CMD-EXAMPLE',invocation:candidate.command.invocation,sourceRef:candidate.command.sourceRef}]});
const canonicalIntentBundle={specSpanRegistry:source.specSpanRegistry,canonicalIntentIR:source.semanticObligations.map(row=>({
  ownership:'owned_obligation',declaredSourceId:row.id,specSpanRefs:row.specSpanRefs,classification:row.classification||'positive',requiredOutcome:row.text}))};
const published=await require(path.join(base,'control-plane/standalone-goal-authority.ts')).publishStandaloneGoalAuthority({
  source,canonicalIntentBundle,goalContractPath:path.join(process.argv[2],'goal.md'),projectRoot:process.argv[2]});
const authority=require(path.join(base,'control-plane/goal-execution-authority.ts'));
const ir=authority.resolveGoalExecutionAuthority(JSON.parse(fs.readFileSync(published.goalExecutionIrRef.path,'utf8')));
const constraint=ir.semanticSource.typedExecutionConstraints.find(row=>row.constraintId==='CMD-EXAMPLE');
const span=ir.logicalSpecSpans.find(row=>(row.boundDeclarationIds||[]).includes('CMD-EXAMPLE'));
const activation=require(path.join(base,'control-plane/frozen-goal-activation.ts'));
const eligibility=activation.compileFrozenGoalExecutionEligibility(ir);
const partitionModule=require(path.join(base,'control-plane/frozen-goal-partition.ts'));
const selection=partitionModule.selectFrozenGoalPartition({goalExecutionIr:ir,eligibility});
if(selection.partitionOutcome==='partition_no_valid_solution')throw new Error('minimal_publish_partition_invalid');
const partition=partitionModule.compilePartitionFromFrozenGoalAuthority({goalExecutionIr:ir,eligibility,
  executionAdapterRef:{path:'test-only/adapter.json',hash:'sha256:'+'a'.repeat(64)}});
const children=[];for(const [name,bytes]of partition.files)if(name.endsWith('child-execution-contract.json'))children.push(JSON.parse(bytes.toString('utf8')));
process.stdout.write(JSON.stringify({sampleBytes:Buffer.byteLength(sourceText),blockSource:candidate.block.sourceRef,commandSource:candidate.command.sourceRef,
  declarationSource:constraint.declarationSource,span,partitionCount:partition.manifest.partitionCount,
  childContainsDeclaration:children.some(child=>child.logicalSpecSpans.some(row=>(row.boundDeclarationIds||[]).includes('CMD-EXAMPLE')))}));
})().catch(error=>{process.stderr.write(String(error&&error.stack||error));process.exitCode=1;});
`;

function realSourceProbe() {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), '-e', probe, sourcePath, expectedPath],
    { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  expect(result.status, result.stderr.slice(0, 1200)).toBe(0);
  return JSON.parse(result.stdout);
}

function minimalPublishProbe() {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'standalone-publish-provenance-'));
  try {
    const result = spawnSync(process.execPath,
      [path.resolve('node_modules/tsx/dist/cli.mjs'), '-e', publishProbe, sourcePath, temporaryRoot],
      { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
    expect(result.status, result.stderr.slice(0, 1200)).toBe(0);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

describe('real source execution declaration applicability, without Judge', () => {
  it('publishes a nested external command fragment through freeze and partition', () => {
    const result = minimalPublishProbe();
    expect(result.sampleBytes).toBeLessThan(6000);
    expect(result.blockSource.startByte).toBeLessThan(result.commandSource.startByte);
    expect(result.blockSource.endByteExclusive).toBeGreaterThan(result.commandSource.endByteExclusive);
    expect(result.declarationSource).toMatchObject(result.commandSource);
    expect(result.span).toMatchObject({
      boundObligationIds: [],
      boundDeclarationIds: ['CMD-EXAMPLE'],
      canonicalNodeRefs: ['BLOCK-EXAMPLE', 'CMD-EXAMPLE'],
      ...result.commandSource,
    });
    expect(result.partitionCount).toBeGreaterThanOrEqual(2);
    expect(result.childContainsDeclaration).toBe(false);
  }, 120000);

  it('closes the full source pipeline without upgrading declarations into extra tasks', () => {
    const result = realSourceProbe();
    expect(result.sourceHash).toBe('sha256:06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a');
    expect(result.actions).toBe(16);
    expect(result.semanticBytes).toBeGreaterThan(0);
    expect(result.authorityBytes).toBeGreaterThan(0);
    expect(result.authorityRoundTrip).toBe(true);
    expect(result.closure.decision).toBe('pass');
    expect(result.closure.coverage.nonActionConstraintIds.length).toBeGreaterThan(0);
  }, 120000);

  it('conserves excluded command declarations against the independent source-role oracle', () => {
    const result = realSourceProbe();
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')).sections.flatMap((section: any) => section.commands);
    const excluded = expected.filter((command: any) => ['environment_setting', 'command_template', 'authoring_command', 'prohibited_command'].includes(command.role));
    expect(excluded).toHaveLength(6);
    for (const declaration of excluded) {
      const matches = result.constraints.filter((row: any) => row.kind === 'CMD' && row.canonicalValue === declaration.expression);
      expect(matches.length, declaration.id).toBeGreaterThan(0);
      expect(matches.every((row: any) => row.coverageRole === 'non_action_declaration'), declaration.id).toBe(true);
      expect(result.executionCommands.some((row: any) => row.invocation === declaration.expression), declaration.id).toBe(false);
    }
    expect(result.constraints.filter((row: any) => row.kind === 'CMD').map((row: any) => row.constraintId).sort()).toEqual(result.sourceCommandIds.sort());
  }, 120000);

  it('inherits explicit global commit checks and referenced acceptance evidence', () => {
    const result = realSourceProbe();
    for (const invocation of ['git status --short', 'git diff --cached --name-only']) {
      const command = result.executionCommands.find((row: any) => row.invocation === invocation);
      expect(command, invocation).toBeDefined();
      expect(command.obligationRefs.filter((ref: string) => /^WORK-/u.test(ref))).toHaveLength(16);
    }
    expect(result.constraints.filter((row: any) => row.kind === 'EVDREQ' && row.coverageRole === 'action_trace')
      .every((row: any) => row.applicableMustRefs.some((ref: string) => /^WORK-/u.test(ref)))).toBe(true);
  }, 120000);
});
