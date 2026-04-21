import {
  cpSync,
  existsSync as fsExistsSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunScoreRecord } from '../../packages/scoring/writer/types';
import { createStubGovernanceProviderAdapter } from '../../scripts/governance-provider-adapter';
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

function writeStubGovernanceConfig(root: string): string {
  const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  writeFileSync(
    configPath,
    [
      'version: 1',
      'primaryHost: codex',
      'packetHosts:',
      '  - codex',
      'provider:',
      '  mode: stub',
      '  id: test-governance-provider',
      '  stubCandidate:',
      '    source: model-provider',
      '    providerId: test-governance-provider',
      '    providerMode: stub',
      '    confidence: medium',
      '    suggestedStage: plan',
      '    suggestedAction: patch',
      '    explicitRolePreference:',
      '      - critical-auditor',
      '    recommendedSkillChain:',
      '      - provider-recommended-skill',
      '      - code-reviewer',
      '    recommendedSubagentRoles:',
      '      - provider-reviewer',
      '    recommendedSkillItems:',
      '      - value: provider-recommended-skill',
      '        reason: Provider wants a focused remediation lane.',
      '        confidence: high',
      '      - value: code-reviewer',
      '        reason: Provider wants review coverage in the chain.',
      '        confidence: medium',
      '    recommendedSubagentRoleItems:',
      '      - value: provider-reviewer',
      '        reason: Provider wants a reviewer role preserved.',
      '        confidence: medium',
      '    researchPolicy: forbidden',
      '    delegationPreference: ask-me-first',
      '    constraints:',
      '      - minimal-patch',
      '    rationale: Keep remediation bounded.',
      '    overrideAllowed: false',
      '',
    ].join('\n'),
    'utf8'
  );
  return configPath;
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
    recommendedSkillChain: ['provider-recommended-skill', 'code-reviewer'],
    recommendedSubagentRoles: ['provider-reviewer'],
    recommendedSkillItems: [
      {
        value: 'provider-recommended-skill',
        reason: 'Provider wants a focused remediation lane.',
        confidence: 'high',
      },
      {
        value: 'code-reviewer',
        reason: 'Provider wants review coverage in the chain.',
        confidence: 'medium',
      },
    ],
    recommendedSubagentRoleItems: [
      {
        value: 'provider-reviewer',
        reason: 'Provider wants a reviewer role preserved.',
        confidence: 'medium',
      },
    ],
    researchPolicy: 'forbidden',
    delegationPreference: 'ask-me-first',
    constraints: ['minimal-patch'],
    rationale: 'Keep remediation bounded.',
    overrideAllowed: false,
  });
}

