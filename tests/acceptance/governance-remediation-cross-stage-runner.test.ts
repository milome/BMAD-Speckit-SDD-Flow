import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStubGovernanceProviderAdapter } from '../../scripts/governance-provider-adapter';
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-remediation-cross-stage-'));
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const registry = defaultRuntimeContextRegistry(root);
  writeRuntimeContextRegistry(root, registry);
  writeRuntimeContext(root, {
    version: 1,
    flow: 'story',
    stage: 'plan',
    contextScope: 'story',
    sourceMode: 'full_bmad',
    storyId: '15.1',
    storySlug: 'cross-stage-governance',
    epicId: 'epic-15',
    runId: 'run-brief-prd-arch',
    artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15-1',
    updatedAt: '2026-03-28T00:00:00.000Z',
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
    recommendedSkillChain: ['speckit-workflow'],
    recommendedSubagentRoles: ['code-reviewer'],
    researchPolicy: 'forbidden',
    delegationPreference: 'ask-me-first',
    constraints: ['minimal-patch'],
    rationale: 'Keep cross-stage remediation bounded.',
    overrideAllowed: false,
  });
}

function crossStageBaseInput(root: string, outputPath: string) {
  return {
    projectRoot: root,
    outputPath,
    promptText: '继续 brief -> prd -> arch blocker 修复，不要联网，最小修复。',
    stageContextKnown: true,
    gateFailureExists: true,
    blockerOwnershipLocked: true,
    rootTargetLocked: true,
    equivalentAdapterCount: 2,
    sourceGateFailureIds: ['GF-BRIEF-001'],
    capabilitySlot: 'brief.challenge',
    canonicalAgent: 'PM + Critical Auditor',
    actualExecutor: 'brief contract workflow',
    adapterPath: 'local workflow fallback',
    targetArtifacts: ['product-brief.md'],
    expectedDelta: 'close brief contract blockers',
    rerunOwner: 'PM',
    rerunGate: 'brief-gate',
    outcome: 'blocked',
    hostKind: 'codex' as const,
    providerAdapter: createProvider(),
    maxAttempts: 5,
  };
}

describe('governance remediation runner cross-stage gate progression', () => {
  it('advances brief -> prd -> architecture rerun targets and only completes after the final gate passes', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-cross-stage-chain'
      );
      mkdirSync(outDir, { recursive: true });

      const attempt1 = path.join(outDir, 'attempt-brief.md');
      const attempt2 = path.join(outDir, 'attempt-prd.md');
      const attempt3 = path.join(outDir, 'attempt-architecture.md');
      const finalPassOutput = path.join(outDir, 'attempt-final-pass.md');

      const chainInput = {
        ...crossStageBaseInput(fixture.root, attempt1),
        attemptId: 'attempt-cross-stage-01',
        rerunChain: [
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
        ],
      } as any;

      const firstRun = await runGovernanceRemediation(chainInput);
      expect(existsSync(attempt1)).toBe(true);
      expect(firstRun.loopState.rerunGate).toBe('brief-gate');
      expect(firstRun.loopState.capabilitySlot).toBe('brief.challenge');

      const prdRun = await runGovernanceRemediation({
        ...crossStageBaseInput(fixture.root, attempt2),
        attemptId: 'attempt-cross-stage-02',
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'brief-gate',
          status: 'pass',
          summary: 'Brief gate now passes and handoff should move to PRD.',
          updatedArtifacts: ['product-brief.md'],
        },
      } as any);

      expect(prdRun.rerunGateResultIngested).toBe(true);
      expect(prdRun.shouldContinue).toBe(true);
      expect(prdRun.stopReason).toBeNull();
      expect(existsSync(attempt2)).toBe(true);
      expect(prdRun.loopState.status).toBe('awaiting_rerun');
      expect(prdRun.loopState.rerunGate).toBe('prd-contract-gate');
      expect(prdRun.loopState.capabilitySlot).toBe('prd.contract');
      expect(prdRun.loopState.canonicalAgent).toBe('PM + Critical Auditor');
      expect(prdRun.loopState.targetArtifacts).toEqual(['prd.md']);
      expect(prdRun.loopState.executorRouting).toEqual({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
        prioritizedSignals: [],
        packetStrategy: 'default-remediation-packet',
        reason: 'no journey contract hints detected; use the default gate remediation route',
      });
      expect(prdRun.loopState.remediationAuditTraceSummaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(prdRun.loopState.attempts[1]?.remediationAuditTraceSummaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: (none)',
        ])
      );
      expect(prdRun.executorPacket?.prompt).toContain('Awaiting Rerun Gate: prd-contract-gate');
      expect(readFileSync(attempt2, 'utf8')).toContain('Rerun Gate: prd-contract-gate');

      const architectureRun = await runGovernanceRemediation({
        ...crossStageBaseInput(fixture.root, attempt3),
        attemptId: 'attempt-cross-stage-03',
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'prd-contract-gate',
          status: 'pass',
          summary: 'PRD contract gate now passes and handoff should move to architecture.',
          updatedArtifacts: ['prd.md'],
        },
      } as any);

      expect(architectureRun.rerunGateResultIngested).toBe(true);
      expect(architectureRun.shouldContinue).toBe(true);
      expect(architectureRun.stopReason).toBeNull();
      expect(existsSync(attempt3)).toBe(true);
      expect(architectureRun.loopState.rerunGate).toBe('architecture-contract-gate');
      expect(architectureRun.loopState.capabilitySlot).toBe('architecture.contract');
      expect(architectureRun.loopState.canonicalAgent).toBe('Architect + Critical Auditor');
      expect(architectureRun.loopState.targetArtifacts).toEqual(['architecture.md']);
      expect(architectureRun.executorPacket?.prompt).toContain(
        'Awaiting Rerun Gate: architecture-contract-gate'
      );
      expect(readFileSync(attempt3, 'utf8')).toContain('Rerun Gate: architecture-contract-gate');

      const finalPass = await runGovernanceRemediation({
        ...crossStageBaseInput(fixture.root, finalPassOutput),
        attemptId: 'attempt-cross-stage-04',
        loopStateId: firstRun.loopState.loopStateId,
        rerunGateResult: {
          gate: 'architecture-contract-gate',
          status: 'pass',
          summary: 'Architecture contract gate now passes.',
          updatedArtifacts: ['architecture.md'],
        },
      } as any);

      const persisted = readGovernanceAttemptLoopState(
        fixture.root,
        firstRun.loopState.loopStateId
      );

      expect(finalPass.rerunGateResultIngested).toBe(true);
      expect(finalPass.shouldContinue).toBe(false);
      expect(finalPass.stopReason).toBe('rerun gate passed');
      expect(finalPass.executorPacket).toBeNull();
      expect(finalPass.loopState.status).toBe('completed');
      expect(finalPass.loopState.attemptCount).toBe(3);
      expect(existsSync(finalPassOutput)).toBe(false);
      expect(persisted.attempts[0]?.rerunGateResult?.gate).toBe('brief-gate');
      expect(persisted.attempts[1]?.rerunGateResult?.gate).toBe('prd-contract-gate');
      expect(persisted.lastGateResult?.gate).toBe('architecture-contract-gate');
      expect(persisted.lastGateResult?.status).toBe('pass');
      expect(persisted.remediationAuditTraceSummaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: generic',
          'Executor Route: default-gate-remediation',
          'Stop Reason: rerun gate passed',
          'Journey Contract Signals: (none)',
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });
});
