import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const MODULE_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'utils',
  'goal-contract',
  'control-plane',
  'frozen-goal-partition.ts'
);
const RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));',
  'const result = runtime.compilePartitionFromFrozenGoalAuthority(input);',
  'process.stdout.write(JSON.stringify({',
  '  ...result,',
  '  files: [...result.files].map(([relativePath, bytes]) => [relativePath, bytes.toString("base64")]),',
  '}));',
].join('\n');
const FAILURE_RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8"));',
  'try {',
  '  runtime.compilePartitionFromFrozenGoalAuthority(input);',
  '  process.stdout.write(JSON.stringify({ ok: true }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

function compile(input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [TSX, '-e', RUNNER, MODULE_PATH, Buffer.from(JSON.stringify(input), 'utf8').toString('base64')],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

function compileFailure(input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      FAILURE_RUNNER,
      MODULE_PATH,
      Buffer.from(JSON.stringify(input), 'utf8').toString('base64'),
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return {
    status: completed.status,
    result: completed.stdout ? JSON.parse(completed.stdout) : null,
    stderr: completed.stderr,
  };
}

function frozenPartitionInput() {
  const task = (ordinal: number) => ({
    taskId: `TASK-00${ordinal}`,
    title: `Task ${ordinal}`,
    obligationRefs: [`OBL-00${ordinal}`],
    atomRefs: [`ATOM-00${ordinal}`],
    expectedEffortMinutes: 150,
    upperBoundEffortMinutes: 180,
    effortBasisRefs: [`BASIS-00${ordinal}`],
    oracle: `oracle-${ordinal}`,
  });
  const components = [1, 2].map((ordinal) => ({
    componentId: `COMPONENT-00${ordinal}`,
    executionDomainRefs: [`DOMAIN-00${ordinal}`],
    traceSliceRefs: [`TRACE-00${ordinal}`],
    taskRefs: [`TASK-00${ordinal}`],
    expectedEffortMinutes: 150,
    upperBoundEffortMinutes: 180,
    basisRefs: [`BASIS-00${ordinal}`],
    ownedPaths: [ordinal === 1 ? 'src/zeta.ts' : 'src/alpha.ts'],
    admissible: true,
  }));
  return {
    goalExecutionIr: {
      schemaVersion: 'GoalExecutionIR/v1',
      profile: 'requirements_backed',
      goalId: 'GOAL-2222222222222222',
      goalExecutionIRHash: `sha256:${'2'.repeat(64)}`,
      obligations: [1, 2].map((ordinal) => ({
        obligationId: `OBL-00${ordinal}`,
        kind: 'MUST',
        text: `Obligation ${ordinal}`,
      })),
      logicalSpecSpans: [1, 2].map((ordinal) => ({
        specSpanId: `SPAN-00${ordinal}`,
        obligationRef: `OBL-00${ordinal}`,
      })),
      executionDomains: [
        { executionDomainId: 'DOMAIN-001', logicalTargetPaths: ['src/zeta.ts'] },
        { executionDomainId: 'DOMAIN-002', logicalTargetPaths: ['src/alpha.ts'] },
      ],
      traceSlices: [1, 2].map((ordinal) => ({
        traceSliceId: `TRACE-00${ordinal}`,
        executionDomainRef: `DOMAIN-00${ordinal}`,
        obligationRefs: [`OBL-00${ordinal}`],
        taskRefs: [`TASK-00${ordinal}`],
        commandRefs: [`CMD-00${ordinal}`],
        evidenceContractRefs: [`EVD-00${ordinal}`],
        basisRefs: [`BASIS-00${ordinal}`],
      })),
      atomicTasks: [task(1), task(2)],
      dependencies: [{ from: 'TASK-002', to: 'TASK-001', basisRefs: ['DEP-001'] }],
      logicalScopes: {
        ownedPaths: ['src/alpha.ts', 'src/zeta.ts'],
        forbiddenPaths: ['.git/**'],
      },
      commands: [1, 2].map((ordinal) => ({
        commandId: `CMD-00${ordinal}`,
        invocation: `node command-${ordinal}.mjs`,
      })),
      evidenceContracts: [1, 2].map((ordinal) => ({
        evidenceContractId: `EVD-00${ordinal}`,
        requirement: `Evidence ${ordinal}`,
      })),
      artifacts: [1, 2].map((ordinal) => ({
        artifactId: `ART-00${ordinal}`,
        obligationRefs: [`OBL-00${ordinal}`],
      })),
      coExecutionConstraints: [1, 2].map((ordinal) => ({
        constraintId: `CTM-00${ordinal}`,
        taskRefs: [`TASK-00${ordinal}`],
      })),
    },
    eligibility: {
      schemaVersion: 'GoalContractExecutionEligibility/v1',
      profile: 'requirements_backed',
      goalId: 'GOAL-2222222222222222',
      goalExecutionIRHash: `sha256:${'2'.repeat(64)}`,
      executionMode: 'partitioned_goal',
      partitionOutcome: 'partition_search_inconclusive',
      componentCount: 2,
      components,
      decision: 'pass',
      eligibilityHash: `sha256:${'3'.repeat(64)}`,
    },
  };
}

describe('frozen Goal partition manifest', () => {
  it('derives reconstructable child slices with exact scope conservation and dependency order', () => {
    const compiled = compile(frozenPartitionInput());
    const files = new Map<string, string>(compiled.files);
    const child = (partitionId: string) =>
      JSON.parse(
        Buffer.from(
          files.get(`partition/children/${partitionId}/child-execution-contract.json`)!,
          'base64'
        ).toString('utf8')
      );

    expect(compiled.manifest).toMatchObject({
      partitionOutcome: 'complete_valid',
      topologicalOrder: ['PART-001', 'PART-002'],
    });
    expect(compiled.manifest.partitions[1].dependencyPartitionRefs).toEqual(['PART-001']);
    expect(child('PART-001')).toMatchObject({
      taskRefs: ['TASK-001'],
      logicalScopes: { ownedPaths: ['src/zeta.ts'], forbiddenPaths: ['.git/**'] },
      executionDomains: [{ executionDomainId: 'DOMAIN-001' }],
      traceSlices: [{ traceSliceId: 'TRACE-001' }],
      coExecutionConstraints: [{ constraintId: 'CTM-001' }],
    });
    expect(child('PART-002')).toMatchObject({
      taskRefs: ['TASK-002'],
      dependencyPartitionRefs: ['PART-001'],
      logicalScopes: { ownedPaths: ['src/alpha.ts'], forbiddenPaths: ['.git/**'] },
      executionDomains: [{ executionDomainId: 'DOMAIN-002' }],
      traceSlices: [{ traceSliceId: 'TRACE-002' }],
      coExecutionConstraints: [{ constraintId: 'CTM-002' }],
    });
  });

  it('publishes a hard-compatible child above the selector target maximum', () => {
    const input = frozenPartitionInput();
    input.goalExecutionIr.atomicTasks[0].expectedEffortMinutes = 200;
    input.goalExecutionIr.atomicTasks[0].upperBoundEffortMinutes = 220;
    input.eligibility.components[0].expectedEffortMinutes = 200;
    input.eligibility.components[0].upperBoundEffortMinutes = 220;

    const compiled = compile(input);

    expect(compiled.manifest.partitions[0]).toMatchObject({
      expectedEffortMinutes: 200,
      upperBoundEffortMinutes: 220,
    });
  });

  it.each([
    [
      'obligation',
      (input: ReturnType<typeof frozenPartitionInput>) => {
        input.goalExecutionIr.obligations.push({
          obligationId: 'OBL-003',
          kind: 'MUST',
          text: 'Unassigned obligation',
        });
      },
    ],
    [
      'logical spec span',
      (input: ReturnType<typeof frozenPartitionInput>) => {
        input.goalExecutionIr.logicalSpecSpans.push({
          specSpanId: 'SPAN-003',
          obligationRef: 'OBL-999',
        });
      },
    ],
    [
      'command',
      (input: ReturnType<typeof frozenPartitionInput>) => {
        input.goalExecutionIr.commands.push({
          commandId: 'CMD-003',
          invocation: 'node command-3.mjs',
        });
      },
    ],
    [
      'evidence contract',
      (input: ReturnType<typeof frozenPartitionInput>) => {
        input.goalExecutionIr.evidenceContracts.push({
          evidenceContractId: 'EVD-003',
          requirement: 'Unassigned evidence',
        });
      },
    ],
    [
      'artifact',
      (input: ReturnType<typeof frozenPartitionInput>) => {
        input.goalExecutionIr.artifacts.push({
          artifactId: 'ART-003',
          obligationRefs: ['OBL-999'],
        });
      },
    ],
  ])(
    'rejects an unassigned or dangling parent %s before manifest publication',
    (_label, mutate) => {
      const input = frozenPartitionInput();
      mutate(input);

      const completed = compileFailure(input);

      expect(completed.status, completed.stderr).toBe(1);
      expect(completed.result).toEqual({
        ok: false,
        issueCode: 'partition_no_valid_solution',
      });
    }
  );

  it('rejects a parent command that would be owned by more than one child', () => {
    const input = frozenPartitionInput();
    input.goalExecutionIr.traceSlices[1].commandRefs.push('CMD-001');

    const completed = compileFailure(input);

    expect(completed.status, completed.stderr).toBe(1);
    expect(completed.result).toEqual({
      ok: false,
      issueCode: 'partition_no_valid_solution',
    });
  });
});
