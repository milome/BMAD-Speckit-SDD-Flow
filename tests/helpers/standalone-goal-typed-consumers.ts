import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileStandaloneGoalExecution } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { normativeRoleInput } from './standalone-goal-normative-roles';

function attachCanonicalRequirementGraph(value: ReturnType<typeof normativeRoleInput>) {
  const sourceRows = value.sourceObligations.map((row, index) => {
    const sequence = String(index + 1).padStart(3, '0');
    const primaryId = row.executionRole === 'action'
      ? `TASK-STANDALONE-${sequence}`
      : row.polarity === 'forbidden'
        ? `NEG-STANDALONE-${sequence}`
        : `REQ-STANDALONE-${sequence}`;
    return {
      row,
      primaryId,
      ownerId: row.executionRole === 'action' ? `REQ-STANDALONE-${sequence}` : primaryId,
      sourceSpanRef: `SPAN-${sha256Stable(String(row.id)).slice(7, 23).toUpperCase()}`,
    };
  });
  const canonicalRefBySourceId = new Map(sourceRows.map(({ row, ownerId }) => [String(row.id), ownerId]));
  const relation = (type: string, fromRef: string, toRef: string, scope: string, sourceSpanRef: string) => ({
    id: `REL-${sha256Stable({ type, fromRef, toRef, scope }).slice(7, 23).toUpperCase()}`,
    type,
    fromRef,
    toRef,
    scope,
    sourceSpanRefs: [sourceSpanRef],
  });
  const applicabilityFor = (conditions: unknown) => {
    if (!Array.isArray(conditions) || conditions.length === 0) return { mode: 'always' };
    return {
      mode: 'conditional',
      condition: conditions.map((condition) => {
        if (typeof condition === 'string') return condition;
        if (condition && typeof condition === 'object' && typeof (condition as Record<string, unknown>).text === 'string') {
          return String((condition as Record<string, unknown>).text);
        }
        return JSON.stringify(condition);
      }).join(' AND '),
    };
  };
  const nodes = sourceRows.flatMap(({ row, primaryId, ownerId, sourceSpanRef }) => {
    const sourceApplicability = row.applicability as Record<string, unknown> | undefined;
    const scope = sourceApplicability?.scope === 'global' ? 'global' : 'local';
    const common = {
      title: String(row.id),
      normativeStrength: String(row.normativeStrength).toUpperCase(),
      polarity: row.polarity,
      applicability: applicabilityFor(row.conditions),
      scope,
      references: {},
      sourceSpanRefs: [sourceSpanRef],
    };
    const primary = {
      ...common,
      id: primaryId,
      kind: row.executionRole === 'action' ? 'TASK' : row.polarity === 'forbidden' ? 'NEG' : 'REQ',
      statement: String(row.exactText),
      aliases: [String(row.id)],
      ownerRef: row.executionRole === 'action' ? ownerId : null,
      attributes: { executionRole: row.executionRole },
    };
    if (row.executionRole !== 'action') return [primary];
    return [{
      ...common,
      id: ownerId,
      kind: 'REQ',
      statement: String(row.requiredOutcome),
      aliases: [],
      ownerRef: null,
      attributes: { executionRole: 'requirement' },
    }, primary];
  });
  const relations = sourceRows.flatMap(({ row, primaryId, ownerId, sourceSpanRef }) => {
    const sourceApplicability = row.applicability as Record<string, unknown> | undefined;
    const scope = sourceApplicability?.scope === 'global' ? 'global' : 'local';
    const rows = row.executionRole === 'action' ? [
      relation('owned_by', primaryId, ownerId, scope, sourceSpanRef),
      relation('implemented_by', ownerId, primaryId, scope, sourceSpanRef),
    ] : [];
    const obligationRefs = Array.isArray(sourceApplicability?.obligationRefs)
      ? sourceApplicability.obligationRefs.map(String)
      : [];
    rows.push(...obligationRefs.map((sourceRef) => relation(
      'applies_to_requirement',
      primaryId,
      canonicalRefBySourceId.get(sourceRef) ?? sourceRef,
      scope,
      sourceSpanRef
    )));
    if (scope === 'global') {
      rows.push(relation('globally_authorized_by', primaryId, ownerId, scope, sourceSpanRef));
      if (primaryId !== ownerId) {
        rows.push(relation('globally_authorized_by', ownerId, ownerId, scope, sourceSpanRef));
      }
    }
    return rows;
  });
  const aliases = sourceRows.map(({ row, primaryId, sourceSpanRef }) => ({
    alias: String(row.id),
    canonicalRef: primaryId,
    sourceSpanRefs: [sourceSpanRef],
  }));
  const graph = {
    schemaVersion: 'CanonicalRequirementGraph/v1',
    sourcePlanId: 'PLAN-STANDALONE-TYPED-CONSUMERS',
    sourcePlanVersion: 'standalone-source-plan/v1',
    goal: 'Exercise typed standalone Goal consumers.',
    scope: value.technicalSnapshot.targetPaths,
    nonGoals: value.technicalSnapshot.forbiddenPaths,
    nodes,
    relations,
    aliases,
    graphHash: '',
  };
  const { graphHash: _graphHash, ...payload } = graph;
  graph.graphHash = sha256Stable({
    ...payload,
    nodes: nodes.map(({ sourceSpanRefs: _sourceSpanRefs, ...node }) => node),
    relations: relations.map(({ sourceSpanRefs: _sourceSpanRefs, ...row }) => row),
    aliases: aliases.map(({ sourceSpanRefs: _sourceSpanRefs, ...row }) => row),
  });
  value.canonicalRequirementGraph = graph;
}

