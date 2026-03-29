import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readGovernanceAttemptLoopState,
  runGovernanceRemediation,
} from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function createFixtureProject(): {
  root: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-remediation-wave2a-tail-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'post_audit',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.3',
    storySlug: 'wave2a-tail-governance',
    epicId: 'epic-15',
    runId: 'run-wave2a-tail',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function wave2aTailBaseInput(root: string, outputPath: string, attemptId: string) {
  return {
    projectRoot: root,
    outputPath,
    promptText: '继续 Wave 2A 主链尾段整改；post_audit 通过后必须停到人工 PR 审核。',
    stageContextKnown: true,
    gateFailureExists: true,
    blockerOwnershipLocked: true,
    rootTargetLocked: true,
    equivalentAdapterCount: 1,
    attemptId,
    sourceGateFailureIds: ['GF-WAVE2A-TAIL-001'],
    capabilitySlot: 'qa.readiness',
    canonicalAgent: 'PM + QA / readiness reviewer',
    actualExecutor: 'implementation readiness workflow',
    adapterPath: 'local workflow fallback',
    targetArtifacts: ['implementation-readiness-report.md'],
    expectedDelta: 'close Wave 2A mainline blockers',
    rerunOwner: 'PM',
    rerunGate: 'implementation-readiness',
    outcome: 'blocked',
    hostKind: 'codex' as const,
    maxAttempts: 6,
  };
}

function wave2aMainlineRerunChain() {
  return [
    {
      rerunGate: 'implementation-readiness',
      capabilitySlot: 'qa.readiness',
      canonicalAgent: 'PM + QA / readiness reviewer',
      targetArtifacts: ['implementation-readiness-report.md'],
      expectedDelta: 'close readiness blockers',
    },
    {
      rerunGate: 'speckit_5_2',
      capabilitySlot: 'speckit.implement',
      canonicalAgent: 'speckit-implement + auditor-implement',
      targetArtifacts: ['tasks.md', 'AUDIT_implement-E15-S3.md'],
      expectedDelta: 'close implement-stage blockers',
    },
    {
      rerunGate: 'bmad_story_stage4',
      capabilitySlot: 'story.post_audit',
      canonicalAgent: 'auditor-implement',
      targetArtifacts: ['AUDIT_Story_15-3_stage4.md'],
      expectedDelta: 'close post-audit blockers',
    },
    {
      rerunGate: 'pr_review',
      capabilitySlot: 'review.pr',
      canonicalAgent: 'Human Reviewer',
      targetArtifacts: ['pull-request'],
      expectedDelta: 'wait for explicit human PR review decision',
    },
  ];
}

describe('governance remediation runner Wave 2A tail contract', () => {
  it('stops after post_audit passes and waits for human pr_review instead of spawning another remediation attempt', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-wave2a-tail'
      );
      mkdirSync(outDir, { recursive: true });

      const readinessOutput = path.join(outDir, 'attempt-readiness.md');
      const implementOutput = path.join(outDir, 'attempt-implement.md');
      const postAuditOutput = path.join(outDir, 'attempt-post-audit.md');
      const prReviewOutput = path.join(outDir, 'attempt-pr-review.md');

      const firstRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, readinessOutput, 'attempt-wave2a-tail-01'),
        rerunChain: wave2aMainlineRerunChain(),
      } as any);

      expect(firstRun.loopState.rerunGate).toBe('implementation-readiness');

      const implementRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, implementOutput, 'attempt-wave2a-tail-02'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'Readiness blockers are closed; move into implement audit.',
          updatedArtifacts: ['implementation-readiness-report.md'],
        },
      } as any);

      expect(implementRun.loopState.rerunGate).toBe('speckit_5_2');
      expect(existsSync(implementOutput)).toBe(true);

      const postAuditRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, postAuditOutput, 'attempt-wave2a-tail-03'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'speckit_5_2',
          status: 'pass',
          summary: 'Implement-stage audit passed; move into post_audit.',
          updatedArtifacts: ['AUDIT_implement-E15-S3.md'],
        },
      } as any);

      expect(postAuditRun.loopState.rerunGate).toBe('bmad_story_stage4');
      expect(existsSync(postAuditOutput)).toBe(true);

      const prReviewHold = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, prReviewOutput, 'attempt-wave2a-tail-04'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'bmad_story_stage4',
          status: 'pass',
          summary: 'Post-audit passed; the next step must wait for explicit human PR review.',
          updatedArtifacts: ['AUDIT_Story_15-3_stage4.md'],
        },
      } as any);

      const persisted = readGovernanceAttemptLoopState(
        fixture.root,
        firstRun.loopState.loopStateId
      );

      expect(prReviewHold.rerunGateResultIngested).toBe(true);
      expect(prReviewHold.shouldContinue).toBe(false);
      expect(prReviewHold.stopReason).toBe('await human review');
      expect(prReviewHold.executorPacket).toBeNull();
      expect(prReviewHold.loopState.status).toBe('stopped');
      expect(prReviewHold.loopState.lastStopReason).toBe('await human review');
      expect(prReviewHold.loopState.rerunGate).toBe('pr_review');
      expect(prReviewHold.loopState.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
        packetStrategy: 'default-remediation-packet',
        reason: 'no journey contract hints detected; use the default gate remediation route',
      });
      expect(prReviewHold.loopState.remediationAuditTraceSummaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(existsSync(prReviewOutput)).toBe(false);
      expect(persisted.lastGateResult?.gate).toBe('bmad_story_stage4');
      expect(persisted.lastGateResult?.status).toBe('pass');
      expect(persisted.remediationAuditTraceSummaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(readFileSync(postAuditOutput, 'utf8')).toContain('Rerun Gate: bmad_story_stage4');
    } finally {
      fixture.cleanup();
    }
  });
});
