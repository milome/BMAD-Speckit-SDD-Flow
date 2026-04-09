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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { governancePendingQueueFilePath } from '../../scripts/governance-runtime-queue';
import type { GovernanceStopHookResult } from '../../scripts/governance-hook-types';
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

afterEach(() => {
  vi.restoreAllMocks();
});

function waitBriefly(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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

function createFixtureProject(): {
  root: string;
  configPath: string;
  cleanup: () => void;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-stop-worker-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
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
    storyId: '14.2',
    storySlug: 'runtime-governance-stop',
    epicId: 'epic-14',
    runId: 'run-002',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-2',
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

describe('governance stop hook worker trigger', () => {
  it('drains pending governance rerun work on stop', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-stop');
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
        attemptId: 'attempt-stop-01',
        sourceGateFailureIds: ['GF-200'],
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

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-stop-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-stop-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T02:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              journeyContractHints: [
                {
                  signal: 'smoke_task_chain',
                  label: 'Smoke Task Chain',
                  count: 1,
                  affected_stages: ['tasks'],
                  epic_stories: ['E14.S2'],
                  recommendation:
                    'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
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
                attemptId: 'attempt-stop-02',
                sourceGateFailureIds: ['GF-200'],
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
                  blockerIds: ['IR-BLK-002'],
                  summary: 'Need another readiness remediation attempt.',
                  updatedArtifacts: ['implementation-readiness-report'],
                },
              },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const stopResult = stopHook.stop({
        projectRoot: fixture.root,
        waitForWorker: true,
      }) as GovernanceStopHookResult;

      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as { attemptCount: number; attempts: Array<{ attemptId: string }> };

      expect(existsSync(stopResult.checkpointPath)).toBe(true);
      expect(stopResult.workerResult?.started).toBe(true);
      expect(stopResult.workerResult?.skipped).not.toBe(true);
      expect(stopResult.workerResult?.status).toBe(0);
      expect(stopResult.workerResult?.journeyContractHints?.map((item) => item.signal)).toEqual([
        'smoke_task_chain',
      ]);
      expect(stopResult.workerResult).not.toHaveProperty('pendingJourneyContractHints');
      expect(stopResult.workerResult?.rerunDecision).toMatchObject({
        mode: 'targeted',
        signals: ['smoke_task_chain'],
        hintCount: 1,
      });
      expect(stopResult.workerResult?.rerunDecision?.reason).toContain('journey contract hints');
      expect(stopResult.workerResult?.executorRouting).toMatchObject({
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['smoke_task_chain'],
      });
      expect(stopResult.workerResult?.remediationAuditTrace).toMatchObject({
        stopReason: null,
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['smoke_task_chain'],
      });
      expect(
        stopResult.workerResult?.remediationAuditTrace?.journeyContractHints?.map((item) => item.signal)
      ).toEqual(['smoke_task_chain']);
      expect(stopResult.workerResult?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: targeted',
          'Executor Route: journey-contract-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: smoke_task_chain',
        ])
      );
      expect(stopResult.workerResult?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
          '- Stop Reason: (none)',
          '- Journey Contract Signals: smoke_task_chain',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
          '- Prioritized Signals: smoke_task_chain',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining([
          '## Governance Latest Raw Event',
          '## Governance Remediation Runner Summary',
          '- Journey Contract Signals: smoke_task_chain',
        ])
      );
      expect(stopResult.workerResult?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '## Governance Remediation Runner Summary',
        ])
      );
      expect(consoleLogSpy.mock.calls.flat()).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
          '- Stop Reason: (none)',
          '- Journey Contract Signals: smoke_task_chain',
        ])
      );
      expect(existsSync(secondOutput)).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-stop-02');
    } finally {
      fixture.cleanup();
    }
  }, 60000);

  it('normalizes handwritten readiness packets on stop even when no pending queue exists', () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'dev'
      );
      mkdirSync(outDir, { recursive: true });
      const artifactPath = path.join(
        outDir,
        'implementation-readiness-remediation-2026-04-09.md'
      );
      writeFileSync(
        artifactPath,
        [
          '# Governance Remediation Artifact',
          '',
          '## Core Fields',
          '- Capability Slot: qa.readiness',
          '- Canonical Agent: PM + QA / readiness reviewer',
          '- Target Artifact(s):',
          '- prd.md',
          '- architecture.md',
          '- epics.md',
          '- Rerun Gate: implementation-readiness',
          '',
          '## Executor Routing Trace',
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
          '- Packet Strategy: default-remediation-packet',
          '- Prioritized Signals: (none)',
          '- Routing Reason: generic routing',
        ].join('\n'),
        'utf8'
      );
      const cursorPacketPath = artifactPath.replace(/\.md$/i, '.cursor-packet.md');
      const claudePacketPath = artifactPath.replace(/\.md$/i, '.claude-packet.md');
      writeFileSync(cursorPacketPath, '# Cursor Packet - handwritten\n', 'utf8');
      writeFileSync(claudePacketPath, '# Claude Packet - handwritten\n', 'utf8');

      const stopResult = stopHook.stop({
        projectRoot: fixture.root,
        waitForWorker: true,
      }) as GovernanceStopHookResult;

      const cursorPacket = readFileSync(cursorPacketPath, 'utf8');
      const claudePacket = readFileSync(claudePacketPath, 'utf8');

      expect(existsSync(stopResult.checkpointPath)).toBe(true);
      expect(stopResult.workerResult?.skipped).toBe(true);
      expect(cursorPacket).toContain('# Governance Remediation Executor Packet');
      expect(claudePacket).toContain('# Governance Remediation Executor Packet');
      expect(
        cursorPacket
          .replace(/- Host Kind: .+/g, '- Host Kind: <host>')
          .replace(/- Execution Mode: .+/g, '- Execution Mode: <mode>')
      ).toBe(
        claudePacket
          .replace(/- Host Kind: .+/g, '- Host Kind: <host>')
          .replace(/- Execution Mode: .+/g, '- Execution Mode: <mode>')
      );
    } finally {
      fixture.cleanup();
    }
  });
});