export async function typedTwoActionExecution(options: { localBoundary?: boolean } = {}) {
  const value = normativeRoleInput();
  value.sourceObligations.push({ ...structuredClone(value.sourceObligations[0]), id: 'MUST-002',
    exactText: 'Implement a separate import.', requiredOutcome: 'Import preserves every CSV row.',
    specSpanRefs: ['SPAN-MUST-002'], applicability: { scope: 'global', sourceRefs: ['SPAN-MUST-002'] } });
  value.sourceObligations[2].applicability = { scope: 'obligations', obligationRefs: ['MUST-001'], sourceRefs: ['SPAN-GUIDE-001'] };
  value.logicalSpecSpans.push({
    specSpanId: 'SPAN-MUST-002',
    sourceArtifactId: 'fixture:standalone-normative-roles',
    sourceSnapshotHash: value.sourceSnapshotHash,
    startByte: 80,
    endByteExclusive: 88,
    lineStart: 6,
    lineEnd: 6,
    exactTextHash: `sha256:${'7'.repeat(64)}`,
    boundObligationIds: ['MUST-002'],
    evidenceClaimRefs: [],
  });
  value.technicalSnapshot.targetPaths = ['src/export.ts', 'src/import.ts'];
  value.technicalSnapshot.commandRecords.push({ commandId: 'CMD-import', invocation: 'npm test -- import' });
  value.technicalSnapshot.artifactRecords = [];
  value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.filter((row) => row.constraintId !== 'ART-export');
  value.technicalSnapshot.constraintBindings.push(...['PATH-standalone-2', 'CMD-import'].map((constraintId) => ({
    constraintId, sourceRefs: ['SPAN-MUST-002'], applicableMustRefs: ['MUST-002'], premiseRefs: ['SPAN-MUST-002'] })));
  if (options.localBoundary) {
    value.sourceObligations[1].applicability = { scope: 'obligations', obligationRefs: ['MUST-001'], sourceRefs: ['SPAN-NEG-001'] };
    value.technicalSnapshot.constraintBindings.find((row) => row.constraintId === 'STOP-standalone-1')!.scope = 'declared';
  }
  attachCanonicalRequirementGraph(value);
  return compileStandaloneGoalExecution(value);
}

export async function typedTwoActionIR(options: { localBoundary?: boolean } = {}) {
  return (await typedTwoActionExecution(options)).goalExecutionIr;
}

export async function typedAggregateExecution() {
  const value = normativeRoleInput();
  value.technicalSnapshot.artifactRecords = [];
  value.technicalSnapshot.constraintBindings = value.technicalSnapshot.constraintBindings!.filter((row) => row.constraintId !== 'ART-export');
  for (const [index, phase] of ['post_child_execution', 'final_aggregate'].entries()) {
    const id = `MUST-00${index + 2}`;
    const commandId = `CMD-aggregate-${index + 1}`;
    value.sourceObligations.push({ ...structuredClone(value.sourceObligations[0]), id,
      exactText: `Verify aggregate ${phase}.`, requiredOutcome: `Aggregate ${phase} checks pass.`,
      specSpanRefs: [`SPAN-${id}`], applicability: { scope: 'global', sourceRefs: [`SPAN-${id}`] },
      taskExecution: { executionClass: 'aggregate_only', ownedProductionPaths: '`none`', aggregateGatePhase: phase,
        aggregateValidationCommands: [commandId], sourceRefs: [`SPAN-${id}`] } });
    value.logicalSpecSpans.push({
      specSpanId: `SPAN-${id}`,
      sourceArtifactId: 'fixture:standalone-normative-roles',
      sourceSnapshotHash: value.sourceSnapshotHash,
      startByte: 96 + index * 16,
      endByteExclusive: 104 + index * 16,
      lineStart: 7 + index,
      lineEnd: 7 + index,
      exactTextHash: `sha256:${String(index + 8).repeat(64)}`,
      boundObligationIds: [id],
      evidenceClaimRefs: [],
    });
    value.technicalSnapshot.commandRecords.push({ commandId, invocation: `node -e "process.exit(0)"` });
    value.technicalSnapshot.constraintBindings.push({ constraintId: commandId, sourceRefs: [`SPAN-${id}`],
      applicableMustRefs: [id], applicableAtomRefs: [`${id}-A1`], premiseRefs: [`SPAN-${id}`] });
  }
  attachCanonicalRequirementGraph(value);
  return compileStandaloneGoalExecution(value);
}

