export interface CanCommitInput {
  audit_status: string;
  commit_allowed: boolean;
}

export function canCommit(input: CanCommitInput): boolean {
  return input.audit_status === 'pass' && input.commit_allowed === true;
}

export interface ResolveNextStageInput {
  currentStage: string;
  auditStatus: string;
}

export interface ResolveNextStageOutput {
  next_stage: string;
  allowed_action: 'allow' | 'iterate' | 'audit_required' | 'blocked';
}

export function resolveNextStage(input: ResolveNextStageInput): ResolveNextStageOutput {
  if (input.auditStatus === 'PASS') {
    if (input.currentStage === 'specify') {
      return { next_stage: 'specify_passed', allowed_action: 'allow' };
    }
    if (input.currentStage === 'plan') {
      return { next_stage: 'plan_passed', allowed_action: 'allow' };
    }
    if (input.currentStage === 'tasks') {
      return { next_stage: 'tasks_passed', allowed_action: 'allow' };
    }
    if (input.currentStage === 'implement') {
      return { next_stage: 'implement_passed', allowed_action: 'allow' };
    }
  }

  if (input.auditStatus === 'FAIL') {
    return { next_stage: 'blocked', allowed_action: 'iterate' };
  }

  return { next_stage: 'blocked', allowed_action: 'audit_required' };
}
