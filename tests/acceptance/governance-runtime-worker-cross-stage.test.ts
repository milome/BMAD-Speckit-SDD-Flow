import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import {
  readGovernanceCurrentRun,
  governanceCurrentRunPath,
  governanceDoneQueueFilePath,
  governancePendingQueueFilePath,
  type GovernanceRuntimeQueueItem,
} from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';
import {
  governanceAttemptLoopStatePath,
  runGovernanceRemediation,
} from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function writeGovernanceConfig(root: string): string {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
      'version: 1',
      'primaryHost: cursor',
      'packetHosts:',
      '  - cursor',
      '  - claude',
      'provider:',
      '  mode: stub',
      '  id: readiness-governance-stub',
    ].join('\n'),
    'utf8'
  );
  return configPath;
}

function createFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runtime-worker-cross-stage-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.2',
    storySlug: 'runtime-governance-cross-stage',
    epicId: 'epic-15',
    runId: 'run-brief-prd-arch-worker',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-2',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function createWave2aTailFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runtime-worker-wave2a-tail-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'post_impl',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.3',
    storySlug: 'runtime-governance-wave2a-tail',
    epicId: 'epic-15',
    runId: 'run-wave2a-tail-worker',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function briefToArchRerunChain() {
  return [
    {
      rerunGate: 'brief-gate',
      capabilitySlot: 'brief.challenge',
      canonicalAgent: 'PM + Critical Auditor',
      targetArtifacts: ['product-brief.md'],
      expectedDelta: 'close brief contract blockers',
    },
    {
      rerunGate: 'prd-contract-gate',
      capabilitySlot: 'prd.contract',
      canonicalAgent: 'PM + Critical Auditor',
      targetArtifacts: ['prd.md'],
      expectedDelta: 'close PRD contract blockers',
    },
    {
      rerunGate: 'architecture-contract-gate',
      capabilitySlot: 'architecture.contract',
      canonicalAgent: 'Architect + Critical Auditor',
      targetArtifacts: ['architecture.md'],
      expectedDelta: 'close architecture contract blockers',
    },
  ];
}

function crossStageBaseInput(root: string, outputPath: string, attemptId: string) {
  return {
    projectRoot: root,
    outputPath,
    promptText: '继续 brief -> prd -> arch blocker 修复，不要联网，最小修复。',
    stageContextKnown: true,
    gateFailureExists: true,
    blockerOwnershipLocked: true,
    rootTargetLocked: true,
    equivalentAdapterCount: 2,
    attemptId,
    sourceGateFailureIds: ['GF-BRIEF-100'],
    capabilitySlot: 'brief.challenge',
    canonicalAgent: 'PM + Critical Auditor',
    actualExecutor: 'brief contract workflow',
    adapterPath: 'local workflow fallback',
    targetArtifacts: ['product-brief.md'],
    expectedDelta: 'close brief contract blockers',
    rerunOwner: 'PM',
    rerunGate: 'brief-gate',
    outcome: 'blocked',
    hostKind: 'cursor' as const,
    maxAttempts: 5,
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
    sourceGateFailureIds: ['GF-WAVE2A-TAIL-002'],
    capabilitySlot: 'qa.readiness',
    canonicalAgent: 'PM + QA / readiness reviewer',
    actualExecutor: 'implementation readiness workflow',
    adapterPath: 'local workflow fallback',
    targetArtifacts: ['implementation-readiness-report.md'],
    expectedDelta: 'close Wave 2A mainline blockers',
    rerunOwner: 'PM',
    rerunGate: 'implementation-readiness',
    outcome: 'blocked',
    hostKind: 'cursor' as const,
    maxAttempts: 6,
  };
}