export function typedConsumerProbe(ir: Record<string, unknown>, mutation = '') {
  const root = process.cwd();
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'goal-typed-consumer-test-'));
  const inputPath = path.join(temporaryRoot, 'test-only-ir.json');
  const runner = [
    'const fs=require("node:fs"),p=require("node:path");',
    'const ir=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));',
    'const base=p.join(process.cwd(),"packages/bmad-speckit/src/utils/goal-contract/control-plane");',
    'const activation=require(p.join(base,"frozen-goal-activation.ts"));',
    'const partition=require(p.join(base,"frozen-goal-partition.ts"));',
    'try { const eligibility=activation.compileFrozenGoalExecutionEligibility(ir);',
    'const compiled=partition.compilePartitionFromFrozenGoalAuthority({goalExecutionIr:ir,eligibility,',
    'executionAdapterRef:{path:"test-only/adapter.json",hash:"sha256:"+"a".repeat(64)}});',
    'const children=[],prompts=[];',
    'for(const [name,bytes]of compiled.files){if(name.endsWith("child-execution-contract.json"))children.push(JSON.parse(bytes.toString("utf8")));',
    'if(name.endsWith("human_prompt.txt"))prompts.push(bytes.toString("utf8"));}',
    'const mutation=process.argv[2];',
    'if(mutation==="missing-inherited"){children[0].obligationRefs=children[0].obligationRefs.filter(x=>x!=="NEG-001");children[0].inheritedObligationRefs=children[0].inheritedObligationRefs.filter(x=>x!=="NEG-001");}',
    'if(mutation==="broadened-inherited"){children[1].obligationRefs.push("GUIDE-001");children[1].inheritedObligationRefs.push("GUIDE-001");}',
    'if(mutation==="flipped-polarity")children[0].obligations.find(x=>x.obligationId==="NEG-001").polarity="required";',
    'if(mutation==="swapped-command")children[0].commands=children[1].commands;',
    'if(mutation==="missing-constraint")children[0].executionConstraintRefs.pop();',
    'if(mutation==="forged-constraint")children[0].executionConstraints[0].canonicalValue="invented/value";',
    'if(mutation==="dropped-stop")children.find(child=>child.logicalScopes.stopConditions?.length).logicalScopes.stopConditions=[];',
    'if(mutation==="owned-path"){children[0].logicalScopes.ownedPaths.push("unrelated/secrets.ts");compiled.manifest.partitions[0].ownedPaths.push("unrelated/secrets.ts");}',
    'if(mutation==="forbidden-path"){children[0].logicalScopes.forbiddenPaths=[];compiled.manifest.partitions[0].forbiddenPaths=[];}',
    'if(mutation==="domain-path")children[0].executionDomains[0].ownership.push({targetPath:"unrelated/secrets.ts",owner:"test-only"});',
    'if(mutation==="dependency")children[0].dependencies.push({from:"TASK-001",to:"TASK-001",basisRefs:[]});',
    'if(mutation==="coexecution")children[0].coExecutionConstraints.push({constraintId:"CTM-invented",taskRefs:["TASK-001","TASK-002"],basisRefs:[]});',
    'if(mutation==="restriction-scope")children[0].logicalScopes.pathRestrictions[0].scope="global";',
    'for(let i=0;i<children.length;i++)partition.validateTypedPartitionChild(ir,eligibility.components,compiled.manifest.partitions[i],children[i]);',
    'process.stdout.write(JSON.stringify({evidenceClass:"test-only-consumer-probe",eligibility,manifest:compiled.manifest,children,prompts}));',
    '} catch(error) {process.stdout.write(JSON.stringify({error:error.message}));}',
  ].join('');
  try {
    writeFileSync(inputPath, JSON.stringify(ir), { encoding: 'utf8', flag: 'wx' });
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), '-e', runner, inputPath, mutation],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error(`consumer_probe_failed:${result.status}:${result.stderr.slice(0, 500)}`);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}
