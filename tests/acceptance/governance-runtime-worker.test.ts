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
  governanceCurrentRunPath,
  governancePendingQueueFilePath,
} from '../../scripts/governance-runtime-queue';
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runtime-worker-'));
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

describe('governance runtime worker', () => {
  it('drains governance rerun queue items and launches the next remediation attempt', async () => {
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
            timestamp: '2026-03-28T01:00:00.000Z',
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
          },
          null,
          2
        ),
        'utf8'
      );

      await processQueue(fixture.root);

      const currentRun = JSON.parse(readFileSync(governanceCurrentRunPath(fixture.root), 'utf8')) as Array<{
        type: string;
        result?: { artifactPath?: string; packetPaths?: Record<string, string> };
      }>;
      const loopStateRaw = JSON.parse(
        readFileSync(
          governanceAttemptLoopStatePath(fixture.root, firstRun.loopState.loopStateId),
          'utf8'
        )
      ) as { attemptCount: number; attempts: Array<{ attemptId: string; rerunGateResult?: { status: string } }> };

      expect(existsSync(secondOutput)).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);
      expect(existsSync(secondOutput.replace(/\.md$/i, '.claude-packet.md'))).toBe(true);
      expect(currentRun.at(-1)?.type).toBe('governance-remediation-rerun');
      expect(currentRun.at(-1)?.result?.artifactPath).toBe(secondOutput);
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.status).toBe('fail');
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-runner-02');
      expect(readFileSync(secondOutput, 'utf8')).toContain('Outcome: blocked');
    } finally {
      fixture.cleanup();
    }
  });
});
