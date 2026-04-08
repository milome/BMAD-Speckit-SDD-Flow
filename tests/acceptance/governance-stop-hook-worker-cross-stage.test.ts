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
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  readGovernanceCurrentRun,
  governancePendingQueueFilePath,
} from '../../scripts/governance-runtime-queue';
import type {
  GovernanceExecutionResult,
  GovernanceStopHookResult,
} from '../../scripts/governance-hook-types';
import {
  governanceAttemptLoopStatePath,
  runGovernanceRemediation,
} from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import {
  linkRepoNodeModulesIntoProject,
  linkRepoScriptsIntoProject,
  linkRepoTsconfigIntoProject,
} from '../helpers/runtime-registry-fixture';

const require = createRequire(import.meta.url);
const stopHook = require('../../_bmad/claude/hooks/stop.cjs');

function waitBriefly(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForCurrentRunSettled(root: string, expectedCheck: () => boolean): void {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (expectedCheck()) {
      return;
    }
    waitBriefly(100);
  }
  throw new Error('Timed out waiting for stop-hook worker current-run settlement');
}

function cleanupWithRetries(root: string): void {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EBUSY' || attempt === 4) {
        throw error;
      }
      waitBriefly(200);
    }
  }
}

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

function seedScoringSchemaFixture(repoRoot: string, root: string): void {
  cpSync(
    path.join(repoRoot, 'packages', 'scoring', 'schema'),
    path.join(root, 'packages', 'scoring', 'schema'),
    { recursive: true }
  );
}

function createFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-stop-worker-cross-stage-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  seedScoringSchemaFixture(repoRoot, root);
  linkRepoNodeModulesIntoProject(root);
  linkRepoScriptsIntoProject(root);
  linkRepoTsconfigIntoProject(root);
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.3',
    storySlug: 'runtime-governance-stop-cross-stage',
    epicId: 'epic-15',
    runId: 'run-brief-prd-arch-stop',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    cleanup() {
      cleanupWithRetries(root);
    },
  };
}

