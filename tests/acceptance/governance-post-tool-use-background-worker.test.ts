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
  governanceCurrentRunPath,
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

const require = createRequire(import.meta.url);
const claudeHook = require('../../_bmad/claude/hooks/post-tool-use.js');
const runtimeWorkerHelper = require('../../_bmad/runtime/hooks/run-bmad-runtime-worker.js');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 15000, intervalMs = 200): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for detached governance worker`);
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
  cleanup: () => Promise<void>;
} {
  const repoRoot = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-bg-'));
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
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 4) {
            throw error;
          }
          await sleep(100);
        }
      }
    },
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
      }) as {
        backgroundTrigger?: { started?: boolean; wait?: boolean; pid?: number };
      };

      expect(hookResult?.backgroundTrigger?.started).toBe(true);
      expect(hookResult?.backgroundTrigger?.wait).toBe(false);

      await waitFor(() => existsSync(secondOutput));

      const currentRun = JSON.parse(readFileSync(governanceCurrentRunPath(fixture.root), 'utf8')) as Array<{
        type: string;
      }>;
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
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-background-02');
    } finally {
      const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(fixture.root) as string;
      await waitFor(() => !existsSync(lockPath), 15000, 200);
      await fixture.cleanup();
    }
  });
});
