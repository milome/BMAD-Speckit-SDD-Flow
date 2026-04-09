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
import {
  governancePendingQueueFilePath,
  readGovernanceCurrentRun,
  type GovernanceRuntimeQueueItem,
} from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';
import { listGovernancePacketExecutionRecords } from '../../scripts/governance-packet-execution-store';
import { runGovernanceRemediation } from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

function createFixtureProject(): { root: string; configPath: string; cleanup: () => void } {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runtime-worker-exec-record-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '14.1',
    storySlug: 'runtime-governance',
    epicId: 'epic-14',
    runId: 'run-001',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14-1',
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
      '  - claude',
      'provider:',
      '  mode: stub',
      '  id: readiness-governance-stub',
      'execution:',
      '  enabled: true',
      '  authoritativeHost: cursor',
      '  fallbackHosts:',
      '    - claude',
      '  dispatch:',
      '    leaseTimeoutSeconds: 900',
      '    heartbeatIntervalSeconds: 60',
      '    maxDispatchAttempts: 3',
      '  execution:',
      '    timeoutMinutes: 30',
      '    maxExecutionAttempts: 2',
      '  rerunGate:',
      '    required: true',
      '    autoSchedule: true',
      '    maxGateRetries: 2',
      '  escalation:',
      '    afterDispatchFailures: 3',
      '    afterExecutionFailures: 2',
      '    afterGateFailures: 2',
      '  projections:',
      '    emitNonAuthoritativePackets: true',
      '    archivePath: _bmad-output/runtime/governance/archive',
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

describe('governance runtime worker execution record', () => {
  it('creates an execution record alongside packets and projects it into current-run', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-worker');
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
        attemptId: 'attempt-runner-01',
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

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-item-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-item-01',
            type: 'governance-remediation-rerun',
            timestamp: '2026-04-09T01:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                projectRoot: fixture.root,
                outputPath: secondOutput,
                promptText: '继续 implementation readiness patch。',
                stageContextKnown: true,
                gateFailureExists: true,
                blockerOwnershipLocked: true,
                rootTargetLocked: true,
                equivalentAdapterCount: 1,
                attemptId: 'attempt-runner-02',
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
                  summary: 'Still missing readiness proof.',
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
      const records = listGovernancePacketExecutionRecords(fixture.root).filter(
        (record) => record.loopStateId === firstRun.loopState.loopStateId
      );
      expect(records).toHaveLength(1);
      expect(records[0]?.packetPaths.cursor).toContain('.cursor-packet.md');
      expect(records[0]?.status).toBe('running');

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const latest = currentRun.at(-1)?.result;
      expect(latest?.artifactPath).toBe(secondOutput);
      expect(latest?.executionProjection?.executionId).toBe(records[0]?.executionId);
      expect(latest?.executionProjection?.executionStatus).toBe('running');
    } finally {
      fixture.cleanup();
    }
  });
});
