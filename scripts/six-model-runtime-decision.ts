import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildOpenReconfirmationBlockingReasonRefs,
  hasOpenReconfirmationRequest,
} from './reconfirmation-runtime';

export type SixModelRuntimeNextAction =
  | 'enter_architecture_confirmation'
  | 'prepare_architecture_confirmation'
  | 'recompute_current_model_gate'
  | 'run_implementation_readiness_gate'
  | 'dispatch_implement'
  | 'run_execution_closure_gate'
  | 'dispatch_review'
  | 'dispatch_remediation'
  | 'run_closeout'
  | 'run_pre_confirmation_drilldown'
  | 'await_user_acceptance'
  | 'await_user'
  | 'record_closed'
  | null;

export interface SixModelRuntimeDecision {
  schemaVersion: 'six-model-runtime-decision/v1';
  recordId: string;
  requirementSetId: string;
  attemptId: string;
  currentMentalModel: string | null;
  currentModelStatus: string | null;
  nextAction: SixModelRuntimeNextAction;
  ready: boolean;
  nextMentalModel: string | null;
  allowedDispatchTaskType: 'implement' | 'audit' | 'remediate' | 'closeout' | null;
  transitionMode: 'auto_after_controlled_ingest' | 'requires_user_or_gate' | 'blocked';
  blockingReasonRefs: Array<{ sourceType: string; id: string }>;
  userFacingStagePrompt: string;
  recordHash: string;
}

export interface SplitBrainBlocker {
  schemaVersion: 'split-brain-blocker/v1';
  blockerId: 'split_brain_orchestration_state_next_action';
  orchestrationStateNextAction: string | null;
  matrixNextAction: string | null;
  currentMentalModel: string | null;
  currentModelStatus: string | null;
  pendingPacketId: string | null;
  lastTaskReportStatus: string | null;
  recordHash: string;
  decisionRef: string;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

export function decisionMatrixDir(
  projectRoot: string,
  recordId: string,
  attemptId: string
): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(recordId),
    'decision-matrix',
    safeSegment(attemptId)
  );
}

function modelResult(
  record: Record<string, unknown>,
  model: string | null
): Record<string, unknown> | null {
  const results = object(record.sixModelResults);
  return model ? object(results?.[model]) : null;
}

function statusFor(record: Record<string, unknown>, model: string): string {
  return text(modelResult(record, model)?.status);
}

function hasCurrentPass(record: Record<string, unknown>, model: string): boolean {
  return statusFor(record, model) === 'pass';
}

function isTerminalCloseout(record: Record<string, unknown>): boolean {
  const closeout = object(record.closeout);
  return (
    text(record.status) === 'closed' ||
    text(record.lastEventType) === 'record_closed' ||
    text(closeout?.decision) === 'pass'
  );
}

function isCurrentImplementationCompletion(input: {
  pendingPacketId?: string | null;
  pendingPacketTaskType?: string | null;
  pendingPacketKind?: string | null;
  lastTaskReportPacketId?: string | null;
  lastTaskReportStatus?: string | null;
}): boolean {
  const pendingTaskType = text(input.pendingPacketTaskType);
  const pendingPacketKind = text(input.pendingPacketKind);
  return (
    text(input.lastTaskReportStatus) === 'done' &&
    (pendingTaskType === 'implement' ||
      (pendingTaskType === '' && pendingPacketKind === 'execution')) &&
    text(input.pendingPacketId) !== '' &&
    text(input.pendingPacketId) === text(input.lastTaskReportPacketId)
  );
}

function nextModelFor(action: SixModelRuntimeNextAction): string | null {
  switch (action) {
    case 'enter_architecture_confirmation':
      return 'architecture_confirmation';
    case 'run_implementation_readiness_gate':
      return 'implementation_readiness';
    case 'dispatch_implement':
    case 'run_execution_closure_gate':
      return 'execution_closure';
    case 'dispatch_review':
      return 'audit_review';
    case 'run_closeout':
      return 'delivery_confirmation';
    case 'record_closed':
      return 'closed';
    default:
      return null;
  }
}

