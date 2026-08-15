import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  canonicalJson,
  sha256,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import { runStandaloneGoalAuthoringJudge } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-authoring-judge';
import { materializeStandaloneGoalJudgeHttpFixture } from '../helpers/standalone-goal-judge-http-fixture';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function candidate() {
  const semanticPayload = {
    obligations: [{ obligationId: 'MUST-001', text: 'Implement export.' }],
    atoms: [{ id: 'ATOM-001', requirementRef: 'MUST-001' }],
    logicalSpecSpans: [{ specSpanId: 'SPAN-001', boundObligationIds: ['MUST-001'] }],
    executionConstraints: [{ constraintId: 'CMD-001', kind: 'CMD' }],
    architecture: {
      architectureDecisions: [{ decisionId: 'ARCH-001', decisionType: 'isolation' }],
    },
  };
  const standaloneGoalSemanticIRHash = sha256Stable({
    sourcePlanHash: hash('1'),
    semanticPayload,
  });
  return {
    schemaVersion: 'StandaloneGoalSemanticIR/v1' as const,
    sourcePlanHash: hash('1'),
    semanticPayload,
    standaloneGoalSemanticIRHash,
  };
}

function normalizedResponse(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'requirements-contract-normalized-judge-response/v1',
    providerRef: 'test-goal-judge',
    transport: 'openai-compatible',
    configuredModel: 'test-model',
    returnedModel: 'test-model',
    decision: 'pass',
    findings: [],
    challengeRequests: [],
    evidenceRefs: ['ARCH-001', 'ATOM-001', 'CMD-001', 'MUST-001', 'SPAN-001'],
    providerRequestId: 'request-1',
    requestHash: hash('8'),
    responseHash: hash('9'),
    ...overrides,
  };
}

function dependencies(response: Record<string, unknown>) {
  const invoke = vi.fn(async () => response);
  const prepareInvocation = vi.fn(async () => ({
    configPath: '_bmad/_config/governance-remediation.yaml',
    judgeRuntime: {},
    providerRef: 'test-goal-judge',
    provider: {
      transport: 'openai-compatible',
      apiStyle: 'responses',
      model: 'test-model',
      requestPolicy: {},
    },
    providerRegistryHash: hash('7'),
    credentialProviderRef: 'test-goal-judge',
    credentialRevision: 1,
    invoke,
  }));
  return { invoke, prepareInvocation };
}

