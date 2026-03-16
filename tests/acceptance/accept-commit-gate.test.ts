import { describe, expect, it } from 'vitest';
import { canCommit, resolveNextStage } from './can-bmad-commit';

describe('commit gate', () => {
  it('denies commit when audit fails', () => {
    expect(canCommit({ audit_status: 'fail', commit_allowed: false })).toBe(false);
  });

  it('allows commit when audit passes and commit_allowed', () => {
    expect(canCommit({ audit_status: 'pass', commit_allowed: true })).toBe(true);
  });
});

describe('state transitions', () => {
  it('transitions specify to specify_passed on PASS', () => {
    expect(resolveNextStage({
      currentStage: 'specify',
      auditStatus: 'PASS',
    })).toEqual({
      next_stage: 'specify_passed',
      allowed_action: 'allow',
    });
  });

  it('blocks on FAIL', () => {
    expect(resolveNextStage({
      currentStage: 'specify',
      auditStatus: 'FAIL',
    })).toEqual({
      next_stage: 'blocked',
      allowed_action: 'iterate',
    });
  });
});
