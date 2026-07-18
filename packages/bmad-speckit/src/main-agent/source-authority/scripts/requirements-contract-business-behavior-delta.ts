import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type CurrentBehavior =
  | { status: 'proved'; description: string; proofRefs: string[] }
  | { status: 'unknown'; proofRefs: [] };

interface ScenarioInput {
  scenarioId: string;
  currentBehavior: CurrentBehavior;
  targetBehavior: {
    description: string;
    requirementRefs: string[];
  };
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function syntheticCurrentBehaviorCount(scenarios: ScenarioInput[]): number {
  return scenarios.filter((scenario) => {
    const currentBehavior = scenario.currentBehavior as CurrentBehavior & {
      description?: unknown;
      status?: unknown;
    };
    return (
      (currentBehavior.status !== 'proved' && currentBehavior.status !== 'unknown') ||
      (currentBehavior.status === 'unknown' && currentBehavior.description !== undefined)
    );
  }).length;
}

function normalizeCurrentBehavior(currentBehavior: CurrentBehavior): CurrentBehavior {
  if (currentBehavior.status === 'unknown') {
    return { status: 'unknown', proofRefs: [] };
  }
  if (currentBehavior.status !== 'proved') {
    throw new Error(`unsupported current behavior status: ${String(currentBehavior.status)}`);
  }
  return {
    status: 'proved',
    description: nonEmpty(currentBehavior.description, 'current behavior'),
    proofRefs: currentBehavior.proofRefs.map((ref) => nonEmpty(ref, 'current behavior proof')),
  };
}

function validateSchema(value: unknown): boolean {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-business-behavior-delta.schema.json'
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

export function createRequirementsContractBusinessBehaviorDelta(input: {
  requirementSetId: string;
  semanticModelHash: string;
  scenarios: ScenarioInput[];
}) {
  if (input.scenarios.length === 0) throw new Error('Business Behavior Delta requires scenarios');
  const measuredSyntheticCurrentBehaviorCount = syntheticCurrentBehaviorCount(input.scenarios);
  if (measuredSyntheticCurrentBehaviorCount > 0) {
    const unsupported = input.scenarios.find(
      (scenario) =>
        scenario.currentBehavior.status !== 'proved' &&
        scenario.currentBehavior.status !== 'unknown'
    );
    if (unsupported) {
      throw new Error(
        `unsupported current behavior status: ${String(unsupported.currentBehavior.status)}`
      );
    }
    throw new Error('synthetic current behavior description is forbidden');
  }
  const scenarios = input.scenarios.map((scenario) => {
    const currentBehavior = normalizeCurrentBehavior(scenario.currentBehavior);
    const targetBehavior = {
      description: nonEmpty(scenario.targetBehavior.description, 'target behavior'),
      requirementRefs: scenario.targetBehavior.requirementRefs.map((ref) =>
        nonEmpty(ref, 'target requirement ref')
      ),
    };
    const deltaType =
      currentBehavior.status === 'unknown'
        ? ('added' as const)
        : currentBehavior.description === targetBehavior.description
          ? ('unchanged' as const)
          : ('modified' as const);
    const preimage = {
      scenarioId: nonEmpty(scenario.scenarioId, 'scenarioId'),
      currentBehavior,
      targetBehavior,
      deltaType,
    };
    return { ...preimage, scenarioDeltaHash: sha256Stable(preimage) };
  });
  const preimage = {
    schemaVersion: 'requirements-contract-business-behavior-delta/v1' as const,
    requirementSetId: nonEmpty(input.requirementSetId, 'requirementSetId'),
    semanticModelHash: input.semanticModelHash,
    scenarios,
    syntheticCurrentBehaviorCount: measuredSyntheticCurrentBehaviorCount,
    decision: 'pass' as const,
  };
  const result = { ...preimage, deltaHash: sha256Stable(preimage) };
  if (!validateSchema(result)) throw new Error('Business Behavior Delta schema validation failed');
  return result;
}
