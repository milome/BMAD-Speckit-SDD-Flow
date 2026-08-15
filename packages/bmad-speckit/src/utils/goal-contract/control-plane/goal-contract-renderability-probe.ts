import { validateGoalContractSchema } from './schema-registry';

type JsonObject = Record<string, unknown>;

export interface GoalContractRenderabilityProbe {
  schemaVersion: 'GoalContractRenderabilityProbe/v1';
  goalExecutionIRHash: string;
  expectedObligationIds: string[];
  renderedObligationIds: string[];
  missingObligationIds: string[];
  unexpectedObligationIds: string[];
  expectedTaskIds: string[];
  renderedTaskIds: string[];
  missingTaskIds: string[];
  unexpectedTaskIds: string[];
  decision: 'pass' | 'block';
  issueCodes: string[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function setDifference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function includesId(markdown: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9_.-])${escaped}(?:$|[^A-Za-z0-9_.-])`, 'mu').test(markdown);
}

export function probeGoalContractRenderability(input: {
  goalExecutionIr: JsonObject;
  markdown: string;
}): GoalContractRenderabilityProbe {
  const expectedObligationIds = sortedUnique(
    objects(input.goalExecutionIr.obligations).map((row) => text(row.obligationId))
  );
  const expectedTaskIds = sortedUnique(
    objects(input.goalExecutionIr.atomicTasks).map((row) => text(row.taskId))
  );
  const renderedObligationIds = expectedObligationIds.filter((id) =>
    includesId(input.markdown, id)
  );
  const renderedTaskIds = expectedTaskIds.filter((id) => includesId(input.markdown, id));
  const missingObligationIds = setDifference(expectedObligationIds, renderedObligationIds);
  const unexpectedObligationIds = setDifference(renderedObligationIds, expectedObligationIds);
  const missingTaskIds = setDifference(expectedTaskIds, renderedTaskIds);
  const unexpectedTaskIds = setDifference(renderedTaskIds, expectedTaskIds);
  const issueCodes = sortedUnique([
    ...(missingObligationIds.length > 0 ? ['goal_parent_projection_obligation_missing'] : []),
    ...(unexpectedObligationIds.length > 0 ? ['goal_parent_projection_obligation_unexpected'] : []),
    ...(missingTaskIds.length > 0 ? ['goal_parent_projection_task_missing'] : []),
    ...(unexpectedTaskIds.length > 0 ? ['goal_parent_projection_task_unexpected'] : []),
    ...(/\b(?:undefined|null|NaN)\b/u.test(input.markdown)
      ? ['goal_parent_projection_undefined_value']
      : []),
    ...(!input.markdown.includes(text(input.goalExecutionIr.goalExecutionIRHash))
      ? ['goal_parent_projection_ir_identity_missing']
      : []),
  ]);
  const report = {
    schemaVersion: 'GoalContractRenderabilityProbe/v1',
    goalExecutionIRHash: text(input.goalExecutionIr.goalExecutionIRHash),
    expectedObligationIds,
    renderedObligationIds,
    missingObligationIds,
    unexpectedObligationIds,
    expectedTaskIds,
    renderedTaskIds,
    missingTaskIds,
    unexpectedTaskIds,
    decision: issueCodes.length === 0 ? 'pass' : 'block',
    issueCodes,
  } satisfies GoalContractRenderabilityProbe;
  validateGoalContractSchema('goal-contract-renderability-probe.schema.json', report);
  return Object.freeze(report);
}