function taskTypeFor(
  action: SixModelRuntimeNextAction
): SixModelRuntimeDecision['allowedDispatchTaskType'] {
  switch (action) {
    case 'dispatch_implement':
      return 'implement';
    case 'dispatch_review':
      return 'audit';
    case 'dispatch_remediation':
      return 'remediate';
    case 'run_closeout':
    case 'record_closed':
      return 'closeout';
    default:
      return null;
  }
}

function blockingReasons(result: Record<string, unknown> | null): string[] {
  return Array.isArray(result?.blockingReasons)
    ? result.blockingReasons.map((item) => text(item)).filter(Boolean)
    : [];
}

export function resolveSixModelRuntimeDecision(input: {
  record: Record<string, unknown> | null;
  attemptId: string;
  pendingPacketId?: string | null;
  pendingPacketTaskType?: string | null;
  pendingPacketKind?: string | null;
  lastTaskReportPacketId?: string | null;
  lastTaskReportStatus?: string | null;
}): SixModelRuntimeDecision {
  const record = input.record ?? {};
  const recordId = text(record.recordId) || 'requirement-record';
  const requirementSetId = text(record.requirementSetId) || recordId;
  const currentMentalModel = text(record.currentMentalModel) || null;
  const currentResult = modelResult(record, currentMentalModel);
  const currentModelStatus = text(currentResult?.status) || null;
  const reasonRefs = blockingReasons(currentResult).map((id) => ({
    sourceType: 'model_result',
    id,
  }));

  let nextAction: SixModelRuntimeNextAction = 'await_user';
  let ready = false;
  let transitionMode: SixModelRuntimeDecision['transitionMode'] = 'requires_user_or_gate';

  if (hasOpenReconfirmationRequest(record)) {
    nextAction = 'run_pre_confirmation_drilldown';
    ready = false;
    transitionMode = 'blocked';
    reasonRefs.push(...buildOpenReconfirmationBlockingReasonRefs(record));
  } else if (isTerminalCloseout(record)) {
    nextAction = 'record_closed';
    ready = true;
    transitionMode = 'auto_after_controlled_ingest';
  } else if (text(record.status) === 'awaiting_user_acceptance') {
    nextAction = 'await_user_acceptance';
    ready = false;
    transitionMode = 'requires_user_or_gate';
  } else if (text(record.status) !== 'user_confirmed') {
    nextAction = 'run_pre_confirmation_drilldown';
    reasonRefs.push({ sourceType: 'requirement_record', id: recordId });
  } else if (currentMentalModel === 'requirement_confirmation') {
    if (currentModelStatus === 'pass') {
      nextAction = 'enter_architecture_confirmation';
      ready = true;
      transitionMode = 'auto_after_controlled_ingest';
    } else {
      nextAction = 'run_pre_confirmation_drilldown';
    }
  } else if (currentMentalModel === 'architecture_confirmation') {
    if (currentModelStatus === 'pass') {
      nextAction = 'run_implementation_readiness_gate';
      ready = true;
      transitionMode = 'auto_after_controlled_ingest';
    } else {
      nextAction = 'prepare_architecture_confirmation';
    }
  } else if (currentMentalModel === 'implementation_readiness') {
    if (currentModelStatus === 'pass') {
      if (
        isCurrentImplementationCompletion(input) &&
        !hasCurrentPass(record, 'execution_closure')
      ) {
        nextAction = 'run_execution_closure_gate';
        ready = true;
        transitionMode = 'requires_user_or_gate';
      } else {
        nextAction = 'dispatch_implement';
        ready = true;
        transitionMode = 'auto_after_controlled_ingest';
      }
    } else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
      nextAction = 'dispatch_remediation';
      ready = true;
      transitionMode = 'blocked';
    } else if (currentModelStatus === 'stale') {
      nextAction = 'recompute_current_model_gate';
    } else {
      nextAction = 'run_implementation_readiness_gate';
    }
  } else if (currentMentalModel === 'execution_closure') {
    if (currentModelStatus === 'pass') {
      nextAction = 'dispatch_review';
      ready = true;
      transitionMode = 'auto_after_controlled_ingest';
    } else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
      nextAction = 'dispatch_remediation';
      ready = true;
      transitionMode = 'blocked';
    } else if (currentModelStatus === 'stale') {
      nextAction = 'recompute_current_model_gate';
    } else {
      nextAction = 'run_execution_closure_gate';
      ready = true;
    }
  } else if (currentMentalModel === 'audit_review') {
    if (currentModelStatus === 'pass' && hasCurrentPass(record, 'execution_closure')) {
      nextAction = 'run_closeout';
      ready = true;
      transitionMode = 'auto_after_controlled_ingest';
    } else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
      nextAction = 'dispatch_remediation';
      ready = true;
      transitionMode = 'blocked';
    } else if (currentModelStatus === 'stale') {
      nextAction = 'recompute_current_model_gate';
    } else {
      nextAction = 'dispatch_review';
      ready = true;
    }
  } else if (currentMentalModel === 'delivery_confirmation') {
    if (currentModelStatus === 'awaiting_user_acceptance') {
      nextAction = 'await_user_acceptance';
      ready = false;
      transitionMode = 'requires_user_or_gate';
    } else if (currentModelStatus === 'pass' && hasCurrentPass(record, 'audit_review')) {
      nextAction = 'record_closed';
      ready = true;
      transitionMode = 'auto_after_controlled_ingest';
    } else {
      nextAction = 'run_closeout';
      ready = true;
    }
  } else {
    nextAction = 'run_pre_confirmation_drilldown';
  }

  const recordHash = sha256Text(JSON.stringify(record));
  return {
    schemaVersion: 'six-model-runtime-decision/v1',
    recordId,
    requirementSetId,
    attemptId: input.attemptId,
    currentMentalModel,
    currentModelStatus,
    nextAction,
    ready,
    nextMentalModel: nextModelFor(nextAction),
    allowedDispatchTaskType: taskTypeFor(nextAction),
    transitionMode,
    blockingReasonRefs: reasonRefs,
    userFacingStagePrompt:
      nextAction === 'await_user_acceptance'
        ? '交付确认页已生成，等待用户打开 closeout-confirmation-current.html 核验，并执行 confirm-closeout-acceptance 后才写入 record_closed。'
        : `当前六心智阶段: ${currentMentalModel ?? 'unknown'} (${currentModelStatus ?? 'unknown'}); 下一步: ${nextAction ?? 'none'}.`,
    recordHash,
  };
}

