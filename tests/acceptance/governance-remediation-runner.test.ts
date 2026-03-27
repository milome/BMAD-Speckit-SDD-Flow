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
  createStubGovernanceProviderAdapter,
} from '../../scripts/governance-provider-adapter';
import {
  governanceAttemptLoopStatePath,
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-remediation-runner-'));
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
    updatedAt: '2026-03-27T00:00:00.000Z',
  });

  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function createProvider() {
  return createStubGovernanceProviderAdapter({
    source: 'model-provider',
    providerId: 'placeholder',
    providerMode: 'stub',
    confidence: 'medium',
    suggestedStage: 'plan',
    suggestedAction: 'patch',
    explicitRolePreference: ['critical-auditor'],
    researchPolicy: 'forbidden',
    delegationPreference: 'ask-me-first',
    constraints: ['minimal-patch'],
    rationale: 'Keep remediation bounded.',
    overrideAllowed: false,
  });
}

function baseInput(root: string, outputPath: string) {
  return {
    projectRoot: root,
    outputPath,
    promptText: '做 implementation readiness 修复，不要联网，最小修复。',
    stageContextKnown: true,
    gateFailureExists: true,
    blockerOwnershipLocked: true,
    rootTargetLocked: true,
    equivalentAdapterCount: 2,
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
    hostKind: 'codex' as const,
    providerAdapter: createProvider(),
    maxAttempts: 3,
  };
}

describe('governance remediation runner', () => {
  it('builds the first host-aware execution packet and persists loop state', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-x');
      mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'implementation-readiness-remediation-2026-03-27.md');

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, outFile),
        attemptId: 'attempt-runner-01',
      });

      const loopStateFile = governanceAttemptLoopStatePath(
        fixture.root,
        result.loopState.loopStateId
      );

      expect(existsSync(outFile)).toBe(true);
      expect(existsSync(loopStateFile)).toBe(true);
      expect(readFileSync(outFile, 'utf8')).toContain('## Model Hint Debug');
      expect(result.runtimeContext?.stage).toBe('plan');
      expect(result.runtimeRegistry?.activeScope.scopeType).toBe('project');
      expect(result.runtimePolicy?.triggerStage).toBeTruthy();
      expect(result.loopState.attemptCount).toBe(1);
      expect(result.loopState.status).toBe('awaiting_rerun');
      expect(result.currentAttemptNumber).toBe(1);
      expect(result.nextAttemptNumber).toBe(2);
      expect(result.shouldContinue).toBe(true);
      expect(result.rerunGateResultIngested).toBe(false);
      expect(result.executorPacket?.hostKind).toBe('codex');
      expect(result.executorPacket?.executionMode).toBe('codex-spawn-agent');
      expect(result.executorPacket?.prompt).toContain('Governance Remediation Task Packet');
      expect(result.executorPacket?.prompt).toContain('Do not change blocker ownership.');
      expect(result.executorPacket?.prompt).toContain('## Remediation Artifact');
    } finally {
      fixture.cleanup();
    }
  });

  it('ingests failed rerun gate results and schedules the next remediation attempt', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-y');
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-1.md');
      const secondOutput = path.join(outDir, 'attempt-2.md');

      await runGovernanceRemediation({
        ...baseInput(fixture.root, firstOutput),
        attemptId: 'attempt-runner-01',
      });

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, secondOutput),
        attemptId: 'attempt-runner-02',
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'fail',
          blockerIds: ['IR-BLK-001', 'IR-BLK-002'],
          summary: 'Critical journey still lacks runnable proof.',
          updatedArtifacts: ['implementation-readiness-report'],
        },
      });

      const persisted = readGovernanceAttemptLoopState(
        fixture.root,
        result.loopState.loopStateId
      );

      expect(existsSync(secondOutput)).toBe(true);
      expect(result.rerunGateResultIngested).toBe(true);
      expect(result.loopState.attemptCount).toBe(2);
      expect(result.loopState.status).toBe('awaiting_rerun');
      expect(result.currentAttemptNumber).toBe(2);
      expect(result.nextAttemptNumber).toBe(3);
      expect(result.shouldContinue).toBe(true);
      expect(result.executorPacket).not.toBeNull();
      expect(result.loopState.lastGateResult?.status).toBe('fail');
      expect(persisted.attempts[0]?.rerunGateResult?.summary).toContain('Critical journey');
      expect(persisted.attempts[1]?.attemptId).toBe('attempt-runner-02');
    } finally {
      fixture.cleanup();
    }
  });

  it('stops the loop when the rerun gate passes', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-z');
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-1.md');
      const passOutput = path.join(outDir, 'attempt-pass.md');

      await runGovernanceRemediation({
        ...baseInput(fixture.root, firstOutput),
        attemptId: 'attempt-runner-01',
      });

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, passOutput),
        attemptId: 'attempt-runner-pass',
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          summary: 'Readiness gate now passes.',
          updatedArtifacts: ['implementation-readiness-report'],
        },
      });

      expect(result.rerunGateResultIngested).toBe(true);
      expect(result.shouldContinue).toBe(false);
      expect(result.stopReason).toBe('rerun gate passed');
      expect(result.executorPacket).toBeNull();
      expect(result.loopState.status).toBe('completed');
      expect(result.loopState.attemptCount).toBe(1);
      expect(result.currentAttemptNumber).toBe(1);
      expect(result.nextAttemptNumber).toBeNull();
      expect(existsSync(passOutput)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it('stops the loop when max attempts is already exhausted after a failed rerun', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-max');
      mkdirSync(outDir, { recursive: true });
      const firstOutput = path.join(outDir, 'attempt-1.md');
      const blockedOutput = path.join(outDir, 'attempt-blocked.md');

      await runGovernanceRemediation({
        ...baseInput(fixture.root, firstOutput),
        attemptId: 'attempt-runner-01',
        maxAttempts: 1,
      });

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, blockedOutput),
        attemptId: 'attempt-runner-02',
        maxAttempts: 1,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'fail',
          blockerIds: ['IR-BLK-001'],
          summary: 'Blocker is still open after the only allowed attempt.',
        },
      });

      expect(result.rerunGateResultIngested).toBe(true);
      expect(result.shouldContinue).toBe(false);
      expect(result.stopReason).toContain('max attempts reached');
      expect(result.executorPacket).toBeNull();
      expect(result.loopState.status).toBe('stopped');
      expect(result.loopState.attemptCount).toBe(1);
      expect(result.currentAttemptNumber).toBe(1);
      expect(result.nextAttemptNumber).toBeNull();
      expect(existsSync(blockedOutput)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
