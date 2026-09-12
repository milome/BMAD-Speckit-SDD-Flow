import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256Stable, sha256Text, stableStringify } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { compileStandaloneGoalExecution } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-ir';
import { compileGoalExecutionClosure } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-closure';
import { goalExecutionIRHash } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { normalizeGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';
import { materializeGoalRunExecutionAdapter } from './goal-run-execution-adapter-fixture';
import { normativeRoleInput } from './standalone-goal-normative-roles';
import { typedTwoActionExecution, typedAggregateExecution } from './standalone-goal-typed-consumers';

// Frozen authority fixtures deliberately exercise independently rehashed nested records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function typedActivationProbe(mode: 'direct' | 'partitioned' | 'aggregate', mutation = '', dictionary = false) {
  const input = normativeRoleInput();
  if (dictionary) input.sourceObligations[0].exactText = 'Implement export with all declared constraints. '.repeat(3000);
  const compiled = { ...structuredClone(mode === 'direct'
    ? compileStandaloneGoalExecution(input)
    : mode === 'aggregate' ? await typedAggregateExecution() : await typedTwoActionExecution({ localBoundary: true })) };
  const root = process.cwd();
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'test-only-typed-goal-activation-'));
  const outRoot = path.join(projectRoot, 'test-only-authority');
  const goalRoot = path.join(outRoot, 'goal');
  mkdirSync(goalRoot, { recursive: true });
  const rehash = (value: Row, field: string) => { delete value[field]; value[field] = sha256Stable(value); };
  const write = (name: string, value: Row, field: string) => {
    const relativePath = `goal/${name}.json`;
    writeFileSync(path.join(outRoot, relativePath), `${stableStringify(value)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { path: relativePath, hash: value[field] };
  };
  try {
    const ir = compiled.goalExecutionIr;
    if (mutation === 'ir-content') {
      ir.obligations[0].text = 'UNAUTHORIZED test-only change after authoring.';
      ir.goalExecutionIRHash = goalExecutionIRHash(ir);
      compiled.closure = compileGoalExecutionClosure(ir);
    }
    if (mutation === 'closure-content') { compiled.closure.coverage.obligationIds = []; rehash(compiled.closure, 'goalExecutionClosureHash'); }
    if (mutation === 'closure-version') { compiled.closure.schemaVersion = 'GoalExecutionClosure/v1';
      delete compiled.closure.coverage.nonActionObligationIds; rehash(compiled.closure, 'goalExecutionClosureHash'); }
    const binding: Row = { schemaVersion: 'GoalSourceBinding/v1', profile: 'standalone', goalExecutionIRHash: ir.goalExecutionIRHash,
      sourcePlanHash: ir.standaloneLineage!.sourcePlanHash, sourceSnapshotHash: ir.standaloneLineage!.sourceSnapshotHash };
    if (mutation === 'binding-source') binding.sourcePlanHash = `sha256:${'f'.repeat(64)}`;
    rehash(binding, 'goalSourceBindingHash');
    const evidence: Row = { schemaVersion: 'GoalContractResolvedEvidenceIndex/v1', profile: 'standalone', goalExecutionIRHash: ir.goalExecutionIRHash,
      goalSourceBindingHash: binding.goalSourceBindingHash, resolutions: ir.obligations.map((row) => ({ goalObligationId: row.obligationId,
        logicalSpecSpanRefs: row.sourceRefs.filter((ref) => ref.startsWith('SPAN-')), evidenceClaimRefs: row.evidenceClaimRefs })) };
    if (mutation === 'missing-evidence-resolution') evidence.resolutions.pop();
    if (mutation === 'swapped-evidence-source') evidence.resolutions[0].logicalSpecSpanRefs = evidence.resolutions[1].logicalSpecSpanRefs;
    rehash(evidence, 'resolvedEvidenceIndexHash');
    const projection = '# Test-only activation fixture\n';
    writeFileSync(path.join(goalRoot, 'projection.md'), projection, 'utf8');
    const report = `${JSON.stringify({ evidenceClass: 'test-only-renderability-input' })}\n`;
    writeFileSync(path.join(goalRoot, 'renderability.json'), report, 'utf8');
    const active: Row = { schemaVersion: 'GoalContractActiveAuthority/v1', profile: 'standalone', goalId: ir.goalId, goalExecutionIRHash: ir.goalExecutionIRHash,
      standaloneSemanticIrRef: write('semantic', compiled.standaloneGoalSemanticIr, 'standaloneGoalSemanticIRHash'),
      standaloneInternalSemanticGateRef: write('test-only-internal-semantic-gate', compiled.internalSemanticGate, 'gateHash'),
      goalExecutionIrRef: write('ir', normalizeGoalExecutionAuthority(ir), 'goalExecutionIRHash'), closureRef: write('closure', compiled.closure, 'goalExecutionClosureHash'),
      sourceBindingRef: write('binding', binding, 'goalSourceBindingHash'), resolvedEvidenceIndexRef: write('evidence', evidence, 'resolvedEvidenceIndexHash'),
      parentProjectionRef: { path: 'goal/projection.md', bytesHash: sha256Text(projection) }, renderabilityReportRef: { path: 'goal/renderability.json', bytesHash: sha256Text(report) } };
    rehash(active, 'activeAuthorityHash');
    write('active-authority', active, 'activeAuthorityHash');
    writeFileSync(path.join(projectRoot, 'TEST_ONLY_PROVENANCE.json'), JSON.stringify({ evidenceClass: 'automated-regression-only', actualJudgeDispatches: 0, humanConfirmed: false, businessExecution: false }), 'utf8');
    materializeGoalRunExecutionAdapter(outRoot, { executableSource: 'throw new Error("TEST_ONLY_EXECUTOR_MUST_NOT_RUN");' });
    const program = [
      'const path=require("node:path");const a=require(process.argv[1]);const projectRoot=process.argv[2];',
      'try {const goalAuthorityPath=path.join(projectRoot,"test-only-authority/goal/active-authority.json");',
      'const first=a.activateFrozenGoalAuthority({projectRoot,goalAuthorityPath});',
      'const second=a.activateFrozenGoalAuthority({projectRoot,goalAuthorityPath});',
      'const pointer=path.join(projectRoot,"test-only-authority/goal/runtime/active-run.json");',
      'const resumed=a.resolveCommittedActiveRun({projectRoot,activeRunPointerPath:pointer});',
      'process.stdout.write(JSON.stringify({first,second,resumed}));',
      '}catch(error){process.stdout.write(JSON.stringify({error:error.message,field:error.field}));}',
    ].join('');
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), '-e', program,
      path.join(root, 'packages/bmad-speckit/src/utils/goal-contract/control-plane/frozen-goal-activation.ts'), projectRoot],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 512 * 1024 });
    if (result.status !== 0) throw new Error(`activation_probe_failed:${result.status}:${result.stderr.slice(0, 500)}`);
    return { evidenceClass: 'test-only-activation-and-resume',
      semanticRepresentation: compiled.standaloneGoalSemanticIr.semanticPayload.schemaVersion ?? 'plain',
      ...JSON.parse(result.stdout) };
  } finally {
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}
