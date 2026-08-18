import { describe, expect, it } from 'vitest';

import { projectGovernedGoalExecutionTaskReport } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration';

const PACKAGE_HASH = `sha256:${'a'.repeat(64)}`;
const CLOSURE_HASH = `sha256:${'b'.repeat(64)}`;

function validInput() {
  return {
    packetId: 'goal-run:R-001',
    packageManifestHash: PACKAGE_HASH,
    campaignClosureHash: CLOSURE_HASH,
    closedAuthorities: [
      {
        executionAuthorityId: 'direct:R-001',
        closureHash: `sha256:${'c'.repeat(64)}`,
      },
    ],
    filesChanged: ['src/refund.ts'],
    validationsRun: ['npm test -- refund'],
    evidence: ['goal/runtime/evidence/refund.json'],
    downstreamContext: ['campaign-closure-bound'],
  };
}

describe('Task 7B Goal TaskReport provenance', () => {
  it('renders done only from package, campaign closure, and closed-authority lineage', () => {
    expect(projectGovernedGoalExecutionTaskReport(validInput())).toMatchObject({
      packetId: 'goal-run:R-001',
      status: 'done',
      filesChanged: ['src/refund.ts'],
      validationsRun: ['npm test -- refund'],
      evidence: ['goal/runtime/evidence/refund.json'],
    });
  });

  it.each([
    { packageManifestHash: 'not-a-hash' },
    { campaignClosureHash: '' },
    { closedAuthorities: [] },
    {
      closedAuthorities: [{ executionAuthorityId: '', closureHash: `sha256:${'c'.repeat(64)}` }],
    },
    {
      closedAuthorities: [{ executionAuthorityId: 'direct:R-001', closureHash: 'sha256:stale' }],
    },
  ])('rejects malformed or incomplete terminal provenance: %#', (mutation) => {
    expect(() => projectGovernedGoalExecutionTaskReport({ ...validInput(), ...mutation })).toThrow(
      'main_agent_goal_task_report_provenance_mismatch'
    );
  });
});