describe('governance runtime worker cross-stage rerun queue', () => {
  it('promotes the active rerun gate to PRD after a brief gate pass instead of consuming it as a single-gate loop', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-worker-cross-stage'
      );
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-brief.md');
      const secondOutput = path.join(outDir, 'attempt-prd.md');

      const firstRun = await runGovernanceRemediation({
        ...crossStageBaseInput(fixture.root, firstOutput, 'attempt-worker-cross-stage-01'),
        rerunChain: briefToArchRerunChain(),
      });

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-cross-stage-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-cross-stage-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T03:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                ...crossStageBaseInput(
                  fixture.root,
                  secondOutput,
                  'attempt-worker-cross-stage-02'
                ),
                loopStateId: firstRun.loopState.loopStateId,
                rerunGateResult: {
                  gate: 'brief-gate',
                  status: 'pass',
                  summary: 'Brief gate now passes and handoff should move to PRD.',
                  updatedArtifacts: ['product-brief.md'],
                },
              },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      await processQueue(fixture.root);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as {
        attemptCount: number;
        status: string;
        rerunGate: string;
        capabilitySlot: string;
        targetArtifacts: string[];
        attempts: Array<{ attemptId: string; rerunGateResult?: { gate: string; status: string } }>;
      };
      const latestCurrentRun = currentRun.at(-1);

      expect(existsSync(secondOutput)).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.claude-packet.md'))).toBe(true);
      expect(latestCurrentRun?.type).toBe('governance-remediation-rerun');
      expect(latestCurrentRun?.result?.artifactPath).toBe(secondOutput);
      expect(latestCurrentRun?.result?.shouldContinue).toBe(true);
      expect(latestCurrentRun?.result?.stopReason).toBeNull();
      expect(latestCurrentRun?.result?.rerunGateResultIngested).toBe(true);
      expect(latestCurrentRun?.result?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '- Should Continue: yes',
        ])
      );
      expect(readFileSync(secondOutput, 'utf8')).toContain('Rerun Gate: prd-contract-gate');
      expect(
        readFileSync(
          latestCurrentRun?.result?.packetPaths?.cursor ??
            secondOutput.replace(/\.md$/i, '.cursor-packet.md'),
          'utf8'
        )
      ).toContain('Awaiting Rerun Gate: prd-contract-gate');
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.status).toBe('awaiting_rerun');
      expect(loopStateRaw.rerunGate).toBe('prd-contract-gate');
      expect(loopStateRaw.capabilitySlot).toBe('prd.contract');
      expect(loopStateRaw.targetArtifacts).toEqual(['prd.md']);
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.gate).toBe('brief-gate');
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.status).toBe('pass');
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-worker-cross-stage-02');
    } finally {
      fixture.cleanup();
    }
  });

  it('records a human-review hold in queue result/current-run after bmad_story_stage4 passes instead of dropping executor routing on the floor', async () => {
    const fixture = createWave2aTailFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-worker-wave2a-tail'
      );
      mkdirSync(outDir, { recursive: true });
      const readinessOutput = path.join(outDir, 'attempt-readiness.md');
      const implementOutput = path.join(outDir, 'attempt-implement.md');
      const postAuditOutput = path.join(outDir, 'attempt-post-audit.md');
      const prReviewOutput = path.join(outDir, 'attempt-pr-review.md');

      const firstRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, readinessOutput, 'attempt-worker-wave2a-tail-01'),
        rerunChain: wave2aMainlineRerunChain(),
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, implementOutput, 'attempt-worker-wave2a-tail-02'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'Readiness blockers are closed; move into implement audit.',
          updatedArtifacts: ['implementation-readiness-report.md'],
        },
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, postAuditOutput, 'attempt-worker-wave2a-tail-03'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'speckit_5_2',
          status: 'pass',
          summary: 'Implement-stage audit passed; move into post_audit.',
          updatedArtifacts: ['AUDIT_implement-E15-S3.md'],
        },
      });

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-wave2a-tail-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-wave2a-tail-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T05:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                ...wave2aTailBaseInput(
                  fixture.root,
                  prReviewOutput,
                  'attempt-worker-wave2a-tail-04'
                ),
                loopStateId: firstRun.loopState.loopStateId,
                rerunGateResult: {
                  gate: 'bmad_story_stage4',
                  status: 'pass',
                  summary: 'Post-audit passed; the next step must wait for explicit human PR review.',
                  updatedArtifacts: ['AUDIT_Story_15-3_stage4.md'],
                },
              },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      await processQueue(fixture.root);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const doneQueueResult = JSON.parse(
        readFileSync(governanceDoneQueueFilePath(fixture.root, 'queue-wave2a-tail-01'), 'utf8')
      ) as GovernanceRuntimeQueueItem<unknown, GovernanceExecutionResult>;
      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as {
        attemptCount: number;
        status: string;
        lastStopReason: string | null;
        rerunGate: string;
        attempts: Array<{ attemptId: string; rerunGateResult?: { gate: string; status: string } }>;
      };
      const latestCurrentRun = currentRun.at(-1);

      expect(latestCurrentRun?.type).toBe('governance-remediation-rerun');
      expect(doneQueueResult.result?.artifactPath).toBeNull();
      expect(doneQueueResult.result?.packetPaths ?? {}).toEqual({});
      expect(doneQueueResult.result?.shouldContinue).toBe(false);
      expect(doneQueueResult.result?.stopReason).toBe('await human review');
      expect(doneQueueResult.result?.rerunGateResultIngested).toBe(true);
      expect(latestCurrentRun?.result?.shouldContinue).toBe(false);
      expect(latestCurrentRun?.result?.stopReason).toBe('await human review');
      expect(doneQueueResult.result?.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(latestCurrentRun?.result?.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(doneQueueResult.result?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(latestCurrentRun?.result?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(doneQueueResult.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
          '- Stop Reason: await human review',
          '- Journey Contract Signals: (none)',
        ])
      );
      expect(latestCurrentRun?.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
          '- Stop Reason: await human review',
          '- Journey Contract Signals: (none)',
        ])
      );
      expect(doneQueueResult.result?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Stop Reason: await human review',
          '- Executor Route: default-gate-remediation',
        ])
      );
      expect(latestCurrentRun?.result?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining([
          '## Governance Latest Raw Event',
          '## Governance Remediation Runner Summary',
        ])
      );
      expect(latestCurrentRun?.result?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '- Stop Reason: await human review',
        ])
      );
      expect(existsSync(prReviewOutput)).toBe(false);
      expect(loopStateRaw.attemptCount).toBe(3);
      expect(loopStateRaw.status).toBe('stopped');
      expect(loopStateRaw.lastStopReason).toBe('await human review');
      expect(loopStateRaw.rerunGate).toBe('pr_review');
      expect(loopStateRaw.attempts[2]?.attemptId).toBe('attempt-worker-wave2a-tail-03');
      expect(loopStateRaw.attempts[2]?.rerunGateResult?.gate).toBe('bmad_story_stage4');
      expect(loopStateRaw.attempts[2]?.rerunGateResult?.status).toBe('pass');
    } finally {
      fixture.cleanup();
    }
  });
});
