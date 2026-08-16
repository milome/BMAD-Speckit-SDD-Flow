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
  'const input = JSON.parse(Buffer.from(process.argv[3], "base64").toString("utf8"));',
  'const value = runtime[process.argv[2]](input);',
  'process.stdout.write(JSON.stringify(value));',
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
  expect(completed.status, completed.stderr || completed.stdout).toBe(0);
  return JSON.parse(completed.stdout);
}

function selectionInput(
  options: {
    overlappingPaths?: boolean;
    componentCount?: number;
    expectedEfforts?: number[];
    upperBoundEfforts?: number[];
    dependencies?: Array<{ from: string; to: string }>;
  } = {}
) {
  const componentCount = options.componentCount ?? 2;
  const components = Array.from({ length: componentCount }, (_value, index) => {
    const ordinal = index + 1;
    return {
      componentId: `COMPONENT-${String(ordinal).padStart(3, '0')}`,
      executionDomainRefs: [`DOMAIN-${String(ordinal).padStart(3, '0')}`],
      traceSliceRefs: [`TRACE-${String(ordinal).padStart(3, '0')}`],
      taskRefs: [`TASK-${String(ordinal).padStart(3, '0')}`],
      expectedEffortMinutes: options.expectedEfforts?.[index] ?? 150,
      upperBoundEffortMinutes: options.upperBoundEfforts?.[index] ?? 180,
      basisRefs: [`BASIS-${ordinal}`],
      admissible: true,
    };
  });
  const executionDomains = components.map((component, index) => ({
    executionDomainId: component.executionDomainRefs[0],
    logicalTargetPaths: [options.overlappingPaths ? 'src/shared.ts' : `src/part-${index + 1}.ts`],
  }));
  return {
    goalExecutionIr: {
      dependencies: options.dependencies ?? [],
      executionDomains,
      logicalScopes: {
        ownedPaths: [...new Set(executionDomains.flatMap((domain) => domain.logicalTargetPaths))],
        forbiddenPaths: ['.git/**'],
      },
    },
    eligibility: { components },
  };
}

describe('frozen Goal partition optimizer', () => {
  it('returns complete_valid only after exhaustive hard-valid search', () => {
    const selected = invoke('selectFrozenGoalPartition', {
      ...selectionInput(),
      solverEnvelope: { maxSearchStates: 100 },
    });

    expect(selected).toMatchObject({
      partitionOutcome: 'complete_valid',
      searchedStateCount: expect.any(Number),
      groups: [
        { componentRefs: ['COMPONENT-001'], ownedPaths: ['src/part-1.ts'] },
        { componentRefs: ['COMPONENT-002'], ownedPaths: ['src/part-2.ts'] },
      ],
      selectionIdentityHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
  });

  it('returns bounded_valid when the budget ends after finding a hard-valid candidate', () => {
    const bounded = invoke('selectFrozenGoalPartition', {
      ...selectionInput({ componentCount: 3 }),
      solverEnvelope: { maxSearchStates: 1 },
    });
    const complete = invoke('selectFrozenGoalPartition', {
      ...selectionInput({ componentCount: 3 }),
      solverEnvelope: { maxSearchStates: 100 },
    });

    expect(bounded.partitionOutcome).toBe('bounded_valid');
    expect(bounded.groups).toEqual(complete.groups);
    expect(bounded.selectionIdentityHash).toBe(complete.selectionIdentityHash);
  });

  it('distinguishes exhaustive no-solution from budget-limited inconclusive search', () => {
    const noSolution = invoke('selectFrozenGoalPartition', {
      ...selectionInput({ overlappingPaths: true }),
      solverEnvelope: { maxSearchStates: 100 },
    });
    const inconclusive = invoke('selectFrozenGoalPartition', {
      ...selectionInput({ overlappingPaths: true }),
      solverEnvelope: { maxSearchStates: 1 },
    });

    expect(noSolution).toMatchObject({
      partitionOutcome: 'partition_no_valid_solution',
      groups: [],
    });
    expect(inconclusive).toMatchObject({
      partitionOutcome: 'partition_search_inconclusive',
      groups: [],
    });
  });

  it('treats the 120-180 minute target as selector guidance instead of a hard gate', () => {
    const selected = invoke('selectFrozenGoalPartition', {
      ...selectionInput({
        expectedEfforts: [119, 181],
        upperBoundEfforts: [180, 240],
      }),
      solverEnvelope: { maxSearchStates: 100 },
    });

    expect(selected).toMatchObject({
      partitionOutcome: 'complete_valid',
      groups: [
        { componentRefs: ['COMPONENT-001'], expectedEffortMinutes: 119 },
        { componentRefs: ['COMPONENT-002'], expectedEffortMinutes: 181 },
      ],
    });
  });

  it('uses dependency-cut scoring to select membership and responds to dependency mutation', () => {
    const baseOptions = {
      componentCount: 3,
      expectedEfforts: [80, 80, 80],
      upperBoundEfforts: [100, 100, 100],
    };
    const first = invoke('selectFrozenGoalPartition', {
      ...selectionInput({
        ...baseOptions,
        dependencies: [{ from: 'TASK-002', to: 'TASK-001' }],
      }),
      solverEnvelope: { maxSearchStates: 100 },
    });
    const mutated = invoke('selectFrozenGoalPartition', {
      ...selectionInput({
        ...baseOptions,
        dependencies: [{ from: 'TASK-003', to: 'TASK-001' }],
      }),
      solverEnvelope: { maxSearchStates: 100 },
    });

    expect(first.groups.map((group: { componentRefs: string[] }) => group.componentRefs)).toEqual([
      ['COMPONENT-001', 'COMPONENT-002'],
      ['COMPONENT-003'],
    ]);
    expect(mutated.groups.map((group: { componentRefs: string[] }) => group.componentRefs)).toEqual(
      [['COMPONENT-001', 'COMPONENT-003'], ['COMPONENT-002']]
    );
    expect(mutated.selectionIdentityHash).not.toBe(first.selectionIdentityHash);
  });
});
