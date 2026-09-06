import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = path.resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md');
const expectedPath = sourcePath.replace(/\.md$/u, '.expected.json');
const probe = `
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve('packages/bmad-speckit/src/utils/goal-contract');
const sourcePath=process.argv[1],expected=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const source=require(path.join(base,'source-obligation-extractor.ts')).extractSourceObligations({snapshot:require(path.join(base,'dual-view-derivation.ts')).buildSourceSnapshot({sourceType:'source_plan',sourcePath,rawBytes:fs.readFileSync(sourcePath)})});
const technical=require(path.join(base,'control-plane/standalone-goal-technical-snapshot.ts')).standaloneTechnicalSnapshot(source,source.sourceObligations);
const works=expected.sections.flatMap(section=>section.works), byWork=new Map(works.map(work=>[work.id,work]));
const rows=source.sourceObligations.map(row=>({...row,exactText:row.text,requiredOutcome:byWork.has(row.id)?byWork.get(row.id).pass.map(check=>check.text).join('\\n'):row.text}));
const semantic=require(path.join(base,'control-plane/standalone-goal-semantic-ir.ts')).compileStandaloneGoalSemanticIR({sourcePlanHash:source.sourcePlanHash,sourceSnapshotHash:source.sourceSnapshotHash,sourceObligations:rows,logicalSpecSpans:rows.flatMap(row=>row.specSpanRefs.map(specSpanId=>({specSpanId,boundObligationIds:[row.id],evidenceClaimRefs:[]}))),technicalSnapshot:technical});
const payload=require(path.join(base,'control-plane/standalone-goal-semantic-representation.ts')).resolveStandaloneGoalSemanticPayload(semantic);
  const gate=require(path.join(base,'control-plane/standalone-goal-internal-semantic-gate.ts')).runStandaloneGoalInternalSemanticGate({sourcePlanHash:source.sourcePlanHash,sourceSnapshotHash:source.sourceSnapshotHash,sourceObligations:rows,logicalSpecSpans:rows.flatMap(row=>row.specSpanRefs.map(specSpanId=>({specSpanId,boundObligationIds:[row.id],evidenceClaimRefs:[]}))),technicalSnapshot:technical},semantic);
  const compiled=require(path.join(base,'control-plane/goal-execution-ir.ts')).compileGoalExecutionIR({profile:'standalone',semanticSource:{kind:'standalone_goal_semantic_ir',schemaVersion:semantic.schemaVersion,standaloneGoalSemanticIRHash:semantic.standaloneGoalSemanticIRHash},standaloneLineage:{sourcePlanHash:source.sourcePlanHash,sourceSnapshotHash:source.sourceSnapshotHash,standaloneGoalSemanticIRHash:semantic.standaloneGoalSemanticIRHash,internalSemanticGateHash:gate.gateHash},technicalAuthority:{testOnly:'pure-unadmitted-compiler',internalSemanticGateHash:gate.gateHash},...payload});
let closure;try{closure=require(path.join(base,'control-plane/goal-execution-closure.ts')).compileGoalExecutionClosure(compiled);}catch(error){closure={error:error.message};}
const authorityModule=require(path.join(base,'control-plane/goal-execution-authority.ts'));
const authority=authorityModule.normalizeGoalExecutionAuthority(compiled);
console.log(JSON.stringify({evidenceClass:'test-only-pure-compile-no-Judge-no-admission',sourceHash:source.sourcePlanHash,actions:compiled.atomicTasks.length,semanticBytes:Buffer.byteLength(JSON.stringify(semantic)),goalBytes:Buffer.byteLength(JSON.stringify(compiled)),authorityBytes:Buffer.byteLength(JSON.stringify(authority)),authorityRoundTrip:authorityModule.resolveGoalExecutionAuthority(authority).goalExecutionIRHash===compiled.goalExecutionIRHash,sourceCommandIds:source.sourceBlocks.flatMap(block=>(block.commandDeclarations||[]).map(command=>command.id)),constraints:payload.executionConstraints.filter(row=>['CMD','EVDREQ'].includes(row.kind)),executionCommands:compiled.commands.map(row=>({commandId:row.commandId,invocation:row.invocation,obligationRefs:row.obligationRefs})),closure}));
`;

function realSourceProbe() {
  const result = spawnSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), '-e', probe, sourcePath, expectedPath],
    { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  expect(result.status, result.stderr.slice(0, 1200)).toBe(0);
  return JSON.parse(result.stdout);
}

describe('real source execution declaration applicability, without Judge', () => {
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