export function writeSixModelRuntimeDecision(input: {
  projectRoot: string;
  decision: SixModelRuntimeDecision;
}): string {
  const filePath = path.join(
    decisionMatrixDir(input.projectRoot, input.decision.recordId, input.decision.attemptId),
    'six-model-runtime-decision.json'
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(input.decision, null, 2)}\n`, 'utf8');
  return filePath;
}

export function writeSplitBrainBlocker(input: {
  projectRoot: string;
  decision: SixModelRuntimeDecision;
  orchestrationStateNextAction: string | null;
  pendingPacketId?: string | null;
  lastTaskReportStatus?: string | null;
  decisionRef: string;
}): string {
  const blocker: SplitBrainBlocker = {
    schemaVersion: 'split-brain-blocker/v1',
    blockerId: 'split_brain_orchestration_state_next_action',
    orchestrationStateNextAction: input.orchestrationStateNextAction,
    matrixNextAction: input.decision.nextAction,
    currentMentalModel: input.decision.currentMentalModel,
    currentModelStatus: input.decision.currentModelStatus,
    pendingPacketId: input.pendingPacketId ?? null,
    lastTaskReportStatus: input.lastTaskReportStatus ?? null,
    recordHash: input.decision.recordHash,
    decisionRef: input.decisionRef,
  };
  const filePath = path.join(
    decisionMatrixDir(input.projectRoot, input.decision.recordId, input.decision.attemptId),
    'split-brain-blocker.json'
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(blocker, null, 2)}\n`, 'utf8');
  return filePath;
}
