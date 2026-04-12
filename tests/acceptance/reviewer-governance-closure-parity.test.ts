import { describe, expect, it } from 'vitest';
import {
  buildReviewCloseoutEnvelopeV1,
  buildReviewGovernanceClosureV1,
} from '../../scripts/reviewer-schema';
import { getReviewerRegistration } from '../../scripts/reviewer-registry';

describe('reviewer governance closure parity', () => {
  it('reuses the same governance closure requirements for both hosts', () => {
    const story = getReviewerRegistration('story_audit');
    expect(story.hosts.cursor.governance).toStrictEqual(story.hosts.claude.governance);
  });

  it('freezes a non-happy-path closeout envelope instead of a pass-only contract', () => {
    const envelope = buildReviewCloseoutEnvelopeV1({
      resultCode: 'blocked',
      requiredFixes: ['fix-1'],
      requiredFixesDetail: [{ id: 'fix-1', summary: 'Need another rerun.', severity: 'required' }],
      rerunDecision: 'rerun_required',
      scoringFailureMode: 'non_blocking_failure',
      packetExecutionClosureStatus: 'retry_pending',
    });
    const governance = buildReviewGovernanceClosureV1();

    expect(governance.implementationReadinessStatusRequired).toBe(true);
    expect(governance.packetExecutionClosureRequired).toBe(true);
    expect(envelope.resultCode).toBe('blocked');
    expect(envelope.rerunDecision).toBe('rerun_required');
    expect(envelope.scoringFailureMode).toBe('non_blocking_failure');
    expect(envelope.packetExecutionClosureStatus).toBe('retry_pending');
  });
});
