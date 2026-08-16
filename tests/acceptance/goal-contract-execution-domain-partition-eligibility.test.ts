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
  'frozen-goal-activation.ts'
);
const RUNNER = [
  'const runtime = require(process.argv[1]);',
  'const input = JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"));',
  'try {',
  '  const value = runtime[process.argv[2]](input);',
  '  process.stdout.write(JSON.stringify({ ok: true, value }));',
  '} catch (error) {',
  '  process.stdout.write(JSON.stringify({ ok: false, issueCode: error.failureClass || error.message }));',
  '  process.exitCode = 1;',
  '}',
].join('\n');

function invoke(functionName: string, input: unknown) {
  const completed = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      RUNNER,
      MODULE_PATH,
      functionName,
      Buffer.from(JSON.stringify(input), 'utf8').toString('base64'),
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
  return {
    ...completed,
    result: completed.stdout ? JSON.parse(completed.stdout) : null,
  };
}

function task(taskId: string, expected = 150, upper = 180) {
  return {
    taskId,
    title: taskId,
    obligationRefs: [`OBL-${taskId}`],
    atomRefs: [`ATOM-${taskId}`],
    expectedEffortMinutes: expected,
    upperBoundEffortMinutes: upper,
    effortBasisRefs: [`BASIS-${taskId}`],
    oracle: `oracle-${taskId}`,
  };
}

function frozenIr(input: { sharedTrace: boolean; sharedDomain?: boolean }) {
  const atomicTasks = [task('TASK-001'), task('TASK-002')];
  return {
    profile: 'requirements_backed',
    goalId: 'GOAL-1111111111111111',
    goalExecutionIRHash: `sha256:${'1'.repeat(64)}`,
    atomicTasks,
    traceSlices: input.sharedTrace
      ? [
          {
            traceSliceId: 'TRACE-001',
            executionDomainRef: 'DOMAIN-001',
            obligationRefs: ['OBL-TASK-001'],
            taskRefs: ['TASK-001', 'TASK-002'],
            commandRefs: ['CMD-001'],
            evidenceContractRefs: ['EVD-001'],
            basisRefs: ['OBL-TASK-001'],
          },
        ]
      : [
          {
            traceSliceId: 'TRACE-001',
            executionDomainRef: 'DOMAIN-001',
            obligationRefs: ['OBL-TASK-001'],
            taskRefs: ['TASK-001'],
            commandRefs: ['CMD-001'],
            evidenceContractRefs: ['EVD-001'],
            basisRefs: ['OBL-TASK-001'],
          },
          {
            traceSliceId: 'TRACE-002',
            executionDomainRef: input.sharedDomain ? 'DOMAIN-001' : 'DOMAIN-002',
            obligationRefs: ['OBL-TASK-002'],
            taskRefs: ['TASK-002'],
            commandRefs: ['CMD-002'],
            evidenceContractRefs: ['EVD-002'],
            basisRefs: ['OBL-TASK-002'],
          },
        ],
    executionDomains: [
      {
        executionDomainId: 'DOMAIN-001',
        logicalTargetPaths: ['src/one.ts', ...(input.sharedDomain ? ['src/two.ts'] : [])],
        ownership: [],
      },
      ...(input.sharedDomain
        ? []
        : [
            {
              executionDomainId: 'DOMAIN-002',
              logicalTargetPaths: ['src/two.ts'],
              ownership: [],
            },
          ]),
    ],
    logicalScopes: {
      ownedPaths: ['src/one.ts', 'src/two.ts'],
      forbiddenPaths: ['.git/**'],
    },
    artifacts: [
      {
        artifactId: 'ART-001',
        logicalPath: 'src/one.ts',
        obligationRefs: ['OBL-TASK-001'],
      },
      {
        artifactId: 'ART-002',
        logicalPath: 'src/two.ts',
        obligationRefs: ['OBL-TASK-002'],
      },
    ],
    coExecutionConstraints: [],
  };
}

