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
  governanceCurrentRunPath,
} from '../../scripts/governance-runtime-queue';
import type {
  GovernanceExecutionResult,
  GovernancePostToolUseResult,
} from '../../scripts/governance-hook-types';
import {
  governanceAttemptLoopStatePath,
  runGovernanceRemediation,
} from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  linkRepoNodeModulesIntoProject,
  linkRepoScriptsIntoProject,
} from '../helpers/runtime-registry-fixture';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

const require = createRequire(import.meta.url);
const claudeHook = require('../../_bmad/claude/hooks/post-tool-use.cjs');
const runtimeWorkerHelper = require('../../_bmad/runtime/hooks/run-bmad-runtime-worker.cjs');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 30000,
  intervalMs = 200
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for detached governance worker`);
}

async function waitForWorkerSettled(
  projectRoot: string,
  predicate: () => boolean,
  timeoutMs = 30000,
  intervalMs = 200
): Promise<void> {
  const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(projectRoot) as string;
  await waitFor(() => predicate(), timeoutMs, intervalMs);
  await waitFor(() => !existsSync(lockPath), timeoutMs, intervalMs).catch(() => {});
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

function seedScoringSchemaFixture(root: string): void {
  cpSync(
    path.join(process.cwd(), 'packages', 'scoring', 'schema'),
    path.join(root, 'packages', 'scoring', 'schema'),
    { recursive: true }
  );
}

function createFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => Promise<void>;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-bg-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  seedScoringSchemaFixture(root);
  linkRepoNodeModulesIntoProject(root);
  linkRepoScriptsIntoProject(root);
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '14.3',
    storySlug: 'runtime-governance-background',
    epicId: 'epic-14',
    runId: 'run-003',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    async cleanup() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 9) {
            throw error;
          }
          await sleep(200); // Increased from 100ms for Windows file locking
        }
      }
    },
  };
}

function createWave2aTailFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => Promise<void>;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-bg-wave2a-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  seedScoringSchemaFixture(root);
  linkRepoNodeModulesIntoProject(root);
  linkRepoScriptsIntoProject(root);
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'post_impl',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.3',
    storySlug: 'runtime-governance-background-wave2a',
    epicId: 'epic-15',
    runId: 'run-wave2a-tail-background',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-3',
    updatedAt: '2026-03-28T00:00:00.000Z',
  });

  return {
    root,
    configPath: writeGovernanceConfig(root),
    async cleanup() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 9) {
            throw error;
          }
          await sleep(200); // Increased from 100ms for Windows file locking
        }
      }
    },
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
    sourceGateFailureIds: ['GF-WAVE2A-TAIL-BG-001'],
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

describe('governance post-tool-use detached background worker', () => {
  it('auto-drains the governance queue without waiting for stop', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-background'
      );
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-1.md');
      const secondOutput = path.join(outDir, 'attempt-2.md');

      const firstRun = await runGovernanceRemediation({
        projectRoot: fixture.root,
        outputPath: firstOutput,
        promptText: '做 implementation readiness 修复，不要联网，最小修复。',
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
        attemptId: 'attempt-background-01',
        sourceGateFailureIds: ['GF-300'],
        capabilitySlot: 'qa.readiness',
        canonicalAgent: 'PM + QA / readiness reviewer',
        actualExecutor: 'implementation readiness workflow',
        adapterPath: 'local workflow fallback',
        targetArtifacts: ['prd.md', 'architecture.md'],
        expectedDelta: 'close readiness blockers',
        rerunOwner: 'PM',
        rerunGate: 'implementation-readiness',
        outcome: 'blocked',
        hostKind: 'cursor',
      });

      const hookResult = claudeHook.postToolUse({
        type: 'governance-rerun-result',
        payload: {
          projectRoot: fixture.root,
          configPath: fixture.configPath,
          journeyContractHints: [
            {
              signal: 'closure_task_id',
              label: 'Closure Task',
              count: 1,
              affected_stages: ['tasks'],
              epic_stories: ['E14.S3'],
              recommendation:
                'Add one closure note task for each Journey Slice and link it to the same smoke path evidence chain.',
            },
          ],
          runnerInput: {
            projectRoot: fixture.root,
            outputPath: secondOutput,
            promptText: '继续 implementation readiness 修复，不要联网。',
            stageContextKnown: true,
            gateFailureExists: true,
            blockerOwnershipLocked: true,
            rootTargetLocked: true,
            equivalentAdapterCount: 1,
            attemptId: 'attempt-background-02',
            sourceGateFailureIds: ['GF-300'],
            capabilitySlot: 'qa.readiness',
            canonicalAgent: 'PM + QA / readiness reviewer',
            actualExecutor: 'implementation readiness workflow',
            adapterPath: 'local workflow fallback',
            targetArtifacts: ['prd.md', 'architecture.md'],
            expectedDelta: 'close readiness blockers',
            rerunOwner: 'PM',
            rerunGate: 'implementation-readiness',
            outcome: 'blocked',
            hostKind: 'cursor',
            loopStateId: firstRun.loopState.loopStateId,
            rerunGateResult: {
              gate: 'implementation-readiness',
              status: 'fail',
              blockerIds: ['IR-BLK-003'],
              summary: 'Need detached background remediation rerun.',
              updatedArtifacts: ['implementation-readiness-report'],
            },
          },
        },
      }) as GovernancePostToolUseResult;

      expect(hookResult?.backgroundTrigger?.started).toBe(true);
      expect(hookResult?.backgroundTrigger?.wait).toBe(false);
      expect(hookResult?.backgroundTrigger?.rerunDecision).toMatchObject({
        mode: 'targeted',
        signals: ['closure_task_id'],
        hintCount: 1,
      });
      expect(hookResult?.backgroundTrigger?.executorRouting).toMatchObject({
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['closure_task_id'],
      });
      expect(
        hookResult?.backgroundTrigger?.governancePresentation?.structuredMetadataLines
      ).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
        ])
      );
      expect(hookResult?.backgroundTrigger?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining(['## Governance Latest Raw Event', '暂无 governance raw event 摘要'])
      );
      expect(
        hookResult?.backgroundTrigger?.journeyContractHints?.map((item) => item.signal)
      ).toEqual(['closure_task_id']);
      expect(hookResult?.backgroundTrigger?.stopReason).toBeNull();
      expect(hookResult?.backgroundTrigger).not.toHaveProperty('pendingJourneyContractHints');

      await waitForWorkerSettled(
        fixture.root,
        () => {
          if (!existsSync(secondOutput) || !existsSync(governanceCurrentRunPath(fixture.root))) {
            return false;
          }
          const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
          const latest = currentRun.at(-1);
          return (
            latest?.type === 'governance-remediation-rerun' &&
            latest?.result?.artifactPath === secondOutput
          );
        }
      );

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as { attemptCount: number; attempts: Array<{ attemptId: string }> };

      expect(existsSync(secondOutput)).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.claude-packet.md'))).toBe(true);
      expect(currentRun.at(-1)?.type).toBe('governance-remediation-rerun');
      expect(currentRun.at(-1)?.result?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
        ])
      );
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-background-02');
    } finally {
      const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(fixture.root) as string;
      await waitFor(() => !existsSync(lockPath), 15000, 200);
      await fixture.cleanup();
    }
  }, 60000);

  it('preserves the Wave 2A human-review hold through the detached background worker path on Windows-style hook hosts', async () => {
    const fixture = createWave2aTailFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-background-wave2a'
      );
      mkdirSync(outDir, { recursive: true });
      const readinessOutput = path.join(outDir, 'attempt-readiness.md');
      const implementOutput = path.join(outDir, 'attempt-implement.md');
      const postAuditOutput = path.join(outDir, 'attempt-post-audit.md');
      const prReviewOutput = path.join(outDir, 'attempt-pr-review.md');

      const firstRun = await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, readinessOutput, 'attempt-background-wave2a-01'),
        rerunChain: wave2aMainlineRerunChain(),
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, implementOutput, 'attempt-background-wave2a-02'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'Readiness blockers are closed; move into implement audit.',
          updatedArtifacts: ['implementation-readiness-report.md'],
        },
      });

      await runGovernanceRemediation({
        ...wave2aTailBaseInput(fixture.root, postAuditOutput, 'attempt-background-wave2a-03'),
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'speckit_5_2',
          status: 'pass',
          summary: 'Implement-stage audit passed; move into post_audit.',
          updatedArtifacts: ['AUDIT_implement-E15-S3.md'],
        },
      });

      const hookResult = claudeHook.postToolUse({
        type: 'governance-rerun-result',
        payload: {
          projectRoot: fixture.root,
          configPath: fixture.configPath,
          runnerInput: {
            ...wave2aTailBaseInput(fixture.root, prReviewOutput, 'attempt-background-wave2a-04'),
            loopStateId: firstRun.loopState.loopStateId,
            rerunGateResult: {
              gate: 'bmad_story_stage4',
              status: 'pass',
              summary: 'Post-audit passed; the next step must wait for explicit human PR review.',
              updatedArtifacts: ['AUDIT_Story_15-3_stage4.md'],
            },
          },
        },
      }) as GovernancePostToolUseResult;

      expect(hookResult?.backgroundTrigger?.started).toBe(true);
      expect(hookResult?.backgroundTrigger?.wait).toBe(false);
      expect(hookResult?.backgroundTrigger?.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
      });
      expect(
        hookResult?.backgroundTrigger?.governancePresentation?.structuredMetadataLines
      ).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
        ])
      );
      expect(hookResult?.backgroundTrigger?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining(['## Governance Latest Raw Event', '暂无 governance raw event 摘要'])
      );

      await waitForWorkerSettled(
        fixture.root,
        () => {
          if (!existsSync(governanceCurrentRunPath(fixture.root))) {
            return false;
          }
          const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
          const latest = currentRun.at(-1);
          return latest?.result?.stopReason === 'await human review';
        }
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
      expect(existsSync(prReviewOutput)).toBe(false);
      expect(loopStateRaw.status).toBe('stopped');
      expect(loopStateRaw.lastStopReason).toBe('await human review');
      expect(loopStateRaw.rerunGate).toBe('pr_review');
    } finally {
      const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(fixture.root) as string;
      await waitFor(() => !existsSync(lockPath), 15000, 200).catch(() => {});
      await fixture.cleanup();
    }
  }, 60000);
});