function createWave2aTailFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-stop-worker-wave2a-tail-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  seedScoringSchemaFixture(repoRoot, root);
  linkRepoNodeModulesIntoProject(root);
  linkRepoScriptsIntoProject(root);
  linkRepoTsconfigIntoProject(root);
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'post_audit',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.3',
    storySlug: 'runtime-governance-stop-wave2a-tail',
    epicId: 'epic-15',
    runId: 'run-wave2a-tail-stop',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    cleanup() {
      cleanupWithRetries(root);
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
    sourceGateFailureIds: ['GF-BRIEF-200'],
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
    sourceGateFailureIds: ['GF-WAVE2A-TAIL-003'],
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

describe('governance stop hook cross-stage rerun queue', () => {
  it('drains queued rerun work and advances brief pass into the PRD gate when stop triggers the worker', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-stop-cross-stage'
      );
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-brief.md');
      const secondOutput = path.join(outDir, 'attempt-prd.md');

      const firstRun = await runGovernanceRemediation({
        ...crossStageBaseInput(fixture.root, firstOutput, 'attempt-stop-cross-stage-01'),
        rerunChain: briefToArchRerunChain(),
      });

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-stop-cross-stage-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-stop-cross-stage-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T04:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                ...crossStageBaseInput(fixture.root, secondOutput, 'attempt-stop-cross-stage-02'),
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

      const stopResult = stopHook.stop({
        projectRoot: fixture.root,
        waitForWorker: true,
      }) as GovernanceStopHookResult;

      waitForCurrentRunSettled(
        fixture.root,
        () =>
          existsSync(secondOutput) &&
          readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root).at(-1)?.type ===
            'governance-remediation-rerun'
      );

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

      expect(existsSync(stopResult.checkpointPath)).toBe(true);
      expect(stopResult.workerResult?.started).toBe(true);
      expect(stopResult.workerResult?.skipped).not.toBe(true);
      expect(stopResult.workerResult?.status).toBe(0);
      expect(existsSync(secondOutput)).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.claude-packet.md'))).toBe(true);
      expect(currentRun.at(-1)?.type).toBe('governance-remediation-rerun');
      expect(currentRun.at(-1)?.result?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Should Continue: yes',
          '- Executor Route: default-gate-remediation',
        ])
      );
      expect(readFileSync(secondOutput, 'utf8')).toContain('Rerun Gate: prd-contract-gate');
      expect(readFileSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'), 'utf8')).toContain(
        'Awaiting Rerun Gate: prd-contract-gate'
      );
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.status).toBe('awaiting_rerun');
      expect(loopStateRaw.rerunGate).toBe('prd-contract-gate');
      expect(loopStateRaw.capabilitySlot).toBe('prd.contract');
      expect(loopStateRaw.targetArtifacts).toEqual(['prd.md']);
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.gate).toBe('brief-gate');
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.status).toBe('pass');
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-stop-cross-stage-02');
    } finally {
      fixture.cleanup();
    }
  }, 60000);

  it('surfaces the human-review hold on workerResult after bmad_story_stage4 passes instead of forcing stop-hook consumers to infer it from current-run', async () => {
    const fixture = createWave2aTailFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-stop-wave2a-tail'
      );
      mkdirSync(outDir, { recursive: true });
      const readinessOutput = path.join(outDir, 'attempt-readiness.md');
      const implementOutput = path.join(outDir, 'attempt-implement.md');
      const postAuditOutput = path.join(outDir, 'attempt-post-audit.md');
      const prReviewOutput = path.join(outDir, 'attempt-pr-review.md');

      const firstRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, readinessOutput, 'attempt-stop-wave2a-tail-01'),
        rerunChain: wave2aMainlineRerunChain(),
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, implementOutput, 'attempt-stop-wave2a-tail-02'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'Readiness blockers are closed; move into implement audit.',
          updatedArtifacts: ['implementation-readiness-report.md'],
        },
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, postAuditOutput, 'attempt-stop-wave2a-tail-03'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'speckit_5_2',
          status: 'pass',
          summary: 'Implement-stage audit passed; move into post_audit.',
          updatedArtifacts: ['AUDIT_implement-E15-S3.md'],
        },
      });

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-stop-wave2a-tail-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-stop-wave2a-tail-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T06:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                ...wave2aTailBaseInput(
                  fixture.root,
                  prReviewOutput,
                  'attempt-stop-wave2a-tail-04'
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

      const stopResult = stopHook.stop({
        projectRoot: fixture.root,
        waitForWorker: true,
      }) as GovernanceStopHookResult;

      waitForCurrentRunSettled(
        fixture.root,
        () =>
          readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root).at(-1)?.result
            ?.stopReason === 'await human review'
      );

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as {
        status: string;
        lastStopReason: string | null;
        rerunGate: string;
      };
      const latestCurrentRun = currentRun.at(-1);

      expect(existsSync(stopResult.checkpointPath)).toBe(true);
      expect(stopResult.workerResult?.started).toBe(true);
      expect(stopResult.workerResult?.skipped).not.toBe(true);
      expect(stopResult.workerResult?.status).toBe(0);
      expect(stopResult.workerResult?.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(stopResult.workerResult?.remediationAuditTrace).toMatchObject({
        stopReason: 'await human review',
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(stopResult.workerResult?.remediationAuditTrace?.journeyContractHints).toEqual([]);
      expect(stopResult.workerResult?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(stopResult.workerResult?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
          '- Stop Reason: await human review',
          '- Journey Contract Signals: (none)',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Should Continue: no',
          '- Stop Reason: await human review',
          '- Routing Mode: generic',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining([
          '## Governance Latest Raw Event',
          '## Governance Remediation Runner Summary',
          '- Journey Contract Signals: (none)',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
        ])
      );
      expect(stopResult.workerResult?.shouldContinue).toBe(false);
      expect(stopResult.workerResult?.stopReason).toBe('await human review');
      expect(latestCurrentRun?.type).toBe('governance-remediation-rerun');
      expect(latestCurrentRun?.result?.shouldContinue).toBe(false);
      expect(latestCurrentRun?.result?.stopReason).toBe('await human review');
      expect(latestCurrentRun?.result?.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(latestCurrentRun?.result?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '- Stop Reason: await human review',
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
      expect(existsSync(prReviewOutput)).toBe(false);
      expect(loopStateRaw.status).toBe('stopped');
      expect(loopStateRaw.lastStopReason).toBe('await human review');
      expect(loopStateRaw.rerunGate).toBe('pr_review');
    } finally {
      fixture.cleanup();
    }
  }, 60000);
});
