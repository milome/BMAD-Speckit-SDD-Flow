import * as path from 'node:path';
import {
  finalizeCommittedGoalRun,
  type GoalFinalizationResult,
} from '../source-authority/scripts/main-agent-goal-run-finalizer';
import { createGoalFinalizationActorResolver } from '../source-authority/scripts/main-agent-goal-finalization-actor-resolver';
import type { MainAgentActionContext } from './source-authority-main-action';

function blockedResult(issueCode: string): GoalFinalizationResult {
  return {
    schemaVersion: 'main-agent-goal-finalization-result/v1',
    status: 'blocked',
    issueCode,
    campaignClosureRef: null,
    candidateRef: null,
    acceptedResultRef: null,
    aggregateRef: null,
    effectivePassRef: null,
    deliveryGateReceiptRef: null,
    closeoutRequestRef: null,
    pageRef: null,
  };
}

function issueCode(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return /^(?:requirements_successor_required|architecture_successor_required|readiness_recheck_required):[a-z0-9_]+$/u.test(
    value
  ) || /^[a-z][a-z0-9_]+(?::[A-Za-z0-9._-]+)?$/u.test(value)
    ? value
    : 'goal_finalization_internal_error';
}

function isConfinedRelativePath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[A-Za-z]:/u.test(value)
  ) {
    return false;
  }
  return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

function isGoalFinalizationResult(value: unknown): value is GoalFinalizationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const expectedKeys = [
    'schemaVersion',
    'status',
    'issueCode',
    'campaignClosureRef',
    'candidateRef',
    'acceptedResultRef',
    'aggregateRef',
    'effectivePassRef',
    'deliveryGateReceiptRef',
    'closeoutRequestRef',
    'pageRef',
  ];
  return (
    result.schemaVersion === 'main-agent-goal-finalization-result/v1' &&
    ['awaiting_user_acceptance', 'finalization_reused', 'blocked'].includes(
      String(result.status)
    ) &&
    Object.keys(result).length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(result, key))
  );
}

export async function runFinalizeGoalRunAction(context: MainAgentActionContext): Promise<{
  payload: GoalFinalizationResult;
  exitCode: number;
}> {
  const allowed = new Set(['action', 'cwd', 'campaignClosure', 'json']);
  const forbidden = Object.keys(context.args).find((key) => !allowed.has(key));
  const campaignClosurePath = context.args.campaignClosure;
  if (forbidden || !isConfinedRelativePath(campaignClosurePath) || context.args.json !== 'true') {
    return { payload: blockedResult('goal_finalization_request_invalid'), exitCode: 2 };
  }
  try {
    const payload = await finalizeCommittedGoalRun(
      {
        projectRoot: context.cwd,
        campaignClosurePath,
      },
      createGoalFinalizationActorResolver({ projectRoot: context.cwd })
    );
    if (!isGoalFinalizationResult(payload)) {
      throw new Error('goal_finalization_result_invalid');
    }
    return {
      payload,
      exitCode: ['awaiting_user_acceptance', 'finalization_reused'].includes(payload.status)
        ? 0
        : 1,
    };
  } catch (error) {
    return { payload: blockedResult(issueCode(error)), exitCode: 2 };
  }
}
