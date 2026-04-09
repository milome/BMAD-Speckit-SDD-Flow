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
import type { RunScoreRecord } from '../../packages/scoring/writer/types';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { createAcceptedPlaceholderDispatchAdapter } from '../../scripts/governance-packet-dispatch-worker';
import {
  readGovernanceCurrentRun,
  governanceCurrentRunPath,
  governanceDoneQueueFilePath,
  governancePendingQueueFilePath,
  type GovernanceRuntimeQueueItem,
} from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';
import {
  governanceAttemptLoopStatePath,
  runGovernanceRemediation,
} from '../../scripts/governance-remediation-runner';
import { writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
const runtimeWorkerHelper = require('../../_bmad/runtime/hooks/run-bmad-runtime-worker.cjs');

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
  cpSync(
    path.join(repoRoot, 'packages', 'runtime-emit', 'dist'),
    path.join(root, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'runtime-emit', 'dist'),
    { recursive: true }
  );
  cpSync(
    path.join(repoRoot, 'packages', 'scoring', 'schema'),
    path.join(root, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'scoring', 'schema'),
    { recursive: true }
  );
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
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 9) {
            throw error;
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
        }
      }
    },
  };
}

function writeScoreRecord(root: string, record: RunScoreRecord): void {
  const dataPath = path.join(root, 'packages', 'scoring', 'data');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(path.join(dataPath, `${record.run_id}.json`), JSON.stringify(record, null, 2), 'utf8');
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
                promptText:
                  '继续 implementation readiness patch，critical auditor 最小修复，不要联网。',
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
                availableSkills: ['speckit-workflow', 'code-reviewer'],
                skillPaths: [
                  'D:/skills/speckit-workflow/SKILL.md',
                  'D:/skills/code-reviewer/SKILL.md',
                ],
                skillInventory: [
                  {
                    skillId: 'speckit-workflow',
                    path: 'D:/skills/speckit-workflow/SKILL.md',
                  },
                  {
                    skillId: 'code-reviewer',
                    path: 'D:/skills/code-reviewer/SKILL.md',
                  },
                ],
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

      await processQueue(fixture.root, {
        dispatchAdapter: createAcceptedPlaceholderDispatchAdapter('runtime-worker placeholder dispatch'),
      });

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
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
      expect(currentRun.at(-1)?.result?.executionIntentCandidate).toMatchObject({
        source: 'prompt-hints',
        stage: 'readiness',
        action: 'patch',
        interactionMode: 'review-first',
        skillAvailabilityMode: 'advisory-only',
        matchedAvailableSkills: ['speckit-workflow', 'code-reviewer'],
        missingSkills: [],
        semanticSkillFeatures: expect.any(Array),
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        advisoryOnly: true,
      });
      expect(currentRun.at(-1)?.result?.executionPlanDecision).toMatchObject({
        source: 'prompt-hints',
        stage: 'readiness',
        action: 'patch',
        interactionMode: 'review-first',
        skillAvailabilityMode: 'execution-filtered',
        matchedAvailableSkills: ['speckit-workflow', 'code-reviewer'],
        missingSkills: [],
        semanticSkillFeatures: expect.any(Array),
        researchPolicy: 'forbidden',
        delegationPreference: 'ask-me-first',
        blockedByGovernance: ['entry-routing', 'blocker-ownership', 'artifact-target'],
        advisoryOnly: false,
      });
      expect(currentRun.at(-1)?.result?.executionPlanDecision?.skillChain).toEqual([
        'speckit-workflow',
        'code-reviewer',
      ]);
      expect(currentRun.at(-1)?.result?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Artifact Path: ' + secondOutput,
          '- Execution Stage: readiness',
          '- Execution Action: patch',
          '- Interaction Mode: review-first',
          '- Skill Availability Mode: execution-filtered',
          '- Available Skills: speckit-workflow, code-reviewer',
          '- Matched Available Skills: speckit-workflow, code-reviewer',
          '- Missing Skills: (none)',
        ])
      );
      expect(loopStateRaw.attemptCount).toBe(2);
      expect(loopStateRaw.attempts[0]?.rerunGateResult?.status).toBe('fail');
      expect(loopStateRaw.attempts[1]?.attemptId).toBe('attempt-runner-02');
      expect(readFileSync(secondOutput, 'utf8')).toContain('Outcome: blocked');
    } finally {
      fixture.cleanup();
    }
  });

  it('keeps journey contract remediation actions in worker-generated remediation packets', async () => {
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

      const outDir = path.join(
        fixture.root,
        '_bmad-output',
        'planning-artifacts',
        'feature-worker-hints'
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
        attemptId: 'attempt-runner-hints-01',
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

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-item-hints-01');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-item-hints-01',
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
                attemptId: 'attempt-runner-hints-02',
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

      await processQueue(fixture.root, {
        dispatchAdapter: createAcceptedPlaceholderDispatchAdapter('runtime-worker placeholder dispatch'),
      });

      const artifactText = readFileSync(secondOutput, 'utf8');
      const cursorPacket = readFileSync(secondOutput.replace(/\.md$/i, '.cursor-packet.md'), 'utf8');
      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      const doneItem = JSON.parse(
        readFileSync(governanceDoneQueueFilePath(fixture.root, 'queue-item-hints-01'), 'utf8')
      ) as GovernanceRuntimeQueueItem<unknown, GovernanceExecutionResult>;

      expect(artifactText).toContain('## Journey Contract Remediation Hints');
      expect(artifactText).toContain('Add at least one smoke task chain per Journey Slice');
      expect(cursorPacket).toContain('## Targeted Remediation Actions');
      expect(cursorPacket).toContain('## Executor Routing Decision');
      expect(cursorPacket).toContain('Routing Mode: targeted');
      expect(cursorPacket).toContain('Executor Route: journey-contract-remediation');
      expect(cursorPacket).toContain('Add at least one smoke task chain per Journey Slice');
      expect(cursorPacket).toContain('Add one closure note task for each Journey Slice');
      expect(
        currentRun.at(-1)?.result?.journeyContractHints?.map((item) => item.signal).sort()
      ).toEqual(['closure_task_id', 'smoke_task_chain']);
      expect(
        doneItem.result?.journeyContractHints?.map((item) => item.signal).sort()
      ).toEqual(['closure_task_id', 'smoke_task_chain']);
      expect(currentRun.at(-1)?.result?.executorRouting).toMatchObject({
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
      });
      expect(doneItem.result?.executorRouting).toMatchObject({
        routingMode: 'targeted',
        executorRoute: 'journey-contract-remediation',
        prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
      });
      expect(currentRun.at(-1)?.result?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: targeted',
          'Executor Route: journey-contract-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: closure_task_id, smoke_task_chain',
        ])
      );
      expect(doneItem.result?.remediationAuditTrace?.summaryLines).toEqual(
        expect.arrayContaining([
          'Routing Mode: targeted',
          'Executor Route: journey-contract-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: closure_task_id, smoke_task_chain',
        ])
      );
      expect(currentRun.at(-1)?.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
          '- Stop Reason: (none)',
          '- Journey Contract Signals: closure_task_id, smoke_task_chain',
        ])
      );
      expect(doneItem.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '## Governance Remediation Runner Summary',
          '## Loop State Trace Summary',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
          '- Stop Reason: (none)',
          '- Journey Contract Signals: closure_task_id, smoke_task_chain',
        ])
      );
      expect(currentRun.at(-1)?.result?.governancePresentation?.structuredMetadataLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '- Routing Mode: targeted',
          '- Executor Route: journey-contract-remediation',
        ])
      );
      expect(currentRun.at(-1)?.result?.governancePresentation?.rawEventLines).toEqual(
        expect.arrayContaining([
          '## Governance Latest Raw Event',
          '## Governance Remediation Runner Summary',
        ])
      );
      expect(doneItem.result?.governancePresentation?.combinedLines).toEqual(
        expect.arrayContaining([
          '## Governance Structured Metadata',
          '## Governance Latest Raw Event',
          '- Executor Route: journey-contract-remediation',
        ])
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('hook-local packaged worker can move a rerun item from pending to done/current-run without ts-node in consumer root', async () => {
    const fixture = createFixtureProject();
    try {
      const outDir = path.join(fixture.root, '_bmad-output', 'planning-artifacts', 'feature-worker-packaged');
      mkdirSync(outDir, { recursive: true });
      const output = path.join(outDir, 'attempt-packaged.md');

      const queuePath = governancePendingQueueFilePath(fixture.root, 'queue-item-packaged');
      mkdirSync(path.dirname(queuePath), { recursive: true });
      mkdirSync(path.join(fixture.root, '.claude', 'hooks'), { recursive: true });
      cpSync(
        path.join(process.cwd(), '_bmad', 'runtime', 'hooks'),
        path.join(fixture.root, '.claude', 'hooks'),
        { recursive: true }
      );
      cpSync(
        path.join(process.cwd(), '_bmad', 'runtime', 'hooks'),
        path.join(fixture.root, '.cursor', 'hooks'),
        { recursive: true }
      );
      cpSync(
        path.join(process.cwd(), 'packages', 'runtime-emit', 'dist'),
        path.join(fixture.root, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'runtime-emit', 'dist'),
        { recursive: true }
      );
      cpSync(
        path.join(process.cwd(), 'packages', 'scoring', 'schema'),
        path.join(fixture.root, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'schema'),
        { recursive: true }
      );
      writeFileSync(
        queuePath,
        JSON.stringify(
          {
            id: 'queue-item-packaged',
            type: 'governance-remediation-rerun',
            timestamp: '2026-03-28T02:00:00.000Z',
            payload: {
              projectRoot: fixture.root,
              configPath: fixture.configPath,
              runnerInput: {
                projectRoot: fixture.root,
                outputPath: output,
                promptText: 'packaged worker rerun',
                stageContextKnown: true,
                gateFailureExists: true,
                blockerOwnershipLocked: true,
                rootTargetLocked: true,
                equivalentAdapterCount: 1,
                attemptId: 'attempt-packaged-01',
                sourceGateFailureIds: ['PKG-1'],
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
              },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      const workerResult = runtimeWorkerHelper.runWorkerWithRunnerLock({
        projectRoot: fixture.root,
        onlyWhenPending: true,
      });

      expect(workerResult.status).toBe(0);
      const failedDebugPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'last-failed-debug.json'
      );
      if (existsSync(failedDebugPath)) {
        throw new Error(readFileSync(failedDebugPath, 'utf8'));
      }
      expect(existsSync(governanceDoneQueueFilePath(fixture.root, 'queue-item-packaged'))).toBe(true);
      expect(existsSync(governanceCurrentRunPath(fixture.root))).toBe(true);
      expect(existsSync(output)).toBe(true);
      expect(existsSync(output.replace(/\.md$/i, '.cursor-packet.md'))).toBe(true);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(fixture.root);
      expect(currentRun.at(-1)?.type).toBe('governance-remediation-rerun');
      expect(currentRun.at(-1)?.result?.artifactPath).toBe(output);
      expect(currentRun.at(-1)?.result?.rerunGateResultIngested).toBe(false);
      expect(currentRun.at(-1)?.result?.executionIntentCandidate).toBeTruthy();
      expect(currentRun.at(-1)?.result?.executionPlanDecision).toBeTruthy();
      expect(currentRun.at(-1)?.result?.executionIntentCandidate?.source).toBeTruthy();
      expect(currentRun.at(-1)?.result?.executionPlanDecision?.source).toBeTruthy();
      expect(currentRun.at(-1)?.result?.executorRouting).toMatchObject({
        routingMode: 'generic',
        executorRoute: 'default-gate-remediation',
      });
      expect(currentRun.at(-1)?.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([
          '- Routing Mode: generic',
          '- Executor Route: default-gate-remediation',
          '- Stop Reason: (none)',
          '- Journey Contract Signals: (none)',
        ])
      );
      expect(readFileSync(output, 'utf8')).toContain('## Governance Remediation Runner Summary');
      expect(readFileSync(output, 'utf8')).toContain('## Governance Remediation Runner Summary');
      expect(readFileSync(output.replace(/\.md$/i, '.cursor-packet.md'), 'utf8')).toContain(
        '## Governance Remediation Runner Summary'
      );
    } finally {
      fixture.cleanup();
    }
  });
});