describe('frozen Goal execution-domain partition eligibility', () => {
  it('keeps one vertical trace slice indivisible and routes its oversized component upstream', () => {
    const ir = frozenIr({ sharedTrace: true });

    const components = invoke('deriveGoalExecutionComponents', ir);
    expect(components.status, components.stderr || components.stdout).toBe(0);
    expect(components.result.value).toMatchObject([
      {
        taskRefs: ['TASK-001', 'TASK-002'],
        traceSliceRefs: ['TRACE-001'],
        executionDomainRefs: ['DOMAIN-001'],
        expectedEffortMinutes: 300,
        upperBoundEffortMinutes: 360,
        admissible: false,
      },
    ]);
    const eligibility = invoke('compileFrozenGoalExecutionEligibility', ir);
    expect(eligibility.status).toBe(1);
    expect(eligibility.result).toEqual({
      ok: false,
      issueCode: 'requirements_successor_required:goal_task_decomposition',
    });
  });

  it('selects partition mode only after deriving separate admissible components', () => {
    const completed = invoke(
      'compileFrozenGoalExecutionEligibility',
      frozenIr({ sharedTrace: false })
    );

    expect(completed.status, completed.stderr || completed.stdout).toBe(0);
    expect(completed.result.value).toMatchObject({
      schemaVersion: 'GoalContractExecutionEligibility/v1',
      executionMode: 'partitioned_goal',
      partitionOutcome: 'partition_search_inconclusive',
      componentCount: 2,
      decision: 'pass',
    });
    expect(
      completed.result.value.components.map(
        (component: { executionDomainRefs: string[] }) => component.executionDomainRefs
      )
    ).toEqual([['DOMAIN-001'], ['DOMAIN-002']]);
  });

  it('rejects a direct component that crosses incompatible isolation domains', () => {
    const ir = frozenIr({ sharedTrace: false });
    ir.atomicTasks = [task('TASK-001', 90, 100), task('TASK-002', 90, 100)];
    ir.coExecutionConstraints = [
      {
        constraintId: 'COEXEC-001',
        taskRefs: ['TASK-001', 'TASK-002'],
        basisRefs: ['BASIS-COEXEC-001'],
      },
    ];
    ir.executionDomains = [
      { ...ir.executionDomains[0], isolationMode: 'worktree' },
      { ...ir.executionDomains[1], isolationMode: 'in_place' },
    ];

    const completed = invoke('compileFrozenGoalExecutionEligibility', ir);

    expect(completed.status).toBe(1);
    expect(completed.result).toEqual({
      ok: false,
      issueCode: 'architecture_successor_required:goal_execution_domain',
    });
  });

  it('derives identical component authority when frozen set-like arrays are reordered', () => {
    const canonicalIr = frozenIr({ sharedTrace: false });
    const reorderedIr = {
      ...canonicalIr,
      atomicTasks: [...canonicalIr.atomicTasks].reverse(),
      traceSlices: [...canonicalIr.traceSlices].reverse(),
    };
    const canonical = invoke('deriveGoalExecutionComponents', canonicalIr);
    const reordered = invoke('deriveGoalExecutionComponents', reorderedIr);

    expect(canonical.status, canonical.stderr || canonical.stdout).toBe(0);
    expect(reordered.status, reordered.stderr || reordered.stdout).toBe(0);
    expect(reordered.result.value).toEqual(canonical.result.value);
  });

  it('derives disjoint component scopes for independently closable traces in one domain', () => {
    const completed = invoke(
      'compileFrozenGoalExecutionEligibility',
      frozenIr({ sharedTrace: false, sharedDomain: true })
    );

    expect(completed.status, completed.stderr || completed.stdout).toBe(0);
    expect(
      completed.result.value.components.map(
        (component: { executionDomainRefs: string[]; ownedPaths: string[] }) => ({
          executionDomainRefs: component.executionDomainRefs,
          ownedPaths: component.ownedPaths,
        })
      )
    ).toEqual([
      { executionDomainRefs: ['DOMAIN-001'], ownedPaths: ['src/one.ts'] },
      { executionDomainRefs: ['DOMAIN-001'], ownedPaths: ['src/two.ts'] },
    ]);
  });
});
