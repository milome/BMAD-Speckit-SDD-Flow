import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  compileGoalExecutionIR,
  goalExecutionIRHash,
  type GoalExecutionCompilerInput,
  type GoalExecutionIR,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { compileRequirementsBackedGoal } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { materializeGoalRunExecutionAdapter } from '../helpers/goal-run-execution-adapter-fixture';
import { materializeImplementationReadinessFixture } from '../helpers/implementation-readiness-fixture';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE_COMMAND = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'commands',
  'goal-contract.ts'
);
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
const PARTITION_MODULE = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-partition.ts'
);
const MAIN_AGENT_RUNTIME = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'runtime.ts'
);

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

function hashControlPlaneValue(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')}`;
}

function writeCanonicalRecord(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(canonicalize(value))}\n`, 'utf8');
}
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=2;});',
].join('');

function runSourceCommand(cwd: string, args: string[]) {
  if (args[0] === 'activate') {
    const authorityIndex = args.indexOf('--goal-authority');
    if (authorityIndex >= 0) {
      const outRoot = path.dirname(path.dirname(path.resolve(cwd, args[authorityIndex + 1])));
      if (!existsSync(path.join(outRoot, 'goal', 'execution-adapter', 'authority.json'))) {
        materializeGoalRunExecutionAdapter(outRoot);
      }
    }
  }
  return spawnSync(process.execPath, [TSX, '-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function runMainAgent(cwd: string, args: string[]) {
  const runner = [
    'const { mainAgentRuntimeCommand } = require(process.argv[1]);',
    'Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))',
    '.then((code)=>{process.exitCode=code;})',
    '.catch((error)=>{console.error(error);process.exitCode=2;});',
  ].join('');
  return spawnSync(process.execPath, [TSX, '-e', runner, MAIN_AGENT_RUNTIME, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function git(cwd: string, args: string[]): string {
  const completed = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return completed.stdout.trim();
}

function activateWithForbiddenSolver(cwd: string, goalAuthorityPath: string) {
  materializeGoalRunExecutionAdapter(path.dirname(path.dirname(goalAuthorityPath)));
  const runner = [
    'const partition = require(process.argv[1]);',
    'partition.compilePartitionFromFrozenGoalAuthority = () => { throw new Error("solver_invoked_before_reuse"); };',
    'const { activateFrozenGoalAuthority } = require(process.argv[2]);',
    'try {',
    '  const value = activateFrozenGoalAuthority({ projectRoot: process.argv[3], goalAuthorityPath: process.argv[4] });',
    '  process.stdout.write(JSON.stringify(value));',
    '} catch (error) {',
    '  console.error(error && error.stack ? error.stack : error);',
    '  process.exitCode = 1;',
    '}',
  ].join('\n');
  return spawnSync(
    process.execPath,
    [TSX, '-e', runner, PARTITION_MODULE, ACTIVATION_MODULE, cwd, goalAuthorityPath],
    { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
}

function compilePartitionFixtureIr(input: GoalExecutionCompilerInput): GoalExecutionIR {
  const base = compileGoalExecutionIR(input);
  const [firstTask, secondTask] = base.atomicTasks;
  const [baseObligation] = base.obligations;
  const firstObligation = {
    ...baseObligation,
    atomRefs: firstTask.atomRefs,
  };
  const secondObligation = {
    ...baseObligation,
    obligationId: 'MUST-PARTITION-002',
    text: 'Verify the independent partition result.',
    atomRefs: secondTask.atomRefs,
  };
  const [firstBaseCommand, secondBaseCommand = firstBaseCommand] = base.commands;
  const firstCommand = {
    ...firstBaseCommand,
    commandId: 'CMD-PARTITION-001',
    obligationRefs: [firstObligation.obligationId],
    atomRefs: firstTask.atomRefs,
  };
  const secondCommand = {
    ...secondBaseCommand,
    commandId: 'CMD-PARTITION-002',
    obligationRefs: [secondObligation.obligationId],
    atomRefs: secondTask.atomRefs,
  };
  const firstEvidence = {
    ...base.evidenceContracts[0],
    evidenceContractId: 'EVD-PARTITION-001',
    obligationRefs: [firstObligation.obligationId],
    atomRefs: firstTask.atomRefs,
  };
  const secondEvidence = {
    ...base.evidenceContracts[0],
    evidenceContractId: 'EVD-PARTITION-002',
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
        specSpanId: 'SPAN-PARTITION-001',
        boundObligationIds: [firstObligation.obligationId],
      },
      {
        ...base.logicalSpecSpans[0],
        specSpanId: 'SPAN-PARTITION-002',
        boundObligationIds: [secondObligation.obligationId],
      },
    ],
    executionDomains: [
      {
        ...base.executionDomains[0],
        executionDomainId: 'DOMAIN-001',
        logicalTargetPaths: ['src/partition-one.cjs'],
      },
      {
        ...base.executionDomains[0],
        executionDomainId: 'DOMAIN-002',
        logicalTargetPaths: ['src/partition-two.cjs'],
      },
    ],
    traceSlices: [
      {
        traceSliceId: 'TRACE-001',
        executionDomainRef: 'DOMAIN-001',
        obligationRefs: [firstObligation.obligationId],
        taskRefs: [firstTask.taskId],
        commandRefs: [firstCommand.commandId],
        evidenceContractRefs: [firstEvidence.evidenceContractId],
        basisRefs: firstObligation.sourceRefs,
      },
      {
        traceSliceId: 'TRACE-002',
        executionDomainRef: 'DOMAIN-002',
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
      { from: secondTask.taskId, to: firstTask.taskId, basisRefs: ['DEP-PARTITION-001'] },
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
        artifactId: 'ART-PARTITION-001',
        logicalPath: 'src/partition-one.cjs',
        obligationRefs: [firstObligation.obligationId],
      },
      {
        ...base.artifacts[0],
        artifactId: 'ART-PARTITION-002',
        logicalPath: 'src/partition-two.cjs',
        obligationRefs: [secondObligation.obligationId],
      },
    ],
    goalExecutionIRHash: '',
  } as GoalExecutionIR;
  return { ...draft, goalExecutionIRHash: goalExecutionIRHash(draft) };
}

describe('goal-contract partition controlled activation', () => {
  it('selects immutable child authorities before committing the active-run pointer', () => {
    const fixture = materializeImplementationReadinessFixture({ additionalGoalAtoms: 1 });
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = compileRequirementsBackedGoal(
        {
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot,
        },
        { compileGoalExecutionIR: compilePartitionFixtureIr }
      );

      const activated = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);

      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      const result = JSON.parse(activated.stdout);
      expect(result).toMatchObject({
        schemaVersion: 'goal-contract-activation-result/v1',
        status: 'activated',
        issueCode: null,
        executionMode: 'partitioned_goal',
        partitionOutcome: 'complete_valid',
      });
      expect(result.artifacts.map((artifact: { role: string }) => artifact.role)).toEqual([
        'goal_execution_authority',
        'execution_eligibility',
        'candidate_run',
        'activation_record',
        'partition_manifest',
        'child_execution_package',
        'child_execution_package',
        'active_run_pointer',
      ]);
      expect(
        result.artifacts.some(
          (artifact: { role: string }) => artifact.role === 'direct_execution_package'
        )
      ).toBe(false);

      const manifestArtifact = result.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'partition_manifest'
      );
      const manifest = JSON.parse(readFileSync(manifestArtifact.artifactRef, 'utf8'));
      expect(manifest).toMatchObject({
        schemaVersion: 'GoalContractPartitionManifest/v1',
        partitionOutcome: 'complete_valid',
        partitionCount: 2,
      });
      expect(manifest.partitions).toHaveLength(2);
      for (const partition of manifest.partitions) {
        expect(
          existsSync(
            path.resolve(
              path.dirname(manifestArtifact.artifactRef),
              partition.childContractRef.path
            )
          )
        ).toBe(true);
        expect(partition).toMatchObject({
          childContractRef: {
            path: expect.any(String),
            hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          },
          childExecutionPackageRef: {
            path: expect.any(String),
            hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          },
        });
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('executes each child with one owned-path commit and a dependency-ordered campaign closure', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalGoalAtoms: 1,
      targetPaths: ['src/partition-one.cjs', 'src/partition-two.cjs'],
      invocations: [
        'node --test tests/partition-one.test.cjs',
        'node --test tests/partition-two.test.cjs',
      ],
      additionalFiles: {
        'src/partition-one.cjs': "module.exports = { status: 'pending' };\n",
        'src/partition-two.cjs': "module.exports = { status: 'pending' };\n",
        'tests/partition-one.test.cjs': [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "test('CMD-readiness-refund ORACLE-REFUND-ACCEPTED partition one is green', () => {",
          "  assert.equal(require('../src/partition-one.cjs').status, 'green', 'ORACLE-REFUND-ACCEPTED');",
          '});',
          '',
        ].join('\n'),
        'tests/partition-two.test.cjs': [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "test('CMD-readiness-refund-2 ORACLE-REFUND-ACCEPTED partition two is green', () => {",
          "  assert.equal(require('../src/partition-two.cjs').status, 'green', 'ORACLE-REFUND-ACCEPTED');",
          '});',
          '',
        ].join('\n'),
      },
    });
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      git(fixture.root, ['init']);
      git(fixture.root, ['config', 'user.name', 'Goal Fixture']);
      git(fixture.root, ['config', 'user.email', 'goal-fixture@example.invalid']);
      git(fixture.root, ['commit', '--allow-empty', '-m', 'test: establish partition baseline']);
      const baseline = git(fixture.root, ['rev-parse', 'HEAD']);
      const outRoot = path.join(fixture.root, 'goal-run');
      const generated = compileRequirementsBackedGoal(
        {
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot,
        },
        { compileGoalExecutionIR: compilePartitionFixtureIr }
      );
      materializeGoalRunExecutionAdapter(outRoot, {
        adapterId: 'partition-fixture-mutator',
        executableSource: [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          "let input = '';",
          "process.stdin.setEncoding('utf8');",
          "process.stdin.on('data', (chunk) => (input += chunk));",
          "process.stdin.on('end', () => {",
          '  const request = JSON.parse(input);',
          '  const ownedPath = request.ownedPaths[0];',
          '  fs.mkdirSync(path.dirname(path.join(request.projectRoot, ownedPath)), { recursive: true });',
          "  fs.writeFileSync(path.join(request.projectRoot, ownedPath), \"module.exports = { status: 'green' };\\n\", 'utf8');",
          "  process.stdout.write(JSON.stringify({ schemaVersion: 'GoalRunMutationResult/v1', exitCode: 0, changedPaths: [ownedPath] }));",
          '});',
          '',
        ].join('\n'),
      });
      const activated = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);
      expect(activated.status, activated.stderr || activated.stdout).toBe(0);
      const activation = JSON.parse(activated.stdout);
      const activeRun = activation.artifacts.find(
        (artifact: { role: string }) => artifact.role === 'active_run_pointer'
      ).artifactRef;
      const executed = runMainAgent(fixture.root, [
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activeRun,
        '--json',
      ]);
      expect(executed.status, executed.stderr || executed.stdout).toBe(0);
      const result = JSON.parse(executed.stdout);
      expect(result).toMatchObject({
        schemaVersion: 'main-agent-goal-run-result/v1',
        status: 'closed',
        issueCode: null,
      });
      expect(result.validClosures).toHaveLength(2);
      const closures = result.validClosures.map((entry: { artifactRef: string }) =>
        JSON.parse(readFileSync(path.join(fixture.root, entry.artifactRef), 'utf8'))
      );
      expect(closures.map((closure: Record<string, unknown>) => closure.commitProof.kind)).toEqual([
        'owned_path_commit',
        'owned_path_commit',
      ]);
      expect(
        closures.every((closure: Record<string, any>) => closure.commitProof.commitCount === 1)
      ).toBe(true);
      expect(closures[1].dependencyClosureRefs).toHaveLength(1);
      expect(git(fixture.root, ['rev-list', '--count', `${baseline}..HEAD`])).toBe('2');
      const firstClosureRef = result.validClosures[0].artifactRef;
      const firstClosureBytes = readFileSync(path.join(fixture.root, firstClosureRef));
      writeFileSync(
        path.join(fixture.root, 'src', 'partition-two.cjs'),
        "module.exports = { status: 'stale' };\n",
        'utf8'
      );
      const remediated = runMainAgent(fixture.root, [
        'execute-goal-run',
        '--cwd',
        fixture.root,
        '--active-run',
        activeRun,
        '--remediate-from',
        closures[1].executionAuthorityId,
        '--json',
      ]);
      expect(remediated.status, remediated.stderr || remediated.stdout).toBe(0);
      const remediatedResult = JSON.parse(remediated.stdout);
      expect(remediatedResult).toMatchObject({ status: 'closed', issueCode: null });
      expect(remediatedResult.validClosures).toHaveLength(2);
      expect(remediatedResult.validClosures[0]).toEqual(result.validClosures[0]);
      expect(readFileSync(path.join(fixture.root, firstClosureRef))).toEqual(firstClosureBytes);
      expect(readFileSync(path.join(fixture.root, 'src', 'partition-two.cjs'), 'utf8')).toContain(
        "status: 'green'"
      );
      expect(git(fixture.root, ['rev-list', '--count', `${baseline}..HEAD`])).toBe('2');
    } finally {
      fixture.cleanup();
    }
  }, 60_000);

  it('reuses a compatible active partition before invoking the solver again', () => {
    const fixture = materializeImplementationReadinessFixture({ additionalGoalAtoms: 1 });
    try {
      produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });
      const generated = compileRequirementsBackedGoal(
        {
          projectRoot: fixture.root,
          requirementRecordPath: fixture.runtimeRecordPath,
          outRoot: path.join(fixture.root, 'goal-run'),
        },
        { compileGoalExecutionIR: compilePartitionFixtureIr }
      );
      const first = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);
      expect(first.status, first.stderr || first.stdout).toBe(0);

      const reused = activateWithForbiddenSolver(fixture.root, generated.activeAuthorityRef.path);

      expect(reused.status, reused.stderr || reused.stdout).toBe(0);
      expect(JSON.parse(reused.stdout)).toMatchObject({
        status: 'activation_reused',
        executionMode: 'partitioned_goal',
        partitionOutcome: 'complete_valid',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a self-hashed active manifest bound to a different Goal IR', () => {
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
      const first = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const result = JSON.parse(first.stdout);
      const byRole = new Map(
        result.artifacts.map((entry: { role: string; artifactRef: string }) => [entry.role, entry])
      );
      const manifestPath = byRole.get('partition_manifest')!.artifactRef;
      const candidatePath = byRole.get('candidate_run')!.artifactRef;
      const activationPath = byRole.get('activation_record')!.artifactRef;
      const pointerPath = byRole.get('active_run_pointer')!.artifactRef;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.goalExecutionIRHash = `sha256:${'9'.repeat(64)}`;
      delete manifest.partitionManifestHash;
      manifest.partitionManifestHash = hashControlPlaneValue(manifest);
      writeCanonicalRecord(manifestPath, manifest);
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      candidate.selectedPartitionManifestRef.hash = manifest.partitionManifestHash;
      delete candidate.candidateRunHash;
      candidate.candidateRunHash = hashControlPlaneValue(candidate);
      writeCanonicalRecord(candidatePath, candidate);
      const activation = JSON.parse(readFileSync(activationPath, 'utf8'));
      activation.candidateRunRef.hash = candidate.candidateRunHash;
      activation.selectedPartitionManifestRef.hash = manifest.partitionManifestHash;
      delete activation.activationRecordHash;
      activation.activationRecordHash = hashControlPlaneValue(activation);
      writeCanonicalRecord(activationPath, activation);
      const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      pointer.activationRecordHash = activation.activationRecordHash;
      delete pointer.activeRunPointerHash;
      pointer.activeRunPointerHash = hashControlPlaneValue(pointer);
      writeCanonicalRecord(pointerPath, pointer);

      const blocked = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);

      expect(blocked.status).toBe(1);
      expect(JSON.parse(blocked.stdout)).toMatchObject({
        status: 'blocked',
        issueCode: 'goal_execution_package_invalid',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects activation refs that diverge from the candidate authority refs', () => {
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
      const first = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);
      expect(first.status, first.stderr || first.stdout).toBe(0);
      const result = JSON.parse(first.stdout);
      const byRole = new Map(
        result.artifacts.map((entry: { role: string; artifactRef: string }) => [entry.role, entry])
      );
      const manifestPath = byRole.get('partition_manifest')!.artifactRef;
      const activationPath = byRole.get('activation_record')!.artifactRef;
      const pointerPath = byRole.get('active_run_pointer')!.artifactRef;
      const alternateManifestPath = path.join(path.dirname(manifestPath), 'alternate.json');
      writeFileSync(alternateManifestPath, readFileSync(manifestPath));
      const activation = JSON.parse(readFileSync(activationPath, 'utf8'));
      activation.selectedPartitionManifestRef.path = 'partition/alternate.json';
      delete activation.activationRecordHash;
      activation.activationRecordHash = hashControlPlaneValue(activation);
      writeCanonicalRecord(activationPath, activation);
      const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      pointer.activationRecordHash = activation.activationRecordHash;
      delete pointer.activeRunPointerHash;
      pointer.activeRunPointerHash = hashControlPlaneValue(pointer);
      writeCanonicalRecord(pointerPath, pointer);

      const blocked = runSourceCommand(fixture.root, [
        'activate',
        '--cwd',
        fixture.root,
        '--goal-authority',
        generated.activeAuthorityRef.path,
        '--json',
      ]);

      expect(blocked.status).toBe(1);
      expect(JSON.parse(blocked.stdout)).toMatchObject({
        status: 'blocked',
        issueCode: 'goal_execution_package_invalid',
      });
    } finally {
      fixture.cleanup();
    }
  });
});
