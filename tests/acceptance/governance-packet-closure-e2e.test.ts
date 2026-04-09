import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { ingestGovernanceExecutionResult, ingestGovernanceRerunGateResult } from '../../scripts/governance-execution-result-ingestor';
import {
  governancePendingQueueFilePath,
  readGovernanceCurrentRun,
  type GovernanceRuntimeQueueItem,
} from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';
import { readGovernancePacketExecutionRecord } from '../../scripts/governance-packet-execution-store';
import { runGovernanceRemediation } from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import { defaultRuntimeContextRegistry, writeRuntimeContextRegistry } from '../../scripts/runtime-context-registry';

function createFixtureProject(): { root: string; configPath: string; cleanup: () => void } {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-packet-closure-e2e-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '14.3',
    storySlug: 'runtime-governance-closure-e2e',
    epicId: 'epic-14',
    runId: 'run-closure-e2e-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-3',
    updatedAt: '2026-04-09T00:00:00.000Z',
  });

  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    [
      'version: 2',
      'primaryHost: cursor',
      'packetHosts:',
      '  - cursor',
      'provider:',
      '  mode: stub',
      '  id: readiness-governance-stub',
      'execution:',
      '  enabled: true',
      '  authoritativeHost: cursor',
      '  fallbackHosts: []',
    ].join('\n'),
    'utf8'
  );

  return {
    root,
    configPath,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe('governance packet closure end-to-end', () => {
  it('moves from worker output to gate_passed through execution and rerun-gate ingestion', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-closure-e2e');
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
        attemptId: 'attempt-closure-e2e-01',
        sourceGateFailureIds: ['GF-100'],
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

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-closure-e2e-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-closure-e2e-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-04-09T01:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                projectRoot: fixture.root,
                outputPath: secondOutput,
                promptText: '继续 implementation readiness 修复，不要联网。',
                stageContextKnown: true,
                gateFailureExists: true,
                blockerOwnershipLocked: true,
                rootTargetLocked: true,
                equivalentAdapterCount: 1,
                attemptId: 'attempt-closure-e2e-02',
                sourceGateFailureIds: ['GF-100'],
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
                  blockerIds: ['IR-BLK-001'],
                  summary: 'Need one more attempt.',
                  updatedArtifacts: ['implementation-readiness-report'],
                },
              },
            },
          } satisfies GovernanceRuntimeQueueItem,
          null,
          2
        ),
        'utf8'
      );

      await processQueue(fixture.root);

      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      const runningRecord = readGovernancePacketExecutionRecord(
        fixture.root,
        firstRun.loopState.loopStateId,
        2
      );
      expect(runningRecord?.status).toBe('running');

      const awaiting = ingestGovernanceExecutionResult(fixture.root, {
        loopStateId: firstRun.loopState.loopStateId,
        attemptNumber: 2,
        result: {
          outcome: 'completed',
          observedAt: '2026-04-09T02:00:00.000Z',
          externalRunId: 'placeholder-run',
        },
      });
      expect(awaiting.status).toBe('awaiting_rerun_gate');

      const passed = ingestGovernanceRerunGateResult(fixture.root, {
        loopStateId: firstRun.loopState.loopStateId,
        attemptNumber: 2,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'all blockers resolved',
          observedAt: '2026-04-09T02:10:00.000Z',
        },
      });

      expect(passed?.status).toBe('gate_passed');
      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      expect(currentRun.at(-1)?.result?.executionProjection?.executionId).toBeTruthy();
      expect(currentRun.at(-1)?.result?.artifactPath).toBe(secondOutput);
    } finally {
      fixture.cleanup();
    }
  });
});
