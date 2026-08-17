import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { executeCommittedGoalRun } from '../source-authority/scripts/main-agent-goal-run-executor';
import type { MainAgentActionContext } from './source-authority-main-action';

type GoalRunResult = Record<string, unknown>;

let resultValidator: ValidateFunction | null = null;

function validateResult(result: GoalRunResult): void {
  if (!resultValidator) {
    const schemaPath = path.join(
      __dirname,
      '..',
      'source-authority',
      'schemas',
      'main-agent-goal-run-result.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
    resultValidator = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  }
  if (!resultValidator(result)) {
    throw Object.assign(new Error('main_agent_goal_run_result_invalid'), {
      validationErrors: resultValidator.errors,
    });
  }
}

function invalidInput(issueCode: string): GoalRunResult {
  return {
    schemaVersion: 'main-agent-goal-run-result/v1',
    profile: null,
    status: 'blocked',
    issueCode,
    activeRunPointer: null,
    activationRecord: null,
    attemptPointer: null,
    validClosures: [],
    campaignClosure: null,
    projections: [],
  };
}

function issueCode(error: unknown): string {
  const issue = error instanceof Error ? error.message : String(error);
  return /^(?:requirements_successor_required|architecture_successor_required|readiness_recheck_required):[a-z0-9_]+$/u.test(
    issue
  ) || /^[a-z][a-z0-9_]+(?::[A-Za-z0-9._-]+)?$/u.test(issue)
    ? issue
    : 'goal_execution_internal_error';
}

function projectRef(projectRoot: string, targetPath: string): string {
  const relative = path
    .relative(path.resolve(projectRoot), path.resolve(targetPath))
    .replace(/\\/gu, '/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('goal_execution_artifact_path_invalid');
  }
  return relative;
}

function committedFailurePayload(
  error: unknown,
  projectRoot: string,
  payload: GoalRunResult
): GoalRunResult {
  const committed = (error as { committed?: Record<string, unknown> })?.committed;
  const pointer = (error as { attemptPointer?: Record<string, unknown> })?.attemptPointer;
  if (!committed || !['requirements_backed', 'standalone'].includes(String(committed.profile))) {
    return payload;
  }
  const outRoot = String(committed.outRoot);
  const activeRunPointer = committed.activeRunPointer as Record<string, unknown>;
  const activationRecord = committed.activationRecord as Record<string, unknown>;
  const committedPayload: GoalRunResult = {
    ...payload,
    profile: committed.profile,
    activeRunPointer: {
      artifactRef: projectRef(projectRoot, String(committed.activeRunPointerPath)),
      artifactHash: activeRunPointer.activeRunPointerHash,
    },
    activationRecord: {
      artifactRef: projectRef(
        projectRoot,
        path.join(outRoot, ...String(activeRunPointer.activationRecordRef).split('/'))
      ),
      artifactHash: activationRecord.activationRecordHash,
    },
  };
  if (!pointer) return committedPayload;
  const validClosureRefs = Array.isArray(pointer.validClosureRefs) ? pointer.validClosureRefs : [];
  return {
    ...committedPayload,
    attemptPointer: {
      artifactRef: projectRef(
        projectRoot,
        path.join(outRoot, 'goal', 'runtime', 'current-execution-attempt.json')
      ),
      artifactHash: pointer.attemptPointerHash,
      pointerVersion: pointer.pointerVersion,
      phase: pointer.phase,
    },
    validClosures: validClosureRefs.map((closureRef: Record<string, unknown>) => ({
      role: 'authority_closure',
      artifactRef: projectRef(
        projectRoot,
        path.join(outRoot, ...String(closureRef.path).split('/'))
      ),
      artifactHash: closureRef.hash,
    })),
  };
}

export function runExecuteGoalRunAction(context: MainAgentActionContext): {
  payload: GoalRunResult;
  exitCode: number;
} {
  const allowed = new Set(['action', 'cwd', 'activeRun', 'remediateFrom', 'json']);
  const forbidden = Object.keys(context.args).find((key) => !allowed.has(key));
  const activeRun = context.args.activeRun;
  if (
    forbidden ||
    typeof activeRun !== 'string' ||
    activeRun.length === 0 ||
    context.args.json !== 'true' ||
    (context.args.remediateFrom !== undefined &&
      (typeof context.args.remediateFrom !== 'string' || context.args.remediateFrom.length === 0))
  ) {
    const payload = invalidInput('goal_execution_request_invalid');
    validateResult(payload);
    return { payload, exitCode: 1 };
  }
  try {
    const payload = executeCommittedGoalRun({
      projectRoot: context.cwd,
      activeRunPointerPath: activeRun,
      remediateFrom:
        typeof context.args.remediateFrom === 'string' ? context.args.remediateFrom : null,
    }) as GoalRunResult;
    validateResult(payload);
    return {
      payload,
      exitCode: ['closed', 'execution_reused'].includes(String(payload.status)) ? 0 : 1,
    };
  } catch (error) {
    const payload = committedFailurePayload(error, context.cwd, invalidInput(issueCode(error)));
    validateResult(payload);
    return { payload, exitCode: 1 };
  }
}