describe('standalone Goal authoring Judge', () => {
  it('uses the production provider resolver and HTTP adapter exactly once', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-http-'));
    const judge = await materializeStandaloneGoalJudgeHttpFixture(root);
    try {
      const input = {
        projectRoot: root,
        authorityRoot: path.join(root, 'goal-run'),
        standaloneGoalSemanticIr: candidate(),
      };
      const first = await runStandaloneGoalAuthoringJudge(input);
      const replay = await runStandaloneGoalAuthoringJudge(input);

      expect(first.goalJudgeDispatchCount).toBe(1);
      expect(replay.goalJudgeDispatchCount).toBe(0);
      expect(judge.requests).toBe(1);
    } finally {
      await judge.close();
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('dispatches one real provider request and reuses the accepted candidate with zero calls or writes', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-pass-'));
    const deps = dependencies(normalizedResponse());
    try {
      const input = {
        projectRoot: root,
        authorityRoot: path.join(root, 'goal-run'),
        standaloneGoalSemanticIr: candidate(),
      };
      const first = await runStandaloneGoalAuthoringJudge(input, deps);
      const second = await runStandaloneGoalAuthoringJudge(input, deps);

      expect(deps.prepareInvocation).toHaveBeenCalledTimes(1);
      expect(deps.invoke).toHaveBeenCalledTimes(1);
      expect(deps.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            role: 'goal_full',
            candidateHash: input.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
            requiredCoverageRefs: ['ARCH-001', 'ATOM-001', 'CMD-001', 'MUST-001', 'SPAN-001'],
          }),
        })
      );
      expect(first.goalJudgeDispatchCount).toBe(1);
      expect(first.writeCount).toBeGreaterThan(0);
      expect(second).toMatchObject({
        goalJudgeDispatchCount: 0,
        publicationStatus: 'reused',
        writeCount: 0,
      });
      expect(first.authoringEffectivePass).toMatchObject({
        schemaVersion: 'StandaloneGoalAuthoringEffectivePass/v1',
        standaloneGoalSemanticIRHash: input.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash,
        authoringJudgeAggregateHash: first.aggregate.authoringJudgeAggregateHash,
        decision: 'pass',
      });
      for (const ref of Object.values(first.refs)) {
        expect(existsSync(ref.path)).toBe(true);
      }
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('rebuilds EffectivePass from an accepted aggregate without redispatching', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-pass-resume-'));
    const deps = dependencies(normalizedResponse());
    try {
      const input = {
        projectRoot: root,
        authorityRoot: path.join(root, 'goal-run'),
        standaloneGoalSemanticIr: candidate(),
      };
      const first = await runStandaloneGoalAuthoringJudge(input, deps);
      rmSync(first.refs.effectivePassRef.path);

      const resumed = await runStandaloneGoalAuthoringJudge(input, deps);

      expect(deps.invoke).toHaveBeenCalledTimes(1);
      expect(resumed).toMatchObject({
        goalJudgeDispatchCount: 0,
        publicationStatus: 'published',
        writeCount: 1,
      });
      expect(existsSync(resumed.refs.effectivePassRef.path)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('rejects provider lineage mismatch before publishing an aggregate', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-provider-'));
    const deps = dependencies(normalizedResponse({ providerRef: 'different-provider' }));
    try {
      await expect(
        runStandaloneGoalAuthoringJudge(
          {
            projectRoot: root,
            authorityRoot: path.join(root, 'goal-run'),
            standaloneGoalSemanticIr: candidate(),
          },
          deps
        )
      ).rejects.toThrow('standalone_goal_authoring_judge_provider_lineage_mismatch');
      expect(deps.invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('validates the persisted provider selection against the canonical schema', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-selection-'));
    const deps = dependencies(normalizedResponse());
    try {
      const input = {
        projectRoot: root,
        authorityRoot: path.join(root, 'goal-run'),
        standaloneGoalSemanticIr: candidate(),
      };
      const first = await runStandaloneGoalAuthoringJudge(input, deps);
      rmSync(first.refs.aggregateRef.path);
      rmSync(first.refs.effectivePassRef.path);
      const selection = JSON.parse(readFileSync(first.refs.providerSelectionRef.path, 'utf8'));
      delete selection.providerConfigurationHash;
      delete selection.providerSelectionHash;
      selection.providerSelectionHash = sha256(
        `providerSelectionHash/v1\n${canonicalJson(selection)}`
      );
      writeFileSync(first.refs.providerSelectionRef.path, `${canonicalJson(selection)}\n`, 'utf8');

      await expect(runStandaloneGoalAuthoringJudge(input, deps)).rejects.toThrow(
        'requirements_schema_invalid'
      );
      expect(deps.invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('persists an accepted block as terminal and never creates EffectivePass or redispatches', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-block-'));
    const deps = dependencies(
      normalizedResponse({
        decision: 'block',
        findings: [
          {
            findingId: 'GOAL-FINDING-001',
            category: 'semantic_gap',
            message: 'The completion oracle is ambiguous.',
            evidenceRefs: ['MUST-001'],
          },
        ],
      })
    );
    const input = {
      projectRoot: root,
      authorityRoot: path.join(root, 'goal-run'),
      standaloneGoalSemanticIr: candidate(),
    };
    try {
      await expect(runStandaloneGoalAuthoringJudge(input, deps)).rejects.toMatchObject({
        message: 'standalone_goal_successor_required:authoring_judge',
        goalJudgeDispatchCount: 1,
      });
      await expect(runStandaloneGoalAuthoringJudge(input, deps)).rejects.toMatchObject({
        message: 'standalone_goal_successor_required:authoring_judge',
        goalJudgeDispatchCount: 0,
      });

      expect(deps.invoke).toHaveBeenCalledTimes(1);
      const judgeRoot = path.join(
        input.authorityRoot,
        'goal',
        'standalone-semantic',
        input.standaloneGoalSemanticIr.standaloneGoalSemanticIRHash.slice(7),
        'authoring-judge'
      );
      expect(existsSync(path.join(judgeRoot, 'authoring-effective-pass.json'))).toBe(false);
      expect(
        JSON.parse(readFileSync(path.join(judgeRoot, 'aggregate.json'), 'utf8'))
      ).toMatchObject({
        decision: 'block',
        findingIds: ['GOAL-FINDING-001'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('blocks a provider pass that does not cover the exact closed candidate set', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-goal-judge-coverage-'));
    const deps = dependencies(normalizedResponse({ evidenceRefs: ['MUST-001'] }));
    const input = {
      projectRoot: root,
      authorityRoot: path.join(root, 'goal-run'),
      standaloneGoalSemanticIr: candidate(),
    };
    try {
      await expect(runStandaloneGoalAuthoringJudge(input, deps)).rejects.toMatchObject({
        message: 'standalone_goal_successor_required:authoring_judge',
        issueCodes: ['standalone_goal_authoring_judge_coverage_incomplete'],
      });
      expect(deps.invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });
});
