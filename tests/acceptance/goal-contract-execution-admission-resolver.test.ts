import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import { transitionGoalExecutionAttempt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-execution-attempt';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import {
  compileGoalExecutionIR,
  goalExecutionIRHash,
  type GoalExecutionCompilerInput,
  type GoalExecutionIR,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const ACTIVATION_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-activation.ts'
);
const ATTEMPT_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'main-agent-goal-execution-attempt.ts'
);
const RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"));',
  'try {',
  '  const result = runtime[process.argv[2]](input);',
  '  process.stdout.write(JSON.stringify({ ok: true, result }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

function callRuntime<T>(modulePath: string, exportName: string, input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      RUNNER,
      modulePath,
      exportName,
      Buffer.from(JSON.stringify(input), 'utf8').toString('base64'),
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return {
    ...completed,
    output: JSON.parse(completed.stdout) as
      | { ok: true; result: T }
      | { ok: false; issueCode: string },
  };
}

function callActivationRuntime<T>(exportName: string, input: unknown) {
  if (
    exportName === 'activateFrozenGoalAuthority' &&
    input &&
    typeof input === 'object' &&
    typeof (input as { goalAuthorityPath?: unknown }).goalAuthorityPath === 'string'
  ) {
    materializeGoalRunExecutionAdapter(
      path.dirname(path.dirname((input as { goalAuthorityPath: string }).goalAuthorityPath))
    );
  }
  return callRuntime<T>(ACTIVATION_MODULE, exportName, input);
}

