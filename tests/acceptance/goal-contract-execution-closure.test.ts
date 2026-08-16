import { describe, expect, it } from 'vitest';
import {
  compileGoalExecutionIR,
  goalExecutionIRHash,
  validateGoalExecutionIR,
  type GoalExecutionCompilerInput,
  type GoalExecutionIR,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { compileGoalExecutionClosure } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-closure';

function compilerInput(): GoalExecutionCompilerInput {
  const obligations = [
    {
      obligationId: 'MUST-001',
      kind: 'MUST' as const,
      text: 'Implement refund.',
      oracle: 'refund accepted',
      sourceRefs: ['MUST-001'],
      atomRefs: ['MUST-001-A1'],
      evidenceClaimRefs: [],
    },
    {
      obligationId: 'NEG-001',
      kind: 'NEG' as const,
      text: 'Must not double refund.',
      oracle: 'one refund',
      sourceRefs: ['NEG-001'],
      atomRefs: ['NEG-001-A1'],
      evidenceClaimRefs: [],
    },
  ];
  const constraints = [
    {
      constraintId: 'PATH-refund',
      kind: 'PATH',
      canonicalValue: 'src/refund.ts',
      applicableMustRefs: ['MUST-001', 'NEG-001'],
      applicableAtomRefs: ['MUST-001-A1', 'NEG-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CMD-refund',
      kind: 'CMD',
      canonicalValue: 'npm test -- refund',
      applicableMustRefs: ['MUST-001', 'NEG-001'],
      applicableAtomRefs: ['MUST-001-A1', 'NEG-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'ART-refund',
      kind: 'ART',
      canonicalValue: 'dist/refund.js',
      applicableMustRefs: ['MUST-001'],
      applicableAtomRefs: ['MUST-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CTM-refund',
      kind: 'CTM',
      canonicalValue: 'refund vertical slice',
      applicableMustRefs: ['MUST-001', 'NEG-001'],
      applicableAtomRefs: ['MUST-001-A1', 'NEG-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'EVDREQ-refund',
      kind: 'EVDREQ',
      canonicalValue: 'RED/GREEN evidence',
      applicableMustRefs: ['MUST-001', 'NEG-001'],
      applicableAtomRefs: ['MUST-001-A1', 'NEG-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'STOP-repo',
      kind: 'STOP',
      canonicalValue: '.git/**',
      applicableMustRefs: ['MUST-001'],
      applicableAtomRefs: ['MUST-001-A1'],
      premiseRefs: ['MUST-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
  ];
  return {
    profile: 'requirements_backed',
    semanticSource: {
      kind: 'requirements_semantic_ir',
      semanticRevisionId: 'SEM-001',
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
    },
    requirementsLineage: {
      semanticRevisionId: 'SEM-001',
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
    },
    technicalAuthority: {
      architectureConfirmationCandidateHash: `sha256:${'2'.repeat(64)}`,
      implementationReadinessCandidateHash: `sha256:${'3'.repeat(64)}`,
    },
    obligations,
    atoms: [
      {
        id: 'MUST-001-A1',
        requirementRef: 'MUST-001',
        action: 'Implement refund.',
        oracle: 'refund accepted',
      },
      {
        id: 'NEG-001-A1',
        requirementRef: 'NEG-001',
        action: 'Reject a duplicate refund.',
        oracle: 'one refund',
      },
    ],
    logicalSpecSpans: [
      { specSpanId: 'SPAN-001', boundObligationIds: ['MUST-001'], evidenceClaimRefs: [] },
      { specSpanId: 'SPAN-002', boundObligationIds: ['NEG-001'], evidenceClaimRefs: [] },
    ],
    executionConstraints: constraints,
    architecture: {
      isolation: { mode: 'consumer_worktree' },
      ownership: [
        { targetPath: 'src/refund.ts', owner: 'main-agent', basisRefs: ['PATH-refund'] },
        { targetPath: 'tests/refund.test.ts', owner: 'main-agent', basisRefs: ['PATH-refund'] },
      ],
      architectureDecisions: [{ decisionId: 'ARCH-002' }, { decisionId: 'ARCH-001' }],
    },
  };
}

describe('GoalExecutionIR deterministic closure', () => {
  it('produces one closed schema independent of set-like input order', () => {
    const leftInput = compilerInput();
    const rightInput = compilerInput();
    rightInput.obligations.reverse();
    rightInput.atoms.reverse();
    rightInput.executionConstraints.reverse();
    (rightInput.architecture.ownership as unknown[]).reverse();
    (rightInput.architecture.architectureDecisions as unknown[]).reverse();

    const left = compileGoalExecutionIR(leftInput);
    const right = compileGoalExecutionIR(rightInput);
    const closure = compileGoalExecutionClosure(left);

    expect(validateGoalExecutionIR(left)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(right).toEqual(left);
    expect(closure.decision).toBe('pass');
    expect(closure.coverage.obligationIds).toEqual(['MUST-001', 'NEG-001']);
    expect(closure.coverage.taskIds).toEqual(['TASK-001', 'TASK-002']);
    expect(left.atomicTasks.every((task) => Number(task.upperBoundEffortMinutes) <= 240)).toBe(
      true
    );
    expect(left.atomicTasks.every((task) => (task.effortBasisRefs as string[]).length > 0)).toBe(
      true
    );
  });

  it('blocks incomplete trace coverage even when the candidate hash is internally consistent', () => {
    const compiled = compileGoalExecutionIR(compilerInput());
    const broken = structuredClone(compiled) as GoalExecutionIR;
    broken.traceSlices = broken.traceSlices.slice(0, 1);
    broken.goalExecutionIRHash = goalExecutionIRHash(broken);

    expect(() => compileGoalExecutionClosure(broken)).toThrowError(
      'goal_execution_task_coverage_incomplete'
    );
  });

  it('blocks an empty trace even when aggregate task coverage is complete', () => {
    const compiled = compileGoalExecutionIR(compilerInput());
    const broken = structuredClone(compiled) as GoalExecutionIR;
    const displacedTaskRefs = broken.traceSlices[1].taskRefs as string[];
    broken.traceSlices[0].taskRefs = [
      ...(broken.traceSlices[0].taskRefs as string[]),
      ...displacedTaskRefs,
    ];
    broken.traceSlices[1].taskRefs = [];
    broken.goalExecutionIRHash = goalExecutionIRHash(broken);

    expect(() => compileGoalExecutionClosure(broken)).toThrowError(
      'goal_execution_trace_task_membership_empty'
    );
  });

  it('maps the atom dependency DAG into task dependency rows', () => {
    const input = compilerInput();
    input.atoms = [
      {
        atomId: 'NEG-001-A1',
        coverageSeed: 'NEG-001',
        action: 'Reject a duplicate refund.',
        oracle: 'one refund',
        dependencies: ['MUST-001-A1'],
      },
      {
        atomId: 'MUST-001-A1',
        coverageSeed: 'MUST-001',
        action: 'Implement refund.',
        oracle: 'refund accepted',
        dependencies: [],
      },
    ];

    const compiled = compileGoalExecutionIR(input);

    expect(compiled.dependencies).toEqual([
      {
        from: 'TASK-002',
        to: 'TASK-001',
        basisRefs: ['MUST-001-A1', 'NEG-001-A1'],
      },
    ]);
  });

  it.each([
    ['self edge', ['MUST-001-A1'], ['NEG-001-A1']],
    ['cycle', ['NEG-001-A1'], ['MUST-001-A1']],
  ])(
    'rejects an atom dependency DAG containing a %s',
    (_case, mustDependencies, negDependencies) => {
      const input = compilerInput();
      input.atoms = [
        {
          atomId: 'MUST-001-A1',
          coverageSeed: 'MUST-001',
          action: 'Implement refund.',
          oracle: 'refund accepted',
          dependencies: mustDependencies,
        },
        {
          atomId: 'NEG-001-A1',
          coverageSeed: 'NEG-001',
          action: 'Reject a duplicate refund.',
          oracle: 'one refund',
          dependencies: negDependencies,
        },
      ];

      expect(() => compileGoalExecutionIR(input)).toThrowError(
        'requirements_successor_required:goal_task_dependency_dag'
      );
    }
  );

  it.each([
    ['command', 'commandRefs', 'goal_execution_trace_command_membership_mismatch'],
    [
      'evidence contract',
      'evidenceContractRefs',
      'goal_execution_trace_evidence_membership_mismatch',
    ],
  ] as const)(
    'blocks a partial multi-obligation %s trace edge deletion',
    (_case, field, issueCode) => {
      const compiled = compileGoalExecutionIR(compilerInput());
      const broken = structuredClone(compiled) as GoalExecutionIR;
      const firstTrace = broken.traceSlices[0] as Record<string, unknown>;
      const secondTrace = broken.traceSlices[1] as Record<string, unknown>;
      firstTrace[field] = [...((firstTrace[field] as string[]) ?? [])];
      secondTrace[field] = [];
      broken.goalExecutionIRHash = goalExecutionIRHash(broken);

      expect(() => compileGoalExecutionClosure(broken)).toThrowError(issueCode);
    }
  );

  it('blocks duplicate top-level command identifiers', () => {
    const compiled = compileGoalExecutionIR(compilerInput());
    const broken = structuredClone(compiled) as GoalExecutionIR;
    broken.commands.push(structuredClone(broken.commands[0]));
    broken.goalExecutionIRHash = goalExecutionIRHash(broken);

    expect(() => compileGoalExecutionClosure(broken)).toThrowError(
      'goal_execution_command_id_duplicate'
    );
  });

  it('blocks a cyclic dependency graph in an externally supplied GoalExecutionIR', () => {
    const compiled = compileGoalExecutionIR(compilerInput());
    const broken = structuredClone(compiled) as GoalExecutionIR;
    broken.dependencies = [
      { from: 'TASK-001', to: 'TASK-002', basisRefs: ['MUST-001-A1'] },
      { from: 'TASK-002', to: 'TASK-001', basisRefs: ['NEG-001-A1'] },
    ];
    broken.goalExecutionIRHash = goalExecutionIRHash(broken);

    expect(() => compileGoalExecutionClosure(broken)).toThrowError(
      'goal_execution_dependency_dag_invalid'
    );
  });

  it('merges Architecture-only forbidden paths without duplicating Requirements STOP scope', () => {
    const input = compilerInput();
    input.architecture.logicalScope = {
      forbiddenPaths: ['docs/generated/**', '.git/**'],
    };

    const compiled = compileGoalExecutionIR(input);

    expect(compiled.logicalScopes.forbiddenPaths).toEqual(['.git/**', 'docs/generated/**']);
  });

  it('does not project general Requirements STOP prose into forbidden paths', () => {
    const input = compilerInput();
    const stop = input.executionConstraints.find((constraint) => constraint.kind === 'STOP');
    if (!stop) throw new Error('fixture_stop_missing');
    stop.canonicalValue = 'Stop on schema drift.';
    input.architecture.logicalScope = { forbiddenPaths: ['.git/**'] };

    const compiled = compileGoalExecutionIR(input);

    expect(compiled.logicalScopes.forbiddenPaths).toEqual(['.git/**']);
  });

  it('binds atom-only commands and evidence contracts to the matching trace', () => {
    const input = compilerInput();
    input.executionConstraints.push(
      {
        constraintId: 'CMD-refund-atom',
        kind: 'CMD',
        canonicalValue: 'npm test -- refund-atom',
        applicableMustRefs: [],
        applicableAtomRefs: ['MUST-001-A1'],
        premiseRefs: ['MUST-001-A1'],
        derivationReceiptRefs: [],
        disposition: 'proven',
      },
      {
        constraintId: 'EVDREQ-refund-atom',
        kind: 'EVDREQ',
        canonicalValue: 'atom RED/GREEN evidence',
        applicableMustRefs: [],
        applicableAtomRefs: ['MUST-001-A1'],
        premiseRefs: ['MUST-001-A1'],
        derivationReceiptRefs: [],
        disposition: 'proven',
      }
    );

    const compiled = compileGoalExecutionIR(input);
    const mustTrace = compiled.traceSlices.find((row) =>
      (row.obligationRefs as string[]).includes('MUST-001')
    );

    expect(mustTrace?.commandRefs).toContain('CMD-refund-atom');
    expect(mustTrace?.evidenceContractRefs).toContain('EVDREQ-refund-atom');
  });

  it.each([
    [
      'command',
      'commands',
      'commandId',
      'CMD-orphan',
      'goal_execution_command_coverage_incomplete',
    ],
    [
      'evidence contract',
      'evidenceContracts',
      'evidenceContractId',
      'EVDREQ-orphan',
      'goal_execution_evidence_coverage_incomplete',
    ],
  ] as const)(
    'blocks an orphan top-level %s that is absent from every trace',
    (_case, collection, idField, id, issueCode) => {
      const compiled = compileGoalExecutionIR(compilerInput());
      const broken = structuredClone(compiled) as GoalExecutionIR;
      const row = {
        [idField]: id,
        ...(collection === 'commands'
          ? { invocation: 'npm test -- orphan' }
          : { requirement: 'orphan evidence' }),
        obligationRefs: [],
        atomRefs: [],
        basisRefs: [id],
      };
      (broken[collection] as Array<Record<string, unknown>>).push(row);
      broken.goalExecutionIRHash = goalExecutionIRHash(broken);

      expect(() => compileGoalExecutionClosure(broken)).toThrowError(issueCode);
    }
  );

  it('blocks swapped task-to-obligation trace membership', () => {
    const compiled = compileGoalExecutionIR(compilerInput());
    const broken = structuredClone(compiled) as GoalExecutionIR;
    const firstTaskRefs = broken.traceSlices[0].taskRefs;
    broken.traceSlices[0].taskRefs = broken.traceSlices[1].taskRefs;
    broken.traceSlices[1].taskRefs = firstTaskRefs;
    broken.goalExecutionIRHash = goalExecutionIRHash(broken);

    expect(() => compileGoalExecutionClosure(broken)).toThrowError(
      'goal_execution_trace_task_membership_mismatch'
    );
  });

  it('creates a vertical task for an obligation without an explicit atom', () => {
    const input = compilerInput();
    input.obligations.push({
      obligationId: 'EDGE-001',
      kind: 'EDGE',
      text: 'Handle an empty refund request.',
      oracle: 'typed empty result',
      sourceRefs: ['EDGE-001'],
      atomRefs: [],
      evidenceClaimRefs: [],
    });

    const compiled = compileGoalExecutionIR(input);
    const edgeTrace = compiled.traceSlices.find((row) =>
      (row.obligationRefs as string[]).includes('EDGE-001')
    );

    expect((edgeTrace?.taskRefs as string[]).length).toBe(1);
    expect(compileGoalExecutionClosure(compiled).decision).toBe('pass');
  });

  it('rejects a schema-invalid GoalExecutionIR before it can become authority', () => {
    const input = compilerInput();
    input.obligations[0].text = '';

    expect(() => compileGoalExecutionIR(input)).toThrowError('canonical_schema_invalid');
  });
});