function writeScoreRecord(root: string, record: RunScoreRecord): void {
  const dataPath = path.join(root, 'packages', 'scoring', 'data');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(
    path.join(dataPath, `${record.run_id}.json`),
    JSON.stringify(record, null, 2),
    'utf8'
  );
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

function shellQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function makeScoreRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e14-s1-tasks-1',
    scenario: 'real_dev',
    stage: 'tasks',
    phase_score: 61,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-28T12:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

function expectProviderSkillChainContract(
  skillChain: string[] | undefined,
  providerSkillItem:
    | {
        value: string;
        matchedSkillId?: string;
      }
    | undefined
): void {
  expect(skillChain).toBeDefined();
  expect(skillChain?.slice(-2)).toEqual(['code-reviewer', 'speckit-workflow']);
  expect(skillChain?.[0]).toBe(providerSkillItem?.matchedSkillId ?? 'provider-recommended-skill');
}

describe('governance remediation runner', () => {
  it('shows unavailable provider recommendations with fallback metadata in runner outputs', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-provider-fallback'
      );
      mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'provider-fallback.md');

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, outFile),
        attemptId: 'attempt-runner-fallback-01',
        providerAdapter: createStubGovernanceProviderAdapter({
          source: 'model-provider',
          providerId: 'fallback-provider',
          providerMode: 'stub',
          confidence: 'medium',
          suggestedStage: 'plan',
          suggestedAction: 'patch',
          explicitRolePreference: ['critical-auditor'],
          recommendedSkillChain: ['provider-unavailable-skill', 'code-reviewer'],
          recommendedSubagentRoles: ['provider-reviewer'],
          recommendedSkillItems: [
            {
              value: 'provider-unavailable-skill',
              reason: 'Provider suggested an unavailable skill.',
              confidence: 'medium',
            },
            {
              value: 'code-reviewer',
              reason: 'Provider wants review coverage in the chain.',
              confidence: 'medium',
            },
          ],
          recommendedSubagentRoleItems: [
            {
              value: 'provider-reviewer',
              reason: 'Provider wants a reviewer role preserved.',
              confidence: 'medium',
            },
          ],
          researchPolicy: 'forbidden',
          delegationPreference: 'ask-me-first',
          constraints: ['minimal-patch'],
          rationale: 'Test unavailable recommendation fallback.',
          overrideAllowed: false,
        }),
      });

      const written = readFileSync(outFile, 'utf8');
      expect(written).toContain(
        '  - provider-unavailable-skill [source=model-provider; confidence=medium; consumed=no; reason=Provider suggested an unavailable skill.; filteredBecause=replaced-by-better-match]'
      );
      expect(result.executionIntentCandidate?.providerRecommendationItems.skills).toEqual([
        {
          value: 'provider-unavailable-skill',
          source: 'model-provider',
          reason: 'Provider suggested an unavailable skill.',
          confidence: 'medium',
          consumed: false,
          matchedSkillId: 'build-error-resolver',
          matchedBy: 'token-overlap',
          matchScore: 500,
          filteredBecause: ['replaced-by-better-match'],
        },
        {
          value: 'code-reviewer',
          source: 'model-provider',
          reason: 'Provider wants review coverage in the chain.',
          confidence: 'medium',
          consumed: true,
          matchedSkillId: 'code-reviewer',
          matchedBy: 'exact-id',
          matchScore: 10000,
          filteredBecause: [],
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it('prints the persisted loop-state trace summary to CLI stdout', () => {
    const fixture = createFixtureProject();
    try {
      const configPath = writeStubGovernanceConfig(fixture.root);
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-cli');
      mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'implementation-readiness-remediation-cli.md');
      const command = [
        'npx',
        'ts-node',
        '--project', 'tsconfig.node.json',
        '--transpile-only',
        'scripts/governance-remediation-runner.ts',
        '--projectRoot',
        shellQuote(fixture.root),
        '--configPath',
        shellQuote(configPath),
        '--outputPath',
        shellQuote(outFile),
        '--promptText',
        shellQuote('做 implementation readiness 修复，不要联网，最小修复。'),
        '--stageContextKnown true',
        '--gateFailureExists true',
        '--blockerOwnershipLocked true',
        '--rootTargetLocked true',
        '--equivalentAdapterCount 2',
        '--attemptId',
        shellQuote('attempt-runner-cli-01'),
        '--sourceGateFailureIds',
        shellQuote('GF-100'),
        '--capabilitySlot qa.readiness',
        '--canonicalAgent',
        shellQuote('PM + QA / readiness reviewer'),
        '--actualExecutor',
        shellQuote('implementation readiness workflow'),
        '--adapterPath',
        shellQuote('local workflow fallback'),
        '--targetArtifacts',
        shellQuote('prd.md,architecture.md'),
        '--expectedDelta',
        shellQuote('close readiness blockers'),
        '--rerunOwner PM',
        '--rerunGate implementation-readiness',
        '--outcome blocked',
        '--stopReason',
        shellQuote('critical blockers remain open'),
      ].join(' ');

      const stdout = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      const written = readFileSync(outFile, 'utf8');

      expect(fsExistsSync(outFile)).toBe(true);
      expect(stdout).toContain('## Governance Remediation Runner Summary');
      expect(stdout).toContain('Loop State ID:');
      expect(stdout).toContain('Should Continue: yes');
      expect(stdout).toContain('## Loop State Trace Summary');
      expect(stdout).toContain('Routing Mode: generic');
      expect(stdout).toContain('Executor Route: default-gate-remediation');
      expect(stdout).toContain('Stop Reason: critical blockers remain open');
      expect(stdout).toContain('Journey Contract Signals: (none)');
      expect(written).toContain(
        '- Provider Recommended Skill Chain: provider-recommended-skill, code-reviewer'
      );
      expect(written).toContain(
        '- Provider Recommended Subagent Roles: provider-reviewer'
      );
      expect(written).toContain(
        'provider-recommended-skill [source=model-provider; confidence=high;'
      );
      expect(written).toContain('code-reviewer [source=model-provider; confidence=medium;');
      expect(written).toContain('- Skill Chain:');
      expect(written).toContain('code-reviewer');
      expect(written).toContain('speckit-workflow');
      expect(written).toContain(
        '- Subagent Roles: provider-reviewer, critical-auditor'
      );
    } finally {
      fixture.cleanup();
    }
  }, 60000);

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
      const written = readFileSync(outFile, 'utf8');
      expect(written).toContain('## Model Hint Debug');
      expect(written).toContain(
        '- Provider Recommended Skill Chain: provider-recommended-skill, code-reviewer'
      );
      expect(written).toContain(
        '- Provider Recommended Subagent Roles: provider-reviewer'
      );
      expect(written).toContain(
        '  - provider-reviewer [source=model-provider; confidence=medium; consumed=yes; reason=Provider wants a reviewer role preserved.; filteredBecause=(none)]'
      );
      expect(written).toContain('- Skill Chain:');
      expect(written).toContain('code-reviewer');
      expect(written).toContain('speckit-workflow');
      expect(written).toContain(
        '- Subagent Roles: provider-reviewer, critical-auditor'
      );
      expect(result.executionIntentCandidate?.skillChain).toEqual([
        'provider-recommended-skill',
        'code-reviewer',
        'speckit-workflow',
      ]);
      expectProviderSkillChainContract(
        result.executionPlanDecision?.skillChain,
        result.executionIntentCandidate?.providerRecommendationItems.skills[0]
      );
      expect(result.executionIntentCandidate?.subagentRoles).toEqual([
        'provider-reviewer',
        'critical-auditor',
      ]);
      expect(result.executionPlanDecision?.subagentRoles).toEqual([
        'provider-reviewer',
        'critical-auditor',
      ]);
      expect(result.executionIntentCandidate?.providerRecommendationItems.skills?.[0]).toMatchObject({
        value: 'provider-recommended-skill',
        source: 'model-provider',
        reason: 'Provider wants a focused remediation lane.',
        confidence: 'high',
      });
      expect(result.executionIntentCandidate?.providerRecommendationItems.skills?.[1]).toMatchObject({
        value: 'code-reviewer',
        source: 'model-provider',
        reason: 'Provider wants review coverage in the chain.',
        confidence: 'medium',
        matchedSkillId: 'code-reviewer',
        matchedBy: 'exact-id',
        matchScore: 10000,
      });
      expect(
        result.executionIntentCandidate?.providerRecommendationItems.skills?.[0]?.filteredBecause
      ).toEqual(
        expect.arrayContaining(
          result.executionIntentCandidate?.providerRecommendationItems.skills?.[0]?.matchedSkillId
            ? ['replaced-by-better-match']
            : ['not-available-in-inventory']
        )
      );
      expect(result.executionPlanDecision?.providerRecommendationItems.subagentRoles).toEqual([
        {
          value: 'provider-reviewer',
          source: 'model-provider',
          reason: 'Provider wants a reviewer role preserved.',
          confidence: 'medium',
          consumed: true,
          filteredBecause: [],
        },
      ]);
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

      const persisted = readGovernanceAttemptLoopState(fixture.root, result.loopState.loopStateId);

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

  it('injects targeted journey contract remediation actions into the artifact and executor packet', async () => {
    const fixture = createFixtureProject();
    try {
      writeScoreRecord(
        fixture.root,
        makeScoreRecord({
          journey_contract_signals: {
            smoke_task_chain: true,
            closure_task_id: true,
          },
        })
      );
      writeScoreRecord(
        fixture.root,
        makeScoreRecord({
          run_id: 'dev-e99-s9-tasks-2',
          journey_contract_signals: {
            shared_path_reference: true,
          },
        })
      );

      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-hints');
      mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'implementation-readiness-remediation-2026-03-28.md');

      const result = await runGovernanceRemediation({
        ...baseInput(fixture.root, outFile),
        attemptId: 'attempt-runner-hints-01',
      });

      const written = readFileSync(outFile, 'utf8');
      expect(written).toContain('## Journey Contract Remediation Hints');
      expect(written).toContain('smoke_task_chain');
      expect(written).toContain('closure_task_id');
      expect(written).toContain('Add at least one smoke task chain per Journey Slice');
      expect(written).toContain('Add one closure note task for each Journey Slice');
      expect(written).not.toContain('shared_path_reference');
      expect(
        result.artifactResult?.journeyContractHints?.map((item) => item.signal).sort()
      ).toEqual(['closure_task_id', 'smoke_task_chain']);
      expect(result.journeyContractHints?.map((item) => item.signal).sort()).toEqual([
        'closure_task_id',
        'smoke_task_chain',
      ]);
      expect(result.executorPacket?.routingMode).toBe('targeted');
      expect(result.executorPacket?.executorRoute).toBe('journey-contract-remediation');
      expect(result.executorPacket?.prioritizedSignals).toEqual([
        'closure_task_id',
        'smoke_task_chain',
      ]);
      expect(result.executorPacket?.prompt).toContain('## Targeted Remediation Actions');
      expect(result.executorPacket?.prompt).toContain('## Executor Routing Decision');
      expect(result.executorPacket?.prompt).toContain('Routing Mode: targeted');
      expect(result.executorPacket?.prompt).toContain(
        'Executor Route: journey-contract-remediation'
      );
      expect(result.executorPacket?.prompt).toContain(
        'Prioritized Signals: closure_task_id, smoke_task_chain'
      );
      expect(result.executorPacket?.prompt).toContain(
        'Add at least one smoke task chain per Journey Slice'
      );
      expect(result.executorPacket?.prompt).toContain(
        'Add one closure note task for each Journey Slice'
      );
      expect(result.executorPacket?.prompt).not.toContain(
        'Require multi-agent tasks to reference the same journey ledger'
      );
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
