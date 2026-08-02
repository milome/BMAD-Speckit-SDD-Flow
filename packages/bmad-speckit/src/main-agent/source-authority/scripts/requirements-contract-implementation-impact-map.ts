import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { sha256Stable } from './requirements-contract-semantic-resolver';

interface ImpactTask {
  taskId: string;
  scenarioRef: string;
  stepRef: string;
  traceRefs: string[];
  requirementRefs: string[];
}

interface ImpactOwnership {
  taskId: string;
  owningComponent: string;
  path: string;
  symbol: string;
  changeType: 'create' | 'modify' | 'delete' | 'verify';
  ownershipProofRefs: string[];
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique`);
}

function validateSchema(value: unknown): boolean {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-implementation-impact-map.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

export function createRequirementsContractImplementationImpactMap(input: {
  sequenceContractHash: string;
  taskDagHash: string;
  tasks: ImpactTask[];
  ownership: ImpactOwnership[];
}) {
  if (input.tasks.length === 0) throw new Error('Implementation Impact Map requires tasks');
  unique(input.tasks.map((task) => task.taskId), 'taskId');
  unique(input.ownership.map((owner) => owner.taskId), 'ownership taskId');
  const taskIds = new Set(input.tasks.map((task) => task.taskId));
  const extraOwnership = input.ownership.filter((owner) => !taskIds.has(owner.taskId));
  if (extraOwnership.length > 0) {
    throw new Error(`ownership references unknown task: ${extraOwnership[0].taskId}`);
  }
  const ownerByTaskId = new Map(input.ownership.map((owner) => [owner.taskId, owner]));
  const entries = input.tasks.flatMap((task) => {
    const owner = ownerByTaskId.get(task.taskId);
    if (!owner || owner.ownershipProofRefs.length === 0) return [];
    return [
      {
        taskId: nonEmpty(task.taskId, 'taskId'),
        scenarioRef: nonEmpty(task.scenarioRef, 'scenarioRef'),
        stepRef: nonEmpty(task.stepRef, 'stepRef'),
        traceRefs: task.traceRefs.map((ref) => nonEmpty(ref, 'traceRef')),
        requirementRefs: task.requirementRefs.map((ref) => nonEmpty(ref, 'requirementRef')),
        owningComponent: nonEmpty(owner.owningComponent, 'owningComponent'),
        path: nonEmpty(owner.path, 'path'),
        symbol: nonEmpty(owner.symbol, 'symbol'),
        changeType: owner.changeType,
        ownershipProofRefs: owner.ownershipProofRefs.map((ref) =>
          nonEmpty(ref, 'ownershipProofRef')
        ),
      },
    ];
  });
  const provenTaskIds = new Set(entries.map((entry) => entry.taskId));
  const unprovenTaskIds = input.tasks
    .map((task) => task.taskId)
    .filter((taskId) => !provenTaskIds.has(taskId));
  const unprovenImpactCount = unprovenTaskIds.length;
  const preimage = {
    schemaVersion: 'requirements-contract-implementation-impact-map/v1' as const,
    sequenceContractHash: input.sequenceContractHash,
    taskDagHash: input.taskDagHash,
    entries,
    unprovenTaskIds,
    unprovenImpactCount,
    decision: unprovenImpactCount === 0 ? ('pass' as const) : ('block' as const),
  };
  const result = { ...preimage, impactMapHash: sha256Stable(preimage) };
  if (!validateSchema(result)) throw new Error('Implementation Impact Map schema validation failed');
  return result;
}
