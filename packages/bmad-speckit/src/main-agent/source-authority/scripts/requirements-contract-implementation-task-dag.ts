import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {
  type RequirementsContractSequenceContract,
  validateSequenceContract,
} from './requirements-contract-sequence-model';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface CriticalStepTaskBinding {
  scenarioId: string;
  stepId: string;
  taskId: string;
  targetRef: string;
  symbolRef: string;
  authorizedBehavior: string;
  forbiddenBehaviors: string[];
  redRef: string;
  evidenceRefs: string[];
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function cycleCount(tasks: Array<{ taskId: string; dependencies: string[] }>): number {
  const dependencies = new Map(tasks.map((task) => [task.taskId, task.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycles = 0;
  const visit = (taskId: string): void => {
    if (visiting.has(taskId)) {
      cycles += 1;
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const dependency of dependencies.get(taskId) ?? []) visit(dependency);
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const task of tasks) visit(task.taskId);
  return cycles;
}

function validateSchema(value: unknown): boolean {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-implementation-task-dag.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

export function compileRequirementsContractImplementationTaskDag(input: {
  sequenceContract: RequirementsContractSequenceContract;
  criticalSteps: CriticalStepTaskBinding[];
}) {
  if (!validateSequenceContract(input.sequenceContract).ok) {
    throw new Error('Task DAG requires a valid Sequence Contract');
  }
  if (input.criticalSteps.length === 0) throw new Error('Task DAG requires critical Steps');
  const taskIdByStep = new Map<string, string>();
  const taskIds = new Set<string>();
  for (const binding of input.criticalSteps) {
    const key = `${binding.scenarioId}#${binding.stepId}`;
    if (taskIdByStep.has(key)) throw new Error(`duplicate critical Step binding: ${key}`);
    const taskId = nonEmpty(binding.taskId, 'taskId');
    if (taskIds.has(taskId)) throw new Error(`duplicate taskId: ${taskId}`);
    taskIds.add(taskId);
    taskIdByStep.set(key, taskId);
  }
  const tasks = input.criticalSteps.map((binding) => {
    const scenario = input.sequenceContract.sequenceScenarios.find(
      (candidate) => candidate.id === binding.scenarioId
    );
    const step = scenario?.steps.find((candidate) => candidate.id === binding.stepId);
    if (!scenario || !step) {
      throw new Error(`unknown critical Step: ${binding.scenarioId}#${binding.stepId}`);
    }
    const priorCriticalTask = [...scenario.steps]
      .filter((candidate) => candidate.order < step.order)
      .sort((left, right) => right.order - left.order)
      .map((candidate) => taskIdByStep.get(`${scenario.id}#${candidate.id}`))
      .find((candidate): candidate is string => Boolean(candidate));
    const orderingDependencies = scenario.orderingConstraints
      .filter((constraint) => constraint.after === step.id)
      .map((constraint) => taskIdByStep.get(`${scenario.id}#${constraint.before}`))
      .filter((candidate): candidate is string => Boolean(candidate));
    return {
      taskId: binding.taskId,
      scenarioRef: scenario.id,
      stepRef: step.id,
      objective: step.operation,
      dependencies: [...new Set([priorCriticalTask, ...orderingDependencies].filter(Boolean))] as string[],
      targetRef: nonEmpty(binding.targetRef, 'targetRef'),
      symbolRef: nonEmpty(binding.symbolRef, 'symbolRef'),
      requirementRefs: step.requirementRefs,
      authorizedBehavior: nonEmpty(binding.authorizedBehavior, 'authorizedBehavior'),
      forbiddenBehaviors: binding.forbiddenBehaviors.map((value) =>
        nonEmpty(value, 'forbiddenBehavior')
      ),
      redRef: nonEmpty(binding.redRef, 'redRef'),
      evidenceRefs: binding.evidenceRefs.map((value) => nonEmpty(value, 'evidenceRef')),
    };
  });
  const knownTaskIds = new Set(tasks.map((task) => task.taskId));
  const unresolvedDependencyCount = tasks.flatMap((task) => task.dependencies).filter(
    (dependency) => !knownTaskIds.has(dependency)
  ).length;
  const detectedCycleCount = cycleCount(tasks);
  const preimage = {
    schemaVersion: 'requirements-contract-implementation-task-dag/v1' as const,
    sequenceContractHash: input.sequenceContract.sequenceContractHash,
    tasks,
    cycleCount: detectedCycleCount,
    unresolvedDependencyCount,
    decision:
      detectedCycleCount === 0 && unresolvedDependencyCount === 0
        ? ('pass' as const)
        : ('block' as const),
  };
  const result = { ...preimage, taskDagHash: sha256Stable(preimage) };
  if (!validateSchema(result)) throw new Error('implementation Task DAG schema validation failed');
  return result;
}