function callAttemptRuntime<T>(exportName: string, input: unknown) {
  return callRuntime<T>(ATTEMPT_MODULE, exportName, input);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function controlPlaneHash(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')}`;
}

function writeCanonicalRecord(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(canonicalize(value))}\n`, 'utf8');
}

function compilePartitionFixtureIr(input: GoalExecutionCompilerInput): GoalExecutionIR {
  const base = compileGoalExecutionIR(input);
  const [firstTask, secondTask] = base.atomicTasks;
  const [baseObligation] = base.obligations;
  const firstObligation = { ...baseObligation, atomRefs: firstTask.atomRefs };
  const secondObligation = {
    ...baseObligation,
    obligationId: 'MUST-EXECUTION-ADMISSION-002',
    text: 'Verify the independent execution admission partition.',
    atomRefs: secondTask.atomRefs,
  };
  const firstCommand = {
    ...base.commands[0],
    commandId: 'CMD-EXECUTION-ADMISSION-001',
    obligationRefs: [firstObligation.obligationId],
    atomRefs: firstTask.atomRefs,
  };
  const secondCommand = {
    ...base.commands[0],
    commandId: 'CMD-EXECUTION-ADMISSION-002',
    obligationRefs: [secondObligation.obligationId],
    atomRefs: secondTask.atomRefs,
  };
  const firstEvidence = {
    ...base.evidenceContracts[0],
    evidenceContractId: 'EVD-EXECUTION-ADMISSION-001',
    obligationRefs: [firstObligation.obligationId],
    atomRefs: firstTask.atomRefs,
  };
  const secondEvidence = {
    ...base.evidenceContracts[0],
    evidenceContractId: 'EVD-EXECUTION-ADMISSION-002',
    obligationRefs: [secondObligation.obligationId],
    atomRefs: secondTask.atomRefs,
  };
  const draft = {
    ...base,
    obligations: [firstObligation, secondObligation],
    aliases: [firstObligation, secondObligation].map((obligation) => ({
      aliasId: `requirements_backed:${obligation.obligationId}`,
      obligationId: obligation.obligationId,
      sourceRefs: obligation.sourceRefs,
    })),
    logicalSpecSpans: [
      {
        ...base.logicalSpecSpans[0],
        specSpanId: 'SPAN-EXECUTION-ADMISSION-001',
        boundObligationIds: [firstObligation.obligationId],
      },
      {
        ...base.logicalSpecSpans[0],
        specSpanId: 'SPAN-EXECUTION-ADMISSION-002',
        boundObligationIds: [secondObligation.obligationId],
      },
    ],
    executionDomains: [
      {
        ...base.executionDomains[0],
        executionDomainId: 'DOMAIN-EXECUTION-ADMISSION-001',
        logicalTargetPaths: ['src/partition-one.cjs'],
      },
      {
        ...base.executionDomains[0],
        executionDomainId: 'DOMAIN-EXECUTION-ADMISSION-002',
        logicalTargetPaths: ['src/partition-two.cjs'],
      },
    ],
    traceSlices: [
      {
        traceSliceId: 'TRACE-EXECUTION-ADMISSION-001',
        executionDomainRef: 'DOMAIN-EXECUTION-ADMISSION-001',
        obligationRefs: [firstObligation.obligationId],
        taskRefs: [firstTask.taskId],
        commandRefs: [firstCommand.commandId],
        evidenceContractRefs: [firstEvidence.evidenceContractId],
        basisRefs: firstObligation.sourceRefs,
      },
      {
        traceSliceId: 'TRACE-EXECUTION-ADMISSION-002',
        executionDomainRef: 'DOMAIN-EXECUTION-ADMISSION-002',
        obligationRefs: [secondObligation.obligationId],
        taskRefs: [secondTask.taskId],
        commandRefs: [secondCommand.commandId],
        evidenceContractRefs: [secondEvidence.evidenceContractId],
        basisRefs: secondObligation.sourceRefs,
      },
    ],
    atomicTasks: [
      { ...firstTask, obligationRefs: [firstObligation.obligationId] },
      { ...secondTask, obligationRefs: [secondObligation.obligationId] },
    ],
    dependencies: [
      {
        from: secondTask.taskId,
        to: firstTask.taskId,
        basisRefs: ['DEP-EXECUTION-ADMISSION-001'],
      },
    ],
    logicalScopes: {
      ownedPaths: ['src/partition-one.cjs', 'src/partition-two.cjs'],
      forbiddenPaths: base.logicalScopes.forbiddenPaths,
    },
    commands: [firstCommand, secondCommand],
    evidenceContracts: [firstEvidence, secondEvidence],
    artifacts: [
      {
        ...base.artifacts[0],
        artifactId: 'ART-EXECUTION-ADMISSION-001',
        logicalPath: 'src/partition-one.cjs',
        obligationRefs: [firstObligation.obligationId],
      },
      {
        ...base.artifacts[0],
        artifactId: 'ART-EXECUTION-ADMISSION-002',
        logicalPath: 'src/partition-two.cjs',
        obligationRefs: [secondObligation.obligationId],
      },
    ],
    goalExecutionIRHash: '',
  } as GoalExecutionIR;
  return { ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) };
}

function materializeActiveRun(
  beforeReadiness?: (fixture: ReturnType<typeof materializeImplementationReadinessFixture>) => void
) {
  const fixture = materializeImplementationReadinessFixture();
  beforeReadiness?.(fixture);
  produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
  const generated = compileRequirementsBackedGoal({
    projectRoot: fixture.root,
    requirementRecordPath: fixture.runtimeRecordPath,
    outRoot: path.join(fixture.root, 'goal-run'),
  });
  const activationCall = callActivationRuntime<{
    artifacts: Array<{ role: string; artifactRef: string }>;
  }>('activateFrozenGoalAuthority', {
    projectRoot: fixture.root,
    goalAuthorityPath: generated.activeAuthorityRef.path,
  });
  if (!activationCall.output.ok) throw new Error(activationCall.output.issueCode);
  const activated = activationCall.output.result;
  const activeRunPointerPath = activated.artifacts.find(
    (artifact) => artifact.role === 'active_run_pointer'
  )?.artifactRef;
  if (!activeRunPointerPath) throw new Error('active_run_pointer_missing');
  return { fixture, generated, activeRunPointerPath };
}

function beginExecutionResume(fixtureRoot: string, activeRunPointerPath: string): void {
  const resolvedCall = callActivationRuntime<{
    outRoot: string;
    activeRunPointer: { activeRunPointerHash: string };
    activationRecord: { activationRecordHash: string };
    orderedExecutionAuthorityIds: string[];
    executionAuthorities: unknown[];
  }>('resolveCommittedActiveRun', {
    projectRoot: fixtureRoot,
    activeRunPointerPath,
  });
  expect(resolvedCall.status, resolvedCall.stderr || resolvedCall.stdout).toBe(0);
  if (!resolvedCall.output.ok) throw new Error(resolvedCall.output.issueCode);
  const resolved = resolvedCall.output.result;
  const preparedCall = callAttemptRuntime<{
    pointer: {
      attemptPointerHash: string;
      pointerVersion: number;
      nextExecutionAuthorityId: string;
    };
  }>('prepareGoalExecutionAttempt', {
    projectRoot: fixtureRoot,
    outRoot: resolved.outRoot,
    activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
    activationRecordHash: resolved.activationRecord.activationRecordHash,
    orderedExecutionAuthorityIds: resolved.orderedExecutionAuthorityIds,
    executionAuthorities: resolved.executionAuthorities,
  });
  expect(preparedCall.status, preparedCall.stderr || preparedCall.stdout).toBe(0);
  if (!preparedCall.output.ok) throw new Error(preparedCall.output.issueCode);
  const prepared = preparedCall.output.result;
  transitionGoalExecutionAttempt({
    outRoot: resolved.outRoot,
    expectedPointerHash: prepared.pointer.attemptPointerHash,
    expectedPointerVersion: prepared.pointer.pointerVersion,
    phase: 'executing',
    nextExecutionAuthorityId: prepared.pointer.nextExecutionAuthorityId,
    validClosureRefs: [],
    blockedIssueCode: null,
  });
}

function closeExecutionAttempt(fixtureRoot: string, activeRunPointerPath: string): void {
  const resolvedCall = callActivationRuntime<{
    outRoot: string;
    activeRunPointer: { activeRunPointerHash: string };
    activationRecord: { activationRecordHash: string };
    orderedExecutionAuthorityIds: string[];
    executionAuthorities: Array<Record<string, unknown>>;
  }>('resolveCommittedActiveRun', { projectRoot: fixtureRoot, activeRunPointerPath });
  expect(resolvedCall.status, resolvedCall.stderr || resolvedCall.stdout).toBe(0);
  if (!resolvedCall.output.ok) throw new Error(resolvedCall.output.issueCode);
  const resolved = resolvedCall.output.result;
  const preparedCall = callAttemptRuntime<{
    pointer: {
      attemptPointerHash: string;
      pointerVersion: number;
      nextExecutionAuthorityId: string;
    };
  }>('prepareGoalExecutionAttempt', {
    projectRoot: fixtureRoot,
    outRoot: resolved.outRoot,
    activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
    activationRecordHash: resolved.activationRecord.activationRecordHash,
    orderedExecutionAuthorityIds: resolved.orderedExecutionAuthorityIds,
    executionAuthorities: resolved.executionAuthorities,
  });
  expect(preparedCall.status, preparedCall.stderr || preparedCall.stdout).toBe(0);
  if (!preparedCall.output.ok) throw new Error(preparedCall.output.issueCode);
  const prepared = preparedCall.output.result;
  const executing = transitionGoalExecutionAttempt({
    outRoot: resolved.outRoot,
    expectedPointerHash: prepared.pointer.attemptPointerHash,
    expectedPointerVersion: prepared.pointer.pointerVersion,
    phase: 'executing',
    nextExecutionAuthorityId: prepared.pointer.nextExecutionAuthorityId,
    validClosureRefs: [],
    blockedIssueCode: null,
  });
  const authority = resolved.executionAuthorities[0];
  const closurePayload = {
    schemaVersion: 'GoalExecutionAuthorityClosure/v1',
    profile: authority.profile,
    candidateRunId: authority.candidateRunId,
    activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
    activationRecordHash: resolved.activationRecord.activationRecordHash,
    executionAuthorityId: authority.executionAuthorityId,
    executionAuthorityHash: authority.executionAuthorityHash,
    executionPackageHash: authority.executionPackageHash,
    evidenceRef: { path: 'goal/runtime/evidence.json', hash: `sha256:${'e'.repeat(64)}` },
    dependencyClosureRefs: [],
    changedPaths: [],
    commitProof: { kind: 'not_applicable' },
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    decision: 'pass',
  };
  const closure = { ...closurePayload, closureHash: controlPlaneHash(closurePayload) };
  const closurePath = path.join(
    resolved.outRoot,
    'goal',
    'runtime',
    'closures',
    `${String(authority.executionAuthorityId)}.json`
  );
  mkdirSync(path.dirname(closurePath), { recursive: true });
  writeCanonicalRecord(closurePath, closure);
  const closed = transitionGoalExecutionAttempt({
    outRoot: resolved.outRoot,
    expectedPointerHash: executing.pointer.attemptPointerHash,
    expectedPointerVersion: executing.pointer.pointerVersion,
    phase: 'closure_pending',
    nextExecutionAuthorityId: null,
    validClosureRefs: [
      {
        executionAuthorityId: String(authority.executionAuthorityId),
        path: path.relative(resolved.outRoot, closurePath).replace(/\\/gu, '/'),
        hash: closure.closureHash,
      },
    ],
    blockedIssueCode: null,
  });
  transitionGoalExecutionAttempt({
    outRoot: resolved.outRoot,
    expectedPointerHash: closed.pointer.attemptPointerHash,
    expectedPointerVersion: closed.pointer.pointerVersion,
    phase: 'closed',
    nextExecutionAuthorityId: null,
    validClosureRefs: closed.pointer.validClosureRefs,
    blockedIssueCode: null,
  });
}

describe('goal execution admission and committed active-run resolution', () => {
  it('returns verified direct execution and Task 5B readiness views', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      const call = callActivationRuntime<{
        outRoot: string;
        activeRunPointer: { activeRunPointerHash: string };
        activationRecord: { activationRecordHash: string };
        orderedExecutionAuthorityIds: string[];
        executionAuthorities: Array<{
          executionAuthorityId: string;
          executionAuthorityHash: string;
          executionPackageHash: string;
          ownedPaths: string[];
          forbiddenPaths: string[];
          commands: unknown[];
          dependencies: unknown[];
        }>;
        requirementsReadiness: {
          readinessScopedInputDigest: string;
          candidateRef: { path: string; hash: string };
          normalizedCommands: unknown[];
          inputArtifacts: unknown[];
          redOutcomes: unknown[];
        };
      }>('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });
      expect(call.status, call.stderr || call.stdout).toBe(0);
      if (!call.output.ok) throw new Error(call.output.issueCode);
      const resolved = call.output.result;

      expect(resolved.orderedExecutionAuthorityIds).toHaveLength(1);
      expect(resolved.executionAuthorities).toEqual([
        expect.objectContaining({
          executionAuthorityId: resolved.orderedExecutionAuthorityIds[0],
          executionAuthorityHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          executionPackageHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          ownedPaths: ['src/refund-worker.cjs'],
          forbiddenPaths: expect.arrayContaining(['.git/**']),
          commands: expect.any(Array),
          dependencies: expect.any(Array),
        }),
      ]);
      expect(resolved.requirementsReadiness).toMatchObject({
        readinessScopedInputDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        candidateRef: {
          path: expect.any(String),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
        normalizedCommands: expect.any(Array),
        inputArtifacts: expect.any(Array),
        redOutcomes: expect.any(Array),
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('resolves the committed GoalExecutionIR without reading mutable authoring projections', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      rmSync(generated.activeAuthorityRef.path, { force: true });

      const resolved = callActivationRuntime<{ goalExecutionIRHash: string }>(
        'resolveCommittedActiveRun',
        {
          projectRoot: fixture.root,
          activeRunPointerPath,
        }
      );
      expect(resolved.status, resolved.stderr || resolved.stdout).toBe(0);
      expect(resolved.output).toEqual({
        ok: true,
        result: expect.objectContaining({ goalExecutionIRHash: generated.goalExecutionIRHash }),
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a partition dependency that is ordered after its consumer', () => {
    const fixture = materializeImplementationReadinessFixture({ additionalGoalAtoms: 1 });
    try {
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const generated = compileRequirementsBackedGoal(
        {
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
        },
        { compileGoalExecutionIR: compilePartitionFixtureIr }
      );
      const activated = callActivationRuntime<{
        artifacts: Array<{ role: string; artifactRef: string }>;
      }>('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      if (!activated.output.ok) throw new Error(activated.output.issueCode);
      const byRole = new Map(
        activated.output.result.artifacts.map((artifact) => [artifact.role, artifact.artifactRef])
      );
      const activeRunPointerPath = byRole.get('active_run_pointer');
      if (!activeRunPointerPath) throw new Error('active_run_pointer_missing');
      const resolved = callActivationRuntime<{
        orderedExecutionAuthorityIds: string[];
        executionAuthorities: Array<{ dependencyExecutionAuthorityIds: string[] }>;
      }>('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });
      expect(resolved.status, resolved.stderr || resolved.stdout).toBe(0);
      if (!resolved.output.ok) throw new Error(resolved.output.issueCode);
      expect(resolved.output.result.orderedExecutionAuthorityIds).toHaveLength(2);
      expect(
        resolved.output.result.executionAuthorities[1].dependencyExecutionAuthorityIds
      ).toEqual([resolved.output.result.orderedExecutionAuthorityIds[0]]);

      const manifestPath = byRole.get('partition_manifest');
      const candidatePath = byRole.get('candidate_run');
      const activationPath = byRole.get('activation_record');
      if (!manifestPath || !candidatePath || !activationPath) throw new Error('artifact_missing');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.topologicalOrder = [...manifest.topologicalOrder].reverse();
      delete manifest.partitionManifestHash;
      manifest.partitionManifestHash = controlPlaneHash(manifest);
      writeCanonicalRecord(manifestPath, manifest);
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      candidate.selectedPartitionManifestRef.hash = manifest.partitionManifestHash;
      delete candidate.candidateRunHash;
      candidate.candidateRunHash = controlPlaneHash(candidate);
      writeCanonicalRecord(candidatePath, candidate);
      const activation = JSON.parse(readFileSync(activationPath, 'utf8'));
      activation.candidateRunRef.hash = candidate.candidateRunHash;
      activation.selectedPartitionManifestRef.hash = manifest.partitionManifestHash;
      delete activation.activationRecordHash;
      activation.activationRecordHash = controlPlaneHash(activation);
      writeCanonicalRecord(activationPath, activation);
      const pointer = JSON.parse(readFileSync(activeRunPointerPath, 'utf8'));
      pointer.activationRecordHash = activation.activationRecordHash;
      delete pointer.activeRunPointerHash;
      pointer.activeRunPointerHash = controlPlaneHash(pointer);
      writeCanonicalRecord(activeRunPointerPath, pointer);
      const claimPath = path.join(
        path.dirname(activeRunPointerPath),
        'active-run-claims',
        `v${String(pointer.pointerVersion).padStart(16, '0')}.json`
      );
      const claim = JSON.parse(readFileSync(claimPath, 'utf8'));
      claim.activationRecordHash = activation.activationRecordHash;
      claim.nextActiveRunPointerHash = pointer.activeRunPointerHash;
      delete claim.claimHash;
      claim.claimHash = controlPlaneHash(claim);
      writeCanonicalRecord(claimPath, claim);

      const blocked = callActivationRuntime('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'goal_execution_package_invalid',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('requires the complete RED baseline before first execution start', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );

      const blocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:scoped_input_digest',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('allows only active-run owned target bytes to change during resume', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      const originalTestBytes = readFileSync(fixture.testPath);
      const originalConfigBytes = readFileSync(fixture.configPath);
      const originalLockBytes = readFileSync(fixture.lockPath);
      beginExecutionResume(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );

      const admitted = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(admitted.status, admitted.stderr || admitted.stdout).toBe(0);

      writeFileSync(fixture.testPath, "throw new Error('changed test identity');\n", 'utf8');
      const blocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:test_bytes',
      });

      writeFileSync(fixture.testPath, originalTestBytes);
      writeFileSync(fixture.configPath, '{"name":"changed-config"}\n', 'utf8');
      const configBlocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(configBlocked.status).toBe(1);
      expect(configBlocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:config_bytes',
      });

      writeFileSync(fixture.configPath, originalConfigBytes);
      const addedConfigPath = path.join(fixture.root, 'tsconfig.json');
      writeFileSync(addedConfigPath, '{"compilerOptions":{}}\n', 'utf8');
      const inputSetBlocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(inputSetBlocked.status).toBe(1);
      expect(inputSetBlocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:input_set',
      });

      rmSync(addedConfigPath, { force: true });
      writeFileSync(fixture.lockPath, '{"lockfileVersion":3,"changed":true}\n', 'utf8');
      const lockBlocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(lockBlocked.status).toBe(1);
      expect(lockBlocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:lock_bytes',
      });
      writeFileSync(fixture.lockPath, originalLockBytes);
    } finally {
      fixture.cleanup();
    }
  });

  it('classifies an added local dependency as input membership drift before test bytes', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      beginExecutionResume(fixture.root, activeRunPointerPath);
      writeFileSync(path.join(fixture.root, 'tests', 'helper.cjs'), 'module.exports = true;\n');
      writeFileSync(
        fixture.testPath,
        `require('./helper.cjs');\n${readFileSync(fixture.testPath, 'utf8')}`,
        'utf8'
      );

      const blocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:input_set',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('classifies a removed local dependency as input membership drift before test bytes', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun((preparedFixture) => {
      writeFileSync(
        path.join(preparedFixture.root, 'tests', 'helper.cjs'),
        'module.exports = true;\n'
      );
      writeFileSync(
        preparedFixture.testPath,
        `require('./helper.cjs');\n${readFileSync(preparedFixture.testPath, 'utf8')}`,
        'utf8'
      );
    });
    try {
      beginExecutionResume(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.testPath,
        readFileSync(fixture.testPath, 'utf8').replace("require('./helper.cjs');\n", ''),
        'utf8'
      );

      const blocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });
      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:input_set',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('does not replace the committed active run while its execution attempt is non-closed', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      beginExecutionResume(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });

      const blocked = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });

      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({ ok: false, issueCode: 'active_run_cas_conflict' });
    } finally {
      fixture.cleanup();
    }
  });

  it('does not replace a non-closed attempt when the active pointer and claim are missing', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      beginExecutionResume(fixture.root, activeRunPointerPath);
      const activeRunPointer = JSON.parse(readFileSync(activeRunPointerPath, 'utf8')) as {
        pointerVersion: number;
      };
      const claimPath = path.join(
        path.dirname(activeRunPointerPath),
        'active-run-claims',
        `v${String(activeRunPointer.pointerVersion).padStart(16, '0')}.json`
      );
      rmSync(activeRunPointerPath);
      rmSync(claimPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });

      const blocked = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });

      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({ ok: false, issueCode: 'active_run_cas_conflict' });
      expect(existsSync(activeRunPointerPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('fails closed on noncanonical active-run pointer bytes during activation reuse', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      const activeRunPointer = JSON.parse(readFileSync(activeRunPointerPath, 'utf8'));
      writeFileSync(activeRunPointerPath, `${JSON.stringify(activeRunPointer, null, 2)}\n`, 'utf8');

      const blocked = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
      });

      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({ ok: false, issueCode: 'active_run_cas_conflict' });
    } finally {
      fixture.cleanup();
    }
  });

  it('restores the highest continuous active-run claim for its non-closed attempt', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      closeExecutionAttempt(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const activated = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      const successorPointer = JSON.parse(readFileSync(activeRunPointerPath, 'utf8')) as {
        pointerVersion: number;
        activeRunPointerHash: string;
      };
      expect(successorPointer.pointerVersion).toBe(2);
      beginExecutionResume(fixture.root, activeRunPointerPath);
      rmSync(activeRunPointerPath);

      const recovered = callActivationRuntime<{ status: string }>('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });

      expect(recovered.status, recovered.stderr || recovered.stdout).toBe(0);
      expect(recovered.output).toMatchObject({
        ok: true,
        result: { status: 'activation_reused' },
      });
      expect(JSON.parse(readFileSync(activeRunPointerPath, 'utf8'))).toEqual(successorPointer);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects execution admission when the active pointer trails the highest claim', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      const previousPointerBytes = readFileSync(activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const activated = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      writeFileSync(activeRunPointerPath, previousPointerBytes);

      const rejected = callActivationRuntime('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });

      expect(rejected.status).toBe(1);
      expect(rejected.output).toEqual({ ok: false, issueCode: 'active_run_cas_conflict' });
    } finally {
      fixture.cleanup();
    }
  });

  it('does not restore a requested claim that conflicts with a non-closed attempt', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      beginExecutionResume(fixture.root, activeRunPointerPath);
      const attemptPointerPath = path.join(
        fixture.root,
        'goal-run',
        'goal',
        'runtime',
        'current-execution-attempt.json'
      );
      const nonClosedAttemptBytes = readFileSync(attemptPointerPath);
      closeExecutionAttempt(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const activated = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      writeFileSync(attemptPointerPath, nonClosedAttemptBytes);
      rmSync(activeRunPointerPath);

      const rejected = callActivationRuntime('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });

      expect(rejected.status).toBe(1);
      expect(rejected.output).toEqual({ ok: false, issueCode: 'active_run_cas_conflict' });
      expect(existsSync(activeRunPointerPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a caller-forged authority snapshot before creating an execution attempt', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      const resolvedCall = callActivationRuntime<{
        outRoot: string;
        activeRunPointer: { activeRunPointerHash: string };
        activationRecord: { activationRecordHash: string };
        orderedExecutionAuthorityIds: string[];
        executionAuthorities: Array<Record<string, unknown>>;
      }>('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });
      expect(resolvedCall.status, resolvedCall.stderr || resolvedCall.stdout).toBe(0);
      if (!resolvedCall.output.ok) throw new Error(resolvedCall.output.issueCode);
      const resolved = resolvedCall.output.result;
      const forgedAuthorities = resolved.executionAuthorities.map((authority) => ({
        ...authority,
        ownedPaths: ['src/caller-forged.ts'],
      }));

      const rejected = callAttemptRuntime('prepareGoalExecutionAttempt', {
        projectRoot: fixture.root,
        outRoot: resolved.outRoot,
        activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
        activationRecordHash: resolved.activationRecord.activationRecordHash,
        orderedExecutionAuthorityIds: resolved.orderedExecutionAuthorityIds,
        executionAuthorities: forgedAuthorities,
      });
      expect(rejected.status).toBe(1);
      expect(rejected.output).toEqual({
        ok: false,
        issueCode: 'goal_execution_attempt_cas_conflict',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('replaces a closed attempt with a successor active-run attempt under CAS', () => {
    const { fixture, activeRunPointerPath } = materializeActiveRun();
    try {
      closeExecutionAttempt(fixture.root, activeRunPointerPath);
      writeFileSync(
        fixture.targetPath,
        `${readFileSync(fixture.targetPath, 'utf8')}// successor readiness\n`,
        'utf8'
      );
      produceImplementationReadiness({ projectRoot: fixture.root, requestId: fixture.requestId });
      const successor = compileRequirementsBackedGoal({
        projectRoot: fixture.root,
        requirementRecordPath: fixture.runtimeRecordPath,
        outRoot: path.join(fixture.root, 'goal-run'),
      });
      const previousPointer = JSON.parse(readFileSync(activeRunPointerPath, 'utf8'));
      const successorLockPath = `${activeRunPointerPath}.lock-v${String(
        Number(previousPointer.pointerVersion) + 1
      ).padStart(16, '0')}`;
      const crashedTicketPath = `${successorLockPath}.owner-00000000000000000001-crashed-active-run-owner.ticket`;
      mkdirSync(path.dirname(crashedTicketPath), { recursive: true });
      writeCanonicalRecord(crashedTicketPath, {
        schemaVersion: 'ControlPlaneGenerationLockMarker/v1',
        lockSchemaVersion: 'GoalContractActiveRunLock/v2',
        markerKind: 'ticket',
        ownerPid: 2_147_483_647,
        ownerProcessStartIdentity: 'linux-start-ticks:0',
        ownerToken: 'crashed-active-run-owner',
        ticket: '1',
        acquiredAtMs: 0,
        leaseExpiresAtMs: 1,
      });
      utimesSync(crashedTicketPath, new Date(0), new Date(0));
      const activated = callActivationRuntime<{
        artifacts: Array<{ role: string; artifactRef: string }>;
      }>('activateFrozenGoalAuthority', {
        projectRoot: fixture.root,
        goalAuthorityPath: successor.activeAuthorityRef.path,
      });
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      if (!activated.output.ok) throw new Error(activated.output.issueCode);
      const successorPointerPath = activated.output.result.artifacts.find(
        (artifact) => artifact.role === 'active_run_pointer'
      )?.artifactRef;
      if (!successorPointerPath) throw new Error('active_run_pointer_missing');
      const resolvedCall = callActivationRuntime<{
        outRoot: string;
        activeRunPointer: { activeRunPointerHash: string };
        activationRecord: { activationRecordHash: string };
        orderedExecutionAuthorityIds: string[];
        executionAuthorities: unknown[];
      }>('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath: successorPointerPath,
      });
      expect(resolvedCall.status, resolvedCall.stderr || resolvedCall.stdout).toBe(0);
      if (!resolvedCall.output.ok) throw new Error(resolvedCall.output.issueCode);
      const resolved = resolvedCall.output.result;

      const prepared = callAttemptRuntime<{
        recovered: boolean;
        pointer: { pointerVersion: number; phase: string };
      }>('prepareGoalExecutionAttempt', {
        projectRoot: fixture.root,
        outRoot: resolved.outRoot,
        activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
        activationRecordHash: resolved.activationRecord.activationRecordHash,
        orderedExecutionAuthorityIds: resolved.orderedExecutionAuthorityIds,
        executionAuthorities: resolved.executionAuthorities,
      });
      expect(prepared.status, prepared.stderr || prepared.stdout).toBe(0);
      if (!prepared.output.ok) throw new Error(prepared.output.issueCode);
      expect(prepared.output.result).toMatchObject({
        recovered: false,
        pointer: { pointerVersion: 1, phase: 'prepared' },
      });
      expect(existsSync(crashedTicketPath)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('treats blocked-before-execution as a fresh start rather than an owned-path resume', () => {
    const { fixture, generated, activeRunPointerPath } = materializeActiveRun();
    try {
      const resolvedCall = callActivationRuntime<{
        outRoot: string;
        activeRunPointer: { activeRunPointerHash: string };
        activationRecord: { activationRecordHash: string };
        orderedExecutionAuthorityIds: string[];
        executionAuthorities: unknown[];
      }>('resolveCommittedActiveRun', {
        projectRoot: fixture.root,
        activeRunPointerPath,
      });
      expect(resolvedCall.status, resolvedCall.stderr || resolvedCall.stdout).toBe(0);
      if (!resolvedCall.output.ok) throw new Error(resolvedCall.output.issueCode);
      const resolved = resolvedCall.output.result;
      const preparedCall = callAttemptRuntime<{
        pointer: {
          attemptPointerHash: string;
          pointerVersion: number;
          nextExecutionAuthorityId: string;
        };
      }>('prepareGoalExecutionAttempt', {
        projectRoot: fixture.root,
        outRoot: resolved.outRoot,
        activeRunPointerHash: resolved.activeRunPointer.activeRunPointerHash,
        activationRecordHash: resolved.activationRecord.activationRecordHash,
        orderedExecutionAuthorityIds: resolved.orderedExecutionAuthorityIds,
        executionAuthorities: resolved.executionAuthorities,
      });
      expect(preparedCall.status, preparedCall.stderr || preparedCall.stdout).toBe(0);
      if (!preparedCall.output.ok) throw new Error(preparedCall.output.issueCode);
      const prepared = preparedCall.output.result;
      transitionGoalExecutionAttempt({
        outRoot: resolved.outRoot,
        expectedPointerHash: prepared.pointer.attemptPointerHash,
        expectedPointerVersion: prepared.pointer.pointerVersion,
        phase: 'blocked',
        nextExecutionAuthorityId: prepared.pointer.nextExecutionAuthorityId,
        validClosureRefs: [],
        blockedIssueCode: 'pre_execution_environment_blocked',
      });
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'accepted' };\n",
        'utf8'
      );

      const blocked = callActivationRuntime('validateGoalExecutionAdmission', {
        phase: 'execution_start_or_resume',
        projectRoot: fixture.root,
        goalAuthorityPath: generated.activeAuthorityRef.path,
        activeRunPointerPath,
      });

      expect(blocked.status).toBe(1);
      expect(blocked.output).toEqual({
        ok: false,
        issueCode: 'readiness_recheck_required:scoped_input_digest',
      });
    } finally {
      fixture.cleanup();
    }
  });
});
